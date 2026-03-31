const getEl = id => document.getElementById(id);
let timerInterval, abortController;

// --- 1. FUNGSI HUBUNGKAN API (Disesuaikan agar tombol HTML mengenali) ---
window.checkEngine = async function(num) {
    const keyInput = getEl(`apiKey${num}`);
    const key = keyInput ? keyInput.value.trim() : "";
    
    if(!key) {
        alert(`Masukkan API Key untuk Engine ${num}!`);
        return;
    }
    
    window.showPopup(`Menghubungkan Engine ${num}...`, num);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        
        if (data.models) {
            const select = getEl(`modelSelect${num}`);
            const btn = getEl(`btnCheck${num}`);
            
            // Filter hanya model yang mendukung generateContent
            const mods = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            select.innerHTML = mods.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            
            select.classList.remove('hidden');
            btn.innerText = `ENGINE ${num} AKTIF ✓`;
            btn.style.backgroundColor = num === 1 ? "#064e3b" : "#1e3a8a"; // Hijau untuk Engine 1, Biru untuk Engine 2
            btn.style.color = "white";
            
            window.saveDraft();
        } else {
            alert(`API Key ${num} tidak valid.`);
        }
    } catch (e) {
        alert(`Gagal koneksi Engine ${num}. Periksa internet.`);
    } finally {
        window.hidePopup();
    }
};

// --- 2. LOGIKA PENULISAN (Sangat linear & tidak tumpang tindih) ---
window.writeChapter = async function(i) {
    const ls = document.querySelectorAll('.ch-label'),
          ts = document.querySelectorAll('.ch-title-input'),
          ss = document.querySelectorAll('.ch-summary-input'),
          bs = document.querySelectorAll('.ch-bridge-input'),
          cs = document.querySelectorAll('.ch-content-input');
    
    window.showPopup(`Engine 1 Menulis ${ls[i].innerText}...`, 1);

    // MENGAMBIL KONTEKS DARI TEKS ASLI BAB SEBELUMNYA (Agar Nyambung)
    let previousTail = "";
    if (i > 0 && cs[i-1].value) {
        previousTail = `\nAKHIR CERITA BAB SEBELUMNYA (SAMBUNGKAN LANGSUNG): 
        "...${cs[i-1].value.slice(-1200)}"\n`;
    }

    const writePrompt = `Anda penulis novel profesional. Tulis narasi untuk ${ls[i].innerText} - ${ts[i].value}.
    
    JUDUL: ${getEl('novelTitle').value}
    DUNIA: ${getEl('storyIdea').value}
    GAYA: ${getEl('style').value} | GENRE: ${getEl('genre').value}

    ${previousTail}
    CATATAN MEMORI/LOGIKA: ${i > 0 ? bs[i-1].value : "Ini adalah pembukaan cerita."}
    ALUR BAB INI: ${ss[i].value}

    ATURAN KETAT (ANTI-TUMPANG TINDIH):
    1. INI KELANJUTAN LANGSUNG. Jangan mengulang perkenalan karakter/sistem/dunia.
    2. Langsung mulai narasi dari titik terakhir bab sebelumnya.
    3. Majukan alur secara linear, jangan berputar-putar di tempat.
    4. Minimal 1500 kata, EYD rapi, gaya bahasa sastra mendalam.`;

    try {
        const result = await callAI(1, writePrompt);
        cs[i].value = result;
        window.saveDraft();

        // Engine 2 membantu mengingat untuk bab depan
        window.showPopup(`Engine 2 Mengunci Memori...`, 2);
        const bridgeRes = await callAI(2, `Buat catatan sejarah singkat dari bab ini untuk bab selanjutnya (posisi tokoh, status misi, barang baru): ${result.substring(0, 2500)}`);
        bs[i].value = bridgeRes;
        window.saveDraft();
    } catch (e) { 
        if(e.name !== 'AbortError') alert("Gagal Menulis."); 
    } finally { 
        window.hidePopup(); 
    }
};

