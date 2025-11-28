// This script runs in the ISOLATED world
// It listens for messages from the MAIN world and forwards them to the background script

console.log('[x402] Interceptor listener loaded in ISOLATED world');

window.addEventListener('message', (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data.type === 'X402_CAPTURED') {
        console.log('[x402] Received 402 data from MAIN world:', event.data.url);

        chrome.runtime.sendMessage({
            type: 'X402_DATA',
            data: event.data
        }).then(() => {
            console.log('[x402] Message sent to background script');
        }).catch(err => {
            console.error('[x402] Error sending message to background:', err);
        });
    }
});

console.log('[x402] Event listener registered for X402_CAPTURED messages');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'X402_BASKET_UPDATED') {
        console.log('[x402] Received basket update from background:', message.data.url);
        // Forward to MAIN world
        window.postMessage({
            type: 'X402_BASKET_UPDATED',
            data: message.data
        }, '*');
    }
});
