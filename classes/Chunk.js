let chunkCounter = 0;

// Chunk tipleri ve ağırlıkları
const CHUNK_TYPES = ['flat', 'flat', 'hill', 'valley', 'ramp_up', 'ramp_down', 'jagged'];

class Chunk {
    constructor(startX, startY, type, prevEndY) {
        this.id = chunkCounter++;
        this.x = startX;
        this.baseY = startY;       // Yolun merkez Y'si
        this.type = type || 'flat';
        this.length = 1200;        // Chunk uzunluğu (px)
        this.segments = 12;        // Kaç nokta

        // Önceki chunk'ın bitiş Y'sini al (kesintisiz geçiş)
        this.startY = (prevEndY !== undefined) ? prevEndY : startY;

        // Noktaları oluştur
        this.points = this.generatePoints();
        this.endY = this.points[this.points.length - 1].y;
    }

    generatePoints() {
        const pts = [];
        const step = this.length / this.segments;
        const sy = this.startY;

        for (let i = 0; i <= this.segments; i++) {
            const px = this.x + i * step;
            let py = sy;
            const t = i / this.segments; // 0..1 ilerleme

            switch (this.type) {
                case 'flat':
                    py = sy;
                    break;

                case 'hill':
                    // Yukarı tepe — sin eğrisi
                    py = sy - Math.sin(t * Math.PI) * 300;
                    break;

                case 'valley':
                    // Aşağı çukur
                    py = sy + Math.sin(t * Math.PI) * 250;
                    break;

                case 'ramp_up':
                    // Sürekli yokuş yukarı
                    py = sy - t * 400;
                    break;

                case 'ramp_down':
                    // Sürekli yokuş aşağı
                    py = sy + t * 350;
                    break;

                case 'jagged':
                    // Rastgele engebeli arazi
                    if (i === 0) {
                        py = sy;
                    } else if (i === this.segments) {
                        py = sy + (Math.random() - 0.5) * 100;
                    } else {
                        py = sy + (Math.random() - 0.5) * 200;
                    }
                    break;

                default:
                    py = sy;
            }
            pts.push({ x: px, y: py });
        }
        return pts;
    }

    // Verilen X koordinatında bu chunk'taki zemin Y'sini bul (lerp)
    getGroundY(worldX) {
        if (worldX < this.points[0].x || worldX > this.points[this.points.length - 1].x) return null;

        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i + 1];
            if (worldX >= p1.x && worldX <= p2.x) {
                const t = (worldX - p1.x) / (p2.x - p1.x);
                return p1.y + t * (p2.y - p1.y);
            }
        }
        return null;
    }

    // Bu chunk'ın x aralığında mı?
    containsX(worldX) {
        return worldX >= this.x && worldX <= this.x + this.length;
    }

    getState() {
        return {
            id: this.id,
            x: this.x,
            baseY: this.baseY,
            length: this.length,
            type: this.type,
            points: this.points,  // Tüm vektör noktaları client'a gidecek
            startY: this.startY,
            endY: this.endY
        };
    }
}

module.exports = Chunk;
module.exports.CHUNK_TYPES = CHUNK_TYPES;
