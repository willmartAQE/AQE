# AQE - Atomic Quantum Engine

AQE (Atomic Quantum Engine) is a cutting-edge JavaScript library designed to deliver unparalleled performance in DOM querying and manipulation. By leveraging atomic operations, Web Workers (in the Pro version), and a sophisticated spatial pruning architecture, AQE drastically reduces query times, making it ideal for complex web applications, large dataset rendering, and highly interactive user interfaces.

---

## Key Features

*   **Ultra-fast DOM Queries**: Select elements with complex CSS selectors efficiently.
*   **Spatial Filtering**: Narrow down searches based on geometric coordinates.
*   **Dynamic Handling**: Automatically synchronizes DOM changes via `MutationObserver`.
*   **Scalable Architecture**: Designed to handle from a few to millions of elements.
*   **Intuitive API**: Easy to integrate into your workflow.

---

## Installation

AQE is provided as a set of JavaScript files. Include the relevant engine file in your project HTML:

```html
<!-- Include the engine file -->
<script src="path/to/aqe-engine.js"></script> 
```

**Note:** The specific engine file name (`aqe-light.min.js` or `aqe.pro.min.js`) depends on the version you intend to use and its availability. Ensure the path is correct relative to your `index.html`.

---

## Usage

### Initialization

```javascript
// Initialize the engine. The constructor might take arguments 
// like maxNodes or configuration options depending on the specific engine file.
// Example for a hypothetical engine file:
const engine = new AQE(50000); // Example initialization with max 50,000 nodes
```

### Node Synchronization

AQE automatically synchronizes DOM nodes when they are added or modified. You can also force a full synchronization:

```javascript
// Synchronize all currently existing nodes in the document
engine.syncAll();
```

### Executing Queries

```javascript
// Example query with a CSS selector
const nodes = await engine.query('div.my-class#unique-id');

// Example query with a spatial filter (if supported by the engine)
// The exact format for spatial filters might vary based on the engine implementation.
// const bounds = { x: 100, y: 200, radius: 50 }; 
// const nodesWithSpatialFilter = await engine.query('p.highlight', bounds); 
```

### Lifecycle Management

It's important to destroy the engine when it's no longer needed to free up resources (like Web Workers or MutationObservers).

```javascript
// When you no longer need the engine
engine.destroy();
```

---

## Contributing

Contributions are welcome! Please open an issue or a pull request.

---

## License

This project is licensed under the [MIT](LICENSE) License.

---
