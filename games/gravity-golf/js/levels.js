// The course: 18 holes on a 320×180 pixel screen (y grows downward; angles in degrees, -90 = top of a planet).
// b: planets { k: kind, x, y, r }   tee/hole: { b: planet index, a: angle on its surface }
// moons: { of: planet index, d: orbit distance, r, w: speed (rad/s), ph: start angle (rad) }   w: wormholes [x1, y1, x2, y2]
window.GG = window.GG || {};
GG.COURSE = [
  { name: 'First Swing', par: 2,
    b: [{ k: 'home', x: 62, y: 120, r: 22 }, { k: 'rock', x: 252, y: 118, r: 22 }],
    tee: { b: 0, a: -70 }, hole: { b: 1, a: -110 } },

  { name: 'Over the Hill', par: 3,
    b: [{ k: 'home', x: 44, y: 132, r: 17 }, { k: 'rock', x: 160, y: 128, r: 34 }, { k: 'rock', x: 276, y: 132, r: 17 }],
    tee: { b: 0, a: -80 }, hole: { b: 2, a: -100 } },

  { name: 'Slingshot', par: 3,
    b: [{ k: 'home', x: 46, y: 56, r: 15 }, { k: 'rock', x: 164, y: 104, r: 30 }, { k: 'rock', x: 270, y: 150, r: 14 }],
    tee: { b: 0, a: -30 }, hole: { b: 2, a: -150 } },

  { name: 'Slippery Slope', par: 2,
    b: [{ k: 'home', x: 50, y: 118, r: 20 }, { k: 'ice', x: 232, y: 100, r: 30 }],
    tee: { b: 0, a: -80 }, hole: { b: 1, a: -90 } },

  { name: 'Sand Trap', par: 3,
    b: [{ k: 'home', x: 42, y: 140, r: 16 }, { k: 'sand', x: 158, y: 118, r: 26 }, { k: 'rock', x: 272, y: 78, r: 16 }],
    tee: { b: 0, a: -70 }, hole: { b: 2, a: -120 } },

  { name: 'Hot Stuff', par: 4,
    b: [{ k: 'home', x: 40, y: 100, r: 16 }, { k: 'sun', x: 160, y: 100, r: 16 }, { k: 'rock', x: 280, y: 100, r: 16 }],
    tee: { b: 0, a: -90 }, hole: { b: 2, a: -90 } },

  { name: 'Wormhole', par: 3,
    b: [{ k: 'home', x: 44, y: 142, r: 16 }, { k: 'rock', x: 160, y: 100, r: 36 }, { k: 'rock', x: 276, y: 60, r: 16 }],
    w: [[88, 46, 234, 128]],
    tee: { b: 0, a: -60 }, hole: { b: 2, a: -100 } },

  { name: 'Pinball', par: 4,
    b: [{ k: 'home', x: 36, y: 60, r: 14 }, { k: 'bouncy', x: 110, y: 110, r: 16 }, { k: 'bouncy', x: 170, y: 50, r: 14 },
        { k: 'bouncy', x: 220, y: 130, r: 15 }, { k: 'rock', x: 286, y: 70, r: 15 }],
    tee: { b: 0, a: -40 }, hole: { b: 4, a: -110 } },

  { name: 'Moon Guard', par: 3,
    b: [{ k: 'home', x: 50, y: 120, r: 18 }, { k: 'rock', x: 236, y: 96, r: 22 }],
    moons: [{ of: 1, d: 44, r: 7, w: 1.1, ph: 3 }],
    tee: { b: 0, a: -70 }, hole: { b: 1, a: -120 } },

  { name: 'Push Back', par: 3,
    b: [{ k: 'home', x: 40, y: 112, r: 17 }, { k: 'repel', x: 160, y: 72, r: 16 }, { k: 'rock', x: 280, y: 104, r: 17 }],
    tee: { b: 0, a: -75 }, hole: { b: 2, a: -120 } },

  { name: 'Binary Stars', par: 3,
    b: [{ k: 'home', x: 40, y: 150, r: 15 }, { k: 'rock', x: 150, y: 80, r: 20 }, { k: 'rock', x: 192, y: 118, r: 16 },
        { k: 'rock', x: 284, y: 60, r: 15 }],
    tee: { b: 0, a: -60 }, hole: { b: 3, a: -110 } },

  { name: 'Asteroid Belt', par: 3,
    b: [{ k: 'home', x: 44, y: 112, r: 18 }, { k: 'rock', x: 278, y: 104, r: 18 },
        { k: 'asteroid', x: 150, y: 40, r: 5 }, { k: 'asteroid', x: 160, y: 62, r: 4 }, { k: 'asteroid', x: 147, y: 84, r: 5 },
        { k: 'asteroid', x: 163, y: 106, r: 4 }, { k: 'asteroid', x: 151, y: 128, r: 5 }, { k: 'asteroid', x: 162, y: 150, r: 4 },
        { k: 'asteroid', x: 176, y: 74, r: 3 }, { k: 'asteroid', x: 136, y: 118, r: 3 }],
    tee: { b: 0, a: -70 }, hole: { b: 1, a: -110 } },

  { name: 'Far Side', par: 3,
    b: [{ k: 'home', x: 46, y: 70, r: 16 }, { k: 'rock', x: 210, y: 76, r: 30 }],
    tee: { b: 0, a: -40 }, hole: { b: 1, a: 60 } },

  { name: 'Double Warp', par: 4,
    b: [{ k: 'home', x: 40, y: 100, r: 16 }, { k: 'sun', x: 160, y: 58, r: 14 }, { k: 'sun', x: 160, y: 142, r: 14 },
        { k: 'rock', x: 160, y: 100, r: 18 }, { k: 'rock', x: 282, y: 100, r: 16 }],
    w: [[96, 34, 228, 150], [96, 150, 228, 34]],
    tee: { b: 0, a: -90 }, hole: { b: 4, a: -90 } },

  { name: 'Ice and Fire', par: 3,
    b: [{ k: 'home', x: 38, y: 130, r: 15 }, { k: 'ice', x: 120, y: 60, r: 18 }, { k: 'sun', x: 190, y: 110, r: 15 },
        { k: 'ice', x: 276, y: 70, r: 20 }],
    tee: { b: 0, a: -60 }, hole: { b: 3, a: -90 } },

  { name: 'Crowded Space', par: 3,
    b: [{ k: 'home', x: 30, y: 150, r: 13 }, { k: 'rock', x: 88, y: 88, r: 16 }, { k: 'sand', x: 140, y: 150, r: 14 },
        { k: 'bouncy', x: 170, y: 64, r: 13 }, { k: 'repel', x: 222, y: 124, r: 14 }, { k: 'rock', x: 290, y: 44, r: 14 }],
    tee: { b: 0, a: -50 }, hole: { b: 5, a: -120 } },

  { name: 'Sun Corridor', par: 4,
    b: [{ k: 'home', x: 36, y: 96, r: 16 }, { k: 'sun', x: 120, y: 44, r: 14 }, { k: 'sun', x: 150, y: 150, r: 14 },
        { k: 'sun', x: 200, y: 70, r: 12 }, { k: 'rock', x: 284, y: 124, r: 17 }],
    tee: { b: 0, a: -30 }, hole: { b: 4, a: -110 } },

  { name: 'Grand Tour', par: 4,
    b: [{ k: 'home', x: 30, y: 44, r: 13 }, { k: 'ice', x: 96, y: 130, r: 18 }, { k: 'sun', x: 160, y: 60, r: 13 },
        { k: 'repel', x: 196, y: 140, r: 13 }, { k: 'bouncy', x: 240, y: 90, r: 12 }, { k: 'rock', x: 292, y: 150, r: 15 },
        { k: 'asteroid', x: 128, y: 96, r: 4 }, { k: 'asteroid', x: 268, y: 40, r: 4 }],
    moons: [{ of: 5, d: 30, r: 5, w: -1.3, ph: 4 }],
    w: [[60, 150, 226, 34]],
    tee: { b: 0, a: -20 }, hole: { b: 5, a: -135 } },
];

