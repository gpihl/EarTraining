(function () {
  function createOvertoneOsc(context, baseFreq, multiplier, amplitude, destination) {
    const gainNode = context.createGain();
    gainNode.gain.value = amplitude;
    gainNode.connect(destination);

    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = baseFreq * multiplier;
    oscillator.connect(gainNode);
    return oscillator;
  }

  function createReverb(context, seconds = 2, decay = 2) {
    const length = context.sampleRate * seconds;
    const impulse = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index++) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, decay);
      }
    }

    const convolver = context.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  class SequencePlayer {
    constructor(options = {}) {
      this.attack = options.attack || 0.01;
      this.release = options.release || 0.01;
      this.overtoneAmps = options.overtoneAmps || [0.12, 0.05, 0.03];
      this.reverbWet = options.reverbWet || 0;
      this.reverbSeconds = options.reverbSeconds || 2;
      this.reverbDecay = options.reverbDecay || 2;
    }

    playSequence(frequencies, duration = 0.8, gap = 0.1) {
      if (!frequencies || frequencies.length === 0) {
        return;
      }

      const context = new (window.AudioContext || window.webkitAudioContext)();
      const convolver = this.reverbWet > 0
        ? createReverb(context, this.reverbSeconds, this.reverbDecay)
        : null;

      let wetGain = null;
      if (convolver) {
        wetGain = context.createGain();
        wetGain.gain.value = this.reverbWet;
        convolver.connect(wetGain);
        wetGain.connect(context.destination);
      }

      let time = context.currentTime;
      frequencies.forEach((frequency) => {
        this._playOne(context, frequency, time, duration, convolver);
        time += duration + gap;
      });

      const endTime = time - gap;
      const extra = this.reverbWet > 0 ? this.reverbSeconds : 0;
      const waitTime = (endTime - context.currentTime + extra + 0.05) * 1000;

      setTimeout(() => {
        try {
          context.close();
        } catch (err) {
          // ignore
        }
      }, waitTime);
    }

    _playOne(context, frequency, start, duration, convolver) {
      const stop = start + duration;
      const mainGain = context.createGain();

      mainGain.connect(context.destination);
      if (convolver) {
        mainGain.connect(convolver);
      }

      mainGain.gain.setValueAtTime(0, start);
      mainGain.gain.linearRampToValueAtTime(1, start + this.attack);
      mainGain.gain.linearRampToValueAtTime(0, stop - this.release);

      const oscillators = this.overtoneAmps.map((amp, index) => {
        return createOvertoneOsc(context, frequency, index + 1, amp, mainGain);
      });

      oscillators.forEach((oscillator) => {
        oscillator.start(start);
        oscillator.stop(stop);
      });
    }
  }

  class ChordPlayer {
    constructor(options = {}) {
      this.attack = options.attack || 0.3;
      this.release = options.release || 0.7;
      this.overtoneAmps = options.overtoneAmps || [0.12, 0.05, 0.03];
      this.reverbWet = options.reverbWet || 0;
      this.reverbSeconds = options.reverbSeconds || 2;
      this.reverbDecay = options.reverbDecay || 2;

      this.lowestMidi = options.lowestMidi || 36;  // C2
      this.highestMidi = options.highestMidi || 96; // C7

      this.context = null;
      this.gain = null;
      this.noteFreqs = [];
      this.noteGains = [];
      this.noteOscillators = [];
      this.stopTimeout = null;
      this.isFadingOut = false;

      this.reverbNode = null;
      this.wetGain = null;
      this.currentFreqs = null;

      this._setupContext();
    }

    _setupContext() {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);

      if (this.reverbWet > 0) {
        this.reverbNode = createReverb(this.context, this.reverbSeconds, this.reverbDecay);
        this.wetGain = this.context.createGain();
        this.wetGain.gain.value = this.reverbWet;
        this.reverbNode.connect(this.wetGain);
        this.wetGain.connect(this.context.destination);
        this.gain.connect(this.reverbNode);
      }

      const noteCount = this.highestMidi - this.lowestMidi + 1;
      for (let i = 0; i < noteCount; i++) {
        const midi = this.lowestMidi + i;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        this.noteFreqs.push(freq);

        const gains = [];
        const oscs = [];
        this.overtoneAmps.forEach((amp, idx) => {
          const gain = this.context.createGain();
          gain.gain.value = 0;
          gain.connect(this.gain);

          const osc = this.context.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq * (idx + 1);
          osc.connect(gain);
          osc.start();

          gains.push(gain);
          oscs.push(osc);
        });

        this.noteGains.push(gains);
        this.noteOscillators.push(oscs);
      }

      this.gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    }

    _immediateCleanup() {
      if (!this.context) {
        return;
      }

      if (this.stopTimeout) {
        clearTimeout(this.stopTimeout);
        this.stopTimeout = null;
      }

      this.noteOscillators.forEach((arr) => {
        arr.forEach((osc) => {
          try {
            osc.stop();
          } catch (err) {
            // ignore
          }
        });
      });

      const context = this.context;
      try {
        context.close();
      } catch (err) {
        // ignore
      }

      this.context = null;
      this.gain = null;
      this.noteFreqs = [];
      this.noteGains = [];
      this.noteOscillators = [];
      this.reverbNode = null;
      this.wetGain = null;
      this.isFadingOut = false;
      this.currentFreqs = null;
    }

    start(frequencies) {
      if (!frequencies || frequencies.length === 0) {
        return;
      }

      if (!this.context) {
        this._setupContext();
      }

      const same =
        this.currentFreqs &&
        this.currentFreqs.length === frequencies.length &&
        this.currentFreqs.every((freq, index) => freq === frequencies[index]);

      const now = this.context.currentTime;

      if (same) {
        if (this.isFadingOut) {
          if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
          }
          this.isFadingOut = false;
          this.gain.gain.cancelScheduledValues(now);
          this.gain.gain.setValueAtTime(Math.max(this.gain.gain.value, 0.0001), now);
          this.gain.gain.exponentialRampToValueAtTime(1, now + this.attack);
        }
      } else {
        this.noteGains.forEach((arr) => {
          arr.forEach((gain) => {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(0, now);
          });
        });

        frequencies.forEach((frequency) => {
          const idx = this.noteFreqs.indexOf(frequency);
          if (idx !== -1) {
            this.noteGains[idx].forEach((gain, i) => {
              gain.gain.setValueAtTime(this.overtoneAmps[i], now);
            });
          }
        });

        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(Math.max(this.gain.gain.value, 0.0001), now);
        this.gain.gain.exponentialRampToValueAtTime(1, now + this.attack);

        this.currentFreqs = frequencies.slice();
      }
    }

    stop(immediate = false) {
      if (!this.context) {
        return;
      }

      const now = this.context.currentTime;

      if (immediate) {
        if (this.stopTimeout) {
          clearTimeout(this.stopTimeout);
          this.stopTimeout = null;
        }

        this.noteGains.forEach((arr) => {
          arr.forEach((gain) => {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(0, now);
          });
        });

        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(0.0001, now);

        this.isFadingOut = false;
        this.currentFreqs = null;
        return;
      }

      this.isFadingOut = true;

      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.exponentialRampToValueAtTime(0.0001, now + this.release);

      this.noteGains.forEach((arr) => {
        arr.forEach((gain) => {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + this.release);
        });
      });

      if (this.stopTimeout) {
        clearTimeout(this.stopTimeout);
      }

      const extra = this.reverbWet > 0 ? this.reverbSeconds : 0;
      const wait = (this.release + extra + 0.05) * 1000;

      this.stopTimeout = setTimeout(() => {
        this.noteGains.forEach((arr) => {
          arr.forEach((gain) => {
            gain.gain.setValueAtTime(0, this.context.currentTime);
          });
        });
        this.isFadingOut = false;
        this.stopTimeout = null;
        this.currentFreqs = null;
      }, wait);
    }
  }

  window.Sound = { SequencePlayer, ChordPlayer };
})();
