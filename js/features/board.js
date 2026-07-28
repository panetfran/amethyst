// 1. 基础缓存配置
const STORAGE_KEY = 'async_board_messages';
const TIME_KEY = 'async_board_last_partner_time';

// ⏳ 对方多长时间来贴一次长便签：默认 12 小时（测试时你可以随时改为 5000 也就是 5 秒）
const PARTNER_LEAVE_INTERVAL = 20 * 60 * 1000; 

// 🌟【终极强制开启】：直接挂载到 window 全局，任何地方都能直接点开！
window.forceOpenBoard = function() {
    const modal = document.getElementById('board-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderBoard();
        // 延迟判定，给系统充足的缓冲时间
        setTimeout(checkAndGeneratePartnerMsg, 200);
        markBoardSeen();
    } else {
        console.error("找不到 id 为 board-modal 的弹窗元素，请检查 HTML 结构！");
    }
};

// 🌟【终极强制关闭】
window.forceCloseBoard = function() {
    const modal = document.getElementById('board-modal');
    if (modal) modal.style.display = 'none';
};

// 2. 原生的常规事件绑定（保留作为双重保险，如果原先能跑就继续跑）
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('board-toggle-btn');
    const closeBtn = document.getElementById('board-close-btn');
    const sendBtn = document.getElementById('board-send-btn');
    const inputField = document.getElementById('board-input');

    if (toggleBtn && !toggleBtn.getAttribute('onclick')) {
        toggleBtn.addEventListener('click', window.forceOpenBoard);
    }
    if (closeBtn) {
        // 如果你的关闭按钮也点不动，可以在 HTML 的关闭按钮加 onclick="forceCloseBoard()"
        closeBtn.addEventListener('click', window.forceCloseBoard);
    }
    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }
    
    // 页面加载 3 秒后在后台静默检查一次，之后转入循环调度（见下方 scheduleBoardCheck）
    setTimeout(() => { checkAndGeneratePartnerMsg(); scheduleBoardCheck(); }, 3000);
});

// 3. 核心：【拼接机制】
let _boardCheckTimer = null;
function scheduleBoardCheck() {
    if (_boardCheckTimer) clearTimeout(_boardCheckTimer);
    // 每隔5~8分钟检查一次；真正要不要生成新留言，由函数内部的
    // PARTNER_LEAVE_INTERVAL（20分钟）+ 50%概率 这两道门限来把控节奏，
    // 这里只是保证"有在定期检查"，不会因为你一直不开留白面板就永远查不到
    const delay = (5 + Math.random() * 3) * 60 * 1000;
    _boardCheckTimer = setTimeout(() => { checkAndGeneratePartnerMsg(); scheduleBoardCheck(); }, delay);
}

function checkAndGeneratePartnerMsg() {
    if (typeof localforage === 'undefined') return;

    // 在需要用的时候动态获取存储键，防止安全锁暴毙
    const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey(STORAGE_KEY) : STORAGE_KEY;
    const REAL_TIME_KEY = typeof getStorageKey === 'function' ? getStorageKey(TIME_KEY) : TIME_KEY;

    Promise.all([
        localforage.getItem(REAL_STORAGE_KEY),
        localforage.getItem(REAL_TIME_KEY)
    ]).then(async (results) => {
        let messages = results[0] || [];
        let lastTime = parseInt(results[1] || '0');
        let now = Date.now();

        if (now - lastTime > PARTNER_LEAVE_INTERVAL) {
            
            await localforage.setItem(REAL_TIME_KEY, now.toString());

            // 🎲 核心概率判定：这里设置为 50% 的概率（测试时你可以改成 true 也就是 100% 触发）
            const isLucky = Math.random() < 0.5;
            if (!isLucky) return;

            // 提取回复池
            const REPLIES_KEY = typeof getStorageKey === 'function' ? getStorageKey('customReplies') : 'customReplies';
            let pool = await localforage.getItem(REPLIES_KEY) || [];

            if (pool && !Array.isArray(pool) && typeof pool === 'object') {
                pool = Object.values(pool);
            }

            // 🚨 终极防空安全兜底
            if (!pool || pool.length === 0) {
                pool = ["今天的天气很好……", "你在听吗？", "我一直在想一件事……", "有些话想留在这里。", "起风了……", "这边的留白，我很喜欢。"];
            }

            const count = Math.floor(Math.random() * 3) + 3; 
            const connectors = ['……', '。', '，',  '？'];
            
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

            let finalSentence = "";
            for(let i = 0; i < combinedPieces.length; i++) {
                finalSentence += combinedPieces[i];
                if(i < combinedPieces.length - 1) {
                    const randomConnector = connectors[Math.floor(Math.random() * connectors.length)];
                    finalSentence += randomConnector;
                }
            }

            messages.push({
                id: 'p_' + Date.now(),
                role: 'partner',
                content: finalSentence, 
                time: new Date().toLocaleString('zh-CN', { hour12: false })
            });

            await localforage.setItem(REAL_STORAGE_KEY, messages);
            refreshBoardBadge();

            const modal = document.getElementById('board-modal');
            if (modal && modal.style.display === 'flex') {
                renderBoard();
            }
        }
    }).catch(err => console.log("留白数据判定静默跳过"));
}

// 4. 渲染便签墙
function renderBoard() {
    const boardWall = document.getElementById('board-wall');
    if (!boardWall || typeof localforage === 'undefined') return;

    const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey(STORAGE_KEY) : STORAGE_KEY;

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

// 5. 我手写贴上去的逻辑
function handleSend() {
    const inputField = document.getElementById('board-input');
    if (!inputField || typeof localforage === 'undefined') return;
    const text = inputField.value.trim();
    if (!text) return;

    const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey(STORAGE_KEY) : STORAGE_KEY;

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

// 6. 角标未读统计（用"上次查看时对方留言的数量"做对比，不解析格式化时间字符串，更稳）
function refreshBoardBadge() {
    if (typeof localforage === 'undefined' || typeof window.appBadges === 'undefined') return;
    const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey(STORAGE_KEY) : STORAGE_KEY;
    const REAL_SEEN_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_seen_count') : 'async_board_seen_count';
    Promise.all([
        localforage.getItem(REAL_STORAGE_KEY),
        localforage.getItem(REAL_SEEN_KEY)
    ]).then(([messages, seenCount]) => {
        messages = messages || [];
        seenCount = seenCount || 0;
        const partnerCount = messages.filter(m => m.role === 'partner').length;
        window.appBadges.set('board-toggle-btn', Math.max(0, partnerCount - seenCount));
    }).catch(() => {});
}

function markBoardSeen() {
    if (typeof localforage === 'undefined') return;
    const REAL_STORAGE_KEY = typeof getStorageKey === 'function' ? getStorageKey(STORAGE_KEY) : STORAGE_KEY;
    const REAL_SEEN_KEY = typeof getStorageKey === 'function' ? getStorageKey('async_board_seen_count') : 'async_board_seen_count';
    localforage.getItem(REAL_STORAGE_KEY).then(messages => {
        messages = messages || [];
        const partnerCount = messages.filter(m => m.role === 'partner').length;
        return localforage.setItem(REAL_SEEN_KEY, partnerCount);
    }).then(refreshBoardBadge).catch(() => {});
}

// 页面加载后先算一次角标（不用等打开面板）
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(refreshBoardBadge, 1000);
});
