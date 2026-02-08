const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

// --- GHOST LIST (LAG ÇÖZÜCÜ) ---
let collectedIds = []; // Sunucu onaylayana kadar burada tutacağız
let floatingTexts = []; // Puan efektleri için

let players = {}, diamonds = [], tents = [], activeMessages = {}, keys = {}, showDice = null;
let myPlayer = { x: 1000, y: 1000, speed: 10, playing: false, size: 20 };

// GIMMICK
let hasGivenSalute = false;
let lastAsTime = 0;

function lerp(start, end, t) { return start * (1 - t) + end * t; }

window.startGame = function() {
    const nick = document.getElementById('nicknameInput').value;
    if (nick.trim()) { 
        socket.emit('joinGame', nick); 
        myPlayer.playing = true; 
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('saWarning').style.display = 'block';
        setTimeout(() => { canvas.focus(); window.focus(); }, 100);
    }
};

window.clickAsButton = function() {
    const btn = document.getElementById('asButton');
    const now = Date.now();
    if (now - lastAsTime < 120000) { alert("2 Dakika beklemen lazım!"); return; }
    socket.emit('chatMessage', 'as'); 
    socket.emit('claimAsReward'); 
    lastAsTime = now;
    btn.style.display = 'none'; 
    canvas.focus();
};

window.rollDice = function() {
    socket.emit('requestDiceRoll');
    document.getElementById('rollDiceBtn').style.display = 'none';
    setTimeout(() => { canvas.focus(); }, 50);
};

// --- KLAVYE ---
document.addEventListener('keydown', (e) => { 
    if (document.activeElement === document.getElementById('chatInput')) {
        if (e.key === 'Enter') handleChat(); return; 
    }
    if (e.key === 'Enter') { handleChat(); return; }
    keys[e.key] = true; 
});
document.addEventListener('keyup', (e) => keys[e.key] = false);

function handleChat() {
    const container = document.getElementById('chatInputContainer');
    const input = document.getElementById('chatInput');
    
    if (container.style.display === 'block') {
        const msg = input.value.trim();
        if (msg) {
            socket.emit('chatMessage', msg.substring(0, 30));
            if (!hasGivenSalute && msg.toLowerCase() === 'sa') {
                hasGivenSalute = true;
                document.getElementById('saWarning').style.display = 'none';
                const log = document.getElementById('chatLog');
                if (log) log.innerHTML += `<div><b style="color:#00ff00">SİSTEM:</b> Kilit açıldı! Saldır!</div>`;
            }
        }
        input.value = ""; container.style.display = 'none'; input.blur(); 
        setTimeout(() => { canvas.focus(); myPlayer.playing = true; }, 50);
    } else { 
        container.style.display = 'block'; 
        setTimeout(() => { input.focus(); }, 10);
        myPlayer.playing = false; keys = {}; 
    }
}

// --- SOCKET EVENTS (BURASI DEĞİŞTİ) ---
socket.on('initDiamonds', (d) => diamonds = d);

// EN ÖNEMLİ KISIM BURASI: UPDATE GELDİĞİNDE FİLTRELEME YAPIYORUZ
socket.on('updateDiamonds', (serverDiamonds) => {
    // Sunucudan gelen listeden, bizim "zaten yediğimiz" (collectedIds) elmasları çıkarıyoruz.
    // Böylece sunucu "bu elmas hala var" dese bile biz çizmiyoruz.
    diamonds = serverDiamonds.filter(d => !collectedIds.includes(d.id));

    // Temizlik: Eğer sunucu da artık o elması sildiyse, biz de hayalet listesinden silebiliriz.
    // (Hafıza şişmesin diye)
    collectedIds = collectedIds.filter(ghostId => serverDiamonds.some(sd => sd.id === ghostId));
});

socket.on('diceResult', (res) => { showDice = res; setTimeout(() => showDice = null, 4000); });
socket.on('speedBoost', () => { myPlayer.speed = 50; setTimeout(() => myPlayer.speed = 10, 10000); });

