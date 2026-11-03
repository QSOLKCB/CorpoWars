// SPDX-License-Identifier: Apache-2.0
// Play the expansion through the packaged UI, beginning with a valid v0.3 save.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile,mkdir,writeFile}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const root=resolve('dist'),results=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=requested.replace(/^\/CorpoWars(?=\/)/,''),file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'text/plain'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});

async function pauseCheck(page,{status=false}={}){
  await page.locator('#pause').click();
  const before=await page.locator('#clock').textContent();
  const missionBefore=await page.locator('#mission-status').textContent();
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#clock').textContent(),before,'tactical pause freezes mission time');
  if(status)assert.equal(await page.locator('#mission-status').textContent(),missionBefore,'tactical pause freezes the new objective timer/status');
  await page.locator('#pause').click();
}

async function objective(page,key){
  await page.locator(`#${key}-order`).click();
  await page.waitForFunction(key=>document.getElementById(`${key}-order`).classList.contains('done')||document.getElementById('debrief').open,key,{timeout:120000});
  assert.equal(await page.locator(`#${key}-order`).evaluate(el=>el.classList.contains('done')),true,
    `${key} objective failed: ${await page.locator('#result-copy').textContent()} / ${await page.locator('#mission-status').textContent()}`);
}

async function gpuSample(page){
  const sample=await page.locator('#battlefield').evaluate(canvas=>new Promise(done=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl2'),bytes=new Uint8Array(4),values=[],colors=new Set();
    for(let y=24;y<canvas.height;y+=Math.max(1,Math.floor(canvas.height/10)))for(let x=24;x<canvas.width;x+=Math.max(1,Math.floor(canvas.width/12))){
      gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);values.push(...bytes);colors.add([...bytes].join(','));
    }
    done({values,colors:colors.size,error:gl.getError(),version:gl.getParameter(gl.VERSION)});
  })));
  assert.equal(sample.error,0);assert.ok(sample.version.includes('WebGL 2'));assert.ok(sample.colors>5,'the expansion city must render varied nonblank colour output');
  return {colors:sample.colors,digest:createHash('sha256').update(Buffer.from(sample.values)).digest('hex')};
}

