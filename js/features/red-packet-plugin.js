(function() {
    'use strict';

    // 1. 数据模型与持久化
    window.RP_Module = {
        myBalance: 100000,
        systemBalance: 100000,
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
    window.RP_Module.load();

    // 2. 渲染红包到聊天流
    function renderRedPacketToChat(amount) {
        const chatContainer = document.getElementById('board-container');
        if (!chatContainer) return;

        const packet = document.createElement('div');
        packet.style.cssText = 'margin:10px 0; padding:12px; background:#e64a3b; color:#fff; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-size:14px;';
        packet.innerHTML = `
            <span>🧧 对方发来了一个红包</span>
            <span style="font-weight:bold;">¥${(amount/100).toFixed(2)}</span>
        `;
        
        packet.onclick = function() {
            window.RP_Module.myBalance += amount;
            window.RP_Module.save();
            alert("领取成功！金额已存入你的钱包。");
            this.style.opacity = '0.6';
            this.innerHTML = '<span>🧧 红包已领取</span>';
            this.onclick = null;
        };
        
        chatContainer.appendChild(packet);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 3. 自动触发器
    setInterval(() => {
        if (Math.random() > 0.2) return;
        let rand = Math.random();
        let randomAmount;
        if (rand < 0.70) randomAmount = Math.floor(Math.random() * 5000 + 1);
        else if (rand < 0.95) randomAmount = Math.floor(Math.random() * 45000 + 5001);
        else randomAmount = Math.floor(Math.random() * 81400 + 50001);
        
        if (window.RP_Module.systemBalance >= randomAmount) {
            window.RP_Module.systemBalance -= randomAmount;
            window.RP_Module.save();
            renderRedPacketToChat(randomAmount);
        }
    }, 600000); 

    // 4. 悬浮球 (调整至输入栏正上方: bottom: 70px)
    const btn = document.createElement('div');
    btn.innerHTML = '🧧';
    btn.style.cssText = `
        position:fixed; bottom:70px; right:20px; width:40px; height:40px; 
        background:#333; color:#fff; border-radius:50%; display:flex; 
        align-items:center; justify-content:center; cursor:pointer; 
        z-index:9999; box-shadow:0 2px 5px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(btn);
    
    // 5. 控制台逻辑 (不变)
    btn.onclick = () => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:20%; left:50%; transform:translateX(-50%); background:#fff; padding:20px; border-radius:15px; z-index:10000; box-shadow:0 10px 30px rgba(0,0,0,0.3); width:300px;';
        modal.innerHTML = `
            <h3>红包控制台</h3>
            <p>我的余额: ¥${(window.RP_Module.myBalance/100).toFixed(2)}</p>
            <p>对方余额: ¥${(window.RP_Module.systemBalance/100).toFixed(2)}</p>
            <button id="rp_send_btn" style="width:100%; margin-bottom:10px; background:#e64a3b; color:#fff; border:none; padding:8px; border-radius:5px; cursor:pointer;">发红包给对方</button>
            <button id="rp_edit_btn" style="width:100%; margin-bottom:10px; padding:8px; cursor:pointer;">修改余额</button>
            <button id="rp_close_btn" style="width:100%; padding:8px; cursor:pointer;">关闭</button>
        `;
        document.body.appendChild(modal);

        document.getElementById('rp_close_btn').onclick = () => modal.remove();
        document.getElementById('rp_edit_btn').onclick = () => {
            let newMy = prompt("修改我的余额(元):", (window.RP_Module.myBalance/100));
            let newSys = prompt("修改对方余额(元):", (window.RP_Module.systemBalance/100));
            if(newMy !== null) window.RP_Module.myBalance = parseFloat(newMy) * 100;
            if(newSys !== null) window.RP_Module.systemBalance = parseFloat(newSys) * 100;
            window.RP_Module.save();
            modal.remove();
        };
        document.getElementById('rp_send_btn').onclick = () => {
            let amountYuan = prompt("请输入红包金额(元):", "10.00");
            let amountFen = Math.round(parseFloat(amountYuan) * 100);
            if (amountFen > 0 && amountFen <= window.RP_Module.myBalance) {
                window.RP_Module.myBalance -= amountFen;
                window.RP_Module.save();
                renderRedPacketToChat(amountFen);
                modal.remove();
            } else {
                alert("金额无效或余额不足！");
            }
        };
    };
})();
