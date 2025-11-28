import rrwebPlayer from 'rrweb-player';
import { unzipSync } from 'fflate';
import 'rrweb-player/dist/style.css';

const dropZone = document.getElementById('drop-zone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const playerContainer = document.getElementById('player-container')!;

// Handle click to upload
dropZone.addEventListener('click', () => fileInput.click());

// Handle file selection
fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) processFile(file);
});

// Handle drag & drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#007bff';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ccc';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ccc';
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
});

async function processFile(file: File) {
    if (!file.name.endsWith('.zip')) {
        alert('Please upload a .zip file');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Unzip
        const unzipped = unzipSync(uint8Array);
        
        // Find recording.json
        const jsonFile = unzipped['recording.json'];
        if (!jsonFile) {
            throw new Error('recording.json not found in zip');
        }

        const jsonStr = new TextDecoder().decode(jsonFile);
        const events = JSON.parse(jsonStr);

        console.log('Loaded events:', events.length);
        
        // Clear previous player
        playerContainer.innerHTML = '';

        // Initialize player
        new rrwebPlayer({
            target: playerContainer,
            props: {
                events,
                width: 1024,
                height: 576,
                autoPlay: true,
            },
        });

        dropZone.style.display = 'none';

    } catch (err) {
        console.error('Error processing file:', err);
        alert('Failed to load recording. See console for details.');
    }
}
