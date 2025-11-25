const http = require('http');

const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    if (req.url === '/pay' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let items = [];
            try {
                const data = JSON.parse(body);
                items = data.items || [];
            } catch (e) {
                console.error('Failed to parse request body');
            }

            // Always return 402 for /pay
            res.writeHead(402, {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'x402 token="abc12345"',
                'X-Custom-Header': 'test-value',
                'X-Invoice-Items': JSON.stringify(items)
            });
            res.end(JSON.stringify({
                error: 'Payment Required',
                protocol: 'x402',
                items: items
            }));
        });
    } else if (req.url === '/checkout' || req.url === '/checkout.html') {
        // Serve checkout page
        const filePath = path.join(__dirname, 'checkout.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Checkout page not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Mock server running at http://localhost:${PORT}`);
    console.log(`Test URL: http://localhost:${PORT}/pay`);
});
