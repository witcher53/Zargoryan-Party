class Diamond {
    constructor(type = 'normal') {
        this.type = type;

        // Rastgele pozisyon (Map Size: 2000x2000)
        this.id = Math.random().toString(36).substr(2, 9);
        this.x = Math.floor(Math.random() * 2000);
        this.y = Math.floor(Math.random() * 2000);

        // Özellikler
        if (this.type === 'super') {
            this.color = '#ff0000'; // Kırmızı
            this.size = 50;
            this.points = 50;
        } else {
            this.color = '#00ffff'; // Turkuaz
            this.size = 30;
            this.points = 10;
        }
    }
}

module.exports = Diamond;
