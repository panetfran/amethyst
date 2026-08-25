let envelopeData = { outbox: [], inbox: [] }; 
let currentEnvTab = 'outbox';
let editingEnvId = null; 
let editingEnvSection = null; 

async function loadEnvelopeData() {
    const saved = await localforage.getItem(getStorageKey('envelopeData'));
    if (saved) envelopeData = saved;
    const oldPending = await localforage.getItem(getStorageKey('pending_envelope'));
    if (oldPending && envelopeData.outbox.length === 0) {
        envelopeData.outbox.push({
            id: 'legacy_' + Date.now(),
            content: '（历史寄出的信件）',
            sentTime: oldPending.sentTime,
            replyTime: oldPending.replyTime,
            status: 'pending'
        });
        await localforage.removeItem(getStorageKey('pending_envelope'));
        saveEnvelopeData();
    }
    refreshEnvelopeBadge();
}

function refreshEnvelopeBadge() {
    if (typeof window.appBadges !== 'undefined') {
        const newInboxCount = envelopeData.inbox.filter(l => l.isNew).length;
        window.appBadges.set('envelope-function', newInboxCount);
    }
}

function saveEnvelopeData() {
    localforage.setItem(getStorageKey('envelopeData'), envelopeData);
    refreshEnvelopeBadge();
}

async function checkEnvelopeStatus() {
    await loadEnvelopeData();
    const now = Date.now();
    let changed = false;
    let newReplyLetter = null;

    // 判定是否忙碌：有没回的信，或者有没读的信
    const isBusy = envelopeData.outbox.some(l => l.status === 'pending') || 
                   envelopeData.inbox.some(l => l.isNew === true);

    // 逻辑 A：处理你寄出的信的回信
    envelopeData.outbox.forEach(letter => {
        if (letter.status === 'pending' && now >= letter.replyTime) {
            letter.status = 'replied';
            const replyContent = generateEnvelopeReplyText();
            const inboxLetter = {
                id: 'reply_' + Date.now(),
                refId: letter.id,
                content: replyContent,
                receivedTime: Date.now(),
                isNew: true
            };
            envelopeData.inbox.push(inboxLetter);
            newReplyLetter = inboxLetter;
            changed = true;
            playSound('message');
        }
    });

    // 逻辑 B：系统主动找你
    if (!isBusy) {
        const lastActiveTime = localStorage.getItem('last_system_mail_time') || 0;
        const cooldown = 10 * 60 * 60 * 1000; // 10小时冷却，不再是1小时
        if (now - lastActiveTime > cooldown && Math.random() < 0.25) { // 25% 概率，不再是50%
            const activeContent = generateEnvelopeReplyText();
            const systemLetter = {
                id: 'sys_' + Date.now(),
                refId: null,
                content: activeContent,
                receivedTime: now,
                isNew: true
            };
            envelopeData.inbox.push(systemLetter);
            newReplyLetter = systemLetter;
            changed = true;
            localStorage.setItem('last_system_mail_time', now);
            playSound('message');
        }
    }

    if (changed) {
        saveEnvelopeData();
        if (newReplyLetter) showEnvelopeReplyPopup(newReplyLetter);
        renderEnvelopeLists();
    }
}

function showEnvelopeReplyPopup(letter) {
    const existing = document.getElementById('envelope-reply-popup');
    if (existing) existing.remove();
    const popup = document.createElement('div');
    popup.id = 'envelope-reply-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:20px;padding:18px 20px;z-index:8000;max-width:320px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:12px;animation:slideUpNotif 0.4s cubic-bezier(0.22,1,0.36,1);';
    popup.innerHTML = `
        <style>@keyframes slideUpNotif{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(0.9)}60%{transform:translateX(-50%) translateY(-4px) scale(1.02)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}</style>
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:26px;">💌</span>
            <div>
                <div style="font-size:14px;font-weight:700;color:var(--text-primary);">收到了一封回信</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;opacity:0.8;">Ta 给你写了回信，快去看看吧~</div>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="document.getElementById('envelope-reply-popup').remove();" style="flex:1;padding:8px 0;border-radius:12px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">稍后查看</button>
            <button onclick="openEnvelopeAndViewReply('${letter.id}');" style="flex:2;padding:8px 0;border-radius:12px;border:none;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">立即阅读 ✉</button>
        </div>`;
    document.body.appendChild(popup);
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 8000);
}

