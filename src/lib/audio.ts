// Procedural ambient soundscapes and timer chimes using the Web Audio API.
// Nothing is downloaded: every sound is synthesised on the device.
import type { AmbientId } from '../types';

let ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(kind: 'white' | 'pink' | 'brown', seconds = 4): AudioBuffer {
  const c = ac();
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  return buf;
}

interface Running { stop: () => void; setVolume: (v: number) => void }
let running: Running | null = null;
let current: AmbientId = 'off';

function loop(kind: 'white' | 'pink' | 'brown', dest: AudioNode) {
  const c = ac();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(kind);
  src.loop = true;
  src.connect(dest);
  src.start();
  return src;
}

export function startAmbient(id: AmbientId, volume: number) {
  if (id === current && running) { running.setVolume(volume); return; }
  stopAmbient();
  if (id === 'off') return;
  const c = ac();
  const master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  master.gain.linearRampToValueAtTime(volume, c.currentTime + 1.2);
  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];

  if (id === 'white' || id === 'pink' || id === 'brown') {
    sources.push(loop(id, master));
  } else if (id === 'rain') {
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    const g = c.createGain(); g.gain.value = 0.55;
    hp.connect(lp).connect(g).connect(master);
    sources.push(loop('pink', hp));
    const rumble = c.createBiquadFilter(); rumble.type = 'lowpass'; rumble.frequency.value = 300;
    const rg = c.createGain(); rg.gain.value = 0.5;
    rumble.connect(rg).connect(master);
    sources.push(loop('brown', rumble));
    // droplets
    const drop = () => {
      const t = c.currentTime;
      const o = c.createOscillator(); const og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1800 + Math.random() * 2600, t);
      o.frequency.exponentialRampToValueAtTime(400 + Math.random() * 400, t + 0.05);
      og.gain.setValueAtTime(0.02 + Math.random() * 0.03, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(og).connect(master); o.start(t); o.stop(t + 0.07);
    };
    timers.push(window.setInterval(() => { if (Math.random() < 0.7) drop(); }, 90));
  } else if (id === 'waves') {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const swell = c.createGain(); swell.gain.value = 0.5;
    lp.connect(swell).connect(master);
    sources.push(loop('brown', lp));
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
    const depth = c.createGain(); depth.gain.value = 0.45;
    lfo.connect(depth).connect(swell.gain);
    lfo.start(); sources.push(lfo);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.07;
    const d2 = c.createGain(); d2.gain.value = 500;
    lfo2.connect(d2).connect(lp.frequency); lfo2.start(); sources.push(lfo2);
  } else if (id === 'fire') {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.8;
    lp.connect(g).connect(master);
    sources.push(loop('brown', lp));
    const crackle = () => {
      const t = c.currentTime;
      const len = Math.floor(c.sampleRate * (0.004 + Math.random() * 0.012));
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = c.createBufferSource(); s.buffer = b;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 3500; bp.Q.value = 1.5;
      const cg = c.createGain(); cg.gain.value = 0.2 + Math.random() * 0.6;
      s.connect(bp).connect(cg).connect(master); s.start(t);
    };
    timers.push(window.setInterval(() => {
      if (Math.random() < 0.35) crackle();
      if (Math.random() < 0.05) { crackle(); setTimeout(crackle, 30); setTimeout(crackle, 75); }
    }, 70));
  }

  running = {
    stop: () => {
      timers.forEach(clearInterval);
      const t = c.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.4);
      setTimeout(() => { sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); master.disconnect(); }, 500);
    },
    setVolume: (v) => master.gain.setTargetAtTime(v, c.currentTime, 0.2),
  };
  current = id;
}

export function stopAmbient() {
  running?.stop();
  running = null;
  current = 'off';
}

export function ambientPlaying(): AmbientId { return current; }

export function chime(kind: 'bell' | 'soft' | 'digital' | 'none', volume = 0.6) {
  if (kind === 'none') return;
  const c = ac();
  const t0 = c.currentTime + 0.02;
  const out = c.createGain();
  out.gain.value = volume;
  out.connect(c.destination);
  const tone = (freq: number, start: number, dur: number, type: OscillatorType, gain: number) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out); o.start(start); o.stop(start + dur + 0.05);
  };
  if (kind === 'bell') {
    for (const [i, f] of [659.25, 987.77, 1318.5].entries()) {
      tone(f, t0 + i * 0.18, 2.2, 'sine', 0.35);
      tone(f * 2.76, t0 + i * 0.18, 0.6, 'sine', 0.05);
    }
  } else if (kind === 'soft') {
    tone(523.25, t0, 1.2, 'triangle', 0.3);
    tone(783.99, t0 + 0.22, 1.6, 'triangle', 0.25);
  } else {
    for (let i = 0; i < 3; i++) tone(1046.5, t0 + i * 0.16, 0.09, 'square', 0.08);
  }
}

/** A short tick used for UI feedback (e.g. completing a task). */
export function pop(volume = 0.25) {
  try {
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
    g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.16);
  } catch { /* audio unavailable */ }
}
