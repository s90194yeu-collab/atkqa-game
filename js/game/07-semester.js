/* 【07-semester.js】學期積分、稱號風格、登入資訊
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   學期積分與稱號
   ── 每課只採計最高分，重刷同一課不會累加，只會刷新該課的最佳成績
   ── 學期總積分＝各課最佳分數的總和
   ========================================================================== */
/* ── 稱號：九階門檻共用，18 種風格 ──
   門檻以「一學期約 12 課」估算：單場滿分約 3,200，六成正確約 1,700。
   換課數時按比例調整，Code.gs 的 TITLE_MIN 要一起改。 */
const TITLE_MIN = [0, 1200, 3500, 7000, 11500, 17000, 23000, 30000, 38000];
const TITLE_STYLES = [
  {k:'scholar', name:'古代科舉',   icon:'📜', color:'#c98200', t:['童生','秀才','舉人','貢士','進士','探花','榜眼','狀元','文曲星']},
  {k:'royal',   name:'帝王封建',   icon:'👑', color:'#e0661a', t:['平民','士人','校尉','將軍','侯爵','公爵','親王','攝政王','皇帝']},
  {k:'rpg',     name:'奇幻冒險',   icon:'⚔️', color:'#12a97c', t:['旅人','見習冒險者','銅級冒險者','銀級冒險者','金級冒險者','白金冒險者','勇者','大勇者','傳說勇者']},
  {k:'wuxia',   name:'武俠江湖',   icon:'🗡️', color:'#a8730c', t:['江湖客','後起之秀','成名高手','一方之雄','絕頂高手','一派宗師','武林盟主','三教頂峰','天下第一']},
  {k:'magic',   name:'魔法與魔王', icon:'🔮', color:'#8b68ee', t:['旁聽生','見習魔法師','正式魔法師','高等魔法師','大魔導士','賢者','大賢者','魔王','暴風之王']},
  {k:'myth',    name:'神域諸神',   icon:'⚡', color:'#c99200', t:['凡人','祭司','神使','半神','守護神','主神','司命者','創世神','萬神之上']},
  {k:'oath',    name:'圓桌誓約',   icon:'🛡️', color:'#3f72e6', t:['侍從','見習騎士','正式騎士','圓桌之席','領主','大公','攝政','護國公','王']},
  {k:'sengoku', name:'戰國亂世',   icon:'🏯', color:'#ee6420', t:['足輕','小姓','侍大將','家老','城主','大名','守護','天下人','第六天魔王']},
  {k:'zhulu',   name:'逐鹿中原',   icon:'🐉', color:'#e03b52', t:['布衣','士人','門客','幕僚','謀士','軍師','丞相','國士無雙','帝者之師']},
];

/* 舊風格代號 → 新風格代號（與 Code.gs 的 STYLE_ALIAS 一致）
   學生先前選過的舊風格自動平移，不必重選 */
const STYLE_ALIAS = { slayer:'sengoku', gundam:'myth', aot:'oath', lineage:'zhulu' };

const STYLE_BY_KEY = {};
TITLE_STYLES.forEach(function(x){ STYLE_BY_KEY[x.k] = x; });

let MY_STYLE = 'rpg';        // 預設風格：奇幻冒險
function styleObj(k){
  if(STYLE_ALIAS[k]) k = STYLE_ALIAS[k];
  return STYLE_BY_KEY[k] || STYLE_BY_KEY.rpg || STYLE_BY_KEY.scholar;
}
function tierOf(total){
  let i = 0;
  TITLE_MIN.forEach(function(m, k){ if(total >= m) i = k; });
  return i;
}
function titleOf(total, key){
  const st = styleObj(key || MY_STYLE), i = tierOf(total);
  return {name: st.t[i], icon: st.icon, color: st.color, min: TITLE_MIN[i], tier: i};
}
function nextTitle(total, key){
  const st = styleObj(key || MY_STYLE), i = tierOf(total);
  if(i >= TITLE_MIN.length - 1) return null;
  return {name: st.t[i+1], icon: st.icon, color: st.color, min: TITLE_MIN[i+1]};
}

let SEMESTER = null;          // {total, lessons:[{id,name,best,plays}]}
let LAST_BEST = null;         // 這一場開打前，本課的最佳分數

let ME = {email:'', shortId:'', allowed:false, domains:[]};
function loadUser(){
  if(!inGAS){ paintLogin(); return; }
  if(window.__watch) window.__watch('getUserInfo');
  google.script.run
    .withSuccessHandler(function(u){
      if(window.__done) window.__done('getUserInfo');
      ME = u || ME; paintLogin(); loadSemester();
      loadUnlocks();   /* 放在回呼裡：此時所有 let 變數都已初始化 */
      loadGrowth();
      if(ME.allowed) loadDojo();
    })
    .withFailureHandler(function(e){
      if(window.__done) window.__done('getUserInfo');
      if(window.__bootErr) window.__bootErr('getUserInfo 失敗：', (e && e.message) || String(e));
      paintLogin();
    })
    .getUserInfo();
}
function paintLogin(){
  const guest = !ME.allowed;
  $('sem-box').hidden = guest;
  $('login-box').hidden = !guest;
  if(guest){
    $('login-who').textContent = ME.email
      ? ('目前登入：' + ME.email + '（非本校帳號）')
      : '目前未登入';
    $('login-note').textContent = ME.email
      ? '這個帳號不會登記成績。要累積學期積分與稱號，請改用學校帳號登入。'
      : '不登入也可以正常遊玩，只是不會留下任何紀錄。要累積學期積分與稱號，請用學校帳號登入。';
    const d = $('login-domains'); d.innerHTML = '';
    (ME.domains || ['gm.nssh.ntpc.edu.tw','stdmail.nssh.ntpc.edu.tw']).forEach(function(x){
      const b = document.createElement('code'); b.textContent = '@' + x; d.appendChild(b);
    });
  }
}

