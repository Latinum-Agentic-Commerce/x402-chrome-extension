chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.statusCode === 402) {
            console.log("Captured 402 request:", details);

            // Check for x402 protocol indication in headers
            // Assumption: "protocol x402" might be in WWW-Authenticate or a custom header.
            // We will save all 402s but mark them if we find "x402".
            const headers = details.responseHeaders || [];
            const isX402 = headers.some(h =>
                (h.name.toLowerCase() === 'www-authenticate' && h.value.toLowerCase().includes('x402')) ||
                h.name.toLowerCase().includes('x402') ||
                h.value.toLowerCase().includes('x402')
            );

            const requestData = {
                id: details.requestId,
                url: details.url,
                method: details.method,
                timeStamp: details.timeStamp,
                statusCode: details.statusCode,
                statusLine: details.statusLine,
                responseHeaders: headers,
                isX402: isX402
            };

            chrome.storage.local.get({ requests: [] }, (result) => {
                const requests = result.requests;
                requests.push(requestData);
                chrome.storage.local.set({ requests: requests }, () => {
                    console.log("Saved 402 request to storage.");
                });
            });
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders", "extraHeaders"] // extraHeaders needed for some headers
);
