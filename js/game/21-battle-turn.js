/* 【21-battle-turn.js】戰鬥：群攻、回合攻防、敵方行動、解析、倒下與復活
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ---------- 回合結算 ---------- */
/* 群體攻擊：對全部存活敵人各判定一次，單體傷害打折以維持平衡 */
async function aoeAttack(mv){
  if(S.charge <= 0){
    log('💨 發動權不足，' + mv.name + ' 沒能成形。', 'var(--dim)');
    popNumber('f-p','蓄力失敗','miss'); sfx('fail');
    return;
  }
  say(S.player, 'attack', 'p');
  banner('全體攻擊！'); sfx('assist');
  lunge('p'); sfx('swing');
  await wait(200);

  const targets = S.foes.map(function(e,i){ return {e:e,i:i}; })
                        .filter(function(x){ return x.e.hp > 0; });
  const scale = CONFIG.playerDmg * CONFIG.aoeScale;
  let total = 0;
  for(let k = 0; k < targets.length; k++){
    const t = targets[k];
    const st = S.foeSt[t.i];
    const dodged = !(S.pSt.focus>0 || S.pSt.seed>0) && Math.random() < evasionOf(t.e, st);
    const accEff = clamp(mv.acc + roleOf(S.player).acc - (S.pSt.blind>0?S.pSt.blindVal:0), 5, 100);
    const hit = !dodged && (S.pSt.focus>0 || S.pSt.seed>0 || Math.random()*100 <= accEff);
    const wasTarget = (t.i === S.target);
    if(!hit){
      if(wasTarget){ popNumber('f-e', dodged?'EVADE':'MISS', dodged?'block':'miss'); }
      log('　' + t.e.name + '：' + (dodged ? '閃開了' : '未命中'), 'var(--dim)');
      continue;
    }
    const r = damage(S.player, t.e, mv, S.charge, S.pSt, st, scale, S.combo);
    t.e.hp -= r.dmg; st.taken = (st.taken || 0) + r.dmg; total += r.dmg;
    log('　' + t.e.name + '：' + r.note + ' 受到 ' + r.dmg + ' 傷害', 'var(--jade)');
    if(wasTarget){
      attackFx('e', fxKindOf(mv));
      impact('e', r.crit);
      popNumber('f-e', r.dmg, r.crit ? 'crit' : '');
    }
    paintHUD();
    await wait(150);
  }
  screenFlash(); shakeStage(true); sfx('crit');
  log('💥 ' + mv.name + '！命中 ' + targets.length + ' 名目標，合計 ' + total + ' 傷害。', 'var(--gold)');
  S.pSt.focus = 0; S.pSt.charge = 0; S.pSt.smite = 0; S.pSt.burst = 0; S.pSt.jackpot = 0;
  S.foes.forEach(function(e,i){ awaken(e, S.foeSt[i], i === S.target ? 'e' : 'x'); });
}

/* 先攻判定：速度＝定位命中修正＋招式命中＋隨機，答對全題另有加成 */
function speedOf(ch, st, bonus){
  const mv = mainAtk(ch) || {acc:80};
  return roleOf(ch).acc * 2 + (mv.acc || 80) * 0.25
       + (st.evadeUp > 0 ? 8 : 0) + (bonus || 0) + Math.random() * 24;
}

/* 發動權 0 時的唯一出路：放棄本回合行動。
   敵方仍然會行動（不出招不代表對手會停手），然後照常進入解析畫面。 */
/* 發動權 0 的那一題：直接進入解析，不讓對手趁機攻擊。
   一定要走 finishQuestion()，否則題數不會累加、作答也不會記錄。
   想恢復「對手照樣出手」的懲罰，把 CONFIG.zeroChargeSafe 改成 false。 */
