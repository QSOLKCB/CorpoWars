// SPDX-License-Identifier: Apache-2.0
// Original tracker composition: integer-indexed arpeggios, Euclidean accents,
// pulse lead, triangle bass and synthesised drums. No sampled or quoted music.
export const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
export function musicStep(step, mood = 'briefing') {
  const bar=Math.floor(step/16),s=step%16,root=[40,36,43,38,40,43,36,38][bar%8];
  const chord=[0,3,7,10],notes=[],combat=mood==='combat';
  const add=(voice,midi,length,level)=>notes.push({voice,midi,length,level});
  // Bit reversal yields a repeating, non-linear sweep through each chord.
  const index=((s&1)<<1)|((s>>1)&1);
  if(mood!=='paused'||s%2===0)add('arp',root+24+chord[index]+(s>=8?12:0),.095,combat?.030:.022);
  if(s%4===0||combat&&s%4===3)add('bass',root+(s===12?7:0),.20,.075);
  if(mood!=='briefing'&&mood!=='paused') {
    const melody=[7,10,12,7,3,0,10,14];
    if(s%2===0)add('lead',root+24+melody[(Math.floor(s/2)+bar*3)%8],.18,combat?.042:.025);
  }
  if(mood!=='paused') {
    if(s%4===0||combat&&s===14)add('kick',0,.16,.16);
    if(s===4||s===12)add('snare',0,.12,combat?.055:.035);
    if((s*5)%16<7)add('hat',0,.035,.025);
  }
  return notes;
}

export class ChipMusic {
  constructor(context) {
    this.context=context;this.enabled=false;this.audible=true;this.volume=.45;this.mood='briefing';this.step=0;this.timer=null;
    this.output=context.createGain();this.output.gain.value=0;this.output.connect(context.destination);
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.25),context.sampleRate),data=buffer.getChannelData(0);
    let seed=2091;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
    this.noise=buffer;
  }
  gain() {this.output.gain.setTargetAtTime(this.enabled&&this.audible?this.volume*(this.mood==='paused'?.35:1):0,this.context.currentTime,.025);}
  setVolume(value) {this.volume=Math.max(0,Math.min(1,value));this.gain();}
  setMood(value) {this.mood=value;this.gain();}
  setAudible(value) {
    this.audible=value;this.gain();
    if(!value){clearInterval(this.timer);this.timer=null;}
    else if(this.enabled&&!this.timer)this.startScheduler();
  }
  toggle() {
    this.enabled=!this.enabled;this.gain();
    if(this.enabled&&this.audible)this.startScheduler();else{clearInterval(this.timer);this.timer=null;}
    return this.enabled;
  }
  startScheduler() {
    clearInterval(this.timer);this.next=this.context.currentTime+.04;
    const schedule=()=>{
      if(this.context.state!=='running')return;
      const now=this.context.currentTime;
      // Discard missed beats after a suspended tab, never burst through backlog.
      if(this.next<now)this.next=now+.02;
      while(this.next<now+.12) {
        for(const note of musicStep(this.step++,this.mood))this.note(note,this.next);
        this.next+=60/(this.mood==='combat'?138:120)/4;
      }
    };
    schedule();this.timer=setInterval(schedule,25);
  }
  note(note,time) {
    const ctx=this.context,gain=ctx.createGain(),noise=note.voice==='hat'||note.voice==='snare';
    const source=noise?ctx.createBufferSource():ctx.createOscillator();
    let filter;
    if(noise) {
      source.buffer=this.noise;filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=note.voice==='hat'?7000:1600;source.connect(filter);filter.connect(gain);
    } else {
      source.type=note.voice==='bass'||note.voice==='kick'?'triangle':'square';
      source.frequency.setValueAtTime(note.voice==='kick'?135:frequency(note.midi),time);
      if(note.voice==='kick')source.frequency.exponentialRampToValueAtTime(38,time+note.length);
      source.connect(gain);
    }
    gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(note.level,time+.005);gain.gain.exponentialRampToValueAtTime(.0001,time+note.length);
    gain.connect(this.output);source.start(time);source.stop(time+note.length+.01);
    source.onended=()=>{source.disconnect();filter?.disconnect();gain.disconnect();};
  }
}
