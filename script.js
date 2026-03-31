const getEl = id => document.getElementById(id);
let timerInterval, abortController;

// --- FUNGSI HUBUNGKAN (PASTIKAN NAMA INI SESUAI DENGAN HTML) ---
window.checkEngine = async function(num) {
    const keyInput = getEl(`apiKey${num}`);
    const key = keyInput ? keyInput.value.trim() : "";
    
    if(!key) {
        alert(`Masukkan API Key untuk Engine ${num}!`);
        return;
    }
    
    window.showPopup(`Mencoba Engine ${num}...`, num);
    
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
            alert(`API Key ${num} salah atau limit.`);
        }
    } catch (e) {
        alert(`Gagal koneksi Engine ${num}. Cek internet.`);
    } finally {
        window.hidePopup();
    }
};

// --- LOGIKA PENULISAN UTUH ---
window.writeChapter = async (i) => {
    const ls = document.querySelectorAll('.ch-label'),
          ts = document.querySelectorAll('.ch-title-input'),
          ss = document.querySelectorAll('.ch-summary-input'),
          bs = document.querySelectorAll('.ch-bridge-input'),
          cs = document.querySelectorAll('.ch-content-input');
    
    window.showPopup(`Engine 1 Menulis ${ls[i].innerText}...`, 1);

    let previousTail = "";
    if (i > 0 && cs[i-1].value) {
        previousTail = `\nAKHIR DARI BAB SEBELUMNYA (SAMBUNGKAN NARASI DARI TITIK INI):\n...${cs[i-1].value.slice(-1000)}\n`;
    }

    const writePrompt = `Anda penulis novel profesional. Tulis ${ls[i].innerText} agar menyambung sempurna.
    JUDUL: ${getEl('novelTitle').value} | KONSEP: ${getEl('storyIdea').value}
    ${previousTail}
    MEMORI: ${i > 0 ? bs[i-1].value : "Awal cerita."}
    ALUR BAB INI: ${ss[i].value}
    ATURAN: Kelanjutan langsung, jangan ulang perkenalan, minimal 1500 kata, gaya ${getEl('style').value}.`;

    try {
        const result = await callAI(1, writePrompt);
        cs[i].value = result;
        window.saveDraft();

        window.showPopup(`Engine 2 Mengunci Benang Merah...`, 2);
        const brRes = await callAI(2, `Catat ringkasan kejadian kunci bab ini untuk bab depan: ${result.substring(0, 2000)}`);
        bs[i].value = brRes;
        window.saveDraft();
    } catch (e) { alert("Gagal Menulis."); }
    finally { window.hidePopup(); }
};

// --- FUNGSI PENDUKUNG ---
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
    return d.candidates[0].content.parts[0].text.trim();
}

window.showPopup = (msg, engineNum) => {
    getEl('aiPopup').classList.remove('hidden');
    getEl('popupStatus').innerText = msg;
};
window.hidePopup = () => getEl('aiPopup').classList.add('hidden');

// (Fungsi Lainnya seperti renderWorkspace, saveDraft, download tetap sama seperti sebelumnya)
