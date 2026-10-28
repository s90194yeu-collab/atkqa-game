/* 【23-growth.js】成長系統：熟練度、典故卡、成就、全班討伐、錯題道場、每週活動
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   成長系統
   ── 題型熟練度：每個題型全對越多題，等級越高；出到該題型時，出招傷害小幅加成
   ── 典故卡：用角色完整打完三回合就解鎖他的招式典故，通關 3／5 次升銀框／金框
   ── 成就徽章：18 個，存在試算表「成長」工作表
   ── 全班討伐：每一課、每一班一隻共用的討伐目標，全班的作答累計成傷害
   ── 每週活動：老師在「活動」工作表填寫，開放期間自動生效
   ── 錯題道場：錯題本裡的題目變成菁英怪，訂正成功就從錯題本移除
   這些都是外加的成長層，戰鬥的核心數值完全沒動。
   ========================================================================== */
const MASTERY = {
  cats: ['A1_形音義','A2_成語詞語','A3_語法修辭','A4_排序與填空',
         'A5_作家與國學常識','A6_諸子與文化常識','B1_文言文課內理解','B2_白話文課內理解'],
  steps: [0, 5, 15, 30, 50, 80],      // Lv1～Lv5 需要的累計全對題數
  dmgPerLv: 0.03                      // 每一級：這類題目出招傷害 +3%（Lv5 為 +15%）
};
const CAT_ICON = {
  'A1_形音義':'🔤', 'A2_成語詞語':'📚', 'A3_語法修辭':'🧩', 'A4_排序與填空':'🧱',
  'A5_作家與國學常識':'🏛️', 'A6_諸子與文化常識':'☯️', 'B1_文言文課內理解':'📜', 'B2_白話文課內理解':'📖'
};
const CAT_SHORT = {
  'A1_形音義':'形音義', 'A2_成語詞語':'成語詞語', 'A3_語法修辭':'語法修辭', 'A4_排序與填空':'排序填空',
  'A5_作家與國學常識':'作家國學', 'A6_諸子與文化常識':'諸子文化', 'B1_文言文課內理解':'文言理解', 'B2_白話文課內理解':'白話理解'
};
const CARD_TIERS = [{n:5, k:'gold', t:'金框'}, {n:3, k:'silver', t:'銀框'}, {n:1, k:'bronze', t:'銅框'}];
const RAID_REWARD_SP = 5;             // 全班討伐成功：這一課開場 SP +5
const DOJO_MAX = 20;                  // 錯題道場一次最多 20 題
const ACHIEVEMENTS = [
  {id:'first_game',    icon:'🌱', name:'初出茅廬', desc:'完整打完第一場三回合'},
  {id:'streak10',      icon:'🔥', name:'十連全對', desc:'單場連續全對 10 題'},
  {id:'perfect_round', icon:'💯', name:'完美回合', desc:'一個回合的題目全部全對'},
  {id:'iron',          icon:'🛡️', name:'毫髮無傷', desc:'打完三回合時體力還有 80% 以上'},
  {id:'hard_clear',    icon:'⚔️', name:'以一敵三', desc:'困難模式完整打完三回合'},
  {id:'slayer',        icon:'💥', name:'萬夫莫敵', desc:'單場擊破 6 名以上敵人'},
  {id:'comeback',      icon:'🔄', name:'捲土重來', desc:'戰敗後再起，仍完整打完三回合'},
  {id:'spirit',        icon:'🌀', name:'精神領袖', desc:'單場使用精神指令 8 次'},
  {id:'awaken',        icon:'🦋', name:'破繭',     desc:'在戰鬥中換乘或變形'},
  {id:'all_cats',      icon:'🐾', name:'七貓之主', desc:'解鎖全部七隻貓'},
  {id:'scholar',       icon:'🎓', name:'博學',     desc:'八大題型都達到 Lv1'},
  {id:'master',        icon:'👑', name:'一代宗師', desc:'任一題型達到 Lv5'},
  {id:'hundred',       icon:'🗡️', name:'百題斬',   desc:'累計全對 100 題'},
  {id:'clans',         icon:'🏳️', name:'群英薈萃', desc:'七個陣營各有一位角色完整通關'},
  {id:'collector',     icon:'🃏', name:'典藏家',   desc:'收集 20 張典故卡'},
  {id:'golden',        icon:'🌟', name:'金框收藏', desc:'任一張典故卡升到金框'},
  {id:'dojo10',        icon:'💎', name:'錯題剋星', desc:'在錯題道場訂正 10 題'},
  {id:'raid',          icon:'🏆', name:'討伐英雄', desc:'全班討伐成功，而且你有出力'}
];

