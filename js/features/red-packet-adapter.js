/**
 * 红包功能适配层 - 彻底解决高级弹窗黑屏与堆叠Bug版
 */
(function() {
    'use strict';

    // ==========================================
    // 【核心修复】拦截并清空高级功能弹窗的影响
    // ==========================================
    var originalShowModal = window.showRedPacketSendModal;
    if (typeof originalShowModal === 'function') {
        window.showRedPacketSendModal = function() {
            // 1. 强行隐藏高级功能弹窗
            var advModal = document.getElementById('advanced-modal');
            if (advModal) advModal.style.display = 'none';

            // 2. 强行寻找原网页所有可能的全局大黑色遮罩层，直接从网页上移除（防止重叠变黑）
            var modalOverlay = document.getElementById('modal-overlay') || document.querySelector('.modal-overlay');
            if (modalOverlay) modalOverlay.style.display = 'none';

            // 3. 清理可能残存的旧红包遮罩（连点导致的Bug）
            var existingRpOverlay = document.getElementById('rp-modal-overlay');
            if (existingRpOverlay) existingRpOverlay.remove();

            // 4. 调用原文件原本的打开弹窗函数
            originalShowModal();

            // 5. 【终极保底】在红包弹窗出来后的 100 毫秒，再次强行把非红包的黑背景全部隐藏
            setTimeout(function() {
                if (modalOverlay) modalOverlay.style.display = 'none';
                // 确保红包自己的遮罩是显示的
                var rpOverlay = document.getElementById('rp-modal-overlay');
                if (rpOverlay) {
                    rpOverlay.style.display = 'flex';
                }
            }, 100);
        };
    }

    // ==========================================
    // 以下为你原本正确的桥接逻辑，保持完整
    // ==========================================
    if (typeof window.initTransferData === 'function') {
        window.initTransferData();
    }

    window.throttledSaveData = function() {
        if (typeof localforage !== 'undefined' && window.transferData) {
            localforage.setItem('transfer_data', window.transferData);
        }
    };

    if (typeof localforage !== 'undefined') {
        localforage.getItem('transfer_data').then(function(val) {
            if (val) window.transferData = val;
        });
    }

    window.addMessage = function(msgData) {
        var chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;

        var msgWrap = document.createElement('div');
        if (msgData.sender === 'user') {
            msgWrap.className = 'message-wrapper my-message';
            msgWrap.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:12px;';
        } else if (msgData.sender === 'partner') {
            msgWrap.className = 'message-wrapper partner-message';
            msgWrap.style.cssText = 'display:flex;justify-content:flex-start;margin-bottom:12px;';
        } else {
            msgWrap.className = 'message-wrapper system-message';
            msgWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:12px;';
            msgWrap.innerHTML = '<div style="background:rgba(0,0,0,0.05);color:#888;font-size:11px;padding:4px 12px;border-radius:12px;">' + msgData.text + '</div>';
            chatContainer.appendChild(msgWrap);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return;
        }

        var cardHtml = window.renderRedPacketMessage(msgData);
        msgWrap.innerHTML = cardHtml;
        chatContainer.appendChild(msgWrap);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        var cardElement = msgWrap.querySelector('.red-packet-card');
        if (cardElement) {
            cardElement.onclick = function() {
                window.showRedPacketReceiveModal(cardElement.dataset.rpId);
            };
        }
    };

    window.renderMessages = function() {
        document.querySelectorAll('.red-packet-card').forEach(function(card) {
            var rpId = card.dataset.rpId;
            if (window.transferData && window.transferData.records) {
                var record = window.transferData.records.find(function(r) { return r.id === rpId; });
                if (record) {
                    var mockMsg = { id: rpId, sender: record.from === 'me' ? 'user' : 'partner', text: record.message, redPacket: record };
                    var newCardHtml = window.renderRedPacketMessage(mockMsg);
                    
                    var tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newCardHtml;
                    var newCardElement = tempDiv.querySelector('.red-packet-card');
                    
                    if (newCardElement && card.parentNode) {
                        newCardElement.onclick = function() {
                            window.showRedPacketReceiveModal(rpId);
                        };
                        card.parentNode.replaceChild(newCardElement, card);
                    }
                }
            }
        });
    };

    window.playSound = function(type) { console.log('播放提示音:', type); };
    window.showNotification = function(text, type) { console.log('通知:', text); };

    setInterval(function() {
        if (typeof window.trySystemRedPacket === 'function') window.trySystemRedPacket();
        if (typeof window.checkRedPacketExpiry === 'function') window.checkRedPacketExpiry();
    }, 20000);

    setInterval(function() {
        if (typeof window.tryCollectPendingRedPacket === 'function') window.tryCollectPendingRedPacket();
    }, 1500);

})();
