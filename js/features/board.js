(function() {
    // 1. 基础缓存配置（智能对接你系统的存储加密前缀机制）
    const STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';
    const TIME_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_last_partner_time') : 'async_board_last_partner_time';
    
    // ⏳ 对方多长时间来贴一次长便签：默认 12 小时（测试时你可以随时改为 5 * 1000 也就是 5 秒）
    const PARTNER_LEAVE_INTERVAL = 5 * 1000; 

    // 获取 HTML 元素
    const toggleBtn = document.getElementById('board-toggle-btn');
    const modal = document.getElementById('board-modal');
    const closeBtn = document.getElementById('board-close-btn');
    const sendBtn = document.getElementById('board-send-btn');
    const inputField = document.getElementById('board-input');
    const boardWall = document.getElementById('board-wall');

    // 2. 事件绑定
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

    // 4. 核心：【拼接机制】把 3-5 张字卡加上随机连接符拼成一张纸条
    function checkAndGeneratePartnerMsg() {
        // 使用标准的带安全保护的 localforage 获取，防止卡死初始化
        if (typeof localforage === 'undefined') return;

        Promise.all([
            localforage.getItem(STORAGE_KEY),
            localforage.getItem(TIME_KEY)
        ]).then(async (results) => {
            let messages = results[0] || [];
            let lastTime = parseInt(results[1] || '0');
            let now = Date.now();

            if (now - lastTime > PARTNER_LEAVE_INTERVAL) {
                
                // 无论有没有抽中，都更新时间戳，保证判定频率正常
                await localforage.setItem(TIME_KEY, now.toString());

                // 🎲 核心机制：每半小时判定一次，这里是 50% 概率
                // 【提示】：如果你将时间改为 5 秒进行测试，可以把 0.5 临时改为 1.0 (即 100% 成功)
                const isLucky = Math.random() < 0.5;
                if (!isLucky) return;

                // 🌟 【精准定位字卡库】：对接你系统里的自定义回复库 🌟
                const REPLIES_KEY = typeof getStorageKey === 'function' ? getStorageKey('customReplies') : 'customReplies';
                let pool = await localforage.getItem(REPLIES_KEY) || [];

                // 兼容处理：如果是对象格式则提取出数组
                if (pool && !Array.isArray(pool) && typeof pool === 'object') {
                    pool = Object.values(pool);
                }

                // 🚨 【防空安全兜底】：如果读取失败或回复库为空，用精美废话兜底，绝对不报错卡死
                if (!pool || pool.length === 0) {
                    pool = ["今天的天气很好……", "你在听吗？", "我一直在想一件事……", "有些话想留在这里。", "起风了……"];
                }

                // 确定这次抽取几张字卡（3 到 5 张）
                const count = Math.floor(Math.random() * 3) + 3; 
                
                // 定义在字卡中间随机加入的连接符/碎碎念语气词
                const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
                
                let combinedPieces = [];
                
                for (let i = 0; i < count; i++) {
                    let cardText = pool[Math.floor(Math.random() * pool.length)];
                    
                    // 解包深层对象（比如你信件格式里的 .content）
                    if (cardText && typeof cardText === 'object' && cardText.content) {
                        cardText = cardText.content;
                    }
                    if (cardText && typeof cardText === 'string') {
                        combinedPieces.push(cardText);
                    }
                }

                if (combinedPieces.length === 0) return;

                // 把捞出来的几张字卡，中间随机塞入不同的符号拼起来
                let finalSentence = "";
                for(let i = 0; i < combinedPieces.length; i++) {
                    finalSentence += combinedPieces[i];
                    if(i < combinedPieces.length - 1) {
                        const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                        finalSentence += randomConnector;
                    }
                }

                // 最终只作为「一条」完整的长便签塞进历史记录
                messages.push({
                    id: 'p_' + Date.now(),
                    role: 'partner',
                    content: finalSentence, 
                    time: new Date().toLocaleString('zh-CN', { hour12: false })
                });

                // 异步保存
                await localforage.setItem(STORAGE_KEY, messages);

                if (modal && modal.style.display === 'flex') {
                    renderBoard();
                }
            }
        }).catch(err => console.log("留白静默跳过判定"));
    }

    // 5. 渲染便签墙（这里包含你定好的雾霾蓝灰与丁香淡紫高级色）
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
                
                // 【配色】我写的用雾霾蓝灰，他写的用丁香淡紫
                const bgColor = isMy ? '#E9EEF2' : '#F1EFF7'; 
                const alignSelf = isMy ? 'flex-end' : 'flex-start';
                
                // 精致小边框
                const borderStyle = isMy ? 'border-left: 4px solid #90A4AE' : 'border-left: 4px solid #D1C4E9';
                // 保持手写便签的随机轻微倾斜
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
