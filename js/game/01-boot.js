/* 【01-boot.js】啟動診斷（BOOT_DIAG 改 true 可把錯誤顯示在畫面上）
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */

/* ============================================================================
   啟動診斷：把原本只會出現在主控台的錯誤，直接顯示在畫面上。
   確認一切正常之後，把 BOOT_DIAG 改成 false 就會完全關閉。
   ========================================================================== */
var BOOT_DIAG = false;
(function(){
  if(!BOOT_DIAG) return;
  var box = null, seen = {};
  window.__bootErr = function(title, detail){
    try{
      if(!box){
        box = document.createElement('div'); box.id = 'boot-err';
        var x = document.createElement('button'); x.textContent = '關閉';
        x.onclick = function(){ box.remove(); box = null; };
        box.appendChild(x);
        var h = document.createElement('b'); h.textContent = '⚠ 啟動診斷（這個訊息只有出問題時才會出現）';
        box.appendChild(h);
        (document.body || document.documentElement).appendChild(box);
      }
      var k = title + '|' + detail;
      if(seen[k]) return; seen[k] = 1;
      var c = document.createElement('code');
      c.textContent = title + '　' + detail;
      box.appendChild(c);
    }catch(e){}
  };
  window.addEventListener('error', function(e){
    window.__bootErr('JS 例外：', (e.message || '') + '　@ 第 ' + (e.lineno || '?') + ' 行');
  });
  window.addEventListener('unhandledrejection', function(e){
    window.__bootErr('未處理的 Promise：', String(e.reason));
  });
  /* 逾時監看：12 秒後回報哪些後端呼叫沒有回應 */
  window.__pending = {};
  window.__watch = function(name){
    window.__pending[name] = Date.now();
    setTimeout(function(){
      if(window.__pending[name]){
        window.__bootErr('後端無回應（逾時 12 秒）：', name
          + '　→ 多半是 Apps Script 沒有重新部署，或 Code.gs 有編譯錯誤');
      }
    }, 12000);
  };
  window.__done = function(name){ delete window.__pending[name]; };
})();
/* 註：原本這裡有一行 "use strict"，但它不在檔案最前面，從來沒有生效；拆檔後改成註解，維持原本的寬鬆模式。 */
