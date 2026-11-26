const ipEl = document.getElementById("ip");
const trafficEl = document.getElementById("traffic");
const subEl = document.getElementById("subdomains");
const btn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const homepageBtn = document.getElementById("homepageBtn");
const authorBtn = document.getElementById("authorBtn");
const intervalInput = document.getElementById("intervalInput");
const scopeSelect = document.getElementById("scopeSelect");
const setIntervalBtn = document.getElementById("setIntervalBtn");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const reloadBtn = document.getElementById("reloadBtn");
const themeToggle = document.getElementById("themeToggle");
const enableWebDarkModeBtn = document.getElementById("enableWebDarkModeBtn");
const disableWebDarkModeBtn = document.getElementById("disableWebDarkModeBtn");
const langSelect = document.getElementById("langSelect");
const openWaterfallBtn = document.getElementById("openWaterfallBtn");
const openWaterfallTabBtn = document.getElementById("openWaterfallTabBtn");
const closeWaterfallBtn = document.getElementById("closeWaterfallBtn");
const waterfallEmbed = document.getElementById("waterfallEmbed");
const waterfallFrame = document.getElementById("waterfallFrame");
const loadingOverlay = document.getElementById("loadingOverlay");
const loaderContainer = document.querySelector(".loader-container");
const siteRuleHostEl = document.getElementById("siteRuleHost");
const siteRuleIntervalInput = document.getElementById("siteRuleIntervalInput");
const saveSiteRuleBtn = document.getElementById("saveSiteRuleBtn");
const removeSiteRuleBtn = document.getElementById("removeSiteRuleBtn");
const siteRuleList = document.getElementById("siteRuleList");
const panStatusEl = document.getElementById("pan-status");
const panProviderEl = document.getElementById("pan-provider");
const panPageTypeEl = document.getElementById("pan-page-type");
const panHostnameEl = document.getElementById("pan-hostname");
const panMessageEl = document.getElementById("pan-message");
const panFileSummaryEl = document.getElementById("pan-file-summary");
const panResolveSummaryEl = document.getElementById("pan-resolve-summary");
const panFileListEl = document.getElementById("pan-file-list");
const refreshPanHelperBtn = document.getElementById("refreshPanHelperBtn");
const copyPanNamesBtn = document.getElementById("copyPanNamesBtn");
const copyPanLinksBtn = document.getElementById("copyPanLinksBtn");
const copyPanAriaBtn = document.getElementById("copyPanAriaBtn");
const copyPanCurlBtn = document.getElementById("copyPanCurlBtn");
const copyPanUrlBtn = document.getElementById("copyPanUrlBtn");

let fragmentInterval = null;
let currentTabId = null;
let currentHostname = "";
let currentTabUrl = "";
let currentPanFiles = [];

function getSessionStorage() {
  return chrome.storage.session || chrome.storage.local;
}

function sessionSet(items) {
  return new Promise((resolve) => {
    getSessionStorage().set(items, resolve);
  });
}

function collectDetailedPerf(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => {
          const nav = performance.getEntriesByType("navigation")[0];
          const ttfb = nav ? Math.round(nav.responseStart) : 0;
          const dcl = nav ? Math.round(nav.domContentLoadedEventEnd) : 0;

          const fcpEntry = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
          const fcp = fcpEntry ? Math.round(fcpEntry.startTime) : 0;

          const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
          const lcp = lcpEntries && lcpEntries.length ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : 0;

          const clsEntries = performance.getEntriesByType("layout-shift");
          const cls = clsEntries && clsEntries.length
            ? clsEntries.filter((e) => !e.hadRecentInput).reduce((acc, e) => acc + e.value, 0)
            : 0;

          const allRes = performance.getEntriesByType("resource");
          const resources = allRes.map((r) => ({
            name: r.name,
            nameShort: (() => {
              try {
                const u = new URL(r.name);
                const base = u.pathname.split("/").pop() || u.hostname;
                return base + (u.search ? "?" : "");
              } catch {
                return r.name;
              }
            })(),
            initiatorType: r.initiatorType,
            startTime: r.startTime,
            duration: r.duration,
            transferSize: r.transferSize || 0,
            encodedBodySize: r.encodedBodySize || 0,
            decodedBodySize: r.decodedBodySize || 0,
            redirectStart: r.redirectStart || 0,
            redirectEnd: r.redirectEnd || 0,
            domainLookupStart: r.domainLookupStart || 0,
            domainLookupEnd: r.domainLookupEnd || 0,
            connectStart: r.connectStart || 0,
            secureConnectionStart: r.secureConnectionStart || 0,
            connectEnd: r.connectEnd || 0,
            requestStart: r.requestStart || 0,
            responseStart: r.responseStart || 0,
            responseEnd: r.responseEnd || 0,
          }));

          const bytes = allRes.reduce((acc, r) => acc + (r.transferSize || 0), 0);

          return {
            url: location.href,
            metrics: {
              ttfb,
              fcp,
              lcp,
              cls,
              dcl,
              reqs: allRes.length,
              bytes,
            },
            resources,
          };
        },
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!results || !results[0] || !results[0].result) {
          reject(new Error("No data"));
          return;
        }
        resolve(results[0].result);
      }
    );
  });
}

// 生成碎片效果
function spawnFragments() {
  if (!loaderContainer) return;
  
  fragmentInterval = setInterval(() => {
    const fragment = document.createElement("div");
    fragment.className = "fragment";
    
    // 随机弹出方向和旋转
    const dx = (Math.random() - 0.5) * 150 + 45;
    const dy = (Math.random() - 0.5) * 150 + 45;
    const dr = Math.random() * 360;
    
    fragment.style.setProperty("--dx", `${dx}px`);
    fragment.style.setProperty("--dy", `${dy}px`);
    fragment.style.setProperty("--dr", `${dr}deg`);
    fragment.style.animation = "fragmentOut 0.8s ease-out forwards";
    
    loaderContainer.appendChild(fragment);
    
    // 动画结束后移除元素，释放内存
    setTimeout(() => {
      fragment.remove();
    }, 800);
  }, 150); // 每 150ms 产生一个碎片
}

