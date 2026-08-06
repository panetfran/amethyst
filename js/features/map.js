/**
 * features/map.js - 地图（v2，手机优先重写版）
 *
 * 跟上一版比，主要变化：
 *   - 去掉了侧边悬浮小图标工具栏（手机上很难点），改成底部大按钮 + 底部弹出面板
 *   - 去掉了手绘地形/手绘路线这类鼠标拖拽才顺手的工具，加/改地点改用表单弹窗
 *   - 梦角自动移动改成"连续没动次数越多，下次命中概率越高"，保底不会一直不动
 *   - 梦角移动时会顺手留一句小评论（复用字卡库）
 *   - 点开地点能看到"梦角最近在这待过几次"
 *   - 陪伴功能进行中，会自动把"我"和"梦角"的位置都同步成"我的家·客厅"
 *
 * 依赖：getStorageKey, localforage, showNotification, customReplies, settings, SESSION_ID
 * 不需要 AI：地点/评论都是本地数据 + 字卡库随机组合。
 */

(function () {
    'use strict';

    // ==================== 基础工具 ====================
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
    function randFloat(a, b) { return a + Math.random() * (b - a); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings && settings.partnerName) ? settings.partnerName : '梦角';
    }
    function getMyName() {
        return (typeof settings !== 'undefined' && settings && settings.myName) ? settings.myName : '我';
    }
    function mapStorageKey() {
        return (typeof getStorageKey === 'function') ? getStorageKey('map2Data') : 'map2Data';
    }
    function generateId() { return 'loc_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }

    // ==================== 默认地点数据 ====================
    function buildDefaultMaps() {
        return {
            root: {
                title: '主地图',
                w: 1000, h: 900,
                zones: [
                    { x: 80, y: 60, w: 340, h: 220, color: '#e3ecdc' },
                    { x: 280, y: 340, w: 440, h: 400, color: '#f4ecd8' },
                    { x: 620, y: 60, w: 320, h: 220, color: '#dde8f0' },
                    { x: 620, y: 560, w: 340, h: 280, color: '#efe6ee' },
                    { x: 60, y: 440, w: 150, h: 130, color: '#d8e8d0' },
                    { x: 60, y: 690, w: 150, h: 130, color: '#c9e0e8' },
                    { x: 850, y: 400, w: 130, h: 140, color: '#e0d8ea' }
                ],
                roads: [
                    { x1: 500, y1: 350, x2: 250, y2: 250, w: 8 },
                    { x1: 500, y1: 350, x2: 500, y2: 480, w: 8 },
                    { x1: 500, y1: 350, x2: 800, y2: 250, w: 8 },
                    { x1: 500, y1: 350, x2: 800, y2: 650, w: 8 },
                    { x1: 400, y1: 430, x2: 600, y2: 430, w: 6 },
                    { x1: 400, y1: 560, x2: 600, y2: 560, w: 6 },
                    { x1: 500, y1: 490, x2: 500, y2: 700, w: 6 }
                ],
                locations: [
                    { id: 'station', x: 500, y: 350, name: '车站', icon: 'fa-train', color: '#8a8a8a' },
                    { id: 'my_home', x: 180, y: 160, name: '我的家', icon: 'fa-house', color: '#7BC8A4', submapKey: 'my_home' },
                    { id: 'ta_home', x: 320, y: 160, name: getPartnerName() + '的家', icon: 'fa-house', color: '#BB9EC7', submapKey: 'ta_home' },
                    { id: 'conv_store', x: 400, y: 430, name: '便利店', icon: 'fa-store', color: '#F4A6B3' },
                    { id: 'supermarket', x: 600, y: 430, name: '超市', icon: 'fa-cart-shopping', color: '#F4A6B3' },
                    { id: 'clothes_shop', x: 400, y: 560, name: '服装店', icon: 'fa-shirt', color: '#F4A6B3' },
                    { id: 'cafe', x: 600, y: 560, name: '咖啡馆', icon: 'fa-mug-hot', color: '#F4A6B3' },
                    { id: 'cinema', x: 500, y: 490, name: '电影院', icon: 'fa-film', color: '#F4A6B3' },
                    { id: 'bar', x: 500, y: 630, name: '酒吧', icon: 'fa-martini-glass', color: '#F4A6B3' },
                    { id: 'downtown', x: 500, y: 700, name: '市区', icon: 'fa-city', color: '#F4A6B3' },
                    { id: 'dentist', x: 320, y: 490, name: '牙医', icon: 'fa-tooth', color: '#F4A6B3' },
                    { id: 'my_school', x: 720, y: 160, name: '学校', icon: 'fa-school', color: '#7BC8A4', submapKey: 'my_school' },
                    { id: 'ta_university', x: 870, y: 160, name: '折纸大学', icon: 'fa-graduation-cap', color: '#BB9EC7', submapKey: 'ta_university' },
                    { id: 'ta_company', x: 720, y: 700, name: '星际和平公司', icon: 'fa-satellite', color: '#BB9EC7', submapKey: 'ta_company' },
                    { id: 'ta_society', x: 850, y: 620, name: '博识学会', icon: 'fa-landmark', color: '#BB9EC7' },
                    { id: 'ta_station', x: 870, y: 780, name: '空间站', icon: 'fa-satellite-dish', color: '#BB9EC7', submapKey: 'ta_station' },
                    { id: 'my_park', x: 150, y: 500, name: '公园', icon: 'fa-tree', color: '#7BC8A4' },
                    { id: 'seaside', x: 150, y: 750, name: '海边', icon: 'fa-umbrella-beach', color: '#7BC8A4' },
                    { id: 'high_place', x: 350, y: 800, name: '城市高处', icon: 'fa-mountain', color: '#7BC8A4' },
                    { id: 'greenhouse', x: 900, y: 470, name: '植物园', icon: 'fa-seedling', color: '#BB9EC7' },
                    { id: 'ta_traveling', x: 950, y: 850, name: '出差中·其它星系', icon: 'fa-rocket', color: '#c5a47e', rare: true }
                ]
            },
            my_home: {
                title: '我的家', w: 600, h: 500, zones: [{ x: 0, y: 0, w: 600, h: 500, color: '#f0ebe3' }], roads: [],
                locations: [
                    { id: 'entrance', x: 100, y: 250, name: '玄关', icon: 'fa-door-open', color: '#7FA6CD' },
                    { id: 'living_room', x: 250, y: 150, name: '客厅', icon: 'fa-couch', color: '#7FA6CD' },
                    { id: 'bedroom', x: 400, y: 150, name: '卧室', icon: 'fa-moon', color: '#BB9EC7' },
                    { id: 'bed', x: 400, y: 280, name: '床', icon: 'fa-bed', color: '#BB9EC7' },
                    { id: 'restroom', x: 250, y: 380, name: '洗手间', icon: 'fa-toilet', color: '#7FA6CD' },
                    { id: 'bathroom', x: 130, y: 380, name: '浴室', icon: 'fa-bath', color: '#7FA6CD' },
                    { id: 'kitchen', x: 400, y: 400, name: '厨房', icon: 'fa-kitchen-set', color: '#F4A6B3' },
                    { id: 'balcony', x: 520, y: 250, name: '阳台', icon: 'fa-sun', color: '#7BC8A4' }
                ]
            },
            ta_home: {
                title: getPartnerName() + '的家', w: 600, h: 500, zones: [{ x: 0, y: 0, w: 600, h: 500, color: '#f2ecf5' }], roads: [],
                locations: [
                    { id: 'ta_entrance', x: 100, y: 250, name: '玄关', icon: 'fa-door-open', color: '#BB9EC7' },
                    { id: 'ta_living_room', x: 250, y: 150, name: '客厅', icon: 'fa-couch', color: '#BB9EC7' },
                    { id: 'ta_bedroom', x: 400, y: 150, name: '卧室', icon: 'fa-moon', color: '#c5a47e' },
                    { id: 'ta_bed', x: 400, y: 280, name: '床', icon: 'fa-bed', color: '#c5a47e' },
                    { id: 'ta_restroom', x: 250, y: 380, name: '洗手间', icon: 'fa-toilet', color: '#BB9EC7' },
                    { id: 'ta_bathroom', x: 130, y: 380, name: '浴室', icon: 'fa-bath', color: '#BB9EC7' },
                    { id: 'ta_kitchen', x: 400, y: 400, name: '厨房', icon: 'fa-kitchen-set', color: '#F4A6B3' },
                    { id: 'ta_balcony', x: 520, y: 250, name: '阳台', icon: 'fa-sun', color: '#7BC8A4' }
                ]
            },
            my_school: {
                title: '学校', w: 550, h: 450, zones: [{ x: 0, y: 0, w: 550, h: 450, color: '#e8e0d4' }], roads: [],
                locations: [
                    { id: 'classroom', x: 200, y: 220, name: '教室', icon: 'fa-chalkboard', color: '#7FA6CD' },
                    { id: 'library', x: 380, y: 220, name: '图书馆', icon: 'fa-book-open', color: '#7FA6CD' }
                ]
            },
            ta_company: {
                title: '星际和平公司', w: 550, h: 450, zones: [{ x: 0, y: 0, w: 550, h: 450, color: '#e6e6ee' }], roads: [],
                locations: [
                    { id: 'meeting_room', x: 180, y: 220, name: '会议室', icon: 'fa-people-group', color: '#BB9EC7' },
                    { id: 'office', x: 350, y: 150, name: '办公室', icon: 'fa-briefcase', color: '#BB9EC7' },
                    { id: 'lab', x: 350, y: 300, name: '实验区', icon: 'fa-flask', color: '#c5a47e' }
                ]
            },
            ta_university: {
                title: '折纸大学', w: 550, h: 450, zones: [{ x: 0, y: 0, w: 550, h: 450, color: '#ede4d0' }], roads: [],
                locations: [
                    { id: 'ta_office', x: 180, y: 220, name: '办公室', icon: 'fa-briefcase', color: '#BB9EC7' },
                    { id: 'ta_classroom', x: 350, y: 150, name: '教室', icon: 'fa-chalkboard', color: '#BB9EC7' },
                    { id: 'ta_library', x: 350, y: 300, name: '图书馆', icon: 'fa-book-open', color: '#BB9EC7' }
                ]
            },
            ta_station: {
                title: '空间站', w: 550, h: 450, zones: [{ x: 0, y: 0, w: 550, h: 450, color: '#dfe6ee' }], roads: [],
                locations: [
                    { id: 'station_meeting', x: 150, y: 150, name: '会议室', icon: 'fa-people-group', color: '#BB9EC7' },
                    { id: 'station_office', x: 350, y: 150, name: '办公室', icon: 'fa-briefcase', color: '#BB9EC7' },
                    { id: 'archive', x: 150, y: 300, name: '藏品区', icon: 'fa-box-archive', color: '#c5a47e' },
                    { id: 'observatory', x: 350, y: 300, name: '天文观测台', icon: 'fa-star', color: '#c5a47e' }
                ]
            }
        };
    }

    var ICON_CHOICES = [
        'fa-house', 'fa-door-open', 'fa-couch', 'fa-bed', 'fa-moon', 'fa-toilet', 'fa-bath',
        'fa-kitchen-set', 'fa-sun', 'fa-train', 'fa-school', 'fa-graduation-cap', 'fa-chalkboard',
        'fa-book-open', 'fa-store', 'fa-cart-shopping', 'fa-shirt', 'fa-mug-hot', 'fa-film',
        'fa-martini-glass', 'fa-city', 'fa-tooth', 'fa-tree', 'fa-umbrella-beach', 'fa-mountain',
        'fa-seedling', 'fa-satellite', 'fa-satellite-dish', 'fa-landmark', 'fa-briefcase',
        'fa-people-group', 'fa-flask', 'fa-box-archive', 'fa-star', 'fa-rocket', 'fa-heart',
        'fa-gamepad', 'fa-dumbbell', 'fa-hospital', 'fa-paw', 'fa-gift', 'fa-music'
    ];

    // ==================== 状态 ====================
    var state = null;
    var mapStack = ['root'];
    var zoom = 1, panX = 0, panY = 0;
    var canvas, ctx, viewEl;
    var _meAvatarImg = null, _taAvatarImg = null, _meAvatarSrc = null, _taAvatarSrc = null;
    var _taCheckTimer = null;
    var overlay = null;

    function curKey() { return mapStack[mapStack.length - 1]; }
    function curMap() { return state.maps[curKey()]; }

    // ==================== 存储 ====================
    function loadState() {
        return new Promise(function (resolve) {
            if (typeof localforage === 'undefined') { state = freshState(); resolve(); return; }
            localforage.getItem(mapStorageKey()).then(function (saved) {
                if (saved && saved.maps) {
                    state = saved;
                    if (!state.footprints) state.footprints = [];
                    if (typeof state.taChecksSinceMove !== 'number') state.taChecksSinceMove = 0;
                } else {
                    state = freshState();
                }
                resolve();
            }).catch(function () { state = freshState(); resolve(); });
        });
    }
    function freshState() {
        return {
            maps: buildDefaultMaps(),
            footprints: [],
            me: { mapKey: 'root', x: 440, y: 250 },
            ta: { mapKey: 'root', x: 560, y: 250 },
            taChecksSinceMove: 0
        };
    }
    function saveState() {
        if (typeof localforage === 'undefined' || !state) return;
        localforage.setItem(mapStorageKey(), state).catch(function () {});
    }

    // ==================== 头像 ====================
    function loadAvatars() {
        try {
            var meImg = document.querySelector('#my-avatar img');
            var taImg = document.querySelector('#partner-avatar img');
            var meUrl = meImg ? meImg.src : null;
            var taUrl = taImg ? taImg.src : null;
            if (meUrl && meUrl !== _meAvatarSrc) {
                _meAvatarSrc = meUrl;
                var mi = new Image();
                mi.onload = function () { _meAvatarImg = mi; render(); };
                mi.src = meUrl;
            }
            if (taUrl && taUrl !== _taAvatarSrc) {
                _taAvatarSrc = taUrl;
                var ti = new Image();
                ti.onload = function () { _taAvatarImg = ti; render(); };
                ti.src = taUrl;
            }
        } catch (e) {}
    }

    // ==================== 梦角自动移动 ====================
    function getMoveChance(checksSinceLastMove) {
        var base = 0.25, step = 0.15;
        return Math.min(0.95, base + checksSinceLastMove * step);
    }

    function collectAllTargets() {
        var normal = [], rare = [];
        Object.keys(state.maps).forEach(function (mapKey) {
            (state.maps[mapKey].locations || []).forEach(function (loc) {
                var entry = { mapKey: mapKey, x: loc.x, y: loc.y, name: loc.name };
                if (loc.rare) rare.push(entry); else normal.push(entry);
            });
        });
        return { normal: normal, rare: rare };
    }

    function generateMoveComment() {
        var pool = (typeof customReplies !== 'undefined' && customReplies.length > 0) ? customReplies : ['嗯', '到啦', '在这儿'];
        var n = Math.min(pool.length, randInt(1, 2));
        var shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });
        return shuffled.slice(0, n).join('。') + '。';
    }

    function moveTaNow(forceMode) {
        var targets = collectAllTargets();
        var useRandomCoord = forceMode === 'random' || (!forceMode && Math.random() < 0.15);
        var mapKey, x, y, label;

        if (useRandomCoord) {
            var keys = Object.keys(state.maps);
            mapKey = pick(keys);
            var m = state.maps[mapKey];
            x = randFloat(60, m.w - 60);
            y = randFloat(60, m.h - 60);
            label = (state.maps[mapKey].title || mapKey) + ' 的某处';
        } else {
            var useRare = targets.rare.length > 0 && Math.random() < 0.2;
            var pool = useRare ? targets.rare : (targets.normal.length ? targets.normal : targets.rare);
            if (!pool.length) return false;
            var t = pick(pool);
            mapKey = t.mapKey; x = t.x; y = t.y; label = t.name;
        }

        state.ta = { mapKey: mapKey, x: x, y: y };
        var comment = generateMoveComment();
        state.footprints.unshift({ ts: Date.now(), mapKey: mapKey, x: x, y: y, locationName: label, comment: comment });
        if (state.footprints.length > 300) state.footprints.length = 300;
        state.taChecksSinceMove = 0;
        saveState();
        refreshBadge();

        var pn = getPartnerName();
        if (typeof showNotification === 'function') showNotification(pn + ' 去了 ' + label, 'info', 3500);
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random(), sender: 'system', text: pn + ' 去了' + label + '，' + comment, timestamp: new Date(), type: 'system' });
        }
        if (overlay && overlay.style.display !== 'none') { if (curKey() === mapKey) render(); }
        return true;
    }
    window.mapTestMoveTa = function (mode) { if (state) moveTaNow(mode || undefined); else loadState().then(function () { moveTaNow(mode || undefined); }); };

    function scheduleTaCheck() {
        if (_taCheckTimer) clearTimeout(_taCheckTimer);
        var delay = randInt(30, 90) * 60 * 1000;
        _taCheckTimer = setTimeout(function () {
            if (state) {
                var chance = getMoveChance(state.taChecksSinceMove || 0);
                if (Math.random() < chance) {
                    moveTaNow();
                } else {
                    state.taChecksSinceMove = (state.taChecksSinceMove || 0) + 1;
                    saveState();
                }
            }
            scheduleTaCheck();
        }, delay);
    }

    // ==================== 角标 ====================
    function refreshBadge() {
        if (typeof window.appBadges === 'undefined' || !state) return;
        var lastSeen = 0;
        try { lastSeen = parseInt(safeGetItem(mapStorageKey() + '_seen') || '0', 10) || 0; } catch (e) {}
        var unread = state.footprints.filter(function (f) { return f.ts > lastSeen; }).length;
        window.appBadges.set('map-function', unread);
    }
    function markSeen() {
        try { safeSetItem(mapStorageKey() + '_seen', String(Date.now())); } catch (e) {}
        refreshBadge();
    }

    // ==================== 陪伴联动 ====================
    window.mapSyncCompanionTogether = function () {
        if (!state) return;
        // 不是每次陪伴都非要"传送"到同一个房间——40%概率是真的凑到一起，
        // 剩下60%就当是那种"各自在各自的地方，但陪伴照常进行"的远程感觉，
        // 位置不动，也不特意留记录
        if (Math.random() >= 0.4) return;

        state.me = { mapKey: 'my_home', x: 250, y: 150 };
        state.ta = { mapKey: 'my_home', x: 300, y: 180 };
        state.footprints.unshift({ ts: Date.now(), mapKey: 'my_home', x: 300, y: 180, locationName: '客厅（陪伴中）', comment: generateMoveComment() });
        if (state.footprints.length > 300) state.footprints.length = 300;
        saveState();
        refreshBadge();
        if (overlay && overlay.style.display !== 'none' && curKey() === 'my_home') render();
    };

    // ==================== UI 构建 ====================
    function buildOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'map2-overlay';
        overlay.innerHTML = ''
            + '<div class="m2-header">'
            +   '<button id="m2-back" class="m2-icon-btn"><i class="fas fa-chevron-left"></i></button>'
            +   '<div class="m2-title" id="m2-title">地图</div>'
            +   '<button id="m2-menu" class="m2-icon-btn"><i class="fas fa-ellipsis"></i></button>'
            + '</div>'
            + '<div class="m2-canvas-wrap" id="m2-canvas-wrap">'
            +   '<canvas id="m2-canvas"></canvas>'
            +   '<div class="m2-hint" id="m2-hint">双指缩放 · 拖拽平移 · 点地点查看</div>'
            + '</div>'
            + '<div class="m2-bottombar">'
            +   '<button class="m2-bbtn" id="m2-locate-me"><i class="fas fa-location-crosshairs"></i><span>我</span></button>'
            +   '<button class="m2-bbtn" id="m2-locate-ta"><i class="fas fa-location-crosshairs"></i><span id="m2-ta-label">TA</span></button>'
            +   '<button class="m2-bbtn m2-bbtn-main" id="m2-move-me"><i class="fas fa-person-walking-arrow-right"></i><span>移动我</span></button>'
            +   '<button class="m2-bbtn" id="m2-add-loc"><i class="fas fa-plus"></i><span>加地点</span></button>'
            +   '<button class="m2-bbtn" id="m2-footprints"><i class="fas fa-shoe-prints"></i><span>足迹</span></button>'
            + '</div>'
            + '<div class="m2-sheet-mask" id="m2-sheet-mask"></div>'
            + '<div class="m2-sheet" id="m2-sheet"><div class="m2-sheet-handle"></div><div class="m2-sheet-body" id="m2-sheet-body"></div></div>';
        document.body.appendChild(overlay);

        canvas = document.getElementById('m2-canvas');
        ctx = canvas.getContext('2d');
        viewEl = document.getElementById('m2-canvas-wrap');

        bindChrome();
        bindCanvasTouch();
    }

    function openSheet(html) {
        document.getElementById('m2-sheet-body').innerHTML = html;
        document.getElementById('m2-sheet').classList.add('open');
        document.getElementById('m2-sheet-mask').classList.add('open');
    }
    function closeSheet() {
        document.getElementById('m2-sheet').classList.remove('open');
        document.getElementById('m2-sheet-mask').classList.remove('open');
    }

    function bindChrome() {
        document.getElementById('m2-back').addEventListener('click', function () {
            if (mapStack.length > 1) { mapStack.pop(); resizeAndCenter(); render(); updateTitle(); }
            else hide();
        });
        document.getElementById('m2-sheet-mask').addEventListener('click', closeSheet);

        document.getElementById('m2-menu').addEventListener('click', function () {
            openSheet(''
                + '<div class="m2-sheet-title">更多</div>'
                + '<button class="m2-list-btn" id="m2-menu-testmove"><i class="fas fa-shuffle"></i> 让' + escapeHtml(getPartnerName()) + '现在移动</button>'
                + '<button class="m2-list-btn" id="m2-menu-testmove-rand"><i class="fas fa-dice"></i> 让' + escapeHtml(getPartnerName()) + '去一个随机坐标</button>'
                + '<button class="m2-list-btn m2-danger" id="m2-menu-reset"><i class="fas fa-arrow-rotate-left"></i> 重置为默认布局</button>'
            );
            document.getElementById('m2-menu-testmove').addEventListener('click', function () {
                moveTaNow('location'); closeSheet();
            });
            document.getElementById('m2-menu-testmove-rand').addEventListener('click', function () {
                moveTaNow('random'); closeSheet();
            });
            document.getElementById('m2-menu-reset').addEventListener('click', function () {
                if (!confirm('确定要重置吗？所有自定义地点和足迹记录都会清空，恢复默认布局，不可撤销。')) return;
                if (typeof localforage !== 'undefined') localforage.removeItem(mapStorageKey()).catch(function () {});
                state = freshState();
                mapStack = ['root'];
                resizeAndCenter(); render(); updateTitle();
                closeSheet();
                if (typeof showNotification === 'function') showNotification('已重置为默认布局', 'success');
            });
        });

        document.getElementById('m2-locate-me').addEventListener('click', function () { jumpTo('me'); });
        document.getElementById('m2-locate-ta').addEventListener('click', function () { jumpTo('ta'); });
        document.getElementById('m2-move-me').addEventListener('click', openMovePicker);
        document.getElementById('m2-add-loc').addEventListener('click', function () { openLocationForm(null); });
        document.getElementById('m2-footprints').addEventListener('click', openFootprints);
    }

    function updateTitle() {
        document.getElementById('m2-title').textContent = curMap().title || curKey();
        document.getElementById('m2-ta-label').textContent = getPartnerName() ? getPartnerName().slice(0, 4) : 'TA';
    }

    // ==================== 触摸交互 ====================
    function bindCanvasTouch() {
        var lastPinchDist = null;
        var dragStart = null;
        var moved = false;

        canvas.addEventListener('touchstart', function (e) {
            moved = false;
            if (e.touches.length === 1) {
                dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: panX, panY: panY };
            } else if (e.touches.length === 2) {
                lastPinchDist = dist(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY);
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', function (e) {
            if (e.touches.length === 1 && dragStart) {
                var dx = e.touches[0].clientX - dragStart.x;
                var dy = e.touches[0].clientY - dragStart.y;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
                panX = dragStart.panX + dx;
                panY = dragStart.panY + dy;
                render();
                e.preventDefault();
            } else if (e.touches.length === 2 && lastPinchDist) {
                var d = dist(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY);
                var ratio = d / lastPinchDist;
                zoom = Math.max(0.4, Math.min(2.5, zoom * ratio));
                lastPinchDist = d;
                moved = true;
                render();
                e.preventDefault();
            }
        }, { passive: false });

        canvas.addEventListener('touchend', function (e) {
            if (!moved && e.changedTouches.length === 1 && (!e.touches || e.touches.length === 0)) {
                var rect = canvas.getBoundingClientRect();
                var sx = e.changedTouches[0].clientX - rect.left;
                var sy = e.changedTouches[0].clientY - rect.top;
                handleTap(sx, sy);
            }
            dragStart = null; lastPinchDist = null;
        });

        var mouseDown = false, mDragStart = null, mMoved = false;
        canvas.addEventListener('mousedown', function (e) {
            mouseDown = true; mMoved = false;
            mDragStart = { x: e.clientX, y: e.clientY, panX: panX, panY: panY };
        });
        canvas.addEventListener('mousemove', function (e) {
            if (!mouseDown || !mDragStart) return;
            var dx = e.clientX - mDragStart.x, dy = e.clientY - mDragStart.y;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) mMoved = true;
            panX = mDragStart.panX + dx; panY = mDragStart.panY + dy;
            render();
        });
        canvas.addEventListener('mouseup', function (e) {
            if (!mMoved) {
                var rect = canvas.getBoundingClientRect();
                handleTap(e.clientX - rect.left, e.clientY - rect.top);
            }
            mouseDown = false; mDragStart = null;
        });
        canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            zoom = Math.max(0.4, Math.min(2.5, zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
            render();
        }, { passive: false });
    }

    function screenToWorld(sx, sy) {
        return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
    }

    function handleTap(sx, sy) {
        var p = screenToWorld(sx, sy);
        var m = curMap();
        var best = null, bestD = 26 / zoom;
        (m.locations || []).forEach(function (loc) {
            var d = dist(p.x, p.y, loc.x, loc.y);
            if (d < bestD) { bestD = d; best = loc; }
        });
        if (state.me.mapKey === curKey()) {
            var dme = dist(p.x, p.y, state.me.x, state.me.y);
            if (dme < bestD) { bestD = dme; best = { special: 'me' }; }
        }
        if (state.ta.mapKey === curKey()) {
            var dta = dist(p.x, p.y, state.ta.x, state.ta.y);
            if (dta < bestD) { bestD = dta; best = { special: 'ta' }; }
        }
        if (!best) return;
        if (best.special === 'me') { openPersonSheet('me'); return; }
        if (best.special === 'ta') { openPersonSheet('ta'); return; }
        openLocationDetail(best);
    }

    // ==================== 渲染 ====================
    function resizeAndCenter() {
        if (!canvas || !viewEl) return;
        var dpr = window.devicePixelRatio || 1;
        var cw = viewEl.clientWidth, ch = viewEl.clientHeight;
        canvas.width = cw * dpr; canvas.height = ch * dpr;
        canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var m = curMap();
        zoom = Math.min(cw / m.w, ch / m.h, 1) * 0.92;
        panX = cw / 2 - (m.w / 2) * zoom;
        panY = ch / 2 - (m.h / 2) * zoom;
    }

    function iconGlyph(name) {
        var map = {
            'fa-house': '\uf015', 'fa-door-open': '\uf52b', 'fa-couch': '\uf4b8', 'fa-bed': '\uf236',
            'fa-moon': '\uf186', 'fa-toilet': '\uf7d8', 'fa-bath': '\uf2cd', 'fa-kitchen-set': '\ue51a',
            'fa-sun': '\uf185', 'fa-train': '\uf238', 'fa-school': '\uf549', 'fa-graduation-cap': '\uf19d',
            'fa-chalkboard': '\uf51b', 'fa-book-open': '\uf518', 'fa-store': '\uf54e', 'fa-cart-shopping': '\uf07a',
            'fa-shirt': '\uf553', 'fa-mug-hot': '\uf7b6', 'fa-film': '\uf008', 'fa-martini-glass': '\uf57b',
            'fa-city': '\uf64f', 'fa-tooth': '\uf5c9', 'fa-tree': '\uf1bb', 'fa-umbrella-beach': '\uf5ca',
            'fa-mountain': '\uf6fc', 'fa-seedling': '\uf4d8', 'fa-satellite': '\uf7bf', 'fa-satellite-dish': '\uf7c0',
            'fa-landmark': '\uf66f', 'fa-briefcase': '\uf0b1', 'fa-people-group': '\ue533', 'fa-flask': '\uf0c3',
            'fa-box-archive': '\uf187', 'fa-star': '\uf005', 'fa-rocket': '\uf135', 'fa-heart': '\uf004',
            'fa-gamepad': '\uf11b', 'fa-dumbbell': '\uf44b', 'fa-hospital': '\uf0f8', 'fa-paw': '\uf1b0',
            'fa-gift': '\uf06b', 'fa-music': '\uf001', 'fa-location-dot': '\uf3c5', 'fa-user': '\uf007'
        };
        return map[name] || '\uf3c5';
    }

    function render() {
        if (!ctx || !state) return;
        var m = curMap();
        ctx.clearRect(0, 0, viewEl.clientWidth, viewEl.clientHeight);
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);

        ctx.fillStyle = '#eef1e8';
        ctx.fillRect(-2000, -2000, m.w + 4000, m.h + 4000);

        (m.zones || []).forEach(function (z) {
            ctx.fillStyle = z.color;
            roundRect(ctx, z.x, z.y, z.w, z.h, 16);
            ctx.fill();
        });

        (m.roads || []).forEach(function (r) {
            ctx.strokeStyle = '#c9beac';
            ctx.lineWidth = r.w;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(r.x1, r.y1);
            ctx.lineTo(r.x2, r.y2);
            ctx.stroke();
        });

        (m.locations || []).forEach(function (loc) {
            drawLocationMarker(loc.x, loc.y, loc.color, loc.icon, loc.name, !!loc.submapKey);
        });

        if (state.me.mapKey === curKey()) drawPerson(state.me.x, state.me.y, _meAvatarImg, '#7BC8A4', getMyName(), 'fa-user');
        if (state.ta.mapKey === curKey()) drawPerson(state.ta.x, state.ta.y, _taAvatarImg, '#c5a47e', getPartnerName(), 'fa-user');

        ctx.restore();
    }

    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    function drawLocationMarker(x, y, color, icon, name, hasSub) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath(); ctx.ellipse(x, y + 20, 11, 4, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = color || '#7FA6CD';
        roundRect(ctx, x - 15, y - 15, 30, 30, 8); ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '900 15px "Font Awesome 6 Free"';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(iconGlyph(icon), x, y);

        if (hasSub) {
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath(); ctx.arc(x + 12, y - 12, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = color || '#7FA6CD';
            ctx.font = '900 7px "Font Awesome 6 Free"';
            ctx.fillText('\uf061', x + 12, y - 12);
        }

        ctx.fillStyle = '#1a1a1a';
        ctx.font = '500 11px "Noto Serif SC", serif';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(name, x, y + 32);
    }

    function drawPerson(x, y, avatarImg, fallbackColor, label, fallbackIcon) {
        ctx.save();
        ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = fallbackColor; ctx.stroke();

        if (avatarImg) {
            ctx.save();
            ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(avatarImg, x - 16, y - 16, 32, 32);
            ctx.restore();
        } else {
            ctx.fillStyle = fallbackColor;
            ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '900 14px "Font Awesome 6 Free"';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(iconGlyph(fallbackIcon), x, y);
        }
        ctx.restore();

        // 如果这个位置正好跟某个地点重合（比如"移动我的位置"移到了具体地点上），
        // 地点自己的名字标签画在 y+32，这里就往下多让开一截，不然两行字会叠在一起
        var labelOffset = 34;
        try {
            var nearby = (curMap().locations || []).some(function (loc) { return dist(loc.x, loc.y, x, y) < 6; });
            if (nearby) labelOffset = 50;
        } catch (e) {}

        ctx.fillStyle = '#1a1a1a';
        ctx.font = '600 11px "Noto Serif SC", serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, x, y + labelOffset);
    }

    // ==================== 跳转 ====================
    function jumpTo(who) {
        var target = state[who];
        if (!target) return;
        if (target.mapKey !== curKey()) {
            mapStack = target.mapKey === 'root' ? ['root'] : ['root', target.mapKey];
            resizeAndCenter();
            updateTitle();
        }
        panX = viewEl.clientWidth / 2 - target.x * zoom;
        panY = viewEl.clientHeight / 2 - target.y * zoom;
        render();
        var label = who === 'me' ? getMyName() : getPartnerName();
        if (typeof showNotification === 'function') showNotification('已定位到 ' + label + ' 的位置', 'success', 2000);
    }

    // ==================== 地点详情 / 编辑 / 删除 ====================
    function openLocationDetail(loc) {
        var visits = state.footprints.filter(function (f) { return f.locationName === loc.name; }).length;
        var visitLine = visits > 0
            ? ('<div class="m2-visit-line"><i class="fas fa-shoe-prints"></i> ' + escapeHtml(getPartnerName()) + ' 最近来过这里 ' + visits + ' 次</div>')
            : '';
        var subBtn = loc.submapKey ? '<button class="m2-list-btn" id="m2-enter-sub"><i class="fas fa-arrow-right"></i> 进入 ' + escapeHtml(loc.name) + '</button>' : '';
        openSheet(''
            + '<div class="m2-sheet-title"><i class="fas ' + loc.icon + '" style="color:' + loc.color + ';margin-right:6px;"></i>' + escapeHtml(loc.name) + '</div>'
            + visitLine
            + subBtn
            + '<button class="m2-list-btn" id="m2-edit-loc"><i class="fas fa-pen"></i> 编辑</button>'
            + '<button class="m2-list-btn m2-danger" id="m2-del-loc"><i class="fas fa-trash-alt"></i> 删除</button>'
        );
        if (loc.submapKey) {
            document.getElementById('m2-enter-sub').addEventListener('click', function () {
                if (!state.maps[loc.submapKey]) return;
                mapStack.push(loc.submapKey);
                resizeAndCenter(); render(); updateTitle();
                closeSheet();
            });
        }
        document.getElementById('m2-edit-loc').addEventListener('click', function () { openLocationForm(loc); });
        document.getElementById('m2-del-loc').addEventListener('click', function () {
            if (!confirm('确定删除"' + loc.name + '"吗？')) return;
            var m = curMap();
            m.locations = m.locations.filter(function (l) { return l.id !== loc.id; });
            saveState(); render(); closeSheet();
        });
    }

    function openPersonSheet(who) {
        var label = who === 'me' ? getMyName() : getPartnerName();
        openSheet(''
            + '<div class="m2-sheet-title">' + escapeHtml(label) + '</div>'
            + '<div style="font-size:12px;color:var(--text-secondary);padding:0 2px 12px;">当前位置：' + escapeHtml(curMap().title || curKey()) + '</div>'
            + (who === 'me' ? '<button class="m2-list-btn" id="m2-sheet-move-me"><i class="fas fa-person-walking-arrow-right"></i> 移动到别的地方</button>' : '')
        );
        if (who === 'me') {
            document.getElementById('m2-sheet-move-me').addEventListener('click', function () { closeSheet(); openMovePicker(); });
        }
    }

    // ==================== 加/编辑地点表单 ====================
    function openLocationForm(existing) {
        var isNew = !existing;
        var iconGrid = ICON_CHOICES.map(function (ic) {
            return '<div class="m2-icon-choice" data-icon="' + ic + '"><i class="fas ' + ic + '"></i></div>';
        }).join('');
        openSheet(''
            + '<div class="m2-sheet-title">' + (isNew ? '添加地点' : '编辑地点') + '</div>'
            + '<input type="text" id="m2-form-name" class="m2-input" placeholder="地点名字" value="' + (existing ? escapeHtml(existing.name) : '') + '">'
            + '<div class="m2-form-label">选个图标</div>'
            + '<div class="m2-icon-grid" id="m2-icon-grid">' + iconGrid + '</div>'
            + '<button class="m2-list-btn m2-primary" id="m2-form-save">' + (isNew ? '添加到地图中央（之后可拖动）' : '保存') + '</button>'
        );
        var selectedIcon = existing ? existing.icon : ICON_CHOICES[0];
        var grid = document.getElementById('m2-icon-grid');
        function markSelected() {
            grid.querySelectorAll('.m2-icon-choice').forEach(function (el) {
                el.classList.toggle('sel', el.getAttribute('data-icon') === selectedIcon);
            });
        }
        markSelected();
        grid.querySelectorAll('.m2-icon-choice').forEach(function (el) {
            el.addEventListener('click', function () { selectedIcon = this.getAttribute('data-icon'); markSelected(); });
        });
        document.getElementById('m2-form-save').addEventListener('click', function () {
            var name = document.getElementById('m2-form-name').value.trim();
            if (!name) { if (typeof showNotification === 'function') showNotification('请输入地点名字', 'warning'); return; }
            var m = curMap();
            if (isNew) {
                m.locations.push({ id: generateId(), x: m.w / 2, y: m.h / 2, name: name, icon: selectedIcon, color: pick(['#7BC8A4', '#BB9EC7', '#F4A6B3', '#7FA6CD', '#c5a47e']) });
            } else {
                existing.name = name; existing.icon = selectedIcon;
            }
            saveState(); render(); closeSheet();
        });
    }

    // ==================== 移动我的位置 ====================
    function openMovePicker() {
        var flat = [];
        Object.keys(state.maps).forEach(function (mk) {
            (state.maps[mk].locations || []).forEach(function (loc) {
                flat.push({ mapKey: mk, mapTitle: state.maps[mk].title || mk, loc: loc });
            });
        });
        var listHtml = flat.map(function (item) {
            return '<div class="m2-pick-item" data-map="' + item.mapKey + '" data-x="' + item.loc.x + '" data-y="' + item.loc.y + '">'
                + '<i class="fas ' + item.loc.icon + '" style="color:' + item.loc.color + ';width:20px;"></i>'
                + '<div><div class="m2-pick-name">' + escapeHtml(item.loc.name) + '</div><div class="m2-pick-sub">' + escapeHtml(item.mapTitle) + '</div></div>'
                + '</div>';
        }).join('');
        openSheet('<div class="m2-sheet-title">移动我的位置到…</div><div class="m2-pick-list">' + listHtml + '</div>');
        document.querySelectorAll('.m2-pick-item').forEach(function (el) {
            el.addEventListener('click', function () {
                state.me = { mapKey: this.getAttribute('data-map'), x: parseFloat(this.getAttribute('data-x')), y: parseFloat(this.getAttribute('data-y')) };
                saveState();
                if (curKey() === state.me.mapKey) render();
                closeSheet();
                if (typeof showNotification === 'function') showNotification('已移动到新位置', 'success');
            });
        });
    }

    // ==================== 足迹 ====================
    function openFootprints() {
        markSeen();
        if (!state.footprints.length) {
            openSheet('<div class="m2-sheet-title">足迹</div><div class="m2-empty">还没有足迹记录</div>');
            return;
        }
        var html = state.footprints.slice(0, 100).map(function (f) {
            var d = new Date(f.ts);
            var timeStr = d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            return '<div class="m2-footprint-item">'
                + '<div class="m2-fp-time">' + timeStr + '</div>'
                + '<div class="m2-fp-text"><b>' + escapeHtml(getPartnerName()) + '</b> 去了 <b>' + escapeHtml(f.locationName) + '</b></div>'
                + '<div class="m2-fp-comment">' + escapeHtml(f.comment || '') + '</div>'
                + '</div>';
        }).join('');
        openSheet('<div class="m2-sheet-title">足迹（共 ' + state.footprints.length + ' 条）</div>' + html);
    }

    // ==================== 公开 API ====================
    function show() {
        if (!overlay) buildOverlay();
        overlay.style.display = 'flex';
        // 只在第一次打开（内存里还没有数据）时才去读存储；之后每次打开都复用内存里的
        // state——它本来就是实时最新的，没必要重新读一遍，这样也避免"刚保存完立刻
        // 关闭再打开，写入还没落盘、读到旧数据"这种读写抢跑导致改动看起来"变回去了"
        var initPromise = state ? Promise.resolve() : loadState();
        initPromise.then(function () {
            loadAvatars();
            mapStack = ['root'];
            resizeAndCenter();
            updateTitle();
            render();
            refreshBadge();
            if (!_taCheckTimer) scheduleTaCheck();

            // 兜底：万一图标字体这时候还没真正下载完，等它加载好了再补画一次
            if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
                document.fonts.ready.then(function () { render(); }).catch(function () {});
            }
        });
    }
    function hide() {
        if (overlay) overlay.style.display = 'none';
        closeSheet();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                loadState().then(function () {
                    refreshBadge();
                    scheduleTaCheck();
                });
            }
        }, 300);
        window.addEventListener('resize', function () {
            if (overlay && overlay.style.display !== 'none') { resizeAndCenter(); render(); }
        });
    });

    window.MapApp = { show: show, hide: hide };
})();
