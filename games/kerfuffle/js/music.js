'use strict';
// ---------------------------------------------------------------------------
// Music for KERFUFFLE! — composed for the synth/sequencer in js/audio.js.
// One token = one 16th-note step unless it has a :length. Each pattern
// lists its chords one per bar (or Chord:steps); tracks set to 'chords'
// play them (pads, comping, arpeggios) and 'gen:<style>' writes a bass line.
// ---------------------------------------------------------------------------

const D4 = (pat, bars) => '(' + pat + ')x' + bars; // repeat a 1-bar drum pattern

const SONGS = {};

// --- Main theme "Kerfuffle!" — C major, 124 BPM --------------------------------
SONGS.title = {
  bpm: 124,
  tracks: {
    lead: { inst: 'lead', vol: 0.55, rev: 0.22, del: 0.18 },
    bell: { inst: 'bell', vol: 0.34, rev: 0.35, pan: -0.25 },
    bass: { inst: 'bass', vol: 0.5, oct: 2 },
    pad: { inst: 'pad', vol: 0.5, rev: 0.4, center: 64 },
    arp: { inst: 'pluck', vol: 0.3, pan: 0.3, del: 0.22, arp: 'updown', rate: 1, span: 2, center: 72 },
    kick: { inst: 'kick', vol: 0.8 },
    snare: { inst: 'snare', vol: 0.45, rev: 0.12 },
    clap: { inst: 'clap', vol: 0.32, rev: 0.2 },
    hat: { inst: 'hat', vol: 0.42, pan: 0.15 },
    ohat: { inst: 'ohat', vol: 0.34, pan: 0.15 },
    crash: { inst: 'crash', vol: 0.4 },
  },
  patterns: {
    intro: {
      bars: 2,
      chords: 'F G',
      pad: 'chords',
      arp: 'chords',
      bass: 'gen:half',
      hat: D4('x.x.x.x.x.x.x.x.', 2),
      kick: 'x............... x...x...x...x...',
      snare: '................ ....x...x.x.xXXX',
    },
    A: {
      bars: 8,
      chords: 'C G Am F C G F G',
      lead: `G5:2 E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 | F5:2 D5:2 F5:2 B5:4 A5:2 G5:2 F5:2 |
             E5:2 C5:2 E5:2 A5:4 G5:2 F5:2 E5:2 | F5:4 A5:4 G5:6 .:2 |
             G5:2 E5:2 G5:2 C6:4 D6:2 E6:4 | D6:3 C6:1 B5:2 G5:2 D6:4 .:4 |
             C6:2 A5:2 F5:2 A5:2 C6:4 D6:4 | B5:4 A5:2 B5:2 D6:8`,
      bell: '.:48 .:8 E6:2 F6:2 G6:4 .:48 .:8 G6:2 A6:2 B6:4',
      bass: 'gen:octave8',
      pad: 'chords',
      arp: 'chords',
      kick: D4('x...x...x...x...', 8),
      snare: D4('....x.......x...', 7) + ' ....x...x.x.xxxx',
      clap: D4('....x.......x...', 8),
      hat: D4('x.x.x.x.x.x.x.x.', 8),
      ohat: D4('..............x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
    B: {
      bars: 8,
      chords: 'F G Em Am F G C C',
      lead: `A5:6 G5:2 F5:4 C6:4 | B5:6 A5:2 G5:4 D6:4 | E6:6 D6:2 B5:4 G5:4 | A5:8 C6:4 E6:4 |
             F6:4 E6:2 D6:2 C6:4 A5:4 | B5:4 C6:2 D6:2 G6:8 | E6:4 D6:2 C6:2 G5:4 E5:4 | C6:12 .:4`,
      bell: '.:96 C7:2 G6:2 E6:2 C6:2 .:24',
      bass: 'gen:disco',
      pad: 'chords',
      arp: 'chords',
      kick: D4('x...x...x...x...', 8),
      snare: D4('....x.......x...', 7) + ' ....x.x.x.xxXXXX',
      clap: D4('....x.......x...', 8),
      hat: D4('xgxgxgxgxgxgxgxg', 8),
      ohat: D4('..x...x...x...x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
  },
  order: ['intro', 'A', 'B', 'A', 'B'],
  loop: 1,
};

// --- Character select "Pick 'Em!" — F major jazz, 108 BPM -------------------------
SONGS.select = {
  bpm: 108,
  swing16: 0.18,
  tracks: {
    lead: { inst: 'piano', vol: 0.6, rev: 0.25 },
    comp: { inst: 'organ', vol: 0.28, comp: 'offbeat', center: 62, rev: 0.2 },
    bass: { inst: 'bass', vol: 0.48, oct: 2 },
    bell: { inst: 'bell', vol: 0.22, rev: 0.4, pan: -0.3 },
    kick: { inst: 'kick', vol: 0.55 },
    rim: { inst: 'rim', vol: 0.4 },
    shaker: { inst: 'shaker', vol: 0.4, pan: 0.2 },
    hat: { inst: 'hat', vol: 0.28 },
  },
  patterns: {
    A: {
      bars: 8,
      chords: 'Gm7 C7 Fmaj7 Dm7 Gm7 C7 Fmaj7 Fmaj7',
      lead: `D5:3 F5:1 A5:4 G5:2 F5:2 D5:4 | E5:2 G5:2 Bb5:4 A5:2 G5:2 E5:4 | F5:6 A5:2 C6:4 E6:4 | D6:4 C6:2 A5:2 F5:8 |
             Bb5:3 A5:1 G5:4 D5:4 F5:4 | E5:4 G5:2 C6:2 Bb5:4 G5:4 | A5:8 C6:4 A5:4 | F5:12 .:4`,
      bell: '.:112 A6:2 C7:2 F7:4 .:8',
      comp: 'chords',
      bass: 'gen:walk',
      kick: D4('x.......x.......', 8),
      rim: D4('....x.......x...', 8),
      shaker: D4('xgxgxgxgxgxgxgxg', 8),
      hat: D4('..x...x...x...x.', 8),
    },
    B: {
      bars: 8,
      chords: 'Bbmaj7 A7 Dm7 G7 Gm7 C7 F C7',
      lead: `D6:4 C6:2 Bb5:2 A5:4 F5:4 | E5:4 G5:2 A5:2 C#6:8 | D6:6 F6:2 E6:4 D6:4 | B5:4 D6:4 F6:4 E6:4 |
             D6:4 Bb5:4 G5:4 A5:4 | Bb5:4 G5:4 E5:4 C5:4 | F5:4 A5:4 C6:8 | .:8 G5:2 A5:2 Bb5:2 B5:2`,
      comp: 'chords',
      bass: 'gen:walk',
      kick: D4('x.......x.......', 8),
      rim: D4('....x.......x...', 8),
      shaker: D4('xgxgxgxgxgxgxgxg', 8),
      hat: D4('..x...x...x...x.', 8),
    },
  },
  order: ['A', 'B'],
  loop: 0,
};

// --- VS splash sting --------------------------------------------------------------
SONGS.versus = {
  bpm: 120,
  once: true,
  tracks: {
    brass: { inst: 'brass', vol: 0.7, center: 62, rev: 0.3 },
    bass: { inst: 'bass', vol: 0.6 },
    taiko: { inst: 'taiko', vol: 0.85 },
    tom: { inst: 'tom', vol: 0.6, pitch: 150 },
    snare: { inst: 'snare', vol: 0.5 },
    crash: { inst: 'crash', vol: 0.5 },
  },
  patterns: {
    S: {
      bars: 3,
      brass: '@Cm:3 . @Cm:2 . . @Ab:4 @Bb:4 | @C:16 | .:16',
      bass: 'C2:3 . C2:2 . . Ab1:4 Bb1:4 | C2:16 | .:16',
      taiko: 'X..x.x..X...X... X............... ................',
      tom: '........x.x.xxxx ................ ................',
      snare: '............xxxx ................ ................',
      crash: '................ X............... ................',
    },
  },
  order: ['S'],
};

// --- Victory fanfare ---------------------------------------------------------------
SONGS.victory = {
  bpm: 140,
  once: true,
  tracks: {
    lead: { inst: 'brass', vol: 0.62, rev: 0.3 },
    lead2: { inst: 'lead', vol: 0.3, del: 0.2 },
    pad: { inst: 'pad', vol: 0.45, rev: 0.4 },
    bass: { inst: 'bass', vol: 0.5 },
    bell: { inst: 'bell', vol: 0.32, rev: 0.4 },
    kick: { inst: 'kick', vol: 0.8 },
    snare: { inst: 'snare', vol: 0.5 },
    crash: { inst: 'crash', vol: 0.5 },
  },
  patterns: {
    V: {
      bars: 3,
      chords: 'C F:8 G:8 C',
      lead: 'G4:2 C5:2 E5:2 G5:4 E5:2 G5:4 | A5:2 A5:2 A5:2 B5:4 B5:2 C6:4 | C6:16',
      lead2: 'G5:2 C6:2 E6:2 G6:4 E6:2 G6:4 | A6:2 A6:2 A6:2 B6:4 B6:2 C7:4 | C7:16',
      pad: 'chords',
      bass: 'C2:4 C2:4 G1:4 C2:4 | F1:8 G1:8 | C2:16',
      bell: '.:32 C6 E6 G6 C7 E7 G7 C8:10',
      kick: 'x...x...x...x... x...x...x.x.x... X...............',
      snare: '....x.......x... ....x.......xxxx ................',
      crash: 'X............... ................ X...............',
    },
  },
  order: ['V'],
};

// --- Results / menus: relaxed G major, 100 BPM ----------------------------------------
SONGS.results = {
  bpm: 100,
  tracks: {
    lead: { inst: 'pluck', vol: 0.55, rev: 0.3, del: 0.25 },
    pad: { inst: 'pad', vol: 0.45, rev: 0.45, center: 62 },
    bass: { inst: 'sub', vol: 0.45, oct: 2 },
    arp: { inst: 'bell', vol: 0.16, arp: 'up', rate: 2, span: 2, center: 76, rev: 0.4, pan: 0.25 },
    kick: { inst: 'kick', vol: 0.55 },
    rim: { inst: 'rim', vol: 0.35 },
    shaker: { inst: 'shaker', vol: 0.32 },
  },
  patterns: {
    A: {
      bars: 8,
      chords: 'Gmaj7 Em7 Cmaj7 D7sus4 Gmaj7 Em7 Am7 D7',
      lead: `B5:4 D6:2 F#6:2 D6:4 B5:4 | G5:4 B5:2 D6:2 E6:8 | E6:4 D6:2 C6:2 B5:4 G5:4 | A5:8 D6:8 |
             B5:4 D6:2 F#6:2 A6:4 F#6:4 | G6:6 E6:2 D6:4 B5:4 | C6:4 B5:2 A5:2 E6:4 C6:4 | D6:8 F#6:4 A6:4`,
      pad: 'chords',
      bass: 'gen:bounce',
      arp: 'chords',
      kick: D4('x.....x...x.....', 8),
      rim: D4('....x.......x...', 8),
      shaker: D4('..x...x...x...x.', 8),
    },
  },
  order: ['A'],
  loop: 0,
};

// --- Sunset Rooftop "Rooftop Rumble" (Jett) — A minor street funk, 150 BPM --------------
SONGS.rooftop = {
  bpm: 150,
  tracks: {
    lead: { inst: 'saw', vol: 0.48, rev: 0.2, del: 0.15 },
    stab: { inst: 'brass', vol: 0.3, comp: 'stab', center: 62, pan: -0.2 },
    pad: { inst: 'pad', vol: 0.32, rev: 0.3, center: 60 },
    bass: { inst: 'slap', vol: 0.62, oct: 2 },
    kick: { inst: 'kick', vol: 0.85 },
    snare: { inst: 'snare', vol: 0.55, rev: 0.15 },
    hat: { inst: 'hat', vol: 0.42, pan: 0.15 },
    ohat: { inst: 'ohat', vol: 0.3, pan: 0.15 },
    crash: { inst: 'crash', vol: 0.4 },
  },
  patterns: {
    intro: {
      bars: 2,
      bass: 'A1:2 . A2 . A1 G2:2 A2:2 . E2 G2 A2:3 | A1:2 . A2 . A1 G2:2 A2:2 . C3 D3 E3:3',
      kick: D4('x..x..x...x..x..', 2),
      snare: '....x.......x... ....x.......xxxx',
      hat: D4('xgxgxgxgxgxgxgxg', 2),
    },
    A: {
      bars: 8,
      chords: 'Am7 D9 Am7 D9 Fmaj7 E7 Am7 E7',
      lead: `A5:2 .:1 A5:1 C6:2 A5:2 D6:2 C6:2 A5:2 G5:2 | E5:2 G5:2 A5:2 .:2 F#5:2 E5:2 D5:4 |
             A5:2 .:1 A5:1 C6:2 A5:2 E6:2 D6:2 C6:2 A5:2 | G5:4 F#5:2 E5:2 D5:4 .:4 |
             C6:2 C6:2 A5:2 C6:2 E6:4 D6:4 | B5:2 B5:2 G#5:2 B5:2 D6:4 E6:4 |
             E6:3 D6:1 C6:2 A5:2 C6:2 A5:2 G5:2 E5:2 | G#5:4 B5:4 E6:6 .:2`,
      stab: 'chords',
      bass: 'gen:funk',
      kick: D4('x..x..x...x..x..', 8),
      snare: D4('....x.......x...', 7) + ' ....x.......xxxx',
      hat: D4('xgxgxgxgxgxgxgxg', 8),
      ohat: D4('......x.......x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
    B: {
      bars: 8,
      chords: 'Dm7 G7 Cmaj7 Fmaj7 Bm7b5 E7 Am7 E7',
      lead: `F5:4 A5:4 C6:4 D6:4 | B5:4 D6:4 F6:6 .:2 | E6:8 D6:4 C6:4 | A5:8 .:4 C6:4 |
             D6:4 B5:4 F5:4 A5:4 | G#5:8 B5:4 D6:4 | C6:6 B5:2 A5:8 | E5:2 G#5:2 B5:2 D6:2 E6:8`,
      pad: 'chords',
      bass: 'gen:rock',
      kick: D4('x...x...x...x...', 8),
      snare: D4('....x.......x...', 7) + ' ....x...x.x.xxxx',
      hat: D4('x.x.x.x.x.x.x.x.', 8),
      ohat: D4('..x...x...x...x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
  },
  order: ['intro', 'A', 'B', 'A', 'B'],
  loop: 1,
};

// --- Sugarplum Park "Sugar Rush" (Mochi) — G major chiptune pop, 140 BPM ----------------
SONGS.candy = {
  bpm: 140,
  tracks: {
    lead: { inst: 'chip', vol: 0.55, del: 0.2 },
    arp: { inst: 'arp', vol: 0.34, arp: 'updown', rate: 1, span: 2, center: 72, pan: 0.25 },
    bell: { inst: 'bell', vol: 0.26, arp: 'up', rate: 2, span: 2, center: 84, rev: 0.3, pan: -0.25 },
    bass: { inst: 'bass', vol: 0.48, oct: 2 },
    kick: { inst: 'kick', vol: 0.8 },
    clap: { inst: 'clap', vol: 0.42, rev: 0.15 },
    hat: { inst: 'hat', vol: 0.4, pan: 0.15 },
    shaker: { inst: 'shaker', vol: 0.28, pan: -0.2 },
    crash: { inst: 'crash', vol: 0.35 },
  },
  patterns: {
    I: {
      bars: 2,
      chords: 'G D',
      arp: 'chords',
      kick: 'x...x...x...x... x...x...x.x.xxxx',
      hat: D4('x.x.x.x.x.x.x.x.', 2),
    },
    A: {
      bars: 8,
      chords: 'G D Em C G D C D',
      lead: `B5:2 B5:2 D6:2 B5:2 G5:2 A5:2 B5:4 | A5:2 A5:2 F#5:2 A5:2 D6:4 C6:2 A5:2 |
             G5:2 G5:2 B5:2 G5:2 E5:2 F#5:2 G5:4 | E5:2 G5:2 C6:2 E6:2 D6:6 .:2 |
             B5:2 D6:2 G6:4 F#6:2 E6:2 D6:4 | C6:2 D6:2 E6:4 D6:2 C6:2 A5:4 |
             G5:2 A5:2 B5:2 C6:2 E6:4 D6:4 | F#6:4 E6:2 F#6:2 G6:8`,
      arp: 'chords',
      bass: 'gen:octave8',
      kick: D4('x...x...x...x...', 8),
      clap: D4('....x.......x...', 8),
      hat: D4('xgxgxgxgxgxgxgxg', 8),
      shaker: D4('..x...x...x...x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
    B: {
      bars: 8,
      chords: 'Em C G D Em C Am D',
      lead: `E6:6 D6:2 B5:8 | C6:6 B5:2 G5:8 | B5:4 D6:4 G6:4 D6:4 | F#6:12 .:4 |
             G6:4 F#6:4 E6:4 B5:4 | C6:4 E6:4 G6:8 | A6:4 G6:4 E6:4 C6:4 | D6:8 F#6:8`,
      bell: 'chords',
      bass: 'gen:bounce',
      kick: D4('x...x...x...x...', 7) + ' x...x...x.x.xxxx',
      clap: D4('....x.......x...', 8),
      hat: D4('x.x.x.x.x.x.x.x.', 8),
      shaker: D4('xgxgxgxgxgxgxgxg', 8),
      crash: 'X' + '.'.repeat(127),
    },
  },
  order: ['I', 'A', 'B', 'A', 'B'],
  loop: 1,
};

// --- The Main Event (Bruno) — E minor stadium rock, 132 BPM ------------------------------
SONGS.arena = {
  bpm: 132,
  tracks: {
    lead: { inst: 'brass', vol: 0.58, rev: 0.25 },
    power: { inst: 'saw', vol: 0.24, comp: 'chug8', center: 52 },
    bass: { inst: 'bass', vol: 0.58, oct: 2 },
    kick: { inst: 'kick', vol: 0.95 },
    snare: { inst: 'snare', vol: 0.62, rev: 0.25 },
    clap: { inst: 'clap', vol: 0.55, rev: 0.3 },
    hat: { inst: 'hat', vol: 0.38 },
    crash: { inst: 'crash', vol: 0.45 },
    tom: { inst: 'tom', vol: 0.6, pitch: 120 },
  },
  patterns: {
    intro: {
      bars: 4,
      chords: 'E5 E5 E5 E5',
      kick: D4('X.X.....X.X.....', 4),
      clap: D4('....X.......X...', 4),
      power: '.:32 (@E5:2 . .)x4 @E5:2 @E5:2 @E5:2 @E5:2 @D5:2 @D5:2 @D5:2 @D5:2',
      crash: '.'.repeat(48) + 'X...............',
    },
    A: {
      bars: 8,
      chords: 'E5 E5 C5 D5 E5 E5 C5 B5',
      lead: `E5:4 G5:2 A5:2 B5:8 | B5:2 A5:2 G5:2 A5:2 B5:4 E5:4 | C6:4 B5:2 A5:2 G5:4 E5:4 | F#5:4 G5:2 A5:2 D6:8 |
             E6:4 D6:2 B5:2 G5:4 B5:4 | A5:2 G5:2 F#5:2 G5:2 E5:8 | C6:4 E6:4 G6:4 E6:4 | D#6:4 F#6:4 B5:8`,
      power: 'chords',
      bass: 'gen:rock',
      kick: D4('x.......x.x.....', 8),
      snare: D4('....x.......x...', 8),
      hat: D4('x.x.x.x.x.x.x.x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
    B: {
      bars: 8,
      chords: 'C5 D5 E5 E5 C5 D5 B5 B5',
      lead: `G5:4 E5:4 G5:4 C6:4 | A5:4 F#5:4 A5:4 D6:4 | B5:8 G5:4 E6:4 | E6:12 .:4 |
             G6:4 E6:4 C6:4 E6:4 | F#6:4 D6:4 A5:4 D6:4 | D#6:8 F#6:8 | B6:8 .:8`,
      power: 'chords',
      bass: 'gen:root8',
      kick: D4('x...x...x...x...', 8),
      snare: D4('....x.......x...', 8),
      clap: D4('....x.......x...', 8),
      hat: D4('xgxgxgxgxgxgxgxg', 8),
      tom: '.'.repeat(112) + 'x.x.x.x.xxxxxxxx',
      crash: 'X' + '.'.repeat(127),
    },
  },
  order: ['intro', 'A', 'B', 'A', 'B'],
  loop: 1,
};

// --- Neon Alley "Neon Nights" (Volt) — D minor synthwave, 120 BPM ------------------------
SONGS.neon = {
  bpm: 120,
  tracks: {
    lead: { inst: 'saw', vol: 0.44, del: 0.3, rev: 0.3 },
    arp: { inst: 'arp', vol: 0.42, arp: 'up', rate: 1, span: 2, center: 64, del: 0.2, pan: 0.2 },
    pad: { inst: 'pad', vol: 0.55, rev: 0.5, center: 60 },
    bass: { inst: 'sub', vol: 0.55, oct: 2 },
    kick: { inst: 'kick', vol: 0.9 },
    snare: { inst: 'snare', vol: 0.5, rev: 0.45 },
    clap: { inst: 'clap', vol: 0.32, rev: 0.4 },
    hat: { inst: 'hat', vol: 0.34, pan: 0.2 },
    ohat: { inst: 'ohat', vol: 0.28, pan: -0.2 },
    crash: { inst: 'crash', vol: 0.38 },
  },
  patterns: {
    intro: {
      bars: 4,
      chords: 'Dm Bb F C',
      arp: 'chords',
      pad: 'chords',
      kick: '.'.repeat(32) + D4('x...x...x...x...', 2),
      hat: '.'.repeat(32) + D4('..x...x...x...x.', 2),
    },
    A: {
      bars: 8,
      chords: 'Dm Bb F C Dm Bb F C',
      lead: `A5:4 F5:2 A5:2 D6:6 C6:2 | D6:4 C6:2 Bb5:2 F5:8 | A5:4 C6:2 F6:2 E6:6 D6:2 | E6:4 G6:4 C6:8 |
             F6:4 E6:2 D6:2 A5:4 D6:4 | F6:6 E6:2 D6:4 Bb5:4 | C6:4 A5:4 F5:4 A5:4 | G5:4 C6:4 E6:8`,
      arp: 'chords',
      pad: 'chords',
      bass: 'gen:synth',
      kick: D4('x...x...x...x...', 8),
      snare: D4('....x.......x...', 8),
      clap: D4('....x.......x...', 8),
      hat: D4('..x...x...x...x.', 8),
      ohat: D4('......x.......x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
    B: {
      bars: 8,
      chords: 'Gm Bb Dm A Gm Bb Dm A',
      lead: `D6:4 Bb5:4 G5:4 Bb5:4 | F6:8 D6:8 | A6:4 F6:4 D6:4 F6:4 | E6:4 C#6:4 A5:4 E6:4 |
             G6:4 F6:4 D6:4 Bb5:4 | F6:4 D6:4 Bb5:4 F6:4 | A6:6 G6:2 F6:4 E6:4 | E6:8 C#6:8`,
      arp: 'chords',
      pad: 'chords',
      bass: 'gen:synth',
      kick: D4('x...x...x...x...', 8),
      snare: D4('....x.......x...', 7) + ' ....x...x.x.xxxx',
      hat: D4('xgxgxgxgxgxgxgxg', 8),
      ohat: D4('..x...x...x...x.', 8),
      crash: 'X' + '.'.repeat(127),
    },
  },
  order: ['intro', 'A', 'B', 'A', 'B'],
  loop: 1,
};

// --- Moonlit Bamboo "Moonlit Blades" (Kiri) — D minor pentatonic action, 152 BPM ------------
SONGS.bamboo = {
  bpm: 152,
  tracks: {
    lead: { inst: 'flute', vol: 0.5, rev: 0.3, del: 0.2 },
    koto: { inst: 'koto', vol: 0.36, arp: 'updown', rate: 1, span: 2, center: 67, pan: -0.2, del: 0.15 },
    pad: { inst: 'pad', vol: 0.3, rev: 0.4, center: 57 },
    bass: { inst: 'bass', vol: 0.5, oct: 2 },
    taiko: { inst: 'taiko', vol: 0.68 },
    tom: { inst: 'tom', vol: 0.5, pitch: 180 },
    wood: { inst: 'wood', vol: 0.34, pan: 0.3 },
    shaker: { inst: 'shaker', vol: 0.3, pan: -0.2 },
    crash: { inst: 'crash', vol: 0.32 },
  },
  patterns: {
    intro: {
      bars: 2,
      chords: 'Dm Dm',
      koto: 'chords',
      taiko: 'X.......X.x..... X.......X.x.x.xx',
    },
    A: {
      bars: 8,
      chords: 'Dm C Bb C Dm C Bb C',
      lead: `D6:2 F6:2 G6:2 A6:4 G6:2 F6:2 D6:2 | C6:2 D6:2 F6:2 G6:4 F6:2 D6:2 C6:2 |
             A5:2 C6:2 D6:2 F6:4 D6:2 C6:2 A5:2 | G5:4 A5:2 C6:2 D6:8 |
             A6:4 G6:2 F6:2 G6:4 A6:4 | C7:4 A6:2 G6:2 A6:8 | F6:2 G6:2 F6:2 D6:2 C6:4 A5:4 | D6:12 .:4`,
      koto: 'chords',
      pad: 'chords',
      bass: 'gen:root8',
      taiko: D4('X.....x.X...x...', 8),
      wood: D4('..x...x...x...x.', 8),
      shaker: D4('xgxgxgxgxgxgxgxg', 8),
      crash: 'X' + '.'.repeat(127),
    },
    B: {
      bars: 8,
      chords: 'Bb C Dm Dm Bb C A A',
      lead: `F6:4 D6:4 Bb5:4 D6:4 | E6:4 G6:4 C7:8 | A6:2 G6:2 F6:2 G6:2 A6:8 | D7:8 C7:4 A6:4 |
             Bb6:4 A6:2 G6:2 F6:4 D6:4 | E6:4 G6:4 C7:8 | A6:4 E6:2 C#6:2 E6:4 A6:4 | A6:8 .:8`,
      koto: 'chords',
      pad: 'chords',
      bass: 'gen:bounce',
      taiko: D4('X...x...X...x.x.', 8),
      wood: D4('x.x.x.x.x.x.x.x.', 8),
      shaker: D4('xgxgxgxgxgxgxgxg', 8),
      tom: '.'.repeat(112) + 'x.x.x.xxx.x.xxxx',
      crash: 'X' + '.'.repeat(127),
    },
  },
  order: ['intro', 'A', 'B', 'A', 'B'],
  loop: 1,
};

// --- Teahouse Garden "Tea for Two Hundred" (Nana) — C major swing, 150 BPM -----------------
SONGS.teahouse = {
  bpm: 150,
  swing8: 0.33,
  tracks: {
    lead: { inst: 'organ', vol: 0.48, rev: 0.25 },
    piano: { inst: 'piano', vol: 0.42, comp: 'swing', center: 60 },
    bass: { inst: 'bass', vol: 0.5, oct: 2 },
    kick: { inst: 'kick', vol: 0.5 },
    snare: { inst: 'snare', vol: 0.22 },
    hat: { inst: 'hat', vol: 0.36, pan: 0.2 },
    wood: { inst: 'wood', vol: 0.26, pitch: 1300, pan: -0.3 },
  },
  patterns: {
    intro: {
      bars: 2,
      chords: 'Dm7 G7',
      piano: 'chords',
      bass: 'gen:walk',
      hat: D4('x...x.x.x...x.x.', 2),
      snare: '................ ....x.....x.x.x.',
    },
    A: {
      bars: 8,
      chords: 'C6 A7 Dm7 G7 C6 A7 Dm7:8 G7:8 C6',
      lead: `E5:3 G5:1 A5:2 G5:2 E5:2 D5:2 C5:4 | C#5:2 E5:2 G5:2 A5:2 Bb5:4 A5:4 |
             A5:3 G5:1 F5:2 D5:2 F5:2 A5:2 C6:4 | B5:4 A5:2 G5:2 F5:4 D5:4 |
             G5:2 A5:2 C6:2 D6:2 E6:4 D6:2 C6:2 | C#6:4 E6:4 G6:4 E6:4 |
             D6:2 C6:2 A5:2 F5:2 G5:2 A5:2 B5:4 | C6:8 .:2 G5:2 A5:2 C6:2`,
      piano: 'chords',
      bass: 'gen:walk',
      kick: D4('x.......x.......', 8),
      snare: D4('....g.......g...', 8),
      hat: D4('x...x.x.x...x.x.', 8),
      wood: D4('..............x.', 8),
    },
    B: {
      bars: 8,
      chords: 'F Fm C A7 Dm7 G7 C G7',
      lead: `A5:4 C6:4 F6:8 | Ab5:4 C6:4 F6:8 | E6:4 D6:2 C6:2 G5:8 | A5:2 B5:2 C#6:2 E6:2 G6:8 |
             F6:4 E6:2 D6:2 A5:8 | G5:2 A5:2 B5:2 D6:2 F6:8 | E6:4 G6:4 C6:8 | .:4 D6:2 E6:2 G6:2 A6:2 G6:4`,
      piano: 'chords',
      bass: 'gen:walk',
      kick: D4('x.......x.......', 8),
      snare: D4('....x.......x...', 7) + ' ....x...x.x.x.x.',
      hat: D4('x...x.x.x...x.x.', 8),
      wood: D4('......x.......x.', 8),
    },
  },
  order: ['intro', 'A', 'B', 'A', 'B'],
  loop: 1,
};
