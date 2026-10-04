'use strict';
/* Input, HUD, minimap, species picker, nest panel and field guide. */

class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set();
    this.just = new Set();
    this.joy = { x: 0, y: 0 };
    this.touchBite = false;
    this.touchTrail = false;
    const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT' && e.code !== 'Escape') return;
      if (block.includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.just.add(e.code);
      this.keys.add(e.code);
      game.onKey(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  get move() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x--;
    if (k.has('KeyD') || k.has('ArrowRight')) x++;
    if (k.has('KeyW') || k.has('ArrowUp')) y--;
    if (k.has('KeyS') || k.has('ArrowDown')) y++;
    x += this.joy.x; y += this.joy.y;
    const l = Math.hypot(x, y);
    if (l < 0.15) return { x: 0, y: 0 };
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  get bite() { return this.keys.has('Space') || this.touchBite; }
  get trail() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchTrail; }
  pressed(code) { return this.just.has(code); }
  endFrame() { this.just.clear(); }
}

/* --------------------------------------------------------- field guide */

const fakeAnt = (sp, role = 'worker', size = 2.2) => ({ x: 0, y: 0, a: -0.35, size: size * ANT_SPECIES[sp].shape.size, sp, role, gait: 1.2, hurtT: 0, greetT: 0, biteT: 0, id: 3 });

