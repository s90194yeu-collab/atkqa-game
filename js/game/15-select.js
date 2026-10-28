/* 【15-select.js】選角畫面、角色清冊
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   選角畫面
   ========================================================================== */
const UNIVERSES = [
  {k:'myth',    label:'⚡ 神域', keys:['myth']},
  {k:'oath',    label:'🛡️ 誓約', keys:['oath']},
  {k:'sengoku', label:'🏯 亂世', keys:['sengoku']},
  {k:'zhulu',   label:'🐉 逐鹿', keys:['zhulu']},
  {k:'shuihu',  label:'🍶 梁山', keys:['shuihu']},
  {k:'major',   label:'🎓 學府', keys:['major']},
  {k:'wild',    label:'🌿 淺山', keys:['wild']},
  {k:'special', label:'💠 特殊', keys:['special']}
];
const UNI_LABEL = {
  myth:'⚡ 神域', oath:'🛡️ 誓約', sengoku:'🏯 亂世', zhulu:'🐉 逐鹿',
  shuihu:'🍶 梁山', major:'🎓 學府', wild:'🌿 淺山', special:'💠 特殊'
};
/* 試算表 C 欄可以寫「神域」或「⚡ 神域」，兩種都認得 */
const UNI_BY_LABEL = {
  '⚡ 神域':'myth', '🛡️ 誓約':'oath', '🏯 亂世':'sengoku', '🐉 逐鹿':'zhulu',
  '🍶 梁山':'shuihu', '🎓 學府':'major', '🌿 淺山':'wild', '💠 特殊':'special',
  '神域':'myth', '誓約':'oath', '亂世':'sengoku', '逐鹿':'zhulu',
  '梁山':'shuihu', '學府':'major', '淺山':'wild', '特殊':'special'
};
const UNIVERSE_FILTER = {};
UNIVERSES.forEach(u=>{ UNIVERSE_FILTER[u.k] = u.keys; });
let selected = null;

/* 隱藏角色：輸入密碼才會出現在陣容中（僅本次開啟有效） */
const SECRET_PW = { sp_quewue:'nsshchiue' };
const UNLOCKED  = {};

/* ── 解鎖貓：陣營 → 角色ID ──────────────────────────────
   用該陣營的角色打贏一場，就解鎖那一隻。進化過也算，
   因為 applyForm() 不會改動 universe。 */
const CAT_BY_UNI = {
  myth     :'cat_myth',
  oath     :'cat_oath',
  sengoku  :'cat_sengoku',
  zhulu    :'cat_zhulu',
  shuihu   :'cat_shuihu',
  major    :'cat_major',
  wild     :'cat_wild'
};

/* 從試算表讀回已解鎖的角色，重新整理也不會消失 */
function loadUnlocks(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(d){
      d = d || {};
      (d.unlocked || []).forEach(function(id){ UNLOCKED[id] = true; });
      CLEARED = {};
      (d.cleared || []).forEach(function(id){ CLEARED[id] = true; });
      if(rosterBuilt) renderRoster(LAST_FILTER.key || UNIVERSES[0].k, LAST_FILTER.mode);
    })
    .withFailureHandler(function(){})
    .getUnlocks();
}

/* 已完整打完三回合的角色ID（跨場累積，存在試算表）
   用 var 宣告：這個物件會被啟動流程中較早的程式碼碰到，
   let 的暫時性死區會直接拋 ReferenceError。 */
var CLEARED = {};

/* 某陣營需要幾位角色才能解鎖＝該陣營可選角色的半數（無條件進位），貓本身不算 */
function catQuota(uni){
  const n = ALL_CHARACTERS.filter(c=>c.universe===uni && !c.isUpgrade && !c.secret).length;
  return Math.ceil(n / 2);
}
function catProgress(uni){
  const ids = ALL_CHARACTERS.filter(c=>c.universe===uni && !c.isUpgrade && !c.secret).map(c=>c.id);
  return ids.filter(id=>CLEARED[id]).length;
}

