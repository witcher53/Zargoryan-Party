class Cube {
    constructor() {
        this.x = 1000;
        this.y = 1000;
        this.vx = 0;
        this.vy = 0;
        this.mass = 50;
        this.size = 3000;    // DEV KÜP: Tüm oyun bu kutunun İÇİNDE
        this.angle = 0;
        this.angularVel = 0;
        this.friction = 0.985;

        // --- LOCAL SPACE CHILD OBJECTS ---
        // Çadır: Küpün merkezine göre sabit lokal koordinat
        this.tent = {
            localX: -400, localY: -400,
            w: 500, h: 500,
            color: '#e67e22', label: 'ZAR ALANI'
        };

        // Elmaslar: Lokal koordinatlarda
        this.localDiamonds = [];
    }

    // --- LOCAL → WORLD DÖNÜŞÜM ---
    // Formül: WorldPos = CubePos + Rotate(LocalPos, CubeAngle)
    // | cos(θ)  -sin(θ) | * | lx |   +  | cx |
    // | sin(θ)   cos(θ) |   | ly |      | cy |
    localToWorld(localX, localY) {
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        return {
            x: this.x + localX * cos - localY * sin,
            y: this.y + localX * sin + localY * cos
        };
    }

    // --- WORLD → LOCAL DÖNÜŞÜM ---
    // Ters rotasyon: angle yerine -angle
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
        const half = this.size / 2 - 100; // Kenardan 100px içeride
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
        // Sürtünme
        this.vx *= this.friction;
        this.vy *= this.friction;

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

        // Dönüş: angularVel = linearSpeed / radius
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const radius = this.size / 2;
        this.angularVel = speed / radius;
        if (this.vx < 0) this.angularVel *= -1;
        this.angle += this.angularVel;
    }

    applySlope(force) {
        this.vx += force.x / this.mass;
        this.vy += force.y / this.mass;
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
