// SPDX-License-Identifier: Apache-2.0
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');
const assert = require('node:assert/strict');
const root=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try {
    const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=requested.replace(/^\/CorpoWars(?=\/)/,''),file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'text/plain'});res.end(body);
  } catch {res.writeHead(404);res.end();}
});
(async()=>{
  let browser;
  try {
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const url=`http://127.0.0.1:${server.address().port}/CorpoWars/`;
    browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    await page.goto(url);await page.waitForFunction(()=>!document.getElementById('deploy').disabled);
    await mkdir('test-results',{recursive:true});
    assert.equal(await page.locator('#graphics-error').isVisible(),false);
    await page.locator('#headquarters').click();assert.equal(await page.locator('#cash').textContent(),'6,000');
    await page.locator('#equip-0-aug').click();await page.locator('#equip-1-owen').click();await page.locator('#equip-2-shotgun').click();
    await page.getByLabel('VEX AUG starting mode').selectOption('2');
    assert.equal(await page.locator('#cash').textContent(),'2,950');
    await page.locator('#tab-research').click();assert.equal(await page.locator('#research-med2').isEnabled(),false);
    await page.locator('#research-med1').click();await page.locator('#research-head').click();
    assert.equal(await page.locator('#research-arms').isEnabled(),true);
    await page.locator('#research-panic1').click();assert.equal(await page.locator('#cash').textContent(),'500');
    assert.equal(await page.locator('#research-torso').isEnabled(),false);
    await page.locator('#difficulty').selectOption('hostile');await page.screenshot({path:'test-results/research.png',fullPage:true});
    await page.reload();await page.locator('#headquarters').click();assert.equal(await page.locator('#cash').textContent(),'500');
    assert.equal(await page.locator('#difficulty').inputValue(),'hostile');
    await page.locator('#difficulty').selectOption('relaxed');await page.locator('#hq-ready').click();
    assert.match(await page.locator('#agent-0 .weapon-name').textContent(),/300/);
    await page.locator('#music').click();assert.equal(await page.locator('#music').getAttribute('aria-pressed'),'true');
    await page.locator('#music-volume').fill('25');await page.locator('#music').click();
    assert.equal(await page.locator('#music').getAttribute('aria-pressed'),'false');
    // Render the actual synthesiser offline to verify non-silent, finite PCM.
    const pcm=await page.evaluate(async()=>{
      const {ChipMusic,musicStep}=await import('./src/music.js');
      const ctx=new OfflineAudioContext(1,44100*3,44100),music=new ChipMusic(ctx);
      music.enabled=true;music.gain();
      for(let step=0;step<16;step++)for(const note of musicStep(step,'combat'))music.note(note,step*.125);
      const buffer=await ctx.startRendering(),samples=buffer.getChannelData(0);
      let peak=0,energy=0,finite=true;for(const sample of samples){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;finite&&=Number.isFinite(sample);}
      return {peak,rms:Math.sqrt(energy/samples.length),finite};
    });
    assert.ok(pcm.finite&&pcm.peak<1&&pcm.rms>.005,JSON.stringify(pcm));
    const pixels=await page.locator('#battlefield').evaluate(canvas=>new Promise(done=>requestAnimationFrame(()=>{
      const gl=canvas.getContext('webgl2'),p=new Uint8Array(4),colors=new Set();
      for(let y=50;y<canvas.height;y+=80)for(let x=50;x<canvas.width;x+=80){gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);colors.add([...p].join(','));}
      done({colors:colors.size,error:gl.getError(),version:gl.getParameter(gl.VERSION)});
    })));
    assert.equal(pixels.error,0);assert.ok(pixels.version.includes('WebGL 2'));assert.ok(pixels.colors>5,JSON.stringify(pixels));
    // The whole desktop HUD, including radar, fits without scrolling.
    const hud=await page.evaluate(()=>{
      const radar=document.getElementById('minimap').getBoundingClientRect(),field=document.getElementById('battlefield').getBoundingClientRect(),squad=document.querySelector('.squad-bar').getBoundingClientRect();
      return {topLeft:radar.left<field.left+180&&radar.top<field.top+50,inView:radar.bottom<innerHeight&&squad.bottom<=innerHeight,noOverflow:document.documentElement.scrollWidth<=innerWidth};
    });assert.deepEqual(hud,{topLeft:true,inView:true,noOverflow:true});
    await page.screenshot({path:'test-results/briefing-v030.png',fullPage:true});
    for(let mission=0;mission<3;mission++) {
      await page.locator('#deploy').press('Space');
      if(mission===0) {
        await page.locator('#pause').click();const clock=await page.locator('#clock').textContent();
        await page.waitForTimeout(350);assert.equal(await page.locator('#clock').textContent(),clock);
        await page.locator('#agent-0').click();await page.locator('#aug-mode').click();
        assert.match(await page.locator('#agent-0 .weapon-name').textContent(),/223/);
        assert.match(await page.locator('#agent-0 .health-text').textContent(),/RELOAD/);
        const left=()=>page.locator('.world-label').first().evaluate(el=>parseFloat(el.style.left));
        const before=await left();await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');
        assert.ok(await left()<before-40,'D must pan right');
        await page.keyboard.down('a');await page.waitForTimeout(200);await page.keyboard.up('a');
        assert.equal(await page.locator('#agent-1').getAttribute('aria-pressed'),'false','A must pan, not select all');
        const button=await page.locator('#pan-right').boundingBox(),mouseBefore=await left();
        await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();await page.waitForTimeout(250);await page.mouse.up();
        assert.ok(await left()<mouseBefore-30,'Mouse arrow must pan continuously');
        await page.keyboard.press('q');assert.equal(await page.locator('#agent-1').getAttribute('aria-pressed'),'true');
        await page.locator('#panic').click();assert.equal(await page.locator('#panic').getAttribute('aria-pressed'),'true');
        await page.locator('#pause').click();
      }
      await page.locator('#relay-order').click();
      await page.waitForFunction(()=>document.getElementById('relay-order').classList.contains('done'),null,{timeout:60000});
      await page.locator('#vault-order').click();
      await page.waitForFunction(()=>document.getElementById('vault-order').classList.contains('done'),null,{timeout:60000});
      if(mission===0){await page.locator('#cutaway').click();await page.screenshot({path:'test-results/gameplay-v030.png',fullPage:true});await page.locator('#cutaway').click();}
      await page.locator('#exit-order').click();await page.locator('#debrief').waitFor({state:'visible',timeout:60000});
      assert.match(await page.locator('#result-title').textContent(),/FULFILLED/);
      await page.screenshot({path:`test-results/victory-${mission+1}.png`,fullPage:true});
      await page.locator('#retry').click();
      assert.equal(await page.locator('#cash').textContent(),['2,900','6,100','10,100'][mission]);
      await page.locator('#hq-ready').click();
    }
    await page.reload();await page.locator('#headquarters').click();assert.equal(await page.locator('#cash').textContent(),'10,100');
    await page.setViewportSize({width:390,height:844});
    await page.locator('#tab-research').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/mobile-research.png',fullPage:true});
    await page.locator('#hq-ready').click();await page.locator('#deploy').click();await page.locator('#pause').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/mobile-gameplay.png',fullPage:true});
    await page.locator('#help').click();assert.ok(await page.locator('#manual').isVisible());
    await page.getByRole('button',{name:'RETURN TO OPERATION'}).click();assert.equal(await page.locator('#manual').isVisible(),false);
    // Storage failures must not block a new campaign or a purchase.
    const noStorage=await browser.newPage();
    await noStorage.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw new Error('disabled');};});
    await noStorage.goto(url);await noStorage.locator('#headquarters').click();await noStorage.locator('#equip-0-owen').click();
    assert.equal(await noStorage.locator('#cash').textContent(),'5,300');assert.match(await noStorage.locator('#save-status').textContent(),/unavailable/);
    // Recreated renderer resources must display the same paused operation after
    // context restoration, then continue through the normal resume control.
    const restored=await browser.newPage(),restoreErrors=[];
    restored.on('pageerror',error=>restoreErrors.push(String(error)));
    await restored.goto(url);await restored.locator('#deploy').click();await restored.locator('#pause').click();
    await restored.evaluate(()=>{
      const gl=document.getElementById('battlefield').getContext('webgl2');
      window.loseExtension=gl.getExtension('WEBGL_lose_context');
      if(!window.loseExtension)throw Error('Context-loss extension unavailable');
      window.loseExtension.loseContext();
    });
    await restored.locator('#graphics-error').waitFor({state:'visible'});
    await restored.evaluate(()=>window.loseExtension.restoreContext());
    await restored.locator('#graphics-error').waitFor({state:'hidden'});
    assert.equal(await restored.locator('#pause-banner').isVisible(),true);
    await restored.locator('#pause').click();assert.equal(await restored.locator('#pause-banner').isVisible(),false);
    assert.deepEqual(restoreErrors,[]);await restored.close();
    const unsupported=await browser.newPage();
    await unsupported.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
    await unsupported.goto(url);await unsupported.locator('#graphics-error').waitFor({state:'visible'});assert.equal(await unsupported.locator('#deploy').isEnabled(),false);
    assert.deepEqual(errors,[]);console.log('PASS: WebGL2 output, all 3 contracts, budget and research, persistent equipment/difficulty, WASD and mouse camera, fixed HUD, AUG, panic, mobile, audio PCM, and storage/GPU fallback.');
    console.log('Audio render:',JSON.stringify(pcm));
  } finally {if(browser)await browser.close();await new Promise(done=>server.close(done));}
})().catch(error=>{console.error(error);process.exitCode=1;});