async function skipTurn(){
  if(S.busy || S.resolved) return;
  S.busy = true;
  const btn = $('main-btn');
  btn.disabled = true; btn.textContent = '交戰中…';
  $('t-body').hidden = true;
  window.scrollTo({top:0, behavior:'smooth'});
  await wait(280);

  if(CONFIG.zeroChargeSafe){
    log('⏭️ 這一題沒有取得發動權，直接看解析。', 'var(--dim)');
    await wait(200);
    S.busy = false;
    finishQuestion();
    return;
  }

  log('⏭️ 這一題沒有取得發動權，放棄行動。', 'var(--dim)');
  banner('放棄行動');
  await wait(320);

  if(!S.finished) await enemyPhase();     // 對手照樣出手
  if(S.finished){ S.busy = false; return; }

  /* 收尾比照 resolveTurn 的最後一段，狀態倒數才不會停住 */
  await poisonTick();
  if(S.player.hp <= 0) return playerDown();
  if(allFoesDown())    return victoryThisQuestion();
  if(S.enemy.hp <= 0){ syncTarget(); paintHUD(); }

  tickStatus(S.pSt); tickStatus(S.eSt);
  S.eSt.muzan = false; S.pSt.assistGuard = false;
  paintHUD();
  finishQuestion();
}