const APPEARANCE_PANEL_TITLES = {
    'theme': '主题配色', 'font': '字体设置', 'background': '聊天背景',
    'bubble': '气泡样式', 'avatar': '聊天头像', 'css': '自定义CSS',
    'font-bg': '背景 & 字体', 'bubble-css': '气泡 & CSS'
};
window.showAppearancePanel = function(panel) {
    const panelMap = {
        'font-bg': ['font', 'background'],
        'bubble-css': ['bubble', 'css']
    };
    document.getElementById('appearance-nav-grid').style.display = 'none';
    var unBtn = document.getElementById('update-notice-btn');
    if (unBtn) unBtn.style.display = 'none';
    var galleryBanner = document.getElementById('gallery-banner-entry');
    if (galleryBanner) galleryBanner.style.display = 'none';
    document.getElementById('appearance-panel-container').style.display = 'block';
    document.getElementById('appearance-panel-title').textContent = APPEARANCE_PANEL_TITLES[panel] || panel;
    document.querySelectorAll('.appearance-sub-panel').forEach(p => p.style.display = 'none');
    if (panelMap[panel]) {
        panelMap[panel].forEach(sub => {
            const target = document.getElementById('appearance-panel-' + sub);
            if (target) target.style.display = 'block';
        });
    } else {
        const target = document.getElementById('appearance-panel-' + panel);
        if (target) target.style.display = 'block';
    }
    if (panel === 'bubble' || panel === 'bubble-css') { setTimeout(() => { if (typeof window.updateBubblePreviewFn === 'function') window.updateBubblePreviewFn(); }, 50); }
};
window.hideAppearancePanel = function() {
    document.getElementById('appearance-nav-grid').style.display = 'grid';
    document.getElementById('appearance-panel-container').style.display = 'none';
    document.querySelectorAll('.appearance-sub-panel').forEach(p => p.style.display = 'none');
    var unBtn = document.getElementById('update-notice-btn');
    if (unBtn) unBtn.style.display = 'flex';
    var galleryBanner = document.getElementById('gallery-banner-entry');
    if (galleryBanner) galleryBanner.style.display = 'flex';
};

window.openEnvelopeAndViewReply = function(replyId) {
    const popup = document.getElementById('envelope-reply-popup');
    if (popup) popup.remove();
    const envelopeModal = document.getElementById('envelope-modal');
    showModal(envelopeModal);
    setTimeout(() => {
        switchEnvTab('inbox');
        viewEnvLetter('inbox', replyId);
    }, 200);
};

function generateEnvelopeReplyText() {
    const sourcePool = [...customReplies];
    const sentenceCount = Math.floor(Math.random() * (25 - 8 + 1)) + 8;
    let replyContent = "";
    for (let i = 0; i < sentenceCount; i++) {
        const randomSentence = sourcePool[Math.floor(Math.random() * sourcePool.length)];
        const punctuation = Math.random() < 0.2 ? "..." : (Math.random() < 0.2 ? "，" : "。");
        replyContent += randomSentence + punctuation;
        if (Math.random() < 0.25 && i < sentenceCount - 1) {
            replyContent += "\n\n";
        }
    }
    return replyContent;
}


window.switchEnvTab = function(tab) {
    currentEnvTab = tab;
    document.getElementById('env-tab-outbox').classList.toggle('active', tab === 'outbox');
    document.getElementById('env-tab-inbox').classList.toggle('active', tab === 'inbox');
    document.getElementById('env-tab-starred').classList.toggle('active', tab === 'starred');
    document.getElementById('env-outbox-section').style.display = tab === 'outbox' ? 'block' : 'none';
    document.getElementById('env-inbox-section').style.display = tab === 'inbox' ? 'block' : 'none';
    document.getElementById('env-starred-section').style.display = tab === 'starred' ? 'block' : 'none';
    document.getElementById('env-compose-form').style.display = 'none';
    document.getElementById('env-main-close-btn').style.display = 'flex';
    exitEnvBatchMode(); // 切标签页的时候，批量管理模式自动退出，避免跨标签页选中状态搞混
    renderEnvelopeLists();
};

