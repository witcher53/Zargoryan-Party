class Diamond {
    constructor(type = 'normal') {
        this.type = type; // 'normal' veya 'super'
        this.id = Math.random().toString(36).substr(2, 9);
        // Harita büyüdü (2000x2000)
        this.x = Math.floor(Math.random() * 1900) + 50;
        this.y = Math.floor(Math.random() * 1900) + 50;
        
        if (type === 'super') {
            this.color = '#ff0000'; // Kırmızı
            this.size = 25; // Daha büyük
            this.points = 50; // 50 Puan
        } else {
            this.color = '#00ffff'; // Cyan
            this.size = 15;
            this.points = 10;
        }
    }
}
module.exports = Diamond;