async function resolveTurn(){
  if(S.busy || !S.move) return;
  S.busy = true;
  const btn = $('main-btn');
  btn.disabled = true; btn.textContent = '交戰中…';
  $('t-body').hidden = true;
  window.scrollTo({top:0, behavior:'smooth'});   // 自動回到戰鬥畫面
  await wait(320);

  const mv = S.move;

  /* ── 先攻判定 ── */
  const pSpd = speedOf(S.player, S.pSt, S.charge >= 1 ? 14 : 0);
  const eLead = aliveFoes()[0] || S.enemy;
  const eSpd = speedOf(eLead, S.eSt, 0) + (S.difficulty === 'hard' ? 6 : 0);
  const enemyFirst = (mv.kind !== 'guard') && (S.pSt.spAccel <= 0) && (eSpd > pSpd);
  if(enemyFirst){
    log('⚡ ' + eLead.name + ' 搶得先機，先發制人！', 'var(--ember)');
    banner('先制攻擊！');
    await wait(500);
    await enemyPhase();
    paintHUD();
    awaken(S.player, S.pSt, 'p');
    await wait(460);
    if(S.player.hp <= 0){ return playerDown(); }
  }else if(mv.kind !== 'guard'){
    log('⚡ ' + S.player.name + ' 搶得先機！', 'var(--jade)');
  }

  /* ── 玩家行動 ── */
  if(mv.kind === 'aoe'){
    await aoeAttack(mv);
  }else if(mv.kind === 'guard'){
    const eff = 1 - (1 - mv.defense) * S.charge;
    S.pSt.guard = S.pSt.master ? eff * 0.5 : eff;
    say(S.player, 'guard', 'p');
    log('🛡️ ' + S.player.name + ' 以【' + mv.name + '】架起防禦（減傷至 ' +
        Math.round(S.pSt.guard*100) + '%）。', 'var(--ion)');
    auraFx('p'); $('p-img').classList.add('guarding');
    setTimeout(()=>$('p-img').classList.remove('guarding'), 900);
    sfx('guard');
    if(S.pSt.spFriend > 0 || Math.random() < CONFIG.assistRate){
      const ally = pickAlly(S.player);
      if(ally){
        S.pSt.assistGuard = true;
        showAssist('p', ally); sfx('assist');
        log('🤝 ' + ally.name + ' 前來支援，構築雙重防壁！', 'var(--jade)');
        await assistCutIn(ally, '合體防禦！');
      }
    }
  }else if(mv.kind === 'skill'){
    if(S.charge >= 0.5){
      say(S.player, 'skill', 'p');
      applySkill(mv, S.player, S.enemy, S.pSt, S.eSt, 'p', S.charge);
      S.skillUses++;
      const sk2 = CONFIG.skillPts * (S.pSt.spLuck > 0 ? 2 : 1);
      S.quizPts += sk2;
      log('✨ ' + S.player.name + ' 發動【' + mv.name + '】：' + skillText(mv.effect, S.player.role) +
          '（＋' + sk2 + ' 分）', 'var(--gold)');
    }else{
      log('💨 發動權不足 50%，【' + mv.name + '】發動失敗。', 'var(--dim)');
      sfx('fail');
    }
  }else if(S.charge <= 0){
    log('💨 發動權不足，招式在半途潰散。', 'var(--dim)');
    popNumber('f-p','蓄力失敗','miss'); sfx('fail');
  }else{
    let assistMul = 1;
    if(S.pSt.spFriend > 0 || Math.random() < CONFIG.assistRate){
      const ally = pickAlly(S.player);
      if(ally){
        assistMul = CONFIG.assistPower;
        showAssist('p', ally); sfx('assist');
        log('🤝 ' + ally.name + ' 加入攻擊！威力大幅提升！', 'var(--gold)');
        await assistCutIn(ally, '合體攻擊！');
      }
    }
    say(S.player, 'attack', 'p');
    const hits = (S.pSt.extraHit > 0) ? 2 : 1;
    if(hits > 1){ banner('連續攻擊！'); sfx('assist'); }
    for(let h = 0; h < hits; h++){
      if(S.enemy.hp <= 0) break;
      const sure = (S.pSt.focus>0 || S.pSt.seed>0 || S.pSt.spHit>0);
      const dodged = (S.eSt.spDodge > 0) || (!sure && Math.random() < evasionOf(S.enemy, S.eSt));
      const accEff = clamp(mv.acc + roleOf(S.player).acc + (S.pSt.spFocus>0?25:0)
                           - (S.pSt.blind>0?S.pSt.blindVal:0), 5, 100);
      const willHit = !dodged && (sure || Math.random()*100 <= accEff);
      lunge('p'); sfx('swing');
      await wait(190);

      if(dodged){
        popNumber('f-e','EVADE','block'); sfx('miss');
        log('🌀 ' + S.enemy.name + ' 身法閃過了這一擊！', 'var(--dim)');
      }else if(willHit){
        const r = damage(S.player, S.enemy, mv, S.charge, S.pSt, S.eSt, CONFIG.playerDmg, S.combo);
        const dmg = Math.round(r.dmg * assistMul);
        S.enemy.hp -= dmg;
        S.eSt.taken = (S.eSt.taken || 0) + dmg;
        attackFx('e', fxKindOf(mv));
        await wait(110);
        impact('e', r.crit || assistMul > 1);
        popNumber('f-e', dmg, r.crit ? 'crit' : '');
        if(r.crit){ screenFlash(); banner('CRITICAL!'); sfx('crit'); }
        else if(r.glance) sfx('glance');
        else sfx('impact');
        log('⚔️ ' + mv.name + ' 命中！' + r.note + ' 造成 ' + dmg + ' 傷害。',
            r.crit ? 'var(--gold)' : 'var(--jade)');
        S.pSt.smite = 0; S.pSt.burst = 0; S.pSt.jackpot = 0;
        paintHUD();
        await thornsBack(S.eSt, S.player, 'p', dmg);
      }else{
        popNumber('f-e','MISS','miss'); sfx('miss');
        log('💨 【' + mv.name + '】落空了！', 'var(--dim)');
      }
      if(h === 0 && hits > 1) await wait(360);
    }
    S.pSt.focus = 0; S.pSt.charge = 0; S.pSt.extraHit = 0;
    S.pSt.smite = 0; S.pSt.burst = 0; S.pSt.jackpot = 0;
  }

  paintHUD();
  awaken(S.enemy, S.eSt, 'e');
  await wait(700);
  if(allFoesDown()) return victoryThisQuestion();
  if(S.enemy.hp <= 0){
    log('💥 ' + S.enemy.name + ' 倒下了！', 'var(--gold)');
    if(allFoesDown()) return victoryThisQuestion();
    syncTarget(); paintHUD();
    log('🎯 自動鎖定下一個目標：' + S.enemy.name, 'var(--gold)');
    await wait(500);
  }

  /* ── 電腦行動（若已先攻過就跳過） ── */
  if(!enemyFirst) await enemyPhase();
  paintHUD();
  awaken(S.player, S.pSt, 'p');
  await wait(560);
  if(S.player.hp <= 0){ return playerDown(); }

  /* ── 覺醒：本題再行動一次 ── */
  if(S.pSt.spAwaken > 0 && S.player.hp > 0 && !allFoesDown()){
    S.pSt.spAwaken = 0;
    banner('覺醒！再行動！', true); sfx('awaken');
    log('🌀 覺醒發動——再行動一次！', 'var(--ion)');
    await wait(500);
    const mv2 = mainAtk(S.player);
    if(mv2 && S.charge > 0){
      lunge('p'); sfx('swing'); await wait(180);
      const r2 = damage(S.player, S.enemy, mv2, S.charge, S.pSt, S.eSt, CONFIG.playerDmg, S.combo);
      S.enemy.hp -= r2.dmg; S.eSt.taken = (S.eSt.taken||0) + r2.dmg;
      attackFx('e', fxKindOf(mv2)); impact('e', r2.crit);
      popNumber('f-e', r2.dmg, r2.crit ? 'crit' : '');
      log('⚔️ 追擊！' + mv2.name + ' 造成 ' + r2.dmg + ' 傷害。', 'var(--jade)');
      paintHUD();
      awaken(S.enemy, S.eSt, 'e');
      await wait(600);
      if(allFoesDown()) return victoryThisQuestion();
      if(S.enemy.hp <= 0){ syncTarget(); paintHUD(); }
    }
  }

  /* ── 收尾：毒、狀態倒數 ── */
  await poisonTick();
  if(S.player.hp <= 0){ return playerDown(); }
  if(allFoesDown()){ return victoryThisQuestion(); }
  if(S.enemy.hp <= 0){ syncTarget(); paintHUD(); }

  tickStatus(S.pSt); tickStatus(S.eSt);
  S.eSt.muzan = false; S.pSt.assistGuard = false;
  paintHUD();
  finishQuestion();
}

