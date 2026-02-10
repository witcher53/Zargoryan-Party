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
    process.exit(1);
}

// --- ZAMANLAYICI KASASI ---
const playerTimers = {}; 

// --- SUNUCU KORUMASI ---
process.on('uncaughtException', (err) => {
    console.error('🔥 BEKLENMEYEN HATA:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 İŞLENMEMİŞ SÖZ:', reason);
});

io.on('connection', (socket) => {
    console.log('Yeni savasci katildi:', socket.id);

    // --- OYUNA KATILMA ---
    socket.on('joinGame', (data) => {
        try {
            if (!data) return;
            const safeNick = (data.nickname && typeof data.nickname === 'string') ? data.nickname : "Unknown";
            const safeScore = (data.bestScore && !isNaN(data.bestScore)) ? data.bestScore : 0;

            game.addPlayer(socket.id, safeNick, safeScore);
            
            if (game.players[socket.id]) {
                game.players[socket.id].size = 20;
            }
            socket.emit('initDiamonds', game.diamonds);
        } catch (e) { console.error(`Join Hata:`, e); }
    });

    // --- PING ---
    socket.on('pingCheck', (startTime) => socket.emit('pongCheck', startTime));
    socket.on('updatePing', (ms) => {
        if (game.players[socket.id]) game.players[socket.id].ping = ms;
    });

    // --- HAREKET & OYNANIŞ ---
    socket.on('playerMovement', (data) => {
        try {
            if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
            if (isNaN(data.x) || isNaN(data.y)) return;

            const result = game.movePlayer(socket.id, data);

            if (result && result.type === 'diamond') {
                if (result.subType === 'super') {
                    const pid = result.playerId;
                    const player = game.players[pid];

                    if (player) {
                        let currentSize = player.size || 20;
                        
                        // Titan Modu Kontrolü (1000'den büyükse etki etme)
                        if (currentSize < 750) {
                            if (playerTimers[pid]) clearTimeout(playerTimers[pid]);

                            let msg = "";
                            let duration = 10000; 
                            let newSize = currentSize;

                            // Büyüme Mantığı
                            if (currentSize >= 190) { // Giga -> Titan
                                newSize = 800; 
                                duration = 3000;
                                msg = `🌍 ${player.nickname} HARİTAYI YUTUYOR! (3s) 🌍`;
                            }
                            else if (currentSize >= 90) { // Dev -> Giga
                                newSize = 200;
                                duration = 13000;
                                msg = `⚠️ ${player.nickname} GIGA HULK OLDU! ⚠️`;
                            }
                            else { // Normal -> Dev
                                newSize = 100;
                                duration = 10000;
                                msg = `⚠️ ${player.nickname} DEV OLDU! ⚠️`;
                            }

                            player.size = newSize;
                            io.to(pid).emit('speedBoost');
                            io.emit('chatMessage', { id: 'Sistem', msg: msg });

                            playerTimers[pid] = setTimeout(() => {
                                if (game.players[pid]) game.players[pid].size = 20;
                                delete playerTimers[pid];
                            }, duration);
                        }
                    }
                }
            }
        } catch (e) { }
    });

    // --- DİĞER EVENTLER ---
    socket.on('minigamePenalty', (amount) => {
        game.applyPenalty(socket.id, amount || 50);
    });

    socket.on('requestDiceRoll', () => {
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
    });

    socket.on('chatMessage', (msg) => {
        if(msg && typeof msg === 'string') io.emit('chatMessage', { id: socket.id, msg: msg.substring(0, 100) });
    });

    socket.on('claimAsReward', () => {
        const player = game.players[socket.id];
        if (player) {
            player.score += 50;
            if (player.score > player.bestScore) player.bestScore = player.score;
        }
    });

    socket.on('disconnect', () => {
        if (playerTimers[socket.id]) {
            clearTimeout(playerTimers[socket.id]);
            delete playerTimers[socket.id];
        }
        game.removePlayer(socket.id);
    });
});

// --- OYUN DÖNGÜSÜ ---
setInterval(() => {
    const state = game.getState();
    // Veri Temizliği
    for (let id in state.players) {
        if (!state.players[id]) continue;
        if (!state.players[id].score) state.players[id].score = 0;
        if (!state.players[id].size) state.players[id].size = 20;
        if (state.players[id].size > 1000) state.players[id].size = 1000;
    }
    io.emit('state', state);
    io.emit('updateDiamonds', state.diamonds);
}, 1000 / 30);

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`🚀 Zargoryan PRO Online! Port: ${PORT}`);
});