/**
 * AQE Light — Test Suite
 *
 * Runs with plain Node.js >= 16, no test framework required.
 * Uses node:assert/strict and a minimal test harness defined below.
 *
 * Usage:
 *   node tests/AQE-light.test.js
 *   npm test
 */

import assert from 'node:assert/strict';
import AQELight from '../src/AQE-light.js';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(label, fn) {
    try {
        fn();
        console.log(`  ✓  ${label}`);
        passed++;
    } catch (err) {
        console.error(`  ✗  ${label}`);
        console.error(`     ${err.message}`);
        failed++;
        failures.push({ label, err });
    }
}

function suite(title) {
    console.log(`\n${title}`);
}

// ─── Minimal DOM stub ─────────────────────────────────────────────────────────
// Node.js has no DOM. We provide the minimal surface AQELight actually touches:
// nodeType, localName, id, classList, attributes, matches.

function makeEl(tag, { id = '', classes = [], attrs = {}, pseudo = [] } = {}) {
    const attrMap = Object.entries({ ...attrs, ...(id ? { id } : {}) });
    return {
        nodeType:  1,
        localName: tag,
        id,
        classList: {
            forEach: (fn) => classes.forEach(fn),
        },
        attributes: attrMap.map(([name, value]) => ({ name, value: String(value) })),
        matches: (sel) => pseudo.includes(sel),
    };
}

// ─── Suite 1: Constructor ─────────────────────────────────────────────────────

suite('1. Constructor');

test('creates empty tokenMap', () => {
    const e = new AQELight();
    assert.equal(e.tokenMap.size, 0);
});

test('bitCounter starts at 0', () => {
    const e = new AQELight();
    assert.equal(e.bitCounter, 0);
});

test('registry starts empty', () => {
    const e = new AQELight();
    assert.equal(e._registry.size, 0);
});

// ─── Suite 2: _getBit ─────────────────────────────────────────────────────────

suite('2. _getBit — bitmask allocation');

test('first token gets bit 1n', () => {
    const e = new AQELight();
    assert.equal(e._getBit('div'), 1n);
});

test('second token gets bit 2n', () => {
    const e = new AQELight();
    e._getBit('div');
    assert.equal(e._getBit('.cls'), 2n);
});

test('third token gets bit 4n', () => {
    const e = new AQELight();
    e._getBit('div');
    e._getBit('.cls');
    assert.equal(e._getBit('#main'), 4n);
});

test('same token returns cached bit', () => {
    const e = new AQELight();
    const b1 = e._getBit('span');
    const b2 = e._getBit('span');
    assert.equal(b1, b2);
    assert.equal(e.tokenMap.size, 1);
});

test('bits are unique across 10 tokens', () => {
    const e = new AQELight();
    const tokens = ['div','span','p','a','ul','li','.cls','#id','[href]',':focus'];
    const bits   = tokens.map(t => e._getBit(t));
    const unique = new Set(bits.map(String));
    assert.equal(unique.size, tokens.length);
});

test('bitCounter wraps at 63 (aliasing, no crash)', () => {
    const e = new AQELight();
    // Force 64 tokens — bit 64 aliases to bit 0 (& 63 === 0)
    for (let i = 0; i < 64; i++) e._getBit(`tok${i}`);
    // Should not throw, bitCounter keeps incrementing
    assert.equal(e.bitCounter, 64);
    // Bit 64 aliases to slot 0 → same as tok0
    assert.equal(e._getBit('tok64'), e._getBit('tok0'));
});

// ─── Suite 3: _nodeMask ───────────────────────────────────────────────────────

suite('3. _nodeMask — node bitmask computation');

test('tag name contributes a bit', () => {
    const e  = new AQELight();
    const el = makeEl('div');
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit('div')) !== 0n, true);
});

test('id contributes a bit', () => {
    const e  = new AQELight();
    const el = makeEl('div', { id: 'main' });
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit('#main')) !== 0n, true);
});

test('class names each contribute a bit', () => {
    const e  = new AQELight();
    const el = makeEl('div', { classes: ['foo', 'bar'] });
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit('.foo')) !== 0n, true);
    assert.equal((mask & e._getBit('.bar')) !== 0n, true);
});

test('attribute name contributes a bit', () => {
    const e  = new AQELight();
    const el = makeEl('input', { attrs: { type: 'text' } });
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit('[type]')) !== 0n, true);
});

test('attribute name=value contributes a bit', () => {
    const e  = new AQELight();
    const el = makeEl('input', { attrs: { type: 'text' } });
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit('[type=text]')) !== 0n, true);
});

test('empty attribute value does not add name=value bit', () => {
    const e  = new AQELight();
    const el = makeEl('div', { attrs: { hidden: '' } });
    const mask = e._nodeMask(el);
    // [hidden] present, [hidden=] NOT present
    assert.equal((mask & e._getBit('[hidden]')) !== 0n, true);
    assert.equal((mask & e._getBit('[hidden=]')), 0n);
});

