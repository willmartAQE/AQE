/**
 * AQE - Atomic Quantum Engine v2 [LIGHT VERSION]
 * Author: William Martin (williammartin.aqe@gmail.com)
 * 
 * A lightweight version of the AQE engine, demonstrating core concepts
 * like bitmasking and CSS tokenization, but running synchronously on the
 * main thread with limited node capacity. Ideal for free distribution
 * and showcasing the fundamental speed of bitwise matching.
 *
 * KEY LIMITATIONS vs PRO VERSION:
 * - Runs on the Main Thread (synchronous, can block UI).
 * - Maximum capacity: 500 nodes (hardcoded limit).
 * - Does NOT use SharedArrayBuffer or Web Workers.
 * - Lacks advanced spatial pruning and Atomics for thread safety.
 *
 * UPGRADE TO PRO FOR:
 * - Full Multi-threaded Parallelism (Web Workers).
 * - Unlimited Node Capacity.
 * - Hardware-level Spatial Pruning (AABB).
 * - Zero-latency SharedArrayBuffer architecture with Atomics.
 */
class AIELight {
    /** 
     * @param {number} [maxNodes=500] - Maximum nodes to track. Hard limit is 500.
     */
    constructor(maxNodes = 500) {
        // Enforce the hard limit for the Light version
        this.maxNodes = Math.min(maxNodes, 500); 
        this.tokenMap  = new Map();   // CSS token → BigInt bitmask
        this.bitCounter = 0;          // Counter for allocated bits (max 63)
        
        // Stores node data directly in JS objects (less performant than buffer)
        this.registry = new Map(); // Map DOM Element → { maskLow, maskHigh, rect }
        
        // Log a message indicating the Light version is active and suggesting upgrade
        console.log(
            `%c AQE Light Initialized (Max ${this.maxNodes} nodes). %c Upgrade to AQE Pro for Parallel Processing & Unlimited Capacity! `, 
            "background: #222; color: #bada55; padding: 5px; border-radius: 3px;",
            "background: #f0ad4e; color: #fff; padding: 5px; border-radius: 3px; cursor: pointer;",
            () => { window.location.href = 'mailto:williammartin@gmx.com?subject=AQE%20Pro%20Inquiry'; } // Mailto link on click
        );
    }

    // ─────────────────────────────────────────────────────
    //  Bitmask Helpers (Identical logic to Pro version)
    // ─────────────────────────────────────────────────────

    /**
     * Assigns a unique bit to each CSS token encountered.
     * Limited to 63 bits to prevent precision loss in Number() casts.
     * @param {string} token - The CSS token.
     * @returns {bigint} - The BigInt bit representation.
     */
    _getBit(token) {
        if (!this.tokenMap.has(token)) {
            const bit = 1n << BigInt(this.bitCounter & 63);
            this.tokenMap.set(token, bit);
            this.bitCounter++;
        }
        return this.tokenMap.get(token);
    }

    // ─────────────────────────────────────────────────────
    //  DOM Synchronization (Main Thread)
    // ─────────────────────────────────────────────────────

    /**
     * Serializes the CSS and geometric state of a DOM element into the registry.
     * Limited by the maxNodes capacity.
     * @param {Node} el - The DOM element to synchronize.
     */
    syncNode(el) {
        // Basic validation and capacity check
        if (!el || el.nodeType !== 1 || this.registry.size >= this.maxNodes) return;
        if (!document.contains(el)) return; // Only sync nodes in the document

        // Generate CSS Bitmask
        let mask = this._getBit(el.localName.toLowerCase());
        if (el.id) mask |= this._getBit(`#${el.id}`);
        el.classList.forEach(c => mask |= this._getBit(`.${c}`));

        // Store node data directly in the registry map
        const rect = el.getBoundingClientRect();
        this.registry.set(el, {
            maskLow:  Number(mask & 0xFFFF_FFFFn), // Low 32 bits
            maskHigh: Number(mask >> 32n),         // High 32 bits
            rect: { // Store spatial data (used only for basic demo, not pruning)
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
            }
        });
    }

    /**
     * Removes a node from the registry.
     * @param {Element} el - The DOM element to remove.
     */
    unsyncNode(el) {
        this.registry.delete(el);
    }

    // ─────────────────────────────────────────────────────
    //  Query Execution (Synchronous on Main Thread)
    // ─────────────────────────────────────────────────────

    /**
     * Executes a synchronous query on the Main Thread.
     * This method can block the UI thread if the registry is large or the selector complex.
     *
     * @param {string} selector - The CSS selector string (e.g., "div.active#main").
     * @returns {Element[]} - An array of matching DOM elements.
     */
    query(selector) {
        // Robust tokenizer: extracts tags, classes, and IDs correctly
        const tokenRegex = /[.#]?[a-zA-Z][a-zA-Z0-9_-]*/g;
        let targetMask = 0n;

        // Build the target bitmask from the selector
        for (const raw of selector.matchAll(tokenRegex)) {
            const token = raw[0];
            if (!token) continue;
            if (token.startsWith('.') || token.startsWith('#')) {
                targetMask |= this._getBit(token);
            } else {
                targetMask |= this._getBit(token.toLowerCase());
            }
        }
        
        // Split the target mask into low and high 32-bit parts
        const tLow = Number(targetMask & 0xFFFF_FFFFn);
        const tHigh = Number(targetMask >> 32n);

        const results = [];
        // Iterate through all registered nodes
        for (const [node, data] of this.registry) {
            // Perform the bitwise AND check
            if ((data.maskLow & tLow) === tLow && (data.maskHigh & tHigh) === tHigh) {
                results.push(node);
            }
        }
        return results;
    }

    // ─────────────────────────────────────────────────────
    //  Lifecycle & Initial Sync
    // ─────────────────────────────────────────────────────

    /**
     * Synchronizes all elements currently in the document up to the maxNodes limit.
     * Useful for initial setup.
     */
    syncAll() {
        if (typeof document !== 'undefined' && document.body) {
            let count = 0;
            document.querySelectorAll('*').forEach(el => {
                if (count < this.maxNodes) {
                    this.syncNode(el);
                    count++;
                }
            });
        }
    }

    /**
     * Cleans up internal data structures. Does not terminate workers or observers
     * as they don't exist in the Light version.
     */
    destroy() {
        this.registry.clear();
        this.tokenMap.clear();
        this.freeSlots.length = 0;
        this.bitCounter = 0;
        this.nextFreeIdx = 0;
        console.log("AQE Light Engine cleaned up.");
    }
}
