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

async function main() {
  const GAMEMASTER_URL = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json';
  const RANKINGS_URL   = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json';

  console.log('Fetching gamemaster...');
  const gamemaster = await fetchJSON(GAMEMASTER_URL);

  // Build speciesId → dex lookup
  const dexMap = new Map();
  for (const p of gamemaster.pokemon) {
    if (p.speciesId && p.dex) dexMap.set(p.speciesId, p.dex);
  }
  console.log(`Gamemaster loaded: ${dexMap.size} species`);

  console.log('Fetching Great League rankings...');
  const rankings = await fetchJSON(RANKINGS_URL);
  console.log(`Rankings loaded: ${rankings.length} entries`);

  let skipped = 0;
  const output = [];

  for (const entry of rankings) {
    const { speciesId, speciesName } = entry;
    const attackStat = entry.stats && entry.stats.atk;

    // Exclude shadows
    if (speciesId.endsWith('_shadow')) { skipped++; continue; }

    // Exclude megas
    if (speciesId.includes('_mega') || (speciesName && speciesName.startsWith('Mega '))) {
      skipped++; continue;
    }

    const dex = dexMap.get(speciesId);
    if (!dex) {
      console.warn(`  WARN: no dex found for "${speciesId}" — skipping`);
      skipped++;
      continue;
    }

    if (attackStat == null) {
      console.warn(`  WARN: no attackStat for "${speciesId}" — skipping`);
      skipped++;
      continue;
    }

    output.push({
      speciesId,
      speciesName,
      dex,
      attackStat: Math.round(attackStat * 10) / 10,
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