const GUIDE = [];
for (const k of Object.keys(ANT_SPECIES)) {
  const s = ANT_SPECIES[k];
  GUIDE.push({ id: 'ant:' + k, name: s.name, latin: s.latin, scale: 1 / s.shape.size, text: s.blurb, draw: (c, t) => drawAnt(c, fakeAnt(k), t) });
}
GUIDE.push(
  { id: 'aphid', name: 'Aphid', latin: 'Aphidoidea', scale: 4.5, text: 'Sips plant sap and lets out sugary honeydew. Ants stroke aphids with their antennae to collect it and guard them in return. Many aphids are born already pregnant.', draw: (c, t) => drawAphid(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 0, ready: true, id: 1 }, t) },
  { id: 'ladybug', name: 'Seven-spot ladybird', latin: 'Coccinella septempunctata', scale: 2.6, text: 'One ladybird can eat thousands of aphids in its life. Ants that herd aphids chase ladybirds away from their flock.', draw: (c, t) => drawLadybug(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 0, z: 0, open: 0, id: 1 }, t) },
  { id: 'spider', name: 'Wolf spider', latin: 'Lycosidae', scale: 1, text: 'Hunts on foot instead of spinning a web, using sharp eyesight. Mothers carry their spiderlings around on their backs.', draw: (c, t) => drawSpider(c, { x: 4, y: 0, a: -0.4, size: 0.95, gait: 1, hurtT: 0, biteT: 0 }, t) },
  { id: 'beetle', name: 'Stag beetle', latin: 'Lucanus cervus', scale: 1.1, text: 'Males wrestle rivals with their antler-like jaws. The grubs spend several years feeding on rotting wood before they become adults.', draw: (c, t) => drawBeetle(c, { x: 0, y: 0, a: -0.4, size: 0.95, gait: 1, hurtT: 0, biteT: 0 }, t) },
  { id: 'pillbug', name: 'Pill bug', latin: 'Armadillidium vulgare', scale: 2.4, text: 'Not an insect at all but a land crustacean, related to crabs and shrimp. When something bothers it, it rolls into an armoured ball.', draw: (c, t) => drawPillbug(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 0, curl: 0, roll: 0 }, t) },
  { id: 'caterpillar', name: 'Hawk-moth caterpillar', latin: 'Sphingidae', scale: 1.3, text: 'The curved horn on its tail looks dangerous but is harmless. It will grow into a fast, heavy-bodied moth.', draw: (c, t) => { const segs = []; for (let i = 0; i < 10; i++) segs.push({ x: 24 - i * 5.6, y: Math.sin(i * 0.6) * 4 }); drawCaterpillar(c, { segs, thrash: 0.4 }, t); } },
  { id: 'snail', name: 'Garden snail', latin: 'Cornu aspersum', scale: 1.7, text: 'Glides on a film of mucus. In dry weather it seals its shell with a door of dried mucus called an epiphragm.', draw: (c, t) => drawSnail(c, { x: -3, y: 0, a: -0.3, size: 1, ext: 1, id: 1 }, t) },
  { id: 'butterfly', name: 'Peacock butterfly', latin: 'Aglais io', scale: 1.5, text: 'The big eyespots on its wings can startle birds. It spends winter as an adult, so it is one of the first butterflies out in spring.', draw: (c) => drawButterfly(c, { x: 0, y: 0, a: -Math.PI / 2, z: 0, size: 1, landed: true, variant: 'peacock', id: 1 }, 0.9) },
  { id: 'dragonfly', name: 'Emperor dragonfly', latin: 'Anax imperator', scale: 1.15, text: 'Catches other insects in mid-air and can fly forwards, backwards or hover. Its huge eyes see almost all the way around.', draw: (c, t) => drawDragonfly(c, { x: 12, y: 0, a: Math.PI, z: 0, size: 1, id: 1 }, t) },
  { id: 'antlion', name: 'Antlion', latin: 'Myrmeleontidae', scale: 2.4, text: 'The larva digs a cone-shaped pit in sand and waits at the bottom, flicking sand at insects that slip in. Some ants pull trapped nestmates back out.', draw: (c) => { radialFill(c, 0, 0, 18, [[0, '#3e2f1a'], [0.3, '#7d6440'], [0.75, '#c4aa76'], [1, 'rgba(220,199,151,0)']]); drawAntlionJaws(c, { x: 0, y: 0, jawVis: 1, jawA: -0.5 }, 0.3); } },
  { id: 'firefly', name: 'Firefly', latin: 'Lampyridae', scale: 4, text: 'A beetle that makes cold light in its abdomen through a chemical reaction. Each species flashes its own pattern to find a mate.', draw: (c) => { const e = { x: 0, y: 0, a: -0.4, freq: 0, ph: Math.PI / 2, fade: 1 }; c.globalCompositeOperation = 'lighter'; drawFireflyGlow(c, e, 0); c.globalCompositeOperation = 'source-over'; drawFireflyBody(c, e, 0); } },
  { id: 'crab', name: 'Shore crab', latin: 'Carcinus maenas', scale: 0.85, text: 'Walks sideways because its legs bend best that way. It can last for hours out of the sea by keeping its gills damp.', draw: (c, t) => drawCrab(c, { x: 0, y: 0, a: -Math.PI / 2, size: 1, gait: 1, biteT: 0, id: 4 }, t) },
  { id: 'frog', name: 'Common frog', latin: 'Rana temporaria', scale: 0.9, text: 'Flicks out its sticky tongue faster than you can blink. Its spit turns runny on impact, then thickens again to glue prey in place.', draw: (c, t) => drawFrog(c, { x: 0, y: 0, a: -0.5, size: 1, id: 2 }, t) },
  { id: 'lizard', name: 'Common lizard', latin: 'Zootoca vivipara', scale: 0.6, text: 'Basks in the sun to warm up before hunting. Unlike most lizards, it usually gives birth to live young.', draw: (c, t) => drawLizard(c, { x: 30, y: 0, a: 0, size: 1, gait: 1, sway: 1 }, t) },
  { id: 'bird', name: 'European robin', latin: 'Erithacus rubecula', scale: 0.85, text: 'Hops across open ground watching for movement. Robins even follow gardeners and wild boar to snatch the insects they turn up.', draw: (c, t) => drawBird(c, { x: 4, y: 0, a: -0.4, size: 0.9, z: 0, flying: false, id: 1 }, t) },
  { id: 'mouse', name: 'Wood mouse', latin: 'Apodemus sylvaticus', scale: 0.75, text: 'Mostly eats seeds and hides stores of them for winter. It can shed the skin of its tail to escape a predator.', draw: (c, t) => drawMouse(c, { x: 10, y: 0, a: -0.3, size: 1, gait: 0, id: 2 }, t) },
  { id: 'worm', name: 'Earthworm', latin: 'Lumbricus terrestris', scale: 1.6, text: 'Breathes through its skin, so it comes to the surface when rain floods its burrow. Its tunnels let air and water into the soil.', draw: (c, t) => { const segs = []; for (let i = 0; i < 12; i++) segs.push({ x: 22 - i * 4, y: Math.sin(i * 0.7) * 4 }); drawWorm(c, { segs }, t); } },
  { id: 'centipede', name: 'Brown centipede', latin: 'Lithobius forficatus', scale: 1, text: 'A fast night hunter. Its first pair of legs are venom claws called forcipules.', draw: (c, t) => { const segs = []; for (let i = 0; i < 16; i++) segs.push({ x: 40 - i * 6, y: Math.sin(i * 0.5) * 5 }); drawCentipede(c, { segs }, t); } },
  { id: 'millipede', name: 'Millipede', latin: 'Diplopoda', scale: 1.3, text: 'Despite the name, most have far fewer than a thousand legs. It eats rotting leaves and coils up to protect its soft underside.', draw: (c, t) => { const segs = []; for (let i = 0; i < 20; i++) segs.push({ x: 40 - i * 4.4, y: Math.sin(i * 0.4) * 4 }); drawMillipede(c, { segs, curl: 0 }, t); } },
  { id: 'scorpion', name: 'Scorpion', latin: 'Scorpiones', scale: 1.1, text: 'Hunts at night and glows blue-green under ultraviolet light. It grabs prey with its pincers and saves the sting for when it is needed.', draw: (c, t) => drawScorpion(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1, biteT: 0, tailSide: 1 }, t) },
  { id: 'grasshopper', name: 'Meadow grasshopper', latin: 'Pseudochorthippus parallelus', scale: 1.7, text: 'Its big back legs can launch it many times its own length. It sings by rubbing its legs against its wings.', draw: (c, t) => drawGrasshopper(c, { x: 0, y: 0, a: -0.4, size: 1, z: 0 }, t) },
  { id: 'bee', name: 'Honeybee', latin: 'Apis mellifera', scale: 3, text: 'Visits flowers for nectar and pollen. Its sting is barbed, so when it stings a mammal the sting stays behind and the bee dies.', draw: (c, t) => drawBee(c, { x: 0, y: 0, a: -0.4, size: 1, z: 0, id: 1 }, t) },
  { id: 'mantis', name: 'European mantis', latin: 'Mantis religiosa', scale: 1.2, text: 'Waits without moving, then snatches prey with spiked front legs in a fraction of a second. It can turn its head to look over its shoulder.', draw: (c, t) => drawMantis(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 0, biteT: 0 }, t) },
);
GUIDE.push(
  { id: 'wasp', name: 'Common wasp', latin: 'Vespula vulgaris', scale: 2.4, text: 'Hunts other insects to feed its larvae, flying the prey back to a paper nest. The adults themselves mostly drink sugary liquids.', draw: (c, t) => drawWasp(c, { x: 0, y: 0, a: -0.4, size: 1, z: 0, gait: 1, id: 1 }, t) },
  { id: 'earwig', name: 'Common earwig', latin: 'Forficula auricularia', scale: 2.2, text: 'Despite the old myth, it does not crawl into ears. Mothers guard their eggs and young all through the winter.', draw: (c, t) => drawEarwig(c, { x: 4, y: 0, a: -0.4, size: 1, gait: 1 }, t) },
  { id: 'slug', name: 'Large red slug', latin: 'Arion rufus', scale: 1.5, text: 'A snail without a shell. It breathes through a hole on its right side called a pneumostome.', draw: (c, t) => drawSlug(c, { x: 0, y: 0, a: -0.3, size: 1, id: 1, speedNow: 0 }, t) },
  { id: 'dungbeetle', name: 'Dung beetle', latin: 'Scarabaeidae', scale: 2, text: 'Rolls balls of dung much bigger than itself, walking backwards. Some species steer by the Milky Way at night.', draw: (c, t) => drawDungBeetle(c, { x: 10, y: 0, a: 0, size: 1, gait: 1, ball: true, bx: -12, by: 0, ballR: 11, roll: 0 }, t) },
  { id: 'cricket', name: 'Field cricket', latin: 'Gryllus campestris', scale: 1.8, text: 'Males sing by rubbing their wings together. Their ears are on their front legs.', draw: (c, t) => drawCricket(c, { x: 4, y: 0, a: -0.4, size: 1, z: 0 }, t) },
  { id: 'moth', name: 'Moth', latin: 'Lepidoptera', scale: 1.8, text: 'Most moths fly at night. Bright lights confuse their sense of which way is up, which is why they circle lamps.', draw: (c, t) => drawMoth(c, { x: 0, y: 0, a: -Math.PI / 2, z: 0, size: 1, id: 1 }, 0.1) },
  { id: 'hedgehog', name: 'European hedgehog', latin: 'Erinaceus europaeus', scale: 0.55, text: 'Carries thousands of spines and rolls into a prickly ball when threatened. It snuffles through the night eating beetles, worms and ants.', draw: (c, t) => drawHedgehog(c, { x: -12, y: 0, a: 0, size: 1 }, t) },
  { id: 'stick', name: 'Stick insect', latin: 'Phasmatodea', scale: 1.1, text: 'Looks, and even sways, like a twig to hide from birds. Many species can lay eggs without mating.', draw: (c, t) => drawStickInsect(c, { x: 4, y: 0, a: -0.3, size: 1, gait: 0, id: 1 }, t) },
  { id: 'termite', name: 'Termite', latin: 'Blattodea', scale: 3, text: 'Termites are really social cockroaches. Workers are soft and blind; soldiers have huge heads for defence. Some ants specialise in raiding them.', draw: (c, t) => drawTermite(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1, role: 'soldier' }, t) },
);
GUIDE.push(
  { id: 'harvestman', name: 'Harvestman', latin: 'Opiliones', scale: 1.4, text: 'Not a spider: it has one round body, no silk and no venom. It can shed a leg to escape, and the lost leg keeps twitching to distract the attacker.', draw: (c, t) => drawHarvestman(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1, bobT: 0 }, t) },
  { id: 'groundbeetle', name: 'Violet ground beetle', latin: 'Carabus violaceus', scale: 2, text: 'A fast night hunter with a metallic sheen. It hides under logs by day and chases down slugs, worms and lone ants after dark.', draw: (c, t) => drawGroundBeetle(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1, id: 1 }, t) },
  { id: 'jumper', name: 'Zebra jumping spider', latin: 'Salticus scenicus', scale: 2.6, text: 'Has some of the sharpest eyes of any small animal and will turn to watch you. Instead of a web, it stalks and leaps onto prey many body lengths away.', draw: (c, t) => drawJumper(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1 }, t) },
  { id: 'toad', name: 'Common toad', latin: 'Bufo bufo', scale: 0.8, text: 'Drier and wartier than a frog, it walks more than it hops. The glands behind its eyes ooze a bitter poison that puts off predators.', draw: (c, t) => drawFrog(c, { x: 0, y: 0, a: -0.4, size: 1, warty: true, pal: ['#7a5a34', '#c49a64', '#3a2410'], id: 3 }, t) },
  { id: 'shrew', name: 'Common shrew', latin: 'Sorex araneus', scale: 0.9, text: 'Its heart can beat over 1,000 times a minute. A shrew must eat about its own weight every day, so it hunts almost without rest.', draw: (c, t) => drawShrew(c, { x: 4, y: 0, a: -0.4, size: 1, gait: 1, id: 3, speedNow: 0 }, t) },
  { id: 'strider', name: 'Pond skater', latin: 'Gerris lacustris', scale: 2.4, text: 'Water-repellent hairs on its feet let it stand on the surface film of ponds. It feels the ripples of insects that fall in and rows across to eat them.', draw: (c, t) => drawStrider(c, { x: 0, y: 0, a: -0.4 }, t) },
  { id: 'newt', name: 'Smooth newt', latin: 'Lissotriton vulgaris', scale: 1.4, text: 'An amphibian that lives on land for most of the year and returns to ponds to breed. Males grow a wavy crest in spring.', draw: (c, t) => drawNewt(c, { x: 6, y: 0, a: -0.3, size: 1, sway: 0.6, gait: 1 }, t) },
  { id: 'mole', name: 'European mole', latin: 'Talpa europaea', scale: 0.75, text: 'Digs up to 20 metres of tunnel a day with spade-like hands. It stores live worms in a larder, having bitten their heads to stop them escaping.', draw: (c, t) => drawMole(c, { x: 0, y: 0, a: -0.3, size: 1, gait: 1, id: 3 }, t) },
  { id: 'assassin', name: 'Assassin bug', latin: 'Reduviidae', scale: 2.2, text: 'Waits motionless, then stabs prey with its curved beak and injects saliva that turns the insides to liquid. Some species specialise in hunting ants.', draw: (c, t) => drawAssassin(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1 }, t) },
  { id: 'rove', name: 'Rove beetle', latin: 'Staphylinidae', scale: 2.6, text: 'The largest family of beetles. Its wing cases are tiny, leaving the abdomen bare, and it raises its tail like a scorpion when threatened.', draw: (c, t) => drawRove(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1, tail: 0.7 }, t) },
  { id: 'vole', name: 'Field vole', latin: 'Microtus agrestis', scale: 0.9, text: 'A small, round-faced rodent that makes runways through long grass. It is food for owls, kestrels, weasels and foxes.', draw: (c, t) => drawVole(c, { x: 0, y: 0, a: -0.4, size: 1, gait: 1, id: 2 }, t) },
  { id: 'hoverfly', name: 'Hoverfly', latin: 'Syrphidae', scale: 3, text: 'Wears wasp stripes as a disguise but cannot sting. It can hang perfectly still in mid-air, then dart off in a blink.', draw: (c, t) => drawHoverfly(c, { x: 0, y: 0, a: -0.4, z: 0, id: 1 }, t) },
);
const plantPortrait = (kind) => (c) => { const spr = canopySprite({ seed: 9000 + kind.length, kind, cr: 60, tr: 12 }); c.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h); };
GUIDE.push(
  { id: 'plant:oak', name: 'English oak', latin: 'Quercus robur', scale: 0.55, text: 'A single oak can support hundreds of kinds of insect. In autumn it drops acorns that animals carry off and bury.', draw: plantPortrait('oak') },
  { id: 'plant:pine', name: 'Scots pine', latin: 'Pinus sylvestris', scale: 0.55, text: 'Red wood ants often build their mounds from its fallen needles. Its bark turns orange-red towards the top.', draw: plantPortrait('pine') },
  { id: 'plant:birch', name: 'Silver birch', latin: 'Betula pendula', scale: 0.55, text: 'Its white bark reflects sunlight. It is one of the first trees to grow on bare ground.', draw: plantPortrait('birch') },
  { id: 'plant:willow', name: 'Weeping willow', latin: 'Salix babylonica', scale: 0.55, text: 'Grows best with its roots near water. Willow bark contains salicin, a natural relative of aspirin.', draw: plantPortrait('willow') },
  { id: 'plant:bush', name: 'Bramble', latin: 'Rubus fruticosus', scale: 0.7, text: 'Its blackberries feed birds, mammals and insects alike. Shake it and ripe berries fall for your sisters.', draw: (c) => { const f = { seed: 77, berries: 6, x: 0, y: 0 }; const spr = bushSprite(f); c.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h); } },
  { id: 'plant:sunflower', name: 'Sunflower', latin: 'Helianthus annuus', scale: 0.75, text: 'The seeds in its head are packed in spirals that follow the Fibonacci numbers. Young flower heads turn to follow the sun.', draw: (c) => { const spr = sunflowerSprite({ seed: 78 }); c.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h); } },
  { id: 'plant:sundew', name: 'Round-leaved sundew', latin: 'Drosera rotundifolia', scale: 2, text: 'A carnivorous bog plant. Insects stick to its glistening drops, and the tentacles slowly curl around them.', draw: (c) => drawSundew(c, { x: 0, y: 0, seed: 5, curl: 0 }, 0.5) },
);
const guideEntry = (id) => GUIDE.find((g) => g.id === id);