/* 受擊後的反傷 */
async function thornsBack(victimSt, attacker, attackerSide, dmg){
  if(!(victimSt.thorns > 0) || dmg <= 0) return;
  const back = Math.max(5, Math.round(dmg * victimSt.thornsVal));
  attacker.hp -= back;
  const host = attackerSide === 'p' ? 'f-p' : 'f-e';
  popNumber(host, back, 'block'); hpFlash(attackerSide); sfx('counter');
  log('🌹 荊棘反傷！' + attacker.name + ' 被反彈 ' + back + ' 點傷害。', 'var(--ember)');
  paintHUD();
  await wait(380);
}

async function poisonTick(){
  if(S.pSt.poison > 0){
    const d = Math.round(S.player.maxHp * 0.05);
    S.player.hp -= d; popNumber('f-p', d, 'block'); hpFlash('p'); sfx('debuff');
    log('☠️ 中毒發作，你流失 ' + d + ' 點體力。', '#5fae1a');
  }
  if(S.eSt.poison > 0){
    const d = Math.round(S.enemy.maxHp * 0.05);
    S.enemy.hp -= d; popNumber('f-e', d, 'block'); hpFlash('e'); sfx('debuff');
    log('☠️ ' + S.enemy.name + ' 中毒發作，流失 ' + d + ' 點體力。', '#5fae1a');
  }
  if(S.pSt.regen > 0){
    const h = Math.round(S.player.maxHp * S.pSt.regenPct);
    S.player.hp = Math.min(S.player.maxHp, S.player.hp + h);
    popNumber('f-p', '+'+h, 'heal'); sfx('heal');
    log('💚 持續回復，你恢復 ' + h + ' 點體力。', 'var(--jade)');
  }
  if(S.eSt.regen > 0){
    const h = Math.round(S.enemy.maxHp * S.eSt.regenPct);
    S.enemy.hp = Math.min(S.enemy.maxHp, S.enemy.hp + h);
    popNumber('f-e', '+'+h, 'heal');
  }
  if(S.pSt.poison > 0 || S.eSt.poison > 0 || S.pSt.regen > 0 || S.eSt.regen > 0){
    paintHUD(); await wait(520);
  }
}

/* 敵方全體行動：困難模式最多兩隻出手 */
async function enemyPhase(){
  const actors = [];
  S.foes.forEach(function(e, i){ if(e.hp > 0) actors.push(i); });
  const maxActs = (S.difficulty === 'hard') ? CONFIG.hardActs : 1;
  const acting = shuffle(actors).slice(0, maxActs);
  for(let k = 0; k < acting.length; k++){
    if(S.player.hp <= 0) break;
    const i = acting[k];
    if(S.foes[i].hp <= 0) continue;
    await enemyTurn(i);
    paintHUD();
    if(k < acting.length - 1) await wait(420);
  }
}

