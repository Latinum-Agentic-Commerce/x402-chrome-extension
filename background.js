chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.statusCode === 402) {
            // Check if this is an x402 protocol response
            const wwwAuthHeader = details.responseHeaders.find(
                h => h.name.toLowerCase() === 'www-authenticate'
            );

            const isX402 = wwwAuthHeader && wwwAuthHeader.value.toLowerCase().includes('x402');

            if (isX402) {
                const requestData = {
                    url: details.url,
                    method: details.method,
                    timeStamp: details.timeStamp,
                    statusCode: details.statusCode,
                    responseHeaders: details.responseHeaders,
                    isX402: isX402,
                    tabId: details.tabId  // Store the tab ID
                };

                chrome.storage.local.get({ requests: [] }, (result) => {
                    const requests = result.requests;
                    requests.push(requestData);
                    chrome.storage.local.set({ requests }, () => {
                        // Try to create a notification (optional, may fail if icon missing)
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: chrome.runtime.getURL('icon.png'),
                            title: 'Payment Required (402)',
                            message: `Request from ${new URL(details.url).hostname}`,
                            priority: 2
                        }, (notificationId) => {
                            if (chrome.runtime.lastError) {
                                console.warn('Notification skipped:', chrome.runtime.lastError.message);
                            }
                        });
                    });
                });
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders", "extraHeaders"] // extraHeaders needed for some headers
);
