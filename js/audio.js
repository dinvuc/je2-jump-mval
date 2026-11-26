'use strict';
// audio.js -- synthesised sound effects and the original chiptune soundtrack.
// Loaded before game.js; AUDIO is used by every other script.

// Everything is generated with Web Audio oscillators and noise: no sound files, no
// samples, no third-party music. The soundtrack below was composed for this game.
// The audio context only starts after a key press or click (browser rule).
const AUDIO = (() => {
  let ac = null, sfxBus = null, musBus = null, musFilter = null, noise = null, intensity = 0, muffled = false;
  let sfxOn = true, musicOn = true;
  try {
    sfxOn = localStorage.getItem('je2jump_muted') !== '1';
    musicOn = localStorage.getItem('je2jump_music') !== '0';
  } catch { /* private mode */ }
  const save = () => { try { localStorage.setItem('je2jump_muted', sfxOn ? '0' : '1'); localStorage.setItem('je2jump_music', musicOn ? '1' : '0'); } catch { /* private mode */ } };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(ac.destination);
    musBus = ac.createGain(); musBus.gain.value = 0.55;
    musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 20000;   // muffles the music in tunnels
    musBus.connect(musFilter).connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 25);
  }
  function tone(f0, f1, dur, type, vol, t, bus) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.03);
  }
  function hiss(dur, vol, t, freq, bus) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }

  // -- sound effects --
  const fx = (f0, f1, dur, type = 'square', vol = 0.05, delay = 0) => tone(f0, f1, dur, type, vol, ac.currentTime + delay, sfxBus);
  const arp = (fs, step, type = 'triangle', vol = 0.05, dur = 0.12) => fs.forEach((f, i) => fx(f, f, dur, type, vol, i * step));
  const SOUNDS = {
    jump: () => fx(300, 560, 0.12, 'square', 0.03),
    dj: () => fx(520, 1040, 0.14, 'triangle', 0.05),
    cys: k => { const m = 1 + 0.12 * (k - 1); fx(880 * m, 880 * m, 0.06, 'square', 0.025); fx(1320 * m, 1320 * m, 0.09, 'square', 0.025, 0.05); },
    iron: k => { const m = 1 + 0.12 * (k - 1); fx(520 * m, 980 * m, 0.14, 'triangle', 0.06); },
    power: () => arp([523, 659, 784, 1047], 0.06),
    hurt: () => fx(220, 70, 0.3, 'sawtooth', 0.05),
    stomp: () => fx(420, 110, 0.16, 'square', 0.045),
    check: () => arp([784, 1175], 0.08, 'sine', 0.06),
    pop: () => fx(900, 300, 0.08, 'sine', 0.04),
    crack: () => { fx(170, 55, 0.14, 'sawtooth', 0.035); hiss(0.12, 0.05, ac.currentTime, 1500, sfxBus); },
    dash: () => fx(160, 740, 0.16, 'triangle', 0.05),
    off: () => arp([660, 440], 0.08, 'sine', 0.04),
    done: k => arp([                                       // a different victory jingle per level
      [523, 659, 784, 1047, 1319],                         // TSB: bright C major
      [587, 740, 880, 1175, 880, 1175],                    // SNpulse: quick D major
      [440, 523, 659, 880, 1047, 1319],                    // SN: from A minor up to C
      [392, 494, 587, 784, 988, 1175, 1568],               // CF: a long fanfare
    ][(k - 1) % 4], 0.09, 'triangle', 0.06, 0.18),
    goal: () => arp([784, 988, 1319], 0.07, 'sine', 0.06, 0.2),
    mist: () => { hiss(2.5, 0.05, ac.currentTime, 3000, sfxBus); hiss(2.5, 0.03, ac.currentTime + 0.4, 6000, sfxBus); },
    fail: () => arp([392, 330, 262, 196], 0.14, 'triangle', 0.06, 0.2),
    click: () => fx(660, 660, 0.05, 'square', 0.03),
    move: () => fx(440, 440, 0.03, 'square', 0.02),
    shoot: () => fx(900, 500, 0.08, 'square', 0.03),
    boing: () => fx(180, 720, 0.22, 'sine', 0.08),
    ribo: () => arp([392, 523, 784], 0.05, 'square', 0.04, 0.1),
    breakb: () => { hiss(0.15, 0.08, ac.currentTime, 800, sfxBus); fx(140, 60, 0.12, 'square', 0.04); },
    peptide: () => arp([659, 880, 1175, 1568], 0.06, 'sine', 0.06, 0.18),
    cough: () => {
      for (const d of [0, 0.28]) { hiss(0.32, 0.22, ac.currentTime + d, 120, sfxBus); fx(140, 70, 0.25, 'sawtooth', 0.05, d); }
    },
    warn: () => arp([880, 660, 880], 0.12, 'square', 0.03, 0.08),
    bossHit: () => { fx(300, 90, 0.18, 'square', 0.06); hiss(0.08, 0.06, ac.currentTime, 2000, sfxBus); },
    bossDie: () => { arp([523, 392, 330, 262, 196, 131], 0.08, 'sawtooth', 0.05, 0.2); hiss(0.8, 0.12, ac.currentTime, 300, sfxBus); },
    // stomping several enemies without landing climbs a scale
    chain: k => { const m = Math.pow(2, Math.min(k, 8) * 2 / 12); fx(420 * m, 160 * m, 0.14, 'square', 0.05); fx(840 * m, 840 * m, 0.08, 'triangle', 0.04, 0.05); },
    secret: () => arp([523, 784, 659, 1047, 1319, 1568], 0.07, 'triangle', 0.06, 0.22),
    star: k => { const f = [659, 784, 988, 1175, 1319][Math.min(k, 4)]; fx(f, f, 0.22, 'triangle', 0.07); fx(f * 2, f * 2, 0.12, 'sine', 0.03, 0.03); },
    tick: k => fx(1200 + (k % 6) * 60, 1200 + (k % 6) * 60, 0.025, 'square', 0.015),
    medal: () => arp([784, 988, 1175, 1568], 0.06, 'square', 0.04, 0.16),
    lysis: () => { fx(500, 60, 0.45, 'sawtooth', 0.06); hiss(0.4, 0.12, ac.currentTime + 0.05, 900, sfxBus); },
    land: () => { fx(140, 50, 0.1, 'sine', 0.12); hiss(0.06, 0.04, ac.currentTime, 400, sfxBus); },
    gen: k => { const m = Math.pow(2, (k % 12) / 12); arp([523 * m, 659 * m, 784 * m], 0.05, 'triangle', 0.05, 0.12); },
    camera: () => { hiss(0.05, 0.12, ac.currentTime, 3000, sfxBus); fx(1800, 1800, 0.04, 'square', 0.02, 0.06); },
  };

  // -- the soundtrack: 8 bars (128 sixteenth steps), chords C Am F G | C Am F G --
  // Melody notes: [step, midi note, length in steps]. Original composition.
  const MELODY = [
    [0, 76, 2], [2, 79, 2], [4, 84, 3], [8, 83, 1], [9, 84, 1], [10, 79, 2], [12, 76, 4],
    [16, 81, 2], [18, 84, 2], [20, 88, 3], [24, 86, 1], [25, 84, 1], [26, 83, 2], [28, 81, 4],
    [32, 77, 2], [34, 81, 2], [36, 84, 2], [38, 86, 2], [40, 84, 2], [42, 81, 2], [44, 77, 2], [46, 79, 2],
    [48, 79, 3], [51, 81, 1], [52, 83, 2], [54, 86, 2], [56, 91, 4], [60, 86, 2], [62, 83, 2],
    [64, 79, 1], [65, 79, 1], [66, 84, 2], [68, 88, 2], [70, 91, 2], [72, 88, 2], [74, 84, 2], [76, 86, 4],
    [80, 88, 3], [83, 86, 1], [84, 84, 2], [86, 81, 2], [88, 84, 4], [92, 88, 4],
    [96, 89, 2], [98, 88, 2], [100, 86, 2], [102, 84, 2], [104, 81, 4], [108, 84, 2], [110, 86, 2],
    [112, 83, 4], [116, 86, 2], [118, 83, 2], [120, 79, 8],
  ];
  const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];   // C, Am, F, G
  // -- the B section: 8 more bars over F G Em Am | F G C C, longer notes and a
  // rising answer, so the theme no longer loops on its own. Original composition.
  const MELODY_B = [
    [0, 81, 4], [4, 84, 2], [6, 81, 2], [8, 77, 6], [14, 79, 2],
    [16, 83, 4], [20, 86, 2], [22, 83, 2], [24, 79, 6], [30, 81, 2],
    [32, 83, 3], [35, 79, 1], [36, 76, 4], [40, 79, 2], [42, 83, 2], [44, 86, 4],
    [48, 84, 6], [54, 83, 1], [55, 81, 1], [56, 81, 8],
    [64, 77, 2], [66, 81, 2], [68, 84, 2], [70, 89, 2], [72, 88, 4], [76, 84, 4],
    [80, 86, 2], [82, 83, 2], [84, 79, 2], [86, 83, 2], [88, 86, 4], [92, 91, 4],
    [96, 88, 4], [100, 91, 2], [102, 88, 2], [104, 84, 4], [108, 86, 2], [110, 88, 2],
    [112, 84, 6], [118, 79, 2], [120, 84, 8],
  ];
  const F = [41, 45, 48], Gc = [43, 47, 50], Em = [40, 43, 47], Am = [45, 48, 52], C = [48, 52, 55];
  const SECTIONS = {
    A: { melody: new Map(MELODY.map(m => [m[0], m])), chords: CHORDS },
    B: { melody: new Map(MELODY_B.map(m => [m[0], m])), chords: [F, Gc, Em, Am, F, Gc, C, C] },
  };
  // Per-medium arrangements: tempo, transposition, minor mode, lead sound, drum density,
  // and the form (the order of the 8-bar sections; every song plays A then B unless set).
  const SONGS = {
    title: { bpm: 108, tr: 0, minor: false, lead: 'square', drums: 1 },
    TSB: { bpm: 116, tr: 0, minor: false, lead: 'square', drums: 1 },
    SNpulse: { bpm: 138, tr: 2, minor: false, lead: 'square', drums: 2 },
    SN: { bpm: 100, tr: -3, minor: true, lead: 'triangle', drums: 1 },
    'CF airway': { bpm: 108, tr: -5, minor: true, lead: 'triangle', drums: 1 },
    boss: { bpm: 152, tr: -2, minor: true, lead: 'square', drums: 2, form: 'A' },   // the tense A theme only
    'Log phase': { bpm: 128, tr: 4, minor: false, lead: 'square', drums: 2 },
  };
  let song = null, step = 0, nextT = 0;
  const pitch = n => {
    if (song.minor) { const pc = ((n % 12) + 12) % 12; if (pc === 4 || pc === 9 || pc === 11) n -= 1; }   // major -> natural minor
    return midi(n + song.tr);
  };
  function playStep(s, t) {
    const form = song.form || 'AB', name = form[Math.floor(s / 128) % form.length], sec = SECTIONS[name];
    const sp = 60 / song.bpm / 4, ls = s % 128, bar = Math.floor(ls / 16), chord = sec.chords[bar % sec.chords.length], inBar = s % 16;
    const m = sec.melody.get(ls);
    if (m) tone(pitch(m[1]), pitch(m[1]), m[2] * sp * 0.95, song.lead, song.lead === 'square' ? 0.035 : 0.07, t, musBus);
    if (inBar % 2 === 0) {                                   // bouncy octave bass
      const n = chord[0] - 12 + (inBar % 4 === 2 ? 12 : 0);
      tone(pitch(n), pitch(n), sp * 1.6, 'triangle', 0.11, t, musBus);
    }
    const an = chord[inBar % 3] + 12;                        // soft arpeggio
    tone(pitch(an), pitch(an), sp * 0.9, 'sine', 0.025, t, musBus);
    if (inBar === 0 || inBar === 8 || (song.drums > 1 && inBar === 10)) tone(150, 45, 0.14, 'sine', 0.22, t, musBus);   // kick
    if (name === 'B' ? inBar === 8 : inBar === 4 || inBar === 12) hiss(0.11, 0.07, t, 1200, musBus);                     // snare (half time in B)
    if (song.drums > 1 ? true : inBar % 2 === 0) hiss(0.03, inBar % 4 === 2 ? 0.035 : 0.018, t, 7000, musBus);          // hi-hat
    if (intensity > 0.5) {                                   // danger layer: enemies nearby
      if (inBar % 2 === 1) hiss(0.025, 0.03, t, 9000, musBus);
      if (inBar === 6 || inBar === 14) tone(240, 110, 0.12, 'sine', 0.16, t, musBus);
      if (inBar === 15) tone(330, 140, 0.1, 'sine', 0.12, t, musBus);
    }
  }
  function schedule() {
    if (!ac || !song || !musicOn) return;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;   // tab was in the background
    while (nextT < ac.currentTime + 0.12) {
      playStep(step, nextT);
      nextT += 60 / song.bpm / 4;
      step = (step + 1) % (128 * (song.form || 'AB').length);
    }
  }

  return {
    play(name, arg = 1) { if (ac && sfxOn && SOUNDS[name]) SOUNDS[name](arg); },
    unlock() {
      if (!ac) { try { init(); } catch { return; } }
      if (ac.state === 'suspended') ac.resume();
    },
    music(name) {
      const s = SONGS[name] || SONGS.title;
      if (s === song) return;
      song = s; step = 0; if (ac) nextT = ac.currentTime + 0.08;
    },
    duck(on) { if (musBus) musBus.gain.setTargetAtTime(on ? 0.15 : 0.55, ac.currentTime, 0.1); },
    muffle(on) {
      if (on === muffled) return;
      muffled = on;
      if (musFilter) musFilter.frequency.setTargetAtTime(on ? 650 : 20000, ac.currentTime, 0.25);
    },
    intensity(v) { intensity = v; },
    toggleSfx() { sfxOn = !sfxOn; save(); },
    toggleMusic() { musicOn = !musicOn; save(); if (ac) nextT = ac.currentTime + 0.05; },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
  };
})();
