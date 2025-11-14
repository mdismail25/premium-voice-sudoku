
/* animated-bg/upgraded-neon.js
   Canvas-driven neon butterflies with smooth flocking-like motion and glow effect.
   Auto-initializes; low-impact fallback if canvas isn't supported.
*/
(function(){
  if(window.__ANIMATED_BG_UPGRADED) return; // avoid double init
  window.__ANIMATED_BG_UPGRADED = true;

  function createContainer(){
    if(document.getElementById("animated-bg-container")) {
      // keep existing container but clear children
      var existing = document.getElementById("animated-bg-container");
      existing.innerHTML = '';
      return existing;
    }
    var c = document.createElement("div");
    c.id = "animated-bg-container";
    document.body.insertBefore(c, document.body.firstChild);
    return c;
  }

  function buildStructure(container){
    container.innerHTML = `
      <canvas id="animated-bg-canvas"></canvas>
      <div class="animated-bg-bokeh" aria-hidden="true"></div>
      <div class="animated-bg-layer layer-far" aria-hidden="true"></div>
      <div class="animated-bg-layer layer-mid" aria-hidden="true"></div>
      <div class="animated-bg-layer layer-near" aria-hidden="true"></div>
      <div class="animated-bg-vignette" aria-hidden="true"></div>
    `;
  }

  function setupCanvas(canvas){
    var ctx = canvas.getContext && canvas.getContext('2d');
    if(!ctx) return null;
    function fit(){
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0) * dpr;
      canvas.height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) * dpr;
      canvas.style.width = (canvas.width / dpr) + "px";
      canvas.style.height = (canvas.height / dpr) + "px";
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    fit();
    window.addEventListener("resize", function(){ ctx.setTransform(1,0,0,1,0,0); fit(); });
    return ctx;
  }

  function rand(a,b){ return Math.random()*(b-a)+a; }
  function lerp(a,b,t){ return a + (b-a)*t; }

  function Butterfly(x,y,opts){
    this.x = x; this.y = y;
    this.vx = rand(-0.6,0.9); this.vy = rand(-0.3,0.3);
    this.scale = opts.scale || rand(0.6,1.2);
    var hue = opts.hue || rand(260,340);
    this.color1 = opts.color1 || `hsl(${hue}deg 90% 65%)`;
    this.color2 = opts.color2 || `hsl(${hue-40}deg 85% 60%)`;
    this.wing = rand(0.6,1.2);
    this.phase = rand(0,Math.PI*2);
    this.size = rand(10,26) * this.scale;
    this.age = 0;
    this.turn = rand(-0.02,0.02);
  }
  Butterfly.prototype.update = function(w,h,mouse){
    this.age += 0.016;
    // simple flocking-like attraction to gentle paths + mouse repulsion
    var targetY = h*0.25 + Math.sin(this.age + this.phase) * (h*0.12);
    var targetX = (w*0.2) + Math.cos(this.age*0.4 + this.phase) * (w*0.25);
    // bias movement with per-butterfly variation
    this.vx += ( (targetX - this.x) * 0.0006 ) + this.turn;
    this.vy += ( (targetY - this.y) * 0.0009 ) * (0.6 + this.scale*0.4);
    // mouse influence (repel)
    if(mouse && mouse.x !== null){
      var dx = this.x - mouse.x;
      var dy = this.y - mouse.y;
      var d2 = dx*dx + dy*dy;
      if(d2 < 90000){
        var f = Math.max(0, 1 - d2/90000);
        this.vx += (dx / (Math.sqrt(d2)+20)) * 0.6 * f;
        this.vy += (dy / (Math.sqrt(d2)+20)) * 0.6 * f;
      }
    }
    // cap speeds
    this.vx = Math.max(-2.0, Math.min(2.0, this.vx));
    this.vy = Math.max(-1.2, Math.min(1.2, this.vy));
    this.x += this.vx * (0.9 + this.scale*0.7);
    this.y += this.vy * (0.9 + this.scale*0.7);
    // wrap horizontally softly
    if(this.x > w + 80) this.x = -80;
    if(this.x < -80) this.x = w + 80;
    if(this.y < 20) this.y = 20;
    if(this.y > h - 30) this.y = h - 30;
  };

  Butterfly.prototype.draw = function(ctx){
    ctx.save();
    ctx.translate(this.x, this.y);
    var angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle);
    var s = this.size;
    // glow: draw outer blurred ellipse
    ctx.beginPath();
    ctx.ellipse(0, 0, s*1.6, s*0.9, 0, 0, Math.PI*2);
    ctx.fillStyle = this.color1;
    ctx.globalAlpha = 0.12;
    ctx.filter = 'blur(10px)';
    ctx.fill();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    // wings - two-sided with gradient fill imitation
    var flap = Math.sin((Date.now()/140) + this.phase) * this.wing;
    // left wing
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(-s*0.2, -s*0.6*flap, -s*1.4, -s*0.9, -s*1.8, -s*0.4);
    ctx.bezierCurveTo(-s*1.5, -s*0.1, -s*0.6, -s*0.2, 0,0);
    ctx.closePath();
    // right wing (mirror)
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(-s*0.2, s*0.6*flap, -s*1.4, s*0.9, -s*1.8, s*0.4);
    ctx.bezierCurveTo(-s*1.5, s*0.1, -s*0.6, s*0.2, 0,0);
    ctx.closePath();
    // wing fill using radial gradient
    var g = ctx.createRadialGradient(-s*0.8, 0, s*0.3, -s*1.2, 0, s*1.8);
    g.addColorStop(0, this.color2);
    g.addColorStop(0.6, this.color1);
    g.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, s*0.18, s*0.6, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(20,20,20,0.95)";
    ctx.globalCompositeOperation = 'source-over';
    ctx.fill();

    // small neon edge
    ctx.beginPath();
    ctx.ellipse(0, 0, s*0.9, s*0.45, 0, 0, Math.PI*2);
    ctx.strokeStyle = this.color1;
    ctx.lineWidth = Math.max(1, s*0.06);
    ctx.globalAlpha = 0.25;
    ctx.stroke();

    ctx.restore();
  };

  function start(){
    var container = createContainer();
    buildStructure(container);
    var canvas = document.getElementById("animated-bg-canvas");
    var ctx = setupCanvas(canvas);
    if(!ctx) return;
    var w = document.documentElement.clientWidth;
    var h = document.documentElement.clientHeight;
    var butterflies = [];
    var target = Math.max(8, Math.floor(w/160));
    for(var i=0;i<target;i++){
      butterflies.push(new Butterfly(rand(0,w), rand(h*0.15, h*0.7), { scale: rand(0.7,1.3), hue: rand(260,340) }));
    }

    var mouse = { x:null, y:null };
    window.addEventListener('mousemove', function(e){
      mouse.x = e.clientX; mouse.y = e.clientY;
    });
    window.addEventListener('touchmove', function(e){
      if(e.touches && e.touches[0]){ mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
    });
    window.addEventListener('touchend', function(){ mouse.x = null; mouse.y = null; });
    window.addEventListener('mouseout', function(){ mouse.x = null; mouse.y = null; });

    function frame(){
      var vw = document.documentElement.clientWidth;
      var vh = document.documentElement.clientHeight;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,vw,vh);

      // faint ambient glow gradient to add depth
      var g = ctx.createLinearGradient(0,0,0,vh);
      g.addColorStop(0, 'rgba(8,12,20,0.0)');
      g.addColorStop(1, 'rgba(8,12,20,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,vw,vh);

      // draw butterflies
      for(var i=0;i<butterflies.length;i++){
        butterflies[i].update(vw,vh,mouse);
        butterflies[i].draw(ctx);
      }

      // maintain count adaptively
      if(butterflies.length < target && Math.random() < 0.02){
        butterflies.push(new Butterfly(-40, rand(vh*0.15,vh*0.6), { scale: rand(0.8,1.2), hue: rand(260,340) }));
      } else if(butterflies.length > target + 6 && Math.random() < 0.005){
        butterflies.pop();
      }

      requestAnimationFrame(frame);
    }
    frame();

    // performance: pause drawing when tab hidden
    var running = true;
    document.addEventListener("visibilitychange", function(){
      running = !document.hidden;
      if(!running) ctx.clearRect(0,0,canvas.width,canvas.height);
    });
  }

  // run on DOM ready
  if(document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(start, 60);
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }

})();
