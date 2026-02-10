import { state } from './modules/state.js';
import { initInputs } from './modules/inputs.js';
import { updatePhysics, triggerRumble } from './modules/physics.js';
import { drawGame } from './modules/renderer.js';

const socket = io({ reconnection: true, reconnectionAttempts: 5 });
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- DOM ELEMENTLERİNİ ÖNBELLEĞE AL (Performans İçin) ---
const DOM = {
    loginScreen: document.getElementById('loginScreen'),
    nicknameInput: document.getElementById('nicknameInput'),
    saWarning: document.getElementById('saWarning'),
    chatLog: document.getElementById('chatLog'),
    chatInputContainer: document.getElementById('chatInputContainer'),
    chatInput: document.getElementById('chatInput'),
    scoreBoard: document.getElementById('scoreBoard'),
    scoreBoardBody: document.getElementById('scoreBoardBody'),
    lbContent: document.getElementById('lb-content'),
    rollDiceBtn: document.getElementById('rollDiceBtn'),
    asButton: document.getElementById('asButton'),
    gamepadChatMenu: document.getElementById('gamepadChatMenu'),
    pingDisplay: document.getElementById('pingDisplay')
};

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

initInputs(socket, sendMessage);

// --- BAĞLANTI ---
socket.on('disconnect', () => {
    state.myPlayer.playing = false;
    const panicDiv = document.createElement('div');
    panicDiv.style = "position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:red; font-size:50px; font-weight:bold; background:black; padding:20px; border:5px solid red; z-index:9999;";
    panicDiv.innerHTML = "⚠️ BAĞLANTI KOPTU! ⚠️<br><span style='font-size:20px; color:white'>Sayfayı Yenilemen Lazım</span>";
    document.body.appendChild(panicDiv);
});

// --- PING ---
setInterval(() => { if (socket.connected) socket.emit('pingCheck', Date.now()); }, 2000);
socket.on('pongCheck', (startTime) => {
    state.currentPing = Date.now() - startTime;
    if (DOM.pingDisplay) DOM.pingDisplay.innerText = `Ping: ${state.currentPing} ms`;
    if (socket.connected) socket.emit('updatePing', state.currentPing);
});

// --- MINIGAME TRIGGER ---
setInterval(() => {
    if (state.myPlayer.playing && !state.minigame.active) {
        state.minigame.active = true;
        state.minigame.startTime = Date.now();
        state.minigame.obstacles = [];
        state.minigame.collectibles = [];
        state.floatingTexts.push({ x: state.myPlayer.x, y: state.myPlayer.y, text: '⚠️ SAVAŞ BAŞLIYOR! ⚠️', color: 'red', life: 100 });
    }
}, 60000);

// --- GLOBAL FONKSİYONLAR ---
window.startGame = function () {
    const nick = DOM.nicknameInput.value;
    if (nick.trim()) {
        const savedBest = localStorage.getItem('zargoryan_best') || 0;
        socket.emit('joinGame', { nickname: nick, bestScore: savedBest });
        state.myPlayer.playing = true;
        DOM.loginScreen.style.display = 'none';
        DOM.saWarning.style.display = 'block';
        setTimeout(() => { canvas.focus(); window.focus(); }, 100);
    }
};

window.clickAsButton = function () {
    const now = Date.now();
    if (now - state.lastAsTime < 120000) return;
    sendMessage('as'); socket.emit('claimAsReward');
    state.lastAsTime = now; DOM.asButton.style.display = 'none'; canvas.focus();
};

window.rollDice = function () {
    if (state.isRolling) return;
    state.diceCooldown = Date.now() + 5000;
    state.isRolling = true;
    DOM.rollDiceBtn.style.display = 'none';
    socket.emit('requestDiceRoll');
    triggerRumble(navigator.getGamepads()[0], 0.5, 0.5, 300);
    setTimeout(() => canvas.focus(), 50);
};

function sendMessage(text) {
    socket.emit('chatMessage', text.substring(0, 30));
    if (!state.hasGivenSalute && text.toLowerCase() === 'sa') {
        state.hasGivenSalute = true;
        DOM.saWarning.style.display = 'none';
        if (DOM.chatLog) DOM.chatLog.innerHTML += `<div><b style="color:#00ff00">SİSTEM:</b> Kilit açıldı! Saldır!</div>`;
    }
}

