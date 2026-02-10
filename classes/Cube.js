class Cube {
    constructor() {
        this.x = 1000;
        this.y = 1000;
        this.vx = 0;
        this.vy = 0;
        this.mass = 50;
        this.size = 3000;
        this.radius = this.size / 2;
        this.angle = 0;
        this.angularVel = 0;
        this.friction = 0.985;
        this.restitution = 0.3; // Bounce katsayısı (0 = tam yapışkan, 1 = tam elastik)

        // --- LOCAL SPACE CHILD OBJECTS ---
        this.tent = {
            localX: -400, localY: -400,
            w: 500, h: 500,
            color: '#e67e22', label: 'ZAR ALANI'
        };
        this.localDiamonds = [];

        // Yerçekimi
        this.gravity = 0.5;
    }

    // --- KUVVET UYGULAMA ---
    // Oyuncuların toplam kuvveti buraya gelir
    applyForce(fx, fy) {
        this.vx += fx / this.mass;
        this.vy += fy / this.mass;
    }

    // --- LOCAL ↔ WORLD DÖNÜŞÜM ---
    localToWorld(localX, localY) {
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        return {
            x: this.x + localX * cos - localY * sin,
            y: this.y + localX * sin + localY * cos
        };
    }

    worldToLocal(worldX, worldY) {
        const cos = Math.cos(-this.angle);
        const sin = Math.sin(-this.angle);
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        return {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos
        };
    }

    // Elmas spawn (lokal koordinatta)
    spawnDiamond(type) {
        const half = this.size / 2 - 100;
        const d = {
            id: Math.random().toString(36).substr(2, 9),
            localX: (Math.random() - 0.5) * 2 * half,
            localY: (Math.random() - 0.5) * 2 * half,
            type: type,
            color: (type === 'super') ? '#ff0000' : '#00ffff',
            size: (type === 'super') ? 25 : 15,
            points: (type === 'super') ? 50 : 10
        };
        this.localDiamonds.push(d);
        return d;
    }

    update() {
        // Yerçekimi
        this.vy += this.gravity;

        // Sürtünme (hava direnci)
        this.vx *= 0.999;
        this.vy *= 0.999;

        // Dead zone
        if (Math.abs(this.vx) < 0.05) this.vx = 0;
        if (Math.abs(this.vy) < 0.05) this.vy = 0;

        // Hard cap
        const CAP = 60;
        this.vx = Math.max(-CAP, Math.min(CAP, this.vx));
        this.vy = Math.max(-CAP, Math.min(CAP, this.vy));

        // Pozisyon
        this.x += this.vx;
        this.y += this.vy;

        // Dönüş: vx'e bağlı yuvarlanma
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.angularVel = this.vx / this.radius; // Sola gidince sola döner
        this.angle += this.angularVel;
    }

    getState() {
        return {
            x: this.x, y: this.y,
            vx: this.vx, vy: this.vy,
            size: this.size, mass: this.mass,
            angle: this.angle, angularVel: this.angularVel,
            tent: this.tent,
            localDiamonds: this.localDiamonds
        };
    }
}

module.exports = Cube;
