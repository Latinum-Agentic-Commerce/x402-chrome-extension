// Listen for messages from content scripts (which have the response body)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'X402_DATA') {
        const data = message.data;
        console.log('Received X402 body from interceptor:', data.url);

        const requestData = {
            url: data.url,
            method: 'POST', // Most x402 requests will be POST
            timeStamp: Date.now(),
            statusCode: data.status,
            responseHeaders: Object.entries(data.headers).map(([name, value]) => ({ name, value })),
            responseBody: data.body, // Store the body!
            isX402: true,
            tabId: sender.tab ? sender.tab.id : null,
            source: 'interceptor' // Mark the source
        };

        saveRequest(requestData);
    }
});

// Helper to save request
function saveRequest(requestData) {
    chrome.storage.local.get({ requests: [] }, (result) => {
        const requests = result.requests;

        // IMPROVED dedup: check by URL and within a wider time window
        // Also prefer requests with responseBody
        const existingIndex = requests.findIndex(r =>
            r.url === requestData.url &&
            Math.abs(r.timeStamp - requestData.timeStamp) < 5000 // 5 second window
        );

        if (existingIndex !== -1) {
            // Request already exists - replace it if the new one has a body and the old one doesn't
            if (requestData.responseBody && !requests[existingIndex].responseBody) {
                console.log('Replacing request without body with one that has body');
                requests[existingIndex] = requestData;
                chrome.storage.local.set({ requests }, () => {
                    console.log('Updated 402 request with body');
                });
            } else {
                console.log('Skipping duplicate request');
            }
        } else {
            // New request
            requests.push(requestData);
            chrome.storage.local.set({ requests }, () => {
                console.log('Saved 402 request' + (requestData.responseBody ? ' with body' : ' without body') + ', total:', requests.length);
                showNotification(requestData.url);
            });
        }
    });
}

function showNotification(url) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'), // Fixed path
        title: 'Payment Required (402)',
        message: `Request from ${new URL(url).hostname}`,
        priority: 2
    }).catch(err => {
        console.warn('Notification failed:', err);
    });
}

chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.statusCode === 402) {
            // We still listen here as a backup for non-fetch requests
            // But mark it so we can prefer interceptor data

            const requestData = {
                url: details.url,
                method: details.method,
                timeStamp: details.timeStamp,
                statusCode: details.statusCode,
                responseHeaders: details.responseHeaders,
                isX402: true,
                tabId: details.tabId,
                source: 'webRequest' // Mark the source
            };

            saveRequest(requestData);
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders", "extraHeaders"]
);
