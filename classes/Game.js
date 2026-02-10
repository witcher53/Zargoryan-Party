const Player = require('./Player');
const Diamond = require('./Diamond');
const Cube = require('./Cube');
const Chunk = require('./Chunk');

const CHUNK_TYPES = ['straight', 'straight', 'straight', 'slope_down', 'slope_down', 'slope_up'];
const CHUNK_BUFFER_AHEAD = 8;
const CHUNK_BUFFER_BEHIND = 3;

class Game {
    constructor() {
        this.players = {};
        this.diamonds = [];
        this.maxDiamonds = 60;
        this.mapWidth = 2000;
        this.mapHeight = 2000;

        // Çadır Alanı
        this.tents = [
            { id: 0, x: 0, y: 0, w: 400, h: 400, color: '#e67e22', label: "ZAR ALANI" }
        ];

        // Hamster Ball (Küp)
        this.cube = new Cube();

        // Sonsuz Yol
        this.chunks = [];
        this.generateInitialChunks();

        for (let i = 0; i < 30; i++) this.spawnDiamond('normal');
        setInterval(() => { this.spawnDiamond('super'); }, 40000);
    }

    // --- CHUNK GENERATION ---
    generateInitialChunks() {
        let startX = 0;
        const trackY = 1000; // Yolun Y merkezi
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
        // Küpün arkasında kalan chunk'ları sil
        while (this.chunks.length > 0 && this.chunks[0].x + this.chunks[0].length < this.cube.x - 1500) {
            this.chunks.shift();
        }
    }

    // --- CUBE PHYSICS (Her tick çağrılır) ---
    updateCubePhysics() {
        // 1. Küpün üzerinde olduğu chunk'ı bul
        for (const chunk of this.chunks) {
            if (chunk.contains(this.cube.x, this.cube.y)) {
                this.cube.applySlope(chunk.slopeForce);
                break;
            }
        }

        // 2. Küp fiziğini güncelle
        this.cube.update();

        // 3. Küpü yol içinde tut (Y ekseni sınırı)
        const currentChunk = this.getChunkAt(this.cube.x, this.cube.y);
        if (currentChunk) {
            const halfW = currentChunk.width / 2;
            const minY = currentChunk.y - halfW + this.cube.size / 2;
            const maxY = currentChunk.y + halfW - this.cube.size / 2;
            if (this.cube.y < minY) { this.cube.y = minY; this.cube.vy = Math.abs(this.cube.vy) * 0.7; }
            if (this.cube.y > maxY) { this.cube.y = maxY; this.cube.vy = -Math.abs(this.cube.vy) * 0.7; }
        }

        // 4. Sonsuz yol: yeni chunk ekle, eskiyi sil
        const lastChunk = this.chunks[this.chunks.length - 1];
        while (this.cube.x > lastChunk.x - 2000) {
            this.generateNextChunk();
            if (this.chunks[this.chunks.length - 1].x > lastChunk.x + 5000) break;
        }
        this.removeOldChunks();
    }

    getChunkAt(x, y) {
        for (const chunk of this.chunks) {
            if (chunk.contains(x, y)) return chunk;
        }
        return this.chunks.length > 0 ? this.chunks[0] : null;
    }

    // --- PLAYER-CUBE COLLISION (Her tick çağrılır) ---
    updatePlayerCubeCollisions() {
        const half = this.cube.size / 2;
        const cubeX = this.cube.x;
        const cubeY = this.cube.y;

        for (let id in this.players) {
            const p = this.players[id];
            if (!p) continue;

            const pSize = p.size || 20;
            const playerMass = Math.sqrt(pSize / 20);

            // Oyuncunun küp içindeki relatif pozisyonu
            const relX = p.x - cubeX;
            const relY = p.y - cubeY;

            // İç duvar sınırları
            const innerLimit = half - pSize;
            let hit = false;
            let forceX = 0, forceY = 0;

            // Sol duvar
            if (relX < -innerLimit) {
                forceX = (p.x - (cubeX - innerLimit)); // Negatif: sola itiyor
                p.x = cubeX - innerLimit;
                hit = true;
            }
            // Sağ duvar
            if (relX > innerLimit) {
                forceX = (p.x - (cubeX + innerLimit)); // Pozitif: sağa itiyor
                p.x = cubeX + innerLimit;
                hit = true;
            }
            // Üst duvar
            if (relY < -innerLimit) {
                forceY = (p.y - (cubeY - innerLimit));
                p.y = cubeY - innerLimit;
                hit = true;
            }
            // Alt duvar
            if (relY > innerLimit) {
                forceY = (p.y - (cubeY + innerLimit));
                p.y = cubeY + innerLimit;
                hit = true;
            }

            if (hit) {
                // Momentum transfer: oyuncudan küpe
                let multiplier = playerMass / this.cube.mass;

                // TITAN MEKANİĞİ: Size > 190 ise kuvvet 10x
                if (pSize > 190) multiplier *= 10;

                // Oyuncunun hızından küpe kuvvet aktar
                // forceX/Y negatifse oyuncu duvara doğru gidiyordu → küpü o yöne it
                this.cube.vx += forceX * multiplier * 2;
                this.cube.vy += forceY * multiplier * 2;
            }
        }
    }

    // --- MEVCUT METODLAR (DEĞİŞMEDİ) ---
    spawnDiamond(type) {
        if (this.diamonds.length < this.maxDiamonds) {
            this.diamonds.push(new Diamond(type));
        }
    }

    addPlayer(id, nickname, bestScore) {
        const safeNick = (nickname && typeof nickname === 'string') ? nickname.substring(0, 15) : "Unknown";
        const safeScore = (typeof bestScore === 'number' && !isNaN(bestScore)) ? bestScore : 0;
        this.players[id] = new Player(id, safeNick, safeScore);
        // Oyuncuyu küpün merkezinde spawn et
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

            return this.checkCollisions(player);
        }
        return null;
    }

    playerRollDice(id) {
        const player = this.players[id];
        if (!player) return null;

        const tent = this.tents[0];
        if (player.x > tent.x && player.x < tent.x + tent.w &&
            player.y > tent.y && player.y < tent.y + tent.h) {

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

    checkCollisions(player) {
        const pSize = player.size || 20;

        for (let i = this.diamonds.length - 1; i >= 0; i--) {
            const d = this.diamonds[i];
            const distance = Math.sqrt(Math.pow(player.x - d.x, 2) + Math.pow(player.y - d.y, 2));

            if (distance < pSize + d.size) {
                player.score += d.points;
                if (player.score > player.bestScore) player.bestScore = player.score;

                const type = d.type;
                this.diamonds.splice(i, 1);
                if (type === 'normal') this.spawnDiamond('normal');
                return { type: 'diamond', subType: type, playerId: player.id };
            }
        }
        return null;
    }

    getState() {
        return {
            players: this.players,
            diamonds: this.diamonds,
            tents: this.tents,
            cube: this.cube.getState(),
            chunks: this.chunks.map(c => c.getState())
        };
    }
}
module.exports = Game;
