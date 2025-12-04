// Store mapping of notification IDs to tab IDs for click handling
const notificationToTabMap = {};

// Listen for messages from content scripts (which have the response body)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'X402_DATA') {
        const data = message.data;
        console.log('[background] Received X402 data from interceptor:', data.url, data.method || 'unknown', 'Status:', data.status);

        const requestData = {
            url: data.url,
            method: data.method || 'GET', // Use actual method if available
            timeStamp: Date.now(),
            statusCode: data.status,
            responseHeaders: Object.entries(data.headers || {}).map(([name, value]) => ({ name, value })),
            responseBody: data.body, // Store the body!
            isX402: true,
            tabId: sender.tab ? sender.tab.id : null,
            source: data.source || 'interceptor', // Mark the source (interceptor or embedded)
            requestId: data.requestId, // Capture requestId if present
            sourceUrl: sender.tab ? sender.tab.url : null // Capture source URL
        };

        saveRequest(requestData);
    }
});

// Helper to show notification for a request
function showNotificationForRequest(requestData) {
    try {
        const hostname = new URL(requestData.url).hostname || 'unknown';

        // Parse basket to get all items
        let items = [];
        if (requestData.responseBody) {
            try {
                const body = JSON.parse(requestData.responseBody);
                if (body.basket && Array.isArray(body.basket) && body.basket.length > 0) {
                    items = body.basket.slice(0, 5).map(item => { // Max 5 items
                        const basePrice = parseFloat(item.price || 0) / 100;
                        const quantity = item.quantity || 1;
                        const itemPrice = basePrice * quantity;
                        return {
                            title: item.name || 'Unknown item',
                            message: `$${itemPrice.toFixed(2)}${quantity > 1 ? ` (${quantity}x)` : ''}`
                        };
                    });
                }
            } catch (e) {
                console.warn('[background] Failed to parse basket for notification:', e);
            }
        }

        chrome.notifications.create({
            type: items.length > 0 ? 'list' : 'basic',
            iconUrl: 'icons/icon128.png',
            title: `x402 Payment Request - ${hostname}`,
            message: items.length > 0 ? '' : hostname,
            items: items.length > 0 ? items : undefined,
            priority: 1
        }, (notificationId) => {
            if (chrome.runtime.lastError) {
                console.error('[background] Notification error:', chrome.runtime.lastError);
            } else {
                console.log('[background] Notification created:', notificationId);
                // Store mapping for click handler
                if (requestData.tabId) {
                    notificationToTabMap[notificationId] = requestData.tabId;
                }
            }
        });
    } catch (error) {
        console.error('[background] Failed to create notification:', error);
    }
}

// Helper to save request
function saveRequest(requestData) {
    chrome.storage.local.get({ requests: [] }, (result) => {
        const requests = result.requests;

        // Deduplication by requestId only
        let existingIndex = -1;
        if (requestData.requestId) {
            existingIndex = requests.findIndex(r => r.requestId === requestData.requestId);
        }

        if (existingIndex !== -1) {
            // Replace existing request
            requests[existingIndex] = requestData;
        } else {
            // Insert new request
            requests.push(requestData);
        }

        // Save and trigger notification in both cases
        chrome.storage.local.set({ requests }, () => {
            animateBadge(requests.length);

            // Show browser notification if we have basket data
            if (requestData.responseBody) {
                showNotificationForRequest(requestData);
            }

            // Broadcast update to the specific tab
            if (requestData.tabId) {
                chrome.tabs.sendMessage(requestData.tabId, {
                    type: 'X402_BASKET_UPDATED',
                    data: requestData
                }).catch(err => console.log('[background] Could not send update to tab (tab might be closed or no content script):', err));
            }
        });

    });
}

function animateBadge(count) {
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

// Handle notification clicks - focus the tab with the 402 request
chrome.notifications.onClicked.addListener((notificationId) => {
    console.log('[background] Notification clicked:', notificationId);

    const tabId = notificationToTabMap[notificationId];
    if (tabId) {
        // Focus the tab and its window
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.warn('[background] Tab no longer exists:', chrome.runtime.lastError);
            } else if (tab) {
                // Bring the window to front and activate the tab
                chrome.windows.update(tab.windowId, { focused: true }, () => {
                    chrome.tabs.update(tabId, { active: true }, () => {
                        console.log('[background] Focused tab:', tabId);
                    });
                });
            }
        });

        // Clean up the mapping
        delete notificationToTabMap[notificationId];
    }

    // Clear the notification
    chrome.notifications.clear(notificationId);
});