/* 一場完整打完三回合之後呼叫：記錄這位角色，並檢查是否湊齊解鎖 */
function tryUnlockCat(){
  const uni  = S.player && S.player.universe;
  const base = (S.player && S.player.baseId) || (S.player && S.player.id);
  if(!base || CLEARED[base]){ return checkCatUnlock(uni); }
  CLEARED[base] = true;
  if(inGAS){
    google.script.run.withFailureHandler(function(){ }).addCleared(base);
  }
  return checkCatUnlock(uni);
}
function checkCatUnlock(uni){
  const id = CAT_BY_UNI[uni];
  if(!id || UNLOCKED[id]) return null;
  if(catProgress(uni) < catQuota(uni)) return null;
  const cat = ALL_CHARACTERS.filter(c=>c.id===id)[0];
  if(!cat) return null;
  UNLOCKED[id] = true;
  if(inGAS){
    google.script.run.withFailureHandler(function(){ }).addUnlock(id);
  }
  return cat;
}

/* 七隻全解鎖的獎勵：每場可額外使用一次「直接解題」 */
function allCatsUnlocked(){
  return Object.values(CAT_BY_UNI).every(id=>UNLOCKED[id]);
}
/* 用遮蔽輸入框取代 prompt，旁人看不到打了什麼 */
function unlockSecret(){
  $('pw-input').value = '';
  $('pw-msg').textContent = '';
  $('pw-box').hidden = false;
  $('pw-box').style.display = 'flex';
  setTimeout(function(){ $('pw-input').focus(); }, 60);
}
function closePw(){
  $('pw-box').hidden = true;
  $('pw-box').style.display = 'none';
}
function submitPw(){
  const v = ($('pw-input').value || '').trim();
  if(!v) return;
  let hit = null;
  Object.keys(SECRET_PW).forEach(k=>{ if(SECRET_PW[k] === v) hit = k; });
  if(!hit){
    sfx('fail');
    $('pw-msg').textContent = '密碼錯誤，請再試一次。';
    $('pw-input').value = '';
    $('pw-input').focus();
    return;
  }
  const ch = ALL_CHARACTERS.filter(c=>c.id===hit)[0];
  closePw();
  if(UNLOCKED[hit]){ alert('「' + (ch?ch.name:'') + '」已經解鎖了。'); return; }
  UNLOCKED[hit] = true;
  sfx('awaken'); banner('UNLOCKED!', true);
  renderRoster(LAST_FILTER.key || UNIVERSES[0].k, LAST_FILTER.mode);
  alert('隱藏角色解鎖：' + (ch?ch.name:'') + '\n請到「特殊」陣營選用。');
}

function buildTabs(){
  const box = $('tabs');
  UNIVERSES.forEach((u,i)=>{
    const b = document.createElement('button');
    b.className = 'tab' + (i===0?' on':'');
    b.dataset.u = u.k; b.textContent = u.label;
    b.onclick = ()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
      b.classList.add('on'); renderRoster(u.k, 'universe'); sfx('tap');
    };
    box.appendChild(b);
  });
  const rnd = document.createElement('button');
  rnd.className = 'tab rnd'; rnd.id = 'btn-random'; rnd.textContent = '🎲 隨機選角';
  rnd.onclick = pickRandom;
  box.appendChild(rnd);

  /* 第二排：依定位挑角色 */
  const rbox = $('role-tabs');
  const lb = document.createElement('span');
  lb.className = 'tabs-label'; lb.textContent = '依定位';
  rbox.appendChild(lb);
  ROLE_ORDER.forEach(function(rk){
    const r = ROLES[rk];
    const b = document.createElement('button');
    b.className = 'tab role-tab';
    b.dataset.role = rk; b.style.color = r.color; b.style.setProperty('--tc', r.color);
    b.textContent = r.icon + ' ' + r.name;
    b.onclick = function(){
      document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
      b.classList.add('on');
      renderRoster(rk, 'role'); sfx('tap');
    };
    rbox.appendChild(b);
  });
  const cx = document.createElement('button');
  cx.className = 'tab rnd'; cx.textContent = '📋 角色清冊';
  cx.onclick = function(){ openCodex(); sfx('tap'); };
  rbox.appendChild(cx);
}

