import { state, MAP_WIDTH, MAP_HEIGHT } from './state.js';

export function triggerRumble(gp, weak, strong, duration) {
    if (gp && gp.vibrationActuator) {
        try {
            gp.vibrationActuator.playEffect("dual-rumble", {
                startDelay: 0, duration: duration, weakMagnitude: weak, strongMagnitude: strong
            });
        } catch(e) {}
    }
}

function updateMinigame(socket) {
    const mg = state.minigame;
    const mp = state.myPlayer;
    const now = Date.now();

    if (mg.phase === 'countdown') {
        const elapsed = (now - mg.startTime) / 1000;
        mg.countdownVal = 5 - elapsed;
        
        if (mg.countdownVal <= 0) {
            mg.phase = 'active';
            mg.startTime = Date.now();
            mg.obstacles = [];
            mg.collectibles = [];
            
            // SKORLARI SIFIRLA
            mg.sessionScoreGained = 0;
            mg.sessionScoreLost = 0;
            
            state.floatingTexts.push({ x: mp.x, y: mp.y - 100, text: 'KAÇ VE TOPLA!', color: '#00ff00', life: 60 });
        }
        return; 
    }

    mg.timeLeft = Math.max(0, 20 - (now - mg.startTime) / 1000); 
    
    if (mg.timeLeft <= 0) {
        mg.active = false;
        state.floatingTexts.push({ x: mp.x, y: mp.y, text: 'TUR BİTTİ!', color: '#00ff00', life: 60 });
        return;
    }

    // --- DAHA AZ RESİM YAĞMASI ---
    // Oranları düşürdüm: 0.06 -> 0.02 ve 0.10 -> 0.03
    if (Math.random() < 0.02) { 
        mg.obstacles.push({ x: Math.random() * MAP_WIDTH, y: -150, w: 120, h: 120, vy: Math.random() * 3 + 4, hit: false, imgIndex: Math.floor(Math.random() * 3) });
    }
    else if (Math.random() < 0.03) { 
        mg.collectibles.push({ x: Math.random() * MAP_WIDTH, y: -150, w: 100, h: 100, vy: Math.random() * 2 + 3, collected: false, imgIndex: Math.floor(Math.random() * 3) });
    }

    // --- FİZİK GÜNCELLEME (OBSTACLES) ---
    for (let i = mg.obstacles.length - 1; i >= 0; i--) {
        let obs = mg.obstacles[i];
        obs.y += obs.vy;

        // Çarpışma Kontrolü (Güvenli)
        const pSize = (mp.size && !isNaN(mp.size)) ? mp.size : 20;
        
        if (!obs.hit && !isNaN(mp.x) && !isNaN(mp.y) &&
            mp.x < obs.x + obs.w && mp.x + pSize > obs.x &&
            mp.y < obs.y + obs.h && mp.y + pSize > obs.y
        ) {
            obs.hit = true;
            socket.emit('minigamePenalty', 50); 
            // Skoru anlık güncelle
            mg.sessionScoreLost += 50; 
            state.floatingTexts.push({ x: mp.x, y: mp.y, text: '-50 DARBE!', color: 'red', life: 30 });
            triggerRumble(null, 1.0, 1.0, 300);
        }

        if (obs.y > MAP_HEIGHT) mg.obstacles.splice(i, 1);
    }

    // --- FİZİK GÜNCELLEME (COLLECTIBLES) ---
    for (let i = mg.collectibles.length - 1; i >= 0; i--) {
        let col = mg.collectibles[i];
        col.y += col.vy;

        const pSize = (mp.size && !isNaN(mp.size)) ? mp.size : 20;
        
        if (!col.collected && !isNaN(mp.x) && !isNaN(mp.y) &&
            mp.x < col.x + col.w && mp.x + pSize > col.x &&
            mp.y < col.y + col.h && mp.y + pSize > col.y
        ) {
            col.collected = true;
            socket.emit('claimAsReward'); socket.emit('claimAsReward'); 
            // Skoru anlık güncelle
            mg.sessionScoreGained += 100;
            state.floatingTexts.push({ x: mp.x, y: mp.y - 50, text: '+100 ALDIN!', color: '#00ff00', life: 40 });
            triggerRumble(null, 0.5, 0.5, 100);
        }

        if (col.y > MAP_HEIGHT) {
            if (!col.collected) {
                socket.emit('minigamePenalty', 5); 
                // Kaçanlar için de skor güncelle
                mg.sessionScoreLost += 5;
                state.floatingTexts.push({ x: col.x, y: MAP_HEIGHT - 50, text: '-5 KAÇTI!', color: 'orange', life: 30 });
            }
            mg.collectibles.splice(i, 1);
        }
    }
}