// Course 2 — Deep Space: nine harder holes. (Pars were set by testing, like the Classic course.)
GG.DEEP = [
  { name: 'Event Horizon', par: 3,
    b: [{ k: 'home', x: 36, y: 90, r: 15 }, { k: 'sun', x: 150, y: 90, r: 22 }, { k: 'repel', x: 226, y: 40, r: 12 }, { k: 'rock', x: 284, y: 112, r: 16 }],
    tee: { b: 0, a: -60 }, hole: { b: 3, a: -150 } },

  { name: 'Moon Maze', par: 4,
    b: [{ k: 'home', x: 44, y: 140, r: 16 }, { k: 'rock', x: 220, y: 80, r: 20 }],
    moons: [{ of: 1, d: 38, r: 6, w: 1.2, ph: 0 }, { of: 1, d: 58, r: 7, w: -.8, ph: 2.5 }],
    tee: { b: 0, a: -50 }, hole: { b: 1, a: -140 } },

  { name: 'Ricochet', par: 4,
    b: [{ k: 'home', x: 30, y: 40, r: 13 }, { k: 'bouncy', x: 96, y: 96, r: 13 }, { k: 'bouncy', x: 160, y: 40, r: 12 }, { k: 'bouncy', x: 214, y: 118, r: 13 },
        { k: 'rock', x: 286, y: 150, r: 15 }],
    tee: { b: 0, a: 20 }, hole: { b: 4, a: -110 } },

  { name: 'Warp Relay', par: 5,
    b: [{ k: 'home', x: 40, y: 150, r: 15 }, { k: 'sun', x: 250, y: 44, r: 12 }, { k: 'sun', x: 300, y: 110, r: 11 }, { k: 'sun', x: 214, y: 96, r: 10 },
        { k: 'rock', x: 268, y: 76, r: 12 }],
    w: [[120, 150, 90, 30], [170, 30, 262, 132]],
    tee: { b: 0, a: -30 }, hole: { b: 4, a: 90 } },

  { name: 'Ice Rink', par: 3,
    b: [{ k: 'ice', x: 46, y: 60, r: 16 }, { k: 'ice', x: 130, y: 128, r: 20 }, { k: 'ice', x: 206, y: 60, r: 14 }, { k: 'ice', x: 282, y: 124, r: 13 }],
    tee: { b: 0, a: -90 }, hole: { b: 3, a: 70 } },

  { name: 'Gravity Well', par: 4,
    b: [{ k: 'home', x: 34, y: 150, r: 14 }, { k: 'rock', x: 176, y: 88, r: 40 }, { k: 'rock', x: 258, y: 26, r: 10 }],
    tee: { b: 0, a: -45 }, hole: { b: 2, a: 150 } },

  { name: 'Repel Gate', par: 3,
    b: [{ k: 'home', x: 36, y: 90, r: 15 }, { k: 'repel', x: 160, y: 40, r: 14 }, { k: 'repel', x: 160, y: 140, r: 14 }, { k: 'repel', x: 200, y: 90, r: 11 },
        { k: 'sand', x: 284, y: 90, r: 18 }],
    tee: { b: 0, a: -90 }, hole: { b: 4, a: 180 } },

  { name: 'Asteroid Storm', par: 4,
    b: [{ k: 'home', x: 30, y: 150, r: 14 }, { k: 'rock', x: 286, y: 36, r: 14 },
        ...[[90, 60], [110, 110], [130, 36], [150, 84], [170, 140], [186, 50], [206, 100], [226, 150], [240, 70], [118, 150], [70, 100], [262, 110]].map(([x, y], i) => ({ k: 'asteroid', x, y, r: 3 + (i % 3) }))],
    moons: [{ of: 1, d: 30, r: 5, w: 1.4, ph: 1 }],
    tee: { b: 0, a: -45 }, hole: { b: 1, a: 135 } },

  { name: 'Singularity', par: 3,
    b: [{ k: 'home', x: 30, y: 30, r: 12 }, { k: 'sun', x: 160, y: 96, r: 16 }, { k: 'repel', x: 96, y: 150, r: 12 }, { k: 'ice', x: 230, y: 40, r: 14 },
        { k: 'rock', x: 290, y: 150, r: 10 }, { k: 'bouncy', x: 90, y: 80, r: 10 }],
    moons: [{ of: 1, d: 34, r: 5, w: -1.1, ph: 0 }],
    w: [[40, 150, 250, 100]],
    tee: { b: 0, a: 40 }, hole: { b: 4, a: -150 } },
];

