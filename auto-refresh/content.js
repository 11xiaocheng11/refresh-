const INTERVAL = 10; // 刷新间隔

function start() {
    if (window.__refreshTimer) return;
    window.__refreshTimer = setTimeout(() => {
        location.reload();
    }, INTERVAL);
}

function stop() {
    clearTimeout(window.__refreshTimer);
    window.__refreshTimer = null;
}

chrome.storage.local.get(['enabled'], (res) => {
    if (res.enabled) start();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) {
        const enabled = changes.enabled.newValue;
        if (enabled) {
            start();
        } else {
            stop();
        }
    }
});
