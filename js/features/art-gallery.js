/**
 * features/art-gallery.js - 绘世（梦角随机作画）
 *
 * 无 AI：画布形状/背景色/图形种类/颜色/位置/大小/旋转全部本地随机生成
 * （用精选色板而不是纯随机RGB，保证好看）；配文跟其他功能一样，从
 * 字卡库（customReplies）随机抽1~3条拼起来。
 *
 * 依赖：getStorageKey, localforage, showNotification, showModal, hideModal,
 *       customReplies, addMessage, settings, SESSION_ID
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
    function randFloat(a, b) { return a + Math.random() * (b - a); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '对方';
    }

    // ─── 完全随机颜色（不用精选色板）──────────
    // 用 HSL 随机生成：色相0~360全随机，饱和度/亮度给一点点范围限制只是为了
    // 避免出现全黑、全白这种看不出形状的极端情况，色彩本身完全不挑
    function randomColor(minL, maxL) {
        const h = randInt(0, 359);
        const s = randInt(35, 100);
        const l = randInt(minL, maxL);
        return `hsl(${h}, ${s}%, ${l}%)`;
    }
    function randomBgColor() { return randomColor(15, 92); }   // 背景亮暗都随机，全范围
    function randomShapeColor() { return randomColor(30, 80); } // 图形避开太接近纯黑/纯白，保证看得清

    const CANVAS_SHAPES = ['square', 'portrait', 'landscape', 'circle', 'ellipse'];
    const SHAPE_TYPES = ['circle', 'square', 'triangle', 'heart', 'star', 'diamond', 'wave'];

    let paintings = [];
    let lastSeenAt = 0;

    // ─── 存储 ──────────────────────────────
    async function loadData() {
        try {
            const saved = await localforage.getItem(getStorageKey('artPaintings'));
            paintings = Array.isArray(saved) ? saved : [];
        } catch (e) { paintings = []; }
        try {
            const seenRaw = safeGetItem(getStorageKey('artGalleryLastSeenAt'));
            lastSeenAt = seenRaw ? parseInt(seenRaw, 10) || 0 : 0;
        } catch (e) { lastSeenAt = 0; }
        refreshBadge();
    }
    function saveData() {
        localforage.setItem(getStorageKey('artPaintings'), paintings).catch(() => {});
        refreshBadge();
    }
    function refreshBadge() {
        if (typeof window.appBadges !== 'undefined') {
            const unread = paintings.filter(p => p.ts > lastSeenAt).length;
            window.appBadges.set('art-gallery-function', unread);
        }
    }
    function markSeen() {
        lastSeenAt = Date.now();
        safeSetItem(getStorageKey('artGalleryLastSeenAt'), String(lastSeenAt));
        refreshBadge();
    }

    // ─── 生成一幅画（参数化，不是位图）──────────────────
    function getCanvasDims(shape) {
        switch (shape) {
            case 'portrait': return { w: 300, h: 420 };
            case 'landscape': return { w: 420, h: 300 };
            case 'circle': return { w: 360, h: 360 };
            case 'ellipse': return { w: 420, h: 300 };
            default: return { w: 360, h: 360 }; // square
        }
    }

    function shapeSvg(type, cx, cy, size, color, rotation, opacity) {
        const t = `rotate(${rotation} ${cx} ${cy})`;
        const o = opacity.toFixed(2);
        switch (type) {
            case 'circle':
                return `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${color}" opacity="${o}"/>`;
            case 'square':
                return `<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" fill="${color}" opacity="${o}" transform="${t}"/>`;
            case 'diamond':
                return `<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" fill="${color}" opacity="${o}" transform="rotate(45 ${cx} ${cy})"/>`;
            case 'triangle': {
                const h = size * 0.87;
                const pts = `${cx},${cy - h / 2} ${cx - size / 2},${cy + h / 2} ${cx + size / 2},${cy + h / 2}`;
                return `<polygon points="${pts}" fill="${color}" opacity="${o}" transform="${t}"/>`;
            }
            case 'heart': {
                const s = size / 24;
                return `<path d="M12 21s-7.5-5.1-10-9.3C0.2 8.4 1.8 4.5 5.5 4c2-.3 3.7.7 4.9 2.3C11.6 4.7 13.3 3.7 15.3 4c3.7.5 5.3 4.4 3.5 7.7C19.5 15.9 12 21 12 21z"
                    fill="${color}" opacity="${o}" transform="translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})"/>`;
            }
            case 'star': {
                const spikes = 5, outerR = size / 2, innerR = size / 4.5;
                let pts = [];
                for (let i = 0; i < spikes * 2; i++) {
                    const r = i % 2 === 0 ? outerR : innerR;
                    const a = (Math.PI / spikes) * i - Math.PI / 2;
                    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
                }
                return `<polygon points="${pts.join(' ')}" fill="${color}" opacity="${o}" transform="${t}"/>`;
            }
            case 'wave': {
                const w = size, hgt = size / 3;
                return `<path d="M${cx - w / 2} ${cy} Q ${cx - w / 4} ${cy - hgt} ${cx} ${cy} T ${cx + w / 2} ${cy}"
                    stroke="${color}" stroke-width="${Math.max(3, size / 12)}" fill="none" opacity="${o}" stroke-linecap="round" transform="${t}"/>`;
            }
            default:
                return '';
        }
    }

    // 图形大小分三档：小/中/大（相对画布短边的比例）
    const SIZE_TIERS = {
        small: [0.08, 0.16],
        medium: [0.17, 0.27],
        large: [0.28, 0.42]
    };
    function randomSize(minDim) {
        const tier = pick(['small', 'medium', 'large']);
        const [lo, hi] = SIZE_TIERS[tier];
        return Math.round(randFloat(minDim * lo, minDim * hi));
    }

    function generatePainting() {
        const canvasShape = pick(CANVAS_SHAPES);
        const { w, h } = getCanvasDims(canvasShape);
        const bg = randomBgColor();
        const shapeCount = randInt(4, 11);
        const dominant = Math.random() < 0.4 ? pick(SHAPE_TYPES) : null; // 40%概率这次以某个图形为主
        const minDim = Math.min(w, h);

        let shapesSvg = '';
        for (let i = 0; i < shapeCount; i++) {
            const type = dominant && Math.random() < 0.6 ? dominant : pick(SHAPE_TYPES);
            const color = randomShapeColor();
            const size = randomSize(minDim);
            const cx = randFloat(size * 0.3, w - size * 0.3);
            const cy = randFloat(size * 0.3, h - size * 0.3);
            const rotation = randInt(0, 359);
            const opacity = randFloat(0.55, 0.95);
            shapesSvg += shapeSvg(type, cx, cy, size, color, rotation, opacity);
        }

        let clipDef = '', bgShape = '';
        if (canvasShape === 'circle' || canvasShape === 'ellipse') {
            const rx = w / 2, ry = h / 2;
            clipDef = `<clipPath id="artClip"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${rx}" ry="${ry}"/></clipPath>`;
            bgShape = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${rx}" ry="${ry}" fill="${bg}"/>`;
        } else {
            clipDef = `<clipPath id="artClip"><rect x="0" y="0" width="${w}" height="${h}" rx="18"/></clipPath>`;
            bgShape = `<rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="${bg}"/>`;
        }

        const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
            <defs>${clipDef}</defs>
            ${bgShape}
            <g clip-path="url(#artClip)">${shapesSvg}</g>
        </svg>`;

        return { svg, w, h, canvasShape };
    }

    function generateComment() {
        const pool = (typeof customReplies !== 'undefined' && customReplies.length > 0)
            ? customReplies : ['画完啦', '你觉得怎么样', '随手画的'];
        const n = Math.min(pool.length, randInt(1, 3));
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n).join('。') + '。';
    }

    // ─── 生成并保存一幅新画 ──────────────────
    function paintNewOne(silent) {
        const { svg, canvasShape } = generatePainting();
        const record = {
            id: 'art_' + Date.now(),
            ts: Date.now(),
            svg: svg,
            canvasShape: canvasShape,
            comment: generateComment()
        };
        paintings.unshift(record);
        if (paintings.length > 200) paintings.length = 200; // 防止无限堆积
        saveData();

        const pn = getPartnerName();
        if (!silent) {
            showNotification(`🎨 ${pn} 画了一幅新的画~`, 'success', 3500);
        }
        if (typeof addMessage === 'function') {
            addMessage({
                id: Date.now() + Math.random(),
                sender: 'system',
                text: `${pn} 在"绘世"里画了一幅新画 ✦`,
                timestamp: new Date(),
                type: 'system'
            });
        }

        const modal = document.getElementById('art-gallery-modal');
        if (modal && modal.classList.contains('active') || (modal && modal.style.display === 'flex')) {
            renderGallery();
        }
    }
    window.artPaintNow = function () { paintNewOne(false); }; // 供数据管理面板测试按钮调用

    // ─── 随机后台触发 ──────────────────────
    function scheduleNextPainting() {
        const delay = (2 + Math.random() * 5) * 60 * 60 * 1000; // 2~7小时检查一次
        setTimeout(() => {
            if (Math.random() < 0.5) paintNewOne(false); // 50%概率真的画
            scheduleNextPainting();
        }, delay);
    }

    // ─── 画廊渲染 ──────────────────────────
    function renderGallery() {
        const list = document.getElementById('art-gallery-list');
        if (!list) return;
        if (paintings.length === 0) {
            list.innerHTML = `<div class="art-empty"><i class="fas fa-palette"></i><p>还没有画作</p><span>${escapeHtml(getPartnerName())}会不定期画点什么留在这里~</span></div>`;
            return;
        }
        list.innerHTML = paintings.map(p => {
            const d = new Date(p.ts);
            const timeStr = d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            const shapeClass = 'art-thumb-' + p.canvasShape;
            return `
                <div class="art-card" onclick="window.artViewPainting('${p.id}')">
                    <div class="art-thumb ${shapeClass}">${p.svg}</div>
                    <div class="art-card-meta">
                        <div class="art-card-time">${timeStr}</div>
                        <div class="art-card-comment">${escapeHtml(p.comment)}</div>
                    </div>
                </div>`;
        }).join('');
    }

    window.artViewPainting = function (id) {
        const p = paintings.find(x => x.id === id);
        if (!p) return;
        const d = new Date(p.ts);
        const canvasEl = document.getElementById('art-view-canvas');
        canvasEl.innerHTML = p.svg;
        canvasEl.className = 'art-view-canvas art-thumb-' + p.canvasShape;
        canvasEl.dataset.currentId = id;
        document.getElementById('art-view-time').textContent = d.toLocaleString('zh-CN');
        document.getElementById('art-view-comment').textContent = p.comment;
        showModal(document.getElementById('art-view-modal'));
    };

    window.artDeletePainting = function (id) {
        if (!confirm('确定删除这幅画吗？')) return;
        paintings = paintings.filter(p => p.id !== id);
        saveData();
        hideModal(document.getElementById('art-view-modal'));
        renderGallery();
        showNotification('已删除', 'success');
    };

    // ─── 初始化 ──────────────────────────────
    function initListeners() {
        const entryBtn = document.getElementById('art-gallery-function');
        if (entryBtn) {
            entryBtn.addEventListener('click', async () => {
                const advancedModal = document.getElementById('advanced-modal');
                if (advancedModal) hideModal(advancedModal);
                await loadData();
                renderGallery();
                showModal(document.getElementById('art-gallery-modal'));
                markSeen();
            });
        }
        document.getElementById('close-art-gallery-modal')?.addEventListener('click', () => hideModal(document.getElementById('art-gallery-modal')));
        document.getElementById('close-art-view-modal')?.addEventListener('click', () => hideModal(document.getElementById('art-view-modal')));
        document.getElementById('art-view-delete-btn')?.addEventListener('click', () => {
            const canvas = document.getElementById('art-view-canvas');
            const id = canvas?.dataset?.currentId;
            if (id) window.artDeletePainting(id);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                initListeners();
                loadData();
                setTimeout(scheduleNextPainting, 60 * 1000);
            }
        }, 300);
    });
})();
