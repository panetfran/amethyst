/**
 * features/wishes.js - 心愿（合并了"心愿清单"+"小任务清单"）
 *
 * 三种类型：
 *   material  物质心愿——想要的东西，"满足"会跳转去发红包
 *   emotional 情感心愿——想要的关心，"满足"是纯聊天反应
 *   action    行动请求——想让你做点什么，"满足"是标记完成+反应
 *
 * 同一时间只有一个"进行中"的心愿，满足/过期之后才会出现下一个。
 * 不需要 AI：心愿内容是预先写好的一批，随机挑选。
 *
 * 依赖：getStorageKey, localforage, showNotification, addMessage, settings, SESSION_ID
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings && settings.partnerName) ? settings.partnerName : '梦角';
    }
    function storageKey() { return (typeof getStorageKey === 'function') ? getStorageKey('wishesData') : 'wishesData'; }

    // ==================== 心愿池 ====================
    var WISH_POOL = {
        material: [
            '想要一束花，随便什么花都好', '想吃一顿火锅', '想要一杯很好喝的奶茶',
            '想要一件新衣服', '想要一本喜欢的书', '想去看一场电影',
            '想要一份小礼物，不用贵', '想吃点甜甜的东西', '想要一次说走就走的短途旅行',
            '想要一副好看的耳机'
        ],
        emotional: [
            '想让你夸夸我', '想要一个拥抱', '想让你说一句"辛苦了"',
            '想让你多陪陪我', '想让你哄哄我', '想听你说说今天开心的事',
            '想让你告诉我，我在你心里是什么样子', '想要一点点撒娇的空间',
            '想让你耐心听我说完一件小事', '想让你说你也想我了'
        ],
        action: [
            '陪我聊聊天，随便聊什么都行', '给我讲个笑话', '发一张你现在在做什么的照片',
            '陪我玩一小会儿', '给我唱一句喜欢的歌词', '跟我分享一件今天发生的小事',
            '陪我看看今天的天气怎么样', '给我讲讲你在忙什么', '陪我一起安静待一会儿',
            '跟我说说你现在的心情'
        ]
    };
    var TYPE_META = {
        material: { label: '物质心愿', icon: 'fa-gift', color: '#c9767a' },
        emotional: { label: '情感心愿', icon: 'fa-heart', color: '#c98aa8' },
        action: { label: '行动请求', icon: 'fa-hand-point-right', color: '#7a9dc9' }
    };
    var FULFILL_REACTIONS = {
        material: ['太开心了，谢谢你！', '就知道你最好了~', '这下满足了，抱一个！'],
        emotional: ['心里暖暖的，谢谢你。', '就是想要这种感觉，谢谢你懂我。', '有你在真好。'],
        action: ['好耶，谢谢你陪我~', '感觉好多了，谢谢你。', '就喜欢跟你待在一起。']
    };

    // ==================== 状态 ====================
    var state = null;

    function freshState() {
        return { current: null, history: [], lastGeneratedAt: 0 };
    }
    function loadState() {
        return new Promise(function (resolve) {
            if (typeof localforage === 'undefined') { state = freshState(); resolve(); return; }
            localforage.getItem(storageKey()).then(function (saved) {
                state = (saved && typeof saved === 'object') ? saved : freshState();
                if (!state.history) state.history = [];
                resolve();
            }).catch(function () { state = freshState(); resolve(); });
        });
    }
    function saveState() {
        if (typeof localforage === 'undefined' || !state) return;
        localforage.setItem(storageKey(), state).catch(function () {});
    }

    // ==================== 生成新心愿 ====================
    function generateWish() {
        var type = pick(['material', 'emotional', 'action']);
        var text = pick(WISH_POOL[type]);
        state.current = {
            id: 'wish_' + Date.now(),
            type: type,
            text: text,
            createdAt: Date.now(),
            fulfilled: false
        };
        state.lastGeneratedAt = Date.now();
        saveState();
        refreshBadge();

        var pn = getPartnerName();
        if (typeof showNotification === 'function') showNotification(pn + ' 有一个新心愿~', 'info', 3500);
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random(), sender: 'system', text: pn + '：' + text, timestamp: new Date(), type: 'system' });
        }
    }

    var CHECK_INTERVAL_MIN = 3, CHECK_INTERVAL_MAX = 10; // 小时
    var GENERATE_CHANCE = 0.35;
    var _checkTimer = null;

    function scheduleCheck() {
        if (_checkTimer) clearTimeout(_checkTimer);
        var delay = (CHECK_INTERVAL_MIN + Math.random() * (CHECK_INTERVAL_MAX - CHECK_INTERVAL_MIN)) * 60 * 60 * 1000;
        _checkTimer = setTimeout(function () {
            if (state && !state.current && Math.random() < GENERATE_CHANCE) {
                generateWish();
            }
            scheduleCheck();
        }, delay);
    }
    window.wishesTestGenerate = function () {
        if (state) { if (!state.current) generateWish(); }
        else loadState().then(function () { if (!state.current) generateWish(); });
    };

    // ==================== 满足心愿 ====================
    window.fulfillCurrentWish = function () {
        if (!state || !state.current) return;
        var wish = state.current;

        if (wish.type === 'material') {
            // 物质类：跳转去发红包，心愿先不标记完成，等真的发了红包再算
            if (typeof window.showRedPacketSendModal === 'function') {
                window.showRedPacketSendModal();
            } else if (typeof showNotification === 'function') {
                showNotification('红包功能好像还没加载好', 'warning');
            }
            return;
        }

        completeWish(wish);
    };

    function completeWish(wish) {
        wish.fulfilled = true;
        wish.fulfilledAt = Date.now();
        state.history.unshift(wish);
        if (state.history.length > 100) state.history.length = 100;
        state.current = null;
        saveState();
        refreshBadge();

        var pn = getPartnerName();
        var reaction = pick(FULFILL_REACTIONS[wish.type] || ['谢谢你~']);
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random(), sender: 'partner', text: reaction, timestamp: new Date(), type: 'normal' });
        }
        if (typeof showNotification === 'function') showNotification('心愿满足啦~', 'success', 3000);

        // 顺手让"连接状态"往好的方向走一下（如果壁纸功能已经加载）
        try {
            if (typeof window.wallpaperBoostLinkStatus === 'function') window.wallpaperBoostLinkStatus();
        } catch (e) {}

        renderWishPanel();
    }

    // 红包真正发出去之后，如果当前有未完成的物质心愿，就顺手标记完成
    // （由 red-packet.js 在发送成功后调用，可选钩子，没连上也不影响心愿本身的其它功能）
    window.wishesNotifyRedPacketSent = function () {
        if (state && state.current && state.current.type === 'material') {
            completeWish(state.current);
        }
    };

    window.dismissCurrentWish = function () {
        if (!state || !state.current) return;
        if (!confirm('这个心愿先不管了吗？（不会记录进历史，之后还会有新的心愿出现）')) return;
        state.current = null;
        saveState();
        refreshBadge();
        renderWishPanel();
    };

    // ==================== 角标 ====================
    function refreshBadge() {
        if (typeof window.appBadges === 'undefined' || !state) return;
        window.appBadges.set('wishes-function', state.current && !state.current.fulfilled ? 1 : 0);
    }

    // ==================== UI ====================
    function renderWishPanel() {
        var body = document.getElementById('wishes-modal-body');
        if (!body) return;

        var html = '';
        if (state.current) {
            var meta = TYPE_META[state.current.type];
            var timeAgo = Math.round((Date.now() - state.current.createdAt) / (60 * 1000));
            var timeLabel = timeAgo < 60 ? (timeAgo + '分钟前') : (Math.round(timeAgo / 60) + '小时前');
            html += '<div class="wish-current-card" style="border-color:' + meta.color + '33;background:' + meta.color + '11;">'
                + '<div class="wish-type-badge" style="background:' + meta.color + ';"><i class="fas ' + meta.icon + '"></i> ' + meta.label + '</div>'
                + '<div class="wish-text">' + escapeHtml(state.current.text) + '</div>'
                + '<div class="wish-time">' + timeLabel + '</div>'
                + '<div class="wish-actions">'
                +   '<button class="wish-fulfill-btn" onclick="window.fulfillCurrentWish()" style="background:' + meta.color + ';">'
                +     (state.current.type === 'material' ? '<i class="fas fa-gift"></i> 去满足' : '<i class="fas fa-check"></i> 满足心愿')
                +   '</button>'
                +   '<button class="wish-dismiss-btn" onclick="window.dismissCurrentWish()">先不管</button>'
                + '</div>'
                + '</div>';
        } else {
            html += '<div class="wish-empty">'
                + '<i class="fas fa-cloud"></i>'
                + '<p>现在没有心愿</p>'
                + '<span>' + escapeHtml(getPartnerName()) + '会不定期冒出一个新的~</span>'
                + '</div>';
        }

        if (state.history.length > 0) {
            html += '<div class="wish-history-title">历史心愿（' + state.history.length + '）</div>';
            html += '<div class="wish-history-list">' + state.history.slice(0, 30).map(function (w) {
                var m = TYPE_META[w.type];
                var d = new Date(w.fulfilledAt);
                return '<div class="wish-history-item">'
                    + '<i class="fas ' + m.icon + '" style="color:' + m.color + ';"></i>'
                    + '<div class="wish-history-text">' + escapeHtml(w.text) + '</div>'
                    + '<div class="wish-history-date">' + d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + '</div>'
                    + '</div>';
            }).join('') + '</div>';
        }

        body.innerHTML = html;
    }

    // ==================== 初始化 ====================
    function initListeners() {
        var entryBtn = document.getElementById('wishes-function');
        if (entryBtn) {
            entryBtn.addEventListener('click', function () {
                loadState().then(function () {
                    renderWishPanel();
                    if (typeof showModal === 'function') showModal(document.getElementById('wishes-modal'));
                });
            });
        }
        document.getElementById('close-wishes-modal')?.addEventListener('click', function () {
            if (typeof hideModal === 'function') hideModal(document.getElementById('wishes-modal'));
        });
        document.getElementById('wishes-test-btn')?.addEventListener('click', function () {
            window.wishesTestGenerate();
            setTimeout(renderWishPanel, 50);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                initListeners();
                loadState().then(function () {
                    refreshBadge();
                    scheduleCheck();
                });
            }
        }, 300);
    });
})();
