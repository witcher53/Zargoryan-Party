const Player = require('./Player');
const Diamond = require('./Diamond');

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

        for(let i=0; i<30; i++) this.spawnDiamond('normal');
        setInterval(() => { this.spawnDiamond('super'); }, 40000);
    }

    spawnDiamond(type) {
        if (this.diamonds.length < this.maxDiamonds) {
            this.diamonds.push(new Diamond(type));
        }
    }

    addPlayer(id, nickname, bestScore) {
        // İsim ve skor kontrolü
        const safeNick = (nickname && typeof nickname === 'string') ? nickname.substring(0, 15) : "Unknown";
        const safeScore = (typeof bestScore === 'number' && !isNaN(bestScore)) ? bestScore : 0;
        this.players[id] = new Player(id, safeNick, safeScore);
    }

    removePlayer(id) { 
        if (this.players[id]) {
            delete this.players[id]; 
        }
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
            // --- KRİTİK KORUMA: Bozuk Sayı Gelirse İşleme ---
            if (typeof data.x !== 'number' || isNaN(data.x) || typeof data.y !== 'number' || isNaN(data.y)) {
                return null;
            }

            // Sınır Kontrolü (Harita dışına çıkmayı sunucuda da engelle)
            // Oyuncuyu harita sınırlarına hapseder
            let safeX = Math.max(0, Math.min(data.x, this.mapWidth));
            let safeY = Math.max(0, Math.min(data.y, this.mapHeight));

            player.x = safeX;
            player.y = safeY;
            
            return this.checkCollisions(player);
        }
        return null;
    }

    playerRollDice(id) {
        const player = this.players[id];
        if (!player) return null;

        const tent = this.tents[0];
        // Çadırın içinde mi?
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
        // Player size yoksa varsayılan 20 yap
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
        return { players: this.players, diamonds: this.diamonds, tents: this.tents };
    }
}
module.exports = Game;
