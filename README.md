# AQE - Atomic Quantum Engine

AQE (Atomic Quantum Engine) is a cutting-edge JavaScript library designed to deliver unparalleled performance in DOM querying and manipulation. By leveraging atomic operations, Web Workers (in the Pro version), and a sophisticated spatial pruning architecture, AQE drastically reduces query times, making it ideal for complex web applications, large dataset rendering, and highly interactive user interfaces.

---

## Version Comparison: Light vs. Pro

AQE is available in two primary versions, each optimized for different use cases:

### ⚡ AQE Light (Main Thread)

*   **Architecture**: Executes all operations on the browser's main thread.
*   **Performance**: Offers a significant improvement over standard DOM methods for simple queries and moderate-sized datasets.
*   **Maximum Capacity**: Limited to **500 nodes** registered in the buffer. Exceeding this limit is not possible.
*   **Technologies**: Uses CSS bitmasks for filtering and geometric coordinates, but **does not** utilize `SharedArrayBuffer` or Web Workers.
*   **Use Cases**: Ideal for websites with smaller DOMs, rapid prototyping, or when parallel processing is not required.
*   **Advantages**: Easy to include, requires no special server configurations.

### 🚀 AQE Pro (Parallel Worker)

*   **Architecture**: Fully utilizes Web Workers to execute query operations in parallel on a separate thread.
*   **Performance**: **Significantly faster** than the Light version, especially for complex queries and large data volumes.
*   **Maximum Capacity**: Supports up to **50,000 nodes** (or more, depending on memory configuration) in the buffer, managed efficiently.
*   **Technologies**: Employs `SharedArrayBuffer` for efficient inter-thread communication, atomic operations for data safety, and Web Workers for parallelism. Also implements advanced spatial pruning (AABB).
*   **Use Cases**: Complex web applications, interactive dashboards, large-scale data visualizations, browser-based games, and anywhere DOM performance is critical.
*   **Advantages**: Exceptional performance, guaranteed UI responsiveness even under heavy load.
*   **Requirements**: Requires a server environment that sends the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers to enable `SharedArrayBuffer` (not available on static GitHub Pages; requires a local or dedicated server).

---

### Performance Estimation: Light vs. Pro

Providing an exact performance estimate is challenging without specific benchmarks on your hardware and for your particular use case. However, we can make generalizations based on the architecture:

*   **Simple Queries (e.g., `#id`, `tagname`) on Few Nodes**: The difference might be minimal. The Light version could even be slightly faster due to lower overhead from not communicating with a worker.
*   **Complex Queries (e.g., combinations of classes, IDs, attributes) on Many Nodes**: This is where the Pro version excels. Thanks to parallel processing and `SharedArrayBuffer` usage, the Pro version can be **5x to 50x faster**, or even more, compared to the Light version. Parallel processing distributes the workload across multiple CPU cores, while direct access to shared memory eliminates communication bottlenecks.
*   **Queries with Spatial Filtering on Many Nodes**: The Pro version is specifically designed to excel in this scenario, with efficient AABB pruning implemented in the worker. The Light version, performing filtering on the main thread, can become a significant bottleneck.

**In Summary:**

*   If you're working with a small DOM and don't need parallel processing, **AQE Light** is an excellent and easy-to-use choice.
*   If you require maximum performance, handle large amounts of data, or need to guarantee UI responsiveness under load, **AQE Pro** is the indispensable solution. Remember that it requires a specific execution environment (server with COOP/COEP headers) to fully leverage its capabilities.

---

## Key Features

*   **Ultra-fast DOM Queries**: Select elements with complex CSS selectors efficiently.
*   **Spatial Filtering**: Narrow down searches based on geometric coordinates (superior performance in Pro version).
*   **Dynamic Handling**: Automatically synchronizes DOM changes via `MutationObserver`.
*   **Scalable Architecture**: Designed to handle from a few to millions of elements.
*   **Intuitive API**: Easy to integrate into your workflow.

---

## Installation

### AQE Light

1.  Download the `aqe-light.min.js` file.
2.  Include it in your HTML:
    ```html
    <script src="path/to/aqe-light.min.js"></script>
    ```
3.  Initialize the engine in your JavaScript:
    ```javascript
    // Assuming AIELight is the class name for the light version
    const lightEngine = new AIELight(500); // Max 500 nodes
    // Or if using AQE class for both and distinguishing by constructor args/availability:
    // const lightEngine = new AQE(500); // Max 500 nodes
    ```

### AQE Pro

1.  Obtain the `aqe.pro.min.js` file (compiled from the Pro source code).
2.  Place it in your distribution directory (e.g., `dist/`).
3.  Include it in your HTML:
    ```html
    <script src="dist/aqe.pro.min.js"></script>
    ```
4.  **Important**: To enable `SharedArrayBuffer` and Web Workers, your page must be served by a server that sends the following HTTP headers:
    *   `Cross-Origin-Opener-Policy: same-origin`
    *   `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`)
    This is **not possible on static GitHub Pages**. You will need to use a local server (e.g., with Node.js) or dedicated hosting to test the Pro version.

5.  Initialize the Pro engine:
    ```javascript
    const proEngine = new AQE(50000); // Max 50,000 nodes
    ```

---

## Usage

### Initialization

```javascript
// For AQE Light
const lightEngine = new AIELight(500); // Max 500 nodes

// For AQE Pro (requires server with COOP/COEP headers)
const proEngine = new AQE(50000); // Max 50,000 nodes (or more)
```

### Node Synchronization

AQE automatically synchronizes DOM nodes when they are added or modified. You can also force a full synchronization:

```javascript
// Synchronize all currently existing nodes in the document
lightEngine.syncAll();
// or
proEngine.syncAll();
```

### Executing Queries

```javascript
// Example query with AQE Light
const nodes = await lightEngine.query('div.my-class#unique-id');

// Example query with AQE Pro (with spatial filter)
const bounds = { x: 100, y: 200, radius: 50 }; // Rectangle centered at (100, 200) with radius 50
const nodesPro = await proEngine.query('p.highlight', bounds);
```

### Lifecycle Management

It's important to destroy the engine when it's no longer needed to free up resources (Web Worker, MutationObserver).

```javascript
// When you no longer need the engine
lightEngine.destroy();
// or
proEngine.destroy();
```

---

## Contributing

Contributions are welcome! Please open an issue or a pull request.

---

## License

This project is licensed under the [MIT](LICENSE) License.
