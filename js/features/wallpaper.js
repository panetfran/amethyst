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

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    async function loadData() {
        try {
            const saved = await localforage.getItem(getStorageKey('wallpaperImages'));
            images = Array.isArray(saved) ? saved : [];
        } catch (e) { images = []; }
        try {
            const pick = await localforage.getItem(getStorageKey('wallpaperDailyPick'));
            dailyPick = pick || null;
        } catch (e) { dailyPick = null; }
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
            clockWrap.style.display = 'none';
            document.getElementById('wallpaper-manage-btn')?.classList.add('on-image');
        } else {
            bgLayer.style.backgroundImage = '';
            bgLayer.classList.remove('has-image');
            clockWrap.style.display = 'flex';
            document.getElementById('wallpaper-manage-btn')?.classList.remove('on-image');
            updateClock();
        }
    }

    function updateClock() {
        const timeEl = document.getElementById('wallpaper-time');
        const dateEl = document.getElementById('wallpaper-date');
        if (!timeEl || !dateEl) return;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        timeEl.textContent = `${hh}:${mm}`;
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        dateEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
    }

    function startClockTicker() {
        if (clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(() => {
            if (!dailyPick || !dailyPick.url) updateClock();
        }, 15000); // 没图片时每15秒刷新一次时钟就够了，不用逐秒
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
        overlay.classList.add('active');
    };
    window.wallpaperCloseManager = function () {
        document.getElementById('wallpaper-mgr-overlay')?.classList.remove('active');
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
        document.getElementById('wallpaper-mgr-overlay')?.addEventListener('click', function (e) {
            if (e.target === this) window.wallpaperCloseManager();
        });
        startClockTicker();
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
