const Player = require('./Player');
const Diamond = require('./Diamond');
const Cube = require('./Cube');
const Chunk = require('./Chunk');
const { CHUNK_TYPES } = require('./Chunk');

// --- KUVVET HİYERARŞİSİ ---
function getPlayerForce(size) {
    if (size >= 800) return 500;  // Titan
    if (size >= 200) return 50;   // Mega Hulk
    if (size >= 100) return 10;   // Hulk
    return 1;                     // Normal
}

// --- VEKTÖR MATEMATİK ---
function dot(ax, ay, bx, by) { return ax * bx + ay * by; }
function len(x, y) { return Math.sqrt(x * x + y * y); }

// En yakın nokta: Nokta P'den AB doğru parçasına
function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return { x: ax, y: ay, t: 0 };
    let t = dot(apx, apy, abx, aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: ax + t * abx, y: ay + t * aby, t };
}

// Doğru parçasının normal vektörü (yukarı bakan)
function segmentNormal(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l = len(dx, dy);
    if (l === 0) return { x: 0, y: -1 };
    // Normal: (-dy, dx) normalized — "sola" bakan normal
    // Zemin segmentlerinde "yukarı" normalin -y olmasını istiyoruz
    let nx = -dy / l, ny = dx / l;
    // Normalin yukarı bakmasını garanti et
    if (ny > 0) { nx = -nx; ny = -ny; }
    return { x: nx, y: ny };
}

class Game {
    constructor() {
        this.players = {};
        this.maxLocalDiamonds = 60;
        this.mapWidth = 2000;
        this.mapHeight = 2000;

        // Hamster Ball
        this.cube = new Cube();

        // Sonsuz Yol — Vektör Terrain
        this.chunks = [];
        this.generateInitialChunks();

        // Elmaslar küpün İÇİNDE
        for (let i = 0; i < 30; i++) this.cube.spawnDiamond('normal');
        setInterval(() => {
            if (this.cube.localDiamonds.length < this.maxLocalDiamonds) {
                this.cube.spawnDiamond('super');
            }
        }, 40000);

        this.diamonds = [];
        this.tents = [];
    }

    // === CHUNK GENERATION (Vektör) ===
    generateInitialChunks() {
        let startX = 0;
        let lastEndY = 800; // Başlangıç yüksekliği
        for (let i = 0; i < 12; i++) {
            const type = (i < 3) ? 'flat' : CHUNK_TYPES[Math.floor(Math.random() * CHUNK_TYPES.length)];
            const chunk = new Chunk(startX, 1000, type, lastEndY);
            this.chunks.push(chunk);
            startX += chunk.length;
            lastEndY = chunk.endY;
        }
        // Küpü ilk chunk'ın zeminine oturt
        this.cube.x = 600;
        const groundY = this.chunks[0].getGroundY(600) || 800;
        this.cube.y = groundY - this.cube.radius - 1; // Zeminin hemen üstünde
    }

    generateNextChunk() {
        const last = this.chunks[this.chunks.length - 1];
        const type = CHUNK_TYPES[Math.floor(Math.random() * CHUNK_TYPES.length)];
        const chunk = new Chunk(last.x + last.length, last.baseY, type, last.endY);
        this.chunks.push(chunk);
        return chunk;
    }

    removeOldChunks() {
        while (this.chunks.length > 0 && this.chunks[0].x + this.chunks[0].length < this.cube.x - 4000) {
            this.chunks.shift();
        }
    }

    // === ANA FİZİK DÖNGÜSÜ ===
    updateCubePhysics() {
        // 1. Küp fiziğini güncelle (yerçekimi + pozisyon)
        this.cube.update();

        // 2. Circle-Line Collision: Küp vs Zemin Segmentleri
        this.resolveTerrainCollision();

        // 3. Sonsuz yol: yeni chunk ekle, eskiyi sil
        const lastChunk = this.chunks[this.chunks.length - 1];
        const lastEnd = lastChunk.x + lastChunk.length;
        while (this.cube.x > lastEnd - 5000) {
            this.generateNextChunk();
            if (this.chunks.length > 30) break;
        }
        this.removeOldChunks();
    }

