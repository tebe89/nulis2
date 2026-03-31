const getEl = id => document.getElementById(id);
let timerInterval, abortController;

// --- POPUP HANDLER ---
window.showPopup = (msg, engineNum) => {
    let seconds = 0;
    getEl('popupTimer').innerText = "0s";
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { seconds++; getEl('popupTimer').innerText = seconds + "s"; }, 1000);
    getEl('aiPopup').classList.remove('hidden');
    getEl('popupStatus').innerText = msg;
    const status = getEl('engineStatus');
    if(engineNum === 1) { 
        status.innerText = "ENGINE 1: WRITING..."; 
        status.className = "text-green-500 text-[10px] font-bold tracking-widest"; 
    } else if(engineNum === 2) { 
        status.innerText = "ENGINE 2: ARCHIVING..."; 
        status.className = "text-blue-400 text-[10px] font-bold tracking-widest"; 
    } else { 
        status.innerText = "DUAL ENGINE ACTIVE"; 
        status.className = "text-gray-500 text-[10px] font-bold tracking-widest"; 
    }
};
window.hidePopup = () => { getEl('aiPopup').classList.add('hidden'); clearInterval(timerInterval); };
window.cancelProcess = () => { if (abortController) { abortController.abort(); window.hidePopup(); } };

// --- ENGINE CHECKER ---
window.checkSpecificEngine = async (num) => {
    const keyInput = getEl(`apiKey${num}`);
    const key = keyInput ? keyInput.value.trim() : "";
    
    if(!key) {
        alert(`Tolong masukkan API Key untuk Engine ${num} dulu.`);
        return;
    }
    
    window.showPopup(`Mencoba Engine ${num}...`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        
        if (data.models) {
            const select = getEl(`modelSelect${num}`);
            const btn = getEl(`btnCheck${num}`);
            
            const mods = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            select.innerHTML = mods.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            
            select.classList.remove('hidden');
            btn.innerText = `ENGINE ${num} AKTIF ✓`;
            btn.style.backgroundColor = num === 1 ? "#064e3b" : "#1e3a8a";
            btn.style.color = "white";
            
            window.saveDraft();
        } else {
            alert(`Error Engine ${num}: ${data.error ? data.error.message : 'Key salah atau limit'}`);
        }
    } catch (e) {
        console.error(e);
        alert(`Gagal koneksi Engine ${num}. Cek koneksi internet.`);
    } finally {
        window.hidePopup();
    }
};

// --- CORE LOGIC ---
async function callAI(num, prompt) {
    const key = getEl(`apiKey${num}`).value;
    const model = getEl(`modelSelect${num}`).value;
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 8192 } })
    });
    const data = await res.json();
    if (data.candidates && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
    }
    throw new Error("AI tidak merespon.");
}

window.planNovel = async () => {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi konsep dulu!");
    window.showPopup("Engine 2 Merancang Alur...", 2);
    try {
        const count = getEl('chapterCount').value;
        const prompt = `Buat alur novel JSON murni: [{"label":"Prolog","judul":"...","ringkasan":"..."},{"label":"Bab 1","judul":"...","ringkasan":"..."},{"label":"Epilog","judul":"...","ringkasan":"..."}]. Total bab tengah ${count}. Ide: ${idea}`;
        const raw = await callAI(2, prompt);
        const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        window.renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
        window.saveDraft();
    } catch (e) { alert("Gagal merancang: " + e.message); }
    finally { window.hidePopup(); }
};

window.writeChapter = async (i) => {
    const labels = document.querySelectorAll('.ch-label');
    const titles = document.querySelectorAll('.ch-title-input');
    const summaries = document.querySelectorAll('.ch-summary-input');
    const bridges = document.querySelectorAll('.ch-bridge-input');
    
    window.showPopup(`Engine 1 Menulis ${labels[i].innerText}...`, 1);
    let memory = i > 0 ? `MEMORI BAB SEBELUMNYA: ${bridges[i-1].value}\n` : "Ini adalah awal cerita.\n";
    const prompt = `Tulis narasi mendalam untuk ${labels[i].innerText}: ${titles[i].value}.\n${memory}\nALUR: ${summaries[i].value}\nGenre: ${getEl('genre').value} | Gaya: ${getEl('style').value}\nATURAN: Minimal 1500 kata, deskriptif tinggi, EYD sempurna, satu bab saja.`;

    try {
        const result = await callAI(1, prompt);
        document.querySelectorAll('.ch-content-input')[i].value = result;
        window.saveDraft();

        window.showPopup(`Engine 2 Mengarsipkan Memori...`, 2);
        const bridgePrompt = `Analisis bab ini dan ringkas poin penting untuk bab depan: ${result.substring(0, 3000)}`;
        const bridgeRes = await callAI(2, bridgePrompt);
        document.querySelectorAll('.ch-bridge-input')[i].value = bridgeRes;
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Error: " + e.message); }
    finally { window.hidePopup(); }
};

// --- UI RENDER & STORAGE ---
window.renderWorkspace = (plan, title) => {
    getEl('mainPlaceholder').classList.add('hidden');
    getEl('displayTitle').innerText = title || "Karya Tebe";
    getEl('novelWorkspace').classList.remove('hidden');
    getEl('chaptersArea').innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 mb-8 shadow-2xl">
            <div class="flex justify-between border-b border-gray-800 pb-4 mb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none text-white novel-font" value="${item.judul}" oninput="window.saveDraft()">
                </div>
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-8 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500 transition">TULIS</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea class="ch-summary-input summary-box" rows="3" oninput="window.saveDraft()">${item.summary || item.ringkasan}</textarea>
                <textarea class="ch-bridge-input bridge-box" rows="3" oninput="window.saveDraft()">${item.bridge || ""}</textarea>
            </div>
            <textarea class="ch-content-input content-box mt-4" rows="18" oninput="window.saveDraft()">${item.content || ""}</textarea>
        </div>
    `).join('');
};

window.saveDraft = () => {
    const chapters = [];
    document.querySelectorAll('.chapter-card').forEach(card => {
        chapters.push({
            label: card.querySelector('.ch-label').innerText,
            judul: card.querySelector('.ch-title-input').value,
            summary: card.querySelector('.ch-summary-input').value,
            bridge: card.querySelector('.ch-bridge-input').value,
            content: card.querySelector('.ch-content-input').value
        });
    });
    const data = {
        k1: getEl('apiKey1').value, k2: getEl('apiKey2').value,
        m1: getEl('modelSelect1').value, m2: getEl('modelSelect2').value,
        title: getEl('novelTitle').value, genre: getEl('genre').value,
        style: getEl('style').value, idea: getEl('storyIdea').value,
        count: getEl('chapterCount').value,
        visible: !getEl('novelWorkspace').classList.contains('hidden'),
        chapters: chapters
    };
    localStorage.setItem('tebe_v15_final', JSON.stringify(data));
};

window.onload = () => {
    const saved = localStorage.getItem('tebe_v15_final');
    if (!saved) return;
    const data = JSON.parse(saved);
    getEl('apiKey1').value = data.k1 || "";
    getEl('apiKey2').value = data.k2 || "";
    getEl('novelTitle').value = data.title || "";
    getEl('genre').value = data.genre || "";
    getEl('style').value = data.style || "";
    getEl('storyIdea').value = data.idea || "";
    getEl('chapterCount').value = data.count || 3;
    
    // Auto-connect jika sudah ada key
    if(data.k1) window.checkSpecificEngine(1);
    if(data.k2) window.checkSpecificEngine(2);
    if(data.visible) window.renderWorkspace(data.chapters, data.title);
};
