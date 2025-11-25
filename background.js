chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.statusCode === 402) {
            console.log('Captured 402 response:', details.url);

            // Store the request data
            const requestData = {
                url: details.url,
                method: details.method,
                timeStamp: details.timeStamp,
                statusCode: details.statusCode,
                responseHeaders: details.responseHeaders,
                isX402: true, // Assume all 402s are x402
                tabId: details.tabId
            };

            chrome.storage.local.get({ requests: [] }, (result) => {
                const requests = result.requests;
                requests.push(requestData);
                chrome.storage.local.set({ requests }, () => {
                    console.log('Saved 402 request, total:', requests.length);

                    // Try to create a notification
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
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders", "extraHeaders"]
);