    // === CIRCLE-LINE COLLISION ===
    // Küp (daire) her zemin segmentine karşı test edilir
    resolveTerrainCollision() {
        const cx = this.cube.x;
        const cy = this.cube.y;
        const r = this.cube.radius;
        const TERRAIN_FRICTION = 0.02; // Zemin sürtünme katsayısı

        let collided = false;

        for (const chunk of this.chunks) {
            // Sadece yakın chunk'ları kontrol et
            if (chunk.x > cx + r + 200 || chunk.x + chunk.length < cx - r - 200) continue;

            const pts = chunk.points;
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i];
                const b = pts[i + 1];

                // X aralığı kontrolü (erken çıkış)
                if (Math.max(a.x, b.x) < cx - r || Math.min(a.x, b.x) > cx + r) continue;

                // En yakın nokta
                const closest = closestPointOnSegment(cx, cy, a.x, a.y, b.x, b.y);
                const dx = cx - closest.x;
                const dy = cy - closest.y;
                const dist = len(dx, dy);

                if (dist < r && dist > 0.001) {
                    // ÇARPIŞMA! Penetrasyon çözümle
                    collided = true;
                    const penetration = r - dist;

                    // Normal: merkez → en yakın nokta yönünde (dışarı doğru)
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // 1. Penetrasyonu düzelt (küpü dışarı it)
                    this.cube.x += nx * penetration;
                    this.cube.y += ny * penetration;

                    // 2. Hız bileşenlerini ayrıştır
                    const vDotN = dot(this.cube.vx, this.cube.vy, nx, ny);

                    // Sadece yüzeye doğru hareket ediyorsak çöz
                    if (vDotN < 0) {
                        // Normal bileşen (bounce)
                        const vnx = vDotN * nx;
                        const vny = vDotN * ny;

                        // Tangential bileşen
                        const vtx = this.cube.vx - vnx;
                        const vty = this.cube.vy - vny;

                        // Yeni hız: tangent korunur + normal bounce + friction
                        this.cube.vx = vtx * (1 - TERRAIN_FRICTION) - vDotN * this.cube.restitution * nx;
                        this.cube.vy = vty * (1 - TERRAIN_FRICTION) - vDotN * this.cube.restitution * ny;
                    }
                }
            }
        }

        // Güvenlik: Küp çok aşağı düştüyse (düşme koruması)
        if (this.cube.y > 5000) {
            // En yakın chunk'a geri koy
            const chunk = this.chunks[Math.floor(this.chunks.length / 2)];
            if (chunk && chunk.points.length > 0) {
                const mid = chunk.points[Math.floor(chunk.points.length / 2)];
                this.cube.x = mid.x;
                this.cube.y = mid.y - this.cube.radius - 100;
                this.cube.vx = 0;
                this.cube.vy = 0;
            }
        }
    }

    // === PLAYER-CUBE COLLISION + COOPERATIVE FORCE (ROTATING HITBOX) ===
    updatePlayerCubeCollisions() {
        const half = this.cube.size / 2;
        const angle = this.cube.angle || 0;
        const cosA = Math.cos(-angle);  // İnverse rotation (world → local)
        const sinA = Math.sin(-angle);
        const cosB = Math.cos(angle);   // Forward rotation (local → world)
        const sinB = Math.sin(angle);
        const cx = this.cube.x;
        const cy = this.cube.y;

        // Force Accumulator — tüm oyuncuların kuvveti toplanır
        let totalFx = 0;
        let totalFy = 0;

        for (let id in this.players) {
            const p = this.players[id];
            if (!p) continue;

            const pSize = p.size || 20;
            const force = getPlayerForce(pSize);
            const innerLimit = half - pSize;

            // STEP 1-2: World → Cube Lokal Uzay (ters döndürme)
            const dx = p.x - cx;
            const dy = p.y - cy;
            let localX = dx * cosA - dy * sinA;
            let localY = dx * sinA + dy * cosA;

            // STEP 3: Lokal uzayda AABB clamp
            let hitX = false, hitY = false;
            let localDirX = 0, localDirY = 0;

            if (localX < -innerLimit) {
                localDirX = -1;
                localX = -innerLimit;
                hitX = true;
            } else if (localX > innerLimit) {
                localDirX = 1;
                localX = innerLimit;
                hitX = true;
            }

            if (localY < -innerLimit) {
                localDirY = -1;
                localY = -innerLimit;
                hitY = true;
            } else if (localY > innerLimit) {
                localDirY = 1;
                localY = innerLimit;
                hitY = true;
            }

            if (hitX || hitY) {
                // STEP 4: Lokal uzaydaki kuvvet vektörü
                const localFx = hitX ? localDirX * force : 0;
                const localFy = hitY ? localDirY * force : 0;

                // STEP 5: Clamped pozisyonu ve kuvveti world'e geri döndür (+angle)
                p.x = cx + localX * cosB - localY * sinB;
                p.y = cy + localX * sinB + localY * cosB;

                // Kuvveti world uzayına döndür
                totalFx += localFx * cosB - localFy * sinB;
                totalFy += localFx * sinB + localFy * cosB;
            }
        }

        // STEP 6: Toplam kuvveti küpe uygula
        if (totalFx !== 0 || totalFy !== 0) {
            this.cube.applyForce(totalFx, totalFy);
        }
    }

    // === ELMAS ÇARPIŞMA (LOCAL SPACE) ===
    // Oyuncu pozisyonunu -CubeAngle ile döndür, sonra lokal koordinatta kontrol et
    checkLocalDiamondCollisions(player) {
        const pSize = player.size || 20;

        // Oyuncuyu küpün lokal uzayına çevir
        const local = this.cube.worldToLocal(player.x, player.y);

        for (let i = this.cube.localDiamonds.length - 1; i >= 0; i--) {
            const d = this.cube.localDiamonds[i];
            const dx = local.x - d.localX;
            const dy = local.y - d.localY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < pSize + d.size) {
                player.score += d.points;
                if (player.score > player.bestScore) player.bestScore = player.score;

                const type = d.type;
                this.cube.localDiamonds.splice(i, 1);
                if (type === 'normal' && this.cube.localDiamonds.length < this.maxLocalDiamonds) {
                    this.cube.spawnDiamond('normal');
                }
                return { type: 'diamond', subType: type, playerId: player.id };
            }
        }
        return null;
    }

    // === ZAR ATMA (LOCAL SPACE ÇADIR) ===
    playerRollDice(id) {
        const player = this.players[id];
        if (!player) return null;

        // Oyuncuyu lokal uzaya çevir
        const local = this.cube.worldToLocal(player.x, player.y);
        const tent = this.cube.tent;

        // Lokal AABB kontrolü
        if (local.x > tent.localX && local.x < tent.localX + tent.w &&
            local.y > tent.localY && local.y < tent.localY + tent.h) {

            const now = Date.now();
            if (now - player.lastDiceTime > 5000) {
                player.lastDiceTime = now;

                const target = Math.floor(Math.random() * 10) + 11;
                const roll = Math.floor(Math.random() * 20) + 1;
                let win = false;
                let message = "";

                if (roll > target) {
                    win = true;
                    player.score += 300;
                    if (player.score > player.bestScore) player.bestScore = player.score;
                    if (roll === 20) {
                        player.size = 500;
                        message = "MEGA HULK (NAT 20)!";
                    } else {
                        player.size = 100;
                        message = "HULK MODU!";
                    }
                    setTimeout(() => {
                        if (this.players[id]) this.players[id].size = 20;
                    }, 10000);
                }
                return { roll, target, win, nickname: player.nickname, extraMsg: message };
            }
        }
        return null;
    }

    // --- MEVCUT METODLAR ---
    addPlayer(id, nickname, bestScore) {
        const safeNick = (nickname && typeof nickname === 'string') ? nickname.substring(0, 15) : "Unknown";
        const safeScore = (typeof bestScore === 'number' && !isNaN(bestScore)) ? bestScore : 0;
        this.players[id] = new Player(id, safeNick, safeScore);
        this.players[id].x = this.cube.x;
        this.players[id].y = this.cube.y;
    }

    removePlayer(id) { if (this.players[id]) delete this.players[id]; }

    applyPenalty(id, amount) {
        const player = this.players[id];
        if (player && typeof player.score === 'number') {
            player.score -= amount;
            if (player.score < 0) player.score = 0;
        }
    }

    movePlayer(id, data) {
        const player = this.players[id];
        if (player) {
            if (typeof data.x !== 'number' || isNaN(data.x) || typeof data.y !== 'number' || isNaN(data.y)) return null;
            player.x = data.x;
            player.y = data.y;
            return this.checkLocalDiamondCollisions(player);
        }
        return null;
    }

    // === NETWORK OPTIMIZATION: STATE SPLITTING ===

    // 1. DÜŞÜK BANDWIDTH (30Hz) - Sadece hareketli veriler
    getDynamicState() {
        return {
            players: this.players,
            cube: {
                x: this.cube.x, y: this.cube.y,
                vx: this.cube.vx, vy: this.cube.vy,
                angle: this.cube.angle,
                angularVel: this.cube.angularVel
            }
        };
    }

    // 2. YÜKSEK BANDWIDTH (Event-Based) - Sadece değişince
    getStaticState() {
        return {
            chunks: this.chunks.map(c => c.getState()),
            tent: this.cube.tent,
            localDiamonds: this.cube.localDiamonds,
            cubeSize: this.cube.size
        };
    }

    // 3. İLK BAĞLANTI (Full State)
    getInitialState() {
        return {
            dynamic: this.getDynamicState(),
            static: this.getStaticState()
        };
    }
}
module.exports = Game;
