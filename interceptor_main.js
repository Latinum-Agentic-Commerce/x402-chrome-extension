// This script runs in the MAIN world, so it can wrap window.fetch and XMLHttpRequest
console.log('[x402] Interceptor loaded in MAIN world');

// Intercept fetch API
const originalFetch = window.fetch;

window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (response.status === 402) {
        // Get the request method from the args
        const requestInit = args[1] || {};
        const method = requestInit.method || 'GET';

        console.log('[x402] Detected 402 response via fetch:', method, response.url);
        try {
            const clone = response.clone();
            const bodyText = await clone.text();

            console.log('[x402] Response body length:', bodyText.length, '- Method:', method);

            // Send to the isolated content script
            window.postMessage({
                type: 'X402_CAPTURED',
                url: response.url,
                status: response.status,
                method: method,
                headers: Object.fromEntries(response.headers.entries()),
                body: bodyText
            }, '*');
        } catch (err) {
            console.error('[x402] Error capturing fetch response:', err);
        }
    }

    return response;
};

// Intercept XMLHttpRequest
const XHROpen = XMLHttpRequest.prototype.open;
const XHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._x402_url = url;
    this._x402_method = method;
    return XHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
        if (this.status === 402) {
            console.log('[x402] Detected 402 response via XMLHttpRequest:', this._x402_url || this.responseURL);

            try {
                const headers = {};
                const headersString = this.getAllResponseHeaders();
                headersString.split('\r\n').forEach(line => {
                    const parts = line.split(': ');
                    if (parts.length >= 2) {
                        headers[parts[0].toLowerCase()] = parts.slice(1).join(': ');
                    }
                });

                // Send to the isolated content script
                window.postMessage({
                    type: 'X402_CAPTURED',
                    url: this._x402_url || this.responseURL,
                    status: this.status,
                    headers: headers,
                    body: this.responseText
                }, '*');
            } catch (err) {
                console.error('[x402] Error capturing XHR response:', err);
            }
        }
    });

    return XHRSend.apply(this, args);
};

console.log('[x402] Fetch and XMLHttpRequest interceptors installed');

// Check for embedded x402 payment data (e.g., window.x402 object)
// This handles cases where payment data is embedded in the HTML rather than returned as JSON
function checkForEmbeddedX402Data() {
    if (typeof window.x402 !== 'undefined' && window.x402) {
        console.log('[x402] Found embedded window.x402 object:', window.x402);

        // Extract payment requirements from the embedded object
        let paymentData = null;

        if (window.x402.paymentRequirements && Array.isArray(window.x402.paymentRequirements)) {
            // Convert paymentRequirements to the x402 standard format
            paymentData = {
                accepts: window.x402.paymentRequirements,
                amount: window.x402.amount,
                resource: window.x402.currentUrl || window.location.href
            };
        }

        if (paymentData) {
            console.log('[x402] Sending embedded payment data to background');
            window.postMessage({
                type: 'X402_CAPTURED',
                url: window.location.href,
                status: 402,
                method: 'GET',
                headers: {},
                body: JSON.stringify(paymentData),
                source: 'embedded'
            }, '*');
        }
    }
}

// Check immediately when script loads
checkForEmbeddedX402Data();

// Also check after a short delay in case the object is set asynchronously
setTimeout(checkForEmbeddedX402Data, 100);
setTimeout(checkForEmbeddedX402Data, 500);