export function updatePhysics(socket, gp) {
    const mp = state.myPlayer;

    // 1. ACİL DURUM KONTROLÜ
    if (isNaN(mp.x) || !Number.isFinite(mp.x)) mp.x = 1000;
    if (isNaN(mp.y) || !Number.isFinite(mp.y)) mp.y = 1000;
    if (isNaN(mp.vx) || !Number.isFinite(mp.vx)) mp.vx = 0;
    if (isNaN(mp.vy) || !Number.isFinite(mp.vy)) mp.vy = 0;
    if (isNaN(mp.momentum)) mp.momentum = 1.0;
    if (!mp.speed) mp.speed = 10;

    let ax = 0, ay = 0;
    
    if (gp) {
        if (Math.abs(gp.axes[0]) > 0.1) ax = gp.axes[0];
        if (Math.abs(gp.axes[1]) > 0.1) ay = gp.axes[1];
        const ltPressed = gp.buttons[6].pressed;
        const rtPressed = gp.buttons[7].pressed;
        if (ltPressed && !state.gpState.lastLt) handleComboInput(0, mp);
        if (rtPressed && !state.gpState.lastRt) handleComboInput(2, mp);
        state.gpState.lastLt = ltPressed;
        state.gpState.lastRt = rtPressed;
    }

    if (ax === 0 && ay === 0) {
        if (state.keys['w'] || state.keys['W']) ay = -1;
        if (state.keys['s'] || state.keys['S']) ay = 1;
        if (state.keys['a'] || state.keys['A']) ax = -1;
        if (state.keys['d'] || state.keys['D']) ax = 1;
    }

    if (state.minigame.active) {
        updateMinigame(socket);
    }

    mp.momentum *= 0.995; 
    if (mp.momentum < 1.0) mp.momentum = 1.0;
    if (isNaN(mp.momentum)) mp.momentum = 1.0;

    if (mp.nextClick === 2 && Date.now() - mp.comboTimer > 2000) {
        mp.nextClick = 0;
        mp.momentum = Math.max(1.0, mp.momentum - 0.5);
        state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'SÜRE BİTTİ', color: 'gray', life: 20 });
    }

    const len = Math.sqrt(ax*ax + ay*ay);
    if (len > 0) {
        const baseAcc = (mp.speed > 20) ? mp.acc * 2 : mp.acc;
        
        const newVx = mp.vx + (ax / len) * baseAcc * mp.momentum;
        const newVy = mp.vy + (ay / len) * baseAcc * mp.momentum;

        if (Number.isFinite(newVx)) mp.vx = newVx;
        if (Number.isFinite(newVy)) mp.vy = newVy;
    }

    mp.vx *= mp.friction;
    mp.vy *= mp.friction;

    const maxSpeedLimit = 30 * mp.momentum;
    const currentSpeed = Math.sqrt(mp.vx*mp.vx + mp.vy*mp.vy);
    
    if (currentSpeed > maxSpeedLimit && currentSpeed > 0 && Number.isFinite(currentSpeed)) {
        const ratio = maxSpeedLimit / currentSpeed;
        if (!isNaN(ratio) && Number.isFinite(ratio)) {
            mp.vx *= ratio;
            mp.vy *= ratio;
        }
    }

    if (Math.abs(mp.vx) < 0.1) mp.vx = 0;
    if (Math.abs(mp.vy) < 0.1) mp.vy = 0;

    // Mutlak Hız Limiti
    if (mp.vx > 100) mp.vx = 100; if (mp.vx < -100) mp.vx = -100;
    if (mp.vy > 100) mp.vy = 100; if (mp.vy < -100) mp.vy = -100;

    let nextX = mp.x + mp.vx;
    let nextY = mp.y + mp.vy;

    const visualSize = (mp.size && !isNaN(mp.size)) ? mp.size : 20;
    const r = Math.min(visualSize, 40); 
    
    const pushBuffer = r + 2;
    let bounceMultiplier = (r > 30) ? 1.1 : 1.5; 
    const momentumKick = (mp.momentum * 20) * (r / 20);

    if (nextX < r) { nextX = pushBuffer; mp.vx = Math.abs(mp.vx) * bounceMultiplier + momentumKick; triggerRumble(gp, 1.0, 1.0, 200); }
    if (nextX > MAP_WIDTH - r) { nextX = MAP_WIDTH - pushBuffer; mp.vx = -Math.abs(mp.vx) * bounceMultiplier - momentumKick; triggerRumble(gp, 1.0, 1.0, 200); }
    if (nextY < r) { nextY = pushBuffer; mp.vy = Math.abs(mp.vy) * bounceMultiplier + momentumKick; triggerRumble(gp, 1.0, 1.0, 200); }
    if (nextY > MAP_HEIGHT - r) { nextY = MAP_HEIGHT - pushBuffer; mp.vy = -Math.abs(mp.vy) * bounceMultiplier - momentumKick; triggerRumble(gp, 1.0, 1.0, 200); }

    if (!isNaN(nextX) && !isNaN(nextY) && Number.isFinite(nextX) && Number.isFinite(nextY)) {
        if (Math.abs(mp.x - nextX) > 0.01 || Math.abs(mp.y - nextY) > 0.01) {
            mp.x = nextX; 
            mp.y = nextY;
            socket.emit('playerMovement', { x: mp.x, y: mp.y });
        }
    } else {
        mp.vx = 0;
        mp.vy = 0;
    }

    for (let i = state.diamonds.length - 1; i >= 0; i--) {
        const d = state.diamonds[i];
        if (!d) continue; 
        
        const dist = Math.sqrt((mp.x - d.x)**2 + (mp.y - d.y)**2);
        
        if (!isNaN(dist) && dist < visualSize + d.size) { 
            state.collectedIds.push(d.id);
            if (d.type === 'super') {
                triggerRumble(gp, 1.0, 1.0, 500); 
                state.floatingTexts.push({ x: d.x, y: d.y, text: 'GÜÇ!', color: 'red', life: 60 });
            } else {
                triggerRumble(gp, 0.2, 0.0, 100); 
                state.floatingTexts.push({ x: d.x, y: d.y, text: '+10', color: '#00ffff', life: 30 });
            }
            state.diamonds.splice(i, 1); 
        }
    }
}

function handleComboInput(btnCode, mp) {
    if (btnCode === mp.nextClick) {
        if (btnCode === 0) { 
            mp.nextClick = 2; 
            mp.comboTimer = Date.now(); 
            state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'SAĞA ABAN! ->', color: 'yellow', life: 20 });
        } else if (btnCode === 2) { 
            if (Date.now() - mp.comboTimer < 2000) {
                mp.momentum += 0.8; 
                if (mp.momentum > mp.maxMomentum) mp.momentum = mp.maxMomentum;
                state.floatingTexts.push({ x: mp.x, y: mp.y - 50, text: 'HIZLANDIN! 🔥', color: '#00ff00', life: 40 });
                mp.nextClick = 0; 
            } else {
                mp.nextClick = 0;
                mp.momentum = 1.0;
                state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'YAVAŞSIN!', color: 'red', life: 30 });
            }
        }
    }
}