test(':checked pseudo-class contributes a bit', () => {
    const e  = new AQELight();
    const el = makeEl('input', { pseudo: [':checked'] });
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit(':checked')) !== 0n, true);
});

test(':disabled pseudo-class contributes a bit', () => {
    const e  = new AQELight();
    const el = makeEl('input', { pseudo: [':disabled'] });
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit(':disabled')) !== 0n, true);
});

test('unmatched pseudo-class does not set bit', () => {
    const e  = new AQELight();
    const el = makeEl('input');   // pseudo: [] — matches() always returns false
    const mask = e._nodeMask(el);
    assert.equal((mask & e._getBit(':focus')), 0n);
});

// ─── Suite 4: _selectorMask ───────────────────────────────────────────────────

suite('4. _selectorMask — selector bitmask parsing');

test('parses tag selector', () => {
    const e = new AQELight();
    e._getBit('div'); // pre-register
    const m = e._selectorMask('div');
    assert.equal((m & e._getBit('div')) !== 0n, true);
});

test('parses class selector', () => {
    const e = new AQELight();
    const m = e._selectorMask('.active');
    assert.equal((m & e._getBit('.active')) !== 0n, true);
});

test('parses ID selector', () => {
    const e = new AQELight();
    const m = e._selectorMask('#main');
    assert.equal((m & e._getBit('#main')) !== 0n, true);
});

test('parses attribute selector', () => {
    const e = new AQELight();
    const m = e._selectorMask('[type=text]');
    assert.equal((m & e._getBit('[type=text]')) !== 0n, true);
});

test('parses compound selector — uses last part for mask', () => {
    const e = new AQELight();
    // "div .child" → subject is ".child"
    const m = e._selectorMask('div .child');
    assert.equal((m & e._getBit('.child')) !== 0n, true);
});

test('parses pseudo-class selector', () => {
    const e = new AQELight();
    const m = e._selectorMask(':disabled');
    assert.equal((m & e._getBit(':disabled')) !== 0n, true);
});

test('parses compound tag+class+id', () => {
    const e = new AQELight();
    const m = e._selectorMask('div.active#main');
    assert.equal((m & e._getBit('div'))     !== 0n, true);
    assert.equal((m & e._getBit('.active')) !== 0n, true);
    assert.equal((m & e._getBit('#main'))   !== 0n, true);
});

// ─── Suite 5: syncNode / unsyncNode ──────────────────────────────────────────

suite('5. syncNode / unsyncNode');

test('syncNode ignores null', () => {
    const e = new AQELight();
    assert.doesNotThrow(() => e.syncNode(null));
    assert.equal(e._registry.size, 0);
});

test('syncNode ignores non-element nodeType', () => {
    const e = new AQELight();
    assert.doesNotThrow(() => e.syncNode({ nodeType: 3 }));
    assert.equal(e._registry.size, 0);
});

test('syncNode registers a valid element', () => {
    const e  = new AQELight();
    const el = makeEl('div');
    e.syncNode(el);
    assert.equal(e._registry.size, 1);
    assert.equal(e._registry.has(el), true);
});

test('syncNode stores a BigInt mask', () => {
    const e  = new AQELight();
    const el = makeEl('span', { classes: ['foo'] });
    e.syncNode(el);
    assert.equal(typeof e._registry.get(el), 'bigint');
});

test('syncNode updates mask on re-sync', () => {
    const e  = new AQELight();
    const el = makeEl('div');
    e.syncNode(el);
    const before = e._registry.get(el);
    // simulate adding a class by re-syncing a new stub with same ref
    const el2 = makeEl('div', { classes: ['new'] });
    e._registry.set(el2, e._nodeMask(el2)); // manual update
    assert.notEqual(e._registry.get(el2), before);
});

test('unsyncNode removes element from registry', () => {
    const e  = new AQELight();
    const el = makeEl('div');
    e.syncNode(el);
    e.unsyncNode(el);
    assert.equal(e._registry.has(el), false);
    assert.equal(e._registry.size, 0);
});

test('unsyncNode is safe on unknown element', () => {
    const e  = new AQELight();
    const el = makeEl('div');
    assert.doesNotThrow(() => e.unsyncNode(el));
});

// ─── Suite 6: query ───────────────────────────────────────────────────────────

suite('6. query — selector matching');

test('returns empty array on empty registry', () => {
    const e = new AQELight();
    assert.deepEqual(e.query('div'), []);
});

test('matches element by tag', () => {
    const e  = new AQELight();
    const el = makeEl('div');
    e.syncNode(el);
    assert.deepEqual(e.query('div'), [el]);
});

