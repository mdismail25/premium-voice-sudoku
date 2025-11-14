(() => {
  const canvas = document.createElement("canvas");
  canvas.id = "ULTIMATE_BG";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  let W, H, DPR;
  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = canvas.width = window.innerWidth * DPR;
    H = canvas.height = window.innerHeight * DPR;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // -----------------------------
  // GLOBAL SYSTEMS & UTILITIES
  // -----------------------------

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  const mouse = { x: -9999, y: -9999 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // Click explosions
  const explosions = [];
  window.addEventListener("click", (e) => {
    for (let i = 0; i < 40; i++) {
      explosions.push({
        x: e.clientX,
        y: e.clientY,
        vx: rand(-3, 3),
        vy: rand(-3, 3),
        life: rand(30, 60),
        color: `hsl(${rand(0,360)},100%,60%)`
      });
    }
  });

  // -----------------------------
  // LAYER 1 — NEBULA FOG
  // -----------------------------
  const fog = [];
  for (let i = 0; i < 5; i++) {
    fog.push({
      x: rand(0, window.innerWidth),
      y: rand(0, window.innerHeight),
      r: rand(400, 700),
      s: rand(0.1, 0.25),
      color: `hsla(${rand(180, 300)},60%,55%,0.12)`
    });
  }

  // -----------------------------
  // LAYER 2 — AURORA WAVES
  // -----------------------------
  let auroraTime = 0;

  function drawAurora() {
    auroraTime += 0.01;

    const grad = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
    grad.addColorStop(0, "rgba(0,255,255,0.18)");
    grad.addColorStop(0.5, "rgba(255,0,255,0.12)");
    grad.addColorStop(1, "rgba(0,200,255,0.18)");

    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();

    ctx.moveTo(0, window.innerHeight * 0.3);

    for (let x = 0; x < window.innerWidth; x += 20) {
      ctx.lineTo(
        x,
        window.innerHeight * 0.3 +
          Math.sin(x * 0.01 + auroraTime) * 35 +
          Math.sin(x * 0.02 + auroraTime * 0.5) * 25
      );
    }

    ctx.lineTo(window.innerWidth, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  // -----------------------------
  // LAYER 3 — FIREFLIES
  // -----------------------------
  const fireflies = [];
  for (let i = 0; i < 40; i++) {
    fireflies.push({
      x: rand(0, window.innerWidth),
      y: rand(0, window.innerHeight),
      r: rand(2, 4),
      pulse: rand(0, Math.PI * 2),
      speed: rand(0.3, 1),
      color: `hsla(${rand(40,90)},100%,70%,1)`
    });
  }

  // -----------------------------
  // LAYER 4 — BUTTERFLIES
  // -----------------------------
  const butterflies = [];
  const colors = [
    ["#ff00ff", "#00ffff"],
    ["#ff8800", "#ffe200"],
    ["#00ff99", "#00d4ff"],
    ["#ff33aa", "#6633ff"],
  ];

  for (let i = 0; i < 20; i++) {
    const c = colors[Math.floor(Math.random() * colors.length)];
    butterflies.push({
      x: rand(0, window.innerWidth),
      y: rand(0, window.innerHeight),
      vx: rand(-1, 1),
      vy: rand(-1, 1),
      size: rand(18, 28),
      flap: rand(0, Math.PI * 2),
      flapSpeed: rand(0.15, 0.22),
      c1: c[0],
      c2: c[1]
    });
  }

  function drawButterfly(b) {
    const flap = Math.sin(b.flap) * 10;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);

    // Glow
    ctx.fillStyle = b.c1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, b.size * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Wings
    ctx.fillStyle = b.c1;
    ctx.beginPath();
    ctx.ellipse(12, -5, b.size, b.size * 0.5 + flap, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.c2;
    ctx.beginPath();
    ctx.ellipse(-12, -5, b.size, b.size * 0.5 - flap, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = "#111";
    ctx.fillRect(-3, -b.size / 2, 6, b.size);

    ctx.restore();
  }

  // -----------------------------
  // RENDER LOOP
  // -----------------------------
  function loop() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Fog
    fog.forEach((f) => {
      ctx.beginPath();
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      grad.addColorStop(0, f.color);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    });

    // Aurora
    drawAurora();

    // Fireflies
    fireflies.forEach((fl) => {
      fl.pulse += 0.05;
      ctx.globalAlpha = (Math.sin(fl.pulse) + 1) * 0.4;

      ctx.fillStyle = fl.color;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
      ctx.fill();

      fl.x += (Math.random() - 0.5) * fl.speed;
      fl.y += (Math.random() - 0.5) * fl.speed;
    });

    ctx.globalAlpha = 1;

    // Butterflies
    butterflies.forEach((b) => {
      b.flap += b.flapSpeed;

      // Mouse gravity attraction
      const dx = mouse.x - b.x;
      const dy = mouse.y - b.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 260) {
        b.vx += dx / dist * 0.05;
        b.vy += dy / dist * 0.05;
      }

      b.vx += (Math.random() - 0.5) * 0.02;
      b.vy += (Math.random() - 0.5) * 0.02;

      // Limit speed
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 2.2) {
        b.vx *= 0.96;
        b.vy *= 0.96;
      }

      b.x += b.vx * 2;
      b.y += b.vy * 2;

      // Wrap
      if (b.x < -50) b.x = window.innerWidth + 50;
      if (b.x > window.innerWidth + 50) b.x = -50;
      if (b.y < -50) b.y = window.innerHeight + 50;
      if (b.y > window.innerHeight + 50) b.y = -50;

      drawButterfly(b);
    });

    // Explosions
    explosions.forEach((ex, i) => {
      ctx.globalAlpha = ex.life / 60;
      ctx.fillStyle = ex.color;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ex.x += ex.vx;
      ex.y += ex.vy;
      ex.life--;

      if (ex.life <= 0) explosions.splice(i, 1);
    });

    ctx.globalAlpha = 1;

    requestAnimationFrame(loop);
  }

  loop();
})();
