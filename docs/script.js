// --- Element References ---
const nodeCountSlider = document.getElementById('nodeCount');
const nodeCountValue = document.getElementById('nodeCountValue');
const selectorInput = document.getElementById('selector');
const testLightBtn = document.getElementById('testLightBtn');
const testProBtn = document.getElementById('testProBtn');
const outputDiv = document.getElementById('output');

// --- Global Variables ---
let lightEngine = null;
let proEngine = null;
let nodesToTest = [];
let currentSelector = '';

// --- Initialization ---
nodeCountValue.textContent = nodeCountSlider.value;
nodeCountSlider.addEventListener('input', (e) => nodeCountValue.textContent = e.target.value);

// Load the Pro version dynamically if available (e.g., from a paid CDN or local file)
// For this demo, we'll assume it's loaded via a separate script tag or imported.
// If not loaded, disable the Pro button.
if (typeof AIE !== 'undefined') {
    proEngine = new AIE(parseInt(nodeCountSlider.value));
    console.log("Pro Engine loaded.");
} else {
    testProBtn.disabled = true;
    testProBtn.textContent += " (Pro Engine Not Loaded)";
    console.log("Pro Engine not loaded. Testing will be limited.");
}

// Initialize Light engine (always available)
lightEngine = new AIELight(500); // Light version has a hardcoded limit

// --- Helper Functions ---
function generateNodes(count) {
    outputDiv.innerHTML = `<p>Generating ${count} nodes...</p>`;
    const container = document.body; // Append to body for layout calculation
    nodesToTest = [];
    const startTime = performance.now();

    // Clear previous nodes if any
    const existingNodes = document.querySelectorAll('.test-node');
    existingNodes.forEach(n => n.remove());

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'test-node';
        // Add classes dynamically to make selectors more interesting
        if (i % 10 === 0) div.classList.add('active');
        if (i % 5 === 0) div.id = `node-${i}`;
        
        // Position nodes to test spatial queries
        div.style.position = 'absolute';
        div.style.left = `${(i % 100) * 10}px`; 
        div.style.top = `${Math.floor(i / 100) * 10}px`;
        div.style.width = '5px';
        div.style.height = '5px';
        div.style.backgroundColor = '#ccc';

        container.appendChild(div);
        nodesToTest.push(div);
    }
    const endTime = performance.now();
    outputDiv.innerHTML += `<p>Nodes generated in ${(endTime - startTime).toFixed(2)} ms.</p>`;
    return nodesToTest;
}

function runTest(engineInstance, testName) {
    currentSelector = selectorInput.value;
    outputDiv.innerHTML += `<p>Running <strong>${testName}</strong> with selector "<code>${currentSelector}</code>"...</p>`;
    
    // Sync the engine with the generated nodes
    // Note: Light engine syncs on the fly or needs manual sync
    if (engineInstance instanceof AIELight) {
       engineInstance.syncAll(); // Sync all generated nodes for Light
    } else if (engineInstance.syncNode) { // Assume Pro engine syncs automatically or needs manual call
       // If Pro engine syncs automatically via observer, this might not be needed
       // If Pro needs manual sync: engineInstance.syncAll();
    }

    const startTime = performance.now();
    
    // Execute the query
    const results = engineInstance.query(currentSelector); 
    
    const endTime = performance.now();
    
    outputDiv.innerHTML += `<p><strong>${testName}</strong> completed in <strong>${(endTime - startTime).toFixed(2)} ms</strong>. Found ${results.length} nodes.</p>`;
    
    // Optional: Highlight results
    // results.forEach(n => n.style.backgroundColor = 'red'); 
}

// --- Event Listeners ---
testLightBtn.addEventListener('click', () => {
    const count = parseInt(nodeCountSlider.value);
    generateNodes(count); // Regenerate nodes for a clean test
    runTest(lightEngine, "Light Version");
});

testProBtn.addEventListener('click', async () => {
    if (!proEngine) {
        alert("Pro Engine is not loaded. Cannot run Pro test.");
        return;
    }
    const count = parseInt(nodeCountSlider.value);
    generateNodes(count); // Regenerate nodes for a clean test
    
    // Pro engine might need initial sync if not using observer for initial load
    // If using observer, ensure it's active and has processed the nodes.
    // For simplicity here, we assume syncAll is called or observer handles it.
     try {
        // If Pro engine has an async setup or syncAll, await it.
        // Example: if (proEngine.init) await proEngine.init(); 
        runTest(proEngine, "Pro Version");
     } catch (error) {
         outputDiv.innerHTML += `<p style="color:red;">Error running Pro test: ${error.message}</p>`;
     }
});

// Initial node generation on load
generateNodes(parseInt(nodeCountSlider.value));
