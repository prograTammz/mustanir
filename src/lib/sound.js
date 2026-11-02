// Game sounds, synthesized on the spot: nothing to download, so they work offline from the first tap. The melodies walk up
// maqam Hijaz on D, to suit the palace. The silent switch mutes them, and music playing in another app keeps playing.
import { LS } from "./store.js";

export const soundOn = () => LS.get("a2-sound", true);
export const setSound = (on) => LS.set("a2-sound", on);

// [MIDI note, start s, length s, volume]. D5 74, Eb5 75, F#5 78, G5 79, A5 81, Bb5 82, D6 86.
const SONGS = {
  tap: [[90, 0, 0.03, 0.025]],
  xp: [[81, 0, 0.12, 0.07], [86, 0.07, 0.2, 0.08]],
  loss: [[78, 0, 0.12, 0.06], [74, 0.08, 0.22, 0.06]],
  quest: [[78, 0, 0.12, 0.07], [81, 0.09, 0.12, 0.07], [86, 0.18, 0.35, 0.09]],
  chest: [[74, 0, 0.14, 0.08], [78, 0.1, 0.14, 0.08], [81, 0.2, 0.14, 0.08], [86, 0.3, 0.5, 0.1]],
  medal: [[81, 0, 0.12, 0.08], [82, 0.1, 0.12, 0.08], [81, 0.2, 0.12, 0.08], [86, 0.32, 0.6, 0.1], [90, 0.32, 0.6, 0.05]],
  level: [[74, 0, 0.14, 0.09], [75, 0.12, 0.14, 0.09], [78, 0.24, 0.14, 0.09], [79, 0.36, 0.14, 0.09], [81, 0.48, 0.22, 0.1], [86, 0.68, 1.1, 0.11], [81, 0.68, 1.1, 0.07], [78, 0.68, 1.1, 0.06]],
};

let ctx = null;
export function play(name) {
  if (!soundOn()) return;
  try {
    if (!ctx) {
      if (navigator.audioSession) navigator.audioSession.type = "ambient";
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state !== "running") ctx.resume(); // iOS starts it suspended, and suspends it again in the background
    const t0 = ctx.currentTime + 0.005;
    for (const [note, at, len, vol] of SONGS[name]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + at;
      o.type = "triangle"; o.frequency.value = 440 * 2 ** ((note - 69) / 12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + len + 0.02);
    }
  } catch { /* no sound here */ }
}
