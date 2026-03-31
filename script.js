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
    const st = getEl('engineStatus');
    if(engineNum === 1) { 
        st.innerText = "ENGINE 1: MENULIS NARASI UTUH..."; 
        st.className = "text-green-500 text-[10px] font-bold tracking-widest"; 
    } else if(engineNum === 2) { 
        st.innerText = "ENGINE 2: MENYAMBUNG BENANG MERAH..."; 
        st.className = "text-blue-400 text-[10px] font-bold tracking-widest"; 
    } else { 
        st.innerText = "DUAL ENGINE AKTIF"; 
        st.className = "text-gray-500 text-[10px] font-bold tracking-widest"; 
    }
};
window.hidePopup = () => { getEl('aiPopup').classList.add('hidden'); clearInterval(timerInterval); };
window.cancelProcess = () => { if (abortController) { abortController.abort(); window.hidePopup(); } };

// --- ENGINE CHECKER ---
window.checkSpecificEngine = async (num) => {
    const key = getEl(`apiKey${num}`).value.trim();
    if(!key) return alert(`Masukkan API Key untuk Engine ${num}!`);
    window.showPopup(`Koneksi Engine ${num}...`);
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if(data.models) {
            const select = getEl(`modelSelect${num}`);
            const btn = getEl(`btnCheck${num}`);
            const mods = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            select.innerHTML = mods.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            select.classList.remove('hidden');
            btn.innerText = `ENGINE ${num} READY ✓`;
            btn.style.backgroundColor = num === 1 ? "#064e3b" : "#1e3a8a";
            btn.style.color = "white";
            window.saveDraft();
        }
    } catch (e) { alert(`Gagal koneksi Engine ${num}.`); }
    finally { window.hidePopup(); }
};

async function callAI(num, prompt) {
    const key = getEl(`apiKey${num}`).value;
    const model = getEl(`modelSelect${num}`).value;
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 8192 } })
    });
    const d = await res.json();
    return d.candidates[0].content.parts[0].text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
}

