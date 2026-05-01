```javascript
/**
 * AQE Light - Atomic Quantum Engine (Free Edition)
 *
 * Lightweight CSS selector engine for everyday use.
 * No SharedArrayBuffer, no Web Worker, no Bloom index.
 * Runs synchronously on the main thread via native DOM APIs.
 *
 * Supported syntax:
 *   - Simple:    tag   .class   #id   [attr]   [attr=val]
 *   - Pseudo:    :checked   :disabled   :focus   (stateful, no layout)
 *   - Compound:  div.active#main   input[type="text"].visible
 *   - List:      h1, h2, h3
 *   - Complex:   div .child   div > .child   (delegated to el.matches)
 */
class AQELight {
    constructor() {
        this.tokenMap   = new Map();
        this.bitCounter = 0;
        this._registry  = new Map(); // el → mask
    }

    // ─── Bitmask ──────────────────────────────────────────────────────────────

    _getBit(token) {
        if (!this.tokenMap.has(token)) {
            this.tokenMap.set(token, 1n << BigInt(this.bitCounter++ & 63));
        }
        return this.tokenMap.get(token);
    }

    _nodeMask(el) {
        let mask = this._getBit(el.localName.toLowerCase());

        if (el.id)             mask |= this._getBit(`#${el.id}`);
        el.classList.forEach(c => mask |= this._getBit(`.${c}`));

        for (const { name, value } of el.attributes) {
            mask |= this._getBit(`[${name}]`);
            if (value !== '') mask |= this._getBit(`[${name}=${value}]`);
        }

        if (el.matches?.(':checked'))   mask |= this._getBit(':checked');
        if (el.matches?.(':disabled'))  mask |= this._getBit(':disabled');
        if (el.matches?.(':enabled'))   mask |= this._getBit(':enabled');
        if (el.matches?.(':empty'))     mask |= this._getBit(':empty');
        if (el.matches?.(':required'))  mask |= this._getBit(':required');
        if (el.matches?.(':focus'))     mask |= this._getBit(':focus');

        return mask;
    }

    _selectorMask(selector) {
        let mask = 0n;
        // Extract the last compound part (most specific subject of the selector)
        const subject = selector.trim().split(/\s*[ >+~]\s*/).pop() ?? selector;
        let i = 0;

        while (i < subject.length) {
            const ch = subject[i];

            if (ch === '.') {
                const m = subject.slice(i).match(/^\.[a-zA-Z_-][a-zA-Z0-9_-]*/);
                if (m) { mask |= this._getBit(m[0]); i += m[0].length; continue; }
            }
            if (ch === '#') {
                const m = subject.slice(i).match(/^#[a-zA-Z_-][a-zA-Z0-9_-]*/);
                if (m) { mask |= this._getBit(m[0]); i += m[0].length; continue; }
            }
            if (ch === '[') {
                const end = subject.indexOf(']', i);
                if (end !== -1) {
                    const token = subject.slice(i, end + 1).replace(/['"]/g, '').replace(/\s+/g, '');
                    mask |= this._getBit(token);
                    i = end + 1;
                    continue;
                }
            }
            if (ch === ':') {
                const m = subject.slice(i).match(/^::?[a-zA-Z-]+(\([^)]*\))?/);
                if (m) { mask |= this._getBit(m[0]); i += m[0].length; continue; }
            }
            if (/[a-zA-Z*_-]/.test(ch)) {
                const m = subject.slice(i).match(/^[a-zA-Z*_-][a-zA-Z0-9_-]*/);
                if (m) { mask |= this._getBit(m[0].toLowerCase()); i += m[0].length; continue; }
            }
            i++;
        }

        return mask;
    }

    // ─── Registry ─────────────────────────────────────────────────────────────

    syncNode(el) {
        if (!el || el.nodeType !== 1) return;
        this._registry.set(el, this._nodeMask(el));
    }

    unsyncNode(el) {
        this._registry.delete(el);
    }

    syncAll() {
        this._registry.clear();
        document.querySelectorAll('*').forEach(el => this.syncNode(el));
    }

    // ─── Query ────────────────────────────────────────────────────────────────

    /**
     * Queries the registry synchronously.
     * Bitmask pre-filters candidates; el.matches() validates complex selectors.
     *
     * @param {string} selector  Any valid CSS selector string
     * @returns {Element[]}
     */
    query(selector) {
        const branches = selector.split(',').map(s => s.trim()).filter(Boolean);

        if (branches.length > 1) {
            const seen = new Set();
            return branches.flatMap(s => this.query(s)).filter(el => {
                if (seen.has(el)) return false;
                seen.add(el);
                return true;
            });
        }

        const targetMask = this._selectorMask(selector);
        const isComplex  = /[\s>+~]/.test(selector.trim());
        const results    = [];

        for (const [el, nodeMask] of this._registry) {
            if ((nodeMask & targetMask) !== targetMask) continue;
            if (isComplex && !el.matches(selector)) continue;
            results.push(el);
        }

        return results;
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    destroy() {
        this._registry.clear();
        this.tokenMap.clear();
    }
}
```
