// SPDX-License-Identifier: Apache-2.0
// Original synthesised effects. No audio files, samples, or third-party music.
export class Audio {
  constructor() {this.enabled=false;this.context=null;this.lastShot=0;}
  async toggle() {
    if(!this.context) {const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return false;this.context=new Context();}
    try {await this.context.resume();this.enabled=!this.enabled;if(this.enabled)this.play('order');return this.enabled;} catch {this.enabled=false;return false;}
  }
  play(type) {
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const ctx=this.context,t=ctx.currentTime;
    if(type==='shot'&&t-this.lastShot<.06)return;
    if(type==='shot')this.lastShot=t;
    const presets={shot:[150,38,.085,'sawtooth',.045],order:[432,648,.08,'sine',.055],objective:[432,864,.4,'triangle',.07],heal:[324,648,.3,'sine',.06],pulse:[180,28,.6,'sawtooth',.045],danger:[140,85,.3,'square',.035],victory:[432,1296,.7,'triangle',.07]};
    const p=presets[type];if(!p)return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=p[3];oscillator.frequency.setValueAtTime(p[0],t);oscillator.frequency.exponentialRampToValueAtTime(p[1],t+p[2]);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(p[4],t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+p[2]);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(t);oscillator.stop(t+p[2]+.02);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
