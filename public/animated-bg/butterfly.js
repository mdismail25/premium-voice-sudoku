// animated-bg/butterfly-wow.js
// "Butterfly WOW" — realistic, creative animated butterflies
// Drop into animated-bg/ and include in index.html with: <script src="animated-bg/butterfly-wow.js" defer></script>
(() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'butterflyWowCanvas';
  document.body.appendChild(canvas);

  // Put it right after neonCanvas if present so stacking is controlled by DOM order.
  const neon = document.getElementById('neonCanvas');
  if (neon && neon.parentNode) neon.parentNode.insertBefore(canvas, neon.nextSibling);

  const ctx = canvas.getContext('2d', { alpha: true });

  // --- CONFIG: tune for 'wow' vs performance ---
  const CONFIG = {
    COUNT_BASE: 14,          // base number of butterflies on small screens
    MAX_COUNT: 42,          // cap for very large screens
    DETAIL: 1.0,            // render scale multiplier (0.6 ~ mobile, 1.0 default, 1.4 high)
    FLOW_SCALE: 0.0025,     // flow-field scale (controls current wavelength)
    FBM_OCTAVES: 4,
    BOID_SEPARATION: 28,    // distance to separate
    COHESION_FACTOR: 0.002,
    ALIGNMENT_FACTOR: 0.05,
    SEPARATION_FACTOR: 0.35,
    ATTRACTION_MOUSE: 0.85, // how strongly butterflies follow mouse
    MAX_SPEED: 120,         // px/sec base
    MIN_SPEED: 45,
    WING_FLAP_SPEED: 6.0,   // global wing flap multiplier
    TRAIL_FADE: 0.16,       // lower = longer trails
    SHADOW_INTENSITY: 0.12, // body shadow
    BLOOM_SOFTEN: 0.22,     // glow intensity
  };

  // Resize & DPR
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  function resize() {
    DPR = Math.max(1, window.devicePixelRatio || 1) * (CONFIG.DETAIL || 1);
    canvas.width = Math.round(window.innerWidth * DPR);
    canvas.height = Math.round(window.innerHeight * DPR);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Mouse & touch
  const MOUSE = { x: -9999, y: -9999, vx: 0, vy: 0, active: false };
  let lastMouseTime = 0;
  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    const dt = Math.max(1, now - lastMouseTime);
    MOUSE.vx = (e.clientX - (MOUSE.x || e.clientX)) / dt * 1000;
    MOUSE.vy = (e.clientY - (MOUSE.y || e.clientY)) / dt * 1000;
    MOUSE.x = e.clientX;
    MOUSE.y = e.clientY;
    MOUSE.active = true;
    lastMouseTime = now;
  }, { passive: true });
  window.addEventListener('mouseleave', () => { MOUSE.x = -9999; MOUSE.y = -9999; MOUSE.active = false; });
  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) { MOUSE.x = e.touches[0].clientX; MOUSE.y = e.touches[0].clientY; MOUSE.active = true; }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) { MOUSE.x = e.touches[0].clientX; MOUSE.y = e.touches[0].clientY; }
  }, { passive: true });
  window.addEventListener('touchend', () => { MOUSE.x = -9999; MOUSE.y = -9999; MOUSE.active = false; });

  // click spawn
  window.addEventListener('click', (e) => {
    spawnBurst(e.clientX, e.clientY, 6);
  }, { passive: true });

  // A compact, fast value noise (grid + bilinear interpolation) + FBM wrapper
  function createNoise(seed = Math.random()) {
    // pseudo-random with seed
    let s = seed * 1e9 % 2147483647;
    function rnd() { s = (s * 48271) % 2147483647; return (s - 1) / 2147483646; }
    // build a small grid cache on demand
    const cache = new Map();
    function gridValue(ix, iy) {
      const key = ix + ',' + iy;
      if (cache.has(key)) return cache.get(key);
      // produce a deterministic pseudo-random value from coords
      const n = Math.abs(Math.sin(ix * 127.1 + iy * 311.7 + seed * 9999) * 43758.5453) % 1;
      cache.set(key, n);
      return n;
    }
    function smoothstep(t) { return t * t * (3 - 2 * t); }
    // bilinear interp
    return function (x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const xf = x - x0, yf = y - y0;
      const v00 = gridValue(x0, y0);
      const v10 = gridValue(x0 + 1, y0);
      const v01 = gridValue(x0, y0 + 1);
      const v11 = gridValue(x0 + 1, y0 + 1);
      const u = smoothstep(xf), v = smoothstep(yf);
      const a = v00 * (1 - u) + v10 * u;
      const b = v01 * (1 - u) + v11 * u;
      return a * (1 - v) + b * v;
    };
  }

  // Create base noise and FBM
  const baseNoise = createNoise(Math.random());
  function fbm(x, y, octaves = CONFIG.FBM_OCTAVES) {
    let value = 0, amplitude = 1, freq = 1, sumAmp = 0;
    for (let o = 0; o < octaves; o++) {
      value += baseNoise(x * freq, y * freq) * amplitude;
      sumAmp += amplitude;
      amplitude *= 0.5;
      freq *= 2;
    }
    return value / sumAmp;
  }

  // Flow field vector from fbm (smooth wind)
  function flowAt(x, y, t) {
    // sample fbm at different offsets to approximate rotational field
    const s = CONFIG.FLOW_SCALE;
    const n1 = fbm(x * s + t * 0.0004, y * s - t * 0.0003);
    const n2 = fbm(x * s - 120.5 + t * 0.0007, y * s + 98.3 - t * 0.0005);
    // angle derived from noise
    const angle = (n1 - n2) * Math.PI * 2;
    return { vx: Math.cos(angle), vy: Math.sin(angle) };
  }

  // Species palettes for variety
  const SPECIES = [
    { name: 'NeonMagenta', a: 'hsl(310, 92%, 60%)', b: 'hsl(265, 95%, 58%)', glow: 'rgba(255,150,240,0.14)' },
    { name: 'CyanGold', a: 'hsl(185, 88%, 55%)', b: 'hsl(45, 92%, 60%)', glow: 'rgba(160,255,220,0.12)' },
    { name: 'RoyalSunset', a: 'hsl(28, 92%, 60%)', b: 'hsl(320, 86%, 54%)', glow: 'rgba(255,200,170,0.10)' },
    { name: 'Iridescent', a: 'hsl(260, 72%, 60%)', b: 'hsl(200, 86%, 52%)', glow: 'rgba(200,180,255,0.12)' },
  ];

  // Butterfly factory
  function makeButterfly(i) {
    const sizeFactor = 0.6 + Math.random() * 1.8; // depth feel
    const base = {
      id: Math.floor(Math.random() * 1e9),
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 6,
      size: 18 * sizeFactor,            // visual size
      speed: lerp(CONFIG.MIN_SPEED, CONFIG.MAX_SPEED, Math.random()) * (0.6 + Math.random() * 0.9),
      wingPhase: Math.random() * Math.PI * 2,
      wingSpeed: (0.9 + Math.random() * 1.8) * CONFIG.WING_FLAP_SPEED * (0.6 + Math.random() * 0.8),
      sway: 0.6 + Math.random() * 1.4,
      species: SPECIES[Math.floor(Math.random() * SPECIES.length)],
      depth: 0.2 + Math.random() * 1.8,  // used for blur & scale depth
      targetTimer: Math.round(100 + Math.random() * 300),
      targetX: null,
      targetY: null,
      dead: false,
    };
    base.size *= CONFIG.DETAIL;
    base.speed *= (0.6 + base.depth * 0.4);
    return base;
  }

  const COUNT = Math.max(CONFIG.COUNT_BASE, Math.min(CONFIG.MAX_COUNT,
    Math.round((window.innerWidth * window.innerHeight) / (1280 * 720) * 18)));
  const butterflies = [];
  for (let i = 0; i < COUNT; i++) butterflies.push(makeButterfly(i));

  // util
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // wing drawing — layered, with small procedural texture
  function drawWings(ctx, b, wingOpen, globalAlpha = 1) {
    const size = b.size;
    // left & right wing control points
    const w = size;
    const h = size * 0.65;
    // base gradient
    const gR = ctx.createLinearGradient(0, -h, w, h);
    gR.addColorStop(0, b.species.a);
    gR.addColorStop(1, b.species.b);
    // wing shading layer
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    ctx.globalAlpha = 0.9 * globalAlpha;
    // right wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(w * 0.1, -h * 0.9 * wingOpen, w * 1.03, -h * 0.44 * wingOpen, w * 0.38, -h * 0.06 * wingOpen);
    ctx.bezierCurveTo(w * 0.7, -h * 0.09 * wingOpen, w * 0.25, h * 0.25 * wingOpen, 0, 0);
    ctx.closePath();
    ctx.fillStyle = gR;
    ctx.fill();

    // left wing mirrored
    const gL = ctx.createLinearGradient(-w, -h, 0, h);
    gL.addColorStop(0, b.species.b);
    gL.addColorStop(1, b.species.a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w * 0.1, -h * 0.9 * wingOpen, -w * 1.03, -h * 0.44 * wingOpen, -w * 0.38, -h * 0.06 * wingOpen);
    ctx.bezierCurveTo(-w * 0.7, -h * 0.09 * wingOpen, -w * 0.25, h * 0.25 * wingOpen, 0, 0);
    ctx.closePath();
    ctx.fillStyle = gL;
    ctx.fill();

    // fine venation effect — procedural stripes
    ctx.globalAlpha = 0.12 * globalAlpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(0.5, b.size * 0.02);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(lerp(0.25 * w, 0.95 * w, t) * (i % 2 ? -1 : 1),
                           lerp(-h * 0.1, h * 0.45, t) * wingOpen,
                           lerp(w * 0.3, w * 0.9, t) * (i % 2 ? -1 : 1),
                           lerp(-h * 0.05, h * 0.35, t) * wingOpen);
    }
    ctx.stroke();

    // edge glow
    ctx.globalAlpha = CONFIG.BLOOM_SOFTEN * 0.9 * globalAlpha;
    ctx.fillStyle = b.species.glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.9, h * 0.6 * wingOpen, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // body drawing
  function drawBody(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const angle = Math.atan2(b.vy, b.vx);
    ctx.rotate(angle + Math.PI / 2);
    const bw = Math.max(1, b.size * 0.12);
    const bh = Math.max(1, b.size * 0.62);
    // shadow under body
    ctx.globalAlpha = CONFIG.SHADOW_INTENSITY * b.depth;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, bh * 0.35, bw * 1.4, bh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // actual body
    ctx.globalAlpha = 1;
    const bodyGrad = ctx.createLinearGradient(0, -bh/2, 0, bh/2);
    bodyGrad.addColorStop(0, 'rgba(20,20,28,0.98)');
    bodyGrad.addColorStop(1, 'rgba(40,40,48,0.98)');
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, -bw/2, -bh/2, bw, bh, bw);
    ctx.fill();

    // antennae
    ctx.strokeStyle = 'rgba(20,20,26,0.95)';
    ctx.lineWidth = Math.max(1, b.size * 0.02);
    ctx.beginPath();
    ctx.moveTo(0, -bh/2 + bw * 0.2);
    ctx.quadraticCurveTo(-bw * 1.6, -bh * 0.9, -bw * 3.2, -bh * 1.2);
    ctx.moveTo(0, -bh/2 + bw * 0.2);
    ctx.quadraticCurveTo(bw * 1.6, -bh * 0.9, bw * 3.2, -bh * 1.2);
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (r == null) r = Math.min(w,h) * 0.15;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Spawn burst of butterflies at location
  function spawnBurst(x, y, amount = 6) {
    for (let i = 0; i < amount; i++) {
      const b = makeButterfly();
      b.x = x + (Math.random() - 0.5) * 40;
      b.y = y + (Math.random() - 0.5) * 40;
      b.vx = (Math.random() - 0.5) * 40;
      b.vy = (Math.random() - 0.5) * 40;
      butterflies.push(b);
    }
    // cap
    while (butterflies.length > CONFIG.MAX_COUNT) butterflies.shift();
  }

  // makeButterfly exported earlier in minimal scope — re-declare for spawnBurst closure
  function makeButterfly() {
    const sizeFactor = 0.6 + Math.random() * 1.8;
    const b = {
      id: Math.floor(Math.random() * 1e9),
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 6,
      size: 18 * sizeFactor * CONFIG.DETAIL,
      speed: lerp(CONFIG.MIN_SPEED, CONFIG.MAX_SPEED, Math.random()) * (0.6 + Math.random() * 0.9),
      wingPhase: Math.random() * Math.PI * 2,
      wingSpeed: (0.9 + Math.random() * 1.8) * CONFIG.WING_FLAP_SPEED * (0.6 + Math.random() * 0.8),
      sway: 0.6 + Math.random() * 1.4,
      species: SPECIES[Math.floor(Math.random() * SPECIES.length)],
      depth: 0.3 + Math.random() * 1.6,
      targetTimer: Math.round(80 + Math.random() * 300),
      targetX: null,
      targetY: null,
      dead: false,
    };
    b.speed *= (0.6 + b.depth * 0.4);
    return b;
  }

  // main animation loop with motion, flocking, draw
  let last = performance.now();
  function animate(now) {
    const dt = Math.min(40, now - last) / 1000;
    last = now;

    // trail fade to create motion blur / trailing glow
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(1,4,8,${CONFIG.TRAIL_FADE})`; // darker = faster fade; tweak for effect
    ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);

    // additive bloom layer drawn on top of butterflies
    ctx.globalCompositeOperation = 'lighter';

    // update & draw each butterfly
    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];

      // life & cleanup
      if (b.dead) continue;
      b.targetTimer--;
      if (b.targetTimer <= 0 || b.targetX === null) {
        b.targetTimer = 120 + Math.floor(Math.random() * 360);
        b.targetX = clamp(b.x + (Math.random() - 0.5) * 240, 20, window.innerWidth - 20);
        b.targetY = clamp(b.y + (Math.random() - 0.5) * 160, 20, window.innerHeight - 20);
      }

      // flow influence
      const f = flowAt(b.x, b.y, now);
      // boid-like behavior: separation, alignment, cohesion
      let sepX = 0, sepY = 0, cohX = 0, cohY = 0, aliX = 0, aliY = 0;
      let neighbors = 0;
      for (let j = 0; j < butterflies.length; j++) {
        if (i === j) continue;
        const o = butterflies[j];
        const dx = o.x - b.x, dy = o.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 120) { // neighbor radius
          neighbors++;
          cohX += o.x; cohY += o.y;
          aliX += o.vx; aliY += o.vy;
          if (dist < CONFIG.BOID_SEPARATION) {
            sepX -= (o.x - b.x) / dist;
            sepY -= (o.y - b.y) / dist;
          }
        }
      }
      if (neighbors > 0) {
        cohX = (cohX / neighbors - b.x) * CONFIG.COHESION_FACTOR;
        cohY = (cohY / neighbors - b.y) * CONFIG.COHESION_FACTOR;
        aliX = (aliX / neighbors - b.vx) * CONFIG.ALIGNMENT_FACTOR;
        aliY = (aliY / neighbors - b.vy) * CONFIG.ALIGNMENT_FACTOR;
      }

      // mouse attraction
      let mouseX = 0, mouseY = 0;
      if (MOUSE.active && MOUSE.x > -9000) {
        const mdx = MOUSE.x - b.x, mdy = MOUSE.y - b.y;
        const md = Math.hypot(mdx, mdy);
        if (md < 360) {
          const attract = (1 - (md / 360)) * CONFIG.ATTRACTION_MOUSE;
          mouseX = mdx / (md || 1) * attract * 120;
          mouseY = mdy / (md || 1) * attract * 120;
        }
      }

      // drive towards target + flow + boid adjustments
      const tx = (b.targetX || b.x) - b.x;
      const ty = (b.targetY || b.y) - b.y;
      const tdist = Math.hypot(tx, ty) || 1;
      const tnx = tx / tdist, tny = ty / tdist;

      // mix movement vectors with tuned weights
      const desiredVx = (tnx * 40 * (0.8 + b.depth)) + f.vx * 60 + sepX * CONFIG.SEPARATION_FACTOR + cohX * 180 + aliX * 1.0 + mouseX * 0.45;
      const desiredVy = (tny * 30 * (0.8 + b.depth)) + f.vy * 60 + sepY * CONFIG.SEPARATION_FACTOR + cohY * 160 + aliY * 1.0 + mouseY * 0.45;

      // smooth velocity and apply speed cap
      b.vx = lerp(b.vx, desiredVx, 0.06);
      b.vy = lerp(b.vy, desiredVy, 0.06);

      const vmag = Math.hypot(b.vx, b.vy);
      if (vmag > b.speed) {
        b.vx = (b.vx / vmag) * b.speed;
        b.vy = (b.vy / vmag) * b.speed;
      }

      // position update scaled by dt
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // screen edge wrap
      if (b.x < -80) b.x = window.innerWidth + 80;
      if (b.x > window.innerWidth + 80) b.x = -80;
      if (b.y < -80) b.y = window.innerHeight + 80;
      if (b.y > window.innerHeight + 80) b.y = -80;

      // wing animation
      b.wingPhase += b.wingSpeed * dt;
      const wingOpen = 0.6 + Math.sin(b.wingPhase) * 0.45 * (1 + 0.3 * b.depth);

      // draw layered wings with subtle trailing 'motion blur' by rendering multiple translucent layers
      const layers = clamp(Math.round(2 + b.depth * 2), 2, 5);
      for (let L = layers; L >= 1; L--) {
        const alpha = 0.18 * (1 - (L / (layers + 1))) * (1 + 0.25 * b.depth);
        drawWings(ctx, b, wingOpen * (1 - (L - 1) * 0.06), alpha);
      }

      // draw body last for depth
      drawBody(ctx, b);
    }

    // occasionally trim if too many
    while (butterflies.length > CONFIG.MAX_COUNT) butterflies.shift();

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

  // initial bloom overlay to blend with neon style — drawn in a separate lighter pass
  (function softBloomLoop() {
    // create a subtle overlay every few frames for glow
    // we rely primarily on 'lighter' composite in main loop, nothing extra needed here.
    setTimeout(softBloomLoop, 4000);
  })();

  // Public API helpers
  window.__butterflyWow = {
    spawnAt(x, y, amount = 6) { spawnBurst(x, y, amount); },
    setCount(n) {
      const target = clamp(n, 4, CONFIG.MAX_COUNT);
      while (butterflies.length < target) butterflies.push(makeButterfly());
      while (butterflies.length > target) butterflies.shift();
    },
    speciesList: SPECIES,
  };

  // Small helper to populate extra butterflies at startup for richness
  (function populateExtra() {
    const extra = Math.max(0, Math.round(COUNT * 0.35));
    for (let i = 0; i < extra; i++) butterflies.push(makeButterfly());
  })();

  // Defensive: handle visibility change to pause if needed
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // optionally reduce updates — current loop will auto-slow when tab inactive, no action required
    }
  });

  // clean removal support (if you later want to remove canvas)
  window.__butterflyWow.remove = function() {
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };

})();
