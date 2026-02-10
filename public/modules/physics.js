import { state, MAP_WIDTH, MAP_HEIGHT } from './state.js';

export function triggerRumble(gp, weak, strong, duration) {
    if (gp && gp.vibrationActuator) {
        try {
            gp.vibrationActuator.playEffect("dual-rumble", {
                startDelay: 0, duration: duration, weakMagnitude: weak, strongMagnitude: strong
            });
        } catch (e) { }
    }
}

// === LOKAL UZAY YARDIMCILARI ===
function cubeLocalToWorld(localX, localY) {
    const cube = state.cube;
    const cos = Math.cos(cube.angle || 0);
    const sin = Math.sin(cube.angle || 0);
    return {
        x: cube.x + localX * cos - localY * sin,
        y: cube.y + localX * sin + localY * cos
    };
}

function worldToCubeLocal(worldX, worldY) {
    const cube = state.cube;
    const cos = Math.cos(-(cube.angle || 0));
    const sin = Math.sin(-(cube.angle || 0));
    const dx = worldX - cube.x;
    const dy = worldY - cube.y;
    return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos
    };
}

// === MINIGAME (KÜP LOKAL UZAYINDA) ===
function updateMinigame(socket) {
    const mg = state.minigame;
    const mp = state.myPlayer;
    const cube = state.cube;
    const now = Date.now();
    const cubeHalf = cube.size / 2;

    if (mg.phase === 'countdown') {
        const elapsed = (now - mg.startTime) / 1000;
        mg.countdownVal = 5 - elapsed;
        if (mg.countdownVal <= 0) {
            mg.phase = 'active';
            mg.startTime = Date.now();
            mg.obstacles = [];
            mg.collectibles = [];
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

    // --- SPAWN: NADİR AMA HIZLI (Küp lokal "üst"ten düşer) ---
    if (Math.random() < 0.008) {
        mg.obstacles.push({
            localX: (Math.random() - 0.5) * cubeHalf * 1.5,
            localY: -cubeHalf + 50,
            w: 120, h: 120,
            vy: Math.random() * 8 + 10,  // HIZLI düşüş
            hit: false,
            imgIndex: Math.floor(Math.random() * 3)
        });
    }
    else if (Math.random() < 0.012) {
        mg.collectibles.push({
            localX: (Math.random() - 0.5) * cubeHalf * 1.5,
            localY: -cubeHalf + 50,
            w: 100, h: 100,
            vy: Math.random() * 5 + 8,
            collected: false,
            imgIndex: Math.floor(Math.random() * 3)
        });
    }

    // --- OBSTACLES (Lokal koordinatta düşer) ---
    // Oyuncu pozisyonunu lokal uzaya çevir
    const playerLocal = worldToCubeLocal(mp.x, mp.y);
    const pSize = (mp.size && !isNaN(mp.size)) ? mp.size : 20;

    for (let i = mg.obstacles.length - 1; i >= 0; i--) {
        let obs = mg.obstacles[i];
        obs.localY += obs.vy;

        if (!obs.hit &&
            playerLocal.x < obs.localX + obs.w && playerLocal.x + pSize > obs.localX &&
            playerLocal.y < obs.localY + obs.h && playerLocal.y + pSize > obs.localY
        ) {
            obs.hit = true;
            socket.emit('minigamePenalty', 50);
            mg.sessionScoreLost += 50;
            state.floatingTexts.push({ x: mp.x, y: mp.y, text: '-50 DARBE!', color: 'red', life: 30 });
            triggerRumble(null, 1.0, 1.0, 300);
        }
        // Küpün altından çıktıysa sil
        if (obs.localY > cubeHalf) mg.obstacles.splice(i, 1);
    }

    // --- COLLECTIBLES (Lokal koordinatta düşer) ---
    for (let i = mg.collectibles.length - 1; i >= 0; i--) {
        let col = mg.collectibles[i];
        col.localY += col.vy;

        if (!col.collected &&
            playerLocal.x < col.localX + col.w && playerLocal.x + pSize > col.localX &&
            playerLocal.y < col.localY + col.h && playerLocal.y + pSize > col.localY
        ) {
            col.collected = true;
            socket.emit('claimAsReward'); socket.emit('claimAsReward');
            mg.sessionScoreGained += 100;
            state.floatingTexts.push({ x: mp.x, y: mp.y - 50, text: '+100 ALDIN!', color: '#00ff00', life: 40 });
            triggerRumble(null, 0.5, 0.5, 100);
        }
        if (col.localY > cubeHalf) {
            if (!col.collected) {
                socket.emit('minigamePenalty', 5);
                mg.sessionScoreLost += 5;
                // Düştüğü yerin world pozisyonunu hesapla
                const wp = cubeLocalToWorld(col.localX, cubeHalf);
                state.floatingTexts.push({ x: wp.x, y: wp.y, text: '-5 KAÇTI!', color: 'orange', life: 30 });
            }
            mg.collectibles.splice(i, 1);
        }
    }
}

// === ANA FİZİK MOTORU ===
export function updatePhysics(socket, gp) {
    const mp = state.myPlayer;

    // ACİL DURUM KONTROLÜ
    if (isNaN(mp.x) || !Number.isFinite(mp.x)) mp.x = state.cube.x || 1000;
    if (isNaN(mp.y) || !Number.isFinite(mp.y)) mp.y = state.cube.y || 1000;
    if (isNaN(mp.vx) || !Number.isFinite(mp.vx)) mp.vx = 0;
    if (isNaN(mp.vy) || !Number.isFinite(mp.vy)) mp.vy = 0;
    if (isNaN(mp.momentum)) mp.momentum = 1.0;
    if (!mp.speed) mp.speed = 10;

    let ax = 0, ay = 0;

    // INPUTS
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

    // MOMENTUM AZALMASI
    mp.momentum *= 0.997;
    if (mp.momentum < 1.0) mp.momentum = 1.0;

    if (mp.nextClick === 2 && Date.now() - mp.comboTimer > 2000) {
        mp.nextClick = 0;
        mp.momentum = Math.max(1.0, mp.momentum - 0.5);
        state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'SÜRE BİTTİ', color: 'gray', life: 20 });
    }

    // --- KÜTLE SİSTEMİ ---
    const visualSize = (mp.size && !isNaN(mp.size)) ? mp.size : 20;
    const mass = Math.sqrt(visualSize / 20);
    const effectiveAcc = mp.acc / mass;

    // --- VEKTÖR EKLEME (Drift) ---
    const len = Math.sqrt(ax * ax + ay * ay);
    if (len > 0) {
        const boostMul = (mp.speed > 20) ? 1.5 : 1.0;
        const accX = (ax / len) * effectiveAcc * mp.momentum * boostMul;
        const accY = (ay / len) * effectiveAcc * mp.momentum * boostMul;
        if (Number.isFinite(accX)) mp.vx += accX;
        if (Number.isFinite(accY)) mp.vy += accY;
    }

    // --- SÜRTÜNME ---
    mp.vx *= mp.friction;
    mp.vy *= mp.friction;

    // --- HIZ LİMİTİ ---
    const maxSpeedLimit = 45 * mp.momentum / mass;
    const currentSpeed = Math.sqrt(mp.vx * mp.vx + mp.vy * mp.vy);
    if (currentSpeed > maxSpeedLimit && currentSpeed > 0 && Number.isFinite(currentSpeed)) {
        const ratio = maxSpeedLimit / currentSpeed;
        if (!isNaN(ratio) && Number.isFinite(ratio)) {
            mp.vx *= ratio;
            mp.vy *= ratio;
        }
    }

    if (Math.abs(mp.vx) < 0.05) mp.vx = 0;
    if (Math.abs(mp.vy) < 0.05) mp.vy = 0;

    const HARD_CAP = 80;
    mp.vx = Math.max(-HARD_CAP, Math.min(HARD_CAP, mp.vx));
    mp.vy = Math.max(-HARD_CAP, Math.min(HARD_CAP, mp.vy));

    let nextX = mp.x + mp.vx;
    let nextY = mp.y + mp.vy;

    // --- OYUNCU KÜP İÇİNDE ---
    const r = visualSize;
    const cube = state.cube;
    const cubeHalf = (cube ? cube.size / 2 : 1500);
    const cubeX = (cube ? cube.x : 1000);
    const cubeY = (cube ? cube.y : 1000);
    const innerLimit = cubeHalf - r;
    const BOUNCE = 0.95;

    if (nextX < cubeX - innerLimit) {
        nextX = cubeX - innerLimit;
        mp.vx = Math.abs(mp.vx) * BOUNCE;
        triggerRumble(gp, 0.8, 1.0, 200);
    }
    if (nextX > cubeX + innerLimit) {
        nextX = cubeX + innerLimit;
        mp.vx = -Math.abs(mp.vx) * BOUNCE;
        triggerRumble(gp, 0.8, 1.0, 200);
    }
    if (nextY < cubeY - innerLimit) {
        nextY = cubeY - innerLimit;
        mp.vy = Math.abs(mp.vy) * BOUNCE;
        triggerRumble(gp, 0.8, 1.0, 200);
    }
    if (nextY > cubeY + innerLimit) {
        nextY = cubeY + innerLimit;
        mp.vy = -Math.abs(mp.vy) * BOUNCE;
        triggerRumble(gp, 0.8, 1.0, 200);
    }

    if (!isNaN(nextX) && !isNaN(nextY) && Number.isFinite(nextX) && Number.isFinite(nextY)) {
        if (Math.abs(mp.x - nextX) > 0.01 || Math.abs(mp.y - nextY) > 0.01) {
            mp.x = nextX; mp.y = nextY;
            socket.emit('playerMovement', { x: mp.x, y: mp.y });
        }
    } else {
        mp.vx = 0; mp.vy = 0;
    }

    // ELMAS TOPLAMA (Client-side ghost removal — server handles actual scoring)
    if (cube && cube.localDiamonds) {
        const cos = Math.cos(cube.angle || 0);
        const sin = Math.sin(cube.angle || 0);
        for (let i = state.diamonds.length - 1; i >= 0; i--) {
            const d = state.diamonds[i];
            if (!d) continue;
            // localToWorld
            const wx = cube.x + d.localX * cos - d.localY * sin;
            const wy = cube.y + d.localX * sin + d.localY * cos;
            const dist = Math.sqrt((mp.x - wx) ** 2 + (mp.y - wy) ** 2);
            if (!isNaN(dist) && dist < visualSize + d.size) {
                state.collectedIds.push(d.id);
                if (d.type === 'super') {
                    triggerRumble(gp, 1.0, 1.0, 500);
                    state.floatingTexts.push({ x: wx, y: wy, text: 'GÜÇ!', color: 'red', life: 60 });
                } else {
                    triggerRumble(gp, 0.2, 0.0, 100);
                    state.floatingTexts.push({ x: wx, y: wy, text: '+10', color: '#00ffff', life: 30 });
                }
                state.diamonds.splice(i, 1);
            }
        }
    }
}

function handleComboInput(btnCode, mp) {
    if (btnCode === mp.nextClick) {
        if (btnCode === 0) {
            mp.nextClick = 2; mp.comboTimer = Date.now();
            state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'SAĞA ABAN! ->', color: 'yellow', life: 20 });
        } else if (btnCode === 2) {
            if (Date.now() - mp.comboTimer < 2000) {
                mp.momentum += 0.8;
                if (mp.momentum > mp.maxMomentum) mp.momentum = mp.maxMomentum;
                state.floatingTexts.push({ x: mp.x, y: mp.y - 50, text: 'HIZLANDIN! 🔥', color: '#00ff00', life: 40 });
                mp.nextClick = 0;
            } else {
                mp.nextClick = 0; mp.momentum = 1.0;
                state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'YAVAŞSIN!', color: 'red', life: 30 });
            }
        }
    }
}