let GROWTH = {mastery:{}, ach:{}, cards:{}, stats:{}, guest:true, loaded:false};
let EVENTS = [];
let RAID = {};                 // 課程ID → 討伐狀態
let DOJO_ITEMS = null;         // 錯題本（null＝還沒讀）
let DOJO_MAP = {};
let PENDING_MODE = 'normal';   // 下一場要打的模式：normal／dojo

function todayKey(){
  const d = new Date();
  return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
}
function curLessonId(){ return currentLesson ? currentLesson.id : 'default'; }

/* ── 題型熟練度 ── */
function catKeyOf(c){
  c = String(c || '');
  if(MASTERY.cats.indexOf(c) >= 0) return c;
  return MASTERY.cats.filter(function(k){ const p = k.split('_'); return p[0] === c || p[1] === c; })[0] || '';
}
function lvOfOk(ok){
  let lv = 0;
  MASTERY.steps.forEach(function(s, i){ if(ok >= s) lv = i; });
  return lv;
}
function masteryOk(cat){ const m = GROWTH.mastery[catKeyOf(cat)]; return m ? (m.ok || 0) : 0; }
function masteryLv(cat){ return catKeyOf(cat) ? lvOfOk(masteryOk(cat)) : 0; }
function totalFull(){
  return MASTERY.cats.reduce(function(s, c){ return s + masteryOk(c); }, 0);
}
/* 每答完一題就在本機累加，升級時當場告訴學生 */
function addMastery(cat, full){
  const k = catKeyOf(cat);
  if(!k) return;
  const m = GROWTH.mastery[k] || (GROWTH.mastery[k] = {n:0, ok:0});
  const before = lvOfOk(m.ok || 0);
  m.n = (m.n || 0) + 1;
  if(full) m.ok = (m.ok || 0) + 1;
  const after = lvOfOk(m.ok);
  if(after > before){
    const name = k.split('_')[1];
    S.lvUps.push(name + ' Lv' + after);
    log('📗 「' + name + '」熟練度升到 Lv' + after + '！這類題目出招傷害 +' +
        Math.round(after * MASTERY.dmgPerLv * 100) + '%', 'var(--jade)');
    banner(CAT_SHORT[k] + ' Lv' + after + '!', true);
  }
}

