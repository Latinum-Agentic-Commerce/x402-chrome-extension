const http = require('http');

const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    if (req.url === '/pay') {
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
                console.error("Failed to parse body", e);
            }

            res.writeHead(402, {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'x402 token="abc12345"',
                'X-Custom-Header': 'test-value',
                'X-Invoice-Items': JSON.stringify(items) // Attach items to header
            });
            res.end(JSON.stringify({
                error: 'Payment Required',
                invoice: {
                    items: items,
                    total: items.reduce((sum, item) => sum + item.price, 0)
                }
            }));
            console.log('Responded with 402 to /pay with items:', items.length);
        });
    } else if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Mock server running at http://localhost:${PORT}`);
    console.log(`Test URL: http://localhost:${PORT}/pay`);
});
