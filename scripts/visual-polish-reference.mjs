// SPDX-License-Identifier: Apache-2.0
// Original geometry, rendered as coloured triangles with native WebGL2.
import { clamp, random, visibleGuard } from '../src/simulation.js';

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

// New districts have their own original industrial palettes. Legacy worlds have
// no theme and take the exact original colour/geometry branch below.
const DISTRICT_STYLES = {
  copperline: {base:'#231b18',road:'#332b26',pavement:'#514840',body:['#6c6253','#594e45'],roof:'#9b8970',edge:'#d1b98b',window:'#e7bd78',dark:'#322d2a',accent:'#d99155',plant:'#65704b'},
  coldstore: {base:'#121d28',road:'#223640',pavement:'#405965',body:['#607d8b','#465d70'],roof:'#8aa7b6',edge:'#bde5ec',window:'#a5e5ec',dark:'#273b50',accent:'#7dcadf',plant:'#4c7474'},
  exchange: {base:'#1e1828',road:'#30293b',pavement:'#4f455c',body:['#746780','#584f66'],roof:'#a194ad',edge:'#dbbce6',window:'#e4b4dd',dark:'#3a3045',accent:'#c69cdb',plant:'#5f6075'},
};

// Keep only the finite original palette; animated alpha/light values are not cached.
const palette = new Map();
function color(hex, light = 1, alpha = 1) {
  let c=palette.get(hex);
  if(!c) {
    const n=Number.parseInt(hex.replace('#',''),16);
    c=[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,1];palette.set(hex,c);
  }
  return light===1&&alpha===1?c:[c[0]*light,c[1]*light,c[2]*light,alpha];
}

// Exactly the angles used by the original 32-segment rings, evaluated once.
const ringCos=Array.from({length:33},(_,i)=>Math.cos(i*Math.PI/16));
const ringSin=Array.from({length:33},(_,i)=>Math.sin(i*Math.PI/16));
class Mesh {
  constructor() { this.data=new Float32Array(65536);this.length=0; }
  reset() {this.length=0;}
  view() {return this.data.subarray(0,this.length);}
  reserve(count) {
    if(this.length+count<=this.data.length)return;
    let capacity=this.data.length;while(capacity<this.length+count)capacity*=2;
    const next=new Float32Array(capacity);next.set(this.data.subarray(0,this.length));this.data=next;
  }
  vertex(x,y,z,r,g,b,a) {
    const v=this.data,i=this.length;
    v[i]=x;v[i+1]=y;v[i+2]=z;v[i+3]=r;v[i+4]=g;v[i+5]=b;v[i+6]=a;this.length=i+7;
  }
  tri(a,b,c,col) {
    this.reserve(21);
    this.vertex(a[0],a[1],a[2],...col);this.vertex(b[0],b[1],b[2],...col);this.vertex(c[0],c[1],c[2],...col);
  }
  quadValues(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz,r,g,b,a) {
    this.reserve(42);
    this.vertex(ax,ay,az,r,g,b,a);this.vertex(bx,by,bz,r,g,b,a);this.vertex(cx,cy,cz,r,g,b,a);
    this.vertex(ax,ay,az,r,g,b,a);this.vertex(cx,cy,cz,r,g,b,a);this.vertex(dx,dy,dz,r,g,b,a);
  }
  quad(a,b,c,d,col) {this.quadValues(...a,...b,...c,...d,...col);}
  floor(x,y,w,d,col,z=.01) {this.quadValues(x,y,z,x+w,y,z,x+w,y+d,z,x,y+d,z,...col);}
  box(x,y,w,d,h,col,base=0) {
    const c=typeof col==='string'?color(col):col,r=c[0],g=c[1],b=c[2],a=c[3],top=base+h;
    this.quadValues(x,y,top,x+w,y,top,x+w,y+d,top,x,y+d,top,r*1.06,g*1.06,b*1.06,a);
    this.quadValues(x,y+d,base,x+w,y+d,base,x+w,y+d,top,x,y+d,top,r*.65,g*.65,b*.65,a);
    this.quadValues(x+w,y,base,x+w,y+d,base,x+w,y+d,top,x+w,y,top,r*.82,g*.82,b*.82,a);
  }
  line(a,b,width,col) {
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,x=-dy/len*width/2,y=dx/len*width/2;
    this.quadValues(a[0]+x,a[1]+y,a[2],b[0]+x,b[1]+y,b[2],b[0]-x,b[1]-y,b[2],a[0]-x,a[1]-y,a[2],...col);
  }
  ring(x,y,radius,width,col,z=.04) {
    for(let i=0;i<32;i++)this.quadValues(
      x+ringCos[i]*radius,y+ringSin[i]*radius,z,x+ringCos[i+1]*radius,y+ringSin[i+1]*radius,z,
      x+ringCos[i+1]*(radius-width),y+ringSin[i+1]*(radius-width),z,x+ringCos[i]*(radius-width),y+ringSin[i]*(radius-width),z,...col);
  }
}

