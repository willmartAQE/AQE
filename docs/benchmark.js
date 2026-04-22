// --- Element References ---
const nodeCountSlider = document.getElementById('nodeCount');
const nodeCountValue = document.getElementById('nodeCountValue');
const selectorInput = document.getElementById('selector');
const runBenchmarkBtn = document.getElementById('runBenchmarkBtn');
const resultsDiv = document.getElementById('results');
const chartDiv = document.getElementById('chart'); // Elemento per il grafico

// --- Global Variables ---
let lightEngine = null;
let proEngine = null; // Verrà caricato dinamicamente o gestito diversamente
let nodes = [];
let currentSelector = '';

// --- Initialization ---
nodeCountValue.textContent = nodeCountSlider.value;
nodeCountSlider.addEventListener('input', (e) => nodeCountValue.textContent = e.target.value);

// Initialize Light engine (always available)
lightEngine = new AIELight(500); // Light version has a hardcoded limit

// --- Helper Functions ---

// Function to generate DOM nodes for testing
function generateNodes(count) {
    resultsDiv.innerHTML = `<p>Generating ${count} nodes...</p>`;
    const container = document.body; 
    nodes = [];
    const startTime = performance.now();

    // Clear previous nodes
    const existingNodes = document.querySelectorAll('.test-node');
    existingNodes.forEach(n => n.remove());

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'test-node';
        if (i % 10 === 0) div.classList.add('active');
        if (i % 5 === 0) div.id = `node-${i}`;
        
        div.style.position = 'absolute';
        div.style.left = `${(i % 100) * 10}px`; 
        div.style.top = `${Math.floor(i / 100) * 10}px`;
        div.style.width = '5px';
        div.style.height = '5px';
        div.style.backgroundColor = '#ccc';

        container.appendChild(div);
        nodes.push(div);
    }
    const endTime = performance.now();
    resultsDiv.innerHTML += `<p>Nodes generated in ${(endTime - startTime).toFixed(2)} ms.</p>`;
    return nodes;
}

// Function to load script dynamically (for Pro version)
function loadScript(url, callback) {
    return
