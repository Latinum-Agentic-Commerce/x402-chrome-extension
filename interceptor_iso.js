// This script runs in the ISOLATED world
// It listens for messages from the MAIN world and forwards them to the background script

window.addEventListener('message', (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data.type === 'X402_CAPTURED') {
        chrome.runtime.sendMessage({
            type: 'X402_DATA',
            data: event.data
        });
    }
});