let rosterBuilt = false;
let LAST_FILTER = {key:null, mode:'universe'};
/* ── 角色清冊：同類型角色的橫向比較 ── */
let CODEX_ROLE = 'attacker', CODEX_SORT = 'power', codexBuilt = false;
const CODEX_SORTS = [
  {k:'power', label:'依攻擊威力'},
  {k:'hp',    label:'依血量'},
  {k:'guard', label:'依防禦硬度'},
  {k:'acc',   label:'依命中率'},
  {k:'name',  label:'依名稱'}
];
function openCodex(role){
  if(role) CODEX_ROLE = role;
  if(!codexBuilt){
    codexBuilt = true;
    const tb = $('codex-tabs');
    ROLE_ORDER.forEach(function(rk){
      const r = ROLES[rk];
      const b = document.createElement('button');
      b.className = 'tab role-tab'; b.dataset.role = rk; b.style.color = r.color; b.style.setProperty('--tc', r.color);
      b.textContent = r.icon + ' ' + r.name;
      b.onclick = function(){ CODEX_ROLE = rk; renderCodex(); sfx('tap'); };
      tb.appendChild(b);
    });
    const sb = $('codex-sort');
    CODEX_SORTS.forEach(function(o){
      const b = document.createElement('button');
      b.className = 'sortbtn'; b.dataset.sort = o.k; b.textContent = o.label;
      b.onclick = function(){ CODEX_SORT = o.k; renderCodex(); sfx('tap'); };
      sb.appendChild(b);
    });
  }
  renderCodex();
  show('scr-codex');
}

