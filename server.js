const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const Game = require('./classes/Game');

app.use(express.static('public'));

// Oyun motorunu başlat
let game;
try {
    game = new Game();
} catch (e) {
    console.error("🔥 OYUN MOTORU BAŞLATILAMADI:", e);
    process.exit(1); // Oyun başlamazsa sunucuyu kapat
}

// --- ZAMANLAYICI KASASI (CRASH ÖNLEYİCİ) ---
// Timer nesneleri çok karmaşıktır, bunları oyuncu objesinin içine koyarsan
// Socket.io veriyi gönderirken "Ben bunu gönderemem" diyip sunucuyu çökertir.
// O yüzden zamanlayıcıları burada ayrı bir kutuda tutuyoruz.
const playerTimers = {}; 

// --- SUNUCU ÇÖKMESİNİ ENGELLEYEN GLOBAL KORUMA ---
// Bu iki blok, sunucunun ne olursa olsun kapanmamasını sağlar.
process.on('uncaughtException', (err) => {
    console.error('🔥 BEKLENMEYEN HATA (Sunucu Kapanmadı):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 İŞLENMEMİŞ SÖZ (Promise Rejection):', reason);
});

io.on('connection', (socket) => {
    console.log('Yeni savasci katildi:', socket.id);

    // --- OYUNA KATILMA ---
    socket.on('joinGame', (data) => {
        try {
            if (!data) return;
            // İsim ve skor güvenliği
            const safeNick = (data.nickname && typeof data.nickname === 'string') ? data.nickname : "Unknown";
            const safeScore = (data.bestScore && !isNaN(data.bestScore)) ? data.bestScore : 0;

            game.addPlayer(socket.id, safeNick, safeScore);
            
            // Başlangıç boyutu garantisi
            if (game.players[socket.id]) {
                game.players[socket.id].size = 20;
            }
            socket.emit('initDiamonds', game.diamonds);
        } catch (e) {
            console.error(`⚠️ joinGame Hatası (${socket.id}):`, e);
        }
    });

    // --- PING SİSTEMİ ---
    socket.on('pingCheck', (startTime) => {
        try {
            socket.emit('pongCheck', startTime);
        } catch(e) {}
    });
    
    socket.on('updatePing', (ms) => {
        try {
            if (game.players[socket.id]) game.players[socket.id].ping = ms;
        } catch(e) {}
    });

    // --- OYUNCU HAREKETİ & ELMAS TOPLAMA (EN KRİTİK YER) ---
    socket.on('playerMovement', (data) => {
        try {
            // 1. DATA KONTROLÜ: Bozuk veri gelirse işlemi iptal et
            if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
            if (isNaN(data.x) || isNaN(data.y)) return;

            // Hareketi işle
            const result = game.movePlayer(socket.id, data);

            // 2. ELMAS ETKİLEŞİMİ
            if (result && result.type === 'diamond') {
                if (result.subType === 'super') {
                    const pid = result.playerId;
                    const player = game.players[pid];

                    if (player) {
                        let currentSize = player.size || 20;
                        
                        // --- TIMER DÜZELTMESİ ---
                        // Oyuncu objesine dokunmuyoruz, dışarıdaki kasadan siliyoruz.
                        if (playerTimers[pid]) clearTimeout(playerTimers[pid]);

                        let msg = "";
                        let duration = 10000; 

                        // Evrim Mantığı
                        if (currentSize >= 190 && currentSize <= 210) { 
                            player.size = 200; duration = 13000;
                            msg = `⚠️ ${player.nickname} GIGA HULK SÜRESİNİ UZATTI! ⚠️`;
                        } 
                        else if (currentSize >= 90 && currentSize <= 110) {
                            player.size = 200; duration = 13000;
                            msg = `⚠️ ${player.nickname} EVRİM GEÇİRDİ! GIGA HULK! ⚠️`;
                        } 
                        else if (currentSize > 400) {
                             duration = 10000;
                             msg = `⚠️ ${player.nickname} MEGA FORMUNU KORUYOR! ⚠️`;
                        }
                        else {
                            player.size = 100;
                            msg = `⚠️ ${player.nickname} DEV OLDU! ⚠️`;
                        }

                        // Efektleri Yolla
                        io.to(pid).emit('speedBoost');
                        io.emit('chatMessage', { id: 'Sistem', msg: msg });

                        // --- YENİ GÜVENLİ TIMER ---
                        // Zamanlayıcıyı dışarıdaki kasaya atıyoruz
                        playerTimers[pid] = setTimeout(() => {
                            try {
                                if (game.players[pid]) {
                                    game.players[pid].size = 20;
                                }
                                delete playerTimers[pid]; // İşi bitince temizle
                            } catch(err) {
                                console.error("Shrink Timer Hatası:", err);
                            }
                        }, duration);
                    }
                }
            }
        } catch (e) {
            console.error(`⚠️ Hareket Hatası (${socket.id}):`, e);
        }
    });

    // --- MINIGAME CEZALARI ---
    socket.on('minigamePenalty', (amount) => {
        try {
            const penalty = amount || 50;
            game.applyPenalty(socket.id, penalty);
        } catch(e) { console.error('Penalty Hatası:', e); }
    });

    // --- ZAR SİSTEMİ ---
    socket.on('requestDiceRoll', () => {
        try {
            const result = game.playerRollDice(socket.id);
            if (result) {
                socket.emit('diceResult', result);
                const durum = result.win ? "KAZANDI" : "KAYBETTİ";
                io.emit('chatMessage', {
                    id: 'Sistem',
                    msg: `🎲 ${result.nickname} Zar: [${result.roll}] ${durum} ${result.extraMsg || ''}`
                });
            } else {
                socket.emit('diceResult', null); 
            }
        } catch (e) {
            console.error(`⚠️ Zar Hatası (${socket.id}):`, e);
        }
    });

    // --- CHAT ---
    socket.on('chatMessage', (msg) => {
        try {
            if(msg && typeof msg === 'string') {
                // Mesaj çok uzunsa kes
                const safeMsg = msg.substring(0, 100);
                io.emit('chatMessage', { id: socket.id, msg: safeMsg });
            }
        } catch(e) {}
    });

    // --- AS BUTONU ÖDÜLÜ ---
    socket.on('claimAsReward', () => {
        try {
            const player = game.players[socket.id];
            if (player) {
                player.score += 50;
                if (player.score > player.bestScore) player.bestScore = player.score;
            }
        } catch(e) {}
    });

    // --- BAĞLANTI KOPMA ---
    socket.on('disconnect', () => {
        try {
            // Çıkan oyuncunun timer'ını temizle ki hafıza şişmesin
            if (playerTimers[socket.id]) {
                clearTimeout(playerTimers[socket.id]);
                delete playerTimers[socket.id];
            }
            game.removePlayer(socket.id);
        } catch (e) {
            console.error('⚠️ Disconnect hatası:', e);
        }
    });
});

