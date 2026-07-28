/**
 * features/app-nav.js - 主界面滑动导航
 *
 * 三个"屏幕"：0=聊天主页（完全不动，原样）、1=互动页、2=工具页
 * 聊天主页往左滑 → 互动页；互动页再往左滑 → 工具页；反方向滑动返回。
 * 顶部图标栏（社交/群聊/回复库/主题/夜间/设置）只在聊天主页显示。
 *
 * 实现方式：不改动现有聊天页面的任何 DOM 结构（风险最低），而是把
 * "互动页"、"工具页"做成两个 position:fixed 的全屏图层，用横向位移
 * （translateX）模拟三屏横滑效果，聊天页本身留在原地当"第0屏"。
 */

(function () {
    'use strict';

    const PAGE_COUNT = 3;
    let currentPage = 0; // 0=聊天 1=互动 2=工具
    let startX = 0, startY = 0, dragging = false, dragDeltaX = 0;
    let lockedDirection = null; // 'h' 横向滑动 | 'v' 竖向滑动（竖向就不接管，让聊天正常滚动）

    const social = () => document.getElementById('app-page-social');
    const tools = () => document.getElementById('app-page-tools');
    const headerActions = () => document.querySelector('.header-actions');
    const swipeRoot = () => document.getElementById('app-swipe-root');

    function applyPageState(withTransition) {
        const s = social(), t = tools(), root = swipeRoot();
        if (!s || !t || !root) return;

        root.style.transition = withTransition ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';

        // root 宽度是 300vw（占位屏 + 互动页 + 工具页各100vw），用 vw 做位移，
        // 不用百分比，省得跟"元素自身宽度"的百分比换算搞混
        root.style.transform = `translateX(${-currentPage * 100}vw)`;

        s.classList.toggle('current', currentPage === 1);
        t.classList.toggle('current', currentPage === 2);
        // 在聊天主页时，让这个浮层完全不拦截触摸/点击（聊天该怎么用还怎么用）
        root.style.pointerEvents = currentPage === 0 ? 'none' : 'auto';

        const ha = headerActions();
        if (ha) ha.style.display = currentPage === 0 ? '' : 'none';

        document.querySelectorAll('.app-dot').forEach(dot => {
            dot.classList.toggle('active', parseInt(dot.dataset.page) === currentPage);
        });
    }

    function goToPage(idx) {
        currentPage = Math.max(0, Math.min(PAGE_COUNT - 1, idx));
        applyPageState(true);
    }
    window.appNavGoTo = goToPage;

    // ─── 触摸滑动 ──────────────────────────────
    function onTouchStart(e) {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        dragging = true;
        lockedDirection = null;
        dragDeltaX = 0;
    }

    function onTouchMove(e) {
        if (!dragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (!lockedDirection) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            lockedDirection = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        }
        if (lockedDirection !== 'h') return; // 竖向滑动交给页面自己滚动，不拦截

        // 边界限制：聊天页(0)没有上一页，工具页(2)没有下一页
        if (currentPage === 0 && dx > 0) { dragDeltaX = 0; return; } // 聊天页不能再往右滑
        if (currentPage === 2 && dx < 0) { dragDeltaX = 0; return; } // 工具页不能再往左滑

        e.preventDefault();
        dragDeltaX = dx;
        const root = swipeRoot();
        if (!root) return;
        const baseVw = -currentPage * 100;
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
        // 监听整个 body：聊天主页(0屏)也要能感应"向左滑"手势才能进入互动页
        document.body.addEventListener('touchstart', onTouchStart, { passive: true });
        document.body.addEventListener('touchmove', onTouchMove, { passive: false });
        document.body.addEventListener('touchend', onTouchEnd, { passive: true });

        // 桌面端鼠标拖拽兜底（方便电脑上测试）
        let mouseDown = false;
        document.body.addEventListener('mousedown', (e) => {
            mouseDown = true; startX = e.clientX; startY = e.clientY; dragging = true; lockedDirection = null; dragDeltaX = 0;
        });
        document.body.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            onTouchMove({ touches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => {} });
        });
        document.body.addEventListener('mouseup', () => { if (mouseDown) { mouseDown = false; onTouchEnd(); } });

        document.querySelectorAll('.app-dot').forEach(dot => {
            dot.addEventListener('click', () => goToPage(parseInt(dot.dataset.page)));
        });

        applyPageState(false);
    }

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(initSwipe, 300);
    });
})();
