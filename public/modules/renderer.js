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
        ctx.lineTo(size * Math.cos(i * Math.PI / 3 - Math.PI/6), size * Math.sin(i * Math.PI / 3 - Math.PI/6)); 
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "white"; ctx.font = "bold " + (size/1.5) + "px Arial"; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(val, 0, 0); ctx.restore();
}

export function drawGame(ctx, canvas, socket) {
    const mp = state.myPlayer;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    const safeX = (Number.isFinite(mp.x)) ? mp.x : 1000;
    const safeY = (Number.isFinite(mp.y)) ? mp.y : 1000;

    const scale = Math.min(canvas.width / MAP_WIDTH, canvas.height / MAP_HEIGHT) * 1.2; 
    const centerX = (canvas.width - MAP_WIDTH * scale) / 2;
    const centerY = (canvas.height - MAP_HEIGHT * scale) / 2;
    const panX = (1000 - safeX) * scale * 0.5;
    const panY = (1000 - safeY) * scale * 0.5;

    ctx.translate(centerX + panX, centerY + panY);
    ctx.scale(scale, scale);

    ctx.strokeStyle = "red"; ctx.lineWidth = 5; ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
    for(let i=0; i<=MAP_WIDTH; i+=100) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_HEIGHT); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MAP_WIDTH, i); ctx.stroke(); }

    state.tents.forEach(t => { 
        ctx.fillStyle = t.color; ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center"; ctx.fillText(t.label, t.x + t.w/2, t.y - 20);
    });
    state.diamonds.forEach(d => { ctx.fillStyle = d.color; ctx.fillRect(d.x - d.size/2, d.y - d.size/2, d.size, d.size); });

    if (state.minigame.active) {
        state.minigame.obstacles.forEach(obs => {
            if(!obs.hit) {
                const img = obsImages[obs.imgIndex] || obsImages[0];
                ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "red"; 
                obs.w = drawScaledImage(ctx, img, obs.x, obs.y, obs.h);
                ctx.restore();
            }
        });
        state.minigame.collectibles.forEach(col => {
            if(!col.collected) {
                const img = colImages[col.imgIndex] || colImages[0];
                ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "#00ff00"; 
                col.w = drawScaledImage(ctx, img, col.x, col.y, col.h);
                ctx.restore();
            }
        });
    }

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
                 const dSize = Math.min((p.size || 20), 1000); // Limit arttı
                 ctx.fillText(`SAĞA ABAN! (${(2000 - (Date.now() - mp.comboTimer))/1000}s)`, px, py - dSize - 25); ctx.restore();
            }
        } 
        else { 
            p.x = lerp(p.x, p.targetX, 0.2); 
            p.y = lerp(p.y, p.targetY, 0.2); 
            px = p.x; py = p.y; 
        }

        ctx.save(); ctx.translate(px, py);

        // --- GÖRSEL LIMIT ARTIRILDI ---
        let realSize = (p.size && Number.isFinite(p.size) && p.size > 0) ? p.size : 20;
        let drawSize = Math.min(realSize, 1000); // 150 yerine 1000 yaptık ki Titan gözüksün!

        ctx.fillStyle = p.color || '#fff'; 
        ctx.beginPath(); ctx.arc(0, 0, drawSize, 0, Math.PI*2); ctx.fill(); 
        
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
            ctx.fillRect(-(textWidth+40)/2, -drawSize - 80, textWidth+40, 50); 
            ctx.strokeRect(-(textWidth+40)/2, -drawSize - 80, textWidth+40, 50);
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
    ctx.restore();

    if (mp.playing) {
        const speedVal = Math.sqrt(mp.vx*mp.vx + mp.vy*mp.vy).toFixed(0);
        
        ctx.save(); 
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; 
        ctx.fillRect(10, 10, 300, 170);
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(10, 10, 300, 170);
        
        ctx.textAlign = "left";
        let pingColor = state.currentPing < 100 ? '#00ff00' : (state.currentPing < 200 ? 'yellow' : 'red');
        ctx.font = "bold 20px Arial"; ctx.fillStyle = pingColor; ctx.fillText(`PING: ${state.currentPing} ms`, 25, 45);
        ctx.fillStyle = "#00ffff"; ctx.fillText(`HIZ: ${speedVal}`, 25, 80);
        const comboColor = mp.momentum > 2.0 ? `hsl(${Date.now() % 360}, 100%, 70%)` : "orange";
        ctx.fillStyle = comboColor; ctx.font = "bold 24px Arial"; ctx.fillText(`KOMBO: x${mp.momentum.toFixed(2)}`, 25, 115);
        
        ctx.textAlign = "center"; ctx.font = "bold 14px Arial"; ctx.fillStyle = "#FFD700"; 
        ctx.fillText("SOL TIK + SAĞ TIK ABAN", 160, 145); 
        ctx.fillText("= AŞIRI HIZLAN! 🚀", 160, 160);
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
                ctx.fillText(`⚠️ TEHLİKE GELİYOR: ${Math.ceil(mg.countdownVal)} ⚠️`, canvas.width/2, 80);
            } else {
                ctx.font = "bold 30px Arial"; ctx.fillStyle = "white";
                ctx.fillText(`HAYATTA KAL: ${mg.timeLeft.toFixed(1)}s`, canvas.width/2, 60);
            }
            ctx.textAlign = "left"; ctx.fillStyle = "#00ff00"; ctx.font = "bold 30px Arial";
            ctx.fillText(`KAZANILAN: +${mg.sessionScoreGained}`, 20, canvas.height / 2);
            ctx.textAlign = "right"; ctx.fillStyle = "#ff0000"; 
            ctx.fillText(`KAYBEDİLEN: -${mg.sessionScoreLost}`, canvas.width - 20, canvas.height / 2);
            ctx.restore();
        }
    }
}