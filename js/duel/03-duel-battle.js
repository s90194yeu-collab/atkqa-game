/* 【duel/03-duel-battle.js】雙人對戰：作答、選招、播放裁判寫回的演出腳本、解析與補位
   畫面只負責顯示與送出；誰先攻、命中、會心、傷害都由 Apps Script 計算後寫進 public/script。 */

function duelClone(x){ return x ? JSON.parse(JSON.stringify(x)) : x; }
function duelArr(x){ return Array.isArray(x) ? x : (x ? Object.keys(x).sort(function(a, b){ return a - b; }).map(function(k){ return x[k]; }) : []); }
function duelSideKey(s){ return s === duelMe() ? 'me' : 'op'; }
function duelQ(n){ const q = DU.priv && DU.priv.q; return q ? q[n] : null; }
function duelR(n){ const r = DU.priv && DU.priv.r; return r ? r[n] : null; }

/* ── 主畫面 ── */
function duelBattle(p){
  if(DU.view !== 'battle'){
    duelView('battle');
    window.DUEL_BGM = 'battle'; BGM.auto('scr-duel');
    if(!DU.vsides) DU.vsides = duelClone(p.sides);
  }
  const me = duelMe(), op = duelOp();
  $('duel-h-me').textContent = (p.players[me].sid || '我');
  $('duel-h-op').textContent = (p.players[op].sid || '對手');
  $('duel-h-q').textContent = '第 ' + (p.q || 1) + ' / ' + (p.qCount || 10) + ' 題';

  /* 演出：還沒播過這一題的腳本就播放；播放中不重畫角色卡 */
  if(p.phase === 'show' && p.script && !DU.played[p.q] && !DU.playing){
    if(!DU.vsides || DU.vsidesQ !== p.q){
      /* 重新整理後才進來（沒有演出前的狀態）：直接顯示結果 */
      DU.played[p.q] = true;
      DU.vsides = duelClone(p.sides); DU.vsidesQ = p.q;
    }else{
      duelPlay(p);
    }
  }
  if(!DU.playing){
    if(p.phase !== 'show' || DU.played[p.q]){ DU.vsides = duelClone(p.sides); }
    DU.vsidesQ = (p.phase === 'answer' || p.phase === 'action') ? p.q : DU.vsidesQ;
    duelRenderSides();
  }

  const phaseTxt = { answer: '作答中', action: '選擇招式', show: DU.playing ? '交戰中' : '看解析' };
  $('duel-h-phase').textContent = phaseTxt[p.phase] || '';
  const totals = { answer: (DU.info.rules && DU.info.rules.answer) || 50000, action: (DU.info.rules && DU.info.rules.action) || 10000, show: 5000 };
  duelTimer('duel-b-bar', 'duel-b-left', p.deadline, totals[p.phase] || 50000);

  $('duel-q').hidden = false;
  $('duel-q').classList.toggle('acting', p.phase === 'action');
  if(p.phase === 'action' && DU.scrolledQ !== p.q){
    DU.scrolledQ = p.q;
    /* 矮螢幕（橫向手機）：選招面板捲進畫面 */
    if(window.matchMedia && matchMedia('(max-height:520px)').matches)
      setTimeout(function(){ const el = $('duel-act'); if(el && !el.hidden) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
  }
  $('duel-act').hidden = p.phase !== 'action';
  $('duel-exp').hidden = !(p.phase === 'show' && DU.played[p.q] && !DU.playing);
  if(p.phase === 'answer') duelPaintQuestion(p);
  if(p.phase === 'action'){ duelPaintQuestion(p); duelPaintAction(p); }
  if(p.phase === 'show'){ duelPaintQuestion(p); if(DU.played[p.q] && !DU.playing) duelPaintExplain(p); }
}

/* ── 角色卡 ── */
function duelRenderSides(){
  const s = DU.vsides || {}, p = DU.pub;
  ['me', 'op'].forEach(function(k){
    const side = k === 'me' ? duelMe() : duelOp();
    const col = $('duel-col-' + k);
    const field = duelArr(s[side] && s[side].field);
    col.innerHTML = '';
    for(let i = 0; i < 3; i++) col.appendChild(duelCard(field[i], k, i));
  });
  const hp = (p && p.hpPct) || {};
  $('duel-h-mehp').style.width = (hp[duelMe()] === undefined ? 100 : hp[duelMe()]) + '%';
  $('duel-h-ophp').style.width = (hp[duelOp()] === undefined ? 100 : hp[duelOp()]) + '%';
  const sideTxt = function(x){ x = x || {}; return '替補 ' + (x.benchLeft || 0) + ' 位・連擊 ' + (x.combo || 0) + '・SP ' + (x.sp || 0); };
  $('duel-h-mebench').textContent = sideTxt(s[duelMe()]);
  $('duel-h-opbench').textContent = sideTxt(s[duelOp()]);
  duelMarkCards();
}
/* 主要出手角色放大（比照單人困難模式的大立繪）：
   選招時＝我選的出手者／目標；演出時＝正在出手與被攻擊的角色；其餘時候沿用上一次，倒下就換體力最高的 */
function duelSetLead(k, slot){
  DU.lead = DU.lead || {};
  if(slot === undefined || slot === null || DU.lead[k] === slot) return;
  DU.lead[k] = slot; duelApplyLead();
}
function duelApplyLead(){
  DU.lead = DU.lead || {};
  ['me', 'op'].forEach(function(k){
    const side = k === 'me' ? duelMe() : duelOp();
    const field = duelArr(DU.vsides && DU.vsides[side] && DU.vsides[side].field);
    let lead = DU.lead[k];
    const alive = function(i){ return field[i] && field[i].hp > 0; };
    if(lead === undefined || !field[lead] || (!alive(lead) && !DU.playing)){
      lead = 0; let best = -1;
      field.forEach(function(f, i){ if(f && f.hp > 0 && f.hp > best){ best = f.hp; lead = i; } });
      DU.lead[k] = lead;
    }
    document.querySelectorAll('#duel-col-' + k + ' .duel-fc').forEach(function(el){
      el.classList.toggle('lead', Number(el.dataset.slot) === lead);
    });
  });
}
function duelCard(f, k, slot){
  const d = document.createElement('div');
  d.className = 'duel-fc' + (!f ? ' empty' : (f.hp <= 0 ? ' down' : ''));
  d.dataset.slot = slot; d.dataset.side = k;
  if(!f){ d.innerHTML = '<div></div><div><b>（空位）</b></div>'; return d; }
  const img = document.createElement('img'); d.appendChild(img); duelImg(img, f.id);
  const role = ROLES[f.role] || ROLES.balance;
  const info = document.createElement('div');
  info.innerHTML = '<b>' + duelEsc(duelCharOf(f.id).name || f.name) + '</b><span class="r">' + role.icon + role.name + '・' + duelEsc(f.type) + '</span>' +
    '<div class="dhp"><i style="width:' + Math.max(0, f.hp / f.maxHp * 100) + '%"></i></div><span class="dhpn">' + Math.max(0, f.hp) + ' / ' + f.maxHp + '</span>' +
    duelStChips(f);
  d.appendChild(info);
  if(f.ab && f.hp > 0){
    const ready = duelAbReady(f);
    const star = document.createElement('i');
    star.className = 'duel-star' + (f.abUsed ? ' used' : (ready ? ' ready' : ''));
    star.textContent = '★';
    star.title = '大絕招【' + f.ab.n + '】' + (f.abUsed ? '（已使用）' : (ready ? '（可以發動！）' : '（體力低於 40% 解鎖）'));
    d.appendChild(star);
  }
  d.onclick = function(){ duelCardClick(k, slot); };
  return d;
}
/* 狀態標記：與單人版同一套名稱 */
const DUEL_ST_LABEL = { spFocus: { label: '集中', color: 'var(--gold)' } };
function duelStChips(f){
  const st = f && f.st; if(!st) return '';
  const out = Object.keys(st).map(function(k){
    const info = DUEL_ST_LABEL[k] || (typeof STATUS_INFO !== 'undefined' && STATUS_INFO[k]);
    if(!info) return '';
    const n = Number(st[k]);
    const keep = ['zero', 'alaya', 'nemesis', 'focus', 'charge', 'smite', 'burst', 'jackpot', 'extraHit'].indexOf(k) >= 0;
    return '<em style="--c:' + info.color + '">' + info.label + (keep || !(n > 0) ? '' : n) + '</em>';
  }).join('');
  return out ? '<span class="dst">' + out + '</span>' : '';
}
function duelAbReady(f){
  const at = (DU.chars && DU.chars.config && DU.chars.config.upgradeAt) || 0.4;
  return !!(f && f.ab && !f.abUsed && f.hp > 0 && f.hp <= f.maxHp * at);
}
function duelCardEl(k, slot){ return document.querySelector('#duel-col-' + k + ' .duel-fc[data-slot="' + slot + '"]'); }
function duelSetHp(k, slot, hp){
  const side = k === 'me' ? duelMe() : duelOp();
  const f = DU.vsides && DU.vsides[side] && duelArr(DU.vsides[side].field)[slot];
  if(!f) return;
  f.hp = hp;
  const el = duelCardEl(k, slot); if(!el) return;
  const bar = el.querySelector('.dhp i'), n = el.querySelector('.dhpn');
  if(bar) bar.style.width = Math.max(0, hp / f.maxHp * 100) + '%';
  if(n) n.textContent = Math.max(0, hp) + ' / ' + f.maxHp;
}
function duelPop(k, slot, text, cls){
  const el = duelCardEl(k, slot); if(!el) return;
  const p = document.createElement('div');
  p.className = 'duel-pop' + (cls ? ' ' + cls : '');
  p.textContent = text;
  el.appendChild(p); setTimeout(function(){ p.remove(); }, 1000);
}
function duelFlash(k, slot, cls, ms){
  const el = duelCardEl(k, slot); if(!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(function(){ el.classList.remove(cls); }, ms || 400);
}

/* ── 作答 ── */
function duelPaintQuestion(p){
  const n = p.q, q = duelQ(n);
  const uidSent = !!((DU.flags.sub[n] || {})[DU.uid]);
  const box = $('duel-opts');
  if(p.phase === 'answer' && dnow() < Number(p.showAt || 0)){
    $('duel-qmeta').textContent = '';
    $('duel-qtext').innerHTML = '<span class="duel-wait-q">第 ' + n + ' 題</span>';
    box.innerHTML = ''; $('duel-answer').hidden = true; $('duel-q-status').textContent = '';
    clearTimeout(DU.timers.reveal);
    DU.timers.reveal = setTimeout(function(){ if(DU.pub && DU.pub.q === n) duelBattle(DU.pub); }, Number(p.showAt) - dnow() + 30);
    DU.qRendered = null;
    return;
  }
  if(!q){ $('duel-qtext').textContent = '題目載入中⋯⋯'; box.innerHTML = ''; return; }
  const reveal = (p.phase !== 'answer') ? duelR(n) : null;
  const key = n + ':' + (reveal ? 'r' : 'a');
  if(DU.qRendered !== key){
    DU.qRendered = key;
    if(!reveal) DU.sel = new Set();
    $('duel-qmeta').textContent = (q.type === 'multi' ? '多選題（答對幾個給幾成）' : '單選題') + (q.cat ? '・' + String(q.cat).split('_').pop() : '');
    $('duel-qtext').textContent = q.text;
    box.innerHTML = '';
    duelArr(q.options).forEach(function(o, i){
      const b = document.createElement('button');
      b.className = 'duel-opt'; b.dataset.code = o.c;
      b.innerHTML = '<em>' + String.fromCharCode(65 + i) + '</em><span>' + duelEsc(o.t) + '</span>';
      b.onclick = function(){ duelToggleOpt(o.c, q.type); };
      box.appendChild(b);
    });
  }
  const correct = reveal ? duelArr(reveal.correct) : [];
  const picked = reveal ? duelArr(reveal.picked) : null;
  box.querySelectorAll('.duel-opt').forEach(function(b){
    const c = b.dataset.code;
    b.classList.toggle('sel', !reveal && DU.sel && DU.sel.has(c));
    b.classList.toggle('right', !!reveal && correct.indexOf(c) >= 0);
    b.classList.toggle('wrong', !!reveal && picked.indexOf(c) >= 0 && correct.indexOf(c) < 0);
    b.disabled = !!reveal || uidSent || p.phase !== 'answer';
  });
  const ans = $('duel-answer');
  ans.hidden = p.phase !== 'answer';
  ans.disabled = uidSent || !DU.sel || !DU.sel.size;
  ans.textContent = uidSent ? '已送出' : '送出答案';
  const opSent = !!((DU.flags.sub[n] || {})[p.players[duelOp()].uid]);
  $('duel-q-status').textContent = p.phase === 'answer'
    ? (uidSent ? (opSent ? '雙方都送出了！' : '已送出，等待對手⋯⋯') : (opSent ? '對手已經送出答案了！' : ''))
    : '';
}
function duelToggleOpt(code, type){
  const p = DU.pub;
  if(!p || p.phase !== 'answer' || (DU.flags.sub[p.q] || {})[DU.uid]) return;
  if(type === 'multi'){ DU.sel.has(code) ? DU.sel.delete(code) : DU.sel.add(code); }
  else { DU.sel = new Set([code]); }
  sfx('tap'); duelPaintQuestion(p);
}
function duelSendAnswer(){
  const p = DU.pub;
  if(!p || p.phase !== 'answer' || !DU.sel || !DU.sel.size) return;
  const n = p.q, upd = {};
  upd['ans/' + n + '/' + DU.uid] = { codes: Array.from(DU.sel), t: DTS() };
  upd['sub/' + n + '/' + DU.uid] = true;
  $('duel-answer').disabled = true;
  dref('matches/' + DU.mid).update(upd).then(function(){ sfx('select'); })
    .catch(function(e){ $('duel-q-status').textContent = '送出失敗（可能已超過時間）：' + e.message; });
}

/* ── 選招 ── */
/* 精神指令在對戰中的說明（幸運、祝福改成對戰版；其餘依單人版） */
const DUEL_SP_DESC = {
  focus: '出手角色 2 題內命中 +25、閃避 +15',
  hit: '出手角色本題的攻擊必定命中（連必閃也擋不住）',
  dodge: '本題我方第一次被攻擊必定閃過',
  accel: '本題必定先攻（雙方都用就照常）',
  hotblood: '出手角色本題攻擊傷害 ×2（可與魂疊加）',
  soul: '出手角色本題攻擊傷害 ×2.5 且必定會心',
  iron: '出手角色本題受到的傷害 ×0.25',
  guts: '出手角色立刻回復 35% 體力',
  luck: '出手角色本題的攻擊必定會心',
  bless: '本題我方防禦減傷再 ×0.7，反擊率 +30%',
  friend: '本題必定發動合體（需要隊伍裡有同系列夥伴）',
  awaken: '出手角色本題再攻擊一次'
};
const DUEL_SP_ZERO_OK = ['focus', 'dodge', 'iron', 'guts', 'bless'];   // 沒有發動權時只能用防守類指令
function duelMyField(){ return duelArr(DU.pub.sides[duelMe()].field); }
function duelOpField(){ return duelArr(DU.pub.sides[duelOp()].field); }
function duelMySide(){ return (DU.pub && DU.pub.sides && DU.pub.sides[duelMe()]) || {}; }
function duelSpList(f){
  const rs = (DU.chars && DU.chars.roleSpirits) || (typeof ROLE_SPIRITS !== 'undefined' ? ROLE_SPIRITS : {});
  return (f && (rs[f.role] || rs.balance)) || [];
}
function duelSpCost(k){
  const sp = (DU.chars && DU.chars.spirits && DU.chars.spirits[k]) || (typeof SPIRITS !== 'undefined' && SPIRITS[k]) || {};
  return Number(sp.sp || 99);
}
function duelSpName(k){ return (typeof SPIRITS !== 'undefined' && SPIRITS[k]) ? SPIRITS[k].icon + SPIRITS[k].name : k; }
/* 沒有發動權時，還有沒有可以用的指令 */
function duelCanCastZero(){
  const side = duelMySide(), used = side.spUsed || {}, sp = Number(side.sp || 0);
  return duelMyField().some(function(f){
    return f && f.hp > 0 && duelSpList(f).some(function(k){ return DUEL_SP_ZERO_OK.indexOf(k) >= 0 && !used[k] && duelSpCost(k) <= sp; });
  });
}
function duelPaintAction(p){
  const n = p.q, charge = Number((p.charge || {})[duelMe()] || 0);
  const acted = !!((DU.flags.acted[n] || {})[DU.uid]);
  const alive = duelMyField().some(function(f){ return f && f.hp > 0; });
  $('duel-charge').textContent = Math.round(charge * 100) + '%';
  const opCharge = Number((p.charge || {})[duelOp()] || 0);
  $('duel-act-hint').textContent = '（對手 ' + Math.round(opCharge * 100) + '%' +
    (charge > opCharge ? '，你先出手' : (charge < opCharge ? '，對手先出手' : '，答得快的先出手')) + '）';
  const zeroCast = charge <= 0 && alive && !acted && duelCanCastZero();
  const can = (charge > 0 || zeroCast) && alive && !acted;
  const full = charge > 0;
  const showEl = function(id, on){ const e = $(id); if(e) e.style.display = on ? '' : 'none'; };
  showEl('duel-step-who', can);
  showEl('duel-step-moves', can && full);
  showEl('duel-step-target', can && full);
  showEl('duel-step-sp', can);
  showEl('duel-step-ab', can && full);
  showEl('duel-go', can);
  showEl('duel-skip', can && !full);
  if(!can){
    $('duel-bench').hidden = true;
    $('duel-act-status').textContent = acted ? '已出招，等待對手⋯⋯'
      : (!alive ? '場上沒有可以行動的角色。' : '這一題沒有發動權，無法攻擊：系統會讓體力最高的角色以一半效果防禦。');
    DU.act = null; duelMarkCards();
    return;
  }
  if(!DU.act || DU.act.q !== n) duelDefaultAct(n);
  DU.act.zero = !full;
  duelPaintActDetail();
}
function duelDefaultAct(n){
  const mine = duelMyField(), theirs = duelOpField();
  let who = 0, best = -1;
  mine.forEach(function(f, i){ if(f && f.hp > 0 && f.hp > best){ best = f.hp; who = i; } });
  let target = 0, low = 1e9;
  theirs.forEach(function(f, i){ if(f && f.hp > 0 && f.hp < low){ low = f.hp; target = i; } });
  DU.act = { q: n, who: who, move: duelBestMoveIdx(mine[who]), target: target, swap: null, sp: [], ab: false };
}
function duelBestMoveIdx(f){
  let idx = 0, p = -1;
  (f && duelArr(f.moves) || []).forEach(function(m, i){ if((m.k === 'attack' || m.k === 'aoe') && m.p > p){ p = m.p; idx = i; } });
  return idx;
}
/* 特技說明：持續時間依發動權（全對 2 題、部分正確 1 題） */
function duelSkillText(eff, role, charge){
  const n = charge >= 1 ? 2 : 1;
  let t = (typeof skillText === 'function') ? skillText(eff, role) : '';
  t = t.replace('接下來 2 回合', '接下來 ' + n + ' 題').replace('中毒 3 回合', '中毒 ' + (n + 1) + ' 題').replace(' 2 回合', ' ' + (n + 1) + ' 題');
  return t;
}
function duelMoveInfo(m, charge){
  if(m.k === 'guard') return '防禦・減傷至 ' + Math.round((m.d || 0.5) * 100) + '%，有機會反擊';
  if(m.k === 'skill') return '特技・' + duelSkillText(m.e, (duelMyField()[DU.act.who] || {}).role, charge) + (charge < 0.5 ? '（需發動權 50%）' : '');
  if(m.k === 'aoe') return '全體攻擊・威力 ' + m.p + '・命中 ' + Math.round(m.a) + '%（每人 ×' + ((DU.chars && DU.chars.config.aoeScale) || 0.72) + '）';
  return '攻擊・威力 ' + m.p + '・命中 ' + Math.round(m.a) + '%';
}
function duelPaintActDetail(){
  const a = DU.act, f = duelMyField()[a.who], t = duelOpField()[a.target];
  const charge = Number(((DU.pub && DU.pub.charge) || {})[duelMe()] || 0);
  $('duel-who-name').textContent = f ? duelCharOf(f.id).name + '（' + ((ROLES[f.role] || ROLES.balance).name) + '）' : '—';

  /* 招式 */
  const box = $('duel-moves'); box.innerHTML = '';
  duelArr(f && f.moves).forEach(function(m, i){
    const b = document.createElement('button');
    const locked = m.k === 'skill' && charge < 0.5;
    b.className = 'duel-move k-' + m.k + (a.swap === null && a.move === i ? ' on' : '') + (locked ? ' locked' : '');
    b.disabled = locked;
    b.innerHTML = duelEsc(m.n) + '<small>' + duelEsc(duelMoveInfo(m, charge)) + '</small>';
    b.onclick = function(){ a.move = i; a.swap = null; sfx('tap'); duelPaintActDetail(); };
    box.appendChild(b);
  });
  const bench = duelArr(DU.priv && DU.priv.bench).filter(function(x){ return x.hp > 0; });
  if(bench.length && !a.zero){
    const b = document.createElement('button');
    b.className = 'duel-move swap' + (a.swap !== null ? ' on' : '');
    b.innerHTML = '換人<small>換下這位，本題不攻擊、不發動指令</small>';
    b.onclick = function(){ a.swap = a.swap === null ? bench[0].i : null; if(a.swap !== null){ a.sp = []; a.ab = false; } sfx('tap'); duelPaintActDetail(); };
    box.appendChild(b);
  }
  const mv = f && duelArr(f.moves)[a.move];
  const needTarget = !a.zero && a.swap === null && mv && mv.k !== 'guard' && !(mv.k === 'skill' && ['atk_up','def_up','evade_up','focus','charge','smite','crit_up','regen','thorns','heal','reload'].indexOf(mv.e) >= 0);
  $('duel-step-target').style.display = needTarget ? '' : 'none';
  $('duel-target-name').textContent = mv && mv.k === 'aoe' ? '（全體攻擊，不用選）' : (t ? duelCharOf(t.id).name : '—');
  const bl = $('duel-bench');
  bl.hidden = a.swap === null;
  if(a.swap !== null){
    const list = $('duel-bench-list'); list.innerHTML = '';
    bench.forEach(function(x){
      const b = document.createElement('button');
      b.textContent = duelCharOf(x.id).name + '（' + x.hp + '）';
      b.className = x.i === a.swap ? 'on' : '';
      b.onclick = function(){ a.swap = x.i; sfx('tap'); duelPaintActDetail(); };
      list.appendChild(b);
    });
  }

  /* 精神指令：依出手角色的定位 */
  const side = duelMySide(), used = side.spUsed || {}, have = Number(side.sp || 0);
  const list = duelSpList(f);
  a.sp = (a.sp || []).filter(function(k){ return list.indexOf(k) >= 0 && (!a.zero || DUEL_SP_ZERO_OK.indexOf(k) >= 0); });
  const spent = a.sp.reduce(function(t, k){ return t + duelSpCost(k); }, 0);
  $('duel-sp-now').textContent = 'SP ' + (have - spent) + ' / ' + have;
  const spBox = $('duel-sps'); spBox.innerHTML = '';
  list.forEach(function(k){
    const on = a.sp.indexOf(k) >= 0, cost = duelSpCost(k);
    const zeroBlock = a.zero && DUEL_SP_ZERO_OK.indexOf(k) < 0;
    const ok = on || (!used[k] && cost <= have - spent && !zeroBlock && a.swap === null);
    const b = document.createElement('button');
    b.className = 'duel-sp' + (on ? ' on' : '') + (used[k] ? ' used' : '');
    b.disabled = !ok;
    b.title = DUEL_SP_DESC[k] || '';
    b.innerHTML = '<b>' + duelEsc(duelSpName(k)) + '</b><em>' + (used[k] ? '已用' : cost + ' SP') + '</em><span>' +
      duelEsc(zeroBlock ? '沒有發動權時不能用' : (DUEL_SP_DESC[k] || '')) + '</span>';
    b.onclick = function(){
      const i = a.sp.indexOf(k);
      if(i >= 0) a.sp.splice(i, 1); else a.sp.push(k);
      sfx(i >= 0 ? 'tap' : 'buff'); duelPaintActDetail();
    };
    spBox.appendChild(b);
  });

  /* 大絕招：體力低於 40% 解鎖，一位角色一場一次 */
  const abBtn = $('duel-ab');
  if(f && f.ab && !a.zero){
    const ready = duelAbReady(f) && a.swap === null;
    if(!ready) a.ab = false;
    abBtn.hidden = false;
    abBtn.disabled = !ready;
    abBtn.className = 'duel-ab' + (a.ab ? ' on' : '') + (ready ? ' ready' : '');
    const desc = (typeof ABILITY_TEXT !== 'undefined' && ABILITY_TEXT[f.ab.e]) || '';
    abBtn.title = desc;
    abBtn.innerHTML = ready
      ? '<b>★ 大絕招：' + duelEsc(f.ab.n) + '</b><span>' + duelEsc(desc) + '</span>'
      : '<b>★ 大絕招：' + duelEsc(f.ab.n) + '<small>' + (f.abUsed ? '（已使用）' : '（體力低於 40% 解鎖）') + '</small></b>';
    abBtn.onclick = function(){ if(!ready) return; a.ab = !a.ab; sfx(a.ab ? 'awaken' : 'tap'); duelPaintActDetail(); };
    if(ready){ const c = duelCharOf(f.id); if(c && typeof preloadAnimFor === 'function') preloadAnimFor(c); }
  }else{
    abBtn.hidden = true; a.ab = false;
  }

  $('duel-go').disabled = false; $('duel-skip').disabled = false;
  $('duel-go').textContent = a.zero ? (a.sp.length ? '發動指令' : '確定') : '確定出招';
  $('duel-act-status').textContent = a.zero ? '這一題沒有發動權：不能攻擊，出手角色會以一半效果防禦；可以先用防守類精神指令。' : '';
  duelMarkCards();
}
function duelMarkCards(){
  const p = DU.pub, a = DU.act;
  const choosing = p && p.phase === 'action' && a && a.q === p.q && !((DU.flags.acted[p.q] || {})[DU.uid]) && !DU.playing;
  if(choosing){ DU.lead = DU.lead || {}; DU.lead.me = a.who; if(!a.zero) DU.lead.op = a.target; }
  duelApplyLead();
  document.querySelectorAll('#scr-duel .duel-fc').forEach(function(el){
    el.classList.remove('pickable', 'sel', 'tgt');
    if(!choosing || el.classList.contains('down') || el.classList.contains('empty')) return;
    const k = el.dataset.side, slot = Number(el.dataset.slot);
    if(k === 'op' && a.zero) return;
    el.classList.add('pickable');
    if(k === 'me' && slot === a.who) el.classList.add('sel');
    const mv = duelArr(duelMyField()[a.who] && duelMyField()[a.who].moves)[a.move];
    if(k === 'op' && slot === a.target && a.swap === null && mv && mv.k !== 'guard' && mv.k !== 'aoe') el.classList.add('tgt');
  });
}
function duelCardClick(k, slot){
  const p = DU.pub, a = DU.act;
  if(!p || p.phase !== 'action' || !a || DU.playing || (DU.flags.acted[p.q] || {})[DU.uid]) return;
  if(k === 'me'){
    const f = duelMyField()[slot];
    if(!f || f.hp <= 0) return;
    if(a.who !== slot){ a.who = slot; a.move = duelBestMoveIdx(f); a.swap = null; a.ab = false; }
  }else{
    if(a.zero) return;
    const t = duelOpField()[slot];
    if(!t || t.hp <= 0) return;
    a.target = slot;
  }
  sfx('tap'); duelPaintActDetail();
}
function duelSendAction(skip){
  const p = DU.pub, a = DU.act;
  if(!p || p.phase !== 'action' || !a) return;
  const n = p.q, upd = {};
  let act;
  if(a.zero) act = { who: a.who };
  else if(a.swap !== null) act = { who: a.who, swap: a.swap };
  else act = { who: a.who, move: a.move, target: a.target };
  if(a.swap === null && !skip && a.sp && a.sp.length) act.sp = a.sp.slice();
  if(!a.zero && a.swap === null && a.ab) act.ab = true;
  upd['act/' + n + '/' + DU.uid] = act;
  upd['acted/' + n + '/' + DU.uid] = true;
  $('duel-go').disabled = true; $('duel-skip').disabled = true;
  dref('matches/' + DU.mid).update(upd).then(function(){ sfx('select'); })
    .catch(function(e){ $('duel-act-status').textContent = '送出失敗（可能已超過時間）：' + e.message; });
}

/* ── 演出：依裁判的腳本逐一播放 ── */
function duelName(s, slot){
  const f = DU.vsides && DU.vsides[s] && duelArr(DU.vsides[s].field)[slot];
  return f ? duelCharOf(f.id).name : '';
}
/* 大絕招的全畫面演出：有演出動畫就播，沒有就用立繪；對戰版固定停留，不拖慢節奏 */
function duelCutIn(id, title, ms){
  const ch = duelCharOf(id);
  const wrap = document.createElement('div'); wrap.className = 'cutin duel-cut';
  const cap = document.createElement('span'); cap.textContent = title;
  wrap.appendChild(cap); document.body.appendChild(wrap);
  const tries = [].concat(typeof animSources === 'function' ? animSources(ch) : [], ch.img ? [ch.img] : [], ch.ph ? [ch.ph] : []);
  let i = 0;
  const im = document.createElement('img'); im.referrerPolicy = 'no-referrer';
  im.onerror = function(){ if(i < tries.length) im.src = tries[i++]; else im.remove(); };
  if(tries.length){ wrap.insertBefore(im, cap); im.src = tries[i++]; }
  setTimeout(function(){ wrap.classList.add('out'); setTimeout(function(){ wrap.remove(); }, 420); }, ms);
}
function duelAssistCut(allyId, label){
  const c = duelCharOf(allyId);
  if(typeof assistCutIn === 'function') assistCutIn({ img: c.img || c.ph, ph: c.ph || c.img, name: c.name }, label);
}
function duelPlay(p){
  const n = p.q, ev = duelArr(p.script && p.script.ev);
  DU.playing = true;
  duelRenderSides();
  $('duel-exp').hidden = true; $('duel-act').hidden = true;
  $('duel-h-phase').textContent = '交戰中';
  const first = p.script.first;
  duelLog('── 第 ' + n + ' 題：' + (first === duelMe() ? '你先出手' : '對手先出手') + ' ──', 'var(--dim)');
  const sideName = function(s){ return duelSideKey(s) === 'me' ? '我方' : '對手'; };
  const tone = function(s){ return duelSideKey(s) === 'me' ? 'var(--ion)' : 'var(--ember)'; };
  const setSt = function(s, slot, fn){
    const f = DU.vsides && DU.vsides[s] && duelArr(DU.vsides[s].field)[slot];
    if(!f) return;
    f.st = f.st || {}; fn(f);
  };
  let i = 0;
  const step = function(){
    if(i >= ev.length){ return finish(); }
    const e = ev[i++], k = duelSideKey(e.s), who = sideName(e.s) + '・' + duelName(e.s, e.slot);
    let wait = 850;
    if(['atk', 'sp', 'ab', 'skill', 'aoe', 'guard', 'counter'].indexOf(e.e) >= 0 && !e.sup){
      if(!(e.e === 'atk' && e.aoe)) duelSetLead(k, e.slot);
      if((e.e === 'atk' && !e.aoe) || (e.e === 'ab' && e.ts)) duelSetLead(duelSideKey(e.ts), e.tslot);
    }
    if(e.e === 'swap'){
      const side = DU.vsides[e.s], fld = duelArr(side.field);
      fld[e.slot] = e.f; side.field = fld;
      duelRenderSides(); duelFlash(k, e.slot, 'act');
      sfx('select'); duelLog('🔄 ' + sideName(e.s) + '換上「' + duelCharOf(e.f.id).name + '」');
    }else if(e.e === 'sp'){
      const names = duelArr(e.k).map(duelSpName).join('、');
      duelFlash(k, e.slot, 'act', 380);
      banner(duelArr(e.k).map(function(x){ return (SPIRITS[x] || {}).name || x; }).join('＋') + '！', true); sfx('buff');
      if(e.heal){ duelPop(k, e.slot, '+' + e.heal, 'block'); duelSetHp(k, e.slot, e.hp); duelFlash(k, e.slot, 'heal', 500); }
      duelLog('🌀 ' + who + ' 發動精神指令【' + names + '】' + (e.heal ? '，回復 ' + e.heal + ' 體力' : ''), tone(e.s));
      wait = 1100;
    }else if(e.e === 'ab'){
      duelCutIn(e.id, '★ ' + e.n, 3000);
      sfx('awaken'); banner(e.n, true);
      const desc = (typeof ABILITY_TEXT !== 'undefined' && ABILITY_TEXT[e.eff]) || '';
      setSt(e.s, e.slot, function(f){ f.abUsed = 1; });
      setTimeout(function(){
        if(e.heal){ duelPop(k, e.slot, '+' + e.heal, 'block'); duelSetHp(k, e.slot, e.hp); }
        if(e.dmg){ const tk = duelSideKey(e.ts); duelFlash(tk, e.tslot, 'hit', 360); duelPop(tk, e.tslot, '-' + e.dmg, 'crit'); duelSetHp(tk, e.tslot, e.thp); sfx('crit'); }
      }, 3100);
      duelLog('★ ' + who + ' 發動大絕招【' + e.n + '】：' + desc + (e.dmg ? '（' + e.dmg + ' 傷害）' : '') + (e.heal ? '（回復 ' + e.heal + '）' : ''), 'var(--gold)');
      wait = 3600;
    }else if(e.e === 'assist'){
      const ally = duelCharOf(e.ally).name;
      duelAssistCut(e.ally, e.kind === 'guard' ? '合體防禦！' : '合體攻擊！');
      sfx('assist');
      duelLog('🤝 ' + ally + ' 前來支援 ' + who + '：' + (e.kind === 'guard' ? '構築雙重防壁！' : '合體攻擊，威力大增！'), 'var(--gold)');
      wait = 1900;
    }else if(e.e === 'guard'){
      const el = duelCardEl(k, e.slot); if(el) el.classList.add('guarding');
      duelPop(k, e.slot, '防禦 ' + e.pct + '%', 'block'); sfx('guard');
      duelLog('🛡️ ' + who + (e.sup ? ' 支援防禦' : ' 架起【' + e.mv + '】') + '，減傷至 ' + e.pct + '%');
      wait = 520;
    }else if(e.e === 'aoe'){
      duelFlash(k, e.slot, 'act', 380); banner('全體攻擊！'); sfx('assist');
      duelLog('💥 ' + who + ' 施展全體攻擊【' + e.mv + '】！', tone(e.s));
      wait = 600;
    }else if(e.e === 'blitz'){
      banner('連續攻擊！'); sfx('assist'); wait = 450;
    }else if(e.e === 'awaken'){
      banner('覺醒！再行動！', true); sfx('awaken');
      duelLog('🌀 ' + who + ' 覺醒，再攻擊一次！', 'var(--ion)'); wait = 700;
    }else if(e.e === 'skill'){
      duelFlash(k, e.slot, 'act', 380); sfx(e.dmg ? 'debuff' : (e.heal ? 'heal' : 'buff'));
      const txt = duelSkillText(e.eff, e.role, e.n >= 2 ? 1 : 0.5);
      if(e.heal){ duelPop(k, e.slot, '+' + e.heal, 'block'); duelSetHp(k, e.slot, e.hp); }
      if(e.ts){
        const tk = duelSideKey(e.ts);
        if(e.dmg){ duelFlash(tk, e.tslot, 'hit', 360); duelPop(tk, e.tslot, '-' + e.dmg); duelSetHp(tk, e.tslot, e.thp); }
        else duelPop(tk, e.tslot, { poison: 'POISON', blind: 'BLIND', weaken: 'DOWN' }[e.eff] || '', 'block');
      }
      duelLog('✨ ' + who + ' 發動特技【' + e.mv + '】：' + txt, tone(e.s));
      wait = 900;
    }else if(e.e === 'fizzle'){
      duelPop(k, e.slot, '發動失敗', 'miss'); sfx('fail');
      duelLog('💨 發動權不足 50%，' + who + ' 的【' + e.mv + '】沒能成形', 'var(--dim)');
      wait = 600;
    }else if(e.e === 'atk'){
      const tk = duelSideKey(e.ts), tname = sideName(e.ts) + '・' + duelName(e.ts, e.tslot);
      duelFlash(k, e.slot, 'act', 380); sfx('swing');
      setTimeout(function(){
        if(!e.hit){
          duelPop(tk, e.tslot, e.miss === 'dodge' ? '必閃！' : (e.miss === 'evade' ? 'EVADE' : 'MISS'), 'miss'); sfx('miss');
          duelLog((e.sup || e.aoe ? '　↳ ' : '⚔️ ') + who + ' 的【' + e.mv + '】' + (e.miss === 'dodge' ? '被「必閃」閃過了' : '落空了'), 'var(--dim)');
          return;
        }
        duelFlash(tk, e.tslot, 'hit', 360);
        duelPop(tk, e.tslot, '-' + e.dmg, e.crit ? 'crit' : '');
        duelSetHp(tk, e.tslot, e.hp);
        if(e.crit){ if(!e.aoe) banner('CRITICAL!'); sfx('crit'); } else sfx(e.glance ? 'glance' : 'impact');
        const effTxt = { good: '效果絕佳！', bad: '效果不太好⋯', none: '幾乎沒有效果⋯' }[e.eff] || '';
        duelLog((e.sup || e.aoe ? '　↳ ' : '⚔️ ') + who + ' 的【' + e.mv + '】' + (e.as ? '（合體）' : '') + '命中 ' + tname + '：' + e.dmg + ' 傷害' +
          (e.crit ? '（會心！）' : (e.glance ? '（擦傷）' : '')) + (e.note ? '［' + e.note + '］' : '') + (effTxt ? ' ' + effTxt : '') +
          (e.blocked ? '（擋下 ' + e.blocked + '）' : ''), tk === 'me' ? 'var(--ember)' : 'var(--ion)');
      }, 300);
      wait = e.sup || e.aoe ? 700 : 950;
    }else if(e.e === 'counter' || e.e === 'thorns'){
      const tk = duelSideKey(e.ts);
      duelFlash(k, e.slot, 'act', 380);
      setTimeout(function(){
        duelFlash(tk, e.tslot, 'hit', 360); duelPop(tk, e.tslot, '-' + e.dmg); duelSetHp(tk, e.tslot, e.hp);
        if(e.e === 'counter'){ banner(e.as ? '合體反擊！' : 'COUNTER!', true); sfx('counter'); }
        else sfx('counter');
        duelLog(e.e === 'counter' ? '↩️ ' + who + ' 反擊！回敬 ' + e.dmg + ' 傷害' : '🌹 荊棘反傷！' + who + ' 反彈 ' + e.dmg + ' 傷害', 'var(--jade)');
      }, 250);
    }else if(e.e === 'tick'){
      if(e.kind === 'poison'){ duelPop(k, e.slot, '-' + e.dmg, 'block'); duelFlash(k, e.slot, 'hit', 300); sfx('debuff'); duelLog('☠️ ' + who + ' 中毒發作，流失 ' + e.dmg + ' 體力', '#5fae1a'); }
      else { duelPop(k, e.slot, '+' + e.heal, 'block'); duelFlash(k, e.slot, 'heal', 500); sfx('heal'); duelLog('💚 ' + who + ' 持續回復 ' + e.heal + ' 體力', 'var(--jade)'); }
      duelSetHp(k, e.slot, e.hp);
      wait = 600;
    }else if(e.e === 'ko'){
      const el = duelCardEl(k, e.slot); if(el) el.classList.add('down');
      sfx('ko'); duelLog('💥 ' + who + ' 倒下了！', k === 'me' ? 'var(--ember)' : 'var(--jade)');
      wait = 700;
    }
    DU.timers.play = setTimeout(step, wait);
  };
  const finish = function(){
    DU.playing = false; DU.played[n] = true;
    document.querySelectorAll('#scr-duel .duel-fc.guarding').forEach(function(el){ el.classList.remove('guarding'); });
    if(DU.afterPlay){ const f = DU.afterPlay; DU.afterPlay = null; f(); return; }
    if(DU.pub) duelBattle(DU.pub);
  };
  DU.timers.play = setTimeout(step, 400);
}

/* ── 解析、補位、下一題 ── */
function duelPaintExplain(p){
  const n = p.q, r = duelR(n), q = duelQ(n);
  const v = $('duel-exp-verdict');
  if(r){
    const rate = Number(r.rate) || 0;
    v.textContent = rate >= 1 ? '答對了！' : (rate > 0 ? '部分正確（' + Math.round(rate * 100) + '%）' : '答錯了');
    v.className = 'duel-verdict ' + (rate >= 1 ? 'ok' : 'ng');
    const letters = q ? duelArr(q.options).map(function(o, i){ return duelArr(r.correct).indexOf(o.c) >= 0 ? String.fromCharCode(65 + i) : ''; }).filter(Boolean).join('、') : '';
    $('duel-exp-text').textContent = (letters ? '正解：' + letters + '\n' : '') + (r.exp || '');
  }
  /* 我方場上有空位、替補還有人：可以指定誰上場（不選就依替補順序） */
  const field = duelArr(p.sides[duelMe()].field);
  const holes = [0, 1, 2].filter(function(k){ return !field[k] || field[k].hp <= 0; });
  const bench = duelArr(DU.priv && DU.priv.bench).filter(function(x){ return x.hp > 0; });
  const box = $('duel-pick');
  box.hidden = !(holes.length && bench.length);
  if(!box.hidden){
    const list = $('duel-pick-list'); list.innerHTML = '';
    const chosen = DU.pickFor === n ? DU.pickBench : null;
    bench.forEach(function(x){
      const b = document.createElement('button');
      b.className = 'bn' + (chosen === x.i ? ' on' : '');
      b.textContent = duelCharOf(x.id).name + '（' + x.hp + '）';
      b.onclick = function(){
        DU.pickFor = n; DU.pickBench = x.i; sfx('tap');
        dref('matches/' + DU.mid + '/pick/' + n + '/' + DU.uid).set({ slot: holes[0], bench: x.i });
        duelPaintExplain(p);
      };
      list.appendChild(b);
    });
  }
  const ready = !!((DU.flags.ready[n] || {})[DU.uid]);
  const opReady = !!((DU.flags.ready[n] || {})[p.players[duelOp()].uid]);
  const nb = $('duel-next');
  nb.disabled = ready;
  nb.textContent = Number(n) >= Number(p.qCount || 10) ? '看結算' : '下一題';
  $('duel-next-status').textContent = ready ? (opReady ? '雙方都準備好了！' : '等待對手⋯⋯') : (opReady ? '對手已經準備好了' : '');
}
function duelSendReady(){
  const p = DU.pub;
  if(!p || p.phase !== 'show') return;
  dref('matches/' + DU.mid + '/ready/' + p.q + '/' + DU.uid).set(true);
  $('duel-next').disabled = true; sfx('tap');
}
function duelOnFlags(k){
  const p = DU.pub;
  if(!p || DU.view !== 'battle') return;
  if(k === 'sub' && p.phase === 'answer') duelPaintQuestion(p);
  if(k === 'acted' && p.phase === 'action') duelPaintAction(p);
  if(k === 'ready' && p.phase === 'show' && DU.played[p.q] && !DU.playing) duelPaintExplain(p);
}

$('duel-answer').onclick = duelSendAnswer;
$('duel-go').onclick = function(){ duelSendAction(false); };
$('duel-skip').onclick = function(){ duelSendAction(true); };
$('duel-next').onclick = duelSendReady;
$('duel-surrender').onclick = function(){
  if(!DU.mid) return;
  if(!confirm('確定要投降嗎？本場會判定落敗。')) return;
  duelGas('duelForfeit', DU.mid).catch(function(e){ duelLog('投降失敗：' + e.message); });
};
