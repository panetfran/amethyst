/**
 * features/sync-questionnaire.js - 同步问卷（当场一起答题，无 AI）
 *
 * 跟"梦向问卷"不是一回事：梦向问卷是你出题、对方在后台代填、你事后看结果；
 * 这个是你和对方当场轮流选答案，选完立刻并排显示，还能要求对方重选
 * （50%概率会被拒绝），部分题目还能互相写评论。
 *
 * 依赖：getStorageKey, localforage, showNotification, showModal, hideModal,
 *       settings, customReplies, SESSION_ID
 * 不需要 AI：对方选项是随机选一个；对方评论跟朋友圈/快问快答一样，从字卡库
 * （customReplies）随机抽2~4条拼起来。
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '对方';
    }

    const BUILTIN_SURVEY = {
        id: 'builtin_tolerance',
        title: '对象和他人的关系你能忍到几级',
        builtin: true,
        questions: [
            '第1级：见面打招呼', '第2级：有联系方式', '第3级：偶尔的关心', '第4级：经常约着打游戏',
            '第5级：记得对方生日，并且互送礼物', '第6级：把ta挂在嘴边，动不动就提起', '第7级：单独约吃饭看电影',
            '第8级：打个电话就会去赴约', '第9级：频繁聊天发消息', '第10级：喝醉了给ta打电话',
            '第11级：一起合租', '第12级：单独一起旅行', '第13级：一起开一间房',
            '第14级：在你的面前和ta有直接的亲密举动', '第15级：孩子全都不是你的'
        ].map(t => ({ text: t, options: ['接受', '中立', '拒绝'], needComment: true }))
    };

    let syncSurveys = [];
    let syncRecords = [];
    let editingSurvey = null;
    let editingIsNew = false;
    let sf = null; // 当前填写状态
    let sfTimer = null;
    let invitePopupTimer = null;

    // ─── 存储 ──────────────────────────────
    async function loadData() {
        try {
            const savedSurveys = await localforage.getItem(getStorageKey('syncSurveys'));
            syncSurveys = Array.isArray(savedSurveys) && savedSurveys.length > 0 ? savedSurveys : [JSON.parse(JSON.stringify(BUILTIN_SURVEY))];
        } catch (e) { syncSurveys = [JSON.parse(JSON.stringify(BUILTIN_SURVEY))]; }
        try {
            const savedRecords = await localforage.getItem(getStorageKey('syncSurveyRecords'));
            syncRecords = Array.isArray(savedRecords) ? savedRecords : [];
        } catch (e) { syncRecords = []; }
    }

    function saveData() {
        localforage.setItem(getStorageKey('syncSurveys'), syncSurveys).catch(() => {});
        localforage.setItem(getStorageKey('syncSurveyRecords'), syncRecords).catch(() => {});
    }

    // ─── 字卡评论生成（跟朋友圈/快问快答同一套逻辑）──────────
    function generateOppComment() {
        const pool = (typeof customReplies !== 'undefined' && customReplies.length > 0)
            ? customReplies : ['嗯嗯', '是这样', '我也这么想'];
        const n = Math.min(pool.length, randInt(2, 4));
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n).join('。') + '。';
    }

    // ─── 列表 ──────────────────────────────
    function renderList() {
        const deck = document.getElementById('sq-deck');
        if (!deck) return;
        if (syncSurveys.length === 0) {
            deck.innerHTML = `<div class="sq-empty">暂无问卷<br><span>点击下方"新建问卷"开始吧~</span></div>`;
            return;
        }
        deck.innerHTML = '<div class="sq-grid">' + syncSurveys.map(s => {
            const recs = syncRecords.filter(r => r.surveyId === s.id);
            return `
                <div class="sq-card" onclick="window.sqOpenDetail('${s.id}')">
                    <i class="fas fa-list-check sq-card-icon"></i>
                    <div class="sq-card-title">${escapeHtml(s.title || '未命名问卷')}</div>
                    <div class="sq-card-meta">${s.questions.length} 题 · 已填 ${recs.length} 次${s.builtin ? ' · 内置' : ''}</div>
                </div>`;
        }).join('') + '</div>';
    }

    // ─── 详情 ──────────────────────────────
    window.sqOpenDetail = function (id) {
        const s = syncSurveys.find(x => x.id === id);
        if (!s) return;
        const recs = syncRecords.filter(r => r.surveyId === id).sort((a, b) => b.ts - a.ts);

        let html = `
            <div class="sq-detail-tip">共 ${s.questions.length} 道题目${s.builtin ? ' · 内置问卷' : ''}</div>
            <div class="sq-btn-row">
                <button class="sq-pill-btn primary" onclick="window.sqInvite('${s.id}')"><i class="fas fa-paper-plane"></i> 邀请对方一起填</button>
            </div>
            <div class="sq-btn-row">
                <button class="sq-pill-btn" onclick="window.sqEditSurvey('${s.id}')"><i class="fas fa-pen"></i> 编辑</button>
                <button class="sq-pill-btn" onclick="window.sqExportSurvey('${s.id}')"><i class="fas fa-download"></i> 导出</button>
                <button class="sq-pill-btn danger" onclick="window.sqDeleteSurvey('${s.id}')"><i class="fas fa-trash-alt"></i> 删除</button>
            </div>`;

        if (recs.length) {
            html += `<div class="sq-section-label">填写记录</div><div class="sq-record-list">`;
            recs.forEach(r => {
                const d = new Date(r.ts);
                html += `
                    <div class="sq-record-item" onclick="window.sqOpenRecord('${r.id}')">
                        <span>${d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        <i class="fas fa-chevron-right"></i>
                    </div>`;
            });
            html += `</div>`;
        } else {
            html += `<div class="sq-empty" style="padding:30px 0;">还没有填写记录</div>`;
        }

        showSqModal(s.title || '未命名问卷', html);
    };

    window.sqOpenRecord = function (id) {
        const r = syncRecords.find(x => x.id === id);
        if (!r) return;
        const d = new Date(r.ts);
        let html = `<div class="sq-detail-tip">${d.toLocaleString('zh-CN')}</div>` + renderAnswersHtml(r.answers);
        html += `<div class="sq-btn-row"><button class="sq-pill-btn danger" onclick="window.sqDeleteRecord('${r.id}','${r.surveyId}')"><i class="fas fa-trash-alt"></i> 删除该记录</button></div>`;
        showSqModal(r.title || '填写记录', html);
    };

    function renderAnswersHtml(answers) {
        const pn = getPartnerName();
        return `<div class="sq-summary">` + answers.map(a => {
            let block = `
                <div class="sq-sum-item">
                    <div class="sq-sum-q">${escapeHtml(a.q)}</div>
                    <div class="sq-sum-row"><span class="sq-sum-who">我</span>${escapeHtml(a.self)}</div>
                    <div class="sq-sum-row"><span class="sq-sum-who">${escapeHtml(pn)}</span>${escapeHtml(a.opp)}</div>`;
            if (a.oppComment !== undefined) {
                block += `
                    <div class="sq-sum-row sq-sum-comment"><span class="sq-sum-who">我的评论</span>${escapeHtml(a.selfComment || '（无）')}</div>
                    <div class="sq-sum-row sq-sum-comment"><span class="sq-sum-who">${escapeHtml(pn)}的评论</span>${escapeHtml(a.oppComment)}</div>`;
            }
            block += `</div>`;
            return block;
        }).join('') + `</div>`;
    }

    window.sqDeleteRecord = function (id, surveyId) {
        if (!confirm('确定删除这条记录吗？')) return;
        syncRecords = syncRecords.filter(r => r.id !== id);
        saveData();
        window.sqOpenDetail(surveyId);
        showNotification('已删除', 'success');
    };

    window.sqDeleteSurvey = function (id) {
        if (!confirm('确定删除这份问卷吗？连同它的所有填写记录一起删除。')) return;
        syncSurveys = syncSurveys.filter(s => s.id !== id);
        syncRecords = syncRecords.filter(r => r.surveyId !== id);
        saveData();
        hideSqModal();
        renderList();
        showNotification('已删除', 'success');
    };

    window.sqExportSurvey = function (id) {
        const s = syncSurveys.find(x => x.id === id);
        if (!s) return;
        const data = { title: s.title, questions: s.questions };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        a.download = `同步问卷_${s.title}_${Date.now()}.json`;
        a.click();
        showNotification('已导出', 'success');
    };

    window.sqImportSurvey = function (input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const d = JSON.parse(ev.target.result);
                if (!d.title || !Array.isArray(d.questions)) { showNotification('文件格式不正确', 'warning'); return; }
                syncSurveys.push({ id: 'sq_' + Date.now(), title: d.title, questions: d.questions });
                saveData();
                renderList();
                showNotification('导入成功', 'success');
            } catch (e) {
                showNotification('文件解析失败', 'error');
            }
        };
        reader.readAsText(file);
        input.value = '';
    };

    // ─── 编辑器 ──────────────────────────────
    window.sqNewSurvey = function () {
        editingSurvey = { id: 'sq_' + Date.now(), title: '', questions: [{ text: '', options: [], needOptions: false, needComment: false }] };
        editingIsNew = true;
        renderEditForm();
    };

    window.sqEditSurvey = function (id) {
        const s = syncSurveys.find(x => x.id === id);
        if (!s) return;
        editingSurvey = JSON.parse(JSON.stringify(s));
        editingSurvey.questions.forEach(q => { if (!('needOptions' in q)) q.needOptions = !!(q.options && q.options.length); });
        editingIsNew = false;
        renderEditForm();
    };

    function renderEditForm() {
        const s = editingSurvey;
        let html = `<input class="sq-input" id="sqe-title" placeholder="问卷标题" value="${escapeHtml(s.title)}">`;

        s.questions.forEach((q, qi) => {
            const hasOpts = !!q.needOptions;
            html += `
                <div class="sq-qedit-item">
                    <div class="sq-qedit-row">
                        <span>题目 ${qi + 1}</span>
                        <span class="sq-qedit-del" onclick="window.sqRemoveQuestion(${qi})">删除</span>
                    </div>
                    <input class="sq-input" id="sqe-q-${qi}" placeholder="题目内容" value="${escapeHtml(q.text)}">
                    <div class="sq-qedit-toggles">
                        <label class="sq-check-chip"><input type="checkbox" id="sqe-opts-on-${qi}" onchange="window.sqToggleOpts(${qi})" ${hasOpts ? 'checked' : ''}> 选项</label>
                        <label class="sq-check-chip"><input type="checkbox" id="sqe-cmt-${qi}" ${q.needComment ? 'checked' : ''}> 附加评论</label>
                    </div>`;
            if (hasOpts) {
                html += `<div class="sq-qedit-opts">`;
                (q.options || []).forEach((opt, oi) => {
                    html += `
                        <div class="sq-qedit-opt-row">
                            <input class="sq-input" id="sqe-opt-${qi}-${oi}" placeholder="选项 ${oi + 1}" value="${escapeHtml(opt)}">
                            <span class="sq-opt-del" onclick="window.sqRemoveOption(${qi},${oi})"><i class="fas fa-times"></i></span>
                        </div>`;
                });
                html += `</div><button class="sq-add-opt-btn" onclick="window.sqAddOption(${qi})">+ 添加选项</button>`;
            }
            html += `</div>`;
        });

        html += `
            <button class="sq-pill-btn" onclick="window.sqAddQuestion()"><i class="fas fa-plus"></i> 添加题目</button>
            <button class="sq-pill-btn primary" onclick="window.sqSaveEdit()"><i class="fas fa-check"></i> 保存问卷</button>`;

        showSqModal(editingIsNew ? '新建问卷' : '编辑问卷', html);
    }

    function syncFormToState() {
        const s = editingSurvey;
        const t = document.getElementById('sqe-title');
        if (t) s.title = t.value.trim();
        s.questions.forEach((q, qi) => {
            const qEl = document.getElementById('sqe-q-' + qi);
            const cEl = document.getElementById('sqe-cmt-' + qi);
            const oOnEl = document.getElementById('sqe-opts-on-' + qi);
            if (qEl) q.text = qEl.value.trim();
            if (cEl) q.needComment = cEl.checked;
            if (oOnEl) q.needOptions = oOnEl.checked;
            if (q.needOptions) {
                q.options = (q.options || []).map((opt, oi) => {
                    const oEl = document.getElementById(`sqe-opt-${qi}-${oi}`);
                    return oEl ? oEl.value.trim() : opt;
                });
            }
        });
    }

    window.sqToggleOpts = function (qi) {
        syncFormToState();
        const q = editingSurvey.questions[qi];
        q.needOptions = document.getElementById('sqe-opts-on-' + qi).checked;
        if (q.needOptions && (!q.options || !q.options.length)) q.options = ['', ''];
        renderEditForm();
    };
    window.sqAddQuestion = function () {
        syncFormToState();
        editingSurvey.questions.push({ text: '', options: [], needOptions: false, needComment: false });
        renderEditForm();
    };
    window.sqRemoveQuestion = function (i) {
        syncFormToState();
        editingSurvey.questions.splice(i, 1);
        if (!editingSurvey.questions.length) editingSurvey.questions.push({ text: '', options: [], needOptions: false, needComment: false });
        renderEditForm();
    };
    window.sqAddOption = function (qi) {
        syncFormToState();
        if (!editingSurvey.questions[qi].options) editingSurvey.questions[qi].options = [];
        editingSurvey.questions[qi].options.push('');
        renderEditForm();
    };
    window.sqRemoveOption = function (qi, oi) {
        syncFormToState();
        editingSurvey.questions[qi].options.splice(oi, 1);
        renderEditForm();
    };

    window.sqSaveEdit = function () {
        syncFormToState();
        const s = editingSurvey;
        if (!s.title) { showNotification('请输入问卷标题', 'warning'); return; }
        s.questions.forEach(q => { q.options = (q.options || []).filter(o => o); });
        const valid = s.questions.filter(q => q.text && (!q.needOptions || q.options.length >= 2));
        if (!valid.length) { showNotification('请至少填写一道有效题目（有选项的题至少要2个选项）', 'warning'); return; }
        s.questions = valid.map(q => ({ text: q.text, options: q.needOptions ? q.options : [], needComment: !!q.needComment }));

        if (editingIsNew) {
            syncSurveys.push(s);
        } else {
            const idx = syncSurveys.findIndex(x => x.id === s.id);
            if (idx > -1) syncSurveys[idx] = s;
        }
        editingSurvey = null;
        saveData();
        hideSqModal();
        renderList();
        showNotification('已保存 ✓', 'success');
    };

    // ─── 邀请对方一起填 ──────────────────────
    window.sqInvite = function (id) {
        const survey = syncSurveys.find(s => s.id === id);
        if (!survey || !survey.questions.length) { showNotification('问卷是空的，先加几道题吧', 'warning'); return; }
        hideSqModal();

        const pn = getPartnerName();
        showInvitePopup('send', '已发出邀请', `《${survey.title}》· 等待${pn}回应…`);
        invitePopupTimer = setTimeout(() => {
            const accepted = Math.random() < 0.7; // 70% 概率接受，比原版稍微友好一点
            if (accepted) {
                showInvitePopup('accept', `${pn}接受了邀请`, '正在打开问卷…');
                invitePopupTimer = setTimeout(() => { hideInvitePopup(); startFill(id); }, 1400);
            } else {
                showInvitePopup('decline', `${pn}拒绝了邀请`, '或许可以过会儿再邀请一次');
                invitePopupTimer = setTimeout(hideInvitePopup, 1800);
            }
        }, 1300);
    };

    function showInvitePopup(type, title, sub) {
        const el = document.getElementById('sq-invite-popup');
        if (!el) return;
        el.className = 'sq-invite-popup on ' + type;
        const iconMap = {
            send: '<i class="fas fa-paper-plane"></i>',
            accept: '<i class="fas fa-check"></i>',
            decline: '<i class="fas fa-xmark"></i>'
        };
        document.getElementById('sq-ip-icon').innerHTML = iconMap[type] || iconMap.send;
        document.getElementById('sq-ip-title').textContent = title;
        document.getElementById('sq-ip-sub').textContent = sub;
    }
    function hideInvitePopup() {
        const el = document.getElementById('sq-invite-popup');
        if (el) el.classList.remove('on');
    }

    // ─── 逐题填写（全屏）──────────────────────
    function startFill(id) {
        const survey = syncSurveys.find(s => s.id === id);
        if (!survey) return;
        sf = { surveyId: id, survey, qIndex: 0, selfIdx: -1, oppIdx: -1, stage: 'pick', reselectMsg: '', curAnswer: null, answers: [] };
        document.getElementById('sq-fill-overlay').classList.add('active');
        renderFillStep();
    }

    window.sqCloseFill = function () {
        clearTimeout(sfTimer); sfTimer = null;
        sf = null;
        document.getElementById('sq-fill-overlay').classList.remove('active');
    };

    window.sqSelectSelf = function (i) {
        if (!sf || sf.stage !== 'pick') return;
        const firstPick = sf.selfIdx === -1;
        sf.selfIdx = i;
        if (firstPick) {
            const q = sf.survey.questions[sf.qIndex];
            sf.oppIdx = randInt(0, q.options.length - 1);
        }
        renderFillStep();
    };

    window.sqReselect = function () {
        if (!sf || sf.stage !== 'pick' || sf.selfIdx === -1) return;
        const pn = getPartnerName();
        sf.stage = 'reselecting';
        sf.reselectMsg = `${pn}正在重新选择…`;
        renderFillStep();
        clearTimeout(sfTimer);
        sfTimer = setTimeout(() => {
            if (Math.random() < 0.5) {
                sf.stage = 'reselect-refused';
                sf.reselectMsg = `${pn}拒绝了重选请求`;
                renderFillStep();
                sfTimer = setTimeout(() => { sf.stage = 'pick'; renderFillStep(); }, 1100);
            } else {
                const q = sf.survey.questions[sf.qIndex];
                sf.oppIdx = randInt(0, q.options.length - 1);
                sf.stage = 'reselect-done';
                sf.reselectMsg = '选择完毕';
                renderFillStep();
                sfTimer = setTimeout(() => { sf.stage = 'pick'; renderFillStep(); }, 900);
            }
        }, randInt(1, 3) * 1000);
    };

    window.sqFillNext = function () {
        if (!sf || sf.stage !== 'pick' || sf.selfIdx === -1) return;
        const q = sf.survey.questions[sf.qIndex];
        sf.curAnswer = { q: q.text, self: q.options[sf.selfIdx], opp: q.options[sf.oppIdx] };
        if (q.needComment) {
            const pn = getPartnerName();
            sf.stage = 'comment-wait';
            renderFillStep();
            clearTimeout(sfTimer);
            sfTimer = setTimeout(() => {
                sf.curAnswer.oppComment = generateOppComment();
                sf.curAnswer.selfComment = '';
                sf.stage = 'comment';
                renderFillStep();
            }, randInt(3, 8) * 1000);
        } else {
            sf.answers.push(sf.curAnswer);
            nextQuestion();
        }
    };

    window.sqFillNextFromComment = function () {
        if (!sf) return;
        const ta = document.getElementById('sq-self-comment');
        sf.curAnswer.selfComment = ta ? ta.value.trim() : '';
        sf.answers.push(sf.curAnswer);
        nextQuestion();
    };

    function nextQuestion() {
        sf.qIndex++;
        sf.selfIdx = -1; sf.oppIdx = -1; sf.stage = 'pick'; sf.reselectMsg = ''; sf.curAnswer = null;
        if (sf.qIndex >= sf.survey.questions.length) renderFillSummary();
        else renderFillStep();
    }

    function oppBlock(q, dim) {
        const pn = getPartnerName();
        return `<div class="sq-opp-block${dim ? ' dim' : ''}"><div class="sq-opp-label">${escapeHtml(pn)}选择</div><div class="sq-opp-value">${escapeHtml(q.options[sf.oppIdx])}</div></div>`;
    }

    function indicatorHtml(msg, spinning) {
        const icon = spinning
            ? `<span class="sq-dots"><i></i><i></i><i></i></span>`
            : `<i class="fas fa-check" style="color:#4cd964;"></i>`;
        return `<div class="sq-indicator">${icon}<span>${escapeHtml(msg)}</span></div>`;
    }

    function renderFillStep() {
        const q = sf.survey.questions[sf.qIndex];
        document.getElementById('sq-fill-title').textContent = sf.survey.title;
        document.getElementById('sq-fill-progress').textContent = `${sf.qIndex + 1} / ${sf.survey.questions.length}`;

        let html = `<div class="sq-fill-question">${escapeHtml(q.text)}</div>`;

        if (q.options && q.options.length > 0) {
            html += `<div class="sq-fill-options">`;
            q.options.forEach((opt, i) => {
                html += `<div class="sq-fill-opt ${i === sf.selfIdx ? 'selected' : ''}" onclick="window.sqSelectSelf(${i})">${escapeHtml(opt)}</div>`;
            });
            html += `</div>`;
        } else {
            // 没有预设选项：走开放式文字作答（简化处理，双方都用字卡随机拼一句代替"当场打字"）
            html += `<div class="sq-empty" style="padding:16px 0;">这道题没有设置选项，建议在编辑里加几个选项～</div>`;
        }

        if (sf.selfIdx > -1) {
            if (sf.stage === 'pick') {
                html += oppBlock(q) + `
                    <div class="sq-fill-actions">
                        <button class="sq-pill-btn" onclick="window.sqReselect()">重选</button>
                        <button class="sq-pill-btn primary" onclick="window.sqFillNext()">下一步</button>
                    </div>`;
            } else if (sf.stage === 'reselecting') {
                html += oppBlock(q, true) + indicatorHtml(sf.reselectMsg, true);
            } else if (sf.stage === 'reselect-refused' || sf.stage === 'reselect-done') {
                html += oppBlock(q) + indicatorHtml(sf.reselectMsg, false);
            } else if (sf.stage === 'comment-wait') {
                html += oppBlock(q) + indicatorHtml(getPartnerName() + '正在输入评论…', true);
            } else if (sf.stage === 'comment') {
                html += oppBlock(q) + `
                    <div class="sq-comment-block">
                        <div class="sq-comment-label">${escapeHtml(getPartnerName())}的评论</div>
                        <div class="sq-comment-text">${escapeHtml(sf.curAnswer.oppComment)}</div>
                    </div>
                    <textarea class="sq-textarea" id="sq-self-comment" placeholder="写下你的评论…（可留空）"></textarea>
                    <button class="sq-pill-btn primary" onclick="window.sqFillNextFromComment()">下一步</button>`;
            }
        }

        document.getElementById('sq-fill-body').innerHTML = html;
    }

    function renderFillSummary() {
        document.getElementById('sq-fill-title').textContent = sf.survey.title;
        document.getElementById('sq-fill-progress').textContent = '完成';
        let html = renderAnswersHtml(sf.answers);
        html += `<button class="sq-pill-btn primary" onclick="window.sqFinishFill()"><i class="fas fa-check"></i> 完成并保存</button>`;
        document.getElementById('sq-fill-body').innerHTML = html;
    }

    window.sqFinishFill = function () {
        if (!sf) return;
        syncRecords.push({ id: 'sqrec_' + Date.now(), surveyId: sf.surveyId, title: sf.survey.title, ts: Date.now(), answers: sf.answers });
        saveData();
        sf = null;
        document.getElementById('sq-fill-overlay').classList.remove('active');
        renderList();
        showNotification('问卷已完成 ✓', 'success');
    };

    // ─── 通用小弹窗（列表详情/编辑器共用）──────────────────
    function showSqModal(title, bodyHtml) {
        document.getElementById('sq-modal-title').textContent = title;
        document.getElementById('sq-modal-body').innerHTML = bodyHtml;
        showModal(document.getElementById('sq-inner-modal'));
    }
    function hideSqModal() {
        hideModal(document.getElementById('sq-inner-modal'));
    }

    // ─── 初始化 ──────────────────────────────
    function initListeners() {
        const entryBtn = document.getElementById('sync-questionnaire-function');
        if (entryBtn) {
            entryBtn.addEventListener('click', async () => {
                const advancedModal = document.getElementById('advanced-modal');
                if (advancedModal) hideModal(advancedModal);
                await loadData();
                renderList();
                showModal(document.getElementById('sync-questionnaire-modal'));
            });
        }

        document.getElementById('sq-new-btn')?.addEventListener('click', window.sqNewSurvey);
        document.getElementById('sq-import-input')?.addEventListener('change', function (e) { window.sqImportSurvey(this); });
        document.getElementById('sq-import-btn')?.addEventListener('click', () => document.getElementById('sq-import-input').click());
        document.getElementById('close-sync-questionnaire-modal')?.addEventListener('click', () => hideModal(document.getElementById('sync-questionnaire-modal')));
        document.getElementById('sq-inner-modal-close')?.addEventListener('click', hideSqModal);
        document.getElementById('sq-fill-close')?.addEventListener('click', window.sqCloseFill);
    }

    document.addEventListener('DOMContentLoaded', function () {
        const waitReady = setInterval(function () {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                setTimeout(initListeners, 500);
            }
        }, 300);
    });
})();
