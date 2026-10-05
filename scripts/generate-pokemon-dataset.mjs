// Generates src/main/resources/pokemon_gen1.ttl (DATA-002) from the tables below.
// Offline and deterministic: `node scripts/generate-pokemon-dataset.mjs` writes the file,
// `--check` fails when the committed Turtle differs from what the tables produce.
// Data follows the current games for the 151 Kanto species; evolution stages and
// links are counted only inside these 151 (e.g. Pichu is absent, so Pikachu is stage 1).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../src/main/resources/pokemon_gen1.ttl', import.meta.url));
const NS = 'http://easyquery.example.org/pokemon#';

const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

// Attacking type -> defending type multipliers; omitted pairs are neutral (1x).
const CHART = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

// number|name|category|height m|weight kg|types|HP Atk Def SpA SpD Spe|evolves from|method
// method: L<level>, a stone name, or Trade.
const POKEMON = `
1|Bulbasaur|Seed|0.7|6.9|Grass/Poison|45 49 49 65 65 45||
2|Ivysaur|Seed|1.0|13.0|Grass/Poison|60 62 63 80 80 60|1|L16
3|Venusaur|Seed|2.0|100.0|Grass/Poison|80 82 83 100 100 80|2|L32
4|Charmander|Lizard|0.6|8.5|Fire|39 52 43 60 50 65||
5|Charmeleon|Flame|1.1|19.0|Fire|58 64 58 80 65 80|4|L16
6|Charizard|Flame|1.7|90.5|Fire/Flying|78 84 78 109 85 100|5|L36
7|Squirtle|Tiny Turtle|0.5|9.0|Water|44 48 65 50 64 43||
8|Wartortle|Turtle|1.0|22.5|Water|59 63 80 65 80 58|7|L16
9|Blastoise|Shellfish|1.6|85.5|Water|79 83 100 85 105 78|8|L36
10|Caterpie|Worm|0.3|2.9|Bug|45 30 35 20 20 45||
11|Metapod|Cocoon|0.7|9.9|Bug|50 20 55 25 25 30|10|L7
12|Butterfree|Butterfly|1.1|32.0|Bug/Flying|60 45 50 90 80 70|11|L10
13|Weedle|Hairy Bug|0.3|3.2|Bug/Poison|40 35 30 20 20 50||
14|Kakuna|Cocoon|0.6|10.0|Bug/Poison|45 25 50 25 25 35|13|L7
15|Beedrill|Poison Bee|1.0|29.5|Bug/Poison|65 90 40 45 80 75|14|L10
16|Pidgey|Tiny Bird|0.3|1.8|Normal/Flying|40 45 40 35 35 56||
17|Pidgeotto|Bird|1.1|30.0|Normal/Flying|63 60 55 50 50 71|16|L18
18|Pidgeot|Bird|1.5|39.5|Normal/Flying|83 80 75 70 70 101|17|L36
19|Rattata|Mouse|0.3|3.5|Normal|30 56 35 25 35 72||
20|Raticate|Mouse|0.7|18.5|Normal|55 81 60 50 70 97|19|L20
21|Spearow|Tiny Bird|0.3|2.0|Normal/Flying|40 60 30 31 31 70||
22|Fearow|Beak|1.2|38.0|Normal/Flying|65 90 65 61 61 100|21|L20
23|Ekans|Snake|2.0|6.9|Poison|35 60 44 40 54 55||
24|Arbok|Cobra|3.5|65.0|Poison|60 95 69 65 79 80|23|L22
25|Pikachu|Mouse|0.4|6.0|Electric|35 55 40 50 50 90||
26|Raichu|Mouse|0.8|30.0|Electric|60 90 55 90 80 110|25|Thunder Stone
27|Sandshrew|Mouse|0.6|12.0|Ground|50 75 85 20 30 40||
28|Sandslash|Mouse|1.0|29.5|Ground|75 100 110 45 55 65|27|L22
29|Nidoran♀|Poison Pin|0.4|7.0|Poison|55 47 52 40 40 41||
30|Nidorina|Poison Pin|0.8|20.0|Poison|70 62 67 55 55 56|29|L16
31|Nidoqueen|Drill|1.3|60.0|Poison/Ground|90 92 87 75 85 76|30|Moon Stone
32|Nidoran♂|Poison Pin|0.5|9.0|Poison|46 57 40 40 40 50||
33|Nidorino|Poison Pin|0.9|19.5|Poison|61 72 57 55 55 65|32|L16
34|Nidoking|Drill|1.4|62.0|Poison/Ground|81 102 77 85 75 85|33|Moon Stone
35|Clefairy|Fairy|0.6|7.5|Fairy|70 45 48 60 65 35||
36|Clefable|Fairy|1.3|40.0|Fairy|95 70 73 95 90 60|35|Moon Stone
37|Vulpix|Fox|0.6|9.9|Fire|38 41 40 50 65 65||
38|Ninetales|Fox|1.1|19.9|Fire|73 76 75 81 100 100|37|Fire Stone
39|Jigglypuff|Balloon|0.5|5.5|Normal/Fairy|115 45 20 45 25 20||
40|Wigglytuff|Balloon|1.0|12.0|Normal/Fairy|140 70 45 85 50 45|39|Moon Stone
41|Zubat|Bat|0.8|7.5|Poison/Flying|40 45 35 30 40 55||
42|Golbat|Bat|1.6|55.0|Poison/Flying|75 80 70 65 75 90|41|L22
43|Oddish|Weed|0.5|5.4|Grass/Poison|45 50 55 75 65 30||
44|Gloom|Weed|0.8|8.6|Grass/Poison|60 65 70 85 75 40|43|L21
45|Vileplume|Flower|1.2|18.6|Grass/Poison|75 80 85 110 90 50|44|Leaf Stone
46|Paras|Mushroom|0.3|5.4|Bug/Grass|35 70 55 45 55 25||
47|Parasect|Mushroom|1.0|29.5|Bug/Grass|60 95 80 60 80 30|46|L24
48|Venonat|Insect|1.0|30.0|Bug/Poison|60 55 50 40 55 45||
49|Venomoth|Poison Moth|1.5|12.5|Bug/Poison|70 65 60 90 75 90|48|L31
50|Diglett|Mole|0.2|0.8|Ground|10 55 25 35 45 95||
51|Dugtrio|Mole|0.7|33.3|Ground|35 100 50 50 70 120|50|L26
52|Meowth|Scratch Cat|0.4|4.2|Normal|40 45 35 40 40 90||
53|Persian|Classy Cat|1.0|32.0|Normal|65 70 60 65 65 115|52|L28
54|Psyduck|Duck|0.8|19.6|Water|50 52 48 65 50 55||
55|Golduck|Duck|1.7|76.6|Water|80 82 78 95 80 85|54|L33
56|Mankey|Pig Monkey|0.5|28.0|Fighting|40 80 35 35 45 70||
57|Primeape|Pig Monkey|1.0|32.0|Fighting|65 105 60 60 70 95|56|L28
58|Growlithe|Puppy|0.7|19.0|Fire|55 70 45 70 50 60||
59|Arcanine|Legendary|1.9|155.0|Fire|90 110 80 100 80 95|58|Fire Stone
60|Poliwag|Tadpole|0.6|12.4|Water|40 50 40 40 40 90||
61|Poliwhirl|Tadpole|1.0|20.0|Water|65 65 65 50 50 90|60|L25
62|Poliwrath|Tadpole|1.3|54.0|Water/Fighting|90 95 95 70 90 70|61|Water Stone
63|Abra|Psi|0.9|19.5|Psychic|25 20 15 105 55 90||
64|Kadabra|Psi|1.3|56.5|Psychic|40 35 30 120 70 105|63|L16
65|Alakazam|Psi|1.5|48.0|Psychic|55 50 45 135 95 120|64|Trade
66|Machop|Superpower|0.8|19.5|Fighting|70 80 50 35 35 35||
67|Machoke|Superpower|1.5|70.5|Fighting|80 100 70 50 60 45|66|L28
68|Machamp|Superpower|1.6|130.0|Fighting|90 130 80 65 85 55|67|Trade
69|Bellsprout|Flower|0.7|4.0|Grass/Poison|50 75 35 70 30 40||
70|Weepinbell|Flycatcher|1.0|6.4|Grass/Poison|65 90 50 85 45 55|69|L21
71|Victreebel|Flycatcher|1.7|15.5|Grass/Poison|80 105 65 100 70 70|70|Leaf Stone
72|Tentacool|Jellyfish|0.9|45.5|Water/Poison|40 40 35 50 100 70||
73|Tentacruel|Jellyfish|1.6|55.0|Water/Poison|80 70 65 80 120 100|72|L30
74|Geodude|Rock|0.4|20.0|Rock/Ground|40 80 100 30 30 20||
75|Graveler|Rock|1.0|105.0|Rock/Ground|55 95 115 45 45 35|74|L25
76|Golem|Megaton|1.4|300.0|Rock/Ground|80 120 130 55 65 45|75|Trade
77|Ponyta|Fire Horse|1.0|30.0|Fire|50 85 55 65 65 90||
78|Rapidash|Fire Horse|1.7|95.0|Fire|65 100 70 80 80 105|77|L40
79|Slowpoke|Dopey|1.2|36.0|Water/Psychic|90 65 65 40 40 15||
80|Slowbro|Hermit Crab|1.6|78.5|Water/Psychic|95 75 110 100 80 30|79|L37
81|Magnemite|Magnet|0.3|6.0|Electric/Steel|25 35 70 95 55 45||
82|Magneton|Magnet|1.0|60.0|Electric/Steel|50 60 95 120 70 70|81|L30
83|Farfetch'd|Wild Duck|0.8|15.0|Normal/Flying|52 90 55 58 62 60||
84|Doduo|Twin Bird|1.4|39.2|Normal/Flying|35 85 45 35 35 75||
85|Dodrio|Triple Bird|1.8|85.2|Normal/Flying|60 110 70 60 60 110|84|L31
86|Seel|Sea Lion|1.1|90.0|Water|65 45 55 45 70 45||
87|Dewgong|Sea Lion|1.7|120.0|Water/Ice|90 70 80 70 95 70|86|L34
88|Grimer|Sludge|0.9|30.0|Poison|80 80 50 40 50 25||
89|Muk|Sludge|1.2|30.0|Poison|105 105 75 65 100 50|88|L38
90|Shellder|Bivalve|0.3|4.0|Water|30 65 100 45 25 40||
91|Cloyster|Bivalve|1.5|132.5|Water/Ice|50 95 180 85 45 70|90|Water Stone
92|Gastly|Gas|1.3|0.1|Ghost/Poison|30 35 30 100 35 80||
93|Haunter|Gas|1.6|0.1|Ghost/Poison|45 50 45 115 55 95|92|L25
94|Gengar|Shadow|1.5|40.5|Ghost/Poison|60 65 60 130 75 110|93|Trade
95|Onix|Rock Snake|8.8|210.0|Rock/Ground|35 45 160 30 45 70||
96|Drowzee|Hypnosis|1.0|32.4|Psychic|60 48 45 43 90 42||
97|Hypno|Hypnosis|1.6|75.6|Psychic|85 73 70 73 115 67|96|L26
98|Krabby|River Crab|0.4|6.5|Water|30 105 90 25 25 50||
99|Kingler|Pincer|1.3|60.0|Water|55 130 115 50 50 75|98|L28
100|Voltorb|Ball|0.5|10.4|Electric|40 30 50 55 55 100||
101|Electrode|Ball|1.2|66.6|Electric|60 50 70 80 80 150|100|L30
102|Exeggcute|Egg|0.4|2.5|Grass/Psychic|60 40 80 60 45 40||
103|Exeggutor|Coconut|2.0|120.0|Grass/Psychic|95 95 85 125 75 55|102|Leaf Stone
104|Cubone|Lonely|0.4|6.5|Ground|50 50 95 40 50 35||
105|Marowak|Bone Keeper|1.0|45.0|Ground|60 80 110 50 80 45|104|L28
106|Hitmonlee|Kicking|1.5|49.8|Fighting|50 120 53 35 110 87||
107|Hitmonchan|Punching|1.4|50.2|Fighting|50 105 79 35 110 76||
108|Lickitung|Licking|1.2|65.5|Normal|90 55 75 60 75 30||
109|Koffing|Poison Gas|0.6|1.0|Poison|40 65 95 60 45 35||
110|Weezing|Poison Gas|1.2|9.5|Poison|65 90 120 85 70 60|109|L35
111|Rhyhorn|Spikes|1.0|115.0|Ground/Rock|80 85 95 30 30 25||
112|Rhydon|Drill|1.9|120.0|Ground/Rock|105 130 120 45 45 40|111|L42
113|Chansey|Egg|1.1|34.6|Normal|250 5 5 35 105 50||
114|Tangela|Vine|1.0|35.0|Grass|65 55 115 100 40 60||
115|Kangaskhan|Parent|2.2|80.0|Normal|105 95 80 40 80 90||
116|Horsea|Dragon|0.4|8.0|Water|30 40 70 70 25 60||
117|Seadra|Dragon|1.2|25.0|Water|55 65 95 95 45 85|116|L32
118|Goldeen|Goldfish|0.6|15.0|Water|45 67 60 35 50 63||
119|Seaking|Goldfish|1.3|39.0|Water|80 92 65 65 80 68|118|L33
120|Staryu|Star Shape|0.8|34.5|Water|30 45 55 70 55 85||
121|Starmie|Mysterious|1.1|80.0|Water/Psychic|60 75 85 100 85 115|120|Water Stone
122|Mr. Mime|Barrier|1.3|54.5|Psychic/Fairy|40 45 65 100 120 90||
123|Scyther|Mantis|1.5|56.0|Bug/Flying|70 110 80 55 80 105||
124|Jynx|Human Shape|1.4|40.6|Ice/Psychic|65 50 35 115 95 95||
125|Electabuzz|Electric|1.1|30.0|Electric|65 83 57 95 85 105||
126|Magmar|Spitfire|1.3|44.5|Fire|65 95 57 100 85 93||
127|Pinsir|Stag Beetle|1.5|55.0|Bug|65 125 100 55 70 85||
128|Tauros|Wild Bull|1.4|88.4|Normal|75 100 95 40 70 110||
129|Magikarp|Fish|0.9|10.0|Water|20 10 55 15 20 80||
130|Gyarados|Atrocious|6.5|235.0|Water/Flying|95 125 79 60 100 81|129|L20
131|Lapras|Transport|2.5|220.0|Water/Ice|130 85 80 85 95 60||
132|Ditto|Transform|0.3|4.0|Normal|48 48 48 48 48 48||
133|Eevee|Evolution|0.3|6.5|Normal|55 55 50 45 65 55||
134|Vaporeon|Bubble Jet|1.0|29.0|Water|130 65 60 110 95 65|133|Water Stone
135|Jolteon|Lightning|0.8|24.5|Electric|65 65 60 110 95 130|133|Thunder Stone
136|Flareon|Flame|0.9|25.0|Fire|65 130 60 95 110 65|133|Fire Stone
137|Porygon|Virtual|0.8|36.5|Normal|65 60 70 85 75 40||
138|Omanyte|Spiral|0.4|7.5|Rock/Water|35 40 100 90 55 35||
139|Omastar|Spiral|1.0|35.0|Rock/Water|70 60 125 115 70 55|138|L40
140|Kabuto|Shellfish|0.5|11.5|Rock/Water|30 80 90 55 45 55||
141|Kabutops|Shellfish|1.3|40.5|Rock/Water|60 115 105 65 70 80|140|L40
142|Aerodactyl|Fossil|1.8|59.0|Rock/Flying|80 105 65 60 75 130||
143|Snorlax|Sleeping|2.1|460.0|Normal|160 110 65 65 110 30||
144|Articuno|Freeze|1.7|55.4|Ice/Flying|90 85 100 95 125 85||
145|Zapdos|Electric|1.6|52.6|Electric/Flying|90 90 85 125 90 100||
146|Moltres|Flame|2.0|60.0|Fire/Flying|90 100 90 125 85 90||
147|Dratini|Dragon|1.8|3.3|Dragon|41 64 45 50 50 50||
148|Dragonair|Dragon|4.0|16.5|Dragon|61 84 65 70 70 70|147|L30
149|Dragonite|Dragon|2.2|210.0|Dragon/Flying|91 134 95 100 100 80|148|L55
150|Mewtwo|Genetic|2.0|122.0|Psychic|106 110 90 154 90 130||
151|Mew|New Species|0.4|4.0|Psychic|100 100 100 100 100 100||
`;

