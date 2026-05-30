(function() {
    // 1. 基础缓存配置
    const STORAGE_KEY = 'async_board_messages';
    const TIME_KEY = 'async_board_last_check_time'; // 记住上一次判定时间
    
    // 【测试专用】：先改成 5 秒钟判定一次
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

    // 网页一加载，后台自动检查一次
    checkAndGeneratePartnerMsg();

    // 3. 打开与关闭
    function openBoard() {
        if (modal) {
            modal.style.display = 'flex';
            renderBoard();
            checkAndGeneratePartnerMsg(); // 打开时再次检查
        }
    }

    function closeBoard() {
        if (modal) modal.style.display = 'none';
    }

    // 4. 核心：对方异步拼接纸条逻辑
    function checkAndGeneratePartnerMsg() {
        let messages = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        let lastCheckTime = parseInt(localStorage.getItem(TIME_KEY) || '0');
        let now = Date.now();

        // 如果距离上一次判定已经过了 5 秒
        if (now - lastCheckTime > HALF_HOUR) {
            
            // 锁定这次判定的时间戳
            localStorage.setItem(TIME_KEY, now.toString());

            // 测试阶段：100% 触发概率，先不拼运气
            const isLucky = true; 

            if (!isLucky) return;

            // 🔍 核心排查：多渠道尝试获取你的字卡数据
            let pool = [];
            
            if (window.customReplies && window.customReplies.length > 0) {
                pool = window.customReplies;
            } else if (window.replyLibrary && window.replyLibrary.length > 0) {
                pool = window.replyLibrary;
            } else if (localStorage.getItem('customStatuses')) {
                pool = JSON.parse(localStorage.getItem('customStatuses') || '[]');
            } else if (localStorage.getItem('customReplies')) {
                pool = JSON.parse(localStorage.getItem('customReplies') || '[]');
            }

            // 🚨 终极防空兜底：如果上面的全局变量系统都没抓到，我们写几个死数据测试
            if (!pool || pool.length === 0) {
                pool = [
                    "今天的天气很好……",
                    "你在听吗？",
                    "我一直在想一件事……",
                    "有些话想留在这里。",
                    "起风了……"
                ];
            }

            // 确定抽取几张字卡（3 到 5 张）
            const count = Math.floor(Math.random() * 3) + 3; 
            const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
            let combinedPieces = [];
            
            for (let i = 0; i < count; i++) {
                let cardText = pool[Math.floor(Math.random() * pool.length)];
                combinedPieces.push(cardText);
            }

            // 拼接字卡
            let finalSentence = "";
            for(let i = 0; i < combinedPieces.length; i++) {
                finalSentence += combinedPieces[i];
                if(i < combinedPieces.length - 1) {
                    const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                    finalSentence += randomConnector;
                }
            }

            // 塞进数组
            messages.push({
                id: 'p_' + Date.now(),
                role: 'partner',
                content: finalSentence,
                time: new Date().toLocaleString('zh-CN', { hour12: false })
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));

            // 如果当前留言板正开着，立刻刷新视图
            if (modal && modal.style.display === 'flex') {
                renderBoard();
            }
        }
    }

    // 5. 渲染便签墙（灰蓝 & 淡紫）
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

    // 6. 我写便签发送
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