// Capture every geometry input, including paths/selection and visible membership.
// Camera, zoom, resolution and cutaway affect only uniforms/static draw selection.
// This is synchronous current-generation reuse, with no historical/unbounded cache.
function geometrySignature(game,hover,alpha,guards) {
  const unit=u=>[u.x,u.y,u.prevX??u.x,u.prevY??u.y,u.id,u.team,u.hp,u.maxHp,u.fear,u.stun,u.enemyType,u.path.map(p=>[p.x,p.y])];
  const point=p=>[p.x,p.y,p.done];
  const c=game.courier,courier=c?[c.x,c.y,c.prevX??c.x,c.prevY??c.y,c.hp,c.maxHp,Boolean(c.active),Boolean(c.path?.length)]:null;
  return JSON.stringify([game.time,game.phase,alpha,point(game.relay),point(game.vault),point(game.exit),
    [...game.selected],game.agents.map(unit),guards.map(unit),courier,game.mission.kind,Boolean(game.holdContested),
    game.effects.map(e=>[e.type,e.life,e.maxLife,e.x,e.y,e.tx,e.ty,e.weapon,e.team]),
    hover&&game.phase==='active'?[Math.floor(hover.x),Math.floor(hover.y)]:null],(_key,value)=>{
      if(typeof value==='number') {
        if(!Number.isFinite(value))throw new TypeError('non-finite render input');
        if(Object.is(value,-0))return '-0';
      }
      return value;
    });
}

