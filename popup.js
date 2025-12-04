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
    const debugToggle = document.getElementById('debug-toggle');

    let lastRequestCount = 0;
    let debugMode = false;

    // Load debug mode state from storage
    chrome.storage.local.get({ debugMode: false }, (result) => {
        debugMode = result.debugMode;
        debugToggle.checked = debugMode;
        renderList();
    });

    // Debug toggle button handler
    debugToggle.addEventListener('change', () => {
        debugMode = debugToggle.checked;
        chrome.storage.local.set({ debugMode }, () => {
            renderList();
        });
    });

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

            // Filter out zero-value requests from display only (unless debug mode is on)
            let displayRequests = requests;
            if (!debugMode) {
                displayRequests = requests.filter(req => {
                    const items = getItemsFromRequest(req);
                    const total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                    return total > 0;
                });
            }

            if (displayRequests.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                displayRequests.forEach((req, index) => {
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
                        const basePrice = parseFloat(item.price || 0) / 100; // Price in cents
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

    async function showDetail(req, items, total) {
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

        // Handle JSON display
        const jsonDisplay = detailView.querySelector('#json-display');

        // In debug mode, show JSON automatically
        if (debugMode && jsonDisplay) {
            jsonDisplay.textContent = JSON.stringify(req, null, 2);
            jsonDisplay.classList.remove('hidden');
        } else if (jsonDisplay) {
            // In normal mode, hide JSON
            jsonDisplay.classList.add('hidden');
        }

        // Handle Pay Now button(s) - detect available wallets and create buttons
        const payBtnContainer = detailView.querySelector('.pay-btn-container');
        if (!payBtnContainer) {
            console.error('Pay button container not found');
            return;
        }

        // Clear existing buttons
        payBtnContainer.innerHTML = '';

        // Detect available wallets by injecting a detection script
        const detectWallets = async () => {
            try {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: req.tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id },
                    world: 'MAIN',
                    func: () => {
                        const wallets = [];

                        // Ethereum wallets
                        if (typeof window.ethereum !== 'undefined') {
                            if (window.ethereum.isMetaMask) wallets.push({ name: 'MetaMask', provider: 'ethereum', chain: 'ethereum' });
                            else if (window.ethereum.isPhantom) wallets.push({ name: 'Phantom (EVM)', provider: 'ethereum', chain: 'ethereum' });
                            else if (window.ethereum.isCoinbaseWallet) wallets.push({ name: 'Coinbase Wallet', provider: 'ethereum', chain: 'ethereum' });
                            else if (window.ethereum.isBraveWallet) wallets.push({ name: 'Brave Wallet', provider: 'ethereum', chain: 'ethereum' });
                            else wallets.push({ name: 'Web3 Wallet', provider: 'ethereum', chain: 'ethereum' });
                        }

                        if (window.phantom?.ethereum && !window.ethereum?.isPhantom) {
                            wallets.push({ name: 'Phantom (EVM)', provider: 'phantom.ethereum', chain: 'ethereum' });
                        }

                        if (window.coinbaseWalletExtension) {
                            wallets.push({ name: 'Coinbase Wallet', provider: 'coinbaseWalletExtension', chain: 'ethereum' });
                        }

                        // Solana wallets
                        if (window.solana?.isPhantom) {
                            wallets.push({ name: 'Phantom (Solana)', provider: 'solana', chain: 'solana' });
                        } else if (window.phantom?.solana) {
                            wallets.push({ name: 'Phantom (Solana)', provider: 'phantom.solana', chain: 'solana' });
                        } else if (typeof window.solana !== 'undefined' && !window.solana.isPhantom) {
                            // Generic Solana wallet (could be Solflare, Backpack, etc.)
                            const walletName = window.solana.isSolflare ? 'Solflare' :
                                             window.solana.isBackpack ? 'Backpack' :
                                             'Solana Wallet';
                            wallets.push({ name: walletName, provider: 'solana', chain: 'solana' });
                        }

                        if (window.solflare?.isSolflare) {
                            wallets.push({ name: 'Solflare', provider: 'solflare', chain: 'solana' });
                        }

                        if (window.backpack) {
                            wallets.push({ name: 'Backpack', provider: 'backpack', chain: 'solana' });
                        }

                        return wallets;
                    }
                });

                return result.result || [];
            } catch (e) {
                console.error('Failed to detect wallets:', e);
                return [];
            }
        };

        const wallets = await detectWallets();

        if (wallets.length === 0) {
            // No wallets detected, show a message
            const noWalletMsg = document.createElement('div');
            noWalletMsg.style.textAlign = 'center';
            noWalletMsg.style.padding = '12px';
            noWalletMsg.style.color = '#6b7280';
            noWalletMsg.style.fontSize = '13px';
            noWalletMsg.textContent = 'No Web3 wallet detected. Install MetaMask or Phantom.';
            payBtnContainer.appendChild(noWalletMsg);
            return;
        }

        // Create a payment button for each detected wallet
        wallets.forEach(wallet => {
            const payBtn = document.createElement('button');
            payBtn.className = 'pay-btn';
            payBtn.innerHTML = `Pay with ${wallet.name}`;
            payBtn.style.marginBottom = wallets.length > 1 ? '8px' : '0';

            payBtn.addEventListener('click', async () => {
            // Extract payment requirements from the x402 response first
            let paymentData = null;
            try {
                if (req.responseBody) {
                    const body = JSON.parse(req.responseBody);
                    if (body.accepts && body.accepts[0]) {
                        const accept = body.accepts[0];
                        paymentData = {
                            payTo: accept.payTo,
                            asset: accept.asset,
                            amount: accept.maxAmountRequired,
                            network: accept.network,
                            scheme: accept.scheme
                        };
                    }
                }
            } catch (e) {
                console.error('Failed to parse payment requirements:', e);
            }

            if (!paymentData || !paymentData.payTo || !paymentData.asset) {
                console.error('Cannot process payment: Missing payment requirements in x402 response');
                return;
            }

            // Try to find a valid tab to inject the script
            let targetTabId = req.tabId;

            // If we have a tabId, check if the tab still exists
            if (targetTabId) {
                try {
                    await chrome.tabs.get(targetTabId);
                    console.log('Using original tab:', targetTabId);
                } catch (e) {
                    console.log('Original tab no longer exists, will try to find alternative');
                    targetTabId = null;
                }
            }

            // If the original tab is gone, try to use the current active tab
            if (!targetTabId) {
                try {
                    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (activeTab && activeTab.id) {
                        targetTabId = activeTab.id;
                        console.log('Using active tab:', targetTabId);
                    }
                } catch (e) {
                    console.error('Failed to get active tab:', e);
                }
            }

            // If still no tab, try to open the payment URL in a new tab
            if (!targetTabId && req.sourceUrl) {
                try {
                    const newTab = await chrome.tabs.create({ url: req.sourceUrl, active: true });
                    targetTabId = newTab.id;
                    console.log('Opened new tab:', targetTabId);
                    // Wait a bit for the page to load
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (e) {
                    console.error('Failed to create new tab:', e);
                }
            }

            if (!targetTabId) {
                console.error('Cannot process payment: No valid tab available');
                return;
            }

            // Execute script in the target tab
            chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                world: 'MAIN',  // Run in main world to access wallet providers
                func: (paymentData, displayTotal, providerPath, walletName, walletChain) => {
                    console.log(`Processing x402 payment with ${walletName} (${walletChain}):`, paymentData);

                    // Determine if this is a Solana or Ethereum payment based on wallet chain and network
                    const isSolanaPayment = walletChain === 'solana' ||
                                          paymentData.network?.includes('solana');

                    if (isSolanaPayment) {
                        // ===== SOLANA PAYMENT FLOW =====
                        let provider = null;

                        if (providerPath === 'solana') {
                            provider = window.solana;
                        } else if (providerPath === 'phantom.solana') {
                            provider = window.phantom?.solana;
                        } else if (providerPath === 'solflare') {
                            provider = window.solflare;
                        } else if (providerPath === 'backpack') {
                            provider = window.backpack;
                        }

                        if (!provider) {
                            console.error(`${walletName} Solana provider not found`);
                            return;
                        }

                        // Connect to Solana wallet
                        provider.connect({ onlyIfTrusted: false })
                            .then(() => {
                                const fromPubkey = provider.publicKey.toString();
                                const toPubkey = paymentData.payTo;
                                const mint = paymentData.asset; // SPL token mint address
                                const amount = BigInt(paymentData.amount);

                                console.log(`Solana payment from ${fromPubkey} to ${toPubkey}`);
                                console.log(`Amount: ${amount} (${displayTotal} USD)`);

                                // Create SPL Token transfer instruction
                                // Note: This is a simplified version. In production, you'd use @solana/spl-token
                                // For now, we'll create a basic transfer instruction

                                // SPL Token Program ID
                                const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

                                // Build transfer instruction data
                                // Instruction: 3 = Transfer
                                // Amount: 8 bytes (little endian)
                                const instructionData = new Uint8Array(9);
                                instructionData[0] = 3; // Transfer instruction

                                // Write amount as little-endian u64
                                const amountBytes = new Uint8Array(8);
                                let tempAmount = amount;
                                for (let i = 0; i < 8; i++) {
                                    amountBytes[i] = Number(tempAmount & 0xFFn);
                                    tempAmount >>= 8n;
                                }
                                instructionData.set(amountBytes, 1);

                                // For a proper SPL token transfer, we need:
                                // 1. Source token account (user's token account)
                                // 2. Destination token account (merchant's token account)
                                // 3. Authority (user's public key)

                                // Create a simple transfer transaction
                                // Note: This is simplified. Production code should use @solana/web3.js properly
                                const transaction = {
                                    feePayer: provider.publicKey,
                                    recentBlockhash: null, // Will be filled by wallet
                                    instructions: [{
                                        programId: TOKEN_PROGRAM_ID,
                                        keys: [
                                            { pubkey: fromPubkey, isSigner: false, isWritable: true },  // Source
                                            { pubkey: mint, isSigner: false, isWritable: false },       // Mint
                                            { pubkey: toPubkey, isSigner: false, isWritable: true },    // Destination
                                            { pubkey: provider.publicKey, isSigner: true, isWritable: false }, // Authority
                                        ],
                                        data: instructionData
                                    }]
                                };

                                // Sign and send transaction
                                return provider.signAndSendTransaction(transaction);
                            })
                            .then(signature => {
                                console.log(`${walletName} Solana payment transaction sent! Signature:`, signature);
                                console.log(`Payment initiated! Amount: $${displayTotal}, Signature: ${signature}`);
                            })
                            .catch(err => {
                                console.error('Solana payment error:', err);
                                if (err.code === 4001 || err.message?.includes('User rejected')) {
                                    console.log('Payment cancelled by user');
                                } else {
                                    console.error(`Solana payment failed: ${err.message || 'Unknown error'}`);
                                }
                            });
                    } else {
                        // ===== ETHEREUM PAYMENT FLOW =====
                        let provider = null;

                        if (providerPath === 'ethereum') {
                            provider = window.ethereum;
                        } else if (providerPath === 'phantom.ethereum') {
                            provider = window.phantom?.ethereum;
                        } else if (providerPath === 'coinbaseWalletExtension') {
                            provider = window.coinbaseWalletExtension;
                        }

                        if (!provider) {
                            console.error(`${walletName} provider not found`);
                            return;
                        }

                        // ERC-20 transfer function signature
                        const transferFunctionSignature = '0xa9059cbb';

                        // Encode the recipient address (remove 0x prefix, pad to 32 bytes)
                        const recipientAddress = paymentData.payTo.replace('0x', '').padStart(64, '0');

                        // Encode the amount (pad to 32 bytes)
                        const amountHex = BigInt(paymentData.amount).toString(16).padStart(64, '0');

                        // Construct the data payload for ERC-20 transfer
                        const data = transferFunctionSignature + recipientAddress + amountHex;

                        provider.request({ method: 'eth_requestAccounts' })
                            .then(accounts => {
                                const from = accounts[0];

                                // First, check if we're on the correct network
                                return provider.request({ method: 'eth_chainId' })
                                    .then(chainId => {
                                        // Base Sepolia chain ID is 0x14a34 (84532)
                                        const expectedChainId = '0x14a34';

                                        if (chainId !== expectedChainId) {
                                            // Prompt user to switch to Base Sepolia
                                            return provider.request({
                                                method: 'wallet_switchEthereumChain',
                                                params: [{ chainId: expectedChainId }],
                                            }).catch(switchError => {
                                                // If the chain is not added, add it
                                                if (switchError.code === 4902) {
                                                    return provider.request({
                                                        method: 'wallet_addEthereumChain',
                                                        params: [{
                                                            chainId: expectedChainId,
                                                            chainName: 'Base Sepolia',
                                                            nativeCurrency: {
                                                                name: 'Ethereum',
                                                                symbol: 'ETH',
                                                                decimals: 18
                                                            },
                                                            rpcUrls: ['https://sepolia.base.org'],
                                                            blockExplorerUrls: ['https://sepolia.basescan.org']
                                                        }]
                                                    });
                                                }
                                                throw switchError;
                                            });
                                        }
                                    })
                                    .then(() => {
                                        // Now send the USDC transfer transaction
                                        const params = [{
                                            from: from,
                                            to: paymentData.asset, // USDC token contract address
                                            data: data, // Encoded transfer function call
                                            value: '0x0' // No ETH value for ERC-20 transfer
                                        }];

                                        return provider.request({
                                            method: 'eth_sendTransaction',
                                            params: params,
                                        });
                                    })
                                    .then(txHash => {
                                        console.log(`${walletName} payment transaction sent! Hash:`, txHash);
                                        console.log(`Payment initiated! Amount: $${displayTotal}, Transaction: ${txHash}`);
                                    })
                                    .catch(err => {
                                        console.error('Payment error:', err);
                                        if (err.code === 4001) {
                                            console.log('Payment cancelled by user');
                                        } else {
                                            console.error(`Payment failed: ${err.message || 'Unknown error'}`);
                                        }
                                    });
                            });
                    }
                },
                args: [paymentData, total.toFixed(2), wallet.provider, wallet.name, wallet.chain]
            }).catch(err => {
                console.error('Script injection error:', err);
            });
            });

            payBtnContainer.appendChild(payBtn);
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
