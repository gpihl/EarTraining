(function(){
  function createOvertoneOsc(ctx, freq, multiplier, amp, destination){
    const g = ctx.createGain();
    g.gain.value = amp;
    g.connect(destination);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * multiplier;
    o.connect(g);
    return o;
  }

  class SequencePlayer {
    constructor(opts={}){
      this.attack = opts.attack || 0.01;
      this.release = opts.release || 0.01;
      this.overtoneAmps = opts.overtoneAmps || [0.12,0.05,0.03];
    }
    playSequence(freqs, dur=0.8, gap=0.1){
      if(!freqs || !freqs.length) return;
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      let t = ctx.currentTime;
      freqs.forEach(f=>{
        this._playOne(ctx,f,t,dur);
        t += dur + gap;
      });
    }
    _playOne(ctx,freq,start,dur){
      const stop=start+dur;
      const main=ctx.createGain();
      main.connect(ctx.destination);
      main.gain.setValueAtTime(0,start);
      main.gain.linearRampToValueAtTime(1,start+this.attack);
      main.gain.linearRampToValueAtTime(0,stop-this.release);
      const oscs=this.overtoneAmps.map((a,i)=>createOvertoneOsc(ctx,freq,i+1,a,main));
      oscs.forEach(o=>{o.start(start);o.stop(stop);});
    }
  }

  class ChordPlayer {
    constructor(opts={}){
      this.attack = opts.attack || 0.3;
      this.release = opts.release || 0.7;
      this.overtoneAmps = opts.overtoneAmps || [0.12,0.05,0.03];
      this.ctx=null;this.gain=null;this.oscillators=[];this.stopTimeout=null;this.isFadingOut=false;
    }
    start(freqs){
      if(!freqs || !freqs.length) return;
      if(this.ctx && this.isFadingOut){
        if(this.stopTimeout){clearTimeout(this.stopTimeout);this.stopTimeout=null;}
        this.isFadingOut=false;
        const n=this.ctx.currentTime;
        this.gain.gain.cancelScheduledValues(n);
        this.gain.gain.setValueAtTime(Math.max(this.gain.gain.value,0.0001),n);
        this.gain.gain.exponentialRampToValueAtTime(1,n+this.attack);
        return;
      }
      this.stop();
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      const n=this.ctx.currentTime;
      this.gain=this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.gain.gain.setValueAtTime(0.0001,n);
      this.gain.gain.exponentialRampToValueAtTime(1,n+this.attack);
      this.oscillators=[];
      freqs.forEach(f=>{
        this.overtoneAmps.forEach((a,i)=>{
          const o=createOvertoneOsc(this.ctx,f,i+1,a,this.gain);
          o.start(n);
          this.oscillators.push(o);
        });
      });
    }
    stop(){
      if(!this.ctx) return;
      const n=this.ctx.currentTime;
      this.isFadingOut=true;
      this.gain.gain.cancelScheduledValues(n);
      this.gain.gain.setValueAtTime(this.gain.gain.value,n);
      this.gain.gain.exponentialRampToValueAtTime(0.0001,n+this.release);
      if(this.stopTimeout) clearTimeout(this.stopTimeout);
      const ctx=this.ctx, oscs=this.oscillators; 
      this.stopTimeout=setTimeout(()=>{
        oscs.forEach(o=>{try{o.stop();}catch(e){}});
        try{ctx.close();}catch(e){}
        if(this.ctx===ctx){this.ctx=null;this.gain=null;this.oscillators=[];}
        this.stopTimeout=null;this.isFadingOut=false;},(this.release+0.05)*1000);
    }
  }

  window.Sound={SequencePlayer,ChordPlayer};
})();
