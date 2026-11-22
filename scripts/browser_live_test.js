import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { openBrowser, delay } from './browser-driver.js';
import { ALL_WORDS } from '../src/words.ts';

const root = resolve(import.meta.dirname, '..');
const artifacts = join(root, 'artifacts/live-browser');
const url = process.env.GAME_PUBLIC_URL || 'https://spelling.giacomel.info/';
const page = await openBrowser(root, { entry: '/dist/index.html', artifactsPath: artifacts });
const { evaluate, command } = page;

async function wait(expression, label = expression) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await evaluate(expression)) return;
    await delay(50);
  }
  throw new Error(`Condition not met: ${label}`);
}

async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw new Error('Invisible control: '+${JSON.stringify(selector)});const x=r.x+r.width/2,y=r.y+r.height/2;return {x,y};})()`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  await page.command('Page.navigate', { url });
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait('Boolean(window.__spellingApp)', 'live app boot');
  await wait("document.querySelectorAll('[data-site-header]').length===1", 'live shared header');
  await wait("document.querySelectorAll('[data-site-footer]').length===1", 'live shared footer');
  await wait('Boolean(window.SitePrivacy)', 'live privacy runtime');
  await evaluate('window.SitePrivacy.ready.then(()=>true)');
  assert.equal(await evaluate('location.hostname'), 'spelling.giacomel.info');
  assert.equal(await evaluate('document.title'), 'Spelling & Magic Box • Gioco educativo');
  if (await evaluate("Boolean(document.querySelector('#klaro .cookie-notice .cm-btn-decline'))")) {
    await click('#klaro .cookie-notice .cm-btn-decline');
  }

  await click('#btn-alphabet');
  await wait("document.getElementById('alphabet-dialog').open", 'live alphabet open');
  const alphabet = await evaluate(`(()=>{const dialog=document.getElementById('alphabet-dialog');const grid=document.getElementById('alphabet-grid');const card=grid.querySelector('.sp-letter-card strong');return {all:document.getElementById('btn-alphabet-all').textContent,a:grid.querySelector('[data-letter="A"] span').textContent,width:dialog.getBoundingClientRect().width,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,letterSize:parseFloat(getComputedStyle(card).fontSize)};})()`);
  assert.ok(alphabet.all.includes('tutto l’alfabeto'));
  assert.equal(alphabet.a, '/eɪ/ “ey”');
  assert.ok(alphabet.width >= 380);
  assert.equal(alphabet.columns, 3);
  assert.ok(alphabet.letterSize >= 24);
  const alphabetShot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(artifacts, 'live-alphabet-mobile.png'), Buffer.from(alphabetShot.data, 'base64'));
  await click('#btn-alphabet-done');
  await wait("!document.getElementById('alphabet-dialog').open", 'live alphabet close');

  await click('[data-start="direct"]');
  await wait("document.getElementById('screen-game').hidden===false", 'live game start');
  await click('#btn-hint');
  const meaning = await evaluate("document.getElementById('hint-translation').textContent");
  const entry = ALL_WORDS.find((word) => word.it === meaning);
  assert.ok(entry, `live word for ${meaning}`);
  await click('#spelling-input');
  await evaluate(`(()=>{const input=document.getElementById('spelling-input');input.value=${JSON.stringify(entry.word)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('#btn-check');
  await wait("document.getElementById('feedback').dataset.result==='correct'", 'live correct feedback');
  assert.ok(Number(await evaluate("document.getElementById('stat-score').textContent")) > 0);
  assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
  assert.deepEqual(page.errors, []);

  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(artifacts, 'live-mobile.png'), Buffer.from(screenshot.data, 'base64'));
  const report = { status: 'PASS', url, host: await evaluate('location.hostname'), word: entry.word, errors: page.errors };
  await writeFile(join(artifacts, 'live-browser.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await page.close();
}