(async()=>{
  let browser,page;
  try{
    const campaignModule=await import(pathToFileURL(resolve('src/campaign.js')).href);
    const {createCampaign,equip,research,settleMission,decodeCampaign,MISSIONS,RESEARCH,SAVE_KEY}=campaignModule;
    assert.equal(MISSIONS.length,6,'this regression covers the six-contract expansion');
    const legacy=createCampaign();
    for(let mission=0;mission<3;mission++)assert.equal(settleMission(legacy,mission,'won'),MISSIONS[mission].reward);
    for(let agent=0;agent<4;agent++){assert.equal(equip(legacy,agent,'aug'),true);legacy.modes[agent]=2;}
    for(const item of RESEARCH)assert.equal(research(legacy,item.id),true);
    legacy.mission=2;delete legacy.challenges;
    assert.equal(legacy.cash,2150);
    const decoded=decodeCampaign(JSON.stringify(legacy));assert.ok(decoded,'the legacy save remains accepted');
    assert.deepEqual(decoded.completed,[0,1,2]);assert.equal(decoded.cash,2150);
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const url=`http://127.0.0.1:${server.address().port}/CorpoWars/`;
    browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.addInitScript(({key,save})=>{
      // Seed once. Reload assertions must observe the game's own saved state.
      if(localStorage.getItem(key)===null)localStorage.setItem(key,save);
    },{key:SAVE_KEY,save:JSON.stringify(legacy)});
    await page.goto(url);await page.waitForFunction(()=>!document.getElementById('deploy').disabled);
    await mkdir('test-results',{recursive:true});
    await page.locator('#headquarters').click();
    assert.equal(await page.locator('#cash').textContent(),'2,150');
    assert.equal(await page.locator('.contract-card').count(),6);
    assert.equal(await page.locator('#contract-3').isEnabled(),true);
    assert.equal(await page.locator('#contract-4').isEnabled(),false);
    assert.equal(await page.locator('#contract-5').isEnabled(),false);
    await page.locator('#contract-3').click();await page.locator('#hq-ready').click();
    await page.reload();await page.waitForFunction(()=>!document.getElementById('deploy').disabled);
    assert.match(await page.locator('#operation-name').textContent(),/SIGNAL SIEGE/);
    for(let agent=0;agent<4;agent++)assert.match(await page.locator(`#agent-${agent} .weapon-name`).textContent(),/300/);
    let cash=2150;
    for(let mission=3;mission<6;mission++){
      const definition=MISSIONS[mission];
      assert.equal((await page.locator('#operation-name').textContent()).trim(),definition.name.toUpperCase());
      await page.screenshot({path:`test-results/expansion-${definition.id}-briefing.png`,fullPage:true});
      const gpu=await gpuSample(page);
      await page.locator('#deploy').click();await page.keyboard.press('q');
      await objective(page,'relay');
      await pauseCheck(page,{status:definition.kind==='lockdown'});
      if(definition.kind==='lockdown')assert.match(await page.locator('#mission-status').textContent(),/LOCKDOWN/i);
      await objective(page,'vault');
      if(definition.kind==='escort'){
        await page.locator('#escort-order').waitFor({state:'visible'});
        assert.match(await page.locator('#mission-status').textContent(),/COURIER/i);
        await page.locator('#escort-order').click();
        assert.equal(await page.locator('#escort-order').getAttribute('aria-pressed'),'true');
      }else await page.locator('#exit-order').click();
      await page.locator('#debrief').waitFor({state:'visible',timeout:120000});
      assert.match(await page.locator('#result-title').textContent(),/FULFILLED/,
        `${definition.name}: ${await page.locator('#result-copy').textContent()}`);
      assert.equal(await page.locator('#challenge-results [data-earned]').count(),3);
      const challenges={};
      for(const id of ['clean','restraint','swift'])challenges[id]=await page.locator(`#challenge-${id}`).getAttribute('data-earned')==='true';
      assert.equal(challenges.clean,true,'the funded squad extracts all four agents');
      assert.equal(challenges.restraint,true,'UI playthrough uses no medical, EMP or panic charges');
      assert.equal(challenges.swift,true,'the direct objective route beats the displayed par time');
      if(mission===5)assert.match(await page.locator('#result-copy').textContent(),/All six districts/);
      await page.screenshot({path:`test-results/expansion-${definition.id}-victory.png`,fullPage:true});
      cash+=definition.reward;
      const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
      assert.equal(saved.cash,cash);assert.deepEqual(saved.completed,Array.from({length:mission+1},(_,index)=>index));
      assert.deepEqual(saved.loadout,['aug','aug','aug','aug']);assert.deepEqual(saved.research,legacy.research);
      const recorded=saved.challenges[`${definition.id}:relaxed`];
      assert.deepEqual([...recorded].sort(),Object.keys(challenges).filter(id=>challenges[id]).sort());
      results.push({id:definition.id,kind:definition.kind,cash,challenges,gpu});
      await page.locator('#retry').click();assert.equal(await page.locator('#cash').textContent(),cash.toLocaleString('en-AU'));
      assert.equal(await page.locator('.contract-card').count(),6);
      if(mission<5)assert.equal(await page.locator(`#contract-${mission+1}`).getAttribute('aria-pressed'),'true');
      await page.locator('#hq-ready').click();
    }
    assert.equal(new Set(results.map(result=>result.gpu.digest)).size,3,'the three expansion district views are visually distinct');
    await page.reload();await page.locator('#headquarters').click();
    assert.equal(await page.locator('#cash').textContent(),'19,750');
    assert.equal(await page.locator('.contract-card:disabled').count(),0);
    assert.match(await page.locator('#contract-3 .contract-medals').textContent(),/Clean Extraction.*RELAXED/);
    await page.locator('#difficulty').selectOption('hostile');
    assert.match(await page.locator('#contract-3 .contract-medals').textContent(),/0 \/ 3 CHALLENGE BADGES.*HOSTILE/);
    await page.locator('#difficulty').selectOption('relaxed');
    assert.match(await page.locator('#contract-3 .contract-medals').textContent(),/Clean Extraction.*RELAXED/);
    // Select a completed expansion contract without granting another reward.
    await page.locator('#contract-3').click();
    assert.match(await page.locator('#contract-3').textContent(),/REPLAY/);
    const persisted=await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY);
    assert.equal(decodeCampaign(persisted).cash,cash);
    const beforeReplay=JSON.parse(persisted);
    await page.locator('#hq-ready').click();await page.locator('#deploy').click();
    await objective(page,'relay');await objective(page,'vault');await page.locator('#exit-order').click();
    await page.locator('#debrief').waitFor({state:'visible',timeout:120000});
    assert.match(await page.locator('#result-title').textContent(),/FULFILLED/);
    assert.match(await page.locator('#result-copy').textContent(),/already paid out/);
    const afterReplay=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
    assert.equal(afterReplay.cash,cash,'a completed expansion replay cannot duplicate its reward');
    assert.deepEqual(afterReplay.completed,beforeReplay.completed);
    assert.deepEqual(afterReplay.challenges,beforeReplay.challenges,'replay medals merge without duplication');
    await page.locator('#retry').click();
    assert.equal(await page.locator('#cash').textContent(),'19,750');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/expansion-mobile-contracts.png',fullPage:true});
    await page.locator('#hq-ready').click();await page.locator('#deploy').click();await page.locator('#pause').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('#mission-status').isVisible(),true);
    await page.screenshot({path:'test-results/expansion-mobile-hud.png',fullPage:true});
    assert.deepEqual(errors,[]);
    await writeFile('test-results/expansion-browser.json',JSON.stringify({legacySavePreserved:true,missions:results,allSixUnlocked:true,replayRewardUnchanged:true,mobileNoOverflow:true,browser:await browser.version()},null,2)+'\n');
    console.log('PASS: legacy v0.3 save, all 3 expansion contracts through DOM, siege/escort/lockdown, paused timers, challenge persistence, six-contract rewards/unlocks, distinct WebGL2 cities, and mobile layout.');
  }catch(error){
    if(page){
      await mkdir('test-results',{recursive:true});
      await page.screenshot({path:'test-results/expansion-failure.png',fullPage:true}).catch(()=>{});
      await writeFile('test-results/expansion-failure.json',JSON.stringify({error:String(error),results,status:await page.locator('#mission-status').textContent().catch(()=>null),phase:await page.locator('#phase').textContent().catch(()=>null),clock:await page.locator('#clock').textContent().catch(()=>null)},null,2)+'\n');
    }
    throw error;
  }finally{if(browser)await browser.close();if(server.listening)await new Promise(done=>server.close(done));}
})().catch(error=>{console.error(error);process.exitCode=1;});
