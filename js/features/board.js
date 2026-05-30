(function() {
    // 1. 基础缓存配置（统一使用你系统的 getStorageKey 机制）
    const STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_messages') : 'async_board_messages';
    const TIME_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_last_check_time') : 'async_board_last_check_time';
    
    // 【测试专用】：保持 5 秒判定一次，测试通过后你可以改回 30 * 60 * 1000（30分钟）
    const HALF_HOUR = 5 * 1000; 

    // 获取 HTML 元素
    const modal = document.getElementById('board-modal');
    const closeBtn = document.getElementById('board-close-btn');
    const sendBtn = document.getElementById('board-send-btn');
    const inputField = document.getElementById('board-input');
    const boardWall = document.getElementById('board-wall');

    // 2. 强力动态全局事件监听（彻底解决因为列表异步渲染导致的点击不弹窗问题）
    document.addEventListener('click', async function(e) {
        // 寻找点击的目标是不是我们的“留白”菜单项
        const targetBtn = e.target.closest('#board-toggle-btn');
        if (targetBtn) {
            e.preventDefault();
            e.stopPropagation(); // 阻止事件冒泡，防止被高级功能弹窗的关闭逻辑影响
            
            // 自动帮你在背后把高级功能面板隐去，防止层级冲突卡死
            const advModal = document.getElementById('advanced-modal');
            if (advModal) {
                advModal.style.display = 'none';
            }
            
            // 呼出留白便签墙
            await openBoard();
        }
    });

    // 绑定内部关闭和发送按钮
    if (closeBtn) closeBtn.addEventListener('click', closeBoard);
    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    // 网页一加载，过 1 秒钟在后台偷偷运行一次判定，实现“离线堆积”
    setTimeout(checkAndGeneratePartnerMsg, 1000);

    // 3. 打开与关闭函数
    async function openBoard() {
        if (modal) {
            modal.style.display = 'flex';
            await renderBoard(); // 刷新渲染列表
            await checkAndGeneratePartnerMsg(); // 每次打开顺便判定一下
        } else {
            console.error("【留白】未在网页底部找到 id 为 board-modal 的弹窗结构，请确认 HTML 贴的位置。");
        }
    }

    function closeBoard() {
        if (modal) modal.style.display = 'none';
    }

    // 4. 核心：【异步对接数据库】拼接纸条
    async function checkAndGeneratePartnerMsg() {
        if (typeof localforage === 'undefined') {
            console.error("【留白】当前环境未检测到 localforage 库。");
            return;
        }

        // 异步读取留言记录和上一次判定时间
        let messages = await localforage.getItem(STORAGE_KEY) || [];
        let lastCheckTime = parseInt(await localforage.getItem(TIME_KEY) || '0');
        let now = Date.now();

        // 时间判定规则
        if (now - lastCheckTime > HALF_HOUR) {
            
            // 立刻更新锁，保证不会因为重复刷新而疯狂刷屏
            await localforage.setItem(TIME_KEY, now.toString());

            // 测试阶段：100% 触发概率（等5秒测试成功后，再改成 Math.random() < 0.5）
            const isLucky = true; 
            if (!isLucky) return;

            // 从你系统的数据库中获取自定义回复库的数据键名
            const REPLIES_KEY = typeof getStorageKey === 'function' ? getStorageKey('customReplies') : 'customReplies';
            let pool = await localforage.getItem(REPLIES_KEY) || [];

            // 格式兼容：如果拿出来的是对象字典，转成数组
            if (pool && !Array.isArray(pool) && typeof pool === 'object') {
                pool = Object.values(pool);
            }

            // 终极防空兜底（防止你的回复库现在没有内容）
            if (!pool || pool.length === 0) {
                pool = ["今天的天气很好……", "你在听吗？", "我一直在想一件事……", "有些话想留在这里。", "起风了……"];
            }

            // 随机确定抽取几张字卡（3 到 5 张）
            const count = Math.floor(Math.random() * 3) + 3; 
            const connectors = ['…… ', '。 ', '， ', '……还有，', '……？ ', ' 或者是 ', '。也是，', '、', '……其实，'];
            let combinedPieces = [];
            
            for (let i = 0; i < count; i++) {
                let cardText = pool[Math.floor(Math.random() * pool.length)];
                // 数据深层提取兼容
                if (cardText && typeof cardText === 'object' && cardText.content) cardText = cardText.content;
                if (cardText) combinedPieces.push(cardText);
            }

            if (combinedPieces.length === 0) return;

            // 开始融合成一段带有呼吸感的碎碎念
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

            // 存入异步数据库
            await localforage.setItem(STORAGE_KEY, messages);

            // 如果当前正好开着墙，就刷新界面
            if (modal && modal.style.display === 'flex') {
                await renderBoard();
            }
        }
    }

    // 5. 渲染墙壁面（雾霾蓝灰 & 丁香淡紫）
    async function renderBoard() {
        if (!boardWall) return;
        let messages = [];
        if (typeof localforage !== 'undefined') {
            messages = await localforage.getItem(STORAGE_KEY) || [];
        }
        boardWall.innerHTML = '';

        if (messages.length === 0) {
            boardWall.innerHTML = `<div style="text-align:center;color:#aaa;margin-top:60px;font-size:12px;font-family: sans-serif;">墙上空空如也，留下一张便签吧。</div>`;
            return;
        }

        messages.forEach(msg => {
            const isMy = msg.role === 'my';
            
            // 调配的高级色彩：我写的用雾霾蓝灰，他写的用浅丁香紫
            const bgColor = isMy ? '#E9EEF2' : '#F1EFF7'; 
            const alignSelf = isMy ? 'flex-end' : 'flex-start';
            const borderStyle = isMy ? 'border-left: 4px solid #90A4AE' : 'border-left: 4px solid #D1C4E9';
            const randomRotate = (Math.random() * 2 - 1).toFixed(1); // 随机轻微旋转产生手账贴纸感

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

        // 永远把最新的话留在视线正中央
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
