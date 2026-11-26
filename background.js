function generateInvertedTriangleImageDataPixel(size, fill, stroke, strokeWidth) {
  const img = new ImageData(size, size);
  const data = img.data;
  const mid = (size - 1) / 2;
  const margin = Math.max(1, Math.round(size * 0.12));
  const usable = size - margin * 2;
  for (let y = margin; y <= size - 1 - margin; y++) {
    const relY = y - margin;
    const half = Math.round((usable - 1 - relY) / 2);
    const left = Math.floor(mid - half);
    const right = Math.floor(mid + half);
    for (let x = left; x <= right; x++) {
      const i = (y * size + x) * 4;
      data[i] = stroke[0];
      data[i + 1] = stroke[1];
      data[i + 2] = stroke[2];
      data[i + 3] = 255;
    }
    const relYFill = relY + strokeWidth;
    const halfFill = Math.round((usable - 1 - relYFill) / 2) - strokeWidth;
    if (halfFill >= 0) {
      const left2 = Math.floor(mid - halfFill);
      const right2 = Math.floor(mid + halfFill);
      for (let x = left2; x <= right2; x++) {
        const j = (y * size + x) * 4;
        data[j] = fill[0];
        data[j + 1] = fill[1];
        data[j + 2] = fill[2];
        data[j + 3] = 255;
      }
    }
  }
  return img;
}

