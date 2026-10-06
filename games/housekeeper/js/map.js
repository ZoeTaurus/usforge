// House layout: rooms, walls, and furniture/objects. Positions are in tiles.
(function () {
  const T = HS.TILE;

  const CHAIR = [
    'A normal chair. You count the chairs again. Still four. Probably.',
    'You sit for a second. The chair creaks "hello". Chairs don\'t do that.',
  ];

  // `kind` picks how render.js draws it. Objects with a `label` can be interacted with.
  const OBJECTS = [
    // Kitchen
    { id: 'kitrug', x: 3, y: 4, w: 3, h: 2, kind: 'rug', color: '#e07a5f', layer: 0, solid: false },
    { id: 'fridge', label: 'Fridge', x: 1, y: 1, h: 2, kind: 'fridge' },
    { id: 'counter', x: 2, y: 1, w: 4, kind: 'counter' },
    { id: 'sink', label: 'Kitchen sink', x: 6, y: 1, kind: 'ksink',
      flavor: ['The tap drips in a rhythm. It sounds like Morse code. You decide not to translate it.'] },
    { id: 'trash', label: 'Kitchen trash', x: 1, y: 6, kind: 'sprite', sprite: 'trash' },
    { id: 'bowl', label: 'Cat bowl', x: 7, y: 6, kind: 'bowl', solid: false },

    // Dining room
    { id: 'shelf', label: 'Bookshelf', x: 10, y: 1, w: 2, kind: 'shelf',
      flavor: ['Every book is titled "How To Housesit". They are all different lengths.'] },
    { id: 'table', label: 'Dining table', x: 13, y: 3, w: 3, h: 2, kind: 'table',
      flavor: ['A long dining table. Someone has scratched little tally marks along the edge. Hundreds of them. Days, maybe.'] },
    { id: 'chair1', label: 'Chair', x: 12, y: 3, kind: 'sprite', sprite: 'chair', flavor: CHAIR },
    { id: 'chair2', label: 'Chair', x: 12, y: 4, kind: 'sprite', sprite: 'chair', flavor: CHAIR },
    { id: 'chair3', label: 'Chair', x: 16, y: 3, kind: 'sprite', sprite: 'chair', flip: true, flavor: CHAIR },
    { id: 'chair4', label: 'Chair', x: 16, y: 4, kind: 'sprite', sprite: 'chair', flip: true, flavor: CHAIR },
    { id: 'chair5', label: 'Chair', x: 14, y: 5, kind: 'chair5', visible: false },
    { id: 'painting', label: 'Painting', x: 14, y: 0, kind: 'painting' },

    // Living room
    { id: 'livrug', x: 22, y: 3, w: 5, h: 3, kind: 'rug', color: '#81b29a', layer: 0, solid: false },
    { id: 'tv', label: 'TV', x: 24, y: 1, w: 2, kind: 'tv' },
    { id: 'couch', label: 'Couch', x: 23, y: 4, w: 3, kind: 'couch' },
    { id: 'fern', label: 'Fern', x: 27, y: 6, kind: 'fern' },
    { id: 'armchair', label: 'Armchair', x: 20, y: 6, kind: 'armchair',
      flavor: ['The armchair is still warm. Nobody has sat in it today. You checked.'] },

    // Hallway
    { id: 'hallrug', x: 12, y: 9, w: 8, h: 2, kind: 'rug', color: '#c48f5a', layer: 0, solid: false },
    { id: 'clock', label: 'Grandfather clock', x: 1, y: 9, kind: 'sprite', sprite: 'clock' },
    { id: 'phone', label: 'Landline', x: 8, y: 9, kind: 'phone' },
    { id: 'frontdoor', label: 'Front door', x: 29, y: 9, h: 2, kind: 'door' },
    { id: 'mail', label: 'Mail', x: 27, y: 10, kind: 'item', sprite: 'mail', solid: false, visible: false },
    { id: 'note', label: 'Strange note', x: 28, y: 9, kind: 'item', sprite: 'note', solid: false, visible: false },

    // Bedroom
    { id: 'bedrug', x: 5, y: 15, w: 4, h: 2, kind: 'rug', color: '#9d8bd6', layer: 0, solid: false },
    { id: 'bed', label: 'Bed', x: 2, y: 13, w: 2, h: 3, kind: 'bed' },
    { id: 'lamp', label: 'Lamp', x: 4, y: 13, kind: 'sprite', sprite: 'lamp',
      flavor: ['The lamp is on. It\'s always on. There is no bulb in it.'] },
    { id: 'wardrobe', label: 'Wardrobe', x: 8, y: 12, w: 2, kind: 'wardrobe',
      flavor: ['Robin\'s clothes. Every shirt has a tiny "thank you" stitched inside the collar.'] },

    // Bathroom
    { id: 'mirror', label: 'Mirror', x: 12, y: 11, w: 2, kind: 'mirror' },
    { id: 'bathsink', label: 'Sink', x: 16, y: 12, kind: 'sprite', sprite: 'bsink',
      flavor: ['The soap is shaped like a tiny house. This house. There\'s a tiny you inside it.'] },
    { id: 'toilet', label: 'Toilet', x: 17, y: 12, kind: 'sprite', sprite: 'toilet',
      flavor: ['It flushes by itself as you walk up. Polite.'] },
    { id: 'towel', label: 'Towel rack', x: 17, y: 15, kind: 'towel' },
    { id: 'tub', label: 'Bathtub', x: 12, y: 16, w: 2, h: 2, kind: 'tub' },

    // Laundry room
    { id: 'washer', label: 'Washing machine', x: 20, y: 12, kind: 'washer' },
    { id: 'dryer', label: 'Dryer', x: 21, y: 12, kind: 'washer',
      flavor: ['Warm. Inside is one sock. It\'s yours. You are wearing both of yours.'] },
    { id: 'bin', label: 'Big trash bin', x: 20, y: 18, kind: 'bin' },
    { id: 'boxes', label: 'Boxes', x: 26, y: 17, w: 2, h: 2, kind: 'boxes',
      flavor: ['Boxes labeled "HOUSESITTER #1", "#2", "#3"… The last one has your name on it. It\'s empty. For now.'] },
    { id: 'basement', label: 'Basement door', x: 28, y: 12, h: 2, kind: 'basement' },

    // ---------- South wing ----------
    // Back hallway
    { id: 'backrug', x: 3, y: 20, w: 24, h: 2, kind: 'rug', color: '#7a5a8a', layer: 0, solid: false },
    { id: 'dust1', label: 'Dust pile', x: 6, y: 21, kind: 'dust', solid: false, visible: false },
    { id: 'dust2', label: 'Dust pile', x: 12, y: 20, kind: 'dust', solid: false, visible: false },
    { id: 'dust3', label: 'Dust pile', x: 20, y: 21, kind: 'dust', solid: false, visible: false },
    { id: 'photo1', label: 'Family photo', x: 4, y: 19, kind: 'photo' },
    { id: 'photo2', label: 'Family photo', x: 10, y: 19, kind: 'photo' },
    { id: 'photo3', label: 'Family photo', x: 18, y: 19, kind: 'photo' },
    { id: 'photo4', label: 'Family photo', x: 26, y: 19, kind: 'photo' },
    { id: 'coats', label: 'Coat rack', x: 1, y: 20, kind: 'coats',
      flavor: ['Five coats. One of them is damp. It\'s always damp, no matter how dry the day is.', 'You check the pockets. One has a note: "it\'s nice here. stay." It\'s in your handwriting.'] },

    // Study
    { id: 'studyrug', x: 3, y: 28, w: 4, h: 3, kind: 'rug', color: '#a0524a', layer: 0, solid: false },
    { id: 'shelf2', label: 'Bookshelf', x: 1, y: 23, w: 2, kind: 'shelf',
      flavor: ['A whole shelf of diaries, one per housesitter. The newest one is blank, but the spine already has your name.'] },
    { id: 'shelf3', label: 'Bookshelf', x: 7, y: 23, w: 2, kind: 'shelf',
      flavor: ['Cookbooks. Every recipe serves "everyone in the house." The ingredient lists are very long.'] },
    { id: 'desk', label: 'Typewriter', x: 3, y: 24, w: 3, kind: 'desk' },
    { id: 'globe', label: 'Globe', x: 8, y: 27, kind: 'globe',
      flavor: ['The globe spins by itself and stops with a tiny click. Your finger is resting on your hometown. You didn\'t put it there.'] },
    { id: 'readchair', label: 'Reading chair', x: 2, y: 31, kind: 'armchair',
      flavor: ['There\'s a book open on the seat, face down. The title is <i>Day 8</i>. You put it back exactly how it was.'] },
    { id: 'fireplace', label: 'Fireplace', x: 5, y: 34, w: 2, kind: 'fireplace',
      flavor: ['The fire is lit. Nobody lit it. It\'s so warm. You could stay here forever, says a thought that isn\'t yours.'] },

    // Nursery
    { id: 'nurseryrug', x: 12, y: 30, w: 5, h: 3, kind: 'rug', color: '#e8a0b8', layer: 0, solid: false },
    { id: 'crib', label: 'Crib', x: 12, y: 24, w: 2, h: 2, kind: 'crib',
      flavor: ['An old wooden crib. The mattress has a little dent in it, like someone small just got up.', 'The mobile above the crib is turning. Slowly. There\'s no breeze. It turns the other way when you watch.'] },
    { id: 'horse', label: 'Rocking horse', x: 16, y: 26, kind: 'horse' },
    { id: 'blocks', label: 'Toy blocks', x: 13, y: 28, kind: 'blocks',
      flavor: ['The blocks spell H-E-L-L-O. You knock them over. When you look back, they spell H-I.'] },
    { id: 'musicbox', label: 'Music box', x: 17, y: 23, kind: 'musicbox' },

    // Sunroom
    { id: 'sunrug', x: 23, y: 28, w: 3, h: 2, kind: 'rug', color: '#5a9a8a', layer: 0, solid: false },
    { id: 'plant1', label: 'Plant', x: 20, y: 23, kind: 'fern', flavor: ['A happy plant. It leans toward you a little. Plants lean toward the light. You aren\'t the light.'] },
    { id: 'plant2', label: 'Plant', x: 28, y: 23, kind: 'fern', flavor: ['This plant is thriving. You don\'t want to know what it\'s been fed.'] },
    { id: 'plant3', label: 'Plant', x: 20, y: 31, kind: 'fern', flavor: ['A plant. Totally normal. You watch it for a full minute just to be sure.'] },
    { id: 'wicker1', label: 'Wicker chair', x: 22, y: 26, kind: 'sprite', sprite: 'chair', flavor: ['A wicker chair, still rocking very slightly.'] },
    { id: 'wicker2', label: 'Wicker chair', x: 26, y: 26, kind: 'sprite', sprite: 'chair', flip: true, flavor: ['A wicker chair. The cushion is warm.'] },
    { id: 'telescope', label: 'Telescope', x: 27, y: 29, kind: 'telescope' },
    { id: 'window1', label: 'Window', x: 21, y: 35, w: 2, kind: 'window' },
    { id: 'window2', label: 'Window', x: 25, y: 35, w: 2, kind: 'window' },
  ];

  HS.Map = {
    grid: [],
    objects: [],
    byId: {},

    rooms: [
      { id: 'kitchen', x: 1, y: 1, w: 8, h: 7, color: '#f4e7c9', alt: '#e6d3a8', pattern: 'checker' },
      { id: 'dining', x: 10, y: 1, w: 9, h: 7, color: '#d8b083', alt: '#c49a6c', pattern: 'planks' },
      { id: 'living', x: 20, y: 1, w: 9, h: 7, color: '#bfd3b8', alt: '#a9c19f', pattern: 'carpet' },
      { id: 'hall', x: 1, y: 9, w: 28, h: 2, color: '#d9c4a3', alt: '#c7ae88', pattern: 'planks' },
      { id: 'bedroom', x: 1, y: 12, w: 10, h: 7, color: '#c9c3e6', alt: '#b4acda', pattern: 'carpet' },
      { id: 'bath', x: 12, y: 12, w: 6, h: 7, color: '#d3ecef', alt: '#b5dbe1', pattern: 'tile' },
      { id: 'laundry', x: 19, y: 12, w: 10, h: 7, color: '#dadada', alt: '#c3c3c3', pattern: 'tile' },
      { id: 'backhall', x: 1, y: 20, w: 28, h: 2, color: '#c9b293', alt: '#b59c7c', pattern: 'planks' },
      { id: 'study', x: 1, y: 23, w: 9, h: 12, color: '#7a5a48', alt: '#6a4c3c', pattern: 'planks' },
      { id: 'nursery', x: 11, y: 23, w: 8, h: 12, color: '#f2dbe4', alt: '#e8c8d6', pattern: 'carpet' },
      { id: 'sunroom', x: 20, y: 23, w: 9, h: 12, color: '#e6e0c8', alt: '#d4ccb0', pattern: 'checker' },
    ],

    build() {
      const C = HS.COLS, R = HS.MAP_ROWS;
      const g = [];
      for (let y = 0; y < R; y++) {
        const row = [];
        for (let x = 0; x < C; x++) row.push(x === 0 || y === 0 || x === C - 1 || y === R - 1 ? '#' : '.');
        g.push(row);
      }
      const wall = (x, y) => { g[y][x] = '#'; };
      for (let y = 1; y <= 7; y++) { wall(9, y); wall(19, y); }
      for (let x = 0; x < C; x++) { wall(x, 8); wall(x, 11); }
      for (let y = 12; y <= 18; y++) { wall(11, y); wall(18, y); }
      // South wing: back hallway (rows 20-21), then study / nursery / sunroom.
      for (let x = 0; x < C; x++) { wall(x, 19); wall(x, 22); }
      for (let y = 23; y <= 34; y++) { wall(10, y); wall(19, y); }
      // Doorways
      [[4, 8], [14, 8], [24, 8], [5, 11], [15, 11], [24, 11], [9, 4], [19, 4],
        [15, 19], [22, 19], [5, 22], [14, 22], [24, 22]].forEach(([x, y]) => { g[y][x] = '.'; });
      this.grid = g;

      this.objects = OBJECTS.map(o => Object.assign({ w: 1, h: 1, solid: true, visible: true, layer: 1 }, o));
      this.byId = {};
      this.objects.forEach(o => { this.byId[o.id] = o; });
    },

    isWall(tx, ty) {
      return !this.grid[ty] || this.grid[ty][tx] !== '.';
    },

    roomAt(px, py) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      return this.rooms.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || null;
    },

    isSolidAt(px, py) {
      if (this.isWall(Math.floor(px / T), Math.floor(py / T))) return true;
      return this.objects.some(o => o.visible && o.solid &&
        px >= o.x * T && px < (o.x + o.w) * T && py >= o.y * T && py < (o.y + o.h) * T);
    },

    // Closest interactable object within reach of a point.
    nearest(px, py, reach = 12) {
      let best = null, bestD = reach;
      for (const o of this.objects) {
        if (!o.visible || !o.label) continue;
        const cx = Math.max(o.x * T, Math.min(px, (o.x + o.w) * T));
        const cy = Math.max(o.y * T, Math.min(py, (o.y + o.h) * T));
        const d = Math.hypot(px - cx, py - cy);
        if (d < bestD) { bestD = d; best = o; }
      }
      return best;
    },
  };
})();
