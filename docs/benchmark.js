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
    // Aggiorna il numero di nodi se l'engine è già stato inizializzato
    if (lightEngine) {
        // La versione Light ha un limite hardcoded, quindi non possiamo cambiarlo dinamicamente
        // Potresti voler mostrare un avviso se l'utente prova a superarlo
    }
    if (proEngine) {
        // Per la versione Pro, potremmo voler aggiornare il numero di nodi
        // proEngine.setNodeCount(parseInt(e.target.value)); // Assumendo che esista un metodo del genere
    }
});

// Initialize Light engine (always available)
// La versione Light ha un limite hardcoded di 500 nodi.
// Se il numero di nodi richiesto è maggiore, potremmo volerlo troncare o avvisare.
const initialNodeCount = parseInt(nodeCountSlider.value);
const lightMaxNodes = 500; // Limite hardcoded per AIELight
const nodesForLight = Math.min(initialNodeCount, lightMaxNodes);

try {
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

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'test-node';
        if (i % 10 === 0) div.classList.add('active');
        if (i % 5 === 0) div.id = `node-${i}`;
        
        div.style.position = 'absolute';
        // Distribuisci i nodi in modo più uniforme per evitare sovrapposizioni eccessive
        const cols = 100; // Numero di colonne per la griglia
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
        resultsDiv.innerHTML += `<p style="color:red;">Error generating nodes.</p>`;
        benchmarkRunning = false;
        runBenchmarkBtn.disabled = false;
        return;
    }

    // 2. Esegui il test con AQE Light
    if (lightEngine) {
        try {
            // Sincronizza i nodi generati con l'engine Light
            // Assumendo che AIELight abbia un metodo per sincronizzare tutti i nodi generati
            // Se AIELight si basa su MutationObserver, potrebbe non essere necessario un sync esplicito
            // Ma per coerenza con la Pro, potremmo volerlo se disponibile.
            // lightEngine.syncAll(); // Se esiste un metodo syncAll
            
            const startTimeLight = performance.now();
            const resultsLight = lightEngine.query(currentSelector); // Assumendo che query accetti il selettore
            const endTimeLight = performance.now();
            
            resultsDiv.innerHTML += `<p>AQE Light Test:</p>`;
            resultsDiv.innerHTML += `<p>  Selector: <code>${currentSelector}</code></p>`;
            resultsDiv.innerHTML += `<p>  Nodes found: ${resultsLight.length}</p>`;
            resultsDiv.innerHTML += `<p>  Time taken: ${(endTimeLight - startTimeLight).toFixed(2)} ms</p>`;

            // Potresti voler visualizzare una parte dei risultati o un riepilogo
            // resultsDiv.innerHTML += `<p>  Sample results: ${resultsLight.slice(0, 5).map(n => n.id || 'no-id').join(', ')}...</p>`;

        } catch (error) {
            resultsDiv.innerHTML += `<p style="color:red;">Error during AQE Light test: ${error.message}</p>`;
        }
    } else {
        resultsDiv.innerHTML += `<p>AQE Light engine not available.</p>`;
    }

    // 3. Esegui il test con AQE Pro (se disponibile)
    // Per eseguire il test Pro, l'utente dovrà aver scaricato e incluso aqe.pro.min.js
    // e averlo caricato dinamicamente o incluso nello script.
    // Qui assumiamo che AQE (la classe Pro) sia disponibile globalmente dopo il caricamento.
    
    // Controlla se la classe AQE (Pro) è definita
    if (typeof AQE !== 'undefined') {
        try {
            // Inizializza l'engine Pro. Nota: SharedArrayBuffer potrebbe non funzionare su GitHub Pages.
            // Per test locali, assicurati che il server fornisca gli header COOP/COEP.
            // Qui potremmo voler usare un numero di nodi diverso o lo stesso conteggio.
            // Assumiamo che l'engine Pro possa gestire un numero di nodi maggiore rispetto alla Light.
            proEngine = new AQE(count); // Usa lo stesso conteggio per un confronto equo
            resultsDiv.innerHTML += `<p>AQE Pro engine initialized.</p>`;

            // Sincronizza i nodi con l'engine Pro (importante per SharedArrayBuffer)
            // Assumendo che esista un metodo syncAll o simile
            if (typeof proEngine.syncAll === 'function') {
                proEngine.syncAll();
            } else {
                console.warn("AQE Pro engine does not have a syncAll method. Performance might be affected.");
            }

            const startTimePro = performance.now();
            const resultsPro = proEngine.query(currentSelector); // Assumendo che query accetti il selettore
            const endTimePro = performance.now();
            
            resultsDiv.innerHTML += `<p>AQE Pro Test:</p>`;
            resultsDiv.innerHTML += `<p>  Selector: <code>${currentSelector}</code></p>`;
            resultsDiv.innerHTML += `<p>  Nodes found: ${resultsPro.length}</p>`;
            resultsDiv.innerHTML += `<p>  Time taken: ${(endTimePro - startTimePro).toFixed(2)} ms</p>`;

            // Qui potresti aggiungere la logica per creare un grafico comparativo
            // ad esempio usando Chart.js o un altro library, o semplicemente mostrando i risultati testuali.
            // Esempio di visualizzazione testuale:
            const lightTime = endTimeLight - startTimeLight;
            const proTime = endTimePro - startTimePro;
            let comparisonText = "";
            if (proTime < lightTime) {
                comparisonText = `AQE Pro was ${(lightTime / proTime).toFixed(1)}x faster than AQE Light.`;
            } else if (proTime > lightTime) {
                comparisonText = `AQE Light was ${(proTime / lightTime).toFixed(1)}x faster than AQE Pro.`;
            } else {
                comparisonText = `AQE Pro and AQE Light had similar performance.`;
            }
            resultsDiv.innerHTML += `<p><strong>Comparison:</strong> ${comparisonText}</p>`;

        } catch (error) {
            resultsDiv.innerHTML += `<p style="color:red;">Error during AQE Pro test: ${error.message}. SharedArrayBuffer might be unavailable or other issues.</p>`;
        }
    } else {
        resultsDiv.innerHTML += `<p>AQE Pro engine class 'AQE' not found. Ensure 'aqe.pro.min.js' is loaded.</p>`;
        // Potresti voler aggiungere un bottone qui per guidare l'utente a scaricare la Pro
    }

    benchmarkRunning = false;
    runBenchmarkBtn.disabled = false;
}

// --- Event Listener ---
runBenchmarkBtn.addEventListener('click', runBenchmark);

// --- Initial Setup ---
// Genera nodi iniziali al caricamento della pagina, se desiderato
// generateNodes(parseInt(nodeCountSlider.value)); 
// O semplicemente mostra il messaggio iniziale
resultsDiv.innerHTML = `<p>AQE Light engine initialized. Adjust settings and click "Run Benchmark".</p>`;

// Assicurati che il selettore sia inizializzato
currentSelector = selectorInput.value;