function shader(gl, type, source) {
  const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) { const msg=gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(msg); }
  return s;
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('WebGL2 is unavailable. Enable hardware acceleration or use a browser with WebGL2 support.');
    this.gl=gl; this.camera={x:14,y:22}; this.zoom=1; this.cutaway=false; this.width=1; this.height=1;
    this.cameraTarget={...this.camera};this.mesh=new Mesh();this.overlay=new Mesh();this.dynamicBytes=0;this.overlayBytes=0;this.pixelRatio=2;
    this.geometryKey=null;this.vaos=new Map();
    this.stats={geometryBuilds:0,geometryHits:0,uploadedBytes:0,storageAllocations:0};
    this.program=gl.createProgram();
    const vs=shader(gl,gl.VERTEX_SHADER,VERTEX), fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    this.locations={pos:gl.getAttribLocation(this.program,'a_position'),color:gl.getAttribLocation(this.program,'a_color'),
      resolution:gl.getUniformLocation(this.program,'u_resolution'),camera:gl.getUniformLocation(this.program,'u_camera'),zoom:gl.getUniformLocation(this.program,'u_zoom')};
    this.dynamic=gl.createBuffer();this.overlayBuffer=gl.createBuffer();this.ground=gl.createBuffer();this.buildings=gl.createBuffer();
    this.makeCity(game.world); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  }
  makeCity(world) {
    this.geometryKey=null;
    const ground=new Mesh(),city=new Mesh(),rng=random(world.seed+13),gl=this.gl,theme=DISTRICT_STYLES[world.theme];
    ground.box(-.2,-.2,world.size+.4,world.size+.4,.35,theme?.base??'#11191b',-.38);
    for(let y=0;y<world.size;y++) for(let x=0;x<world.size;x++) {
      const road=x%9<3||y%9<3, shade=.88+rng()*.18;
      ground.floor(x+.015,y+.015,.97,.97,color(road?(theme?.road??'#232d30'):(theme?.pavement??'#3a4748'),shade));
      if(x%9===1&&y%9>3&&y%2===0) ground.floor(x+.47,y+.15,.06,.55,color('#7b7f67'),.025);
      if(y%9===1&&x%9>3&&x%2===0) ground.floor(x+.15,y+.47,.55,.06,color('#7b7f67'),.025);
      if((x%9===3||x%9===8)&&y%9>=3) ground.floor(x+(x%9===3?0:.91),y,.08,1,color('#64706a'),.035);
      if((y%9===3||y%9===8)&&x%9>=3) ground.floor(x,y+(y%9===3?0:.91),1,.08,color('#64706a'),.035);
      if((x%9===3&&y%9<3)||(y%9===3&&x%9<3)) {
        for(let i=0;i<4;i++) ground.floor(x+.07+i*.23,y+.15,.11,.65,color('#69736a'),.03);
      }
    }
    for(const b of world.buildings) {
      // Static contact shadows and roof outlines give the city more depth at no
      // per-frame geometry cost.
      ground.floor(b.x+.28,b.y+.32,b.w+.25,b.d+.3,color('#060d10',1,.36),.04);
      const c=theme?theme.body[b.tone>.5?0:1]:b.tone>.5?'#556264':'#444f55';
      city.box(b.x+.03,b.y+.03,b.w-.06,b.d-.06,b.height,c);
      city.box(b.x-.03,b.y-.03,b.w+.06,b.d+.06,.12,theme?.roof??'#6d7770',b.height);
      city.line([b.x,b.y+b.d,b.height+.13],[b.x+b.w,b.y+b.d,b.height+.13],.035,color(theme?.edge??'#a4b4a4'));
      city.box(b.x+.28,b.y+.25,Math.min(1.2,b.w-.5),Math.min(.8,b.d-.5),.4,'#313d40',b.height+.12);
      if(b.w>2) {
        city.box(b.x+1.9,b.y+.3,.5,.5,.23,'#818875',b.height+.12);
        city.box(b.x+.45,b.y+.45,.055,.055,1,'#8b9484',b.height+.5);
      }
      for(let z=.6;z<b.height-.2;z+=.64) {
        for(let x=b.x+.28;x<b.x+b.w-.3;x+=.52) {
          const lit=rng()>.35;
          city.quad([x,b.y+b.d+.003,z],[x+.28,b.y+b.d+.003,z],[x+.28,b.y+b.d+.003,z+.22],[x,b.y+b.d+.003,z+.22],color(lit?(theme?.window??'#b4ae6e'):(theme?.dark??'#243338'),lit?.65+rng()*.4:1));
        }
        for(let y=b.y+.25;y<b.y+b.d-.3;y+=.52) {
          city.quad([b.x+b.w+.003,y,z],[b.x+b.w+.003,y+.28,z],[b.x+b.w+.003,y+.28,z+.22],[b.x+b.w+.003,y,z+.22],color(rng()>.5?(theme?.window??'#9ca77d'):(theme?.dark??'#293a3e')));
        }
      }
      if(b.w>2) {
        city.box(b.x+.4,b.y+b.d+.04,1.4,.035,.38,theme?.accent??'#d1ac51',.9);
        for(let i=0;i<5;i++) city.box(b.x+.51+i*.25,b.y+b.d+.08,.11,.015,.22,'#353d35',.98);
      }
      // Low planters and original geometric trees at block corners.
      const x=b.x+b.w+.35,y=b.y+.4;
      if(x<world.size&&!world.blocked[Math.floor(y)*world.size+Math.floor(x)]) {
        ground.box(x-.18,y-.18,.36,.36,.18,'#525e50');
        city.box(x-.04,y-.04,.08,.08,.65,'#514f40');
        city.box(x-.22,y-.22,.44,.44,.5,theme?.plant??'#455c4d',.55);
      }
      // Distinct rooftop silhouettes are static, original procedural geometry.
      if(theme&&b.w>=2&&b.d>=2) {
        const x=b.x+b.w*.5,y=b.y+b.d*.5,z=b.height+.14;
        if(world.theme==='copperline') {
          city.box(x-.45,y-.3,.35,.6,.6,theme.accent,z);
          city.box(x+.1,y-.3,.35,.6,.6,theme.accent,z);
          city.line([x-.28,y,z+.7],[x+.28,y,z+.7],.08,color(theme.edge));
        }else if(world.theme==='coldstore') {
          city.box(x-.55,y-.55,1.1,1.1,.22,theme.dark,z);
          city.ring(x,y,.42,.1,color(theme.edge),z+.24);
          city.line([x-.33,y,z+.25],[x+.33,y,z+.25],.055,color(theme.accent));
          city.line([x,y-.33,z+.25],[x,y+.33,z+.25],.055,color(theme.accent));
        }else {
          city.box(x-.22,y-.22,.44,.44,.38,theme.dark,z);
          city.box(x-.035,y-.035,.07,.07,1.1,theme.edge,z+.38);
          city.box(x-.18,y-.06,.36,.12,.12,theme.accent,z+1.25);
        }
      }
    }
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) {
      const x=i*9+3.3,y=j*9+3.3;
      city.box(x,y,.05,.05,1.65,'#75837a');city.box(x-.15,y-.05,.35,.15,.08,'#cebd78',1.65);
      ground.floor(x-.3,y-.3,.7,.7,color('#d4bd76',1,.07),.03);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,this.ground);gl.bufferData(gl.ARRAY_BUFFER,ground.view(),gl.STATIC_DRAW);this.groundCount=ground.length/7;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buildings);gl.bufferData(gl.ARRAY_BUFFER,city.view(),gl.STATIC_DRAW);this.cityCount=city.length/7;
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,this.pixelRatio);
    this.width=rect.width;this.height=rect.height;
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h) {this.canvas.width=w;this.canvas.height=h;}
    if(this.viewportWidth!==w||this.viewportHeight!==h) {this.gl.viewport(0,0,w,h);this.viewportWidth=w;this.viewportHeight=h;}
  }
  project(x,y,z=0) {return {x:((x-y)-(this.camera.x-this.camera.y))*24*this.zoom+this.width/2,y:((x+y)-(this.camera.x+this.camera.y))*12*this.zoom-z*24*this.zoom+this.height/2};}
  unproject(x,y) {
    const dx=(x-this.width/2)/(24*this.zoom),dy=(y-this.height/2)/(12*this.zoom);
    return {x:this.camera.x+(dx+dy)/2,y:this.camera.y+(dy-dx)/2};
  }
  pan(dx,dy) {this.camera.x=clamp(this.camera.x+(dx/24+dy/12)/2/this.zoom,-2,38);this.camera.y=clamp(this.camera.y+(dy/12-dx/24)/2/this.zoom,-2,38);this.cameraTarget={...this.camera};}
  zoomBy(amount) {this.zoom=clamp(this.zoom*amount,.48,2.1);}
  focus(point, immediate=false) {this.cameraTarget={x:clamp(point.x,-2,38),y:clamp(point.y,-2,38)};if(immediate)this.camera={...this.cameraTarget};}
  buffer(buffer,count) {
    const gl=this.gl,l=this.locations;
    let vao=this.vaos.get(buffer);
    if(!vao) {
      vao=gl.createVertexArray();this.vaos.set(buffer,vao);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enableVertexAttribArray(l.pos);gl.vertexAttribPointer(l.pos,3,gl.FLOAT,false,28,0);
      gl.enableVertexAttribArray(l.color);gl.vertexAttribPointer(l.color,4,gl.FLOAT,false,28,12);
    }else gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  uploadMesh(mesh,buffer,capacityName) {
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    if(mesh.length*4>this[capacityName]) {
      const capacity=Math.max(262144,mesh.data.byteLength);
      gl.bufferData(gl.ARRAY_BUFFER,capacity,gl.DYNAMIC_DRAW);this[capacityName]=capacity;this.stats.storageAllocations++;
    }
    if(mesh.length) {gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.view());this.stats.uploadedBytes+=mesh.length*4;}
  }
  drawMesh(mesh) {this.uploadMesh(mesh,this.dynamic,'dynamicBytes');this.buffer(this.dynamic,mesh.length/7);}
  render(game,hover,alpha=1,delta=1/60) {
    const ease=1-Math.exp(-12*delta);
    this.camera.x+=(this.cameraTarget.x-this.camera.x)*ease;this.camera.y+=(this.cameraTarget.y-this.camera.y)*ease;
    const gl=this.gl;this.resize();gl.clearColor(.055,.075,.079,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    gl.uniform2f(this.locations.resolution,this.width,this.height);gl.uniform2f(this.locations.camera,this.camera.x,this.camera.y);gl.uniform1f(this.locations.zoom,this.zoom);
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);this.buffer(this.ground,this.groundCount);if(!this.cutaway)this.buffer(this.buildings,this.cityCount);
    const guards=game.guards.filter(e=>visibleGuard(game,e)),key=geometrySignature(game,hover,alpha,guards);
    const mesh=this.mesh,overlay=this.overlay;
    if(key!==this.geometryKey) {
    this.geometryKey=null;mesh.reset();overlay.reset();
    const points=[{...game.relay,active:!game.relay.done,kind:'relay'}, {...game.vault,active:game.relay.done&&!game.vault.done,kind:'vault'}, {...game.exit,done:game.phase==='won',active:game.vault.done,kind:'exit'}];
    for(const p of points) {
      const col=p.done?'#7f9d86':p.active?'#d1bd65':'#617476';
      mesh.ring(p.x,p.y,p.kind==='exit'?2.5:1,.07,color(col));
      if(p.kind!=='exit') {mesh.box(p.x-.22,p.y-.18,.44,.36,.65,'#6d7a72');mesh.box(p.x-.19,p.y-.2,.38,.04,.22,col,.38);}
      if(p.active) {overlay.ring(p.x,p.y,1.2+Math.sin(game.time*3)*.08,.035,color(col,1,.65));}
    }
    if(game.mission.kind==='hold'&&!game.vault.done) {
      mesh.ring(game.vault.x,game.vault.y,3,.055,color(game.holdContested?'#e18a73':game.relay.done?'#8bc8ac':'#788d88',1,.7));
    }
    for(const state of game.agents) {
      const a=state,x=(a.prevX??a.x)+(a.x-(a.prevX??a.x))*alpha,y=(a.prevY??a.y)+(a.y-(a.prevY??a.y))*alpha;
      if(a.hp>0&&game.selected.has(a.id)) {
        mesh.ring(x,y,.43,.06,color('#e0c46d'));
        let from={x,y};
        for(const p of a.path) {mesh.line([from.x,from.y,.05],[p.x,p.y,.05],.025,color('#cdb65f',1,.45));from=p;}
      }
    }
    for(let i=0;i<game.agents.length+guards.length;i++) {
      const unit=i<game.agents.length?game.agents[i]:guards[i-game.agents.length];
      const x=(unit.prevX??unit.x)+(unit.x-(unit.prevX??unit.x))*alpha,y=(unit.prevY??unit.y)+(unit.y-(unit.prevY??unit.y))*alpha;
      const agent=unit.team==='agent',c=agent?'#d2c9a3':unit.fear>0?'#bd91cf':unit.stun>0?'#99c5bd':unit.enemyType==='bulwark'?'#bb8061':unit.enemyType==='marksman'?'#9c78b5':'#b26253';
      if(unit.hp<=0) {mesh.box(x-.25,y-.15,.5,.3,.08,'#4b5151');continue;}
      const moving=unit.path.length>0,swing=moving?Math.sin((game.time+alpha/30)*13+unit.id)*.1:0;
      mesh.ring(x,y,.32,.3,color('#050d0e',1,.6),.035);
      mesh.box(x-.16,y-.13+swing,.12,.16,.32,'#202b2f');mesh.box(x+.04,y-.13-swing,.12,.16,.32,'#202b2f');
      mesh.box(x-.21,y-.16,.42,.32,.43,c,.28);mesh.box(x-.13,y-.12,.26,.24,.23,'#a4af9e',.71);
      mesh.box(x-.13,y+.122,.26,.018,.065,agent?'#fae191':'#ef9378',.8);
      mesh.box(x+.16,y-.1,.12,.43,.1,'#263337',.55);
      if(!agent&&unit.enemyType==='bulwark') {
        mesh.box(x-.29,y+.16,.58,.09,.56,'#48515b',.28);
        mesh.box(x-.23,y+.255,.46,.025,.08,'#e3b17d',.7);
        mesh.box(x-.27,y-.2,.54,.38,.13,'#6a6d71',.62);
      }else if(!agent&&unit.enemyType==='marksman') {
        mesh.box(x+.18,y+.32,.065,.5,.055,'#444054',.57);
        mesh.box(x+.165,y+.06,.095,.16,.09,'#c9a5e4',.65);
        overlay.tri([x-.09,y,1.23],[x+.09,y,1.23],[x,y,1.36],color('#c9a5e4',1,.85));
      }
      if(unit.fear>0)overlay.ring(x,y,.44,.07,color('#cf9ce8',1,.85),1.1);
      if(unit.hp<unit.maxHp) {
        overlay.line([x-.32,y,1.25],[x+.32,y,1.25],.07,color('#192229'));
        overlay.line([x-.32,y,1.25],[x-.32+.64*unit.hp/unit.maxHp,y,1.25],.05,color(agent?'#adce95':'#e79777'));
      }
      if(agent&&game.selected.has(unit.id)) {
        // Always-visible small marker preserves selection behind tall buildings.
        overlay.ring(x,y,.31,.04,color('#f3d780',1,.7),1.07);
        const p=[x,y,1.25];overlay.tri([p[0]-.12,p[1],p[2]+.12],[p[0]+.12,p[1],p[2]+.12],[p[0],p[1],p[2]],color('#edd58c'));
      }
    }
    if(game.courier) {
      const unit=game.courier,x=(unit.prevX??unit.x)+(unit.x-(unit.prevX??unit.x))*alpha,y=(unit.prevY??unit.y)+(unit.y-(unit.prevY??unit.y))*alpha;
      if(unit.hp<=0)mesh.box(x-.25,y-.15,.5,.3,.08,'#4b5151');
      else {
        const accent=unit.active?'#8ad9dc':'#d0b67c',moving=unit.active&&unit.path?.length,swing=moving?Math.sin(game.time*13+300)*.08:0;
        mesh.ring(x,y,.4,.05,color(accent));
        mesh.box(x-.16,y-.12+swing,.12,.16,.32,'#25343c');mesh.box(x+.04,y-.12-swing,.12,.16,.32,'#25343c');
        mesh.box(x-.2,y-.16,.4,.32,.43,accent,.28);mesh.box(x-.12,y-.11,.24,.22,.23,'#c0d4ca',.71);
        mesh.box(x-.16,y-.24,.32,.1,.34,'#3b626c',.34);
        mesh.box(x+.19,y,.13,.25,.18,'#dabf83',.36);
        overlay.ring(x,y,.36,.045,color(accent,1,.8),1.08);
        overlay.tri([x-.12,y,1.24],[x+.12,y,1.24],[x,y,1.4],color(accent));
        if(unit.active||unit.hp<unit.maxHp) {
          overlay.line([x-.34,y,1.53],[x+.34,y,1.53],.075,color('#192229'));
          overlay.line([x-.34,y,1.53],[x-.34+.68*unit.hp/unit.maxHp,y,1.53],.05,color('#9cdbd9'));
        }
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
      if(e.type==='shot') {
        mesh.line([e.x,e.y,.6],[e.tx,e.ty,.55],e.weapon==='shotgun'?.11:.045,color(e.team==='agent'?'#ffe2a1':'#d97c64',1,life));
        mesh.box(e.tx-.06,e.ty-.06,.12,.12,.12,color('#ffe8ae',1,life),.45);
      }
      else overlay.ring(e.x,e.y,e.type==='pulse'||e.type==='panic'?(1-life)*7:.35+(1-life)*.5,.05,color(e.type==='panic'?'#ce9ce7':e.type==='pulse'?'#accdba':'#e6cb79',1,life));
    }
    if(hover&&game.phase==='active') mesh.ring(Math.floor(hover.x)+.5,Math.floor(hover.y)+.5,.3,.025,color('#e6dcb3',1,.45));
    this.uploadMesh(mesh,this.dynamic,'dynamicBytes');this.uploadMesh(overlay,this.overlayBuffer,'overlayBytes');
    // Publish only after both uploads succeed; a failed build/upload retries fresh.
    this.geometryKey=key;this.stats.geometryBuilds++;
    }else this.stats.geometryHits++;
    this.buffer(this.dynamic,mesh.length/7);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);this.buffer(this.overlayBuffer,overlay.length/7);gl.depthMask(true);
  }
  dispose() {
    const gl=this.gl;for(const vao of this.vaos.values())gl.deleteVertexArray(vao);this.vaos.clear();
    for(const b of [this.dynamic,this.overlayBuffer,this.ground,this.buildings])gl.deleteBuffer(b);
    this.geometryKey=null;gl.deleteProgram(this.program);
  }
}
