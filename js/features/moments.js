/**
 * features/moments.js - 朋友圈功能（无 AI 版本，v2）
 *
 * 依赖（均已存在于现有代码中）：
 *   getStorageKey, safeGetItem, safeSetItem, localforage, showNotification,
 *   settings, customReplies, addMessage, showModal, hideModal, SESSION_ID
 *
 * v2 改动：
 *   1. 数据存储从 localStorage(safeSetItem) 换成 localforage(IndexedDB)，
 *      避免图片较多时超出 localStorage 5~10MB 配额导致静默存储失败
 *      （之前"图片库丢失/封面复原/朋友圈刷新消失"都是这个原因）。
 *   2. 内部不再每次操作都重新 loadMomentsData()，全程以内存里的
 *      momentsData 为唯一数据源，只在打开朋友圈面板时刷新一次，
 *      避免"保存失败后被旧数据覆盖"的连锁问题。
 *   3. getRandomReplyText 随机概率换行，不再是一整段密文。
 *   4. 对方回复评论 / 回复回复，现在也会在聊天页留一条系统消息，
 *      不再只依赖容易错过的 toast 提示。
 */

(function() {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    // ─── 数据 ──────────────────────────────
    let momentsData = {
        myCover: null,
        partnerCover: null,
        partnerCoverOptions: [],   // [{id, url}]
        partnerImagePool: [],      // [{id, url}]
        posts: []                  // 所有帖子
    };

    let currentMomentsTab = 'mine';
    let momentsEditorImages = [];  // [{url}]

    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '对方';
    }
    function getMyName() {
        return (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
    }

    // ─── 存储：走 localforage（IndexedDB），容量远大于 localStorage ──
    async function loadMomentsData() {
        try {
            const saved = await localforage.getItem(getStorageKey('momentsData'));
            if (saved) {
                momentsData = {
                    myCover: saved.myCover || null,
                    partnerCover: saved.partnerCover || null,
                    partnerCoverOptions: Array.isArray(saved.partnerCoverOptions) ? saved.partnerCoverOptions : [],
                    partnerImagePool: Array.isArray(saved.partnerImagePool) ? saved.partnerImagePool : [],
                    posts: Array.isArray(saved.posts) ? saved.posts : []
                };
            }
        } catch (e) {
            console.error('加载朋友圈数据失败', e);
        }
    }

    function saveMomentsData() {
        localforage.setItem(getStorageKey('momentsData'), momentsData).catch(e => {
            console.error('保存朋友圈数据失败', e);
            showNotification('朋友圈数据保存失败了，可能是图片太大，建议用图片链接代替本地上传', 'error', 4500);
        });
    }

    // ─── 随机字卡文案（跟 simulateReply 用同一个池子），随机概率换行 ──
    function getRandomReplyText(minCount, maxCount) {
        const replyPool = (typeof customReplies !== 'undefined' && customReplies.length > 0)
            ? customReplies
            : ['一切安好', '今天很开心', '想你', '天气真好', '要开心哦'];
        const count = typeof maxCount === 'number' ? minCount + Math.floor(Math.random() * (maxCount - minCount + 1)) : minCount;
        const shuffled = [...replyPool].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, shuffled.length));
        if (selected.length === 0) return '今天心情不错 ✦';

        let result = '';
        selected.forEach((item, idx) => {
            result += item + '。';
            if (idx < selected.length - 1) {
                result += Math.random() < 0.45 ? '\n' : '';
            }
        });
        return result;
    }

    function textToHtml(text) {
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    // ─── 渲染朋友圈列表 ──────────────────────
    function renderMomentsList(tab) {
        currentMomentsTab = tab;
        const container = document.getElementById('moments-content');
        if (!container) return;
        document.querySelectorAll('#moments-tabs .moments-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

        const pn = getPartnerName();
        const mn = getMyName();
        const myAvatarImg = document.querySelector('#my-avatar img');
        const partnerAvatarImg = document.querySelector('#partner-avatar img');
        const myAvatar = myAvatarImg ? myAvatarImg.src : null;
        const partnerAvatar = partnerAvatarImg ? partnerAvatarImg.src : null;

        const coverUrl = tab === 'mine' ? momentsData.myCover : momentsData.partnerCover;

        const posts = momentsData.posts
            .filter(p => p.author === (tab === 'mine' ? 'me' : 'partner'))
            .sort((a, b) => b.timestamp - a.timestamp);

        let html = '';

        html += `<div class="moments-cover-wrap">
            ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="封面">` : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#2c3e50,#4a6fa5);"></div>'}
            <button class="moments-cover-change-btn" onclick="window.momentsChangeCover('${tab}')">
                <i class="fas fa-camera"></i> 更换封面
            </button>
            <div class="moments-avatar-inline">
                ${(tab === 'mine' ? myAvatar : partnerAvatar)
                    ? `<img src="${escapeHtml(tab === 'mine' ? myAvatar : partnerAvatar)}" alt="">`
                    : `<i class="fas fa-user"></i>`}
            </div>
        </div>`;

        if (tab === 'partner') {
            html += `<div class="moments-partner-actions">
                <button class="moments-partner-action-btn" onclick="window.openPartnerCoverManager()">
                    <i class="fas fa-images"></i> 管理封面
                </button>
                <button class="moments-partner-action-btn" onclick="window.openPartnerImagePool()">
                    <i class="fas fa-camera"></i> 管理图片库
                </button>
            </div>`;
        }

        if (posts.length === 0) {
            html += `<div class="moments-empty">
                <i class="fas fa-camera-retro"></i>
                <p>${tab === 'mine' ? '还没有发过朋友圈' : escapeHtml(pn) + '还没有发过朋友圈'}</p>
                <span>${tab === 'mine' ? '记录下这一刻的想法吧~' : '等待ta分享生活点滴'}</span>
            </div>`;
        } else {
            posts.forEach(post => {
                const isMe = post.author === 'me';
                const authorName = isMe ? mn : pn;
                const avatar = isMe ? myAvatar : partnerAvatar;
                const timeStr = new Date(post.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

                html += `<div class="moment-post" data-post-id="${post.id}">
                    <div class="moment-post-header">
                        <div class="moment-post-avatar">
                            ${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : `<i class="fas fa-user"></i>`}
                        </div>
                        <div class="moment-post-user">
                            <div class="moment-post-name">${escapeHtml(authorName)}</div>
                            <div class="moment-post-time">${timeStr}</div>
                        </div>
                        <button class="moment-post-delete" onclick="window.deleteMomentPost('${post.id}')" title="删除">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>`;

                if (post.text) {
                    html += `<div class="moment-post-text">${textToHtml(post.text)}</div>`;
                }

                if (post.images && post.images.length > 0) {
                    const gridClass = `grid-${Math.min(post.images.length, 9)}`;
                    html += `<div class="moment-post-images ${gridClass}">`;
                    post.images.forEach(img => {
                        html += `<div class="moment-post-img-wrap"><img src="${escapeHtml(img.url)}" class="moment-post-img" onclick="if(typeof viewImage==='function')viewImage('${escapeHtml(img.url.replace(/'/g,"\\'"))}')" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`;
                    });
                    html += `</div>`;
                }

                const likeCount = post.likes ? post.likes.length : 0;
                const commentCount = post.comments ? post.comments.length : 0;
                html += `<div class="moment-post-actions">
                    <button class="moment-action-btn ${post.likes && post.likes.includes('me') ? 'liked' : ''}" onclick="window.toggleMomentLike('${post.id}')">
                        <i class="fas fa-heart"></i> ${likeCount > 0 ? likeCount : '赞'}
                    </button>
                    <button class="moment-action-btn" onclick="window.commentOnMoment('${post.id}')">
                        <i class="fas fa-comment"></i> ${commentCount > 0 ? commentCount : '评论'}
                    </button>
                </div>`;

                if (post.comments && post.comments.length > 0) {
                    html += `<div class="moment-comments" id="comments-${post.id}">`;
                    post.comments.forEach(comment => {
                        const cAuthor = comment.author === 'me' ? mn : pn;
                        html += `<div class="moment-comment">
                            <div class="moment-comment-author">${escapeHtml(cAuthor)}</div>
                            <div class="moment-comment-text">${textToHtml(comment.text)}</div>`;
                        if (comment.replies && comment.replies.length > 0) {
                            comment.replies.forEach(reply => {
                                const rAuthor = reply.author === 'me' ? mn : pn;
                                html += `<div style="margin-left:16px;padding:4px 0;border-top:1px dashed rgba(var(--accent-color-rgb),0.05);">
                                    <div class="moment-comment-author" style="font-size:11px;">${escapeHtml(rAuthor)}</div>
                                    <div class="moment-comment-text" style="font-size:12px;">${textToHtml(reply.text)}</div>
                                </div>`;
                            });
                        }
                        html += `<span class="moment-comment-reply" onclick="window.replyToMomentComment('${post.id}','${comment.id}')">
                            <i class="fas fa-reply"></i> 回复
                        </span>`;
                        html += `</div>`;
                    });
                    html += `</div>`;
                }

                html += `</div>`;
            });
        }

        if (tab === 'mine') {
            html += `<div class="moments-publish-bar">
                <button class="moments-publish-btn" onclick="window.openMomentEditor()">
                    <i class="fas fa-pen"></i> 发布朋友圈
                </button>
            </div>`;
        }

        container.innerHTML = html;
        container.scrollTop = 0;
        const fab = document.getElementById('partner-post-fab');
        if (fab) fab.style.display = (tab === 'partner') ? 'flex' : 'none';
    }

    // ─── 更换封面 ──────────────────────────
    window.momentsChangeCover = function(tab) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:20px;padding:24px;width:88%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
                    <i class="fas fa-image"></i> 更换封面
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button class="delivery-checkout-btn" id="cover-local-btn" style="background:var(--accent-color);">
                        <i class="fas fa-upload"></i> 选择本地图片
                    </button>
                    <button class="delivery-checkout-btn" id="cover-url-btn" style="background:var(--accent-color);opacity:0.8;">
                        <i class="fas fa-link"></i> 使用图片链接（推荐，不占本地存储空间）
                    </button>
                    <button class="delivery-manage-btn" id="cover-cancel-btn" style="padding:12px;">取消</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#cover-cancel-btn').onclick = close;

        overlay.querySelector('#cover-local-btn').onclick = () => {
            close();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { showNotification('图片不能超过5MB', 'error'); return; }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (tab === 'mine') momentsData.myCover = ev.target.result;
                    else momentsData.partnerCover = ev.target.result;
                    saveMomentsData();
                    renderMomentsList(tab);
                    showNotification('封面已更新 ✨', 'success');
                };
                reader.readAsDataURL(file);
            };
            input.click();
        };
        overlay.querySelector('#cover-url-btn').onclick = () => {
            close();
            const url = prompt('请输入封面图片的URL链接：');
            if (url && url.trim()) {
                if (tab === 'mine') momentsData.myCover = url.trim();
                else momentsData.partnerCover = url.trim();
                saveMomentsData();
                renderMomentsList(tab);
                showNotification('封面已更新 ✨', 'success');
            }
        };
    };

    // ─── 发布编辑器 ──────────────────────────
    window.openMomentEditor = function() {
        const overlay = document.getElementById('moments-editor-overlay');
        document.getElementById('moments-editor-text').value = '';
        momentsEditorImages = [];
        renderEditorImages();
        overlay.classList.add('active');
        updateEditorSubmitBtn();
    };

    function renderEditorImages() {
        const container = document.getElementById('moments-editor-images');
        const addArea = document.getElementById('moments-editor-add-area');
        if (momentsEditorImages.length === 0) {
            container.innerHTML = '';
            addArea.style.display = 'block';
        } else {
            container.innerHTML = momentsEditorImages.map((img, idx) => `
                <div class="moments-editor-img-item">
                    <img src="${escapeHtml(img.url)}" alt="">
                    <button class="moments-editor-img-remove" data-idx="${idx}">✕</button>
                </div>`).join('');
            addArea.style.display = momentsEditorImages.length < 9 ? 'block' : 'none';
        }
        container.querySelectorAll('.moments-editor-img-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                momentsEditorImages.splice(idx, 1);
                renderEditorImages();
                updateEditorSubmitBtn();
            });
        });
        updateEditorSubmitBtn();
    }

    function updateEditorSubmitBtn() {
        const text = document.getElementById('moments-editor-text').value.trim();
        const hasContent = text.length > 0 || momentsEditorImages.length > 0;
        document.getElementById('moments-editor-submit').disabled = !hasContent;
    }

    function addEditorImage(url) {
        if (momentsEditorImages.length >= 9) {
            showNotification('最多只能添加9张图片', 'warning');
            return;
        }
        momentsEditorImages.push({ url });
        renderEditorImages();
        updateEditorSubmitBtn();
    }

    function publishMoment() {
        const text = document.getElementById('moments-editor-text').value.trim();
        if (!text && momentsEditorImages.length === 0) {
            showNotification('请至少填写文字或添加图片', 'warning');
            return;
        }
        const post = {
            id: 'moment_' + Date.now(),
            author: 'me',
            text: text,
            images: momentsEditorImages.map(img => ({ url: img.url })),
            timestamp: Date.now(),
            likes: [],
            comments: []
        };
        momentsData.posts.push(post);
        saveMomentsData();

        document.getElementById('moments-editor-overlay').classList.remove('active');
        document.getElementById('moments-editor-text').value = '';
        momentsEditorImages = [];
        renderEditorImages();
        renderMomentsList('mine');
        showNotification('朋友圈已发布 ✨', 'success');

        schedulePartnerInteraction(post.id, 5 * 60 * 1000);
    }

    // ─── 对方自动点赞+评论（发帖后）──────────
    function schedulePartnerInteraction(postId, maxDelay) {
        const delay = Math.random() * maxDelay;
        setTimeout(() => {
            const post = momentsData.posts.find(p => p.id === postId);
            if (!post) return;

            if (!post.likes) post.likes = [];
            if (!post.likes.includes('partner')) post.likes.push('partner');

            const commentText = getRandomReplyText(2, 3);
            const comment = {
                id: 'cmt_' + Date.now(),
                author: 'partner',
                text: commentText,
                timestamp: Date.now(),
                replies: []
            };
            if (!post.comments) post.comments = [];
            post.comments.push(comment);
            saveMomentsData();

            const pn = getPartnerName();
            notifyInChat(`${pn} 点赞并评论了你的朋友圈 ✦`);

            if (currentMomentsTab === 'mine') renderMomentsList('mine');
            showNotification(`${pn} 点赞并评论了你的朋友圈 ✦`, 'success', 3000);
        }, delay);
    }

    // ─── 点赞 ──────────────────────────────
    window.toggleMomentLike = function(postId) {
        const post = momentsData.posts.find(p => p.id === postId);
        if (!post) return;
        if (!post.likes) post.likes = [];
        const idx = post.likes.indexOf('me');
        if (idx >= 0) post.likes.splice(idx, 1);
        else post.likes.push('me');
        saveMomentsData();
        renderMomentsList(currentMomentsTab);
    };

    // ─── 评论 ──────────────────────────────
    window.commentOnMoment = function(postId) {
        const text = prompt('写下你的评论：');
        if (!text || !text.trim()) return;

        const post = momentsData.posts.find(p => p.id === postId);
        if (!post) return;

        const comment = {
            id: 'cmt_' + Date.now(),
            author: 'me',
            text: text.trim(),
            timestamp: Date.now(),
            replies: []
        };
        if (!post.comments) post.comments = [];
        post.comments.push(comment);
        saveMomentsData();
        renderMomentsList(currentMomentsTab);
        showNotification('评论成功 ✦', 'success');

        const delay = Math.random() * 60 * 1000;
        setTimeout(() => {
            const latestPost = momentsData.posts.find(p => p.id === postId);
            if (!latestPost) return;
            const latestComment = latestPost.comments.find(c => c.id === comment.id);
            if (!latestComment) return;

            const partnerReplyText = getRandomReplyText(2, 3);
            const partnerReply = {
                id: 'reply_' + Date.now(),
                author: 'partner',
                text: partnerReplyText,
                timestamp: Date.now()
            };
            if (!latestComment.replies) latestComment.replies = [];
            latestComment.replies.push(partnerReply);
            saveMomentsData();

            const pn = getPartnerName();
            notifyInChat(`${pn} 回复了你在朋友圈的评论 ✦`);

            if (currentMomentsTab === 'partner' || currentMomentsTab === 'mine') renderMomentsList(currentMomentsTab);
            showNotification(`${pn} 回复了你的评论 ✦`, 'success', 3000);
        }, delay);
    };

    window.replyToMomentComment = function(postId, commentId) {
        const replyText = prompt('输入你的回复：');
        if (!replyText || !replyText.trim()) return;

        const post = momentsData.posts.find(p => p.id === postId);
        if (!post) return;
        const comment = post.comments.find(c => c.id === commentId);
        if (!comment) return;

        const reply = { id: 'reply_' + Date.now(), author: 'me', text: replyText.trim(), timestamp: Date.now() };
        if (!comment.replies) comment.replies = [];
        comment.replies.push(reply);
        saveMomentsData();
        renderMomentsList(currentMomentsTab);
        showNotification('回复成功 ✦', 'success');

        const delay = Math.random() * 60 * 1000;
        setTimeout(() => {
            const currentPost = momentsData.posts.find(p => p.id === postId);
            if (!currentPost) return;
            const currentComment = currentPost.comments.find(c => c.id === commentId);
            if (!currentComment) return;

            const partnerReplyText = getRandomReplyText(2, 3);
            const partnerReply = { id: 'reply_' + Date.now(), author: 'partner', text: partnerReplyText, timestamp: Date.now() };
            if (!currentComment.replies) currentComment.replies = [];
            currentComment.replies.push(partnerReply);
            saveMomentsData();

            const pn = getPartnerName();
            notifyInChat(`${pn} 回复了你在朋友圈的评论 ✦`);

            if (currentMomentsTab === 'mine') renderMomentsList('mine');
            showNotification(`${pn} 回复了你的评论 ✦`, 'success', 3000);
        }, delay);
    };

    window.deleteMomentPost = function(postId) {
        if (!confirm('确定要删除这条朋友圈吗？')) return;
        momentsData.posts = momentsData.posts.filter(p => p.id !== postId);
        saveMomentsData();
        renderMomentsList(currentMomentsTab);
        showNotification('已删除', 'success');
    };

    // ─── 对方封面管理 ──────────────────────
    window.openPartnerCoverManager = function() {
        const overlay = document.getElementById('moments-cover-manager-overlay');
        document.getElementById('moments-cover-manager-title').textContent = '管理' + getPartnerName() + '封面';
        const body = document.getElementById('moments-cover-manager-body');

        let html = '<div class="moments-cover-options">';
        momentsData.partnerCoverOptions.forEach((opt) => {
            const isActive = momentsData.partnerCover === opt.url;
            html += `<div class="moments-cover-option${isActive ? ' active' : ''}" onclick="window.selectPartnerCover('${opt.id}')">
                <img src="${escapeHtml(opt.url)}" onerror="this.style.display='none'">
                <button class="cover-option-delete" onclick="event.stopPropagation();window.deletePartnerCoverOption('${opt.id}')">✕</button>
            </div>`;
        });
        html += `<div class="moments-cover-add" onclick="window.addPartnerCoverOption()">
            <i class="fas fa-plus"></i> 添加封面
        </div>`;
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text-secondary);padding:8px 0;text-align:center;">建议用"图片链接"而不是本地上传，本地图片会占用较多存储空间</div>';

        body.innerHTML = html;
        overlay.classList.add('active');
    };

    window.selectPartnerCover = function(coverId) {
        const opt = momentsData.partnerCoverOptions.find(o => o.id === coverId);
        if (opt) {
            momentsData.partnerCover = opt.url;
            saveMomentsData();
            renderMomentsList('partner');
            window.openPartnerCoverManager();
            showNotification('封面已切换', 'success');
        }
    };

    window.deletePartnerCoverOption = function(coverId) {
        if (!confirm('确定删除这个封面吗？')) return;
        const opt = momentsData.partnerCoverOptions.find(o => o.id === coverId);
        momentsData.partnerCoverOptions = momentsData.partnerCoverOptions.filter(o => o.id !== coverId);
        if (opt && momentsData.partnerCover === opt.url) {
            momentsData.partnerCover = momentsData.partnerCoverOptions.length > 0 ? momentsData.partnerCoverOptions[0].url : null;
        }
        saveMomentsData();
        renderMomentsList('partner');
        window.openPartnerCoverManager();
        showNotification('封面已删除', 'success');
    };

    window.addPartnerCoverOption = function() {
        const mode = confirm('点击"确定"选择本地图片，点击"取消"使用图片链接（推荐）');
        if (mode) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { showNotification('图片不能超过5MB', 'error'); return; }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    momentsData.partnerCoverOptions.push({ id: 'cover_' + Date.now(), url: ev.target.result });
                    if (!momentsData.partnerCover) momentsData.partnerCover = ev.target.result;
                    saveMomentsData();
                    renderMomentsList('partner');
                    window.openPartnerCoverManager();
                    showNotification('封面已添加', 'success');
                };
                reader.readAsDataURL(file);
            };
            input.click();
        } else {
            const url = prompt('请输入封面图片URL：');
            if (url && url.trim()) {
                momentsData.partnerCoverOptions.push({ id: 'cover_' + Date.now(), url: url.trim() });
                if (!momentsData.partnerCover) momentsData.partnerCover = url.trim();
                saveMomentsData();
                renderMomentsList('partner');
                window.openPartnerCoverManager();
                showNotification('封面已添加', 'success');
            }
        }
    };

    // ─── 对方图片池管理（用于自动发帖配图）──────
    window.openPartnerImagePool = function() {
        const overlay = document.getElementById('moments-cover-manager-overlay');
        document.getElementById('moments-cover-manager-title').textContent = '管理' + getPartnerName() + '图片库';
        const body = document.getElementById('moments-cover-manager-body');

        let html = '<div class="moments-image-pool">';
        momentsData.partnerImagePool.forEach((item) => {
            html += `<div class="moments-pool-item">
                <img src="${escapeHtml(item.url)}" onerror="this.style.display='none'">
                <button class="moments-pool-item-delete" onclick="window.deletePartnerPoolItem('${item.id}')">✕</button>
            </div>`;
        });
        html += `<div class="moments-cover-add" onclick="window.addPartnerPoolItem()">
            <i class="fas fa-plus"></i> 添加图片
        </div>`;
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text-secondary);padding:8px 0;text-align:center;">这些图片会被随机用于对方的自动发帖配图，建议用图片链接而不是本地上传</div>';

        body.innerHTML = html;
        overlay.classList.add('active');
    };

    window.deletePartnerPoolItem = function(itemId) {
        if (!confirm('确定删除这张图片吗？')) return;
        momentsData.partnerImagePool = momentsData.partnerImagePool.filter(i => i.id !== itemId);
        saveMomentsData();
        window.openPartnerImagePool();
        showNotification('已删除', 'success');
    };

    window.addPartnerPoolItem = function() {
        const mode = confirm('点击"确定"选择本地图片，点击"取消"使用图片链接（推荐）');
        const addItem = (url) => {
            momentsData.partnerImagePool.push({ id: 'pool_' + Date.now() + '_' + Math.floor(Math.random() * 10000), url: url });
            saveMomentsData();
            window.openPartnerImagePool();
            showNotification('图片已添加', 'success');
        };
        if (mode) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { showNotification('图片不能超过5MB', 'error'); return; }
                const reader = new FileReader();
                reader.onload = (ev) => addItem(ev.target.result);
                reader.readAsDataURL(file);
            };
            input.click();
        } else {
            const url = prompt('请输入图片URL：');
            if (url && url.trim()) addItem(url.trim());
        }
    };

    // ─── 对方自动发朋友圈：每日随机调度 ──────
    function schedulePartnerMoments() {
        const today = new Date().toDateString();
        let schedule;
        try {
            schedule = JSON.parse(safeGetItem(getStorageKey('momentsSchedule')) || '{}');
        } catch (e) { schedule = {}; }

        if (schedule.date === today) return;

        const count = 1 + Math.floor(Math.random() * 5); // 每天1~5条
        const times = [];
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;

        for (let i = 0; i < count; i++) {
            const randomTime = dayStart + Math.random() * (dayEnd - dayStart - 60 * 60 * 1000) + 30 * 60 * 1000;
            times.push(randomTime);
        }
        times.sort((a, b) => a - b);

        schedule = { date: today, times: times, posted: [] };
        safeSetItem(getStorageKey('momentsSchedule'), JSON.stringify(schedule));

        times.forEach(t => {
            const delay = Math.max(0, t - Date.now());
            setTimeout(() => publishPartnerMoment(), delay);
        });
    }

    function publishPartnerMoment() {
        const isImagePost = momentsData.partnerImagePool.length > 0 && Math.random() < 0.6;
        let text = '';
        let images = [];

        if (!isImagePost || Math.random() < 0.5) {
            text = getRandomReplyText(3, 5);
        }

        if (isImagePost) {
            const imgCount = 1 + Math.floor(Math.random() * Math.min(4, momentsData.partnerImagePool.length));
            const shuffled = [...momentsData.partnerImagePool].sort(() => Math.random() - 0.5);
            images = shuffled.slice(0, imgCount).map(img => ({ url: img.url }));
        }

        if (!text && images.length === 0) {
            text = getRandomReplyText(3, 5);
        }

        const post = {
            id: 'moment_' + Date.now(),
            author: 'partner',
            text: text,
            images: images,
            timestamp: Date.now(),
            likes: [],
            comments: []
        };

        momentsData.posts.push(post);
        saveMomentsData();

        if (currentMomentsTab === 'partner') renderMomentsList('partner');
        const pn = getPartnerName();
        showNotification(`${pn} 发布了一条朋友圈 ✦`, 'success', 3000);
        notifyInChat(`${pn} 发布了一条新朋友圈，快去看看吧 ✦`);
    }
    window.publishPartnerMomentNow = publishPartnerMoment; // 供数据管理面板测试按钮调用

    function restoreSchedule() {
        try {
            const schedule = JSON.parse(safeGetItem(getStorageKey('momentsSchedule')) || '{}');
            const today = new Date().toDateString();
            if (schedule.date !== today) return;

            schedule.times.forEach(t => {
                if (schedule.posted && schedule.posted.includes(t)) return;
                const delay = Math.max(0, t - Date.now());
                if (delay > 0) {
                    setTimeout(() => {
                        publishPartnerMoment();
                        if (!schedule.posted) schedule.posted = [];
                        schedule.posted.push(t);
                        safeSetItem(getStorageKey('momentsSchedule'), JSON.stringify(schedule));
                    }, delay);
                } else if (delay > -60000) {
                    setTimeout(() => publishPartnerMoment(), 100);
                    if (!schedule.posted) schedule.posted = [];
                    schedule.posted.push(t);
                    safeSetItem(getStorageKey('momentsSchedule'), JSON.stringify(schedule));
                }
            });
        } catch (e) {}
    }

    // ─── 初始化 ──────────────────────────────
    async function initMoments() {
        await loadMomentsData();

        const entryBtn = document.getElementById('moments-function');
        if (entryBtn) {
            entryBtn.addEventListener('click', async () => {
                const advancedModal = document.getElementById('advanced-modal');
                if (advancedModal && typeof hideModal === 'function') hideModal(advancedModal);
                await loadMomentsData();
                renderMomentsList('mine');
                if (typeof showModal === 'function') showModal(document.getElementById('moments-modal'));
            });
        }

        document.querySelectorAll('#moments-tabs .moments-tab').forEach(tab => {
            tab.addEventListener('click', () => renderMomentsList(tab.dataset.tab));
        });

        const closeBtn = document.getElementById('moments-close');
        if (closeBtn) closeBtn.addEventListener('click', () => hideModal(document.getElementById('moments-modal')));

        document.getElementById('moments-editor-close').addEventListener('click', () => {
            document.getElementById('moments-editor-overlay').classList.remove('active');
        });
        document.getElementById('moments-editor-cancel').addEventListener('click', () => {
            document.getElementById('moments-editor-overlay').classList.remove('active');
        });
        document.getElementById('moments-editor-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('moments-editor-overlay')) {
                document.getElementById('moments-editor-overlay').classList.remove('active');
            }
        });
        document.getElementById('moments-editor-submit').addEventListener('click', publishMoment);
        document.getElementById('moments-editor-text').addEventListener('input', updateEditorSubmitBtn);

        document.getElementById('moments-editor-local-btn').addEventListener('click', () => {
            document.getElementById('moments-local-input').click();
        });
        document.getElementById('moments-local-input').addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                if (file.size > 5 * 1024 * 1024) { showNotification('图片不能超过5MB', 'error'); return; }
                const reader = new FileReader();
                reader.onload = (ev) => addEditorImage(ev.target.result);
                reader.readAsDataURL(file);
            });
            e.target.value = '';
        });
        document.getElementById('moments-editor-url-btn').addEventListener('click', () => {
            const url = prompt('请输入图片URL链接：');
            if (url && url.trim()) addEditorImage(url.trim());
        });
        document.getElementById('moments-editor-add-img-btn').addEventListener('click', () => {
            document.getElementById('moments-local-input').click();
        });

        document.getElementById('moments-cover-manager-close').addEventListener('click', () => {
            document.getElementById('moments-cover-manager-overlay').classList.remove('active');
        });
        document.getElementById('moments-cover-manager-cancel').addEventListener('click', () => {
            document.getElementById('moments-cover-manager-overlay').classList.remove('active');
        });
        document.getElementById('moments-cover-manager-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('moments-cover-manager-overlay')) {
                document.getElementById('moments-cover-manager-overlay').classList.remove('active');
            }
        });

        setInterval(() => {
            const tab = document.getElementById('moments-tab-partner');
            if (tab) tab.textContent = getPartnerName() + '的';
        }, 1000);

        schedulePartnerMoments();
        restoreSchedule();
    }

    document.addEventListener('DOMContentLoaded', function() {
        const waitReady = setInterval(function() {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                initMoments();
            }
        }, 300);
    });
})();
