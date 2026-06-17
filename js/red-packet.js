/**
 * red-packet.js - 红包功能模块
 * 适配版：专为本项目 core.js 定制
 *
 * 使用方法：
 * 1. 把本文件放到 js/ 目录下
 * 2. 在 index.html 末尾 </body> 前加：
 *    <script src="js/red-packet.js"></script>
 * 3. 在你想要的入口按钮上调用 window.showRedPacketSendModal()
 *    例如在 collapsed-extras-panel 里加一个按钮即可
 */

(function () {
    'use strict';

    // =============================================
    // 工具函数
    // =============================================

    /** 金额格式化：分 -> 元，带千分位 */
    function fmt(n) {
        return (n / 100).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /** 生成唯一 ID */
    function genId() {
        return 'rp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /** 安全获取对方昵称（适配本项目 settings 对象） */
    function getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '对方';
    }

    /** 安全获取我的昵称 */
    function getMyName() {
        return (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
    }

    // =============================================
    // 数据存储（适配本项目 localforage + getStorageKey）
    // =============================================

    /**
     * 初始化红包数据。
     * 本项目用 localforage + getStorageKey，所以 transferData 存在内存里，
     * 通过独立的 saveRPData / loadRPData 与 localforage 同步。
     */
    if (typeof window.transferData === 'undefined' || window.transferData === null) {
        window.transferData = { myBalance: 100000, systemBalance: 100000, records: [] };
    }

    window.initTransferData = function () {
        if (!window.transferData) {
            window.transferData = { myBalance: 100000, systemBalance: 100000, records: [] };
        }
        if (!window.transferData.records) window.transferData.records = [];
        if (typeof window.transferData.myBalance !== 'number') window.transferData.myBalance = 100000;
        if (typeof window.transferData.systemBalance !== 'number') window.transferData.systemBalance = 100000;
    };

    /** 保存红包数据到 localforage（复用本项目存储体系） */
    function saveRPData() {
        try {
            // 优先用项目的 localforage + APP_PREFIX（与本项目存储体系一致）
            if (typeof localforage !== 'undefined' && typeof APP_PREFIX !== 'undefined') {
                localforage.setItem(APP_PREFIX + 'redPacketData', window.transferData).catch(function (e) {
                    console.warn('[RedPacket] localforage 保存失败:', e);
                });
            } else {
                // 降级到 localStorage
                localStorage.setItem('rp_transferData', JSON.stringify(window.transferData));
            }
        } catch (e) {
            console.warn('[RedPacket] 保存失败:', e);
        }
        // 同时触发本项目的 throttledSaveData（保存聊天消息等）
        if (typeof throttledSaveData === 'function') throttledSaveData();
    }

    /** 从 localforage 加载红包数据 */
    function loadRPData(callback) {
        try {
            if (typeof localforage !== 'undefined' && typeof APP_PREFIX !== 'undefined') {
                localforage.getItem(APP_PREFIX + 'redPacketData').then(function (val) {
                    if (val && typeof val === 'object') {
                        window.transferData = val;
                        window.initTransferData(); // 补全缺失字段
                    }
                    if (callback) callback();
                }).catch(function () {
                    if (callback) callback();
                });
            } else {
                // 降级到 localStorage
                try {
                    var raw = localStorage.getItem('rp_transferData');
                    if (raw) window.transferData = JSON.parse(raw);
                    window.initTransferData();
                } catch (e) {}
                if (callback) callback();
            }
        } catch (e) {
            if (callback) callback();
        }
    }

    // 页面加载时读取红包数据
    // 等待本项目 loadData 完成后再执行（监听 DOMContentLoaded 或延迟）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(function () { loadRPData(); }, 800);
        });
    } else {
        setTimeout(function () { loadRPData(); }, 800);
    }

    // =============================================
    // 节日检测
    // =============================================

    function getFestivals() {
        var now = new Date();
        var m = now.getMonth() + 1;
        var d = now.getDate();
        var festivals = [
            { month: 1,  day: 1,  name: '元旦',   messages: ['新年快乐!', '元旦快乐', '新的一年加油~', '万事如意'] },
            { month: 2,  day: 14, name: '情人节', messages: ['情人节快乐', '永远爱你', '你是我最珍贵的', '甜蜜每一天'] },
            { month: 3,  day: 8,  name: '妇女节', messages: ['女神节快乐', '你是最美的', '做自己的女王'] },
            { month: 5,  day: 1,  name: '劳动节', messages: ['劳动节快乐', '辛苦了~', '好好休息一下吧'] },
            { month: 5,  day: 20, name: '520',    messages: ['520快乐', '我爱你', '一生一世', '你是我心中唯一'] },
            { month: 6,  day: 1,  name: '儿童节', messages: ['儿童节快乐', '永远做个快乐的小孩', '今天你最大~'] },
            { month: 7,  day: 7,  name: '七夕',   messages: ['七夕快乐', '星河万里不如你', '鹊桥相会', '愿得一心人'] },
            { month: 10, day: 1,  name: '国庆节', messages: ['国庆快乐', '放假快乐~', '祖国生日快乐'] },
            { month: 11, day: 11, name: '双十一', messages: ['双十一快乐', '购物愉快~', '清空购物车'] },
            { month: 12, day: 24, name: '平安夜', messages: ['平安夜快乐', '平平安安', '圣诞前夕温暖你'] },
            { month: 12, day: 25, name: '圣诞节', messages: ['圣诞快乐', 'Merry Christmas!', '铃儿响叮当'] },
            { month: 12, day: 31, name: '跨年',   messages: ['跨年快乐', '一起迎接新年~', '辞旧迎新'] }
        ];
        return festivals.filter(function (f) { return f.month === m && f.day === d; });
    }

    // =============================================
    // 核心：把红包消息插入本项目的消息流
    // =============================================

    /**
     * 适配本项目 addMessage()。
     * core.js 的 addMessage 直接 push 到 messages 数组并调用 renderMessages，
     * 但它不认识 type:'red-packet'，所以我们在 renderMessages 完成后
     * 再把红包卡片 DOM 注入到对应的气泡里。
     */
    function addRedPacketMessage(msgObj) {
        // 确保必要字段
        msgObj.id = msgObj.id || genId();
        msgObj.timestamp = msgObj.timestamp || new Date();
        msgObj.status = msgObj.status || 'sent';
        msgObj.type = 'red-packet';
        // text 作为普通文字回退（core.js 会渲染这个）
        msgObj.text = msgObj.text || '【红包】' + (msgObj.redPacket ? msgObj.redPacket.message : '');
        msgObj.favorited = false;
        msgObj.note = null;

        // 用本项目的 addMessage 插入（会自动存档、渲染）
        if (typeof addMessage === 'function') {
            addMessage(msgObj);
        }

        // addMessage → renderMessages 是同步的，渲染完后立刻替换气泡内容
        // 用 requestAnimationFrame 确保 DOM 已更新
        requestAnimationFrame(function () {
            injectRedPacketCard(msgObj);
        });
    }

    /**
     * 在 DOM 里找到对应消息 wrapper，把气泡内容替换成红包卡片。
     * core.js 用 wrapper.dataset.id / wrapper.dataset.msgId 标记消息。
     */
    function injectRedPacketCard(msg) {
        var id = String(msg.id);
        var wrapper = document.querySelector('[data-id="' + id + '"], [data-msg-id="' + id + '"]');
        if (!wrapper) return;

        var bubble = wrapper.querySelector('.message-sent, .message-received');
        if (!bubble) return;

        // 生成红包卡片 HTML
        var cardHtml = renderRedPacketCard(msg);
        bubble.innerHTML = cardHtml;
        // 去掉气泡默认背景/padding，让卡片自己控制样式
        bubble.style.cssText = 'background:none!important;padding:0!important;border:none!important;box-shadow:none!important;max-width:260px;';

        // 绑定点击事件
        var card = bubble.querySelector('.rp-card');
        if (card) {
            card.addEventListener('click', function () {
                var rpId = card.dataset.rpId;
                window.showRedPacketReceiveModal(rpId);
            });
        }
    }

    /**
     * renderMessages 结束后重新注入所有红包卡片。
     * 因为 renderMessages 会清空 innerHTML 重建 DOM，所以每次渲染后需重注入。
     * 我们用猴子补丁（monkey-patch）包裹原始 renderMessages。
     */
    var _rpPatchApplied = false;
    function patchRenderMessages() {
        if (_rpPatchApplied) return;
        // renderMessages 定义在 core.js 的闭包里，通过 window 暴露出来
        // 检查方式：core.js 末尾通常会把它挂到 window，如果没有我们等待
        if (typeof window.renderMessages !== 'function') {
            setTimeout(patchRenderMessages, 300);
            return;
        }
        var _orig = window.renderMessages;
        window.renderMessages = function () {
            _orig.apply(this, arguments);
            requestAnimationFrame(reInjectAllRedPackets);
        };
        _rpPatchApplied = true;
    }

    /** 遍历所有消息，重新注入红包卡片 */
    function reInjectAllRedPackets() {
        if (typeof messages === 'undefined') return;
        messages.forEach(function (msg) {
            if (msg.type === 'red-packet') {
                injectRedPacketCard(msg);
            }
        });
    }

    // 等 renderMessages 暴露到 window 后再打补丁
    setTimeout(patchRenderMessages, 500);

    // =============================================
    // 红包卡片 HTML 渲染
    // =============================================

    function renderRedPacketCard(msg) {
        var rp = msg.redPacket || {};
        var recordId = rp.id || msg.id;
        var amount = rp.amount || 0;
        var message = rp.message || msg.text || '恭喜发财';
        var status = rp.status || 'pending';

        // 查找最新记录状态
        window.initTransferData();
        var latest = (window.transferData.records || []).find(function (r) { return r.id === recordId; });
        if (latest) {
            status = latest.status;
            amount = latest.amount;
            message = latest.message || message;
        }

        var isOpened = status !== 'pending';
        var isSentByMe = msg.sender === 'user';

        // 状态标签
        var statusHtml;
        if (status === 'pending') {
            statusHtml = '<span style="display:flex;align-items:center;gap:4px;font-weight:500;color:#e85d50;font-size:11px;"><i class="fas fa-clock" style="font-size:10px;"></i>' + (isSentByMe ? '对方待领取' : '待领取') + '</span>';
        } else if (status === 'received') {
            statusHtml = '<span style="display:flex;align-items:center;gap:4px;font-weight:500;color:#2ed573;font-size:11px;"><i class="fas fa-check-circle" style="font-size:10px;"></i>已领取</span>';
        } else {
            statusHtml = '<span style="display:flex;align-items:center;gap:4px;font-weight:500;color:#bbb;font-size:11px;"><i class="fas fa-undo" style="font-size:10px;"></i>已退回</span>';
        }

        // 时间
        var timeStr = '';
        if (msg.timestamp) {
            var ts = new Date(msg.timestamp);
            var diff = Date.now() - ts;
            if (diff < 60000) {
                timeStr = '刚刚';
            } else if (diff < 3600000) {
                timeStr = Math.floor(diff / 60000) + '分钟前';
            } else if (diff < 86400000) {
                timeStr = ts.getHours().toString().padStart(2, '0') + ':' + ts.getMinutes().toString().padStart(2, '0');
            } else {
                timeStr = (ts.getMonth() + 1) + '/' + ts.getDate();
            }
        }

        var bodyBg = isOpened
            ? 'background:linear-gradient(160deg,#d0c8c8,#b8b0b0);'
            : 'background:linear-gradient(160deg,#c4453c,#9e3730);';

        var iconColor = isOpened ? '#aaa' : '#fff';
        var rpIcon = '<svg width="34" height="40" viewBox="0 0 20 28" fill="none" stroke="' + iconColor + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2" y="6" width="16" height="18" rx="2"/>' +
            '<path d="M2 8l8 6 8-6"/>' +
            '<circle cx="10" cy="14" r="2.5" fill="' + iconColor + '" stroke="none"/>' +
            '</svg>';

        return '<div class="rp-card" data-rp-id="' + recordId + '" style="width:240px;border-radius:8px;overflow:hidden;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,0.18);transition:transform 0.15s,box-shadow 0.15s;" ' +
            'onmouseenter="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 20px rgba(0,0,0,0.22)\'" ' +
            'onmouseleave="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'0 3px 12px rgba(0,0,0,0.18)\'">' +
            // 红色主体
            '<div style="' + bodyBg + 'padding:14px 14px 16px;display:flex;align-items:center;gap:12px;">' +
                '<div style="flex-shrink:0;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">' + rpIcon + '</div>' +
                '<div style="flex:1;min-width:0;color:#fff;">' +
                    '<div style="font-size:12px;font-weight:600;opacity:0.85;margin-bottom:2px;">红包</div>' +
                    '<div style="font-size:22px;font-weight:700;line-height:1.2;color:' + (isOpened ? '#ccc' : '#fff') + ';">' +
                        '<span style="font-size:13px;font-weight:500;">¥</span>' + fmt(amount) +
                    '</div>' +
                    '<div style="font-size:11px;opacity:0.75;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + message + '</div>' +
                '</div>' +
            '</div>' +
            // 底部状态栏
            '<div style="background:#fff;padding:7px 14px;display:flex;align-items:center;justify-content:space-between;border-top:1px dashed rgba(196,69,60,0.25);">' +
                statusHtml +
                '<span style="color:#ccc;font-size:11px;">' + timeStr + '</span>' +
            '</div>' +
        '</div>';
    }

    // =============================================
    // 发红包主菜单弹窗
    // =============================================

    window.showRedPacketSendModal = function () {
        window.initTransferData();

        var overlay = _createOverlay('flex-end');
        overlay.innerHTML =
            '<div style="width:100%;max-width:420px;background:var(--primary-bg,#fff);border-radius:20px 20px 0 0;padding:0;animation:rpSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);">' +
                _drawerHandle() +
                '<div style="padding:16px 20px 12px;font-size:17px;font-weight:700;text-align:center;color:var(--text-primary,#1a1a1a);">红包</div>' +
                '<div style="padding:0 20px 28px;display:flex;gap:16px;">' +
                    // 发红包
                    '<button id="rp-menu-send" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;border:1.5px solid var(--border-color,#e8e8e8);border-radius:16px;background:var(--secondary-bg,#f5f5f5);cursor:pointer;">' +
                        '<div style="width:48px;height:48px;border-radius:50%;background:#c4453c;display:flex;align-items:center;justify-content:center;">' +
                            '<svg width="24" height="28" viewBox="0 0 20 28" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="16" height="18" rx="2"/><path d="M2 8l8 6 8-6"/><circle cx="10" cy="14" r="2" fill="#fff" stroke="none"/></svg>' +
                        '</div>' +
                        '<span style="font-size:13px;font-weight:600;color:var(--text-primary,#1a1a1a);">发红包</span>' +
                    '</button>' +
                    // 余额设置
                    '<button id="rp-menu-balance" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;border:1.5px solid var(--border-color,#e8e8e8);border-radius:16px;background:var(--secondary-bg,#f5f5f5);cursor:pointer;">' +
                        '<div style="width:48px;height:48px;border-radius:50%;background:var(--accent-color,#b8a9c9);display:flex;align-items:center;justify-content:center;">' +
                            '<i class="fas fa-wallet" style="color:#fff;font-size:20px;"></i>' +
                        '</div>' +
                        '<span style="font-size:13px;font-weight:600;color:var(--text-primary,#1a1a1a);">余额设置</span>' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        _injectRpStyles();

        overlay.querySelector('#rp-menu-send').onclick = function () {
            overlay.remove();
            _showSendForm();
        };
        overlay.querySelector('#rp-menu-balance').onclick = function () {
            overlay.remove();
            window.showTransferBalanceSettings();
        };
    };

    // =============================================
    // 发红包表单
    // =============================================

    function _showSendForm() {
        window.initTransferData();
        var festivals = getFestivals();
        var festival = festivals.length > 0 ? festivals[0] : null;

        var quickMsgs = festival
            ? festival.messages
            : ['恭喜发财', '新年快乐', '大吉大利', '好运连连', '辛苦了~', '买杯奶茶'];
        var defaultMsg = festival ? festival.messages[0] : '';

        var overlay = _createOverlay('flex-end');
        overlay.innerHTML =
            '<div style="width:100%;max-width:420px;background:var(--primary-bg,#fff);border-radius:20px 20px 0 0;padding:0;animation:rpSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);max-height:88vh;overflow-y:auto;">' +
                _drawerHandle() +
                '<div style="padding:14px 20px 10px;font-size:17px;font-weight:700;text-align:center;color:var(--text-primary,#1a1a1a);">' +
                    (festival
                        ? '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:#fdecea;color:#c4453c;font-size:12px;font-weight:600;"><i class="fas fa-gift"></i>' + festival.name + '</span>'
                        : '发红包') +
                '</div>' +
                '<div style="padding:0 20px 28px;">' +
                    // 金额输入
                    '<div style="text-align:center;padding:20px 0 24px;">' +
                        '<div style="display:flex;align-items:baseline;justify-content:center;gap:2px;">' +
                            '<span style="font-size:26px;font-weight:500;color:var(--text-primary,#1a1a1a);">¥</span>' +
                            '<input type="number" placeholder="0.00" step="0.01" min="0.01" id="rp-amount" ' +
                            'style="width:180px;font-size:40px;font-weight:700;border:none;outline:none;text-align:center;background:none;color:var(--text-primary,#1a1a1a);border-bottom:2px solid var(--border-color,#e8e8e8);padding-bottom:4px;" />' +
                        '</div>' +
                        '<div style="margin-top:8px;font-size:12px;color:var(--text-secondary,#888);">余额 ¥' + fmt(window.transferData.myBalance) + '</div>' +
                    '</div>' +
                    // 留言
                    '<input type="text" id="rp-msg" placeholder="添加留言..." maxlength="30" value="' + defaultMsg + '" ' +
                    'style="width:100%;height:42px;border:1.5px solid var(--border-color,#e8e8e8);border-radius:10px;padding:0 14px;font-size:14px;outline:none;background:var(--secondary-bg,#f5f5f5);color:var(--text-primary,#1a1a1a);box-sizing:border-box;" />' +
                    // 快捷留言
                    '<div id="rp-quick" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">' +
                        quickMsgs.map(function (m, i) {
                            var active = i === 0 ? 'border-color:var(--accent-color,#b8a9c9);color:var(--accent-color,#b8a9c9);background:rgba(184,169,201,0.08);' : '';
                            return '<span data-msg="' + m + '" style="padding:6px 14px;border-radius:20px;border:1px solid var(--border-color,#e8e8e8);background:var(--secondary-bg,#f5f5f5);font-size:12px;color:var(--text-secondary,#888);cursor:pointer;transition:all 0.15s;' + active + '">' + m + '</span>';
                        }).join('') +
                    '</div>' +
                    // 发送按钮
                    '<button id="rp-send-btn" disabled ' +
                    'style="width:100%;height:48px;border:none;border-radius:12px;background:#c4453c;color:#fff;font-size:16px;font-weight:700;cursor:pointer;margin-top:22px;opacity:0.4;transition:opacity 0.2s;">发送红包</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var amtEl = overlay.querySelector('#rp-amount');
        var msgEl = overlay.querySelector('#rp-msg');
        var btnEl = overlay.querySelector('#rp-send-btn');

        // 快捷留言
        overlay.querySelectorAll('#rp-quick span').forEach(function (s) {
            s.onclick = function () {
                overlay.querySelectorAll('#rp-quick span').forEach(function (x) {
                    x.style.borderColor = 'var(--border-color,#e8e8e8)';
                    x.style.color = 'var(--text-secondary,#888)';
                    x.style.background = 'var(--secondary-bg,#f5f5f5)';
                });
                s.style.borderColor = 'var(--accent-color,#b8a9c9)';
                s.style.color = 'var(--accent-color,#b8a9c9)';
                s.style.background = 'rgba(184,169,201,0.08)';
                msgEl.value = s.dataset.msg;
            };
        });

        // 金额校验
        amtEl.oninput = function () {
            var val = parseFloat(amtEl.value);
            var ok = val > 0 && Math.round(val * 100) <= window.transferData.myBalance;
            btnEl.disabled = !ok;
            btnEl.style.opacity = ok ? '1' : '0.4';
            btnEl.style.cursor = ok ? 'pointer' : 'default';
        };
        setTimeout(function () { amtEl.focus(); }, 80);

        // 发送
        btnEl.onclick = function () {
            var amount = Math.round(parseFloat(amtEl.value) * 100);
            if (!amount || amount <= 0 || amount > window.transferData.myBalance) return;

            var message = msgEl.value.trim() || '恭喜发财';
            window.transferData.myBalance -= amount;

            var record = {
                id: genId(),
                from: 'me',
                to: 'system',
                amount: amount,
                message: message,
                status: 'pending',
                createdAt: Date.now()
            };
            window.transferData.records.push(record);
            saveRPData();

            // 插入到聊天（我方发送）
            addRedPacketMessage({
                id: record.id,
                sender: 'user',
                text: '【红包】' + message,
                timestamp: new Date(),
                type: 'red-packet',
                redPacket: record
            });

            if (typeof playSound === 'function') playSound('send');
            if (typeof showNotification === 'function') showNotification('红包已发送 ✦', 'success');
            overlay.remove();

            // 系统延迟处理
            _scheduleSystemResponse(record);
        };
    }

    /** 系统自动处理用户发的红包 */
    function _scheduleSystemResponse(record) {
        var delayMin = (typeof settings !== 'undefined' && settings.replyDelayMin) ? settings.replyDelayMin : 3000;
        var delayMax = (typeof settings !== 'undefined' && settings.replyDelayMax) ? settings.replyDelayMax : 7000;
        var delay = delayMin + Math.random() * (delayMax - delayMin);

        setTimeout(function () {
            window.initTransferData();
            var r = (window.transferData.records || []).find(function (x) { return x.id === record.id; });
            if (!r || r.status !== 'pending') return;

            // 20% 退回
            if (Math.random() < 0.2) {
                r.status = 'returned';
                r.returnedAt = Date.now();
                window.transferData.myBalance += r.amount;
                saveRPData();
                // 刷新现有红包卡片
                if (typeof renderMessages === 'function') renderMessages();
                if (typeof showNotification === 'function') showNotification('红包已被退回', 'info');
                return;
            }

            // 80% → 70% 立即收取，10% 保持 pending 待后续收取
            if (Math.random() < 0.875) { // 0.7/0.8
                r.status = 'received';
                r.receivedAt = Date.now();
                window.transferData.systemBalance += r.amount;
                saveRPData();
                // 对方发回一条"已领取"的红包卡片
                addRedPacketMessage({
                    id: 'rp_recv_' + Date.now(),
                    sender: 'partner',
                    text: '【红包】已领取',
                    timestamp: new Date(),
                    type: 'red-packet',
                    redPacket: r
                });
                if (typeof playSound === 'function') playSound('message');
            }
            // 剩余 10% 保持 pending，由 tryCollectPendingRedPacket 后续处理
        }, delay);
    }

    // =============================================
    // 领取红包弹窗
    // =============================================

    window.showRedPacketReceiveModal = function (recordId) {
        window.initTransferData();

        var record = (window.transferData.records || []).find(function (r) { return r.id === recordId; });
        if (!record) {
            if (typeof showNotification === 'function') showNotification('红包不存在', 'warning');
            return;
        }

        // 自己发的 pending 红包不能自己领
        if (record.from === 'me' && record.status === 'pending') {
            if (typeof showNotification === 'function') showNotification('自己发的红包无法领取', 'info');
            return;
        }

        var overlay = _createOverlay('center');
        var isPending  = record.status === 'pending';
        var isReceived = record.status === 'received';
        var isReturned = record.status === 'returned';
        var senderName = record.from === 'me' ? getMyName() : getPartnerName();
        var isSystemSender = record.from === 'system';

        var panelBg  = isPending  ? '#c4453c' : '#ccc';
        var btnStyle = isPending
            ? 'background:#ffd700;color:#c4453c;box-shadow:0 2px 10px rgba(255,215,0,0.5);cursor:pointer;'
            : 'background:#ddd;color:#999;cursor:default;';
        var btnText  = isPending ? '開' : (isReceived ? '已领取' : '已退回');
        var titleTxt = isReturned ? '已过期' : record.message;
        var titleClr = isReturned ? '#aaa' : (isPending ? '#ffd700' : '#ffd700');

        var returnBtnHtml = (isPending && isSystemSender)
            ? '<button id="rp-return" style="margin-top:14px;padding:10px 24px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff6b35,#f7931e);color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(255,107,53,0.4);">退回红包</button>'
            : '';

        overlay.innerHTML =
            '<div id="rp-panel" style="text-align:center;border-radius:16px;overflow:hidden;width:240px;background:' + panelBg + ';animation:rpPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1);">' +
                '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#ffd700 20%,#ffd700 80%,transparent);"></div>' +
                '<div style="padding:32px 18px 22px;display:flex;flex-direction:column;align-items:center;gap:8px;">' +
                    '<div style="width:48px;height:48px;border-radius:50%;background:var(--accent-color,#b8a9c9);border:2px solid rgba(255,215,0,0.5);display:flex;align-items:center;justify-content:center;">' +
                        '<i class="fas fa-heart" style="color:#fff;font-size:18px;"></i>' +
                    '</div>' +
                    '<div style="font-size:13px;color:rgba(255,255,255,0.85);">' + senderName + ' 发来的红包</div>' +
                    '<div style="font-size:17px;font-weight:700;color:' + titleClr + ';">' + titleTxt + '</div>' +
                '</div>' +
                '<div style="padding:24px 18px 32px;background:' + (isPending ? '#c4453c' : '#bbb') + ';display:flex;flex-direction:column;align-items:center;">' +
                    '<button id="rp-open" style="width:64px;height:64px;border-radius:50%;font-size:20px;font-weight:700;border:none;transition:all 0.15s;' + btnStyle + '">' + btnText + '</button>' +
                    returnBtnHtml +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        _injectRpStyles();

        // 退回按钮
        var returnBtn = overlay.querySelector('#rp-return');
        if (returnBtn) {
            returnBtn.onclick = function () {
                window.transferData.systemBalance += record.amount;
                record.status = 'returned';
                record.returnedAt = Date.now();
                saveRPData();
                if (typeof showNotification === 'function') showNotification('红包已退回', 'info');
                if (typeof renderMessages === 'function') renderMessages();
                overlay.remove();
            };
        }

        // 领取按钮
        var openBtn = overlay.querySelector('#rp-open');
        if (openBtn && isPending) {
            openBtn.onmouseenter = function () { this.style.transform = 'scale(1.1)'; };
            openBtn.onmouseleave = function () { this.style.transform = 'scale(1)'; };
            openBtn.onclick = function () {
                // 更新余额
                if (record.from === 'system') {
                    window.transferData.myBalance    += record.amount;
                    window.transferData.systemBalance -= record.amount;
                }
                record.status = 'received';
                record.receivedAt = Date.now();
                saveRPData();

                if (typeof showNotification === 'function') showNotification('已领取红包 ¥' + fmt(record.amount) + ' ✦', 'success');
                if (typeof playSound === 'function') playSound('message');

                // 插入"已领取"卡片到聊天
                addRedPacketMessage({
                    id: 'rp_recv_' + Date.now(),
                    sender: 'user',
                    text: '【红包】已领取',
                    timestamp: new Date(),
                    type: 'red-packet',
                    redPacket: record
                });

                overlay.remove();
            };
        }
    };

    // =============================================
    // 系统主动发红包
    // =============================================

    var SPECIAL_AMOUNTS = [5.2, 52, 520, 13.14, 1314];
    var _rpDayStr = '';
    var _rpDayCount = 0;

    window.trySystemRedPacket = function () {
        window.initTransferData();

        var today = new Date().toISOString().slice(0, 10);
        if (today !== _rpDayStr) { _rpDayStr = today; _rpDayCount = 0; }
        if (_rpDayCount >= 5) return false;

        var festivals = getFestivals();
        var festival = festivals.length > 0 ? festivals[0] : null;
        var chance = festival ? 0.85 : 0.25;
        if (Math.random() > chance) return false;

        var amount;
        if (Math.random() < (festival ? 0.9 : 0.4)) {
            amount = Math.round(SPECIAL_AMOUNTS[Math.floor(Math.random() * SPECIAL_AMOUNTS.length)] * 100);
        } else {
            var maxYuan = Math.min(200, Math.floor(window.transferData.systemBalance / 100));
            if (maxYuan <= 0) return false;
            amount = Math.floor(Math.random() * maxYuan * 100) + 1;
        }
        if (window.transferData.systemBalance < amount) return false;

        window.transferData.systemBalance -= amount;

        var msgs = festival ? festival.messages : ['给你一个小红包~', '惊喜红包', '好运红包', '开心一下~'];
        var message = msgs[Math.floor(Math.random() * msgs.length)];

        var record = {
            id: genId(),
            from: 'system',
            to: 'me',
            amount: amount,
            message: message,
            status: 'pending',
            createdAt: Date.now()
        };
        window.transferData.records.push(record);
        _rpDayCount++;
        saveRPData();

        addRedPacketMessage({
            id: record.id,
            sender: 'partner',
            text: '【红包】' + message,
            timestamp: new Date(),
            type: 'red-packet',
            redPacket: record
        });

        if (typeof playSound === 'function') playSound('message');
        if (typeof showNotification === 'function') {
            showNotification((festival ? festival.name + '红包来啦！' : '收到一个红包') + ' ¥' + fmt(amount), 'success');
        }
        return true;
    };

    // =============================================
    // 后续随机收取 & 过期退回
    // =============================================

    window.tryCollectPendingRedPacket = function () {
        window.initTransferData();
        var pending = (window.transferData.records || []).filter(function (r) {
            return r.status === 'pending' && r.from === 'me';
        });
        if (!pending.length || Math.random() > 0.08) return;

        var target = pending[Math.floor(Math.random() * pending.length)];
        if (Date.now() - target.createdAt > 24 * 3600 * 1000) return;

        target.status = 'received';
        target.receivedAt = Date.now();
        window.transferData.systemBalance += target.amount;
        saveRPData();

        addRedPacketMessage({
            id: 'rp_recv_' + Date.now(),
            sender: 'partner',
            text: '【红包】已领取',
            timestamp: new Date(),
            type: 'red-packet',
            redPacket: target
        });
        if (typeof playSound === 'function') playSound('message');
    };

    window.checkRedPacketExpiry = function () {
        window.initTransferData();
        var now = Date.now();
        var expired = (window.transferData.records || []).filter(function (r) {
            return r.status === 'pending' && (now - r.createdAt) > 24 * 3600 * 1000;
        });
        if (!expired.length) return;

        expired.forEach(function (r) {
            r.status = 'returned';
            r.returnedAt = now;
            if (r.from === 'me') window.transferData.myBalance += r.amount;
            else if (r.from === 'system') window.transferData.systemBalance += r.amount;
        });
        saveRPData();
        if (typeof renderMessages === 'function') renderMessages();
    };

    // =============================================
    // 余额设置弹窗
    // =============================================

    window.showTransferBalanceSettings = function () {
        window.initTransferData();
        var overlay = _createOverlay('center');
        overlay.innerHTML =
            '<div style="width:min(340px,88vw);background:var(--primary-bg,#fff);border-radius:20px;padding:0;animation:rpPopIn 0.25s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 20px 60px rgba(0,0,0,0.28);border:1px solid var(--border-color,#e8e8e8);">' +
                _drawerHandle() +
                '<div style="padding:16px 20px 10px;font-size:17px;font-weight:700;text-align:center;color:var(--text-primary,#1a1a1a);">余额设置</div>' +
                '<div style="padding:0 20px 24px;">' +
                    _balRow('我的余额', 'rp-bal-my', window.transferData.myBalance) +
                    _balRow('对方余额', 'rp-bal-sys', window.transferData.systemBalance) +
                    '<button id="rp-bal-save" style="width:100%;height:48px;border:none;border-radius:12px;background:var(--accent-color,#b8a9c9);color:#fff;font-size:16px;font-weight:700;cursor:pointer;margin-top:16px;">保存</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        _injectRpStyles();

        overlay.querySelector('#rp-bal-save').onclick = function () {
            window.transferData.myBalance     = Math.round((parseFloat(overlay.querySelector('#rp-bal-my').value)  || 0) * 100);
            window.transferData.systemBalance = Math.round((parseFloat(overlay.querySelector('#rp-bal-sys').value) || 0) * 100);
            saveRPData();
            if (typeof showNotification === 'function') showNotification('余额已保存', 'success');
            overlay.remove();
        };
    };

    // =============================================
    // 工具 DOM 函数
    // =============================================

    function _createOverlay(align) {
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.48);z-index:9999;display:flex;' +
            'align-items:' + (align === 'center' ? 'center' : 'flex-end') + ';justify-content:center;';
        ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
        return ov;
    }

    function _drawerHandle() {
        return '<div style="width:36px;height:4px;border-radius:2px;background:var(--border-color,#ddd);margin:10px auto 0;"></div>';
    }

    function _balRow(label, id, centVal) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:0.5px solid var(--border-color,#e8e8e8);">' +
            '<span style="font-size:14px;color:var(--text-primary,#1a1a1a);">' + label + '</span>' +
            '<input type="number" id="' + id + '" value="' + (centVal / 100).toFixed(2) + '" ' +
            'style="width:120px;height:36px;border:1.5px solid var(--border-color,#e8e8e8);border-radius:8px;padding:0 10px;font-size:15px;text-align:right;outline:none;font-weight:600;background:var(--secondary-bg,#f5f5f5);color:var(--text-primary,#1a1a1a);box-sizing:border-box;" />' +
        '</div>';
    }

    /** 注入必要的 CSS 动画（只注入一次） */
    function _injectRpStyles() {
        if (document.getElementById('rp-styles')) return;
        var style = document.createElement('style');
        style.id = 'rp-styles';
        style.textContent =
            '@keyframes rpSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}' +
            '@keyframes rpPopIn{from{transform:scale(0.85);opacity:0}to{transform:scale(1);opacity:1}}';
        document.head.appendChild(style);
    }

    // =============================================
    // 暴露到全局，方便 index.html 里直接调用
    // =============================================
    window.renderRedPacketMessage = renderRedPacketCard; // 兼容旧接口

    console.log('[RedPacket] 模块加载完成 ✦');

// 每隔 5 分钟自动检查一次有没有过期的红包
    setInterval(function() {
        if (typeof window.checkRedPacketExpiry === 'function') {
            window.checkRedPacketExpiry();
        }
    }, 5 * 60 * 1000);

    

})();
