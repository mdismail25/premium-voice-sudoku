
(function(){
 if(window.__BG_UPGRADED)return; window.__BG_UPGRADED=true;

 // Create container if missing
 var c=document.getElementById("animated-bg-container");
 if(!c){
   c=document.createElement("div");
   c.id="animated-bg-container";
   document.body.prepend(c);
 }

 // Build layers
 c.innerHTML = `
   <canvas id="animated-bg-canvas"></canvas>
   <div class="animated-bg-bokeh"></div>
   <div class="animated-bg-stars"></div>
   <div class="animated-bg-grain"></div>
 `;

 // Auto day/night
 var hour = new Date().getHours();
 if(!(hour>7 && hour<19)){
   c.classList.add("night");
 }

 var canvas=document.getElementById("animated-bg-canvas");
 var ctx=canvas.getContext("2d");

 function fit(){
   var dpr = window.devicePixelRatio || 1;
   canvas.width = innerWidth * dpr;
   canvas.height = innerHeight * dpr;
   canvas.style.width = innerWidth + "px";
   canvas.style.height = innerHeight + "px";
   ctx.setTransform(dpr,0,0,dpr,0,0);
 }
 fit();
 addEventListener("resize", fit);

 function Butterfly(){
   this.x=Math.random()*innerWidth;
   this.y=Math.random()*innerHeight*0.7;
   this.vx=Math.random()*2-1;
   this.vy=Math.random()*1-0.5;
   this.s=12+Math.random()*22;
   this.h=260+Math.random()*80;
   this.p=Math.random()*6.28;
 }
 Butterfly.prototype.update=function(){
   this.p+=0.05;
   this.x+=this.vx;
   this.y+=this.vy + Math.sin(this.p)*0.4;
   if(this.x<-50)this.x=innerWidth+50;
   if(this.x>innerWidth+50)this.x=-50;
   if(this.y<20)this.y=20;
   if(this.y>innerHeight-20)this.y=innerHeight-20;
 };
 Butterfly.prototype.draw=function(){
   ctx.save();
   ctx.translate(this.x,this.y);
   var f=Math.sin(Date.now()/120+this.p)*1.2;
   var s=this.s;
   var g=ctx.createLinearGradient(-s,0,s,0);
   g.addColorStop(0,`hsla(${this.h},90%,65%,0.9)`);
   g.addColorStop(1,`hsla(${this.h-40},80%,60%,0.9)`);
   ctx.fillStyle=g;
   ctx.beginPath();
   ctx.moveTo(0,0);
   ctx.bezierCurveTo(-s, -s*f, -s*1.5, -s*0.5, -s*2, 0);
   ctx.bezierCurveTo(-s*1.5, s*0.5, -s, s*f, 0,0);
   ctx.fill();
   ctx.restore();
 };

 var butterflies=[];
 for(let i=0;i<18;i++) butterflies.push(new Butterfly());

 function frame(){
   ctx.clearRect(0,0,innerWidth,innerHeight);
   for(let b of butterflies){ b.update(); b.draw(); }
   requestAnimationFrame(frame);
 }
 frame();
})();