socket.on('chatMessage', (data) => {
    activeMessages[data.id] = data.msg; 
    setTimeout(() => delete activeMessages[data.id], 5000);
    const log = document.getElementById('chatLog');
    
    if (data.msg.toLowerCase() === 'sa' && data.id !== socket.id) {
        const now = Date.now();
        if (now - lastAsTime >= 120000) {
            document.getElementById('asButton').style.display = 'block';
            setTimeout(() => { document.getElementById('asButton').style.display = 'none'; }, 5000);
        }
    }

    if (log) {
        let gorunenIsim = "???"; let renk = "gold";
        if (data.id === 'Sistem') { gorunenIsim = "SİSTEM";rk = "red"; } 
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
            players[id].size = serverPlayers[id].size;
            players[id].nickname = serverPlayers[id].nickname;
            players[id].color = serverPlayers[id].color;
        }
    }
    for (let id in players) if (!serverPlayers[id]) delete players[id];

    const lb = document.getElementById('lb-content');
    if (lb) {
        const sorted = Object.values(players).sort((a, b) => b.score - a.score).slice(0, 10);
        let html = '';
        sorted.forEach((p, i) => {
            html += `<div class="player-row" style="border-bottom:1px solid rgba(255,255,255,0.1); padding:2px;"><span>#${i + 1} ${p.nickname}</span><span class="score">${p.score}</span></div>`;
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
    if (myPlayer.playing && hasGivenSalute && document.getElementById('chatInputContainer').style.display === 'none') {
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy = -1; 
        if (keys['s'] || keys['S']) dy = 1; 
        if (keys['a'] || keys['A']) dx = -1; 
        if (keys['d'] || keys['D']) dx = 1;
        
        if (dx || dy) {
            const len = Math.sqrt(dx*dx + dy*dy);
            let nextX = myPlayer.x + (dx/len) * myPlayer.speed;
            let nextY = myPlayer.y + (dy/len) * myPlayer.speed;
            if (nextX < 0) nextX = 0; if (nextX > MAP_WIDTH) nextX = MAP_WIDTH;
            if (nextY < 0) nextY = 0; if (nextY > MAP_HEIGHT) nextY = MAP_HEIGHT;
            myPlayer.x = nextX; myPlayer.y = nextY;
            socket.emit('playerMovement', { x: myPlayer.x, y: myPlayer.y });

            // --- SMOOTH ELMAS TOPLAMA ---
            for (let i = diamonds.length - 1; i >= 0; i--) {
                const d = diamonds[i];
                if (Math.sqrt(Math.pow(myPlayer.x - d.x, 2) + Math.pow(myPlayer.y - d.y, 2)) < myPlayer.size + d.size) { 
                    // 1. Ghost Listeye Ekle
                    collectedIds.push(d.id);
                    
                    // 2. Efekt Oluştur (+10 yazısı)
                    floatingTexts.push({
                        x: d.x, y: d.y, 
                        text: d.type === 'super' ? '+50' : '+10', 
                        color: d.type === 'super' ? 'red' : '#00ffff',
                        life: 30 // 30 frame (1 saniye) yaşayacak
                    });

                    // 3. Ekrandan Sil
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

    // --- PUAN EFEKTLERİNİ ÇİZ ---
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ctx.fillStyle = ft.color;
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ft.y -= 2; // Yukarı doğru uçsun
        ft.life--; // Ömrü azalsın
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    for (let id in players) {
        let p = players[id];
        let px, py;
        if (id === socket.id) { px = myPlayer.x; py = myPlayer.y; } 
        else { p.x = lerp(p.x || 0, p.targetX || 0, 0.2); p.y = lerp(p.y || 0, p.targetY || 0, 0.2); px = p.x; py = p.y; }

        ctx.save(); ctx.translate(px, py);
        ctx.fillStyle = p.color || '#fff'; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "white"; ctx.font = "bold 36px Arial"; ctx.textAlign = "center"; ctx.fillText(`${p.nickname} (${p.score})`, 0, p.size + 40);

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