// --- SOCKET LISTENERS ---
// Elmaslar artık cube.localDiamonds'tan geliyor (state handler'da sync ediliyor)
socket.on('initDiamonds', () => { }); // Uyumluluk: eski handler
socket.on('updateDiamonds', () => { }); // Uyumluluk: eski handler

socket.on('diceResult', (res) => {
    state.isRolling = false;
    if (res) {
        state.showDice = res;
        setTimeout(() => state.showDice = null, 4000);
    } else {
        state.floatingTexts.push({ x: state.myPlayer.x, y: state.myPlayer.y - 50, text: 'BEKLE!', color: 'orange', life: 30 });
    }
});

socket.on('speedBoost', () => {
    if (state.myPlayer.speed < 40) {
        state.myPlayer.speed = 40;
        setTimeout(() => state.myPlayer.speed = 10, 10000);
    }
});

socket.on('chatMessage', (data) => {
    state.activeMessages[data.id] = data.msg; setTimeout(() => delete state.activeMessages[data.id], 5000);
    if (data.msg.toLowerCase() === 'sa' && data.id !== socket.id && Date.now() - state.lastAsTime >= 120000) {
        DOM.asButton.style.display = 'block'; setTimeout(() => DOM.asButton.style.display = 'none', 5000);
    }
    if (DOM.chatLog) {
        let gorunenIsim = "???", renk = "gold";
        if (data.id === 'Sistem') { gorunenIsim = "SİSTEM"; renk = "red"; }
        else if (state.players[data.id]) { gorunenIsim = state.players[data.id].nickname; }
        else if (data.id === socket.id) { gorunenIsim = "Ben"; }
        DOM.chatLog.innerHTML += `<div><b style="color:${renk}">${gorunenIsim}:</b> ${data.msg}</div>`;
        DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
    }
});

socket.on('state', (serverState) => {
    if (!serverState || !serverState.players) return;
    state.tents = serverState.tents || [];
    if (serverState.cube) {
        state.cube = serverState.cube;
        // Elmasları cube.localDiamonds'tan al, collectedIds'e göre filtrele
        if (serverState.cube.localDiamonds) {
            state.diamonds = serverState.cube.localDiamonds.filter(d => !state.collectedIds.includes(d.id));
            state.collectedIds = state.collectedIds.filter(ghostId =>
                serverState.cube.localDiamonds.some(sd => sd.id === ghostId)
            );
        }
    }
    if (serverState.chunks) state.chunks = serverState.chunks;
    const serverPlayers = serverState.players;

    for (let id in serverPlayers) {
        const sp = serverPlayers[id];
        if (!sp || typeof sp.score === 'undefined') continue;

        if (!state.players[id]) {
            state.players[id] = sp;
        } else {
            Object.assign(state.players[id], {
                targetX: sp.x, targetY: sp.y, score: sp.score, size: sp.size,
                bestScore: sp.bestScore, ping: sp.ping, nickname: sp.nickname, color: sp.color
            });
            if (id === socket.id) state.myPlayer.size = sp.size;
        }
    }
    for (let id in state.players) if (!serverPlayers[id]) delete state.players[id];

    if (state.players[socket.id]) {
        const score = state.players[socket.id].score;
        if (score > (parseInt(localStorage.getItem('zargoryan_best') || 0))) localStorage.setItem('zargoryan_best', score);
    }

    try {
        if (DOM.lbContent) {
            const sorted = Object.values(state.players)
                .filter(p => p && typeof p.score === 'number' && !isNaN(p.score))
                .sort((a, b) => b.score - a.score).slice(0, 10);
            DOM.lbContent.innerHTML = sorted.map((p, i) =>
                `<div class="player-row"><span style="flex:1;">#${i + 1} ${p.nickname}</span><div style="text-align:right;"><span class="score">${p.score}</span><span class="best-score">🏆${p.bestScore}</span></div></div>`
            ).join('');
        }
    } catch (e) { }
    updateScoreBoard();
});

function updateScoreBoard() {
    try {
        if (DOM.scoreBoard.style.display !== 'block') return;
        const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
        DOM.scoreBoardBody.innerHTML = sorted.map(p => {
            let pingColor = p.ping > 100 ? (p.ping > 200 ? 'red' : 'yellow') : '#00ff00';
            return `<tr style="border-bottom:1px solid #444;"><td style="padding:5px;">${p.nickname}</td><td style="text-align:center; color:gold;">${p.score}</td><td style="text-align:center; color:#aaa;">${p.bestScore}</td><td style="text-align:right; color:${pingColor};">${p.ping || 0} ms</td></tr>`;
        }).join('');
    } catch (e) { }
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement === DOM.chatInput) {
        if (e.key === 'Enter') handleChat();
        return;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        DOM.scoreBoard.style.display = 'block';
        updateScoreBoard();
        return;
    }
    if (e.key === 'Enter') handleChat();
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') DOM.scoreBoard.style.display = 'none';
});

