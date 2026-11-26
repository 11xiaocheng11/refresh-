let intervalTime = 60000; // 默认刷新间隔 1 分钟
let refreshTimer = null;
let countdownTimer = null;
let nextRefreshAt = 0;
let countdownEl = null;
let clockCanvas = null;
let clockDigital = null;
let isClockVisible = false;
let clockRaf = 0;
let lastIntervalTime = intervalTime;

function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function normalizeTextLines(text) {
    return String(text || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function parseSizeText(line) {
    const match = String(line || '').match(/^\d+(?:\.\d+)?\s?(?:B|KB|MB|GB|TB)$/i);
    return match ? match[0] : '';
}

function looksLikeNoise(line) {
    return [
        '下载', '分享', '更多', '移动', '删除', '搜索', '上传', '新建', '最近',
        '全部文件', '回收站', '网盘', '列表', '排序', '筛选', '文件', '文件夹'
    ].includes(line);
}

function getCandidateName(lines, sizeIndex) {
    if (!Array.isArray(lines) || lines.length === 0) return '';
    if (sizeIndex > 0 && !looksLikeNoise(lines[sizeIndex - 1])) {
        return lines[sizeIndex - 1];
    }
    return lines.find((line) => {
        if (looksLikeNoise(line)) return false;
        if (line.length > 80) return false;
        return /[^\s]/.test(line);
    }) || '';
}

function extractQuarkFilesFromDom() {
    const selectors = [
        '[data-row-key]',
        '[role="row"]',
        '[class*="file-item"]',
        '[class*="file-row"]',
        '[class*="list-item"]',
        '[class*="table-row"]',
        '[class*="item"]'
    ];

    const elements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const files = [];
    const seen = new Set();

    elements.forEach((element) => {
        if (!isElementVisible(element)) return;
        const lines = normalizeTextLines(element.innerText);
        if (lines.length === 0 || lines.length > 12) return;

        const sizeIndex = lines.findIndex((line) => parseSizeText(line));
        const sizeText = sizeIndex >= 0 ? parseSizeText(lines[sizeIndex]) : '';
        const name = getCandidateName(lines, sizeIndex);

        if (!name || looksLikeNoise(name)) return;

        const key = `${name}__${sizeText}`;
        if (seen.has(key)) return;
        seen.add(key);

        const lowerText = lines.join(' ').toLowerCase();
        const isFolder = /文件夹|folder/.test(lowerText);
        files.push({
            name,
            sizeText,
            type: isFolder ? 'folder' : sizeText ? 'file' : 'unknown',
            typeLabel: isFolder ? '文件夹' : sizeText ? '文件' : '未知类型',
            selected: element.getAttribute('aria-selected') === 'true' || element.className.includes('selected')
        });
    });

    const selectedFiles = files.filter((file) => file.selected);
    if (selectedFiles.length > 0) {
        return selectedFiles.slice(0, 50);
    }
    return files.slice(0, 50);
}

function getPanHelperFiles() {
    const context = detectPanHelperContext();
    if (!context.supported || context.provider !== 'quark') {
        return {
            supported: false,
            provider: context.provider,
            files: [],
            message: context.message,
            emptyMessage: '当前页面暂不支持提取文件列表',
        };
    }

    const files = extractQuarkFilesFromDom();
    return {
        supported: true,
        provider: 'quark',
        source: 'visible-dom',
        sourceLabel: '页面可见区域',
        files,
        message: files.length
            ? `已从当前页面提取 ${files.length} 项文件数据。`
            : '当前还没有从页面可见区域提取到文件项，可能需要先进入列表区域或切换视图。',
        emptyMessage: '当前没有提取到可见文件项',
    };
}

function detectPanHelperContext() {
    const host = location.hostname || '';
    const path = location.pathname || '';
    const isQuark = host === 'pan.quark.cn';

    if (!isQuark) {
        return {
            supported: false,
            provider: null,
            providerName: '-',
            host,
            pageType: 'unknown',
            pageTypeLabel: '-',
            message: '当前页面不是已接入的网盘站点。第一阶段暂时只支持识别夸克网盘。',
            title: document.title || '',
        };
    }

    const sharePatterns = ['/s/', '/share/'];
    const drivePatterns = ['/list', '/drive', '/disk'];
    let pageType = 'unknown';
    let pageTypeLabel = '未知页面';

    if (sharePatterns.some((pattern) => path.includes(pattern))) {
        pageType = 'share';
        pageTypeLabel = '分享页';
    } else if (drivePatterns.some((pattern) => path.includes(pattern))) {
        pageType = 'drive';
        pageTypeLabel = '网盘页';
    } else {
        pageType = 'quark';
        pageTypeLabel = '夸克页面';
    }

    const files = extractQuarkFilesFromDom();
    const hasLikelyFileList = files.length > 0 || Boolean(
        document.querySelector('[class*="file"], [class*="list"], [data-row-key], [class*="table"], [class*="item"]')
    );

    return {
        supported: true,
        provider: 'quark',
        providerName: '夸克网盘',
        host,
        pageType,
        pageTypeLabel,
        hasLikelyFileList,
        fileCount: files.length,
        message: hasLikelyFileList
            ? `已识别夸克网盘页面，当前可见文件项 ${files.length} 个。下一步可以继续接下载链接生成。`
            : '已识别夸克网盘页面，但当前还没有检测到明显的文件列表区域。',
        title: document.title || '',
    };
}

function normalizeIntervalMs(rawValue) {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 100) {
        return 60000;
    }
    return Math.round(value);
}

function getSiteRuleInterval(siteRules) {
    if (!siteRules || typeof siteRules !== 'object' || Array.isArray(siteRules)) {
        return null;
    }
    const host = location.hostname;
    if (!host) {
        return null;
    }
    if (siteRules[host]) {
        return normalizeIntervalMs(siteRules[host]);
    }
    return null;
}

function createOrUpdateCountdownUI() {
    if (!countdownEl) {
        countdownEl = document.createElement('div');
        countdownEl.id = 'auto-refresh-countdown-ui';
        countdownEl.className = 'exclude-dark-mode';
        countdownEl.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 14px;
            font-family: monospace;
            z-index: 2147483647;
            pointer-events: auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            backdrop-filter: blur(4px);
            transition: opacity 0.3s;
            user-select: none;
            cursor: default;
        `;
        countdownEl.innerHTML = `
          <div id="auto-refresh-countdown-badge"></div>
          <div id="auto-refresh-countdown-popover" style="
            position: absolute;
            right: 0;
            bottom: calc(100% + 10px);
            width: 220px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.96);
            color: #000;
            border: 1px solid rgba(0,0,0,0.35);
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
            display: none;
          ">
            <div style="display:flex; justify-content:center;">
              <canvas id="auto-refresh-clock" width="160" height="160" style="display:block;"></canvas>
            </div>
            <div id="auto-refresh-clock-digital" style="
              margin-top: 8px;
              text-align: center;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
              font-size: 13px;
              color: #111;
              letter-spacing: 0.3px;
            "></div>
          </div>
        `;
        document.body.appendChild(countdownEl);

        const popover = countdownEl.querySelector('#auto-refresh-countdown-popover');
        clockCanvas = countdownEl.querySelector('#auto-refresh-clock');
        clockDigital = countdownEl.querySelector('#auto-refresh-clock-digital');

        countdownEl.addEventListener('mouseenter', () => {
            isClockVisible = true;
            if (popover) popover.style.display = 'block';
            startClockRaf();
        });
        countdownEl.addEventListener('mouseleave', () => {
            isClockVisible = false;
            if (popover) popover.style.display = 'none';
            stopClockRaf();
        });
    }
    
    const badge = countdownEl.querySelector('#auto-refresh-countdown-badge');
    const remainingMs = Math.max(0, nextRefreshAt - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const timeStr = m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
    if (badge) badge.textContent = `刷新: ${timeStr}`;
    countdownEl.style.display = 'block';
}

function removeCountdownUI() {
    if (countdownEl) {
        countdownEl.style.display = 'none';
    }
}

function formatRemainingMs(remainingMs) {
    const totalMs = Math.max(0, Math.floor(remainingMs));
    const totalSeconds = Math.floor(totalMs / 1000);
    const ms = totalMs % 1000;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function drawClock(remainingMs) {
    if (!clockCanvas) return;
    const ctx = clockCanvas.getContext('2d');
    if (!ctx) return;
    const w = clockCanvas.width;
    const h = clockCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 6;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const len = i % 5 === 0 ? 10 : 5;
        const lw = i % 5 === 0 ? 2.2 : 1.2;
        const x1 = cx + Math.cos(ang) * (r - len);
        const y1 = cy + Math.sin(ang) * (r - len);
        const x2 = cx + Math.cos(ang) * r;
        const y2 = cy + Math.sin(ang) * r;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#111';
        ctx.stroke();
    }

    const remaining = Math.max(0, remainingMs);
    const seconds = (remaining / 1000) % 60;
    const minutes = (remaining / 1000 / 60) % 60;
    const hours = (remaining / 1000 / 3600) % 12;

    const secAng = (seconds / 60) * Math.PI * 2 - Math.PI / 2;
    const minAng = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
    const hourAng = (hours / 12) * Math.PI * 2 - Math.PI / 2;

    const drawHand = (ang, length, width, color) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * length, cy + Math.sin(ang) * length);
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    drawHand(hourAng, r * 0.48, 5, '#111');
    drawHand(minAng, r * 0.68, 3.5, '#111');
    drawHand(secAng, r * 0.78, 2, '#111');

    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
}

function startClockRaf() {
    if (clockRaf) return;
    const tick = () => {
        clockRaf = requestAnimationFrame(tick);
        const remainingMs = Math.max(0, nextRefreshAt - Date.now());
        drawClock(remainingMs);
        if (clockDigital) clockDigital.textContent = formatRemainingMs(remainingMs);
    };
    tick();
}

function stopClockRaf() {
    if (clockRaf) {
        cancelAnimationFrame(clockRaf);
        clockRaf = 0;
    }
}

function scheduleReload() {
    const remaining = Math.max(0, nextRefreshAt - Date.now());
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    refreshTimer = setTimeout(() => {
        location.reload();
    }, remaining);
}

function start() {
    if (!nextRefreshAt) nextRefreshAt = Date.now() + intervalTime;
    createOrUpdateCountdownUI();

    if (!countdownTimer) {
        countdownTimer = setInterval(() => {
            createOrUpdateCountdownUI();
            if (!isClockVisible && clockDigital) {
                clockDigital.textContent = '';
            }
        }, 100);
    }

    if (!refreshTimer) {
        scheduleReload();
    }
}

function stop() {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    stopClockRaf();
    removeCountdownUI();
}

function applyWebDarkMode(enable) {
    if (enable) {
        if (!document.getElementById('auto-refresh-web-dark-mode')) {
            const style = document.createElement('style');
            style.id = 'auto-refresh-web-dark-mode';
            // 使用 CSS 滤镜强行反色，并保留图片的原始颜色
            style.textContent = `
                html {
                    filter: invert(100%) hue-rotate(180deg) !important;
                    background: #fff !important; 
                }
                img, video, iframe, canvas, svg, .exclude-dark-mode {
                    filter: invert(100%) hue-rotate(180deg) !important;
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        const style = document.getElementById('auto-refresh-web-dark-mode');
        if (style) style.remove();
    }
}

function checkStatus() {
    chrome.storage.local.get(['enabled', 'interval', 'refreshScope', 'webDarkMode', 'siteRules'], (res) => {
        intervalTime = getSiteRuleInterval(res.siteRules) || normalizeIntervalMs(res.interval);
        const intervalChanged = intervalTime !== lastIntervalTime;
        lastIntervalTime = intervalTime;
        
        // 护眼模式
        applyWebDarkMode(!!res.webDarkMode);

        const scope = res.refreshScope || 'current'; // 默认仅当前页面
        let shouldRun = false;
        
        if (scope === 'all' && res.enabled) {
            shouldRun = true;
        } else if (scope === 'current' && sessionStorage.getItem('autoRefreshEnabled') === 'true') {
            shouldRun = true;
        }

        if (shouldRun) {
            if (intervalChanged) {
                nextRefreshAt = Date.now() + intervalTime;
                scheduleReload();
            }
            start();
        } else {
            stop();
        }
    });
}

// 页面加载时同步状态
checkStatus();

// 监听 storage 改变 (用于响应时间间隔或全局启停)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        checkStatus();
    }
});

// 监听来自 popup / background 的独立消息 (用于单页面启停)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'start_current') {
        sessionStorage.setItem('autoRefreshEnabled', 'true');
        checkStatus();
        sendResponse({status: "started"});
    } else if (msg.action === 'stop_current') {
        sessionStorage.removeItem('autoRefreshEnabled');
        checkStatus();
        sendResponse({status: "stopped"});
    } else if (msg.action === 'settings_updated') {
        checkStatus();
        sendResponse({status: "updated"});
    } else if (msg.action === 'apply_web_dark_mode') {
        applyWebDarkMode(msg.enable);
        sendResponse({status: "ok"});
    } else if (msg.action === 'get_pan_helper_context') {
        sendResponse(detectPanHelperContext());
    } else if (msg.action === 'get_pan_helper_files') {
        sendResponse(getPanHelperFiles());
    }
});
