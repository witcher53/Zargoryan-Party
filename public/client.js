import { state, MAP_WIDTH, MAP_HEIGHT } from './modules/state.js';
import { initInputs } from './modules/inputs.js';
import { updatePhysics, triggerRumble } from './modules/physics.js';
import { drawGame } from './modules/renderer.js';

const socket = io({
    reconnection: true,
    reconnectionAttempts: 5
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Inputları Başlat
initInputs(socket, sendMessage);

// --- BAĞLANTI DURUMU KONTROLÜ ---
socket.on('disconnect', (reason) => {
    console.warn("Bağlantı koptu:", reason);
    state.myPlayer.playing = false;
    const panicDiv = document.createElement('div');
    panicDiv.style = "position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:red; font-size:50px; font-weight:bold; background:black; padding:20px; border:5px solid red; z-index:9999;";
    panicDiv.innerHTML = "⚠️ BAĞLANTI KOPTU! ⚠️<br><span style='font-size:20px; color:white'>Sayfayı Yenilemen Lazım</span>";
    document.body.appendChild(panicDiv);
});

socket.on('connect', () => {
    console.log("Sunucuya bağlanıldı!");
});

// --- PING ---
setInterval(() => { 
    if(socket.connected) socket.emit('pingCheck', Date.now()); 
}, 2000);

socket.on('pongCheck', (startTime) => {
    state.currentPing = Date.now() - startTime;
    // Ping değerini ekranda göster
    const pingDisplay = document.getElementById('pingDisplay');
    if(pingDisplay) pingDisplay.innerText = `Ping: ${state.currentPing} ms`;
    
    if(socket.connected) socket.emit('updatePing', state.currentPing);
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
window.startGame = function() {
    const nick = document.getElementById('nicknameInput').value;
    if (nick.trim()) {
        const savedBest = localStorage.getItem('zargoryan_best') || 0;
        socket.emit('joinGame', { nickname: nick, bestScore: savedBest });
        state.myPlayer.playing = true;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('saWarning').style.display = 'block';
        setTimeout(() => { canvas.focus(); window.focus(); }, 100);
    }
};

window.clickAsButton = function() {
    const now = Date.now();
    if (now - state.lastAsTime < 120000) return;
    sendMessage('as'); socket.emit('claimAsReward');
    state.lastAsTime = now; document.getElementById('asButton').style.display = 'none'; canvas.focus();
};

window.rollDice = function() {
    if (state.isRolling) return;
    state.diceCooldown = Date.now() + 5000;
    state.isRolling = true;
    document.getElementById('rollDiceBtn').style.display = 'none';
    socket.emit('requestDiceRoll');
    triggerRumble(navigator.getGamepads()[0], 0.5, 0.5, 300);
    setTimeout(() => canvas.focus(), 50);
};

function sendMessage(text) {
    socket.emit('chatMessage', text.substring(0, 30));
    if (!state.hasGivenSalute && text.toLowerCase() === 'sa') {
        state.hasGivenSalute = true;
        document.getElementById('saWarning').style.display = 'none';
        const log = document.getElementById('chatLog');
        if (log) log.innerHTML += `<div><b style="color:#00ff00">SİSTEM:</b> Kilit açıldı! Saldır!</div>`;
    }
}

// --- SOCKET OLAYLARI ---
socket.on('initDiamonds', (d) => state.diamonds = d);
socket.on('updateDiamonds', (serverDiamonds) => {
    // Topladığımız elmasları filtrele ki ekranımızda titreme olmasın
    state.diamonds = serverDiamonds.filter(d => !state.collectedIds.includes(d.id));
    // Serverda artık olmayan elmasları collected listesinden çıkar
    state.collectedIds = state.collectedIds.filter(ghostId => serverDiamonds.some(sd => sd.id === ghostId));
});

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
    // Hız artışı için güvenli limit
    if (state.myPlayer.speed < 40) { 
        state.myPlayer.speed = 40;
        setTimeout(() => state.myPlayer.speed = 10, 10000);
    }
});

socket.on('chatMessage', (data) => {
    state.activeMessages[data.id] = data.msg; setTimeout(() => delete state.activeMessages[data.id], 5000);
    if (data.msg.toLowerCase() === 'sa' && data.id !== socket.id && Date.now() - state.lastAsTime >= 120000) {
        document.getElementById('asButton').style.display = 'block'; setTimeout(() => document.getElementById('asButton').style.display = 'none', 5000);
    }
    const log = document.getElementById('chatLog');
    if (log) {
        let gorunenIsim = "???", renk = "gold";
        if (data.id === 'Sistem') { gorunenIsim = "SİSTEM"; renk = "red"; }
        else if (state.players[data.id]) { gorunenIsim = state.players[data.id].nickname; }
        else if (data.id === socket.id) { gorunenIsim = "Ben"; }
        log.innerHTML += `<div><b style="color:${renk}">${gorunenIsim}:</b> ${data.msg}</div>`;
        log.scrollTop = log.scrollHeight;
    }
});

socket.on('state', (serverState) => {
    if (!serverState || !serverState.players) return;

    state.tents = serverState.tents;
    const serverPlayers = serverState.players;

    for (let id in serverPlayers) {
        const sp = serverPlayers[id];
        if (!sp || typeof sp.score === 'undefined') continue;

        if (!state.players[id]) {
            state.players[id] = sp;
        } else {
            Object.assign(state.players[id], {
                targetX: sp.x,
                targetY: sp.y,
                score: sp.score,
                size: sp.size,
                bestScore: sp.bestScore,
                ping: sp.ping,
                nickname: sp.nickname,
                color: sp.color
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
        const lb = document.getElementById('lb-content');
        if (lb) {
            const sorted = Object.values(state.players)
                .filter(p => p && typeof p.score === 'number' && !isNaN(p.score))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
            lb.innerHTML = sorted.map((p, i) =>
                `<div class="player-row"><span style="flex:1;">#${i + 1} ${p.nickname}</span><div style="text-align:right;"><span class="score">${p.score}</span><span class="best-score">🏆${p.bestScore}</span></div></div>`
            ).join('');
        }
    } catch(e) {}
    updateScoreBoard();
});

function updateScoreBoard() {
    try {
        const tbody = document.getElementById('scoreBoardBody');
        if(document.getElementById('scoreBoard').style.display !== 'block') return;
        const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
        tbody.innerHTML = sorted.map(p => {
            let pingColor = p.ping > 100 ? (p.ping > 200 ? 'red' : 'yellow') : '#00ff00';
            return `<tr style="border-bottom:1px solid #444;"><td style="padding:5px;">${p.nickname}</td><td style="text-align:center; color:gold;">${p.score}</td><td style="text-align:center; color:#aaa;">${p.bestScore}</td><td style="text-align:right; color:${pingColor};">${p.ping || 0} ms</td></tr>`;
        }).join('');
    } catch(e) {}
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement === document.getElementById('chatInput')) {
        if (e.key === 'Enter') handleChat();
        return;
    }
    // Skor tablosu için TAB tuşu
    if (e.key === 'Tab') {
        e.preventDefault(); 
        document.getElementById('scoreBoard').style.display = 'block';
        updateScoreBoard();
        return;
    }
    if (e.key === 'Enter') handleChat();
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') document.getElementById('scoreBoard').style.display = 'none';
});

function handleChat() {
    const container = document.getElementById('chatInputContainer');
    const input = document.getElementById('chatInput');
    if (container.style.display === 'block') {
        if (input.value.trim()) sendMessage(input.value.trim());
        input.value = ""; container.style.display = 'none'; input.blur();
        setTimeout(() => { canvas.focus(); state.myPlayer.playing = true; }, 50);
    } else {
        container.style.display = 'block'; setTimeout(() => input.focus(), 10);
        state.myPlayer.playing = false; state.keys = {};
    }
}

// GAMEPAD LOGIC (HIZLI CHAT)
function handleGamepadChat() {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!gp) return;

    if (gp.buttons[9].pressed) document.getElementById('scoreBoard').style.display = 'block';
    else if (!state.keys['Tab']) document.getElementById('scoreBoard').style.display = 'none';

    // A TUŞU (Menü Aç/Kapa)
    if (gp.buttons[0].pressed && !state.buttonPressed) {
        state.isChatMenuOpen = !state.isChatMenuOpen;
        document.getElementById('gamepadChatMenu').style.display = state.isChatMenuOpen ? 'grid' : 'none';
        state.buttonPressed = true;
    }

    if (state.isChatMenuOpen) {
        if (gp.buttons[1].pressed && !state.buttonPressed) { 
            sendMessage("sa"); state.isChatMenuOpen = false; document.getElementById('gamepadChatMenu').style.display = 'none'; state.buttonPressed = true; 
        } 
        if (gp.buttons[2].pressed && !state.buttonPressed) { sendMessage("Ağla 😂"); state.buttonPressed = true; } 
        if (gp.buttons[3].pressed && !state.buttonPressed) { sendMessage("Bol Şans"); state.buttonPressed = true; } 
    } 
    else {
        // Oyun içi kısayollar (Zar ve As)
        if (document.getElementById('asButton').style.display === 'block') {
            if (gp.buttons[3].pressed && !state.buttonPressed) { clickAsButton(); state.buttonPressed = true; }
        }
        const btn = document.getElementById('rollDiceBtn');
        if (btn && btn.style.display === 'block') {
            if (gp.buttons[2].pressed && !state.buttonPressed) { rollDice(); state.buttonPressed = true; }
        }
    }

    if (!gp.buttons[0].pressed && !gp.buttons[1].pressed && !gp.buttons[2].pressed && !gp.buttons[3].pressed) {
        state.buttonPressed = false;
    }
}

function gameLoop() {
    // 1. EKRANI TEMİZLE (Çizimden önce şart)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    
    // Gamepad Chat kontrolleri
    handleGamepadChat();

    // SADECE GEREKLİ KONTROLLERİ YAPIP FİZİK MOTORUNU ÇAĞIRIYORUZ
    if (state.myPlayer.playing && state.hasGivenSalute && !state.isChatMenuOpen && document.getElementById('chatInputContainer').style.display === 'none') {
        try {
            updatePhysics(socket, gp);
        } catch(e) { console.error("Fizik hatası:", e); }
    }

    const btn = document.getElementById('rollDiceBtn');
    if (state.tents[0]) {
        const t = state.tents[0];
        const mp = state.myPlayer;
        const px = Number.isFinite(mp.x) ? mp.x : 0;
        const py = Number.isFinite(mp.y) ? mp.y : 0;
        
        const inside = px > t.x && px < t.x+t.w && py > t.y && py < t.y+t.h;
        const isCooldownOver = Date.now() > state.diceCooldown;
        btn.style.display = (inside && !state.showDice && !state.isRolling && isCooldownOver) ? 'block' : 'none';
    }

    // MODÜLER ÇİZİM FONKSİYONU (Koruma içeren)
    try {
        drawGame(ctx, canvas, socket);
    } catch (e) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "white"; ctx.font = "20px Arial";
        ctx.fillText("Görüntü Kurtarılıyor...", 50, 50);
        console.error("Draw error:", e);
    }
    
    requestAnimationFrame(gameLoop);
}

gameLoop();