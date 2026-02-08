const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const Game = require('./classes/Game');

app.use(express.static('public'));

const game = new Game();

io.on('connection', (socket) => {
    console.log('Yeni savasci katildi:', socket.id);

    socket.on('joinGame', (data) => {
        // data.bestScore client'tan geliyor
        game.addPlayer(socket.id, data.nickname, data.bestScore);
        socket.emit('initDiamonds', game.diamonds);
    });

    // PING
    socket.on('pingCheck', (startTime) => {
        socket.emit('pongCheck', startTime);
    });
    socket.on('updatePing', (ms) => {
        if (game.players[socket.id]) game.players[socket.id].ping = ms;
    });

    socket.on('playerMovement', (data) => {
        const result = game.movePlayer(socket.id, data);
        if (result && result.type === 'diamond') {
            if (result.subType === 'super') {
                const pid = result.playerId;
                io.to(pid).emit('speedBoost');
                if (game.players[pid]) {
                    game.players[pid].size = 100;
                    io.emit('chatMessage', {
                        id: 'Sistem',
                        msg: `⚠️ ${game.players[pid].nickname} KIZIL ELMASI YUTTU! DEV OLDU! ⚠️`
                    });
                    setTimeout(() => {
                        if (game.players[pid]) game.players[pid].size = 20;
                    }, 10000);
                }
            }
        }
    });

    socket.on('requestDiceRoll', () => {
        const result = game.playerRollDice(socket.id);
        if (result) {
            socket.emit('diceResult', result);
            const durum = result.win ? "KAZANDI (+50 Puan)" : "KAYBETTİ";
            io.emit('chatMessage', {
                id: 'Sistem',
                msg: `🎲 ${result.nickname} Zar Attı: [${result.roll}] (Hedef > ${result.target}) -> ${durum}`
            });
        }
    });

    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', { id: socket.id, msg: msg });
    });

    socket.on('claimAsReward', () => {
        const player = game.players[socket.id];
        if (player) {
            player.score += 50;
            // Server tarafında rekor kontrolü
            if (player.score > player.bestScore) {
                player.bestScore = player.score;
            }
        }
    });

    socket.on('disconnect', () => {
        game.removePlayer(socket.id);
    });
});

setInterval(() => {
    const state = game.getState();
    io.emit('state', state);
    io.emit('updateDiamonds', state.diamonds);
}, 1000 / 30);

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`🚀 Zargoryan PRO Online! Port: ${PORT}`);
});
