/**
 * features/app-nav.js - 主界面滑动导航（四屏）
 *
 * 页面顺序：-1=壁纸页 ← 0=聊天主页（不动，原样）→ 1=互动页 → 2=工具页
 * 聊天页往左滑进互动/工具；聊天页往右滑进壁纸页。
 * 顶部图标栏（社交/群聊/回复库/主题/夜间/设置）只在聊天主页显示。
 * 通话进行中（body.immersive-mode）禁用划动，避免壁纸页把通话画面盖住。
 *
 * 实现方式：不改动现有聊天页面的任何 DOM 结构，互动页/工具页/壁纸页都是
 * position:fixed 的全屏图层，用横向位移（translateX）模拟横滑效果。
 */

(function () {
    'use strict';

    const MIN_PAGE = -1; // 壁纸页
    const MAX_PAGE = 2;  // 工具页
    let currentPage = 0; // -1=壁纸 0=聊天 1=互动 2=工具
    let startX = 0, startY = 0, dragging = false, dragDeltaX = 0;
    let lockedDirection = null; // 'h' 横向滑动 | 'v' 竖向滑动（竖向就不接管，让聊天正常滚动）

    const wallpaper = () => document.getElementById('app-page-wallpaper');
    const social = () => document.getElementById('app-page-social');
    const tools = () => document.getElementById('app-page-tools');
    const headerActions = () => document.querySelector('.header-actions');
    const swipeRoot = () => document.getElementById('app-swipe-root');

    // page(-1~2) 换算成 root 里的槽位（0~3），root 总宽 400vw
    function slotOf(page) { return page - MIN_PAGE; }

    function isCallActive() {
        return document.body.classList.contains('immersive-mode');
    }

    // 有些功能是自己的全屏图层，本身就有精细的点击/拖动交互（比如地图要能点小图标进子地图、
    // 拖动平移）——这时候这套左右划页面的手势监听必须完全让路，不然两边抢同一次触摸，
    // 地图自己的点击经常会被吞掉。这里列出这些全屏图层，只要有一个正显示着，就不拦截手势。
    function isFullscreenFeatureOpen() {
        var ids = ['map-app-overlay', 'companion-page', 'sq-fill-overlay'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (!el) continue;
            var style = window.getComputedStyle(el);
            if (style.display !== 'none' && el.classList.contains('active')) return true;
            if (style.display === 'flex' || style.display === 'block') {
                // map-app-overlay 是用 style.display 直接切换的，不靠 class
                if (ids[i] === 'map-app-overlay') return true;
            }
        }
        return false;
    }

    function shouldBlockNav() {
        return isCallActive() || isFullscreenFeatureOpen();
    }

    function applyPageState(withTransition) {
        const root = swipeRoot();
        const w = wallpaper(), s = social(), t = tools();
        if (!root) return;

        root.style.transition = withTransition ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';
        root.style.transform = `translateX(${-slotOf(currentPage) * 100}vw)`;

        if (w) w.classList.toggle('current', currentPage === -1);
        if (s) s.classList.toggle('current', currentPage === 1);
        if (t) t.classList.toggle('current', currentPage === 2);

        // 在聊天主页时，让这个浮层完全不拦截触摸/点击（聊天该怎么用还怎么用）
        root.style.pointerEvents = currentPage === 0 ? 'none' : 'auto';

        const ha = headerActions();
        if (ha) ha.style.display = currentPage === 0 ? '' : 'none';

        document.querySelectorAll('.app-dot').forEach(dot => {
            dot.classList.toggle('active', parseInt(dot.dataset.page, 10) === currentPage);
        });

        if (currentPage === -1 && typeof window.wallpaperOnShow === 'function') {
            window.wallpaperOnShow();
        }
    }

    function goToPage(idx) {
        if (shouldBlockNav()) return; // 通话中或地图等全屏功能开着时不许划走
        currentPage = Math.max(MIN_PAGE, Math.min(MAX_PAGE, idx));
        applyPageState(true);
    }
    window.appNavGoTo = goToPage;

    // ─── 触摸滑动 ──────────────────────────────
    function onTouchStart(e) {
        if (shouldBlockNav()) return;
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        dragging = true;
        lockedDirection = null;
        dragDeltaX = 0;
    }

    function onTouchMove(e) {
        if (!dragging || shouldBlockNav()) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (!lockedDirection) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            lockedDirection = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        }
        if (lockedDirection !== 'h') return; // 竖向滑动交给页面自己滚动，不拦截

        // 边界限制：壁纸页(-1)没有上一页，工具页(2)没有下一页
        if (currentPage === MIN_PAGE && dx > 0) { dragDeltaX = 0; return; }
        if (currentPage === MAX_PAGE && dx < 0) { dragDeltaX = 0; return; }

        e.preventDefault();
        dragDeltaX = dx;
        const root = swipeRoot();
        if (!root) return;
        const baseVw = -slotOf(currentPage) * 100;
        const dragVw = (dragDeltaX / window.innerWidth) * 100;
        root.style.transition = 'none';
        root.style.transform = `translateX(${baseVw + dragVw}vw)`;
        root.style.pointerEvents = 'auto';
    }

    function onTouchEnd() {
        if (!dragging) return;
        dragging = false;
        if (lockedDirection !== 'h') { applyPageState(false); return; }

        const threshold = window.innerWidth * 0.18;
        if (dragDeltaX < -threshold) {
            goToPage(currentPage + 1);
        } else if (dragDeltaX > threshold) {
            goToPage(currentPage - 1);
        } else {
            applyPageState(true);
        }
        lockedDirection = null;
        dragDeltaX = 0;
    }

    function initSwipe() {
        // 监听整个 body：聊天主页也要能感应左右滑手势才能进入相邻页
        document.body.addEventListener('touchstart', onTouchStart, { passive: true });
        document.body.addEventListener('touchmove', onTouchMove, { passive: false });
        document.body.addEventListener('touchend', onTouchEnd, { passive: true });

        // 桌面端鼠标拖拽兜底（方便电脑上测试）
        let mouseDown = false;
        document.body.addEventListener('mousedown', (e) => {
            if (shouldBlockNav()) return;
            mouseDown = true; startX = e.clientX; startY = e.clientY; dragging = true; lockedDirection = null; dragDeltaX = 0;
        });
        document.body.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            onTouchMove({ touches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => {} });
        });
        document.body.addEventListener('mouseup', () => { if (mouseDown) { mouseDown = false; onTouchEnd(); } });

        document.querySelectorAll('.app-dot').forEach(dot => {
            dot.addEventListener('click', () => goToPage(parseInt(dot.dataset.page, 10)));
        });

        applyPageState(false);
    }

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(initSwipe, 300);
    });
})();