// 初始化：获取当前 tab 并加载数据
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  spawnFragments(); // 开始碎片动画
  const tab = tabs[0];
  if (!tab) return;
  currentTabId = tab.id;
  currentTabUrl = tab.url || "";
  syncRefreshButtonState();
  
  try {
    const url = new URL(tab.url);
    currentHostname = url.hostname || "";
    if (siteRuleHostEl) siteRuleHostEl.textContent = currentHostname || "当前页面不支持";
    loadSiteRuleState();

    // 子域名数量
    const hostnameParts = url.hostname.split(".");
    subEl.textContent = hostnameParts.length > 2 ? hostnameParts.length - 1 : 0;
  } catch (_) {
    currentHostname = "";
    if (siteRuleHostEl) siteRuleHostEl.textContent = "当前页面不支持";
    if (subEl) subEl.textContent = "0";
  }

  reloadPanHelperData();

  const devUrlEl = document.getElementById("dev-url");
  if (devUrlEl) devUrlEl.textContent = tab.url;
  const netKey = `net_${tab.id}`;
  const storage = chrome.storage.session || chrome.storage.local;
  storage.get([netKey], (res) => {
    const data = res[netKey] || {};
    const statusEl = document.getElementById("dev-status");
    const serverEl = document.getElementById("dev-server");
    const redirectCountEl = document.getElementById("dev-redirect-count");
    const chainEl = document.getElementById("dev-redirect-chain");
    if (statusEl) statusEl.textContent = data.statusCode ?? "N/A";
    if (serverEl) serverEl.textContent = data.server || "N/A";
    const chain = Array.isArray(data.redirectChain) ? data.redirectChain : [];
    if (redirectCountEl) redirectCountEl.textContent = `${chain.length}`;
    if (chainEl) {
      if (chain.length === 0) {
        chainEl.textContent = "N/A";
      } else {
        chainEl.innerHTML = chain
          .map((x, i) => `<div style="margin-bottom: 6px; word-break: break-all;"><b>${i + 1}.</b> ${x.from} → ${x.to}</div>`)
          .join("");
      }
    }
  });

  // 生成二维码
  const qrImg = document.getElementById("qrcode-img");
  const qrUrl = document.getElementById("qrcode-url");
  if (qrImg && qrUrl) {
    const urlStr = tab.url;
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlStr)}&margin=10`;
    qrImg.style.display = "inline-block";
    qrUrl.textContent = urlStr;
    qrUrl.title = urlStr;
  }

  // 获取公网 IP
  fetch(`https://api.ipify.org?format=json`)
    .then(res => res.json())
    .then(data => { 
      ipEl.textContent = data.ip; 
      hideLoading(); // 获取到 IP 后隐藏加载动画
    })
    .catch(() => { 
      ipEl.textContent = "获取失败"; 
      hideLoading();
    });

  // 获取流量数据
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
    if (chrome.runtime.lastError) {
      trafficEl.textContent = "不支持";
      return;
    }
    if (results && results[0] && results[0].result !== undefined) {
      const bytes = results[0].result;
      if (bytes > 1024*1024) trafficEl.textContent = (bytes/1024/1024).toFixed(2) + " MB";
      else trafficEl.textContent = (bytes/1024).toFixed(1) + " KB";
    } else {
      trafficEl.textContent = "未知";
    }
  });

  // 获取架构信息
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => {
      const techs = [];
      const hasGlobal = (name) => typeof window[name] !== 'undefined';
      
      // 前端框架
      if (hasGlobal('React') || document.querySelector('[data-reactroot], [data-reactid]')) techs.push({name: 'React', category: '前端框架', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png'});
      if (hasGlobal('Vue') || hasGlobal('__VUE__') || document.querySelector('[data-v-app]')) techs.push({name: 'Vue.js', category: '前端框架', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/vue/vue.png'});
      if (hasGlobal('angular') || document.querySelector('[ng-version], [ng-app]')) techs.push({name: 'Angular', category: '前端框架', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/angular/angular.png'});
      if (hasGlobal('Svelte') || document.querySelector('#svelte')) techs.push({name: 'Svelte', category: '前端框架', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/svelte/svelte.png'});
      
      // Web 框架
      if (hasGlobal('__NEXT_DATA__')) techs.push({name: 'Next.js', category: 'Web 框架', icon: 'https://raw.githubusercontent.com/github/explore/28b02bbc9ad9f7a503c43775aebeb515dc2ea5fc/topics/nextjs/nextjs.png'});
      if (hasGlobal('__NUXT__')) techs.push({name: 'Nuxt.js', category: 'Web 框架', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/nuxt/nuxt.png'});
      
      // JavaScript 库
      if (hasGlobal('jQuery') || hasGlobal('$')) techs.push({name: 'jQuery', category: 'JavaScript 库', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/jquery/jquery.png'});
      if (hasGlobal('_') && typeof window._.VERSION === 'string') techs.push({name: 'Lodash / Underscore', category: 'JavaScript 库', icon: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6f/Lodash.svg/120px-Lodash.svg.png'});
      if (hasGlobal('moment')) techs.push({name: 'Moment.js', category: 'JavaScript 库', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/120px-React-icon.svg.png'}); // moment 暂用默认替代，或者不显示
      if (hasGlobal('d3')) techs.push({name: 'D3.js', category: 'JavaScript 库', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/d3/d3.png'});
      if (hasGlobal('THREE')) techs.push({name: 'Three.js', category: 'JavaScript 库', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/threejs/threejs.png'});
      if (hasGlobal('echarts')) techs.push({name: 'ECharts', category: 'JavaScript 库', icon: 'https://raw.githubusercontent.com/apache/echarts/master/docs/assets/favicon.png'});
      
      // 构建工具
      if (hasGlobal('webpackJsonp') || hasGlobal('webpackChunk')) techs.push({name: 'Webpack', category: '构建工具', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/webpack/webpack.png'});
      if (hasGlobal('parcelRequire')) techs.push({name: 'Parcel', category: '构建工具', icon: 'https://raw.githubusercontent.com/parcel-bundler/website/master/src/assets/favicon.ico'});
      if (document.querySelector('script[type="module"]')) techs.push({name: 'ES Modules', category: '构建工具', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/javascript/javascript.png'});
      
      // CMS / 生成器
      const generator = document.querySelector('meta[name="generator"]');
      if (generator) {
        const content = generator.getAttribute('content').toLowerCase();
        if (content.includes('wordpress')) techs.push({name: 'WordPress', category: 'CMS', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/wordpress/wordpress.png'});
        if (content.includes('hexo')) techs.push({name: 'Hexo', category: '静态生成器', icon: 'https://raw.githubusercontent.com/hexojs/logo/master/hexo-logo-avatar.png'});
        if (content.includes('hugo')) techs.push({name: 'Hugo', category: '静态生成器', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/hugo/hugo.png'});
        if (content.includes('jekyll')) techs.push({name: 'Jekyll', category: '静态生成器', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/jekyll/jekyll.png'});
        if (content.includes('docusaurus')) techs.push({name: 'Docusaurus', category: '静态生成器', icon: 'https://raw.githubusercontent.com/facebook/docusaurus/main/website/static/img/docusaurus.svg'});
        if (content.includes('gatsby')) techs.push({name: 'Gatsby', category: '静态生成器', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/gatsby/gatsby.png'});
        if (content.includes('discuz')) techs.push({name: 'Discuz!', category: '论坛', icon: 'https://www.discuz.net/favicon.ico'});
      }
      
      // 分析工具
      if (hasGlobal('ga') || hasGlobal('_gaq') || hasGlobal('GoogleAnalyticsObject')) techs.push({name: 'Google Analytics', category: '分析', icon: 'https://www.google.com/images/icons/product/analytics-32.png'});
      if (hasGlobal('_hmt')) techs.push({name: '百度统计', category: '分析', icon: 'https://tongji.baidu.com/favicon.ico'});
      
      // UI 框架
      if (document.querySelector('.container, .row, .col-md-12') && hasGlobal('bootstrap')) techs.push({name: 'Bootstrap', category: 'UI 框架', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/bootstrap/bootstrap.png'});
      if (document.querySelector('.ant-btn, .ant-layout')) techs.push({name: 'Ant Design', category: 'UI 框架', icon: 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg'});
      if (document.querySelector('.el-button, .el-row')) techs.push({name: 'Element UI', category: 'UI 框架', icon: 'https://element.eleme.cn/favicon.ico'});
      if (document.querySelector('.v-application')) techs.push({name: 'Vuetify', category: 'UI 框架', icon: 'https://cdn.vuetifyjs.com/images/logos/vuetify-logo-light.png'});
      if (document.querySelector('.q-app')) techs.push({name: 'Quasar', category: 'UI 框架', icon: 'https://cdn.quasar.dev/logo-v2/favicon/favicon.ico'});
      if (document.querySelector('[class*="tw-"]')) techs.push({name: 'Tailwind CSS', category: 'UI 框架', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/tailwind/tailwind.png'});

      // Web 服务器 (由于无法直接读 Header，这里通过某些特征推测，或留作扩展示例)
      // 注意：精确检测 Nginx 通常需要读取 HTTP Response Headers (Server: nginx)
      // 这里我们在 content script 中尽量检查常见的错误页或注入特征
      if (document.title.includes('Welcome to nginx!') || document.body.innerHTML.includes('nginx/')) {
        techs.push({name: 'Nginx', category: 'Web 服务器', icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/nginx/nginx.png'});
      }
      
      // 富文本编辑器
      if (hasGlobal('Quill') || document.querySelector('.ql-container, .ql-editor')) {
        techs.push({name: 'Quill', category: '富文本编辑器', icon: 'https://quilljs.com/assets/images/favicon.png'});
      }

      return techs;
    }
  }, (results) => {
    const techListEl = document.getElementById("techList");
    if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
      techListEl.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">无法分析此页面架构</div>';
      return;
    }
    
    const techs = results[0].result;
    if (techs.length === 0) {
      techListEl.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">未检测到已知的前端技术栈</div>';
      return;
    }
    
    const groups = {};
    techs.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push({ name: t.name, icon: t.icon });
    });
    
    let html = '';
    for (const cat in groups) {
      html += `<div class="tech-category">${cat}</div><div>`;
      groups[cat].forEach(tech => {
        const iconHtml = tech.icon ? `<img src="${tech.icon}" class="tech-icon" onerror="this.style.display='none'">` : '';
        html += `<span class="tech-item">${iconHtml}${tech.name}</span>`;
      });
      html += `</div>`;
    }
    techListEl.innerHTML = html;
  });

  // 获取 SEO 和 Open Graph 信息
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const getMeta = (name) => document.querySelector(`meta[name="${name}" i]`)?.content || '无';
      const getOg = (prop) => document.querySelector(`meta[property="${prop}" i]`)?.content || '无';
      return {
        title: document.title || '无',
        description: getMeta('description'),
        keywords: getMeta('keywords'),
        ogTitle: getOg('og:title'),
        ogImage: getOg('og:image'),
        ogDesc: getOg('og:description')
      };
    }
  }, (results) => {
    if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) return;
    const seo = results[0].result;
    document.getElementById('seo-title').textContent = seo.title;
    document.getElementById('seo-desc').textContent = seo.description;
    document.getElementById('seo-keywords').textContent = seo.keywords;
    document.getElementById('og-title').textContent = seo.ogTitle;
    document.getElementById('og-desc').textContent = seo.ogDesc;
    
    const ogImgEl = document.getElementById('og-image');
    if (seo.ogImage !== '无') {
      ogImgEl.innerHTML = `<a href="${seo.ogImage}" target="_blank" style="color: #007bff; text-decoration: none;">[查看图片]</a>`;
    } else {
      ogImgEl.textContent = '无';
    }
  });

  // 获取性能瀑布流信息
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const nav = performance.getEntriesByType("navigation")[0];
      const ttfb = nav ? Math.round(nav.responseStart) : 0;
      const dcl = nav ? Math.round(nav.domContentLoadedEventEnd) : 0;

      const fcpEntry = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
      const fcp = fcpEntry ? Math.round(fcpEntry.startTime) : 0;

      const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
      const lcp = lcpEntries && lcpEntries.length ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : 0;

      const clsEntries = performance.getEntriesByType("layout-shift");
      const cls = clsEntries && clsEntries.length
        ? clsEntries.filter((e) => !e.hadRecentInput).reduce((acc, e) => acc + e.value, 0)
        : 0;

      const allRes = performance.getEntriesByType("resource");
      const resources = allRes
        .slice()
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map((r) => ({
          name: r.name.split("/").pop().split("?")[0] || r.name,
          duration: Math.round(r.duration),
        }));

      const reqs = allRes.length;
      const bytes = allRes.reduce((acc, r) => acc + (r.transferSize || 0), 0);

      return { ttfb, fcp, lcp, cls, dcl, reqs, bytes, resources };
    }
  }, (results) => {
    if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) return;
    const perf = results[0].result;
    const ttfbEl = document.getElementById("perf-ttfb");
    const fcpEl = document.getElementById("perf-fcp");
    const lcpEl = document.getElementById("perf-lcp");
    const clsEl = document.getElementById("perf-cls");
    document.getElementById('perf-dcl').textContent = perf.dcl;
    const reqsEl = document.getElementById("perf-reqs");
    const bytesEl = document.getElementById("perf-bytes");
    if (ttfbEl) ttfbEl.textContent = perf.ttfb;
    if (fcpEl) fcpEl.textContent = perf.fcp;
    if (lcpEl) lcpEl.textContent = perf.lcp;
    if (clsEl) clsEl.textContent = typeof perf.cls === "number" ? perf.cls.toFixed(3) : perf.cls;
    if (reqsEl) reqsEl.textContent = perf.reqs;
    if (bytesEl) {
      const b = perf.bytes || 0;
      bytesEl.textContent = b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`;
    }
    
    const resContainer = document.getElementById('perf-resources');
    if (perf.resources.length > 0) {
      let html = '';
      perf.resources.forEach((r, i) => {
        html += `<div style="margin-bottom: 6px; display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 2px;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;" title="${r.name}">${i+1}. ${r.name}</span>
          <span style="color: #d93025;">${r.duration} ms</span>
        </div>`;
      });
      resContainer.innerHTML = html;
    } else {
      resContainer.innerHTML = '<div style="text-align: center; color: var(--secondary-text); padding: 10px;">无资源数据</div>';
    }
  });
});

const clearCacheBtn = document.getElementById("clearCacheBtn");

if (clearCacheBtn) {
  clearCacheBtn.addEventListener("click", () => {
    if (!currentTabId) return;
    chrome.tabs.get(currentTabId, (tab) => {
      const url = new URL(tab.url);
      
      // 1. 清除 Cookies
      chrome.cookies.getAll({ domain: url.hostname }, (cookies) => {
        cookies.forEach(c => {
          const protocol = c.secure ? "https://" : "http://";
          const domain = c.domain.startsWith(".") ? c.domain.substring(1) : c.domain;
          chrome.cookies.remove({
            url: protocol + domain + c.path,
            name: c.name
          });
        });
      });

      // 2. 清除 Storage 并强制刷新页面
      chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => {
          localStorage.clear();
          sessionStorage.clear();
          location.reload();
        }
      }).then(() => {
        window.close(); // 刷新后关闭弹出框
      });
    });
  });
}

// 隐藏加载动画逻辑
function hideLoading() {
  setTimeout(() => {
    if (fragmentInterval) {
      clearInterval(fragmentInterval);
      fragmentInterval = null;
    }
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
      // 清空可能残留在容器中的碎片
      const remainingFragments = loaderContainer.querySelectorAll(".fragment");
      remainingFragments.forEach(f => f.remove());
    }, 500);
  }, 800); // 配合更快的动画缩短显示时间
}

// 侧边栏切换
sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("hidden");
  sidebarToggle.textContent = sidebar.classList.contains("hidden") ? "▶" : "◀";
});

// 重新加载页面按钮
reloadBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.reload(tabs[0].id);
    window.close(); // 重新加载后通常关闭弹出框
  });
});

// 导航切换
document.querySelectorAll(".nav-btn[data-target]").forEach(button => {
  button.addEventListener("click", () => {
    // 切换按钮激活状态
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    // 切换视图显示
    const target = button.getAttribute("data-target");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(target).classList.add("active");
  });
});

function updateBtnState(isRunning) {
  if (isRunning) {
    btn.textContent = t("enabled");
    btn.disabled = true;
    btn.classList.add("secondary");
    btn.classList.remove("primary");
  } else {
    btn.textContent = t("start");
    btn.disabled = false;
    btn.classList.add("primary");
    btn.classList.remove("secondary");
  }
}

function normalizeIntervalMs(rawSeconds) {
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(seconds) || seconds < 0.1) {
    return null;
  }
  return Math.round(seconds * 1000);
}

function getRulesObject(rawRules) {
  if (!rawRules || typeof rawRules !== "object" || Array.isArray(rawRules)) {
    return {};
  }
  return rawRules;
}

function formatIntervalText(interval) {
  const ms = Number(interval) || 0;
  return `${ms / 1000} 秒`;
}

function renderSiteRules(rules) {
  if (!siteRuleList) return;
  const entries = Object.entries(getRulesObject(rules)).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    siteRuleList.textContent = "暂无站点规则";
    return;
  }

  siteRuleList.innerHTML = entries
    .map(([host, interval]) => {
      const active = currentHostname && host === currentHostname ? " <b>(当前站点)</b>" : "";
      return `<div style="display:flex; justify-content:space-between; gap:8px; border-top:1px dashed var(--border-color); padding-top:6px; margin-top:6px;"><span style="word-break:break-all;">${host}${active}</span><span>${formatIntervalText(interval)}</span></div>`;
    })
    .join("");
}

function loadSiteRuleState() {
  chrome.storage.local.get(["siteRules"], (res) => {
    const rules = getRulesObject(res.siteRules);
    renderSiteRules(rules);
    if (siteRuleIntervalInput && currentHostname && rules[currentHostname]) {
      siteRuleIntervalInput.value = String(rules[currentHostname] / 1000);
    }
  });
}

function setPanHelperState(data) {
  const state = data || {};
  const supported = !!state.supported;
  if (panStatusEl) panStatusEl.textContent = supported ? "已支持" : "未支持";
  if (panProviderEl) panProviderEl.textContent = state.providerName || (state.provider ? String(state.provider) : "-");
  if (panPageTypeEl) panPageTypeEl.textContent = state.pageTypeLabel || (state.pageType ? String(state.pageType) : "-");
  if (panHostnameEl) panHostnameEl.textContent = state.host || currentHostname || "未知";
  if (panMessageEl) panMessageEl.textContent = state.message || "当前页面暂未接入网盘助手。";
}

function renderPanFiles(payload) {
  const files = Array.isArray(payload && payload.files) ? payload.files : [];
  currentPanFiles = files;

  if (panFileSummaryEl) {
    if (payload && payload.supported) {
      panFileSummaryEl.textContent = `已提取 ${files.length} 项，可见来源：${payload.sourceLabel || "页面可见区域"}`;
    } else {
      panFileSummaryEl.textContent = payload && payload.message ? payload.message : "当前页面暂不支持提取文件列表。";
    }
  }

  if (panResolveSummaryEl) {
    panResolveSummaryEl.textContent = payload && payload.resolveSummary
      ? payload.resolveSummary
      : "当前还没有可复制的下载命令。";
  }

  if (!panFileListEl) return;

  if (!files.length) {
    panFileListEl.textContent = payload && payload.emptyMessage ? payload.emptyMessage : "当前没有提取到文件列表。";
    return;
  }

  panFileListEl.innerHTML = files
    .slice(0, 20)
    .map((file, index) => {
      const meta = [file.typeLabel, file.sizeText].filter(Boolean).join(" / ");
      const extras = [];
      if (file.selected) extras.push("已选中");
      if (file.downloadUrl) extras.push("直链已解析");
      if (file.downloadError) extras.push(file.downloadError);
      const extraText = extras.join(" / ");
      return `<div style="padding: 6px 0; border-top: 1px dashed var(--border-color);"><div style="word-break: break-all;"><b>${index + 1}.</b> ${file.name}</div><div style="margin-top: 2px; color: var(--secondary-text);">${meta || "未识别更多信息"}${extraText ? ` / ${extraText}` : ""}</div></div>`;
    })
    .join("");
}

function loadPanHelperState() {
  if (!currentTabId) {
    setPanHelperState({
      supported: false,
      message: "当前没有可识别的标签页。",
      host: currentHostname,
    });
    return;
  }

  chrome.tabs.sendMessage(currentTabId, { action: "get_pan_helper_context" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      setPanHelperState({
        supported: false,
        host: currentHostname,
        message: "当前页面暂不支持读取网盘上下文，可能是浏览器系统页，或者页面还没有完成注入。",
      });
      return;
    }
    setPanHelperState(response);
  });
}

function loadPanHelperFiles() {
  if (!currentTabId) {
    renderPanFiles({
      supported: false,
      message: "当前没有可识别的标签页。",
      emptyMessage: "暂无文件数据",
    });
    return;
  }

  chrome.tabs.sendMessage(currentTabId, { action: "get_pan_helper_files" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      renderPanFiles({
        supported: false,
        message: "当前页面暂不支持提取文件列表。",
        emptyMessage: "无法读取当前页面中的文件项",
      });
      return;
    }
    renderPanFiles(response);
  });
}

async function executePanMainWorld(func, args = []) {
  if (!currentTabId) {
    throw new Error("当前没有可用标签页");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    world: "MAIN",
    func,
    args,
  });

  if (!results || !results[0]) {
    throw new Error("未获取到页面执行结果");
  }

  return results[0].result;
}

async function loadPanHelperAdvancedFiles() {
  if (!currentTabId || currentHostname !== "pan.quark.cn") {
    loadPanHelperFiles();
    return;
  }

  try {
    const payload = await executePanMainWorld(async () => {
      const COMMON_PARAMS = "pr=ucpro&fr=pc";
      const DRIVE_BASE_URL = "https://drive-pc.quark.cn";

      const formatSize = (size) => {
        const value = Number(size) || 0;
        if (!value) return "";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let index = 0;
        let current = value;
        while (current >= 1024 && index < units.length - 1) {
          current /= 1024;
          index += 1;
        }
        return `${current.toFixed(current >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
      };

      const normalizeFile = (item, source) => {
        const name = item.file_name || item.name || item.fileName || "未知文件";
        const sizeValue = Number(item.size || item.file_size || 0) || 0;
        const isDir = Boolean(item.dir || item.is_dir || item.file_type === 0 || item.type === "folder");
        return {
          fid: item.fid || item.fs_id || "",
          shareFidToken: item.share_fid_token || "",
          name,
          size: sizeValue,
          sizeText: item.sizeText || formatSize(sizeValue),
          isDir,
          type: isDir ? "folder" : "file",
          typeLabel: isDir ? "文件夹" : "文件",
          source,
          selected: source === "selected" || Boolean(item.selected),
        };
      };

      const dedupeFiles = (list) => {
        const seen = new Set();
        return list.filter((item) => {
          const key = `${item.fid || ""}__${item.name}__${item.size || 0}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const getSelectedList = () => {
        try {
          if (typeof require === "function") {
            const selected = require("system-core:context/context.js").instanceForSystem.list.getSelected();
            if (Array.isArray(selected) && selected.length) {
              return selected;
            }
          }
        } catch (_) {
        }

        try {
          const panRoot = document.querySelector(".wp-s-core-pan");
          const selected = panRoot && panRoot.__vue__ && Array.isArray(panRoot.__vue__.selectedList) ? panRoot.__vue__.selectedList : [];
          if (selected.length) {
            return selected;
          }
        } catch (_) {
        }

        return [];
      };

      const extractVisibleFiles = () => {
        const selectors = [
          "[data-row-key]",
          "[role='row']",
          "[class*='file-item']",
          "[class*='file-row']",
          "[class*='list-item']",
          "[class*='table-row']",
          "[class*='item']",
        ];

        const items = [];
        const seen = new Set();
        selectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const lines = String(element.innerText || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            if (!lines.length || lines.length > 12) return;
            const sizeText = lines.find((line) => /^\d+(?:\.\d+)?\s?(?:B|KB|MB|GB|TB)$/i.test(line)) || "";
            const name = lines.find((line) => line.length < 80 && !["下载","分享","更多","移动","删除","搜索","上传","新建","最近","全部文件","回收站","网盘","列表","排序","筛选","文件","文件夹"].includes(line));
            if (!name) return;
            const key = `${name}__${sizeText}`;
            if (seen.has(key)) return;
            seen.add(key);
            items.push({
              name,
              sizeText,
              typeLabel: /文件夹|folder/i.test(lines.join(" ")) ? "文件夹" : sizeText ? "文件" : "未知类型",
              isDir: /文件夹|folder/i.test(lines.join(" ")),
              selected: element.getAttribute("aria-selected") === "true" || String(element.className || "").includes("selected"),
            });
          });
        });
        return items.slice(0, 50);
      };

      const getPwdId = () => {
        const match = location.pathname.match(/\/s\/([A-Za-z0-9]+)/);
        return match ? match[1] : "";
      };

      const fetchShareFiles = async () => {
        const pwdId = getPwdId();
        if (!pwdId) {
          return { files: [], error: "当前分享页没有识别到 pwd_id" };
        }

        const tokenResp = await fetch(`${DRIVE_BASE_URL}/1/clouddrive/share/sharepage/token?${COMMON_PARAMS}`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pwd_id: pwdId, passcode: "" }),
        });
        const tokenJson = await tokenResp.json();
        if (tokenJson.code !== 0 || !tokenJson.data || !tokenJson.data.stoken) {
          return {
            files: [],
            error: tokenJson.message || "获取分享页 stoken 失败，可能是提取码分享或当前登录态不足",
          };
        }

        const stoken = encodeURIComponent(tokenJson.data.stoken);
        const detailUrl = `${DRIVE_BASE_URL}/1/clouddrive/share/sharepage/detail?${COMMON_PARAMS}&pwd_id=${encodeURIComponent(pwdId)}&stoken=${stoken}&pdir_fid=0&force=0&_page=1&_size=50&_fetch_banner=0&_fetch_share=0&_fetch_total=1&_sort=file_type:asc,updated_at:desc&ver=2&fetch_share_full_path=0`;
        const detailResp = await fetch(detailUrl, { credentials: "include" });
        const detailJson = await detailResp.json();
        if (detailJson.code !== 0) {
          return { files: [], error: detailJson.message || "获取分享页文件列表失败" };
        }

        return {
          files: Array.isArray(detailJson.data && detailJson.data.list) ? detailJson.data.list.map((item) => normalizeFile(item, "share-api")) : [],
          error: "",
          pwdId,
        };
      };

      const resolveDownloadUrls = async (files, pageType) => {
        const targets = files.filter((file) => file.fid && !file.isDir);
        if (!targets.length) {
          return {
            files,
            resolveSummary: "当前列表里没有可解析直链的普通文件。",
          };
        }

        try {
          const resp = await fetch(`${DRIVE_BASE_URL}/1/clouddrive/file/download?${COMMON_PARAMS}&uc_param_str=`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fids: targets.map((file) => file.fid) }),
          });
          const json = await resp.json();
          if (json.code !== 0 || !Array.isArray(json.data)) {
            return {
              files: files.map((file) => ({
                ...file,
                downloadError: !file.isDir && file.fid
                  ? (pageType === "share"
                    ? `分享页直链暂未解析成功：${json.message || "接口未返回下载地址，通常需要先保存到网盘"}`
                    : `未解析到直链：${json.message || "接口未返回下载地址"}`)
                  : file.downloadError || "",
              })),
              resolveSummary: pageType === "share"
                ? `分享页直链解析失败：${json.message || "通常需要先保存到网盘"}`
                : `直链解析失败：${json.message || "接口未返回下载地址"}`,
            };
          }

          const map = new Map(json.data.map((item) => [item.fid, item]));
          const resolvedFiles = files.map((file) => {
            const match = map.get(file.fid);
            if (!match || !match.download_url) {
              return file;
            }

            const downloadUrl = match.download_url;
            const escapedName = String(file.name).replace(/"/g, '\\"');
            return {
              ...file,
              downloadUrl,
              aria2Command: `aria2c "${downloadUrl}" --out "${escapedName}" --header "Referer: https://pan.quark.cn/"`,
              curlCommand: `curl -L "${downloadUrl}" -o "${escapedName}" -H "Referer: https://pan.quark.cn/"`,
              downloadError: "",
            };
          });

          const resolvedCount = resolvedFiles.filter((file) => !!file.downloadUrl).length;
          return {
            files: resolvedFiles,
            resolveSummary: resolvedCount
              ? `已解析 ${resolvedCount} 个文件的直链、aria2 和 curl 命令。`
              : "接口返回成功，但没有解析到可用下载地址。",
          };
        } catch (error) {
          return {
            files: files.map((file) => ({
              ...file,
              downloadError: !file.isDir && file.fid ? `直链请求失败：${error && error.message ? error.message : error}` : file.downloadError || "",
            })),
            resolveSummary: `直链请求失败：${error && error.message ? error.message : error}`,
          };
        }
      };

      const isSharePage = /\/s\//.test(location.pathname);
      const selected = dedupeFiles(getSelectedList().map((item) => normalizeFile(item, "selected")));
      const visible = dedupeFiles(extractVisibleFiles().map((item) => ({
        ...item,
        type: item.isDir ? "folder" : "file",
        source: "visible-dom",
      })));

      let files = selected;
      let sourceLabel = "页面选中项";
      let message = selected.length
        ? `已优先读取夸克页面选中项 ${selected.length} 个。`
        : "当前没有读取到选中项。";

      if (!files.length && isSharePage) {
        try {
          const shareResult = await fetchShareFiles();
          if (shareResult.files.length) {
            files = dedupeFiles(shareResult.files);
            sourceLabel = "分享页接口";
            message = `已从夸克分享页接口读取 ${files.length} 项文件。`;
          } else if (shareResult.error) {
            message = shareResult.error;
          }
        } catch (error) {
          message = `分享页接口读取失败：${error && error.message ? error.message : error}`;
        }
      }

      if (!files.length && visible.length) {
        files = visible;
        sourceLabel = "页面可见区域";
        message = `已从页面可见区域读取 ${files.length} 项文件。`;
      }

      if (!files.length) {
        return {
          supported: true,
          provider: "quark",
          sourceLabel,
          files: [],
          message,
          emptyMessage: "当前没有读取到文件项",
          resolveSummary: "当前没有可解析的下载命令。",
        };
      }

      const resolved = await resolveDownloadUrls(files, isSharePage ? "share" : "drive");
      return {
        supported: true,
        provider: "quark",
        sourceLabel,
        files: resolved.files,
        message,
        emptyMessage: "当前没有读取到文件项",
        resolveSummary: resolved.resolveSummary,
      };
    });

    renderPanFiles(payload);
  } catch (error) {
    renderPanFiles({
      supported: false,
      files: [],
      message: `高级提取失败：${error && error.message ? error.message : error}`,
      emptyMessage: "无法从当前页面读取夸克文件数据",
      resolveSummary: "当前没有可解析的下载命令。",
    });
  }
}

function reloadPanHelperData() {
  loadPanHelperState();
  loadPanHelperAdvancedFiles();
}

function syncRefreshButtonState() {
  chrome.storage.local.get(["enabled", "refreshScope"], (res) => {
    const scope = res.refreshScope || "current";
    if (scope === "all") {
      updateBtnState(!!res.enabled);
      return;
    }

    if (!currentTabId) {
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: currentTabId },
        func: () => sessionStorage.getItem("autoRefreshEnabled") === "true",
      },
      (results) => {
        if (chrome.runtime.lastError) {
          updateBtnState(false);
          return;
        }
        const isRunning = results && results[0] && results[0].result;
        updateBtnState(!!isRunning);
      }
    );
  });
}

// 深浅模式切换
function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
}

const I18N = {
  "zh-CN": {
    nav_status: "状态",
    nav_tech: "架构分析",
    nav_seo: "SEO 分析",
    nav_perf: "性能分析",
    nav_dev: "开发者工具",
    nav_qr: "二维码",
    nav_pan: "网盘助手",
    nav_settings: "设置",
    nav_about: "关于",
    nav_help: "帮助",
    footer_home: "官网",
    footer_author: "作者网址",
    top_title: "功能界面",
    network: "网络信息",
    traffic: "流量统计",
    domain: "域名分析",
    tech_title: "技术栈解析",
    seo_basic: "基础 Meta",
    seo_og: "Open Graph (社交分享)",
    perf_metrics: "页面加载指标",
    perf_resources: "最慢的 5 个资源 (瀑布流)",
    perf_waterfall: "详细瀑布流",
    perf_waterfall_tab: "新标签打开",
    close: "关闭",
    waterfall: "Waterfall",
    dev_net: "网络信息",
    dev_chain: "跳转链",
    qr_title: "手机扫码预览",
    qr_desc: "扫描下方二维码在移动端打开当前网页",
    pan_helper: "网盘助手",
    pan_helper_desc: "当前阶段先接入夸克网盘识别，后续继续补文件提取和下载链接生成。",
    pan_helper_message: "识别结果",
    pan_file_list: "文件列表",
    pan_refresh: "重新识别",
    pan_copy_names: "复制文件名",
    pan_copy_links: "复制直链",
    pan_copy_aria: "复制 aria2",
    pan_copy_curl: "复制 curl",
    pan_copy_url: "复制当前链接",
    lang: "语言",
    lang_desc: "界面语言切换",
    scope: "刷新范围设置",
    scope_desc: "选择自动刷新的生效范围",
    scope_current: "仅刷新当前标签页",
    scope_all: "刷新所有标签页",
    interval: "刷新频率设置",
    interval_desc: "设置自动刷新的时间间隔（单位：秒）",
    site_rule: "站点规则配置",
    site_rule_desc: "为当前站点保存专属刷新频率，打开该站点时自动生效。",
    save_site_rule: "保存当前站点规则",
    remove_site_rule: "删除当前站点规则",
    save_settings: "保存所有设置",
    webdark: "网页护眼模式",
    webdark_desc: "强制反转当前网页颜色（暗黑模式）",
    webdark_on: "开启护眼",
    webdark_off: "关闭护眼",
    start: "开启刷新",
    stop: "停止刷新",
    enabled: "刷新已开启",
    danger: "危险操作",
    danger_desc: "一键清空当前网站的 Cookie 和本地缓存，并强制刷新页面。",
    danger_btn: "清空缓存并刷新",
  },
  en: {
    nav_status: "Status",
    nav_tech: "Tech",
    nav_seo: "SEO",
    nav_perf: "Performance",
    nav_dev: "DevTools",
    nav_qr: "QR Code",
    nav_pan: "Pan Helper",
    nav_settings: "Settings",
    nav_about: "About",
    nav_help: "Help",
    footer_home: "Home",
    footer_author: "Author",
    top_title: "Panel",
    network: "Network",
    traffic: "Traffic",
    domain: "Domain",
    tech_title: "Technology",
    seo_basic: "Meta",
    seo_og: "Open Graph",
    perf_metrics: "Metrics",
    perf_resources: "Top 5 Slow Resources",
    perf_waterfall: "Detailed Waterfall",
    perf_waterfall_tab: "Open in tab",
    close: "Close",
    waterfall: "Waterfall",
    dev_net: "Network",
    dev_chain: "Redirect Chain",
    qr_title: "Scan to Open",
    qr_desc: "Scan the QR code to open this page on mobile",
    pan_helper: "Pan Helper",
    pan_helper_desc: "Phase 1 only detects Quark pages. File extraction and link generation come next.",
    pan_helper_message: "Detection Result",
    pan_file_list: "Files",
    pan_refresh: "Refresh Detect",
    pan_copy_names: "Copy Names",
    pan_copy_links: "Copy Links",
    pan_copy_aria: "Copy aria2",
    pan_copy_curl: "Copy curl",
    pan_copy_url: "Copy URL",
    lang: "Language",
    lang_desc: "UI language",
    scope: "Refresh Scope",
    scope_desc: "Choose scope",
    scope_current: "Current tab only",
    scope_all: "All tabs",
    interval: "Refresh Interval",
    interval_desc: "Seconds per refresh",
    site_rule: "Site Rules",
    site_rule_desc: "Save a dedicated refresh interval for the current site and apply it automatically.",
    save_site_rule: "Save Site Rule",
    remove_site_rule: "Remove Site Rule",
    save_settings: "Save settings",
    webdark: "Eye Comfort Mode",
    webdark_desc: "Force dark mode by inverting colors",
    webdark_on: "Enable",
    webdark_off: "Disable",
    start: "Start",
    stop: "Stop",
    enabled: "Running",
    danger: "Danger Zone",
    danger_desc: "Clear cookies and storage for current site, then reload.",
    danger_btn: "Clear & Reload",
  },
  "zh-TW": {
    nav_status: "狀態",
    nav_tech: "架構分析",
    nav_seo: "SEO 分析",
    nav_perf: "效能分析",
    nav_dev: "開發者工具",
    nav_qr: "二維碼",
    nav_pan: "網盤助手",
    nav_settings: "設定",
    nav_about: "關於",
    nav_help: "幫助",
    footer_home: "官網",
    footer_author: "作者網址",
    top_title: "功能介面",
    network: "網路資訊",
    traffic: "流量統計",
    domain: "網域分析",
    tech_title: "技術棧解析",
    seo_basic: "基礎 Meta",
    seo_og: "Open Graph (社群分享)",
    perf_metrics: "頁面載入指標",
    perf_resources: "最慢的 5 個資源 (瀑布流)",
    perf_waterfall: "詳細瀑布流",
    perf_waterfall_tab: "新分頁開啟",
    close: "關閉",
    waterfall: "Waterfall",
    dev_net: "網路資訊",
    dev_chain: "跳轉鏈",
    qr_title: "手機掃碼預覽",
    qr_desc: "掃描下方二維碼在手機開啟目前網頁",
    pan_helper: "網盤助手",
    pan_helper_desc: "目前階段先接入夸克網盤識別，後續再補檔案提取與下載連結生成。",
    pan_helper_message: "識別結果",
    pan_file_list: "檔案列表",
    pan_refresh: "重新識別",
    pan_copy_names: "複製檔名",
    pan_copy_links: "複製直鏈",
    pan_copy_aria: "複製 aria2",
    pan_copy_curl: "複製 curl",
    pan_copy_url: "複製目前連結",
    lang: "語言",
    lang_desc: "介面語言切換",
    scope: "刷新範圍設定",
    scope_desc: "選擇自動刷新的生效範圍",
    scope_current: "僅刷新目前分頁",
    scope_all: "刷新所有分頁",
    interval: "刷新頻率設定",
    interval_desc: "設定自動刷新的時間間隔（秒）",
    site_rule: "站點規則設定",
    site_rule_desc: "為目前站點儲存專屬刷新頻率，之後開啟該站點會自動套用。",
    save_site_rule: "儲存目前站點規則",
    remove_site_rule: "刪除目前站點規則",
    save_settings: "儲存所有設定",
    webdark: "網頁護眼模式",
    webdark_desc: "強制反轉目前網頁顏色（暗黑模式）",
    webdark_on: "開啟護眼",
    webdark_off: "關閉護眼",
    start: "開啟刷新",
    stop: "停止刷新",
    enabled: "刷新已開啟",
    danger: "危險操作",
    danger_desc: "一鍵清空目前網站的 Cookie 與本機快取，並強制刷新頁面。",
    danger_btn: "清空快取並刷新",
  },
};

let currentLang = "zh-CN";

function t(key) {
  const dict = I18N[currentLang] || I18N["zh-CN"];
  return dict[key] ?? I18N["zh-CN"][key] ?? key;
}

function setText(id, key) {
  const el = document.getElementById(id);
  if (el) el.textContent = t(key);
}

function applyLanguage(lang) {
  currentLang = I18N[lang] ? lang : "zh-CN";
  const navMap = {
    "view-dashboard": "nav_status",
    "view-tech": "nav_tech",
    "view-seo": "nav_seo",
    "view-perf": "nav_perf",
    "view-devtools": "nav_dev",
    "view-qrcode": "nav_qr",
    "view-pan-helper": "nav_pan",
    "view-settings": "nav_settings",
    "view-about": "nav_about",
    "view-help": "nav_help",
  };
  Object.entries(navMap).forEach(([target, key]) => {
    const el = document.querySelector(`.nav-btn[data-target="${target}"]`);
    if (el) el.textContent = t(key);
  });
  setText("topTitle", "top_title");
  setText("label-network", "network");
  setText("label-traffic", "traffic");
  setText("label-domain", "domain");
  setText("label-tech", "tech_title");
  setText("label-seo-basic", "seo_basic");
  setText("label-seo-og", "seo_og");
  setText("label-perf-metrics", "perf_metrics");
  setText("label-perf-resources", "perf_resources");
  if (openWaterfallBtn) openWaterfallBtn.textContent = t("perf_waterfall");
  if (openWaterfallTabBtn) openWaterfallTabBtn.textContent = t("perf_waterfall_tab");
  if (closeWaterfallBtn) closeWaterfallBtn.textContent = t("close");
  setText("waterfallTitle", "waterfall");
  setText("label-devtools-net", "dev_net");
  setText("label-devtools-chain", "dev_chain");
  setText("label-qrcode", "qr_title");
  setText("qrcode-desc", "qr_desc");
  setText("label-pan-helper", "pan_helper");
  setText("pan-helper-desc", "pan_helper_desc");
  setText("label-pan-helper-message", "pan_helper_message");
  setText("label-pan-file-list", "pan_file_list");
  setText("label-lang", "lang");
  setText("lang-desc", "lang_desc");
  setText("label-scope", "scope");
  setText("scope-desc", "scope_desc");
  setText("label-interval", "interval");
  setText("interval-desc", "interval_desc");
  setText("label-site-rule", "site_rule");
  setText("site-rule-desc", "site_rule_desc");
  setText("label-webdark", "webdark");
  setText("webdark-desc", "webdark_desc");
  setText("label-danger", "danger");
  setText("danger-desc", "danger_desc");

  if (btn) btn.textContent = btn.disabled ? t("enabled") : t("start");
  if (stopBtn) stopBtn.textContent = t("stop");
  if (setIntervalBtn) setIntervalBtn.textContent = t("save_settings");
  if (refreshPanHelperBtn) refreshPanHelperBtn.textContent = t("pan_refresh");
  if (copyPanNamesBtn) copyPanNamesBtn.textContent = t("pan_copy_names");
  if (copyPanLinksBtn) copyPanLinksBtn.textContent = t("pan_copy_links");
  if (copyPanAriaBtn) copyPanAriaBtn.textContent = t("pan_copy_aria");
  if (copyPanCurlBtn) copyPanCurlBtn.textContent = t("pan_copy_curl");
  if (copyPanUrlBtn) copyPanUrlBtn.textContent = t("pan_copy_url");
  if (saveSiteRuleBtn) saveSiteRuleBtn.textContent = t("save_site_rule");
  if (removeSiteRuleBtn) removeSiteRuleBtn.textContent = t("remove_site_rule");
  if (enableWebDarkModeBtn) enableWebDarkModeBtn.textContent = t("webdark_on");
  if (disableWebDarkModeBtn) disableWebDarkModeBtn.textContent = t("webdark_off");
  if (clearCacheBtn) clearCacheBtn.textContent = t("danger_btn");
  if (homepageBtn) homepageBtn.textContent = t("footer_home");
  if (authorBtn) authorBtn.textContent = t("footer_author");

  if (scopeSelect) {
    const optCurrent = scopeSelect.querySelector(`option[value="current"]`);
    const optAll = scopeSelect.querySelector(`option[value="all"]`);
    if (optCurrent) optCurrent.textContent = t("scope_current");
    if (optAll) optAll.textContent = t("scope_all");
  }
}

themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark-mode");
  applyTheme(isDark);
  chrome.storage.local.set({ darkMode: isDark });
});

function updateWebDarkModeBtnState(isEnabled) {
  if (enableWebDarkModeBtn && disableWebDarkModeBtn) {
    if (isEnabled) {
      enableWebDarkModeBtn.classList.add("secondary");
      enableWebDarkModeBtn.classList.remove("primary");
      disableWebDarkModeBtn.classList.add("primary");
      disableWebDarkModeBtn.classList.remove("secondary");
    } else {
      enableWebDarkModeBtn.classList.add("primary");
      enableWebDarkModeBtn.classList.remove("secondary");
      disableWebDarkModeBtn.classList.add("secondary");
      disableWebDarkModeBtn.classList.remove("primary");
    }
  }
}

// 初始化存储状态
chrome.storage.local.get(["enabled", "interval", "refreshScope", "darkMode", "webDarkMode", "lang", "siteRules"], (res) => {
  const lang = res.lang || "zh-CN";
  if (langSelect) langSelect.value = lang;
  applyLanguage(lang);
  applyTheme(res.darkMode);
  updateWebDarkModeBtnState(res.webDarkMode);
  
  const scope = res.refreshScope || 'current';
  if (scopeSelect) scopeSelect.value = scope;

  if (res.interval) {
    intervalInput.value = res.interval / 1000;
  } else {
    intervalInput.value = 60; // 默认显示 1 分钟
  }
  renderSiteRules(res.siteRules);
  syncRefreshButtonState();
});

if (langSelect) {
  langSelect.addEventListener("change", () => {
    const lang = langSelect.value || "zh-CN";
    chrome.storage.local.set({ lang }, () => {
      applyLanguage(lang);
    });
  });
}

if (refreshPanHelperBtn) {
  refreshPanHelperBtn.addEventListener("click", () => {
    reloadPanHelperData();
  });
}

if (copyPanNamesBtn) {
  copyPanNamesBtn.addEventListener("click", async () => {
    if (!currentPanFiles.length) {
      alert("当前没有可复制的文件名");
      return;
    }
    try {
      await navigator.clipboard.writeText(currentPanFiles.map((file) => file.name).join("\n"));
      alert(`已复制 ${currentPanFiles.length} 个文件名`);
    } catch (error) {
      alert("复制失败，请检查浏览器权限");
    }
  });
}

if (copyPanLinksBtn) {
  copyPanLinksBtn.addEventListener("click", async () => {
    const lines = currentPanFiles.map((file) => file.downloadUrl).filter(Boolean);
    if (!lines.length) {
      alert("当前没有可复制的直链");
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert(`已复制 ${lines.length} 条直链`);
    } catch (error) {
      alert("复制失败，请检查浏览器权限");
    }
  });
}

if (copyPanAriaBtn) {
  copyPanAriaBtn.addEventListener("click", async () => {
    const lines = currentPanFiles.map((file) => file.aria2Command).filter(Boolean);
    if (!lines.length) {
      alert("当前没有可复制的 aria2 命令");
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert(`已复制 ${lines.length} 条 aria2 命令`);
    } catch (error) {
      alert("复制失败，请检查浏览器权限");
    }
  });
}

if (copyPanCurlBtn) {
  copyPanCurlBtn.addEventListener("click", async () => {
    const lines = currentPanFiles.map((file) => file.curlCommand).filter(Boolean);
    if (!lines.length) {
      alert("当前没有可复制的 curl 命令");
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert(`已复制 ${lines.length} 条 curl 命令`);
    } catch (error) {
      alert("复制失败，请检查浏览器权限");
    }
  });
}

if (copyPanUrlBtn) {
  copyPanUrlBtn.addEventListener("click", async () => {
    if (!currentTabUrl) {
      alert("当前没有可复制的链接");
      return;
    }
    try {
      await navigator.clipboard.writeText(currentTabUrl);
      alert("当前链接已复制");
    } catch (error) {
      alert("复制失败，请检查浏览器权限");
    }
  });
}

async function openWaterfall(embed) {
  if (!currentTabId) return;
  try {
    const data = await collectDetailedPerf(currentTabId);
    const key = `waterfall_${currentTabId}`;
    await sessionSet({ [key]: data, waterfall_last: data });
    const url = chrome.runtime.getURL(`report.html?tabId=${encodeURIComponent(String(currentTabId))}`);
    if (embed) {
      if (waterfallFrame) waterfallFrame.src = url;
      if (waterfallEmbed) waterfallEmbed.style.display = "block";
    } else {
      chrome.tabs.create({ url });
    }
  } catch (e) {
    alert(String(e && e.message ? e.message : e));
  }
}

if (openWaterfallBtn) {
  openWaterfallBtn.addEventListener("click", () => {
    openWaterfall(true);
  });
}

if (openWaterfallTabBtn) {
  openWaterfallTabBtn.addEventListener("click", () => {
    openWaterfall(false);
  });
}

if (closeWaterfallBtn) {
  closeWaterfallBtn.addEventListener("click", () => {
    if (waterfallFrame) waterfallFrame.src = "";
    if (waterfallEmbed) waterfallEmbed.style.display = "none";
  });
}

// 开启刷新
btn.addEventListener("click", () => {
  chrome.storage.local.get(["refreshScope"], (res) => {
    const scope = res.refreshScope || 'current';
    if (scope === 'all') {
      chrome.storage.local.set({ enabled: true }, () => updateBtnState(true));
    } else if (currentTabId) {
      // 尝试发送消息给 content script
      chrome.tabs.sendMessage(currentTabId, { action: 'start_current' }, (response) => {
        if (chrome.runtime.lastError) {
          // 如果 content script 未准备好（可能是刚安装插件页面未刷新，或是不支持的页面）
          // 我们尝试通过直接执行脚本的方式来设置状态
          chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: () => {
              sessionStorage.setItem('autoRefreshEnabled', 'true');
              // 强制刷新一次页面以启动 content script 逻辑
              location.reload();
            }
          }).then(() => {
             updateBtnState(true);
          }).catch(err => {
             alert("无法在当前页面开启自动刷新（可能是不受支持的系统页面）\n" + err.message);
          });
        } else {
          updateBtnState(true);
        }
      });
    }
  });
});

// 停止刷新
stopBtn.addEventListener("click", () => {
  chrome.storage.local.get(["refreshScope"], (res) => {
    const scope = res.refreshScope || 'current';
    if (scope === 'all') {
      chrome.storage.local.set({ enabled: false }, () => updateBtnState(false));
    } else if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'stop_current' }, (response) => {
        if (chrome.runtime.lastError) {
          // 如果通信失败，尝试直接执行脚本移除状态
          chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: () => {
              sessionStorage.removeItem('autoRefreshEnabled');
            }
          }).catch(() => {});
        }
        updateBtnState(false);
      });
    }
  });
});

// 设置时间间隔和范围
setIntervalBtn.addEventListener("click", () => {
  const seconds = Number(intervalInput.value);
  const scope = scopeSelect ? scopeSelect.value : 'current';

  const ms = normalizeIntervalMs(seconds);

  if (ms !== null) { // 支持小数，比如 0.5 秒
    chrome.storage.local.set({ interval: ms, refreshScope: scope }, () => {
      if (intervalInput) intervalInput.value = String(ms / 1000);

      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: 'settings_updated', interval: ms }).catch(() => {});
      }

      syncRefreshButtonState();
      alert("设置已保存！\n范围: " + (scope === 'current' ? "仅当前标签页" : "所有标签页") + "\n间隔: " + (ms / 1000) + " 秒");
    });
  } else {
    alert("请输入有效的秒数（至少 0.1）");
  }
});

if (saveSiteRuleBtn) {
  saveSiteRuleBtn.addEventListener("click", () => {
    if (!currentHostname) {
      alert("当前页面没有可保存的站点规则");
      return;
    }

    const ms = normalizeIntervalMs(siteRuleIntervalInput.value);
    if (ms === null) {
      alert("请输入有效的站点规则秒数（至少 0.1）");
      return;
    }

    chrome.storage.local.get(["siteRules"], (res) => {
      const rules = getRulesObject(res.siteRules);
      rules[currentHostname] = ms;
      chrome.storage.local.set({ siteRules: rules, interval: ms, refreshScope: "current" }, () => {
        if (intervalInput) intervalInput.value = String(ms / 1000);
        renderSiteRules(rules);
        if (currentTabId) {
          chrome.tabs.sendMessage(currentTabId, { action: "settings_updated", interval: ms }).catch(() => {});
        }
        alert(`已为 ${currentHostname} 保存规则：${ms / 1000} 秒`);
      });
    });
  });
}

if (removeSiteRuleBtn) {
  removeSiteRuleBtn.addEventListener("click", () => {
    if (!currentHostname) {
      alert("当前页面没有可删除的站点规则");
      return;
    }

    chrome.storage.local.get(["siteRules"], (res) => {
      const rules = getRulesObject(res.siteRules);
      if (!rules[currentHostname]) {
        alert("当前站点还没有保存规则");
        return;
      }

      delete rules[currentHostname];
      chrome.storage.local.set({ siteRules: rules }, () => {
        if (siteRuleIntervalInput) siteRuleIntervalInput.value = "";
        renderSiteRules(rules);
        alert(`已删除 ${currentHostname} 的站点规则`);
      });
    });
  });
}

if (enableWebDarkModeBtn) {
  enableWebDarkModeBtn.addEventListener("click", () => {
    chrome.storage.local.set({ webDarkMode: true }, () => {
      updateWebDarkModeBtnState(true);
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: 'apply_web_dark_mode', enable: true }).catch(() => {
          // 如果没注入，尝试直接执行脚本
          chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: () => {
              if (!document.getElementById('auto-refresh-web-dark-mode')) {
                  const style = document.createElement('style');
                  style.id = 'auto-refresh-web-dark-mode';
                  style.textContent = `
                      html { filter: invert(100%) hue-rotate(180deg) !important; background: #fff !important; }
                      img, video, iframe, canvas, svg, .exclude-dark-mode { filter: invert(100%) hue-rotate(180deg) !important; }
                  `;
                  document.head.appendChild(style);
              }
            }
          }).catch(err => {
             alert("无法在此页面应用护眼模式（可能是浏览器系统页面，如 chrome://）");
          });
        });
      }
    });
  });
}

if (disableWebDarkModeBtn) {
  disableWebDarkModeBtn.addEventListener("click", () => {
    chrome.storage.local.set({ webDarkMode: false }, () => {
      updateWebDarkModeBtnState(false);
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: 'apply_web_dark_mode', enable: false }).catch(() => {
          chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: () => {
              const style = document.getElementById('auto-refresh-web-dark-mode');
              if (style) style.remove();
            }
          }).catch(() => {});
        });
      }
    });
  });
}

// 底部按钮链接
homepageBtn.addEventListener("click", () => {
  window.open("https://github.com/jerryjerry27/refresh-", "_blank");
});
authorBtn.addEventListener("click", () => {
  window.open("https://refresh.jerry27.top/", "_blank");
});
