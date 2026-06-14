(function() {
    'use strict';
    
    // 1. 创建一个唯一的悬浮球，ID前缀使用 rp_ 防止冲突
    const btn = document.createElement('div');
    btn.id = 'rp_float_btn';
    btn.innerHTML = '🧧';
    btn.style.cssText = `
        position:fixed; bottom:80px; right:20px; width:45px; height:45px; 
        background:#e64a3b; border-radius:50%; display:flex; align-items:center; 
        justify-content:center; cursor:pointer; z-index:9999; box-shadow:0 4px 10px rgba(230,74,59,0.3);
    `;
    document.body.appendChild(btn);

    // 2. 这里的逻辑完全独立
    btn.onclick = function() {
        alert("准备好了，可以写红包弹窗逻辑了！");
        // 这里后续填入红包的弹出代码，绝对不会影响你的“贴上”按钮
    };
})();
