// This script runs in the ISOLATED world
// It listens for messages from the MAIN world and forwards them to the background script

window.addEventListener('message', (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data.type === 'X402_CAPTURED') {
        chrome.runtime.sendMessage({
            type: 'X402_DATA',
            data: event.data
        }).catch(err => {
            console.error('[x402] Error sending message to background:', err);
        });
    }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'X402_BASKET_UPDATED') {
        // Forward to MAIN world
        window.postMessage({
            type: 'X402_BASKET_UPDATED',
            data: message.data
        }, '*');
    }
});
