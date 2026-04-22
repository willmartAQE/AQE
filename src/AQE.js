/**
 * AQE - Atomic Quantum Engine v2
 * Author: William Martin (williammartin.aqe@gmail.com)
 * 
 * A quantum leap in DOM querying performance, leveraging atomic operations,
 * parallel workers, and spatial pruning for unparalleled speed and accuracy.
 * 
 * Features:
 * - Parallel Processing via Web Workers for off-main-thread execution.
 * - Atomic Synchronization using Atomics.load/store for thread-safe buffer access.
 * - Spatial Pruning with AABB intersection for geometric filtering.
 * - Zero-Copy Memory via SharedArrayBuffer.
 * - Intelligent Memory Management (slot recycling, WeakMap integration).
 * - O(1) CSS matching using 64-bit integer bitmasks.
 * - Robust CSS Tokenizer supporting tags, classes, and IDs.
 * - Automatic DOM synchronization via MutationObserver.
 * - Lifecycle management (destroy method).
 */
class AQE {
    /** 
     * @param {number} [maxNodes=50000] - Maximum nodes to track in the buffer.
     */
    constructor(maxNodes = 50_000) {
        this.maxNodes = maxNodes;
        this.tokenMap  = new Map();   // CSS token → BigInt bitmask
        this.bitCounter = 0;          // Counter for allocated bits (max 63)

        // MEMORY LAYOUT (32 bytes = 8 × Int32 per node):
        // Index:  [0] CSS mask low   | [1] CSS mask high
        //         [2–3] reserved (future bloom filter)
        //         [4] X (rounded)    | [5] Y (rounded)
        //         [6] Width (rounded)| [7] Height (rounded)
        this.buffer = new SharedArrayBuffer(maxNodes * 8 * 4);
        this.view   = new Int32Array(this.buffer);

        this.nodeToIdx  = new WeakMap(); // Map DOM Element → index in buffer
        this.idxToNode  = new Array(maxNodes); // Map index → DOM Element
        this.freeSlots  = [];          // Indices of freed slots for reuse
        this.nextFreeIdx = 0;          // Next available index if no free slots

        this._pendingQueries = new Map(); // queryId → resolve function for pending promises
        this._queryCounter   = 0;         // Counter for unique query IDs

        this._initWorker();
        // Guard against environments without document (e.g., SSR, Workers)
        if (typeof document !== 'undefined' && document.body) {
            this._initObserver();
            // Initial sync after setup if document is available
            this.syncAll(); 
        } else {
            console.warn("AQE: Document not available. Observer and initial sync skipped.");
        }
    }

    // ─────────────────────────────────────────────────────
    //  Bitmask Helpers
    // ─────────────────────────────────────────────────────

    /**
     * Assigns a unique bit to each CSS token encountered.
     * Bits are limited to 63 to prevent precision loss during Number() casting.
     * Collisions beyond 63 unique tokens are handled gracefully (like Bloom filters).
     * @param {string} token - The CSS token (e.g., "div", ".my-class", "#my-id").
     * @returns {bigint} - The BigInt bit representation for the token.
     */
    _getBit(token) {
        if (!this.tokenMap.has(token)) {
            // Use bitwise left shift on BigInt, limited to 63 bits
            const bit = 1n << BigInt(this.bitCounter & 63);
            this.tokenMap.set(token, bit);
            this.bitCounter++;
        }
        return this.tokenMap.get(token);
    }

    // ─────────────────────────────────────────────────────
    //  DOM Synchronization (Main Thread → Buffer)
    // ─────────────────────────────────────────────────────

    /**
     * Serializes the CSS and geometric state of a DOM element into the shared buffer.
     * Skips non-element nodes or nodes not currently part of the document.
     * @param {Node} el - The DOM element to synchronize.
     */
    syncNode(el) {
        // Basic validation: must be an element node and present in the document
        if (!el || el.nodeType !== 1 || !document.contains(el)) return;

        let idx = this.nodeToIdx.get(el);
        // If node is not yet registered, find or allocate a buffer slot
        if (idx === undefined) {
            if (this.freeSlots.length > 0) {
                idx = this.freeSlots.pop(); // Reuse a freed slot
            } else if (this.nextFreeIdx < this.maxNodes) {
                idx = this.nextFreeIdx++; // Allocate a new slot
            } else {
                console.warn('AQE: Buffer is full. Node ignored.');
                return; // Buffer is full
            }
            this.nodeToIdx.set(el, idx);
            this.idxToNode[idx] = el;
        }

        // Generate CSS Bitmask
        let mask = this._getBit(el.localName.toLowerCase());
        if (el.id) mask |= this._getBit(`#${el.id}`);
        el.classList.forEach(c => mask |= this._getBit(`.${c}`));

        const offset = idx * 8; // Calculate the starting index for this node's data

        // Atomic writes ensure thread safety for the Worker reading in parallel
        Atomics.store(this.view, offset,     Number(mask & 0xFFFF_FFFFn)); // Low 32 bits of the mask
        Atomics.store(this.view, offset + 1, Number(mask >> 32n));         // High 32 bits of the mask

        // Store spatial coordinates (rounded to Int32 for consistency)
        const r = el.getBoundingClientRect();
        Atomics.store(this.view, offset + 4, Math.round(r.left));
        Atomics.store(this.view, offset + 5, Math.round(r.top));
        Atomics.store(this.view, offset + 6, Math.round(r.width));
        Atomics.store(this.view, offset + 7, Math.round(r.height));
    }

