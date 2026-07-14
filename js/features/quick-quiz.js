/**
 * features/quick-quiz.js - 快问快答功能
 *
 * 依赖（均已存在于现有代码中）：
 *   getStorageKey, safeGetItem, safeSetItem, addMessage,
 *   showNotification, playSound, settings, SESSION_ID
 *
 * 不需要改 core.js 的 renderMessages —— 提交后就是一条普通文字消息，
 * 走你现有的普通气泡渲染逻辑。
 * 需要在 HTML 里插入 #quick-quiz-overlay 弹窗结构（见文件末尾说明）。
 */

(function() {
    'use strict';

    // ─── 题目数据：可自行增删 ──────────────────────────
    const QUIZ_QUESTIONS = [
        // 选择题
        { id: 1, type: 'choice', question: '牵手时，你喜欢十指相扣还是轻轻握住？', options: ['十指紧扣', '轻轻握住', '不喜欢牵手'] },
        { id: 2, type: 'choice', question: '拥抱时，你喜欢从背后抱还是面对面紧抱？', options: ['从背后抱', '面对面紧抱', '不喜欢拥抱'] },
        { id: 3, type: 'choice', question: '亲吻时，你喜欢轻吻还是深吻？', options: ['轻吻', '深吻', '不喜欢亲吻'] },
        { id: 4, type: 'choice', question: '对视时，你会先笑还是先移开目光？', options: ['先笑', '先移开目光', '不会对视'] },
        { id: 5, type: 'choice', question: '睡觉时，你喜欢枕我手臂还是自己枕枕头？', options: ['枕你手臂', '自己枕枕头', '喜欢自己一个人睡一张床'] },
        { id: 6, type: 'choice', question: '我靠近时，你本能是迎上来还是向后退？', options: ['迎上来', '向后退', '站着不动等你'] },
        { id: 7, type: 'choice', question: '吵架时，你想先抱我还是先讲道理？', options: ['先抱你', '先讲道理', '不理你'] },
        { id: 8, type: 'choice', question: '难过时，你需要我说话还是安静陪着？', options: ['需要你安慰我', '需要你安静陪着我', '需要我自己一个人安静呆着'] },
        { id: 9, type: 'choice', question: '我为你准备惊喜时，你喜欢提前知道还是完全意外？', options: ['提前知道', '完全意外'] },
        { id: 10, type: 'choice', question: '约会时，你更希望我精心计划还是随性而为？', options: ['精心计划', '随性而为'] },
        { id: 11, type: 'choice', question: '表达爱时，你希望我更常说"我爱你"还是多用行动？', options: ['"我爱你"', '行动', '"我爱你"，以及行动'] },
        { id: 12, type: 'choice', question: '想念时，你会立刻联系我还是先忍着？', options: ['立刻联系', '先忍着'] },
        { id: 13, type: 'choice', question: '额头吻 vs 鼻尖吻', options: ['额头吻', '鼻尖吻'] },
        { id: 14, type: 'choice', question: '早起共进早餐 vs 深夜一起吃宵夜', options: ['早起共进早餐', '深夜一起吃宵夜', '我全都要'] },
        { id: 15, type: 'choice', question: '我为你做饭 vs 你为我做饭', options: ['我为你做饭', '你为我做饭'] },
        { id: 16, type: 'choice', question: '你希望我：公开晒恩爱 vs 私下默默甜', options: ['公开晒恩爱', '私下默默甜'] },
        { id: 17, type: 'choice', question: '纪念日大惊喜 vs 日常小浪漫', options: ['纪念日大惊喜', '日常小浪漫'] },
        { id: 18, type: 'choice', question: '长途旅行冒险 vs 宅家温馨周末', options: ['长途旅行冒险', '宅家温馨周末'] },
        { id: 19, type: 'choice', question: '你更希望我：聪明幽默 vs 温柔体贴', options: ['聪明幽默', '温柔体贴', '我全都要', '你现在这样就很好'] },
        { id: 20, type: 'choice', question: '你希望我们：相似互补 vs 志趣相投', options: ['相似互补', '志趣相投'] },
        { id: 21, type: 'choice', question: '我们的关系中，你更想要：被我需要的感觉 vs 被我崇拜的感觉', options: ['被你需要的感觉', '被你崇拜的感觉', '我全都要', '这两种感觉我都不需要'] },
        { id: 22, type: 'choice', question: '热烈的初恋感 vs 默契的老夫老妻感', options: ['热烈的初恋感', '默契的老夫老妻感'] },
        { id: 23, type: 'choice', question: '我为你改变缺点 vs 接纳我的全部', options: ['你为我改变缺点', '接纳你的全部'] },
        { id: 24, type: 'choice', question: '我吃醋时，你觉得可爱还是麻烦？', options: ['可爱', '麻烦'] },
        { id: 25, type: 'choice', question: '我粘人时，你享受还是觉得烦？', options: ['享受', '烦'] },
        // 填空题
        { id: 26, type: 'fill', question: '用一种颜色形容我们的爱情' },
        { id: 27, type: 'fill', question: '用一种天气形容你此刻的心情' },
        { id: 28, type: 'fill', question: '用一种食物形容我的性格' },
        { id: 29, type: 'fill', question: '用一种动物形容你眼中的我' },
        { id: 30, type: 'fill', question: '用一首歌名形容我们的关系' },
        { id: 31, type: 'fill', question: '用一部电影名形容我们的未来' },
        { id: 32, type: 'fill', question: '用一个地点形容我在你心里的位置' },
        { id: 33, type: 'fill', question: '用一种味道形容想我的感觉' },
        { id: 34, type: 'fill', question: '此刻，你幸福吗？' },
        { id: 35, type: 'fill', question: '此刻，你想我吗？' },
        { id: 36, type: 'fill', question: '可以写下我的名字吗？' },
        { id: 37, type: 'fill', question: '你觉得，我们的感情，还缺点什么？' },
        { id: 38, type: 'fill', question: '早餐，你吃的什么？' },
        { id: 39, type: 'fill', question: '午餐，你吃的什么？' },
        { id: 40, type: 'fill', question: '晚餐，你吃的什么？' },
        { id: 41, type: 'fill', question: '我有让你感到安心吗？' },
        { id: 42, type: 'fill', question: '我最近有做什么让你不开心吗？' },
        { id: 43, type: 'fill', question: '你愿意和我一起培养共同爱好？如果愿意，你想培养什么爱好？' },
        { id: 44, type: 'fill', question: '我有让你感受到爱意吗？' },
        { id: 45, type: 'fill', question: '你会怎么和你的朋友们提起我？' },
        { id: 46, type: 'fill', question: '我和朋友们介绍你是我的爱人，你会介意吗？' },
        { id: 47, type: 'fill', question: '如果我有一天失忆了，你会怎么做？' },
        { id: 48, type: 'fill', question: '你对我第一次心动的原因是什么？' },
        { id: 49, type: 'fill', question: '最近一直在熬夜吗？' },
        { id: 50, type: 'fill', question: '想听你夸夸我' },
        { id: 51, type: 'fill', question: '最近有什么喜欢的东西吗？' },
        { id: 52, type: 'fill', question: '最近有什么开心的事情吗？' },
        { id: 53, type: 'fill', question: '我真的好爱你。' },
        { id: 54, type: 'fill', question: '我真的好想你。' },
        { id: 55, type: 'fill', question: '想和我一起去哪里？' },
        { id: 56, type: 'fill', question: '如果有一天我突然出现在你的面前，你会害怕吗？' },
        { id: 57, type: 'fill', question: '最近有什么不开心的事情吗？' },
        { id: 58, type: 'fill', question: '可以感受到我的存在吗？' },
        { id: 59, type: 'fill', question: '想和你贴近，想近一点，再近一点，直到契合。可以吗？' },
        { id: 60, type: 'fill', question: '我不乖，你会怎么惩罚我？' },
        { id: 61, type: 'fill', question: '评价一下我的今日穿搭？' },
        { id: 62, type: 'fill', question: '你有动摇过对我的感情吗？' },
        { id: 63, type: 'fill', question: '看到了一些东西立刻想到了你，是巧合，还是你给我的传讯？' },
        { id: 64, type: 'fill', question: '你会不喜欢垂头丧气的我吗？' },
        { id: 65, type: 'fill', question: '我最近有在好好护肤，你注意到了吗？' },
        { id: 66, type: 'fill', question: '我唱歌好听吗？' },
        { id: 67, type: 'fill', question: '你还喜欢我这张脸吗？' },
        { id: 68, type: 'fill', question: '你喜欢我现在的身材吗？' },
        { id: 69, type: 'fill', question: '有坏东西欺负我，你会帮我吗？' },
        { id: 70, type: 'fill', question: '我为我们求了姻缘，是上上签，你会觉得我迷信吗？' },
        { id: 71, type: 'fill', question: '你喜欢什么体位姿势？' }
    ];

    const DAILY_QUIZ_LIMIT = 5; // 每天最多弹出几次

    // ─── 状态 ──────────────────────────────
    let currentQuiz = null;
    let timerInterval = null;
    let timeLeft = 0;
    let totalTime = 0;
    let isAnswered = false;
    let isTimeout = false;
    let quizSchedulerTimer = null;

    // ─── 每日记录：走 getStorageKey，随会话隔离 ──────────
    function getTodayStr() {
        return new Date().toISOString().slice(0, 10);
    }

    function getDailyRecord() {
        try {
            const raw = safeGetItem(getStorageKey('quickQuizDailyRecord'));
            if (raw) {
                const data = JSON.parse(raw);
                if (data.date === getTodayStr()) return data.asked || [];
            }
        } catch (e) {}
        return [];
    }

    function saveDailyRecord(askedIds) {
        safeSetItem(getStorageKey('quickQuizDailyRecord'), JSON.stringify({
            date: getTodayStr(),
            asked: askedIds
        }));
    }

    function getAvailableQuestions() {
        const asked = getDailyRecord();
        return QUIZ_QUESTIONS.filter(q => !asked.includes(q.id));
    }

    function hasReachedDailyLimit() {
        return getDailyRecord().length >= DAILY_QUIZ_LIMIT;
    }

    function markQuestionAsked(questionId) {
        const asked = getDailyRecord();
        if (!asked.includes(questionId)) {
            asked.push(questionId);
            saveDailyRecord(asked);
        }
    }

    // ─── 显示快问快答卡片 ──────────────────
    function showQuiz(question, isFirstTrigger = false) {
        if (!question) return;
        if (currentQuiz) closeQuiz();

        currentQuiz = question;
        isAnswered = false;
        isTimeout = false;

        const overlay = document.getElementById('quick-quiz-overlay');
        if (!overlay) return;

        const avatarEl = document.getElementById('qq-avatar');
        if (avatarEl) {
            const partnerImg = document.querySelector('#partner-avatar img');
            avatarEl.innerHTML = partnerImg ? `<img src="${partnerImg.src}">` : `<i class="fas fa-user"></i>`;
        }

        const senderEl = document.getElementById('qq-sender');
        if (senderEl) senderEl.textContent = settings.partnerName || '对方';

        const typeEl = document.getElementById('qq-type');
        if (typeEl) {
            typeEl.textContent = question.type === 'choice' ? '选择题' : '填空题';
            typeEl.style.background = question.type === 'choice' ? 'rgba(var(--accent-color-rgb), 0.15)' : 'rgba(76, 217, 100, 0.15)';
            typeEl.style.color = question.type === 'choice' ? 'var(--accent-color)' : '#4cd964';
        }

        const questionEl = document.getElementById('qq-question');
        if (questionEl) questionEl.textContent = question.question;

        const optionsContainer = document.getElementById('qq-options-container');
        const inputContainer = document.getElementById('qq-input-container');
        const inputEl = document.getElementById('qq-input');
        const resultArea = document.getElementById('qq-result-area');
        if (resultArea) resultArea.innerHTML = '';

        if (question.type === 'choice') {
            optionsContainer.style.display = 'flex';
            inputContainer.style.display = 'none';
            optionsContainer.innerHTML = question.options.map((opt, idx) =>
                `<button class="quick-quiz-option" data-index="${idx}">${opt}</button>`
            ).join('');
            optionsContainer.querySelectorAll('.quick-quiz-option').forEach(btn => {
                btn.addEventListener('click', function() {
                    if (isAnswered || isTimeout) return;
                    optionsContainer.querySelectorAll('.quick-quiz-option').forEach(b => b.classList.remove('selected'));
                    this.classList.add('selected');
                    document.getElementById('qq-submit-btn').disabled = false;
                });
            });
        } else {
            optionsContainer.style.display = 'none';
            inputContainer.style.display = 'block';
            if (inputEl) {
                inputEl.value = '';
                inputEl.disabled = false;
                setTimeout(() => inputEl.focus(), 300);
                inputEl.oninput = function() {
                    if (isAnswered || isTimeout) return;
                    document.getElementById('qq-submit-btn').disabled = !this.value.trim();
                };
            }
        }

        totalTime = question.type === 'choice' ? 7 : 60;
        timeLeft = totalTime;
        updateTimerBar();

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerBar();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                handleTimeout();
            }
        }, 1000);

        overlay.classList.add('active');

        const submitBtn = document.getElementById('qq-submit-btn');
        submitBtn.disabled = true;
        submitBtn.onclick = function() {
            if (isAnswered || isTimeout) return;
            handleSubmit();
        };

        document.getElementById('qq-skip-btn').onclick = function() { closeQuiz(); };
        document.getElementById('qq-close-btn').onclick = function() { closeQuiz(); };
        overlay.onclick = function(e) { if (e.target === overlay) closeQuiz(); };

        if (!isFirstTrigger) markQuestionAsked(question.id);
    }

    function updateTimerBar() {
        const bar = document.getElementById('qq-timer-bar');
        if (!bar) return;
        const pct = (timeLeft / totalTime) * 100;
        bar.style.width = Math.max(0, pct) + '%';
        bar.classList.toggle('danger', pct < 20);
    }

    function handleTimeout() {
        if (isAnswered || isTimeout) return;
        isTimeout = true;
        const resultArea = document.getElementById('qq-result-area');
        if (resultArea) resultArea.innerHTML = `<div class="quick-quiz-timeout"><i class="fas fa-hourglass-end"></i> 时间到！未作答</div>`;
        const inputEl = document.getElementById('qq-input');
        if (inputEl) inputEl.disabled = true;
        document.getElementById('qq-submit-btn').disabled = true;
        document.querySelectorAll('.quick-quiz-option').forEach(b => b.style.pointerEvents = 'none');
        setTimeout(() => closeQuiz(), 3000);
    }

    function handleSubmit() {
        if (isAnswered || isTimeout) return;

        let answer = '';
        if (currentQuiz.type === 'choice') {
            const selected = document.querySelector('.quick-quiz-option.selected');
            if (!selected) { showNotification('请选择一个选项', 'warning'); return; }
            answer = selected.textContent.trim();
        } else {
            const inputEl = document.getElementById('qq-input');
            if (!inputEl || !inputEl.value.trim()) { showNotification('请输入你的回答', 'warning'); return; }
            answer = inputEl.value.trim();
        }

        isAnswered = true;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        document.querySelectorAll('.quick-quiz-option').forEach(b => b.style.pointerEvents = 'none');
        const inputEl = document.getElementById('qq-input');
        if (inputEl) inputEl.disabled = true;
        document.getElementById('qq-submit-btn').disabled = true;

        const resultArea = document.getElementById('qq-result-area');
        if (resultArea) resultArea.innerHTML = `<div class="quick-quiz-answered"><i class="fas fa-check-circle"></i> 已作答</div>`;

        const senderName = settings.myName || '我';
        const partnerName = settings.partnerName || '对方';
        const typeLabel = currentQuiz.type === 'choice' ? '选择题' : '填空题';
        const messageText = `【快问快答 · ${typeLabel}】\n${partnerName} 问：${currentQuiz.question}\n\n${senderName} 答：${answer}`;

        addMessage({
            id: Date.now() + Math.random(),
            sender: 'user',
            text: messageText,
            timestamp: new Date(),
            status: 'sent',
            type: 'normal',
            favorited: false,
            note: null
        });
        if (typeof playSound === 'function') playSound('send');

        setTimeout(() => closeQuiz(), 2000);
    }

    function closeQuiz() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        const overlay = document.getElementById('quick-quiz-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.onclick = null;
        }
        currentQuiz = null;
        isAnswered = false;
        isTimeout = false;
    }
    window.closeQuickQuiz = closeQuiz;

    // ─── 调度系统 ──────────────────────────
    function scheduleNextQuiz() {
        if (quizSchedulerTimer) { clearTimeout(quizSchedulerTimer); quizSchedulerTimer = null; }

        if (hasReachedDailyLimit()) {
            quizSchedulerTimer = setTimeout(() => {
                saveDailyRecord([]);
                scheduleNextQuiz();
            }, msToMidnight());
            return;
        }

        const available = getAvailableQuestions();
        if (available.length === 0) {
            saveDailyRecord([]);
            quizSchedulerTimer = setTimeout(scheduleNextQuiz, 30 * 60 * 1000 + Math.random() * 60 * 60 * 1000);
            return;
        }

        const hours = 2 + Math.random() * 10;
        quizSchedulerTimer = setTimeout(() => {
            if (hasReachedDailyLimit()) { scheduleNextQuiz(); return; }
            const freshAvailable = getAvailableQuestions();
            if (freshAvailable.length === 0) { saveDailyRecord([]); scheduleNextQuiz(); return; }
            const q = freshAvailable[Math.floor(Math.random() * freshAvailable.length)];
            if (q) { showQuiz(q, false); scheduleNextQuiz(); }
        }, hours * 60 * 60 * 1000);
    }

    function msToMidnight() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow - now + 1000;
    }

    // ─── 启动系统 ──────────────────────────
    function startQuickQuizSystem() {
        const today = getTodayStr();
        const raw = safeGetItem(getStorageKey('quickQuizDailyRecord'));
        if (raw) {
            try { if (JSON.parse(raw).date !== today) saveDailyRecord([]); }
            catch (e) { saveDailyRecord([]); }
        } else {
            saveDailyRecord([]);
        }

        // 首次触发：页面打开后1-15分钟内弹出
        const firstDelay = 60 * 1000 + Math.random() * 14 * 60 * 1000;
        setTimeout(() => {
            const available = getAvailableQuestions();
            if (available.length > 0) {
                const q = available[Math.floor(Math.random() * available.length)];
                if (q) {
                    showQuiz(q, true);
                    markQuestionAsked(q.id);
                }
            } else {
                saveDailyRecord([]);
            }
            scheduleNextQuiz();
        }, firstDelay);

        // 跨天重置检测（每30分钟）
        setInterval(() => {
            const raw2 = safeGetItem(getStorageKey('quickQuizDailyRecord'));
            if (raw2) {
                try {
                    if (JSON.parse(raw2).date !== getTodayStr()) {
                        saveDailyRecord([]);
                        if (quizSchedulerTimer) { clearTimeout(quizSchedulerTimer); quizSchedulerTimer = null; }
                        scheduleNextQuiz();
                    }
                } catch (e) {}
            }
        }, 30 * 60 * 1000);
    }

    // ─── 手动触发（供数据管理面板 / 调试用） ──────────────
    function triggerQuickQuizNow() {
        const available = getAvailableQuestions();
        if (available.length === 0) {
            showNotification('今天的题目已经问完啦，明天再来~', 'info', 3000);
            return;
        }
        const q = available[Math.floor(Math.random() * available.length)];
        if (q) { showQuiz(q, false); }
    }
    window.triggerQuickQuizNow = triggerQuickQuizNow;

    // ─── 初始化：等 SESSION_ID 就绪（getStorageKey 依赖它）──────
    document.addEventListener('DOMContentLoaded', function() {
        const waitReady = setInterval(function() {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                setTimeout(startQuickQuizSystem, 2000);
            }
        }, 300);
    });
})();
