document.addEventListener('DOMContentLoaded', () => {
    const requestList = document.getElementById('request-list');
    const emptyState = document.getElementById('empty-state');
    const clearButton = document.getElementById('clear-button');
    const listView = document.getElementById('list-view');
    const detailView = document.getElementById('detail-view');
    const backButton = document.getElementById('back-button');
    const detailTotal = document.getElementById('detail-total');
    const detailItems = document.getElementById('detail-items');

    function renderList() {
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
                    cardTitle.innerHTML = '<span>Payment Request</span><span class="card-total">$' + total.toFixed(2) + '</span>';

                    const cardPreview = document.createElement('div');
                    cardPreview.className = 'card-preview';
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

    function getItemsFromRequest(req) {
        // Try to find X-Invoice-Items header
        const header = req.responseHeaders.find(h => h.name.toLowerCase() === 'x-invoice-items');
        if (header) {
            try {
                return JSON.parse(header.value);
            } catch (e) {
                console.error("Failed to parse invoice items", e);
            }
        }
        // Fallback if no items found
        return [{ name: 'Unknown Item', price: 0, quantity: 1 }];
    }

    function showDetail(req, items, total) {
        listView.classList.add('hidden');
        detailView.classList.remove('hidden');

        detailTotal.textContent = `$${total.toFixed(2)}`;
        detailItems.innerHTML = '';

        items.forEach(item => {
            const qty = item.quantity || 1;
            const li = document.createElement('li');
            li.className = 'invoice-item';

            let imageHtml = '';
            if (item.image) {
                imageHtml = `<img src="${item.image}" class="invoice-item-img" alt="${item.name}">`;
            }

            li.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%;">
          ${imageHtml}
          <div style="flex-grow: 1;">
            <div>${item.name} <span style="color: #666; font-size: 11px;">(x${qty})</span></div>
          </div>
          <div style="font-weight: 500;">$${(item.price * qty).toFixed(2)}</div>
        </div>
      `;
            detailItems.appendChild(li);
        });

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

    clearButton.addEventListener('click', () => {
        chrome.storage.local.set({ requests: [] }, renderList);
    });

    renderList();
});
