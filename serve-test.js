/**
 * Simple HTTP server to serve the test HTML file
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Serve static files
app.use(express.static(__dirname));

// Serve the test HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-websocket-bulk-upload.html'));
});

app.get('/test-resume-status', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-resume-status.html'));
});

app.get('/test-eezo-upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-eezo-upload.html'));
});

app.get('/test-websocket-bulk', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-websocket-bulk-upload.html'));
});

app.listen(port, () => {
    console.log(`🧪 Test server running at http://localhost:${port}`);
    console.log(`📄 Open: http://localhost:${port} to test WebSocket bulk upload`);
    console.log(`🔌 WebSocket server: ws://localhost:5000/ws`);
});
