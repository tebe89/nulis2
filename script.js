const getEl = id => document.getElementById(id);
let timerInterval, abortController;

// UI Helpers
window.showPopup = (msg, engineNum) => {
    let seconds = 0; getEl('popupTimer').innerText = "0s";
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { seconds++; getEl('popupTimer').innerText = seconds + "s"; }, 1000);
    getEl('aiPopup').classList.remove('hidden');
    getEl('popupStatus').innerText = msg;
    const st = getEl('engineStatus');
    if(engineNum === 1) { st.innerText = "ENGINE 1: WRITING..."; st.className = "text-green-500 font-bold italic text-[10px]"; }
    else if(engineNum === 2) { st.innerText = "ENGINE 2: ARCHIVING..."; st.className = "text-blue-500 font-bold italic text-[10px]"; }
    else { st.innerText = "PROCESSING..."; st.className = "text-gray-500 font-bold italic text-[10px]"; }
};
window.hidePopup = () => { getEl('aiPopup').classList.add('hidden'); clearInterval(timerInterval); };
window.cancelProcess = () => { if (abortController) { abortController.abort(); window.hidePopup(); } };

// Stable Engine Connector
window.checkEngine = async (num) => {
    const key = getEl(`apiKey${num}`).value.trim();
    if(!key) return alert("Masukkan API Key!");
    window.showPopup(`Koneksi Engine ${num}...`);
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if(data.models) {
            const sel = getEl(`modelSelect${num}`);
            const btn = getEl(`btnCheck${num}`);
            const mods = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            sel.innerHTML = mods.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            sel.classList.remove('hidden');
            btn.innerText = `ENGINE ${num} AKTIF ✓`;
            btn.classList.add(num === 1 ? 'bg-green-900' : 'bg-blue-900');
            window.saveDraft();
        } else { alert("Key Invalid."); }
    } catch (e) { alert("Koneksi Gagal."); }
    finally { window.hidePopup(); }
};

// Core API Call
async function callAI(num, prompt) {
    const key = getEl(`apiKey${num}`).value;
    const model = getEl(`modelSelect${num}`).value;
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.85, maxOutputTokens: 8192 } })
    });
    const d = await res.json();
    return d.candidates[0].content.parts[0].text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
}

window.planNovel = async () => {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi Konsep.");
    window.showPopup("Engine 2 Merancang Alur...", 2);
    try {
        const c = getEl('chapterCount').value;
        const p = `Buat alur novel JSON murni: [{"label":"Prolog","judul":"...","ringkasan":"..."},{"label":"Bab 1","judul":"...","ringkasan":"..."},{"label":"Epilog","judul":"...","ringkasan":"..."}]. Total bab tengah ${c}. Konsep: ${idea}`;
        const raw = await callAI(2, p);
        const json = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        window.renderWorkspace(JSON.parse(json), getEl('novelTitle').value);
        window.saveDraft();
    } catch (e) { alert("Gagal Rancang Alur."); }
    finally { window.hidePopup(); }
};

window.writeChapter = async (i) => {
    const ls = document.querySelectorAll('.ch-label'), ts = document.querySelectorAll('.ch-title-input'), 
          ss = document.querySelectorAll('.ch-summary-input'), bs = document.querySelectorAll('.ch-bridge-input');
    
    window.showPopup(`Engine 1 Menulis ${ls[i].innerText}...`, 1);
    let mem = i > 0 ? `INGATAN SEBELUMNYA: ${bs[i-1].value}\n` : "Awal Cerita.\n";
    const p = `Tulis narasi mendalam untuk ${ls[i].innerText}: ${ts[i].value}.\n${mem}\nALUR: ${ss[i].value}\nGenre: ${getEl('genre').value} | Gaya: ${getEl('style').value}\nATURAN: Minimal 1500 kata, deskriptif, EYD sempurna, JANGAN tulis label bab di awal teks.`;

    try {
        const res = await callAI(1, p);
        document.querySelectorAll('.ch-content-input')[i].value = res;
        window.saveDraft();
        // Auto Bridge
        window.showPopup(`Engine 2 Meringkas Memori...`, 2);
        const bp = `Ringkas poin penting (lokasi, barang, emosi karakter) untuk bab selanjutnya: ${res.substring(0, 3000)}`;
        const br = await callAI(2, bp);
        document.querySelectorAll('.ch-bridge-input')[i].value = br;
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Error Penulisan."); }
    finally { window.hidePopup(); }
};

window.renderWorkspace = (plan, title) => {
    getEl('mainPlaceholder').classList.add('hidden');
    getEl('displayTitle').innerText = title || "Karya Tebe";
    getEl('novelWorkspace').classList.remove('hidden');
    getEl('chaptersArea').innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-8 rounded-[2rem] border border-gray-900 shadow-2xl">
            <div class="flex justify-between items-center border-b border-gray-800 pb-6 mb-6">
                <div class="flex-1">
                    <span class="ch-label text-[10px] gold-text font-black uppercase tracking-widest">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-2xl font-black bg-transparent outline-none text-white novel-font italic" value="${item.judul}" oninput="window.saveDraft()">
                </div>
                <button onclick="writeChapter(${i})" class="bg-white text-black px-10 py-3 rounded-full text-xs font-black hover:bg-yellow-500 transition shadow-lg">TULIS BAB</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <textarea class="ch-summary-input summary-box" rows="4" placeholder="Alur Bab..." oninput="window.saveDraft()">${item.summary || item.ringkasan || ""}</textarea>
                <textarea class="ch-bridge-input bridge-box" rows="4" placeholder="Memory Bridge (Otomatis)..." oninput="window.saveDraft()">${item.bridge || ""}</textarea>
            </div>
            <textarea class="ch-content-input content-box mt-6" rows="20" placeholder="Hasil narasi akan muncul di sini..." oninput="window.saveDraft()">${item.content || ""}</textarea>
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
    localStorage.setItem('tebe_v15_final', JSON.stringify({
        k1: getEl('apiKey1').value, k2: getEl('apiKey2').value,
        m1: getEl('modelSelect1').value, m2: getEl('modelSelect2').value,
        title: getEl('novelTitle').value, genre: getEl('genre').value,
        style: getEl('style').value, idea: getEl('storyIdea').value,
        count: getEl('chapterCount').value,
        visible: !getEl('novelWorkspace').classList.contains('hidden'),
        chapters: chapters
    }));
};

window.onload = () => {
    const saved = localStorage.getItem('tebe_v15_final');
    if (!saved) return;
    const d = JSON.parse(saved);
    getEl('apiKey1').value = d.k1||""; getEl('apiKey2').value = d.k2||"";
    getEl('novelTitle').value = d.title||""; getEl('genre').value = d.genre||"";
    getEl('style').value = d.style||""; getEl('storyIdea').value = d.idea||"";
    getEl('chapterCount').value = d.count||3;
    if(d.k1) window.checkEngine(1); if(d.k2) window.checkEngine(2);
    if(d.visible) window.renderWorkspace(d.chapters, d.title);
};

window.clearAllData = () => { if(confirm("Hapus draf?")) { localStorage.clear(); location.reload(); } };
