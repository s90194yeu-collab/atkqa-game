/* 【18-battle-answer.js】戰鬥：出題、作答、送出答案、典故
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ---------- 出題 ---------- */
function nextQuestion(){
  if(S.finished) return;
  if(S.qInRound >= S.perRound || !S.pool.length){
    return (S.round >= CONFIG.rounds || !S.pool.length) ? endGame('time') : endRound();
  }
  /* 臨時存檔：在這一題開始前拍快照，並自動備份到這台裝置 */
  if(S.mode !== 'dojo'){ LAST_SNAP = takeSnapshot(); saveLocalSnap(LAST_SNAP); }
  S.current = S.pool.pop();
  S.picked.clear(); S.answered = false; S.resolved = false; S.charge = 0; S.move = null;
  S.pSt.guard = undefined;

  $('q-card').classList.remove('dimmed');
  $('q-idx').textContent = '第 ' + S.round + ' 回合　第 ' + (S.qInRound+1) + ' / ' + S.perRound + ' 題'
                           + (S.current.retry ? '　🔁 重來一次' : '');
  $('q-text').textContent = S.current.q;
  $('q-exp').hidden = true;
  $('charge').hidden = true;
  $('t-hint').hidden = false;
  $('t-body').hidden = true;
  renderForms();
  refreshAbilityBtn();
  renderSpirits();
  /* 七貓獎勵「直接解題」只能在作答前用：每一題開始時都要重新顯示，
     原本只在送出答案後才刷新，那時已經作答完畢，按鈕永遠不會出現 */
  refreshCatSolve();

  const single = S.current.type === 'single';
  $('q-type').textContent = single ? '單選題' : '多選題';
  const _lv = masteryLv(S.current.cat);
  $('q-cat').textContent = String(S.current.cat || '').split('_').pop() + (_lv ? '　Lv' + _lv : '');   // A1_形音義 → 形音義
  $('q-cat').hidden = !S.current.cat;
  $('q-type').className = 'q-type ' + (single ? 'single' : 'multi');
  $('q-type').title = single ? '只能選一個答案' : '答案不只一個，答對幾個就給幾分';

  const box = $('q-opts'); box.innerHTML = '';
  S.current.options.forEach((o,i)=>{
    const b = document.createElement('button');
    b.className = 'opt'; b.dataset.i = i;
    const k = document.createElement('span'); k.className='key'; k.textContent = LETTERS[i]||(i+1);
    const t = document.createElement('span'); t.textContent = o.text;
    b.append(k,t); b.onclick = ()=>toggleOption(i,b);
    box.appendChild(b);
  });

  const btn = $('main-btn');
  btn.textContent = '送出答案'; btn.disabled = false; btn.onclick = submitAnswer;

  /* 梁山的弟兄講義氣：偶爾互相掩護，本回合防禦效果加倍 */
  if(S.player.universe==='shuihu' && !S.pSt.master && Math.random()<0.18){
    S.pSt.master = true;
    log('🍶 義氣相挺！你的防禦效果提升。', 'var(--u-shuihu)');
    auraFx('p');
  }
  /* 亂世的武將下剋上：敵方偶爾爆發 */
  if(S.enemy.universe==='sengoku' && Math.random()<0.18){
    S.eSt.muzan = true;
    log('🏯 下剋上！對手本回合攻擊力大增。', 'var(--u-sengoku)');
  }
  /* 答題階段就先把演出影片抓好，停在第 0 格待命；出招時只呼叫 play() */
  warmAnims();

  /* 陣營被動：長效狀態會被同名特技覆蓋，每題補一次自動復原 */
  applyClanPassive(S.player, S.pSt, true, 'tick');
  aliveFoes().forEach(function(f, i){ applyClanPassive(f, S.foeSt[i], false, 'tick'); });

  awaken(S.player, S.pSt, 'p');   // 連擊型／題數型的換乘條件在每題開始時檢查
  awaken(S.enemy, S.eSt, 'e');
  paintHUD();
}

function paintCharge(){
  $('charge').hidden = false;
  $('charge').classList.toggle('full', S.charge>=1);
  $('chg-pct').textContent = Math.round(S.charge*100) + '%';
  const segs = $('chg-segs'); segs.innerHTML='';
  for(let i=0;i<10;i++){
    const d = document.createElement('div'); d.className='seg'; segs.appendChild(d);
    setTimeout(()=>{ if(i < Math.round(S.charge*10)) d.classList.add('lit'); }, 55*i);
  }
}

function toggleOption(i, el){
  if(S.answered) return;
  if(S.current.type === 'single'){
    // 單選題：選了新的就取消舊的，避免誤選導致整題零分
    if(S.picked.has(i)){ S.picked.clear(); el.classList.remove('sel'); }
    else{
      S.picked.clear();
      document.querySelectorAll('.opt').forEach(function(x){ x.classList.remove('sel'); });
      S.picked.add(i); el.classList.add('sel');
    }
  }else{
    if(S.picked.has(i)){ S.picked.delete(i); el.classList.remove('sel'); }
    else { S.picked.add(i); el.classList.add('sel'); }
  }
  sfx('tap');
}

