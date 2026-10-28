/* 【19-battle-moves.js】戰鬥：招式面板、特色能力、特技、傷害與命中
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
function buildTactics(){
  const box = $('t-moves'); box.innerHTML = '';
  const hint = $('t-zero-hint');
  if(hint) hint.hidden = (S.charge > 0);
  /* 發動權 0＝這題完全沒答對：攻擊傷害歸零、特技也發不起來，
     整排招式停用，只留精神指令可以操作，避免玩家白選一輪。 */
  const zeroCharge = (S.charge <= 0);
  const lowCharge  = (S.charge < 0.5);
  S.player.moves.forEach(m=>{
    const locked = zeroCharge || (m.kind === 'skill' && lowCharge);
    const b = document.createElement('button');
    b.className = 'move kind-' + (m.kind === 'aoe' ? 'aoe' : isAtkKind(m.kind) ? 'attack' : m.kind);
    b.disabled = locked;
    if(locked) b.classList.add('locked');
    const tag = document.createElement('em');
    tag.textContent = kindLabel(m);
    const nm = document.createElement('b'); nm.textContent = m.name;
    const info = document.createElement('span');
    if(isAtkKind(m.kind)){
      const real = (m.kind === 'aoe')
        ? hitChanceAll(S.player, S.pSt, m)
        : hitChance(S.player, S.pSt, S.enemy, S.eSt, m);
      const accCls = real < 70 ? 'lowacc' : real < 85 ? 'midacc' : 'hiacc';
      const nFoe = (m.kind === 'aoe') ? aliveFoes().length : 1;
      const est = Math.round(m.power * (real/100) * (m.kind==='aoe' ? CONFIG.aoeScale*nFoe : 1));
      info.innerHTML = (m.kind === 'aoe' ? '<b class="aoe-tag">全體 ×' + nFoe + '</b>　' : '') +
        '威力 ' + m.power +
        '　<span class="hit-est">實際命中 <b class="'+accCls+'">' + real + '%</b>' +
        (m.kind === 'aoe' ? '（平均）' : '') + '</span>' +
        '　<span class="dmg-est">期望輸出 ' + est + '</span>' +
        '';
    }else if(m.kind === 'guard'){
      const th = threatOf(S.enemy, S.eSt);
      const eff = S.pSt.master ? m.defense * 0.5 : m.defense;
      info.textContent = '減傷至 ' + Math.round(eff*100) + '%，有機會反擊' +
        (th ? ('　可擋下約 ' + Math.max(0, th.dmg - Math.round(th.dmg*eff)) + ' 傷害') : '');
    }else{
      info.textContent = skillText(m.effect, S.player.role) + '（需發動權 50% 以上）';
    }
    if(locked){
      const warn = document.createElement('span');
      warn.className = 'move-lock';
      warn.textContent = zeroCharge
        ? '⚠ 發動權 0％，這題無法出招 —— 改用精神指令'
        : '⚠ 發動權未達 50％，特技發不起來';
      b.appendChild(warn);
    }
    b.append(tag, nm, info);
    b.onclick = ()=>{
      if(b.disabled) return;
      box.querySelectorAll('.move').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel'); S.move = m; sfx('select');
      const btn = $('main-btn');
      btn.disabled = false;
      btn.textContent = m.kind==='aoe' ? '💥 全體攻擊'
                      : isAtkKind(m.kind) ? '⚔️ 執行攻擊'
                      : m.kind==='guard' ? '🛡️ 擺出防禦' : '✨ 發動特技';
      btn.onclick = resolveTurn;
    };
    box.appendChild(b);
  });

  refreshAbilityBtn();
  refreshCatSolve();
}

/* 特色能力隨時可用（含作答前），一場一次 */
/* 宿敵能力的說明會帶出被指定的陣營名稱 */
function abilityDesc(ch){
  if(!ch || !ch.ability) return '';
  const t = ABILITY_TEXT[ch.ability.effect] || '';
  if(ch.ability.effect === 'nemesis' && ch.nemesisOf)
    return t.replace('指定陣營', UNI_LABEL[ch.nemesisOf] || ch.nemesisOf);
  return t;
}