const STAT_PROPERTIES = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];

const fail = (message) => { throw new Error(`pokemon dataset: ${message}`); };
const localName = (text) => text.replace('♀', 'F').replace('♂', 'M').replace(/[^A-Za-z0-9]/g, '');
const typeIri = (type) => `pk:${type}Type`;
const literal = (text) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en`;

const pokemon = POKEMON.trim().split('\n').map((line) => {
  const [number, name, category, height, weight, types, stats, from, method] = line.split('|');
  const typeList = types.split('/');
  typeList.forEach((type) => TYPES.includes(type) || fail(`unknown type ${type} for ${name}`));
  const statValues = stats.split(' ').map(Number);
  if (statValues.length !== 6 || statValues.some((value) => !Number.isInteger(value))) fail(`bad stats for ${name}`);
  return {
    number: Number(number), name, id: `pk:${localName(name)}`, category: `${category} Pokémon`, height, weight,
    types: typeList, stats: statValues, from: from ? Number(from) : null, method: method || null,
  };
});

if (pokemon.length !== 151) fail(`expected 151 Pokémon, found ${pokemon.length}`);
pokemon.forEach((entry, index) => entry.number === index + 1 || fail(`Pokédex number gap at ${entry.name}`));
const byNumber = new Map(pokemon.map((entry) => [entry.number, entry]));
for (const entry of pokemon) {
  if ((entry.from === null) !== (entry.method === null)) fail(`incomplete evolution for ${entry.name}`);
  if (entry.from !== null && !(entry.from < entry.number && byNumber.has(entry.from))) fail(`bad predecessor for ${entry.name}`);
  if (entry.method && !/^(L\d+|Trade|.+ Stone)$/.test(entry.method)) fail(`unknown evolution method for ${entry.name}`);
}

const counts = { 2: 0, 0.5: 0, 0: 0 };
for (const attacker of TYPES) {
  for (const [defender, multiplier] of Object.entries(CHART[attacker])) {
    if (!TYPES.includes(defender)) fail(`unknown chart type ${defender}`);
    counts[multiplier]++;
  }
}
if (counts[2] !== 51 || counts[0.5] !== 61 || counts[0] !== 8) fail(`unexpected chart counts ${JSON.stringify(counts)}`);

const multiplierAgainst = (attacker, defenders) =>
  defenders.reduce((product, defender) => product * (CHART[attacker][defender] ?? 1), 1);

for (const entry of pokemon) {
  entry.stage = entry.from === null ? 1 : byNumber.get(entry.from).stage + 1;
  entry.family = entry.from === null ? entry : byNumber.get(entry.from).family;
  entry.next = pokemon.filter((candidate) => candidate.from === entry.number);
}

const ITEMS = [...new Set(pokemon.map((entry) => entry.method).filter((method) => method && method.endsWith('Stone')))].sort();

// ── Turtle rendering ───────────────────────────────────────────────────────
const out = [];
const block = (subject, pairs) => {
  const lines = pairs.filter(([, object]) => object !== undefined && object !== null && !(Array.isArray(object) && !object.length));
  out.push(`${subject}`);
  lines.forEach(([predicate, object], index) => {
    const value = Array.isArray(object) ? object.join(' , ') : object;
    out.push(`    ${predicate} ${value} ${index === lines.length - 1 ? '.' : ';'}`);
  });
  out.push('');
};
const section = (title) => out.push('#'.repeat(65), `#    ${title}`, '#'.repeat(65), '');

