/* 【duel/02-duel-lobby.js】雙人對戰：進入、大廳、配對、房號、組隊、結算 */

function duelView(name){
  document.querySelectorAll('#scr-duel .duel-view').forEach(function(v){ v.classList.toggle('on', v.dataset.view === name); });
  DU.view = name;
  window.scrollTo(0, 0);
}
function duelMsg(text, back){
  duelView('msg');
  $('duel-msg').textContent = text;
  $('duel-spin').hidden = !!back;
  $('duel-msg-btn').hidden = !back;
}
function duelLog(msg, color){
  const t = $('duel-ticker'); if(!t) return;
  const p = document.createElement('p');
  p.textContent = msg; if(color) p.style.color = color;
  t.appendChild(p); t.scrollTop = t.scrollHeight;
  while(t.children.length > 40) t.removeChild(t.firstChild);
}
function duelEsc(s){ return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function duelMe(){ return DU.side || 'p1'; }
function duelOp(){ return duelMe() === 'p1' ? 'p2' : 'p1'; }

/* 倒數條：deadline 為伺服器時間 */
function duelTimer(barId, textId, deadline, total){
  const key = 't_' + barId;
  clearInterval(DU.timers[key]);
  const bar = $(barId), txt = $(textId);
  const paint = function(){
    const left = Math.max(0, Number(deadline || 0) - dnow());
    if(bar) bar.style.width = Math.max(0, Math.min(100, left / total * 100)) + '%';
    if(bar && bar.parentNode) bar.parentNode.classList.toggle('low', left < 6000);
    if(txt) txt.textContent = Math.ceil(left / 1000);
    if(left <= 0) clearInterval(DU.timers[key]);
  };
  paint();
  DU.timers[key] = setInterval(paint, 200);
}

/* ── 進入 ── */
async function duelOpen(){
  show('scr-duel');
  window.DUEL_BGM = 'menu'; BGM.auto('scr-duel');
  duelMsg('連線中⋯⋯');
  const prevGuestTeam = (DU.info && DU.info.guest && DU.info.lastTeam && DU.info.lastTeam.length)
    ? DU.info.lastTeam.slice() : null;
  try{
    const info = await duelGas('duelEnter', duelGuestTok());
    if(!info || !info.ok){
      if(info && info.reason === 'login'){
        duelGuestClear();
        DU.guestChecked = false;
        duelSyncGuestHome();
        if($('duel-guest-err')) $('duel-guest-err').hidden = true;
        if($('duel-guest-code')) $('duel-guest-code').value = '';
        duelView('guest');
        return;
      }
      duelMsg((info && info.msg) || '目前無法進入雙人對戰。', true);
      return;
    }
    await Promise.all([duelLoadSdk(), duelLoadChars()]);
    await duelConnect(info.token);
    if(info.guest && prevGuestTeam && (!info.lastTeam || !info.lastTeam.length)) info.lastTeam = prevGuestTeam;
    DU.info = info; DU.uid = info.uid;
    duelPaintRules(info.rules);
    $('duel-lesson').textContent = '';
    if(info.match) duelEnterMatch(info.match);
    else duelLobby();
  }catch(e){
    console.error('[duel]', e);
    duelMsg('無法進入雙人對戰：' + (e.message || e), true);
  }
}

/* ── 友校訪客登入 ── */
function duelSyncGuestHome(){
  const area = $('guest-login-area');
  if(!area) return;
  if(!inGAS || (ME && ME.allowed)){ area.hidden = true; return; }
  area.hidden = false;
  const g = DU.guest;
  if(g && g.token){
    if(!DU.guestChecked){
      DU.guestChecked = true;
      duelGas('duelCheckGuest', g.token).then(function(r){
        if(!r || !r.ok){
          duelGuestClear();
          DU.guestChecked = false;
        }else{
          duelGuestSave({ token: g.token, sid: r.sid || g.sid, ymd: r.ymd || g.ymd });
        }
        duelSyncGuestHome();
      }).catch(function(){});
    }
    $('guest-form-home').hidden = true;
    $('guest-active-home').hidden = false;
    $('guest-active-text').textContent = '✅ 已以友校訪客登入：' + (g.sid || '訪客') + '（僅限今日雙人對戰）';
  }else{
    $('guest-form-home').hidden = false;
    $('guest-active-home').hidden = true;
  }
}

async function duelGuestSubmit(inId, btnId, errId, enterAfter){
  const inp = $(inId), btn = $(btnId), err = $(errId);
  if(!inp || !btn) return;
  const code = duelNormCode(inp.value);
  inp.value = code;
  if(err) err.hidden = true;
  if(code.length !== 4){
    if(err){ err.textContent = '請輸入 4 位數字代碼。'; err.hidden = false; }
    return;
  }
  sfx('select');
  const oldTxt = btn.textContent;
  btn.disabled = true; btn.textContent = '驗證中⋯⋯';
  try{
    const r = await duelGas('duelGuestLogin', code);
    if(!r || !r.ok){
      if(err){ err.textContent = (r && r.msg) || '訪客代碼不正確。'; err.hidden = false; }
      btn.disabled = false; btn.textContent = oldTxt;
      return;
    }
    duelGuestSave({ token: r.token, sid: r.sid, ymd: r.ymd });
    DU.guestChecked = true;
    inp.value = '';
    btn.disabled = false; btn.textContent = oldTxt;
    duelSyncGuestHome();
    if(enterAfter) duelOpen();
  }catch(e){
    if(err){ err.textContent = '登入失敗：' + duelNetMsg(e); err.hidden = false; }
    btn.disabled = false; btn.textContent = oldTxt;
  }
}

function duelGuestLogout(fromDuel){
  if(fromDuel && DU.mid && DU.pub && ['end', 'void'].indexOf(DU.pub.phase) < 0){
    if(!confirm('對戰還在進行中，登出會判定投降（落敗）。確定要登出嗎？')) return;
    duelGas('duelForfeit', DU.mid, duelGuestTok()).catch(function(){});
    DU.pub = null;
  }
  duelGuestClear();
  DU.guestChecked = false;
  if(DU.info && DU.info.guest) DU.info = null;
  try{ if(DU.app && DU.app.auth) DU.app.auth().signOut().catch(function(){}); }catch(e){}
  duelSyncGuestHome();
  if(fromDuel) duelBack();
}

/* 規則說明的數字跟著「對戰設定」工作表走（讀不到時用預設：50 秒、10 秒、10 題） */
function duelPaintRules(r){
  r = r || {};
  const sec = function(ms, d){ const n = Number(ms); return (n > 0 ? Math.round(n / 1000) : d) + ' 秒'; };
  const q = Number(r.qCount || r.questions || r.q) || 10;
  if($('duel-rule-ans')) $('duel-rule-ans').textContent = sec(r.answer, 50);
  if($('duel-rule-act')) $('duel-rule-act').textContent = sec(r.action, 10);
  if($('duel-rule-q')) $('duel-rule-q').textContent = q;
}

/* ── 大廳 ── */
function duelLobby(){
  duelStopWaiting(false);
  dunsub('lobby'); dunsub('match');
  DU.mid = null; DU.pub = null; DU.priv = null; DU.side = null;
  window.DUEL_BGM = 'menu'; BGM.auto('scr-duel');
  duelView('lobby');
  const i = DU.info;
  if(i.guest){
    $('duel-tier').textContent = '友校訪客';
    $('duel-rating').textContent = i.sid;
    $('duel-record').textContent = '系統配發編號：' + i.sid + '（今日有效）';
    $('duel-today').textContent = '體驗場模式：不計段分與學期積分';
    if($('duel-guest-logout')) $('duel-guest-logout').hidden = false;
  }else{
    $('duel-tier').textContent = i.tier;
    $('duel-rating').textContent = i.rating + ' 分';
    $('duel-record').textContent = i.wins + ' 勝 ' + i.losses + ' 敗 ' + i.draws + ' 和（共 ' + i.games + ' 場）';
    $('duel-today').textContent = '今天已計分 ' + i.todayCounted + ' / ' + i.dailyMax + ' 場';
    if($('duel-guest-logout')) $('duel-guest-logout').hidden = true;
  }
  $('duel-lobby-err').hidden = true;
  if(!DU.choice){ try{ DU.choice = localStorage.getItem('atkqa_duel_choice') || DUEL_ANY; }catch(e){ DU.choice = DUEL_ANY; } }
  dsub('config', function(c){
    c = c || {};
    DU.info.config = c;
    const lessons = duelArr(c.lessons);
    const open = !!(c.open && lessons.length && (!c.closeAt || dnow() < c.closeAt));
    $('duel-closed').hidden = open;
    $('duel-actions').hidden = !open;
    $('duel-lessons-box').hidden = !open;
    if(DU.choice !== DUEL_ANY && !lessons.some(function(L){ return L.id === DU.choice; })) DU.choice = DUEL_ANY;
    duelPaintLessons();
  }, 'lobby');
  dsub('queue', function(q){ DU.queueAll = q || {}; duelPaintCounts(); }, 'lobby');
  dsub('stats', function(st){
    let n = 0; st = st || {};
    Object.keys(st).forEach(function(k){ n += Math.max(0, Number(st[k] && st[k].active) || 0); });
    $('duel-active').textContent = n;
  }, 'lobby');
}
const DUEL_ANY = '_any';
function duelChoiceName(id){
  if(id === DUEL_ANY) return '不限課次';
  const L = duelArr(DU.info.config && DU.info.config.lessons).filter(function(x){ return x.id === id; })[0];
  return L ? L.name : id;
}
function duelPaintLessons(){
  const box = $('duel-lessons'); box.innerHTML = '';
  const lessons = duelArr(DU.info.config && DU.info.config.lessons);
  [{ id: DUEL_ANY, name: '不限課次' }].concat(lessons).forEach(function(L){
    const b = document.createElement('button');
    b.className = DU.choice === L.id ? 'on' : '';
    b.innerHTML = duelEsc(L.name) + (L.id === DUEL_ANY ? '<small>最快配到人</small>' : '');
    b.onclick = function(){
      DU.choice = L.id; sfx('tap');
      try{ localStorage.setItem('atkqa_duel_choice', L.id); }catch(e){}
      duelPaintLessons();
    };
    box.appendChild(b);
  });
  $('duel-lesson').textContent = duelChoiceName(DU.choice);
  duelPaintCounts();
}
/* 可配對的人：選某一課＝那一課＋不限課次；選不限課次＝所有人 */
function duelPaintCounts(){
  const q = DU.queueAll || {}, ch = DU.choice || DUEL_ANY;
  const allowed = (DU.info.config && DU.info.config.allowed) || {};
  let n = 0;
  Object.keys(q).forEach(function(k){
    if(ch === DUEL_ANY ? (k === DUEL_ANY || allowed[k]) : (k === ch || k === DUEL_ANY)) n += Object.keys(q[k] || {}).length;
  });
  $('duel-waiting').textContent = n; $('duel-waiting2').textContent = n;
}
function duelLobbyErr(msg){ const e = $('duel-lobby-err'); e.textContent = msg; e.hidden = false; }

/* ── 隨機配對 ── */
function duelStartRandom(){
  const lesson = DU.choice || DUEL_ANY;
  sfx('select');
  duelView('wait');
  $('duel-wait-lesson').textContent = '課次：' + duelChoiceName(lesson);
  DU.waitStart = Date.now();
  const entry = dref('queue/' + lesson + '/' + DU.uid);
  DU.waitRef = entry;
  entry.onDisconnect().remove();
  entry.set({ sid: DU.info.sid, t0: DTS(), t: DTS() });
  DU.timers.beat = setInterval(function(){ entry.update({ t: DTS() }); }, 15000);
  DU.timers.waitSec = setInterval(function(){
    const s = Math.floor((Date.now() - DU.waitStart) / 1000);
    $('duel-wait-sec').textContent = s;
    $('duel-wait-hint').hidden = s < 60;
  }, 500);
  DU.waitUserOff = dsub('users/' + DU.uid + '/match', function(mid){ if(mid) duelEnterMatch(mid); }, 'lobby');
  const ask = async function(){
    if(DU.view !== 'wait') return;
    try{
      const r = await duelGas('duelQueue', lesson, duelGuestTok());
      if(DU.view !== 'wait') return;
      if(r.status === 'matched') return duelEnterMatch(r.mid);
      if(r.status === 'closed'){ duelLobby(); return duelLobbyErr('對戰時段已經結束。'); }
      if(r.status === 'gone') entry.set({ sid: DU.info.sid, t0: DTS(), t: DTS() });
    }catch(e){ duelLog('配對查詢失敗：' + e.message); }
  };
  setTimeout(ask, 600);
  DU.timers.ask1 = setTimeout(ask, 10600);
  DU.timers.ask2 = setTimeout(function(){ ask(); DU.timers.ask3 = setInterval(ask, 20000); }, 30600);
}
function duelStopWaiting(tellServer){
  ['beat', 'waitSec', 'ask3', 'roomLeft'].forEach(function(k){ clearInterval(DU.timers[k]); });
  ['ask1', 'ask2'].forEach(function(k){ clearTimeout(DU.timers[k]); });
  if(DU.waitRef){ try{ DU.waitRef.onDisconnect().cancel(); DU.waitRef.remove(); }catch(e){} DU.waitRef = null; }
  if(DU.waitUserOff){ DU.waitUserOff(); DU.waitUserOff = null; }
  if(tellServer) duelGas('duelLeave', duelGuestTok()).catch(function(){});
}

/* ── 房號 ── */
async function duelHost(){
  sfx('select');
  duelMsg('開房中⋯⋯');
  try{
    const r = await duelGas('duelCreateRoom', DU.choice || DUEL_ANY, duelGuestTok());
    if(r.match) return duelEnterMatch(r.match);
    if(!r.ok){ duelLobby(); return duelLobbyErr(r.msg); }
    duelView('room');
    $('duel-code').textContent = r.code;
    $('duel-room-lesson').textContent = '課次：' + (r.lessonName || '');
    const exp = r.exp;
    const paint = function(){
      const left = Math.max(0, exp - dnow());
      $('duel-room-left').textContent = Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
      if(left <= 0 && DU.view === 'room'){ duelStopWaiting(true); duelLobby(); duelLobbyErr('房號已過期，請重新開房。'); }
    };
    paint(); DU.timers.roomLeft = setInterval(paint, 500);
    DU.waitUserOff = dsub('users/' + DU.uid + '/match', function(mid){ if(mid) duelEnterMatch(mid); }, 'lobby');
  }catch(e){ duelLobby(); duelLobbyErr('開房失敗：' + e.message); }
}
async function duelJoin(){
  const code = String($('duel-code-in').value || '').replace(/\D/g, '');
  if(code.length !== 4) return duelLobbyErr('房號是 4 位數字。');
  sfx('select');
  $('duel-join').disabled = true;
  try{
    const r = await duelGas('duelJoinRoom', code, duelGuestTok());
    if(r.ok) duelEnterMatch(r.mid);
    else duelLobbyErr(r.msg);
  }catch(e){ duelLobbyErr('加入失敗：' + e.message); }
  $('duel-join').disabled = false;
}

/* ── 進入一場對戰 ── */
function duelEnterMatch(mid){
  if(DU.mid === mid) return;
  duelStopWaiting(false);
  dunsub('lobby'); dunsub('match');
  DU.countsFor = null;
  DU.mid = mid; DU.pub = null; DU.priv = null; DU.side = null; DU.lastStep = -1; DU.retries = 0; DU.fails = 0;
  DU.flags = { sub: {}, acted: {}, ready: {} };
  DU.played = {}; DU.shown = null; DU.teamSent = false; DU.team = []; DU.lead = {};
  $('duel-ticker').innerHTML = '';
  duelMsg('配對成功！準備開戰⋯⋯');
  sfx('awaken');
  const base = 'matches/' + mid + '/';
  dsub(base + 'private/' + DU.uid, function(v){ DU.priv = v || {}; if(DU.pub) duelRoute(DU.pub, true); }, 'match');
  ['sub', 'acted', 'ready'].forEach(function(k){
    dsub(base + k, function(v){ DU.flags[k] = v || {}; if(DU.pub){ duelSchedule(); if(typeof duelOnFlags === 'function') duelOnFlags(k); } }, 'match');
  });
  dsub(base + 'public', function(p){
    if(!p) return;
    DU.pub = p;
    if(p.players){ DU.side = p.players.p1 && p.players.p1.uid === DU.uid ? 'p1' : 'p2'; }
    if(p.step !== DU.lastStep){ DU.lastStep = p.step; DU.retries = 0; DU.fails = 0; }
    duelRoute(p, false);
    duelSchedule();
  }, 'match');
  duelMarkOnline();
}

function duelRoute(p, privOnly){
  if(p.lesson && p.lesson.name) $('duel-lesson').textContent = p.lesson.name;
  if(p.phase === 'init'){ duelMsg('配對成功！準備開戰⋯⋯'); return; }
  if(p.phase === 'team'){ if(!privOnly || DU.view !== 'team') duelTeamView(p); return; }
  if(p.phase === 'end' || p.phase === 'void'){ duelResult(p); return; }
  duelBattle(p);
}

/* ── 組隊 ── */
function duelEligible(){
  const unlocked = DU.info.unlocked || [], banned = (DU.info.rules && DU.info.rules.banned) || ['sp_quewue'];
  return DU.chars.chars.filter(function(c){
    return !c.up && banned.indexOf(c.id) < 0 && (!c.secret || unlocked.indexOf(c.id) >= 0);
  });
}
function duelCharOf(id){
  const g = ALL_CHARACTERS.filter(function(c){ return c.id === id; })[0];
  const d = DU.chars && DU.chars.byId[id];
  return g || (d ? { id: id, name: d.name, img: '', ph: placeholderImg(d.name, d.u), universe: d.u } : { id: id, name: id, img: '', ph: '' });
}
function duelImg(el, id){
  const c = duelCharOf(id);
  if(c.img || c.ph) bindImg(el, { img: c.img || c.ph, ph: c.ph || c.img });
}
function duelTeamView(p){
  if(DU.view !== 'team'){
    duelView('team');
    window.DUEL_BGM = 'battle'; BGM.auto('scr-duel');
    if(!DU.team || !DU.team.length) DU.team = [];
    DU.tab = DU.tab || 'all';
    duelPaintTabs();
  }
  const me = duelMe(), op = duelOp();
  $('duel-t-me').textContent = (p.players[me].sid || '我') + '（' + (p.players[me].rating || 1000) + '）';
  $('duel-t-op').textContent = (p.players[op].sid || '對手') + '（' + (p.players[op].rating || 1000) + '）';
  duelTimer('duel-t-bar', 'duel-t-left', p.deadline, (DU.info.rules && DU.info.rules.team) ? 60000 : 60000);
  DU.teamSent = !!(p.teamReady && p.teamReady[me]);
  const opReady = !!(p.teamReady && p.teamReady[op]);
  $('duel-team-status').textContent = DU.teamSent
    ? (opReady ? '雙方都送出了，馬上開戰！' : '已送出，等待對手⋯⋯')
    : (opReady ? '對手已經送出隊伍了！' : '時間到還沒送出，系統會依你的上次隊伍自動補滿。');
  duelPaintTeam();
}
function duelPaintTabs(){
  const el = $('duel-tabs'); el.innerHTML = '';
  const elig = duelEligible();
  const tabs = [{ k: 'all', label: '全部' }].concat(UNIVERSES.filter(function(u){
    return elig.some(function(c){ return u.keys.indexOf(c.u) >= 0; });
  }));
  tabs.forEach(function(t){
    const b = document.createElement('button');
    b.textContent = t.label; b.className = DU.tab === t.k ? 'on' : '';
    b.onclick = function(){ DU.tab = t.k; sfx('tap'); duelPaintTabs(); duelPaintTeam(); };
    el.appendChild(b);
  });
}
function duelPaintTeam(){
  const size = (DU.info.rules && DU.info.rules.team) || 8;
  const slots = $('duel-slots'); slots.innerHTML = '';
  for(let i = 0; i < size; i++){
    const id = DU.team[i];
    const b = document.createElement('button');
    b.className = 'duel-slot' + (id ? ' filled' : '') + (i < 3 ? ' starter' : '');
    b.innerHTML = '<em>' + (i < 3 ? '先發' + (i + 1) : '替補' + (i - 2)) + '</em>';
    if(id){
      const img = document.createElement('img'); b.appendChild(img); duelImg(img, id);
      const s = document.createElement('span'); s.textContent = duelCharOf(id).name; b.appendChild(s);
      b.onclick = function(){ if(DU.teamSent) return; DU.team.splice(i, 1); sfx('tap'); duelPaintTeam(); };
    }
    slots.appendChild(b);
  }
  const roster = $('duel-roster'); roster.innerHTML = '';
  const filter = DU.tab === 'all' ? null : (UNIVERSES.filter(function(u){ return u.k === DU.tab; })[0] || {}).keys;
  duelEligible().forEach(function(c){
    if(filter && filter.indexOf(c.u) < 0) return;
    const at = DU.team.indexOf(c.id);
    const b = document.createElement('button');
    b.className = 'duel-pick' + (at >= 0 ? ' in' : '');
    const img = document.createElement('img'); img.loading = 'lazy'; b.appendChild(img); duelImg(img, c.id);
    const role = (ROLES[c.role] || ROLES.balance);
    b.insertAdjacentHTML('beforeend', '<b>' + duelEsc(duelCharOf(c.id).name) + '</b><small>' + role.icon + role.name + '・HP ' + c.hp + '</small>' +
      (at >= 0 ? '<span class="num">' + (at + 1) + '</span>' : ''));
    b.onclick = function(){
      if(DU.teamSent) return;
      if(at >= 0) DU.team.splice(at, 1);
      else if(DU.team.length < size) DU.team.push(c.id);
      else return;
      sfx('select'); duelPaintTeam();
    };
    roster.appendChild(b);
  });
  $('duel-submit').disabled = DU.teamSent || DU.team.length !== size;
  $('duel-submit').textContent = DU.teamSent ? '已送出' : (DU.team.length === size ? '送出隊伍' : '還差 ' + (size - DU.team.length) + ' 位');
  ['duel-last', 'duel-fill'].forEach(function(id){ $(id).disabled = DU.teamSent; });
}
function duelUseLast(){
  const elig = duelEligible().map(function(c){ return c.id; });
  DU.team = (DU.info.lastTeam || []).filter(function(id){ return elig.indexOf(id) >= 0; }).slice(0, 8);
  if(!DU.team.length) duelLog('還沒有上次的隊伍。');
  sfx('tap'); duelPaintTeam();
}
function duelFill(){
  const pool = duelEligible().map(function(c){ return c.id; }).filter(function(id){ return DU.team.indexOf(id) < 0; });
  while(DU.team.length < 8 && pool.length) DU.team.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  sfx('tap'); duelPaintTeam();
}
async function duelSubmitTeam(){
  if(DU.teamSent || DU.team.length !== 8) return;
  $('duel-submit').disabled = true;
  try{
    const r = await duelGas('duelSubmitTeam', DU.mid, DU.team.slice(), duelGuestTok());
    if(!r.ok){ $('duel-team-status').textContent = r.msg; $('duel-submit').disabled = false; return; }
    DU.teamSent = true; DU.info.lastTeam = DU.team.slice();
    sfx('perfect'); duelPaintTeam();
    $('duel-team-status').textContent = '已送出，等待對手⋯⋯';
  }catch(e){ $('duel-team-status').textContent = '送出失敗：' + e.message; $('duel-submit').disabled = false; }
}

/* ── 結算 ── */
function duelResult(p){
  if(DU.view === 'result' && DU.shown === 'result') return;
  DU.shown = 'result';
  clearTimeout(DU.timers.tick); clearTimeout(DU.timers.retry);
  const go = function(){
    duelView('result');
    window.DUEL_BGM = 'menu'; BGM.auto('scr-duel');
    const me = duelMe(), op = duelOp(), r = p.result || {};
    const t = $('duel-r-title');
    t.classList.remove('lose');
    if(p.phase === 'void' || r.winner === 'void'){ t.textContent = '對戰作廢'; t.classList.add('lose'); }
    else if(r.winner === me){ t.textContent = '勝利！'; sfx('win'); }
    else if(r.winner === 'draw'){ t.textContent = '平手'; }
    else { t.textContent = '落敗⋯⋯'; t.classList.add('lose'); sfx('lose'); }
    const why = { wipe: '一方全隊倒下', time: (p.qCount || 10) + ' 題結束，比較全隊剩餘體力', dc: '一方斷線超過 60 秒', forfeit: '一方投降' };
    let reason = why[r.reason] || (p.reason || '');
    if(r.dcDraw) reason += (r.dcDraw === me ? '（你今天第一次斷線，判和局、不扣段分）' : '（對方今天第一次斷線，判和局）');
    $('duel-r-reason').textContent = reason;
    $('duel-r-me').textContent = (p.players && p.players[me] && p.players[me].sid) || '我';
    $('duel-r-op').textContent = (p.players && p.players[op] && p.players[op].sid) || '對手';
    const a = r[me] || {}, b = r[op] || {};
    const row = function(k, x, y){ return '<tr><td>' + k + '</td><td>' + x + '</td><td>' + y + '</td></tr>'; };
    $('duel-r-body').innerHTML =
      row('答對率', (a.rate || 0) + '%', (b.rate || 0) + '%') +
      row('擊倒對手', a.kos || 0, b.kos || 0) +
      row('剩餘體力', (a.hp || 0) + '%', (b.hp || 0) + '%');
    if(p.phase === 'void'){
      $('duel-r-pts').innerHTML = '';
    }else if(r.guestMatch || (DU.info && DU.info.guest)){
      $('duel-r-pts').innerHTML = '<div><small>友校參訪體驗場</small><b>不計分</b><small>不計段分與學期積分</small></div>';
    }else{
      $('duel-r-pts').innerHTML =
        '<div><small>對戰積分</small><b>+' + (a.pts || 0) + '</b><small>' + (a.counted ? '已加進學期積分' : '本場不計分') + '</small></div>' +
        '<div><small>段分</small><b>' + (a.delta > 0 ? '+' : '') + (a.delta || 0) + '</b><small>' + (a.tier || '') + (a.rating ? '・' + a.rating : '') + '</small></div>';
    }
    const notes = [];
    if(r.note) notes.push(r.note);
    if(r.scoreError) notes.push(r.scoreError);
    if(p.phase !== 'void'){
      if(a.counted && !a.pts && (a.rate || 0) < 30 && !(r.reason === 'forfeit' && r.loser === me)) notes.push('你的答對率低於 30%，本場沒有對戰積分。');
      if(r.reason === 'forfeit' && r.loser === me) notes.push('投降的一方沒有對戰積分。');
      if(r.unrated) notes.push(r.unrated);
    }
    $('duel-r-note').textContent = notes.join(' ');
    if(DU.info && a.rating){ DU.info.rating = a.rating; DU.info.tier = a.tier || DU.info.tier; }
  };
  /* 最後一題的演出還沒播完，就等播完再顯示結算 */
  if(DU.playing) DU.afterPlay = go; else go();
}

/* 離開對戰畫面 */
function duelBack(){
  if(DU.mid && DU.pub && ['end', 'void'].indexOf(DU.pub.phase) < 0){
    if(!confirm('對戰還在進行中，離開會判定投降（落敗）。確定要離開嗎？')) return;
    duelGas('duelForfeit', DU.mid, duelGuestTok()).catch(function(){});
  }
  duelStopWaiting(DU.view === 'wait' || DU.view === 'room');
  dunsub('lobby'); dunsub('match');
  Object.keys(DU.timers).forEach(function(k){ clearTimeout(DU.timers[k]); clearInterval(DU.timers[k]); });
  if(DU.mid && DU.db){ try{ dref('matches/' + DU.mid + '/ping/' + DU.uid).onDisconnect().cancel(); }catch(e){} }
  DU.mid = null; DU.pub = null; DU.countsFor = null;
  window.DUEL_BGM = 'menu';
  show('scr-home');
}

/* ── 綁定按鈕 ── */
$('btn-duel').onclick = function(){ sfx('tap'); duelOpen(); };
$('duel-back').onclick = duelBack;
$('duel-msg-btn').onclick = duelBack;
$('duel-home').onclick = duelBack;
$('duel-again').onclick = function(){ sfx('tap'); dunsub('match'); DU.mid = null; duelOpen(); };
$('duel-random').onclick = duelStartRandom;
$('duel-cancel').onclick = function(){ sfx('tap'); duelStopWaiting(true); duelLobby(); };
$('duel-host').onclick = duelHost;
$('duel-room-cancel').onclick = function(){ sfx('tap'); duelStopWaiting(true); duelLobby(); };
$('duel-join').onclick = duelJoin;
$('duel-code-in').addEventListener('keydown', function(e){ if(e.key === 'Enter') duelJoin(); });
$('duel-last').onclick = duelUseLast;
$('duel-fill').onclick = duelFill;
$('duel-submit').onclick = duelSubmitTeam;
if($('btn-guest-home')) $('btn-guest-home').onclick = function(){ duelGuestSubmit('guest-code-home', 'btn-guest-home', 'guest-msg-home', false); };
if($('guest-code-home')) $('guest-code-home').addEventListener('keydown', function(e){ if(e.key === 'Enter') duelGuestSubmit('guest-code-home', 'btn-guest-home', 'guest-msg-home', false); });
if($('btn-guest-home-duel')) $('btn-guest-home-duel').onclick = function(){ sfx('tap'); duelOpen(); };
if($('btn-guest-home-logout')) $('btn-guest-home-logout').onclick = function(){ sfx('tap'); duelGuestLogout(false); };
if($('duel-guest-go')) $('duel-guest-go').onclick = function(){ duelGuestSubmit('duel-guest-code', 'duel-guest-go', 'duel-guest-err', true); };
if($('duel-guest-code')) $('duel-guest-code').addEventListener('keydown', function(e){ if(e.key === 'Enter') duelGuestSubmit('duel-guest-code', 'duel-guest-go', 'duel-guest-err', true); });
if($('duel-guest-logout')) $('duel-guest-logout').onclick = function(){ sfx('tap'); duelGuestLogout(true); };
if($('duel-school-login')) $('duel-school-login').onclick = function(){
  sfx('tap');
  let back = (ME && ME.gameUrl) ? ME.gameUrl : '';
  if(!back){
    try{
      const ref = document.referrer || '';
      if(ref.indexOf('/macros/') >= 0) back = ref.split('?')[0].split('#')[0];
    }catch(e){}
  }
  if(!back){
    alert('還在取得遊戲網址，請稍等一兩秒再按一次。');
    return;
  }
  const u = 'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(back);
  const err = $('duel-guest-err');
  if(err){
    err.hidden = false;
    err.textContent = '正在前往 Google 登入頁，選好學校帳號後會自動回到遊戲。沒有跳轉的話請';
    const alt = document.createElement('a');
    alt.href = u; alt.target = '_blank'; alt.rel = 'noopener';
    alt.textContent = '點這裡另開登入頁';
    alt.style.cssText = 'color:var(--sakura-d,#e0559b);font-weight:700;text-decoration:underline';
    err.appendChild(alt);
  }
  const a = document.createElement('a');
  a.href = u; a.target = '_top';
  document.body.appendChild(a); a.click(); a.remove();
};
duelSyncGuestHome();