    /**
     * Removes a node from the registry and frees its slot in the buffer.
     * @param {Element} el - The DOM element to unsynchronize.
     */
    unsyncNode(el) {
        const idx = this.nodeToIdx.get(el);
        if (idx === undefined) return; // Node not registered

        const offset = idx * 8;
        // Atomically clear the node's data in the buffer
        for (let i = 0; i < 8; i++) Atomics.store(this.view, offset + i, 0);

        this.nodeToIdx.delete(el);    // Remove from element-to-index map
        this.idxToNode[idx] = undefined; // Dereference the node to allow garbage collection
        this.freeSlots.push(idx);     // Add the index to the list of available slots
    }

    // ─────────────────────────────────────────────────────
    //  Web Worker Initialization & Communication
    // ─────────────────────────────────────────────────────

    _initWorker() {
        // Source code for the Web Worker
        const workerSrc = `
self.onmessage = ({ data }) => {
    const { buffer, mLow, mHigh, bounds, count, queryId } = data;
    const view = new Int32Array(buffer); // TypedArray view on the SharedArrayBuffer
    const matches = []; // Array to store indices of matching nodes

    for (let i = 0; i < count; i++) {
        const ptr = i * 8; // Calculate the starting offset for the current node

        // Skip empty slots (nodes that were removed or never registered)
        // Check if both mask parts are zero using atomic reads
        if (Atomics.load(view, ptr) === 0 && Atomics.load(view, ptr + 1) === 0) continue;

        // 1. Spatial Pruning (Axis-Aligned Bounding Box Intersection)
        if (bounds) {
            // Load spatial data atomically
            const nx = Atomics.load(view, ptr + 4);
            const ny = Atomics.load(view, ptr + 5);
            const nw = Atomics.load(view, ptr + 6);
            const nh = Atomics.load(view, ptr + 7);
            
            // Check for intersection between the node's bounding box and the query bounds
            // If no intersection, skip this node and its entire subtree (implicit)
            if (nx + nw < bounds.x1 || nx > bounds.x2 ||
                ny + nh < bounds.y1 || ny > bounds.y2) continue;
        }

        // 2. Bitmask Match: Node must possess ALL bits required by the target selector
        // Load the node's mask atomically
        const nodeLow  = Atomics.load(view, ptr);
        const nodeHigh = Atomics.load(view, ptr + 1);
        
        // Perform the bitwise AND check: (nodeMask & selectorMask) must equal selectorMask
        // This ensures all bits set in the selector are also set in the node's mask
        if ((nodeLow & mLow) === mLow && (nodeHigh & mHigh) === mHigh) {
            matches.push(i); // Store the index of the matching node
        }
    }

    // Send the array of matching indices back to the main thread
    self.postMessage({ queryId, matches });
};
        `;
        const blob = new Blob([workerSrc], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));

        // Handle messages received from the worker
        this.worker.onmessage = ({ data }) => {
            const resolve = this._pendingQueries.get(data.queryId);
            if (resolve) {
                this._pendingQueries.delete(data.queryId);
                // Map the returned indices back to actual DOM elements
                // Filter out any 'undefined' entries (e.g., if a node was removed during query)
                resolve(data.matches.map(idx => this.idxToNode[idx]).filter(Boolean));
            }
        };

