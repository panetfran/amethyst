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

    // ==================== 持久化的后台调度（跟地图梦角移动用的是同一套思路）====================
    // 纯内存的 setTimeout 有个坑：页面一刷新/关掉标签页重开，计时就清零重新算，
    // 网页应用很少会连续开着十几小时甚至几天不关，长间隔的调度几乎永远攒不到触发的那一刻。
    // 改成把"下次检查时间"存到本地，刷新/重开都能接着算，不会清零重来。
    var _scheduleTimers = {};
    function nextCheckKey(name) {
        return (typeof getStorageKey === 'function') ? getStorageKey('plantsNextCheck_' + name) : ('plantsNextCheck_' + name);
    }
    function scheduleWithPersistence(name, minHours, maxHours, chance, actionFn) {
        if (_scheduleTimers[name]) clearTimeout(_scheduleTimers[name]);
        function pickInterval() { return (minHours + Math.random() * (maxHours - minHours)) * 60 * 60 * 1000; }

        function runCheck() {
            if (Math.random() < chance) { try { actionFn(); } catch (e) {} }
            var nextTime = Date.now() + pickInterval();
            if (typeof localforage !== 'undefined') localforage.setItem(nextCheckKey(name), nextTime).catch(function () {});
            scheduleWithPersistence(name, minHours, maxHours, chance, actionFn);
        }

        if (typeof localforage === 'undefined') {
            _scheduleTimers[name] = setTimeout(runCheck, pickInterval());
            return;
        }
        localforage.getItem(nextCheckKey(name)).then(function (savedTime) {
            var now = Date.now();
            var nextTime = (savedTime && savedTime > now) ? savedTime : (now + pickInterval());
            if (!savedTime || savedTime <= now) {
                localforage.setItem(nextCheckKey(name), nextTime).catch(function () {});
            }
            _scheduleTimers[name] = setTimeout(runCheck, Math.max(1000, nextTime - now));
        }).catch(function () {
            _scheduleTimers[name] = setTimeout(runCheck, pickInterval());
        });
    }
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
            waterCooldownHrs: 12, fertilizeCooldownHrs: 24 * 7, loosenCooldownHrs: 24 * 3, sunCooldownHrs: 8,
            decayPerHour: { moisture: 0.4, nutrients: 0.15, sunlight: 0.6, soil: 0.2 },
            flowerChancePerHour: 0.0015, shapeType: 'foliage', flowerMeaning: '坚韧、生命力'
        },
        sansevieria: {
            name: '虎尾兰',
            color: '#4a7c59',
            waterCooldownHrs: 24, fertilizeCooldownHrs: 24 * 10, loosenCooldownHrs: 24 * 5, sunCooldownHrs: 10,
            decayPerHour: { moisture: 0.2, nutrients: 0.12, sunlight: 0.5, soil: 0.15 },
            flowerChancePerHour: 0.0008, shapeType: 'foliage', flowerMeaning: '守护、坚强不屈'
        },
        platycodon: {
            name: '桔梗',
            color: '#6f8fcf',
            waterCooldownHrs: 16, fertilizeCooldownHrs: 24 * 8, loosenCooldownHrs: 24 * 4, sunCooldownHrs: 9,
            decayPerHour: { moisture: 0.35, nutrients: 0.15, sunlight: 0.5, soil: 0.18 },
            flowerChancePerHour: 0.0038, shapeType: 'singleBloom', flowerMeaning: '永恒的爱，无论如何都不会改变'
        },
        forgetMeNot: {
            name: '勿忘我',
            color: '#7ba9d9',
            waterCooldownHrs: 20, fertilizeCooldownHrs: 24 * 9, loosenCooldownHrs: 24 * 5, sunCooldownHrs: 10,
            decayPerHour: { moisture: 0.3, nutrients: 0.13, sunlight: 0.45, soil: 0.16 },
            flowerChancePerHour: 0.0035, shapeType: 'bushy', flowerMeaning: '请不要忘记我'
        },
        babysBreath: {
            name: '满天星',
            color: '#f5f0ee',
            waterCooldownHrs: 18, fertilizeCooldownHrs: 24 * 8, loosenCooldownHrs: 24 * 4, sunCooldownHrs: 9,
            decayPerHour: { moisture: 0.32, nutrients: 0.14, sunlight: 0.5, soil: 0.17 },
            flowerChancePerHour: 0.004, shapeType: 'starry', flowerMeaning: '喜欢藏在心里，也心甘情愿'
        },
        lilyOfValley: {
            name: '铃兰',
            color: '#e8f0e3',
            waterCooldownHrs: 16, fertilizeCooldownHrs: 24 * 9, loosenCooldownHrs: 24 * 5, sunCooldownHrs: 12,
            decayPerHour: { moisture: 0.35, nutrients: 0.14, sunlight: 0.4, soil: 0.16 },
            flowerChancePerHour: 0.0032, shapeType: 'bell', flowerMeaning: '幸福归来，纯洁'
        },
        hyacinth: {
            name: '风信子',
            color: '#8f7dc9',
            waterCooldownHrs: 14, fertilizeCooldownHrs: 24 * 7, loosenCooldownHrs: 24 * 4, sunCooldownHrs: 8,
            decayPerHour: { moisture: 0.4, nutrients: 0.17, sunlight: 0.55, soil: 0.2 },
            flowerChancePerHour: 0.0042, shapeType: 'spike', flowerMeaning: '恒久的思念'
        },
        violet: {
            name: '紫罗兰',
            color: '#9b7fc7',
            waterCooldownHrs: 18, fertilizeCooldownHrs: 24 * 9, loosenCooldownHrs: 24 * 5, sunCooldownHrs: 10,
            decayPerHour: { moisture: 0.3, nutrients: 0.13, sunlight: 0.45, soil: 0.16 },
            flowerChancePerHour: 0.003, shapeType: 'bushy', flowerMeaning: '永恒的美，谦逊的爱'
        },
        eustoma: {
            name: '洋桔梗',
            color: '#e8c8dc',
            waterCooldownHrs: 15, fertilizeCooldownHrs: 24 * 7, loosenCooldownHrs: 24 * 4, sunCooldownHrs: 9,
            decayPerHour: { moisture: 0.38, nutrients: 0.16, sunlight: 0.5, soil: 0.19 },
            flowerChancePerHour: 0.0036, shapeType: 'singleBloom', flowerMeaning: '真诚不变的爱'
        },
        lavender: {
            name: '薰衣草',
            color: '#b39ddb',
            waterCooldownHrs: 28, fertilizeCooldownHrs: 24 * 10, loosenCooldownHrs: 24 * 6, sunCooldownHrs: 7,
            decayPerHour: { moisture: 0.2, nutrients: 0.1, sunlight: 0.65, soil: 0.15 },
            flowerChancePerHour: 0.0032, shapeType: 'spike', flowerMeaning: '静静等待着一场爱情'
        },
        pansy: {
            name: '三色堇',
            color: '#c77dbd',
            waterCooldownHrs: 16, fertilizeCooldownHrs: 24 * 8, loosenCooldownHrs: 24 * 4, sunCooldownHrs: 8,
            decayPerHour: { moisture: 0.36, nutrients: 0.15, sunlight: 0.55, soil: 0.18 },
            flowerChancePerHour: 0.0038, shapeType: 'bushy', flowerMeaning: '请思念我'
        },
        plumbago: {
            name: '蓝雪花',
            color: '#9ec3e0',
            waterCooldownHrs: 20, fertilizeCooldownHrs: 24 * 9, loosenCooldownHrs: 24 * 5, sunCooldownHrs: 9,
            decayPerHour: { moisture: 0.28, nutrients: 0.12, sunlight: 0.5, soil: 0.15 },
            flowerChancePerHour: 0.003, shapeType: 'bushy', flowerMeaning: '静静地等候一场重逢'
        },
        statice: {
            name: '星辰花',
            color: '#c9a8dd',
            waterCooldownHrs: 26, fertilizeCooldownHrs: 24 * 12, loosenCooldownHrs: 24 * 6, sunCooldownHrs: 8,
            decayPerHour: { moisture: 0.22, nutrients: 0.11, sunlight: 0.55, soil: 0.14 },
            flowerChancePerHour: 0.0034, shapeType: 'starry', flowerMeaning: '永不改变的心意'
        },
        camellia: {
            name: '白山茶',
            color: '#fbfbf6',
            waterCooldownHrs: 22, fertilizeCooldownHrs: 24 * 10, loosenCooldownHrs: 24 * 6, sunCooldownHrs: 11,
            decayPerHour: { moisture: 0.26, nutrients: 0.13, sunlight: 0.42, soil: 0.15 },
            flowerChancePerHour: 0.0028, shapeType: 'singleBloom', flowerMeaning: '谦让，理想中的爱'
        },
        sunflower: {
            name: '向日葵',
            color: '#f2c94c',
            waterCooldownHrs: 14, fertilizeCooldownHrs: 24 * 7, loosenCooldownHrs: 24 * 4, sunCooldownHrs: 5,
            decayPerHour: { moisture: 0.45, nutrients: 0.18, sunlight: 0.9, soil: 0.2 },
            flowerChancePerHour: 0.0045, shapeType: 'singleBloom', flowerMeaning: '沉默的爱，只属于你的注视'
        }
    };
    var STARTER_SPECIES = ['dracaena', 'sansevieria']; // 一开始默认养的两盆
    var ALL_SPECIES_KEYS = Object.keys(SPECIES);

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
            graduated: [],
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
        if (!state.graduated) state.graduated = [];
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
                // 按小时累积开花概率，不用等到下次固定周期检查才有机会；
                // 不同品种开花频率不一样（玫瑰/向日葵这种观花植物比虎尾兰勤快得多）
                var flowerChancePerHour = sp.flowerChancePerHour || 0.0015;
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

    function graduatePlant(p) {
        var sp = SPECIES[p.species];
        var snapshot = {
            id: p.id,
            species: p.species,
            nickname: p.nickname,
            plantedAt: p.plantedAt,
            graduatedAt: Date.now(),
            finalHealth: p.health,
            careCount: p.careCount || 0,
            milestones: (p.milestones || []).slice(),
            everFlowered: (p.milestones || []).indexOf('flowered') !== -1,
            everDivided: (p.milestones || []).indexOf('divided') !== -1
        };
        state.graduated.unshift(snapshot);
        state.plants = state.plants.filter(function (x) { return x.id !== p.id; });
        saveState();
        if (typeof showNotification === 'function') showNotification(p.nickname + ' 结业啦，已经放进纪念墙~', 'success', 3500);
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random(), sender: 'system', text: sp.name + '"' + p.nickname + '"结业啦，已经养得很好了 ✦', timestamp: new Date(), type: 'system' });
        }
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
        var drawColor = wilted ? '#b5a86a' : color;
        var potColor = '#c98a5e';
        var shapeType = sp.shapeType || 'foliage';

        var body;
        switch (shapeType) {
            case 'singleBloom': body = _shapeSingleBloom(drawColor, stage, flowering, wilted); break;
            case 'spike':       body = _shapeSpike(drawColor, stage, flowering, wilted); break;
            case 'bell':        body = _shapeBell(drawColor, stage, flowering, wilted); break;
            case 'starry':      body = _shapeStarry(drawColor, stage, flowering, wilted); break;
            case 'bushy':       body = _shapeBushy(drawColor, stage, flowering, wilted); break;
            default:             body = _shapeFoliage(drawColor, stage, flowering, wilted); break;
        }

        return '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">'
            + '<ellipse cx="100" cy="205" rx="42" ry="8" fill="rgba(0,0,0,0.08)"/>'
            + '<path d="M65,150 L75,205 L125,205 L135,150 Z" fill="' + potColor + '"/>'
            + '<rect x="60" y="140" width="80" height="14" rx="4" fill="' + potColor + '"/>'
            + body
            + '</svg>';
    }

    // ── 观叶型（巴西木/虎尾兰）：从盆口放射出去的几笔叶子，原来的画法 ──
    function _shapeFoliage(color, stage, flowering, wilted) {
        var out = '', baseY = 150;
        var leafCount = stage;
        for (var i = 0; i < leafCount + 2; i++) {
            var angle = (i / (leafCount + 2)) * Math.PI - Math.PI / 2;
            var len = 30 + stage * 12 + (i % 2 === 0 ? 8 : 0);
            var lx = 100 + Math.sin(angle) * len * 0.5;
            var ly = baseY - Math.cos(angle) * len;
            out += '<path d="M100,' + baseY + ' Q' + (100 + Math.sin(angle) * len * 0.3) + ',' + (baseY - len * 0.6) + ' ' + lx + ',' + ly + '" '
                + 'stroke="' + color + '" stroke-width="' + (6 - stage * 0.5) + '" fill="none" stroke-linecap="round" opacity="' + (wilted ? 0.55 : 0.9) + '"/>';
            if (flowering && !wilted && i % 2 === 0) {
                out += '<circle cx="' + lx + '" cy="' + ly + '" r="5" fill="#f4a6c1"/><circle cx="' + lx + '" cy="' + ly + '" r="2" fill="#fff2a8"/>';
            }
        }
        return out;
    }

    // ── 单朵大花型（向日葵/洋桔梗/桔梗/白山茶）：一根主茎，顶端一朵明显的大花 ──
    function _shapeSingleBloom(color, stage, flowering, wilted) {
        var stemH = 25 + stage * 22;
        var topY = 150 - stemH;
        var leafColor = wilted ? '#b5a86a' : '#6b9e5e';
        var out = '<path d="M100,150 L100,' + topY + '" stroke="' + leafColor + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
        // 茎两侧的小叶子
        if (stage >= 2) {
            out += '<path d="M100,' + (topY + stemH * 0.4) + ' Q85,' + (topY + stemH * 0.3) + ' 78,' + (topY + stemH * 0.5) + '" stroke="' + leafColor + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
            out += '<path d="M100,' + (topY + stemH * 0.6) + ' Q115,' + (topY + stemH * 0.5) + ' 122,' + (topY + stemH * 0.7) + '" stroke="' + leafColor + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
        }
        // 花苞/花朵：没开花之前是个含苞的小圆，开花之后是一圈花瓣+花心
        var budR = 8 + stage * 2;
        if (flowering && !wilted) {
            var petalCount = 10;
            for (var i = 0; i < petalCount; i++) {
                var a = (i / petalCount) * Math.PI * 2;
                var px = 100 + Math.cos(a) * (budR + 6);
                var py = topY + Math.sin(a) * (budR + 6);
                out += '<ellipse cx="' + px + '" cy="' + py + '" rx="7" ry="4" fill="' + color + '" opacity="0.92" transform="rotate(' + (a * 180 / Math.PI) + ' ' + px + ' ' + py + ')"/>';
            }
            out += '<circle cx="100" cy="' + topY + '" r="' + (budR - 2) + '" fill="#7a5a3a"/>';
        } else {
            out += '<circle cx="100" cy="' + topY + '" r="' + budR + '" fill="' + (wilted ? '#b5a86a' : color) + '" opacity="0.7"/>';
        }
        return out;
    }

    // ── 细穗簇型（薰衣草/风信子）：好几根细穗，顶端一串串小花苞 ──
    function _shapeSpike(color, stage, flowering, wilted) {
        var out = '';
        var spikeCount = Math.min(stage + 1, 5);
        var leafColor = wilted ? '#b5a86a' : '#6b9e5e';
        for (var i = 0; i < spikeCount; i++) {
            var xOff = (i - (spikeCount - 1) / 2) * 14;
            var h = 40 + stage * 18 - Math.abs(xOff) * 0.6;
            var topY = 150 - h;
            var baseX = 100 + xOff * 0.4;
            var topX = 100 + xOff;
            out += '<path d="M' + baseX + ',150 Q' + (baseX + xOff * 0.3) + ',' + (150 - h * 0.5) + ' ' + topX + ',' + topY + '" stroke="' + leafColor + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
            // 穗上一串小花苞
            var budCount = flowering && !wilted ? 6 : 3;
            for (var j = 0; j < budCount; j++) {
                var by = topY + j * 6;
                var bColor = flowering && !wilted ? color : (wilted ? '#c9bd8f' : '#a8c79a');
                out += '<circle cx="' + topX + '" cy="' + by + '" r="' + (flowering ? 4 : 2.5) + '" fill="' + bColor + '" opacity="0.9"/>';
            }
        }
        return out;
    }

    // ── 小铃铛/垂坠型（铃兰）：弯曲的茎，几个小铃铛状的花朵垂下来 ──
    function _shapeBell(color, stage, flowering, wilted) {
        var leafColor = wilted ? '#b5a86a' : '#6b9e5e';
        var out = '<path d="M100,150 Q95,' + (150 - stage * 15) + ' 70,' + (145 - stage * 18) + '" stroke="' + leafColor + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
        out += '<path d="M100,150 Q105,' + (150 - stage * 15) + ' 130,' + (140 - stage * 18) + '" stroke="' + leafColor + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
        var stemH = 30 + stage * 20;
        var curveTopX = 130, curveTopY = 150 - stemH;
        out += '<path d="M100,150 Q120,' + (150 - stemH * 0.6) + ' ' + curveTopX + ',' + curveTopY + '" stroke="' + leafColor + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
        var bellCount = Math.min(stage + 2, 6);
        for (var i = 0; i < bellCount; i++) {
            var t = i / (bellCount - 1 || 1);
            var bx = 100 + (curveTopX - 100) * t;
            var by = (150 - stemH * 0.6 * t) - stemH * 0.4 * t * t + 6;
            var bColor = flowering && !wilted ? '#fdfdf5' : (wilted ? '#c9bd8f' : '#e5e8dc');
            out += '<path d="M' + bx + ',' + by + ' a5,6 0 1,0 0.1,0" fill="' + bColor + '" opacity="0.95"/>';
            if (flowering && !wilted) out += '<circle cx="' + bx + '" cy="' + (by + 4) + '" r="1.2" fill="' + color + '"/>';
        }
        return out;
    }

    // ── 满天繁星型（满天星/星辰花）：很多细枝，每根顶端一个小圆点 ──
    function _shapeStarry(color, stage, flowering, wilted) {
        var out = '';
        var branchCount = 6 + stage * 3;
        var leafColor = wilted ? '#c9bd8f' : '#8fae7c';
        for (var i = 0; i < branchCount; i++) {
            var angle = (i / branchCount) * Math.PI * 1.3 - Math.PI * 0.65;
            var len = 20 + stage * 10 + (i % 3) * 6;
            var lx = 100 + Math.sin(angle) * len * 0.6;
            var ly = 150 - Math.cos(angle) * len;
            out += '<path d="M100,150 L' + lx + ',' + ly + '" stroke="' + leafColor + '" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>';
            var dotColor = flowering && !wilted ? color : (wilted ? '#c9bd8f' : '#d8e0cc');
            out += '<circle cx="' + lx + '" cy="' + ly + '" r="' + (flowering ? 3.5 : 2) + '" fill="' + dotColor + '"/>';
        }
        return out;
    }

    // ── 低矮丛生型（紫罗兰/三色堇/勿忘我/蓝雪花）：矮丛状，一簇簇小花挤在一起 ──
    function _shapeBushy(color, stage, flowering, wilted) {
        var out = '';
        var clumpCount = Math.min(stage + 2, 6);
        var leafColor = wilted ? '#b5a86a' : '#6b9e5e';
        for (var i = 0; i < clumpCount; i++) {
            var xOff = (i - (clumpCount - 1) / 2) * 12;
            var h = 18 + stage * 6 + (i % 2) * 5;
            var topY = 150 - h;
            var topX = 100 + xOff;
            out += '<path d="M100,150 Q' + (100 + xOff * 0.5) + ',' + (150 - h * 0.5) + ' ' + topX + ',' + topY + '" stroke="' + leafColor + '" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
            var petalColor = flowering && !wilted ? color : (wilted ? '#c9bd8f' : '#c3d4b5');
            var r = flowering ? 5 : 3;
            for (var j = 0; j < (flowering ? 4 : 1); j++) {
                var pa = (j / 4) * Math.PI * 2;
                out += '<circle cx="' + (topX + Math.cos(pa) * r * 0.7) + '" cy="' + (topY + Math.sin(pa) * r * 0.7) + '" r="' + r * 0.6 + '" fill="' + petalColor + '" opacity="0.9"/>';
            }
        }
        return out;
    }

    // ==================== 角标 ====================
    // ==================== 梦角自己照顾植物（后台）====================

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

    /** 梦角自己判断"这盆养得够好了"，主动帮你结业一盆 */
    function taTryGraduate() {
        if (!state) return false;
        var ready = state.plants.filter(function (p) {
            return p.stage === 4 && p.health >= 85 && p.milestones.indexOf('stage4') !== -1;
        });
        if (!ready.length) return false;

        var p = pick(ready);
        var pn = getPartnerName();
        graduatePlant(p); // 复用用户手动结业的同一套逻辑（挪进纪念墙、写日志）
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random(), sender: 'system', text: pn + ' 觉得"' + p.nickname + '"已经养得很好了，帮你把它放进了纪念墙 ✦', timestamp: new Date(), type: 'system' });
        }
        return true;
    }

    /** 梦角自己决定"种点新的"，从全部品种里随机挑一种（不局限于最初那两种） */
    function taTryPlantNew() {
        if (!state) return false;
        if (state.plants.length >= MAX_PLANTS) return false;

        var speciesKey = pick(ALL_SPECIES_KEYS);
        var sp = SPECIES[speciesKey];
        var now = Date.now();
        var newPlant = {
            id: 'p_' + now + '_' + Math.floor(Math.random() * 10000),
            species: speciesKey,
            nickname: sp.name,
            plantedAt: now,
            moisture: 65, nutrients: 55, sunlight: 55, soil: 65, health: 60, stage: 1,
            lastWater: 0, lastFertilize: 0, lastLoosen: 0, lastSun: 0, lastDivide: 0,
            careCount: 0, flowering: null, milestones: [], log: []
        };
        addLog(newPlant, getPartnerName() + '给你种下的新植物，才刚刚开始长。');
        state.plants.push(newPlant);
        saveState();

        var pn = getPartnerName();
        if (typeof showNotification === 'function') showNotification(pn + ' 给你种了一盆' + sp.name + '~', 'success', 3500);
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now() + Math.random(), sender: 'system', text: pn + ' 突然想种点新的，给你种了一盆' + sp.name + ' ✦', timestamp: new Date(), type: 'system' });
        }
        return true;
    }

    function scheduleTaCare() {
        // 频率降下来了：45~90分钟检查一次、20%概率（原来是20~40分钟+30%，
        // 算下来平均1.5~2小时就照顾一次，太勤快了，你自己都没什么可做的）
        scheduleWithPersistence('care', 45 / 60, 90 / 60, 0.2, taTryCare);
    }
    window.plantsTestTaCare = function () {
        if (state) taTryCare();
        else loadState().then(taTryCare);
    };

    function scheduleTaGraduateCheck() {
        scheduleWithPersistence('graduate', 12, 24, 0.15, taTryGraduate);
    }
    window.plantsTestTaGraduate = function () {
        if (state) taTryGraduate();
        else loadState().then(taTryGraduate);
    };

    function scheduleTaPlantNewCheck() {
        scheduleWithPersistence('plantnew', 24, 72, 0.2, taTryPlantNew);
    }
    window.plantsTestTaPlantNew = function () {
        if (state) taTryPlantNew();
        else loadState().then(taTryPlantNew);
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

        renderGraduatedWall();
    }

    function renderGraduatedWall() {
        var wallWrap = document.getElementById('plants-graduated-wall');
        if (!wallWrap) return;
        if (!state.graduated || !state.graduated.length) {
            wallWrap.style.display = 'none';
            return;
        }
        wallWrap.style.display = 'block';
        var listEl = document.getElementById('plants-graduated-list');
        listEl.innerHTML = state.graduated.map(function (g) {
            var sp = SPECIES[g.species];
            var d = new Date(g.graduatedAt);
            var badges = [];
            if (g.everFlowered) badges.push('<i class="fas fa-fan" title="开过花"></i>');
            if (g.everDivided) badges.push('<i class="fas fa-code-branch" title="分过株"></i>');
            return '<div class="pl-grad-item">'
                + '<div class="pl-grad-icon" style="background:' + sp.color + '22;color:' + sp.color + ';"><i class="fas fa-seedling"></i></div>'
                + '<div class="pl-grad-info">'
                +   '<div class="pl-grad-name">' + escapeHtml(g.nickname) + ' <span class="pl-grad-species">· ' + escapeHtml(sp.name) + '</span></div>'
                +   '<div class="pl-grad-date">' + d.toLocaleDateString('zh-CN') + ' 结业 · 照顾了 ' + (g.careCount || 0) + ' 次</div>'
                + '</div>'
                + '<div class="pl-grad-badges">' + badges.join('') + '</div>'
                + '</div>';
        }).join('');
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

        var flowerBadge = p.flowering
            ? ('<div class="pl-flower-badge"><i class="fas fa-fan"></i> 正在开花～' + (sp.flowerMeaning ? ('<br><span class="pl-flower-meaning">花语：' + escapeHtml(sp.flowerMeaning) + '</span>') : '') + '</div>')
            : '';

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
        var graduateBtn = p.stage === 4
            ? '<button class="pl-list-btn pl-graduate-btn" id="pl-graduate-btn"><i class="fas fa-trophy"></i> 结业，放进纪念墙</button>'
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
            + (sp.flowerMeaning ? ('<div class="pl-species-meaning">花语：' + escapeHtml(sp.flowerMeaning) + '</div>') : '')
            + milestonesHtml
            + '<div class="pl-stats">'
            +   statBar('水分', 'fa-tint', p.moisture)
            +   statBar('养分', 'fa-flask', p.nutrients)
            +   statBar('日照', 'fa-sun', p.sunlight)
            +   statBar('疏松度', 'fa-hand-sparkles', p.soil)
            + '</div>'
            + '<div class="pl-actions">' + actionsHtml + '</div>'
            + divideBtn
            + graduateBtn
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
        var graduateBtnEl = document.getElementById('pl-graduate-btn');
        if (graduateBtnEl) {
            graduateBtnEl.addEventListener('click', function () {
                if (!confirm('确定让"' + p.nickname + '"结业吗？\n\n结业之后会移进纪念墙，定格成现在的样子，不用再日常照顾，但记录会一直留着。')) return;
                graduatePlant(p);
                if (typeof hideModal === 'function') hideModal(document.getElementById('plants-detail-modal'));
                else document.getElementById('plants-detail-modal').classList.remove('active');
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
        document.getElementById('plants-test-graduate-btn')?.addEventListener('click', function () {
            var ok = taTryGraduate();
            if (!ok && typeof showNotification === 'function') showNotification('现在没有够格毕业的植株（得先长到茂盛阶段、健康度85以上）', 'warning');
            renderList();
        });
        document.getElementById('plants-test-plantnew-btn')?.addEventListener('click', function () {
            var ok = taTryPlantNew();
            if (!ok && typeof showNotification === 'function') showNotification('植株数量已经到上限啦', 'warning');
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
                    scheduleTaGraduateCheck();
                    scheduleTaPlantNewCheck();
                });
                setInterval(function () { if (state) { applyDecay(); saveState(); refreshBadge(); } }, 30 * 60 * 1000);
            }
        }, 300);
    });
})();
