const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

let collectedIds = []; 
let floatingTexts = []; 
let players = {}, diamonds = [], tents = [], activeMessages = {}, keys = {}, showDice = null;
let myPlayer = { x: 1000, y: 1000, speed: 10, playing: false, size: 20 };

let hasGivenSalute = false;
let lastAsTime = 0;
let buttonPressed = false; 
let isChatMenuOpen = false;

// PING
let currentPing = 0;
setInterval(() => { socket.emit('pingCheck', Date.now()); }, 2000);
socket.on('pongCheck', (startTime) => {
    const latency = Date.now() - startTime;
    currentPing = latency;
    document.getElementById('pingDisplay').innerText = `Ping: ${latency} ms`;
    socket.emit('updatePing', latency);
});

function lerp(start, end, t) { return start * (1 - t) + end * t; }

// TİTREŞİM
function triggerRumble(gp, weak, strong, duration) {
    if (gp && gp.vibrationActuator) {
        gp.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0, duration: duration, weakMagnitude: weak, strongMagnitude: strong
        });
    }
}

window.startGame = function() {
    const nick = document.getElementById('nicknameInput').value;
    if (nick.trim()) { 
        const savedBest = localStorage.getItem('zargoryan_best') || 0;
        socket.emit('joinGame', { nickname: nick, bestScore: savedBest }); 
        myPlayer.playing = true; 
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('saWarning').style.display = 'block';
        setTimeout(() => { canvas.focus(); window.focus(); }, 100);
    }
};

window.clickAsButton = function() {
    const btn = document.getElementById('asButton');
    const now = Date.now();
    if (now - lastAsTime < 120000) { return; }
    sendMessage('as');
    socket.emit('claimAsReward'); 
    lastAsTime = now;
    btn.style.display = 'none'; 
    canvas.focus();
};

window.rollDice = function() {
    socket.emit('requestDiceRoll');
    document.getElementById('rollDiceBtn').style.display = 'none';
    const gp = navigator.getGamepads()[0];
    triggerRumble(gp, 0.5, 0.5, 300); 
    setTimeout(() => { canvas.focus(); }, 50);
};

// --- MESAJ GÖNDERME VE KİLİT AÇMA (GÜNCELLENDİ) ---
function sendMessage(text) {
    socket.emit('chatMessage', text.substring(0, 30));
    
    // SA KONTROLÜ (Hem klavye hem gamepad burayı kullanıyor)
    if (!hasGivenSalute && text.toLowerCase() === 'sa') {
        forceUnlock(); // KİLİDİ ZORLA AÇAN FONKSİYON
    }
}

// KİLİDİ AÇAN ÖZEL FONKSİYON
function forceUnlock() {
    hasGivenSalute = true;
    document.getElementById('saWarning').style.display = 'none';
    
    // Chat loguna bilgi ver
    const log = document.getElementById('chatLog');
    if (log) log.innerHTML += `<div><b style="color:#00ff00">SİSTEM:</b> Kilit açıldı! Saldır!</div>`;
}

document.addEventListener('keydown', (e) => { 
    if (document.activeElement === document.getElementById('chatInput')) {
        if (e.key === 'Enter') handleChat(); return; 
    }
    if (e.key === 'Tab') {
        e.preventDefault(); 
        document.getElementById('scoreBoard').style.display = 'block';
        updateScoreBoard();
        return;
    }
    if (e.key === 'Enter') { handleChat(); return; }
    keys[e.key] = true; 
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') document.getElementById('scoreBoard').style.display = 'none';
    keys[e.key] = false;
});

