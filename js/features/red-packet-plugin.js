(function() {
    'use strict';

    // 数据模型
    window.RP_Module = {
        myBalance: 100000,
        systemBalance: 500000,
        save: () => localStorage.setItem('rp_data', JSON.stringify(window.RP_Module)),
        load: () => {
            let s = localStorage.getItem('rp_data');
            if (s) {
                let d = JSON.parse(s);
                window.RP_Module.myBalance = d.myBalance;
                window.RP_Module.systemBalance = d.systemBalance;
            }
        }
    };
    window.RP_Module.load();

    // 渲染到信息流 (修正定位逻辑)
function renderRedPacketToChat(amount) {
    // 找到发送按钮
    const sendBtn = document.getElementById('board-send-btn');
    if (!sendBtn) return console.error("未找到发送按钮，请检查页面结构");

    // 获取聊天列表容器：根据你的结构，它通常是发送按钮所在行的上方那个容器
    // 我们可以通过 sendBtn 向上查找它的父级元素，也就是包含所有消息的那个列表区
    const chatContainer = sendBtn.parentElement.parentElement; 

    const packet = document.createElement('div');
    packet.style.cssText = 'margin:10px; padding:12px; background:#e64a3b; color:#fff; border-radius:8px; cursor:pointer; text-align:center; font-weight:bold;';
    packet.innerHTML = `🧧 对方发来红包：¥${(amount/100).toFixed(2)} (点击领取)`;
    
    packet.onclick = function() {
        window.RP_Module.myBalance += amount;
        window.RP_Module.save();
        this.innerHTML = '🧧 已领取 ¥' + (amount/100).toFixed(2);
        this.style.opacity = '0.5';
        this.onclick = null;
        alert("领取成功！");
    };
    
    // 把红包插入到发送框的上面
    chatContainer.insertBefore(packet, sendBtn.parentElement);
    
    // 自动滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

    // 悬浮球 (位置调整到右下角，离发送键不远的地方)
    const btn = document.createElement('div');
    btn.innerHTML = '🧧';
    btn.style.cssText = 'position:fixed; bottom:70px; right:20px; width:40px; height:40px; background:#e64a3b; color:#fff; border-radius:50%; z-index:9999; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.3);';
    document.body.appendChild(btn);

    // 专属红包弹窗板块
    btn.onclick = () => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:20%; left:50%; transform:translateX(-50%); background:#fff; padding:20px; border-radius:15px; z-index:10000; box-shadow:0 5px 20px rgba(0,0,0,0.3); width:300px;';
        modal.innerHTML = `
            <h3>红包板块</h3>
            <p>我的余额: ¥${(window.RP_Module.myBalance/100).toFixed(2)}</p>
            <button id="btn_send_rp" style="width:100%; padding:10px; background:#e64a3b; color:#fff; border:none; margin-bottom:10px;">发起红包</button>
            <button id="btn_close_rp" style="width:100%; padding:10px;">关闭</button>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn_close_rp').onclick = () => modal.remove();
        document.getElementById('btn_send_rp').onclick = () => {
            let val = prompt("输入金额(元):");
            let amt = Math.round(parseFloat(val) * 100);
            if(amt > 0 && amt <= window.RP_Module.myBalance) {
                if (Math.random() < 0.3) {
                    alert("对方未接收，红包退回。");
                } else {
                    window.RP_Module.myBalance -= amt;
                    window.RP_Module.save();
                    renderRedPacketToChat(amt);
                    alert("红包已发出！");
                }
                modal.remove();
            } else { alert("金额无效或余额不足"); }
        };
    };
})();
