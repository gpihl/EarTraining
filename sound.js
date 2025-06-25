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

  function createReverb(ctx, seconds=2, decay=2){
    const length = ctx.sampleRate * seconds;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for(let c=0;c<impulse.numberOfChannels;c++){
      const data = impulse.getChannelData(c);
      for(let i=0;i<length;i++){
        data[i] = (Math.random()*2-1) * Math.pow(1 - i/length, decay);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  class SequencePlayer {
    constructor(opts={}){
      this.attack = opts.attack || 0.01;
      this.release = opts.release || 0.01;
      this.overtoneAmps = opts.overtoneAmps || [0.12,0.05,0.03];
      this.reverbWet = opts.reverbWet || 0;
      this.reverbSeconds = opts.reverbSeconds || 2;
      this.reverbDecay = opts.reverbDecay || 2;
    }
    playSequence(freqs, dur=0.8, gap=0.1){
      if(!freqs || !freqs.length) return;
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const convolver = this.reverbWet>0 ? createReverb(ctx,this.reverbSeconds,this.reverbDecay) : null;
      let wetGain=null;
      if(convolver){
        wetGain=ctx.createGain();
        wetGain.gain.value=this.reverbWet;
        convolver.connect(wetGain);
        wetGain.connect(ctx.destination);
      }
      let t = ctx.currentTime;
      freqs.forEach(f=>{
        this._playOne(ctx,f,t,dur,convolver);
        t += dur + gap;
      });
      const endTime=t-gap;
      const extra=this.reverbWet>0?this.reverbSeconds:0;
      setTimeout(()=>{try{ctx.close();}catch(e){}},(endTime-ctx.currentTime+extra+0.05)*1000);
    }
    _playOne(ctx,freq,start,dur,convolver){
      const stop=start+dur;
      const main=ctx.createGain();
      main.connect(ctx.destination);
      if(convolver){
        main.connect(convolver);
      }
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
      this.reverbWet = opts.reverbWet || 0;
      this.reverbSeconds = opts.reverbSeconds || 2;
      this.reverbDecay = opts.reverbDecay || 2;
      this.ctx=null;this.gain=null;this.oscillators=[];this.stopTimeout=null;this.isFadingOut=false;
      this.reverbNode=null;this.wetGain=null;
      this.currentFreqs=null;
    }

  _immediateCleanup(){
      if(!this.ctx) return;
      if(this.stopTimeout){clearTimeout(this.stopTimeout);this.stopTimeout=null;}
      this.oscillators.forEach(o=>{try{o.stop();}catch(e){}});
      const ctx=this.ctx;
      try{ctx.close();}catch(e){}
      this.ctx=null;this.gain=null;this.oscillators=[];this.reverbNode=null;this.wetGain=null;
      this.isFadingOut=false;
      this.currentFreqs=null;
  }
    start(freqs){
      if(!freqs || !freqs.length) return;
      const same=this.currentFreqs && this.currentFreqs.length===freqs.length && this.currentFreqs.every((f,i)=>f===freqs[i]);
      if(this.ctx){
        if(same){
          if(this.isFadingOut){
            if(this.stopTimeout){clearTimeout(this.stopTimeout);this.stopTimeout=null;}
            this.isFadingOut=false;
            const n=this.ctx.currentTime;
            this.gain.gain.cancelScheduledValues(n);
            this.gain.gain.setValueAtTime(Math.max(this.gain.gain.value,0.0001),n);
            this.gain.gain.exponentialRampToValueAtTime(1,n+this.attack);
          }
          return;
        }
        this._immediateCleanup();
      }
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      const n=this.ctx.currentTime;
      this.gain=this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      if(this.reverbWet>0){
        this.reverbNode=createReverb(this.ctx,this.reverbSeconds,this.reverbDecay);
        this.wetGain=this.ctx.createGain();
        this.wetGain.gain.value=this.reverbWet;
        this.reverbNode.connect(this.wetGain);
        this.wetGain.connect(this.ctx.destination);
        this.gain.connect(this.reverbNode);
      }
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
      this.currentFreqs=freqs.slice();
    }
    stop(immediate=false){
      if(!this.ctx) return;
      if(immediate){
        this._immediateCleanup();
        return;
      }
      const n=this.ctx.currentTime;
      this.isFadingOut=true;
      this.gain.gain.cancelScheduledValues(n);
      this.gain.gain.setValueAtTime(this.gain.gain.value,n);
      this.gain.gain.exponentialRampToValueAtTime(0.0001,n+this.release);
      if(this.stopTimeout) clearTimeout(this.stopTimeout);
      const ctx=this.ctx, oscs=this.oscillators;
      const extra=this.reverbWet>0?this.reverbSeconds:0;
      this.stopTimeout=setTimeout(()=>{
        oscs.forEach(o=>{try{o.stop();}catch(e){}});
        try{ctx.close();}catch(e){}
        if(this.ctx===ctx){this.ctx=null;this.gain=null;this.oscillators=[];this.reverbNode=null;this.wetGain=null;this.currentFreqs=null;}
        this.stopTimeout=null;this.isFadingOut=false;},(this.release+extra+0.05)*1000);
    }
  }

  window.Sound={SequencePlayer,ChordPlayer};
})();
