// Pindahkan fungsi ke cakupan global agar pasti terbaca oleh HTML onclick
const getEl = id => document.getElementById(id);
let timerInterval, abortController;

// --- FUNGSI HUBUNGKAN ENGINE (PERBAIKAN UTAMA) ---
window.checkEngine = async function(num) {
    console.log("Mencoba menghubungkan Engine " + num);
    const keyInput = getEl(`apiKey${num}`);
    const key = keyInput ? keyInput.value.trim() : "";
    
    if(!key) {
        alert(`Masukkan API Key untuk Engine ${num}!`);
        return;
    }
    
    window.showPopup(`Koneksi Engine ${num}...`, num);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("Engine " + num + " Berhasil Terhubung");
            const sel = getEl(`modelSelect${num}`);
            const btn = getEl(`btnCheck${num}`);
            
            const mods = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            sel.innerHTML = mods.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            
            sel.classList.remove('hidden');
            btn.innerText = `ENGINE ${num} AKTIF ✓`;
            btn.classList.add(num === 1 ? 'bg-green-900' : 'bg-blue-900');
            btn.style.color = "white";
            
            window.saveDraft();
        } else {
            console.error("Respon API Salah:", data);
            alert("API Key " + num + " Tidak Valid. Pastikan Key benar.");
        }
    } catch (e) {
        console.error("Error Koneksi:", e);
        alert("Gagal koneksi ke Google API. Periksa internet Anda.");
    } finally {
        window.hidePopup();
    }
};

// --- FUNGSI POPUP ---
window.showPopup = function(msg, engineNum) {
    let seconds = 0;
    getEl('popupTimer').innerText = "0s";
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { seconds++; getEl('popupTimer').innerText = seconds + "s"; }, 1000);
    getEl('aiPopup').classList.remove('hidden');
    getEl('popupStatus').innerText = msg;
    
    const st = getEl('engineStatus');
    if(engineNum === 1) {
        st.innerText = "ENGINE 1: PENULIS SEDANG BEKERJA";
        st.className = "text-green-500 font-bold italic text-[10px]";
    } else if(engineNum === 2) {
        st.innerText = "ENGINE 2: MEMORY ARCHITECT SEDANG BEKERJA";
        st.className = "text-blue-500 font-bold italic text-[10px]";
    } else {
        st.innerText = "SISTEM SEDANG MEMPROSES DATA";
        st.className = "text-gray-500 font-bold italic text-[10px]";
    }
};

window.hidePopup = () => { getEl('aiPopup').classList.add('hidden'); clearInterval(timerInterval); };
window.cancelProcess = () => { if (abortController) { abortController.abort(); window.hidePopup(); } };

// --- FUNGSI PENULISAN & ALUR ---
async function callAI(num, prompt) {
    const key = getEl(`apiKey${num}`).value;
    const model = getEl(`modelSelect${num}`).value;
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 8192 }
        })
    });
    const d = await res.json();
    return d.candidates[0].content.parts[0].text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
}

window.planNovel = async () => {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi Konsep Dulu!");
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
    const ls = document.querySelectorAll('.ch-label'),
          ts = document.querySelectorAll('.ch-title-input'),
          ss = document.querySelectorAll('.ch-summary-input'),
          bs = document.querySelectorAll('.ch-bridge-input');
    
    window.showPopup(`Engine 1 Menulis ${ls[i].innerText}...`, 1);
    let mem = i > 0 ? `INGATAN SEBELUMNYA: ${bs[i-1].value}\n` : "Awal Cerita.\n";
    const p = `Tulis narasi mendalam untuk ${ls[i].innerText}: ${ts[i].value}.\n${mem}\nALUR: ${ss[i].value}\nGenre: ${getEl('genre').value} | Gaya: ${getEl('style').value}\nATURAN: Minimal 1500 kata, deskriptif, EYD sempurna, JANGAN tulis label bab di awal teks.`;

    try {
        const res = await callAI(1, p);
        document.querySelectorAll('.ch-content-input')[i].value = res;
        window.saveDraft();
        
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
        <div class="chapter-card bg-[#111] p-8 rounded-[2rem] border border-gray-900 shadow-2xl mb-8">
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
            <textarea class="ch-content-input content-box mt-6" rows="20" placeholder="Hasil narasi..." oninput="window.saveDraft()">${item.content || ""}</textarea>
        </div>
    `).join('');
};

// --- STORAGE SYSTEM ---
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
    localStorage.setItem('tebe_v15_dual_engine', JSON.stringify({
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
    console.log("Aplikasi Dimuat");
    const saved = localStorage.getItem('tebe_v15_dual_engine');
    if (!saved) return;
    const d = JSON.parse(saved);
    getEl('apiKey1').value = d.k1||""; 
    getEl('apiKey2').value = d.k2||"";
    getEl('novelTitle').value = d.title||""; 
    getEl('genre').value = d.genre||"";
    getEl('style').value = d.style||""; 
    getEl('storyIdea').value = d.idea||"";
    getEl('chapterCount').value = d.count||3;
    
    // Auto check jika sudah ada data
    if(d.k1) window.checkEngine(1); 
    if(d.k2) window.checkEngine(2);
    if(d.visible) window.renderWorkspace(d.chapters, d.title);
};

window.clearAllData = () => { if(confirm("Hapus draf?")) { localStorage.clear(); location.reload(); } };

// --- SISTEM EKSPOR & DOWNLOAD (FIXED) ---

const getHtmlHeader = (title) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@700;900&display=swap');
    body { background:#f4ece0; color:#2c2c2c; font-family:'Crimson Pro',serif; line-height:1.8; margin:0; padding:0; text-align:justify; }
    .page { max-width: 95%; margin: 10px auto; background: white; padding: 25px; box-shadow: 0 0 10px rgba(0,0,0,0.05); border-radius: 5px; border: 1px solid #ddd; }
    @media (min-width: 768px) { .page { max-width: 800px; padding: 60px 80px; margin: 40px auto; } }
    h1 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 3rem; margin: 40px 0; }
    h2 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 2rem; border-bottom: 2px double #eee; padding-bottom: 10px; margin-top: 50px; }
    p { margin-bottom: 1.5rem; text-indent: 3.5rem; font-size: 1.3rem; }
    .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 10px double #8b6b23; margin: 15px; background:white; }
</style></head><body>`;

window.downloadSingle = function(i, format) {
    const card = document.querySelectorAll('.chapter-card')[i];
    const t = card.querySelector('.ch-title-input').value;
    const l = card.querySelector('.ch-label').innerText;
    const c = card.querySelector('.ch-content-input').value;
    
    let res = "";
    if (format === 'html') {
        res = `${getHtmlHeader(t)}<div class="page"><h2>${l}: ${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div></body></html>`;
    } else {
        res = `[ ${l} - ${t} ]\n\n${c}`;
    }
    
    window.saveFile(res, `${l}_${t}.${format}`, format);
};

window.downloadFull = function(format) {
    const title = getEl('novelTitle').value || 'Novel';
    let res = "";
    
    if (format === 'html') {
        res = `${getHtmlHeader(title)}<div class="cover"><h1>${title}</h1><p>Mahakarya Sastra Modern</p></div>`;
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
    
    window.saveFile(res, `${title}_Lengkap.${format}`, format);
};

window.saveFile = function(str, name, format) {
    const blob = new Blob([str], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
};