function renderPortrait(canvas, sp, w, h, t = 0.4) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.translate(w / 2, h / 2);
  const s = sp.scale * (h / 84);
  c.scale(s, s);
  sp.draw(c, t);
}

/* ---------------------------------------------------------- goals */

const OBJECTIVES = [
  { text: 'Carry 5 bits of food home', done: (g) => g.stats.playerDelivered >= 5, prog: (g) => `${Math.min(5, g.stats.playerDelivered)}/5` },
  { text: 'Use your special ability', done: (g) => g.stats.abilityUsed },
  { text: 'Rally your sisters to follow you', done: (g) => g.stats.rallied },
  { text: 'Haul a big prize home as a team', done: (g) => g.stats.bigDelivered >= 1 },
  { text: 'Dig or enlarge a chamber in the nest', done: (g) => g.stats.dug >= 1 },
  { text: 'Grow the colony to 40 ants', done: (g) => g.stats.peak >= 40, prog: (g) => `${Math.min(40, g.counts.home)}/40` },
  { text: 'Explore 4 kinds of land', done: (g) => g.stats.biomes.size >= 4, prog: (g) => `${g.stats.biomes.size}/4` },
  { text: 'Bring down a big predator', done: (g) => g.stats.bigKills >= 1 },
  { text: 'Topple a rival ant nest', done: (g) => g.stats.nestsDown >= 1 },
  { text: 'Fill 20 field guide pages', done: (g) => g.discovered.size >= 20, prog: (g) => `${g.discovered.size}/20` },
  { text: 'Place a scent beacon for foragers', done: (g) => g.toldOnce.has('beacon') },
  { text: 'Raid a termite mound', done: (g) => (g.stats.termites || 0) >= 5, prog: (g) => `${Math.min(5, g.stats.termites || 0)}/5` },
  { text: 'Dig an overwintering hall', done: (g) => g.home.chambers.winter >= 1 },
  { text: 'Survive your first winter', done: (g) => g.days >= 4 },
  { text: 'Grow the colony to 100 ants', done: (g) => g.stats.peak >= 100, prog: (g) => `${Math.min(100, g.counts.home)}/100` },
  { text: 'Topple 3 rival nests', done: (g) => g.stats.nestsDown >= 3, prog: (g) => `${g.stats.nestsDown}/3` },
];

