(function() {
    // 1. 基础缓存配置（对接你系统的加密前缀机制）
    const STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';
    const TIME_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_last_check_time') : 'async_board_last_check_time';
    
    // 【测试专用】：保持 5 秒判定一次
    const HALF_HOUR = 5 * 1000; 

    // 获取 HTML 元素
    const toggleBtn = document.getElementById('board-toggle-btn');
    const modal = document.getElementById('board-modal');
    const closeBtn = document.getElementById('board-close-btn');
    const sendBtn = document.getElementById('board-send-btn');
    const inputField = document.getElementById('board-input');
    const boardWall = document.getElementById('board-wall');

    // 2. 顺应原系统的常规事件绑定（绝不拦截全局事件）
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            openBoard();
        });
    }
    
    if (closeBtn) closeBtn.addEventListener('click', closeBoard);
    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    // 网页加载 1 秒后在后台静默判定一次
    setTimeout(checkAndGeneratePartnerMsg, 1000);

    // 3. 打开与关闭函数
    async function openBoard() {
        if (modal) {
            modal.style.display = 'flex';
            await renderBoard(); // 刷新渲染列表
            await checkAndGeneratePartnerMsg(); // 每次打开顺便判定一次
        }
    }

    function closeBoard() {
        if (modal) modal.style.display = 'none';
    }

    // 4. 核心：【异步对接 localforage 数据库】拼接纸条
    async function checkAndGeneratePartnerMsg() {
        if (typeof localforage === 'undefined') return;

        let messages = await localforage.getItem(STORAGE_KEY) || [];
        let lastCheckTime = parseInt(await localforage.getItem(TIME_KEY) || '0');
        let now = Date.now();

        if (now - lastCheckTime > HALF_HOUR) {
            // 立刻更新时间锁
            await localforage.setItem(TIME_KEY, now.toString());

            // 测试阶段：100% 触发概率
            const isLucky = true; 
            if (!isLucky) return;

            // 获取你系统的自定义回复库数据
            const REPLIES_KEY = typeof getStorageKey === 'function' ? getStorageKey('customReplies') : 'customReplies';
            let pool = await localforage.getItem(REPLIES_KEY) || [];

            // 格式兼容
            if (pool && !Array.isArray(pool) && typeof pool === 'object') {
                pool = Object.values(pool);
            }

            // 终极防空兜底
            if (!pool || pool.length === 0) {
                pool = ["今天的天气很好……", "你在听吗？", "我一直在想一件事……", "有些话想留在这里。", "起风了……"];
            }

            // 随机确定抽取几张字卡（3 到 5 张）
            const count = Math.floor(Math.random() * 3) + 3; 
            const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
            let combinedPieces = [];
            
            for (let i = 0; i < count; i++) {
                let cardText = pool[Math.floor(Math.random() * pool.length)];
                if (cardText && typeof cardText === 'object' && cardText.content) cardText = cardText.content;
                if (cardText) combinedPieces.push(cardText);
            }

            if (combinedPieces.length === 0) return;

            // 融合成长句
            let finalSentence = "";
            for(let i = 0; i < combinedPieces.length; i++) {
                finalSentence += combinedPieces[i];
                if(i < combinedPieces.length - 1) {
                    const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                    finalSentence += randomConnector;
                }
            }

            // 生成对方的淡紫色便签
            messages.push({
                id: 'p_' + Date.now(),
                role: 'partner',
                content: finalSentence,
                time: new Date().toLocaleString('zh-CN', { hour12: false })
            });

            await localforage.setItem(STORAGE_KEY, messages);

            if (modal && modal.style.display === 'flex') {
                await renderBoard();
            }
        }
    }

    // 5. 渲染墙面（雾霾蓝灰 & 浅丁香紫）
    async function renderBoard() {
        if (!boardWall) return;
        let messages = [];
        if (typeof localforage !== 'undefined') {
            messages = await localforage.getItem(STORAGE_KEY) || [];
        }
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
    }

    // 6. 我贴便签的逻辑
    async function handleSend() {
        if (!inputField) return;
        const text = inputField.value.trim();
        if (!text) return;

        let messages = [];
        if (typeof localforage !== 'undefined') {
            messages = await localforage.getItem(STORAGE_KEY) || [];
        }
        
        messages.push({
            id: 'm_' + Date.now(),
            role: 'my',
            content: text,
            time: new Date().toLocaleString('zh-CN', { hour12: false })
        });

        if (typeof localforage !== 'undefined') {
            await localforage.setItem(STORAGE_KEY, messages);
        }
        inputField.value = ''; 
        await renderBoard(); 
    }
})();
