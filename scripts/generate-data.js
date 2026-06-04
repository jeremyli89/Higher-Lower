const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// CPM values for levels 1, 1.5, 2, ... 51 (101 values)
const CPM = [
  0.094,        0.135137432, 0.16639787,  0.192650919, 0.21573247,
  0.236572661,  0.25572005,  0.273530381, 0.29024988,  0.306057377,
  0.3210876,    0.335445036, 0.34921268,  0.362457751, 0.37523559,
  0.387592406,  0.39956728,  0.411193551, 0.42250001,  0.432926419,
  0.44310755,   0.453059958, 0.46279839,  0.472336083, 0.48168495,
  0.491008451,  0.49985844,  0.508701765, 0.51739395,  0.525942511,
  0.53435433,   0.542787495, 0.55079269,  0.558830586, 0.56664917,
  0.574441195,  0.58207070,  0.589887917, 0.59740001,  0.604818814,
  0.61215729,   0.619399365, 0.62656713,  0.633644533, 0.64065295,
  0.647576426,  0.65443563,  0.661214806, 0.667934,    0.674577537,
  0.68116492,   0.687680648, 0.69414365,  0.700538673, 0.70688421,
  0.713164996,  0.71934,     0.725471,    0.7317,      0.734741009,
  0.73776948,   0.740785574, 0.74378943,  0.746781211, 0.74976104,
  0.752729087,  0.75568551,  0.758630378, 0.76156384,  0.764486065,
  0.76739717,   0.770297266, 0.7731865,   0.776064962, 0.77893275,
  0.781790077,  0.78463697,  0.787473045, 0.79030001,  0.792803950,
  0.79530001,   0.797800015, 0.80030001,  0.802819995, 0.80530003,
  0.807809978,  0.81029999,  0.812810027, 0.81529999,  0.817820022,
  0.82029999,   0.822830018, 0.82529999,  0.827840003, 0.83030001,
  0.832849979,  0.83529999,  0.837859979, 0.84029999,  0.842870009,
  0.84529999,
];

function calcCP(atk, def, hp, cpm) {
  return Math.max(10, Math.floor(atk * Math.sqrt(def) * Math.sqrt(hp) * cpm * cpm / 10));
}

function rank1AtkStat(baseAtk, baseDef, baseHp, cpCap) {
  let bestProduct = -1;
  let bestAtkStat = 0;

  for (let ivAtk = 0; ivAtk <= 15; ivAtk++) {
    const atk = baseAtk + ivAtk;
    for (let ivDef = 0; ivDef <= 15; ivDef++) {
      const def = baseDef + ivDef;
      for (let ivHp = 0; ivHp <= 15; ivHp++) {
        const hp = baseHp + ivHp;

        // Find the highest CPM where CP stays at or under the cap
        let bestCpm = 0;
        for (const cpm of CPM) {
          if (calcCP(atk, def, hp, cpm) <= cpCap) bestCpm = cpm;
          else break;
        }
        if (bestCpm === 0) continue;

        const atkStat  = atk * bestCpm;
        const defStat  = def * bestCpm;
        const hpStat   = Math.floor(hp * bestCpm);
        const product  = atkStat * defStat * hpStat;

        if (product > bestProduct) {
          bestProduct = product;
          bestAtkStat = atkStat;
        }
      }
    }
  }

  return bestAtkStat;
}

async function main() {
  const GAMEMASTER_URL = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json';
  const RANKINGS_URL   = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json';

  console.log('Fetching gamemaster...');
  const gamemaster = await fetchJSON(GAMEMASTER_URL);

  // Build speciesId → { dex, baseStats } lookup
  const pokemonMap = new Map();
  for (const p of gamemaster.pokemon) {
    if (p.speciesId && p.dex && p.baseStats) {
      pokemonMap.set(p.speciesId, { dex: p.dex, baseStats: p.baseStats });
    }
  }
  console.log(`Gamemaster loaded: ${pokemonMap.size} species`);

  console.log('Fetching Great League rankings...');
  const rankings = await fetchJSON(RANKINGS_URL);
  console.log(`Rankings loaded: ${rankings.length} entries`);

  let skipped = 0;
  const output = [];

  for (const entry of rankings) {
    const { speciesId, speciesName } = entry;

    if (speciesId.endsWith('_shadow')) { skipped++; continue; }
    if (speciesId.includes('_mega') || (speciesName && speciesName.startsWith('Mega '))) {
      skipped++; continue;
    }

    const pokemon = pokemonMap.get(speciesId);
    if (!pokemon) {
      console.warn(`  WARN: no data found for "${speciesId}" — skipping`);
      skipped++;
      continue;
    }

    const { dex, baseStats } = pokemon;
    const atkStat = rank1AtkStat(baseStats.atk, baseStats.def, baseStats.hp, 1500);

    if (atkStat === 0) {
      console.warn(`  WARN: could not compute rank 1 stat for "${speciesId}" — skipping`);
      skipped++;
      continue;
    }

    output.push({
      speciesId,
      speciesName,
      dex,
      attackStat: Math.floor(atkStat * 10) / 10,
    });
  }

  const outPath = path.resolve(__dirname, '../data/pokemon.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone!`);
  console.log(`  Written:  ${output.length} Pokemon`);
  console.log(`  Skipped:  ${skipped} (shadows, megas, missing data)`);
  console.log(`  Output:   ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
