(function() {
    'use strict';

    // 1. 数据管理：定义余额和持久化存储逻辑
    window.RP_Module = {
        myBalance: 100000,
        systemBalance: 500000,
        save: function() {
            localStorage.setItem('rp_data', JSON.stringify({
                myBalance: this.myBalance, 
                systemBalance: this.systemBalance
            }));
        },
        load: function() {
            let saved = localStorage.getItem('rp_data');
            if (saved) {
                let data = JSON.parse(saved);
                this.myBalance = data.myBalance;
                this.systemBalance = data.systemBalance;
            }
        }
    };
    window.RP_Module.load(); // 加载历史数据

    // 2. 渲染函数：将红包插入到你的聊天流中
    function renderRedPacketToChat(amount) {
        // 找到聊天框容器，通常 ID 为 board-container (根据你的 index.html)
        const chatContainer = document.getElementById('board-container');
        if (!chatContainer) return;

        const packet = document.createElement('div');
        packet.style.cssText = 'margin:10px 0; padding:12px; background:#e64a3b; color:#fff; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-size:14px;';
        packet.innerHTML = `
            <span>🧧 对方发来了一个红包</span>
            <span style="font-weight:bold;">¥${(amount/100).toFixed(2)}</span>
        `;
        
        // 点击红包领取逻辑
        packet.onclick = function() {
            window.RP_Module.myBalance += amount;
            window.RP_Module.save();
            alert("领取成功！金额已存入你的钱包。");
            this.style.opacity = '0.6';
            this.style.cursor = 'default';
            this.innerHTML = '<span>🧧 红包已领取</span>';
            this.onclick = null; // 防止重复领取
        };
        
        chatContainer.appendChild(packet);
        chatContainer.scrollTop = chatContainer.scrollHeight; // 滚动到底部
    }

   // 3. 自动触发器：设置定时检测
    setInterval(() => {
        // 20% 的随机概率触发
        if (Math.random() > 0.2) return;

        // 进阶随机逻辑：分段概率计算
        let rand = Math.random();
        let randomAmount;

        if (rand < 0.70) {
            // 70% 概率：随机 0.01 - 50.00 元 (1 - 5000分)
            randomAmount = Math.floor(Math.random() * (5000 - 1 + 1) + 1);
        } else if (rand < 0.95) {
            // 25% 概率：随机 50.01 - 500.00 元 (5001 - 50000分)
            randomAmount = Math.floor(Math.random() * (50000 - 5001 + 1) + 5001);
        } else {
            // 5% 概率：暴击！随机 500.01 - 1314.00 元 (50001 - 131400分)
            randomAmount = Math.floor(Math.random() * (131400 - 50001 + 1) + 50001);
        }

        // 检查系统余额是否足够扣除
        if (window.RP_Module.systemBalance >= randomAmount) {
            window.RP_Module.systemBalance -= randomAmount;
            window.RP_Module.save();
            renderRedPacketToChat(randomAmount);
        }
    }, 600000); // 正常运行时设为 600000 (10分钟)


    
    // 4. 右下角悬浮入口（仅供查看余额）
    const btn = document.createElement('div');
    btn.innerHTML = '💰';
    btn.style.cssText = 'position:fixed; bottom:20px; right:20px; width:40px; height:40px; background:#333; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:9999; box-shadow:0 2px 5px rgba(0,0,0,0.2);';
    document.body.appendChild(btn);
    
    btn.onclick = () => {
        alert("【钱包】\n我的余额: ¥" + (window.RP_Module.myBalance/100).toFixed(2) + 
              "\n对方余额: ¥" + (window.RP_Module.systemBalance/100).toFixed(2));
    };
})();