function updateScoreBoard() {
    const tbody = document.getElementById('scoreBoardBody');
    const sorted = Object.values(players).sort((a, b) => b.score - a.score);
    let html = '';
    sorted.forEach(p => {
        let pingColor = p.ping > 100 ? (p.ping > 200 ? 'red' : 'yellow') : '#00ff00';
        html += `
        <tr style="border-bottom:1px solid #444;">
            <td style="padding:5px;">${p.nickname}</td>
            <td style="text-align:center; color:gold;">${p.score}</td>
            <td style="text-align:center; color:#aaa;">${p.bestScore}</td>
            <td style="text-align:right; color:${pingColor};">${p.ping || 0} ms</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function handleChat() {
    const container = document.getElementById('chatInputContainer');
    const input = document.getElementById('chatInput');
    if (container.style.display === 'block') {
        const msg = input.value.trim();
        if (msg) sendMessage(msg);
        input.value = ""; container.style.display = 'none'; input.blur(); 
        setTimeout(() => { canvas.focus(); myPlayer.playing = true; }, 50);
    } else { 
        container.style.display = 'block'; 
        setTimeout(() => { input.focus(); }, 10);
        myPlayer.playing = false; keys = {}; 
    }
}

socket.on('initDiamonds', (d) => diamonds = d);
socket.on('updateDiamonds', (serverDiamonds) => {
    diamonds = serverDiamonds.filter(d => !collectedIds.includes(d.id));
    collectedIds = collectedIds.filter(ghostId => serverDiamonds.some(sd => sd.id === ghostId));
});
socket.on('diceResult', (res) => { showDice = res; setTimeout(() => showDice = null, 4000); });
socket.on('speedBoost', () => { if (myPlayer.speed < 50) { myPlayer.speed = 50; setTimeout(() => myPlayer.speed = 10, 10000); } });

socket.on('chatMessage', (data) => {
    activeMessages[data.id] = data.msg; 
    setTimeout(() => delete activeMessages[data.id], 5000);
    if (data.msg.toLowerCase() === 'sa' && data.id !== socket.id) {
        const now = Date.now();
        if (now - lastAsTime >= 120000) {
            document.getElementById('asButton').style.display = 'block';
            setTimeout(() => { document.getElementById('asButton').style.display = 'none'; }, 5000);
        }
    }
    const log = document.getElementById('chatLog');
    if (log) {
        let gorunenIsim = "???"; let renk = "gold";
        if (data.id === 'Sistem') { gorunenIsim = "SİSTEM"; renk = "red"; } 
        else if (players[data.id]) { gorunenIsim = players[data.id].nickname; } 
        else if (data.id === socket.id) { gorunenIsim = "Ben"; }
        log.innerHTML += `<div><b style="color:${renk}">${gorunenIsim}:</b> ${data.msg}</div>`;
        log.scrollTop = log.scrollHeight;
    }
});

socket.on('state', (state) => {
    tents = state.tents;
    const serverPlayers = state.players;
    for (let id in serverPlayers) {
        if (!players[id]) { players[id] = serverPlayers[id]; } 
        else {
            players[id].targetX = serverPlayers[id].x; 
            players[id].targetY = serverPlayers[id].y;
            players[id].score = serverPlayers[id].score; 
            if (id !== socket.id) players[id].size = serverPlayers[id].size;
            else if (myPlayer.speed === 10) players[id].size = serverPlayers[id].size; 
            
            players[id].bestScore = serverPlayers[id].bestScore;
            players[id].ping = serverPlayers[id].ping;
            players[id].nickname = serverPlayers[id].nickname;
            players[id].color = serverPlayers[id].color;
        }
    }
    for (let id in players) if (!serverPlayers[id]) delete players[id];

    if (players[socket.id]) {
        const currentScore = players[socket.id].score;
        const currentBest = parseInt(localStorage.getItem('zargoryan_best') || 0);
        if (currentScore > currentBest) localStorage.setItem('zargoryan_best', currentScore);
    }
    if (document.getElementById('scoreBoard').style.display === 'block') updateScoreBoard();
    
    const lb = document.getElementById('lb-content');
    if (lb) {
        const sorted = Object.values(players).sort((a, b) => b.score - a.score).slice(0, 10);
        let html = '';
        sorted.forEach((p, i) => {
            html += `
            <div class="player-row">
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">#${i + 1} ${p.nickname}</span>
                <div style="text-align:right;">
                    <span class="score">${p.score}</span>
                    <span class="best-score">🏆${p.bestScore}</span>
                </div>
            </div>`;
        });
        lb.innerHTML = html;
    }
});

function drawD20(ctx, x, y, size, color, val) {
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.fillStyle = color; ctx.strokeStyle = "white"; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { ctx.lineTo(size * Math.cos(i * Math.PI / 3 - Math.PI/6), size * Math.sin(i * Math.PI / 3 - Math.PI/6)); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "white"; ctx.font = "bold " + (size/1.5) + "px Arial"; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(val, 0, 0); ctx.restore();
}

function gameLoop() {
    let dx = 0, dy = 0;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    const promptsDiv = document.getElementById('gpPrompts');
    let promptHtml = "";

    if (gp) {
        if (gp.buttons[9] && gp.buttons[9].pressed) {
            document.getElementById('scoreBoard').style.display = 'block';
            updateScoreBoard();
        } else {
            document.getElementById('scoreBoard').style.display = 'none';
        }

        // A TUŞU (Menü Aç/Kapa)
        if (gp.buttons[0].pressed && !buttonPressed) {
            isChatMenuOpen = !isChatMenuOpen;
            document.getElementById('gamepadChatMenu').style.display = isChatMenuOpen ? 'grid' : 'none';
            buttonPressed = true;
        }

        if (isChatMenuOpen) {
            // B TUŞU (sa)
            if (gp.buttons[1].pressed && !buttonPressed) { 
                sendMessage("sa");
                // KRİTİK DÜZELTME: Menüyü kapat ve yürüme izni ver
                isChatMenuOpen = false;
                document.getElementById('gamepadChatMenu').style.display = 'none';
                buttonPressed = true; 
            } 
            if (gp.buttons[2].pressed && !buttonPressed) { sendMessage("Ağla 😂"); buttonPressed = true; } 
            if (gp.buttons[3].pressed && !buttonPressed) { sendMessage("Bol Şans"); buttonPressed = true; } 
        } 
        else {
            if (Math.abs(gp.axes[0]) > 0.1) dx = gp.axes[0];
            if (Math.abs(gp.axes[1]) > 0.1) dy = gp.axes[1];

            if (document.getElementById('asButton').style.display === 'block') {
                promptHtml += `<div class="prompt-box" style="background:#2ecc71; color:black;"><span style="background:yellow; border-radius:50%; padding:0 8px;">Y</span> AS DE</div>`;
                if (gp.buttons[3].pressed && !buttonPressed) { clickAsButton(); buttonPressed = true; }
            }

            const tent = tents[0];
            const insideTent = tent && myPlayer.x > tent.x && myPlayer.x < tent.x+tent.w && myPlayer.y > tent.y && myPlayer.y < tent.y+tent.h;
            if (insideTent && !showDice) {
                promptHtml += `<div class="prompt-box" style="background:#e67e22;"><span style="background:#3333ff; color:white; border-radius:50%; padding:0 8px;">X</span> ZAR AT</div>`;
                if (gp.buttons[2].pressed && !buttonPressed) { rollDice(); buttonPressed = true; }
            }
        }

        if (!gp.buttons[0].pressed && !gp.buttons[1].pressed && !gp.buttons[2].pressed && !gp.buttons[3].pressed) {
            buttonPressed = false;
        }
    }
    
    promptsDiv.style.display = promptHtml ? 'block' : 'none';
    promptsDiv.innerHTML = promptHtml;

    if (dx === 0 && dy === 0) {
        if (keys['w'] || keys['W']) dy = -1; 
        if (keys['s'] || keys['S']) dy = 1; 
        if (keys['a'] || keys['A']) dx = -1; 
        if (keys['d'] || keys['D']) dx = 1;
    }

    if (myPlayer.playing && hasGivenSalute && !isChatMenuOpen && document.getElementById('chatInputContainer').style.display === 'none') {
        if (dx || dy) {
            const len = Math.sqrt(dx*dx + dy*dy);
            const speedFactor = (gp && len < 1) ? len : 1; 
            let moveSpeed = myPlayer.speed * speedFactor;
            
            let nextX = myPlayer.x + (dx/len) * moveSpeed;
            let nextY = myPlayer.y + (dy/len) * moveSpeed;
            if (nextX < 0) nextX = 0; if (nextX > MAP_WIDTH) nextX = MAP_WIDTH;
            if (nextY < 0) nextY = 0; if (nextY > MAP_HEIGHT) nextY = MAP_HEIGHT;
            myPlayer.x = nextX; myPlayer.y = nextY;
            socket.emit('playerMovement', { x: myPlayer.x, y: myPlayer.y });

            for (let i = diamonds.length - 1; i >= 0; i--) {
                const d = diamonds[i];
                if (Math.sqrt(Math.pow(myPlayer.x - d.x, 2) + Math.pow(myPlayer.y - d.y, 2)) < myPlayer.size + d.size) { 
                    collectedIds.push(d.id);
                    if (d.type === 'super') {
                        triggerRumble(gp, 1.0, 1.0, 500); 
                        myPlayer.speed = 50;
                        if (players[socket.id]) players[socket.id].size = 100;
                        floatingTexts.push({ x: d.x, y: d.y, text: 'HULK MODU!', color: 'red', life: 60 });
                        setTimeout(() => { myPlayer.speed = 10; if (players[socket.id]) players[socket.id].size = 20; }, 10000);
                    } else {
                        triggerRumble(gp, 0.2, 0.0, 100); 
                        floatingTexts.push({ x: d.x, y: d.y, text: '+10', color: '#00ffff', life: 30 });
                    }
                    diamonds.splice(i, 1); 
                }
            }
        }
    }

    const btn = document.getElementById('rollDiceBtn');
    if (tents[0]) {
        const t = tents[0];
        const insideTent = myPlayer.x > t.x && myPlayer.x < t.x+t.w && myPlayer.y > t.y && myPlayer.y < t.y+t.h;
        btn.style.display = (insideTent && !showDice) ? 'block' : 'none';
    }

    draw();
    requestAnimationFrame(gameLoop);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const scale = Math.min(canvas.width / MAP_WIDTH, canvas.height / MAP_HEIGHT) * 1.2; 
    const centerX = (canvas.width - MAP_WIDTH * scale) / 2;
    const centerY = (canvas.height - MAP_HEIGHT * scale) / 2;
    const panX = (1000 - myPlayer.x) * scale * 0.5;
    const panY = (1000 - myPlayer.y) * scale * 0.5;

    ctx.translate(centerX + panX, centerY + panY);
    ctx.scale(scale, scale);

    ctx.strokeStyle = "red"; ctx.lineWidth = 5; ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
    for(let i=0; i<=MAP_WIDTH; i+=100) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_HEIGHT); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MAP_WIDTH, i); ctx.stroke(); }

    tents.forEach(t => { 
        ctx.fillStyle = t.color; ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center"; ctx.fillText(t.label, t.x + t.w/2, t.y - 20);
    });
    diamonds.forEach(d => { ctx.fillStyle = d.color; ctx.fillRect(d.x - d.size/2, d.y - d.size/2, d.size, d.size); });
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ctx.fillStyle = ft.color; ctx.font = "bold 24px Arial"; ctx.textAlign = "center"; ctx.fillText(ft.text, ft.x, ft.y);
        ft.y -= 2; ft.life--; if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    for (let id in players) {
        let p = players[id];
        let px, py;
        if (id === socket.id) { px = myPlayer.x; py = myPlayer.y; } 
        else { p.x = lerp(p.x || 0, p.targetX || 0, 0.2); p.y = lerp(p.y || 0, p.targetY || 0, 0.2); px = p.x; py = p.y; }

        ctx.save(); ctx.translate(px, py);
        ctx.fillStyle = p.color || '#fff'; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
        
        ctx.fillStyle = "white"; ctx.font = "bold 36px Arial"; ctx.textAlign = "center"; 
        ctx.fillText(`${p.nickname} (${p.score})`, 0, p.size + 40);

        if (activeMessages[id]) {
            const msg = activeMessages[id];
            ctx.font = "bold 30px Arial";
            const textWidth = ctx.measureText(msg).width;
            ctx.fillStyle = "white"; ctx.strokeStyle = "#ccc"; ctx.lineWidth = 2;
            ctx.fillRect(-(textWidth+40)/2, -p.size - 80, textWidth+40, 50); ctx.strokeRect(-(textWidth+40)/2, -p.size - 80, textWidth+40, 50);
            ctx.fillStyle = "#333"; ctx.textBaseline = "middle"; ctx.fillText(msg, 0, -p.size - 55);
            ctx.beginPath(); ctx.moveTo(-10, -p.size - 30); ctx.lineTo(10, -p.size - 30); ctx.lineTo(0, -p.size - 15); ctx.fillStyle = "white"; ctx.fill();
        }
        if (id === socket.id && showDice) { drawD20(ctx, 0, -250, 100, showDice.color || '#e67e22', showDice.roll); }
        ctx.restore();
    }
    ctx.restore();
}

gameLoop();