/* 集滿七隻貓的獎勵：每場可額外使用一次「直接解題」，任何角色都能用 */
function refreshCatSolve(){
  const b = $('cat-solve'); if(!b) return;
  if(!allCatsUnlocked() || !S.current || S.answered || S.finished){ b.hidden = true; return; }
  b.hidden = false;
  b.disabled = S.catSolveUsed;
  b.innerHTML = '';
  const t1 = document.createElement('b');
  t1.textContent = S.catSolveUsed ? '🐾 直接解題（本場已用完）' : '🐾 直接解題';
  const t2 = document.createElement('span');
  t2.textContent = S.catSolveUsed ? '集滿七隻貓的獎勵，每場限用一次。'
                                  : '七隻貓替你把正解圈出來，按下送出即可。每場限用一次。';
  b.append(t1, t2);
  b.onclick = function(){
    if(S.catSolveUsed || S.answered || !S.current) return;
    S.catSolveUsed = true;
    S.picked.clear();
    document.querySelectorAll('.opt').forEach(function(el, idx){
      const right = S.current.options[idx] && S.current.options[idx].correct;
      if(right){ S.picked.add(idx); el.classList.add('sel'); }
      else { el.classList.remove('sel'); }
    });
    sfx('awaken');
    log('🐾 七貓齊聚——牠們把答案圈出來了。', 'var(--gold)');
    refreshCatSolve();
  };
}

function refreshAbilityBtn(){
  const ab = $('t-ability');
  if(S.pSt.abilitySealed){ ab.hidden = true; return; }
  // 「直接解題」不受一場一次的限制，每一題都能按
  const unlimited = S.player && S.player.ability && S.player.ability.effect === 'auto_solve';
  // 無限次能力：只要換了一題就重新開放（用題號比對，不受流程分支影響）
  if(unlimited && S.current && S.abUsedQ === S.current.id){ ab.hidden = true; return; }
  if(S.player && S.player.ability && (unlimited || !S.pSt.usedAb[S.player.id]) && !S.finished){
    ab.hidden = false;
    ab.innerHTML = '';
    const t1 = document.createElement('b');
    t1.textContent = '★ 發動特色能力：' + S.player.ability.name;
    const t2 = document.createElement('span');
    t2.textContent = ABILITY_TEXT[S.player.ability.effect] || '';
    ab.append(t1, t2);
    ab.onclick = useAbility;
  }else ab.hidden = true;
}

/* ---------- 特色能力 ---------- */
function useAbility(){
  const a = S.player.ability;
  const noLimit = a && a.effect === 'auto_solve';
  if(!a || S.pSt.abilitySealed || S.busy || S.resolved) return;
  if(noLimit ? (S.current && S.abUsedQ === S.current.id) : S.pSt.usedAb[S.player.id]) return;
  if(!noLimit) S.pSt.usedAb[S.player.id] = true;
  if(noLimit) S.abUsedQ = S.current ? S.current.id : null;   // 同一題不重複發動
  $('t-ability').hidden = true;
  $('p-img').classList.add('glow');
  auraFx('p'); screenFlash('cyan'); banner(a.name, true); sfx('awaken');
  setTimeout(()=>$('p-img').classList.remove('glow'), 900);
  say(S.player, 'ability', 'p');
  cutIn(S.player, a.name);        // 只有特色能力才播放全畫面演出圖（不阻塞，讓效果同步進行）
  log('★ ' + S.player.name + ' 發動【' + a.name + '】：' + (ABILITY_TEXT[a.effect]||''), 'var(--gold)');
  applyAbility(a.effect, S.player, S.enemy, S.pSt, 'e');
  paintHUD();
  awaken(S.enemy, S.eSt, 'e');
  /* 特色能力直接打倒整隊：清場換下一批，這一題繼續。
     原本會直接結束整場（就算還在第一回合）。 */
  if(allFoesDown()) victoryThisQuestion(true);
  else if(S.enemy.hp <= 0){ syncTarget(); paintHUD(); }
}

