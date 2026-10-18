// ==========================================
// CONFETTI ANIMATION (Canvas)
// ==========================================
window.fireConfetti = function() {
  // Buat canvas jika belum ada
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  // Warna tema (Gold, Velvet Red, Light Gold, White)
  const colors = ['#d4af37', '#8a0b15', '#f3e5ab', '#ffffff'];
  let particles = [];
  const particleCount = 120;

  // Class Partikel
  class Particle {
    constructor() {
      this.x = width / 2 + (Math.random() - 0.5) * 200; // Mulai dari tengah
      this.y = height / 2 + (Math.random() - 0.5) * 200;
      this.vx = (Math.random() - 0.5) * 20;
      this.vy = (Math.random() - 0.8) * 20; // Kebanyakan ke atas dulu
      this.size = Math.random() * 8 + 4;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.2;
      this.gravity = 0.5;
      this.opacity = 1;
      this.fade = Math.random() * 0.015 + 0.01;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity; // Efek gravitasi jatuh
      this.vx *= 0.98; // Gesekan udara
      this.rotation += this.rotationSpeed;
      this.opacity -= this.fade;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = Math.max(0, this.opacity);
      ctx.fillStyle = this.color;
      // Bentuk persegi panjang (kertas)
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
      ctx.restore();
    }
  }

  // Buat partikel
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Loop Animasi
  function animate() {
    ctx.clearRect(0, 0, width, height);
    let activeParticles = 0;

    particles.forEach(p => {
      p.update();
      p.draw();
      if (p.opacity > 0 && p.y < height + 50) {
        activeParticles++;
      }
    });

    if (activeParticles > 0) {
      requestAnimationFrame(animate);
    } else {
      // Hapus canvas jika selesai
      canvas.remove();
    }
  }

  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    if (canvas) {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
  });
};