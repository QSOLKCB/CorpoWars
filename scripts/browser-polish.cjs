// SPDX-License-Identifier: Apache-2.0
// Native visual QA and bounded submission work against the frozen v0.4 renderer.
// The enlarged model stage is a test-only inspection view, not a gameplay zoom.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile,mkdir,writeFile}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const assert=require('node:assert/strict');
const root=resolve('.');
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
    if(path==='/'){
      res.setHeader('Content-Type','text/html');
      return res.end(`<!doctype html><meta charset="utf-8"><title>CorpoWars character polish QA</title>
<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#0d1518;color:#d7e3de;font:13px/1.5 monospace}h1{font-size:22px;margin:0 0 6px}p{margin:0 0 16px;color:#a7bdb8}#gallery{display:grid;grid-template-columns:repeat(2,700px);gap:16px}.panel{width:700px;outline:1px solid #49615e;background:#111e21}.panel h2{font-size:14px;padding:10px 14px;margin:0;color:#e1c77e}.plot{position:relative}.plot canvas{display:block;width:700px;height:420px}.actor-label{position:absolute;transform:translateX(-50%);white-space:nowrap;font-size:10px;color:#d6e6df;background:#0a161bd9;padding:2px 4px;border-bottom:1px solid #79958b;pointer-events:none}.detail #gallery{grid-template-columns:1400px}.detail .panel{width:1400px}.detail .plot canvas{width:1400px;height:720px}.detail .actor-label{font-size:12px}</style>
<h1>CorpoWars · character polish comparison</h1><p id="stage-note">Application maximum zoom 2.1 · original projection, shaders and batching · staged original models</p>
<main id="gallery"><section class="panel" id="before-panel"><h2>BEFORE · v0.4.0</h2><div class="plot"><canvas id="before"></canvas><div class="labels"></div></div></section><section class="panel" id="after-panel"><h2>AFTER · polished actor geometry</h2><div class="plot"><canvas id="after"></canvas><div class="labels"></div></div></section></main>`);
    }
    if(!/^\/(src|scripts)\//.test(path)){res.writeHead(404);return res.end();}
    const file=resolve(root,'.'+path);
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    const data=await readFile(file);
    res.setHeader('Content-Type',['.js','.mjs'].includes(extname(file))?'text/javascript':'text/plain');res.end(data);
  }catch{res.writeHead(404);res.end();}
});