function renderCodex(){
  document.querySelectorAll('#codex-tabs .role-tab').forEach(function(t){
    t.classList.toggle('on', t.dataset.role === CODEX_ROLE);
  });
  document.querySelectorAll('#codex-sort .sortbtn').forEach(function(t){
    t.classList.toggle('on', t.dataset.sort === CODEX_SORT);
  });

  const r = ROLES[CODEX_ROLE];
  const box = $('codex-role'); box.innerHTML = '';
  const card = document.createElement('div'); card.className = 'role-card';
  const h = document.createElement('h3');
  h.style.color = r.color; h.textContent = r.icon + ' ' + r.name;
  const p = document.createElement('p'); p.textContent = r.desc;
  const st = document.createElement('div'); st.className = 'role-stats';
  [['傷害倍率', '×' + r.atk.toFixed(2)],
   ['血量倍率', '×' + r.hp.toFixed(2)],
   ['額外會心', '+' + Math.round(r.crit*100) + '%'],
   ['閃避率',   Math.round(r.eva*100) + '%'],
   ['命中修正', (r.acc >= 0 ? '+' : '') + r.acc]].forEach(function(row){
    const d = document.createElement('div'); d.className = 'rs';
    const i = document.createElement('i'); i.textContent = row[0];
    const b = document.createElement('b'); b.textContent = row[1];
    d.append(i, b); st.appendChild(d);
  });
  card.append(h, p, st); box.appendChild(card);

  let list = ALL_CHARACTERS.filter(function(c){
    return c.role === CODEX_ROLE && (!c.secret || UNLOCKED[c.id]);
  });
  const sorters = {
    power: function(a,b){ return (mainAtk(b).power||0) - (mainAtk(a).power||0); },
    hp:    function(a,b){ return b.hp - a.hp; },
    guard: function(a,b){ return guardVal(a) - guardVal(b); },
    acc:   function(a,b){ return (mainAtk(b).acc||0) - (mainAtk(a).acc||0); },
    name:  function(a,b){ return a.name.localeCompare(b.name, 'zh-Hant'); }
  };
  list = list.slice().sort(sorters[CODEX_SORT] || sorters.power);

  const grid = $('codex-list'); grid.innerHTML = '';
  list.forEach(function(c){
    const el = document.createElement('div');
    el.className = 'cx';
    el.style.setProperty('--uc', 'var(--u-' + c.universe + ')');

    const top = document.createElement('div'); top.className = 'cx-top';
    const im = document.createElement('img'); im.loading = 'lazy'; im.alt = c.name;
    bindImg(im, c);
    const nm = document.createElement('div'); nm.className = 'cx-name';
    const nb = document.createElement('b'); nb.textContent = c.name;
    const ns = document.createElement('span');
    ns.textContent = UNI_LABEL[c.universe] + '　總戰力 ' + battlePower(c);
    nm.append(nb, ns);
    top.append(im, nm);
    if(!c.isUpgrade){
      const pick = document.createElement('button');
      pick.className = 'cx-pick'; pick.textContent = '選這位';
      pick.onclick = function(){ codexPick(c); };
      top.appendChild(pick);
    }else{
      const tag = document.createElement('span');
      tag.className = 'cx-stage'; tag.textContent = '進化形態';
      el.appendChild(tag);
    }

    const bars = document.createElement('div'); bars.className = 'cx-bars';
    const cam = mainAtk(c) || {power:0, acc:100};
    const hard = Math.round((1 - guardVal(c)) * 100);
    [['血量', c.hp, (c.hp-400)/900, '#34d399', c.hp],
     ['威力', cam.power, (cam.power-50)/55, '#ff6f8e', cam.power],
     ['硬度', hard, (hard-30)/60, '#5ab8ff', hard + '%'],
     ['命中', cam.acc, (cam.acc-60)/40, '#ffc533', cam.acc + '%']
    ].forEach(function(row){
      const d = document.createElement('div'); d.className = 'cxb';
      const i = document.createElement('i'); i.textContent = row[0];
      const u = document.createElement('u'); const f = document.createElement('b');
      f.style.width = Math.round(clamp(row[2], 0.06, 1) * 100) + '%';
      f.style.background = row[3];
      u.appendChild(f);
      const e = document.createElement('em'); e.textContent = row[4];
      d.append(i, u, e); bars.appendChild(d);
    });

    const txt = document.createElement('div'); txt.className = 'cx-txt';
    const sk = mainSkill(c);
    const l1 = document.createElement('div');
    if(sk){
      l1.innerHTML = '<b>特技</b>　';
      l1.append(document.createTextNode(sk.name + '：' + skillText(sk.effect, c.role)));
    }else{
      const extras = movesOf(c,'atk').slice(1);
      l1.innerHTML = '<b>招式</b>　';
      l1.append(document.createTextNode(
        extras.length ? extras.map(function(m){ return m.name; }).join('／') : '（僅有主要招式）'));
    }
    txt.appendChild(l1);
    if(c.ability){
      const l2 = document.createElement('div');
      l2.innerHTML = '<b>能力</b>　';
      l2.append(document.createTextNode(c.ability.name + '：' + (ABILITY_TEXT[c.ability.effect] || '')));
      txt.appendChild(l2);
    }else{
      const l2 = document.createElement('div');
      l2.textContent = '（第一階段，換乘後才有特色能力）';
      txt.appendChild(l2);
    }
    if(c.upgradeTo || c.forms){
      const up = (c.forms || [c.upgradeTo]).map(function(id){
        const f = ALL_CHARACTERS.filter(x=>x.id===id)[0];
        return f ? f.name : '';
      }).filter(Boolean).join('、');
      const l3 = document.createElement('div');
      l3.innerHTML = '<b>換乘</b>　';
      l3.append(document.createTextNode(up + '（' + awakenText(c) + '）'));
      txt.appendChild(l3);
    }

    const q = QUOTES[c.id];
    if(q){
      const l4 = document.createElement('div');
      l4.innerHTML = '<b>台詞</b>　';
      l4.append(document.createTextNode('「' + q[0] + '」'));
      txt.appendChild(l4);
    }
    el.append(top, bars, txt);
    grid.appendChild(el);
  });
}

function codexPick(c){
  if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
  const tab = Array.prototype.filter.call(document.querySelectorAll('#tabs .tab'),
              function(t){ return t.dataset.u === c.universe; })[0];
  if(tab) tab.classList.add('on');
  renderRoster(c.universe, 'universe');
  const card = Array.prototype.filter.call(document.querySelectorAll('.pick'),
               function(x){ return x.dataset.id === c.id; })[0];
  if(card){
    document.querySelectorAll('.pick').forEach(function(p){ p.classList.remove('on'); });
    card.classList.add('on');
  }
  selectCharacter(c);
  show('scr-select');
  if(card) scrollTo_(card, {behavior:'smooth', block:'center'});
  sfx('select');
}

