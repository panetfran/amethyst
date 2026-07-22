/**
 * features/music-invite.js - 对方邀请一起听歌
 *
 * 依赖：
 *   window.musicPlayerAPI（listeners.js 里 initMusicPlayer 暴露的接口：
 *     open() / isEnabled() / getSongCount() / playIndex() / playRandom() / getCurrentSongTitle()）
 *   getStorageKey, safeGetItem, safeSetItem, showNotification, settings,
 *   customReplies, addMessage, SESSION_ID
 *
 * 逻辑：跟陪伴功能的"主动邀请"是同一套思路——后台随机检查，
 * 命中概率就弹一个"要不要一起听歌"的邀请，你可以同意或拒绝。
 * 同意就打开播放器 + 随机播放一首；拒绝就撒娇一下，不勉强你。
 */

(function () {
    'use strict';

    const CHECK_MIN_MS = 20 * 60 * 1000;   // 最短间隔 20 分钟检查一次
    const CHECK_MAX_MS = 50 * 60 * 1000;   // 最长间隔 50 分钟检查一次
    const TRIGGER_CHANCE = 0.2;            // 每次检查 20% 概率真正弹出邀请

    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '对方';
    }

    function notifyInChat(text) {
        if (typeof addMessage === 'function') {
            addMessage({
                id: Date.now() + Math.random(),
                sender: 'system',
                text: text,
                timestamp: new Date(),
                type: 'system'
            });
        }
    }

    function getRandomLine() {
        const pool = (typeof customReplies !== 'undefined' && customReplies.length > 0)
            ? customReplies
            : ['好呀', '嗯嗯', '一起吧'];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function removeOverlay() {
        const el = document.getElementById('music-invite-overlay');
        if (el) el.remove();
    }

    function showInviteOverlay() {
        // 已经有邀请弹窗、或者正在陪伴模式里，就先不打扰了
        if (document.getElementById('music-invite-overlay')) return;
        if (document.getElementById('companion-page')?.classList.contains('active')) return;
        if (document.querySelector('#companion-incoming-overlay, #companion-inviting-overlay')) return;

        const pn = getPartnerName();
        const overlay = document.createElement('div');
        overlay.id = 'music-invite-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99998;
            background: rgba(0,0,0,0.55); backdrop-filter: blur(10px);
            display: flex; align-items: center; justify-content: center;
            animation: musicInviteFadeIn 0.35s ease;
        `;
        overlay.innerHTML = `
            <style>
                @keyframes musicInviteFadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes musicInviteSlideUp {
                    from { opacity:0; transform: translateY(24px) scale(0.94); }
                    to { opacity:1; transform: translateY(0) scale(1); }
                }
                @keyframes musicInviteNotePulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.12); }
                }
            </style>
            <div style="
                background: var(--secondary-bg); border-radius: 26px; padding: 30px 26px 24px;
                width: 86%; max-width: 320px; text-align: center;
                box-shadow: 0 30px 80px rgba(0,0,0,0.45);
                animation: musicInviteSlideUp 0.4s cubic-bezier(0.34,1.5,0.64,1);
            ">
                <div style="
                    width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px;
                    background: rgba(var(--accent-color-rgb), 0.14);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 26px; color: var(--accent-color);
                    animation: musicInviteNotePulse 1.6s ease-in-out infinite;
                "><i class="fas fa-music"></i></div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                    ${escapeInviteHtml(pn)} 想和你一起听首歌
                </div>
                <div style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 22px;">
                    要不要一起打开播放器？
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="music-invite-decline" style="
                        flex: 1; padding: 12px; border-radius: 14px; border: 1px solid var(--border-color);
                        background: var(--primary-bg); color: var(--text-secondary);
                        font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--font-family);
                    ">不了</button>
                    <button id="music-invite-accept" style="
                        flex: 1; padding: 12px; border-radius: 14px; border: none;
                        background: var(--accent-color); color: #fff;
                        font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--font-family);
                        box-shadow: 0 6px 18px rgba(var(--accent-color-rgb), 0.35);
                    ">一起听 🎵</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#music-invite-accept').addEventListener('click', acceptInvite);
        overlay.querySelector('#music-invite-decline').addEventListener('click', declineInvite);
    }

    function escapeInviteHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function acceptInvite() {
        removeOverlay();
        const pn = getPartnerName();

        if (typeof window.musicPlayerAPI === 'undefined') {
            showNotification('音乐播放器还没准备好，稍后再试试~', 'warning', 3000);
            return;
        }

        window.musicPlayerAPI.open();
        const played = window.musicPlayerAPI.getSongCount() > 0 ? window.musicPlayerAPI.playRandom() : false;

        if (played) {
            const title = window.musicPlayerAPI.getCurrentSongTitle();
            showNotification(`🎵 和 ${pn} 一起听《${title || '这首歌'}》`, 'success', 3500);
            notifyInChat(`你和${pn}一起打开了播放器，正在听《${title || '这首歌'}》 ♪`);
        } else {
            showNotification('播放列表是空的，先去加几首歌吧~', 'info', 3500);
            notifyInChat(`你和${pn}一起打开了播放器 ♪`);
        }
    }

    function declineInvite() {
        removeOverlay();
        const pn = getPartnerName();
        showNotification(`${pn}：${getRandomLine()}`, 'info', 3000);
        notifyInChat(`${pn} 想邀你一起听歌，被你婉拒了，${pn}小小地失落了一下 ♪`);
    }

    // ─── 随机检查调度 ──────────────────────
    function scheduleNextCheck() {
        const delay = CHECK_MIN_MS + Math.random() * (CHECK_MAX_MS - CHECK_MIN_MS);
        setTimeout(() => {
            if (Math.random() < TRIGGER_CHANCE) {
                showInviteOverlay();
            }
            scheduleNextCheck();
        }, delay);
    }

    // 供数据管理面板测试按钮 / 控制台调用，跳过随机等待直接弹一次
    window.triggerMusicInviteNow = function () {
        showInviteOverlay();
    };

    document.addEventListener('DOMContentLoaded', function () {
        const waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                setTimeout(scheduleNextCheck, 60 * 1000); // 页面打开1分钟后才开始第一次检查
            }
        }, 300);
    });
})();
