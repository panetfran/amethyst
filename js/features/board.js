(function() {
    // 1. 基础缓存配置
    const STORAGE_KEY = 'async_board_messages';
    const TIME_KEY = 'async_board_last_partner_time';
    
    // 对方多长时间来贴一次长便签：默认 12 小时
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
        let messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        let lastTime = parseInt(localStorage.getItem(TIME_KEY) || '0');
        let now = Date.now();

        if (now - lastTime > PARTNER_LEAVE_INTERVAL) {
            // 获取你的自定义回复字卡池
            const pool = window.customReplies || [];
            if (pool.length === 0) return; 

            // 确定这次抽取几张字卡（3 到 5 张）
            const count = Math.floor(Math.random() * 3) + 3; 
            
            // 定义在字卡中间随机加入的连接符/碎碎念语气词
            const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
            
            let combinedPieces = [];
            
            for (let i = 0; i < count; i++) {
                // 随机捞一张字卡
                let cardText = pool[Math.floor(Math.random() * pool.length)];
                combinedPieces.push(cardText);
            }

            // 【关键核心】：把捞出来的几张字卡，中间随机塞入不同的符号拼起来
            let finalSentence = "";
            for(let i = 0; i < combinedPieces.length; i++) {
                finalSentence += combinedPieces[i];
                // 如果不是最后一张，就在中间加个随机连接符
                if(i < combinedPieces.length - 1) {
                    const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                    finalSentence += randomConnector;
                }
            }

            // 最终只作为「一条」完整的长便签塞进历史记录
            messages.push({
                id: 'p_' + Date.now(),
                role: 'partner',
                content: finalSentence, // 拼好的一长串话
                time: new Date().toLocaleString('zh-CN', { hour12: false })
            });

            // 保存
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
            localStorage.setItem(TIME_KEY, now.toString());

            if (modal && modal.style.display === 'flex') {
                renderBoard();
            }
        }
    }

    // 5. 渲染便签墙（这里包含你定好的雾霾蓝灰与丁香淡紫高级色）
    function renderBoard() {
        if (!boardWall) return;
        let messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
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

        // 自动拉到最底下
        boardWall.scrollTop = boardWall.scrollHeight;
    }

    // 6. 我手写贴上去的逻辑
    function handleSend() {
        if (!inputField) return;
        const text = inputField.value.trim();
        if (!text) return;

        let messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        messages.push({
            id: 'm_' + Date.now(),
            role: 'my',
            content: text,
            time: new Date().toLocaleString('zh-CN', { hour12: false })
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        inputField.value = ''; 
        renderBoard(); 
    }
})();