/* 隨機挑一位角色：自動切到該陣營、選起來並捲到畫面中央 */
function pickRandom(){
  const pool = ALL_CHARACTERS.filter(c=>!c.isUpgrade && (!c.secret || UNLOCKED[c.id]));
  if(!pool.length) return;
  const c = pool[Math.floor(Math.random()*pool.length)];
  const tab = Array.prototype.filter.call(document.querySelectorAll('.tab'),
              function(t){ return t.dataset.u === c.universe; })[0];
  if(tab){
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
    tab.classList.add('on');
  }
  renderRoster(c.universe);
  const card = Array.prototype.filter.call(document.querySelectorAll('.pick'),
               function(x){ return x.dataset.id === c.id; })[0];
  if(card){
    document.querySelectorAll('.pick').forEach(function(p){ p.classList.remove('on'); });
    card.classList.add('on');
    scrollTo_(card, {behavior:'smooth', block:'center'});
  }
  selectCharacter(c);
  banner('RANDOM!', true); sfx('assist');
}

function renderRoster(filter, mode){
  rosterBuilt = true;
  mode = mode || 'universe';
  LAST_FILTER = {key:filter, mode:mode};
  const grid = $('roster'); grid.innerHTML = '';
  const keys = (mode === 'universe') ? (UNIVERSE_FILTER[filter] || null) : null;
  ALL_CHARACTERS.filter(function(c){
    if(c.isUpgrade) return false;
    if(c.secret && !UNLOCKED[c.id]) return false;
    if(mode === 'role') return c.role === filter;
    return !keys || keys.indexOf(c.universe) >= 0;
  }).forEach(c=>{
    const card = document.createElement('button');
    card.className = 'pick'; card.dataset.id = c.id;
    card.style.setProperty('--uc', 'var(--u-'+c.universe+')');
    const port = document.createElement('div'); port.className = 'pick-port';
    const img = document.createElement('img');
    img.alt = c.name; img.loading = 'lazy'; bindImg(img, c);
    port.appendChild(img);
    const pw = document.createElement('span');
    pw.className = 'pw'; pw.textContent = battlePower(c);
    port.appendChild(pw);
    if(c.upgradeTo || c.forms){
      const ev = document.createElement('span');
      ev.className = 'evo'; ev.textContent = c.forms ? '三形態' : '可進化';
      ev.title = awakenText(c);
      port.appendChild(ev);
    }
    const nm = document.createElement('b'); nm.textContent = c.name;
    const tp = document.createElement('small');
    tp.textContent = c.type + '　HP ' + c.hp;
    const r = roleOf(c);
    const rt = document.createElement('span');
    rt.className = 'role-tag'; rt.style.color = r.color;
    rt.textContent = r.icon + ' ' + r.name;
    card.append(port, nm, tp, rt);
    card.onclick = ()=>{
      document.querySelectorAll('.pick').forEach(p=>p.classList.remove('on'));
      card.classList.add('on'); selectCharacter(c); sfx('select');
    };
    card.onmouseenter = ()=>previewCharacter(c);
    card.onmouseleave = restorePreview;
    grid.appendChild(card);
  });

  // 未解鎖的隱藏角色，只在對應的陣營／定位分頁顯示成 ？？？ 卡片
  if(!grid.children.length && mode === 'role')
    rosterEmptyNote(grid, '這個定位目前沒有可選角色。');

  ALL_CHARACTERS.filter(c=>c.secret && !UNLOCKED[c.id]).forEach(c=>{
    if(mode === 'role'){ if(c.role !== filter) return; }
    else if(keys && keys.indexOf(c.universe) < 0) return;
    const card = document.createElement('button');
    card.className = 'pick locked';
    card.style.setProperty('--uc', 'var(--u-'+c.universe+')');
    const isCat = (CAT_BY_UNI[c.universe] === c.id);
    const port = document.createElement('div');
    port.className = 'pick-port' + (isCat ? ' cat-lock' : '');
    if(isCat){
      /* 明講牠是一隻貓——不知道有東西可拿，就不會有人想去拿 */
      const paw = document.createElement('div'); paw.className = 'cat-silhouette';
      paw.textContent = '🐈';
      const q = document.createElement('span'); q.className = 'cat-q'; q.textContent = '？';
      port.append(paw, q);
    }else{
      const img = document.createElement('img');
      img.alt = '？？？'; img.src = placeholderImg('？？？', c.universe);
      port.appendChild(img);
    }
    const nm = document.createElement('b');
    const tp = document.createElement('small');
    const rt = document.createElement('span');
    rt.className = 'role-tag'; rt.style.color = 'var(--gold)';

    if(isCat){
      const need = catQuota(c.universe), got = catProgress(c.universe);
      const left = Math.max(0, need - got);
      nm.textContent = '？？？貓';
      nm.style.color = 'var(--gold)';
      tp.textContent = '完整通關角色　' + got + ' / ' + need;
      rt.textContent = left ? ('🐾 還差 ' + left + ' 位') : '🐾 快解鎖了！';
      /* 進度條，讓「還差幾位」一眼看得出來 */
      const bar = document.createElement('div'); bar.className = 'cat-bar';
      const fill = document.createElement('i');
      fill.style.width = Math.round(Math.min(1, got / Math.max(1, need)) * 100) + '%';
      bar.appendChild(fill);
      card.onclick = ()=>{
        sfx('tap');
        alert('🐈 這個陣營藏著一隻貓。\n\n'
          + '牠比一般角色強一些，但不能進化，也不會有夥伴來合體。\n\n'
          + '── 解鎖方式 ──\n用「' + (UNI_LABEL[c.universe]||'') + '」的角色完整打完三個回合，\n'
          + '累積 ' + need + ' 位不同的角色即可。\n目前進度：' + got + ' / ' + need + '\n\n'
          + '（中途被擊倒或提早結束不算數）\n\n'
          + '七個陣營的貓全部收齊之後，\n之後不論用哪位角色，每場都能多用一次「直接解題」。');
      };
      card.append(port, nm, tp, bar, rt);
    }else{
      const img2 = document.createElement('img');
      nm.textContent = '？？？';
      tp.textContent = '？？？　HP ???';
      rt.textContent = '🔒 需要密碼';
      card.onclick = ()=>{ sfx('tap'); unlockSecret(); };
      card.append(port, nm, tp, rt);
    }
    grid.appendChild(card);
  });
}

