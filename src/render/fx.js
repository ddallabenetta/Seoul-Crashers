// Effetti: tracce di gomma e macchie a terra (decals) + particelle sopra il mondo.
const MAX_DECALS = 700;
const MAX_PARTICLES = 420;

export class Fx {
  constructor() {
    this.decals = [];
    this.particles = [];
  }

  clear() {
    this.decals.length = 0;
    this.particles.length = 0;
  }

  addSkid(x, y, angle, strength) {
    if (this.decals.length > MAX_DECALS) this.decals.splice(0, 40);
    this.decals.push({
      type: 'skid', x, y, angle,
      w: 9, h: 3.4,
      alpha: Math.min(0.5, 0.16 + strength * 0.3),
      life: 26, maxLife: 26,
    });
  }

  addBlood(x, y, amount = 1) {
    if (this.decals.length > MAX_DECALS) this.decals.splice(0, 40);
    const n = 2 + Math.floor(amount * 3);
    for (let i = 0; i < n; i++) {
      this.decals.push({
        type: 'blood',
        x: x + (Math.random() - 0.5) * 26 * amount,
        y: y + (Math.random() - 0.5) * 26 * amount,
        angle: Math.random() * 6.28,
        w: 4 + Math.random() * 9 * amount,
        h: 3 + Math.random() * 7 * amount,
        alpha: 0.55 + Math.random() * 0.3,
        life: 999, maxLife: 999,
      });
    }
  }

  addScorch(x, y, r) {
    this.decals.push({
      type: 'scorch', x, y, angle: 0, w: r, h: r * 0.8,
      alpha: 0.55, life: 999, maxLife: 999,
    });
  }

  addParticle(p) {
    if (this.particles.length > MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  addDust(x, y, vx, vy, n = 4) {
    for (let i = 0; i < n; i++) {
      this.addParticle({
        type: 'dust', x, y,
        vx: vx * 0.2 + (Math.random() - 0.5) * 40,
        vy: vy * 0.2 + (Math.random() - 0.5) * 40,
        r: 3 + Math.random() * 6,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color: '210,205,195',
      });
    }
  }

  addSparks(x, y, nx, ny, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.9;
      const sp = 90 + Math.random() * 210;
      this.addParticle({
        type: 'spark', x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 1.2 + Math.random() * 1.6,
        life: 0.22 + Math.random() * 0.3,
        maxLife: 0.5,
        color: '255,210,120',
      });
    }
  }

  addSmoke(x, y, n = 3, big = 1) {
    for (let i = 0; i < n; i++) {
      this.addParticle({
        type: 'smoke', x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 26,
        vy: (Math.random() - 0.5) * 26,
        r: (6 + Math.random() * 10) * big,
        grow: 22 * big,
        life: 0.9 + Math.random() * 1.1,
        maxLife: 2,
        color: '90,90,92',
      });
    }
  }

  /** Tracciante: un segmento che sbiadisce, non un proiettile che vola. */
  addTracer(x1, y1, x2, y2, fromPlayer = false) {
    this.addParticle({
      type: 'tracer', x: x1, y: y1, x2, y2,
      vx: 0, vy: 0, r: 0,
      life: 0.07, maxLife: 0.07,
      color: fromPlayer ? '255,236,180' : '255,190,150',
    });
  }

  addMuzzle(x, y, angle) {
    this.addParticle({
      type: 'flash', x, y, vx: 0, vy: 0,
      r: 13, angle,
      life: 0.06, maxLife: 0.06,
      color: '255,224,150',
    });
    this.addSparks(x, y, Math.cos(angle), Math.sin(angle), 3);
  }

  /** Scia dell'arma bianca: un arco che segue il braccio. */
  addSwing(x, y, angle, range) {
    this.addParticle({
      type: 'swing', x, y, vx: 0, vy: 0,
      r: range, angle,
      life: 0.14, maxLife: 0.14,
      color: '235,240,250',
    });
  }

  /** Schizzo di sangue nella direzione del colpo, oltre alla pozza a terra. */
  addBloodSpray(x, y, dx, dy, amount = 1) {
    const n = 4 + Math.floor(amount * 5);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.3;
      const sp = 60 + Math.random() * 190 * amount;
      this.addParticle({
        type: 'blood', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 1.6 + Math.random() * 2.6,
        life: 0.25 + Math.random() * 0.35, maxLife: 0.6,
        color: '150,20,22',
      });
    }
  }

  addExplosion(x, y) {
    this.addScorch(x, y, 46);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283;
      const sp = 120 + Math.random() * 340;
      this.addParticle({
        type: 'fire', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 5 + Math.random() * 12,
        life: 0.3 + Math.random() * 0.5, maxLife: 0.8,
        color: '255,150,50',
      });
    }
    this.addSmoke(x, y, 14, 2.2);
  }

  update(dt) {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      if (d.maxLife < 900) {
        d.life -= dt;
        if (d.life <= 0) this.decals.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
      if (p.grow) p.r += p.grow * dt;
    }
  }

  drawDecals(ctx) {
    for (const d of this.decals) {
      const fade = d.maxLife < 900 ? Math.min(1, d.life / d.maxLife) : 1;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      if (d.type === 'skid') {
        ctx.fillStyle = `rgba(16,16,18,${d.alpha * fade})`;
        ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      } else if (d.type === 'blood') {
        ctx.fillStyle = `rgba(120,14,16,${d.alpha * fade})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.w, d.h, 0, 0, 6.2832);
        ctx.fill();
      } else if (d.type === 'scorch') {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, d.w);
        g.addColorStop(0, `rgba(12,10,10,${0.7 * fade})`);
        g.addColorStop(1, 'rgba(12,10,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.w, d.h, 0, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  draw(ctx, cam, time) {
    ctx.save();
    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      if (p.type === 'tracer') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${p.color},${t * 0.9})`;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        continue;
      }
      if (p.type === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${p.color},${t})`;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.ellipse(p.r * 0.5, 0, p.r, p.r * 0.42, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (p.type === 'swing') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(${p.color},${t * 0.4})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.85, p.angle - 0.7, p.angle + 0.7);
        ctx.stroke();
        continue;
      }
      if (p.type === 'spark' || p.type === 'fire') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${p.color},${t})`;
      } else if (p.type === 'blood') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(${p.color},${Math.min(1, t * 1.6)})`;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(${p.color},${t * 0.42})`;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (p.type === 'smoke' ? 1 : t + 0.3), 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }
}
