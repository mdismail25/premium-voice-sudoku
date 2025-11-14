// animated-bg/ULTIMATE-GOD-BG.js
// ULTIMATE GOD-MODE BACKGROUND - Part 1/3 (UPDATED for manual mic toggle)
// Combines Nebula fog, aurora, ocean rays, fireflies, butterflies, sparks, comets,
// click explosions, vortex events, wind gusts, parallax depth, voice-reactivity,
// butterflies landing on sudoku cells, fireflies orbit selected cell.
// Designed to run without changing your UI.

(() => {
  // Defensive guard so script only injects once
  if (window.__ULTIMATE_GOD_BG_LOADED) return;
  window.__ULTIMATE_GOD_BG_LOADED = true;

  // Create canvas (single canvas that renders layered system)
  const canvas = document.createElement('canvas');
  canvas.id = 'ULTIMATE_GOD_BG';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.mixBlendMode = 'screen';
  canvas.style.zIndex = '-1';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });

  // RESIZE / DPR
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let W = window.innerWidth;
  let H = window.innerHeight;
  function resize() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Utility helpers
  const rand = (a=0,b=1) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const TAU = Math.PI*2;

  // CONFIG - tune these counts to scale performance
  const CONFIG = {
    fireflyCount: Math.round(clamp((W*H)/(1400*800)*48, 18, 120)),
    butterflyCount: Math.round(clamp((W*H)/(1280*720)*20, 8, 32)),
    cometFrequencyMs: 3000,
    sparkChance: 0.02,
    gustIntervalMin: 10000,
    gustIntervalMax: 22000,
    vortexChancePerCycle: 0.003,
    voiceSensitivity: 0.08, // higher => stronger reaction
    parallaxStrength: 8, // px
    nebulaLayers: 4
  };

  // Input state
  const input = {
    mouseX: -9999, mouseY: -9999, mouseDown: false,
    pointerVX: 0, pointerVY: 0,
    lastMouseTime: performance.now(),
  };

  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    const dt = Math.max(1, now - input.lastMouseTime);
    input.pointerVX = (e.clientX - (input.mouseX === -9999 ? e.clientX : input.mouseX)) / dt * 1000;
    input.pointerVY = (e.clientY - (input.mouseY === -9999 ? e.clientY : input.mouseY)) / dt * 1000;
    input.mouseX = e.clientX; input.mouseY = e.clientY; input.lastMouseTime = now;
  }, { passive: true });
  window.addEventListener('mousedown', () => input.mouseDown = true, { passive: true });
  window.addEventListener('mouseup', () => input.mouseDown = false, { passive: true });
  window.addEventListener('mouseleave', () => { input.mouseX = -9999; input.mouseY = -9999; });

  // VOICE input via WebAudio (manual mode)
  let micStreamNode = null;      // AudioNode (MediaStreamAudioSourceNode)
  let micMediaStream = null;     // MediaStream from getUserMedia
  let audioCtx = null;           // AudioContext
  let analyser = null;           // AnalyserNode
  let audioLevel = 0;            // 0..1
  let micEnabled = false;        // manual toggle state

  async function initMicMeter() {
    // call only when user clicks Voice button
    if (audioCtx && analyser && micStreamNode && micMediaStream) return; // already initialized
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micMediaStream = s;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      micStreamNode = audioCtx.createMediaStreamSource(s);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      micStreamNode.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function analyze() {
        if (!analyser) { audioLevel = 0; return; }
        try {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i=0;i<data.length;i++){ sum += data[i]; }
          audioLevel = (sum / data.length) / 255; // 0..1 normalized
        } catch(e) {
          audioLevel = 0;
        }
        if (micEnabled) requestAnimationFrame(analyze);
      }
      analyze();
    } catch (err) {
      // permission denied or unavailable; keep audioLevel 0 and clean references
      audioLevel = 0;
      micMediaStream = null;
      micStreamNode = null;
      analyser = null;
      audioCtx = null;
      throw err;
    }
  }

  // Manual mic toggle exposed globally. Call this when Voice button is clicked.
  window.__ULTIMATE_BG_TOGGLE_MIC = async function () {
    if (!micEnabled) {
      // turn ON
      try {
        micEnabled = true;
        await initMicMeter();
        console.info('ULTIMATE_BG: mic enabled');
      } catch (e) {
        micEnabled = false;
        console.warn('ULTIMATE_BG: mic failed to enable', e);
      }
    } else {
      // turn OFF
      micEnabled = false;
      audioLevel = 0;
      try {
        // stop MediaStream tracks
        if (micMediaStream && micMediaStream.getTracks) {
          micMediaStream.getTracks().forEach(t => {
            try { t.stop(); } catch(e){}
          });
        }
      } catch (e) {}
      // disconnect audio nodes
      try {
        if (micStreamNode && micStreamNode.disconnect) micStreamNode.disconnect();
      } catch(e){}
      try {
        if (analyser && analyser.disconnect) analyser.disconnect();
      } catch(e){}
      try {
        if (audioCtx && audioCtx.close) audioCtx.close();
      } catch(e){}
      micMediaStream = null;
      micStreamNode = null;
      analyser = null;
      audioCtx = null;
      console.info('ULTIMATE_BG: mic disabled');
    }
  };

  // -----------------------
  // Nebula Fog (multi layer)
  // -----------------------
  const nebulaLayers = [];
  for (let i=0;i<CONFIG.nebulaLayers;i++){
    nebulaLayers.push({
      x: rand(-W*0.5, W*1.5),
      y: rand(-H*0.5, H*1.5),
      r: rand(Math.max(W,H)*0.45, Math.max(W,H)*0.95),
      speedX: rand(-0.02, 0.02),
      speedY: rand(-0.007, 0.007),
      hue: rand(180, 320),
      alpha: rand(0.05, 0.18)
    });
  }

  // -----------------------
  // Aurora (sine waves)
  // -----------------------
  let auroraPhase = 0;

  // -----------------------
  // Ocean light rays (vertical beams)
  // -----------------------
  const rays = [];
  for (let i=0;i<20;i++){
    rays.push({
      x: rand(0, W),
      width: rand(180, 420),
      alpha: rand(0.02, 0.09),
      shift: rand(0, TAU)
    });
  }

  // -----------------------
  // Fireflies
  // -----------------------
  const fireflies = [];
  for (let i=0;i<CONFIG.fireflyCount;i++){
    fireflies.push({
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-0.15, 0.15),
      vy: rand(-0.15, 0.15),
      r: rand(0.9, 3.2),
      phase: rand(0, TAU),
      hue: rand(45, 80),
      orbitTarget: null, // used to orbit selected cell
    });
  }

  // Helper to get currently selected sudoku cell center (for firefly orbit)
  function getSelectedCellCenter() {
    const sel = document.querySelector('.cell.selected');
    if (!sel) return null;
    const rect = sel.getBoundingClientRect();
    return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  }

  // -----------------------
  // Butterflies (flocking + landing)
  // -----------------------
  const butterflies = [];
  for (let i=0;i<CONFIG.butterflyCount;i++){
    butterflies.push({
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-0.7, 0.7),
      vy: rand(-0.5, 0.5),
      size: rand(10, 28),
      flap: rand(0, TAU),
      flapSpeed: rand(0.12, 0.36),
      colorA: `hsl(${rand(260,330)}, 90%, ${rand(46,66)}%)`,
      colorB: `hsl(${rand(180,260)}, 90%, ${rand(44,64)}%)`,
      target: null,
      landing: false,
      landTimer: 0,
      id: Math.floor(rand(0,1e9))
    });
  }

  // butterfly landing logic: attempt to land on a random empty (non-prefilled) cell when colliding
  function attemptButterflyLanding(b) {
    try {
      // find the cell element under butterfly position
      const elems = document.elementsFromPoint(b.x, b.y);
      if (!elems) return;
      const cell = elems.find(el => el.classList && el.classList.contains('cell'));
      if (!cell) return;
      // do not land on prefilled
      if (cell.classList.contains('prefilled')) return;
      // land only occasionally
      if (Math.random() < 0.28) {
        b.landing = true;
        b.landTimer = 80 + Math.floor(rand(0, 120)); // frames
        // snap to cell center
        const r = cell.getBoundingClientRect();
        b.target = { x: r.left + r.width/2, y: r.top + r.height/2, cell: cell };
      }
    } catch (e) {
      // ignore cross-origin errors or layout timing issues
    }
  }

  // -----------------------
  // Sparks / Electric arcs
  // -----------------------
  const sparks = []; // small particles with short life

  function spawnSpark(x,y, count=12) {
    for (let i=0;i<count;i++){
      sparks.push({
        x, y,
        vx: rand(-3,3),
        vy: rand(-3,3),
        life: Math.floor(rand(18,42)),
        hue: rand(180,320),
        size: rand(0.6,2.6)
      });
    }
  }

  // -----------------------
  // Comets
  // -----------------------
  const comets = [];
  function spawnComet() {
    const fromLeft = Math.random() < 0.5;
    const y = rand(H*0.05, H*0.6);
    const x = fromLeft ? -80 : W + 80;
    const vx = fromLeft ? rand(2.8, 6.2) : rand(-6.2, -2.8);
    comets.push({
      x, y, vx, vy: rand(-0.3, 0.3),
      length: rand(80, 260),
      hue: rand(180, 320),
      life: 0
    });
  }

  // spawn comet periodically
  setInterval(() => { if (Math.random() < 0.7) spawnComet(); }, CONFIG.cometFrequencyMs);

  // -----------------------
  // Gust events
  // -----------------------
  let nextGustAt = performance.now() + rand(CONFIG.gustIntervalMin, CONFIG.gustIntervalMax);
  let gust = { active: false, dirX: 0, dirY: 0, strength: 0, life: 0 };

  function triggerGust() {
    gust.active = true;
    gust.dirX = rand(-1,1);
    gust.dirY = rand(-0.2, 0.6);
    gust.strength = rand(0.6, 1.8);
    gust.life = Math.floor(rand(220, 520));
    nextGustAt = performance.now() + rand(CONFIG.gustIntervalMin, CONFIG.gustIntervalMax);
  }

  // -----------------------
  // Vortex / Portal Events
  // -----------------------
  const vortexes = [];
  function maybeSpawnVortex() {
    if (Math.random() < 0.0015) {
      const x = rand(W*0.2, W*0.8), y = rand(H*0.2, H*0.7);
      vortexes.push({ x, y, t: 0, life: Math.floor(rand(420, 900)) });
    }
  }

  // -----------------------
  // Mouse magical dust trail (particles)
  // -----------------------
  const trails = [];
  function spawnTrail(x,y, count=3) {
    for (let i=0;i<count;i++){
      trails.push({
        x: x + rand(-6,6),
        y: y + rand(-6,6),
        vx: rand(-0.6,0.6),
        vy: rand(-0.6,0.6),
        life: Math.floor(rand(28,64)),
        hue: rand(200,320),
        size: rand(0.8,2.6)
      });
    }
  }

  // Mouse click explosion integrated (also spawnSpark)
  window.addEventListener('click', (e) => {
    spawnSpark(e.clientX, e.clientY, 28);
    // small comet burst now and then
    if (Math.random() < 0.25) comets.push({ x: e.clientX - 100 + rand(-20,20), y: e.clientY - 120 + rand(-40,40), vx: rand(2.2,5.6), vy: rand(-0.6,0.6), length: rand(60,140), hue: rand(200,320), life: 0 });
  }, { passive: true });

  // trail spawn
  window.addEventListener('mousemove', (e) => {
    if (Math.random() < 0.6) spawnTrail(e.clientX, e.clientY, 1);
  }, { passive: true });

  // -----------------------
  // Parallax field (background offset)
  // -----------------------
  let parallaxOffsetX = 0, parallaxOffsetY = 0, parallaxSmoothX = 0, parallaxSmoothY = 0;

  // -----------------------
  // Timing for animation
  // -----------------------
  let last = performance.now();

  // We'll split the drawing into logical steps in Part 2 and Part 3 so continuation is seamless.