/* ---------- 評分 ---------- */
function submitAnswer(){
  if(S.answered) return;
  const _cs = $('cat-solve'); if(_cs) _cs.hidden = true;
  /* 手機容易誤觸，送出前再確認一次。已選幾個也一併顯示，方便核對。 */
  if(CONFIG.confirmAnswer){
    const picked = [...S.picked].sort((a,b)=>a-b)
      .map(i => String.fromCharCode(65+i)).join('、');
    const msg = picked
      ? '確定送出？你選的是：' + picked + '\n（送出後無法更改）'
      : '你還沒有選任何選項，確定要放棄這一題嗎？';
    if(!confirm(msg)) return;
  }
  S.answered = true;

  const opts = S.current.options;
  const total = opts.filter(o=>o.correct).length || 1;
  let hit=0, wrong=0;
  opts.forEach((o,i)=>{ if(S.picked.has(i)){ o.correct ? hit++ : wrong++; } });
  S.charge = clamp((hit - wrong) / total, 0, 1);

  document.querySelectorAll('.opt').forEach((el,i)=>{
    el.disabled = true; el.classList.remove('sel');
    if(opts[i].correct) el.classList.add('right');
    else if(S.picked.has(i)) el.classList.add('wrong');
  });

  const tw = CONFIG.typeWeight[S.current.type] || 1;
  let pts = Math.round(S.charge * CONFIG.ptsPerQuestion * tw);
  if(S.pSt.spBless > 0){ pts *= 2; log('🌟 祝福生效，本題答題分數加倍！', 'var(--gold)'); }
  S.quizPts += pts;
  const gain = S.charge >= 1 ? 3 : (S.charge > 0 ? 1 : 0);
  if(gain){ S.sp += gain; log('🌀 精神點數 +' + gain + '（目前 ' + S.sp + ' SP）', 'var(--ion)'); }
  if(S.charge >= 1){
    S.combo = Math.min(CONFIG.comboMax, S.combo + 1);
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    /* sinceRun＝換乘之後的連續全對數，sinceBest 記錄其最高值。
       獨立於 S.combo，所以不受連擊上限 5 的影響。 */
    S.sinceRun += 1;
    S.sinceBest = Math.max(S.sinceBest, S.sinceRun);
  }else{
    if(S.combo >= 2) log('💢 連擊中斷。', 'var(--dim)');
    S.combo = 0; S.sinceRun = 0;
  }

  paintCharge();

  if(S.charge>=1){
    sfx('perfect');
    log('🎯 全對！取得 100% 發動權（＋' + pts + ' 分）', 'var(--jade)');
    if(S.combo >= 2){ banner(S.combo + ' COMBO!', true); }
  }else if(S.charge>0){
    sfx('charge');
    log('⚠️ 部分正確：發動權 ' + Math.round(S.charge*100) + '%（＋' + pts + ' 分）', 'var(--gold)');
  }else{
    sfx('fail');
    log('❌ 本題未得分，招式無法蓄力。', 'var(--ember)');
  }

  $('q-card').classList.add('dimmed');
  $('t-hint').hidden = true;
  $('t-body').hidden = false;
  buildTactics();
  renderSpirits();
  /* 發動權 0 時所有招式都會鎖住。若不留一條出路，
     學生會卡在停用的「請選擇一招」上，完全無法推進。 */
  S.move = null;
  refreshTacticsButton();
  paintHUD();
  scrollTo_($('t-body'), {behavior:'smooth', block:'center'});
}

/* ---------- 招式面板：三招各司其職 ---------- */
/* 顯示角色小傳與招式典故；CHARACTER_LORE 沒寫的角色自動隱藏這一區 */
function paintLore(ch){
  /* 今日狀態的大圖：不管有沒有小傳都要顯示 */
  const cp = $('cond-img');
  if(cp && ch){ cp.src = ch.img || ch.ph || ''; cp.alt = ch.name || ''; }

  const box = $('cond-lore'); if(!box) return;
  const base = ch && (ch.baseId || ch.id);
  const lore = CHARACTER_LORE[ch && ch.id] || CHARACTER_LORE[base];
  if(!lore){ box.hidden = true; return; }
  box.hidden = false;


  const bio = $('lore-bio');
  bio.textContent = lore.bio || '';
  bio.hidden = !lore.bio;
  const list = $('lore-moves'); list.innerHTML = '';
  const mv = lore.moves || {};
  const cardId = (CHARACTER_LORE[base] ? base : ch.id);
  if(!loreUnlocked(cardId)){
    const d = document.createElement('div'); d.className = 'lore-lock';
    d.textContent = '🔒 招式典故：用這位角色完整打完三回合，就能解鎖他的典故卡。';
    list.appendChild(d);
    return;
  }
  (ch.moves || []).forEach(m=>{
    if(!mv[m.name]) return;
    const d = document.createElement('div'); d.className = 'lore-mv';
    const b = document.createElement('b'); b.textContent = m.name + '：';
    d.append(b, document.createTextNode(mv[m.name]));
    list.appendChild(d);
  });
}
