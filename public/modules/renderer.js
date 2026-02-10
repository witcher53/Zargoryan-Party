import { state, MAP_WIDTH, MAP_HEIGHT } from './state.js';

function lerp(start, end, t) {
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end)) end = start;
    return start * (1 - t) + end * t;
}

const obsImages = [];
const imgUrls = ["diddy.jpg", "epstein.jpg", "diddy.jpg"];
imgUrls.forEach(url => { const img = new Image(); img.src = url; obsImages.push(img); });

const colImages = [];
const colUrls = ["kirk.jpg", "recai.jpg", "kaanflix.jpg"];
colUrls.forEach(url => { const img = new Image(); img.src = url; colImages.push(img); });

function drawScaledImage(ctx, img, x, y, fixedHeight) {
    if (img.complete && img.naturalHeight !== 0) {
        const ratio = img.naturalWidth / img.naturalHeight;
        const newWidth = fixedHeight * ratio;
        ctx.drawImage(img, x, y, newWidth, fixedHeight);
        return newWidth;
    } else {
        ctx.fillRect(x, y, fixedHeight, fixedHeight);
        return fixedHeight;
    }
}

function drawD20(ctx, x, y, size, color, val) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(size * Math.cos(i * Math.PI / 3 - Math.PI / 6), size * Math.sin(i * Math.PI / 3 - Math.PI / 6));
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "white"; ctx.font = "bold " + (size / 1.5) + "px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(val, 0, 0); ctx.restore();
}

