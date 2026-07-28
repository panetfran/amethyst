/**
 * features/app-badges.js - 主界面滑动页图标角标（未读数字提示）
 *
 * 用法（其他功能文件里调用）：
 *   window.appBadges.set('moments-function', 3)   // 显示数字3
 *   window.appBadges.set('envelope-function', 0)  // 0 或负数会自动隐藏角标
 *
 * 颜色跟随主题色（var(--accent-color)），不用额外维护"蓝色"这一套。
 */

(function () {
    'use strict';

    const counts = {}; // { 'moments-function': 3, ... }

    function ensureBadgeEl(tileId) {
        const tile = document.getElementById(tileId);
        if (!tile) return null;
        let badge = tile.querySelector('.app-tile-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'app-tile-badge';
            // 角标要挂在图标上（第一个 <i>），不是挂在整个方块上，位置才对
            const icon = tile.querySelector('i');
            if (icon) {
                icon.style.position = 'relative';
                icon.appendChild(badge);
            } else {
                tile.appendChild(badge);
            }
        }
        return badge;
    }

    function render(tileId) {
        const badge = ensureBadgeEl(tileId);
        if (!badge) return;
        const n = counts[tileId] || 0;
        if (n <= 0) {
            badge.style.display = 'none';
            badge.textContent = '';
        } else {
            badge.style.display = 'flex';
            badge.textContent = n > 99 ? '99+' : String(n);
        }
    }

    window.appBadges = {
        set(tileId, count) {
            counts[tileId] = Math.max(0, count | 0);
            render(tileId);
        },
        get(tileId) {
            return counts[tileId] || 0;
        },
        clear(tileId) {
            this.set(tileId, 0);
        },
        refreshAll() {
            Object.keys(counts).forEach(render);
        }
    };

    // 页面加载完就位后，把已经 set 过（可能在DOM还没ready时调用过）的角标补画一遍
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(() => window.appBadges.refreshAll(), 500);
    });
})();