/* ----------------------------------------------------------------- HUD */

class UI {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    const ids = ['hud', 'colName', 'sFood', 'sCap', 'sWorkers', 'sSoldiers', 'sBrood', 'leafRow', 'sLeaves', 'bWorker', 'bSoldier', 'bNest', 'autoHatch', 'costW', 'costS',
      'goals', 'goalCount', 'hpBar', 'hpText', 'xpBar', 'lvl', 'abilityBtn', 'abilityName', 'abilityCd', 'status', 'followers', 'prompt',
      'minimap', 'biomeName', 'clockText', 'clockDial', 'weatherText', 'rival', 'rivalName', 'rivalBar', 'toasts', 'scentBtn',
      'discover', 'dPortrait', 'dName', 'dLatin', 'dText', 'dCount', 'guide', 'guideGrid', 'guideCount',
      'title', 'speciesGrid', 'spName', 'spLatin', 'spBlurb', 'spStats', 'spAbility', 'spPerk', 'continueBtn', 'continueInfo', 'startBtn',
      'seasonText', 'upkeep', 'stamBar', 'perkPick', 'perkGrid', 'perkLevel', 'pause', 'over', 'overTitle', 'overText', 'touch', 'joy', 'knob', 'nestPanel', 'npTitle', 'npPips', 'npDesc', 'npNext', 'npBtn', 'npBrood', 'npLayW', 'npLayS', 'npFood', 'tNest'];
    this.el = {};
    for (const id of ids) this.el[id] = $(id);
    this.el.scent = this.el.scentBtn;
    this.acc = 0; this.mapAcc = 0; this.discoverT = 0; this.mapCenter = null;
    this.pickSpecies = 'garden';
    const g = game;
    this.el.bWorker.addEventListener('click', () => g.layEgg('worker'));
    this.el.bSoldier.addEventListener('click', () => g.layEgg('soldier'));
    this.el.bNest.addEventListener('click', () => (g.view === 'nest' ? g.exitNest() : g.enterNest()));
    this.el.autoHatch.addEventListener('change', () => { g.home.autoHatch = this.el.autoHatch.checked; });
    this.el.abilityBtn.addEventListener('click', () => g.useAbility());
    this.el.startBtn.addEventListener('click', () => g.start(this.pickSpecies));
    this.el.continueBtn.addEventListener('click', () => { const d = Game.loadSave(); if (d) g.continueGame(d); });
    $('resumeBtn').addEventListener('click', () => g.setPaused(false));
    $('againBtn').addEventListener('click', () => location.reload());
    $('guideBtn').addEventListener('click', () => this.toggleGuide());
    $('soundBtn').addEventListener('click', () => g.toggleSound());
    this.soundIcon();
    $('guideClose').addEventListener('click', () => this.toggleGuide(false));
    $('pauseBtn').addEventListener('click', () => g.setPaused(true));
    $('npExit').addEventListener('click', () => g.exitNest());
    this.el.scent.addEventListener('click', () => g.toggleScent());
    $('discoverClose').addEventListener('click', () => { this.el.discover.hidden = true; });
    this.el.npBtn.addEventListener('click', () => {
      const key = g.nestView.roomKey(g.nestView.selected);
      const was = g.home.chambers[key];
      if (g.home.upgrade(key)) {
        g.stats.dug++;
        META.best('chambersDug', g.stats.dug);
        if (key === 'barracks') for (const a of g.ants) if (a.colony === g.home && a.role === 'soldier' && !a.isPlayer) { const f = a.hp / a.maxHp; a.applyStats('soldier', false); a.hp = a.maxHp * f; }
        this.toast(`${was ? 'Enlarged' : 'Dug'} the ${CHAMBERS[key].name.toLowerCase()}.`, 'good');
        g.save();
      }
      this.renderNestPanel();
    });
    this.el.npLayW.addEventListener('click', () => g.layEgg('worker'));
    this.el.npLayS.addEventListener('click', () => g.layEgg('soldier'));
    this.mapCtx = this.el.minimap.getContext('2d');
    $('homeBtn').addEventListener('click', () => { g.save(); location.reload(); });
    this.setupHome();
    this.buildSpeciesPicker();
    this.setupTouch();
  }

  /* -------------------------------------------------------------- title */

  buildSpeciesPicker() {
    const grid = this.el.speciesGrid;
    grid.innerHTML = '';
    this.spCanvases = [];
    for (const k of PLAYABLE) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'spcard'; b.dataset.sp = k;
      const cv = document.createElement('canvas');
      b.appendChild(cv);
      const nm = document.createElement('span');
      nm.textContent = ANT_SPECIES[k].name.replace(' ant', '');
      b.appendChild(nm);
      b.addEventListener('click', () => this.selectSpecies(k));
      grid.appendChild(b);
      this.spCanvases.push([cv, k]);
    }
    this.selectSpecies('garden');
    const save = Game.loadSave();
    if (save && ANT_SPECIES[save.species]) {
      this.el.continueBtn.hidden = false;
      this.el.continueInfo.hidden = false;
      this.el.continueInfo.textContent = `Saved ${ANT_SPECIES[save.species].name.toLowerCase()} colony, level ${save.level}, ${(save.pop.worker || 0) + (save.pop.soldier || 0) + 1} ants. Starting a new colony replaces it.`;
    }
    const tick = (now) => {
      if (!this.el.title.hidden) {
        for (const [cv, k] of this.spCanvases) {
          const sel = k === this.pickSpecies;
          renderPortrait(cv, { scale: 1 / ANT_SPECIES[k].shape.size, draw: (c, t) => drawAnt(c, { ...fakeAnt(k, 'worker', 2), a: -Math.PI / 2 + (sel ? Math.sin(now / 900) * 0.25 : 0), gait: sel ? now / 90 : 0.5, greetT: sel ? 1 : 0 }, t) }, 84, 64, now / 1000);
        }
        const k = this.pickSpecies;
        renderPortrait(this.$('homeArt'), { scale: 1, draw: (c, t) => {
          drawAnt(c, { ...fakeAnt(k, 'worker', 1.9 / ANT_SPECIES[k].shape.size), x: -40, y: 6, a: -0.1, gait: 0.6, greetT: 1 }, t);
          drawAnt(c, { ...fakeAnt(k, 'worker', 1.9 / ANT_SPECIES[k].shape.size), x: 40, y: -4, a: Math.PI + 0.15, gait: 2.1, greetT: 1, id: 9 }, t);
        } }, 190, 90, now / 1000);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------- home */

  setupHome() {
    const tabs = document.querySelectorAll('.tabs [data-tab]');
    for (const b of tabs) {
      b.addEventListener('click', () => {
        for (const o of tabs) { o.classList.toggle('on', o === b); o.setAttribute('aria-selected', o === b); }
        for (const p of document.querySelectorAll('.tabpanel')) p.hidden = p.dataset.panel !== b.dataset.tab;
        if (b.dataset.tab === 'achievements') this.renderAchievements();
        if (b.dataset.tab === 'records') this.renderRecords();
        if (b.dataset.tab === 'guidebook') this.guideCards(this.$('homeGuideGrid'), META.guide, this.$('homeGuideCount'));
      });
    }
    const n = Object.keys(META.unlocked).length;
    this.$('achCount').textContent = `${n}/${ACHIEVEMENTS.length}`;
    this.$('guideTabCount').textContent = `${META.guide.size}/${GUIDE.length}`;
  }

  medal(cv, a, got, size) {
    const sp = guideEntry(a.icon) || GUIDE[0];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.height = size * dpr; cv.style.width = cv.style.height = size + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = size / 2;
    const gr = c.createRadialGradient(r * 0.7, r * 0.6, 2, r, r, r);
    gr.addColorStop(0, got ? '#ffe9a6' : '#5a5848'); gr.addColorStop(0.7, got ? '#e0a83a' : '#3e3d32'); gr.addColorStop(1, got ? '#8a5a10' : '#26251e');
    c.fillStyle = gr; c.beginPath(); c.arc(r, r, r - 1, 0, TAU); c.fill();
    c.strokeStyle = got ? 'rgba(255,245,210,0.8)' : 'rgba(255,255,255,0.12)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(r, r, r - 4, 0, TAU); c.stroke();
    c.save(); c.beginPath(); c.arc(r, r, r - 5, 0, TAU); c.clip();
    c.translate(r, r);
    const k = sp.scale * (size / 84) * 0.8;
    c.scale(k, k);
    if (!got) c.globalAlpha = 0.35;
    sp.draw(c, 0.4);
    c.restore();
  }

  renderAchievements() {
    const grid = this.$('achGrid');
    grid.innerHTML = '';
    let n = 0;
    for (const a of ACHIEVEMENTS) {
      const got = !!META.unlocked[a.id];
      if (got) n++;
      const card = document.createElement('article');
      card.className = 'ach' + (got ? ' got' : '');
      const cv = document.createElement('canvas');
      card.appendChild(cv);
      const body = document.createElement('div');
      let extra = '';
      if (got) extra = `<p class="when">Earned ${new Date(META.unlocked[a.id]).toLocaleDateString()}</p>`;
      else if (a.prog) {
        const [v, max] = a.prog(META);
        extra = `<div class="pbar"><i style="transform:scaleX(${clamp(v / max, 0, 1)})"></i></div><p class="when">${Math.min(v, max).toLocaleString()} / ${max.toLocaleString()}</p>`;
      }
      body.innerHTML = `<h3>${a.name}</h3><p>${a.desc}</p>${extra}`;
      card.appendChild(body);
      grid.appendChild(card);
      this.medal(cv, a, got, 56);
    }
    this.$('achSummary').textContent = `${n} of ${ACHIEVEMENTS.length} earned. Achievements carry over between colonies.`;
  }

  renderRecords() {
    const m = META, fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const yrs = (d) => (d >= 4 ? `${Math.floor(d / 4)} yr ${d % 4} seasons` : `${d} season${d === 1 ? '' : 's'}`);
    const tiles = [
      ['Longest life as one ant', fmt(m.r.longestLife), 'The number on the UsForge leaderboard'],
      ['Biggest colony', m.r.biggestColony, 'ants alive at once'],
      ['Longest-lived colony', yrs(m.r.mostDays), ''],
      ['Highest level', m.r.highestLevel, ''],
      ['Farthest from home', `${m.r.farthest.toLocaleString()} steps`, ''],
      ['Biggest single haul', `${m.r.biggestHaul} food`, ''],
      ['Colonies founded', m.t.colonies, ''],
      ['Sisters raised', m.t.antsRaised.toLocaleString(), ''],
      ['Food stored', m.t.colonyLoads.toLocaleString(), 'loads, all colonies'],
      ['Food you carried', m.t.playerLoads.toLocaleString(), 'loads'],
      ['Rival nests toppled', m.t.nests, ''],
      ['Lives lived', m.t.lives, ''],
    ];
    this.$('recordGrid').innerHTML = tiles.map(([l, v, s]) => `<div class="rec"><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`).join('');
    const kills = Object.entries(m.kills).sort((a, b) => b[1] - a[1]);
    const kg = this.$('killGrid');
    kg.innerHTML = kills.length ? '' : '<p class="sub">Nothing yet. Rally your sisters and go hunting.</p>';
    for (const [kind, n] of kills) {
      const sp = guideEntry(kind);
      const d = document.createElement('div');
      d.className = 'kill';
      const cv = document.createElement('canvas');
      d.appendChild(cv);
      d.insertAdjacentHTML('beforeend', `<span>${sp ? sp.name : kind}</span><b>${n.toLocaleString()}</b>`);
      kg.appendChild(d);
      if (sp) renderPortrait(cv, sp, 44, 34);
    }
  }

  openPerks(choices) {
    const g = this.game, el = this.el;
    this.perkChoices = choices;
    el.perkLevel.textContent = `Level ${g.level}`;
    el.perkGrid.innerHTML = '';
    choices.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'perk';
      const have = g.perk(k.id);
      b.innerHTML = `<kbd>${i + 1}</kbd><h3>${k.name}</h3><p>${k.desc}</p><div class="pips">${Array.from({ length: k.max }, (_, j) => `<i class="${j < have ? 'on' : j === have ? 'next' : ''}"></i>`).join('')}</div>`;
      b.addEventListener('click', () => this.pickPerk(i));
      el.perkGrid.appendChild(b);
    });
    el.perkPick.hidden = false;
  }
  pickPerk(i) {
    const k = this.perkChoices && this.perkChoices[i];
    if (!k) return;
    this.el.perkPick.hidden = true;
    this.perkChoices = null;
    this.game.choosePerk(k.id);
  }

  soundIcon() {
    const b = document.getElementById('soundBtn');
    if (b) { b.textContent = SFX.muted ? 'Muted' : 'Sound'; b.classList.toggle('off', SFX.muted); }
  }

  achievement(a) {
    const el = this.$('achToast');
    SFX.achievement();
    el.hidden = false;
    this.$('achName').textContent = `${a.name}: ${a.desc}`;
    this.medal(this.$('achIcon'), a, true, 46);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(this.achTimer);
    this.achTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  selectSpecies(k) {
    this.pickSpecies = k;
    const s = ANT_SPECIES[k], el = this.el;
    for (const b of el.speciesGrid.children) b.classList.toggle('on', b.dataset.sp === k);
    el.spName.textContent = s.name;
    el.spLatin.textContent = s.latin;
    el.spBlurb.textContent = s.blurb;
    const bar = (label, v, max) => `<div><span>${label}</span><i><b style="transform:scaleX(${clamp(v / max, 0.08, 1)})"></b></i></div>`;
    el.spStats.innerHTML = bar('Speed', s.stats.speed, 1.25) + bar('Toughness', s.stats.hp, 2.3) + bar('Bite', s.stats.dmg, 2.1) + bar('Cheap to raise', 16 - s.costW, 11);
    el.spAbility.innerHTML = `<b>${s.ability.name}</b> ${s.ability.desc}`;
    el.spPerk.textContent = s.perk;
    el.startBtn.textContent = `Found a ${s.name.toLowerCase()} colony`;
  }

  onStart() {
    const g = this.game, el = this.el, sp = ANT_SPECIES[g.species];
    el.title.hidden = true;
    el.hud.hidden = false;
    el.over.hidden = true;
    this.mapCenter = null; this.lastGoals = null;
    el.colName.textContent = `${sp.name} colony`;
    el.costW.textContent = sp.costW; el.costS.textContent = sp.costS;
    el.leafRow.hidden = g.species !== 'leafcutter';
    el.autoHatch.checked = g.home.autoHatch;
    el.abilityName.textContent = sp.ability.name;
    el.abilityBtn.title = `${sp.ability.name} (F): ${sp.ability.desc}`;
  }

  /* -------------------------------------------------------------- touch */

  setupTouch() {
    const g = this.game, el = this.el;
    if (!g.isTouch) return;
    el.touch.hidden = false;
    document.body.classList.add('touch');
    let id = null, ox = 0, oy = 0;
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = (e.clientX - ox) / 46, dy = (e.clientY - oy) / 46;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      g.input.joy.x = dx; g.input.joy.y = dy;
      el.knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    el.joy.addEventListener('pointerdown', (e) => {
      id = e.pointerId; el.joy.setPointerCapture(id);
      const r = el.joy.getBoundingClientRect();
      ox = r.left + r.width / 2; oy = r.top + r.height / 2;
      move(e);
    });
    const end = (e) => { if (e.pointerId !== id) return; id = null; g.input.joy.x = 0; g.input.joy.y = 0; el.knob.style.transform = ''; };
    el.joy.addEventListener('pointermove', move);
    el.joy.addEventListener('pointerup', end);
    el.joy.addEventListener('pointercancel', end);
    const hold = (btn, on, off) => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.classList.add('on'); on(); });
      const up = () => { btn.classList.remove('on'); off && off(); };
      btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
    };
    hold(this.$('tBite'), () => { g.input.touchBite = true; }, () => { g.input.touchBite = false; });
    hold(this.$('tGrab'), () => g.input.just.add('KeyE'));
    hold(this.$('tRally'), () => g.input.just.add('KeyQ'));
    hold(this.$('tAbility'), () => g.useAbility());
    hold(this.$('tBeacon'), () => g.placeBeacon());
    hold(this.$('tDash'), () => g.dash());
    hold(this.$('tTrail'), () => { g.input.touchTrail = true; }, () => { g.input.touchTrail = false; });
    hold(this.el.tNest, () => (g.view === 'nest' ? g.exitNest() : g.enterNest()));
  }

  /* -------------------------------------------------------------- update */

  update(dt) {
    const g = this.game, el = this.el;
    this.acc += dt; this.mapAcc += dt;
    if (this.discoverT > 0) { this.discoverT -= dt; if (this.discoverT <= 0) el.discover.hidden = true; }
    if (this.mapAcc > 0.2 && g.view === 'world') { this.mapAcc = 0; this.drawMap(); }
    if (this.acc < 0.12) return;
    this.acc = 0;
    const h = g.home, c = g.counts, sp = ANT_SPECIES[g.species];
    el.sFood.textContent = Math.floor(h.food);
    el.sCap.textContent = `/${h.foodCap}`;
    el.sWorkers.textContent = c.home - c.homeSoldiers;
    el.sSoldiers.textContent = c.homeSoldiers;
    el.sBrood.textContent = h.brood.length;
    if (!el.leafRow.hidden) el.sLeaves.textContent = Math.floor(h.leaves);
    el.bWorker.disabled = !!h.layBlocker('worker');
    el.bSoldier.disabled = !!h.layBlocker('soldier');
    el.bNest.textContent = g.view === 'nest' ? 'Leave nest' : 'Enter nest';
    const p = g.player;
    if (p && !p.dead) {
      const f = clamp(p.hp / p.maxHp, 0, 1);
      el.hpBar.style.transform = `scaleX(${f})`;
      el.hpBar.classList.toggle('low', f < 0.35);
      el.hpText.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
      el.status.textContent = g.playerStatus();
    } else {
      el.hpBar.style.transform = 'scaleX(0)';
      el.hpText.textContent = '0';
      el.status.textContent = g.over ? 'The colony is gone.' : 'You fell. Waking as another sister…';
    }
    el.lvl.textContent = g.level;
    el.stamBar.style.transform = `scaleX(${clamp(g.stamina / 100, 0, 1)})`;
    el.stamBar.classList.toggle('low', g.stamina < 35);
    el.xpBar.style.transform = `scaleX(${clamp(g.xp / g.xpNeed(), 0, 1)})`;
    const cd = Math.max(0, g.abilityCd);
    el.abilityCd.style.transform = `scaleY(${clamp(cd / sp.ability.cd, 0, 1)})`;
    el.abilityBtn.classList.toggle('ready', cd <= 0);
    const fol = g.followerCount;
    el.followers.textContent = fol ? `${fol} sister${fol === 1 ? '' : 's'} following you` : '';
    const ctxa = g.view === 'world' ? g.contextAction() : null;
    const label = ctxa ? ctxa.label : '';
    if (el.prompt.dataset.l !== label) {
      el.prompt.dataset.l = label;
      el.prompt.hidden = !label;
      el.prompt.innerHTML = label ? `${ctxa.act && !g.isTouch ? `<kbd>${ctxa.key || 'E'}</kbd>` : ''}<span>${label}</span>` : '';
    }
    // goals: show the next four unfinished
    const done = OBJECTIVES.filter((o) => o.done(g)).length;
    const next = OBJECTIVES.filter((o) => !o.done(g)).slice(0, 4);
    const html = next.map((o) => `<li>${o.text}${o.prog ? ` <em>${o.prog(g)}</em>` : ''}</li>`).join('') || '<li class="done">Every goal complete. The meadow is yours to roam.</li>';
    if (html !== this.lastGoals) { el.goals.innerHTML = html; this.lastGoals = html; }
    el.goalCount.textContent = `${done}/${OBJECTIVES.length}`;
    // time, weather, place
    const d = g.dayT;
    const k = g.seasonK || 0;
    el.seasonText.textContent = k > 0.08 && k < 0.92 ? `${SEASON_NAMES[g.seasonA]} → ${SEASON_NAMES[g.seasonB]}` : SEASON_NAMES[k >= 0.92 ? g.seasonB : g.seasonA];
    el.upkeep.textContent = `Colony eats ${(h.upkeep || 0).toFixed(1)} food a minute${h.food < 5 && c.home > 3 ? ' · stores nearly empty!' : ''}`;
    el.upkeep.classList.toggle('warn', h.food < 5 && c.home > 3);
    el.clockText.textContent = d < 0.08 ? 'Dawn' : d < 0.3 ? 'Morning' : d < 0.5 ? 'Afternoon' : d < 0.62 ? 'Dusk' : d < 0.92 ? 'Night' : 'Dawn';
    el.clockDial.style.transform = `rotate(${d * 360}deg)`;
    el.weatherText.textContent = g.weather.k > 0.3 ? (g.sw[3] > 0.5 ? 'Snow' : 'Rain') : '';
    el.biomeName.textContent = BIOME_NAMES[g.biomeHere];
    // nearest rival
    let near = null, nd = Infinity;
    for (const col of g.activeColonies) {
      if (col.isPlayer) continue;
      const dd = p ? dist2(p.x, p.y, col.x, col.y) : 0;
      if (dd < nd) { nd = dd; near = col; }
    }
    el.rival.hidden = !near;
    if (near) {
      el.rivalName.textContent = `${near.sp.name} nest · ${g.countColony(near)} ants`;
      el.rivalBar.style.transform = `scaleX(${near.hp / near.maxHp})`;
    }
    if (g.view === 'nest') this.renderNestPanel(true);
  }

  drawMap() {
    const g = this.game, c = this.mapCtx, cv = this.el.minimap;
    const size = cv.clientWidth || 160;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); this.mapCenter = null; }
    const p = g.player && !g.player.dead ? g.player : { x: g.camera.x, y: g.camera.y, a: 0 };
    const R = 1400, W = cv.width, k = W / (R * 2);
    if (!this.mapCenter || dist2(p.x, p.y, this.mapCenter.x, this.mapCenter.y) > 250 * 250) this.buildThumb(p.x, p.y, R);
    const mc = this.mapCenter;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2a3418'; c.fillRect(0, 0, W, W);
    const off = [(mc.x - p.x) * k, (mc.y - p.y) * k];
    c.drawImage(this.mapThumb, off[0] - W * 0.1, off[1] - W * 0.1, W * 1.2, W * 1.2);
    const toMap = (x, y) => [W / 2 + (x - p.x) * k, W / 2 + (y - p.y) * k];
    const dot = (x, y, r, col) => { const [mx, my] = toMap(x, y); if (mx < -5 || my < -5 || mx > W + 5 || my > W + 5) return; c.fillStyle = col; c.beginPath(); c.arc(mx, my, r * dpr, 0, TAU); c.fill(); };
    for (const pit of g.world.activePits) dot(pit.x, pit.y, 3, '#d8c08a');
    for (const pt of g.activePatches) dot(pt.x, pt.y, 3.5, '#5aa040');
    for (const b of g.bigs) dot(b.x, b.y, 2.2, '#ffd36b');
    for (const a of g.ants) if (!a.isPlayer) dot(a.x, a.y, 1, a.colony === g.home ? '#1c120c' : '#e0502a');
    for (const cr of g.critters) if (cr.predator) dot(cr.x, cr.y, 2.4, '#ff8a70');
    for (const col of g.colonies.values()) {
      if (col.isPlayer) continue;
      const [mx, my] = toMap(col.x, col.y);
      if (mx < 0 || my < 0 || mx > W || my > W) continue;
      c.fillStyle = col.dead ? 'rgba(120,100,80,0.8)' : '#c8401c';
      c.beginPath(); c.arc(mx, my, 5 * dpr, 0, TAU); c.fill();
      c.strokeStyle = '#ffd0b0'; c.lineWidth = dpr; c.stroke();
    }
    for (const o of g.home.outposts) dot(o.x, o.y, 3.5, '#9ad060');
    for (const ev of g.events) {
      if (ev.kind !== 'picnic' || ev.fading) continue;
      const [ex, ey] = toMap(ev.x, ev.y);
      if (ex > 8 && ey > 8 && ex < W - 8 && ey < W - 8) {
        c.fillStyle = '#ff6a5a'; c.fillRect(ex - 4 * dpr, ey - 4 * dpr, 8 * dpr, 8 * dpr);
        c.strokeStyle = '#fff'; c.lineWidth = dpr; c.strokeRect(ex - 4 * dpr, ey - 4 * dpr, 8 * dpr, 8 * dpr);
      } else {
        const a = Math.atan2(ey - W / 2, ex - W / 2), r = W / 2 - 9 * dpr;
        c.save(); c.translate(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r); c.rotate(a);
        c.fillStyle = '#ff6a5a';
        c.beginPath(); c.moveTo(7 * dpr, 0); c.lineTo(-5 * dpr, -5 * dpr); c.lineTo(-5 * dpr, 5 * dpr); c.closePath(); c.fill();
        c.restore();
      }
    }
    const [hx, hy] = toMap(0, 0);
    if (hx > 6 && hy > 6 && hx < W - 6 && hy < W - 6) {
      c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(hx, hy, 5 * dpr, 0, TAU); c.fill();
      c.strokeStyle = '#3a2a10'; c.lineWidth = 1.5 * dpr; c.stroke();
    } else {
      const a = Math.atan2(hy - W / 2, hx - W / 2), r = W / 2 - 9 * dpr;
      const ax = W / 2 + Math.cos(a) * r, ay = W / 2 + Math.sin(a) * r;
      c.save(); c.translate(ax, ay); c.rotate(a);
      c.fillStyle = '#ffd36b';
      c.beginPath(); c.moveTo(7 * dpr, 0); c.lineTo(-5 * dpr, -5 * dpr); c.lineTo(-5 * dpr, 5 * dpr); c.closePath(); c.fill();
      c.restore();
    }
    c.save(); c.translate(W / 2, W / 2); c.rotate(p.a || 0);
    c.fillStyle = '#fff4d6';
    c.beginPath(); c.moveTo(6 * dpr, 0); c.lineTo(-4 * dpr, -4 * dpr); c.lineTo(-2 * dpr, 0); c.lineTo(-4 * dpr, 4 * dpr); c.closePath(); c.fill();
    c.restore();
  }

  buildThumb(cx, cy, R) {
    const g = this.game, w = g.world, N = 72;
    const cv = this.mapThumb || document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d'), img = c.createImageData(N, N);
    const span = R * 2.4;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = cx - span / 2 + (i + 0.5) * (span / N), y = cy - span / 2 + (j + 0.5) * (span / N);
      const [e, m] = w.em(x, y);
      const water = w.waterFrom(x, y, e, m) > 0;
      const col = hexRgb(MAP_COL[water ? 'sea' : w.classify(e, m)]);
      const k = (j * N + i) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    this.mapThumb = cv;
    this.mapCenter = { x: cx, y: cy };
  }

  /* ------------------------------------------------------------- nest */

  showNest(on) {
    this.el.nestPanel.hidden = !on;
    document.body.classList.toggle('innest', on);
    if (on) this.renderNestPanel();
  }

  renderNestPanel(quiet) {
    const g = this.game, el = this.el, h = g.home, nv = g.nestView;
    const key = nv.roomKey(nv.selected), def = CHAMBERS[key], lvl = h.chambers[key];
    const html = [def.name, lvl, Math.floor(h.food), h.brood.length].join('|');
    if (quiet && this.lastNest === html) return;
    this.lastNest = html;
    el.npTitle.textContent = def.name;
    el.npPips.innerHTML = Array.from({ length: def.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    el.npDesc.textContent = lvl ? def.desc(lvl) : 'Not dug yet.';
    const cost = h.upgradeCost(key);
    if (cost === null) { el.npNext.textContent = 'Fully dug.'; el.npBtn.hidden = true; }
    else {
      el.npNext.textContent = `Next: ${def.desc(lvl + 1)}`;
      el.npBtn.hidden = false;
      el.npBtn.textContent = `${lvl ? 'Enlarge' : 'Dig'} for ${cost} food`;
      el.npBtn.disabled = h.food < cost;
    }
    const st = { egg: 0, larva: 0, pupa: 0 };
    for (const b of h.brood) st[b.stage]++;
    el.npBrood.textContent = `${st.egg} eggs, ${st.larva} larvae, ${st.pupa} pupae · room for ${BROOD_CAP[h.chambers.nursery]}`;
    el.npFood.textContent = `${Math.floor(h.food)} of ${h.foodCap} food stored${h.chambers.fungus ? ` · ${Math.floor(h.leaves)} leaves for the fungus` : ''}`;
    el.npLayW.textContent = `Lay worker egg · ${h.costOf('worker')}`;
    el.npLayS.textContent = `Lay soldier egg · ${h.costOf('soldier')}`;
    el.npLayW.disabled = !!h.layBlocker('worker');
    el.npLayS.disabled = !!h.layBlocker('soldier');
  }

  /* -------------------------------------------------------------- toasts */

  toast(text, tone = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + tone;
    d.textContent = text;
    this.el.toasts.prepend(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 4800);
    setTimeout(() => d.remove(), 5400);
  }

  showDiscovery(sp, count) {
    const el = this.el;
    renderPortrait(el.dPortrait, sp, 120, 84);
    el.dName.textContent = sp.name;
    el.dLatin.textContent = sp.latin;
    el.dText.textContent = sp.text;
    el.dCount.textContent = `Field guide ${count} of ${GUIDE.length}`;
    el.discover.hidden = false;
    el.discover.classList.remove('pop'); void el.discover.offsetWidth; el.discover.classList.add('pop');
    this.discoverT = 9;
  }

  guideCards(grid, known, countEl) {
    grid.innerHTML = '';
    for (const sp of GUIDE) {
      const has = known.has(sp.id);
      const card = document.createElement('article');
      card.className = 'gcard' + (has ? '' : ' unknown');
      const cv = document.createElement('canvas');
      card.appendChild(cv);
      const body = document.createElement('div');
      body.innerHTML = has
        ? `<h3>${sp.name}</h3><p class="latin">${sp.latin}</p><p>${sp.text}</p>`
        : '<h3>Not yet seen</h3><p>Explore the meadow, woods, shore and marsh to find this.</p>';
      card.appendChild(body);
      grid.appendChild(card);
      renderPortrait(cv, sp, 96, 68);
      if (!has) cv.classList.add('silhouette');
    }
    if (countEl) countEl.textContent = `${GUIDE.filter((g) => known.has(g.id)).length} of ${GUIDE.length} found`;
  }

  toggleGuide(force) {
    const el = this.el, g = this.game;
    const show = force ?? el.guide.hidden;
    el.guide.hidden = !show;
    if (show) this.guideCards(el.guideGrid, g.discovered, el.guideCount);
    g.guideOpen = show;
  }
}
