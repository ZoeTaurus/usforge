'use strict';
/* Ant species. Six are playable; the red wood ant only appears as a rival. */

const ANT_SPECIES = {
  garden: {
    name: 'Black garden ant', latin: 'Lasius niger', playable: true,
    pal: { g: ['#2a1e19', '#7a6252', '#0a0605'], t: ['#2e211b', '#806856', '#0c0806'], h: ['#2b1f1a', '#7d6553', '#0a0605'], leg: '#1c120e', ant: '#24170f' },
    shape: { size: 1, head: 1, gaster: 1, legs: 1, nodes: 1, mand: 'normal', spines: false, hairs: false, slim: 1 },
    stats: { speed: 1, hp: 1, dmg: 1 }, costW: 8, costS: 20,
    ability: { id: 'share', name: 'Share food', cd: 10, desc: 'Heal yourself and every sister nearby.' },
    perk: 'Aphid herders: honeydew is worth 3 food instead of 2.',
    nest: 'crater', trail: [255, 214, 120],
    blurb: 'A worker that finds food lays a scent trail on the way home, and her sisters follow it. When two meet they tap antennae to share news, and sometimes food.',
  },
  leafcutter: {
    name: 'Leafcutter ant', latin: 'Atta cephalotes', playable: true,
    pal: { g: ['#6e3416', '#c47a44', '#240c04'], t: ['#87431e', '#e09858', '#2e1206'], h: ['#8a451f', '#e49c5c', '#2e1206'], leg: '#5a2a10', ant: '#4a200a' },
    shape: { size: 1.05, head: 1.22, gaster: 0.72, legs: 1.2, nodes: 2, mand: 'leaf', spines: true, hairs: false, slim: 1 },
    stats: { speed: 0.95, hp: 1.1, dmg: 1.1 }, costW: 9, costS: 22,
    ability: { id: 'cut', name: 'Cut leaf', cd: 1.2, desc: 'Snip a leaf fragment from the plants around you.' },
    perk: 'Fungus farmers: carried leaves feed the fungus garden, which turns them into food.',
    nest: 'bare', trail: [255, 170, 90],
    blurb: 'Leafcutters do not eat the leaves they carry. They chew them into a mulch that feeds a fungus garden, and the fungus feeds the colony.',
  },
  fire: {
    name: 'Red fire ant', latin: 'Solenopsis invicta', playable: true,
    pal: { g: ['#3c1c12', '#8e5444', '#140604'], t: ['#a8481c', '#f2a062', '#3c1206'], h: ['#a4441a', '#ee985a', '#3a1106'], leg: '#6a2a10', ant: '#5a200a' },
    shape: { size: 0.86, head: 1, gaster: 1, legs: 0.95, nodes: 2, mand: 'normal', spines: false, hairs: false, slim: 1 },
    stats: { speed: 1.05, hp: 0.75, dmg: 0.8 }, costW: 5, costS: 14, venom: true, swims: true,
    ability: { id: 'venom', name: 'Venom burst', cd: 8, desc: 'Sting every enemy around you. The venom keeps burning.' },
    perk: 'Cheap, venomous workers. You can paddle across water.',
    nest: 'dome', trail: [255, 120, 80],
    blurb: 'Fire ants sting with a venom that burns. When floods come they link legs and float together as a living raft.',
  },
  trapjaw: {
    name: 'Trap-jaw ant', latin: 'Odontomachus bauri', playable: true,
    pal: { g: ['#5a2c14', '#c27c4a', '#1a0804'], t: ['#5e2e16', '#c8824e', '#1c0904'], h: ['#5c2d15', '#c6804c', '#1a0804'], leg: '#3a1a0a', ant: '#2e1408' },
    shape: { size: 1.15, head: 1.12, gaster: 0.95, legs: 1.2, nodes: 1, mand: 'trap', spines: false, hairs: false, slim: 0.9 },
    stats: { speed: 1.05, hp: 1.05, dmg: 1.7 }, costW: 10, costS: 24,
    ability: { id: 'leap', name: 'Jaw leap', cd: 4, desc: 'Snap your jaws on the ground and fly forward, hitting anything in the way.' },
    perk: 'Spring-loaded jaws hit very hard.',
    nest: 'litter', trail: [240, 190, 110],
    blurb: 'Its jaws lock open and snap shut in a fraction of a millisecond, one of the fastest movements in the animal world. It can even snap them against the ground to fling itself away.',
  },
  bullet: {
    name: 'Bullet ant', latin: 'Paraponera clavata', playable: true,
    pal: { g: ['#26130c', '#6e4636', '#080302'], t: ['#2c160e', '#74493a', '#0a0402'], h: ['#2a150d', '#704737', '#080302'], leg: '#1a0c08', ant: '#140804' },
    shape: { size: 1.5, head: 1.05, gaster: 1.08, legs: 1.05, nodes: 1, mand: 'normal', spines: false, hairs: true, slim: 1 },
    stats: { speed: 0.86, hp: 2.2, dmg: 2 }, costW: 14, costS: 30,
    ability: { id: 'sting', name: 'Bullet sting', cd: 6, desc: 'A crushing sting that stuns your target.' },
    perk: 'Huge and tough, but each new sister costs a lot of food.',
    nest: 'roots', trail: [230, 160, 130],
    blurb: 'One of the largest ants in the world. Its sting is often rated the most painful of any insect.',
  },
  weaver: {
    name: 'Weaver ant', latin: 'Oecophylla smaragdina', playable: true,
    pal: { g: ['#7a8a2a', '#dce474', '#2a3008'], t: ['#c4681c', '#ffb464', '#4a1e04'], h: ['#c2661c', '#ffb262', '#4a1e04'], leg: '#a05418', ant: '#8a4410' },
    shape: { size: 1.1, head: 1, gaster: 0.9, legs: 1.35, nodes: 1, mand: 'normal', spines: false, hairs: false, slim: 0.82 },
    stats: { speed: 1.18, hp: 0.95, dmg: 1.05 }, costW: 9, costS: 22,
    ability: { id: 'weave', name: 'Weave outpost', cd: 2, desc: 'Spend 15 food to build a leaf shelter where sisters drop food and heal (up to 3).' },
    perk: 'Fast and long-legged. Builds outposts far from home.',
    nest: 'leafball', trail: [200, 240, 120],
    blurb: 'Weaver ants pull leaves together and glue them with silk spun by their own larvae, which workers hold in their jaws like living glue guns.',
  },
  wood: {
    name: 'Red wood ant', latin: 'Formica rufa', playable: false,
    pal: { g: ['#2d1813', '#7c4a3a', '#0b0503'], t: ['#a83c17', '#f6a066', '#3c1106'], h: ['#933416', '#ee8e58', '#330e05'], leg: '#4d1b0c', ant: '#5c200e' },
    shape: { size: 1.05, head: 1, gaster: 1, legs: 1.05, nodes: 1, mand: 'normal', spines: false, hairs: false, slim: 1 },
    stats: { speed: 1, hp: 1.1, dmg: 1.1 }, costW: 8, costS: 20,
    ability: null, perk: '', nest: 'thatch', trail: [255, 110, 150],
    blurb: 'Builds big domed mounds out of pine needles and defends them hard. Instead of stinging, it sprays formic acid.',
  },
};

const PLAYABLE = Object.keys(ANT_SPECIES).filter((k) => ANT_SPECIES[k].playable);
const RIVALS = ['wood', 'fire', 'leafcutter', 'trapjaw', 'bullet', 'weaver', 'garden', 'wood'];
