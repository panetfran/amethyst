/**
 * 传讯定制版红包功能 (独立兼容版)
 * 1. 独立运行，使用 localStorage 本地持久化储存
 * 2. 深度融入现有 board 消息流，无需额外 CSS 和外部 JS 依赖
 */

(function () {
    'use strict';

    // ========== 1. 基础配置与数据初始化 ==========
    function getMyName() { return (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我'; }
    function getPartnerName() { return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角'; }

    // 初始化余额，不需要任何数据库插件，直接用浏览器自带的 localStorage
    let balanceData = JSON.parse(localStorage.getItem('rp_balances')) || {
        myBalance: 1000.00,
        partnerBalance: 1000.00
    };

    function saveBalances() {
        localStorage.setItem('rp_balances', JSON.stringify(balanceData));
    }

    // ========== 2. 构建发红包的主功能弹窗 ==========
    window.showRedPacketSendModal = function () {
        const oldModal = document.getElementById('rp-custom-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'rp-custom-modal';
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:999999; display:flex; align-items:center; justify-content:center; font-family:sans-serif;";
        
        modal.innerHTML = `
            <div style="background:#fff; width:90%; max-width:340px; border-radius:16px; padding:20px; box-shadow:0 8px 30px rgba(0,0,0,0.15); box-sizing:border-box;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f0f0f0; padding-bottom:12px; margin-bottom:16px;">
                    <span style="font-weight:600; color:#333; font-size:15px; display:flex; align-items:center; gap:6px;"><i class="fas fa-envelope-open-text" style="color:#c4453c;"></i>传讯红包</span>
                    <button id="rp-close-btn" style="background:none; border:none; cursor:pointer; font-size:16px; color:#aaa;"><i class="fas fa-times"></i></button>
                </div>
                
                <div style="font-size:12px; color:#666; margin-bottom:16px; background:#f9f9f9; padding:8px; border-radius:8px; line-height:1.6;">
                    💰 我的钱包: <b>￥${balanceData.myBalance.toFixed(2)}</b><br>
                    💌 ${getPartnerName()}的钱包: <b>￥${balanceData.partnerBalance.toFixed(2)}</b>
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">红包金额 (元)</label>
                    <input type="number" id="rp-amount-input" placeholder="0.00" min="0.01" step="0.01" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; outline:none; font-size:14px;">
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">留言备注</label>
                    <input type="text" id="rp-msg-input" placeholder="恭喜发财，大吉大利" value="恭喜发财，大吉大利" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; outline:none; font-size:13px;">
                </div>

                <button id="rp-submit-btn" style="width:100%; padding:12px; background:#c4453c; color:#fff; border:none; border-radius:24px; cursor:pointer; font-weight:600; font-size:14px; box-shadow:0 4px 10px rgba(196,69,60,0.2);">塞进红包并发送</button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('rp-close-btn').onclick = () => modal.remove();
        modal.onclick = (e) => { if(e.target === modal) modal.remove(); };

        document.getElementById('rp-submit-btn').onclick = function () {
            const amountInput = document.getElementById('rp-amount-input');
            const msgInput = document.getElementById('rp-msg-input');
            const amount = parseFloat(amountInput.value);
            const message = msgInput.value.trim() || "恭喜发财，大吉大利";

            if (isNaN(amount) || amount <= 0) {
                alert("请输入正确的红包金额！");
                return;
            }
            if (amount > balanceData.myBalance) {
                alert("钱包余额不足！");
                return;
            }

            balanceData.myBalance -= amount;
            saveBalances();

            // 联动你网站现有的留言板(board)输入框和发送按钮
            const boardInput = document.getElementById('board-input');
            const sendBtn = document.getElementById('board-send-btn');
            
            if (boardInput && sendBtn) {
                const rpCode = `[RED_PACKET|${amount}|${message}]`;
                const originalValue = boardInput.value;
                boardInput.value = rpCode;
                sendBtn.click(); // 自动点击“贴上”
                if(originalValue) boardInput.value = originalValue;
            } else {
                alert("未检测到消息流组件，红包发送失败。");
            }

            modal.remove();
        };
    };

    // ========== 3. 消息流文本捕获与卡片转换 ==========
    function scanAndRenderRedPackets() {
        // 检索网页里所有的消息文本容器
        const messageElements = document.querySelectorAll('.board-item-text, .msg-content, p, span, .item-text');
        
        messageElements.forEach(el => {
            if (el.textContent && el.textContent.includes('[RED_PACKET|')) {
                const match = el.textContent.match(/\[RED_PACKET\|([\d.]+)\|([^\]]+)\]/);
                if (match) {
                    const amount = parseFloat(match[1]);
                    const msg = match[2];
                    const rpId = 'rp_node_' + match[1] + '_' + Math.trunc(Math.random()*1000);

                    el.innerHTML = `
                        <div id="${rpId}" style="background:#f9ebec; border:1px solid #fadbd8; border-radius:12px; padding:12px; width:220px; display:flex; align-items:center; gap:12px; cursor:pointer; user-select:none; text-align:left; box-sizing:border-box;">
                            <div style="background:#e74c3c; width:38px; height:38px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0;">
                                <i class="fas fa-envelope-open-text" style="font-size:18px;"></i>
                            </div>
                            <div style="flex:1; min-width:0;">
                                <div class="rp-card-title" style="font-size:13px; font-weight:600; color:#c4453c; margin-bottom:2px;">${getPartnerName()}发的红包</div>
                                <div style="font-size:11px; color:#999; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">"${msg}"</div>
                            </div>
                        </div>
                    `;

                    setTimeout(() => {
                        const card = document.getElementById(rpId);
                        if (card && !card.dataset.bound) {
                            card.dataset.bound = "true";
                            card.onclick = function(e) {
                                e.stopPropagation();
                                openRedPacketEnvelope(amount, msg, card);
                            };
                        }
                    }, 50);
                }
            }
        });
    }

    // ========== 4. 拆红包的信封大弹窗 ==========
    function openRedPacketEnvelope(amount, msg, cardElement) {
        const modal = document.createElement('div');
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000000; display:flex; align-items:center; justify-content:center;";
        
        modal.innerHTML = `
            <div style="background:#e74c3c; width:280px; height:360px; border-radius:16px; box-shadow:0 12px 40px rgba(0,0,0,0.3); display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:30px 20px; box-sizing:border-box; color:#fff; position:relative; text-align:center;">
                <button id="env-close-btn" style="position:absolute; top:12px; right:14px; background:none; border:none; color:rgba(255,255,255,0.6); cursor:pointer; font-size:16px;"><i class="fas fa-times"></i></button>
                <div>
                    <div style="font-size:13px; opacity:0.8; margin-bottom:4px;">来自 ${getPartnerName()}</div>
                    <div style="font-size:15px; font-weight:500; line-height:1.4;">"${msg}"</div>
                </div>
                <button id="env-open-btn" style="width:75px; height:75px; border-radius:50%; background:#f1c40f; color:#333; border:3px solid #f39c12; font-size:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(0,0,0,0.2); outline:none;">拆</button>
                <div style="font-size:11px; opacity:0.6;">传讯互动功能模块</div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('env-close-btn').onclick = () => modal.remove();

        const openBtn = document.getElementById('env-open-btn');
        openBtn.onclick = function() {
            openBtn.style.transform = "scale(0.9)";
            openBtn.disabled = true;

            setTimeout(() => {
                balanceData.partnerBalance += amount;
                saveBalances();
                alert(`🎉 红包已被拆开！\n${getPartnerName()}的钱包已存入 ￥${amount.toFixed(2)}`);
                if (cardElement) {
                    cardElement.style.opacity = "0.6";
                    cardElement.querySelector('.rp-card-title').innerText = "红包已被拆开";
                }
                modal.remove();
            }, 300);
        };
    }

    // ========== 5. 自动启动循环检测 ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setInterval(scanAndRenderRedPackets, 500));
    } else {
        setInterval(scanAndRenderRedPackets, 500);
    }
})();