function handleChat() {
    if (DOM.chatInputContainer.style.display === 'block') {
        if (DOM.chatInput.value.trim()) sendMessage(DOM.chatInput.value.trim());
        DOM.chatInput.value = ""; DOM.chatInputContainer.style.display = 'none'; DOM.chatInput.blur();
        setTimeout(() => { canvas.focus(); state.myPlayer.playing = true; }, 50);
    } else {
        DOM.chatInputContainer.style.display = 'block'; setTimeout(() => DOM.chatInput.focus(), 10);
        state.myPlayer.playing = false; state.keys = {};
    }
}

function handleGamepadChat() {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!gp) return;

    if (gp.buttons[9].pressed) DOM.scoreBoard.style.display = 'block';
    else if (!state.keys['Tab']) DOM.scoreBoard.style.display = 'none';

    if (gp.buttons[0].pressed && !state.buttonPressed) {
        state.isChatMenuOpen = !state.isChatMenuOpen;
        DOM.gamepadChatMenu.style.display = state.isChatMenuOpen ? 'grid' : 'none';
        state.buttonPressed = true;
    }

    if (state.isChatMenuOpen) {
        if (gp.buttons[1].pressed && !state.buttonPressed) { sendMessage("sa"); state.isChatMenuOpen = false; DOM.gamepadChatMenu.style.display = 'none'; state.buttonPressed = true; }
        if (gp.buttons[2].pressed && !state.buttonPressed) { sendMessage("Ağla 😂"); state.buttonPressed = true; }
        if (gp.buttons[3].pressed && !state.buttonPressed) { sendMessage("Bol Şans"); state.buttonPressed = true; }
    }
    else {
        if (DOM.asButton.style.display === 'block' && gp.buttons[3].pressed && !state.buttonPressed) { clickAsButton(); state.buttonPressed = true; }
        if (DOM.rollDiceBtn.style.display === 'block' && gp.buttons[2].pressed && !state.buttonPressed) { rollDice(); state.buttonPressed = true; }
    }

    if (!gp.buttons[0].pressed && !gp.buttons[1].pressed && !gp.buttons[2].pressed && !gp.buttons[3].pressed) state.buttonPressed = false;
}

function gameLoop() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    handleGamepadChat();

    if (state.myPlayer.playing && state.hasGivenSalute && !state.isChatMenuOpen && DOM.chatInputContainer.style.display === 'none') {
        try { updatePhysics(socket, gp); } catch (e) { }
    }

    // Zar butonu: Çadır artık küpün lokal uzayında
    if (state.cube && state.cube.tent) {
        const tent = state.cube.tent;
        const cube = state.cube;
        const cos = Math.cos(cube.angle || 0);
        const sin = Math.sin(cube.angle || 0);
        // Çadırın 4 köşesinin world pozisyonunu hesapla
        const wx = cube.x + tent.localX * cos - tent.localY * sin;
        const wy = cube.y + tent.localX * sin + tent.localY * cos;
        const wx2 = cube.x + (tent.localX + tent.w) * cos - (tent.localY + tent.h) * sin;
        const wy2 = cube.y + (tent.localX + tent.w) * sin + (tent.localY + tent.h) * cos;
        const minX = Math.min(wx, wx2); const maxX = Math.max(wx, wx2);
        const minY = Math.min(wy, wy2); const maxY = Math.max(wy, wy2);
        const mp = state.myPlayer;
        const px = Number.isFinite(mp.x) ? mp.x : 0;
        const py = Number.isFinite(mp.y) ? mp.y : 0;
        const inside = px > minX && px < maxX && py > minY && py < maxY;
        const isCooldownOver = Date.now() > state.diceCooldown;
        DOM.rollDiceBtn.style.display = (inside && !state.showDice && !state.isRolling && isCooldownOver) ? 'block' : 'none';
    } else {
        DOM.rollDiceBtn.style.display = 'none';
    }

    try { drawGame(ctx, canvas, socket); } catch (e) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "white"; ctx.font = "20px Arial"; ctx.fillText("Görüntü Kurtarılıyor...", 50, 50);
    }
    requestAnimationFrame(gameLoop);
}

gameLoop();