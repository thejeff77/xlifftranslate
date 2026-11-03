#!/usr/bin/env node
// node test/skip.test.js — runs the CLI against fixture XLIFFs with the Google client stubbed.
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BIN = path.join(__dirname, '..', 'bin', 'xlifftranslate.js');
const STUB = path.join(__dirname, 'stub-translate.js');

function xliff(units) {
  const body = units.map(([id, source, target]) =>
    `<trans-unit id="${id}"><source>${source}</source><target>${target}</target></trans-unit>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2"><file source-language="en" datatype="plaintext" original="x"><body>\n${body}\n</body></file></xliff>\n`;
}

function run(units, extraArgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlifftranslate-test-'));
  const file = path.join(dir, 'strings.de.xliff');
  fs.writeFileSync(file, xliff(units));
  const args = ['--require', STUB, BIN, '--i18nPath', dir, '--ignoreText', 'JSON, %d', '--ignoreDelimiter', ', ', ...extraArgs];
  const out = execFileSync(process.execPath, args, { encoding: 'utf8' });
  const result = {};
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/<trans-unit id="([^"]+)"><source>.*?<\/source><target[^>]*>(.*?)<\/target>/g)) {
    result[m[1]] = m[2];
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return { result, out };
}

// Xcode's export writes an untranslated value as an empty target and never sets a state attribute.
const UNITS = [
  ['blank', 'Delete song', ''],
  ['different', 'Delete song', 'Titel löschen'],
  ['equal', 'Presence', 'Presence'],
  ['ignored_equal', 'JSON', 'JSON'],
  ['ignored_blank', 'JSON', ''],
];

{
  const { result, out } = run(UNITS, ['--skipDifferent', 'true']);
  assert.strictEqual(result.blank, 'de:Delete song', 'a blank target is translated');
  assert.strictEqual(result.different, 'Titel löschen', 'a target that differs from its source is kept');
  assert.strictEqual(result.equal, 'Presence', 'a target equal to its source is kept, not sent again');
  assert.strictEqual(result.ignored_equal, 'JSON', 'an all-ignored source leaves its filled target alone');
  assert.strictEqual(result.ignored_blank, 'JSON', 'an all-ignored source is copied into a blank target');
  assert.ok(/Skipped: 3, Translated: 1,/.test(out), 'summary counts: ' + out.split('\n').filter(l => l.startsWith('Skipped:')).pop());
}

{
  const { result } = run(UNITS, []);
  assert.strictEqual(result.blank, 'de:Delete song');
  assert.strictEqual(result.different, 'de:Delete song', 'without the flag a filled target is translated again');
  assert.strictEqual(result.equal, 'de:Presence', 'without the flag an equal target is translated again');
  assert.strictEqual(result.ignored_equal, 'JSON');
}

console.log('ok');