out.push(
  '# First-generation Pokémon (National Pokédex #001-#151) for SPARQL EasyQuery (DATA-002).',
  '# Generated by scripts/generate-pokemon-dataset.mjs; edit the script, not this file.',
  '# Current-game typing, base stats and type chart; evolutions counted within these 151.',
  `@prefix pk: <${NS}> .`,
  '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
  '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
  '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
  '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
  '',
);

section('Classes');
for (const [name, label] of [['Pokemon', 'Pokémon'], ['Type', 'Type'], ['EvolutionFamily', 'Evolution family'],
  ['EvolutionTrigger', 'Evolution trigger'], ['Item', 'Item']]) {
  block(`pk:${name}`, [['rdf:type', 'owl:Class'], ['rdfs:label', literal(label)]]);
}

section('Object properties');
const objectProperties = [
  ['primaryType', 'primary type', 'Pokemon', 'Type'],
  ['secondaryType', 'secondary type', 'Pokemon', 'Type'],
  ['hasType', 'has type', 'Pokemon', 'Type'],
  ['weakTo', 'weak to', 'Pokemon', 'Type'],
  ['fourTimesWeakTo', 'four times weak to', 'Pokemon', 'Type'],
  ['resistantTo', 'resistant to', 'Pokemon', 'Type'],
  ['immuneTo', 'immune to', 'Pokemon', 'Type'],
  ['evolvesFrom', 'evolves from', 'Pokemon', 'Pokemon', 'evolvesInto'],
  ['evolvesInto', 'evolves into', 'Pokemon', 'Pokemon', 'evolvesFrom'],
  ['evolutionTrigger', 'evolution trigger', 'Pokemon', 'EvolutionTrigger'],
  ['evolutionItem', 'evolution item', 'Pokemon', 'Item'],
  ['inEvolutionFamily', 'in evolution family', 'Pokemon', 'EvolutionFamily'],
  ['nextInPokedex', 'next in Pokédex', 'Pokemon', 'Pokemon', 'previousInPokedex'],
  ['previousInPokedex', 'previous in Pokédex', 'Pokemon', 'Pokemon', 'nextInPokedex'],
  ['superEffectiveAgainst', 'super effective against', 'Type', 'Type'],
  ['notVeryEffectiveAgainst', 'not very effective against', 'Type', 'Type'],
  ['noEffectAgainst', 'no effect against', 'Type', 'Type'],
];
for (const [name, label, domain, range, inverse] of objectProperties) {
  block(`pk:${name}`, [['rdf:type', 'owl:ObjectProperty'], ['owl:inverseOf', inverse && `pk:${inverse}`],
    ['rdfs:domain', `pk:${domain}`], ['rdfs:range', `pk:${range}`], ['rdfs:label', literal(label)]]);
}

