// SPDX-License-Identifier: Apache-2.0
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile,mkdir,writeFile}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const assert=require('node:assert/strict');
const root=resolve('.'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
    const relative=path.startsWith('/CorpoWars/')?'/dist/'+path.slice('/CorpoWars/'.length):path;
    const file=resolve(root,'.'+(relative.endsWith('/')?relative+'index.html':relative));
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'text/plain'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
(async()=>{
  let browser;
  try{
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.goto(base+'/CorpoWars/');await page.locator('#deploy').waitFor();
    await page.locator('#headquarters').click();await page.locator('#buy-patch').click();
    assert.equal(await page.locator('#cash').textContent(),'5,750');assert.match(await page.locator('#patch-stock').textContent(),/^1 \/ 12/);
    await page.reload();await page.locator('#headquarters').click();assert.equal(await page.locator('#cash').textContent(),'5,750');
    await page.locator('#hq-ready').click();await page.locator('#deploy').click();await page.keyboard.press('1');
    await page.locator('#hold-fire').click();await page.waitForTimeout(500);
    const ammo=async(id=0)=>Number((await page.locator(`#agent-${id} .health-text`).textContent()).match(/(\d+)\/\d+$/)[1]);
    const box=await page.locator('#battlefield').boundingBox(),x=box.x+box.width*.65,y=box.y+box.height*.55;
    const before=await ammo();await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.waitForTimeout(700);await page.mouse.up({button:'right'});await page.waitForTimeout(160);
    const fired=await ammo();assert.ok(fired<before,'holding right-click fires the selected agent');assert.equal(await ammo(1),12,'unselected agents do not manually fire');
    await page.waitForTimeout(700);assert.equal(await ammo(),fired,'release stops manual fire with hold-fire enabled');
    await page.locator('#pause').click();await page.mouse.click(x,y,{button:'right'});await page.waitForTimeout(180);assert.equal(await ammo(),fired,'pause blocks manual shots');
    await page.locator('#pause').click();await page.waitForTimeout(650);assert.equal(await ammo(),fired,'resume needs a fresh press');
    await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.waitForTimeout(180);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up({button:'right'});
    await page.waitForTimeout(180);const blurred=await ammo();assert.equal(await page.locator('#pause-banner').isVisible(),true);
    await page.locator('#pause').click();await page.waitForTimeout(650);assert.equal(await ammo(),blurred,'blur cancels held input across resume');
    await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.waitForTimeout(150);await page.locator('#battlefield').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up({button:'right'});await page.waitForTimeout(180);
    const canceled=await ammo();await page.waitForTimeout(650);assert.equal(await ammo(),canceled,'pointer cancellation stops manual fire');
    await page.locator('#pause').click();await page.waitForTimeout(500);
    const label=()=>page.locator('.world-label').filter({hasText:'RELAY'}).evaluate(el=>[el.style.left,el.style.top]);
    const original=await label();const angles=[];
    await mkdir('test-results',{recursive:true});
    for(let turn=0;turn<4;turn++){
      angles.push(await label());await page.screenshot({path:`test-results/tactical-angle-${turn}.png`,fullPage:true});
      await page.locator('#rotate-right').click();await page.waitForTimeout(120);
    }
    assert.equal(new Set(angles.map(JSON.stringify)).size,4);assert.deepEqual(await label(),original,'four turns restore projection');
    await page.keyboard.press('[');await page.waitForTimeout(100);assert.notDeepEqual(await label(),original);await page.keyboard.press(']');
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#rotate-right').click();await page.screenshot({path:'test-results/tactical-mobile.png',fullPage:true});
    // Save migration and all expanded objective rows are exercised from legitimate campaign state.
    await page.evaluate(async()=>{
      const {createCampaign,settleMission,SAVE_KEY}=await import('/src/campaign.js');const c=createCampaign();for(let i=0;i<5;i++)settleMission(c,i,'won');localStorage.setItem(SAVE_KEY,JSON.stringify(c));
    });
    await page.reload();assert.equal(await page.locator('.objective').count(),8);assert.equal(await page.locator('#brief-captures').textContent(),'7');
    await page.locator('#deploy').click();await page.locator('#pause').click();await page.locator('#capture5-order').click();await page.screenshot({path:'test-results/tactical-seven-captures-mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    // Native GPU equality with the optimisations disabled, including every map
    // and angle. CPU picking must invert the same shader transform.
    const native=await page.evaluate(async()=>{
      const {Renderer}=await import('/src/renderer.js');const {createGame,startGame}=await import('/src/simulation.js');
      class Full extends Renderer{
        render(...args){this.objectiveKey=null;return super.render(...args);}
        uploadMesh(mesh,buffer,key){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(mesh.length*4>this[key]){this[key]=Math.max(262144,mesh.data.byteLength);gl.bufferData(gl.ARRAY_BUFFER,this[key],gl.DYNAMIC_DRAW);}if(mesh.length)gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.view());}
      }
      const outcomes=[];
      for(let map=0;map<6;map++){
        const g=createGame(undefined,undefined,map);startGame(g);g.time=2;
        const make=Type=>{const c=document.createElement('canvas');c.width=640;c.height=400;c.getBoundingClientRect=()=>({width:640,height:400});const r=new Type(c,g);r.pixelRatio=1;r.focus({x:18,y:18},true);return r;};
        const a=make(Full),b=make(Renderer);
        for(let turn=0;turn<4;turn++){
          a.turn=b.turn=turn;a.render(g,null);b.render(g,null);
          const pixels=r=>{const data=new Uint8Array(640*400*4);r.gl.readPixels(0,0,640,400,r.gl.RGBA,r.gl.UNSIGNED_BYTE,data);if(r.gl.getError())throw Error('WebGL error');return data;};
          const pa=pixels(a),pb=pixels(b);for(let i=0;i<pa.length;i++)if(pa[i]!==pb[i])throw Error(`native mismatch: ${map}/${turn}/${i}`);
          const p=b.project(g.relay.x,g.relay.y),w=b.unproject(p.x,p.y);if(Math.hypot(w.x-g.relay.x,w.y-g.relay.y)>1e-9)throw Error('picking mismatch');
          outcomes.push({map:map+1,turn,pixelParity:true,picking:true});
        }
        for(const r of [a,b]){r.dispose();r.gl.getExtension('WEBGL_lose_context')?.loseContext();}
      }
      return outcomes;
    });
    assert.deepEqual(errors,[]);await writeFile('test-results/tactical-browser.json',JSON.stringify({manualFire:true,pauseBlurCancel:true,reservePurchasePersistence:true,mobile:true,native},null,2));
    console.log('PASS: manual fire/release/pause/blur/cancel, camera rotation, supply persistence, expanded mobile HUD, and 24 native pixel/picking comparisons.');
  }finally{await browser?.close();await new Promise(done=>server.close(done));}
})().catch(error=>{console.error(error);process.exitCode=1;});
