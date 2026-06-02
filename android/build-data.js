// Generates android/data.js from the PopTracker pack JSON files so the
// manual Android tracker stays faithful to the original pack content.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const strip = (s) => s.replace(/^﻿/, '');
const readJson = (p) => JSON.parse(strip(fs.readFileSync(path.join(root, p), 'utf8')));

// ---- Key Items -------------------------------------------------------------
const items = readJson('items/items.json');
const code2img = {};
for (const it of items) {
  if (!it.codes || !it.img) continue;
  for (const c of it.codes.split(',')) {
    const k = c.trim();
    if (k && !code2img[k]) code2img[k] = it.img;
  }
}

const itemRows = [
  ['1st_Tablet', 'Pyramid_Page', 'Walse_Tower_Key', "Ifrit's_Fire", 'Moogle_Suit'],
  ['2nd_Tablet', 'Shrine_Page', 'Steamship_Key', 'SandwormBait', 'Mirage_Radar'],
  ['3rd_Tablet', 'Trench_Page', 'Submarine_Key', 'Hiryuu_Call', 'Adamantite'],
  ['4th_Tablet', 'Falls_Page', 'Big_Bridge_Key', 'Elder_Branch', 'W2_Keys'],
];

const itemNames = {
  '1st_Tablet': '1st Tablet', '2nd_Tablet': '2nd Tablet', '3rd_Tablet': '3rd Tablet', '4th_Tablet': '4th Tablet',
  'Pyramid_Page': 'Pyramid Page', 'Shrine_Page': 'Shrine Page', 'Trench_Page': 'Trench Page', 'Falls_Page': 'Falls Page',
  'Walse_Tower_Key': 'Walse Tower Key', 'Steamship_Key': 'Steamship Key', 'Submarine_Key': 'Submarine Key', 'Big_Bridge_Key': 'Big Bridge Key',
  "Ifrit's_Fire": "Ifrit's Fire", 'SandwormBait': 'Sandworm Bait', 'Hiryuu_Call': 'Hiryuu Call', 'Elder_Branch': 'Elder Branch',
  'Moogle_Suit': 'Moogle Suit', 'Mirage_Radar': 'Mirage Radar', 'Adamantite': 'Adamantite',
  'W2_Keys': 'W2 Keys (Anti-Barrier + Bracelet)',
};

const keyItems = itemRows.map((row) =>
  row.map((code) => {
    const img = code === 'W2_Keys' ? 'images/items/w2_keys.png' : code2img[code];
    if (!img) throw new Error('Missing image for item ' + code);
    return { code, name: itemNames[code] || code, img, kind: 'Key Item' };
  })
);

// ---- Bosses ----------------------------------------------------------------
const bosses = readJson('items/bosses.json');
const baseImg = {};
for (const b of bosses) if (b.type === 'toggle') baseImg[b.codes] = b.img;
const badgeFor = {};
for (const b of bosses) if (b.type === 'toggle_badged') badgeFor[b.codes] = baseImg[b.base_item];

// Pull each boss's vanilla name + location from the pack's location data.
// Sections are named "<Location> - <Boss> (Boss)" and carry hosted_item "<code>_hosted";
// some (e.g. Karlabos) only carry the hosted_item, so we fall back to the parent region.
const locData = readJson('locations/locations.json');
const bossMeta = {}; // code -> { name, location }
(function walkLoc(node, parentName) {
  if (Array.isArray(node)) { node.forEach((n) => walkLoc(n, parentName)); return; }
  if (!node || typeof node !== 'object') return;
  const here = typeof node.name === 'string' ? node.name : parentName;
  if (typeof node.hosted_item === 'string') {
    const m = node.hosted_item.match(/^(.*)_hosted$/);
    if (m) {
      const code = m[1];
      if (typeof node.name === 'string' && node.name.includes(' (Boss)')) {
        const clean = node.name.replace(/\s*\(Boss\)\s*$/, '');
        const dash = clean.indexOf(' - ');
        if (dash >= 0) bossMeta[code] = { name: clean.slice(dash + 3).trim(), location: clean.slice(0, dash).trim() };
        else bossMeta[code] = { name: clean.trim(), location: parentName || '' };
      } else if (!bossMeta[code]) {
        bossMeta[code] = { name: null, location: here || parentName || '' };
      }
    }
  }
  for (const k in node) if (node[k] && typeof node[k] === 'object') walkLoc(node[k], here);
})(locData, '');