async function enemyTurn(idx){
  const i = (idx === undefined) ? S.target : idx;
  const e = S.foes.length ? S.foes[i] : S.enemy;
  const st = S.foes.length ? S.foeSt[i] : S.eSt;
  if(!e || e.hp <= 0) return;
  const lowHp = e.hp < e.maxHp * 0.5;

  if(e.ability && !st.usedAb[e.id] && lowHp){
    st.usedAb[e.id] = true;
    say(e, 'ability', 'e', i);
    if(i === S.target) await cutIn(e, e.ability.name);
    log('★ ' + e.name + ' 發動【' + e.ability.name + '】！', 'var(--ember)');
    banner(e.ability.name); screenFlash('red'); sfx('awaken');
    applyAbility(e.ability.effect, e, S.player, st, 'p');
    paintHUD(); await wait(620);
    if(S.player.hp <= 0) return;
  }

  const atkPool = movesOf(e,'atk');
  const atkMv   = atkPool.length ? atkPool[Math.floor(Math.random()*atkPool.length)] : null;
  const guardMv = mainGuard(e);
  const skillMv = mainSkill(e);

  let pick = 'attack';
  const roll = Math.random();
  // 本回合最後一題：增益已無施展空間，一律直接進攻
  const lastQ = (S.qInRound + 1 >= S.perRound) || !S.pool.length;
  if(!atkMv) pick = skillMv ? 'skill' : 'guard';
  else if(lastQ) pick = 'attack';
  else if(lowHp && roll < 0.22) pick = 'guard';
  else if(roll < 0.30 && skillMv) pick = 'skill';

  if(pick === 'guard' && guardMv){
    st.guard = guardMv.defense;
    say(e, 'guard', 'e', i);
    log('🛡️ ' + e.name + ' 以【' + guardMv.name + '】防禦，本回合按兵不動。', 'var(--dim)');
    auraFx('e'); sfx('guard');
    return;
  }
  if(pick === 'skill' && skillMv){
    say(e, 'skill', 'e', i);
    applySkill(skillMv, e, S.player, st, S.pSt, 'e', 1);
    log('✨ ' + e.name + ' 發動【' + skillMv.name + '】：' + skillText(skillMv.effect, e.role), 'var(--ember)');
    paintHUD(); await wait(420);
    return;
  }
  if(!atkMv){ log('💤 ' + e.name + ' 無法行動。', 'var(--dim)'); return; }

  say(e, 'attack', 'e', i);
  await wait(200);

  const dodged = (S.pSt.spDodge > 0) ||
                 (!(st.focus>0 || st.seed>0) && Math.random() < evasionOf(S.player, S.pSt));
  if(S.pSt.spDodge > 0){ S.pSt.spDodge = 0; log('💨 閃避指令生效，完全避開攻擊！', 'var(--jade)'); }
  const accEff = clamp(atkMv.acc + roleOf(e).acc - (st.blind>0?st.blindVal:0), 5, 100);
  const willHit = !dodged && (st.focus>0 || st.seed>0 || Math.random()*100 <= accEff);
  lunge('e'); sfx('swing');
  await wait(190);
  st.focus = 0;

  if(dodged){
    popNumber('f-p','EVADE','block'); sfx('miss');
    log('🌀 你閃開了【' + atkMv.name + '】！', 'var(--jade)');
    return;
  }
  if(!willHit){
    popNumber('f-p','MISS','miss'); sfx('miss');
    log('💨 幸運！' + e.name + ' 的【' + atkMv.name + '】落空了。', 'var(--jade)');
    return;
  }

  const dmgScale = CONFIG.enemyDmg * (CONFIG.enemyDmgMulti[S.difficulty] || 1);
  const r = damage(e, S.player, atkMv, 1, st, S.pSt, dmgScale, 0);
  st.charge = 0;
  let dmg = r.dmg, blocked = 0;
  const guarding = (S.pSt.guard !== undefined);
  if(guarding){
    let g = S.pSt.guard;
    if(S.pSt.assistGuard) g *= 0.5;
    blocked = dmg - Math.round(dmg * g);
    dmg = Math.round(dmg * g);
    if(blocked > 0){
      const bp = Math.round(blocked * CONFIG.blockPts * (S.pSt.spLuck > 0 ? 2 : 1));
      S.quizPts += bp; S.blocked += blocked;
      log('🛡️ 擋下 ' + blocked + ' 點傷害（＋' + bp + ' 分）', 'var(--ion)');
    }
  }

  S.player.hp -= dmg;
  S.pSt.taken = (S.pSt.taken || 0) + dmg;
  attackFx('p', fxKindOf(atkMv));
  await wait(110);
  if(guarding){
    auraFx('p'); popNumber('f-p','GUARD','block'); sfx('guard');
    log('🛡️ 防禦成功！擋下 ' + blocked + ' 點傷害。', 'var(--ion)');
    await wait(200);
  }
  impact('p', r.crit);
  popNumber('f-p', dmg, r.crit ? 'crit' : '');
  if(r.crit){ screenFlash('red'); banner('CRITICAL!'); sfx('crit'); }
  else if(r.glance) sfx('glance');
  else sfx('impact');
  log('⚠️ ' + e.name + ' 的【' + atkMv.name + '】命中！' + r.note + ' 你受到 ' + dmg + ' 傷害。', 'var(--ember)');
  st.smite = 0; st.burst = 0; st.jackpot = 0;
  paintHUD();
  await thornsBack(S.pSt, e, 'e', dmg);
  if(e.hp <= 0) return;

  /* 防禦成功後的反擊 */
  const cRate = (S.pSt.alwaysCounter > 0) ? 1
    : CONFIG.counterRate + (S.player.role === 'guard' ? 0.20 : 0) + (S.pSt.assistGuard ? 0.35 : 0);
  if(guarding && Math.random() < cRate){
    await wait(360);
    const back = Math.max(12, Math.round(blocked * (S.pSt.assistGuard ? 0.9 : 0.6)));
    S.enemy.hp -= back;
    lunge('p'); await wait(150);
    attackFx('e','slash'); impact('e', false);
    popNumber('f-e', back);
    banner(S.pSt.assistGuard ? '合體反擊！' : 'COUNTER!', true); sfx('counter');
    const cp = CONFIG.counterPts * (S.pSt.spLuck > 0 ? 2 : 1);
    S.quizPts += cp; S.counters++;
    log('↩️ 反擊成功！回敬 ' + back + ' 點傷害（＋' + cp + ' 分）', 'var(--jade)');
    paintHUD(); awaken(S.enemy, S.eSt, 'e');
    await wait(380);
  }
}