// animated-bg/ULTIMATE-GOD-BG.js
// Part 2/3 - animation update & draw functions (continuation)

  // ---------- draw helpers ----------
  function radialGlow(x, y, r, colorStops) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (let i=0;i<colorStops.length;i++){
      const cs = colorStops[i];
      g.addColorStop(cs[0], cs[1]);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // nebula draw
  function drawNebula(dt) {
    for (let i=0;i<nebulaLayers.length;i++){
      const n = nebulaLayers[i];
      n.x += n.speedX * dt * 18;
      n.y += n.speedY * dt * 18;
      // gentle wrap
      if (n.x < -W) n.x = W + rand(20,200);
      if (n.x > W*1.5) n.x = -rand(20,200);
      if (n.y < -H) n.y = H + rand(20,200);
      if (n.y > H*1.5) n.y = -rand(20,200);

      // draw large radial gradient faded
      const r = n.r;
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
      grad.addColorStop(0, `hsla(${n.hue}, 70%, 60%, ${n.alpha})`);
      grad.addColorStop(0.4, `hsla(${n.hue + 12}, 60%, 50%, ${n.alpha*0.55})`);
      grad.addColorStop(1, `hsla(${(n.hue+40)%360}, 50%, 30%, 0)`);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(-W, -H, W*3, H*3);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // aurora draw
  function drawAurora(dt) {
    auroraPhase += dt * 0.0025 * (1 + audioLevel * 3);
    const bandY = H * 0.28;
    const amplitude = 36 + (audioLevel * 140);
    const wavelength = 120;
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.globalAlpha = 0.48;
    for (let layer=0; layer<2; layer++){
      ctx.beginPath();
      ctx.moveTo(0, bandY);
      for (let x=0; x<=W; x+=12){
        const y = bandY + Math.sin((x/wavelength) + auroraPhase*(1+layer*0.6) + layer*1.0) * amplitude * (1 - layer*0.4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, bandY-200, 0, bandY+200);
      g.addColorStop(0, 'rgba(120,0,255,0.06)');
      g.addColorStop(0.4, 'rgba(0,255,240,0.09)');
      g.addColorStop(1, 'rgba(255,80,200,0.05)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ocean rays draw
  function drawRays(dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    for (let i=0;i<rays.length;i++){
      const r = rays[i];
      r.shift += dt*0.0012;
      const x = (r.x + Math.sin(r.shift)*80) % (W+400) - 200;
      ctx.fillStyle = `rgba(0,200,255,${r.alpha})`;
      // soft vertical gradient rectangle
      const wRect = r.width;
      const left = x - wRect/2;
      const g = ctx.createLinearGradient(left, 0, left + wRect, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.2, 'rgba(0,200,255,0.05)');
      g.addColorStop(0.5, 'rgba(0,255,200,0.06)');
      g.addColorStop(0.8, 'rgba(0,200,255,0.03)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(left, 0, wRect, H);
    }
    ctx.restore();
  }

  // firefly update & draw
  function updateFireflies(dt) {
    const selCenter = getSelectedCellCenter();
    for (let i=0;i<fireflies.length;i++){
      const f = fireflies[i];
      // orbit logic if selected cell exists
      if (selCenter) {
        // start orbiting: compute vector from center
        const dx = f.x - selCenter.x, dy = f.y - selCenter.y;
        const dist = Math.hypot(dx,dy) || 1;
        // gently pull toward orbit radius of 40-110
        const desiredRadius = 40 + (i % 5) * 12;
        const pull = clamp((dist - desiredRadius)/120, -0.6, 0.6);
        f.vx += (-dx/dist) * 0.03 * pull;
        f.vy += (-dy/dist) * 0.03 * pull;
      } else {
        // wander
        f.vx += (Math.random()-0.5)*0.04 * f.r;
        f.vy += (Math.random()-0.5)*0.04 * f.r;
      }

      // gust influence
      if (gust.active) {
        f.vx += gust.dirX * gust.strength * 0.12;
        f.vy += gust.dirY * gust.strength * 0.12;
      }

      // move
      f.x += f.vx * (1 + dt*60);
      f.y += f.vy * (1 + dt*60);

      // wrap
      if (f.x < -10) f.x = W + 10;
      if (f.x > W + 10) f.x = -10;
      if (f.y < -10) f.y = H + 10;
      if (f.y > H + 10) f.y = -10;

      f.phase += (0.9 + Math.abs(input.pointerVX)*0.00035) * (dt*60);

      // draw
      const alpha = 0.22 + Math.sin(f.phase)*0.24;
      fCtxCircle(f.x, f.y, f.r*6, `rgba(255,255,200,${clamp(alpha,0.05,0.9)})`, f.r*1.6);
      // core
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,220,${clamp(alpha,0.6,1)})`;
      ctx.arc(f.x, f.y, f.r, 0, TAU);
      ctx.fill();
    }
  }

  // helper draws soft radial on ctx (main ctx)
  function fCtxCircle(x, y, r, color, coreR) {
    // outer glow on main ctx (we use ctx for everything)
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, color);
    gg.addColorStop(0.2, color);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gg;
    ctx.fillRect(x-r, y-r, r*2, r*2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // update butterflies (flocking-ish + landing)
  function updateButterflies(dt) {
    // gentle boids-like cohesion & separation
    for (let i=0;i<butterflies.length;i++){
      const b = butterflies[i];

      // if landing, approach target
      if (b.landing && b.target) {
        const tx = b.target.x - b.x, ty = b.target.y - b.y;
        b.vx = lerp(b.vx, tx*0.06, 0.18);
        b.vy = lerp(b.vy, ty*0.06, 0.18);
        // if close enough stay and flap
        if (Math.hypot(tx,ty) < 6) {
          b.vx *= 0.5; b.vy *= 0.5;
          b.landTimer--;
          if (b.landTimer <= 0) {
            b.landing = false;
            b.target = null;
            // small jump-off impulse
            b.vx += rand(-1.2,1.2); b.vy += rand(-1.2, -0.4);
          }
        }
      } else {
        // choose new target occasionally
        if (!b.target || Math.random() < 0.006) {
          b.target = { x: b.x + rand(-180,180), y: b.y + rand(-120,120) };
        }
        // apply target steering
        const tx = (b.target.x || b.x) - b.x, ty = (b.target.y || b.y) - b.y;
        b.vx += tx * 0.0016 + (Math.random()-0.5)*0.02;
        b.vy += ty * 0.0012 + (Math.random()-0.5)*0.02;
      }

      // boid separation
      let sepX=0, sepY=0, neigh=0;
      for (let j=0;j<butterflies.length;j++){
        if (i===j) continue;
        const o = butterflies[j];
        const dx = o.x - b.x, dy = o.y - b.y;
        const d = Math.hypot(dx,dy) || 1;
        if (d < 36) {
          sepX -= (dx/d);
          sepY -= (dy/d);
          neigh++;
        }
      }
      if (neigh>0) {
        b.vx += sepX*0.12;
        b.vy += sepY*0.12;
      }

      // mouse attraction - butterflies follow mouse gently
      if (input.mouseX > -9000) {
        const dxm = input.mouseX - b.x, dym = input.mouseY - b.y;
        const dm = Math.hypot(dxm,dym);
        if (dm < 320) {
          const pull = (320 - dm)/320;
          b.vx += (dxm/dm) * 0.018 * (1 + pull*2);
          b.vy += (dym/dm) * 0.018 * (1 + pull*2);
          // small chance to land near mouse (if over cell)
          if (Math.random() < 0.003) attemptButterflyLanding(b);
        }
      }

      // gust influence
      if (gust.active) {
        b.vx += gust.dirX * gust.strength * 0.06;
        b.vy += gust.dirY * gust.strength * 0.06;
      }

      // voice-reactive burst: when speaking, butterflies get energetic
      if (audioLevel > CONFIG.voiceSensitivity) {
        b.vx += (Math.random()-0.5) * audioLevel * 2.2;
        b.vy -= Math.abs(audioLevel) * 0.8;
      }

      // enforce max speed per butterfly
      const sp = Math.hypot(b.vx,b.vy);
      const maxSpeed = 2.6 + b.size/16;
      if (sp > maxSpeed) { b.vx = (b.vx/sp)*maxSpeed; b.vy = (b.vy/sp)*maxSpeed; }

      // move
      b.x += b.vx * (1 + dt*60);
      b.y += b.vy * (1 + dt*60);

      // wrap edges
      if (b.x < -60) b.x = W + 60;
      if (b.x > W + 60) b.x = -60;
      if (b.y < -60) b.y = H + 60;
      if (b.y > H + 60) b.y = -60;

      // wing flap update
      b.flap += b.flapSpeed * (1 + audioLevel*2);

      // draw - layers + glow
      const wingOpen = 0.5 + Math.sin(b.flap) * 0.5 * (1 + b.size/50);
      // shadow / glow
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12 + Math.min(0.6, audioLevel*0.8);
      radialGlow(b.x, b.y + b.size*0.1, b.size*2.2, [[0, b.colorB], [0.6, 'rgba(0,0,0,0)']]);
      ctx.globalAlpha = 1;
      // wings
      ctx.save();
      ctx.translate(b.x, b.y);
      const ang = Math.atan2(b.vy, b.vx) + Math.PI/2;
      ctx.rotate(ang);
      ctx.fillStyle = b.colorA;
      ctx.beginPath();
      ctx.ellipse(10, -5, b.size, b.size*0.58*wingOpen, Math.PI/6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = b.colorB;
      ctx.beginPath();
      ctx.ellipse(-10, -5, b.size, b.size*0.58*(1/wingOpen), -Math.PI/6, 0, TAU);
      ctx.fill();
      // body
      ctx.fillStyle = 'rgba(18,18,20,0.98)';
      ctx.fillRect(-2, -b.size*0.45, 4, b.size*0.9);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // update sparks
  function updateSparks(dt) {
    for (let i = sparks.length-1; i>=0; i--) {
      const s = sparks[i];
      s.life--;
      s.x += s.vx * (1 + dt*60) * 1.0;
      s.y += s.vy * (1 + dt*60) * 1.0;
      s.vx *= 0.98; s.vy *= 0.98;
      // draw
      ctx.globalAlpha = clamp(s.life/60, 0, 1);
      ctx.fillStyle = `hsl(${s.hue}, 90%, 60%)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (s.life <= 0) sparks.splice(i,1);
    }
  }

  // update comets
  function updateComets(dt) {
    for (let i=comets.length-1;i>=0;i--) {
      const c = comets[i];
      c.life++;
      c.x += c.vx * (1 + dt*60);
      c.y += c.vy * (1 + dt*60);
      // draw long tail
      ctx.globalCompositeOperation = 'lighter';
      const tailLen = c.length;
      const hx = c.x - c.vx*tailLen*0.4, hy = c.y - c.vy*tailLen*0.4;
      const g = ctx.createLinearGradient(c.x, c.y, hx, hy);
      g.addColorStop(0, `hsla(${c.hue},90%,70%,0.95)`);
      g.addColorStop(0.5, `hsla(${c.hue},90%,60%,0.4)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = clamp(c.length/18, 1, 16);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (c.x < -200 || c.x > W+200 || c.y < -200 || c.y > H+200 || c.life > 600) comets.splice(i,1);
    }
  }

  // update trails (mouse)
  function updateTrails(dt) {
    for (let i=trails.length-1;i>=0;i--) {
      const t = trails[i];
      t.life--;
      t.x += t.vx * (1 + dt*60);
      t.y += t.vy * (1 + dt*60);
      // draw glow
      ctx.globalCompositeOperation = 'lighter';
      radialGlow(t.x, t.y, t.size*8, [[0, `hsla(${t.hue},90%,70%,${clamp(t.life/60,0,0.9)})`],[1,'rgba(0,0,0,0)']]);
      ctx.globalCompositeOperation = 'source-over';
      if (t.life <= 0) trails.splice(i,1);
    }
  }

  // update explosions (spawned via click)
  function updateExplosions(dt) {
    for (let i=explosions.length-1;i>=0;i--) {
      const ex = explosions[i];
      ex.vx *= 0.98; ex.vy *= 0.98;
      ex.x += ex.vx * (1 + dt*60);
      ex.y += ex.vy * (1 + dt*60);
      ex.life--;
      const alpha = clamp(ex.life/80,0,1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = ex.color;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, 2.6 + (1-alpha)*6, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (ex.life <= 0) explosions.splice(i,1);
    }
  }

  // update vortexes
  function updateVortexes(dt) {
    for (let i=vortexes.length-1;i>=0;i--) {
      const v = vortexes[i];
      v.t += dt * 0.6;
      // draw spiral
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.globalCompositeOperation = 'lighter';
      const spirSize = 120 + Math.sin(v.t*0.6)*80;
      const hue = 260 + Math.sin(v.t*0.12)*40;
      for (let s=0;s<5;s++){
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${hue + s*8}, 90%, 60%, ${clamp(1 - v.t/6,0,1) * 0.18})`;
        ctx.lineWidth = 2 + s*1.2;
        const rot = v.t* (1 + s*0.08) + s;
        for (let a=0;a<TAU;a+=0.4) {
          const r = spirSize * (a/(TAU*1.2));
          const px = Math.cos(a + rot)*r;
          const py = Math.sin(a + rot)*r;
          if (a===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      v.life--;
      if (v.life <= 0) vortexes.splice(i,1);
    }
  }

  // spark occasional electric arcs
  function maybeSpawnSparks() {
    if (Math.random() < CONFIG.sparkChance) {
      // random location
      const x = rand(40, W-40), y = rand(60, H*0.6);
      spawnSpark(x,y, 6 + Math.floor(rand(0,10)));
    }
  }

  // update gust state
  function updateGust(dt) {
    if (!gust.active && performance.now() > nextGustAt) triggerGust();
    if (gust.active) {
      gust.life -= dt * 60;
      if (gust.life <= 0) gust.active = false;
    }
  }

  // parallax update from mouse
  function updateParallax(dt) {
    const targetX = (input.mouseX === -9999 ? 0 : (input.mouseX - W/2)/W) * CONFIG.parallaxStrength;
    const targetY = (input.mouseY === -9999 ? 0 : (input.mouseY - H/2)/H) * CONFIG.parallaxStrength;
    parallaxSmoothX = lerp(parallaxSmoothX, targetX, 0.08);
    parallaxSmoothY = lerp(parallaxSmoothY, targetY, 0.08);
  }

  // heartbeat: maybe spawn vortexes/comets/sparks
  function backgroundEvents(dt) {
    maybeSpawnSparks();
    if (Math.random() < 0.002 && Math.random() < 0.6) spawnComet();
    // random vortex chance
    if (Math.random() < CONFIG.vortexChancePerCycle) {
      vortexes.push({ x: rand(W*0.2, W*0.8), y: rand(H*0.2, H*0.7), t: 0, life: Math.floor(rand(420, 900)) });
    }
  }

// End of Part 2/3 (continuation in Part 3/3)
// animated-bg/ULTIMATE-GOD-BG.js
// Part 3/3 - main loop and initialization (final)

  // main animation loop
  function frame(now) {
    const dt = Math.min(40, now - last) / 1000;
    last = now;

    // update audio level already captured asynchronously (audioLevel is global var from Part 1)
    // update gust/parallax/events
    updateGust(dt);
    updateParallax(dt);
    backgroundEvents(dt);

    // clear with subtle alpha to keep trails
    ctx.clearRect(0, 0, W, H);

    // apply parallax translate (we simulate depth by translating background layers)
    ctx.save();
    ctx.translate(-parallaxSmoothX*1.5, -parallaxSmoothY*1.5);

    // Nebula fog (slowest)
    drawNebula(dt);

    // Aurora & ocean rays (slightly faster)
    drawAurora(dt);
    drawRays(dt);

    // Vortexes (over fog)
    updateVortexes(dt);

    // Parallax mid layers offset
    ctx.translate(parallaxSmoothX*0.6, parallaxSmoothY*0.6);

    // Fireflies & trails
    updateFireflies(dt);
    updateTrails(dt);

    // Butterflies above fireflies
    updateButterflies(dt);

    // Sparks, Comets, Explosions
    updateSparks(dt);
    updateComets(dt);
    updateExplosions(dt);

    ctx.restore(); // reset transform

    // Mouse reactive dust spawn small trail more when moving
    if (input.mouseX > -9000 && Math.hypot(input.pointerVX, input.pointerVY) > 20) {
      spawnTrail(input.mouseX, input.mouseY, Math.max(1, Math.round(Math.min(4, Math.hypot(input.pointerVX, input.pointerVY)/60))));
    }

    // occasional events
    if (Math.random() < 0.004) maybeSpawnVortex();
    // next gust chance handled inside updateGust

    requestAnimationFrame(frame);
  }

  // start anim
  requestAnimationFrame((t)=>{ last = t; frame(t); });

  // Expose API for debugging and tuning at runtime
  window.__ULTIMATE_GOD_BG = {
    spawnComet: spawnComet,
    spawnSpark: spawnSpark,
    spawnButterflyBurst: (x,y,n=6) => { for (let i=0;i<n;i++){ butterflies.push({ x: x+rand(-20,20), y: y+rand(-20,20), vx: rand(-1.8,1.8), vy: rand(-1.2,1.2), size: rand(10,28), flap: rand(0,TAU), flapSpeed: rand(0.12,0.36), colorA:`hsl(${rand(260,330)},90%,${rand(46,66)}%)`, colorB:`hsl(${rand(180,260)},90%,${rand(44,64)}%)`, target: null, landing:false, landTimer:0, id:Math.floor(rand(0,1e9)) }); } },
    setCounts: (fCount, bCount) => {
      // adjust fireflies
      while (fireflies.length < fCount) fireflies.push({ x: rand(0,W), y: rand(0,H), vx: rand(-0.15,0.15), vy: rand(-0.15,0.15), r: rand(0.9,3.2), phase: rand(0,TAU), hue: rand(45,80) });
      while (fireflies.length > fCount) fireflies.pop();
      // adjust butterflies
      while (butterflies.length < bCount) butterflies.push({ x: rand(0,W), y: rand(0,H), vx: rand(-0.7,0.7), vy: rand(-0.5,0.5), size: rand(10,28), flap: rand(0,TAU), flapSpeed: rand(0.12,0.36), colorA:`hsl(${rand(260,330)},90%,${rand(46,66)}%)`, colorB:`hsl(${rand(180,260)},90%,${rand(44,64)}%)`, target:null, landing:false, landTimer:0, id:Math.floor(rand(0,1e9)) });
      while (butterflies.length > bCount) butterflies.pop();
    },
    setVoiceSensitivity: (v) => { CONFIG.voiceSensitivity = v; },
    remove: () => {
      // stop animation by removing canvas and clearing references
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      // attempt simple cleanup
      window.__ULTIMATE_GOD_BG_LOADED = false;
    }
  };

  // Startup flourish - small comet + spark shower
  (function startupFlourish(){
    for (let i=0;i<3;i++){ setTimeout(spawnComet, i*350); }
    setTimeout(()=> { spawnSpark(W*0.2,H*0.4, 36); spawnSpark(W*0.8, H*0.35, 36); }, 600);
  })();

  // periodically trigger gust events
  setInterval(()=> {
    if (!gust.active && Math.random() < 0.5) triggerGust();
  }, 6000);

  // friendly console message
  console.info('ULTIMATE-GOD-BG loaded — wow mode active 🌌');

})(); // end IIFE