function applyAbility(effect, self, foe, st, foeSide){
  switch(effect){
    case 'overdrive':   st.odrive = 3; st.odriveMul = 1.6; break;
    case 'trans_am':    st.odrive = 3; st.odriveMul = 1.5; break;
    case 'fortress':    st.fort = 3; break;
    case 'revive':      { const h = Math.round(self.maxHp*0.30); self.hp = Math.min(self.maxHp, self.hp+h);
                          popNumber(foeSide==='e'?'f-p':'f-e', '+'+h, 'heal'); sfx('heal'); break; }
    case 'lucky_star':  st.lucky = 3; break;
    case 'purge':       { ['poison','blind','weaken','fragile'].forEach(k=>st[k]=0);
                          const h = Math.round(self.maxHp*0.15); self.hp = Math.min(self.maxHp, self.hp+h);
                          popNumber(foeSide==='e'?'f-p':'f-e', '+'+h, 'heal'); sfx('heal'); break; }
    case 'zero_system': st.zero = true; break;
    case 'last_burst':  st.burst = 1; break;
    case 'jackpot':     st.jackpot = 1; break;
    case 'blitz':       st.extraHit = 1; break;
    case 'retaliate':   st.thorns = 3; st.thornsVal = 0.55; st.alwaysCounter = 3; break;
    case 'endure':      st.fort = 3; st.regen = 3; st.regenPct = 0.08; break;
    case 'seed_mode':   st.seed = 1; break;
    case 'alaya_vijnana': st.alaya = true; break;   /* 天敵直覺：見下方 combatCalc */
    case 'execute':     { const d = Math.round(foe.maxHp*0.18); foe.hp -= d;
                          attackFx(foeSide,'beam'); impact(foeSide,true);
                          popNumber(foeSide==='e'?'f-e':'f-p', d, 'crit'); sfx('crit'); break; }
    case 'nemesis':     st.nemesis = true; break;   /* 宿敵：見下方 combatCalc */
    case 'ntd_system':  { const u = foe.clan;
                          const d = 150;   /* 舊版對特定陣營加成，新版未使用此能力，統一 150 */
                          foe.hp -= d; attackFx(foeSide,'beam'); impact(foeSide,true);
                          popNumber(foeSide==='e'?'f-e':'f-p', d, 'crit'); sfx('crit'); break; }
    case 'auto_solve':  {
      if(st === S.pSt && S.current){
        if(!S.answered){
          // 作答前：直接把正解勾起來，學生再按送出即可
          S.picked.clear();
          document.querySelectorAll('.opt').forEach((el,idx)=>{
            const right = S.current.options[idx] && S.current.options[idx].correct;
            el.classList.toggle('sel', !!right);
            if(right) S.picked.add(idx);
          });
          log('🔎 ' + S.player.name + ' 看穿了整道題目，正解已自動勾選——按下送出即可。', 'var(--gold)');
        }else{
          S.charge = 1; paintCharge();
          document.querySelectorAll('.opt').forEach(el=>el.classList.remove('wrong'));
          log('🔎 ' + S.player.name + ' 事後補完了解法，發動權補滿 100%。', 'var(--gold)');
        }
        banner('SOLVED!', true); sfx('perfect');
      }else{ st.focus = 1; }
      break;
    }
    case 'psyco_frame': { foe.hp -= 200; attackFx(foeSide,'beam'); impact(foeSide,true);
                          popNumber(foeSide==='e'?'f-e':'f-p', 200, 'crit'); sfx('crit'); break; }
  }
}

/* ---------- 特技 ---------- */
function applySkill(move, self, foe, st, fst, selfSide, charge){
  const long = charge >= 1 ? 2 : 1;
  const foeSide = selfSide === 'p' ? 'e' : 'p';
  const selfHost = selfSide === 'p' ? 'f-p' : 'f-e';
  const foeHost  = selfSide === 'p' ? 'f-e' : 'f-p';
  const role = self.role || 'balance';
  const V = e => mag(e, role);
  switch(move.effect){
    case 'atk_up':   st.atkUp = long; st.atkUpMul = V('atk_up'); auraFx(selfSide); sfx('buff'); break;
    case 'def_up':   st.defUp = long; st.defUpMul = V('def_up'); auraFx(selfSide); sfx('buff'); break;
    case 'evade_up': st.evadeUp = long; st.evadeUpVal = V('evade_up'); auraFx(selfSide); sfx('buff'); break;
    case 'focus':    st.focus = 1; st.focusCrit = V('focus'); auraFx(selfSide); sfx('buff'); break;
    case 'charge':   st.charge = 1; st.chargeMul = V('charge'); auraFx(selfSide); sfx('buff'); break;
    case 'smite':    st.smite = 1; st.smiteVal = Math.round(V('smite')*charge);
                     auraFx(selfSide); sfx('buff'); break;
    case 'crit_up':  st.critUp = long; st.critUpVal = V('crit_up'); auraFx(selfSide); sfx('buff'); break;
    case 'regen':    st.regen = 3; st.regenPct = V('regen'); auraFx(selfSide); sfx('heal'); break;
    case 'thorns':   st.thorns = long; st.thornsVal = V('thorns'); auraFx(selfSide); sfx('buff'); break;
    case 'drain':    { const d = Math.round(V('drain')*charge);
                       foe.hp -= d; self.hp = Math.min(self.maxHp, self.hp + d);
                       popNumber(foeHost, d); popNumber(selfHost,'+'+d,'heal');
                       sfx('debuff'); break; }
    case 'heal':     { const h = Math.round(self.maxHp*V('heal')*charge);
                       self.hp = Math.min(self.maxHp, self.hp+h);
                       popNumber(selfHost,'+'+h,'heal'); sfx('heal'); break; }
    case 'reload':   { const h = Math.round(self.maxHp*0.20);
                       self.hp = Math.min(self.maxHp, self.hp+h);
                       popNumber(selfHost,'+'+h,'heal'); sfx('heal'); break; }
    case 'poison':   fst.poison = long + 1; fst.poisonPct = V('poison');
                     popNumber(foeHost,'POISON','block'); sfx('debuff'); break;
    case 'blind':    fst.blind = long + 1; fst.blindVal = V('blind');
                     popNumber(foeHost,'BLIND','block'); sfx('debuff'); break;
    case 'weaken':   fst.weaken = long + 1; fst.fragile = long; fst.weakenMul = V('weaken');
                     popNumber(foeHost,'DOWN','block'); sfx('debuff'); break;
  }
}

