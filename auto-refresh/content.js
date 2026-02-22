let intervalTime = 10; // 默认刷新间隔，单位毫秒
let refreshTimer = null;

function start() {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
        location.reload();
    }, intervalTime);
}

function stop() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

// 页面加载时同步状态
chrome.storage.local.get(['enabled', 'interval'], (res) => {
    if (res.interval) intervalTime = res.interval || 5000;
    if (res.enabled) start();
});

// 监听 storage 改变
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.interval) {
            intervalTime = changes.interval.newValue;
            if (refreshTimer) {
                stop();
                start();
            }
        }
        if (changes.enabled) {
            if (changes.enabled.newValue) start();
            else stop();
        }
    }
});