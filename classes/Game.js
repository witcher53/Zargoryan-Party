const Player = require('./Player');
const Diamond = require('./Diamond');
const Cube = require('./Cube');
const Chunk = require('./Chunk');

const CHUNK_TYPES = ['straight', 'straight', 'straight', 'slope_down', 'slope_down', 'slope_up'];

class Game {
    constructor() {
        this.players = {};
        this.maxLocalDiamonds = 60;
        this.mapWidth = 2000;
        this.mapHeight = 2000;

        // Hamster Ball (Dev Küp — her şey bunun İÇİNDE)
        this.cube = new Cube();

        // Sonsuz Yol
        this.chunks = [];
        this.generateInitialChunks();

        // Elmasları küpün İÇİNDE spawn et (lokal koordinat)
        for (let i = 0; i < 30; i++) this.cube.spawnDiamond('normal');
        setInterval(() => {
            if (this.cube.localDiamonds.length < this.maxLocalDiamonds) {
                this.cube.spawnDiamond('super');
            }
        }, 40000);

        // Uyumluluk: eski diamonds array (artık kullanılmıyor ama getState'te lazım olabilir)
        this.diamonds = [];
        this.tents = [];
    }

    // --- CHUNK GENERATION ---
    generateInitialChunks() {
        let startX = 0;
        const trackY = 1000;
        for (let i = 0; i < 12; i++) {
            const type = (i < 2) ? 'straight' : CHUNK_TYPES[Math.floor(Math.random() * CHUNK_TYPES.length)];
            const chunk = new Chunk(startX, trackY, type);
            this.chunks.push(chunk);
            startX += chunk.length;
        }
    }

    generateNextChunk() {
        const last = this.chunks[this.chunks.length - 1];
        const type = CHUNK_TYPES[Math.floor(Math.random() * CHUNK_TYPES.length)];
        const chunk = new Chunk(last.x + last.length, last.y, type);
        this.chunks.push(chunk);
        return chunk;
    }

    removeOldChunks() {
        while (this.chunks.length > 0 && this.chunks[0].x + this.chunks[0].length < this.cube.x - 3000) {
            this.chunks.shift();
        }
    }

    // --- CUBE PHYSICS ---
    updateCubePhysics() {
        // 1. Slope kuvveti
        for (const chunk of this.chunks) {
            if (chunk.contains(this.cube.x, this.cube.y)) {
                this.cube.applySlope(chunk.slopeForce);
                break;
            }
        }

        // 2. Küp fiziği
        this.cube.update();

        // 3. Küpü yol içinde tut
        const currentChunk = this.getChunkAt(this.cube.x, this.cube.y);
        if (currentChunk) {
            const halfW = currentChunk.width / 2;
            const minY = currentChunk.y - halfW + this.cube.size / 2;
            const maxY = currentChunk.y + halfW - this.cube.size / 2;
            if (this.cube.y < minY) { this.cube.y = minY; this.cube.vy = Math.abs(this.cube.vy) * 0.7; }
            if (this.cube.y > maxY) { this.cube.y = maxY; this.cube.vy = -Math.abs(this.cube.vy) * 0.7; }
        }

        // 4. Sonsuz yol
        const lastChunk = this.chunks[this.chunks.length - 1];
        while (this.cube.x > lastChunk.x - 4000) {
            this.generateNextChunk();
            if (this.chunks[this.chunks.length - 1].x > lastChunk.x + 10000) break;
        }
        this.removeOldChunks();
    }

    getChunkAt(x, y) {
        for (const chunk of this.chunks) {
            if (chunk.contains(x, y)) return chunk;
        }
        return this.chunks.length > 0 ? this.chunks[0] : null;
    }

