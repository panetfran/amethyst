(function() {
    // 1. 基础缓存配置（统一使用你系统的 getStorageKey 机制）
    const STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';
    const TIME_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_last_check_time') : 'async_board_last_check_time';
    
    // 【测试专用】：保持 5 秒判定一次，测试通过后你可以随时改回 30 * 60 * 1000（30分钟）
    const HALF_HOUR = 5 * 1000; 

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

    // 网页一加载，异步后台检查一次
    setTimeout(checkAndGeneratePartnerMsg, 1000);

    // 3. 打开与关闭
    async function openBoard() {
        if (modal) {
            modal.style.display = 'flex';
            await renderBoard();
            await checkAndGeneratePartnerMsg(); // 打开时再次触发判定
        }
    }

    function closeBoard() {
        if (modal) modal.style.display = 'none';
    }

    // 4. 核心：【异步对接数据库】的拼接纸条逻辑
    async function checkAndGeneratePartnerMsg() {
        if (typeof localforage === 'undefined') {
            console.error("【留白】未检测到 localforage 库，无法读取字卡。");
            return;
        }

        // 异步读取留言板历史纪录与上一次判定时间
        let messages = await localforage.getItem(STORAGE_KEY) || [];
        let lastCheckTime = parseInt(await localforage.getItem(TIME_KEY) || '0');
        let now = Date.now();

        // 判定时间间隔（测试期间为 5 秒）
        if (now - lastCheckTime > HALF_HOUR) {
            
            // 锁定这次判定的时间戳
            await localforage.setItem(TIME_KEY, now.toString());

            // 测试阶段：100% 触发概率，不拼运气（等测试成功，把这里改成 Math.random() < 0.5 即可）
            const isLucky = true; 
            if (!isLucky) return;

            // 🔍 从你系统的 localforage 中提取自定义回复库
            const REPLIES_KEY = typeof getStorageKey === 'function' ? getStorageKey('customReplies') : 'customReplies';
            let pool = await localforage.getItem(REPLIES_KEY) || [];

            // 🚨 如果提取出来的是对象而不是数组，进行格式兼容拆分
            if (pool && !Array.isArray(pool) && typeof pool === 'object') {
                pool = Object.values(pool);
            }

            // 终极防空兜底（如果用户还没在回复库写过任何话，用这个测试）
            if (!pool || pool.length === 0) {
                pool = ["今天的天气很好……", "你在听吗？", "我一直在想一件事……", "有些话想留在这里。", "起风了……"];
            }

            // 随机确定抽取几张字卡（3 到 5 张）
            const count = Math.floor(Math.random() * 3) + 3; 
            const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
            let combinedPieces = [];
            
            for (let i = 0; i < count; i++) {
                let cardText = pool[Math.floor(Math.random() * pool.length)];
                // 确保捞出来的是文本
                if (cardText && typeof cardText === 'object' && cardText.content) cardText = cardText.content;
                if (cardText) combinedPieces.push(cardText);
            }

            if (combinedPieces.length === 0) return;

            // 开始将多张字卡融合成一段碎碎念
            let finalSentence = "";
            for(let i = 0; i < combinedPieces.length; i++) {
                finalSentence += combinedPieces[i];
                if(i < combinedPieces.length - 1) {
                    const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                    finalSentence += randomConnector;
                }
            }

            // 生成对方的淡紫色长便签
            messages.push({
                id: 'p_' + Date.now(),
                role: 'partner',
                content: finalSentence,
                time: new Date().toLocaleString('zh-CN', { hour12: false })
            });

            // 异步写入数据库
            await localforage.setItem(STORAGE_KEY, messages);

            // 如果当前留言板正开着，立刻刷新视图
            if (modal && modal.style.display === 'flex') {
                await renderBoard();
            }
        }
    }

    // 5. 渲染便签墙（高质感：灰蓝 & 淡紫）
    async function renderBoard() {
        if (!boardWall) return;
        let messages = [];
        if (typeof localforage !== 'undefined') {
            messages = await localforage.getItem(STORAGE_KEY) || [];
        }
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
    }

    // 6. 我手写贴便签的发送逻辑
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