function renderEnvelopeLists() {
    renderOutboxList();
    renderInboxList();
    renderStarredList();
    const pendingCount = envelopeData.outbox.filter(l => l.status === 'pending').length;
    const newInboxCount = envelopeData.inbox.filter(l => l.isNew).length;
    const outboxBadge = document.getElementById('env-outbox-badge');
    const inboxBadge = document.getElementById('env-inbox-badge');
    if (outboxBadge) { outboxBadge.textContent = pendingCount; outboxBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none'; }
    if (inboxBadge) { inboxBadge.textContent = newInboxCount; inboxBadge.style.display = newInboxCount > 0 ? 'inline-block' : 'none'; }
    const envelopeEntryBadge = document.getElementById('env-entry-badge');
    if (envelopeEntryBadge) { envelopeEntryBadge.style.display = newInboxCount > 0 ? 'inline-block' : 'none'; }
}

function renderStarredList() {
    const list = document.getElementById('env-starred-list');
    if (!list) return;
    const starredOutbox = envelopeData.outbox.filter(l => l.starred).map(l => ({ ...l, _section: 'outbox' }));
    const starredInbox = envelopeData.inbox.filter(l => l.starred).map(l => ({ ...l, _section: 'inbox' }));
    const all = starredOutbox.concat(starredInbox).sort((a, b) => (b.sentTime || b.receivedTime || 0) - (a.sentTime || a.receivedTime || 0));
    if (all.length === 0) {
        list.innerHTML = `<div class="env-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <div style="font-size:14px;font-weight:500;margin-top:4px;">还没有星标信件</div>
            <div style="font-size:12px;margin-top:6px;opacity:0.6;">重要的信件可以标个星，方便以后回看</div>
        </div>`;
        return;
    }
    list.innerHTML = all.map(letter => {
        const isOut = letter._section === 'outbox';
        const date = new Date(letter.sentTime || letter.receivedTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const preview = letter.content.length > 38 ? letter.content.substring(0, 38) + '…' : letter.content;
        return `
        <div class="env-letter-item ${isOut ? '' : 'reply'} env-batch-item" data-section="${letter._section}" data-id="${letter.id}" onclick="envItemClick(event,'${letter._section}','${letter.id}')">
            <div class="env-batch-check" onclick="event.stopPropagation();toggleEnvBatchCheck(this)"></div>
            <div class="env-letter-header">
                <div class="env-letter-header-from">${isOut ? '寄出' : '收到'} · ${date}</div>
                <button class="env-star-btn starred" onclick="event.stopPropagation();toggleEnvLetterStar('${letter._section}','${letter.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
            </div>
            <div class="env-letter-body"><div class="env-letter-preview">${preview}</div></div>
        </div>`;
    }).join('');
}

function envItemClick(event, section, id) {
    if (envBatchMode) { toggleEnvBatchCheck(event.currentTarget.querySelector('.env-batch-check')); return; }
    viewEnvLetter(section, id);
}

// ==================== 星标 ====================
window.toggleEnvLetterStar = function(section, id) {
    const letters = section === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    const letter = letters.find(l => l.id === id);
    if (!letter) return;
    letter.starred = !letter.starred;
    saveEnvelopeData();
    renderEnvelopeLists();
};

// ==================== 批量管理 ====================
let envBatchMode = false;

window.enterEnvBatchMode = function() {
    envBatchMode = true;
    document.getElementById('env-manage-bar').style.display = 'none';
    document.getElementById('env-manage-bar-batch').style.display = 'flex';
    document.querySelectorAll('.env-letter-item').forEach(el => el.classList.add('env-batch-active'));
};

window.exitEnvBatchMode = function() {
    envBatchMode = false;
    const bar = document.getElementById('env-manage-bar');
    const barBatch = document.getElementById('env-manage-bar-batch');
    if (bar) bar.style.display = 'flex';
    if (barBatch) barBatch.style.display = 'none';
    document.querySelectorAll('.env-letter-item').forEach(el => {
        el.classList.remove('env-batch-active');
        const check = el.querySelector('.env-batch-check');
        if (check) check.classList.remove('checked');
    });
};

window.toggleEnvBatchCheck = function(checkEl) {
    checkEl.classList.toggle('checked');
};

function getEnvBatchSelected() {
    const items = [];
    document.querySelectorAll('.env-letter-item.env-batch-active').forEach(el => {
        const check = el.querySelector('.env-batch-check');
        if (check && check.classList.contains('checked')) {
            items.push({ section: el.getAttribute('data-section'), id: el.getAttribute('data-id') });
        }
    });
    return items;
}

window.batchMarkReadEnvLetters = function() {
    const selected = getEnvBatchSelected();
    if (!selected.length) { showNotification('还没有选中任何信件', 'info'); return; }
    selected.forEach(({ section, id }) => {
        if (section === 'inbox') {
            const letter = envelopeData.inbox.find(l => l.id === id);
            if (letter) letter.isNew = false;
        }
    });
    saveEnvelopeData();
    exitEnvBatchMode();
    renderEnvelopeLists();
    showNotification('已标记已读', 'success');
};

window.batchDeleteEnvLetters = function() {
    const selected = getEnvBatchSelected();
    if (!selected.length) { showNotification('还没有选中任何信件', 'info'); return; }
    if (!confirm(`确定删除选中的 ${selected.length} 封信吗？`)) return;
    selected.forEach(({ section, id }) => {
        if (section === 'outbox') envelopeData.outbox = envelopeData.outbox.filter(l => l.id !== id);
        else envelopeData.inbox = envelopeData.inbox.filter(l => l.id !== id);
    });
    saveEnvelopeData();
    exitEnvBatchMode();
    renderEnvelopeLists();
    showNotification('已删除', 'success');
};

function renderOutboxList() {
    const list = document.getElementById('env-outbox-list');
    if (!list) return;
    if (envelopeData.outbox.length === 0) {
        list.innerHTML = `<div class="env-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            <div style="font-size:14px;font-weight:500;margin-top:4px;">还没有寄出任何信件</div>
            <div style="font-size:12px;margin-top:6px;opacity:0.6;">提笔写下心意，寄送给Ta吧~</div>
        </div>`;
        return;
    }
    list.innerHTML = envelopeData.outbox.slice().reverse().map(letter => {
        const date = new Date(letter.sentTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const isPending = letter.status === 'pending';
        const replyTime = isPending ? new Date(letter.replyTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
        const statusIcon = isPending
            ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
            : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        const statusText = isPending ? `${statusIcon} 预计 ${replyTime} 回信` : `${statusIcon} 已收到回信`;
        const preview = letter.content.length > 38 ? letter.content.substring(0, 38) + '…' : letter.content;
        return `
        <div class="env-letter-item env-batch-item" data-section="outbox" data-id="${letter.id}" onclick="envItemClick(event,'outbox','${letter.id}')">
            <div class="env-batch-check" onclick="event.stopPropagation();toggleEnvBatchCheck(this)"></div>
            <div class="env-letter-header">
                <div class="env-letter-header-from">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
                    寄出 · ${date}
                </div>
                <button class="env-star-btn ${letter.starred ? 'starred' : ''}" onclick="event.stopPropagation();toggleEnvLetterStar('outbox','${letter.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${letter.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
                <div class="env-stamp">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
            </div>
            <div class="env-letter-body">
                <div class="env-letter-preview">${preview}</div>
                <div class="env-letter-status">${statusText}</div>
            </div>
            <button class="env-letter-delete-btn" onclick="deleteEnvLetter(event,'outbox','${letter.id}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    }).join('');
}

function renderInboxList() {
    const list = document.getElementById('env-inbox-list');
    if (!list) return;
    if (envelopeData.inbox.length === 0) {
        list.innerHTML = `<div class="env-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/><polyline points="22 13 12 13"/><path d="M19 16l-5-3-5 3"/></svg>
            <div style="font-size:14px;font-weight:500;margin-top:4px;">还没有收到回信</div>
            <div style="font-size:12px;margin-top:6px;opacity:0.6;">对方正在认真回复中，请稍候~</div>
        </div>`;
        return;
    }
    list.innerHTML = envelopeData.inbox.slice().reverse().map(letter => {
        const date = new Date(letter.receivedTime).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const preview = letter.content.length > 50 ? letter.content.substring(0, 50) + '…' : letter.content;
        const isNew = letter.isNew;
        const origPreview = letter.originalContent ? (letter.originalContent.length > 32 ? letter.originalContent.substring(0, 32) + '…' : letter.originalContent) : '';
        return `
        <div class="env-letter-item reply env-batch-item ${isNew ? 'env-letter-new' : ''}" data-section="inbox" data-id="${letter.id}" onclick="envItemClick(event,'inbox','${letter.id}')">
            <div class="env-batch-check" onclick="event.stopPropagation();toggleEnvBatchCheck(this)"></div>
            <div class="env-letter-header">
                <div class="env-letter-header-from">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
                    收到 · ${date}
                    ${isNew ? '<span style="background:rgba(255,255,255,0.3);color:#fff;font-size:9px;padding:1px 5px;border-radius:6px;margin-left:6px;">新</span>' : ''}
                </div>
                <button class="env-star-btn ${letter.starred ? 'starred' : ''}" onclick="event.stopPropagation();toggleEnvLetterStar('inbox','${letter.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${letter.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
                <div class="env-stamp">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
            </div>
            ${origPreview ? `<div style="padding:6px 12px 0;display:flex;align-items:flex-start;gap:6px;"><div style="width:2px;border-radius:2px;background:rgba(var(--accent-color-rgb),0.4);flex-shrink:0;align-self:stretch;min-height:14px;margin-top:1px;"></div><div style="font-size:11px;color:var(--text-secondary);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100% - 14px);opacity:0.75;">原信: ${origPreview}</div></div>` : ''}
            <div class="env-letter-body">
                <div class="env-letter-preview">${preview}</div>
            </div>
            <button class="env-letter-delete-btn" onclick="deleteEnvLetter(event,'inbox','${letter.id}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    }).join('');
}

window.viewEnvLetter = function(section, id) {
    const letters = section === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    const letter = letters.find(l => l.id === id);
    if (!letter) return;
    
    if (section === 'inbox' && letter.isNew) {
        letter.isNew = false;
        saveEnvelopeData();
        renderEnvelopeLists();
    }
    editingEnvId = id;
    editingEnvSection = section;

    // --- 修改文案：让它更像双向通信 ---
    document.getElementById('env-view-title').textContent = section === 'outbox' ? '致对方的信' : '对方寄来的信';

    const dateObj = letter.timestamp ? new Date(letter.timestamp) : new Date();
    const y = dateObj.getFullYear();
    const mo = String(dateObj.getMonth()+1).padStart(2,'0');
    const d = String(dateObj.getDate()).padStart(2,'0');
    const dateStr = `${y}/${mo}/${d}`;
    const weekdays = ['日','一','二','三','四','五','六'];
    const fullDateStr = dateStr + ' 星期' + weekdays[dateObj.getDay()];

    const stampEl = document.getElementById('env-view-stamp-date');
    if (stampEl) stampEl.textContent = `${mo}/${d}`;

    const dateLine = document.getElementById('env-view-date-line');
    if (dateLine) dateLine.textContent = fullDateStr;

    const toLine = document.getElementById('env-view-to-line');
    const greetingLine = document.getElementById('env-view-greeting-line');
    if (section === 'outbox') {
        const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '亲爱的';
        if (toLine) toLine.textContent = `致 ${partnerName}：`;
        if (greetingLine) greetingLine.textContent = '见字如面，望君安好。';
    } else {
        const myName = (typeof settings !== 'undefined' && settings.myName) || '你';
        if (toLine) toLine.textContent = `致 ${myName}：`;
        // 如果是系统主动发的信，换个稍微不一样的问候语
        greetingLine.textContent = letter.refId ? '见字如面，一切皆好。' : '突然想写封信给你，见字如面。';
    }

    const textEl = document.getElementById('env-view-text');
    if (textEl) textEl.textContent = letter.content;

    const signDateEl = document.getElementById('env-view-sign-date');
    const signNameEl = document.getElementById('env-view-sign-name');
    if (signDateEl) signDateEl.textContent = fullDateStr;
    if (section === 'outbox') {
        const myName = (typeof settings !== 'undefined' && settings.myName) || '你';
        if (signNameEl) signNameEl.textContent = myName;
    } else {
        const partnerName = (typeof settings !== 'undefined' && settings.partnerName) || '对方';
        if (signNameEl) signNameEl.textContent = partnerName;
    }

    document.getElementById('env-edit-input').value = letter.content;
    document.getElementById('env-view-content').style.display = 'block';
    document.getElementById('env-view-edit').style.display = 'none';
    document.getElementById('env-view-edit-btn').style.display = 'inline-flex';
    document.getElementById('env-view-save-btn').style.display = 'none';

    // 更新详情页里的星标按钮状态
    const starBtn = document.getElementById('env-view-star-btn');
    if (starBtn) {
        starBtn.textContent = letter.starred ? '★ 已标星' : '☆ 标星';
        starBtn.classList.toggle('env-star-btn-active', !!letter.starred);
    }

    // 处理回信引用
    const origCtx = document.getElementById('env-view-original-ctx');
    const origText = document.getElementById('env-view-original-text');
    const origExpand = document.getElementById('env-view-original-expand');
    if (origCtx && origText) {
        if (section === 'inbox' && letter.originalContent) {
            origText.textContent = letter.originalContent;
            origText.style.maxHeight = '80px';
            origCtx.style.display = 'block';
            if (origExpand) {
                origExpand.style.display = letter.originalContent.length > 120 ? 'block' : 'none';
                origExpand.textContent = '展开查看全文';
            }
        } else {
            origCtx.style.display = 'none';
        }
    }

    // --- [核心新增]：点击回复按钮时，把当前信件内容“带走” ---
    const replyBtn = document.getElementById('env-view-reply-btn'); // 假设你的按钮ID是这个
    if (replyBtn) {
        replyBtn.onclick = () => {
            // 记住内容
            window._pendingReplyContent = letter.content; 
            // 关闭当前窗口
            hideModal(document.getElementById('envelope-view-modal'));
            // 打开写信窗口
            window.openEnvelopeCompose(); 
            
            // 在输入框上方显示预览
            let pBox = document.getElementById('reply-preview-box');
            if (!pBox) {
                pBox = document.createElement('div');
                pBox.id = 'reply-preview-box';
                pBox.style = "background:#f4f1ff; border-left:4px solid #7c4dff; padding:8px; margin-bottom:10px; font-size:13px; border-radius:4px; color:#666;";
                const inputArea = document.getElementById('envelope-input');
                inputArea.parentNode.insertBefore(pBox, inputArea);
            }
            pBox.innerHTML = `<small style="color:#7c4dff">正在回复对方：</small><br>${letter.content.substring(0, 50)}${letter.content.length > 50 ? '...' : ''}`;
            pBox.style.display = 'block';
        };
    }
    showModal(document.getElementById('envelope-view-modal'));
};

window.toggleEnvLetterStarInView = function() {
    if (!editingEnvId || !editingEnvSection) return;
    toggleEnvLetterStar(editingEnvSection, editingEnvId);
    const letters = editingEnvSection === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    const letter = letters.find(l => l.id === editingEnvId);
    const starBtn = document.getElementById('env-view-star-btn');
    if (starBtn && letter) {
        starBtn.textContent = letter.starred ? '★ 已标星' : '☆ 标星';
        starBtn.classList.toggle('env-star-btn-active', !!letter.starred);
    }
};

window.toggleEnvEdit = function() {
    const contentEl = document.getElementById('env-view-content');
    const editEl = document.getElementById('env-view-edit');
    const editBtn = document.getElementById('env-view-edit-btn');
    const saveBtn = document.getElementById('env-view-save-btn');
    const isEditing = editEl.style.display !== 'none';
    if (isEditing) {
        contentEl.style.display = 'block';
        editEl.style.display = 'none';
        editBtn.textContent = '编辑';
        saveBtn.style.display = 'none';
    } else {
        contentEl.style.display = 'none';
        editEl.style.display = 'block';
        editBtn.textContent = '取消';
        saveBtn.style.display = 'inline-flex';
    }
};

window.saveEnvEdit = function() {
    const newContent = document.getElementById('env-edit-input').value.trim();
    if (!newContent) { showNotification('内容不能为空', 'warning'); return; }
    const letters = editingEnvSection === 'outbox' ? envelopeData.outbox : envelopeData.inbox;
    const letter = letters.find(l => l.id === editingEnvId);
    if (letter) {
        letter.content = newContent;
        saveEnvelopeData();
        const textEl = document.getElementById('env-view-text');
        if (textEl) textEl.textContent = newContent;
        showNotification('已保存修改', 'success');
        toggleEnvEdit();
    }
};

window.closeEnvViewModal = function() {
    hideModal(document.getElementById('envelope-view-modal'));
};

window.deleteEnvLetter = function(event, section, id) {
    event.stopPropagation();
    if (!confirm('确定要删除这封信吗？')) return;
    if (section === 'outbox') {
        envelopeData.outbox = envelopeData.outbox.filter(l => l.id !== id);
    } else {
        envelopeData.inbox = envelopeData.inbox.filter(l => l.id !== id);
    }
    saveEnvelopeData();
    renderEnvelopeLists();
    showNotification('已删除', 'success');
};

window.openNewEnvelopeForm = function() {
    document.getElementById('env-outbox-section').style.display = 'none';
    document.getElementById('env-inbox-section').style.display = 'none';
    document.getElementById('env-main-close-btn').style.display = 'none';
    document.getElementById('env-compose-title').textContent = '写一封信';
    document.getElementById('envelope-input').value = '';
    document.getElementById('env-send-to-chat').checked = false;
    document.getElementById('env-compose-form').style.display = 'block';
};

window.cancelEnvelopeCompose = function() {
    // --- 新增：清理回信预览框 ---
    const pBox = document.getElementById('reply-preview-box');
    if (pBox) pBox.style.display = 'none';
    // -------------------------

    document.getElementById('env-compose-form').style.display = 'none';
    document.getElementById('env-main-close-btn').style.display = 'flex';
    if (currentEnvTab === 'outbox') {
        document.getElementById('env-outbox-section').style.display = 'block';
    } else {
        document.getElementById('env-inbox-section').style.display = 'block';
    }
};

function handleSendEnvelope() {
    const pBox = document.getElementById('reply-preview-box');
    if (pBox) pBox.style.display = 'none';
    const text = document.getElementById('envelope-input').value.trim();
    if (!text) { showNotification('信件内容不能为空', 'warning'); return; }

    const sendToChat = document.getElementById('env-send-to-chat').checked;
    if (sendToChat) {
        addMessage({ id: Date.now(), sender: 'user', text: `【寄出的信】\n${text}`, timestamp: new Date(), status: 'sent', type: 'normal' });
    }

    const minHours = 2, maxHours = 12;
    const randomHours = Math.random() * (maxHours - minHours) + minHours;
    const replyTime = Date.now() + randomHours * 60 * 60 * 1000;
    const newId = 'env_' + Date.now() + '_' + Math.random().toString(36).substr(2,4);
    envelopeData.outbox.push({
        id: newId, content: text,
        sentTime: Date.now(), replyTime,
        status: 'pending'
    });
    saveEnvelopeData();

    cancelEnvelopeCompose();
    switchEnvTab('outbox');
    showNotification(`信件已寄出，预计 ${Math.floor(randomHours)} 小时后收到回信 ✉️`, 'success');
}

// ─── 后台循环检查（原本 checkEnvelopeStatus 只在被动调用时才执行一次，
// 现在补上真正的定时循环，不用打开信箱面板也能在后台生成回信/系统来信）───
let _envelopeCheckTimer = null;
function scheduleEnvelopeCheck() {
    if (_envelopeCheckTimer) clearTimeout(_envelopeCheckTimer);
    // 每隔6~10分钟检查一次；具体要不要真的生成新信，由 checkEnvelopeStatus
    // 内部自己的回信时间判定 + 1小时冷却 + 50%概率 这些门限来控制节奏
    const delay = (6 + Math.random() * 4) * 60 * 1000;
    _envelopeCheckTimer = setTimeout(() => { checkEnvelopeStatus(); scheduleEnvelopeCheck(); }, delay);
}

document.addEventListener('DOMContentLoaded', function () {
    const waitReady = setInterval(function () {
        if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
            clearInterval(waitReady);
            setTimeout(() => { checkEnvelopeStatus(); scheduleEnvelopeCheck(); }, 4000);
        }
    }, 300);
});
