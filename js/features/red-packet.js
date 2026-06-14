/**
 * red-packet.js - 红包功能模块（节日检测 + 一小时低频触发终极版）
 */

(function () {
    'use strict';

    // ========== 1. 基础工具与变量定义 ==========
    function fmt(n) {
        return (n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function genId() {
        return 'rp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    function getPartnerName() {
        var pName = document.getElementById('partner-name');
        return pName ? pName.textContent.trim() : '对方';
    }

    var RP_SVG = '<svg width="36" height="44" viewBox="0 0 20 28" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="16" height="18" rx="2"/><path d="M2 8l8 6 8-6"/><circle cx="10" cy="14" r="2.5" fill="#fff" stroke="none"/></svg>';

    // 全局状态变量
    var defaultData = {
        myBalance: 100000,       
        systemBalance: 500000,   
        records: []              
    };
    window.transferData = Object.assign({}, defaultData);

    // 持久化保存与加载
    function loadTransferData() {
        if (typeof localforage !== 'undefined') {
            localforage.getItem('transfer_data').then(function(val) {
                if (val) window.transferData = val;
            });
        }
    }
    function saveTransferData() {
        if (typeof localforage !== 'undefined' && window.transferData) {
            localforage.setItem('transfer_data', window.transferData);
        }
    }
    loadTransferData();

    // ========== 2. 核心遮罩层控制 ==========
    function getOrCreateOverlay() {
        var overlay = document.getElementById('rp-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'rp-modal-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:none;justify-content:center;align-items:center;font-family:sans-serif;';
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function closeModal() {
        var overlay = document.getElementById('rp-modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.innerHTML = '';
        }
    }

    // ========== 3. 弹出“发红包/钱包”主弹窗 ==========
    window.showRedPacketSendModal = function() {
        var advModal = document.getElementById('advanced-modal');
        if (advModal) advModal.style.display = 'none';
        var modalOverlay = document.getElementById('modal-overlay') || document.querySelector('.modal-overlay');
        if (modalOverlay) modalOverlay.style.display = 'none';

        var overlay = getOrCreateOverlay();
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div style="background:#f7f7f7;width:90%;max-width:340px;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.25);animation: rpScaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
                <div style="background:#c4453c;color:#fff;padding:18px;position:relative;text-align:center;">
                    <span style="font-size:16px;font-weight:600;">给 ${getPartnerName()} 发红包</span>
                    <button id="rp-close-btn" style="position:absolute;right:16px;top:16px;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;opacity:0.8;line-height:1;">&times;</button>
                </div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                    <div style="background:#fff;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #eee;">
                        <span style="font-size:14px;color:#333;">金额 (元)</span>
                        <input id="rp-amount-input" type="number" step="0.01" placeholder="0.00" style="width:120px;text-align:right;border:none;outline:none;font-size:18px;font-weight:600;color:#c4453c;">
                    </div>
                    <div style="background:#fff;border-radius:10px;padding:12px 16px;border:1px solid #eee;">
                        <textarea id="rp-message-input" rows="2" style="width:100%;border:none;outline:none;resize:none;font-size:13px;color:#444;padding:0;font-family:inherit;" placeholder="恭喜发财，大吉大利！">恭喜发财，大吉大利！</textarea>
                    </div>
                    
                    <div style="display:flex; gap:8px; margin-top:-2px;">
                        <div id="rp-change-my-btn" style="flex:1; text-align:center; color:#555; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.03); padding:8px 4px; border-radius:8px; border:1px dashed rgba(0,0,0,0.08); transition:all 0.2s;">
                            我的余额<br>
                            <span style="color:#c4453c;font-weight:600;">¥${fmt(window.transferData.myBalance)}</span> <i class="fas fa-edit" style="font-size:9px;color:#bbb;"></i>
                        </div>
                        <div id="rp-change-system-btn" style="flex:1; text-align:center; color:#555; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.03); padding:8px 4px; border-radius:8px; border:1px dashed rgba(0,0,0,0.08); transition:all 0.2s;">
                            ${getPartnerName()}的余额<br>
                            <span style="color:#2b9348;font-weight:600;">¥${fmt(window.transferData.systemBalance)}</span> <i class="fas fa-edit" style="font-size:9px;color:#bbb;"></i>
                        </div>
                    </div>

                    <button id="rp-submit-btn" style="background:#c4453c;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.2s;box-shadow:0 4px 10px rgba(196,69,60,0.2);margin-top:4px;">塞钱进红包</button>
                </div>
            </div>
            <style>
                @keyframes rpScaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
                #rp-submit-btn:hover { background: #b03a32; }
                #rp-change-my-btn:hover, #rp-change-system-btn:hover { background: rgba(0,0,0,0.07); border-color: rgba(0,0,0,0.2); }
            </style>
        `;

        document.getElementById('rp-close-btn').onclick = closeModal;
        
        document.getElementById('rp-change-my-btn').onclick = function() {
            var currentYuan = (window.transferData.myBalance / 100).toFixed(2);
            var newUserInput = prompt("请输入你想自定义的【我的钱包余额】(元)：", currentYuan);
            if (newUserInput !== null) {
                var targetMoney = parseFloat(newUserInput);
                if (isNaN(targetMoney) || targetMoney < 0) { alert("请输入有效的数字金额！"); } else {
                    window.transferData.myBalance = Math.round(targetMoney * 100); saveTransferData(); window.showRedPacketSendModal();
                }
            }
        };

        document.getElementById('rp-change-system-btn').onclick = function() {
            var currentYuan = (window.transferData.systemBalance / 100).toFixed(2);
            var newUserInput = prompt(`请输入你想自定义的【${getPartnerName()}的钱包余额】(元)：`, currentYuan);
            if (newUserInput !== null) {
                var targetMoney = parseFloat(newUserInput);
                if (isNaN(targetMoney) || targetMoney < 0) { alert("请输入有效的数字金额！"); } else {
                    window.transferData.systemBalance = Math.round(targetMoney * 100); saveTransferData(); window.showRedPacketSendModal();
                }
            }
        };

        document.getElementById('rp-submit-btn').onclick = function() {
            var amtInput = document.getElementById('rp-amount-input').value;
            var msgInput = document.getElementById('rp-message-input').value || "恭喜发财，大吉大利！";
            var amountFen = Math.round(parseFloat(amtInput) * 100);
            
            if (isNaN(amountFen) || amountFen <= 0) { alert("请输入正确的金额"); return; }
            if (amountFen > window.transferData.myBalance) { alert("钱包余额不足！"); return; }

            window.transferData.myBalance -= amountFen;
            var rpId = genId();
            var newRecord = { id: rpId, type: 'send', sender: 'user', amount: amountFen, message: msgInput, time: new Date().toISOString(), isOpened: false };
            window.transferData.records.push(newRecord);
            saveTransferData();
            closeModal();
            appendRedPacketCard(newRecord);
        };
    };

    // ========== 4. 把红包卡片渲染塞进传讯聊天流 ==========
    function appendRedPacketCard(record) {
        var chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;

        var msgWrap = document.createElement('div');
        var isMe = record.sender === 'user';
        msgWrap.className = isMe ? 'message-wrapper my-message' : 'message-wrapper partner-message';
        msgWrap.style.cssText = 'display:flex; justify-content:' + (isMe ? 'flex-end' : 'flex-start') + '; margin-bottom:14px;';

        var bodyBg = record.isOpened ? 'background:#fbc4c1;' : 'background:#e64a3b;';

        msgWrap.innerHTML = `
            <div class="red-packet-card" data-rpid="${record.id}" style="width:230px; border-radius:10px; overflow:hidden; box-shadow:0 3px 10px rgba(0,0,0,0.08); cursor:pointer; transition:transform 0.15s; background:#fff; border:1px solid #eee;">
                <div class="rp-body" style="${bodyBg} padding:14px; color:#fff; display:flex; align-items:center; gap:12px;">
                    <div style="flex-shrink:0;">${RP_SVG}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:600; opacity:0.9;">红包</div>
                        <div style="font-size:22px; font-weight:700; line-height:1.2; margin:2px 0;"><span style="font-size:12px; font-weight:normal;">¥</span>${fmt(record.amount)}</div>
                        <div style="font-size:11px; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${record.message}</div>
                    </div>
                </div>
                <div style="padding:6px 14px; display:flex; justify-content:space-between; align-items:center; background:#fff;">
                    <span style="font-size:10px; color:#999;">传讯专属红包</span>
                    <span class="rp-status" style="font-size:10px; color:${record.isOpened ? '#999' : '#e64a3b'};">${record.isOpened ? '已被领取' : '未拆开'}</span>
                </div>
            </div>
        `;

        chatContainer.appendChild(msgWrap);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        msgWrap.querySelector('.red-packet-card').onclick = function() {
            window.showRedPacketReceiveModal(record.id);
        };

        if (isMe) { simulatePartnerAction(record); }
    }

    // ========== 5. 弹出“拆红包/查看详情”弹窗 ==========
    window.showRedPacketReceiveModal = function(rpId) {
        var record = window.transferData.records.find(function(r) { return r.id === rpId; });
        if (!record) return;

        var overlay = getOrCreateOverlay();
        overlay.style.display = 'flex';

        if (!record.isOpened) {
            var isFromMe = record.sender === 'user';
            
            overlay.innerHTML = `
                <div style="background:#c4453c; width:280px; height:380px; border-radius:16px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:30px 20px; box-shadow:0 15px 40px rgba(0,0,0,0.3); position:relative; text-align:center; color:#fff; animation: rpScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);">
                    <button id="rp-close-btn" style="position:absolute; right:14px; top:14px; background:none; border:none; color:#fff; font-size:20px; cursor:pointer; opacity:0.7;">&times;</button>
                    <div>
                        <div style="font-size:18px; font-weight:600; margin-bottom:4px;">${isFromMe ? '发送成功' : getPartnerName()}</div>
                        <div style="font-size:13px; opacity:0.8;">给你发了一个红包</div>
                        <div style="font-size:14px; font-style:italic; margin-top:20px; opacity:0.9; word-break:break-all;">"${record.message}"</div>
                    </div>
                    
                    ${isFromMe ? 
                        `<div style="font-size:12px; opacity:0.7; margin-bottom:4px;">等待 ${getPartnerName()} 拆开...</div>` :
                        `<button id="rp-open-btn" style="width:80px; height:80px; background:#f4c242; border:none; border-radius:50%; color:#333; font-size:24px; font-weight:700; cursor:pointer; box-shadow:0 6px 15px rgba(0,0,0,0.15); transition:transform 0.1s; display:flex; align-items:center; justify-content:center; margin-bottom:20px;">開</button>`
                    }
                    <div style="font-size:11px; opacity:0.6;">传讯专属加密钱包</div>
                </div>
            `;
            
            document.getElementById('rp-close-btn').onclick = closeModal;
            var openBtn = document.getElementById('rp-open-btn');
            if (openBtn) {
                openBtn.onclick = function() {
                    record.isOpened = true;
                    window.transferData.myBalance += record.amount;
                    saveTransferData();
                    updateCardUI(record);
                    closeModal();
                    alert("成功领取红包，已存入您的钱包余额！");
                };
            }
        } else {
            overlay.innerHTML = `
                <div style="background:#fff; width:280px; border-radius:16px; padding:24px; box-shadow:0 12px 30px rgba(0,0,0,0.15); text-align:center; position:relative; font-family:sans-serif; animation: rpScaleIn 0.2s;">
                    <button id="rp-close-btn" style="position:absolute; right:14px; top:14px; background:none; border:none; color:#999; font-size:20px; cursor:pointer;">&times;</button>
                    <div style="color:#c4453c; font-size:13px; font-weight:600; margin-bottom:14px;">红包详情</div>
                    <div style="font-size:14px; color:#666;">${record.sender === 'user' ? '发给 ' + getPartnerName() : getPartnerName() + ' 发出'}</div>
                    <div style="font-size:32px; font-weight:700; color:#333; margin:10px 0;"><span style="font-size:16px; font-weight:normal;">¥</span>${fmt(record.amount)}</div>
                    <div style="font-size:13px; color:#888; background:#f7f7f7; padding:8px 12px; border-radius:8px; display:inline-block; margin-top:6px;">${record.message}</div>
                    <div style="border-top:1px dashed #eee; margin-top:20px; padding-top:10px; font-size:11px; color:#aaa;">已被领取 · 交易完成</div>
                </div>
            `;
            document.getElementById('rp-close-btn').onclick = closeModal;
        }
    };

    function updateCardUI(record) {
        var card = document.querySelector(`[data-rpid="${record.id}"]`);
        if (card) {
            card.querySelector('.rp-body').style.background = '#fbc4c1';
            var status = card.querySelector('.rp-status');
            if (status) { status.textContent = '已被领取'; status.style.color = '#999'; }
        }
    }

    // ========== 6. 自动化闭环互动 ==========
    function simulatePartnerAction(record) {
        var indicator = document.getElementById('typing-indicator');
        setTimeout(function() { if (indicator) indicator.style.display = 'block'; }, 2000);

        setTimeout(function() {
            if (indicator) indicator.style.display = 'none';
            record.isOpened = true;
            window.transferData.systemBalance += record.amount;
            saveTransferData();
            updateCardUI(record);

            var chatContainer = document.getElementById('chat-container');
            if (chatContainer) {
                var replyWrap = document.createElement('div');
                replyWrap.className = 'message-wrapper partner-message';
                replyWrap.style.cssText = 'display:flex;justify-content:flex-start;margin-bottom:14px;';
                replyWrap.innerHTML = `
                    <div style="background:#fff; padding:10px 14px; border-radius:12px; max-width:75%; box-shadow:0 2px 6px rgba(0,0,0,0.05); font-size:14px; color:#333; line-height:1.5;">
                        ✨ <b>${getPartnerName()}</b> 拆开了你的红包：<br>
                        “谢谢你发给我的专属红包。我收下了”
                    </div>
                `;
                chatContainer.appendChild(replyWrap);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 4500);
    }

    // ========== 7. 【核心调整】特殊节日适配与一小时低频触发系统 ==========
    setInterval(function() {
        // 降低触发概率：每个小时有 25% 的概率扔骰子成功（这样既有惊喜，又不会泛滥）
        if (Math.random() > 0.25) return;

        var now = new Date();
        var month = now.getMonth() + 1;
        var date = now.getDate();

        // 初始化基础变量
        var chosenAmount = 0;
        var festivalMsg = "给你一点小惊喜";

        // 判断是否为特殊节日
        if (month === 2 && date === 14) { 
            // 1. 情人节
            var fAmounts = [52000, 131400]; // 520.00元 或 1314.00元
            chosenAmount = fAmounts[Math.floor(Math.random() * fAmounts.length)];
            festivalMsg = `情人节快乐，只想把最好的都给你，希望你每天都开心`;
        } else if ((month === 12 && date === 31) || (month === 1 && date === 1)) {
            // 2. 跨年 / 元旦
            var fAmounts = [100000]; // 1000元
            chosenAmount = fAmounts[Math.floor(Math.random() * fAmounts.length)];
            festivalMsg = `新年快乐`;
        } else {
            // 3. 其他非节日时候（日常随机/特殊双池）
            var normalAmounts = [520, 1314, 999]; // 5.20, 13.14, 9.99
            chosenAmount = normalAmounts[Math.floor(Math.random() * normalAmounts.length)];
        }

        // 检查对方是否有足够的余额扣除
        if (window.transferData.systemBalance < chosenAmount) return;

        // 执行发红包逻辑
        window.transferData.systemBalance -= chosenAmount;
        var rpId = genId();
        var newRecord = {
            id: rpId,
            type: 'receive',
            sender: 'partner',
            amount: chosenAmount,
            message: festivalMsg,
            time: now.toISOString(),
            isOpened: false
        };
        window.transferData.records.push(newRecord);
        saveTransferData();

        // 渲染卡片
        appendRedPacketCard(newRecord);

    }, 600000); // 彻底改为 600000 毫秒（=10分钟）检测一次

})();
