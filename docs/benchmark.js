// --- Element References ---
const nodeCountSlider = document.getElementById('nodeCount');
const nodeCountValue = document.getElementById('nodeCountValue');
const selectorInput = document.getElementById('selector');
const runBenchmarkBtn = document.getElementById('runBenchmarkBtn');
const resultsDiv = document.getElementById('results');
const chartDiv = document.getElementById('chart'); // Elemento per il grafico (non implementato in questo esempio, ma pronto)

// --- Global Variables ---
let lightEngine = null;
let proEngine = null; // Non verrà inizializzato qui, ma gestito dinamicamente
let nodes = [];
let currentSelector = '';
let benchmarkRunning = false;

// --- Initialization ---
nodeCountValue.textContent = nodeCountSlider.value;
nodeCountSlider.addEventListener('input', (e) => {
    nodeCountValue.textContent = e.target.value;
    // Potresti voler aggiornare l'engine se necessario, ma per ora lasciamo che venga fatto al click del bottone
});

// Initialize Light engine (always available)
// La versione Light ha un limite hardcoded di 500 nodi.
// Se il numero di nodi richiesto è maggiore, tronchiamo per la versione Light.
const initialNodeCount = parseInt(nodeCountSlider.value);
const lightMaxNodes = 500; 
const nodesForLight = Math.min(initialNodeCount, lightMaxNodes);

try {
    // Assicurati che la classe AIELight sia disponibile globalmente
    if (typeof AIELight === 'undefined') {
        throw new Error("AIELight class not found. Ensure aqe-light.min.js is loaded correctly.");
    }
    lightEngine = new AIELight(nodesForLight); 
    resultsDiv.innerHTML = `<p>AQE Light engine initialized with ${nodesForLight} nodes (max ${lightMaxNodes}).</p>`;
} catch (error) {
    resultsDiv.innerHTML += `<p style="color:red;">Error initializing AQE Light: ${error.message}</p>`;
    // Disabilita il benchmark se l'engine Light non può essere inizializzato
    runBenchmarkBtn.disabled = true;
}


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

    const cols = 100; // Numero di colonne per la griglia per distribuire i nodi
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'test-node';
        if (i % 10 === 0) div.classList.add('active');
        if (i % 5 === 0) div.id = `node-${i}`;
        
        div.style.position = 'absolute';
        div.style.left = `${(i % cols) * 10}px`; 
        div.style.top = `${Math.floor(i / cols) * 10}px`;
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

