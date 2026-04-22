# AQE - Atomic Quantum Engine v2

**AQE** is a revolutionary CSS selector and spatial query engine designed for unparalleled performance in modern web applications. By harnessing the power of **Atomic Operations**, **Parallel Web Workers**, and **Spatial Pruning**, AQE delivers near-instantaneous results, ensuring a consistently smooth UI even in the most demanding scenarios.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Engine: Quantum-Performance](https://img.shields.io/badge/Engine-Atomic--Quantum-blueviolet)](#)

## 🚀 Why AQE?

Traditional DOM querying engines often block the main thread, leading to noticeable UI lag. AQE tackles this by treating the document as a high-speed binary buffer, processed in parallel.

### Key Technical Pillars:
- **Quantum Leap Performance**: Achieved through parallel processing via Web Workers (Pro version).
- **Atomic Synchronization**: Guarantees thread-safe data integrity using `Atomics.load/store` (Pro version).
- **Spatial Pruning**: Integrated **AABB (Axis-Aligned Bounding Box)** intersection for ultra-fast geometric filtering (Pro version).
- **Zero-Latency Memory**: Utilizes `SharedArrayBuffer` for efficient, zero-copy data access between threads (Pro version).
- **Intelligent Memory Management**: Automatic slot recycling and `WeakMap` integration prevent memory leaks in dynamic applications.
- **Bitmask Matching**: O(1) CSS selector matching using 64-bit integer bitmasks.

---

## 💡 Light vs. Pro Version

AQE is available in two versions:

| Feature               | **AQE Light (Free)**                                    | **AQE Pro (Paid)**                                         |
| :-------------------- | :------------------------------------------------------ | :--------------------------------------------------------- |
| **Execution Model**   | Synchronous (Main Thread)                               | **Asynchronous (Parallel Web Worker)**                     |
| **Performance**       | Fast for small DOMs, can block UI                       | **Near-instantaneous, zero UI impact**                     |
| **Max Nodes Tracked** | **500** (Hard Limit)                                    | **Unlimited** (Scales with memory)                         |
| **Memory Management** | Standard JS Objects/Map                                 | **SharedArrayBuffer + Atomics** (Zero-copy, thread-safe) |
| **Spatial Filtering** | Basic (demonstration only)                              | **Advanced AABB Pruning**                                  |
| **Use Case**          | Simple demos, small projects, learning                  | **High-performance apps, games, real-time dashboards**     |
| **License**           | MIT                                                     | Commercial (Contact for details)                           |

---

## 📦 Installation

### AQE Light (Free)

For basic usage and demonstrations, include the light version directly. No special server configuration is needed.

```html
<!-- Include via script tag -->
<script src="path/to/aqe-light.min.js"></script> 
```

### AQE Pro (Paid)

To unlock the full potential of parallel processing and advanced features, you need the Pro version.

1.  **Purchase a license** from William Martin ([williammartin.aqe@gmail.com](mailto:williammartin.aqe@gmail.com)).
2.  **Include the Pro version** in your project. This may involve:
    *   Including a provided `aqe.min.js` file.
    *   Using a private npm package (if available).
    *   Ensuring your server provides the necessary headers for **Cross-Origin Isolation**:
        ```http
        Cross-Origin-Opener-Policy: same-origin
        Cross-Origin-Embedder-Policy: require-corp
        ```

---

## 🛠 Usage

### Initialization

```javascript
// Initialize AQE Light (Free Version)
const lightEngine = new AIELight(500); // Max 500 nodes
lightEngine.syncAll();

// Initialize AQE Pro (Paid Version) - Requires Pro engine loaded
// Ensure AIE (the Pro version class) is loaded before this
if (typeof AIE !== 'undefined') {
    const proEngine = new AIE(50000); // Can handle many more nodes
    // Pro engine might auto-sync or require syncAll() depending on setup
    // proEngine.syncAll(); 
}
```

### High-Speed CSS Query

```javascript
// Query using the Light engine (synchronous)
const activeItemsLight = lightEngine.query('div.active'); 

// Query using the Pro engine (asynchronous, parallel)
// const activeItemsPro = await proEngine.query('div.active'); 
```

### Spatial + CSS Query (AQE Pro Only)

This feature is exclusive to the Pro version for maximum performance.

```javascript
// Find elements within a 100px radius of the mouse cursor
const relevantElements = await proEngine.query('.hover-effect', {
    x: e.clientX,
    y: e.clientY,
    radius: 100
});
```

### Lifecycle Management

```javascript
// Clean up resources when the engine is no longer needed
lightEngine.destroy(); 
// proEngine.destroy(); // Call destroy on the Pro engine instance
```

---

## 👨‍💻 Author

**William Martin**
- **Email**: [williammartin.aqe@gmail.com](mailto:williammartin.aqe@gmail.com)
- **Role**: Lead Architect & Developer

---

## 📄 License

- **AQE Light**: Licensed under the **MIT License**. (See `LICENSE` file)
- **AQE Pro**: Commercial License. Please contact William Martin for details and pricing. (See `LICENSE-PRO.md`)
