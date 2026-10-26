// SPDX-License-Identifier: Apache-2.0
// Original geometry, rendered as coloured triangles with native WebGL2.
import { clamp, random, visibleGuard } from './simulation.js';

const VERTEX = `#version 300 es
in vec3 a_position;
in vec4 a_color;
uniform vec2 u_resolution;
uniform vec2 u_camera;
uniform float u_zoom;
out vec4 v_color;
void main() {
  vec3 p = a_position;
  vec2 iso = vec2((p.x-p.y)*24.0, (p.x+p.y)*12.0-p.z*24.0);
  vec2 cam = vec2((u_camera.x-u_camera.y)*24.0, (u_camera.x+u_camera.y)*12.0);
  vec2 screen = (iso-cam)*u_zoom + u_resolution*0.5;
  gl_Position = vec4(screen.x/u_resolution.x*2.0-1.0, 1.0-screen.y/u_resolution.y*2.0, -(p.x+p.y+p.z)*0.011, 1.0);
  v_color = a_color;
}`;
const FRAGMENT = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() { outColor = v_color; }`;

function color(hex, light = 1, alpha = 1) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255 * light, ((n >> 8) & 255) / 255 * light, (n & 255) / 255 * light, alpha];
}

class Mesh {
  constructor() { this.data = []; }
  tri(a, b, c, col) { for (const p of [a, b, c]) this.data.push(...p, ...col); }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  floor(x, y, w, d, col, z = .01) { this.quad([x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z], col); }
  box(x, y, w, d, h, col, base = 0) {
    const c = typeof col === 'string' ? color(col) : col;
    const shade = f => [c[0]*f, c[1]*f, c[2]*f, c[3]];
    this.floor(x, y, w, d, shade(1.06), base+h);
    this.quad([x,y+d,base],[x+w,y+d,base],[x+w,y+d,base+h],[x,y+d,base+h], shade(.65));
    this.quad([x+w,y,base],[x+w,y+d,base],[x+w,y+d,base+h],[x+w,y,base+h], shade(.82));
  }
  line(a, b, width, col) {
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy)||1, x=-dy/len*width/2, y=dx/len*width/2;
    this.quad([a[0]+x,a[1]+y,a[2]],[b[0]+x,b[1]+y,b[2]],[b[0]-x,b[1]-y,b[2]],[a[0]-x,a[1]-y,a[2]], col);
  }
  ring(x, y, radius, width, col, z=.04) {
    for(let i=0;i<32;i++) {
      const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
      this.quad([x+Math.cos(a)*radius,y+Math.sin(a)*radius,z],[x+Math.cos(b)*radius,y+Math.sin(b)*radius,z],
        [x+Math.cos(b)*(radius-width),y+Math.sin(b)*(radius-width),z],[x+Math.cos(a)*(radius-width),y+Math.sin(a)*(radius-width),z],col);
    }
  }
}

function shader(gl, type, source) {
  const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) { const msg=gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(msg); }
  return s;
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'low-power'});
    if(!gl) throw new Error('WebGL2 is unavailable. Enable hardware acceleration or use a browser with WebGL2 support.');
    this.gl=gl; this.camera={x:14,y:22}; this.zoom=1; this.cutaway=false; this.width=1; this.height=1;
    this.program=gl.createProgram();
    const vs=shader(gl,gl.VERTEX_SHADER,VERTEX), fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    this.locations={pos:gl.getAttribLocation(this.program,'a_position'),color:gl.getAttribLocation(this.program,'a_color'),
      resolution:gl.getUniformLocation(this.program,'u_resolution'),camera:gl.getUniformLocation(this.program,'u_camera'),zoom:gl.getUniformLocation(this.program,'u_zoom')};
    this.dynamic=gl.createBuffer(); this.ground=gl.createBuffer(); this.buildings=gl.createBuffer();
    this.makeCity(game.world); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  }
  makeCity(world) {
    const ground=new Mesh(),city=new Mesh(),rng=random(world.seed+13),gl=this.gl;
    ground.box(-.2,-.2,world.size+.4,world.size+.4,.35,'#11191b',-.38);
    for(let y=0;y<world.size;y++) for(let x=0;x<world.size;x++) {
      const road=x%9<3||y%9<3, shade=.88+rng()*.18;
      ground.floor(x+.015,y+.015,.97,.97,color(road?'#232d30':'#3a4748',shade));
      if(x%9===1&&y%9>3&&y%2===0) ground.floor(x+.47,y+.15,.06,.55,color('#7b7f67'),.025);
      if(y%9===1&&x%9>3&&x%2===0) ground.floor(x+.15,y+.47,.55,.06,color('#7b7f67'),.025);
      if((x%9===3||x%9===8)&&y%9>=3) ground.floor(x+(x%9===3?0:.91),y,.08,1,color('#64706a'),.035);
      if((y%9===3||y%9===8)&&x%9>=3) ground.floor(x,y+(y%9===3?0:.91),1,.08,color('#64706a'),.035);
      if((x%9===3&&y%9<3)||(y%9===3&&x%9<3)) {
        for(let i=0;i<4;i++) ground.floor(x+.07+i*.23,y+.15,.11,.65,color('#69736a'),.03);
      }
    }
    for(const b of world.buildings) {
      const c=b.tone>.5?'#556264':'#444f55';
      city.box(b.x+.03,b.y+.03,b.w-.06,b.d-.06,b.height,c);
      city.box(b.x-.03,b.y-.03,b.w+.06,b.d+.06,.12,'#6d7770',b.height);
      city.box(b.x+.28,b.y+.25,Math.min(1.2,b.w-.5),Math.min(.8,b.d-.5),.4,'#313d40',b.height+.12);
      if(b.w>2) {
        city.box(b.x+1.9,b.y+.3,.5,.5,.23,'#818875',b.height+.12);
        city.box(b.x+.45,b.y+.45,.055,.055,1,'#8b9484',b.height+.5);
      }
      for(let z=.6;z<b.height-.2;z+=.64) {
        for(let x=b.x+.28;x<b.x+b.w-.3;x+=.52) {
          const lit=rng()>.35;
          city.quad([x,b.y+b.d+.003,z],[x+.28,b.y+b.d+.003,z],[x+.28,b.y+b.d+.003,z+.22],[x,b.y+b.d+.003,z+.22],color(lit?'#b4ae6e':'#243338',lit?.65+rng()*.4:1));
        }
        for(let y=b.y+.25;y<b.y+b.d-.3;y+=.52) {
          city.quad([b.x+b.w+.003,y,z],[b.x+b.w+.003,y+.28,z],[b.x+b.w+.003,y+.28,z+.22],[b.x+b.w+.003,y,z+.22],color(rng()>.5?'#9ca77d':'#293a3e'));
        }
      }
      if(b.w>2) {
        city.box(b.x+.4,b.y+b.d+.04,1.4,.035,.38,'#d1ac51',.9);
        for(let i=0;i<5;i++) city.box(b.x+.51+i*.25,b.y+b.d+.08,.11,.015,.22,'#353d35',.98);
      }
      // Low planters and original geometric trees at block corners.
      const x=b.x+b.w+.35,y=b.y+.4;
      if(x<world.size&&!world.blocked[Math.floor(y)*world.size+Math.floor(x)]) {
        ground.box(x-.18,y-.18,.36,.36,.18,'#525e50');
        city.box(x-.04,y-.04,.08,.08,.65,'#514f40');
        city.box(x-.22,y-.22,.44,.44,.5,'#455c4d',.55);
      }
    }
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) {
      const x=i*9+3.3,y=j*9+3.3;
      city.box(x,y,.05,.05,1.65,'#75837a');city.box(x-.15,y-.05,.35,.15,.08,'#cebd78',1.65);
      ground.floor(x-.3,y-.3,.7,.7,color('#d4bd76',1,.07),.03);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,this.ground);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ground.data),gl.STATIC_DRAW);this.groundCount=ground.data.length/7;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buildings);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(city.data),gl.STATIC_DRAW);this.cityCount=city.data.length/7;
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    this.width=rect.width;this.height=rect.height;
    const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h) {this.canvas.width=w;this.canvas.height=h;}
    this.gl.viewport(0,0,w,h);
  }
  project(x,y,z=0) {return {x:((x-y)-(this.camera.x-this.camera.y))*24*this.zoom+this.width/2,y:((x+y)-(this.camera.x+this.camera.y))*12*this.zoom-z*24*this.zoom+this.height/2};}
  unproject(x,y) {
    const dx=(x-this.width/2)/(24*this.zoom),dy=(y-this.height/2)/(12*this.zoom);
    return {x:this.camera.x+(dx+dy)/2,y:this.camera.y+(dy-dx)/2};
  }
  pan(dx,dy) {this.camera.x=clamp(this.camera.x+(dx/24+dy/12)/2/this.zoom,-2,38);this.camera.y=clamp(this.camera.y+(dy/12-dx/24)/2/this.zoom,-2,38);}
  zoomBy(amount) {this.zoom=clamp(this.zoom*amount,.48,2.1);}
  focus(point) {this.camera.x=point.x;this.camera.y=point.y;}
  buffer(buffer,count) {
    const gl=this.gl,l=this.locations;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(l.pos);gl.vertexAttribPointer(l.pos,3,gl.FLOAT,false,28,0);
    gl.enableVertexAttribArray(l.color);gl.vertexAttribPointer(l.color,4,gl.FLOAT,false,28,12);
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  drawMesh(mesh) {const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.DYNAMIC_DRAW);this.buffer(this.dynamic,mesh.data.length/7);}
  render(game,hover) {
    const gl=this.gl;this.resize();gl.clearColor(.055,.075,.079,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    gl.uniform2f(this.locations.resolution,this.width,this.height);gl.uniform2f(this.locations.camera,this.camera.x,this.camera.y);gl.uniform1f(this.locations.zoom,this.zoom);
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);this.buffer(this.ground,this.groundCount);if(!this.cutaway)this.buffer(this.buildings,this.cityCount);
    const mesh=new Mesh(),overlay=new Mesh();
    const points=[{...game.relay,active:!game.relay.done,kind:'relay'}, {...game.vault,active:game.relay.done&&!game.vault.done,kind:'vault'}, {...game.exit,done:game.phase==='won',active:game.vault.done,kind:'exit'}];
    for(const p of points) {
      const col=p.done?'#7f9d86':p.active?'#d1bd65':'#617476';
      mesh.ring(p.x,p.y,p.kind==='exit'?2.5:1,.07,color(col));
      if(p.kind!=='exit') {mesh.box(p.x-.22,p.y-.18,.44,.36,.65,'#6d7a72');mesh.box(p.x-.19,p.y-.2,.38,.04,.22,col,.38);}
      if(p.active) {overlay.ring(p.x,p.y,1.2+Math.sin(game.time*3)*.08,.035,color(col,1,.65));}
    }
    for(const a of game.agents) {
      if(a.hp>0&&game.selected.has(a.id)) {
        mesh.ring(a.x,a.y,.43,.06,color('#e0c46d'));
        let from=a;
        for(const p of a.path) {mesh.line([from.x,from.y,.05],[p.x,p.y,.05],.025,color('#cdb65f',1,.45));from=p;}
      }
    }
    for(const unit of [...game.agents,...game.guards.filter(e=>visibleGuard(game,e))]) {
      const agent=unit.team==='agent',c=agent?'#d2c9a3':unit.stun>0?'#99c5bd':'#b26253';
      if(unit.hp<=0) {mesh.box(unit.x-.25,unit.y-.15,.5,.3,.08,'#4b5151');continue;}
      const moving=unit.path.length>0,swing=moving?Math.sin(game.time*13+unit.id)*.1:0;
      mesh.ring(unit.x,unit.y,.32,.3,color('#050d0e',1,.6),.035);
      mesh.box(unit.x-.16,unit.y-.13+swing,.12,.16,.32,'#202b2f');mesh.box(unit.x+.04,unit.y-.13-swing,.12,.16,.32,'#202b2f');
      mesh.box(unit.x-.21,unit.y-.16,.42,.32,.43,c,.28);mesh.box(unit.x-.13,unit.y-.12,.26,.24,.23,'#a4af9e',.71);
      mesh.box(unit.x-.13,unit.y+.122,.26,.018,.065,agent?'#fae191':'#ef9378',.8);
      mesh.box(unit.x+.16,unit.y-.1,.12,.43,.1,'#263337',.55);
      if(agent&&game.selected.has(unit.id)) {
        // Always-visible small marker preserves selection behind tall buildings.
        overlay.ring(unit.x,unit.y,.31,.04,color('#f3d780',1,.7),1.07);
        const p=[unit.x,unit.y,1.25];overlay.tri([p[0]-.12,p[1],p[2]+.12],[p[0]+.12,p[1],p[2]+.12],[p[0],p[1],p[2]],color('#edd58c'));
      }
    }
    // Decorative traffic follows fixed avenues; it does not participate in combat.
    for(let i=0;i<6;i++) {
      const along=(game.time*(i%2?.7:-.6)+i*6+3600)%36,lane=(i%4)*9+1.6;
      const x=i%2?lane:along,y=i%2?along:lane,w=i%2?.5:1.05,d=i%2?1.05:.5;
      mesh.box(x,y,w,d,.24,i%3===0?'#9b8c64':'#536369',.05);mesh.box(x+.08,y+.08,w-.16,d-.16,.2,'#293b42',.29);
      mesh.box(x+w-.08,y+.05,.06,.09,.06,'#e1c46d',.17);
    }
    for(const e of game.effects) {
      const life=e.life/e.maxLife;
      if(e.type==='shot') {mesh.line([e.x,e.y,.6],[e.tx,e.ty,.55],.045,color(e.team==='agent'?'#ffe2a1':'#d97c64',1,life));}
      else overlay.ring(e.x,e.y,e.type==='pulse'?(1-life)*7:.35+(1-life)*.5,.05,color(e.type==='pulse'?'#accdba':'#e6cb79',1,life));
    }
    if(hover&&game.phase==='active') mesh.ring(Math.floor(hover.x)+.5,Math.floor(hover.y)+.5,.3,.025,color('#e6dcb3',1,.45));
    this.drawMesh(mesh);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);this.drawMesh(overlay);gl.depthMask(true);
  }
  dispose() {const gl=this.gl;for(const b of [this.dynamic,this.ground,this.buildings])gl.deleteBuffer(b);gl.deleteProgram(this.program);}
}
