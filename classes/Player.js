class Player {
    constructor(id, nickname) {
        this.id = id;
        this.nickname = nickname.substring(0, 15);
        // Harita büyük (2000x2000)
        this.x = Math.floor(Math.random() * 1800) + 100;
        this.y = Math.floor(Math.random() * 1800) + 100;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.size = 20; // Normal boyutu
        this.score = 0;
        
        // ZAR ÇADIRI İÇİN: En son ne zaman zar attı?
        this.lastDiceTime = 0;
    }
}
module.exports = Player;
