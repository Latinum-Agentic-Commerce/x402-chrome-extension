// This script runs in the MAIN world, so it can wrap window.fetch
const originalFetch = window.fetch;

window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (response.status === 402) {
        try {
            const clone = response.clone();
            const bodyText = await clone.text();

            // Send to the isolated content script
            window.postMessage({
                type: 'X402_CAPTURED',
                url: response.url,
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: bodyText
            }, '*');
        } catch (err) {
            console.error('x402 interceptor error:', err);
        }
    }

    return response;
};
