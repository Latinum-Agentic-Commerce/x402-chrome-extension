const express = require('express');
const { paymentMiddleware } = require('x402-express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
// UUID generator for payment IDs
const { v4: uuidv4 } = require('uuid');
// In‑memory store for pending payments (demo only)
const pendingPayments = {};
// AJV validator for basket schema (v2)
const Ajv = require('ajv');
const ajv = new Ajv();
// Load the basket JSON‑Schema from the cloned x402 v2 repository
const basketSchema = require('./x402_v2/specs/schemes/basket.schema.json');
const validateBasket = ajv.compile(basketSchema);

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

    const paymentId = uuidv4();
    const maxTimeoutSeconds = 600;
    const expiresAt = Date.now() + maxTimeoutSeconds * 1000; // Convert to milliseconds
    const paymentStatusUrl = `${req.protocol}://${req.get('host')}/payment-status/${paymentId}`;

    // Store pending payment details
    pendingPayments[paymentId] = {
        id: paymentId,
        items: items,
        total: total,
        status: 'pending', // Initial status
        createdAt: Date.now(),
        expiresAt: expiresAt,
        merchantAddress: MERCHANT_ADDRESS,
    };

    // Transform items to basket format (schema-compliant)
    // The basket schema requires price to be a string in atomic units
    const basket = items.map(item => ({
        name: item.name,
        price: typeof item.price === 'string' ? item.price : item.price.toString(),
        quantity: item.quantity || 1,
        ...(item.tax && { tax: item.tax.toString() }),
        ...(item.discount && { discount: item.discount.toString() }),
        ...(item.metadata && { metadata: item.metadata })
    }));

    // Validate basket against schema
    const isBasketValid = validateBasket(basket);
    if (!isBasketValid) {
        console.warn('⚠️ Basket validation failed:', validateBasket.errors);
    }

    // Build PaymentRequirements object (v2)
    const paymentRequirements = {
        scheme: 'exact',
        network: 'base-sepolia',
        maxAmountRequired: (total * 1000000).toString(), // USDC atomic units (example)
        resource: `${req.protocol}://${req.get('host')}${req.originalUrl}?paymentId=${paymentId}`,
        description: 'Shopping cart payment',
        mimeType: 'application/json',
        // New structured basket (v2)
        basket: basket,               // <-- transformed to conform to basket schema
        // Keep legacy field for v1 compatibility
        extra: items,
        payTo: MERCHANT_ADDRESS,
        asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        maxTimeoutSeconds: maxTimeoutSeconds,
        x402Version: '2.0',
        paymentId: paymentId,
        expiresAt: new Date(expiresAt).toISOString(),
        paymentStatusUrl: paymentStatusUrl
    };

    // Set header for extension compatibility
    res.setHeader('X-Invoice-Items', JSON.stringify(items));
    res.setHeader('WWW-Authenticate', 'x402');
    res.status(402).json(paymentRequirements);
});

// Payment status endpoint
app.get('/payment-status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const payment = pendingPayments[paymentId];

    if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
    }

    // In a real application, you would check the blockchain for payment confirmation
    // For this demo, we'll just return the stored status.
    // You might also update the status here if a payment was confirmed externally.

    res.json({
        paymentId: payment.id,
        status: payment.status,
        total: payment.total,
        items: payment.items,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
        merchantAddress: payment.merchantAddress,
        // Add any other relevant payment details
    });
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
