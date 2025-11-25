const http = require('http');

const server = http.createServer((req, res) => {
    if (req.url === '/pay') {
        res.writeHead(402, {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'x402 token="abc12345"',
            'X-Custom-Header': 'test-value'
        });
        res.end(JSON.stringify({ error: 'Payment Required' }));
        console.log('Responded with 402 to /pay');
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello World');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Mock server running at http://localhost:${PORT}`);
    console.log(`Test URL: http://localhost:${PORT}/pay`);
});
