function getSessionStorage() {
  return chrome.storage.session || chrome.storage.local;
}

function applyTheme(isDark) {
  const root = document.documentElement;
  if (isDark) {
    root.style.setProperty("--bg", "#1e1e1e");
    root.style.setProperty("--fg", "#e0e0e0");
    root.style.setProperty("--muted", "#aaa");
    root.style.setProperty("--border", "#444");
    root.style.setProperty("--card", "#1e1e1e");
    root.style.setProperty("--bar", "#e0e0e0");
    root.style.setProperty("--bar2", "#888");
  } else {
    root.style.removeProperty("--bg");
    root.style.removeProperty("--fg");
    root.style.removeProperty("--muted");
    root.style.removeProperty("--border");
    root.style.removeProperty("--card");
    root.style.removeProperty("--bar");
    root.style.removeProperty("--bar2");
  }
}

function localGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageGet(keys) {
  return new Promise((resolve) => {
    getSessionStorage().get(keys, resolve);
  });
}

function qs(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

function bytesToText(b) {
  if (!b) return "0 KB";
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024).toFixed(1)} KB`;
}

function ms(n) {
  if (!n) return "-";
  return `${Math.round(n)} ms`;
}

function safeText(elId, value) {
  const el = document.getElementById(elId);
  if (el) el.textContent = value;
}

function renderGrid(totalMs, scale) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const px = Math.max(1, Math.round(totalMs * scale));
  grid.style.width = `${px}px`;
  const step = totalMs > 8000 ? 1000 : 500;
  for (let t = 0; t <= totalMs; t += step) {
    const line = document.createElement("div");
    line.className = "gridLine";
    line.style.left = `${Math.round(t * scale)}px`;
    grid.appendChild(line);
  }
}

function renderRows(resources, totalMs, scale) {
  const names = document.getElementById("names");
  const bars = document.getElementById("bars");
  const timeline = document.getElementById("timeline");

  names.innerHTML = "";
  bars.innerHTML = "";

  const widthPx = Math.max(1, Math.round(totalMs * scale));
  bars.style.width = `${widthPx}px`;

  resources.forEach((r) => {
    const row = document.createElement("div");
    row.className = "row";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = r.initiatorType || "resource";
    const nameText = document.createElement("span");
    nameText.className = "nameText";
    nameText.textContent = r.nameShort || r.name;
    nameText.title = r.name;
    const m = document.createElement("span");
    m.className = "ms";
    m.textContent = `${Math.round(r.duration)} ms`;
    row.appendChild(tag);
    row.appendChild(nameText);
    row.appendChild(m);
    names.appendChild(row);

    const br = document.createElement("div");
    br.className = "barRow";
    br.style.width = `${widthPx}px`;
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.left = `${Math.max(0, Math.round(r.startTime * scale))}px`;
    bar.style.width = `${Math.max(1, Math.round(r.duration * scale))}px`;
    bar.title = `${r.name}\nstart: ${Math.round(r.startTime)}ms\nduration: ${Math.round(r.duration)}ms\ntransfer: ${bytesToText(r.transferSize)}`;
    const inner = document.createElement("div");
    inner.className = "barInner";
    bar.appendChild(inner);
    br.appendChild(bar);
    bars.appendChild(br);
  });

  const syncScroll = (src, dst) => {
    dst.scrollTop = src.scrollTop;
  };

  names.onscroll = () => syncScroll(names, timeline);
  timeline.onscroll = () => syncScroll(timeline, names);
}

async function main() {
  try {
    const theme = await localGet(["darkMode"]);
    applyTheme(!!theme.darkMode);
  } catch {
  }
  const tabId = qs("tabId");
  const key = tabId ? `waterfall_${tabId}` : "waterfall_last";
  const res = await storageGet([key]);
  const data = res[key];

  if (!data) {
    document.body.innerHTML = '<div style="padding:20px;font-family:system-ui;color:#666;">No data. Please open from the extension popup.</div>';
    return;
  }

  const urlEl = document.getElementById("reportUrl");
  if (urlEl) urlEl.textContent = data.url || "N/A";

  safeText("s-ttfb", ms(data.metrics?.ttfb));
  safeText("s-fcp", ms(data.metrics?.fcp));
  safeText("s-lcp", ms(data.metrics?.lcp));
  safeText("s-cls", typeof data.metrics?.cls === "number" ? data.metrics.cls.toFixed(3) : "-");
  safeText("s-dcl", ms(data.metrics?.dcl));
  safeText("s-reqs", `${data.metrics?.reqs ?? 0}`);
  safeText("s-bytes", bytesToText(data.metrics?.bytes || 0));

  const resources = Array.isArray(data.resources) ? data.resources : [];
  if (resources.length === 0) {
    document.getElementById("names").innerHTML = '<div class="empty">No resources</div>';
    document.getElementById("bars").innerHTML = '<div class="empty">No resources</div>';
    return;
  }

  resources.sort((a, b) => a.startTime - b.startTime);

  const minStart = 0;
  const maxEnd = Math.max(...resources.map((r) => r.startTime + r.duration), 0);
  const totalMs = Math.max(1, Math.round(maxEnd - minStart));

  const rangeLabel = document.getElementById("rangeLabel");
  if (rangeLabel) rangeLabel.textContent = `0 ms → ${totalMs} ms`;

  const scaleSelect = document.getElementById("scaleSelect");
  const render = () => {
    const scale = parseFloat(scaleSelect.value || "1");
    renderGrid(totalMs, scale);
    renderRows(resources, totalMs, scale);
  };

  scaleSelect.addEventListener("change", render);
  render();
}

main();
