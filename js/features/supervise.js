/**
 * features/supervise.js - 监督打卡（运动 / 学习 / 早睡早起）
 *
 * 手动打卡 + 连续天数统计 + 梦角主动催促（晚间时段判定，没打卡就可能被念叨）。
 * 催促语气随机混着两种风格：严格监督 / 温柔关心。
 * 不需要 AI：全部是本地字卡池随机挑选。
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
    function storageKey() { return (typeof getStorageKey === 'function') ? getStorageKey('superviseData') : 'superviseData'; }
    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }
    function daysBetween(dateStrA, dateStrB) {
        // 两个 "YYYY-M-D" 格式日期字符串相差多少天
        function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).getTime(); }
        return Math.round((parse(dateStrB) - parse(dateStrA)) / (24 * 60 * 60 * 1000));
    }

    // ==================== 类别设定 ====================
    var CATEGORIES = {
        exercise: { label: '运动', icon: 'fa-person-running', color: '#5a9c6e' },
        study: { label: '学习', icon: 'fa-book-open', color: '#5a7ec9' },
        sleep: { label: '早睡早起', icon: 'fa-moon', color: '#9c7ac9' }
    };

    var PRAISE_LINES = {
        exercise: {
            short: ['运动完啦，真棒', '辛苦了，宝贝', '坚持运动很好'],
            long: ['能坚持这么多天，真的很了不起', '越来越自律了，我很高兴，我们一起进步']
        },
        study: {
            short: ['学习辛苦了', '今天学了什么呀', '喜欢你认真学习的样子'],
            long: ['坚持了这么久，奖励抱抱', '今天也有进步，我们一起']
        },
        sleep: {
            short: ['早睡早起，真乖', '作息不错，继续保持', '按时休息，身体最重要'],
            long: ['这么多天作息都很规律，很厉害', '坚持这么久的好作息，你做到了']
        }
    };

    var NAG_LINES = {
        exercise: {
            strict: ['今天运动了吗？不可以偷懒哦', '说好的运动呢？看着我…', '动一动嘛'],
            gentle: ['今天有没有抽空运动呀？', '别太累着自己，但也别忘了运动哦', '休息一下，起来活动活动？我陪着你']
        },
        study: {
            strict: ['今天学习了吗？不能松懈哦', '记得看书哦', '学习计划，宝宝…🥺'],
            gentle: ['今天有没有看看书呀？', '我们一起来学习吧', '有空的话学一点点嘛']
        },
        sleep: {
            strict: ['还不睡觉吗？在干什么呀', '早点睡，别熬夜了哦', '明明答应我要早睡的…'],
            gentle: ['早点休息哦，身体要紧', '记得早点休息呀，别太晚', '今天早点睡好不好？']
        }
    };

    var STREAK_BROKEN_LINES = {
        strict: ['哎呀，打卡断掉了', '差一点点就可以继续啦', '打卡断了…下次注意哦'],
        gentle: ['没关系，重新开始就好', '断了也没关系，我们再来吧', '别灰心，明天继续就好']
    };

    // ==================== 状态 ====================
    var state = null;
    function freshState() {
        var cats = {};
        Object.keys(CATEGORIES).forEach(function (key) {
            cats[key] = { streak: 0, longestStreak: 0, lastCheckIn: null, log: [] };
        });
        return { categories: cats, lastNagDate: {} };
    }
    function loadState() {
        return new Promise(function (resolve) {
            if (typeof localforage === 'undefined') { state = freshState(); resolve(); return; }
            localforage.getItem(storageKey()).then(function (saved) {
                state = (saved && saved.categories) ? saved : freshState();
                if (!state.lastNagDate) state.lastNagDate = {};
                Object.keys(CATEGORIES).forEach(function (key) {
                    if (!state.categories[key]) state.categories[key] = { streak: 0, longestStreak: 0, lastCheckIn: null, log: [] };
                });
                resolve();
            }).catch(function () { state = freshState(); resolve(); });
        });
    }
    function saveState() {
        if (typeof localforage === 'undefined' || !state) return;
        localforage.setItem(storageKey(), state).catch(function () {});
    }

    // ==================== 打卡 ====================
    window.doCheckIn = function (catKey) {
        if (!state || !CATEGORIES[catKey]) return;
        var cat = state.categories[catKey];
        var today = todayStr();

        if (cat.lastCheckIn === today) {
            if (typeof showNotification === 'function') showNotification('今天已经打过卡啦', 'info');
            return;
        }

        var wasBroken = false, oldStreak = cat.streak;
        if (cat.lastCheckIn) {
            var gap = daysBetween(cat.lastCheckIn, today);
            if (gap === 1) {
                cat.streak += 1;
            } else {
                wasBroken = oldStreak >= 3;
                cat.streak = 1;
            }
        } else {
            cat.streak = 1;
        }
        cat.lastCheckIn = today;
        cat.longestStreak = Math.max(cat.longestStreak, cat.streak);
        cat.log.unshift({ date: today, ts: Date.now() });
        if (cat.log.length > 200) cat.log.length = 200;
        saveState();

        var meta = CATEGORIES[catKey];
        var pn = getPartnerName();

        if (wasBroken) {
            var brokenStyle = pick(['strict', 'gentle']);
            var brokenLine = pick(STREAK_BROKEN_LINES[brokenStyle]);
            if (typeof addMessage === 'function') {
                addMessage({ id: Date.now() + Math.random(), sender: 'partner', text: brokenLine, timestamp: new Date(), type: 'normal' });
            }
        }

        var praisePool = cat.streak >= 7 ? PRAISE_LINES[catKey].long : PRAISE_LINES[catKey].short;
        var praiseLine = pick(praisePool);
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random() + 1, sender: 'partner', text: praiseLine + (cat.streak > 1 ? '（连续' + cat.streak + '天）' : ''), timestamp: new Date(), type: 'normal' });
        }
        if (typeof showNotification === 'function') showNotification(meta.label + ' 打卡成功，连续 ' + cat.streak + ' 天', 'success');

        renderSupervisePanel();
    };

    // ==================== 梦角主动催促（晚间时段判定）====================
    var NAG_WINDOW_START_HOUR = 20, NAG_WINDOW_END_HOUR = 23; // 晚8点~11点之间才可能催
    var NAG_CHANCE_PER_CATEGORY = 0.35;

    function tryNagCheck() {
        if (!state) return;
        var now = new Date();
        var hour = now.getHours();
        if (hour < NAG_WINDOW_START_HOUR || hour >= NAG_WINDOW_END_HOUR) return;

        var today = todayStr();
        Object.keys(CATEGORIES).forEach(function (key) {
            var cat = state.categories[key];
            if (cat.lastCheckIn === today) return; // 今天已经打卡了，不催
            if (state.lastNagDate[key] === today) return; // 今天已经催过这个类别了，不重复催
            if (Math.random() >= NAG_CHANCE_PER_CATEGORY) return;

            state.lastNagDate[key] = today;
            saveState();

            var style = pick(['strict', 'gentle']);
            var line = pick(NAG_LINES[key][style]);
            if (typeof addMessage === 'function') {
                addMessage({ id: Date.now() + Math.random(), sender: 'partner', text: line, timestamp: new Date(), type: 'normal' });
            }
            if (typeof showNotification === 'function') showNotification(getPartnerName() + ' 在催你' + CATEGORIES[key].label + '了', 'info', 3000);
        });
    }

    var _nagTimer = null;
    function scheduleNagCheck() {
        if (_nagTimer) clearTimeout(_nagTimer);
        _nagTimer = setTimeout(function () {
            tryNagCheck();
            scheduleNagCheck();
        }, 30 * 60 * 1000); // 每30分钟检查一次是不是进入晚间时段了
    }
    window.superviseTestNag = function () {
        if (state) tryNagCheck();
        else loadState().then(tryNagCheck);
    };

    // ==================== UI ====================
    function renderSupervisePanel() {
        var body = document.getElementById('supervise-modal-body');
        if (!body) return;
        var today = todayStr();

        var html = Object.keys(CATEGORIES).map(function (key) {
            var meta = CATEGORIES[key];
            var cat = state.categories[key];
            var checkedToday = cat.lastCheckIn === today;
            return '<div class="sv-card">'
                + '<div class="sv-card-header">'
                +   '<div class="sv-card-icon" style="background:' + meta.color + '22;color:' + meta.color + ';"><i class="fas ' + meta.icon + '"></i></div>'
                +   '<div class="sv-card-info">'
                +     '<div class="sv-card-name">' + meta.label + '</div>'
                +     '<div class="sv-card-streak">连续 ' + cat.streak + ' 天 · 最长 ' + cat.longestStreak + ' 天</div>'
                +   '</div>'
                +   '<button class="sv-checkin-btn ' + (checkedToday ? 'done' : '') + '" onclick="window.doCheckIn(\'' + key + '\')" ' + (checkedToday ? 'disabled' : '') + '>'
                +     (checkedToday ? '<i class="fas fa-check"></i> 已打卡' : '打卡')
                +   '</button>'
                + '</div>'
                + '<div class="sv-log-strip">' + renderLogStrip(cat.log) + '</div>'
                + '</div>';
        }).join('');

        body.innerHTML = html;
    }

    function renderLogStrip(log) {
        // 显示最近14天的打卡情况，简单的小方块日历
        var days = [];
        var checkedDates = {};
        log.forEach(function (l) { checkedDates[l.date] = true; });
        for (var i = 13; i >= 0; i--) {
            var d = new Date();
            d.setDate(d.getDate() - i);
            var ds = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
            days.push(!!checkedDates[ds]);
        }
        return days.map(function (checked) {
            return '<div class="sv-log-dot ' + (checked ? 'checked' : '') + '"></div>';
        }).join('');
    }

    // ==================== 初始化 ====================
    function initListeners() {
        var entryBtn = document.getElementById('supervise-function');
        if (entryBtn) {
            entryBtn.addEventListener('click', function () {
                loadState().then(function () {
                    renderSupervisePanel();
                    if (typeof showModal === 'function') showModal(document.getElementById('supervise-modal'));
                });
            });
        }
        document.getElementById('close-supervise-modal')?.addEventListener('click', function () {
            if (typeof hideModal === 'function') hideModal(document.getElementById('supervise-modal'));
        });
        document.getElementById('supervise-test-nag-btn')?.addEventListener('click', function () {
            // 测试按钮无视晚间时段限制，方便随时测试
            if (!state) return;
            var key = pick(Object.keys(CATEGORIES));
            var style = pick(['strict', 'gentle']);
            var line = pick(NAG_LINES[key][style]);
            if (typeof addMessage === 'function') {
                addMessage({ id: Date.now() + Math.random(), sender: 'partner', text: line, timestamp: new Date(), type: 'normal' });
            }
            if (typeof showNotification === 'function') showNotification('已模拟一次催促', 'success');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                initListeners();
                loadState().then(function () {
                    scheduleNagCheck();
                });
            }
        }, 300);
    });
})();
