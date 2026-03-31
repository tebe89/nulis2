const getEl = id => document.getElementById(id);
let timerInterval, abortController;

// --- POPUP ---
window.showPopup = (msg, isMemory = false) => {
    let seconds = 0;
    getEl('popupTimer').innerText = "0s";
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { seconds++; getEl('popupTimer').innerText = seconds + "s"; }, 1000);
    getEl('aiPopup').classList.remove('hidden');
    getEl('popupStatus').innerText = msg;
    getEl('engineStatus').innerText = isMemory ? "ENGINE 2: ARCHIVING..." : "ENGINE 1: WRITING...";
    getEl('engineStatus').className = isMemory ? "text-blue-400 text-[10px] font-bold tracking-widest" : "text-green-500 text-[10px] font-bold tracking-widest";
};
window.hidePopup = () => { getEl('aiPopup').classList.add('hidden'); clearInterval(timerInterval); };
window.cancelProcess = () => { if (abortController) { abortController.abort(); window.hidePopup(); } };

// --- STORAGE ---
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
        key1: getEl('apiKey1').value,
        key2: getEl('apiKey2').value,
        model1: getEl('modelSelect1').value,
        model2: getEl('modelSelect2').value,
        title: getEl('novelTitle').value,
        genre: getEl('genre').value,
        style: getEl('style').value,
        idea: getEl('storyIdea').value,
        chapterCount: getEl('chapterCount').value,
        workspaceVisible: !getEl('novelWorkspace').classList.contains('hidden'),
        chapters: chapters
    };
    localStorage.setItem('tebe_v15_dual', JSON.stringify(data));
};

window.loadDraft = () => {
    const saved = localStorage.getItem('tebe_v15_dual');
    if (!saved) return;
    const data = JSON.parse(saved);
    getEl('apiKey1').value = data.key1 || "";
    getEl('apiKey2').value = data.key2 || "";
    getEl('novelTitle').value = data.title || "";
    getEl('genre').value = data.genre || "";
    getEl('style').value = data.style || "";
    getEl('storyIdea').value = data.idea || "";
    getEl('chapterCount').value = data.chapterCount || 3;
    if (data.key1 && data.key2) window.checkEngines(true);
    if (data.workspaceVisible) window.renderWorkspace(data.chapters, data.title);
};

// --- DUAL ENGINE HANDLER ---
window.checkEngines = async (isSilent = false) => {
    const k1 = getEl('apiKey1').value.trim();
    const k2 = getEl('apiKey2').value.trim();
    if(!k1 || !k2) return isSilent ? null : alert("Masukkan Kedua API Key!");
    
    if(!isSilent) window.showPopup("Sinkronisasi Dual Engine...");
    try {
        const [res1, res2] = await Promise.all([
            fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k1}`),
            fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k2}`)
        ]);
        const [d1, d2] = await Promise.all([res1.json(), res2.json()]);
        
        if(d1.models && d2.models) {
            getEl('savedTag').classList.remove('hidden');
            const fillSelect = (select, data) => {
                const mods = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
                select.innerHTML = mods.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            };
            fillSelect(getEl('modelSelect1'), d1);
            fillSelect(getEl('modelSelect2'), d2);
            
            const saved = JSON.parse(localStorage.getItem('tebe_v15_dual'));
            if(saved) {
                if(saved.model1) getEl('modelSelect1').value = saved.model1;
                if(saved.model2) getEl('modelSelect2').value = saved.model2;
            }
            
            getEl('engineWrapper').classList.remove('hidden');
            window.saveDraft();
        }
    } catch (e) { if(!isSilent) alert("Gagal koneksi engine."); }
    finally { window.hidePopup(); }
};

async function callAI(engineNum, prompt) {
    const key = getEl(`apiKey${engineNum}`).value;
    const model = getEl(`modelSelect${engineNum}`).value;
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 8192 } })
    });
    const data = await res.json();
    return data.candidates[0].content.parts[0].text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
}

// --- LOGIC ---
window.planNovel = async () => {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi Ide Dunia!");
    window.showPopup("Engine 2 Merancang Alur...", true);
    try {
        const count = getEl('chapterCount').value;
        // Gunakan Engine 2 (The Architect) untuk merancang
        const prompt = `Buat alur novel JSON murni: [{"label":"Prolog","judul":"...","ringkasan":"..."},{"label":"Bab 1","judul":"...","ringkasan":"..."},{"label":"Epilog","judul":"...","ringkasan":"..."}]. Total bab tengah ${count}. Ide: ${idea}`;
        const raw = await callAI(2, prompt);
        const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        window.renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
        window.saveDraft();
    } catch (e) { alert("Gagal merancang."); }
    finally { window.hidePopup(); }
};