function loadSemester(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(d){
      SEMESTER = d || {total:0, lessons:[]};
      if(SEMESTER.style) MY_STYLE = SEMESTER.style;
      paintSemester();
      if(LESSONS.length) renderLessons(LESSONS);   // 讓課次選單顯示各課最佳成績
    })
    .withFailureHandler(function(){})
    .getSemester();
}

let STYLE_QUOTA = null;
function openStyles(){
  const total = (SEMESTER && SEMESTER.total) || 0;
  const grid = $('style-grid'); grid.innerHTML = '';
  TITLE_STYLES.forEach(function(st){
    const cur = tierOf(total);
    const card = document.createElement('button');
    card.className = 'style-card' + (st.k === MY_STYLE ? ' on' : '');
    const h = document.createElement('h4');
    h.textContent = st.icon + ' ' + st.name + (st.k === MY_STYLE ? '　（使用中）' : '');
    h.style.color = st.color;
    const now = document.createElement('div');
    now.className = 'now'; now.style.color = st.color;
    now.textContent = '目前：' + st.t[cur];
    const box = document.createElement('div'); box.className = 'style-tiers';
    st.t.forEach(function(name, i){
      const d = document.createElement('div');
      d.className = 'style-tier' + (i < cur ? ' got' : i === cur ? ' cur' : '');
      const a = document.createElement('span'); a.textContent = name;
      const b = document.createElement('em'); b.textContent = TITLE_MIN[i].toLocaleString();
      d.append(a, b); box.appendChild(d);
    });
    card.append(h, now, box);
    card.onclick = function(){ pickStyle(st); };
    grid.appendChild(card);
  });
  if(inGAS && STYLE_QUOTA === null){
    google.script.run.withSuccessHandler(function(q){
      STYLE_QUOTA = q || {ok:false};
      $('style-quota').textContent = STYLE_QUOTA.ok ? '目前可更換一次' : '本期已更換過';
    }).withFailureHandler(function(){}).canChangeStyle();
  }else if(STYLE_QUOTA){
    $('style-quota').textContent = STYLE_QUOTA.ok ? '目前可更換一次' : '本期已更換過';
  }
  show('scr-styles');
}

function pickStyle(st){
  if(st.k === MY_STYLE) return;
  if(!ME.allowed){ alert('需要以學校帳號登入，才能設定稱號風格。'); return; }
  if(STYLE_QUOTA && !STYLE_QUOTA.ok){
    alert('這個時段已經換過稱號風格了。\n每月 1 號與 15 號各開放一次更換機會。');
    return;
  }
  if(!confirm('要把稱號風格改成「' + st.name + '」嗎？\n每個月 1 號與 15 號各能換一次。')) return;
  if(!inGAS){ MY_STYLE = st.k; paintSemester(); openStyles(); return; }
  google.script.run
    .withSuccessHandler(function(r){
      if(r && r.ok){
        MY_STYLE = st.k; STYLE_QUOTA = {ok:false};
        sfx('win'); banner('稱號更新！', true);
        paintSemester(); openStyles();
      }else alert((r && r.msg) || '更換失敗。');
    })
    .withFailureHandler(function(){ alert('連線失敗，請稍後再試。'); })
    .setStyle(st.k);
}

function paintSemester(){
  const box = $('sem-box');
  if(!box) return;
  if(!SEMESTER){ box.hidden = true; return; }
  box.hidden = false;
  const total = SEMESTER.total || 0;
  const t = titleOf(total), nx = nextTitle(total);

  $('sem-title').textContent = t.icon + ' ' + t.name;
  $('sem-title').style.color = t.color;
  $('sem-desc').textContent = styleObj(MY_STYLE).name + '風格　·　第 ' + (t.tier+1) + ' 階 / 9';
  $('sem-total').textContent = total.toLocaleString();

  const bar = $('sem-bar'), lab = $('sem-next');
  if(nx){
    const span = nx.min - t.min;
    const got = total - t.min;
    bar.style.width = Math.round(clamp(got / span, 0.02, 1) * 100) + '%';
    bar.style.background = nx.color;
    lab.textContent = '距離「' + nx.name + '」還差 ' + (nx.min - total).toLocaleString() + ' 分';
  }else{
    bar.style.width = '100%'; bar.style.background = t.color;
    lab.textContent = '已達最高稱號';
  }

  const list = $('sem-lessons'); list.innerHTML = '';
  const ls = (SEMESTER.lessons || []).slice().sort(function(a,b){ return b.best - a.best; });
  if(!ls.length){
    const d = document.createElement('div');
    d.className = 'lesson-empty';
    d.textContent = '還沒有任何課次的成績。每一課只採計你的最高分，隨時可以回來刷新。';
    list.appendChild(d);
    return;
  }
  ls.forEach(function(L){
    const d = document.createElement('div'); d.className = 'sem-row';
    const a = document.createElement('span'); a.textContent = L.name || L.id;
    const b = document.createElement('b'); b.textContent = L.best.toLocaleString();
    const c = document.createElement('em'); c.textContent = '挑戰 ' + (L.plays || 1) + ' 次';
    d.append(a, c, b); list.appendChild(d);
  });
}