// --- OYUN DÖNGÜSÜ (Game Loop) ---
setInterval(() => {
    try {
        const state = game.getState();
        
        // GÖNDERMEDEN ÖNCE VERİ TEMİZLİĞİ
        // Client'a bozuk veri giderse oyun donar.
        for (let id in state.players) {
            if (!state.players[id]) continue;
            
            // Skor kontrolü
            if (state.players[id].score === undefined || isNaN(state.players[id].score)) {
                state.players[id].score = 0;
            }
            
            // Boyut kontrolü
            if (!state.players[id].size || isNaN(state.players[id].size)) {
                state.players[id].size = 20;
            }
            
            // Server tarafında maksimum boyut sınırı (Güvenlik için)
            // Bu, görsel boyutu etkilemez ama veritabanında saçma sayıları önler
            if (state.players[id].size > 500) state.players[id].size = 500;
        }
        
        // Veriyi gönder
        io.emit('state', state);
        io.emit('updateDiamonds', state.diamonds);

    } catch (e) {
        // Döngüde hata olsa bile sunucuyu kapatma
        console.error("🔥 GameLoop Kritik Hata:", e);
    }
}, 1000 / 30); // 30 FPS

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`🚀 Zargoryan PRO Online! Port: ${PORT}`);
    console.log(`🛡️ Korumalı Mod Aktif: Try-Catch blokları devrede.`);
});