/* ── 每週活動 ── */
function splitKV(v){
  v = String(v || '');
  const i = v.search(/[:：]/);
  if(i < 0) return ['', parseFloat(v) || 0];
  return [v.slice(0, i).trim(), parseFloat(v.slice(i + 1)) || 0];
}
function eventScoreMul(){
  let m = 1;
  EVENTS.forEach(function(ev){
    if(ev.code !== 'score') return;
    const kv = splitKV(ev.value);
    if(kv[0] && kv[0] !== curLessonId()) return;
    m *= clamp(kv[1] || 1, 1, 3);
  });
  return m;
}
/* 我方出招的額外倍率：題型熟練度 × 活動加成。只在 damage() 裡、攻擊方是玩家時使用 */
function growthDmgMul(move){
  let m = 1;
  if(S.current){
    const lv = masteryLv(S.current.cat);
    if(lv) m *= 1 + lv * MASTERY.dmgPerLv;
  }
  EVENTS.forEach(function(ev){
    const kv = splitKV(ev.value), pct = clamp(kv[1], 0, 100) / 100;
    if(ev.code === 'elem' && move && (move.type === kv[0] || BREATH[move.type] === kv[0])) m *= 1 + pct;
    if(ev.code === 'clan' && S.player && S.player.universe === (UNI_BY_LABEL[kv[0]] || kv[0])) m *= 1 + pct;
  });
  return m;
}
/* 開場時生效的活動與全班討伐獎勵 */
function applyStartBonuses(){
  EVENTS.forEach(function(ev){
    if(ev.code === 'sp'){
      const n = clamp(parseInt(ev.value, 10) || 0, 0, 20);
      if(n){ S.sp += n; log('🎪 活動「' + ev.name + '」：開場 SP +' + n, 'var(--grape)'); }
    }else if(ev.code === 'hp'){
      const p = clamp(parseFloat(ev.value) || 0, 0, 50);
      if(p){
        S.player.maxHp = Math.round(S.player.maxHp * (1 + p / 100));
        S.player.hp = S.player.maxHp;
        log('🎪 活動「' + ev.name + '」：體力 +' + p + '%', 'var(--grape)');
      }
    }else{
      log('🎪 活動「' + ev.name + '」：' + (ev.desc || ev.value), 'var(--grape)');
    }
  });
  const r = RAID[curLessonId()];
  if(S.mode === 'normal' && r && r.defeated){
    S.sp += RAID_REWARD_SP;
    log('🏆 全班已討伐「' + r.name + '」：開場 SP +' + RAID_REWARD_SP, 'var(--gold)');
  }
}

/* ── 典故卡 ── */
function cardIds(){
  return ALL_CHARACTERS.filter(function(c){ return !c.isUpgrade && CHARACTER_LORE[c.id]; })
                       .map(function(c){ return c.id; });
}
/* 改版前就通關過的角色（CLEARED）直接算有一張銅框 */
function cardClears(id){ return Math.max(Number(GROWTH.cards[id]) || 0, CLEARED[id] ? 1 : 0); }
function tierOfN(n){ return CARD_TIERS.filter(function(t){ return n >= t.n; })[0] || null; }
function cardTier(id){ return tierOfN(cardClears(id)); }
function cardCount(){ return cardIds().filter(function(id){ return cardClears(id) > 0; }).length; }
/* 訪客沒有收集系統，典故全部開放 */
function loreUnlocked(id){ return GROWTH.guest || !GROWTH.loaded || cardClears(id) > 0; }

