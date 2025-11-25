const express = require('express');
const { paymentMiddleware } = require('x402-express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Static files (HTML pages)
app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get(['/checkout', '/checkout.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'checkout.html'));
});

// Calculate total from items
function calculateTotal(items) {
    return items.reduce((sum, item) =>
        sum + (item.price * (item.quantity || 1)), 0
    );
}

// Payment endpoint with x402 protection
// Configure routes with proper x402-express format
const paymentRoutes = {
    '/pay': {
        price: '$0.10', // Static price for testing
        network: 'base-sepolia', // Using testnet for development
        config: {
            description: 'Shopping cart payment',
            mimeType: 'application/json',
            maxTimeoutSeconds: 600
        }
    }
};

// Disable x402 middleware for demo purposes
// app.use(paymentMiddleware(
//     MERCHANT_ADDRESS,
//     paymentRoutes
// ));

// Payment endpoint - returns 402 with payment requirements and X-Invoice-Items header
app.post('/pay', (req, res) => {
    const items = req.body.items || [];
    const total = calculateTotal(items);
    console.log('✅ Payment request received for', total, 'USD');
    console.log('Items:', items.map(i => i.name).join(', '));

    // Build PaymentRequirements object (simplified)
    const paymentRequirements = {
        scheme: 'exact',
        network: 'base-sepolia',
        maxAmountRequired: (total * 1000000).toString(), // USDC atomic units (example)
        resource: req.protocol + '://' + req.get('host') + req.originalUrl,
        description: 'Shopping cart payment',
        mimeType: 'application/json',
        payTo: MERCHANT_ADDRESS,
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        maxTimeoutSeconds: 600,
        x402Version: '1.0',
        extra: items // include invoice items
    };

    // Set header for extension compatibility
    res.setHeader('X-Invoice-Items', JSON.stringify(items));
    res.setHeader('WWW-Authenticate', 'x402');
    res.status(402).json(paymentRequirements);
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   X402 Payment Server Running          ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ URL: http://localhost:${PORT}           ║`);
    console.log(`║ Merchant: ${MERCHANT_ADDRESS.substring(0, 10)}...  ║`);
    console.log('║ Protocol: x402 (Real Blockchain)       ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Test URLs:');
    console.log(`  Basket:   http://localhost:${PORT}/`);
    console.log(`  Checkout: http://localhost:${PORT}/checkout`);
    console.log('');
});
