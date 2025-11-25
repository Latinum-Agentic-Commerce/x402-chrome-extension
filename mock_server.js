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

            // Calculate total in USD cents
            const totalUSD = items.reduce((sum, item) =>
                sum + (item.price * (item.quantity || 1)), 0
            );

            // Convert to USDC (6 decimals) - $1 = 1,000,000 USDC
            const usdcAmount = Math.floor(totalUSD * 1000000);

            // X402 compliant response
            const paymentRequirements = {
                scheme: "exact",
                network: "base",
                maxAmountRequired: usdcAmount.toString(),
                resource: req.headers.origin + req.url,
                description: "Shopping cart payment",
                mimeType: "application/json",
                payTo: "0x1234567890123456789012345678901234567890", // Mock merchant address
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
                maxTimeoutSeconds: 600,
                x402Version: "1.0",
                extra: items // Include invoice items as extra data
            };

            // Always return 402 for /pay
            res.writeHead(402, {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'x402',
                'X-Invoice-Items': JSON.stringify(items) // Keep for backwards compat
            });
            res.end(JSON.stringify(paymentRequirements));
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
