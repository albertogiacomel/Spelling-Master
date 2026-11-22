import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { openBrowser, delay } from './browser-driver.js';
import { ALL_WORDS } from '../src/words.ts';

const root = resolve(import.meta.dirname, '..');
const artifacts = join(root, 'artifacts/browser');
const page = await openBrowser(root, { entry: '/dist/index.html', artifactsPath: artifacts });
const { evaluate, command } = page;
const checks = [];

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
  const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw new Error('Invisible control: '+${JSON.stringify(selector)});const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);if(!hit||(!e.contains(hit)&&hit!==e))throw new Error('Covered control: '+${JSON.stringify(selector)});return {x,y};})()`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function typeAnswer(value) {
  await click('#spelling-input');
  await evaluate(`(()=>{const input=document.getElementById('spelling-input');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}

async function closeDialogWithEscape() {
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
}

async function setSelect(name, value) {
  await evaluate(`(()=>{const element=document.querySelector('[data-setting=${name}]');element.value=${JSON.stringify(value)};element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}

try {
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await wait('Boolean(window.__spellingApp)', 'app boot');
  await wait("document.querySelectorAll('[data-site-header]').length===1", 'shared header');
  await wait("document.querySelectorAll('[data-site-footer]').length===1", 'shared footer');
  await wait('Boolean(window.SitePrivacy)', 'privacy runtime');
  await evaluate('window.SitePrivacy.ready.then(()=>true)');
  await evaluate('document.fonts.ready.then(()=>true)');
  await wait("getComputedStyle(document.querySelector('[data-site-header]')).fontSize==='14px'", 'shell styles');

  if (await evaluate("Boolean(document.querySelector('#klaro .cookie-notice .cm-btn-decline'))")) {
    await click('#klaro .cookie-notice .cm-btn-decline');
  }

  assert.equal(await evaluate('document.title'), 'Spelling & Magic Box • Gioco educativo');
  assert.equal(await evaluate("document.querySelectorAll('[data-difficulty]').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('[data-start]').length"), 3);
  assert.equal(await evaluate("document.getElementById('screen-menu').hidden"), false);

  await click('[data-kit-settings]');
  await wait("document.querySelector('[data-kit-dialog]').open", 'settings open');
  await setSelect('language', 'en');
  await wait("document.documentElement.lang==='en'", 'language switch');
  assert.ok((await evaluate("document.getElementById('menu-title').textContent")).includes('Play with English letters'));
  await setSelect('theme', 'dark');
  await wait("document.body.dataset.agTheme==='dark'", 'dark theme');
  assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), true);
  await setSelect('theme', 'light');
  await setSelect('language', 'it');
  await closeDialogWithEscape();
  await wait("!document.querySelector('[data-kit-dialog]').open", 'settings close');
  checks.push('Shared shell, settings dialog, IT/EN switch and theme change');

  await click('#btn-alphabet');
  await wait("document.getElementById('alphabet-dialog').open", 'alphabet open');
  assert.equal(await evaluate("document.querySelectorAll('#alphabet-grid .sp-letter-card').length"), 26);
  assert.ok((await evaluate("document.getElementById('btn-alphabet-all').textContent")).includes('tutto l’alfabeto'));
  assert.equal(await evaluate("document.querySelector('#alphabet-grid [data-letter=\"A\"] span').textContent"), '/eɪ/ “ey”');
  await click('#alphabet-grid .sp-letter-card');
  await click('#btn-alphabet-done');
  await wait("!document.getElementById('alphabet-dialog').open", 'alphabet close');
  checks.push('Alphabet dialog with 26 letter cards and the whole-alphabet action');

  const initialScore = Number(await evaluate("document.getElementById('stat-score').textContent"));
  await click('[data-start="direct"]');
  await wait("document.getElementById('screen-game').hidden===false", 'game start');
  await click('#btn-hint');
  await wait("document.getElementById('hint-box').hidden===false", 'hint visible');
  const meaning = await evaluate("document.getElementById('hint-translation').textContent");
  const entry = ALL_WORDS.find((word) => word.it === meaning);
  assert.ok(entry, `word for Italian meaning: ${meaning}`);
  assert.equal(Number(await evaluate("document.getElementById('word-length').textContent")), entry.word.length);

  await typeAnswer(entry.word);
  await click('#btn-check');
  await wait("document.getElementById('feedback').hidden===false", 'feedback visible');
  assert.equal(await evaluate("document.getElementById('feedback').dataset.result"), 'correct');
  assert.ok((await evaluate("document.getElementById('feedback-detail').textContent")).includes(entry.word));
  assert.ok(Number(await evaluate("document.getElementById('stat-score').textContent")) > initialScore);
  assert.equal(await evaluate("document.getElementById('spelling-input').disabled"), true);
  checks.push(`Direct spelling: correct answer ${entry.word}`);

  await click('#btn-next');
  await wait("document.getElementById('feedback').hidden===true", 'next word');
  await typeAnswer('ZZZ');
  await click('#btn-check');
  await wait("document.getElementById('feedback').dataset.result==='wrong'", 'wrong feedback');
  assert.ok(await evaluate("document.querySelectorAll('#letter-diff span').length>0"));
  assert.equal(await evaluate("document.getElementById('stat-streak').textContent"), '0');
  checks.push('Wrong answer shows letter diff and resets streak');

  await click('#btn-home');
  await wait("document.getElementById('screen-menu').hidden===false", 'home');
  await click('[data-start="indirect"]');
  await wait("document.getElementById('screen-game').hidden===false", 'indirect start');
  assert.equal(await evaluate("document.getElementById('indirect-leds').hidden"), false);
  assert.equal(await evaluate("document.getElementById('sentence-box').hidden"), true);
  assert.equal(await evaluate("document.getElementById('btn-play-sentence').hidden"), true);
  await click('#btn-play');
  const indirectLength = Number(await evaluate("document.getElementById('word-length').textContent"));
  assert.equal(await evaluate("document.querySelectorAll('#led-row .sp-led').length"), indirectLength);
  checks.push('Indirect mode hides the sentence and builds one LED per letter');

  await click('#btn-home');
  await wait("document.getElementById('screen-menu').hidden===false", 'home again');
  await click('[data-start="mixed"]');
  await wait("document.getElementById('screen-game').hidden===false", 'mixed start');
  assert.equal(await evaluate("document.getElementById('stat-lives').hidden"), false);
  assert.ok((await evaluate("document.getElementById('stat-lives').textContent")).includes('❤️'));
  await click('#btn-skip');
  await click('#btn-skip');
  await click('#btn-skip');
  await wait("document.getElementById('screen-results').hidden===false", 'mixed results');
  assert.ok(await evaluate("Number(document.getElementById('final-correct').textContent)>=0"));
  checks.push('Mixed challenge reaches results after three skips');

  await click('#btn-results-home');
  await wait("document.getElementById('screen-menu').hidden===false", 'results home');

  for (const width of [1280, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    const layout = await evaluate(`(()=>{const cards=[...document.querySelectorAll('.sp-mode')];return {overflow:document.documentElement.scrollWidth>innerWidth,widths:cards.map(c=>c.getBoundingClientRect().width),heights:cards.map(c=>c.getBoundingClientRect().height),columns:getComputedStyle(document.getElementById('mode-grid')).gridTemplateColumns.split(' ').length};})()`);
    assert.equal(layout.overflow, false, `no horizontal overflow at ${width}px`);
    assert.ok(layout.heights.every((height) => height >= 44));
    if (width === 1280) assert.equal(layout.columns, 3);
    if (width <= 390) assert.equal(layout.columns, 1);
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await click('#btn-alphabet');
  await wait("document.getElementById('alphabet-dialog').open", 'alphabet mobile');
  assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
  const alphabetLayout = await evaluate(`(()=>{const dialog=document.getElementById('alphabet-dialog');const grid=document.getElementById('alphabet-grid');const card=grid.querySelector('.sp-letter-card strong');return {width:dialog.getBoundingClientRect().width,height:dialog.getBoundingClientRect().height,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,letterSize:parseFloat(getComputedStyle(card).fontSize)};})()`);
  assert.ok(alphabetLayout.width >= 380, 'alphabet dialog uses the mobile width');
  assert.equal(alphabetLayout.columns, 3);
  assert.ok(alphabetLayout.letterSize >= 24, 'alphabet letters are readable');
  const alphabetShot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(artifacts, 'alphabet-mobile.png'), Buffer.from(alphabetShot.data, 'base64'));
  await click('#btn-alphabet-done');
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  checks.push('Responsive layout at 1280, 390 and 320 px without overflow');

  const savedScore = await evaluate("document.getElementById('stat-score').textContent");
  await command('Page.reload', { ignoreCache: false });
  await wait('Boolean(window.__spellingApp)', 'reload app');
  await wait("document.querySelectorAll('[data-site-header]').length===1", 'reload shell');
  if (await evaluate("Boolean(document.querySelector('#klaro .cookie-notice .cm-btn-decline'))")) {
    await click('#klaro .cookie-notice .cm-btn-decline');
  }
  assert.equal(await evaluate("document.getElementById('stat-score').textContent"), savedScore);
  checks.push('Saved stars survive a page reload');

  assert.deepEqual(page.errors, [], 'no page exceptions');

  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(artifacts, 'home-desktop.png'), Buffer.from(screenshot.data, 'base64'));
  const report = { status: 'PASS', checks, errors: page.errors, savedScore };
  await writeFile(join(artifacts, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await page.close();
}