section('Datatype properties');
const datatypeProperties = [
  ['pokedexNumber', 'Pokédex number', 'xsd:integer'],
  ['category', 'category', 'rdf:langString'],
  ['heightMeters', 'height (m)', 'xsd:decimal'],
  ['weightKilograms', 'weight (kg)', 'xsd:decimal'],
  ['hp', 'HP', 'xsd:integer'],
  ['attack', 'Attack', 'xsd:integer'],
  ['defense', 'Defense', 'xsd:integer'],
  ['specialAttack', 'Sp. Atk', 'xsd:integer'],
  ['specialDefense', 'Sp. Def', 'xsd:integer'],
  ['speed', 'Speed', 'xsd:integer'],
  ['baseStatTotal', 'base stat total', 'xsd:integer'],
  ['evolutionStage', 'evolution stage', 'xsd:integer'],
  ['evolutionLevel', 'evolution level', 'xsd:integer'],
];
for (const [name, label, range] of datatypeProperties) {
  block(`pk:${name}`, [['rdf:type', 'owl:DatatypeProperty'], ['rdfs:domain', 'pk:Pokemon'],
    ['rdfs:range', range], ['rdfs:label', literal(label)]]);
}

section('Types');
for (const type of TYPES) {
  const against = (wanted) => TYPES.filter((defender) => CHART[type][defender] === wanted).map(typeIri);
  block(typeIri(type), [['rdf:type', 'pk:Type'], ['rdfs:label', literal(type)],
    ['pk:superEffectiveAgainst', against(2)], ['pk:notVeryEffectiveAgainst', against(0.5)],
    ['pk:noEffectAgainst', against(0)]]);
}

