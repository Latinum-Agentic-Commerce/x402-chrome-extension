document.addEventListener('DOMContentLoaded', () => {
    // Clear badge when popup is opened
    chrome.action.setBadgeText({ text: '' });

    const requestList = document.getElementById('request-list');
    const emptyState = document.getElementById('empty-state');
    const listView = document.getElementById('list-view');
    const detailView = document.getElementById('detail-view');
    const backButton = document.getElementById('back-button');
    const detailTotal = document.getElementById('detail-total');
    const detailItems = document.getElementById('detail-items');
    // sourceLink removed

    let lastRequestCount = 0;

    // Listen for storage changes to update in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.requests) {
            const newRequests = changes.requests.newValue || [];
            const hasNewRequest = newRequests.length > lastRequestCount;
            lastRequestCount = newRequests.length;

            // Re-render with animation flag for new items
            renderList(hasNewRequest);
        }
    });

    function renderList(animateNew = false) {
        chrome.storage.local.get({ requests: [] }, (result) => {
            const requests = result.requests.reverse(); // Newest first
            requestList.innerHTML = '';

            if (requests.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                requests.forEach((req, index) => {
                    const items = getItemsFromRequest(req);
                    const total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

                    const div = document.createElement('div');
                    div.className = 'request-card';

                    // Animate the first card if it's new
                    if (animateNew && index === 0) {
                        div.classList.add('new-card');
                    }

                    // Format date
                    const date = new Date(req.timeStamp);
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = date.toLocaleDateString();

                    // Preview items (first 3 items)
                    const previewItems = items.slice(0, 3);
                    const previewList = document.createElement('ul');
                    previewList.className = 'preview-list';

                    previewItems.forEach(i => {
                        const li = document.createElement('li');
                        const qtySpan = document.createElement('span');
                        qtySpan.className = 'preview-qty';
                        qtySpan.textContent = (i.quantity || 1) + 'x';
                        li.appendChild(qtySpan);
                        li.appendChild(document.createTextNode(' ' + i.name));
                        previewList.appendChild(li);
                    });

                    if (items.length > 3) {
                        const moreLi = document.createElement('li');
                        moreLi.className = 'preview-more';
                        moreLi.textContent = '+' + (items.length - 3) + ' more items...';
                        previewList.appendChild(moreLi);
                    }

                    const cardTitle = document.createElement('div');
                    cardTitle.className = 'card-title';

                    const titleContainer = document.createElement('div');
                    const titleSpan = document.createElement('span');
                    titleSpan.textContent = 'Payment Request';
                    titleSpan.style.fontWeight = '600';

                    const siteSpan = document.createElement('div');
                    siteSpan.style.fontSize = '11px';
                    siteSpan.style.color = '#6b7280';
                    siteSpan.style.fontWeight = '400';
                    siteSpan.style.marginTop = '2px';
                    try {
                        const hostname = new URL(req.url).hostname;
                        const method = req.method || 'GET';
                        siteSpan.textContent = `${method} ${hostname}`;
                    } catch (e) {
                        siteSpan.textContent = req.url;
                    }

                    titleContainer.appendChild(titleSpan);
                    titleContainer.appendChild(siteSpan);

                    const rightSide = document.createElement('div');
                    rightSide.style.display = 'flex';
                    rightSide.style.alignItems = 'center';

                    const totalSpan = document.createElement('span');
                    totalSpan.className = 'card-total';
                    totalSpan.textContent = '$' + total.toFixed(2);

                    // Add delete button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn';
                    deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent card click
                        deleteRequest(result.requests.length - 1 - index); // Original index
                    });

                    rightSide.appendChild(totalSpan);
                    rightSide.appendChild(deleteBtn);

                    cardTitle.appendChild(titleContainer);
                    cardTitle.appendChild(rightSide);

                    // Extract description from the request
                    let description = null;
                    try {
                        if (req.responseBody) {
                            const body = JSON.parse(req.responseBody);
                            if (body.accepts && body.accepts[0] && body.accepts[0].description) {
                                description = body.accepts[0].description;
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }

                    const cardPreview = document.createElement('div');
                    cardPreview.className = 'card-preview';

                    // Add description if available
                    if (description) {
                        const descDiv = document.createElement('div');
                        descDiv.style.fontSize = '12px';
                        descDiv.style.color = '#4b5563';
                        descDiv.style.marginBottom = '8px';
                        descDiv.style.fontStyle = 'italic';
                        descDiv.style.padding = '6px 8px';
                        descDiv.style.backgroundColor = '#f9fafb';
                        descDiv.style.borderRadius = '4px';
                        descDiv.style.borderLeft = '3px solid #3b82f6';
                        descDiv.textContent = description;
                        cardPreview.appendChild(descDiv);
                    }

                    cardPreview.appendChild(previewList);

                    const cardMeta = document.createElement('div');
                    cardMeta.className = 'card-meta';
                    cardMeta.style.marginTop = '8px';
                    cardMeta.style.color = '#9ca3af';
                    cardMeta.style.borderTop = '1px solid #f3f4f6';
                    cardMeta.style.paddingTop = '5px';
                    cardMeta.textContent = dateStr + ' ' + timeStr;

                    div.appendChild(cardTitle);
                    div.appendChild(cardPreview);
                    div.appendChild(cardMeta);

                    div.addEventListener('click', () => showDetail(req, items, total));
                    requestList.appendChild(div);
                });
            }
        });
    }

    function deleteRequest(index) {
        chrome.storage.local.get({ requests: [] }, (result) => {
            const requests = result.requests;
            requests.splice(index, 1);
            chrome.storage.local.set({ requests }, renderList);
        });
    }

    function getItemsFromRequest(req) {
        console.log('getItemsFromRequest called for:', req.url);
        console.log('Request object:', req);

        // Try response body first (from fetch interceptor)
        if (req.responseBody) {
            try {
                console.log('Parsing responseBody:', req.responseBody.substring(0, 200));
                const body = JSON.parse(req.responseBody);
                console.log('Parsed body:', body);

                // Handle x402 v2 basket extension (https://x402.org/spec/v2/basket.schema.json)
                // This is a proposed extension to add itemized baskets to x402
                // PRIORITY: Check basket first since it provides more detailed item information
                if (body.basket && Array.isArray(body.basket)) {
                    console.log('[x402 basket] Found basket array with', body.basket.length, 'items');
                    return body.basket.map(item => {
                        // Parse price from smallest units (string) to decimal
                        const basePrice = parseFloat(item.price || 0) / 100; // Convert from cents
                        const quantity = item.quantity || 1;
                        const tax = parseFloat(item.tax || 0) / 100;
                        const discount = parseFloat(item.discount || 0) / 100;

                        // Calculate final price: (basePrice * quantity) + tax - discount
                        const totalPrice = (basePrice * quantity) + tax - discount;

                        return {
                            id: item.id,
                            name: item.name,
                            price: totalPrice / quantity, // Price per unit after tax/discount
                            quantity: quantity,
                            image_urls: item.image_urls || null,
                            // Store original basket metadata
                            _basket: {
                                basePrice: basePrice,
                                tax: tax,
                                discount: discount,
                                metadata: item.metadata
                            }
                        };
                    });
                }

                // Handle x402 standard protocol format (accepts array)
                // This is the official x402 specification format
                // Fallback to this if no basket is present
                if (body.accepts && Array.isArray(body.accepts)) {
                    console.log('[x402 standard] Found accepts array with', body.accepts.length, 'payment options');
                    // Convert x402 payment requirements to displayable items
                    return body.accepts.map(accept => ({
                        name: accept.description || 'Payment Required',
                        price: parseFloat(accept.maxAmountRequired || 0) / 1000000, // Convert from smallest units (assuming 6 decimals for USDC)
                        quantity: 1,
                        image_urls: null,
                        // Store original x402 payment requirement data
                        _x402: {
                            network: accept.network,
                            asset: accept.asset,
                            payTo: accept.payTo,
                            currency: accept.extra?.name || 'USDC',
                            scheme: accept.scheme,
                            maxTimeoutSeconds: accept.maxTimeoutSeconds
                        }
                    }));
                }


                console.warn('Response body does not contain a valid basket or accepts array');
            } catch (e) {
                console.error('Failed to parse response body JSON:', e);
            }
        }

        // Fallback: Try X-Invoice-Items header (for webRequest captures)
        if (req.responseHeaders) {
            const invoiceHeader = req.responseHeaders.find(h =>
                h.name.toLowerCase() === 'x-invoice-items'
            );

            if (invoiceHeader && invoiceHeader.value) {
                try {
                    console.log('Using X-Invoice-Items header as fallback');
                    const items = JSON.parse(invoiceHeader.value);
                    console.log('Parsed items from header:', items);
                    return Array.isArray(items) ? items : [];
                } catch (e) {
                    console.error('Failed to parse X-Invoice-Items header:', e);
                }
            }
        }

        console.error('No response body or X-Invoice-Items header found for:', req.url);
        console.error('Request source:', req.source);
        return []; // Empty basket - will show $0.00
    }

    function showDetail(req, items, total) {
        listView.classList.add('hidden');
        detailView.classList.remove('hidden');

        // Handle Source Link on Price
        if (req.sourceUrl) {
            detailTotal.href = req.sourceUrl;
            detailTotal.style.pointerEvents = 'auto';
            detailTotal.title = `Go to ${req.sourceUrl}`;
        } else {
            detailTotal.href = '#';
            detailTotal.style.pointerEvents = 'none';
            detailTotal.title = '';
        }

        detailTotal.textContent = `$${total.toFixed(2)}`;

        // Display Request ID if available
        const existingRequestId = detailView.querySelector('.request-id-display');
        if (existingRequestId) {
            existingRequestId.remove();
        }

        if (req.requestId) {
            const reqIdDiv = document.createElement('div');
            reqIdDiv.className = 'request-id-display';
            reqIdDiv.style.textAlign = 'center';
            reqIdDiv.style.fontSize = '11px';
            reqIdDiv.style.color = '#6b7280';
            reqIdDiv.style.marginBottom = '12px';
            reqIdDiv.style.fontFamily = 'monospace';
            reqIdDiv.textContent = `ID: ${req.requestId}`;
            detailTotal.parentNode.insertBefore(reqIdDiv, detailTotal.nextSibling);
        }

        detailItems.innerHTML = '';

        items.forEach(item => {
            const qty = item.quantity || 1;
            const li = document.createElement('li');
            li.className = 'invoice-item';

            let imageHtml = '';
            if (item.image_urls && item.image_urls[0]) {
                imageHtml = `<img src="${item.image_urls[0]}" class="invoice-item-img" alt="${item.name}">`;
            }

            // Build price breakdown for basket items
            let priceHtml = `<div style="font-weight: 500;">$${(item.price * qty).toFixed(2)}</div>`;

            if (item._basket) {
                // Show detailed breakdown for basket items
                const breakdown = [];
                if (item._basket.basePrice) {
                    breakdown.push(`Base: $${(item._basket.basePrice * qty).toFixed(2)}`);
                }
                if (item._basket.tax > 0) {
                    breakdown.push(`Tax: $${item._basket.tax.toFixed(2)}`);
                }
                if (item._basket.discount > 0) {
                    breakdown.push(`Discount: -$${item._basket.discount.toFixed(2)}`);
                }

                if (breakdown.length > 0) {
                    priceHtml = `
                        <div style="text-align: right;">
                            <div style="font-weight: 500;">$${(item.price * qty).toFixed(2)}</div>
                            <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">${breakdown.join(' • ')}</div>
                        </div>
                    `;
                }
            }

            li.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%;">
          ${imageHtml}
          <div style="flex-grow: 1;">
            <div>${item.name} <span style="color: #666; font-size: 11px;">(x${qty})</span></div>
            ${item.id ? `<div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">ID: ${item.id}</div>` : ''}
          </div>
          ${priceHtml}
        </div>
      `;
            detailItems.appendChild(li);
        });

        // Handle Show JSON button
        const showJsonBtn = detailView.querySelector('#show-json-btn');
        const jsonDisplay = detailView.querySelector('#json-display');

        // Remove old listeners to avoid duplicates
        const newShowJsonBtn = showJsonBtn.cloneNode(true);
        showJsonBtn.parentNode.replaceChild(newShowJsonBtn, showJsonBtn);

        let jsonVisible = false;
        newShowJsonBtn.addEventListener('click', () => {
            jsonVisible = !jsonVisible;
            if (jsonVisible) {
                jsonDisplay.textContent = JSON.stringify(req, null, 2);
                jsonDisplay.classList.remove('hidden');
                newShowJsonBtn.textContent = 'Hide Full Request JSON';
            } else {
                jsonDisplay.classList.add('hidden');
                newShowJsonBtn.textContent = 'Show Full Request JSON';
            }
        });

        // Reset JSON display when showing details
        jsonDisplay.classList.add('hidden');
        newShowJsonBtn.textContent = 'Show Full Request JSON';

        // Handle Pay Now button
        const payBtn = detailView.querySelector('.pay-btn');
        // Remove old listeners to avoid duplicates if showDetail is called multiple times
        const newPayBtn = payBtn.cloneNode(true);
        payBtn.parentNode.replaceChild(newPayBtn, payBtn);

        newPayBtn.addEventListener('click', () => {
            // Use the stored tab ID from the request
            const tabId = req.tabId;

            if (!tabId) {
                alert('Cannot process payment: Tab information not available');
                return;
            }

            // Execute script in the original tab where the 402 occurred
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',  // Run in main world to access window.ethereum
                func: (amount) => {
                    if (typeof window.ethereum !== 'undefined') {
                        // Convert USD to ETH (dummy conversion: 1 ETH = $2000)
                        const ethAmount = (amount / 2000).toFixed(4);
                        const weiAmount = '0x' + (Math.floor(amount / 2000 * 1e18)).toString(16);

                        window.ethereum.request({ method: 'eth_requestAccounts' })
                            .then(accounts => {
                                const from = accounts[0];
                                const params = [{
                                    from: from,
                                    to: '0x000000000000000000000000000000000000dEaD', // Dummy address
                                    value: weiAmount, // Hex value in wei
                                }];

                                return window.ethereum.request({
                                    method: 'eth_sendTransaction',
                                    params: params,
                                });
                            })
                            .then(txHash => {
                                console.log('Transaction sent! Hash:', txHash);
                            })
                            .catch(err => {
                                console.error('Payment error:', err);
                            });
                    } else {
                        alert('MetaMask is not installed!');
                    }
                },
                args: [total]
            }).catch(err => {
                console.error('Script injection error:', err);
                alert('Error: Unable to inject payment script. The original tab may have been closed.');
            });
        });
    }

    backButton.addEventListener('click', () => {
        detailView.classList.add('hidden');
        listView.classList.remove('hidden');
    });

    // Initial render and set count
    chrome.storage.local.get({ requests: [] }, (result) => {
        lastRequestCount = result.requests.length;
        renderList();
    });
});
