const Player = require('./Player');
const Diamond = require('./Diamond');

class Game {
    constructor() {
        this.players = {};
        this.diamonds = [];
        this.maxDiamonds = 60;
        this.mapWidth = 2000;
        this.mapHeight = 2000;

        // SADECE ZAR ÇADIRI KALDI
        this.tents = [
            { id: 0, x: 200, y: 200, w: 200, h: 200, color: '#e67e22', label: "ZAR ATMA (D20)" }
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
        this.players[id] = new Player(id, nickname, bestScore); 
    }
    
    removePlayer(id) { delete this.players[id]; }

    movePlayer(id, data) {
        const player = this.players[id];
        if (player) {
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
        // Çadır kontrolü
        if (player.x > tent.x && player.x < tent.x + tent.w &&
            player.y > tent.y && player.y < tent.y + tent.h) {

            const now = Date.now();
            if (now - player.lastDiceTime > 5000) {
                player.lastDiceTime = now;

                const target = Math.floor(Math.random() * 10) + 11;
                const roll = Math.floor(Math.random() * 20) + 1;
                let win = false;

                if (roll > target) {
                    player.score += 50;
                    if (player.score > player.bestScore) player.bestScore = player.score;
                    win = true;
                }

                return { roll, target, win, nickname: player.nickname };
            }
        }
        return null;
    }

    checkCollisions(player) {
        for (let i = this.diamonds.length - 1; i >= 0; i--) {
            const d = this.diamonds[i];
            const distance = Math.sqrt(Math.pow(player.x - d.x, 2) + Math.pow(player.y - d.y, 2));

            if (distance < player.size + d.size) { 
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