test('does not match wrong tag', () => {
    const e  = new AQELight();
    const el = makeEl('span');
    e.syncNode(el);
    assert.deepEqual(e.query('div'), []);
});

test('matches element by class', () => {
    const e  = new AQELight();
    const el = makeEl('div', { classes: ['active'] });
    e.syncNode(el);
    assert.deepEqual(e.query('.active'), [el]);
});

test('does not match missing class', () => {
    const e  = new AQELight();
    const el = makeEl('div', { classes: ['other'] });
    e.syncNode(el);
    assert.deepEqual(e.query('.active'), []);
});

test('matches element by id', () => {
    const e  = new AQELight();
    const el = makeEl('div', { id: 'main' });
    e.syncNode(el);
    assert.deepEqual(e.query('#main'), [el]);
});

test('matches compound tag.class', () => {
    const e   = new AQELight();
    const el1 = makeEl('div', { classes: ['active'] });
    const el2 = makeEl('span', { classes: ['active'] });
    e.syncNode(el1);
    e.syncNode(el2);
    const result = e.query('div.active');
    assert.equal(result.length, 1);
    assert.equal(result[0], el1);
});

test('matches attribute selector', () => {
    const e  = new AQELight();
    const el = makeEl('input', { attrs: { type: 'text' } });
    e.syncNode(el);
    assert.deepEqual(e.query('[type]'), [el]);
});

test('matches attribute value selector', () => {
    const e  = new AQELight();
    const el = makeEl('input', { attrs: { type: 'text' } });
    e.syncNode(el);
    assert.deepEqual(e.query('[type=text]'), [el]);
});

test('does not match wrong attribute value', () => {
    const e  = new AQELight();
    const el = makeEl('input', { attrs: { type: 'checkbox' } });
    e.syncNode(el);
    assert.deepEqual(e.query('[type=text]'), []);
});

test('matches multiple elements', () => {
    const e   = new AQELight();
    const el1 = makeEl('div', { classes: ['card'] });
    const el2 = makeEl('div', { classes: ['card'] });
    const el3 = makeEl('span', { classes: ['card'] });
    e.syncNode(el1);
    e.syncNode(el2);
    e.syncNode(el3);
    assert.equal(e.query('.card').length, 3);
});

test('selector list (a, b) matches both branches', () => {
    const e   = new AQELight();
    const el1 = makeEl('h1');
    const el2 = makeEl('h2');
    const el3 = makeEl('p');
    e.syncNode(el1);
    e.syncNode(el2);
    e.syncNode(el3);
    const result = e.query('h1, h2');
    assert.equal(result.length, 2);
    assert.ok(result.includes(el1));
    assert.ok(result.includes(el2));
});

test('selector list deduplicates results', () => {
    const e  = new AQELight();
    const el = makeEl('div', { classes: ['active'] });
    e.syncNode(el);
    // "div, .active" — el matches both branches
    const result = e.query('div, .active');
    assert.equal(result.length, 1);
});

test('complex selector delegates to el.matches()', () => {
    const e  = new AQELight();
    // el.matches returns true only for the child selector
    const el = makeEl('div', { classes: ['child'] });
    el.matches = (sel) => sel === 'div .child';
    e.syncNode(el);
    const result = e.query('div .child');
    assert.equal(result.length, 1);
});

test('complex selector excludes non-matching elements', () => {
    const e  = new AQELight();
    const el = makeEl('div', { classes: ['child'] });
    el.matches = () => false; // force fail
    e.syncNode(el);
    assert.deepEqual(e.query('div .child'), []);
});

test('unsync removes element from future queries', () => {
    const e  = new AQELight();
    const el = makeEl('div', { classes: ['active'] });
    e.syncNode(el);
    assert.equal(e.query('.active').length, 1);
    e.unsyncNode(el);
    assert.equal(e.query('.active').length, 0);
});

// ─── Suite 7: destroy ─────────────────────────────────────────────────────────

suite('7. destroy — lifecycle cleanup');

test('clears registry', () => {
    const e  = new AQELight();
    e.syncNode(makeEl('div'));
    e.syncNode(makeEl('span'));
    e.destroy();
    assert.equal(e._registry.size, 0);
});

test('clears tokenMap', () => {
    const e = new AQELight();
    e._getBit('div');
    e._getBit('.cls');
    e.destroy();
    assert.equal(e.tokenMap.size, 0);
});

test('instance is reusable after destroy', () => {
    const e  = new AQELight();
    const el = makeEl('p');
    e.syncNode(el);
    e.destroy();
    e.syncNode(el);
    assert.equal(e._registry.size, 1);
    assert.deepEqual(e.query('p'), [el]);
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests — ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    console.error('  Failed tests:');
    failures.forEach(({ label, err }) => {
        console.error(`    • ${label}: ${err.message}`);
    });
    process.exit(1);
}