/* ---------- 一題結束：秀解析，等學生確認 ---------- */
function finishQuestion(){
  S.resolved = true; S.busy = false;
  if(!S.current) return;            // 防呆：沒有題目就不往下走
  S.used.push(S.current.id);
  S.qInRound++; S.totalAnswered++;

  showExplain();

  /* 錯題回收：答錯的題目下一回合再出一次；重來的題目再錯就不再重來。
     原本的判斷寫在 S.used.push 之後，題號一定已經在 used 裡，
     條件永遠不成立，所以錯題從來沒有被收回來過。 */
  if(S.charge < 1 && CONFIG.wrongRetry && S.wrong.indexOf(S.current.id) < 0
     && !S.current.retry){
    S.wrong.push(S.current.id);
  }
  /* 誘答分析：記下學生實際勾了哪幾個選項（以 A/B/C… 表示），
     以及正解是哪幾個。這樣才分得出「不會」和「被某個選項騙了」。 */
  /* 選項在畫面上是洗過牌的，每個學生看到的 A、B、C 都不一樣。
     要換回題庫原本的順序（o.orig），全班的誘答統計才對得起來。 */
  const _orig = function(i){
    const o = S.current.options && S.current.options[i];
    return (o && typeof o.orig === 'number') ? o.orig : i;
  };
  const _letters = function(set){
    return [...set].map(_orig).sort(function(a,b){ return a-b; })
      .map(function(i){ return String.fromCharCode(65 + i); }).join('');
  };
  const _rightSet = new Set();
  (S.current.options || []).forEach(function(o, i){ if(o.correct) _rightSet.add(i); });

  /* 成長系統：連續全對、完美回合、題型熟練度、全班討伐的傷害 */
  const _full = S.charge >= 1;
  S.streak = _full ? S.streak + 1 : 0;
  S.maxStreak = Math.max(S.maxStreak, S.streak);
  if(_full) S.roundFull++;
  addMastery(S.current.cat, _full);
  if(S.mode === 'dojo'){
    dojoResolved();                 // 道場：訂正成功就從錯題本移除，不寫一般作答紀錄
  }else{
  S.raidDmg += S.charge * 10;
  S.log.push({
    id: S.current.id,
    cat: S.current.cat || '',
    lessonId: currentLesson ? currentLesson.id : 'default',
    round: S.round,
    correct: S.charge >= 1 ? 1 : 0,
    rate: Math.round(S.charge * 100),
    retry: S.current.retry ? 1 : 0,
    picked: _letters(S.picked),      // 學生勾選的選項
    answer: _letters(_rightSet)      // 這一題的正解
  });
  }

  $('main-btn').disabled = true;
  $('main-btn').textContent = '結算中…';
  paintHUD();
}