(async()=>{
  let browser,page;
  try{
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    page=await browser.newPage({viewport:{width:1536,height:1100},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await mkdir('test-results',{recursive:true});
    const checks=await page.evaluate(async()=>{
      const {Renderer:Reference}=await import('/scripts/visual-polish-reference.mjs');
      const {Renderer:Candidate}=await import('/src/renderer.js');
      const {createGame,startGame}=await import('/src/simulation.js');
      const {createCampaign,MISSIONS}=await import('/src/campaign.js');
      const {polishFixture,WORKLOADS,FRAME_COUNT}=await import('/scripts/visual-polish-fixtures.mjs');
      const fail=(ok,message)=>{if(!ok)throw Error(message);};
      const serialize=game=>JSON.stringify(game,(_key,value)=>value instanceof Set?[...value]:value);
      function surface(width=480,height=320,element=null){
        const canvas=element??document.createElement('canvas'),rect={width,height};
        const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
        fail(gl,'WebGL2 must be available for native visual QA');
        const stats={drawCalls:0,drawnVertices:0,uploadCalls:0,uploadedBytes:0,storageCalls:0,storageBytes:0,peakRetainedBytes:0};
        const capacity=new Map();let bound=null;
        const original={};for(const name of ['bindBuffer','bufferData','bufferSubData','drawArrays','deleteBuffer'])original[name]=gl[name].bind(gl);
        gl.bindBuffer=(target,buffer)=>{if(target===gl.ARRAY_BUFFER)bound=buffer;return original.bindBuffer(target,buffer);};
        gl.bufferData=(target,data,usage,...args)=>{
          const bytes=typeof data==='number'?data:data.byteLength;
          stats.storageCalls++;stats.storageBytes+=bytes;capacity.set(bound,bytes);
          stats.peakRetainedBytes=Math.max(stats.peakRetainedBytes,[...capacity.values()].reduce((sum,n)=>sum+n,0));
          return original.bufferData(target,data,usage,...args);
        };
        gl.bufferSubData=(target,offset,data,...args)=>{stats.uploadCalls++;stats.uploadedBytes+=data.byteLength;return original.bufferSubData(target,offset,data,...args);};
        gl.drawArrays=(mode,first,count)=>{stats.drawCalls++;stats.drawnVertices+=count;return original.drawArrays(mode,first,count);};
        gl.deleteBuffer=buffer=>{capacity.delete(buffer);return original.deleteBuffer(buffer);};
        const wrapper={get width(){return canvas.width;},set width(value){canvas.width=value;},get height(){return canvas.height;},set height(value){canvas.height=value;},getContext:()=>gl,getBoundingClientRect:()=>rect};
        return {canvas,rect,gl,wrapper,stats,counts:()=>({...stats,retainedBytes:[...capacity.values()].reduce((sum,n)=>sum+n,0)}),read(){
          const data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
          fail(gl.getError()===gl.NO_ERROR,'native WebGL2 must complete without an error');return data;
        },release(renderer){renderer.dispose();fail(capacity.size===0,'all native GL buffers must be disposed');gl.getExtension('WEBGL_lose_context')?.loseContext();}};
      }
      const budgetKeys=['drawCalls','drawnVertices','uploadCalls','uploadedBytes','storageCalls','storageBytes','peakRetainedBytes','retainedBytes'];
      function budget(before,after,label){
        for(const key of budgetKeys)fail(after[key]<=before[key],`${label}: ${key} grew from ${before[key]} to ${after[key]}`);
      }
      function exact(a,b,label){fail(a.length===b.length,`${label}: pixel dimensions differ`);for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(`${label}: pixel byte ${i}, before ${a[i]}, after ${b[i]}`);}
      function galleryGame(state='idle'){
        const game=createGame();startGame(game);game.paused=true;game.time=state==='idle'?5:state==='walking'?5.43:state==='contact'?6.1:6.6;
        // A test-only open street stage keeps all silhouettes unobscured while
        // retaining the game's real ground, lamp geometry, projection and tint.
        game.world={...game.world,blocked:new Uint8Array(36*36),buildings:[]};
        game.relay.x=game.vault.x=game.exit.x=-100;game.relay.y=game.vault.y=game.exit.y=-100;
        const positions=[];
        for(let i=0;i<4;i++)positions.push({x:10.3+i*1.75,y:17.3-i*1.75});
        for(let i=0;i<4;i++)positions.push({x:13.3+i*1.75,y:20.3-i*1.75});
        for(const [i,agent]of game.agents.entries())Object.assign(agent,{...positions[i],prevX:positions[i].x,prevY:positions[i].y,path:[],hp:agent.maxHp});
        game.guards=game.guards.slice(0,3);
        for(const [i,guard]of game.guards.entries()){
          const point=positions[i+4],type=['guard','bulwark','marksman'][i],hp=[65,117,52][i];
          Object.assign(guard,{...point,prevX:point.x,prevY:point.y,path:[],hp,maxHp:hp,enemyType:type,fear:0,stun:0});
        }
        game.courier={id:300,team:'courier',name:'Witness',...positions[7],prevX:positions[7].x,prevY:positions[7].y,hp:120,maxHp:120,active:state!=='idle',path:[]};
        const units=[...game.agents,...game.guards,game.courier];
        if(state==='walking')for(const unit of units){unit.prevX=unit.x-.08;unit.path=[{x:unit.x+.8,y:unit.y}];}
        if(state==='contact'){
          game.agents[0].hp=60;game.agents[1].fear=2;game.guards[0].hp=30;game.guards[0].stun=2;game.guards[1].fear=2;game.courier.hp=75;
        }
        if(state==='casualties'){game.agents[3].hp=0;game.selected.delete(3);game.courier.hp=0;}
        return game;
      }
      const before=surface(700,420,document.getElementById('before')),after=surface(700,420,document.getElementById('after'));
      const oldRenderer=new Reference(before.wrapper,galleryGame()),newRenderer=new Candidate(after.wrapper,galleryGame());
      for(const renderer of [oldRenderer,newRenderer]){renderer.pixelRatio=1;renderer.focus({x:14.425,y:16.175},true);renderer.zoom=2.1;}
      function gallery(state='idle',detail=false){
        document.body.classList.toggle('detail',detail);
        document.getElementById('stage-note').textContent=detail?'Test-only model inspection zoom 5 · gameplay maximum remains 2.1':`Application maximum zoom 2.1 · ${state} pose · original projection, shaders and batching`;
        for(const model of [before,after]){model.rect.width=detail?1400:700;model.rect.height=detail?720:420;}
        for(const renderer of [oldRenderer,newRenderer])renderer.zoom=detail?5:2.1;
        const game=galleryGame(state),copy=galleryGame(state),snapshot=serialize(game),other=serialize(copy),alpha=state==='walking'?.75:1;
        oldRenderer.render(game,null,alpha,1/60);newRenderer.render(copy,null,alpha,1/60);
        fail(serialize(game)===snapshot&&serialize(copy)===other,'rendering must not mutate staged game state');
        const oldPixels=before.read(),newPixels=after.read();fail(oldPixels.length===newPixels.length,'gallery framebuffer sizes match');
        const units=[...copy.agents,...copy.guards,copy.courier],names=['VEX · POINT','NULL · BREACH','ECHO · RECON','IRON · SUPPORT','SECURITY','BULWARK','MARKSMAN','COURIER'];
        const regions=units.map(unit=>{
          const x=(unit.prevX??unit.x)+(unit.x-(unit.prevX??unit.x))*alpha,y=(unit.prevY??unit.y)+(unit.y-(unit.prevY??unit.y))*alpha;
          const p=newRenderer.project(x,y),scale=newRenderer.zoom;
          return {left:Math.floor(p.x-34*scale),right:Math.ceil(p.x+34*scale),top:Math.floor(p.y-48*scale),bottom:Math.ceil(p.y+13*scale)};
        });
        let changed=0,outside=0;const perActor=new Array(units.length).fill(0),colors=new Set();
        const width=after.canvas.width,height=after.canvas.height;
        for(let i=0;i<newPixels.length;i+=4){
          if(i%256===0)colors.add(`${newPixels[i]},${newPixels[i+1]},${newPixels[i+2]}`);
          if(oldPixels[i]===newPixels[i]&&oldPixels[i+1]===newPixels[i+1]&&oldPixels[i+2]===newPixels[i+2]&&oldPixels[i+3]===newPixels[i+3])continue;
          changed++;const x=(i/4)%width,y=height-1-Math.floor(i/4/width);let covered=false;
          for(let actor=0;actor<regions.length;actor++){const r=regions[actor];if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){perActor[actor]++;covered=true;}}
          if(!covered)outside++;
        }
        fail(changed>100,`${state}: actor polish must produce a visible native pixel change`);
        fail(outside===0,`${state}: ${outside} changed pixels fell outside the declared actor bounds`);
        if(state==='idle'||state==='walking')for(let i=0;i<perActor.length;i++)fail(perActor[i]>5,`${state}: ${names[i]} must have a visibly changed silhouette/material`);
        fail(colors.size>8,`${state}: new scene must have varied nonblank colours`);
        for(const [model,renderer,panel]of [[before,oldRenderer,'before-panel'],[after,newRenderer,'after-panel']]){
          const labels=document.querySelector(`#${panel} .labels`);labels.replaceChildren(...units.map((unit,i)=>{
            const label=document.createElement('span'),p=renderer.project(unit.x,unit.y);label.className='actor-label';label.textContent=names[i];label.style.left=`${p.x}px`;label.style.top=`${p.y+14}px`;return label;
          }));
        }
        budget(before.counts(),after.counts(),`gallery ${state}`);
        return {state,zoom:newRenderer.zoom,changedPixels:changed,outsideActorChanges:outside,changedPixelsByActor:perActor,before:before.counts(),after:after.counts()};
      }
      const galleryChecks=[];for(const state of ['idle','walking','contact','casualties'])galleryChecks.push(gallery(state));
      const staticCases=[];
      for(let index=0;index<MISSIONS.length;index++){
        const a=surface(),b=surface(),game=createGame(undefined,createCampaign(),index);game.agents=[];game.guards=[];game.selected.clear();delete game.courier;
        // Freeze the two-capture historical environment; browser-tactical checks all expanded maps.
        game.captureKeys=[];
        const old=new Reference(a.wrapper,game),current=new Candidate(b.wrapper,game);old.pixelRatio=current.pixelRatio=1;
        old.render(game,null,1,1/60);current.render(game,null,1,1/60);exact(a.read(),b.read(),`actorless ${game.mission.id}`);budget(a.counts(),b.counts(),`actorless ${game.mission.id}`);
        staticCases.push({id:game.mission.id,exactPixels:true});a.release(old);b.release(current);
      }
      const hiddenSurface=surface(),hiddenGame=galleryGame('walking');hiddenGame.guards=[];
      const hiddenRenderer=new Candidate(hiddenSurface.wrapper,hiddenGame);hiddenRenderer.pixelRatio=1;hiddenRenderer.focus({x:14.425,y:16.175},true);hiddenRenderer.zoom=2.1;
      hiddenRenderer.render(hiddenGame,null,.75,1/60);const hiddenBefore=hiddenSurface.read();
      const concealed={...galleryGame().guards[0],id:999,x:34.5,y:34.5,prevX:34.5,prevY:34.5,enemyType:'marksman'};hiddenGame.guards=[concealed];
      hiddenRenderer.render(hiddenGame,null,.75,1/60);exact(hiddenBefore,hiddenSurface.read(),'hidden specialist visibility');hiddenSurface.release(hiddenRenderer);
      const nativeWork=[];
      for(const name of WORKLOADS){
        const a=surface(360,240),b=surface(360,240),oldFixture=polishFixture(name),newFixture=polishFixture(name);
        const old=new Reference(a.wrapper,oldFixture.game),current=new Candidate(b.wrapper,newFixture.game);old.pixelRatio=current.pixelRatio=1;
        for(let index=0;index<FRAME_COUNT;index++){
          const f=oldFixture.step(index,old,a),g=newFixture.step(index,current,b);
          if(![0,1,30,60,119].includes(index))continue;
          old.render(oldFixture.game,f.hover,f.alpha,f.delta);current.render(newFixture.game,g.hover,g.alpha,g.delta);
        }
        fail(a.gl.getError()===a.gl.NO_ERROR&&b.gl.getError()===b.gl.NO_ERROR,`${name}: native work sample has no GL error`);
        const baseline=a.counts(),candidate=b.counts();budget(baseline,candidate,name);nativeWork.push({name,sampledFrames:5,baseline,candidate});a.release(old);b.release(current);
      }
      // CPU-side browser submission wall time includes native calls and possible
      // driver/queue stalls. It is not a GPU timer or a full-game FPS measure.
      function trial(Implementation){
        const start=performance.now(),model=surface(360,240),fixture=polishFixture('specialist-stress'),renderer=new Implementation(model.wrapper,fixture.game);renderer.pixelRatio=1;
        for(let index=0;index<60;index++){const frame=fixture.step(index,renderer,model);renderer.render(fixture.game,frame.hover,frame.alpha,frame.delta);}
        const elapsed=performance.now()-start;fail(model.gl.getError()===model.gl.NO_ERROR,'submission timing must have no GL error');model.release(renderer);return elapsed;
      }
      const samples={baseline:[],candidate:[]};
      for(let pair=0;pair<9;pair++)for(const candidate of pair%2?[true,false]:[false,true]){
        const elapsed=trial(candidate?Candidate:Reference);if(pair>=2)samples[candidate?'candidate':'baseline'].push(elapsed);
      }
      const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
      const submissionTiming={workload:'specialist-stress',frames:60,warmupPairs:2,measuredPairs:7,order:'alternating',samplesMs:samples,medianMs:{baseline:median(samples.baseline),candidate:median(samples.candidate)},timingGate:false,scope:'Cold renderer/native-context construction plus CPU submission wall time. May include driver/queue stalls; excludes explicit GPU timers, gameplay and FPS.'};
      window.polishGallery={render:gallery};gallery('idle');
      return {galleryChecks,staticCases,hiddenSpecialistPixelsUnchanged:true,nativeWork,submissionTiming,userAgent:navigator.userAgent};
    });
    for(const state of ['idle','walking','contact','casualties']){
      await page.evaluate(state=>window.polishGallery.render(state,false),state);
      await page.locator('#gallery').screenshot({path:`test-results/polish-${state}-application-scale.png`});
    }
    await page.evaluate(()=>window.polishGallery.render('idle',true));
    await page.locator('#before-panel').screenshot({path:'test-results/polish-before-detail.png'});
    await page.locator('#after-panel').screenshot({path:'test-results/polish-after-detail.png'});
    assert.deepEqual(errors,[]);
    await writeFile('test-results/visual-polish-browser.json',JSON.stringify({browser:await browser.version(),...checks},null,2)+'\n');
    console.log('PASS: native character polish changes all staged roles, preserves six actorless cities and hidden-enemy pixels, stays within native GL work/capacity budgets, and produces pose/detail galleries.');
    console.log('Browser submission observations:',JSON.stringify(checks.submissionTiming));
  }catch(error){
    if(page){await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/polish-failure.png',fullPage:true}).catch(()=>{});}
    throw error;
  }finally{if(browser)await browser.close();if(server.listening)await new Promise(done=>server.close(done));}
})().catch(error=>{console.error(error);process.exitCode=1;});
