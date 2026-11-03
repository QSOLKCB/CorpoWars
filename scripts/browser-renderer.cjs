// SPDX-License-Identifier: Apache-2.0
// Native WebGL2 pixel parity against the frozen v0.3.0 renderer. Test-only.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile,mkdir,writeFile}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const assert=require('node:assert/strict');
const root=resolve('.');
const server=createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Renderer conformance</title>');}
    if(!/^\/(src|scripts)\//.test(path)){res.writeHead(404);return res.end();}
    const file=resolve(root,'.'+path);
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    const body=await readFile(file);
    res.setHeader('Content-Type',['.js','.mjs'].includes(extname(file))?'text/javascript':'text/plain');res.end(body);
  }catch{res.writeHead(404);res.end();}
});
(async()=>{
  let browser;
  try {
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result=await page.evaluate(async()=>{
      const {Renderer:Reference}=await import('/scripts/performance-render-reference.mjs');
      const {Renderer:Candidate}=await import('/src/renderer.js');
      const {renderFixture,WORKLOADS,FRAME_COUNT}=await import('/scripts/performance-render-fixtures.mjs');
      const {writeStyle,MinimapBackground,drawMinimapBackground}=await import('/src/runtime.js');
      const style=document.createElement('div').style;
      const wantedWidth='33.33333333333333%',wantedLeft='127.123456789px';
      writeStyle(style,'width',wantedWidth);writeStyle(style,'left',wantedLeft);
      const normalizedWidth=style.width,normalizedLeft=style.left;
      const probe=document.createElement('div');
      writeStyle(probe.style,'width',wantedWidth);writeStyle(probe.style,'left',wantedLeft);
      const observer=new MutationObserver(()=>{});observer.observe(probe,{attributes:true,attributeFilter:['style']});
      for(let i=0;i<600;i++){writeStyle(probe.style,'width',wantedWidth);writeStyle(probe.style,'left',wantedLeft);}
      if(observer.takeRecords().length)throw Error('Unchanged normalized CSS must not mutate style');
      probe.style.width='12%';observer.takeRecords();writeStyle(probe.style,'width',wantedWidth);
      if(observer.takeRecords().length!==1||probe.style.width!==normalizedWidth||probe.style.left!==normalizedLeft)throw Error('External CSS edits must be repaired');
      observer.disconnect();
      const {createGame}=await import('/src/simulation.js');
      const {createCampaign}=await import('/src/campaign.js');
      const fresh=document.createElement('canvas'),cached=document.createElement('canvas');
      fresh.width=fresh.height=cached.width=cached.height=216;
      const freshContext=fresh.getContext('2d'),cachedContext=cached.getContext('2d');
      const background=new MinimapBackground(document.createElement('canvas'));
      let minimapCases=0;
      for(let mission=0;mission<3;mission++){
        const game=createGame(undefined,createCampaign(),mission);
        for(let change=0;change<5;change++){
          if(change===2)game.world.buildings[0].x+=.125;
          if(change===3)game.relay.y+=.25;
          if(change===4)game.world.buildings.pop();
          drawMinimapBackground(freshContext,game);background.draw(cachedContext,game);
          const a=freshContext.getImageData(0,0,216,216).data,b=cachedContext.getImageData(0,0,216,216).data;
          for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(`Minimap ${mission}/${change} pixel byte ${i} differs`);
          minimapCases++;
        }
      }
      function surface(){
        const canvas=document.createElement('canvas'),rect={width:480,height:320};
        const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'low-power'});
        if(!gl)throw Error('WebGL2 unavailable');
        return {gl,rect,canvas:{get width(){return canvas.width;},set width(v){canvas.width=v;},get height(){return canvas.height;},set height(v){canvas.height=v;},getContext:()=>gl,getBoundingClientRect:()=>rect},read(){
          const bytes=new Uint8Array(canvas.width*canvas.height*4);
          gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
          if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error while reading pixels');
          return bytes;
        }};
      }
      const results=[];
      for(const name of WORKLOADS){
        const oldSurface=surface(),newSurface=surface(),oldFixture=renderFixture(name),newFixture=renderFixture(name);
        const oldRenderer=new Reference(oldSurface.canvas,oldFixture.game),newRenderer=new Candidate(newSurface.canvas,newFixture.game);
        // Both density settings, cutaway, camera, resize, paused orders, terminal
        // state, changing effects and interpolated movement use the same fixtures
        // as the independent Float32 work-count comparison.
        for(let frame=0;frame<FRAME_COUNT;frame++){
          oldRenderer.pixelRatio=newRenderer.pixelRatio=frame<FRAME_COUNT/2?1:2;
          oldFixture.frame(frame,oldRenderer,oldSurface);newFixture.frame(frame,newRenderer,newSurface);
          const a=oldSurface.read(),b=newSurface.read();
          if(a.length!==b.length)throw Error(`${name}/${frame}: framebuffer sizes differ`);
          for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(`${name}/${frame}: pixel byte ${i}, old ${a[i]}, new ${b[i]}`);
        }
        results.push({name,frames:FRAME_COUNT,exactPixels:true});
        oldRenderer.dispose();newRenderer.dispose();
        for(const surface of [oldSurface,newSurface])surface.gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      return {results,frames:results.reduce((n,r)=>n+r.frames,0),minimapCases,unchangedStyleWrites:0,userAgent:navigator.userAgent};
    });
    assert.deepEqual(errors,[]);assert.equal(result.frames,480);
    await mkdir('test-results',{recursive:true});
    await writeFile('test-results/renderer-pixel-parity.json',JSON.stringify(result,null,2)+'\n');
    console.log(`PASS: exact native WebGL2 pixel parity for ${result.frames} frames, ${result.minimapCases} minimap states, and normalized CSS reuse/repair.`);
  }finally{if(browser)await browser.close();await new Promise(done=>server.close(done));}
})().catch(error=>{console.error(error);process.exitCode=1;});