/* ── 成就 ── */
function clansCleared(){
  const done = {};
  ALL_CHARACTERS.forEach(function(c){
    if(!c.isUpgrade && c.universe !== 'special' && cardClears(c.id) > 0) done[c.universe] = 1;
  });
  return Object.keys(done).length;
}
function evalAchievements(game){
  const got = [];
  const add = function(id){ if(!GROWTH.ach[id] && got.indexOf(id) < 0) got.push(id); };
  if(game){
    if(game.fullRun) add('first_game');
    if(S.maxStreak >= 10) add('streak10');
    if(S.perfectRounds >= 1) add('perfect_round');
    if(game.fullRun && game.hpPct >= 80) add('iron');
    if(game.fullRun && S.difficulty === 'hard') add('hard_clear');
    if(S.kos >= 6) add('slayer');
    if(game.fullRun && S.defeats > 0) add('comeback');
    if(S.spiritCasts >= 8) add('spirit');
    if(S.awakened) add('awaken');
  }
  if(allCatsUnlocked()) add('all_cats');
  const lvs = MASTERY.cats.map(masteryLv);
  if(lvs.every(function(l){ return l >= 1; })) add('scholar');
  if(lvs.some(function(l){ return l >= 5; })) add('master');
  if(totalFull() >= 100) add('hundred');
  if(clansCleared() >= 7) add('clans');
  if(cardCount() >= 20) add('collector');
  if(cardIds().some(function(id){ return cardClears(id) >= 5; })) add('golden');
  if((Number(GROWTH.stats.dojoFixed) || 0) >= 10) add('dojo10');
  const r = RAID[curLessonId()];
  if(r && r.defeated && r.me > 0) add('raid');
  return got;
}
/* 寫回試算表；回傳值以伺服器為準（避免兩台裝置互相覆蓋） */
function pushGrowth(patch){
  const ids = Object.keys(patch.ach || {});
  ids.forEach(function(id){ GROWTH.ach[id] = todayKey(); });
  if(!inGAS || GROWTH.guest) return;
  google.script.run
    .withSuccessHandler(function(r){
      if(r && r.ok){ GROWTH.ach = r.ach || GROWTH.ach; GROWTH.cards = r.cards || GROWTH.cards; GROWTH.stats = r.stats || GROWTH.stats; }
      paintGrowth();
    })
    .withFailureHandler(function(){})
    .saveGrowth(patch);
}
/* 累積型成就（例如七貓、博學）不一定在戰鬥中達成，回首頁時補檢查一次 */
function syncCumulativeAch(){
  if(!GROWTH.loaded || GROWTH.guest) return;
  const got = evalAchievements(null);
  if(!got.length) return;
  const ach = {}; got.forEach(function(id){ ach[id] = 1; });
  pushGrowth({ach: ach});
}

/* ── 讀取 ── */
function loadGrowth(){
  if(!inGAS){ GROWTH.loaded = true; paintGrowth(); return; }
  google.script.run
    .withSuccessHandler(function(g){
      g = g || {};
      GROWTH = {mastery: g.mastery || {}, ach: g.ach || {}, cards: g.cards || {}, stats: g.stats || {},
                guest: !!g.guest, loaded: true};
      paintGrowth(); syncCumulativeAch();
    })
    .withFailureHandler(function(){ GROWTH.loaded = true; paintGrowth(); })
    .getGrowth();
}
function loadEvents(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(list){ EVENTS = Array.isArray(list) ? list : []; paintEvents(); })
    .withFailureHandler(function(){})
    .getEvents();
}
function loadRaid(){
  if(!inGAS) return;
  const id = curLessonId();
  google.script.run
    .withSuccessHandler(function(r){ if(r){ RAID[id] = r; if(id === curLessonId()) paintRaid(); } })
    .withFailureHandler(function(){})
    .getRaid(id);
}
function loadDojo(cb){
  if(!inGAS){ DOJO_ITEMS = []; if(cb) cb(); return; }
  google.script.run
    .withSuccessHandler(function(wb){ DOJO_ITEMS = (wb && wb.items) || []; paintGrowth(); if(cb) cb(); })
    .withFailureHandler(function(){ if(cb) cb(); })
    .getWrongBook();
}

/* ── 首頁：活動橫幅 ── */
function paintEvents(){
  const box = $('event-strip');
  if(!box) return;
  box.innerHTML = '';
  box.hidden = !EVENTS.length;
  EVENTS.forEach(function(ev){
    const d = document.createElement('div'); d.className = 'ev';
    const b = document.createElement('b'); b.textContent = '🎪 ' + ev.name;
    const s = document.createElement('span');
    s.textContent = (ev.desc || ev.value) + (ev.end ? '　至 ' + ev.end.slice(5).replace('-', '/') : '');
    d.append(b, s); box.appendChild(d);
  });
}

