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
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'text/plain'});res.end(body);
  } catch {res.writeHead(404);res.end();}
});
(async()=>{
  let browser;
  try {
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const url=`http://127.0.0.1:${server.address().port}`;
    // Software WebGL is confined to the ephemeral CI browser; no user settings change.
    browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    await page.goto(url);await page.waitForFunction(()=>!document.getElementById('deploy').disabled);
    assert.equal(await page.locator('#graphics-error').isVisible(),false);
    await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/briefing.png',fullPage:true});
    // Verify actual rendered colour variation, not just successful context creation.
    const pixels=await page.locator('#battlefield').evaluate(canvas=>new Promise(done=>requestAnimationFrame(()=>{
      const gl=canvas.getContext('webgl2'),p=new Uint8Array(4),colors=new Set();
      for(let y=50;y<canvas.height;y+=80)for(let x=50;x<canvas.width;x+=80){gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);colors.add([...p].join(','));}
      done({colors:colors.size,error:gl.getError(),version:gl.getParameter(gl.VERSION)});
    })));
    assert.equal(pixels.error,0);assert.ok(pixels.version.includes('WebGL 2'));assert.ok(pixels.colors>5,`Blank or flat scene: ${JSON.stringify(pixels)}`);
    await page.locator('#deploy').click();await page.locator('#pause').click();
    assert.equal(await page.locator('#pause-banner').isVisible(),true);
    const clock=await page.locator('#clock').textContent();await page.waitForTimeout(1100);assert.equal(await page.locator('#clock').textContent(),clock);
    await page.locator('#agent-1').click();assert.equal(await page.locator('#agent-0').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#agent-1').getAttribute('aria-pressed'),'true');
    await page.locator('#select-all').click();await page.locator('#relay-order').click();await page.locator('#pause').click();
    await page.waitForFunction(()=>document.getElementById('relay-order').classList.contains('done'),null,{timeout:45000});
    await page.locator('#vault-order').click();await page.waitForFunction(()=>document.getElementById('vault-order').classList.contains('done'),null,{timeout:60000});
    await page.screenshot({path:'test-results/ledger-secured.png',fullPage:true});
    await page.locator('#exit-order').click();await page.locator('#debrief').waitFor({state:'visible',timeout:60000});
    assert.match(await page.locator('#result-title').textContent(),/FULFILLED/);await page.screenshot({path:'test-results/victory.png',fullPage:true});
    await page.locator('#retry').click();await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('#deploy').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/mobile.png',fullPage:true});
    await page.locator('#deploy').click();await page.locator('#help').click();assert.ok(await page.locator('#manual').isVisible());
    await page.getByRole('button',{name:'RETURN TO OPERATION'}).click();assert.equal(await page.locator('#manual').isVisible(),false);
    // Explicitly test the unsupported-GPU page without changing the running browser's settings.
    const unsupported=await browser.newPage();
    await unsupported.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
    await unsupported.goto(url);await unsupported.locator('#graphics-error').waitFor({state:'visible'});assert.equal(await unsupported.locator('#deploy').isEnabled(),false);
    assert.deepEqual(errors,[]);console.log('PASS: WebGL2 pixels, complete combat mission, pause, selection, mobile layout, help, restart, and unsupported-GPU UX.');
  } finally {if(browser)await browser.close();await new Promise(done=>server.close(done));}
})().catch(error=>{console.error(error);process.exitCode=1;});
