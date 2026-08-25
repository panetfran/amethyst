/**
 * features/wallpaper.js - 壁纸页（左划出来的那一屏）
 *
 * 没上传图片：白屏 + 当前时间/日期（像手机锁屏）
 * 上传了图片：梦角每天随机选一张放着，同一天内不会换，第二天才会重新抽
 *
 * 依赖：getStorageKey, localforage, showNotification, SESSION_ID
 */

(function () {
    'use strict';

    let images = [];          // [{id, url}]
    let dailyPick = null;     // { date: 'YYYY-MM-DD', url: '...' }
    let clockTimer = null;
    let extras = null;        // { dailyQuote, myWeather, taWeather, taOffset }
    let taRerollTimer = null;
    let linkStatusTimer = null;

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings && settings.partnerName) ? settings.partnerName : '梦角';
    }

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    // ==================== 天气池子 ====================
    const MY_WEATHER = [
        { type: 'sunny', icon: 'fa-sun', label: '晴' },
        { type: 'partly', icon: 'fa-cloud-sun', label: '多云' },
        { type: 'cloudy', icon: 'fa-cloud', label: '阴' },
        { type: 'rain', icon: 'fa-cloud-rain', label: '小雨' },
        { type: 'storm', icon: 'fa-cloud-bolt', label: '雷雨' },
        { type: 'snow', icon: 'fa-snowflake', label: '雪' },
        { type: 'fog', icon: 'fa-smog', label: '雾' }
    ];
    const TA_WEATHER = MY_WEATHER.concat([
        { type: 'meteor', icon: 'fa-meteor', label: '陨石雨' },
        { type: 'aurora', icon: 'fa-wand-magic-sparkles', label: '极光闪烁' },
        { type: 'nebula', icon: 'fa-atom', label: '星云缭绕' },
        { type: 'vacuum', icon: 'fa-circle-notch', label: '静谧真空' },
        { type: 'stardust', icon: 'fa-star', label: '星尘飘落' }
    ]);

    // ==================== 连接状态 ====================
    const LINK_STATUS_LIST = [
        { text: '共鸣中', level: 5 },
        { text: '链接稳定', level: 4 },
        { text: '心意相通', level: 5 },
        { text: '梦境相连', level: 5 },
        { text: '心跳同频', level: 4 },
        { text: '能量交汇', level: 4 },
        { text: '正在连接...', level: 3 },
        { text: '努力靠近中', level: 3 },
        { text: '信号微弱', level: 1 },
        { text: '频率校准中', level: 3 },
        { text: '断断续续', level: 2 },
        { text: '正在搜寻...', level: 2 },
        { text: '若有若无', level: 1 },
        { text: '努力中...', level: 2 }
    ];


    async function loadData() {
        try {
            const saved = await localforage.getItem(getStorageKey('wallpaperImages'));
            images = Array.isArray(saved) ? saved : [];
        } catch (e) { images = []; }
        try {
            const savedPick = await localforage.getItem(getStorageKey('wallpaperDailyPick'));
            dailyPick = savedPick || null;
        } catch (e) { dailyPick = null; }
        try {
            const savedExtras = await localforage.getItem(getStorageKey('wallpaperExtras'));
            extras = savedExtras || {};
        } catch (e) { extras = {}; }
    }

    function saveExtras() {
        localforage.setItem(getStorageKey('wallpaperExtras'), extras).catch(() => {});
    }

    function saveImages() {
        localforage.setItem(getStorageKey('wallpaperImages'), images).catch(() => {});
    }
    function saveDailyPick() {
        localforage.setItem(getStorageKey('wallpaperDailyPick'), dailyPick).catch(() => {});
    }

    function ensureTodayPick() {
        const today = todayStr();
        if (images.length === 0) { dailyPick = null; return; }
        if (dailyPick && dailyPick.date === today && images.some(img => img.url === dailyPick.url)) {
            return; // 今天已经选过，且那张图还在，不用重选
        }
        const chosen = images[Math.floor(Math.random() * images.length)];
        dailyPick = { date: today, url: chosen.url };
        saveDailyPick();
    }

    // ─── 渲染壁纸页 ──────────────────────────
    function renderWallpaper() {
        const bgLayer = document.getElementById('wallpaper-bg');
        const clockWrap = document.getElementById('wallpaper-clock-wrap');
        if (!bgLayer || !clockWrap) return;

        ensureTodayPick();

        if (dailyPick && dailyPick.url) {
            bgLayer.style.backgroundImage = `url("${dailyPick.url}")`;
            bgLayer.classList.add('has-image');
            document.getElementById('wallpaper-manage-btn')?.classList.add('on-image');
        } else {
            bgLayer.style.backgroundImage = '';
            bgLayer.classList.remove('has-image');
            document.getElementById('wallpaper-manage-btn')?.classList.remove('on-image');
        }
        clockWrap.style.display = 'flex';
        updateClock();
        ensureDailyQuote();
        ensureMyWeather();
        ensureTaWeatherAndOffset();
        ensureLinkStatus();
        renderQuoteAndWeather();
        renderLinkStatus();
    }

    // ==================== 每日一言（每天固定一条，第二天换新）====================
    function ensureDailyQuote() {
        const today = todayStr();
        if (extras.dailyQuote && extras.dailyQuote.date === today) return;
        const pool = (typeof customReplies !== 'undefined' && customReplies.length > 0) ? customReplies : ['今天也是平静的一天。'];
        extras.dailyQuote = { date: today, text: pick(pool) };
        saveExtras();
    }

    // ==================== 我的天气（每天固定一个，第二天换新）====================
    function ensureMyWeather() {
        const today = todayStr();
        if (extras.myWeather && extras.myWeather.date === today) return;
        extras.myWeather = { date: today, type: pick(MY_WEATHER).type };
        saveExtras();
    }

    // ==================== 梦角的天气 + 时差（后台每隔几小时自动重新抽）====================
    function ensureTaWeatherAndOffset() {
        const now = Date.now();
        const REROLL_MS = (4 + Math.random() * 4) * 60 * 60 * 1000; // 4~8小时重新抽一次
        if (!extras.taWeather || (now - (extras.taWeather.changedAt || 0)) > REROLL_MS) {
            extras.taWeather = { type: pick(TA_WEATHER).type, changedAt: now };
        }
        if (!extras.taOffset || (now - (extras.taOffset.changedAt || 0)) > REROLL_MS) {
            // 时差故意不用整数小时，营造"不是地球标准时区"的感觉
            const hours = Math.round((Math.random() * 24 - 12) * 2) / 2; // -12 ~ +12，步进0.5小时
            extras.taOffset = { hours: hours, changedAt: now };
        }
        saveExtras();
    }

    function ensureLinkStatus(force) {
        const now = Date.now();
        const STALE_MS = 2.5 * 60 * 60 * 1000 + (Math.random() - 0.5) * 30 * 60 * 1000; // 2.5小时±15分钟
        if (force || !extras.linkStatus || (now - (extras.linkStatus.changedAt || 0)) > STALE_MS) {
            let idx;
            const prevIdx = extras.linkStatus ? extras.linkStatus.idx : -1;
            do { idx = Math.floor(Math.random() * LINK_STATUS_LIST.length); }
            while (idx === prevIdx && LINK_STATUS_LIST.length > 1);
            extras.linkStatus = { idx: idx, changedAt: now };
            saveExtras();
        }
    }

    // 给其它功能（比如心愿满足）调用的钩子：直接把连接状态提到一个满级的文案上，
    // 不用等后台自然重抽。没有加载好（extras还没初始化）就静默跳过，不影响调用方。
    window.wallpaperBoostLinkStatus = function () {
        if (!extras) return;
        const topIndices = LINK_STATUS_LIST.reduce((arr, item, i) => { if (item.level === 5) arr.push(i); return arr; }, []);
        if (!topIndices.length) return;
        extras.linkStatus = { idx: topIndices[Math.floor(Math.random() * topIndices.length)], changedAt: Date.now() };
        saveExtras();
        renderLinkStatus();
    };

    function scheduleLinkStatusReroll() {
        if (linkStatusTimer) clearTimeout(linkStatusTimer);
        const base = 2.5 * 60 * 60 * 1000;
        const jitter = (Math.random() - 0.5) * 30 * 60 * 1000;
        linkStatusTimer = setTimeout(() => {
            if (extras) {
                ensureLinkStatus(true);
                renderLinkStatus();
            }
            scheduleLinkStatusReroll();
        }, base + jitter);
    }

    function renderLinkStatus() {
        if (!extras.linkStatus) return;
        const item = LINK_STATUS_LIST[extras.linkStatus.idx];
        if (!item) return;
        const textEl = document.getElementById('wp-link-text');
        if (textEl) textEl.textContent = item.text;
        const hearts = document.querySelectorAll('#wp-link-hearts .wp-heart');
        hearts.forEach((h, i) => {
            h.classList.toggle('active', i < item.level);
            h.classList.toggle('pulse', i < item.level && item.level <= 2);
        });
    }

    function scheduleTaReroll() {
        if (taRerollTimer) clearTimeout(taRerollTimer);
        taRerollTimer = setTimeout(() => {
            if (extras) {
                ensureTaWeatherAndOffset();
                renderQuoteAndWeather();
                updateClock();
            }
            scheduleTaReroll();
        }, 20 * 60 * 1000); // 每20分钟检查一次是不是到了该重新抽的时间
    }

    function findWeather(pool, type) {
        return pool.find(w => w.type === type) || pool[0];
    }

    function renderQuoteAndWeather() {
        const quoteEl = document.getElementById('wallpaper-quote');
        if (quoteEl && extras.dailyQuote) quoteEl.textContent = extras.dailyQuote.text;

        const myW = findWeather(MY_WEATHER, extras.myWeather && extras.myWeather.type);
        const taW = findWeather(TA_WEATHER, extras.taWeather && extras.taWeather.type);

        const myIconEl = document.getElementById('wp-my-weather-icon');
        const myLabelEl = document.getElementById('wp-my-weather-label');
        if (myIconEl && myW) myIconEl.className = 'fas ' + myW.icon;
        if (myLabelEl && myW) myLabelEl.textContent = myW.label;

        const taIconEl = document.getElementById('wp-ta-weather-icon');
        const taLabelEl = document.getElementById('wp-ta-weather-label');
        if (taIconEl && taW) taIconEl.className = 'fas ' + taW.icon;
        if (taLabelEl && taW) taLabelEl.textContent = taW.label;

        const taNameEls = document.querySelectorAll('.wp-ta-name');
        taNameEls.forEach(el => { el.textContent = getPartnerName(); });
    }

    function updateClock() {
        const timeEl = document.getElementById('wallpaper-time');
        const dateEl = document.getElementById('wallpaper-date');
        if (timeEl && dateEl) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            timeEl.textContent = `${hh}:${mm}`;
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            dateEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
        }

        // 我的时间（小卡片里的那份，跟设备真实时间一致）
        const myTimeEl = document.getElementById('wp-my-time');
        if (myTimeEl) {
            const now = new Date();
            myTimeEl.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        }

        // 梦角的时间（用时差换算出来的，不是真实时区）
        const taTimeEl = document.getElementById('wp-ta-time');
        if (taTimeEl && extras && extras.taOffset) {
            const taDate = new Date(Date.now() + extras.taOffset.hours * 60 * 60 * 1000);
            taTimeEl.textContent = String(taDate.getUTCHours()).padStart(2, '0') + ':' + String(taDate.getUTCMinutes()).padStart(2, '0');
        }
    }

    function startClockTicker() {
        if (clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(updateClock, 15000); // 每15秒刷新一次就够了，不用逐秒
    }

    // 供 app-nav.js 在划到壁纸页时调用（顺便处理跨天刷新）
    window.wallpaperOnShow = function () {
        renderWallpaper();
    };

    // ─── 管理面板：上传/删除壁纸图片 ──────────
    function renderManagerList() {
        const list = document.getElementById('wallpaper-mgr-list');
        if (!list) return;
        if (images.length === 0) {
            list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px 0;color:var(--text-secondary);font-size:12px;">还没有壁纸，添加几张吧~</div>`;
            return;
        }
        list.innerHTML = images.map(img => `
            <div class="wallpaper-mgr-item">
                <img src="${img.url}" onerror="this.style.display='none'">
                <button class="wallpaper-mgr-del" onclick="window.wallpaperDeleteImage('${img.id}')"><i class="fas fa-times"></i></button>
            </div>`).join('');
    }

    window.wallpaperOpenManager = function () {
        const overlay = document.getElementById('wallpaper-mgr-overlay');
        if (!overlay) return;
        renderManagerList();
        renderTaEditor();
        overlay.classList.add('active');
    };
    window.wallpaperCloseManager = function () {
        document.getElementById('wallpaper-mgr-overlay')?.classList.remove('active');
    };

    // ==================== 手动编辑梦角的天气 / 时差 ====================
    function renderTaEditor() {
        const weatherSel = document.getElementById('wallpaper-ta-weather-select');
        const offsetInput = document.getElementById('wallpaper-ta-offset-input');
        if (!weatherSel || !offsetInput) return;

        if (!weatherSel.dataset.filled) {
            weatherSel.innerHTML = TA_WEATHER.map(w => `<option value="${w.type}">${w.label}</option>`).join('');
            weatherSel.dataset.filled = '1';
        }
        const curType = extras.taWeather ? extras.taWeather.type : TA_WEATHER[0].type;
        weatherSel.value = curType;
        offsetInput.value = extras.taOffset ? extras.taOffset.hours : 0;
    }

    window.wallpaperSaveTaEdit = function () {
        const weatherSel = document.getElementById('wallpaper-ta-weather-select');
        const offsetInput = document.getElementById('wallpaper-ta-offset-input');
        if (!weatherSel || !offsetInput) return;

        let hours = parseFloat(offsetInput.value);
        if (isNaN(hours)) hours = 0;
        hours = Math.max(-12, Math.min(12, Math.round(hours * 2) / 2)); // 限制在±12小时，0.5小时为步进

        const now = Date.now();
        extras.taWeather = { type: weatherSel.value, changedAt: now };
        extras.taOffset = { hours: hours, changedAt: now };
        saveExtras();
        renderQuoteAndWeather();
        updateClock();
        if (typeof showNotification === 'function') showNotification('已更新' + getPartnerName() + '的天气和时间', 'success');
    };

    window.wallpaperDeleteImage = function (id) {
        if (!confirm('确定删除这张壁纸吗？')) return;
        images = images.filter(img => img.id !== id);
        saveImages();
        if (dailyPick && !images.some(img => img.url === dailyPick.url)) {
            dailyPick = null;
            saveDailyPick();
        }
        renderManagerList();
        renderWallpaper();
        showNotification('已删除', 'success');
    };

    function addImage(url) {
        images.push({ id: 'wp_' + Date.now() + '_' + Math.floor(Math.random() * 10000), url });
        saveImages();
        renderManagerList();
        showNotification('壁纸已添加', 'success');
    }

    window.wallpaperAddViaUpload = function (input) {
        const files = Array.from(input.files || []);
        files.forEach(file => {
            if (file.size > 6 * 1024 * 1024) { showNotification('图片不能超过6MB', 'error'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => addImage(ev.target.result);
            reader.readAsDataURL(file);
        });
        input.value = '';
    };
    window.wallpaperAddViaUrl = function () {
        const url = prompt('请输入图片URL链接：');
        if (url && url.trim()) addImage(url.trim());
    };

    // ─── 初始化 ──────────────────────────────
    function initListeners() {
        document.getElementById('wallpaper-manage-btn')?.addEventListener('click', window.wallpaperOpenManager);
        document.getElementById('wallpaper-mgr-close')?.addEventListener('click', window.wallpaperCloseManager);
        document.getElementById('wallpaper-mgr-upload-btn')?.addEventListener('click', () => {
            document.getElementById('wallpaper-mgr-upload-input')?.click();
        });
        document.getElementById('wallpaper-mgr-upload-input')?.addEventListener('change', function () {
            window.wallpaperAddViaUpload(this);
        });
        document.getElementById('wallpaper-mgr-url-btn')?.addEventListener('click', window.wallpaperAddViaUrl);
        document.getElementById('wallpaper-ta-save-btn')?.addEventListener('click', window.wallpaperSaveTaEdit);
        document.getElementById('wallpaper-mgr-overlay')?.addEventListener('click', function (e) {
            if (e.target === this) window.wallpaperCloseManager();
        });
        startClockTicker();
        scheduleTaReroll();
        scheduleLinkStatusReroll();
    }

    document.addEventListener('DOMContentLoaded', function () {
        const waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                loadData().then(() => {
                    initListeners();
                    renderWallpaper();
                });
            }
        }, 300);
    });
})();