function generateInvertedTriangleImageData(size, fill, stroke, strokeWidth) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const m = Math.max(1, Math.round(size * 0.12));
      const ax = Math.round(size / 2);
      const ay = size - m;
      const bx = m;
      const by = m;
      const cx = size - m;
      const cy = m;
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fillStyle = `rgb(${fill[0]},${fill[1]},${fill[2]})`;
      ctx.strokeStyle = `rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "miter";
      ctx.fill();
      ctx.stroke();
      return ctx.getImageData(0, 0, size, size);
    }
  }
  return generateInvertedTriangleImageDataPixel(size, fill, stroke, strokeWidth);
}

async function setIcons() {
  const res = await chrome.storage.local.get(["enabled"]);
  const enabled = !!res.enabled;
  const fill = enabled ? [0, 0, 0] : [245, 245, 245];
  const stroke = enabled ? [230, 230, 230] : [35, 35, 35];
  const imageData = {
    16: generateInvertedTriangleImageData(16, fill, stroke, 3),
    32: generateInvertedTriangleImageData(32, fill, stroke, 3),
    48: generateInvertedTriangleImageData(48, fill, stroke, 4),
    64: generateInvertedTriangleImageData(64, fill, stroke, 5),
    128: generateInvertedTriangleImageData(128, fill, stroke, 6),
  };
  await chrome.action.setIcon({ imageData });
  await chrome.action.setTitle({ title: enabled ? "自动刷新：开启" : "自动刷新：关闭" });
}

const CONTEXT_MENU_ITEMS = [
  { id: "preset-5s", title: "刷新频率: 5 秒", interval: 5000 },
  { id: "preset-10s", title: "刷新频率: 10 秒", interval: 10000 },
  { id: "preset-30s", title: "刷新频率: 30 秒", interval: 30000 },
  { id: "preset-60s", title: "刷新频率: 60 秒", interval: 60000 },
  { id: "preset-stop", title: "停止当前页刷新", interval: null },
];

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    CONTEXT_MENU_ITEMS.forEach((item) => {
      chrome.contextMenus.create({
        id: item.id,
        title: item.title,
        contexts: ["action"],
      });
    });
  });
}

async function setCurrentTabEnabled(tabId, enabled) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: enabled ? "start_current" : "stop_current" });
  } catch (_) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (shouldEnable) => {
        if (shouldEnable) {
          sessionStorage.setItem("autoRefreshEnabled", "true");
          location.reload();
        } else {
          sessionStorage.removeItem("autoRefreshEnabled");
        }
      },
      args: [enabled],
    });
  }
}

async function applyPresetToTab(tabId, interval) {
  if (interval === null) {
    await setCurrentTabEnabled(tabId, false);
    return;
  }

  await chrome.storage.local.set({ interval, refreshScope: "current" });
  try {
    await chrome.tabs.sendMessage(tabId, { action: "settings_updated", interval });
  } catch (_) {
  }
  await setCurrentTabEnabled(tabId, true);
}

async function toggleEnabled() {
  const res = await chrome.storage.local.get(["enabled", "refreshScope"]);
  const scope = res.refreshScope || 'current';

  if (scope === 'all') {
    const enabled = !res.enabled;
    await chrome.storage.local.set({ enabled });
    await setIcons();
  } else {
    // 仅当前标签页模式
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const current = sessionStorage.getItem('autoRefreshEnabled') === 'true';
            if (current) {
              sessionStorage.removeItem('autoRefreshEnabled');
              return false;
            } else {
              sessionStorage.setItem('autoRefreshEnabled', 'true');
              return true;
            }
          }
        });
        
        if (results && results[0]) {
          const isEnabled = results[0].result;
          try {
            await chrome.tabs.sendMessage(tab.id, { action: isEnabled ? 'start_current' : 'stop_current' });
          } catch (_) {
            // content script 失联时，回退到直接在页面里修正状态并重载。
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (enabled) => {
                  if (enabled) {
                    sessionStorage.setItem('autoRefreshEnabled', 'true');
                    location.reload();
                  } else {
                    sessionStorage.removeItem('autoRefreshEnabled');
                  }
                },
                args: [isEnabled]
              });
            } catch (fallbackError) {
              console.error("当前页面降级切换失败", fallbackError);
            }
          }
        }
      } catch (e) {
        console.error("无法在当前页面执行脚本", e);
      }
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setIcons();
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  setIcons();
  createContextMenus();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-refresh") {
    toggleEnabled();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) {
    setIcons();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const item = CONTEXT_MENU_ITEMS.find((entry) => entry.id === info.menuItemId);
  if (!item || !tab || typeof tab.id !== "number") {
    return;
  }

  applyPresetToTab(tab.id, item.interval).catch((error) => {
    console.error("应用右键预设失败", error);
  });
});

function getSessionStorage() {
  return chrome.storage.session || chrome.storage.local;
}

function sessionGet(keys) {
  return new Promise((resolve) => {
    getSessionStorage().get(keys, resolve);
  });
}

function sessionSet(items) {
  return new Promise((resolve) => {
    getSessionStorage().set(items, resolve);
  });
}

function sessionRemove(keys) {
  return new Promise((resolve) => {
    getSessionStorage().remove(keys, resolve);
  });
}

async function updateNetInfo(tabId, patch) {
  const key = `net_${tabId}`;
  const res = await sessionGet([key]);
  const prev = res[key] || {};
  await sessionSet({ [key]: { ...prev, ...patch } });
}

function getHeader(headers, name) {
  if (!Array.isArray(headers)) return null;
  const lower = name.toLowerCase();
  const h = headers.find((x) => (x.name || "").toLowerCase() === lower);
  return h ? h.value || null : null;
}

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const key = `net_${details.tabId}`;
    sessionGet([key])
      .then((res) => {
        const prev = res[key] || {};
        const chain = Array.isArray(prev.redirectChain) ? prev.redirectChain.slice() : [];
        chain.push({ from: details.url, to: details.redirectUrl });
        const startUrl = prev.startUrl || details.url;
        return sessionSet({
          [key]: {
            ...prev,
            startUrl,
            lastUrl: details.redirectUrl,
            redirectChain: chain,
          },
        });
      })
      .catch(() => {});
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["responseHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const server = getHeader(details.responseHeaders, "server");
    updateNetInfo(details.tabId, {
      finalUrl: details.url,
      statusCode: details.statusCode,
      server,
    }).catch(() => {});
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["responseHeaders"]
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    updateNetInfo(details.tabId, { error: details.error }).catch(() => {});
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  sessionRemove([`net_${tabId}`]).catch(() => {});
});
