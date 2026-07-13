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
        'https://i.postimg.cc/T1wnhb3B/image-1779352474092.png',
        'https://i.postimg.cc/QtSpXmhq/image-1779352483166.png',
        'https://i.postimg.cc/MTz72N2G/image-1779352492254.png',
        'https://i.postimg.cc/LsttWRWT/image-1779352511217.png',
        'https://i.postimg.cc/tg33cyck/image-1779352580093.png',
        'https://i.postimg.cc/6QJVzTMh/image-1779352583517.png',
        'https://i.postimg.cc/TPMjQhtV/image-1779352893855.png',
        'https://i.postimg.cc/6QJVzTMC/image-1779352897628.png',
        'https://i.postimg.cc/jj06vCMz/image-1779352914437.png',
        'https://i.postimg.cc/W4LmSt5F/image-1779352918642.png',
        'https://i.postimg.cc/hGW8Mh2X/image-1779352927165.png',
        'https://i.postimg.cc/xdDGgq6d/image-1779352931965.png',
        'https://i.postimg.cc/9f5P1zLF/image-1779352937325.png',
        'https://i.postimg.cc/52Fqw8SH/image-1779352951012.png',
        'https://i.postimg.cc/tCcNZBWH/image-1779352954121.png',
        'https://i.postimg.cc/HsN9c653/image-1779352965723.png',
        'https://i.postimg.cc/rsFNWbQJ/image-1779353158151.png',
        'https://i.postimg.cc/PxMMChzW/image-1779353161720.png',
        'https://i.postimg.cc/MTYYnxbZ/image-1779353169802.png',
        'https://i.postimg.cc/bvkgj1ZC/image-1779353175894.png',
        'https://i.postimg.cc/zfK71Ty0/image-1779353181113.png',
        'https://i.postimg.cc/L8rD7x8X/image-1779353190263.png',
        'https://i.postimg.cc/QdRmPfdq/image-1779353197471.png',
        'https://i.postimg.cc/ZKsVPbkF/image-1779353201977.png',
        'https://i.postimg.cc/qMv1CtFC/image-1779353218581.png',
        'https://i.postimg.cc/J7qTn3p4/image-1779353221617.png',
        'https://i.postimg.cc/2jwH6d2t/image-1779353225170.png',
        'https://i.postimg.cc/8ctw0D7D/image-1779353231000.png',
        'https://i.postimg.cc/J0PK2msM/image-1779353235773.png',
        'https://i.postimg.cc/FzDGBm7w/image-1779353240854.png',
        'https://i.postimg.cc/cCXTbZrz/image-1779353304321.png',
        'https://i.postimg.cc/d3q46Dt6/image-1779353435283.png',
        'https://i.postimg.cc/j2sZcCdX/image-1779353439919.png',
        'https://i.postimg.cc/wM6023TD/image-1779353448223.png',
        'https://i.postimg.cc/nzK3qqZ4/image-1779353462716.png',
        'https://i.postimg.cc/d1R5GGv8/image-1779353466204.png',
        'https://i.postimg.cc/d1R5GGvd/image-1779353471821.png',
        'https://i.postimg.cc/pTQsKKxr/image-1779353476794.png',
        'https://i.postimg.cc/9MPLyyVz/image-1779353480108.png',
        'https://i.postimg.cc/RF1gww9F/image-1779353504441.png',
        'https://i.postimg.cc/C1CcbbY0/image-1779353509645.png',
        'https://i.postimg.cc/9XJpVmfC/IMG-20260521-164340.png',
        'https://i.postimg.cc/qqbXGLFs/IMG-20260521-164401.png',
        'https://i.postimg.cc/Kjqr5NH6/IMG-20260521-164415.png',
        'https://i.postimg.cc/GthxYNXb/IMG-20260521-164432.png',
        'https://i.postimg.cc/prXJ87s2/IMG-20260521-164500.png',
        'https://i.postimg.cc/VvLWMTKy/IMG-20260521-164513.png',
        'https://i.postimg.cc/J045JgP5/IMG-20260521-164532.png',
        'https://i.postimg.cc/3NXdZCxg/image-1779352368523.png',
        'https://i.postimg.cc/QCGF5nhZ/image-1779352373273.png',
        'https://i.postimg.cc/x8DXHFYF/image-1779352377414.png',
        'https://i.postimg.cc/76TC5yvB/image-1779352384759.png',
        'https://i.postimg.cc/GhPyPr4K/image-1779352388125.png',
        'https://i.postimg.cc/L6k1kRJC/image-1779352394700.png',
        'https://i.postimg.cc/3rvpR2Y4/image-1779352424044.png',
        'https://i.postimg.cc/FHDkqZgJ/image-1779352450457.png',
        'https://i.postimg.cc/C1Wq7xCs/image-1779352453900.png',
        'https://i.postimg.cc/LXZgPTHN/image-1781177009996.png',
        'https://i.postimg.cc/8z1vYMHJ/image-1781178032420.png',
        'https://i.postimg.cc/qMcnQj2P/image-1781178128662.png',
        'https://i.postimg.cc/3wNv8hVL/image-1781178161844.png',
        'https://i.postimg.cc/1XwFkK2P/image-1781529988870.png',
        'https://i.postimg.cc/j2PfphmL/image-1781529993126.png',
        'https://i.postimg.cc/rsx4B93x/image-1781529997116.png',
        'https://i.postimg.cc/Xqd5Rgmj/image-1781530000766.png',
        'https://i.postimg.cc/C5k834Xs/image-1781530004283.png',
        'https://i.postimg.cc/ryr5R8mP/image-1781530008021.png',
        'https://i.postimg.cc/G3yvTct0/image-1781530011433.png',
        'https://i.postimg.cc/HWyb8pnm/image-1781530015125.png',
        'https://i.postimg.cc/9X7ywW0c/image-1781530018797.png',
        'https://i.postimg.cc/fW9YSwyb/image-1781530025711.png',
        'https://i.postimg.cc/X76dwTBN/image-1781530029779.png',
        'https://i.postimg.cc/gkyR4N3M/image-1781530034015.png',
        'https://i.postimg.cc/qR9nDFm5/image-1781530038089.png',
        'https://i.postimg.cc/Y9JgDPXT/image-1781530044505.png',
        'https://i.postimg.cc/ZR13sQ7m/image-1781530048291.png',
        'https://i.postimg.cc/C1dHQkwj/image-1781530166686.png',
        'https://i.postimg.cc/hjwbWvGs/image-1781530219624.png',
        'https://i.postimg.cc/B6yc9b69/image-1781530242288.png',
        'https://i.postimg.cc/nrDKHxsg/image-1781530276844.png',
        'https://i.postimg.cc/9fQGDZwj/image-1781530318131.png',
        'https://i.postimg.cc/h4kb2X6K/image-1781530356003.png',
        'https://i.postimg.cc/y8BhzwVs/image-1781530380477.png',
        'https://i.postimg.cc/NFH8gt9K/image-1781530423467.png',
        'https://i.postimg.cc/5t2wXLQf/image-1781530463297.png',
        'https://i.postimg.cc/JhYjZ0j4/image-1781530482804.png',
        'https://i.postimg.cc/vB1fzyv4/image-1781530513514.png',
        'https://i.postimg.cc/tT1W5bzz/image-1781530561241.png',
        'https://i.postimg.cc/vB1fzyv7/image-1781530574901.png',
        'https://i.postimg.cc/LXqLTSVx/image-1781530592944.png',
        'https://i.postimg.cc/fL6XqPHB/image-1781530607954.png',
        'https://i.postimg.cc/50jqRLf4/image-1781532414460.png',
        'https://i.postimg.cc/sX19N73B/image-1781532445483.png',
        'https://i.postimg.cc/0QrdBD9j/image-1781532452844.png',
        'https://i.postimg.cc/9MztnZcD/image-1781532507094.png'
    ];

    // ---------- 随礼物附带的文案库 ----------
    const GIFT_TEXTS = [
        '你是我新鲜又永恒的春天，是唯一贯穿我所有诗篇的韵脚。',
        '你最可爱，我说时来不及思索。而思索之后，还是这样说。',
        '如果你还在这个世界存在着，那么这个世界无论什么样，对我都是有意义的。',
        '自从我们相遇，你是我白日的白昼，夜晚的星辰，战栗中我全部的青春。',
        '你是我灵魂最后一块拼图，是我所有流浪的终点。',
        '你哄哄我我哄哄你，我们就这样喵喵咪咪汪汪嗷嗷在一起一辈子',
        '该怎么开口呢，是说天气，还是说好想你',
        '当我感到脆弱的时候，就重复你的名字',
        '我毕生的愿望，就是可以和一个人达成同谋，我在你身上找到了这种感觉，同时也找到了我生命的新的意义',
        '我每天都感谢命运让我遇到你，没有你，我的一部分将永远待在黑暗里',
        '我想给你打电话，告诉你天气晴朗，告诉你我爱你，就像人们爱希望和爱确定一样',
        '有一个可以想念的人，就是幸福。',
        '喜欢的东西很贵，喜欢的人很完美，恰好，喜欢的人是你。',
        '我嫉妒你身边每一个无关紧要的人，他们就那样轻而易举见到我朝思暮想的你。',
        '不管怎样，你要多多来信——收信的日子便是节日。吻你。完全属于你、等着你的小狗。吻你吻你再吻你。',
        '你偶然闯入了我并不引以为傲的生活，从那天起，我的生活开始发生变化。我的呼吸变得顺畅了，我讨厌的东西减少了，我可以自由地欣赏值得欣赏的东西了。',
        '说你需要我，依赖我，想我，喜欢我。',
        '我喜欢你给我分享的所有事，即使是小事，我也想听，那样我们的距离就不会远。',
        '上天让我遇到你，我很幸福，所以我万般珍惜不想让幸福从我手中溜走。',
        '那些见不到你的日子都成了爱情的养料，现在在你身边的我比任何时候都确信所有的等待都值得。',
        '我说幸福万万岁，我说你拥有幸福万万年。',
        '爱的成本太高了，要时间，要见面，要担心，要经历异地会猜疑，会掉眼泪，会胡思乱想，会没有安全感，会敏感，但我想说的是我爱你，也请你给我更多一些耐心，请爱我，好吗？',
        '谢谢你在世界的角落找到我。',
        '你一直說我很好，其實一直很好的人是你。',
        '转动戒指像是抚摸我的异地恋人。',
        '其实我远比你想象中的更需要你，因为我真的很在意你，你总能左右我的情绪，我喜欢每天早上醒来看到你的消息，我喜欢你看到好看的视频时与我分享的样子，我喜欢你大事小事都跟我说让我感觉到被需要，无论相隔多远，都能让我感受到内心的炽热，我想和你一直走下去，期待你的每一天，更期待和你一起做更多有意义的事，我爱你。',
        '不喜欢我的人或许很多，但你不可以，因为我在意。',
        '你没有什么要改变的，我只想爱你，爱你的过去、现在和未来。',
        '卖萌好累啊，我就站在这里呼吸两下拜托你一直爱我好不好。',
        '我本不想和风讨论你，可风说可以替我见你。',
        '我好想你。',
        '可不可以不要不依赖我。'
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

    // ---------- 管理面板：不受每日上限约束的强制发送（由 data.js 的按钮调用） ----------
    function forceSendGiftNow() {
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
    window.forceSendGiftNow = forceSendGiftNow;

    // getStorageKey 依赖 SESSION_ID，必须等会话初始化完成后再启动
    document.addEventListener('DOMContentLoaded', function() {
        const waitReady = setInterval(function() {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                initGiftFeature();
            }
        }, 300);
    });
})();