/* 解析獨立成一張大卡：正解、你的作答、完整解析 */
function showExplain(){
  const q = S.current;
  $('ex-idx').textContent = '第 ' + S.round + ' 回合　第 ' + S.qInRound + ' / ' + S.perRound + ' 題';
  $('ex-q').textContent = q.q;

  const right = [], mine = [];
  const keys = ['A','B','C','D','E','F'];
  q.options.forEach(function(o,i){
    if(o.correct) right.push(keys[i] + '. ' + o.text);
    if(S.picked.has(i)) mine.push(keys[i] + '. ' + o.text);
  });

  const ok = (S.charge >= 1);
  const badge = $('ex-badge');
  badge.textContent = ok ? '✓ 完全正確' : (S.charge > 0 ? '△ 部分正確　發動權 ' + Math.round(S.charge*100) + '%' : '✗ 答錯了');
  badge.className = 'ex-badge ' + (ok ? 'ok' : (S.charge > 0 ? 'half' : 'no'));

  const ansBox = $('ex-ans'); ansBox.innerHTML = '';
  const mk = function(label, arr, cls){
    const d = document.createElement('div'); d.className = 'ex-row ' + cls;
    const t = document.createElement('i'); t.textContent = label;
    const v = document.createElement('span');
    v.textContent = arr.length ? arr.join('\n') : '（未作答）';
    d.append(t, v); ansBox.appendChild(d);
  };
  mk('正解', right, 'r');
  if(!ok) mk('你的作答', mine, 'm');

  $('ex-text').textContent = q.exp || '（本題未附解析）';

  const last = (S.qInRound >= S.perRound || !S.pool.length);
  const btn = $('ex-next');
  btn.textContent = last ? '確認解析，結束本回合' : '確認解析，進入下一題';
  btn.onclick = function(){
    sfx('tap');
    show('scr-battle');
    if(S.qInRound >= S.perRound || !S.pool.length){
      (S.round >= CONFIG.rounds || !S.pool.length) ? endGame('time') : endRound();
    }else nextQuestion();
  };
  show('scr-explain');
  window.scrollTo(0,0);
}

/* 戰敗：不會出局，但本回合殘存體力歸零、扣分，下一回合體力上限減半 */
function playerDown(){
  S.busy = false;
  S.defeated = true;
  S.defeats++;
  screenFlash('red'); banner('DOWN...'); sfx('ko'); shakeStage(true);
  log('💀 ' + S.player.name + ' 倒下了⋯⋯', 'var(--ember)');
  setTimeout(function(){
    if(S.round >= CONFIG.rounds && !S.pool.length) return endGame('ko-lose');
    showRevive();
  }, paceMs(1200));
}

