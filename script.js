window.writeChapter = async (i) => {
    const ls = document.querySelectorAll('.ch-label'),
          ts = document.querySelectorAll('.ch-title-input'),
          ss = document.querySelectorAll('.ch-summary-input'),
          bs = document.querySelectorAll('.ch-bridge-input'),
          cs = document.querySelectorAll('.ch-content-input');
    
    window.showPopup(`Engine 1 Menulis ${ls[i].innerText}...`, 1);

    // --- LOGIKA PERBAIKAN ALUR (ANTI-TUMPANG TINDIH) ---
    // Mengambil 1000 karakter terakhir dari bab sebelumnya agar narasi menyambung sempurna
    let previousTail = "";
    if (i > 0 && cs[i-1].value) {
        previousTail = `\n[SANGAT PENTING] AKHIR NARASI BAB SEBELUMNYA: 
        "...${cs[i-1].value.slice(-1000)}"
        INSTRUKSI: Sambungkan narasi bab ini tepat dari titik terakhir di atas tanpa jeda atau pengulangan.\n`;
    }

    const writePrompt = `Anda adalah penulis novel profesional. Tugas Anda adalah menulis ${ls[i].innerText} yang merupakan KELANJUTAN LANGSUNG dari cerita sebelumnya.

    JUDUL NOVEL: ${getEl('novelTitle').value}
    KONSEP DUNIA: ${getEl('storyIdea').value}
    GAYA: ${getEl('style').value} | GENRE: ${getEl('genre').value}

    ${previousTail}
    CATATAN MEMORI/LOGIKA: ${i > 0 ? bs[i-1].value : "Ini adalah awal cerita."}
    ALUR YANG HARUS DITULIS DI BAB INI: ${ss[i].value}

    PERATURAN KETAT AGAR CERITA TIDAK TUMPANG TINDIH:
    1. JANGAN menjelaskan ulang latar belakang, sistem, atau perkenalan karakter yang sudah ada di bab sebelumnya.
    2. JANGAN membuat kejadian yang mirip atau mengulang misi yang sudah disebutkan.
    3. Mulailah narasi dengan aksi atau dialog, jangan mulai dengan deskripsi dunia yang membosankan.
    4. Pastikan alur maju secara linear (tidak berputar-putar).
    5. Tulis minimal 1500 kata dengan EYD dan tanda baca yang sempurna.`;

    try {
        const result = await callAI(1, writePrompt);
        cs[i].value = result;
        window.saveDraft();

        // Engine 2 meringkas memori untuk membantu bab selanjutnya
        window.showPopup(`Engine 2 Mengunci Benang Merah...`, 2);
        const bridgePrompt = `Berdasarkan teks bab ini, buat catatan sejarah singkat agar bab depan tidak amnesia. 
        Catat: Kejadian kunci, posisi terakhir karakter, dan status misi.
        TEKS: ${result.substring(0, 3000)}`;
        
        const bridgeRes = await callAI(2, bridgePrompt);
        bs[i].value = bridgeRes;
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Error Penulisan."); }
    finally { window.hidePopup(); }
};
