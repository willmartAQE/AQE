# ⚡ AQE — Atomic Quantum Engine

> A high-performance CSS selector engine built on BigInt bitmasks, SharedArrayBuffer, dual Bloom bucket indexing, and off-thread Web Worker matching.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
  - [Bitmask System](#bitmask-system)
  - [Bloom Bucket Index](#bloom-bucket-index)
  - [SharedArrayBuffer & Atomics](#sharedarraybuffer--atomics)
  - [Web Worker](#web-worker)
  - [MutationObserver](#mutationobserver)
  - [Query Pipeline](#query-pipeline)
- [Editions](#editions)
  - [AQE Light](#aqe-light-free)
  - [AQE Pro](#aqe-pro-paid)
- [Performance](#performance)
  - [Benchmark Estimates](#benchmark-estimates)
  - [Why AQE Pro Is Faster](#why-aqe-pro-is-faster)
- [Supported Selector Syntax](#supported-selector-syntax)
- [Installation](#installation)
- [Usage](#usage)
  - [AQE Light](#usage--aqe-light)
  - [AQE Pro](#usage--aqe-pro)
- [API Reference](#api-reference)
- [Architecture Diagram](#architecture-diagram)
- [Limitations & Trade-offs](#limitations--trade-offs)
- [Get AQE Pro](#get-aqe-pro)
- [Contact](#contact)
- [License](#license)

---

## Overview

AQE replaces the traditional DOM traversal model with a **flat, memory-mapped approach**. Every node in the document is projected into a compact binary representation stored in a typed array. CSS tokens — tag names, class names, IDs, attributes, pseudo-classes — are each assigned a unique bit in a 64-bit BigInt mask. Matching a selector becomes a bitwise AND operation rather than a recursive tree walk.

The result is a selector engine that scales sub-linearly on large, complex DOMs and stays responsive under high query frequency by offloading scanning to a background thread.

---

## How It Works

### Bitmask System

When a node is registered, AQE computes its **CSS bitmask**: a 64-bit integer where each bit corresponds to a unique CSS token.

```
div#main.active[data-ready]  →  bit_0 (div) | bit_1 (#main) | bit_2 (.active) | bit_3 ([data-ready])
```

Querying `div.active` produces a **target mask** with the same bits. Matching is then:

```
(nodeMask & targetMask) === targetMask
```

This reduces selector matching to a single integer comparison per node — no string parsing, no tree climbing, no attribute iteration at query time.

Masks are split into two 32-bit integers (`mLow`, `mHigh`) for storage in `Int32Array`. Beyond 63 unique tokens, bits alias (Bloom-style false positives), which are harmless: aliased candidates are validated by `el.matches()` on the main thread.

### Bloom Bucket Index

AQE Pro maintains a **dual Bloom bucket index** alongside the main buffer. The node pool is divided into buckets of 32 nodes each. For every bucket, two 32-bit summary integers (`bloomLow`, `bloomHigh`) are kept: the OR of every node mask in that bucket.

Before scanning a bucket, the Worker checks:

```
(bloomLow[b]  & targetLow)  === targetLow
(bloomHigh[b] & targetHigh) === targetHigh
```

If either check fails, **the entire bucket of 32 nodes is skipped in a single operation**. On a typical page where most selectors are class or ID-specific, the majority of buckets are eliminated before any node-level comparison occurs.

The Bloom index is updated incrementally: `syncNode` uses `Atomics.or` to set bits, and `unsyncNode` recomputes the bucket by OR-ing the remaining 31 nodes — O(32) fixed cost.

### SharedArrayBuffer & Atomics

AQE Pro allocates three `SharedArrayBuffer` regions:

| Buffer | Contents | Size |
|---|---|---|
| `buffer` | Node masks + spatial coordinates | `maxNodes × 32 bytes` |
| `bloomLowBuffer` | Bucket OR summary (low 32 bits) | `⌈maxNodes/32⌉ × 4 bytes` |
| `bloomHighBuffer` | Bucket OR summary (high 32 bits) | `⌈maxNodes/32⌉ × 4 bytes` |

All reads and writes use `Atomics.store` / `Atomics.load` / `Atomics.or`, guaranteeing **sequential consistency** between the main thread and the Worker without locks or copying.

### Web Worker

The scanning loop runs entirely off the main thread. The Worker receives the shared buffer references (zero-copy transfer) and a serialised representation of the query steps, then:

1. Iterates over Bloom buckets, skipping mismatches instantly.
2. For each surviving bucket, scans up to 32 nodes with bitwise AND.
3. Optionally applies a spatial AABB filter (geometric pruning).
4. Returns an array of matching node indices via `postMessage`.

Each query carries a unique `queryId`. Responses are routed back to the originating `Promise` via a `Map` of pending callbacks, making concurrent queries fully safe.

### MutationObserver

AQE watches the live DOM for structural and attribute changes:

- **`childList`** mutations call `syncNode` on added nodes and `unsyncNode` on removed nodes — freeing their buffer slots into a `freeSlots` pool for reuse.
- **`attributes`** mutations re-sync the affected node, recomputing its mask to reflect class, id, or attribute changes.

This keeps the buffer a real-time mirror of the DOM with no polling.

### Query Pipeline

```
query(selector)
    │
    ├─ _parse()         → branch[] of { mask, relation } steps
    │
    ├─ selector list?   → fan out _querySingle() in Promise.all, deduplicate
    │
    └─ _querySingle()
            │
            ├─ compute mLow / mHigh for each step
            ├─ postMessage to Worker (zero-copy SharedArrayBuffer)
            │
            └─ Worker response
                    │
                    ├─ map indices → DOM nodes
                    └─ complex selector? → filter with el.matches()
```

---

## Editions

### AQE Light *(free)*

AQE Light is a dependency-free, single-class implementation designed for moderate-scale projects and environments where `SharedArrayBuffer` is unavailable (e.g. cross-origin contexts without COOP/COEP headers).

**How it works:**
- Maintains a plain `Map<Element, bigint>` registry on the main thread.
- Query is synchronous: iterates the registry, applies bitmask pre-filter, then `el.matches()` for complex selectors.
- No Worker, no Bloom index, no shared memory.
- Manual `syncNode` / `syncAll` — no automatic MutationObserver.

**Best suited for:** projects with up to ~5,000 nodes, infrequent queries, or environments with strict security headers.

### AQE Pro *(paid)*

AQE Pro is the full engine: off-thread scanning, Bloom bucket skipping, atomic shared memory, live DOM observation, concurrent query support, and full CSS selector coverage.

**Best suited for:** large SPAs, design tools, virtual DOMs, dashboards, or any context with 5,000+ nodes and high query throughput.

---

## When AQE Light Is Faster Than querySelectorAll

`querySelectorAll` always searches the **entire document**. It has no concept of scope — every call walks every node in the DOM tree from the root.

AQE Light maintains a **registry** of nodes you explicitly sync. This means it only searches the nodes you care about.

When your registry is smaller than the full DOM, AQE Light wins — not because its algorithm is faster, but because it does less work:

```js
// querySelectorAll: searches all 50,000 nodes in the document
document.querySelectorAll('.active[data-ready]');

// AQE Light: searches only the 2,000 nodes in your component tree
const engine = new AQELight();
myComponentNodes.forEach(el => engine.syncNode(el));
engine.query('.active[data-ready]'); // 25× less work
```

**Practical examples where this applies:**

- A virtual list that renders 500 rows out of 100,000 records
- A design tool that tracks only the selected layer's children
- A dashboard widget that manages its own internal node set
- A component library that scopes queries to its own shadow tree

**When querySelectorAll is faster:**

If you sync the entire document (`engine.syncAll()`) and query once, `querySelectorAll` wins — it is implemented in C++ inside the browser engine and has no JavaScript overhead. AQE Light is not a drop-in replacement for arbitrary one-off queries.

**Rule of thumb:** the smaller your registry relative to the full DOM, the larger AQE Light's advantage. At 20% of the DOM, expect 3–5× faster queries. At 5%, expect 10–15×.

---

## Performance

### Live Benchmark

Run the benchmark directly in your browser — real DOM nodes, real measurements via `performance.now()`, no mocks:

**🔬 [willmartaqe.github.io/AQE](https://willmartaqe.github.io/AQE/)**

Configure DOM size (up to 50,000 nodes), selector, hit rate and iterations. AQE Light runs live in your browser; AQE Pro times are simulated based on its measured algorithmic properties (Bloom bucket skipping + Worker overhead).

---

### Benchmark Estimates

The following estimates are based on a DOM of **20,000 nodes** with an average of 3 classes and 2 attributes per node, querying a moderately selective compound selector (`.active[data-ready]`).

| Scenario | `querySelectorAll` (native) | AQE Light | AQE Pro |
|---|---|---|---|
| Cold query, 20k nodes | ~4–8 ms | ~3–6 ms | **~0.3–0.8 ms** |
| Warm query (cached tokens) | ~4–8 ms | ~1–3 ms | **~0.1–0.4 ms** |
| 100 concurrent queries | ~400–800 ms | ~150–300 ms | **~5–15 ms** |
| Spatial filter (radius 200px) | not supported | not supported | **~0.05–0.2 ms** |
| DOM of 50,000 nodes | ~10–20 ms | ~8–15 ms | **~0.5–1.5 ms** |

> Estimates assume a modern desktop browser (V8/SpiderMonkey). Mobile devices may show 1.5–3× slower absolute times across all columns, with AQE Pro's relative advantage maintained.

### Why AQE Pro Is Faster

**1. Off-thread execution.**
The Worker runs the scan loop concurrently with the main thread. On multi-core hardware the query resolves while the UI thread continues rendering — zero jank contribution.

**2. Bloom bucket skipping.**
With 32 nodes per bucket and a selective target mask, typically 60–90% of buckets are eliminated in two integer comparisons. At 20,000 nodes (625 buckets), a selective query may inspect fewer than 100 actual nodes.

**3. Zero-copy memory access.**
`SharedArrayBuffer` is passed by reference to the Worker — no serialisation, no `structuredClone`, no memory allocation on the transfer. The three buffers for a 50,000-node pool consume ~1.6 MB total.

**4. Atomic consistency without locking.**
`Atomics.store` / `Atomics.load` / `Atomics.or` provide sequentially consistent access across threads without mutexes or `Transferable` ownership transfers, eliminating copy overhead on every query.

**5. Incremental sync.**
`freeSlots` reuse means removed nodes immediately free their buffer position for the next inserted node — no compaction, no reallocation, constant-time insert and remove.

**Rough speed ratio between editions:**

| Query type | AQE Light vs AQE Pro |
|---|---|
| Simple selector, 5k nodes | ~3–5× faster (Pro) |
| Compound selector, 20k nodes | **~8–15× faster (Pro)** |
| High-frequency (100 req/s), 20k nodes | **~20–40× faster (Pro)** |
| Spatial filter query | ∞ (feature not available in Light) |

---

## Supported Selector Syntax

| Feature | AQE Light | AQE Pro |
|---|---|---|
| Tag `div` | ✅ | ✅ |
| Class `.active` | ✅ | ✅ |
| ID `#main` | ✅ | ✅ |
| Attribute `[type]` `[type=text]` | ✅ | ✅ |
| Attribute operators `^=` `$=` `*=` `~=` `\|=` | ✅ | ✅ |
| Compound `div.active#main` | ✅ | ✅ |
| Selector list `h1, h2, h3` | ✅ | ✅ |
| Descendant `div .child` | ✅ (via `el.matches`) | ✅ (via `el.matches`) |
| Child `div > .child` | ✅ (via `el.matches`) | ✅ (via `el.matches`) |
| Adjacent `h1 + p` | ✅ (via `el.matches`) | ✅ (via `el.matches`) |
| Sibling `h1 ~ p` | ✅ (via `el.matches`) | ✅ (via `el.matches`) |
| Pseudo `:checked` `:disabled` `:focus` | ✅ | ✅ |
| Pseudo `:not()` `:is()` `:where()` `:has()` | ✅ (via `el.matches`) | ✅ (via `el.matches`) |
| Pseudo-element `::before` | partial | ✅ |
| Spatial filter `{x, y, radius}` | ❌ | ✅ |
| Live DOM observation | ❌ | ✅ |
| Concurrent async queries | ❌ | ✅ |
| Off-thread execution | ❌ | ✅ |

---

## Installation

### AQE Light

No build step required. Drop the file into your project and import it.

**Via npm:**
```bash
npm install atomic-quantum-engine
```

**Via script tag (local):**
```html
<script src="AQE-Light.js"></script>
```

**Via CDN — unpkg:**
```html
<script src="https://unpkg.com/atomic-quantum-engine@latest/AQE-light.js"></script>
```

**Via CDN — jsDelivr:**
```html
<script src="https://cdn.jsdelivr.net/npm/atomic-quantum-engine@latest/AQE-light.js"></script>
```

**Via ES module (local):**
```js
import AQELight from './AQE-Light.js';
```

**Via ES module (unpkg):**
```js
import AQELight from 'https://unpkg.com/atomic-quantum-engine@latest/AQE-light.js';
```

**Via ES module (jsDelivr):**
```js
import AQELight from 'https://cdn.jsdelivr.net/npm/atomic-quantum-engine@latest/AQE-light.js';
```

### AQE Pro

AQE Pro requires `SharedArrayBuffer`, which is available only in **secure contexts** with cross-origin isolation. Add the following headers to your server:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Via script tag:**
```html
<script src="AQE-Pro.js"></script>
```

**Via ES module:**
```js
import AQE from './AQE-Pro.js';
```

> AQE Pro is available for purchase at [williammartin.lemonsqueezy.com](https://williammartin.lemonsqueezy.com) or by contacting the developer directly (see [Contact](#contact)).

---

## Usage

### Usage — AQE Light

```js
const engine = new AQELight();

// Sync the full DOM once on init
engine.syncAll();

// Simple query
const buttons = engine.query('button.primary');

// Compound selector
const inputs = engine.query('input[type=text].visible');

// Selector list
const headings = engine.query('h1, h2, h3');

// Complex selector (descendant)
const items = engine.query('.sidebar > ul li.active');

// Re-sync a node after a manual class change
el.classList.add('highlighted');
engine.syncNode(el);

// Clean up
engine.destroy();
```

### Usage — AQE Pro

```js
const engine = new AQE(50_000); // maxNodes (default 50,000)

// Sync the full DOM once on init.
// After this, MutationObserver keeps the buffer live automatically.
engine.syncAll();

// Simple async query
const buttons = await engine.query('button.primary');

// Compound selector
const inputs = await engine.query('input[type=text].visible:not(:disabled)');

// Selector list — branches run in parallel
const headings = await engine.query('h1, h2, h3');

// Complex selector
const items = await engine.query('.sidebar > ul li.active');

// Spatial query — only nodes within a 300px radius of (500, 400)
const nearby = await engine.query('.tooltip', { x: 500, y: 400, radius: 300 });

// Concurrent queries — fully safe, each resolves independently
const [navItems, cards, badges] = await Promise.all([
    engine.query('nav a.active'),
    engine.query('.card[data-loaded]'),
    engine.query('span.badge:not(.hidden)'),
]);

// Clean up Worker and Observer when done
engine.destroy();
```

---

## API Reference

### `AQELight`

| Method | Signature | Description |
|---|---|---|
| `syncNode` | `(el: Element) → void` | Registers or updates a single node |
| `unsyncNode` | `(el: Element) → void` | Removes a node from the registry |
| `syncAll` | `() → void` | Syncs all nodes currently in the document |
| `query` | `(selector: string) → Element[]` | Synchronous selector query |
| `destroy` | `() → void` | Clears registry and token map |

### `AQE` (Pro)

| Method | Signature | Description |
|---|---|---|
| `syncNode` | `(el: Element) → void` | Registers or updates a single node in the shared buffer |
| `unsyncNode` | `(el: Element) → void` | Removes a node and frees its buffer slot |
| `syncAll` | `() → void` | Full DOM sync — call once on init |
| `query` | `(selector: string, spatial?: {x, y, radius}) → Promise<Element[]>` | Async query, off-thread |
| `destroy` | `() → void` | Terminates the Worker and disconnects the Observer |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        Main Thread                       │
│                                                         │
│  DOM ──MutationObserver──▶ syncNode()                   │
│                                │                        │
│                         BigInt bitmask                  │
│                                │                        │
│              ┌─────────────────▼──────────────────┐     │
│              │         SharedArrayBuffer           │     │
│              │  [mask_low | mask_high | x|y|w|h]  │     │
│              └─────────────────┬──────────────────┘     │
│                                │   (zero-copy ref)      │
│  query() ──────────────────────▼                        │
│                         postMessage()                   │
└─────────────────────────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │         Web Worker          │
                    │                            │
                    │  Bloom bucket check ──▶ skip 32 nodes
                    │         │                  │
                    │  bitmask AND per node       │
                    │         │                  │
                    │  spatial AABB filter        │
                    │         │                  │
                    │  postMessage(matches)       │
                    └─────────┬──────────────────┘
                              │
                    ┌─────────▼──────────────────┐
                    │       Main Thread           │
                    │                            │
                    │  idx[] → Element[]         │
                    │  complex? → el.matches()   │
                    │  resolve(Promise)          │
                    └────────────────────────────┘
```

---

## Limitations & Trade-offs

**Bit aliasing beyond 63 tokens.**
AQE uses 64-bit masks split into two 32-bit integers. Once more than 63 unique CSS tokens are registered, new tokens alias onto existing bit positions. This produces Bloom-style false positives (candidates that pass the bitmask check but fail `el.matches()`), not false negatives. Correctness is preserved; only a negligible number of extra `el.matches()` calls are added.

**`SharedArrayBuffer` requires cross-origin isolation (Pro).**
The headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` must be set. This is a browser security requirement, not an AQE constraint.

**Combinator validation on the main thread.**
Complex selectors (`div > .child`, `.parent ~ .sibling`) are pre-filtered by the Worker using the subject (last compound part) bitmask, then validated by `el.matches()` on the main thread. For selectors where the subject is very broad (e.g. `* > .item`), the pre-filter is less effective and more `el.matches()` calls occur.

**Spatial coordinates are viewport-relative.**
`getBoundingClientRect()` returns coordinates relative to the current viewport. Spatial queries assume a stable scroll position at sync time. Call `syncAll()` after large scroll events if spatial accuracy is critical.

---

## Get AQE Pro

AQE Pro is available through the official store or directly from the developer.

- 🛒 **Store:** [williammartin.lemonsqueezy.com](https://williammartin.lemonsqueezy.com)
- 📧 **Direct contact:** [williammartin.aqe@gmail.com](mailto:williammartin.aqe@gmail.com)

Licences are available for individual developers, teams, and enterprise use. Reach out by email for volume pricing or custom integration support.

---

## Contact

For bug reports, feature requests, or general questions, open an issue on this repository or write to [williammartin.aqe@gmail.com](mailto:williammartin.aqe@gmail.com).

---

## License

**AQE Light** is released under the [MIT License](LICENSE).

**AQE Pro** is a commercial product. Redistribution, reverse engineering, and sublicensing are prohibited without explicit written permission from the author. See the licence file included with your purchase for full terms.
