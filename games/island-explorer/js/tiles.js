'use strict';
// Tile ids and their gameplay properties.
const T = {
  DEEP: 0, SHALLOW: 1, ROUGH: 2, SAND: 3, GRASS: 4, JUNGLE: 5, TREE: 6, JTREE: 7, PALM: 8, ROCK: 9,
  MOUNTAIN: 10, CLIFF: 11, RIVER: 12, BRIDGE_BROKEN: 13, BRIDGE: 14, PATH: 15, COBBLE: 16, TOWNWALL: 17,
  ROOF: 18, HOUSEWALL: 19, DOOR: 20, BERRY: 21, BUSH: 22, VINE: 23, STUMP: 24, FLOWERS: 25, WRECK: 26,
  CAMPFIRE: 27, CHEST: 28, CHEST_OPEN: 29, SIGN: 30, RUINWALL: 31, RUINFLOOR: 32, GATE: 33, FOUNTAIN: 34,
  HUTROOF: 35, HUTWALL: 36, SKELETON: 37, TALLGRASS: 38, CROPS: 39, LAMP: 40, SHELL: 41, JSTUMP: 42,
  PINE: 43, RELIC: 44, SNOW: 45, MUD: 46, ASH: 47, LAVA: 48, ORE: 49, PEBBLE: 50, CRATE: 51, DIG: 52,
  SNOWPINE: 53, DEADTREE: 54, MUSHROOMS: 55, WALL_WOOD: 56, WALL_STONE: 57, WGATE: 58, BIGPINE: 59,
};

// walk:    can be walked on
// sea:     1 = raft can sail, 2 = needs sailboat
// ground:  a floor tile; it becomes the "ground" drawn under objects placed on it
// overlay: a small object drawn on top of the ground below it
// tall:    a tall object (tree) drawn depth-sorted with characters
// chop / mine: hardness (hits needed = hardness / tool power; mining needs a pickaxe) · act: label for the [E] prompt · map: minimap colour
const TILE = [];
function defTile(id, o) {
  TILE[id] = Object.assign({ walk: false, sea: 0, ground: false, overlay: false, tall: false,
    chop: 0, mine: 0, act: null, map: '#f0f' }, o);
}

defTile(T.DEEP,          { sea: 1, ground: true, map: '#1f4f8c' });
defTile(T.SHALLOW,       { sea: 1, ground: true, map: '#3a8bc9' });
defTile(T.ROUGH,         { sea: 2, ground: true, map: '#27395e' });
defTile(T.RIVER,         { ground: true, map: '#4a9ad6' });
defTile(T.SAND,          { walk: true, ground: true, map: '#e9d49b' });
defTile(T.GRASS,         { walk: true, ground: true, map: '#5aa545' });
defTile(T.JUNGLE,        { walk: true, ground: true, map: '#3e7f33' });
defTile(T.PATH,          { walk: true, ground: true, map: '#c29d6c' });
defTile(T.COBBLE,        { walk: true, ground: true, map: '#aaa396' });
defTile(T.RUINFLOOR,     { walk: true, ground: true, map: '#8c8f7a' });
defTile(T.CROPS,         { walk: true, ground: true, map: '#d8b84a' });
defTile(T.SNOW,          { walk: true, ground: true, map: '#e8eef4' });
defTile(T.MUD,           { walk: true, ground: true, map: '#5a5a3a' });
defTile(T.ASH,           { walk: true, ground: true, map: '#4a4040' });
defTile(T.LAVA,          { ground: true, map: '#ff6a20' });

defTile(T.TREE,          { tall: true, chop: 6, act: 'Chop', map: '#2e6b24' });
defTile(T.JTREE,         { tall: true, chop: 7, act: 'Chop', map: '#1f5a2a' });
defTile(T.PALM,          { tall: true, chop: 5, act: 'Chop', map: '#8ab35a' });
defTile(T.PINE,          { tall: true, chop: 6, act: 'Chop', map: '#24583c' });
defTile(T.SNOWPINE,      { tall: true, chop: 7, act: 'Chop', map: '#3a6a5a' });
defTile(T.BIGPINE,       { tall: true, chop: 14, act: 'Chop', map: '#2a5a4a' });
defTile(T.DEADTREE,      { tall: true, chop: 4, act: 'Chop', map: '#5a4a3a' });