// --- 3. FUNGSI RANCANG ALUR ---
window.planNovel = async function() {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi konsep dunia dulu.");
    window.showPopup("Engine 2 Merancang Alur Keseluruhan...", 2);
    try {
        const c = getEl('chapterCount').value;
        const p = `Buat alur novel JSON murni: [{"label":"Prolog","judul":"...","ringkasan":"..."},{"label":"Bab 1","judul":"...","ringkasan":"..."},{"label":"Epilog","judul":"...","ringkasan":"..."}]. Total bab utama ${c}. Konsep: ${idea}`;
        const raw = await callAI(2, p);
        const json = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        window.renderWorkspace(JSON.parse(json), getEl('novelTitle').value);
        window.saveDraft();
    } catch (e) { alert("Gagal Rancang Alur."); }
    finally { window.hidePopup(); }
};

// --- 4. CORE AI CALLER ---
async function callAI(num, prompt) {
    const key = getEl(`apiKey${num}`).value;
    const model = getEl(`modelSelect${num}`).value;
    if(!key || !model) throw new Error("API belum siap.");
    
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }], 
            generationConfig: { temperature: 0.8, maxOutputTokens: 8192 } 
        })
    });
    const d = await res.json();
    return d.candidates[0].content.parts[0].text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
}

// --- 5. UI & WORKSPACE ---
window.renderWorkspace = function(plan, title) {
    getEl('mainPlaceholder').classList.add('hidden');
    getEl('displayTitle').innerText = title || "Karya Tebe";
    getEl('novelWorkspace').classList.remove('hidden');
    getEl('chaptersArea').innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 mb-8 shadow-2xl">
            <div class="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-black uppercase">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none text-white" value="${item.judul}" oninput="window.saveDraft()">
                </div>
                <button onclick="writeChapter(${i})" class="bg-white text-black px-8 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500">TULIS BAB</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea class="ch-summary-input summary-box" rows="3" oninput="window.saveDraft()">${item.summary || item.ringkasan || ""}</textarea>
                <textarea class="ch-bridge-input bridge-box" rows="3" oninput="window.saveDraft()">${item.bridge || ""}</textarea>
            </div>
            <textarea class="ch-content-input content-box mt-4" rows="18" oninput="window.saveDraft()" placeholder="Hasil narasi bab...">${item.content || ""}</textarea>
        </div>
    `).join('');
};

// --- 6. POPUP & LOADER ---
window.showPopup = function(msg, engineNum) {
    let sec = 0; getEl('popupTimer').innerText = "0s";
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { sec++; getEl('popupTimer').innerText = sec + "s"; }, 1000);
    getEl('aiPopup').classList.remove('hidden');
    getEl('popupStatus').innerText = msg;
};
window.hidePopup = function() { getEl('aiPopup').classList.add('hidden'); clearInterval(timerInterval); };
window.cancelProcess = function() { if(abortController) abortController.abort(); hidePopup(); };

// --- 7. EKSPOR & DOWNLOAD (FIXED) ---
window.downloadFull = function(format) {
    const title = getEl('novelTitle').value || 'Novel';
    let res = "";
    if (format === 'html') {
        res = `<html><body style="font-family:serif; background:#f4ece0; padding:40px;"><h1>${title}</h1>`;
        document.querySelectorAll('.chapter-card').forEach(card => {
            const l = card.querySelector('.ch-label').innerText, t = card.querySelector('.ch-title-input').value, c = card.querySelector('.ch-content-input').value;
            res += `<h2>${l}: ${t}</h2><p style="white-space:pre-wrap;">${c}</p>`;
        });
        res += "</body></html>";
    } else {
        document.querySelectorAll('.chapter-card').forEach(card => {
            res += `\n\n--- ${card.querySelector('.ch-label').innerText}: ${card.querySelector('.ch-title-input').value} ---\n\n${card.querySelector('.ch-content-input').value}`;
        });
    }
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title}.${format}`; a.click();
};

// --- 8. STORAGE SYSTEM ---
window.saveDraft = function() {
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

window.onload = function() {
    const saved = localStorage.getItem('tebe_v15_final');
    if (!saved) return;
    const d = JSON.parse(saved);
    getEl('apiKey1').value = d.k1||""; getEl('apiKey2').value = d.k2||"";
    getEl('novelTitle').value = d.title||""; getEl('genre').value = d.genre||"";
    getEl('style').value = d.style||""; getEl('storyIdea').value = d.idea||"";
    getEl('chapterCount').value = d.count||3;
    if(d.k1) window.checkEngine(1); 
    if(d.k2) window.checkEngine(2);
    if(d.visible) window.renderWorkspace(d.chapters, d.title);
};

window.clearAllData = () => { if(confirm("Hapus draf?")) { localStorage.clear(); location.reload(); } };
    