section('Evolution triggers and items');
for (const [name, label] of [['LevelUp', 'Level up'], ['UseItem', 'Use item'], ['Trade', 'Trade']]) {
  block(`pk:${name}`, [['rdf:type', 'pk:EvolutionTrigger'], ['rdfs:label', literal(label)]]);
}
for (const item of ITEMS) block(`pk:${localName(item)}`, [['rdf:type', 'pk:Item'], ['rdfs:label', literal(item)]]);

section('Evolution families');
for (const base of pokemon.filter((entry) => entry.family === entry)) {
  block(`pk:${localName(base.name)}Family`, [['rdf:type', 'pk:EvolutionFamily'], ['rdfs:label', literal(`${base.name} family`)]]);
}

section('Pokémon');
for (const entry of pokemon) {
  const effectiveness = TYPES.map((attacker) => [attacker, multiplierAgainst(attacker, entry.types)]);
  const typesWhere = (predicate) => effectiveness.filter(([, value]) => predicate(value)).map(([attacker]) => typeIri(attacker));
  const trigger = entry.method === null ? null
    : entry.method === 'Trade' ? 'pk:Trade'
      : /^L\d+$/.test(entry.method) ? 'pk:LevelUp' : 'pk:UseItem';
  out.push(`###  #${String(entry.number).padStart(3, '0')} ${entry.name}`);
  block(entry.id, [
    ['rdf:type', 'pk:Pokemon'],
    ['rdfs:label', literal(entry.name)],
    ['pk:pokedexNumber', entry.number],
    ['pk:category', literal(entry.category)],
    ['pk:heightMeters', entry.height],
    ['pk:weightKilograms', entry.weight],
    ['pk:primaryType', typeIri(entry.types[0])],
    ['pk:secondaryType', entry.types[1] && typeIri(entry.types[1])],
    ['pk:hasType', entry.types.map(typeIri)],
    ...STAT_PROPERTIES.map((property, index) => [`pk:${property}`, entry.stats[index]]),
    ['pk:baseStatTotal', entry.stats.reduce((sum, value) => sum + value, 0)],
    ['pk:weakTo', typesWhere((value) => value > 1)],
    ['pk:fourTimesWeakTo', typesWhere((value) => value === 4)],
    ['pk:resistantTo', typesWhere((value) => value > 0 && value < 1)],
    ['pk:immuneTo', typesWhere((value) => value === 0)],
    ['pk:inEvolutionFamily', `pk:${localName(entry.family.name)}Family`],
    ['pk:evolutionStage', entry.stage],
    ['pk:evolvesFrom', entry.from && byNumber.get(entry.from).id],
    ['pk:evolvesInto', entry.next.map((next) => next.id)],
    ['pk:evolutionTrigger', trigger],
    ['pk:evolutionLevel', trigger === 'pk:LevelUp' ? Number(entry.method.slice(1)) : null],
    ['pk:evolutionItem', trigger === 'pk:UseItem' ? `pk:${localName(entry.method)}` : null],
    ['pk:previousInPokedex', byNumber.get(entry.number - 1)?.id],
    ['pk:nextInPokedex', byNumber.get(entry.number + 1)?.id],
  ]);
}

const turtle = out.join('\n');
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== turtle) {
    console.error('src/main/resources/pokemon_gen1.ttl is out of date; run node scripts/generate-pokemon-dataset.mjs');
    process.exit(1);
  }
  console.log('pokemon_gen1.ttl matches the generator.');
} else {
  writeFileSync(output, turtle);
  console.log(`Wrote ${output} (${pokemon.length} Pokémon, ${TYPES.length} types).`);
}