// --- CHUNK ÇİZİMİ ---
function drawChunks(ctx) {
    state.chunks.forEach(chunk => {
        const halfW = chunk.width / 2;
        ctx.fillStyle = chunk.color;
        ctx.fillRect(chunk.x, chunk.y - halfW, chunk.length, chunk.width);

        ctx.strokeStyle = '#ffffff33';
        ctx.lineWidth = 3;
        ctx.strokeRect(chunk.x, chunk.y - halfW, chunk.length, chunk.width);

        ctx.save();
        ctx.setLineDash([20, 20]);
        ctx.strokeStyle = '#ffffff15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(chunk.x, chunk.y);
        ctx.lineTo(chunk.x + chunk.length, chunk.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        if (chunk.type === 'slope_down') {
            for (let i = 0; i < 5; i++) {
                const ax = chunk.x + (i + 0.5) * (chunk.length / 5);
                drawArrow(ctx, ax, chunk.y, 1, '#00ff0066');
            }
        }
        if (chunk.type === 'slope_up') {
            for (let i = 0; i < 5; i++) {
                const ax = chunk.x + (i + 0.5) * (chunk.length / 5);
                drawArrow(ctx, ax, chunk.y, -1, '#ff000066');
            }
        }

        if (chunk.label) {
            ctx.fillStyle = '#ffffff88';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(chunk.label, chunk.x + chunk.length / 2, chunk.y - halfW - 15);
        }
    });
}

function drawArrow(ctx, x, y, dir, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + dir * 20, y);
    ctx.lineTo(x - dir * 10, y - 12);
    ctx.lineTo(x - dir * 10, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

export function drawGame(ctx, canvas, socket) {
    const mp = state.myPlayer;
    const cube = state.cube;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // === KAMERA: KÜP'Ü TAKİP ET ===
    const camX = (cube && Number.isFinite(cube.x)) ? cube.x : 1000;
    const camY = (cube && Number.isFinite(cube.y)) ? cube.y : 1000;

    // Zoom: Küp 3000 birim, ekrana sığdırmak için 0.35
    const zoom = Math.min(canvas.width, canvas.height) / (cube.size * 1.4);
    const offsetX = (canvas.width / 2) - (camX * zoom);
    const offsetY = (canvas.height / 2) - (camY * zoom);
    ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);

    // === ARKA PLAN GRID ===
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const viewW = canvas.width / zoom;
    const viewH = canvas.height / zoom;
    const gridStart = Math.floor((camX - viewW) / 200) * 200;
    const gridEnd = camX + viewW;
    const gridYStart = Math.floor((camY - viewH) / 200) * 200;
    const gridYEnd = camY + viewH;
    for (let gx = gridStart; gx <= gridEnd; gx += 200) {
        ctx.beginPath(); ctx.moveTo(gx, gridYStart); ctx.lineTo(gx, gridYEnd); ctx.stroke();
    }
    for (let gy = gridYStart; gy <= gridYEnd; gy += 200) {
        ctx.beginPath(); ctx.moveTo(gridStart, gy); ctx.lineTo(gridEnd, gy); ctx.stroke();
    }

    // === CHUNK'LARI ÇİZ ===
    drawChunks(ctx);

    // ============================================
    // === KÜP + CHILD OBJECTS (LOKAL UZAY) ===
    // ============================================
    // ctx.translate → küp merkezi, ctx.rotate → küp açısı
    // Bu blokta çizilen her şey küple birlikte döner
    ctx.save();
    ctx.translate(camX, camY);
    ctx.rotate(cube.angle || 0);

    const half = cube.size / 2;

    // --- KÜP KENARLARI ---
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 8;
    ctx.strokeRect(-half, -half, cube.size, cube.size);

    // İç parlak kenar
    ctx.strokeStyle = '#ff6b6b33';
    ctx.lineWidth = 3;
    ctx.strokeRect(-half + 20, -half + 20, cube.size - 40, cube.size - 40);

    // Çapraz çizgiler
    ctx.strokeStyle = '#ffffff08';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-half, -half); ctx.lineTo(half, half);
    ctx.moveTo(half, -half); ctx.lineTo(-half, half);
    ctx.stroke();

    // Köşe noktaları
    const dotSize = 12;
    ctx.fillStyle = '#e74c3c';
    [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(([cx, cy]) => {
        ctx.fillRect(cx - dotSize / 2, cy - dotSize / 2, dotSize, dotSize);
    });

    // --- ÇADIR (LOKAL KOORDİNATTA) ---
    if (cube.tent) {
        const t = cube.tent;
        ctx.fillStyle = t.color || '#e67e22';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(t.localX, t.localY, t.w, t.h);
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#ffffff66';
        ctx.lineWidth = 3;
        ctx.strokeRect(t.localX, t.localY, t.w, t.h);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 50px Arial";
        ctx.textAlign = "center";
        ctx.fillText(t.label || 'ZAR', t.localX + t.w / 2, t.localY + t.h / 2 + 15);
    }

    // --- ELMASLAR (LOKAL KOORDİNATTA) ---
    if (cube.localDiamonds) {
        cube.localDiamonds.forEach(d => {
            ctx.fillStyle = d.color || '#00ffff';
            ctx.shadowBlur = (d.type === 'super') ? 15 : 5;
            ctx.shadowColor = d.color || '#00ffff';
            ctx.fillRect(d.localX - d.size / 2, d.localY - d.size / 2, d.size, d.size);
            ctx.shadowBlur = 0;
        });
    }

    // --- MINIGAME ITEMS (LOKAL KOORDİNATTA) ---
    if (state.minigame.active) {
        state.minigame.obstacles.forEach(obs => {
            if (!obs.hit) {
                const img = obsImages[obs.imgIndex] || obsImages[0];
                ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "red";
                obs.w = drawScaledImage(ctx, img, obs.localX || obs.x, obs.localY || obs.y, obs.h);
                ctx.restore();
            }
        });
        state.minigame.collectibles.forEach(col => {
            if (!col.collected) {
                const img = colImages[col.imgIndex] || colImages[0];
                ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "#00ff00";
                col.w = drawScaledImage(ctx, img, col.localX || col.x, col.localY || col.y, col.h);
                ctx.restore();
            }
        });
    }

    ctx.restore(); // ← Küp lokal uzayından çık

    // ============================================
    // === OYUNCULAR (DÜNYA UZAYI — DÖNMEZ) ===
    // ============================================
    const safeX = (Number.isFinite(mp.x)) ? mp.x : 1000;
    const safeY = (Number.isFinite(mp.y)) ? mp.y : 1000;

    // Floating texts (world space)
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        let ft = state.floatingTexts[i];
        ctx.fillStyle = ft.color; ctx.font = "bold 24px Arial"; ctx.textAlign = "center"; ctx.fillText(ft.text, ft.x, ft.y);
        ft.y -= 2; ft.life--; if (ft.life <= 0) state.floatingTexts.splice(i, 1);
    }

    for (let id in state.players) {
        let p = state.players[id];
        if (!p) continue;

        if (isNaN(p.x)) p.x = 1000;
        if (isNaN(p.y)) p.y = 1000;
        if (isNaN(p.targetX)) p.targetX = p.x;
        if (isNaN(p.targetY)) p.targetY = p.y;

        let px, py;
        if (id === socket.id) {
            px = safeX; py = safeY;
            if (mp.nextClick === 2) {
                ctx.save(); ctx.fillStyle = "yellow"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
                const dSize = Math.min((p.size || 20), 1000);
                ctx.fillText(`SAĞA ABAN! (${(2000 - (Date.now() - mp.comboTimer)) / 1000}s)`, px, py - dSize - 25); ctx.restore();
            }
        }
        else {
            p.x = lerp(p.x, p.targetX, 0.2);
            p.y = lerp(p.y, p.targetY, 0.2);
            px = p.x; py = p.y;
        }

        ctx.save(); ctx.translate(px, py);

        let realSize = (p.size && Number.isFinite(p.size) && p.size > 0) ? p.size : 20;
        let drawSize = Math.min(realSize, 1000);

        ctx.fillStyle = p.color || '#fff';
        ctx.beginPath(); ctx.arc(0, 0, drawSize, 0, Math.PI * 2); ctx.fill();

        if (realSize >= 100) {
            ctx.strokeStyle = (realSize >= 200) ? "#FFD700" : "#ff0000";
            ctx.lineWidth = 5;
        } else {
            ctx.strokeStyle = "white"; ctx.lineWidth = 2;
        }
        ctx.stroke();

        ctx.fillStyle = "white"; ctx.font = "bold 36px Arial"; ctx.textAlign = "center";
        ctx.fillText(`${p.nickname} (${p.score})`, 0, drawSize + 40);

        if (state.activeMessages[id]) {
            const msg = state.activeMessages[id];
            ctx.font = "bold 30px Arial";
            const textWidth = ctx.measureText(msg).width;
            ctx.fillStyle = "white"; ctx.strokeStyle = "#ccc"; ctx.lineWidth = 2;
            ctx.fillRect(-(textWidth + 40) / 2, -drawSize - 80, textWidth + 40, 50);
            ctx.strokeRect(-(textWidth + 40) / 2, -drawSize - 80, textWidth + 40, 50);
            ctx.fillStyle = "#333"; ctx.textBaseline = "middle";
            ctx.fillText(msg, 0, -drawSize - 55);
            ctx.beginPath(); ctx.moveTo(-10, -drawSize - 30); ctx.lineTo(10, -drawSize - 30); ctx.lineTo(0, -drawSize - 15); ctx.fillStyle = "white"; ctx.fill();
        }

        if (id === socket.id && state.showDice) {
            const diceColor = state.showDice.win ? '#00ff00' : '#ff0000';
            drawD20(ctx, 0, -250, 100, diceColor, state.showDice.roll);
        }
        ctx.restore();
    }
    ctx.restore(); // ← Kamera transform'dan çık

    // === HUD (Ekran uzayı — zoom'dan etkilenmez) ===
    if (mp.playing) {
        const speedVal = Math.sqrt(mp.vx * mp.vx + mp.vy * mp.vy).toFixed(0);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(10, 10, 300, 190);
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(10, 10, 300, 190);

        ctx.textAlign = "left";
        let pingColor = state.currentPing < 100 ? '#00ff00' : (state.currentPing < 200 ? 'yellow' : 'red');
        ctx.font = "bold 20px Arial"; ctx.fillStyle = pingColor; ctx.fillText(`PING: ${state.currentPing} ms`, 25, 45);
        ctx.fillStyle = "#00ffff"; ctx.fillText(`HIZ: ${speedVal}`, 25, 75);
        const comboColor = mp.momentum > 2.0 ? `hsl(${Date.now() % 360}, 100%, 70%)` : "orange";
        ctx.fillStyle = comboColor; ctx.font = "bold 24px Arial"; ctx.fillText(`KOMBO: x${mp.momentum.toFixed(2)}`, 25, 110);

        if (cube) {
            const cubeSpeed = Math.sqrt((cube.vx || 0) ** 2 + (cube.vy || 0) ** 2).toFixed(1);
            ctx.fillStyle = '#e74c3c'; ctx.font = "bold 18px Arial";
            ctx.fillText(`KÜP HIZ: ${cubeSpeed}`, 25, 140);
        }

        ctx.textAlign = "center"; ctx.font = "bold 14px Arial"; ctx.fillStyle = "#FFD700";
        ctx.fillText("SOL TIK + SAĞ TIK ABAN", 160, 165);
        ctx.fillText("= AŞIRI HIZLAN! 🚀", 160, 182);
        ctx.restore();

        if (state.showDice) {
            ctx.save(); ctx.textAlign = "left";
            const x = 20, y = canvas.height - 110;
            ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(x, y, 300, 90);
            ctx.strokeStyle = "gold"; ctx.lineWidth = 3; ctx.strokeRect(x, y, 300, 90);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText(`HEDEF: > ${state.showDice.target}`, x + 20, y + 35);
            const resultText = state.showDice.win ? "KAZANDIN! 🎉" : "KAYBETTİN... 💀";
            ctx.fillStyle = state.showDice.win ? "#00ff00" : "#ff0000";
            ctx.font = "bold 22px Arial";
            ctx.fillText(resultText, x + 20, y + 70);
            ctx.restore();
        }

        if (state.minigame.active) {
            const mg = state.minigame;
            ctx.save(); ctx.textAlign = "center";
            if (mg.phase === 'countdown') {
                ctx.font = "bold 40px Arial"; ctx.fillStyle = "red";
                ctx.fillText(`⚠️ TEHLİKE GELİYOR: ${Math.ceil(mg.countdownVal)} ⚠️`, canvas.width / 2, 80);
            } else {
                ctx.font = "bold 30px Arial"; ctx.fillStyle = "white";
                ctx.fillText(`HAYATTA KAL: ${mg.timeLeft.toFixed(1)}s`, canvas.width / 2, 60);
            }
            ctx.textAlign = "left"; ctx.fillStyle = "#00ff00"; ctx.font = "bold 30px Arial";
            ctx.fillText(`KAZANILAN: +${mg.sessionScoreGained}`, 20, canvas.height / 2);
            ctx.textAlign = "right"; ctx.fillStyle = "#ff0000";
            ctx.fillText(`KAYBEDİLEN: -${mg.sessionScoreLost}`, canvas.width - 20, canvas.height / 2);
            ctx.restore();
        }
    }
}