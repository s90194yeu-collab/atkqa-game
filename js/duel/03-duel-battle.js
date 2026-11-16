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
  $('duel-h-q').textContent = '第 ' + (p.q || 1) + ' / ' + (p.qCount || 15) + ' 題';

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
  const totals = { answer: (DU.info.rules && DU.info.rules.answer) || 25000, action: (DU.info.rules && DU.info.rules.action) || 10000, show: 5000 };
  duelTimer('duel-b-bar', 'duel-b-left', p.deadline, totals[p.phase] || 25000);

  $('duel-q').hidden = false;
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
  $('duel-h-mebench').textContent = '替補 ' + ((s[duelMe()] && s[duelMe()].benchLeft) || 0) + ' 位・連擊 ' + ((s[duelMe()] && s[duelMe()].combo) || 0);
  $('duel-h-opbench').textContent = '替補 ' + ((s[duelOp()] && s[duelOp()].benchLeft) || 0) + ' 位・連擊 ' + ((s[duelOp()] && s[duelOp()].combo) || 0);
  duelMarkCards();
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
    '<div class="dhp"><i style="width:' + Math.max(0, f.hp / f.maxHp * 100) + '%"></i></div><span class="dhpn">' + Math.max(0, f.hp) + ' / ' + f.maxHp + '</span>';
  d.appendChild(info);
  d.onclick = function(){ duelCardClick(k, slot); };
  return d;
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
function duelMyField(){ return duelArr(DU.pub.sides[duelMe()].field); }
function duelOpField(){ return duelArr(DU.pub.sides[duelOp()].field); }
function duelPaintAction(p){
  const n = p.q, charge = Number((p.charge || {})[duelMe()] || 0);
  const acted = !!((DU.flags.acted[n] || {})[DU.uid]);
  const alive = duelMyField().some(function(f){ return f && f.hp > 0; });
  $('duel-charge').textContent = Math.round(charge * 100) + '%';
  const opCharge = Number((p.charge || {})[duelOp()] || 0);
  $('duel-act-hint').textContent = '（對手 ' + Math.round(opCharge * 100) + '%' +
    (charge > opCharge ? '，你先出手' : (charge < opCharge ? '，對手先出手' : '，答得快的先出手')) + '）';
  const can = charge > 0 && alive && !acted;
  ['duel-step-who', 'duel-moves', 'duel-step-target', 'duel-go'].forEach(function(id){ const e = $(id); if(e) e.style.display = can ? '' : 'none'; });
  $('duel-moves').parentNode.style.display = can ? '' : 'none';
  if(!can){
    $('duel-bench').hidden = true;
    $('duel-act-status').textContent = acted ? '已出招，等待對手⋯⋯'
      : (!alive ? '場上沒有可以行動的角色。' : '這一題沒有發動權，無法攻擊：系統會讓體力最高的角色以一半效果防禦。');
    DU.act = null; duelMarkCards();
    return;
  }
  if(!DU.act || DU.act.q !== n) duelDefaultAct(n);
  duelPaintActDetail();
}
function duelDefaultAct(n){
  const mine = duelMyField(), theirs = duelOpField();
  let who = 0, best = -1;
  mine.forEach(function(f, i){ if(f && f.hp > 0 && f.hp > best){ best = f.hp; who = i; } });
  let target = 0, low = 1e9;
  theirs.forEach(function(f, i){ if(f && f.hp > 0 && f.hp < low){ low = f.hp; target = i; } });
  DU.act = { q: n, who: who, move: duelBestMoveIdx(mine[who]), target: target, swap: null };
}
function duelBestMoveIdx(f){
  let idx = 0, p = -1;
  (f && duelArr(f.moves) || []).forEach(function(m, i){ if((m.k === 'attack' || m.k === 'aoe') && m.p > p){ p = m.p; idx = i; } });
  return idx;
}
function duelPaintActDetail(){
  const a = DU.act, f = duelMyField()[a.who], t = duelOpField()[a.target];
  $('duel-who-name').textContent = f ? duelCharOf(f.id).name : '—';
  const box = $('duel-moves'); box.innerHTML = '';
  duelArr(f && f.moves).forEach(function(m, i){
    const b = document.createElement('button');
    const guard = m.k === 'guard';
    b.className = 'duel-move' + (guard ? ' guard' : '') + (a.swap === null && a.move === i ? ' on' : '');
    b.innerHTML = duelEsc(m.n) + '<small>' + (guard ? '防禦・減傷至 ' + Math.round((m.d || 0.5) * 100) + '%' : '攻擊・威力 ' + m.p + '・命中 ' + Math.round(m.a) + '%') + '</small>';
    b.onclick = function(){ a.move = i; a.swap = null; sfx('tap'); duelPaintActDetail(); };
    box.appendChild(b);
  });
  const bench = duelArr(DU.priv && DU.priv.bench).filter(function(x){ return x.hp > 0; });
  if(bench.length){
    const b = document.createElement('button');
    b.className = 'duel-move swap' + (a.swap !== null ? ' on' : '');
    b.innerHTML = '換人<small>換下這位，本題不攻擊</small>';
    b.onclick = function(){ a.swap = a.swap === null ? bench[0].i : null; sfx('tap'); duelPaintActDetail(); };
    box.appendChild(b);
  }
  const mv = f && duelArr(f.moves)[a.move];
  const needTarget = a.swap === null && mv && mv.k !== 'guard';
  $('duel-step-target').style.display = needTarget ? '' : 'none';
  $('duel-target-name').textContent = t ? duelCharOf(t.id).name : '—';
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
  $('duel-go').disabled = false;
  $('duel-act-status').textContent = '';
  duelMarkCards();
}
function duelMarkCards(){
  const p = DU.pub, a = DU.act;
  const choosing = p && p.phase === 'action' && a && a.q === p.q && !((DU.flags.acted[p.q] || {})[DU.uid]) && !DU.playing;
  document.querySelectorAll('#scr-duel .duel-fc').forEach(function(el){
    el.classList.remove('pickable', 'sel', 'tgt');
    if(!choosing || el.classList.contains('down') || el.classList.contains('empty')) return;
    const k = el.dataset.side, slot = Number(el.dataset.slot);
    el.classList.add('pickable');
    if(k === 'me' && slot === a.who) el.classList.add('sel');
    const mv = duelArr(duelMyField()[a.who] && duelMyField()[a.who].moves)[a.move];
    if(k === 'op' && slot === a.target && a.swap === null && mv && mv.k !== 'guard') el.classList.add('tgt');
  });
}
function duelCardClick(k, slot){
  const p = DU.pub, a = DU.act;
  if(!p || p.phase !== 'action' || !a || DU.playing || (DU.flags.acted[p.q] || {})[DU.uid]) return;
  if(k === 'me'){
    const f = duelMyField()[slot];
    if(!f || f.hp <= 0) return;
    a.who = slot; a.move = duelBestMoveIdx(f); a.swap = null;
  }else{
    const t = duelOpField()[slot];
    if(!t || t.hp <= 0) return;
    a.target = slot;
  }
  sfx('tap'); duelPaintActDetail();
}
function duelSendAction(){
  const p = DU.pub, a = DU.act;
  if(!p || p.phase !== 'action' || !a) return;
  const n = p.q, upd = {};
  upd['act/' + n + '/' + DU.uid] = a.swap !== null ? { who: a.who, swap: a.swap } : { who: a.who, move: a.move, target: a.target };
  upd['acted/' + n + '/' + DU.uid] = true;
  $('duel-go').disabled = true;
  dref('matches/' + DU.mid).update(upd).then(function(){ sfx('select'); })
    .catch(function(e){ $('duel-act-status').textContent = '送出失敗（可能已超過時間）：' + e.message; });
}

