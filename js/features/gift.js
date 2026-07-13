/**
 * features/gift.js - 礼物盲盒功能
 *
 * 依赖（均已存在于你现有代码中，无需修改）：
 *   getStorageKey, safeGetItem, safeSetItem, getRandomItem,
 *   addMessage, showNotification, settings, messages,
 *   renderMessages, throttledSaveData, SESSION_ID
 *
 * 需要你额外做的两件事（因为渲染逻辑写死在 core.js 里，无法从外部模块 hook）：
 *   1. 在 core.js 的 renderMessages() 里加一个 msg.type === 'gift' 分支（见下方说明）
 *   2. 在 HTML 里插入 #gift-modal 弹窗结构 + 引入 gift.css（见下方说明）
 */

(function() {
    'use strict';

    // ---------- 礼物图片库：把你自己的图片链接放这里 ----------
    const GIFT_IMAGES = [
        'https://i.postimg.cc/66jdgMH7/image-1779352458274.png',
        'https://i.postimg.cc/HnhXMLJy/image-1779352462383.png',
        'https://i.postimg.cc/T1wnhb3B/image-1779352474092.png'
        // ...按需继续添加
    ];

    // ---------- 随礼物附带的文案库 ----------
    const GIFT_TEXTS = [
        '你是我新鲜又永恒的春天，是唯一贯穿我所有诗篇的韵脚。',
        '我毎天都感谢命运让我遇到你。',
        '想给你打电话，告诉你天气晴朗，告诉你我爱你。'
        // ...按需继续添加
    ];

    const MAX_DAILY_GIFTS = 3;                    // 每天最多几个礼物
    const GIFT_MIN_INTERVAL = 30 * 60 * 1000;      // 两个礼物之间最小间隔
    const GIFT_MAX_INTERVAL = 120 * 60 * 1000;     // 最大间隔

    let giftTimer = null;

    // ---------- 每日计数（走 localforage 的 key 体系，跟随会话隔离） ----------
    function getTodayGiftCount() {
        const today = new Date().toDateString();
        const stored = safeGetItem(getStorageKey('giftDailyCount'));
        if (stored) {
            try {
                const data = JSON.parse(stored);
                if (data.date === today) return data.count;
            } catch (e) {}
        }
        return 0;
    }

    function incrementGiftCount() {
        const today = new Date().toDateString();
        const count = getTodayGiftCount() + 1;
        safeSetItem(getStorageKey('giftDailyCount'), JSON.stringify({ date: today, count: count }));
    }

    function canSendGiftToday() {
        return getTodayGiftCount() < MAX_DAILY_GIFTS;
    }

    function resetGiftCountToday() {
        safeSetItem(getStorageKey('giftDailyCount'), JSON.stringify({ date: new Date().toDateString(), count: 0 }));
    }
    window.resetGiftCountToday = resetGiftCountToday;

    // ---------- 发送一个随机礼物 ----------
    function sendRandomGift() {
        if (!canSendGiftToday()) {
            showNotification('今日礼物已送完，明天再来看看吧～', 'info', 3000);
            return;
        }
        const randomImage = getRandomItem(GIFT_IMAGES);
        const randomText = getRandomItem(GIFT_TEXTS);
        if (!randomImage || !randomText) {
            console.warn('[礼物] 图片库或文案库为空');
            return;
        }

        addMessage({
            id: Date.now() + Math.random(),
            type: 'gift',
            image: randomImage,
            text: randomText,
            opened: false,
            timestamp: new Date(),
            sender: settings.partnerName || '对方'
        });

        incrementGiftCount();
        showNotification('💝 收到一份神秘礼物！快去看看吧~', 'success', 3000);
    }
    window.sendRandomGift = sendRandomGift;

    // ---------- 点击礼物卡片 ----------
    function handleGiftCardClick(messageId) {
        const msg = messages.find(m => String(m.id) === String(messageId) && m.type === 'gift');
        if (!msg) return;

        openGiftModal(msg.image, msg.text);

        if (!msg.opened) {
            msg.opened = true;
            throttledSaveData();
            renderMessages(true);
        }
    }
    window.handleGiftCardClick = handleGiftCardClick;

    function openGiftModal(imageUrl, text) {
        const modal = document.getElementById('gift-modal');
        if (!modal) return;
        const imgEl = modal.querySelector('.gift-modal-image');
        const textEl = modal.querySelector('.gift-modal-text');
        if (imgEl) imgEl.src = imageUrl;
        if (textEl) textEl.textContent = text;
        modal.style.display = 'flex';
    }

    function closeGiftModal(event) {
        const modal = document.getElementById('gift-modal');
        if (!modal) return;
        if (!event || event.target === modal || (event.target.closest && event.target.closest('.gift-close-btn'))) {
            modal.style.display = 'none';
        }
    }
    window.closeGiftModal = closeGiftModal;

    // ---------- 自动发送定时器 ----------
    function initGiftFeature() {
        const firstDelay = 10 * 60 * 1000 + Math.random() * 30 * 60 * 1000;
        setTimeout(function() {
            if (canSendGiftToday()) sendRandomGift();
            (function scheduleNext() {
                if (giftTimer) clearTimeout(giftTimer);
                const interval = GIFT_MIN_INTERVAL + Math.random() * (GIFT_MAX_INTERVAL - GIFT_MIN_INTERVAL);
                giftTimer = setTimeout(function() {
                    if (canSendGiftToday()) sendRandomGift();
                    scheduleNext();
                }, interval);
            })();
        }, firstDelay);
    }

    // ---------- 数据管理面板：重置计数 / 立即发送 ----------
    function initGiftManagement() {
        const resetBtn = document.getElementById('reset-gift-count-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (confirm('确定要重置今日礼物计数吗？\n\n重置后，今日可以继续收到新的随机礼物。')) {
                    resetGiftCountToday();
                    showNotification('✅ 今日礼物计数已重置', 'success', 3000);
                }
            });
        }
        const forceBtn = document.getElementById('force-send-gift-btn');
        if (forceBtn) {
            forceBtn.addEventListener('click', function() {
                if (confirm('确定要立即发送一份礼物吗？')) {
                    // 管理面板强制发送不受每日上限约束
                    const randomImage = getRandomItem(GIFT_IMAGES);
                    const randomText = getRandomItem(GIFT_TEXTS);
                    if (!randomImage || !randomText) return;
                    addMessage({
                        id: Date.now() + Math.random(),
                        type: 'gift',
                        image: randomImage,
                        text: randomText,
                        opened: false,
                        timestamp: new Date(),
                        sender: settings.partnerName || '对方'
                    });
                    showNotification('💝 礼物已送出，快去聊天区看看吧~', 'success', 3000);
                }
            });
        }
    }

    // getStorageKey 依赖 SESSION_ID，必须等会话初始化完成后再启动
    document.addEventListener('DOMContentLoaded', function() {
        initGiftManagement();
        const waitReady = setInterval(function() {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                initGiftFeature();
            }
        }, 300);
    });
})();
