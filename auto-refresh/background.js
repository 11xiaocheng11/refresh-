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

async function toggleEnabled() {
  const res = await chrome.storage.local.get(["enabled"]);
  const enabled = !res.enabled;
  await chrome.storage.local.set({ enabled });
  await setIcons();
}

chrome.runtime.onInstalled.addListener(() => {
  setIcons();
});

chrome.runtime.onStartup.addListener(() => {
  setIcons();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-refresh") {
    toggleEnabled();
  }
});

chrome.action.onClicked.addListener(() => {
  toggleEnabled();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) {
    setIcons();
  }
});