    // --- PLAYER-CUBE İÇ DUVAR ÇARPIŞMASI ---
    updatePlayerCubeCollisions() {
        const half = this.cube.size / 2;

        for (let id in this.players) {
            const p = this.players[id];
            if (!p) continue;

            const pSize = p.size || 20;
            const playerMass = Math.sqrt(pSize / 20);

            const relX = p.x - this.cube.x;
            const relY = p.y - this.cube.y;

            const innerLimit = half - pSize;
            let hit = false;
            let forceX = 0, forceY = 0;

            if (relX < -innerLimit) {
                forceX = (p.x - (this.cube.x - innerLimit));
                p.x = this.cube.x - innerLimit;
                hit = true;
            }
            if (relX > innerLimit) {
                forceX = (p.x - (this.cube.x + innerLimit));
                p.x = this.cube.x + innerLimit;
                hit = true;
            }
            if (relY < -innerLimit) {
                forceY = (p.y - (this.cube.y - innerLimit));
                p.y = this.cube.y - innerLimit;
                hit = true;
            }
            if (relY > innerLimit) {
                forceY = (p.y - (this.cube.y + innerLimit));
                p.y = this.cube.y + innerLimit;
                hit = true;
            }

            if (hit) {
                let multiplier = playerMass / this.cube.mass;
                // TITAN: Size > 190 → kuvvet 10x
                if (pSize > 190) multiplier *= 10;
                this.cube.vx += forceX * multiplier * 2;
                this.cube.vy += forceY * multiplier * 2;
            }
        }
    }

    // --- ELMAS ÇARPIŞMA (LOKAL UZAY → DÜNYA UZAYI MATEMATİĞİ) ---
    // Formül: DiamondWorldPos = CubePos + Rotate(DiamondLocalPos, CubeAngle)
    // Distance(PlayerWorldPos, DiamondWorldPos) < playerSize + diamondSize → TOPLA
    checkLocalDiamondCollisions(player) {
        const pSize = player.size || 20;

        for (let i = this.cube.localDiamonds.length - 1; i >= 0; i--) {
            const d = this.cube.localDiamonds[i];

            // Elmasın dünya pozisyonunu hesapla
            const worldPos = this.cube.localToWorld(d.localX, d.localY);
            const distance = Math.sqrt(
                Math.pow(player.x - worldPos.x, 2) +
                Math.pow(player.y - worldPos.y, 2)
            );

            if (distance < pSize + d.size) {
                player.score += d.points;
                if (player.score > player.bestScore) player.bestScore = player.score;

                const type = d.type;
                this.cube.localDiamonds.splice(i, 1);

                // Normal elması yeniden spawn et
                if (type === 'normal' && this.cube.localDiamonds.length < this.maxLocalDiamonds) {
                    this.cube.spawnDiamond('normal');
                }
                return { type: 'diamond', subType: type, playerId: player.id };
            }
        }
        return null;
    }

    // --- ZAR ATMA (LOKAL ÇADIR POZİSYONU) ---
    playerRollDice(id) {
        const player = this.players[id];
        if (!player) return null;

        // Çadırın dünya pozisyonunu hesapla
        const tent = this.cube.tent;
        const tentWorld = this.cube.localToWorld(tent.localX, tent.localY);
        const tentWorldEnd = this.cube.localToWorld(tent.localX + tent.w, tent.localY + tent.h);

        // Basit AABB: oyuncu çadır alanında mı?
        const minX = Math.min(tentWorld.x, tentWorldEnd.x);
        const maxX = Math.max(tentWorld.x, tentWorldEnd.x);
        const minY = Math.min(tentWorld.y, tentWorldEnd.y);
        const maxY = Math.max(tentWorld.y, tentWorldEnd.y);

        if (player.x > minX && player.x < maxX &&
            player.y > minY && player.y < maxY) {

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
        // Küpün merkezinde spawn
        this.players[id].x = this.cube.x;
        this.players[id].y = this.cube.y;
    }

    removePlayer(id) {
        if (this.players[id]) delete this.players[id];
    }

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
            if (typeof data.x !== 'number' || isNaN(data.x) || typeof data.y !== 'number' || isNaN(data.y)) {
                return null;
            }
            player.x = data.x;
            player.y = data.y;
            // Elmas çarpışması lokal uzayda
            return this.checkLocalDiamondCollisions(player);
        }
        return null;
    }

    getState() {
        return {
            players: this.players,
            diamonds: [],  // Eski uyumluluk (artık localDiamonds'ta)
            tents: [],     // Eski uyumluluk (artık cube.tent'te)
            cube: this.cube.getState(),
            chunks: this.chunks.map(c => c.getState())
        };
    }
}
module.exports = Game;
