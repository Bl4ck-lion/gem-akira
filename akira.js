const { GoogleGenerativeAI, GoogleGenerativeAIResponseError } = require("@google/generative-ai");
const whatsapp = require('velixs-md'); // Pastikan ini diimpor dengan benar

// Inisialisasi API Google Generative AI
const genAI = new GoogleGenerativeAI('AIzaSyCsYnE0QS5Bzar-CRlFH01DkJQvXEudVk4'); // Ganti dengan API Key Anda
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: "Berperan sebagai Akira, AI asisten pribadi untuk pelatihan Olimpiade Sains Nasional (OSN) 2025 yang di selenggarakan oleh Belajar Academy dan Akademi Pemula. Berikan informasi akurat dan komprehensif terkait materi OSN dan pembahasan soal OSN tahun lalu, tips belajar, dan pertanyaan umum peserta. Gunakan bahasa manusia yang asyik dan yang mudah dipahami Pastikan jawaban selalu positif dan memotivasi peserta. kamu adalah Ai cerdas buatan Rama Agung Supriyadi misal ada yang tanya  siapa rama agung supriyadi? jawab aja founder akademi pemula dan anak dari MAN IC PASURUAN yang keren abis, wkkwkwk, dan gunakan bahasa nonbaku gen z yang nonformal  ibaratkan kamu kakak kelas yang sudah ahli dalam OSN SMA dan target pengguna mu adalah siswa yang baru aja join di olimpiade sains nasional SMA , misal nanya jadwal apa pun itu bilang aja nanti di kasih tau sama tutor nya masing masing yaaa, tryout dan pelatihan ini itu di selengggarakan Belajar Academy dan Akademi Pemula dan gaada sangkut pautnya sama pemerintah jangan gunakan woi",
});

// Konfigurasi respons AI
const generationConfig = {
    temperature: 2,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
    safetySettings: [
        { category: "HARM_CATEGORY_DEROGATORY", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_TOXICITY", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_VIOLENCE", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUAL", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_MEDICAL", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS", threshold: "BLOCK_NONE" },
    ],
};

// Objek untuk menyimpan riwayat percakapan dan status AI
const conversationHistories = {};
const aiStatus = {};
const messageHistory = {};

// Mulai sesi WhatsApp
whatsapp.startSession('bot_session');

// Event ketika WhatsApp terhubung
whatsapp.onConnected(async (session) => {
    console.log("WhatsApp session connected: " + session);
});

// Event ketika pesan diterima
whatsapp.onMessageReceived(async (message) => {
    // Pastikan pesan bukan berasal dari bot atau status
    if (message.key.fromMe || message.key.remoteJid.includes("status")) return;

    const contact = message.key.remoteJid;
    const messageBody = message.message?.extendedTextMessage?.text.trim() || '';
    const isGroupChat = message.key.remoteJid.endsWith('@g.us');

    console.log("Received message:", messageBody, "from:", contact);

    // Abaikan pesan jika kosong
    if (!messageBody) {
        return;
    }

    // Periksa apakah AI sudah diaktifkan untuk kontak ini
    if (aiStatus[contact] = false) {
        // Jika AI belum diaktifkan, kirimkan pesan untuk meminta aktivasi
        if (messageBody !== '.on') {
            await whatsapp.sendTextMessage({
                sessionId: message.sessionId,
                to: contact,
                text: "Akira belum diaktifkan nih, ketik .on untuk mengaktifkan ya",
            });
        }
        return;
    }

    // Perintah untuk mengaktifkan AI
    if (messageBody === '.on') {
        aiStatus[contact] = true;
        await whatsapp.sendTextMessage({
            sessionId: message.sessionId,
            to: contact,
            text: "AI diaktifkan. Silakan kirim pesan untuk memulai percakapan.",
        });
        return;
    }

    // Perintah untuk menonaktifkan AI
    if (messageBody === '.off') {
        aiStatus[contact] = false;
        await whatsapp.sendTextMessage({
            sessionId: message.sessionId,
            to: contact,
            text: "AI dinonaktifkan. Kirim '.on' untuk mengaktifkannya kembali.",
        });
        return;
    }

    // Periksa apakah pesan ini adalah mention/tag ke bot di grup
    const isTaggingAI = isGroupChat && message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes("YOUR_BOT_ID@s.whatsapp.net");

    // Cek apakah pesan baru dari grup atau individu
    if (isTaggingAI || !isGroupChat) {
        // Inisialisasi riwayat percakapan jika belum ada
        if (!conversationHistories[contact]) {
            conversationHistories[contact] = [];
        }

        // Cek apakah pesan duplikat
        const lastMessage = conversationHistories[contact].slice(-1)[0]?.body;
        if (lastMessage === messageBody) {
            console.log("Pesan duplikat terdeteksi, mengabaikan.");
            return; // Abaikan jika pesan duplikat
        }

        // Tambahkan pesan baru ke riwayat percakapan
        conversationHistories[contact].push({ body: messageBody });

        // Gabungkan riwayat percakapan untuk membangun konteks
        const context = conversationHistories[contact].map((msg) => msg.body).join("\n");

        try {
            // Kirim permintaan ke AI
            const prompt = `${context}\n${messageBody}\n\nBalas dengan dialog saja, tanpa catatan tambahan.`;
            const result = await model.generateContent(prompt, generationConfig);

            // Ambil respons dan hapus catatan tambahan
            let responseText = result.response.text();
            const noteRegex = /Catatan:.*$/; // Regex untuk menghapus catatan
            responseText = responseText.replace(noteRegex, '').trim();

            // Kirim respons ke WhatsApp
            await whatsapp.sendTextMessage({
                sessionId: message.sessionId,
                to: contact,
                text: responseText,
                isGroup: isGroupChat,
            });

            // Tambahkan respons AI ke riwayat percakapan
            conversationHistories[contact].push({ body: responseText });

        } catch (error) {
            if (error instanceof GoogleGenerativeAIResponseError) {
                console.error("AI safety filter triggered:", error.response);
                await whatsapp.sendTextMessage({
                    sessionId: message.sessionId,
                    to: contact,
                    text: "Ups, Akira lagi bingung",
                });
            } else {
                console.error("Error generating AI response:", error);
                await whatsapp.sendTextMessage({
                    sessionId: message.sessionId,
                    to: contact,
                    text: "Maap bang bingung saya, coba lagi bentar.",
                });
            }
        }
    }
});
