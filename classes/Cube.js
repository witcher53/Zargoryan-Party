class Cube {
    constructor() {
        this.x = 1000;
        this.y = 1000;
        this.vx = 0;
        this.vy = 0;
        this.mass = 50;
        this.size = 300;
        this.angle = 0;
        this.angularVel = 0;
        this.friction = 0.985;
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

    // Eğim kuvveti uygula
    applySlope(force) {
        this.vx += force.x / this.mass;
        this.vy += force.y / this.mass;
    }

    getState() {
        return {
            x: this.x, y: this.y,
            vx: this.vx, vy: this.vy,
            size: this.size, mass: this.mass,
            angle: this.angle, angularVel: this.angularVel
        };
    }
}

module.exports = Cube;
