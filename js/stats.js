
"use strict";
/* ============================================================================
   學習分析頁
   ── 與遊戲主程式分開部署，共用同一份 Google 試算表
   ── 資料全部來自 Code.gs：getUserInfo / getMyStats / getWrongBook /
      markCorrected / getAdvice
   ========================================================================== */
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const LETTERS = ['A','B','C','D','E','F'];
const inGAS = typeof google !== 'undefined' && google.script && google.script.run;

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

/* ── 分頁切換 ── */
document.querySelectorAll('.tab').forEach(function(t){
  t.onclick = function(){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');
    $(t.dataset.p).classList.add('on');
  };
});

/* ============================================================================
   雷達圖：三條線（我的／全體／我的平均）
   ========================================================================== */
function radarSVG(cats, myAvg){
  const R = 118, cx = 175, cy = 165, n = cats.length;
  if(!n) return '';
  const pt = (i, r) => {
    const a = -Math.PI/2 + i * 2*Math.PI/n;
    return [cx + Math.cos(a)*r, cy + Math.sin(a)*r];
  };
  const path = (vals, cls) =>
    '<polygon class="'+cls+'" points="' +
    vals.map((v,i)=>{ const p = pt(i, R*clamp(v,0,100)/100); return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' ') +
    '"/>';

  let g = '';
  [25,50,75,100].forEach(function(lv){
    g += '<polygon class="rg" points="' +
      cats.map((_,i)=>{ const p = pt(i, R*lv/100); return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' ') + '"/>';
  });
  cats.forEach(function(_,i){
    const p = pt(i, R);
    g += '<line class="rl" x1="'+cx+'" y1="'+cy+'" x2="'+p[0].toFixed(1)+'" y2="'+p[1].toFixed(1)+'"/>';
  });
  g += path(cats.map(()=>myAvg), 'ravg');                    // 我的整體平均（白虛線）
  g += path(cats.map(c=>c.globalRate), 'rall');              // 全體平均（金線）
  g += path(cats.map(c=>c.rate), 'rme');                     // 我（藍實線）
  cats.forEach(function(c,i){
    const p = pt(i, R*clamp(c.rate,0,100)/100);
    g += '<circle class="rd" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.6"/>';
  });
  // 軸標籤只放編號，完整名稱在右邊列表，避免長字被切掉
  cats.forEach(function(c,i){
    const p = pt(i, R + 22);
    g += '<text class="rt" x="'+p[0].toFixed(1)+'" y="'+(p[1]+4).toFixed(1)+'" text-anchor="middle">' +
         (c.code || c.label || '') + '</text>';
    g += '<text class="rn" x="'+p[0].toFixed(1)+'" y="'+(p[1]+17).toFixed(1)+'" text-anchor="middle">' +
         (c.n ? c.rate + '%' : '—') + '</text>';
  });
  return '<svg viewBox="0 0 350 340" xmlns="http://www.w3.org/2000/svg">' +
    '<style>' +
    '.rg{fill:#f7f5ff;stroke:#e6e0fb;stroke-width:1.5}' +
    '.rl{stroke:#e6e0fb;stroke-width:1.5}' +
    '.ravg{fill:none;stroke:#ff6fa8;stroke-dasharray:5 5;stroke-width:2}' +
    '.rall{fill:rgba(255,197,51,.16);stroke:#f5ab00;stroke-width:2.2;stroke-linejoin:round}' +
    '.rme{fill:rgba(31,143,229,.22);stroke:#1f8fe5;stroke-width:3;stroke-linejoin:round}' +
    '.rd{fill:#fff;stroke:#1f8fe5;stroke-width:2.5}' +
    '.rt{fill:#3b3366;font-size:14px;font-weight:700;font-family:Fredoka,Huninn,sans-serif}' +
    '.rn{fill:#7d78a3;font-size:11.5px;font-weight:700}' +
    '</style>' + g + '</svg>';
}

/* ============================================================================
   狀態
   ========================================================================== */
let ME = {allowed:false}, STATS = null, WB = [];

function boot(){
  if(!inGAS){ demo(); return; }
  google.script.run.withSuccessHandler(function(u){
    ME = u || ME;
    $('back').href = u && u.gameUrl ? u.gameUrl : '#';
    if(!ME.allowed){
      $('who-name').textContent = '訪客';
      $('who-sub').textContent = ME.email ? '（非本校帳號）' : '未登入';
      gate();
      return;
    }
    $('who-name').textContent = ME.shortId || '同學';
    $('who-sub').textContent = ME.email || '';
    loadAll();
  }).withFailureHandler(function(){ gate(); }).getUserInfo();
}

function gate(){
  const msg = '<div class="empty">需要以學校帳號登入才能看到自己的學習分析。<br>' +
              '請用學校信箱登入後重新整理這一頁。</div>';
  $('radar').innerHTML = msg;
  $('cats').innerHTML = ''; $('kpis').innerHTML = '';
  $('q-behind').innerHTML = msg; $('q-ahead').innerHTML = '';
  $('wb-list').innerHTML = msg;
  $('btn-practice').disabled = true;
  $('btn-advice').disabled = true;
}

function loadAll(){
  google.script.run.withSuccessHandler(function(st){
    STATS = st || {cats:[], total:0};
    paintStats(); paintQuestions();
  }).withFailureHandler(function(){
    $('radar').innerHTML = '<div class="empty">讀取失敗，請重新整理。</div>';
  }).getMyStats();

  google.script.run.withSuccessHandler(function(wb){
    WB = (wb && wb.items) || [];
    paintWB();
  }).withFailureHandler(function(){}).getWrongBook();
}

/* ── 題型戰力 ── */
function paintStats(){
  const st = STATS;
  if(!st || !st.cats || !st.cats.length || !st.total){
    $('radar').innerHTML = '<div class="empty">還沒有作答紀錄。<br>先去玩一課，回來就會看到分析。</div>';
    $('cats').innerHTML = ''; $('kpis').innerHTML = '';
    return;
  }
  const kp = $('kpis'); kp.innerHTML = '';
  [['累計作答', st.total + ' 題'],
   ['我的平均得分率', (st.avgRate||0) + '%'],
   ['全體平均', (st.globalAvg||0) + '%'],
   ['全對率', (st.avgFull||0) + '%'],
   ['一起作答的人', (st.people||1) + ' 人']].forEach(function(row){
    const d = document.createElement('div'); d.className = 'kpi';
    const i = document.createElement('i'); i.textContent = row[0];
    const b = document.createElement('b'); b.textContent = row[1];
    if(row[0] === '我的平均得分率'){
      b.style.color = (st.avgRate >= (st.globalAvg||0)) ? 'var(--jade)' : 'var(--gold)';
    }
    d.append(i, b); kp.appendChild(d);
  });

  $('radar').innerHTML = radarSVG(st.cats, st.avgRate || 0);

  const box = $('cats'); box.innerHTML = '';
  st.cats.slice().sort(function(a,b){
    if(!a.n !== !b.n) return a.n ? -1 : 1;      // 沒作答的排最後
    return b.rate - a.rate;
  }).forEach(function(c){
    const d = document.createElement('div'); d.className = 'catrow';

    const nm = document.createElement('div'); nm.className = 'nm';
    const cd = document.createElement('span'); cd.className = 'code';
    cd.textContent = c.code || '—';
    const tx = document.createElement('div'); tx.className = 'txt';
    const nb = document.createElement('b'); nb.textContent = c.label || c.name;
    const ne = document.createElement('em'); ne.textContent = c.n + ' 題';
    tx.append(nb, ne);
    nm.append(cd, tx);

    const bars = document.createElement('div'); bars.className = 'bars';
    [['我', c.n ? c.rate : 0, c.rate >= 75 ? '#34d399' : c.rate >= 50 ? '#ffc533' : '#ff6f8e'],
     ['全體', c.globalRate || 0, '#c9c2ec']].forEach(function(row){
      const b = document.createElement('div'); b.className = 'bar';
      const l = document.createElement('span'); l.textContent = row[0];
      const u = document.createElement('u'); const i = document.createElement('i');
      i.style.width = (row[1] > 0 ? clamp(row[1], 2, 100) : 0) + '%';
      i.style.background = row[2];
      u.appendChild(i); b.append(l, u); bars.appendChild(b);
    });

    const v = document.createElement('div'); v.className = 'val';
    if(c.n){
      const diff = c.rate - (c.globalRate || 0);
      v.textContent = c.rate + '%';
      v.style.color = diff >= 0 ? 'var(--jade)' : 'var(--ember)';
      const s = document.createElement('small');
      s.textContent = (diff >= 0 ? '高於平均 +' : '低於平均 ') + Math.abs(diff);
      v.appendChild(s);
    }else{
      v.textContent = '—';
      const s = document.createElement('small'); s.textContent = '尚未作答';
      v.appendChild(s);
    }
    d.append(nm, bars, v); box.appendChild(d);
  });
}

/* ── 逐題比較 ── */
function paintQuestions(){
  const st = STATS;
  const mk = function(host, rows, cls, emptyMsg){
    const box = $(host); box.innerHTML = '';
    if(!rows || !rows.length){
      box.innerHTML = '<div class="empty">' + emptyMsg + '</div>'; return;
    }
    rows.forEach(function(r){
      const d = document.createElement('div');
      d.className = 'qrow ' + (r.diff < 0 ? 'bad' : r.diff > 0 ? 'good' : '');
      const t = document.createElement('div'); t.className = 'qt';
      const b = document.createElement('b');
      b.textContent = r.q || ('題號 ' + r.id);
      const e = document.createElement('em');
      e.textContent = (r.cat ? r.cat + '　' : '') + '全體 ' + r.n + ' 人作答';
      t.append(b, e);

      const c = document.createElement('div'); c.className = 'cmp';
      const m = document.createElement('div'); m.className = 'm';
      m.textContent = r.mine + '%';
      m.style.color = r.diff < 0 ? 'var(--ember)' : 'var(--jade)';
      const g = document.createElement('div'); g.className = 'g';
      g.textContent = '全體 ' + r.global + '%';
      const dd = document.createElement('div');
      dd.className = 'd ' + (r.diff < 0 ? 'minus' : 'plus');
      dd.textContent = (r.diff >= 0 ? '+' : '') + r.diff;
      c.append(m, g, dd);

      d.append(t, c); box.appendChild(d);
    });
  };
  if(!st){ return; }
  mk('q-behind', st.behind, 'bad', '目前沒有落後全體平均的題目，維持得很好。');
  mk('q-ahead', st.ahead, 'good', '還沒有足夠的資料。');
}

/* ── 錯題本 ── */
function paintWB(){
  const box = $('wb-list'); box.innerHTML = '';
  $('wb-count').textContent = WB.length ? ('共 ' + WB.length + ' 題') : '目前沒有錯題';
  $('btn-practice').disabled = !WB.length;
  if(!WB.length){
    box.innerHTML = '<div class="empty">目前沒有待訂正的題目。<br>答錯的題目會自動收進這裡。</div>';
    return;
  }
  WB.forEach(function(it){
    const d = document.createElement('div'); d.className = 'wbi';
    const top = document.createElement('div'); top.className = 'top';
    if(it.cat){ const c = document.createElement('span'); c.className='chip cat'; c.textContent = String(it.cat).split('_').pop(); top.appendChild(c); }
    const n = document.createElement('span'); n.className='chip n'; n.textContent = '答錯 ' + it.wrong + ' 次';
    top.appendChild(n);
    if(it.lesson){ const l = document.createElement('span'); l.className='chip ls'; l.textContent = it.lesson; top.appendChild(l); }
    const p = document.createElement('p'); p.textContent = it.q;
    const a = document.createElement('div'); a.className='ans';
    a.textContent = '正解：' + (it.answer || []).join('／');
    d.append(top, p, a); box.appendChild(d);
  });
}

/* ── 練習模式 ── */
let PR = {list:[], i:0, picked:new Set(), answered:false};

function startPractice(){
  if(!WB.length) return;
  PR = {list: shuffle(WB).slice(0, 20), i: 0, picked: new Set(), answered: false};
  $('wb-card').hidden = true;
  $('pr-card').hidden = false;
  prShow();
}
function endPractice(){
  $('pr-card').hidden = true;
  $('wb-card').hidden = false;
  paintWB();
}
function prShow(){
  const it = PR.list[PR.i];
  if(!it){ endPractice(); return; }
  PR.picked.clear(); PR.answered = false;
  $('pr-progress').textContent = (PR.i + 1) + ' / ' + PR.list.length;
  $('pr-meta').textContent = (it.cat ? String(it.cat).split('_').pop() : '練習') + (it.lesson ? '　' + it.lesson : '');
  $('pr-q').textContent = it.q;
  $('pr-badge').hidden = true;
  $('pr-exp').hidden = true;

  const single = (it.answer || []).length <= 1;
  it._opts = shuffle((it.options || []).map(function(t){
    return {text:t, correct:(it.answer||[]).indexOf(t) >= 0};
  }));

  const box = $('pr-opts'); box.innerHTML = '';
  it._opts.forEach(function(o, i){
    const b = document.createElement('button'); b.className = 'opt';
    const k = document.createElement('span'); k.className='key'; k.textContent = LETTERS[i] || (i+1);
    const t = document.createElement('span'); t.textContent = o.text;
    b.append(k, t);
    b.onclick = function(){
      if(PR.answered) return;
      if(single){
        PR.picked.clear();
        box.querySelectorAll('.opt').forEach(x=>x.classList.remove('sel'));
        PR.picked.add(i); b.classList.add('sel');
      }else{
        if(PR.picked.has(i)){ PR.picked.delete(i); b.classList.remove('sel'); }
        else { PR.picked.add(i); b.classList.add('sel'); }
      }
    };
    box.appendChild(b);
  });

  const btn = $('pr-btn');
  btn.textContent = '送出答案'; btn.disabled = false;
  btn.onclick = prSubmit;
}
function prSubmit(){
  const it = PR.list[PR.i];
  if(!PR.picked.size){ return; }
  PR.answered = true;
  let ok = true;
  it._opts.forEach(function(o, i){
    const el = $('pr-opts').children[i];
    el.classList.remove('sel');
    if(o.correct){ el.classList.add('right'); if(!PR.picked.has(i)) ok = false; }
    else if(PR.picked.has(i)){ el.classList.add('wrong'); ok = false; }
  });
  const bd = $('pr-badge');
  bd.hidden = false;
  bd.textContent = ok ? '✓ 訂正成功' : '✗ 再看一次解析';
  bd.className = 'badge ' + (ok ? 'ok' : 'no');
  $('pr-exp-text').textContent = it.exp || '（本題未附解析）';
  $('pr-exp').hidden = false;

  if(ok){
    WB = WB.filter(function(x){ return (x.key || x.id) !== (it.key || it.id); });
    if(inGAS) google.script.run
      .withSuccessHandler(function(){}).withFailureHandler(function(){})
      .markCorrected(it.id, it.cat || '', it.lessonId || '');
  }
  const btn = $('pr-btn');
  btn.textContent = (PR.i + 1 < PR.list.length) ? '下一題' : '完成練習';
  btn.onclick = function(){
    PR.i++;
    if(PR.i < PR.list.length) prShow();
    else endPractice();
  };
}

/* ── 學習建議 ── */
function loadAdvice(){
  const t = $('advice');
  t.textContent = '分析中⋯⋯';
  $('btn-advice').disabled = true;
  if(!inGAS){
    t.textContent = '（本機預覽）你在「形音義」表現最穩，平均得分率 82%（高於全體平均 71%）。相對弱的是「排序與填空」，平均 41%，建議先抓關聯詞與代名詞當線索，再決定句子先後。';
    $('btn-advice').disabled = false; return;
  }
  google.script.run.withSuccessHandler(function(r){
    $('btn-advice').disabled = false;
    if(!r){ t.textContent = '產生失敗，請稍後再試。'; return; }
    t.innerHTML = '';
    if(r.ai){
      const tag = document.createElement('span');
      tag.className = 'ai-tag'; tag.textContent = 'AI 建議';
      t.appendChild(tag); t.appendChild(document.createElement('br'));
    }
    t.appendChild(document.createTextNode(r.text || ''));
  }).withFailureHandler(function(){
    $('btn-advice').disabled = false;
    t.textContent = '連線失敗，請稍後再試。';
  }).getAdvice();
}

/* ── 本機預覽用的假資料 ── */
function demo(){
  ME = {allowed:true, shortId:'demo', email:'demo@example.com'};
  $('who-name').textContent = 'demo';
  $('who-sub').textContent = '本機預覽模式';
  const names = [['A1','形音義',82,71],['A2','成語詞語',64,68],['A3','語法修辭',55,60],
                 ['A4','排序與填空',41,58],['A5','作家與國學常識',73,66],
                 ['A6','諸子與文化常識',60,63],['B1','文言文課內理解',69,64],
                 ['B2','白話文課內理解',77,72]];
  STATS = {
    cats: names.map(function(x){
      return {name:x[0]+'_'+x[1], code:x[0], label:x[1], n:8,
              rate:x[2], full:Math.round(x[2]*0.8), globalRate:x[3], globalN:120};
    }),
    total:64, avgRate:65, avgFull:52, globalAvg:65, people:23,
    behind:[{id:'Q7',cat:'A4_排序與填空',mine:20,global:62,n:23,diff:-42,q:'下列文句排入「　」中，順序最恰當的是：'},
            {id:'Q3',cat:'A3_語法修辭',mine:33,global:64,n:21,diff:-31,q:'「阡陌交通，雞犬相聞」使用的修辭手法是：'},
            {id:'Q9',cat:'A2_成語詞語',mine:50,global:70,n:19,diff:-20,q:'「豁然開朗」一語，與下列何者意思最相近？'}],
    ahead:[{id:'Q1',cat:'A1_形音義',mine:100,global:58,n:22,diff:42,q:'下列各組「」內的字，讀音前後相同的是：'},
           {id:'Q5',cat:'B2_白話文課內理解',mine:100,global:74,n:20,diff:26,q:'本文第三段主要在說明什麼？'}]
  };
  WB = [{id:'Q7',lesson:'第一課',cat:'A4_排序與填空',wrong:2,
         q:'下列文句排入「　」中，順序最恰當的是：',
         options:['甲乙丙','乙甲丙','丙乙甲','甲丙乙'],answer:['乙甲丙'],exp:'依時間先後與代詞指涉判斷，應選乙甲丙。'},
        {id:'Q3',lesson:'第一課',cat:'A3_語法修辭',wrong:1,
         q:'「阡陌交通，雞犬相聞」使用的修辭手法是：',
         options:['譬喻','對偶','誇飾','轉化'],answer:['對偶'],exp:'前後句字數相等、詞性相對，屬對偶。'}];
  paintStats(); paintQuestions(); paintWB();
}

$('btn-advice').onclick = loadAdvice;
$('btn-practice').onclick = startPractice;
$('pr-quit').onclick = endPractice;
boot();