// --- LOGIKA PENULISAN ANTI-TUMPANG TINDIH ---
window.writeChapter = async (i) => {
    const ls = document.querySelectorAll('.ch-label'),
          ts = document.querySelectorAll('.ch-title-input'),
          ss = document.querySelectorAll('.ch-summary-input'),
          bs = document.querySelectorAll('.ch-bridge-input'),
          cs = document.querySelectorAll('.ch-content-input');
    
    window.showPopup(`Engine 1 Menulis ${ls[i].innerText}...`, 1);

    // Ambil 1000 karakter terakhir dari bab sebelumnya agar nada ceritanya sama
    let previousTail = "";
    if (i > 0 && cs[i-1].value) {
        previousTail = `\nAKHIR DARI BAB SEBELUMNYA (SAMBUNGKAN NARASI DARI TITIK INI):\n...${cs[i-1].value.slice(-1000)}\n`;
    }

    const writePrompt = `Anda adalah penulis novel profesional. Tugas Anda adalah menulis ${ls[i].innerText} agar menjadi bagian yang mengalir sempurna dari buku ini.

    JUDUL NOVEL: ${getEl('novelTitle').value}
    KONSEP DUNIA: ${getEl('storyIdea').value}
    GAYA: ${getEl('style').value} | GENRE: ${getEl('genre').value}

    ${previousTail}
    MEMORI ALUR: ${i > 0 ? bs[i-1].value : "Awal cerita."}
    ALUR BAB INI: ${ss[i].value}

    PERATURAN KETAT (ANTI-TUMPANG TINDIH):
    1. INI ADALAH KELANJUTAN LANGSUNG. Jangan melakukan perkenalan karakter atau dunia lagi.
    2. JANGAN mengulang kejadian yang sudah terjadi di bab sebelumnya. 
    3. Langsung mulai narasi dari posisi terakhir karakter. Jangan mulai dengan sapaan atau ringkasan.
    4. Minimal 1500 kata. Gunakan EYD, koma, titik, dan spasi yang sempurna.`;

    try {
        const result = await callAI(1, writePrompt);
        cs[i].value = result;
        window.saveDraft();

        // Engine 2 Meringkas untuk bab selanjutnya
        window.showPopup(`Engine 2 Mengunci Benang Merah...`, 2);
        const bridgePrompt = `Analisis Bab ini dan buat catatan sejarah singkat agar bab selanjutnya tidak tumpang tindih. 
        Catat: Kejadian kunci, barang yang didapat, dan posisi/emosi terakhir karakter.
        TEKS: ${result.substring(0, 3000)}`;
        const bridgeRes = await callAI(2, bridgePrompt);
        bs[i].value = bridgeRes;
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Gagal Menulis."); }
    finally { window.hidePopup(); }
};

window.planNovel = async () => {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi konsep dunia dulu.");
    window.showPopup("Engine 2 Merancang Alur...", 2);
    try {
        const c = getEl('chapterCount').value;
        const p = `Buat alur novel JSON murni: [{"label":"Prolog","judul":"...","ringkasan":"..."},{"label":"Bab 1","judul":"...","ringkasan":"..."},{"label":"Epilog","judul":"...","ringkasan":"..."}]. Total bab utama ${c}. Konsep: ${idea}`;
        const raw = await callAI(2, p);
        const json = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        window.renderWorkspace(JSON.parse(json), getEl('novelTitle').value);
        window.saveDraft();
    } catch (e) { alert("Gagal Rancang."); }
    finally { window.hidePopup(); }
};

window.renderWorkspace = (plan, title) => {
    getEl('mainPlaceholder').classList.add('hidden');
    getEl('displayTitle').innerText = title || "Karya Tebe";
    getEl('novelWorkspace').classList.remove('hidden');
    getEl('chaptersArea').innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 mb-8 shadow-2xl">
            <div class="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none text-white novel-font" value="${item.judul}" oninput="window.saveDraft()">
                </div>
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-8 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500 transition">TULIS BAB</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea class="ch-summary-input summary-box" rows="3" oninput="window.saveDraft()" placeholder="Alur...">${item.summary || item.ringkasan || ""}</textarea>
                <textarea class="ch-bridge-input bridge-box" rows="3" oninput="window.saveDraft()" placeholder="Memori Sejarah (Otomatis)...">${item.bridge || ""}</textarea>
            </div>
            <textarea class="ch-content-input content-box mt-4" rows="18" oninput="window.saveDraft()" placeholder="Narasi utuh...">${item.content || ""}</textarea>
            <div class="flex justify-end gap-2 mt-2">
                <button onclick="window.downloadSingle(${i}, 'txt')" class="text-[9px] bg-gray-800 px-3 py-1 rounded">TXT</button>
                <button onclick="window.downloadSingle(${i}, 'html')" class="text-[9px] border border-gray-800 px-3 py-1 rounded">HTML</button>
            </div>
        </div>
    `).join('');
};

// --- STORAGE & DOWNLOAD ---
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

window.loadDraft = () => {
    const saved = localStorage.getItem('tebe_v15_final');
    if (!saved) return;
    const d = JSON.parse(saved);
    getEl('apiKey1').value = d.k1||""; getEl('apiKey2').value = d.k2||"";
    getEl('novelTitle').value = d.title||""; getEl('genre').value = d.genre||"";
    getEl('style').value = d.style||""; getEl('storyIdea').value = d.idea||"";
    getEl('chapterCount').value = d.count||3;
    if(d.k1) window.checkSpecificEngine(1); if(d.k2) window.checkSpecificEngine(2);
    if(d.visible) window.renderWorkspace(d.chapters, d.title);
};

const htmlHeader = (t) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@700&display=swap');body{background:#f4ece0;color:#2c2c2c;font-family:'Crimson Pro',serif;line-height:1.8;margin:0;padding:0;text-align:justify;}.page{max-width:95%;margin:10px auto;background:white;padding:25px;box-shadow:0 0 10px rgba(0,0,0,0.05);border-radius:5px;}@media(min-width:768px){.page{max-width:800px;padding:60px 80px;margin:40px auto;}}h1,h2{font-family:'Cinzel',serif;text-align:center;color:#8b6b23;}h1{font-size:3rem;margin:50px 0;}h2{font-size:2rem;border-bottom:2px double #eee;padding-bottom:10px;margin-top:50px;}p{margin-bottom:1.5rem;text-indent:3.5rem;font-size:1.3rem;}.cover{height:90vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border:10px double #8b6b23;margin:15px;background:white;}</style></head><body>`;

window.downloadSingle = (i, f) => {
    const card = document.querySelectorAll('.chapter-card')[i];
    const t = card.querySelector('.ch-title-input').value, l = card.querySelector('.ch-label').innerText, c = card.querySelector('.ch-content-input').value;
    let res = (f === 'html') ? `${htmlHeader(t)}<div class="page"><h2>${l}: ${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div></body></html>` : `[ ${l} - ${t} ]\n\n${c}`;
    saveFile(res, `${l}_${t}.${f}`, f);
};

window.downloadFull = (f) => {
    const title = getEl('novelTitle').value || 'Novel'; let res = "";
    if (f === 'html') {
        res = `${htmlHeader(title)}<div class="cover"><h1>${title}</h1><p>Mahakarya Sastra</p></div>`;
        document.querySelectorAll('.chapter-card').forEach(card => {
            const l = card.querySelector('.ch-label').innerText, t = card.querySelector('.ch-title-input').value, c = card.querySelector('.ch-content-input').value;
            res += `<div class="page"><h2>${l}: ${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div>`;
        });
        res += "</body></html>";
    } else {
        document.querySelectorAll('.chapter-card').forEach(card => {
            res += `\n\n--- ${card.querySelector('.ch-label').innerText} : ${card.querySelector('.ch-title-input').value} ---\n\n${card.querySelector('.ch-content-input').value}`;
        });
    }
    saveFile(res, `${title}_Lengkap.${f}`, f);
};

function saveFile(str, name, f) {
    const b = new Blob([str], { type: f === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
}

window.clearAllData = () => { if(confirm("Hapus draf?")) { localStorage.clear(); location.reload(); } };
window.onload = window.loadDraft;
    