/* ---------- 合體攻擊／防禦 ---------- */
function pickAlly(ch){
  const mates = ALL_CHARACTERS.filter(c=>c.clan===ch.clan && !c.isUpgrade && !c.secret && c.id!==ch.id);
  return mates.length ? mates[Math.floor(Math.random()*mates.length)] : null;
}

/* ---------- 傷害計算 ---------- */
function damage(attacker, defender, move, charge, A, D, scale, comboLv){
  const atkT = BREATH[move.type] || move.type;
  const defT = defTypeOf(defender);
  const chart = TYPE_CHART[atkT];
  const ra = roleOf(attacker);
  let multi = 1, note = '', crit = false, glance = false;

  if(chart){
    if((chart.none||[]).indexOf(defT) >= 0)     { multi = 0.25; note = '幾乎沒有效果…'; }
    else if(chart.good.indexOf(defT) >= 0)      { multi = 1.5;  note = '效果絕佳！'; }
    else if(chart.bad.indexOf(defT) >= 0)       { multi = 0.5;  note = '效果不太好…'; }
  }
  if(A.seed > 0){ multi = 1.5; note = '覺醒爆發！'; }

  multi *= ra.atk;
  if(A.atkUp > 0)  multi *= A.atkUpMul;
  if(A.odrive > 0) multi *= A.odriveMul;
  if(A.zero)       multi *= 1.2;
  /* 天敵直覺：這一擊的屬性剋制對手時再 ×1.4
     （原本綁「近戰」屬性，新版八屬性沒有這一項，等於永遠不會觸發） */
  if(A.alaya && chart && chart.good.indexOf(defT) >= 0) multi *= 1.4;
  /* 宿敵：攻擊方被指定的陣營，正好是對手的陣營時 ×1.5 */
  if(A.nemesis && attacker.nemesisOf && defender.universe === attacker.nemesisOf) multi *= 1.5;
  if(A.weaken > 0) multi *= A.weakenMul;
  if(A.charge > 0){ multi *= A.chargeMul; note = '蓄力解放！'; }
  if(A.spDmg > 0){ multi *= A.spDmg; note = (A.spDmg >= 2.5 ? '魂！' : '熱血！'); }
  if(D.spIron > 0) multi *= 0.25;
  if(A.burst > 0){  multi *= 2.6; note = '最後爆發！'; }
  if(D.defUp > 0)  multi *= D.defUpMul;
  if(D.fort > 0)   multi *= 0.55;
  /* 天敵直覺（防禦端）：對手的屬性正好被自己剋制時，受創 ×0.75 */
  if(D.alaya){
    const _dc = TYPE_CHART[defTypeOf(defender)];
    if(_dc && _dc.good.indexOf(atkT) >= 0) multi *= 0.75;
  }
  /* 宿敵（防禦端）：來犯者正是指定陣營時，受創 ×0.7 */
  if(D.nemesis && defender.nemesisOf && attacker.universe === defender.nemesisOf) multi *= 0.7;
  if(D.fragile > 0) multi *= 1.5;
  /* 成長系統：題型熟練度與每週活動，只加在我方出招 */
  if(attacker === S.player) multi *= growthDmgMul(move);
  if(comboLv) multi *= (1 + comboLv * CONFIG.comboStep);

  if(move.kind === 'aoe'){
    // 群攻打得廣，但打不出會心
    if(multi > 0 && Math.random() < CONFIG.glanceRate){
      glance = true; multi *= CONFIG.glanceMulti; note = '只是擦傷…';
    }
  }else if(multi > 0){
    if(A.spCrit > 0){
      crit = true; multi *= CONFIG.critMulti; note = '魂・會心！';
    }else if(A.jackpot > 0){
      crit = true; multi *= 2; note = 'JACKPOT！';
    }else{
      let critRate = CONFIG.critRate + ra.crit + (charge >= 1 ? 0.08 : 0) +
                     (A.zero ? 0.10 : 0) + (A.focus > 0 ? A.focusCrit : 0) +
                     (A.critUp > 0 ? A.critUpVal : 0) + (A.lucky > 0 ? 0.40 : 0);
      const roll = Math.random();
      if(roll < critRate){ crit = true; multi *= CONFIG.critMulti; note = '會心一擊！'; }
      else if(roll > 1 - CONFIG.glanceRate){ glance = true; multi *= CONFIG.glanceMulti; note = '只是擦傷…'; }
    }
  }

  const base = move.power + (A.muzan ? 40 : 0);
  const variance = CONFIG.varMin + Math.random() * (CONFIG.varMax - CONFIG.varMin);
  let out = Math.max(0, Math.round(base * variance * multi * charge * scale));
  if(A.smite > 0 && out > 0){ out += A.smiteVal; note = (note ? note + ' ' : '') + '追加打擊！'; }
  return {dmg: out, note, multi, crit, glance};
}
/* 對某個目標的實際命中率（已計入定位修正、致盲、對手閃避） */
function hitChance(attacker, aSt, target, tSt, move){
  if(!move || !isAtkKind(move.kind)) return 100;
  if(aSt && (aSt.focus > 0 || aSt.seed > 0 || aSt.spHit > 0)) return 100;
  if(tSt && tSt.spDodge > 0) return 0;
  const acc = clamp((move.acc || 100) + roleOf(attacker).acc
                    + ((aSt && aSt.spFocus > 0) ? 25 : 0)
                    - ((aSt && aSt.blind > 0) ? aSt.blindVal : 0), 5, 100);
  const eva = target ? evasionOf(target, tSt || newStatus()) : 0;
  return Math.max(1, Math.round(acc * (1 - eva)));
}
/* 群攻：對所有存活目標的平均命中率 */
function hitChanceAll(attacker, aSt, move){
  const alive = S.foes.map(function(e,i){ return {e:e, st:S.foeSt[i]}; })
                      .filter(function(x){ return x.e.hp > 0; });
  if(!alive.length) return 100;
  let t = 0;
  alive.forEach(function(x){ t += hitChance(attacker, aSt, x.e, x.st, move); });
  return Math.round(t / alive.length);
}

