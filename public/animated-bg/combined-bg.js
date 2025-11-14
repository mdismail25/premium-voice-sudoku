// animated-bg/combined-bg.js
// Combined dynamic butterflies + fireflies background
(() => {
  // ensure DOM ready enough for canvas insertion order if necessary
  // we already have canvases in HTML (#butterflyCanvas, #fireflyCanvas)
  const bCanvas = document.getElementById('butterflyCanvas');
  const fCanvas = document.getElementById('fireflyCanvas');

  // defensive: if not present, create them
  function ensureCanvas(elId) {
    let el = document.getElementById(elId);
    if (!el) {
      el = document.createElement('canvas');
      el.id = elId;
      document.body.appendChild(el);
    }
    return el;
  }
  const butterflyCanvas = bCanvas || ensureCanvas('butterflyCanvas');
  const fireflyCanvas = fCanvas || ensureCanvas('fireflyCanvas');

  const bCtx = butterflyCanvas.getContext('2d', { alpha: true });
  const fCtx = fireflyCanvas.getContext('2d', { alpha: true });

  let W = window.innerWidth, H = window.innerHeight;
  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    butterflyCanvas.width = Math.round(W * dpr);
    butterflyCanvas.height = Math.round(H * dpr);
    butterflyCanvas.style.width = W + 'px';
    butterflyCanvas.style.height = H + 'px';
    bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    fireflyCanvas.width = Math.round(W * dpr);
    fireflyCanvas.height = Math.round(H * dpr);
    fireflyCanvas.style.width = W + 'px';
    fireflyCanvas.style.height = H + 'px';
    fCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { W = window.innerWidth; H = window.innerHeight; resize(); }, { passive:true });
  resize();

  // Mouse interactions
  const mouse = { x: -9999, y: -9999, down: false };
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
  window.addEventListener('mousedown', (e) => { mouse.down = true; spawnButterflyBurst(e.clientX, e.clientY, 6); });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  // ---------------------------
  // Fireflies (small glowing particles)
  // ---------------------------
  const fireflies = [];
  const FI_COUNT = Math.round(Math.min(120, (W * H) / (1400*800) * 80)); // adaptive
  for (let i = 0; i < FI_COUNT; i++) {
    fireflies.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: 1 + Math.random() * 2.6,
      baseAlpha: 0.16 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.8,
      drift: 0.2 + Math.random() * 0.6,
      color: `hsl(${40 + Math.random()*40}, 90%, ${60 + Math.random()*8}%)`
    });
  }

  function updateFireflies(dt) {
    // clear with alpha to create soft trails
    fCtx.clearRect(0, 0, W, H);
    // draw each firefly
    for (let i = 0; i < fireflies.length; i++) {
      const p = fireflies[i];
      // flutter
      p.phase += dt * (0.8 + Math.random() * 0.8);
      const alpha = p.baseAlpha + Math.sin(p.phase) * 0.25;

      // gentle attraction to mouse if close
      if (mouse.x > -9000) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 200) {
          const pull = (200 - d) / 200;
          p.vx += (dx / (d || 1)) * (0.02 * pull);
          p.vy += (dy / (d || 1)) * (0.02 * pull);
        }
      }

      // movement
      p.x += p.vx * (1 + p.speed);
      p.y += p.vy * (1 + p.speed);

      // small drift noise
      p.vx += (Math.random() - 0.5) * p.drift * 0.02;
      p.vy += (Math.random() - 0.5) * p.drift * 0.02;

      // wrap
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      // draw glow
      fCtx.beginPath();
      const g = fCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
      g.addColorStop(0, `rgba(255, 250, 200, ${alpha})`);
      g.addColorStop(0.2, `rgba(255, 240, 160, ${alpha*0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fCtx.fillStyle = g;
      fCtx.fillRect(p.x - p.r * 8, p.y - p.r * 8, p.r * 16, p.r * 16);

      // tiny core
      fCtx.beginPath();
      fCtx.fillStyle = `rgba(255,255,220,${Math.min(1, alpha*1.2)})`;
      fCtx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      fCtx.fill();
    }
  }

  // ---------------------------
  // Butterflies (larger flapping creatures)
  // ---------------------------
  const butterflies = [];
  const B_COUNT = Math.round(Math.min(24, (W * H) / (1280*720) * 16));
  const palettes = [
    ['#ff3ec6', '#21fff6'],
    ['#ffb86b', '#ffd54a'],
    ['#7afcff', '#8b6bff'],
    ['#ffd1f0', '#a8f3ff']
  ];
  function makeButterfly() {
    const s = 0.7 + Math.random() * 1.6;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.6,
      size: 12 + Math.random() * 22,
      flap: Math.random() * Math.PI * 2,
      flapSpeed: 0.12 + Math.random() * 0.28,
      palette: palettes[Math.floor(Math.random() * palettes.length)],
      drift: 0.4 + Math.random() * 1.0,
      targetTimer: 40 + Math.floor(Math.random()*240),
      targetX: null,
      targetY: null
    };
  }
  for (let i = 0; i < B_COUNT; i++) butterflies.push(makeButterfly());

  function setButterflyTarget(b) {
    b.targetTimer = 60 + Math.floor(Math.random() * 240);
    b.targetX = Math.max(20, Math.min(W-20, b.x + (Math.random()-0.5)*300));
    b.targetY = Math.max(20, Math.min(H-20, b.y + (Math.random()-0.5)*200));
  }

  function drawButterfly(b) {
    const wingOpen = 0.6 + Math.sin(b.flap) * 0.45;
    const angle = Math.atan2(b.vy, b.vx);

    bCtx.save();
    bCtx.translate(b.x, b.y);
    bCtx.rotate(angle);

    // soft glow
    bCtx.globalAlpha = 0.18;
    const g = bCtx.createRadialGradient(0, 0, 0, 0, 0, b.size * 1.8);
    g.addColorStop(0, b.palette[1]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    bCtx.fillStyle = g;
    bCtx.beginPath();
    bCtx.arc(0, 0, b.size * 1.8, 0, Math.PI*2);
    bCtx.fill();

    bCtx.globalAlpha = 1;

    // right wing
    bCtx.fillStyle = b.palette[0];
    bCtx.beginPath();
    bCtx.ellipse(b.size*0.8, -b.size*0.18, b.size, b.size*0.6 * wingOpen, Math.PI/6, 0, Math.PI*2);
    bCtx.fill();

    // left wing
    bCtx.fillStyle = b.palette[1];
    bCtx.beginPath();
    bCtx.ellipse(-b.size*0.8, -b.size*0.18, b.size, b.size*0.6 * (1.0/wingOpen), -Math.PI/6, 0, Math.PI*2);
    bCtx.fill();

    // body
    bCtx.fillStyle = 'rgba(20,20,26,0.98)';
    bCtx.fillRect(-2, -b.size*0.5, 4, b.size*0.9);

    bCtx.restore();
  }

  function updateButterflies(dt) {
    bCtx.clearRect(0, 0, W, H);
    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];

      b.flap += b.flapSpeed;
      b.targetTimer--;
      if (b.targetTimer <= 0 || b.targetX === null) setButterflyTarget(b);

      // compute attraction to target
      const tx = (b.targetX || b.x) - b.x;
      const ty = (b.targetY || b.y) - b.y;
      const dist = Math.hypot(tx, ty) || 1;
      const nx = tx / dist, ny = ty / dist;

      // flow-like seed: sample a simple sin/noise pattern for natural curves
      const t = performance.now() * 0.001;
      const flowX = Math.sin((b.x + t*50) * 0.002) * 0.6;
      const flowY = Math.cos((b.y - t*40) * 0.002) * 0.5;

      // mouse attraction (stronger if closer)
      let mx = 0, my = 0;
      if (mouse.x > -9000) {
        const mdx = mouse.x - b.x, mdy = mouse.y - b.y;
        const md = Math.hypot(mdx, mdy);
        if (md < 260) {
          const pull = (260 - md) / 260;
          mx = (mdx / (md || 1)) * (1.6 * pull);
          my = (mdy / (md || 1)) * (1.6 * pull);
        }
      }

      // velocity blending
      b.vx += (nx * 0.35 + flowX * 0.6 + mx * 0.6 + (Math.random()-0.5)*0.1) * (0.8 + b.drift*0.2);
      b.vy += (ny * 0.28 + flowY * 0.5 + my * 0.6 + (Math.random()-0.5)*0.1) * (0.8 + b.drift*0.2);

      // speed limit
      const sp = Math.hypot(b.vx, b.vy);
      const maxSp = 1.4 + (b.size/30);
      if (sp > maxSp) { b.vx = (b.vx/sp)*maxSp; b.vy = (b.vy/sp)*maxSp; }

      // move
      b.x += b.vx * 1.8;
      b.y += b.vy * 1.8;

      // wrap edges
      if (b.x < -80) b.x = W + 80;
      if (b.x > W + 80) b.x = -80;
      if (b.y < -80) b.y = H + 80;
      if (b.y > H + 80) b.y = -80;

      drawButterfly(b);
    }
  }

  // spawn butterflies in a little burst on clicks
  function spawnButterflyBurst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const b = makeBurstButterfly(x + (Math.random()-0.5)*40, y + (Math.random()-0.5)*40);
      butterflies.push(b);
    }
    // trim if too many
    while (butterflies.length > 60) butterflies.shift();
  }
  function makeBurstButterfly(x, y) {
    const s = 0.8 + Math.random()*1.6;
    return {
      x: x, y: y,
      vx: (Math.random()-0.5)*4,
      vy: (Math.random()-0.5)*4,
      size: 12 + Math.random()*22,
      flap: Math.random()*Math.PI*2,
      flapSpeed: 0.12 + Math.random()*0.28,
      palette: palettes[Math.floor(Math.random()*palettes.length)],
      drift: 0.4 + Math.random()*1.0,
      targetTimer: 40 + Math.floor(Math.random()*240),
      targetX: null, targetY: null
    };
  }

  // ---------------------------
  // Main animation loop
  // ---------------------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(40, now - last) / 1000;
    last = now;

    updateFireflies(dt);
    updateButterflies(dt);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // export simple controls
  window.__bgLayer = {
    spawnButterflies: spawnButterflyBurst,
    addFirefly: (x,y) => fireflies.push({ x:x||Math.random()*W, y:y||Math.random()*H, vx:(Math.random()-0.5)*0.6, vy:(Math.random()-0.5)*0.6, r:1+Math.random()*2.6, baseAlpha: 0.2, phase:Math.random()*6.28, speed:0.3, drift:0.3, color:`hsl(${40 + Math.random()*40}, 90%, 65%)` })
  };

})();