/* 倒下後的選擇：花分數復活、換角色、或撐著打完（體力 1） */
function showRevive(){
  $('rv-score').textContent = S.quizPts.toLocaleString();
  const box = $('rv-list'); box.innerHTML = '';
  const opts = [
    {k:'revive', t:'原地復活', c:CONFIG.revivePts,
     d:'同一位角色以 50% 體力再戰，但特色能力會被封印，之後整場都不能發動。'},
    {k:'swap',   t:'換角色重來', c:CONFIG.swapPts,
     d:'重新挑一位角色，滿血、狀態全新，特色能力也重置——等於重開一局。'},
    {k:'endure', t:'撐下去', c:0,
     d:'不花分數，以體力 1 繼續作答。再被打中就會再倒一次。'}
  ];
  opts.forEach(function(o){
    const b = document.createElement('button');
    const afford = S.quizPts >= o.c;
    b.className = 'rv-opt' + (afford ? '' : ' off');
    b.disabled = !afford;
    const t = document.createElement('b'); t.textContent = o.t;
    const c = document.createElement('em');
    c.textContent = o.c ? ('−' + o.c + ' 分') : '免費';
    const d = document.createElement('span'); d.textContent = o.d;
    b.append(t, c, d);
    b.onclick = function(){ doRevive(o.k, o.c); };
    box.appendChild(b);
  });
  $('rv-box').hidden = false;
  $('rv-box').style.display = 'flex';
}

function doRevive(kind, cost){
  $('rv-box').hidden = true;
  $('rv-box').style.display = 'none';
  S.quizPts = Math.max(0, S.quizPts - cost);
  sfx(kind === 'endure' ? 'tap' : 'awaken');

  if(kind === 'swap'){
    // 讓玩家自己重新挑角色
    S.swapMode = true;
    log('🔄 換角色重來（−' + cost + ' 分）：請重新選擇出戰角色。', 'var(--gold)');
    show('scr-select');
    $('btn-start').textContent = '重新出戰！';
    if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
    return;
  }else if(kind === 'revive'){
    S.player.hp = Math.round(S.player.maxHp * 0.5);
    S.pSt.abilitySealed = true;              // 復活的代價：特色能力封印
    banner('復活！', true);
    log('❤️ 原地復活（−' + cost + ' 分），回復到 ' + S.player.hp + ' 點體力。', 'var(--jade)');
    log('🔒 代價：本場之後都不能再發動特色能力。', 'var(--ember)');
  }else{
    S.player.hp = 1;
    log('🩸 硬撐下去，體力只剩 1 點。', 'var(--dim)');
  }
  paintHUD(true); renderSpirits(); refreshAbilityBtn();
  finishQuestion();
}

/* 全隊擊破：計分、換上新的一批，回合不因此結束
   mid＝在作答途中（例如特色能力）打倒整隊：換上新的一批，這一題繼續作答 */
function victoryThisQuestion(mid){
  S.busy = !!mid;            // 作答途中清場：換人的這一秒先鎖住操作
  const bonus = CONFIG.koBonus * S.foes.length * (S.pSt.spLuck > 0 ? 2 : 1);
  S.waves++; S.kos += S.foes.length;
  S.quizPts += bonus;
  screenFlash('cyan'); banner('WAVE CLEAR!'); sfx('ko'); shakeStage(true);
  log('🏆 全數擊破！第 ' + S.waves + ' 波清空（＋' + bonus + ' 分）', 'var(--gold)');
  const heal = Math.round(S.player.maxHp * CONFIG.waveHeal);
  S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
  log('💚 清場補給：回復 ' + heal + ' 點體力。', 'var(--jade)');
  paintHUD();
  setTimeout(function(){
    const roundOver = (S.qInRound + 1 >= S.perRound) || !S.pool.length;
    const gameOver  = roundOver && (S.round >= CONFIG.rounds || !S.pool.length);
    /* 最後一題剛好清場：照常結算這一題（記錄作答、看解析），再由下一步自然進入結算。
       原本直接跳結算，這一題的作答不會被記錄，也不算「完整打完三回合」，
       答得越好的學生反而拿不到通關紀錄與貓的解鎖進度。 */
    if(gameOver && !mid){ finishQuestion(); return; }
    spawnEnemies();
    rollStage();
    LAST_IMG.e = null;
    paintHUD(true);
    log('🚨 第 ' + (S.waves + 1) + ' 波登場：' +
        S.foes.map(function(e){ return e.name; }).join('、') + '！', 'var(--ember)');
    banner('NEXT WAVE'); sfx('round');
    if(mid){ S.busy = false; renderFoes(); refreshAbilityBtn(); if(S.answered && !S.resolved) buildTactics(); return; }
    finishQuestion();
  }, paceMs(1500));
}
