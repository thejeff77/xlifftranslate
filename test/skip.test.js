#!/usr/bin/env node
// node test/skip.test.js — runs the CLI against fixture XLIFFs with the Google client stubbed.
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BIN = path.join(__dirname, '..', 'bin', 'xlifftranslate.js');
const STUB = path.join(__dirname, 'stub-translate.js');

function xliff(files) {
  const body = Object.entries(files).map(([original, units]) =>
    `<file original="${original}" source-language="en" datatype="plaintext"><body>\n` +
    units.map(([id, source, target]) =>
      `<trans-unit id="${id}"><source>${source}</source><target>${target}</target></trans-unit>`).join('\n') +
    `\n</body></file>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2">\n${body}\n</xliff>\n`;
}

function run(files, extraArgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlifftranslate-test-'));
  try {
    const file = path.join(dir, 'strings.de.xliff');
    fs.writeFileSync(file, xliff(files));
    const args = ['--require', STUB, BIN, '--i18nPath', dir, '--ignoreText', 'JSON, %d', '--ignoreDelimiter', ', ', ...extraArgs];
    const out = execFileSync(process.execPath, args, { encoding: 'utf8' });
    const result = {};
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/<trans-unit id="([^"]+)"><source>.*?<\/source><target[^>]*>(.*?)<\/target>/g)) {
      result[m[1]] = m[2];
    }
    const summary = out.split('\n').filter((l) => l.startsWith('Skipped:')).pop();
    return { result, summary };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Xcode exports an untranslated .strings value as an empty target with no state attribute. A
// storyboard key that bartycrouch's defaultToBase filled with the base text exports as a target
// equal to its source.
const FILES = {
  'Base.lproj/Localizable.strings': [
    ['blank', 'Delete song', ''],
    ['different', 'Delete song', 'Titel löschen'],
    ['equal', 'Presence', 'Presence'],
    ['ignored_equal', 'JSON', 'JSON'],
    ['ignored_blank', 'JSON', ''],
  ],
  'Base.lproj/Main.storyboard': [
    ['sb_blank', 'Points', ''],
    ['sb_different', 'Points', 'Punkte'],
    ['sb_equal', 'Album', 'Album'],
  ],
};

{
  const { result, summary } = run(FILES, ['--skipDifferent', 'true']);
  assert.strictEqual(result.blank, 'de:Delete song', 'a blank target is translated');
  assert.strictEqual(result.different, 'Titel löschen', 'a target that differs from its source is kept');
  assert.strictEqual(result.equal, 'Presence', 'a .strings target equal to its source is kept, not sent again');
  assert.strictEqual(result.ignored_equal, 'JSON', 'an all-ignored source leaves its filled target alone');
  assert.strictEqual(result.ignored_blank, 'JSON', 'an all-ignored source is copied into a blank target');
  assert.strictEqual(result.sb_blank, 'de:Points', 'a blank storyboard target is translated');
  assert.strictEqual(result.sb_different, 'Punkte', 'a translated storyboard target is kept');
  assert.strictEqual(result.sb_equal, 'de:Album', 'a storyboard target equal to its source is pre-filled base text and is translated');
  assert.ok(/^Skipped: 4, Translated: 3,/.test(summary), 'summary counts: ' + summary);
}

{
  const { result } = run(FILES, []);
  assert.strictEqual(result.blank, 'de:Delete song');
  assert.strictEqual(result.different, 'de:Delete song', 'without the flag a filled target is translated again');
  assert.strictEqual(result.equal, 'de:Presence', 'without the flag an equal target is translated again');
  assert.strictEqual(result.ignored_equal, 'JSON');
  assert.strictEqual(result.sb_different, 'de:Points');
}

console.log('ok');
