// SPDX-License-Identifier: Apache-2.0
// Original synthesised effects. No audio files, samples, or third-party music.
import { ChipMusic } from './music.js';
export class Audio {
  constructor() {this.enabled=false;this.context=null;this.lastShot=0;this.music=null;this.volume=.45;this.busy=false;}
  async unlock() {
    try {
      if(!this.context){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return false;this.context=new Context();this.music=new ChipMusic(this.context);this.music.setVolume(this.volume);}
      await this.context.resume();return this.context.state==='running';
    } catch {return false;}
  }
  async toggle() {
    if(this.busy)return this.enabled;this.busy=true;
    try {if(!await this.unlock())return false;this.enabled=!this.enabled;if(this.enabled)this.play('order');return this.enabled;}
    finally {this.busy=false;}
  }
  async toggleMusic() {
    if(this.busy)return this.music?.enabled||false;this.busy=true;
    try {if(!await this.unlock())return false;return this.music.toggle();}finally{this.busy=false;}
  }
  setVolume(value) {this.volume=value;this.music?.setVolume(value);}
  mood(value) {if(this.music&&this.music.mood!==value)this.music.setMood(value);}
  audible(value) {if(this.music&&this.music.audible!==value)this.music.setAudible(value);}
  play(type) {
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const ctx=this.context,t=ctx.currentTime;
    if(type==='shot'&&t-this.lastShot<.06)return;
    if(type==='shot')this.lastShot=t;
    const presets={shot:[150,38,.085,'sawtooth',.045],order:[432,648,.08,'sine',.055],objective:[432,864,.4,'triangle',.07],heal:[324,648,.3,'sine',.06],pulse:[180,28,.6,'sawtooth',.045],panic:[640,75,.5,'square',.025],danger:[140,85,.3,'square',.035],victory:[432,1296,.7,'triangle',.07]};
    const p=presets[type];if(!p)return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=p[3];oscillator.frequency.setValueAtTime(p[0],t);oscillator.frequency.exponentialRampToValueAtTime(p[1],t+p[2]);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(p[4],t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+p[2]);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(t);oscillator.stop(t+p[2]+.02);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