/* ── 首頁：我的成長 ── */
function paintGrowth(){
  const box = $('growth-box');
  if(!box) return;
  box.hidden = false;
  $('growth-sum').textContent = GROWTH.guest ? '登入學校帳號才會保存' : ('累計全對 ' + totalFull() + ' 題');

  const grid = $('mastery-grid'); grid.innerHTML = '';
  MASTERY.cats.forEach(function(k){
    const ok = masteryOk(k), lv = lvOfOk(ok);
    const next = MASTERY.steps[lv + 1];
    const base = MASTERY.steps[lv];
    const d = document.createElement('div'); d.className = 'ms lv' + lv;
    const top = document.createElement('div'); top.className = 'ms-top';
    const nm = document.createElement('b'); nm.textContent = CAT_ICON[k] + ' ' + CAT_SHORT[k];
    const lb = document.createElement('em'); lb.textContent = 'Lv' + lv;
    top.append(nm, lb);
    const bar = document.createElement('u'); const fill = document.createElement('i');
    fill.style.width = (next ? Math.round((ok - base) / (next - base) * 100) : 100) + '%';
    bar.appendChild(fill);
    const tx = document.createElement('small');
    tx.textContent = next ? ('全對 ' + ok + '／' + next + ' 升級') : ('全對 ' + ok + '　已滿級');
    d.append(top, bar, tx);
    d.title = '出到這類題目時，出招傷害 +' + Math.round(lv * MASTERY.dmgPerLv * 100) + '%';
    grid.appendChild(d);
  });

  const shelf = $('ach-shelf'); shelf.innerHTML = '';
  let n = 0;
  ACHIEVEMENTS.forEach(function(a){
    const got = !!GROWTH.ach[a.id];
    if(got) n++;
    const b = document.createElement('button');
    b.className = 'ach' + (got ? ' got' : '');
    b.textContent = a.icon;
    b.setAttribute('aria-label', a.name);
    b.onclick = function(){
      shelf.querySelectorAll('.ach').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      $('ach-detail').innerHTML = '';
      const t = document.createElement('b'); t.textContent = a.icon + ' ' + a.name;
      const s = document.createElement('span');
      s.textContent = a.desc + (got ? '　✓ ' + GROWTH.ach[a.id] + ' 達成' : '　（尚未達成）');
      $('ach-detail').append(t, s);
      sfx('tap');
    };
    shelf.appendChild(b);
  });
  $('ach-count').textContent = n + ' / ' + ACHIEVEMENTS.length;
  $('cards-count').textContent = cardCount() + ' / ' + cardIds().length;
  $('dojo-count').textContent = DOJO_ITEMS === null ? '' : (DOJO_ITEMS.length + ' 題');
}

