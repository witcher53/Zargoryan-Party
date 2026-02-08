const Player = require('./Player');
const Diamond = require('./Diamond');

class Game {
    constructor() {
        this.players = {};
        this.diamonds = [];
        this.maxDiamonds = 60;
        this.mapWidth = 2000;
        this.mapHeight = 2000;
        
        // ÇADIRLAR
        this.tents = [
            { id: 0, x: 200, y: 200, w: 200, h: 200, color: '#e67e22', label: "ZAR ATMA (D20)" },
            { id: 1, x: 1600, y: 200, w: 200, h: 200, color: '#9b59b6', label: "BULMACA" },
            { id: 2, x: 200, y: 1600, w: 200, h: 200, color: '#2ecc71', label: "PARKUR" },
            { id: 3, x: 1600, y: 1600, w: 200, h: 200, color: '#e74c3c', label: "ARENA" },
            { id: 4, x: 900, y: 900, w: 200, h: 200, color: '#f1c40f', label: "DISKO" },
            { id: 5, x: 900, y: 200, w: 200, h: 200, color: '#34495e', label: "VIP" }
        ];
        
        for(let i=0; i<30; i++) this.spawnDiamond('normal');

        // Kızıl Elmas
        setInterval(() => { this.spawnDiamond('super'); }, 40000);
    }

    spawnDiamond(type) {
        if (this.diamonds.length < this.maxDiamonds) {
            this.diamonds.push(new Diamond(type));
        }
    }

    addPlayer(id, nickname) { this.players[id] = new Player(id, nickname); }
    removePlayer(id) { delete this.players[id]; }

    // Hareket Sadece Collision Kontrolü Yapar (Zar Yok)
    movePlayer(id, data) {
        const player = this.players[id];
        if (player) {
            player.x = data.x;
            player.y = data.y;
            return this.checkCollisions(player);
        }
        return null;
    }

    // YENİ: Oyuncu butona basınca çağrılır
    playerRollDice(id) {
        const player = this.players[id];
        if (!player) return null;

        const tent = this.tents[0];
        // Gerçekten çadırda mı? (Hile kontrolü)
        if (player.x > tent.x && player.x < tent.x + tent.w &&
            player.y > tent.y && player.y < tent.y + tent.h) {
            
            const now = Date.now();
            // 5 Saniye Cooldown
            if (now - player.lastDiceTime > 5000) {
                player.lastDiceTime = now;
                
                const target = Math.floor(Math.random() * 10) + 11; 
                const roll = Math.floor(Math.random() * 20) + 1;    
                let win = false;
                
                if (roll > target) {
                    player.score += 50;
                    win = true;
                }
                
                return { roll, target, win, nickname: player.nickname };
            }
        }
        return null; // Çadırda değil veya süresi dolmamış
    }

    checkCollisions(player) {
        for (let i = this.diamonds.length - 1; i >= 0; i--) {
            const d = this.diamonds[i];
            const distance = Math.sqrt(Math.pow(player.x - d.x, 2) + Math.pow(player.y - d.y, 2));

            if (distance < player.size + d.size) { // player.size burada önemli
                player.score += d.points;
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
