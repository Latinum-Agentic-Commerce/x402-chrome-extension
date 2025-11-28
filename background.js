// Listen for messages from content scripts (which have the response body)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'X402_DATA') {
        const data = message.data;
        console.log('[background] Received X402 data from interceptor:', data.url);
        console.log('[background] Method:', data.method || 'unknown');
        console.log('[background] Response body length:', data.body?.length, '- First 200 chars:', data.body?.substring(0, 200));
        console.log('[background] Response status:', data.status);

        const requestData = {
            url: data.url,
            method: data.method || 'GET', // Use actual method if available
            timeStamp: Date.now(),
            statusCode: data.status,
            responseHeaders: Object.entries(data.headers || {}).map(([name, value]) => ({ name, value })),
            responseBody: data.body, // Store the body!
            isX402: true,
            tabId: sender.tab ? sender.tab.id : null,
            source: data.source || 'interceptor' // Mark the source (interceptor or embedded)
        };

        console.log('[background] Saving request data with body length:', requestData.responseBody?.length);
        saveRequest(requestData);
    }
});

// Helper to save request
function saveRequest(requestData) {
    chrome.storage.local.get({ requests: [] }, (result) => {
        const requests = result.requests;

        // IMPROVED dedup: check by URL, method, and within a wider time window
        // Also prefer requests with responseBody
        const existingIndex = requests.findIndex(r =>
            r.url === requestData.url &&
            r.method === requestData.method && // Include method in dedup check
            Math.abs(r.timeStamp - requestData.timeStamp) < 5000 // 5 second window
        );

        if (existingIndex !== -1) {
            // Request already exists - replace it if the new one has a body and the old one doesn't
            // OR if the new one is from embedded source (which has actual payment data)
            const shouldReplace =
                (requestData.responseBody && !requests[existingIndex].responseBody) ||
                (requestData.source === 'embedded' && requests[existingIndex].source !== 'embedded');

            if (shouldReplace) {
                console.log('[background] Replacing request - new source:', requestData.source, ', old source:', requests[existingIndex].source);
                requests[existingIndex] = requestData;
                chrome.storage.local.set({ requests }, () => {
                    console.log('[background] Updated 402 request with body, responseBody length:', requestData.responseBody.length);
                });
            } else {
                console.log('[background] Skipping duplicate request (existing has body:', !!requests[existingIndex].responseBody, ', new has body:', !!requestData.responseBody, ')');
            }
        } else {
            // New request
            requests.push(requestData);
            chrome.storage.local.set({ requests }, () => {
                console.log('[background] Saved NEW 402 request' + (requestData.responseBody ? ' with body' : ' without body') + ', total:', requests.length);
                if (requestData.responseBody) {
                    console.log('[background] Response body preview:', requestData.responseBody.substring(0, 200));
                }
                if (requestData.responseBody) {
                    console.log('[background] Response body preview:', requestData.responseBody.substring(0, 200));
                }
                // showNotification(requestData.url); // Removed as per user request
                animateBadge(requests.length);
            });
        }
    });
}

function animateBadge(count) {
    console.log('[background] Animating badge with count:', count);

    // Set badge text with count
    chrome.action.setBadgeText({ text: count.toString() });

    // Update the extension title to be more noticeable
    chrome.action.setTitle({ title: `💰 ${count} Payment Request${count > 1 ? 's' : ''} - Click to view!` });

    // Animate badge color: Blink Blue/White 3 times
    const blue = '#3b82f6';
    const white = '#FFFFFF';

    const colors = [
        blue, white,
        blue, white,
        blue, white,
        blue // End on blue
    ];

    let i = 0;
    const interval = setInterval(() => {
        if (i >= colors.length) {
            clearInterval(interval);
            // Ensure final color is blue
            chrome.action.setBadgeBackgroundColor({ color: blue });
            return;
        }
        chrome.action.setBadgeBackgroundColor({ color: colors[i] });
        i++;
    }, 200); // 200ms interval for blinking
}

// Notification and Window opening logic removed as per user request


// Re-enabled: Catch document navigations and other non-fetch requests
chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.statusCode === 402) {
            console.log('[background] webRequest caught 402:', details.method, details.url);

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