/* ── 首頁：全班討伐 ── */
function raidBossOf(lessonId){
  const pool = ALL_CHARACTERS.filter(function(c){ return !c.isUpgrade && !c.secret; });
  let h = 0;
  String(lessonId).split('').forEach(function(ch){ h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
  return pool[h % pool.length];
}
function paintRaid(){
  const box = $('raid-box');
  if(!box) return;
  const r = RAID[curLessonId()];
  if(!r || r.off){ box.hidden = true; return; }
  box.hidden = false;
  $('raid-cls').textContent = r.cls === '未分班' ? '未分班' : (r.cls + ' 班');
  const boss = raidBossOf(curLessonId());
  if(boss) bindImg($('raid-img'), boss);
  $('raid-name').textContent = r.name;
  const left = Math.max(0, r.hp - r.dmg);
  const pct = r.hp ? clamp(left / r.hp * 100, 0, 100) : 0;
  $('raid-fill').style.width = pct + '%';
  $('raid-hp').textContent = r.defeated ? '討伐成功！' : (left.toLocaleString() + ' / ' + r.hp.toLocaleString());
  box.classList.toggle('down', !!r.defeated);
  $('raid-info').textContent = '全班 ' + r.joined + ' 人出戰，累計 ' + r.dmg.toLocaleString() + ' 點傷害' +
    (r.guest ? '' : '　你出了 ' + r.me.toLocaleString() + ' 點');
  const top = $('raid-top'); top.innerHTML = '';
  (r.top || []).forEach(function(t, i){
    const s = document.createElement('span'); s.className = t.me ? 'me' : '';
    s.textContent = ['🥇','🥈','🥉'][i] + ' ' + t.id + '　' + t.dmg;
    top.appendChild(s);
  });
  $('raid-reward').textContent = r.defeated
    ? '🏆 獎勵生效中：這一課開場 SP +' + RAID_REWARD_SP
    : '全對一題造成 10 點傷害。打倒後，全班在這一課開場 SP +' + RAID_REWARD_SP + '。';
}

/* ── 典故圖鑑 ── */
let CARD_FILTER = 'all';
function openCards(){
  const tabs = $('cards-tabs');
  if(!tabs.children.length){
    [{k:'all', label:'全部'}].concat(UNIVERSES).forEach(function(u, i){
      const b = document.createElement('button');
      b.className = 'tab' + (i === 0 ? ' on' : ''); b.dataset.u = u.k === 'all' ? '' : u.k;
      b.textContent = u.label;
      b.onclick = function(){
        tabs.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
        b.classList.add('on'); CARD_FILTER = u.k; renderCards(); sfx('tap');
      };
      tabs.appendChild(b);
    });
  }
  renderCards();
  show('scr-cards');
}
function renderCards(){
  const grid = $('card-grid'); grid.innerHTML = '';
  const ids = cardIds();
  $('cards-tag').textContent = '已收集 ' + cardCount() + ' / ' + ids.length;
  ids.forEach(function(id){
    const c = ALL_CHARACTERS.filter(function(x){ return x.id === id; })[0];
    if(!c || (CARD_FILTER !== 'all' && c.universe !== CARD_FILTER)) return;
    const n = cardClears(id), tier = cardTier(id);
    const hidden = c.secret && !UNLOCKED[id];
    const b = document.createElement('button');
    b.className = 'lcard' + (tier ? ' ' + tier.k : ' locked');
    b.style.setProperty('--uc', 'var(--u-' + c.universe + ')');
    const port = document.createElement('div'); port.className = 'lcard-port';
    const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
    if(hidden) img.src = placeholderImg('？？？', c.universe); else bindImg(img, c);
    port.appendChild(img);
    if(tier){ const t = document.createElement('em'); t.textContent = tier.t; port.appendChild(t); }
    const nm = document.createElement('b'); nm.textContent = hidden ? '？？？' : c.name;
    const tx = document.createElement('small');
    tx.textContent = n ? ('通關 ' + n + ' 次') : '🔒 完整通關一次解鎖';
    b.append(port, nm, tx);
    b.onclick = function(){ if(!hidden) openCardDetail(c); sfx('tap'); };
    grid.appendChild(b);
  });
}
function openCardDetail(c){
  const lore = CHARACTER_LORE[c.id] || {};
  const n = cardClears(c.id), tier = cardTier(c.id), open = n > 0 || GROWTH.guest;
  const box = $('card-detail');
  box.className = 'cond-card card-detail' + (tier ? ' ' + tier.k : '');
  bindImg($('cd-img'), c);
  $('cd-name').textContent = c.name;
  $('cd-sub').textContent = (UNI_LABEL[c.universe] || '') + '　' + roleOf(c).name + '　' +
    (tier ? tier.t + '・通關 ' + n + ' 次' : '尚未解鎖');
  $('cd-bio').textContent = lore.bio || '';
  const mv = $('cd-moves'); mv.innerHTML = '';
  const entries = Object.keys(lore.moves || {});
  if(open){
    entries.forEach(function(k){
      const d = document.createElement('div'); d.className = 'lore-mv';
      const b = document.createElement('b'); b.textContent = k + '：';
      d.append(b, document.createTextNode(lore.moves[k]));
      mv.appendChild(d);
    });
  }else{
    const d = document.createElement('div'); d.className = 'lore-lock';
    d.textContent = '🔒 招式典故 ' + entries.length + ' 則：用' + c.name + '完整打完三回合就能解鎖。';
    mv.appendChild(d);
  }
  const q = (QUOTES[c.id] || [])[0];
  $('cd-quote').hidden = !q;
  $('cd-quote').textContent = q ? '「' + q + '」' : '';
  const next = CARD_TIERS.slice().reverse().filter(function(t){ return n < t.n; })[0];
  $('cd-next').textContent = next ? ('再通關 ' + (next.n - n) + ' 次升到' + next.t) : '已經是最高等級的金框';
  box.hidden = false;
}

/* ── 錯題道場 ── */
function startDojo(){
  if(!inGAS || !(ME && ME.allowed)){ alert('錯題道場需要用學校帳號登入，才讀得到你的錯題本。'); return; }
  const go = function(){
    if(!DOJO_ITEMS || !DOJO_ITEMS.length){ alert('錯題本是空的——目前沒有需要訂正的題目，太強了！'); return; }
    PENDING_MODE = 'dojo';
    if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
    $('lesson-tag').textContent = '⚔️ 錯題道場：' + Math.min(DOJO_MAX, DOJO_ITEMS.length) + ' 題';
    show('scr-select'); sfx('tap');
  };
  if(DOJO_ITEMS === null){ $('dojo-count').textContent = '讀取中…'; loadDojo(go); }
  else go();
}
/* 道場的題庫：錯題本裡的題目（不同課的同一題號要分開，所以用 課程ID|題號 當編號） */
function dojoBank(){
  DOJO_MAP = {};
  return (DOJO_ITEMS || []).slice(0, DOJO_MAX).map(function(it){
    const key = it.key || ((it.lessonId || 'default') + '|' + it.id);
    DOJO_MAP[key] = it;
    return {id: key, q: it.q, options: it.options, answer: it.answer, exp: it.exp, cat: it.cat};
  });
}
function dojoResolved(){
  const it = DOJO_MAP[S.current && S.current.id];
  if(S.charge < 1 || !it || it._fixed) return;
  it._fixed = true; S.dojoFixed++;
  log('💎 訂正成功！這一題已從錯題本移除。', 'var(--jade)');
  if(inGAS) google.script.run.withFailureHandler(function(){}).markCorrected(it.id, it.cat || '', it.lessonId || '');
}

/* ── 一場結束：結算成長 ── */
function settleGrowth(fullRun, hpPct, wasCleared){
  const news = {card:null, ach:[], lv:S.lvUps.slice(), raid:Math.round(S.raidDmg)};
  const patch = {ach:{}, cards:{}, stats:{games:1}};
  GROWTH.stats.games = (Number(GROWTH.stats.games) || 0) + 1;
  if(fullRun){
    patch.stats.fullRuns = 1;
    GROWTH.stats.fullRuns = (Number(GROWTH.stats.fullRuns) || 0) + 1;
    const base = (S.player && S.player.baseId) || (S.player && S.player.id);
    if(base && CHARACTER_LORE[base]){
      const stored = Number(GROWTH.cards[base]) || 0;
      const before = tierOfN(Math.max(stored, wasCleared ? 1 : 0));
      /* 改版前通關過（只記在 CLEARED）的角色，這一場算第二次 */
      const legacy = (stored === 0 && wasCleared);
      GROWTH.cards[base] = legacy ? 2 : stored + 1;
      patch.cards[base] = legacy ? 2 : 1;
      const after = cardTier(base);
      news.card = {c: ALL_CHARACTERS.filter(function(x){ return x.id === base; })[0],
                   first: !before, tier: after, up: !!(before && after && before.k !== after.k)};
    }
  }
  const got = evalAchievements({fullRun: fullRun, hpPct: hpPct});
  got.forEach(function(id){ patch.ach[id] = 1; });
  news.ach = got;
  pushGrowth(patch);
  return news;
}
/* 結算畫面的「這一場的收穫」 */
function paintGrowthNote(news){
  const box = $('growth-note');
  box.innerHTML = '';
  const rows = [];
  if(news.card && news.card.c){
    if(news.card.first) rows.push(['🃏', '解鎖典故卡', news.card.c.name + '（可在首頁「典故圖鑑」閱讀招式典故）']);
    else if(news.card.up) rows.push(['🃏', '典故卡升級', news.card.c.name + ' → ' + news.card.tier.t]);
  }
  news.ach.forEach(function(id){
    const a = ACHIEVEMENTS.filter(function(x){ return x.id === id; })[0];
    if(a) rows.push([a.icon, '新成就', a.name + '：' + a.desc]);
  });
  news.lv.forEach(function(t){ rows.push(['📗', '熟練度升級', t]); });
  if(news.raid > 0) rows.push(['⚔️', '討伐貢獻', '這一場對全班討伐目標造成 ' + news.raid + ' 點傷害' +
                                (ME && ME.allowed ? '（送出成績後計入）' : '（登入學校帳號才會計入）')]);
  if(news.dojo !== undefined) rows.unshift(['💎', '錯題訂正', '這一場訂正了 ' + news.dojo + ' 題']);
  box.hidden = !rows.length;
  if(!rows.length) return;
  const h = document.createElement('h4'); h.textContent = '這一場的收穫';
  box.appendChild(h);
  rows.forEach(function(r){
    const d = document.createElement('div'); d.className = 'gn';
    const i = document.createElement('i'); i.textContent = r[0];
    const t = document.createElement('div');
    const b = document.createElement('b'); b.textContent = r[1];
    const s = document.createElement('span'); s.textContent = r[2];
    t.append(b, s); d.append(i, t); box.appendChild(d);
  });
  if(news.ach.length){ setTimeout(function(){ banner('ACHIEVEMENT!', true); sfx('awaken'); }, 700); }
}
/* 錯題道場的結算：不計學期積分，只記訂正與成長 */
function endDojo(win){
  const total = Object.keys(DOJO_MAP).length;
  GROWTH.stats.dojoFixed = (Number(GROWTH.stats.dojoFixed) || 0) + S.dojoFixed;
  const patch = {ach:{}, cards:{}, stats:{dojoFixed: S.dojoFixed, dojoRuns: 1}};
  const got = evalAchievements({fullRun:false, hpPct:0});
  got.forEach(function(id){ patch.ach[id] = 1; });
  pushGrowth(patch);
  DOJO_ITEMS = null;                       // 錯題本變了，下次重新讀

  const v = $('verdict');
  v.className = 'verdict win';
  v.textContent = '💎 道場修行完成';
  $('total-score').textContent = S.dojoFixed + ' / ' + total;
  $('total-score').nextElementSibling.textContent = '題訂正';
  $('unlock-note').hidden = true;
  $('breakdown').innerHTML = '';
  [['訂正成功', S.dojoFixed + ' 題'],
   ['還要再練', Math.max(0, total - S.dojoFixed) + ' 題'],
   ['作答題數', S.totalAnswered + ' 題'],
   ['最高連續全對', S.maxStreak + ' 題'],
   ['擊破菁英', S.kos + ' 名'],
   ['精神指令', S.spiritCasts + ' 次']].forEach(function(row){
    const d = document.createElement('div'); d.className = 'brow';
    const a = document.createElement('span'); a.textContent = row[0];
    const b = document.createElement('b'); b.textContent = row[1];
    d.append(a, b); $('breakdown').appendChild(d);
  });
  paintGrowthNote({card:null, ach:got, lv:S.lvUps.slice(), raid:0, dojo:S.dojoFixed});
  $('save-box').hidden = true;
  $('board').hidden = true;
  $('rank-box').hidden = true;
  $('sem-result').hidden = false;
  $('sem-result-text').textContent = '錯題道場不計學期積分。訂正成功的題目已經從錯題本移除，學習分析頁也會同步更新。';
  show('scr-result');
  sfx('win');
}
