/* 【24b-home-fold.js】首頁面板摺疊：點面板標題收合或展開，記在這臺裝置上
   有 data-fold 的面板才能摺疊；data-fold-default="1" 表示第一次進來先收起來。
   收起時：學期積分只留稱號與總分，其餘面板只留標題列（右側顯示摘要）。 */
(function(){
  const KEY = 'atkqa_home_fold';
  let saved = {};
  try{ saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(e){ saved = {}; }
  const save = function(){ try{ localStorage.setItem(KEY, JSON.stringify(saved)); }catch(e){} };

  document.querySelectorAll('#scr-home [data-fold]').forEach(function(box){
    const k = box.dataset.fold, h = box.querySelector('h3');
    if(!h) return;
    const folded = (k in saved) ? !!saved[k] : box.dataset.foldDefault === '1';
    box.classList.add('foldable');
    box.classList.toggle('folded', folded);
    h.setAttribute('role', 'button');
    h.setAttribute('tabindex', '0');
    h.setAttribute('aria-expanded', String(!folded));
    const toggle = function(){
      const now = !box.classList.contains('folded');
      box.classList.toggle('folded', now);
      h.setAttribute('aria-expanded', String(!now));
      saved[k] = now ? 1 : 0; save();
      if(typeof sfx === 'function') sfx('tap');
    };
    h.addEventListener('click', toggle);
    h.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); } });
  });

  /* 遊戲設定收起時，標題列顯示目前選的難度與節奏 */
  const sum = document.getElementById('games-sum');
  const paint = function(){
    if(!sum) return;
    const pick = function(id){ const b = document.querySelector('#' + id + ' .optbtn.on b'); return b ? b.textContent.split(/\s/)[0] : ''; };
    sum.textContent = [pick('diff-row'), pick('speed-row')].filter(Boolean).join('・');
  };
  document.querySelectorAll('#diff-row .optbtn, #speed-row .optbtn').forEach(function(b){
    b.addEventListener('click', function(){ setTimeout(paint, 0); });
  });
  paint();
})();