// Function to run the benchmark test
async function runBenchmark() {
    if (benchmarkRunning) {
        resultsDiv.innerHTML += `<p>Benchmark already in progress.</p>`;
        return;
    }
    benchmarkRunning = true;
    runBenchmarkBtn.disabled = true;
    resultsDiv.innerHTML = ''; // Clear previous results
    chartDiv.innerHTML = ''; // Clear previous chart

    const count = parseInt(nodeCountSlider.value);
    currentSelector = selectorInput.value;

    // 1. Genera i nodi DOM
    const generatedNodes = generateNodes(count);
    if (generatedNodes.length !== count) {
        resultsDiv.innerHTML += `<p style="color:red;">Error generating nodes. Expected ${count}, got ${generatedNodes.length}.</p>`;
        benchmarkRunning = false;
        runBenchmarkBtn.disabled = false;
        return;
    }

    // 2. Esegui il test con AQE Light
    let startTimeLight, endTimeLight, resultsLight, lightTime;
    if (lightEngine) {
        try {
            // Per la versione Light, potremmo non aver bisogno di un sync esplicito se usa MutationObserver
            // Ma se AIELight avesse un metodo syncAll(), sarebbe utile per coerenza.
            // Assumiamo che la query venga eseguita direttamente sui nodi generati o tramite l'engine.
            
            startTimeLight = performance.now();
            // Assumiamo che lightEngine.query() sia il metodo corretto per interrogare
            resultsLight = lightEngine.query(currentSelector); 
            endTimeLight = performance.now();
            lightTime = endTimeLight - startTimeLight;
            
            resultsDiv.innerHTML += `<p><strong>AQE Light Test:</strong></p>`;
            resultsDiv.innerHTML += `<p>  Selector: <code>${currentSelector}</code></p>`;
            resultsDiv.innerHTML += `<p>  Nodes found: ${resultsLight.length}</p>`;
            resultsDiv.innerHTML += `<p>  Time taken: ${lightTime.toFixed(2)} ms</p>`;

        } catch (error) {
            resultsDiv.innerHTML += `<p style="color:red;">Error during AQE Light test: ${error.message}</p>`;
            lightTime = Infinity; // Imposta un tempo infinito in caso di errore
        }
    } else {
        resultsDiv.innerHTML += `<p>AQE Light engine not available.</p>`;
        lightTime = Infinity;
    }

    // 3. Esegui il test con AQE Pro (se disponibile)
    // Questo script presuppone che la classe AQE (Pro) sia disponibile globalmente
    // dopo che l'utente ha incluso a mano aqe.pro.min.js nel suo progetto.
    
    let startTimePro, endTimePro, resultsPro, proTime;
    if (typeof AQE !== 'undefined') {
        try {
            // Inizializza l'engine Pro. Nota: SharedArrayBuffer potrebbe non funzionare su GitHub Pages.
            // Per un confronto equo, usiamo lo stesso numero di nodi richiesto dall'utente.
            proEngine = new AQE(count); 
            resultsDiv.innerHTML += `<p>AQE Pro engine initialized.</p>`;

            // Sincronizza i nodi con l'engine Pro (importante per SharedArrayBuffer)
            if (typeof proEngine.syncAll === 'function') {
                proEngine.syncAll();
            } else {
                console.warn("AQE Pro engine does not have a syncAll method. Performance might be affected.");
            }

            startTimePro = performance.now();
            resultsPro = proEngine.query(currentSelector); 
            endTimePro = performance.now();
            proTime = endTimePro - startTimePro;
            
            resultsDiv.innerHTML += `<p><strong>AQE Pro Test:</strong></p>`;
            resultsDiv.innerHTML += `<p>  Selector: <code>${currentSelector}</code></p>`;
            resultsDiv.innerHTML += `<p>  Nodes found: ${resultsPro.length}</p>`;
            resultsDiv.innerHTML += `<p>  Time taken: ${proTime.toFixed(2)} ms</p>`;

            // Confronto testuale delle performance
            let comparisonText = "";
            if (lightTime !== Infinity && proTime !== Infinity) {
                if (proTime < lightTime) {
                    comparisonText = `AQE Pro was ${(lightTime / proTime).toFixed(1)}x faster than AQE Light.`;
                } else if (proTime > lightTime) {
                    comparisonText = `AQE Light was ${(proTime / lightTime).toFixed(1)}x faster than AQE Pro.`;
                } else {
                    comparisonText = `AQE Pro and AQE Light had similar performance.`;
                }
                resultsDiv.innerHTML += `<p><strong>Comparison:</strong> ${comparisonText}</p>`;
            } else if (lightTime === Infinity) {
                 resultsDiv.innerHTML += `<p><strong>Comparison:</strong> AQE Light failed to run.</p>`;
            } else { // proTime === Infinity
                 resultsDiv.innerHTML += `<p><strong>Comparison:</strong> AQE Pro failed to run.</p>`;
            }


        } catch (error) {
            resultsDiv.innerHTML += `<p style="color:red;">Error during AQE Pro test: ${error.message}. Ensure 'aqe.pro.min.js' is correctly loaded and available. SharedArrayBuffer might be unavailable.</p>`;
            proTime = Infinity;
        }
    } else {
        resultsDiv.innerHTML += `<p>AQE Pro engine class 'AQE' not found. Ensure 'aqe.pro.min.js' is loaded.</p>`;
        proTime = Infinity;
    }

    benchmarkRunning = false;
    runBenchmarkBtn.disabled = false;
}

// Event listeners
runBenchmarkBtn.addEventListener('click', runBenchmark);
selectorInput.addEventListener('input', (e) => {
    currentSelector = e.target.value;
});