/* 滑鼠移到角色卡時，下方預覽框先顯示那位角色 */
function previewCharacter(c){
  if(selected && selected.id === c.id) return;
  paintShowcase(c);
  bindImg($('dk-img'), c);
  $('dk-name').textContent = c.name;
  const r = roleOf(c);
  $('dk-info').textContent = r.icon + ' ' + r.name + '　' + r.desc;
}
function restorePreview(){
  if(selected) selectCharacter(selected);
  else{
    $('dk-img').src = placeholderImg('？', 'special');
    $('sc-img').src = placeholderImg('？', 'special');
    $('sc-role').textContent = '';
    $('sc-evo').hidden = true;
    $('sc-power').hidden = true;
    $('sc-quote').hidden = true;
    $('sc-name').textContent = '尚未選擇角色';
    $('sc-sub').textContent = '把滑鼠移到角色上可以先預覽，點一下選定出戰。';
    $('sc-moves').innerHTML = '';
    $('dk-name').textContent = '尚未選擇角色';
    $('dk-info').textContent = '把滑鼠移到角色上可以先預覽，點一下選定出戰';
  }
}

function rosterEmptyNote(grid, msg){
  const d = document.createElement('div');
  d.className = 'roster-empty'; d.textContent = msg;
  grid.appendChild(d);
}

