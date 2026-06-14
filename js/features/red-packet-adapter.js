/**
 * 红包功能适配层 - 负责将你原汁原味的 red-packet.js 与传讯网站连接起来
 */
(function() {
    'use strict';

    // 1. 初始化余额数据
    if (typeof window.initTransferData === 'function') {
        window.initTransferData();
    }

    // 2. 桥接数据保存：原文件调用 window.throttledSaveData 时，自动存入 localforage
    window.throttledSaveData = function() {
        if (typeof localforage !== 'undefined' && window.transferData) {
            localforage.setItem('transfer_data', window.transferData).then(function() {
                console.log('红包余额与记录已安全存档');
            });
        }
    };

    // 从本地加载历史余额
    if (typeof localforage !== 'undefined') {
        localforage.getItem('transfer_data').then(function(val) {
            if (val) {
                window.transferData = val;
            }
        });
    }

    // 3. 桥接消息发送：原文件发送红包、对方发红包、退回时，调用 addMessage 插入聊天框
    window.addMessage = function(msgData) {
        var chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;

        var msgWrap = document.createElement('div');
        // 根据发送者渲染左边还是右边
        if (msgData.sender === 'user') {
            msgWrap.className = 'message-wrapper my-message';
            msgWrap.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:12px;';
        } else if (msgData.sender === 'partner') {
            msgWrap.className = 'message-wrapper partner-message';
            msgWrap.style.cssText = 'display:flex;justify-content:flex-start;margin-bottom:12px;';
        } else {
            // 系统通知提示
            msgWrap.className = 'message-wrapper system-message';
            msgWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:12px;';
            msgWrap.innerHTML = '<div style="background:rgba(0,0,0,0.05);color:#888;font-size:11px;padding:4px 12px;border-radius:12px;">' + msgData.text + '</div>';
            chatContainer.appendChild(msgWrap);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return;
        }

        // 渲染你原文件里非常精致的红包卡片
        var cardHtml = window.renderRedPacketMessage(msgData);
        
        msgWrap.innerHTML = cardHtml;
        chatContainer.appendChild(msgWrap);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // 给红包卡片绑定你原文件写好的点击弹出“拆/开红包”的事件
        var cardElement = msgWrap.querySelector('.red-packet-card');
        if (cardElement) {
            cardElement.onclick = function() {
                var rpId = cardElement.dataset.rpId;
                window.showRedPacketReceiveModal(rpId);
            };
        }
    };

    // 4. 全局重新渲染：【这里已为你修复完毕】
    window.renderMessages = function() {
        // 遍历聊天框中现有的红包，根据最新数据更新它们的状态
        document.querySelectorAll('.red-packet-card').forEach(function(card) {
            var rpId = card.dataset.rpId;
            if (window.transferData && window.transferData.records) {
                var record = window.transferData.records.find(function(r) { return r.id === rpId; });
                if (record) {
                    // 模拟生成一个新的模拟消息对象传给渲染函数
                    var mockMsg = {
                        id: rpId,
                        sender: record.from === 'me' ? 'user' : 'partner',
                        text: record.message,
                        redPacket: record
                    };
                    var newCardHtml = window.renderRedPacketMessage(mockMsg);
                    
                    // 安全地进行整块 HTML 替换
                    var tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newCardHtml;
                    var newCardElement = tempDiv.querySelector('.red-packet-card');
                    
                    if (newCardElement && card.parentNode) {
                        // 重新绑定点击事件，防止事件丢失
                        newCardElement.onclick = function() {
                            window.showRedPacketReceiveModal(rpId);
                        };
                        // 用新节点替换掉老节点
                        card.parentNode.replaceChild(newCardElement, card);
                    }
                }
            }
        });
    };

    // 5. 桥接声音与通知提示
    window.playSound = function(type) { console.log('播放提示音:', type); };
    window.showNotification = function(text, type) { console.log('全局通知:', text, type); };

    // 6. 核心自动化触发器：定时检测“对方给你发红包”与“红包过期”
    // 每 20 秒检查一次对方要不要给你发红包，以及有没有包过期
    setInterval(function() {
        if (typeof window.trySystemRedPacket === 'function') {
            window.trySystemRedPacket(); // 对方有概率主动给你发红包！
        }
        if (typeof window.checkRedPacketExpiry === 'function') {
            window.checkRedPacketExpiry(); // 检查24小时过期
        }
    }, 20000);

    // 每 1.5 秒检查一次，对方有没有把你发过去的pending红包给收了
    setInterval(function() {
        if (typeof window.tryCollectPendingRedPacket === 'function') {
            window.tryCollectPendingRedPacket();
        }
    }, 1500);

})();
