'use client';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private speechMuted: boolean = false;
  private partyOscillatorInterval: any = null;
  private isPartyPlaying: boolean = false;

  private initCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isPartyPlaying) {
      this.stopPartyMusic();
    }
  }

  public setSpeechMuted(muted: boolean) {
    this.speechMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsSpeechMuted(): boolean {
    return this.speechMuted;
  }

  // --- Procedural Web Audio Sound Effects ---

  // Elevator ding (Two harmonic chime tones)
  public playElevatorChime() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // High note then low note: 587.33Hz (D5) -> 440Hz (A4)
    [
      { freq: 587.33, start: 0, dur: 0.8 },
      { freq: 440.0, start: 0.18, dur: 1.0 },
    ].forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  }

  // Door Knock ("TOC TOC")
  public playDoorKnock() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.14].forEach((time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now + time);
      osc.frequency.exponentialRampToValueAtTime(60, now + time + 0.06);

      gain.gain.setValueAtTime(0.3, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + 0.08);
    });
  }

  // Footstep soft tap
  public playFootstep() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Small gift (Rose / Coin chime)
  public playGiftChime() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Pleasant 3-note ascending arpeggio (C6, E6, G6)
    [1046.5, 1318.5, 1567.98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  // Large Gift / Fanfare
  public playBigGiftFanfare() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Heroic brass chord
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.8);
    });
  }

  // Room upgrade sound
  public playUpgrade() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.07;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  // Alarm siren (Fire or destruction)
  public playAlarm() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.linearRampToValueAtTime(950, now + 0.25);
    osc.frequency.linearRampToValueAtTime(700, now + 0.5);
    osc.frequency.linearRampToValueAtTime(950, now + 0.75);
    osc.frequency.linearRampToValueAtTime(700, now + 1.0);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  // Thunder / Lightning
  public playThunder() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Low rumble noise synthesis using frequency sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.4);
  }

  // Powerful building explosion sound (shattering bricks & debris)
  public playExplosion() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Deep sub-bass boom
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 1.2);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.2);

    // Crunching blast distortion
    const blastOsc = ctx.createOscillator();
    const blastGain = ctx.createGain();
    blastOsc.type = 'sawtooth';
    blastOsc.frequency.setValueAtTime(280, now);
    blastOsc.frequency.exponentialRampToValueAtTime(35, now + 0.9);
    blastGain.gain.setValueAtTime(0.4, now);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    blastOsc.connect(blastGain);
    blastGain.connect(ctx.destination);
    blastOsc.start(now);
    blastOsc.stop(now + 0.9);
  }

  // Heavy concrete impact when upper floors crash down
  public playHeavySlam() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Cartoon tumble / stumble sound for falling characters
  public playStumble() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.4);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Blackout power down
  public playPowerDown() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  }

  // Resident eviction sad slide
  public playEvict() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.4);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  // Party mode rhythmic beat
  public startPartyMusic() {
    if (this.isPartyPlaying || this.isMuted) return;
    this.isPartyPlaying = true;
    let step = 0;

    const playBassNote = () => {
      if (!this.isPartyPlaying || this.isMuted) return;
      const ctx = this.initCtx();
      if (!ctx) return;

      const now = ctx.currentTime;
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();

      const freqs = [130.81, 146.83, 164.81, 174.61]; // C3, D3, E3, F3
      const freq = freqs[step % freqs.length];

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(freq, now);

      bassGain.gain.setValueAtTime(0.12, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);

      bassOsc.start(now);
      bassOsc.stop(now + 0.18);
      step++;
    };

    playBassNote();
    this.partyOscillatorInterval = setInterval(playBassNote, 240); // ~125 BPM
  }

  public stopPartyMusic() {
    this.isPartyPlaying = false;
    if (this.partyOscillatorInterval) {
      clearInterval(this.partyOscillatorInterval);
      this.partyOscillatorInterval = null;
    }
  }

  // --- Web Speech API TTS Announcements in Spanish ---
  public speakAnnouncement(text: string, priority = false) {
    if (this.speechMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      if (priority) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.05;
      utterance.pitch = 1.1; // energetic friendly voice
      utterance.volume = 0.9;

      // Try to select a Spanish voice if available
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(
        (v) => v.lang.startsWith('es') || v.lang.includes('Spanish')
      );
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // SpeechSynthesis may fail in some environments silently
    }
  }
}

export const audioEngine = new AudioEngine();
