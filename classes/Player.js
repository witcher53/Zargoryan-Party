class Player {
    constructor(id, nickname, bestScore = 0) {
        this.id = id;
        this.nickname = nickname.substring(0, 15);
        this.x = Math.floor(Math.random() * 1800) + 100;
        this.y = Math.floor(Math.random() * 1800) + 100;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.size = 20; 
        this.score = 0;
        this.bestScore = parseInt(bestScore) || 0;
        
        // YENİ: Ping Bilgisi
        this.ping = 0;

        this.lastDiceTime = 0;
    }
}
module.exports = Player;