// Bosses that aren't AP check-locations have no pack section, plus a couple of
// name fixups. Vanilla locations confirmed against the FFV wiki / guides.
const bossOverrides = {
  karlibos: { name: 'Karlabos', location: 'Torna Canal' },
  gargoyle: { name: 'Gargoyle', location: 'Great Sea Trench' },
  ramuh: { name: 'Ramuh', location: 'World 1 Forest (random encounter)' },
  golem: { name: 'Golem', location: 'Drakenvale (random encounter)' },
  shoat: { name: 'Catoblepas (Shoat)', location: 'World 2 Forest Island, by submarine (random)' },
  calofisteri: { name: 'Calofisteri', location: 'Interdimensional Rift — Forest' },
  apanda: { name: 'Apanda', location: 'Interdimensional Rift — Library' },
  apocalypse: { name: 'Apocalypse (Azulmagia)', location: 'Interdimensional Rift — Castle Dungeon' },
  catastroph: { name: 'Catastrophe', location: 'Interdimensional Rift — Castle' },
  halicarnaso: { name: 'Halicarnassus', location: 'Interdimensional Rift — Throne Room' },
  twintania: { name: 'Twintania', location: 'Interdimensional Rift — Castle Roof' },
  necrophobe: { name: 'Necrophobe', location: 'Interdimensional Rift — Final Area' },
};

const bossRows = [
  ['wingraptorx', 'karlibosx', 'sirenx', 'magisax', 'galurax', 'shivax', 'liquidflamex'],
  ['ironclawx', 'ifritx', 'byblosx', 'sandwormx', 'adamantx', 'solcannonx', 'archaeavisx'],
  ['crayclawx', 'chimbrainx', 'titanx', 'puroborosx', 'tyrasaurusx', 'abductorx', 'hiryuuplantx'],
  ['guardianx', 'atomosx', 'carbunklex', 'gilga1x', 'gilga2x', 'gilgaenkix', 'gilga4x'],
  ['antlionx', 'gargoylex', 'merugenex', 'stalkerx', 'leviathanx', 'tritonx', 'omniscientx'],
  ['minotaurusx', 'gogox', 'odinx', 'bahamutx', 'ramuhx', 'shoatx', 'golemx'],
  ['calofisterix', 'apandax', 'apocalypsex', 'catastrophx', 'halicarnasox', 'twintaniax', 'necrophobex'],
];

const prettyBoss = (code) => {
  const base = code.replace(/x$/, '').replace(/(\d)$/, ' $1');
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const bossList = bossRows.map((row) =>
  row.map((code) => {
    const img = badgeFor[code];
    if (!img) throw new Error('Missing image for boss ' + code);
    const base = code.replace(/x$/, '');
    const ov = bossOverrides[base];
    const meta = bossMeta[base];
    const name = (ov && ov.name) || (meta && meta.name) || prettyBoss(code);
    const location = (ov && ov.location) || (meta && meta.location) || 'Unknown';
    return { code, name, img, kind: 'Boss', location };
  })
);

// ---- Jobs (Career Day crystals) -------------------------------------------
const jobs = readJson('items/jobs.json');
const jobImg = {};
for (const j of jobs) if (j.codes && j.codes.endsWith('_Crystal')) jobImg[j.codes] = j.img;

const jobRows = [
  ['Knight_Crystal', 'Monk_Crystal', 'Thief_Crystal', 'Dragoon_Crystal', 'Ninja_Crystal'],
  ['Samurai_Crystal', 'Berserker_Crystal', 'Hunter_Crystal', 'MysticKnight_Crystal', 'WhiteMage_Crystal'],
  ['BlackMage_Crystal', 'TimeMage_Crystal', 'Summoner_Crystal', 'BlueMage_Crystal', 'RedMage_Crystal'],
  ['Trainer_Crystal', 'Chemist_Crystal', 'Geomancer_Crystal', 'Bard_Crystal', 'Dancer_Crystal'],
  ['Mimic_Crystal', 'Freelancer_Crystal'],
];

const jobList = jobRows.map((row) =>
  row.map((code) => {
    const img = jobImg[code];
    if (!img) throw new Error('Missing image for job ' + code);
    return { code, name: code.replace('_Crystal', '').replace(/([A-Z])/g, ' $1').trim() + ' Crystal', img, kind: 'Job Crystal' };
  })
);

// ---- Events ----------------------------------------------------------------
const events = [
  { code: 'piano_counter', name: 'Pianos', img: 'images/icons/piano.png', type: 'counter', max: 8, kind: 'Event', location: 'Play all 8 pianos across the world' },
  { code: 'exdeathw2', name: 'ExDeath (World 2)', img: 'images/bosses/exdeath.png', type: 'toggle', kind: 'Boss', location: "Castle of Bal / Exdeath's Castle (World 2)" },
  { code: 'exdeath', name: 'Neo ExDeath', img: 'images/bosses/neo_exdeath.png', type: 'toggle', kind: 'Boss', location: 'Interdimensional Rift — Final Floor' },
];

const data = { keyItems, bosses: bossList, jobs: jobList, events };

const out = '// AUTO-GENERATED by build-data.js from the PopTracker pack. Do not edit by hand.\n' +
  'window.TRACKER_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
fs.writeFileSync(path.join(__dirname, 'data.js'), out);

const count = keyItems.flat().length + bossList.flat().length + jobList.flat().length + events.length;
console.log('Wrote android/data.js with', count, 'trackables');