// Course 3 — Black Hole: nine expert holes. Black holes (tiny, deadly, pulling hard) and planets that orbit —
// sometimes carrying the cup, sometimes carrying you. orbit: { of: planet index, d: distance, w: speed (rad/s), ph: start angle }
// (Pars from the built-in solver: what a steady player needs, plus one.)
GG.ABYSS = [
  { name: 'Accretion', par: 3,
    b: [{ k: 'home', x: 40, y: 120, r: 16 }, { k: 'blackhole', x: 160, y: 96, r: 5 }, { k: 'rock', x: 280, y: 110, r: 16 }],
    tee: { b: 0, a: -70 }, hole: { b: 2, a: -110 } },

  { name: 'Merry-Go-Round', par: 3,
    b: [{ k: 'home', x: 40, y: 130, r: 15 }, { k: 'rock', x: 214, y: 90, r: 18 }, { k: 'sand', x: 214, y: 90, r: 8, orbit: { of: 1, d: 48, w: 1.3, ph: 0 } },
        { k: 'blackhole', x: 124, y: 70, r: 4 }],
    tee: { b: 0, a: -60 }, hole: { b: 2, a: -90 } },

  { name: 'Twin Horizons', par: 3,
    b: [{ k: 'home', x: 36, y: 90, r: 15 }, { k: 'blackhole', x: 160, y: 46, r: 5 }, { k: 'blackhole', x: 160, y: 134, r: 5 }, { k: 'rock', x: 284, y: 90, r: 16 }],
    tee: { b: 0, a: -30 }, hole: { b: 3, a: 180 } },

  { name: 'Carousel', par: 4,
    b: [{ k: 'rock', x: 70, y: 90, r: 16 }, { k: 'home', x: 70, y: 90, r: 10, orbit: { of: 0, d: 40, w: -.6, ph: -1.2 } },
        { k: 'sun', x: 170, y: 64, r: 12 }, { k: 'blackhole', x: 216, y: 126, r: 5 }, { k: 'rock', x: 284, y: 88, r: 14 }],
    tee: { b: 1, a: -90 }, hole: { b: 4, a: 150 } },

  { name: 'Lip of the Abyss', par: 3,
    b: [{ k: 'home', x: 40, y: 60, r: 15 }, { k: 'rock', x: 150, y: 120, r: 22 }, { k: 'blackhole', x: 236, y: 86, r: 6 }, { k: 'rock', x: 290, y: 140, r: 14 }],
    tee: { b: 0, a: -20 }, hole: { b: 3, a: -150 } },

  { name: 'Fire and Void', par: 4,
    b: [{ k: 'home', x: 34, y: 140, r: 14 }, { k: 'sun', x: 120, y: 60, r: 13 }, { k: 'blackhole', x: 176, y: 124, r: 5 },
        { k: 'bouncy', x: 228, y: 48, r: 12 }, { k: 'rock', x: 288, y: 116, r: 14 }],
    tee: { b: 0, a: -50 }, hole: { b: 4, a: -110 } },

  { name: 'Orbital Transfer', par: 4,
    b: [{ k: 'rock', x: 80, y: 90, r: 14 }, { k: 'home', x: 80, y: 90, r: 9, orbit: { of: 0, d: 36, w: .8, ph: 3.6 } },
        { k: 'rock', x: 240, y: 90, r: 14 }, { k: 'ice', x: 240, y: 90, r: 9, orbit: { of: 2, d: 40, w: -.9, ph: 0 } }],
    tee: { b: 1, a: -90 }, hole: { b: 3, a: -90 } },

  { name: 'The Drain', par: 4,
    b: [{ k: 'home', x: 34, y: 40, r: 14 }, { k: 'blackhole', x: 160, y: 96, r: 6 },
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ k: 'asteroid', x: Math.round(160 + Math.cos(i / 10 * Math.PI * 2) * 34), y: Math.round(96 + Math.sin(i / 10 * Math.PI * 2) * 30), r: 3 + (i % 2) })),
        { k: 'rock', x: 286, y: 150, r: 14 }],
    tee: { b: 0, a: 30 }, hole: { b: 12, a: -120 } },

  { name: 'Heart of Darkness', par: 4,
    b: [{ k: 'home', x: 30, y: 150, r: 13 }, { k: 'blackhole', x: 150, y: 80, r: 6 }, { k: 'repel', x: 90, y: 50, r: 11 },
        { k: 'rock', x: 250, y: 96, r: 16 }, { k: 'sand', x: 250, y: 96, r: 7, orbit: { of: 3, d: 38, w: 1.5, ph: 1 } }],
    w: [[70, 110, 206, 30]],
    tee: { b: 0, a: -45 }, hole: { b: 4, a: -90 } },
];
