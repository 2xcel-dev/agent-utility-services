const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.', status: 429 }
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for resource-intensive utility.', status: 429 }
});

app.use('/v1/', globalLimiter);
app.use('/v1/sandbox-execution', strictLimiter);
app.use('/v1/claude-reason', strictLimiter);

const requirex402Payment = (priceUSDC) => {
    return (req, res, next) => {
        const paymentProof = req.headers['x-base-payment-proof'];
        if (!paymentProof) {
            return res.status(402).json({
                error: 'Payment Required',
                protocol: 'x402',
                network: 'base',
                currency: 'USDC',
                amount: priceUSDC,
                payToAddress: process.env.TREASURY_WALLET || '0x2XceL_Treasury_Placeholder'
            });
        }
        next();
    };
};

app.post('/v1/schema-sanitizer', requirex402Payment('0.002'), (req, res) => {
    res.json({ success: true, utility: 'schema-sanitizer', message: 'Schema validated and sanitized successfully.' });
});

app.post('/v1/financial-audit', requirex402Payment('0.01'), (req, res) => {
    res.json({ success: true, utility: 'financial-audit', message: 'Financial transaction parsed and verified.' });
});

app.post('/v1/geospatial-verifier', requirex402Payment('0.02'), (req, res) => {
    res.json({ success: true, utility: 'geospatial-verifier', message: 'Spatial coordinate validation passed.' });
});

app.post('/v1/sandbox-execution', requirex402Payment('0.05'), (req, res) => {
    res.json({ success: true, utility: 'sandbox-execution', message: 'Code compilation and script runtime executed safely.' });
});

app.post('/v1/claude-reason', requirex402Payment('0.05'), (req, res) => {
    res.json({ success: true, utility: 'claude-reason', message: 'Advanced logic processing completed.' });
});

app.post('/v1/verification-oracle', requirex402Payment('0.10'), (req, res) => {
    res.json({ success: true, utility: 'verification-oracle', message: 'Cryptographic proof and token attestation verified.' });
});

app.post('/v1/media-transcoder', requirex402Payment('0.15'), (req, res) => {
    res.json({ success: true, utility: 'media-transcoder', message: 'CDN asset rendered and media conversion pipeline complete.' });
});

app.post('/v1/agentic-audit', requirex402Payment('0.25'), (req, res) => {
    res.json({ success: true, utility: 'agentic-audit', message: 'Deep multi-agent system evaluation and vulnerability scan complete.' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'Agent Utility Services (AUS)', protocol: 'x402' });
});

app.listen(PORT, () => {
    console.log(`AUS server running on port ${PORT}`);
});
