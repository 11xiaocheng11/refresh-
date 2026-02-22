const ipEl = document.getElementById("ip");
const trafficEl = document.getElementById("traffic");
const subEl = document.getElementById("subdomains");
const btn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const homepageBtn = document.getElementById("homepageBtn");

// 获取当前 tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const url = new URL(tab.url);

  // 子域名数量
  const hostnameParts = url.hostname.split(".");
  subEl.textContent = hostnameParts.length > 2 ? hostnameParts.length - 1 : 0;

  // 获取公网 IP（通过外部接口）
  fetch(`https://api.ipify.org?format=json`)
    .then(res => res.json())
    .then(data => { ipEl.textContent = data.ip; })
    .catch(() => { ipEl.textContent = "获取失败"; });

  // 获取当前页面资源流量（Performance API）
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      let total = 0;
      performance.getEntriesByType("resource").forEach(r => {
        if (r.transferSize) total += r.transferSize;
      });
      return total;
    }
  }, (results) => {
    if (results && results[0] && results[0].result !== undefined) {
      const bytes = results[0].result;
      // 简单显示 KB/MB
      if (bytes > 1024*1024) trafficEl.textContent = (bytes/1024/1024).toFixed(2) + " MB";
      else trafficEl.textContent = (bytes/1024).toFixed(1) + " KB";
    } else {
      trafficEl.textContent = "未知";
    }
  });
});

// 点击按钮开启自动刷新
btn.addEventListener("click", () => {
  chrome.storage.local.set({ enabled: true }, () => {
    btn.textContent = "已开启刷新";
    btn.disabled = true;
  });
});

// 点击停止按钮关闭自动刷新（如果存在 stopBtn）
if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    chrome.storage.local.set({ enabled: false }, () => {
      btn.textContent = "开启自动刷新";
      btn.disabled = false;
    });
  });
}

// 点击官网按钮打开新标签页
if (homepageBtn) {
  homepageBtn.addEventListener("click", () => {
    window.open("https://github.com/jerryjerry27/refresh-", "_blank");
  });
}