defTile(T.ROCK,          { overlay: true, mine: 6, act: 'Mine', map: '#8a8a8a' });
defTile(T.ORE,           { overlay: true, mine: 9, act: 'Mine', map: '#c07a4a' });
defTile(T.PEBBLE,        { overlay: true, walk: true, map: '#b0a890' });
defTile(T.CRATE,         { overlay: true, act: 'Open', map: '#b08040' });
defTile(T.DIG,           { overlay: true, walk: true, act: 'Dig', map: '#c0503a' });
// player-built structures (build: refund when knocked down)
defTile(T.WALL_WOOD,     { overlay: true, chop: 5, act: 'Chop', build: { wood: 2 }, map: '#9a6e3e' });
defTile(T.WALL_STONE,    { overlay: true, mine: 8, act: 'Mine', build: { stone: 2 }, map: '#8a8a94' });
defTile(T.WGATE,         { overlay: true, walk: true, chop: 5, act: 'Chop', build: { wood: 2 }, map: '#b08050' });
defTile(T.MUSHROOMS,     { overlay: true, act: 'Pick', map: '#d06050' });
defTile(T.BERRY,         { overlay: true, act: 'Pick', map: '#d0304a' });
defTile(T.BUSH,          { overlay: true, map: '#3f8a36' });
defTile(T.VINE,          { overlay: true, act: 'Gather', map: '#7acf5a' });
defTile(T.STUMP,         { overlay: true, walk: true, map: '#6a9a4a' });
defTile(T.JSTUMP,        { overlay: true, walk: true, map: '#4a7a3a' });
defTile(T.FLOWERS,       { overlay: true, walk: true, map: '#6ab555' });
defTile(T.TALLGRASS,     { overlay: true, walk: true, map: '#4c9139' });
defTile(T.SHELL,         { overlay: true, walk: true, map: '#f4d8c0' });
defTile(T.WRECK,         { overlay: true, act: 'Inspect', map: '#6b4a26' });
defTile(T.CAMPFIRE,      { overlay: true, act: 'Rest', map: '#ff8a2a' });
defTile(T.CHEST,         { overlay: true, act: 'Open', map: '#e0b040' });
defTile(T.CHEST_OPEN,    { overlay: true, map: '#8a6030' });
defTile(T.SIGN,          { overlay: true, act: 'Read', map: '#a87a44' });
defTile(T.SKELETON,      { overlay: true, act: 'Search', map: '#e8e4d8' });
defTile(T.LAMP,          { overlay: true, map: '#ffd060' });
defTile(T.RELIC,         { overlay: true, act: 'Take', map: '#ffd84a' });
defTile(T.FOUNTAIN,      { overlay: true, act: 'Look', map: '#5ab0f0' });

defTile(T.MOUNTAIN,      { map: '#8d8275' });
defTile(T.CLIFF,         { map: '#5a5045' });
defTile(T.BRIDGE_BROKEN, { act: 'Repair', map: '#7a5a3a' });
defTile(T.BRIDGE,        { walk: true, map: '#9a6e3e' });
defTile(T.TOWNWALL,      { map: '#55555e' });
defTile(T.ROOF,          { map: '#a8433a' });
defTile(T.HOUSEWALL,     { map: '#d8c8a0' });
defTile(T.DOOR,          { act: 'Knock', map: '#6b4423' });
defTile(T.HUTROOF,       { map: '#c9a55a' });
defTile(T.HUTWALL,       { map: '#8a6236' });
defTile(T.RUINWALL,      { map: '#6a6d5a' });
defTile(T.GATE,          { walk: true, map: '#aaa396' });

// Which "family" a ground tile belongs to, for blending soft edges between them.
function groundKind(t) {
  switch (t) {
    case T.GRASS: return 'g';
    case T.JUNGLE: return 'j';
    case T.SAND: return 's';
    case T.PATH: return 'p';
    case T.SNOW: return 'n';
    case T.MUD: return 'm';
    case T.ASH: return 'a';
    default: return TILE[t].sea ? 'w' : null;
  }
}
