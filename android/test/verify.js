// Drives the manual tracker on an emulated Android device and verifies:
//  - renders all trackables with real images (no broken images)
//  - tap toggles persist
//  - state auto-loads after reload (save-after-every-change)
//  - piano counter increments/decrements
//  - Clear button -> confirmation dialog -> Cancel keeps data, Confirm wipes it
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:8099/android/index.html';
const SHOT_DIR = path.join(__dirname, 'shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: true });

const assert = (cond, msg) => { if (!cond) { throw new Error('ASSERT FAILED: ' + msg); } console.log('  ok: ' + msg); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await context.newPage();
  const failedImgs = [];
  page.on('requestfailed', (r) => { if (r.url().match(/\.png$/)) failedImgs.push(r.url()); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  console.log('1. Load app');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.grid.bosses .cell');

  // count trackables rendered
  const counts = await page.evaluate(() => ({
    items: document.querySelectorAll('.grid.items .cell').length,
    jobs: document.querySelectorAll('.grid.jobs .cell').length,
    bosses: document.querySelectorAll('.grid.bosses .cell').length,
    events: document.querySelectorAll('.grid.events .cell').length,
  }));
  console.log('   rendered:', JSON.stringify(counts));
  assert(counts.items === 20, 'rendered 20 key items');
  assert(counts.jobs === 22, 'rendered 22 jobs');
  assert(counts.bosses === 49, 'rendered 49 bosses');
  assert(counts.events === 3, 'rendered 3 events');

  // verify no broken images (all naturalWidth > 0)
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('.cell img')].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src)
  );
  assert(broken.length === 0, 'no broken images (' + broken.length + ' broken)');
  await shot(page, '01-initial');

  console.log('2. Toggle some items/jobs/bosses');
  await page.click('.grid.items .cell[data-code="1st_Tablet"]');
  await page.click('.grid.items .cell[data-code="Ifrit\'s_Fire"]');
  await page.click('.grid.jobs .cell[data-code="Knight_Crystal"]');
  await page.click('.grid.jobs .cell[data-code="Ninja_Crystal"]');
  await page.click('.grid.bosses .cell[data-code="wingraptorx"]');
  await page.click('.grid.bosses .cell[data-code="omniscientx"]');
  await page.click('.grid.events .cell[data-code="exdeath"]');

  // increment piano counter 3x
  await page.click('.grid.events .cell[data-code="piano_counter"]');
  await page.click('.grid.events .cell[data-code="piano_counter"]');
  await page.click('.grid.events .cell[data-code="piano_counter"]');

  const onItem = await page.getAttribute('.grid.items .cell[data-code="1st_Tablet"]', 'class');
  assert(/\bon\b/.test(onItem), '1st_Tablet shows ON state');
  const knightPressed = await page.getAttribute('.grid.jobs .cell[data-code="Knight_Crystal"]', 'aria-pressed');
  assert(knightPressed === 'true', 'Knight_Crystal aria-pressed=true');
  const bossBadge = await page.$('.grid.bosses .cell[data-code="wingraptorx"] .check');
  assert(bossBadge !== null, 'defeated boss shows check badge overlay');
  const pianoTxt = await page.textContent('.grid.events .cell[data-code="piano_counter"] .count');
  assert(pianoTxt === '3/8', 'piano counter reads 3/8');
  await shot(page, '02-after-toggles');

  // verify it saved to localStorage immediately
  const saved = await page.evaluate(() => localStorage.getItem('ffv-career-day-tracker-v1'));
  const savedObj = JSON.parse(saved);
  assert(savedObj['1st_Tablet'] === true, 'localStorage has 1st_Tablet=true');
  assert(savedObj['piano_counter'] === 3, 'localStorage has piano_counter=3');
  assert(savedObj['Knight_Crystal'] === true, 'localStorage has Knight_Crystal=true');

  console.log('3. Reload -> state auto-loads');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.grid.bosses .cell');
  const afterReload = await page.evaluate(() => ({
    tablet: document.querySelector('.grid.items .cell[data-code="1st_Tablet"]').className,
    knight: document.querySelector('.grid.jobs .cell[data-code="Knight_Crystal"]').getAttribute('aria-pressed'),
    badge: !!document.querySelector('.grid.bosses .cell[data-code="wingraptorx"] .check'),
    piano: document.querySelector('.grid.events .cell[data-code="piano_counter"] .count').textContent,
    fresh: document.querySelector('.grid.items .cell[data-code="Moogle_Suit"]').className,
  }));
  assert(/\bon\b/.test(afterReload.tablet), 'after reload: 1st_Tablet still ON');
  assert(afterReload.knight === 'true', 'after reload: Knight still ON');
  assert(afterReload.badge === true, 'after reload: boss badge still present');
  assert(afterReload.piano === '3/8', 'after reload: piano still 3/8');
  assert(/\boff\b/.test(afterReload.fresh), 'after reload: untouched item still OFF');
  await shot(page, '03-after-reload');

  console.log('4. Long-press a boss shows name + vanilla location (and does NOT toggle)');
  async function longPress(selector) {
    const cell = page.locator(selector);
    await cell.scrollIntoViewIfNeeded();
    const box = await cell.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
  }
  // gargoylex starts OFF; long-press must reveal info without defeating it
  await longPress('.grid.bosses .cell[data-code="gargoylex"]');
  await page.waitForSelector('#infoOverlay:not([hidden])');
  const infoTitle = await page.textContent('#infoTitle');
  const infoBody = await page.textContent('#infoBody');
  assert(infoTitle === 'Gargoyle', 'info title is the boss name ("' + infoTitle + '")');
  assert(/Great Sea Trench/.test(infoBody), 'info body shows vanilla location ("' + infoBody + '")');
  const gargoyleClass = await page.getAttribute('.grid.bosses .cell[data-code="gargoylex"]', 'class');
  assert(/\boff\b/.test(gargoyleClass), 'long-press did NOT toggle the boss on');
  await shot(page, '06-boss-info');
  await page.click('#infoClose');
  await page.waitForSelector('#infoOverlay[hidden]', { state: 'attached' });

  // a Rift boss with an em-dash location
  await longPress('.grid.bosses .cell[data-code="twintaniax"]');
  await page.waitForSelector('#infoOverlay:not([hidden])');
  assert((await page.textContent('#infoTitle')) === 'Twintania', 'second boss name correct');
  assert(/Interdimensional Rift/.test(await page.textContent('#infoBody')), 'second boss location correct');
  await page.click('#infoClose');
  await page.waitForSelector('#infoOverlay[hidden]', { state: 'attached' });

  // long-press a key item shows what it unlocks
  await longPress('.grid.items .cell[data-code="Adamantite"]');
  await page.waitForSelector('#infoOverlay:not([hidden])');
  assert((await page.textContent('#infoTitle')) === 'Adamantite', 'key item info title correct');
  assert((await page.textContent('#infoKind')) === 'Key Item', 'key item info kind correct');
  assert(/World 2/.test(await page.textContent('#infoBody')), 'key item info shows what it unlocks');
  await shot(page, '07-item-unlocks');
  const adamantClass = await page.getAttribute('.grid.items .cell[data-code="Adamantite"]', 'class');
  assert(/\boff\b/.test(adamantClass), 'long-press did NOT toggle the key item on');
  await page.click('#infoClose');
  await page.waitForSelector('#infoOverlay[hidden]', { state: 'attached' });

  console.log('5. Piano counter: tapping past 8 wraps back to 0');
  // currently at 3 -> tap up to 8, then one more must reset to 0
  const pianoSel = '.grid.events .cell[data-code="piano_counter"]';
  for (let i = 0; i < 5; i++) await page.click(pianoSel); // 3 -> 8
  assert((await page.textContent(pianoSel + ' .count')) === '8/8', 'piano reaches 8/8');
  await page.click(pianoSel); // 9th press past max
  assert((await page.textContent(pianoSel + ' .count')) === '0/8', 'tapping past 8 wraps to 0/8');
  // bring it back up a little and verify long-press still decrements
  await page.click(pianoSel); await page.click(pianoSel); // 0 -> 2
  await longPress(pianoSel);
  assert((await page.textContent(pianoSel + ' .count')) === '1/8', 'long-press decrements counter to 1/8');

  console.log('6. Toggle an item off then on (data for clear test)');
  await page.click('.grid.items .cell[data-code="1st_Tablet"]'); // toggle back off
  const offAgain = await page.getAttribute('.grid.items .cell[data-code="1st_Tablet"]', 'class');
  assert(/\boff\b/.test(offAgain), '1st_Tablet toggled back OFF');
  await page.click('.grid.items .cell[data-code="1st_Tablet"]');

  console.log('5. Clear flow: open dialog, Cancel keeps data');
  await page.click('#clearBtn');
  await page.waitForSelector('#confirmOverlay:not([hidden])');
  await shot(page, '04-confirm-dialog');
  assert(await page.isVisible('#confirmOverlay .dialog'), 'confirmation dialog is visible');
  await page.click('#confirmCancel');
  assert(await page.getAttribute('#confirmOverlay', 'hidden') !== null || !(await page.isVisible('#confirmOverlay')), 'dialog closed on Cancel');
  const stillThere = await page.evaluate(() => localStorage.getItem('ffv-career-day-tracker-v1'));
  assert(stillThere && JSON.parse(stillThere)['Knight_Crystal'] === true, 'Cancel kept the data');

  console.log('6. Clear flow: Confirm wipes everything');
  await page.click('#clearBtn');
  await page.waitForSelector('#confirmOverlay:not([hidden])');
  await page.click('#confirmClear');
  await page.waitForSelector('#confirmOverlay[hidden]', { state: 'attached' });
  const onCells = await page.evaluate(() => document.querySelectorAll('.cell.on').length);
  assert(onCells === 0, 'after Clear: no cells are ON (' + onCells + ')');
  const clearedStore = await page.evaluate(() => localStorage.getItem('ffv-career-day-tracker-v1'));
  assert(clearedStore === '{}', 'after Clear: localStorage is empty object');
  await shot(page, '05-after-clear');

  console.log('7. Clear persists across reload');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.grid.bosses .cell');
  const onAfter = await page.evaluate(() => document.querySelectorAll('.cell.on').length);
  assert(onAfter === 0, 'after reload post-clear: still empty');

  assert(failedImgs.length === 0, 'no failed image requests (' + failedImgs.length + ')');
  assert(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');

  await browser.close();
  console.log('\nALL CHECKS PASSED');
})().catch((e) => { console.error('\n' + e.stack); process.exit(1); });
