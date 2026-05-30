(function() {
    // 1. 基础缓存配置（智能对接你系统的存储加密前缀，没有则使用默认值）
    const STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';
    const TIME_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_last_partner_time') : 'async_board_last_partner_time';
    
    // ⏳ 判定时间间隔：测试时你可以把它改为 5 * 1000 (5秒)；生产环境用 30 * 60 * 1000 (30分钟)
    const PARTNER_LEAVE_INTERVAL = 5 * 1000; 

    // 获取 HTML 元素
    const toggleBtn = document.getElementById('board-toggle-btn');
    const modal = document.getElementById('board-modal');
    const closeBtn = document.getElementById('board-close-btn');
    const sendBtn = document.getElementById('board-send-btn');
    const inputField = document.getElementById('board-input');
    const boardWall = document.getElementById('board-wall');

    // 2. 事件绑定（保持你原本的模样，确保点击绝对有效）
    if (toggleBtn) toggleBtn.addEventListener('click', openBoard);
    if (closeBtn) closeBtn.addEventListener('click', closeBoard);
    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    // 初始化时自动在后台检查一次
    checkAndGeneratePartnerMsg();

    // 3. 打开与关闭
    function openBoard() {
        if (modal) {
            modal.style.display = 'flex';
            renderBoard();
            checkAndGeneratePartnerMsg(); 
        }
    }

    function closeBoard() {
        if (modal) modal.style.display = 'none';
    }

    // 4. 核心：【异步对接 localforage】拼接机制 + 半小时 0.5 概率判定
    function checkAndGeneratePartnerMsg() {
        // 如果系统还没加载完成 localforage，直接退出不干扰流程
        if (typeof localforage === 'undefined') return;

        // 采用 .then 异步链条，绝不阻塞外层的常规点击绑定
        Promise.all([
            localforage.getItem(STORAGE_KEY),
            localforage.getItem(TIME_KEY)
        ]).then(async (results) => {
            let messages = results[0] || [];
            let lastTime = parseInt(results[1] || '0');
            let now = Date.now();

            // 如果距离上一次判定超过了半小时
            if (now - lastTime > PARTNER_LEAVE_INTERVAL) {
                
                // 无论是否中签，都必须立刻更新时间戳，锁定判定周期
                await localforage.setItem(TIME_KEY, now.toString());

                // 🎲 核心机制：每半小时有 0.5 (50%) 的概率留言
                // 【提示】：测试时，如果你想看 100% 触发，可以临时把 0.5 改成 1.0
                const isLucky = Math.random() < 0.5;
                if (!isLucky) return; 

                // 🔍 获取你系统的自定义回复库数据
                const REPLIES_KEY = typeof getStorageKey === 'function' ? getStorageKey('customReplies') : 'customReplies';
                let pool = await localforage.getItem(REPLIES_KEY) || [];

                // 格式兼容：如果对象则拆分为数组
                if (pool && !Array.isArray(pool) && typeof pool === 'object') {
                    pool = Object.values(pool);
                }

                // 终极防空兜底
                if (!pool || pool.length === 0) {
                    pool = ["今天的天气很好……", "你在听吗？", "我一直在想一件事……", "有些话想留在这里。", "起风了……"];
                }

                // 确定这次抽取几张字卡（3 到 5 张）
                const count = Math.floor(Math.random() * 3) + 3; 
                const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
                
                let combinedPieces = [];
                for (let i = 0; i < count; i++) {
                    let cardText = pool[Math.floor(Math.random() * pool.length)];
                    // 数据深层提取
                    if (cardText && typeof cardText === 'object' && cardText.content) cardText = cardText.content;
                    if (cardText) combinedPieces.push(cardText);
                }

                if (combinedPieces.length === 0) return;

                // 拼接字卡
                let finalSentence = "";
                for(let i = 0; i < combinedPieces.length; i++) {
                    finalSentence += combinedPieces[i];
                    if(i < combinedPieces.length - 1) {
                        const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                        finalSentence += randomConnector;
                    }
                }

                // 融合封装为一条长便签
                messages.push({
                    id: 'p_' + Date.now(),
                    role: 'partner',
                    content: finalSentence, 
                    time: new Date().toLocaleString('zh-CN', { hour12: false })
                });

                // 保存回数据库
                await localforage.setItem(STORAGE_KEY, messages);

                // 如果当前正开着面板，直接刷新渲染
                if (modal && modal.style.display === 'flex') {
                    renderBoard();
                }
            }
        }).catch(err => console.error("【留白】数据判定出错: ", err));
    }

    // 5. 渲染便签墙（对接 localforage 渲染）
    function renderBoard() {
        if (!boardWall || typeof localforage === 'undefined') return;

        localforage.getItem(STORAGE_KEY).then(messages => {
            messages = messages || [];
            boardWall.innerHTML = '';

            if (messages.length === 0) {
                boardWall.innerHTML = `<div style="text-align:center;color:#aaa;margin-top:60px;font-size:12px;">墙上空空如也，留下一张便签吧。</div>`;
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
        });
    }

    // 6. 我手写贴上去的逻辑
    function handleSend() {
        if (!inputField || typeof localforage === 'undefined') return;
        const text = inputField.value.trim();
        if (!text) return;

        localforage.getItem(STORAGE_KEY).then(async (messages) => {
            messages = messages || [];
            
            messages.push({
                id: 'm_' + Date.now(),
                role: 'my',
                content: text,
                time: new Date().toLocaleString('zh-CN', { hour12: false })
            });

            await localforage.setItem(STORAGE_KEY, messages);
            inputField.value = ''; 
            renderBoard(); 
        });
    }
})();
