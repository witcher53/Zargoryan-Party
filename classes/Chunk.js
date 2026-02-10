let chunkCounter = 0;

class Chunk {
    constructor(startX, startY, type) {
        this.id = chunkCounter++;
        this.x = startX;
        this.y = startY;
        this.type = type || 'straight';  // 'straight', 'slope_down', 'slope_up'
        this.width = 600;    // Yol genişliği
        this.length = 800;   // Chunk uzunluğu

        // Eğim kuvveti
        switch (this.type) {
            case 'slope_down':
                this.slopeForce = { x: 0.8, y: 0 };   // Sağa hızlandır
                this.color = '#1a3a1a';  // Yeşilimsi
                this.label = '⬇ YOKUŞ';
                break;
            case 'slope_up':
                this.slopeForce = { x: -0.5, y: 0 };  // Sola yavaşlat
                this.color = '#3a2a1a';  // Kahve
                this.label = '⬆ YOKUŞ';
                break;
            default:
                this.slopeForce = { x: 0, y: 0 };
                this.color = '#2a2a2a';  // Koyu gri
                this.label = '';
                break;
        }
    }

    // Küp bu chunk'ın içinde mi?
    contains(objX, objY) {
        return objX >= this.x &&
            objX <= this.x + this.length &&
            objY >= this.y - this.width / 2 &&
            objY <= this.y + this.width / 2;
    }

    getState() {
        return {
            id: this.id, x: this.x, y: this.y,
            width: this.width, length: this.length,
            type: this.type, color: this.color, label: this.label,
            slopeForce: this.slopeForce
        };
    }
}

module.exports = Chunk;