/* ── 演出：依裁判的腳本逐一播放 ── */
function duelName(s, slot){
  const f = DU.vsides && DU.vsides[s] && duelArr(DU.vsides[s].field)[slot];
  return f ? duelCharOf(f.id).name : '';
}
function duelPlay(p){
  const n = p.q, ev = duelArr(p.script && p.script.ev);
  DU.playing = true;
  duelRenderSides();
  $('duel-exp').hidden = true; $('duel-act').hidden = true;
  $('duel-h-phase').textContent = '交戰中';
  const first = p.script.first;
  duelLog('── 第 ' + n + ' 題：' + (first === duelMe() ? '你先出手' : '對手先出手') + ' ──', 'var(--dim)');
  let i = 0;
  const step = function(){
    if(!DU.mid || DU.pub !== p && DU.pub && DU.pub.q !== n && DU.pub.phase === 'answer'){ /* 下一題已經開始：直接結束 */ }
    if(i >= ev.length){ return finish(); }
    const e = ev[i++], k = duelSideKey(e.s), who = (k === 'me' ? '我方' : '對手') + '・' + duelName(e.s, e.slot);
    let wait = 850;
    if(e.e === 'swap'){
      const side = DU.vsides[e.s], fld = duelArr(side.field);
      fld[e.slot] = e.f; side.field = fld;
      duelRenderSides(); duelFlash(k, e.slot, 'act');
      sfx('select'); duelLog('🔄 ' + (k === 'me' ? '我方' : '對手') + '換上「' + duelCharOf(e.f.id).name + '」');
    }else if(e.e === 'guard'){
      const el = duelCardEl(k, e.slot); if(el) el.classList.add('guarding');
      duelPop(k, e.slot, '防禦 ' + e.pct + '%', 'block'); sfx('guard');
      duelLog('🛡️ ' + who + (e.sup ? ' 支援防禦' : ' 架起【' + e.mv + '】') + '，減傷至 ' + e.pct + '%');
      wait = 520;
    }else if(e.e === 'atk'){
      const tk = duelSideKey(e.ts), tname = (tk === 'me' ? '我方' : '對手') + '・' + duelName(e.ts, e.tslot);
      duelFlash(k, e.slot, 'act', 380); sfx('swing');
      setTimeout(function(){
        if(!e.hit){
          duelPop(tk, e.tslot, e.miss === 'evade' ? 'EVADE' : 'MISS', 'miss'); sfx('miss');
          duelLog((e.sup ? '　↳ ' : '⚔️ ') + who + ' 的【' + e.mv + '】落空了', 'var(--dim)');
          return;
        }
        duelFlash(tk, e.tslot, 'hit', 360);
        duelPop(tk, e.tslot, '-' + e.dmg, e.crit ? 'crit' : '');
        duelSetHp(tk, e.tslot, e.hp);
        if(e.crit){ banner('CRITICAL!'); sfx('crit'); } else sfx(e.glance ? 'glance' : 'impact');
        const effTxt = { good: '效果絕佳！', bad: '效果不太好⋯', none: '幾乎沒有效果⋯' }[e.eff] || '';
        duelLog((e.sup ? '　↳ ' : '⚔️ ') + who + ' 的【' + e.mv + '】命中 ' + tname + '：' + e.dmg + ' 傷害' +
          (e.crit ? '（會心！）' : (e.glance ? '（擦傷）' : '')) + (effTxt ? ' ' + effTxt : '') +
          (e.blocked ? '（擋下 ' + e.blocked + '）' : ''), tk === 'me' ? 'var(--ember)' : 'var(--ion)');
      }, 300);
      wait = e.sup ? 700 : 950;
    }else if(e.e === 'counter'){
      const tk = duelSideKey(e.ts);
      duelFlash(k, e.slot, 'act', 380);
      setTimeout(function(){
        duelFlash(tk, e.tslot, 'hit', 360); duelPop(tk, e.tslot, '-' + e.dmg); duelSetHp(tk, e.tslot, e.hp);
        banner('COUNTER!', true); sfx('counter');
        duelLog('↩️ ' + who + ' 反擊！回敬 ' + e.dmg + ' 傷害', 'var(--jade)');
      }, 250);
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
  nb.textContent = Number(n) >= Number(p.qCount || 15) ? '看結算' : '下一題';
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
$('duel-go').onclick = duelSendAction;
$('duel-next').onclick = duelSendReady;
$('duel-surrender').onclick = function(){
  if(!DU.mid) return;
  if(!confirm('確定要投降嗎？本場會判定落敗。')) return;
  duelGas('duelForfeit', DU.mid).catch(function(e){ duelLog('投降失敗：' + e.message); });
};