/* 敵方威脅預估：這名對手打到你的機率與期望傷害 */
function threatOf(foe, fSt){
  if(!foe || !S.player || foe.hp <= 0) return null;
  const mv = mainAtk(foe);
  if(!mv) return null;
  const hit = hitChance(foe, fSt, S.player, S.pSt, mv);
  const scale = CONFIG.enemyDmg * (CONFIG.enemyDmgMulti[S.difficulty] || 1);
  const ra = roleOf(foe);
  let raw = mv.power * ra.atk * scale;
  if(fSt.atkUp > 0)  raw *= fSt.atkUpMul;
  if(fSt.odrive > 0) raw *= fSt.odriveMul;
  if(fSt.weaken > 0) raw *= fSt.weakenMul;
  if(S.pSt.defUp > 0) raw *= S.pSt.defUpMul;
  if(S.pSt.fort > 0)  raw *= 0.55;
  const dmg = Math.round(raw * (hit / 100));
  const gv = mainGuard(S.player);
  const guarded = gv ? Math.round(dmg * (S.pSt.master ? gv.defense * 0.5 : gv.defense)) : null;
  return {hit:hit, dmg:dmg, guarded:guarded};
}
function threatText(foe, fSt){
  const t = threatOf(foe, fSt);
  if(!t) return '';
  return '對你命中 ' + t.hit + '%　預估傷害 ' + t.dmg +
         (t.guarded !== null ? '（防禦後約 ' + t.guarded + '）' : '');
}

function evasionOf(ch, st){
  return clamp(roleOf(ch).eva + (st.evadeUp > 0 ? st.evadeUpVal : 0)
             + (st.lucky > 0 ? 0.20 : 0) + (st.spFocus > 0 ? 0.15 : 0), 0, 0.55);
}
