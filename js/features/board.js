(function() {
    // ⏳ 对方贴长便签的判定时间间隔：12 小时（测试时你可以随时改为 5000 也就是 5 秒）
    const PARTNER_LEAVE_INTERVAL = 5 * 1000; 

    // 获取 HTML 元素
    const toggleBtn = document.getElementById('board-toggle-btn');
    const modal = document.getElementById('board-modal');
    const closeBtn = document.getElementById('board-close-btn');
    const sendBtn = document.getElementById('board-send-btn');
    const inputField = document.getElementById('board-input');
    const boardWall = document.getElementById('board-wall');

    // 1. 干净的点击与键盘事件绑定（放在最顶层，确保百分之百绑定成功，绝不被任何未初始化的代码阻塞）
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            if (modal) {
                modal.style.display = 'flex';
                renderBoard();
                // 延迟 100 毫秒再判定，给系统充足的时间
                setTimeout(checkAndGeneratePartnerMsg, 100);
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            if (modal) modal.style.display = 'none';
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    // 网页加载 3 秒后（确保 session_id 肯定初始化完毕了），再在后台悄悄判定一次
    setTimeout(checkAndGeneratePartnerMsg, 3000);

    // 2. 核心：【拼接机制】
    function checkAndGeneratePartnerMsg() {
        if (typeof localforage === 'undefined') return;

        // 🌟【核心修复】：在需要用的时候，再在函数内部动态获取存储键，绝不在全局提早触发安全锁！
        const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';
        const REAL_TIME_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_last_partner_time') : 'async_board_last_partner_time';

        Promise.all([
            localforage.getItem(REAL_STORAGE_KEY),
            localforage.getItem(REAL_TIME_KEY)
        ]).then(async (results) => {
            let messages = results[0] || [];
            let lastTime = parseInt(results[1] || '0');
            let now = Date.now();

            if (now - lastTime > PARTNER_LEAVE_INTERVAL) {
                
                // 无论抽中与否，立刻锁定判定周期
                await localforage.setItem(REAL_TIME_KEY, now.toString());

                // 🎲 核心概率判定：这里设置为 50% 的概率（测试时你可以改成 true 也就是 100% 触发）
                const isLucky = Math.random() < 0.5;
                if (!isLucky) return;

                // 🌟【从 envelope.js 得到启发】：你的系统数据池直接叫 envelopeData 或存储在 customReplies 里
                // 我们去安全提取系统里的回复池
                const REPLIES_KEY = typeof getStorageKey === 'function' ? getStorageKey('customReplies') : 'customReplies';
                let pool = await localforage.getItem(REPLIES_KEY) || [];

                // 兼容性处理
                if (pool && !Array.isArray(pool) && typeof pool === 'object') {
                    pool = Object.values(pool);
                }

                // 🚨 终极防空安全兜底
                if (!pool || pool.length === 0) {
                    pool = ["今天的天气很好……", "你在听吗？", "我一直在想一件事……", "有些话想留在这里。", "起风了……", "这边的留白，我很喜欢。"];
                }

                // 确定这次抽取几张字卡（3 到 5 张）
                const count = Math.floor(Math.random() * 3) + 3; 
                const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
                
                let combinedPieces = [];
                for (let i = 0; i < count; i++) {
                    let cardText = pool[Math.floor(Math.random() * pool.length)];
                    if (cardText && typeof cardText === 'object' && cardText.content) {
                        cardText = cardText.content;
                    }
                    if (cardText && typeof cardText === 'string') {
                        combinedPieces.push(cardText);
                    }
                }

                if (combinedPieces.length === 0) return;

                // 拼成长句
                let finalSentence = "";
                for(let i = 0; i < combinedPieces.length; i++) {
                    finalSentence += combinedPieces[i];
                    if(i < combinedPieces.length - 1) {
                        const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                        finalSentence += randomConnector;
                    }
                }

                // 生成对方的丁香淡紫便签
                messages.push({
                    id: 'p_' + Date.now(),
                    role: 'partner',
                    content: finalSentence, 
                    time: new Date().toLocaleString('zh-CN', { hour12: false })
                });

                // 保存
                await localforage.setItem(REAL_STORAGE_KEY, messages);

                if (modal && modal.style.display === 'flex') {
                    renderBoard();
                }
            }
        }).catch(err => console.log("留白数据判定静默跳过"));
    }

    // 3. 渲染便签墙
    function renderBoard() {
        if (!boardWall || typeof localforage === 'undefined') return;

        // 🌟【动态获取键】：安全渲染
        const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';

        localforage.getItem(REAL_STORAGE_KEY).then(messages => {
            messages = messages || [];
            boardWall.innerHTML = '';

            if (messages.length === 0) {
                boardWall.innerHTML = `<div style="text-align:center;color:#aaa;margin-top:60px;font-size:12px;font-family:sans-serif;">墙上空空如也，留下一张便签吧。</div>`;
                return;
            }

            messages.forEach(msg => {
                const isMy = msg.role === 'my';
                const bgColor = isMy ? '#E9EEF2' : '#F1EFF7'; 
                const alignSelf = isMy ? 'flex-end' : 'flex-start';
                const borderStyle = isMy ? 'border-left: 4px solid #90A4AE' : 'border-left: 4px solid #D1C4E9';
                const randomRotate = (Math.random() * 2 - 1).toFixed(1); 

                const card = document.createElement('div');
                card.style.cssText = `
                    align-self: ${alignSelf};
                    background: ${bgColor};
                    padding: 12px 16px;
                    border-radius: 8px;
                    max-width: 82%;
                    box-shadow: 2px 4px 12px rgba(0,0,0,0.03);
                    transform: rotate(${randomRotate}deg);
                    ${borderStyle};
                `;

                card.innerHTML = `
                    <div style="font-size: 13.5px; color: #333; line-height: 1.6; word-break: break-all; white-space: pre-wrap;">${msg.content}</div>
                    <div style="font-size: 10px; color: #9a9a9a; margin-top: 6px; text-align: right; font-family: sans-serif;">${msg.time}</div>
                `;
                boardWall.appendChild(card);
            });

            boardWall.scrollTop = boardWall.scrollHeight;
        }).catch(err => console.log("渲染数据获取失败"));
    }

    // 4. 我手写贴上去的逻辑
    function handleSend() {
        if (!inputField || typeof localforage === 'undefined') return;
        const text = inputField.value.trim();
        if (!text) return;

        // 🌟【动态获取键】
        const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';

        localforage.getItem(REAL_STORAGE_KEY).then(async (messages) => {
            messages = messages || [];
            
            messages.push({
                id: 'm_' + Date.now(),
                role: 'my',
                content: text,
                time: new Date().toLocaleString('zh-CN', { hour12: false })
            });

            await localforage.setItem(REAL_STORAGE_KEY, messages);
            inputField.value = ''; 
            renderBoard(); 
        }).catch(err => console.log("发送保存失败"));
    }
})();