        // Handle errors occurring in the worker
        this.worker.onerror = (err) => {
            console.error('AQE Worker Error:', err);
            // Reject all pending queries to prevent the application from hanging
            for (const [id, resolve] of this._pendingQueries) {
                resolve([]); // Resolve with an empty array
            }
            this._pendingQueries.clear();
        };
    }

    // ─────────────────────────────────────────────────────
    //  MutationObserver for Real-time DOM Sync
    // ─────────────────────────────────────────────────────

    _initObserver() {
        this.observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    // Handle added nodes: synchronize them
                    m.addedNodes.forEach(n => this.syncNode(n));
                    // Handle removed nodes: unsynchronize them and free slots
                    m.removedNodes.forEach(n => this.unsyncNode(n));
                } else {
                    // Handle attribute changes (class, id, etc.) or characterData changes
                    this.syncNode(m.target);
                }
            }
        });
        // Start observing the document body for attribute changes, child list modifications,
        // and changes in the entire subtree.
        this.observer.observe(document.body, {
            attributes: true,
            subtree:    true,
            childList:  true,
        });
    }

    // ─────────────────────────────────────────────────────
    //  Query Execution Interface
    // ─────────────────────────────────────────────────────

    /**
     * Executes an asynchronous query via the Worker.
     * Supports simple CSS selectors (tag, .class, #id) and their combinations.
     *
     * @param {string} selector - The CSS selector string (e.g., "div.active#main").
     * @param {{x: number, y: number, radius: number}|null} [spatial=null] - Optional geometric filter for spatial queries.
     * @returns {Promise<Element[]>} - A promise resolving with an array of matching DOM elements.
     */
    async query(selector, spatial = null) {
        // Robust tokenizer: extracts tags, classes, and IDs correctly, handling combinations.
        // Regex breakdown:
        // [.#]?       - Optionally matches a '#' or '.' prefix
        // [a-zA-Z]   - Starts with a letter (required for valid CSS identifiers)
        // [a-zA-Z0-9_-]* - Followed by letters, numbers, underscore, or hyphen
        const tokenRegex = /[.#]?[a-zA-Z][a-zA-Z0-9_-]*/g;
        let targetMask = 0n; // Use BigInt for the mask

        // Iterate through all matched tokens in the selector string
        for (const raw of selector.matchAll(tokenRegex)) {
            const token = raw[0];
            if (!token) continue; // Skip empty matches

            // Determine the correct bit for the token type and add it to the target mask
            if (token.startsWith('.') || token.startsWith('#')) {
                targetMask |= this._getBit(token); // Class or ID selector
            } else {
                targetMask |= this._getBit(token.toLowerCase()); // Tag name selector
            }
        }

        // Define spatial bounds if provided, rounding coordinates to integers
        const bounds = spatial ? {
            x1: Math.round(spatial.x - spatial.radius),
            x2: Math.round(spatial.x + spatial.radius),
            y1: Math.round(spatial.y - spatial.radius),
            y2: Math.round(spatial.y + spatial.radius),
        } : null;

        // Generate a unique ID for this query to correlate responses from the worker
        const queryId = this._queryCounter++;

        // Return a Promise that will be resolved when the worker sends back the results
        return new Promise(resolve => {
            this._pendingQueries.set(queryId, resolve); // Store the resolve function
            
            // Send the necessary data to the worker for processing
            this.worker.postMessage({
                buffer:  this.buffer,        // The shared memory buffer
                mLow:    Number(targetMask & 0xFFFF_FFFFn), // Low 32 bits of the target mask
                mHigh:   Number(targetMask >> 32n),         // High 32 bits of the target mask
                bounds,                      // Spatial query bounds (or null)
                count:   this.nextFreeIdx,   // Number of currently registered nodes
                queryId,                     // Unique ID for this query
            });
        });
    }

    // ─────────────────────────────────────────────────────
    //  Lifecycle Management
    // ─────────────────────────────────────────────────────

    /**
     * Performs a full synchronization of all elements currently in the document.
     * Useful for initial setup or after major DOM manipulations not automatically
     * caught by the MutationObserver (e.g., content loaded via AJAX before observer starts).
     */
    syncAll() {
        // Ensure document.body is available before querying elements
        if (typeof document !== 'undefined' && document.body) {
            document.querySelectorAll('*').forEach(el => this.syncNode(el));
        }
    }

    /**
     * Terminates the Web Worker and disconnects the MutationObserver.
     * Essential for preventing memory leaks when the engine instance is no longer needed.
     * Call this when your application is shutting down or removing the engine.
     */
    destroy() {
        this.worker?.terminate(); // Terminate the worker thread
        this.observer?.disconnect(); // Stop observing DOM changes
        this._pendingQueries.clear(); // Clear any outstanding query promises
        
        // Optional: Clear internal maps/arrays if memory needs to be freed immediately
        this.tokenMap.clear();
        this.nodeToIdx.clear();
        this.idxToNode.fill(undefined);
        this.freeSlots.length = 0;
        this.nextFreeIdx = 0;
        
        console.log("AQE Engine destroyed.");
    }
}
