/**
 * features/dream-questionnaire.js - 梦向问卷功能（无 AI 版本）
 *
 * 依赖（均已存在于现有代码中）：
 *   getStorageKey, localforage, showNotification, showModal, hideModal,
 *   settings, customReplies, addMessage, SESSION_ID
 *
 * 不需要 AI：选择题从你写的选项里随机选一个；填空题跟朋友圈/模拟回复
 * 用同一套逻辑，从字卡库（customReplies）随机抽1~3条拼成答案。
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

    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '对方';
    }

    let dreamQuestionnaires = [];
    let dqCurrentType = 'choice';
    let dqCurrentReplyTime = 'immediate';
    let dqQuestions = [];
    let dqEditingId = null;

    // ─── 存储：走 localforage ──────────────
    async function loadDQData() {
        try {
            const saved = await localforage.getItem(getStorageKey('dreamQuestionnaires'));
            if (saved && Array.isArray(saved)) dreamQuestionnaires = saved;
        } catch (e) {
            dreamQuestionnaires = [];
        }
        setTimeout(checkAllPendingDQs, 1000);
    }

    function saveDQData() {
        localforage.setItem(getStorageKey('dreamQuestionnaires'), dreamQuestionnaires).catch(e => {
            console.error('保存问卷数据失败', e);
            showNotification('问卷保存失败了', 'error', 3500);
        });
    }

    // ─── 渲染问卷列表 ──────────────────────
    let dqCurrentSubTab = 'all';

    function renderDQList() {
        const list = document.getElementById('dq-list');
        if (!list) return;

        const sortedDQs = [...dreamQuestionnaires].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (sortedDQs.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <i class="fas fa-clipboard-list" style="font-size: 40px; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
                    <p style="font-size: 14px; font-weight: 500;">还没有问卷</p>
                    <p style="font-size: 12px; opacity: 0.6;">点击"创建新问卷"开始吧~</p>
                </div>`;
        } else {
            list.innerHTML = sortedDQs.map((dq) => {
                const typeBadge = dq.type === 'choice'
                    ? '<span class="dq-card-badge choice">📋 选择题</span>'
                    : '<span class="dq-card-badge fill">✏️ 填空题</span>';
                const statusBadge = dq.answer
                    ? '<span class="dq-card-badge answered">✓ 已回复</span>'
                    : (dq.sent ? '<span class="dq-card-badge pending">⏳ 等待回复</span>' : '');
                const questionCount = dq.questions ? dq.questions.length : 0;
                const replyTimeLabel = dq.replyTime === 'immediate' ? '立即回复' : '随机时间';
                const answerPreview = dq.answer ? '点击查看回复 →' : (dq.sent ? '等待中...' : '点击发送 →');

                return `
                    <div class="dq-card" onclick="handleDQCardClick('${dq.id}')">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="flex: 1; min-width: 0;">
                                <div class="dq-card-header">
                                    <span class="dq-card-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(dq.title || '未命名问卷')}</span>
                                </div>
                                <div class="dq-card-meta">
                                    <span>${questionCount} 题</span>
                                    <span>·</span>
                                    ${typeBadge}
                                    <span>·</span>
                                    <span>${replyTimeLabel}</span>
                                </div>
                                <div style="font-size: 11px; color: var(--accent-color); margin-top: 4px; opacity: 0.8;">${answerPreview}</div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; margin-left: 10px;">
                                ${statusBadge}
                                <button class="dq-delete-btn" onclick="event.stopPropagation(); deleteDQ('${dq.id}')" title="删除">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }

        renderDQReceived();
    }

    function renderDQReceived() {
        const receivedList = document.getElementById('dq-received-list');
        if (!receivedList) return;

        const answeredDQs = dreamQuestionnaires
            .filter(dq => dq.answer)
            .sort((a, b) => (b.answer.answeredAt || 0) - (a.answer.answeredAt || 0));

        if (answeredDQs.length === 0) {
            receivedList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <i class="fas fa-inbox" style="font-size: 40px; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
                    <p style="font-size: 14px; font-weight: 500;">还没有收到回复</p>
                    <p style="font-size: 12px; opacity: 0.6;">发出去的问卷有回复了会出现在这里~</p>
                </div>`;
            return;
        }

        receivedList.innerHTML = answeredDQs.map(dq => `
            <div class="dq-card" onclick="viewDQAnswer('${dq.id}')" style="margin-bottom: 6px;">
                <div class="dq-card-header">
                    <span class="dq-card-title">${escapeHtml(dq.title || '未命名问卷')}</span>
                    <span class="dq-card-badge answered">✓ 已回复</span>
                </div>
                <div class="dq-card-meta">
                    ${dq.questions ? dq.questions.length : 0} 题 · ${dq.type === 'choice' ? '选择题' : '填空题'}
                </div>
            </div>
        `).join('');
    }

    function switchDQSubTab(subTab) {
        dqCurrentSubTab = subTab;
        document.querySelectorAll('#dq-tabs .dq-tab').forEach(t => t.classList.toggle('active', t.dataset.dqtab === subTab));
        document.getElementById('dq-list').style.display = subTab === 'all' ? 'flex' : 'none';
        document.getElementById('dq-received').style.display = subTab === 'received' ? 'block' : 'none';
        if (subTab === 'received') renderDQReceived();
    }

    window.handleDQCardClick = function(id) {
        const dq = dreamQuestionnaires.find(q => q.id === id);
        if (!dq) return;

        if (dq.sent && !dq.answer && dq.expectedReplyAt) {
            checkAndGenerateDQReply(dq);
        }

        const updatedDq = dreamQuestionnaires.find(q => q.id === id);
        if (!updatedDq) return;

        if (updatedDq.answer) {
            viewDQAnswer(id);
        } else if (!updatedDq.sent) {
            openDQEditor(id);
        } else {
            const remainingMinutes = updatedDq.expectedReplyAt
                ? Math.max(0, Math.ceil((updatedDq.expectedReplyAt - Date.now()) / 60000))
                : 0;
            showNotification(`问卷已发送，${getPartnerName()} 预计 ${remainingMinutes} 分钟内回复`, 'info', 3000);
        }
    };

    function checkAllPendingDQs() {
        dreamQuestionnaires.forEach(dq => {
            if (dq.sent && !dq.answer && dq.expectedReplyAt) {
                checkAndGenerateDQReply(dq);
            }
        });
    }

    // ─── 编辑器 ──────────────────────────
    function openDQEditor(id) {
        dqEditingId = id || null;
        const editorView = document.getElementById('dq-editor-view');
        const mainView = document.getElementById('dq-main-view');
        const answerView = document.getElementById('dq-answer-view');

        if (id) {
            const dq = dreamQuestionnaires.find(q => q.id === id);
            if (!dq) return;
            dqCurrentType = dq.type || 'choice';
            dqCurrentReplyTime = dq.replyTime || 'immediate';
            dqQuestions = JSON.parse(JSON.stringify(dq.questions || []));
            document.getElementById('dq-title-input').value = dq.title || '';
        } else {
            dqCurrentType = 'choice';
            dqCurrentReplyTime = 'immediate';
            dqQuestions = [];
            document.getElementById('dq-title-input').value = '';
        }

        mainView.style.display = 'none';
        answerView.style.display = 'none';
        editorView.style.display = 'block';
        const dqTabs = document.getElementById('dq-tabs');
        if (dqTabs) dqTabs.style.display = 'none';

        updateDQTypeButtons();
        updateDQReplyTimeButtons();
        renderDQQuestions();

        document.getElementById('dq-create-btn').style.display = 'none';
        const alreadySent = id ? !!(dreamQuestionnaires.find(q => q.id === id) || {}).sent : false;
        document.getElementById('dq-save-btn').style.display = alreadySent ? 'none' : '';
        document.getElementById('dq-send-btn').style.display = alreadySent ? 'none' : '';
        document.getElementById('dq-back-btn').style.display = '';
        document.getElementById('close-dq-modal').style.display = 'none';
    }
    window.openDQEditor = openDQEditor;

    function backToDQMain() {
        document.getElementById('dq-editor-view').style.display = 'none';
        document.getElementById('dq-answer-view').style.display = 'none';
        document.getElementById('dq-main-view').style.display = '';
        const dqTabs = document.getElementById('dq-tabs');
        if (dqTabs) dqTabs.style.display = 'flex';
        document.getElementById('dq-create-btn').style.display = '';
        document.getElementById('dq-save-btn').style.display = 'none';
        document.getElementById('dq-send-btn').style.display = 'none';
        document.getElementById('dq-back-btn').style.display = 'none';
        document.getElementById('close-dq-modal').style.display = '';
        dqEditingId = null;
        switchDQSubTab(dqCurrentSubTab);
        renderDQList();
    }

    function updateDQTypeButtons() {
        document.querySelectorAll('.dq-type-btn').forEach(btn => {
            btn.className = btn.dataset.type === dqCurrentType
                ? 'modal-btn modal-btn-primary dq-type-btn'
                : 'modal-btn modal-btn-secondary dq-type-btn';
        });
    }

    function updateDQReplyTimeButtons() {
        document.querySelectorAll('.dq-reply-time-btn').forEach(btn => {
            btn.className = btn.dataset.time === dqCurrentReplyTime
                ? 'modal-btn modal-btn-primary dq-reply-time-btn'
                : 'modal-btn modal-btn-secondary dq-reply-time-btn';
        });
        document.getElementById('dq-random-hint').style.display = dqCurrentReplyTime === 'random' ? 'block' : 'none';
    }

    function renderDQQuestions() {
        const container = document.getElementById('dq-questions-container');
        if (!container) return;

        if (dqQuestions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px; opacity: 0.6;">
                    暂无题目，点击下方按钮添加
                </div>`;
            return;
        }

        container.innerHTML = dqQuestions.map((q, index) => `
            <div class="dq-question-block">
                <div class="dq-question-header">
                    <div class="dq-question-number">${index + 1}</div>
                    <input type="text" class="dq-question-input" value="${escapeHtml(q.question)}"
                        placeholder="输入题目..." data-qindex="${index}" onchange="window.updateDQQuestion(${index}, 'question', this.value)">
                    <button class="dq-option-remove" onclick="window.removeDQQuestion(${index})" title="删除题目">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                ${dqCurrentType === 'choice' ? renderDQOptions(q, index) : ''}
            </div>
        `).join('');
    }

    function renderDQOptions(question, qIndex) {
        const options = question.options || [];
        return `
            <div style="padding-left: 34px;">
                <label style="display:flex; align-items:center; gap:6px; font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; cursor: pointer;">
                    <input type="checkbox" ${question.multi ? 'checked' : ''} onchange="window.toggleDQMulti(${qIndex}, this.checked)">
                    允许多选（对方作答时可以选好几个）
                </label>
                ${options.map((opt, oIndex) => `
                    <div class="dq-option-row">
                        <span style="font-size: 11px; color: var(--text-secondary); min-width: 18px;">${String.fromCharCode(65 + oIndex)}.</span>
                        <input type="text" class="dq-option-input" value="${escapeHtml(opt)}"
                            placeholder="选项 ${oIndex + 1}" onchange="window.updateDQOption(${qIndex}, ${oIndex}, this.value)">
                        <button class="dq-option-remove" onclick="window.removeDQOption(${qIndex}, ${oIndex})" title="删除选项">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
                <button onclick="window.addDQOption(${qIndex})" style="background: none; border: 1px dashed var(--border-color); border-radius: 6px; padding: 5px 10px; font-size: 11px; color: var(--text-secondary); cursor: pointer; width: 100%; margin-top: 4px;">
                    <i class="fas fa-plus"></i> 添加选项
                </button>
            </div>
        `;
    }
    window.toggleDQMulti = function(qIndex, checked) {
        if (dqQuestions[qIndex]) dqQuestions[qIndex].multi = checked;
    };

    function addDQQuestion() {
        dqQuestions.push({ question: '', options: dqCurrentType === 'choice' ? ['', ''] : [], multi: false });
        renderDQQuestions();
    }

    window.removeDQQuestion = function(index) {
        dqQuestions.splice(index, 1);
        renderDQQuestions();
    };
    window.updateDQQuestion = function(index, field, value) {
        if (dqQuestions[index]) dqQuestions[index][field] = value;
    };
    window.addDQOption = function(qIndex) {
        if (dqQuestions[qIndex] && dqQuestions[qIndex].options) {
            dqQuestions[qIndex].options.push('');
            renderDQQuestions();
        }
    };
    window.removeDQOption = function(qIndex, oIndex) {
        if (dqQuestions[qIndex] && dqQuestions[qIndex].options) {
            dqQuestions[qIndex].options.splice(oIndex, 1);
            renderDQQuestions();
        }
    };
    window.updateDQOption = function(qIndex, oIndex, value) {
        if (dqQuestions[qIndex] && dqQuestions[qIndex].options) {
            dqQuestions[qIndex].options[oIndex] = value;
        }
    };

    function syncQuestionInputsIntoState() {
        document.querySelectorAll('.dq-question-input').forEach(input => {
            const index = parseInt(input.dataset.qindex);
            if (!isNaN(index) && dqQuestions[index]) dqQuestions[index].question = input.value;
        });
        document.querySelectorAll('.dq-question-block').forEach((block) => {
            const qInput = block.querySelector('.dq-question-input');
            if (!qInput) return;
            const qIndex = parseInt(qInput.dataset.qindex);
            if (isNaN(qIndex) || !dqQuestions[qIndex] || !dqQuestions[qIndex].options) return;
            const optionInputs = block.querySelectorAll('.dq-option-input');
            optionInputs.forEach((input, oIndex) => {
                dqQuestions[qIndex].options[oIndex] = input.value;
            });
        });
    }

    function saveDQ() {
        const title = document.getElementById('dq-title-input').value.trim();
        if (!title) { showNotification('请输入问卷标题', 'warning'); return; }

        syncQuestionInputsIntoState();

        const validQuestions = dqQuestions.filter(q => q.question.trim());
        if (validQuestions.length === 0) { showNotification('请至少添加一道有效题目', 'warning'); return; }
        if (dqCurrentType === 'choice') {
            const invalidOptions = validQuestions.some(q => !q.options || q.options.filter(o => o.trim()).length < 2);
            if (invalidOptions) { showNotification('选择题每题至少需要两个选项', 'warning'); return; }
        }

        const dqData = {
            id: dqEditingId || ('dq_' + Date.now()),
            title,
            type: dqCurrentType,
            replyTime: dqCurrentReplyTime,
            questions: validQuestions.map(q => ({
                question: q.question.trim(),
                options: dqCurrentType === 'choice' ? q.options.map(o => o.trim()).filter(o => o) : [],
                multi: dqCurrentType === 'choice' ? !!q.multi : false
            })),
            sent: false,
            answer: null,
            createdAt: Date.now()
        };

        if (dqEditingId) {
            const index = dreamQuestionnaires.findIndex(q => q.id === dqEditingId);
            if (index >= 0) dreamQuestionnaires[index] = dqData;
            else dreamQuestionnaires.push(dqData);
        } else {
            dreamQuestionnaires.push(dqData);
        }

        saveDQData();
        backToDQMain();
        showNotification('问卷已保存 ✓', 'success');
    }

    function saveDQWithoutClose(targetDQ) {
        const title = document.getElementById('dq-title-input').value.trim();
        if (title) targetDQ.title = title;
        targetDQ.type = dqCurrentType;
        targetDQ.replyTime = dqCurrentReplyTime;

        syncQuestionInputsIntoState();

        targetDQ.questions = dqQuestions.filter(q => q.question.trim()).map(q => ({
            question: q.question.trim(),
            options: dqCurrentType === 'choice' ? (q.options || []).map(o => o.trim()).filter(o => o) : [],
            multi: dqCurrentType === 'choice' ? !!q.multi : false
        }));
    }

    function sendDQ() {
        if (!dqEditingId) { showNotification('请先保存问卷', 'warning'); return; }
        const dq = dreamQuestionnaires.find(q => q.id === dqEditingId);
        if (!dq) return;
        if (dq.sent) { showNotification('该问卷已发送', 'warning'); return; }

        saveDQWithoutClose(dq);
        dq.sent = true;
        dq.sentAt = Date.now();

        if (dq.replyTime === 'random') {
            const delayMinutes = Math.floor(Math.random() * 300);
            dq.expectedReplyAt = Date.now() + delayMinutes * 60 * 1000;
            dq.replyDelayMinutes = delayMinutes;
        } else {
            dq.expectedReplyAt = Date.now() + 3000;
            dq.replyDelayMinutes = 0;
        }

        saveDQData();
        checkAndGenerateDQReply(dq);
        backToDQMain();

        const pn = getPartnerName();
        if (dq.replyTime === 'immediate') {
            showNotification(`问卷已发送！${pn} 正在填写... ✉️`, 'success');
        } else {
            showNotification(`问卷已发送！${pn} 将在 ${dq.replyDelayMinutes} 分钟内回复 ✉️`, 'success');
        }
    }

    function checkAndGenerateDQReply(dq) {
        if (!dq || !dq.sent || dq.answer) return;
        const now = Date.now();
        const expectedTime = dq.expectedReplyAt || 0;

        if (now >= expectedTime) {
            generateDQAnswerNow(dq);
        } else {
            const delay = expectedTime - now;
            setTimeout(() => {
                const currentDq = dreamQuestionnaires.find(q => q.id === dq.id);
                if (currentDq && currentDq.sent && !currentDq.answer) generateDQAnswerNow(currentDq);
            }, delay);
        }
    }

    function generateDQAnswerNow(dq) {
        if (!dq || !dq.questions) return;
        if (dq.answer) return;

        const answers = dq.questions.map(q => {
            if (dq.type === 'choice') {
                const options = q.options || [];
                if (options.length === 0) return { question: q.question, answer: '(无选项)' };
                if (q.multi) {
                    const shuffled = [...options].sort(() => Math.random() - 0.5);
                    const pickCount = 1 + Math.floor(Math.random() * options.length); // 随机选1~全部
                    const picked = shuffled.slice(0, pickCount);
                    return { question: q.question, answer: picked.join('、') };
                }
                const randomIndex = Math.floor(Math.random() * options.length);
                return { question: q.question, answer: options[randomIndex] };
            } else {
                const replyPool = (typeof customReplies !== 'undefined' && customReplies.length > 0)
                    ? customReplies
                    : ['一切安好', '今天很开心', '想你'];
                const sentenceCount = 1 + Math.floor(Math.random() * 3);
                const shuffled = [...replyPool].sort(() => Math.random() - 0.5);
                const selected = shuffled.slice(0, Math.min(sentenceCount, shuffled.length));
                return { question: q.question, answer: selected.join('。') + (selected.length > 0 ? '。' : '') };
            }
        });

        dq.answer = { answers, answeredAt: Date.now() };
        saveDQData();

        const dqList = document.getElementById('dq-list');
        const dqModal = document.getElementById('dream-questionnaire-modal');
        if (dqList && dqModal && dqModal.style.display !== 'none') renderDQList();

        const pn = getPartnerName();
        showNotification(`${pn} 已填写问卷「${dq.title}」✨`, 'success', 4000);
        notifyInChat(`${pn} 填写完了你发的问卷「${dq.title}」，去看看吧 ✦`);
    }

    window.viewDQAnswer = function(id) {
        const dq = dreamQuestionnaires.find(q => q.id === id);
        if (!dq || !dq.answer) return;

        document.getElementById('dq-main-view').style.display = 'none';
        document.getElementById('dq-editor-view').style.display = 'none';
        document.getElementById('dq-answer-view').style.display = 'block';
        const dqTabs = document.getElementById('dq-tabs');
        if (dqTabs) dqTabs.style.display = 'none';

        document.getElementById('dq-answer-content').innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${escapeHtml(dq.title)}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    ${new Date(dq.answer.answeredAt).toLocaleString('zh-CN')} · ${escapeHtml(getPartnerName())}填写
                </div>
            </div>
            ${dq.answer.answers.map((a, i) => `
                <div class="dq-qa-item">
                    <div class="dq-qa-question">${i + 1}. ${escapeHtml(a.question)}</div>
                    <div class="dq-qa-answer ${dq.type === 'fill' ? 'fill-answer' : ''}">${escapeHtml(a.answer)}</div>
                </div>
            `).join('')}
        `;

        document.getElementById('dq-create-btn').style.display = 'none';
        document.getElementById('dq-save-btn').style.display = 'none';
        document.getElementById('dq-send-btn').style.display = 'none';
        document.getElementById('dq-back-btn').style.display = '';
        document.getElementById('close-dq-modal').style.display = 'none';
    };

    window.deleteDQ = function(id) {
        if (!confirm('确定要删除这个问卷吗？')) return;
        dreamQuestionnaires = dreamQuestionnaires.filter(q => q.id !== id);
        saveDQData();
        renderDQList();
        showNotification('问卷已删除', 'success');
    };

    // ─── 初始化 ──────────────────────────────
    function initDQListeners() {
        document.getElementById('dq-create-btn').addEventListener('click', () => openDQEditor(null));
        document.getElementById('dq-back-btn').addEventListener('click', backToDQMain);
        document.getElementById('dq-save-btn').addEventListener('click', saveDQ);
        document.getElementById('dq-send-btn').addEventListener('click', sendDQ);
        document.getElementById('close-dq-modal').addEventListener('click', () => {
            hideModal(document.getElementById('dream-questionnaire-modal'));
        });

        document.querySelectorAll('.dq-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dqCurrentType = btn.dataset.type;
                updateDQTypeButtons();
                renderDQQuestions();
            });
        });

        document.querySelectorAll('.dq-reply-time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dqCurrentReplyTime = btn.dataset.time;
                updateDQReplyTimeButtons();
            });
        });

        document.getElementById('dq-add-question-btn').addEventListener('click', addDQQuestion);

        document.querySelectorAll('#dq-tabs .dq-tab').forEach(tab => {
            tab.addEventListener('click', () => switchDQSubTab(tab.dataset.dqtab));
        });

        const dqEntry = document.getElementById('dream-questionnaire-function');
        if (dqEntry) {
            dqEntry.addEventListener('click', async () => {
                const advancedModal = document.getElementById('advanced-modal');
                if (advancedModal) hideModal(advancedModal);
                await loadDQData();
                switchDQSubTab('all');
                renderDQList();
                showModal(document.getElementById('dream-questionnaire-modal'));
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        const waitReady = setInterval(function() {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                setTimeout(initDQListeners, 500);
            }
        }, 300);
    });
})();