function paintShowcase(c, locked){
  const r = roleOf(c);
  bindImg($('sc-img'), c);
  const rt = $('sc-role');
  rt.textContent = r.icon + ' ' + r.name; rt.style.color = r.color;
  $('sc-name').textContent = c.name;
  $('sc-sub').textContent = UNI_LABEL[c.universe] + '　' + c.type + '　HP ' + c.hp + '　' + r.desc;

  const evo = $('sc-evo');
  if(c.upgradeTo || c.forms){
    evo.hidden = false;
    evo.textContent = (c.forms ? '✦ 多形態' : '✦ 可換乘') + '　' + awakenText(c);
  }else evo.hidden = true;

  const pw = $('sc-power');
  pw.hidden = false;
  $('sc-power-n').textContent = battlePower(c).toLocaleString();

  const q = QUOTES[c.id] || [];
  const qb = $('sc-quote');
  if(q[0]){ qb.hidden = false; qb.textContent = '「' + q[0] + '」'; }
  else qb.hidden = true;

  if(locked){
    const art = $('sc-art');
    art.classList.remove('locked');
    void art.offsetWidth;
    art.classList.add('locked');
  }

  const box = $('sc-moves'); box.innerHTML = '';
  const rows = [];
  c.moves.forEach(function(m){
    if(isAtkKind(m.kind)){
      rows.push([m.kind === 'aoe' ? 'aoe' : 'attack', kindLabel(m), m.name,
        (m.kind === 'aoe' ? '群體攻擊　' : '') + '威力 ' + m.power + '　命中 ' + m.acc + '%',
        rows.length ? '' : q[0]]);
    }else if(m.kind === 'guard'){
      rows.push(['guard','防禦', m.name,
        '減傷至 ' + Math.round(m.defense*100) + '%，有機會反擊', q[1]]);
    }else{
      rows.push(['skill','特技', m.name, skillText(m.effect, c.role), q[2]]);
    }
  });
  if(c.ability) rows.push(['ability','必殺', c.ability.name,
                           ABILITY_TEXT[c.ability.effect] || '', q[3]]);
  else rows.push(['ability','必殺', '（換乘後取得）', '第一階段角色沒有特色能力', '']);
  rows.forEach(function(row){
    const d = document.createElement('div'); d.className = 'sc-mv k-' + row[0];
    const tag = document.createElement('em'); tag.textContent = row[1];
    const nb = document.createElement('b'); nb.textContent = row[2];
    const sp = document.createElement('span'); sp.textContent = row[3];
    d.append(tag, nb, sp);
    if(row[4]){ const qq = document.createElement('q'); qq.textContent = '「' + row[4] + '」'; d.appendChild(qq); }
    box.appendChild(d);
  });
}

function selectCharacter(c){
  selected = c;
  paintShowcase(c, true);
  sfx('select');
  bindImg($('dk-img'), c);
  $('dk-name').textContent = c.name;
  const r = roleOf(c);
  $('dk-info').textContent = r.icon + ' ' + r.name + '　' + r.desc;
  const st = $('dk-stats'); st.innerHTML = '';
  [['攻擊', r.atk/1.3, '#ff6f8e'], ['血量', c.hp/1100, '#34d399'],
   ['會心', (0.12+r.crit)/0.30, '#ffc533'], ['閃避', r.eva/0.20, '#5ab8ff']].forEach(function(row){
    const d = document.createElement('div'); d.className='stat';
    const lb = document.createElement('span'); lb.textContent = row[0];
    const tr = document.createElement('span'); tr.className='track';
    const fi = document.createElement('i');
    fi.style.width = Math.round(clamp(row[1],0.08,1)*100)+'%';
    fi.style.background = row[2];
    tr.appendChild(fi); d.append(lb,tr); st.appendChild(d);
  });
  const mv = $('dk-moves'); mv.innerHTML = '';
  c.moves.forEach(m=>{
    const d = document.createElement('div'); d.className = 'mv-chip';
    const b = document.createElement('b'); b.textContent = m.name;
    let txt = '';
    if(isAtkKind(m.kind)) txt = kindLabel(m) + '　威力 ' + m.power + '｜命中 ' + m.acc + '%';
    else if(m.kind === 'guard') txt = '防禦　減傷至 ' + Math.round(m.defense*100) + '%';
    else txt = '特技　' + skillText(m.effect, c.role);
    d.append(b, document.createTextNode(txt));
    mv.appendChild(d);
  });
  if(c.ability){
    const d = document.createElement('div'); d.className = 'mv-chip ab';
    const b = document.createElement('b'); b.textContent = '★ ' + c.ability.name;
    d.append(b, document.createTextNode(ABILITY_TEXT[c.ability.effect] || ''));
    mv.appendChild(d);
  }
  $('btn-start').disabled = false;
}