window.writeChapter = async (i) => {
    const labels = document.querySelectorAll('.ch-label');
    const titles = document.querySelectorAll('.ch-title-input');
    const summaries = document.querySelectorAll('.ch-summary-input');
    const bridges = document.querySelectorAll('.ch-bridge-input');
    
    // 1. ENGINE 1 MENULIS CERITA
    window.showPopup(`Engine 1 Menulis ${labels[i].innerText}...`);
    let memory = i > 0 ? `INGATAN DARI SEBELUMNYA: ${bridges[i-1].value}\n` : "Awal Cerita.\n";
    const writePrompt = `Tulis naskah narasi mendalam untuk ${labels[i].innerText}: ${titles[i].value}.
    Genre: ${getEl('genre').value} | Gaya: ${getEl('style').value}
    ${memory}
    ALUR: ${summaries[i].value}
    PENTING: Minimal 1500 kata, deskriptif, EYD sempurna, satu bab saja.`;

    try {
        const result = await callAI(1, writePrompt);
        document.querySelectorAll('.ch-content-input')[i].value = result;
        window.saveDraft();

        // 2. ENGINE 2 OTOMATIS MEMBUAT BRIDGE (PARALEL)
        window.showPopup(`Engine 2 Mengarsipkan Memori...`, true);
        const bridgePrompt = `Analisis Bab ini dan ringkas poin penting (posisi karakter, benda, emosi) untuk bab depan. 
        TEKS: ${result.substring(0, 3000)}`;
        const bridgeResult = await callAI(2, bridgePrompt);
        document.querySelectorAll('.ch-bridge-input')[i].value = bridgeResult;
        window.saveDraft();
        
    } catch (e) { if(e.name !== 'AbortError') alert("Error."); }
    finally { window.hidePopup(); }
};

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
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-8 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500">TULIS</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <span class="text-[9px] text-gray-500 uppercase font-bold">Rencana Alur</span>
                    <textarea class="ch-summary-input summary-box mt-1" rows="3" oninput="window.saveDraft()">${item.summary || item.ringkasan}</textarea>
                </div>
                <div>
                    <span class="text-[9px] text-blue-500 uppercase font-bold">Memory Bridge (Editable)</span>
                    <textarea class="ch-bridge-input bridge-box mt-1" rows="3" placeholder="Terisi otomatis oleh Engine 2..." oninput="window.saveDraft()">${item.bridge || ""}</textarea>
                </div>
            </div>
            <textarea class="ch-content-input content-box mt-4" rows="18" oninput="window.saveDraft()">${item.content || ""}</textarea>
            <div class="flex justify-end gap-2 mt-2">
                <button onclick="window.downloadSingle(${i}, 'txt')" class="text-[9px] bg-gray-800 px-4 py-2 rounded">TXT</button>
                <button onclick="window.downloadSingle(${i}, 'html')" class="text-[9px] border border-gray-800 px-4 py-2 rounded">HTML</button>
            </div>
        </div>
    `).join('');
};

const htmlHeader = (title) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@700&display=swap');
    body { background:#f4ece0; color:#2c2c2c; font-family:'Crimson Pro',serif; line-height:1.8; margin:0; padding:0; text-align:justify; }
    .page { max-width: 95%; margin: 10px auto; background: white; padding: 25px; box-shadow: 0 0 10px rgba(0,0,0,0.05); border-radius: 5px; }
    @media (min-width: 768px) { .page { max-width: 800px; padding: 60px 80px; margin: 40px auto; } }
    h1 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 2.8rem; margin: 40px 0; }
    h2 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 2rem; border-bottom: 2px double #eee; padding-bottom: 10px; margin-top: 50px; }
    p { margin-bottom: 1.5rem; text-indent: 3.5rem; font-size: 1.3rem; }
    .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 10px double #8b6b23; margin: 15px; background:white; }
</style></head><body>`;

window.downloadSingle = (i, format) => {
    const card = document.querySelectorAll('.chapter-card')[i];
    const t = card.querySelector('.ch-title-input').value;
    const l = card.querySelector('.ch-label').innerText;
    const c = card.querySelector('.ch-content-input').value;
    let res = (format === 'html') ? `${htmlHeader(t)}<div class="page"><h2>${l}: ${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div></body></html>` : `[ ${l} - ${t} ]\n\n${c}`;
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${l}_${t}.${format}`; a.click();
};

window.downloadFull = (format) => {
    const title = getEl('novelTitle').value || 'Novel';
    let res = "";
    if (format === 'html') {
        res = `${htmlHeader(title)}<div class="cover"><h1>${title}</h1><p>Mahakarya Sastra Modern</p></div>`;
        document.querySelectorAll('.chapter-card').forEach(card => {
            const l = card.querySelector('.ch-label').innerText;
            const t = card.querySelector('.ch-title-input').value;
            const c = card.querySelector('.ch-content-input').value;
            res += `<div class="page"><h2>${l}: ${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div>`;
        });
        res += "</body></html>";
    } else {
        document.querySelectorAll('.chapter-card').forEach(card => {
            const l = card.querySelector('.ch-label').innerText;
            const t = card.querySelector('.ch-title-input').value;
            const c = card.querySelector('.ch-content-input').value;
            res += `\n\n--- ${l.toUpperCase()} : ${t.toUpperCase()} ---\n\n${c}`;
        });
    }
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${title}_Full.${format}`; a.click();
};

window.clearAllData = () => { if(confirm("Hapus memori draf?")) { localStorage.clear(); location.reload(); } };
window.onload = window.loadDraft;
                            
