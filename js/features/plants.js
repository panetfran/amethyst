/**
 * features/plants.js - 养植物（巴西木 / 虎尾兰）
 *
 * 无 AI：浇水/施肥/松土/晒太阳四个动作，冷却时间参考真实习性；
 * 四项数值（水分/养分/日照/疏松度）随时间自然衰减，照顾得好会慢慢长大，
 * 长期不管会枯萎。成长日志是手写的一小批描述性短句，不是聊天对话。
 *
 * 依赖：getStorageKey, localforage, showNotification, SESSION_ID
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    function storageKey() { return (typeof getStorageKey === 'function') ? getStorageKey('plantsData') : 'plantsData'; }
    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings && settings.partnerName) ? settings.partnerName : '梦角';
    }
    function getMyName() {
        return (typeof settings !== 'undefined' && settings && settings.myName) ? settings.myName : '我';
    }
    function actorLabel(actor) {
        if (actor === 'me') return getMyName();
        if (actor === 'ta') return getPartnerName();
        return '';
    }

    // ==================== 植物种类设定 ====================
    var SPECIES = {
        dracaena: {
            name: '巴西木',
            color: '#6b9e5e',
            waterCooldownHrs: 12,       // 半天就能再浇一次
            fertilizeCooldownHrs: 24 * 7,  // 一周施一次肥
            loosenCooldownHrs: 24 * 3,
            sunCooldownHrs: 8,
            decayPerHour: { moisture: 0.4, nutrients: 0.15, sunlight: 0.6, soil: 0.2 }
        },
        sansevieria: {
            name: '虎尾兰',
            color: '#4a7c59',
            waterCooldownHrs: 24,       // 耐旱，但也不用等太久
            fertilizeCooldownHrs: 24 * 10,
            loosenCooldownHrs: 24 * 5,
            sunCooldownHrs: 10,
            decayPerHour: { moisture: 0.2, nutrients: 0.12, sunlight: 0.5, soil: 0.15 }
        }
    };

    var GROWTH_LOG_LINES = {
        water: ['土壤湿润了一些，根须舒展开来。', '水珠顺着叶片滑落，看起来精神了一点。', '喝饱了水，叶尖的颜色深了一些。'],
        fertilize: ['养分慢慢渗进土里。', '叶片的光泽好像更足了。', '土壤里多了一点肥沃的气息。'],
        loosen: ['板结的土被松开了，透气了不少。', '根部周围松软了一些，呼吸更顺畅了。', '土壤变得蓬松，像是伸了个懒腰。'],
        sun: ['晒了会儿太阳，叶子舒展得更开了。', '阳光洒在叶片上，绿色显得更亮了。', '晒足了太阳，整株看起来更精神。'],
        levelUp: ['悄悄又长高了一点点。', '新抽出了一片嫩叶。', '茎干好像更粗壮了一些。'],
        wilting: ['叶尖有点发黄，好像有些日子没被照顾了。', '土壤干裂了，看起来蔫蔫的。', '好久没被打理，状态不太好。']
    };

    // ==================== 状态 ====================
    var state = null;

    function freshState() {
        var now = Date.now();
        return {
            plants: [
                { id: 'p1', species: 'dracaena', nickname: '巴西木', plantedAt: now,
                  moisture: 70, nutrients: 60, sunlight: 60, soil: 70, health: 70, stage: 1,
                  lastWater: 0, lastFertilize: 0, lastLoosen: 0, lastSun: 0, lastDivide: 0,
                  careCount: 0, flowering: null, milestones: [], log: [] },
                { id: 'p2', species: 'sansevieria', nickname: '虎尾兰', plantedAt: now,
                  moisture: 70, nutrients: 60, sunlight: 60, soil: 70, health: 70, stage: 1,
                  lastWater: 0, lastFertilize: 0, lastLoosen: 0, lastSun: 0, lastDivide: 0,
                  careCount: 0, flowering: null, milestones: [], log: [] }
            ],
            lastTick: now
        };
    }

    function loadState() {
        return new Promise(function (resolve) {
            if (typeof localforage === 'undefined') { state = freshState(); resolve(); return; }
            localforage.getItem(storageKey()).then(function (saved) {
                state = (saved && saved.plants) ? saved : freshState();
                normalizeState();
                applyDecay();
                resolve();
            }).catch(function () { state = freshState(); resolve(); });
        });
    }
    function normalizeState() {
        // 兼容旧存档：老数据里没有这几个新字段，缺了就补上默认值，不然后面代码会报错
        state.plants.forEach(function (p) {
            if (typeof p.careCount !== 'number') p.careCount = 0;
            if (!p.milestones) p.milestones = [];
            if (typeof p.lastDivide !== 'number') p.lastDivide = 0;
            if (p.flowering === undefined) p.flowering = null;
        });
    }
    function saveState() {
        if (typeof localforage === 'undefined' || !state) return;
        localforage.setItem(storageKey(), state).catch(function () {});
    }

    // ==================== 衰减 + 成长判定 ====================
    function applyDecay() {
        var now = Date.now();
        var hoursPassed = (now - (state.lastTick || now)) / (1000 * 60 * 60);
        if (hoursPassed <= 0) { state.lastTick = now; return; }
        hoursPassed = Math.min(hoursPassed, 24 * 30); // 最多按30天衰减，避免离线太久数值瞬间归零导致体验很差

        state.plants.forEach(function (p) {
            var sp = SPECIES[p.species];
            p.moisture = clamp(p.moisture - sp.decayPerHour.moisture * hoursPassed, 0, 100);
            p.nutrients = clamp(p.nutrients - sp.decayPerHour.nutrients * hoursPassed, 0, 100);
            p.sunlight = clamp(p.sunlight - sp.decayPerHour.sunlight * hoursPassed, 0, 100);
            p.soil = clamp(p.soil - sp.decayPerHour.soil * hoursPassed, 0, 100);

            var avg = (p.moisture + p.nutrients + p.sunlight + p.soil) / 4;
            var oldHealth = p.health;
            // 健康度缓慢向"四项平均值"靠拢，不会瞬间跳变
            p.health = clamp(p.health + (avg - p.health) * Math.min(1, hoursPassed / 48), 0, 100);

            var oldStage = p.stage;
            if (p.health >= 80) p.stage = 4;
            else if (p.health >= 60) p.stage = 3;
            else if (p.health >= 35) p.stage = 2;
            else p.stage = 1;

            if (p.stage > oldStage) {
                addLog(p, pick(GROWTH_LOG_LINES.levelUp));
            } else if (p.health < 30 && oldHealth >= 30) {
                addLog(p, pick(GROWTH_LOG_LINES.wilting));
                // 健康度掉下去了，花期也提前结束
                if (p.flowering) { p.flowering = null; }
            }

            // 开花：只有茂盛阶段(4)、健康度足够高才可能开花；花期持续几天后自动谢
            if (p.flowering) {
                var floweringDays = (now - p.flowering.startedAt) / (1000 * 60 * 60 * 24);
                if (floweringDays >= p.flowering.durationDays) {
                    p.flowering = null;
                    addLog(p, '花谢了，又变回了熟悉的绿色模样。');
                }
            } else if (p.stage === 4 && p.health >= 80 && hoursPassed > 0) {
                // 按小时累积开花概率，不用等到下次固定周期检查才有机会
                var flowerChancePerHour = 0.0015; // 大约平均一两周会开一次
                if (Math.random() < flowerChancePerHour * hoursPassed) {
                    p.flowering = { startedAt: now, durationDays: 3 + Math.floor(Math.random() * 4) };
                    addLog(p, '悄悄开出了几朵小花！', 'system');
                    checkMilestone(p, 'flowered');
                }
            }

            checkMilestones(p, now);
        });
        state.lastTick = now;
    }

    var MILESTONES = {
        care10: { label: '悉心照料', icon: 'fa-hand-holding-heart', desc: '累计照顾满10次' },
        care50: { label: '养护达人', icon: 'fa-medal', desc: '累计照顾满50次' },
        planted7: { label: '陪伴一周', icon: 'fa-calendar-week', desc: '养了满7天' },
        planted30: { label: '陪伴一月', icon: 'fa-calendar-days', desc: '养了满30天' },
        planted100: { label: '陪伴百日', icon: 'fa-calendar-check', desc: '养了满100天' },
        stage4: { label: '茁壮成长', icon: 'fa-seedling', desc: '长到了茂盛阶段' },
        flowered: { label: '初次绽放', icon: 'fa-fan', desc: '第一次开花' },
        divided: { label: '开枝散叶', icon: 'fa-code-branch', desc: '成功分株一次' }
    };

    function grantMilestone(p, key) {
        if (p.milestones.indexOf(key) !== -1) return;
        p.milestones.push(key);
        var m = MILESTONES[key];
        if (m) addLog(p, '🏅 达成"' + m.label + '"');
    }
    function checkMilestone(p, key) { grantMilestone(p, key); }

    function checkMilestones(p, now) {
        if (p.careCount >= 10) grantMilestone(p, 'care10');
        if (p.careCount >= 50) grantMilestone(p, 'care50');
        var days = (now - p.plantedAt) / (1000 * 60 * 60 * 24);
        if (days >= 7) grantMilestone(p, 'planted7');
        if (days >= 30) grantMilestone(p, 'planted30');
        if (days >= 100) grantMilestone(p, 'planted100');
        if (p.stage >= 4) grantMilestone(p, 'stage4');
    }

    function addLog(p, text, actor) {
        p.log.unshift({ ts: Date.now(), text: text, actor: actor || 'system' });
        if (p.log.length > 60) p.log.length = 60;
    }

    function hoursSince(ts) { return ts ? (Date.now() - ts) / (1000 * 60 * 60) : Infinity; }
    function fmtHours(h) {
        if (h < 1) return Math.round(h * 60) + ' 分钟';
        if (h < 24) return Math.round(h) + ' 小时';
        return Math.round(h / 24) + ' 天';
    }

    var ACTIONS = {
        water: { label: '浇水', icon: 'fa-tint', field: 'moisture', cooldownField: 'waterCooldownHrs', lastField: 'lastWater' },
        fertilize: { label: '施肥', icon: 'fa-flask', field: 'nutrients', cooldownField: 'fertilizeCooldownHrs', lastField: 'lastFertilize' },
        loosen: { label: '松土', icon: 'fa-hand-sparkles', field: 'soil', cooldownField: 'loosenCooldownHrs', lastField: 'lastLoosen' },
        sun: { label: '晒太阳', icon: 'fa-sun', field: 'sunlight', cooldownField: 'sunCooldownHrs', lastField: 'lastSun' }
    };

    function canDo(p, actionKey) {
        var sp = SPECIES[p.species];
        var a = ACTIONS[actionKey];
        var cooldownHrs = sp[a.cooldownField];
        var last = p[a.lastField];
        return hoursSince(last) >= cooldownHrs;
    }

    var DIVIDE_COOLDOWN_HRS = 24 * 45; // 45天才能再分一次株
    var MAX_PLANTS = 6; // 植株数量上限，防止分株无限繁殖把列表撑爆
    var DIVIDE_NICKNAMES = ['新苗', '小苗苗', '分身'];

    function divideePlant(parent) {
        if (state.plants.length >= MAX_PLANTS) {
            if (typeof showNotification === 'function') showNotification('植株数量已经到上限啦', 'warning');
            return;
        }
        var now = Date.now();
        var sp = SPECIES[parent.species];
        var childNickname = parent.nickname + '·' + pick(DIVIDE_NICKNAMES);
        var child = {
            id: 'p_' + now + '_' + Math.floor(Math.random() * 10000),
            species: parent.species,
            nickname: childNickname,
            plantedAt: now,
            moisture: 60, nutrients: 50, sunlight: 50, soil: 60, health: 55, stage: 1,
            lastWater: 0, lastFertilize: 0, lastLoosen: 0, lastSun: 0, lastDivide: 0,
            careCount: 0, flowering: null, milestones: [], log: []
        };
        addLog(child, '从' + parent.nickname + '身上分出来的一株新苗，开始独自生长。');
        state.plants.push(child);

        parent.lastDivide = now;
        addLog(parent, '分出了一株新苗，' + sp.name + '就是这样慢慢"开枝散叶"的。');
        grantMilestone(parent, 'divided');

        saveState();
        if (typeof showNotification === 'function') showNotification('分株成功！多了一株"' + childNickname + '"', 'success', 3500);
    }

    function doAction(p, actionKey, actor) {
        var a = ACTIONS[actionKey];
        if (!canDo(p, actionKey)) return false;
        p[a.field] = 100; // 直接补满，不再是"加固定值"——避免衰减速度稍快就导致长期净亏损
        p[a.lastField] = Date.now();
        p.careCount = (p.careCount || 0) + 1;
        addLog(p, pick(GROWTH_LOG_LINES[actionKey]), actor || 'me');
        applyDecay();
        saveState();
        return true;
    }

    // ==================== SVG 植株形态 ====================
    function plantSvg(species, stage, health, flowering) {
        var sp = SPECIES[species];
        var color = sp.color;
        var wilted = health < 30;
        var leafColor = wilted ? '#b5a86a' : color;
        var potColor = '#c98a5e';

        var leaves = '';
        var flowers = '';
        var leafCount = stage; // 1~4
        var baseY = 150;
        for (var i = 0; i < leafCount + 2; i++) {
            var angle = (i / (leafCount + 2)) * Math.PI - Math.PI / 2;
            var len = 30 + stage * 12 + (i % 2 === 0 ? 8 : 0);
            var lx = 100 + Math.sin(angle) * len * 0.5;
            var ly = baseY - Math.cos(angle) * len;
            leaves += '<path d="M100,' + baseY + ' Q' + (100 + Math.sin(angle) * len * 0.3) + ',' + (baseY - len * 0.6) + ' ' + lx + ',' + ly + '" '
                + 'stroke="' + leafColor + '" stroke-width="' + (6 - stage * 0.5) + '" fill="none" stroke-linecap="round" opacity="' + (wilted ? 0.55 : 0.9) + '"/>';
            if (flowering && !wilted && i % 2 === 0) {
                flowers += '<circle cx="' + lx + '" cy="' + ly + '" r="5" fill="#f4a6c1"/>'
                    + '<circle cx="' + lx + '" cy="' + ly + '" r="2" fill="#fff2a8"/>';
            }
        }

        return '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">'
            + '<ellipse cx="100" cy="205" rx="42" ry="8" fill="rgba(0,0,0,0.08)"/>'
            + '<path d="M65,150 L75,205 L125,205 L135,150 Z" fill="' + potColor + '"/>'
            + '<rect x="60" y="140" width="80" height="14" rx="4" fill="' + potColor + '"/>'
            + leaves
            + flowers
            + '</svg>';
    }

    // ==================== 角标 ====================
    // ==================== 梦角自己照顾植物（后台）====================
    var _taCareTimer = null;

    function taTryCare() {
        if (!state) return;
        // 找出所有"冷却已过、且数值不算太高"的可选项，优先照顾更需要的那个，
        // 但也留一点随机性，不是每次都精确挑最低的那项
        var candidates = [];
        state.plants.forEach(function (p) {
            Object.keys(ACTIONS).forEach(function (key) {
                if (canDo(p, key)) {
                    var a = ACTIONS[key];
                    candidates.push({ plant: p, actionKey: key, value: p[a.field] });
                }
            });
        });
        if (!candidates.length) return;

        candidates.sort(function (a, b) { return a.value - b.value; });
        var poolSize = Math.max(1, Math.ceil(candidates.length * 0.4)); // 从"最需要照顾的前40%"里随机挑一个
        var chosen = pick(candidates.slice(0, poolSize));

        var ok = doAction(chosen.plant, chosen.actionKey, 'ta');
        if (!ok) return;

        var pn = getPartnerName();
        var actionLabel = ACTIONS[chosen.actionKey].label;
        if (typeof showNotification === 'function') showNotification(pn + ' 帮 ' + chosen.plant.nickname + ' ' + actionLabel + '了', 'info', 3000);
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random(), sender: 'system', text: pn + ' 帮 ' + chosen.plant.nickname + ' ' + actionLabel + '了 ✦', timestamp: new Date(), type: 'system' });
        }
        refreshBadge();
    }

    function scheduleTaCare() {
        if (_taCareTimer) clearTimeout(_taCareTimer);
        var delay = (20 + Math.random() * 20) * 60 * 1000; // 20~40分钟检查一次
        _taCareTimer = setTimeout(function () {
            if (Math.random() < 0.3) taTryCare(); // 30%概率真的照顾一下
            scheduleTaCare();
        }, delay);
    }
    window.plantsTestTaCare = function () {
        if (state) taTryCare();
        else loadState().then(taTryCare);
    };

    function refreshBadge() {
        if (typeof window.appBadges === 'undefined' || !state) return;
        var needsCare = state.plants.filter(function (p) {
            return Object.keys(ACTIONS).some(function (k) { return canDo(p, k); }) && p.health < 60;
        }).length;
        window.appBadges.set('plants-function', needsCare);
    }

    // ==================== UI ====================
    function renderList() {
        var wrap = document.getElementById('plants-list');
        if (!wrap) return;
        applyDecay(); saveState(); refreshBadge();
        wrap.innerHTML = state.plants.map(function (p) {
            var sp = SPECIES[p.species];
            return '<div class="pl-card" data-id="' + p.id + '">'
                + '<div class="pl-card-svg">' + plantSvg(p.species, p.stage, p.health, !!p.flowering) + '</div>'
                + '<div class="pl-card-name">' + escapeHtml(p.nickname) + '</div>'
                + '<div class="pl-card-species">' + escapeHtml(sp.name) + ' · 阶段 ' + p.stage + '/4</div>'
                + '<div class="pl-bar-mini"><div class="pl-bar-fill" style="width:' + Math.round(p.health) + '%;background:' + (p.health < 30 ? '#e74c3c' : sp.color) + ';"></div></div>'
                + '</div>';
        }).join('');
        wrap.querySelectorAll('.pl-card').forEach(function (el) {
            el.addEventListener('click', function () { openDetail(this.getAttribute('data-id')); });
        });
    }

    function statBar(label, icon, value) {
        var color = value < 30 ? '#e74c3c' : value < 60 ? '#e0a83c' : '#4cb96a';
        return '<div class="pl-stat-row">'
            + '<i class="fas ' + icon + '"></i>'
            + '<span class="pl-stat-label">' + label + '</span>'
            + '<div class="pl-stat-bar"><div class="pl-stat-fill" style="width:' + Math.round(value) + '%;background:' + color + ';"></div></div>'
            + '<span class="pl-stat-num">' + Math.round(value) + '</span>'
            + '</div>';
    }

    function openDetail(id) {
        var p = state.plants.find(function (x) { return x.id === id; });
        if (!p) return;
        var sp = SPECIES[p.species];

        var flowerBadge = p.flowering ? '<div class="pl-flower-badge"><i class="fas fa-fan"></i> 正在开花～</div>' : '';

        var milestonesHtml = (p.milestones || []).length
            ? '<div class="pl-milestones">' + p.milestones.map(function (key) {
                var m = MILESTONES[key];
                if (!m) return '';
                return '<div class="pl-milestone-badge" title="' + escapeHtml(m.desc) + '"><i class="fas ' + m.icon + '"></i> ' + escapeHtml(m.label) + '</div>';
            }).join('') + '</div>'
            : '';

        var canDivide = p.stage === 4 && hoursSince(p.lastDivide) >= DIVIDE_COOLDOWN_HRS && state.plants.length < MAX_PLANTS;
        var divideBtn = p.stage === 4
            ? ('<button class="pl-list-btn ' + (canDivide ? '' : 'disabled') + '" id="pl-divide-btn">'
                + '<i class="fas fa-code-branch"></i> 分株，养一株新的'
                + (canDivide ? '' : ('<small>' + (state.plants.length >= MAX_PLANTS ? '（植株数量已达上限）' : ('还需 ' + fmtHours(DIVIDE_COOLDOWN_HRS - hoursSince(p.lastDivide)))) + '</small>'))
                + '</button>')
            : '';

        var actionsHtml = Object.keys(ACTIONS).map(function (key) {
            var a = ACTIONS[key];
            var ok = canDo(p, key);
            var cd = sp[a.cooldownField];
            var remain = ok ? 0 : cd - hoursSince(p[a.lastField]);
            return '<button class="pl-action-btn ' + (ok ? '' : 'disabled') + '" data-action="' + key + '" data-id="' + p.id + '">'
                + '<i class="fas ' + a.icon + '"></i>'
                + '<span>' + a.label + '</span>'
                + (ok ? '' : '<small>还需 ' + fmtHours(remain) + '</small>')
                + '</button>';
        }).join('');

        var logHtml = p.log.slice(0, 15).map(function (l) {
            var d = new Date(l.ts);
            var who = actorLabel(l.actor);
            var prefix = who ? ('<b class="pl-log-actor">' + escapeHtml(who) + '</b> ') : '';
            return '<div class="pl-log-item"><span class="pl-log-time">' + d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</span>' + prefix + escapeHtml(l.text) + '</div>';
        }).join('') || '<div class="pl-empty">还没有记录</div>';

        var html = ''
            + '<div class="pl-detail-svg">' + plantSvg(p.species, p.stage, p.health, !!p.flowering) + '</div>'
            + flowerBadge
            + '<div class="pl-detail-title">' + escapeHtml(p.nickname) + ' <span class="pl-detail-species">· ' + escapeHtml(sp.name) + '</span></div>'
            + milestonesHtml
            + '<div class="pl-stats">'
            +   statBar('水分', 'fa-tint', p.moisture)
            +   statBar('养分', 'fa-flask', p.nutrients)
            +   statBar('日照', 'fa-sun', p.sunlight)
            +   statBar('疏松度', 'fa-hand-sparkles', p.soil)
            + '</div>'
            + '<div class="pl-actions">' + actionsHtml + '</div>'
            + divideBtn
            + '<div class="pl-log-title">成长记录</div>'
            + '<div class="pl-log-list">' + logHtml + '</div>';

        document.getElementById('plants-detail-body').innerHTML = html;
        if (typeof showModal === 'function') showModal(document.getElementById('plants-detail-modal'));
        else document.getElementById('plants-detail-modal').classList.add('active');

        if (canDivide) {
            document.getElementById('pl-divide-btn').addEventListener('click', function () {
                divideePlant(p);
                openDetail(id);
                renderList();
            });
        }

        document.querySelectorAll('.pl-action-btn').forEach(function (btn) {
            if (btn.classList.contains('disabled')) return;
            btn.addEventListener('click', function () {
                var ok = doAction(p, this.getAttribute('data-action'), 'me');
                if (ok) {
                    if (typeof showNotification === 'function') showNotification('照顾好了~', 'success', 2000);
                    openDetail(id);
                    renderList();
                }
            });
        });
    }

    // ==================== 初始化 ====================
    function initListeners() {
        var entryBtn = document.getElementById('plants-function');
        if (entryBtn) {
            entryBtn.addEventListener('click', function () {
                loadState().then(function () {
                    renderList();
                    if (typeof showModal === 'function') showModal(document.getElementById('plants-modal'));
                });
            });
        }
        document.getElementById('close-plants-modal')?.addEventListener('click', function () {
            if (typeof hideModal === 'function') hideModal(document.getElementById('plants-modal'));
        });
        document.getElementById('plants-test-ta-btn')?.addEventListener('click', function () {
            taTryCare();
            renderList();
        });
        document.getElementById('close-plants-detail-modal')?.addEventListener('click', function () {
            if (typeof hideModal === 'function') hideModal(document.getElementById('plants-detail-modal'));
            else document.getElementById('plants-detail-modal').classList.remove('active');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                initListeners();
                loadState().then(function () {
                    refreshBadge();
                    scheduleTaCare();
                });
                setInterval(function () { if (state) { applyDecay(); saveState(); refreshBadge(); } }, 30 * 60 * 1000);
            }
        }, 300);
    });
})();
