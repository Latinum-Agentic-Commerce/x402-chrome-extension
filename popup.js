document.addEventListener('DOMContentLoaded', () => {
    const requestList = document.getElementById('request-list');
    const emptyState = document.getElementById('empty-state');
    const clearButton = document.getElementById('clear-button');
    const listView = document.getElementById('list-view');
    const detailView = document.getElementById('detail-view');
    const detailContent = document.getElementById('detail-content');
    const backButton = document.getElementById('back-button');

    function renderList() {
        chrome.storage.local.get({ requests: [] }, (result) => {
            const requests = result.requests.reverse(); // Newest first
            requestList.innerHTML = '';

            if (requests.length === 0) {
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
                requests.forEach((req, index) => {
                    const li = document.createElement('li');
                    li.className = 'request-item';

                    const time = new Date(req.timeStamp).toLocaleString();
                    const x402Badge = req.isX402 ? '<span class="x402-badge">x402</span>' : '';

                    li.innerHTML = `
            <div class="request-url">${req.method} ${req.url} ${x402Badge}</div>
            <div class="request-time">${time}</div>
          `;

                    li.addEventListener('click', () => showDetail(req));
                    requestList.appendChild(li);
                });
            }
        });
    }

    function showDetail(req) {
        listView.style.display = 'none';
        detailView.style.display = 'block';
        clearButton.style.display = 'none';

        detailContent.innerHTML = `
      <p><strong>URL:</strong> ${req.url}</p>
      <p><strong>Method:</strong> ${req.method}</p>
      <p><strong>Status:</strong> ${req.statusCode} ${req.statusLine}</p>
      <p><strong>Time:</strong> ${new Date(req.timeStamp).toLocaleString()}</p>
      <p><strong>Is x402:</strong> ${req.isX402}</p>
      <h3>Response Headers:</h3>
      <pre>${JSON.stringify(req.responseHeaders, null, 2)}</pre>
    `;
    }

    backButton.addEventListener('click', () => {
        detailView.style.display = 'none';
        listView.style.display = 'block';
        clearButton.style.display = 'block';
    });

    clearButton.addEventListener('click', () => {
        chrome.storage.local.set({ requests: [] }, renderList);
    });

    renderList();
});
