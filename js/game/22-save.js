/* 【22-save.js】回合結算、存檔、臨時存檔
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   回合結算與存檔
   ========================================================================== */
function endRound(){
  if(S.qInRound > 0 && S.roundFull >= S.qInRound) S.perfectRounds++;   // 完美回合（成就用）
  const pct = Math.round(clamp(S.player.hp/S.player.maxHp*100,0,100));
  $('rd-title').textContent = '第 ' + S.round + ' 回合結束';
  $('rd-body').innerHTML = '';
  [['本回合作答', S.qInRound + ' 題'],
   ['擊破敵人', S.kos + ' 名'],
   ['累計得分', S.quizPts + ' 分'],
   ['最高連擊', S.bestCombo + ' 連'],
   ['剩餘體力', pct + '%'],
   ['答錯待重來', S.wrong.length + ' 題'],
   ['剩餘題數', S.pool.length + ' 題']].forEach(function(row){
    const d = document.createElement('div'); d.className='brow';
    const a = document.createElement('span'); a.textContent = row[0];
    const b = document.createElement('b');    b.textContent = row[1];
    d.append(a,b); $('rd-body').appendChild(d);
  });
  $('rd-msg').textContent = '';
  $('rd-save').disabled = false;
  $('rd-save').textContent = '💾 存檔';
  show('scr-round');
  sfx('round');
}
function continueNextRound(){
  S.round++;
  show('scr-battle');
  startRound();
}
/* 顯示名稱一律用登入帳號 @ 前面那段，不讓學生自己輸入，避免出現奇怪的暱稱 */
function myName(){ return (ME && ME.shortId) || '訪客'; }

function saveNow(fromRound){
  S.nickname = myName();
  const payload = {
    nickname: S.nickname,
    characterId: S.player.id,
    round: S.round + 1,
    score: S.quizPts,
    hpPct: clamp(S.player.hp/S.player.maxHp, 0.1, 1),
    bestCombo: S.bestCombo,
    used: S.used,
    wrong: S.wrong,
    difficulty: S.difficulty,
    defeats: S.defeats,
    lessonId: currentLesson ? currentLesson.id : 'default',   // 接續時切回同一課
    answers: S.log.slice()     // 老師端的作答紀錄
  };
  const msg = $('rd-msg');
  if(fromRound){ $('rd-save').disabled = true; $('rd-save').textContent = '存檔中…'; }
  if(!inGAS){
    if(fromRound){ msg.textContent = '（本機預覽模式，未實際寫入試算表）'; $('rd-save').textContent = '已存檔'; }
    return;
  }
  google.script.run
    .withSuccessHandler(function(){
      S.log = [];   // 已寫入試算表，清空避免重複送出
      clearLocalSnap();   // 回合存檔比本機備份新，備份可以丟了
      if(fromRound){ msg.textContent = '已存檔，下次可從第 ' + (S.round+1) + ' 回合接續。'; $('rd-save').textContent = '✅ 已存檔'; }
    })
    .withFailureHandler(function(){
      if(fromRound){ msg.textContent = '存檔失敗，請稍後再試。'; $('rd-save').disabled = false; $('rd-save').textContent = '💾 重試存檔'; }
    })
    .saveProgress(payload);
}

/* ============================================================================
   臨時存檔
   ── 每一題開始前，把整個戰況拍成一張「快照」，自動存在這台裝置。
   ── 按 💾 暫存 時，再把快照送到試算表，換一台裝置登入也能接續。
   ── 快照記的是「這一題開始前」的狀態，所以接續時會從這一題重新作答，
      不會有答到一半、招式放到一半的奇怪狀態。
   ========================================================================== */
const SNAP_KEY = 'atkqa_snap_v1';
const SNAP_VER = 1;
let LAST_SNAP = null;          // 目前這一題開始前的快照

function stripChar(c){ const o = Object.assign({}, c); delete o.ph; return o; }   // 預設立繪可以重算，不必存
function restoreChar(c){ if(c && !c.ph) c.ph = placeholderImg(c.name, c.universe); return c; }

function takeSnapshot(){
  if(!S.player || S.finished || !S.foes.length) return null;
  const snap = {
    v: SNAP_VER, t: Date.now(),
    email: (ME && ME.email) || '',
    lessonId: currentLesson ? currentLesson.id : 'default',
    lessonName: currentLesson ? (currentLesson.name || currentLesson.id) : '預設題庫',
    selectedId: selected ? selected.id : (S.player.baseId || S.player.id),
    difficulty: S.difficulty, speed: SPEED,
    round: S.round, qInRound: S.qInRound, perRound: S.perRound, totalAnswered: S.totalAnswered,
    quizPts: S.quizPts, combo: S.combo, bestCombo: S.bestCombo,
    sinceRun: S.sinceRun, sinceBest: S.sinceBest,
    sp: S.sp, spiritUsed: S.spiritUsed, spiritCasts: S.spiritCasts,
    blocked: S.blocked, counters: S.counters, skillUses: S.skillUses,
    waves: S.waves, kos: S.kos, defeats: S.defeats, defeated: S.defeated,
    catSolveUsed: S.catSolveUsed, abUsedQ: S.abUsedQ,
    streak: S.streak, maxStreak: S.maxStreak, roundFull: S.roundFull, perfectRounds: S.perfectRounds,
    awakened: S.awakened, lvUps: S.lvUps, raidDmg: S.raidDmg,
    used: S.used, wrong: S.wrong, retryIds: S.retryIds,
    // 題庫只記題號；重來的題目另外標記，接續時重新洗選項
    pool: S.pool.map(function(q){ return q.retry ? [q.id, 1] : q.id; }),
    player: stripChar(S.player), pSt: S.pSt,
    foes: S.foes.map(stripChar), foeSt: S.foeSt, target: S.target,
    log: S.log                  // 還沒送出的作答紀錄，接續後一併補送
  };
  try{ return JSON.parse(JSON.stringify(snap)); }   // 深拷貝：之後戰況再變也不會影響快照
  catch(e){ return null; }
}
function saveLocalSnap(snap){
  if(!snap) return;
  try{ localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); }catch(e){}
}
function readLocalSnap(){
  try{
    const t = localStorage.getItem(SNAP_KEY);
    const o = t ? JSON.parse(t) : null;
    return (o && o.v === SNAP_VER && o.player) ? o : null;
  }catch(e){ return null; }
}
function clearLocalSnap(){ try{ localStorage.removeItem(SNAP_KEY); }catch(e){} }

/* 這一場已經結束或學生選擇放棄：本機與試算表的進度都清掉，下次不會再問要不要接續 */
function discardProgress(){
  clearLocalSnap(); LAST_SNAP = null;
  if(inGAS && ME && ME.allowed)
    google.script.run.withFailureHandler(function(){}).clearProgress();
}

function setOptRow(rowId, key, val){
  document.querySelectorAll('#' + rowId + ' .optbtn').forEach(function(b){
    b.classList.toggle('on', b.dataset[key] === String(val));
  });
}
/* 接續時切回存檔的那一課；找不到就回傳 false */
function selectLessonById(id){
  if(!id || id === 'default' || !LESSONS.length) return true;
  const idx = LESSONS.findIndex(function(x){ return x.id === id; });
  if(idx < 0) return false;
  const b = document.querySelector('#lesson-grid .lg[data-i="' + idx + '"]');
  if(b) b.click(); else currentLesson = LESSONS[idx];
  return true;
}

/* ── 💾 暫存 ───────────────────────────────────────────── */
function openQuickSave(){
  if(S.finished || !LAST_SNAP){
    log('💾 這一題還沒開始，等題目出現再存檔。', 'var(--dim)');
    return;
  }
  const sn = LAST_SNAP;
  const pct = Math.round(clamp(sn.player.hp / sn.player.maxHp * 100, 0, 100));
  const info = $('qs-info'); info.innerHTML = '';
  [['課次', sn.lessonName],
   ['進度', '第 ' + sn.round + ' 回合　第 ' + (sn.qInRound + 1) + ' / ' + sn.perRound + ' 題'],
   ['角色', sn.player.name + '　體力 ' + pct + '%'],
   ['分數', sn.quizPts + ' 分']].forEach(function(r){
    const d = document.createElement('div'); d.className = 'cond-row';
    const a = document.createElement('b'); a.textContent = r[0];
    const v = document.createElement('span'); v.textContent = r[1];
    d.append(a, v); info.appendChild(d);
  });
  $('qs-note').textContent = (S.answered
      ? '這一題已經作答，存檔後接續時會從這一題重新作答。'
      : '接續時會從這一題開始作答。')
    + (ME && ME.allowed ? '' : '\n目前沒有用學校帳號登入，存檔只會留在這台裝置。');
  $('qs-msg').textContent = '';
  qsBusy(false);
  $('qs-box').hidden = false;
  sfx('tap');
}
function qsBusy(on){
  ['qs-leave','qs-stay','qs-cancel'].forEach(function(id){ $(id).disabled = on; });
}
function doQuickSave(leave){
  const sn = LAST_SNAP;
  if(!sn) return;
  const msg = $('qs-msg');
  const after = function(text){
    msg.style.color = 'var(--jade)'; msg.textContent = text;
    sfx('select');
    if(leave) setTimeout(function(){ location.reload(); }, 800);
    else setTimeout(function(){ $('qs-box').hidden = true; }, 900);
  };
  saveLocalSnap(sn);                                  // 這台裝置一定先存一份
  if(!inGAS || !(ME && ME.allowed)){ after('✅ 已存在這台裝置。'); return; }

  qsBusy(true); msg.style.color = 'var(--dim)'; msg.textContent = '存檔中…';
  const sent = sn.log.length;
  const payload = {
    nickname: myName(), characterId: sn.selectedId, round: sn.round, score: sn.quizPts,
    hpPct: clamp(sn.player.hp / sn.player.maxHp, 0.1, 1), bestCombo: sn.bestCombo,
    used: sn.used, wrong: sn.wrong, difficulty: sn.difficulty, defeats: sn.defeats,
    lessonId: sn.lessonId,
    snap: JSON.stringify(Object.assign({}, sn, {log: []})),   // 作答紀錄另外送，快照裡不重複存
    answers: sn.log
  };
  google.script.run
    .withSuccessHandler(function(r){
      /* 已送出的作答紀錄從待送清單拿掉，避免回合結束時再送一次 */
      S.log = S.log.slice(sent);
      sn.log = []; saveLocalSnap(sn);
      after(r && r.snap === false
        ? '⚠️ 進度已存，但戰況太大沒能存進試算表，只留在這台裝置。'
        : '✅ 已存到雲端，換裝置登入也能接續。');
    })
    .withFailureHandler(function(e){
      qsBusy(false);
      msg.style.color = 'var(--ember)';
      msg.textContent = '雲端存檔失敗（' + ((e && e.message) || '連線問題') + '），已先存在這台裝置。可以再按一次。';
    })
    .saveProgress(payload);
}

/* ── 首頁：找出最新的一筆進度 ──────────────────────────────
   可能有三種：試算表裡的臨時存檔、這台裝置的自動備份、回合結束時的存檔。
   比「最後更新時間」，取最新的那一筆；serverNow 用來校正裝置時鐘的誤差。 */
function loadProgress(){
  if(!inGAS){ chooseResume({}); return; }
  google.script.run
    .withSuccessHandler(function(d){ chooseResume(d || {}); })
    .withFailureHandler(function(){ chooseResume({}); })
    .loadProgress();
}
function chooseResume(d){
  const offset = d.serverNow ? (d.serverNow - Date.now()) : 0;
  const myEmail = d.email || (ME && ME.email) || '';
  const cands = [];
  let srv = null;
  if(d.snap){ try{ srv = JSON.parse(d.snap); }catch(e){ srv = null; } }
  if(srv && srv.v === SNAP_VER && srv.player) cands.push({kind:'snap', snap:srv, at:d.updatedAt || 0});
  else if(d.characterId) cands.push({kind:'round', d:d, at:d.updatedAt || 0});
  const loc = readLocalSnap();
  if(loc && (loc.email || '') === myEmail) cands.push({kind:'snap', snap:loc, at:loc.t + offset});
  if(!cands.length) return;
  cands.sort(function(a, b){ return b.at - a.at; });
  if(cands[0].kind === 'snap') offerSnap(cands[0].snap);
  else offerRound(cands[0].d);
}
function staleResume(name){
  /* 角色改版後舊存檔的 ID 已不存在：明講一句，不要讓進度默默消失 */
  $('resume-name').textContent = name || myName();
  $('resume-info').textContent = '你上次使用的角色已在改版中更換，這筆進度無法接續，請重新選角開始。';
  $('resume-box').hidden = false;
  $('btn-resume').disabled = true;
  $('btn-fresh').textContent = '重新開始';
  $('btn-fresh').onclick = function(){ RESUME = null; $('resume-box').hidden = true; discardProgress(); };
}
/* 臨時存檔：從存檔的那一題繼續 */
function offerSnap(snap){
  const base = ALL_CHARACTERS.filter(function(c){ return c.id === snap.selectedId; })[0];
  if(!base) return staleResume('📌 有一場還沒打完的挑戰');
  const pct = Math.round(clamp(snap.player.hp / snap.player.maxHp * 100, 0, 100));
  $('resume-name').textContent = '📌 有一場還沒打完的挑戰';
  $('resume-info').textContent = snap.lessonName + '　第 ' + snap.round + ' 回合第 ' + (snap.qInRound + 1) +
    ' 題　' + snap.player.name + '　體力 ' + pct + '%　' + snap.quizPts + ' 分';
  $('resume-box').hidden = false;
  $('btn-resume').disabled = false;
  $('btn-resume').textContent = '從這一題繼續';
  $('btn-fresh').textContent = '放棄這一場';
  $('btn-resume').onclick = function(){ $('resume-box').hidden = true; resumeFromSnap(snap); };
  $('btn-fresh').onclick = function(){
    if(!confirm('確定放棄這一場？存檔會刪除，下次要從頭開始。')) return;
    discardProgress(); $('resume-box').hidden = true;
  };
}
/* 回合存檔：從下一回合開頭繼續 */
function offerRound(d){
  const ch = ALL_CHARACTERS.filter(function(c){ return c.id === d.characterId; })[0];
  if(!ch) return staleResume(d.nickname);
  RESUME = d;
  const L = d.lessonId ? LESSONS.filter(function(x){ return x.id === d.lessonId; })[0] : null;
  $('resume-name').textContent = d.nickname || myName();
  $('resume-info').textContent = (L ? (L.name || L.id) + '　' : '') + ch.name + '　第 ' + d.round +
    ' 回合　累計 ' + d.score + ' 分　已作答 ' + (d.used||[]).length + ' 題';
  $('resume-box').hidden = false;
  $('btn-resume').disabled = false;
  $('btn-resume').textContent = '接續上次進度';
  $('btn-fresh').textContent = '重新開始';
  $('btn-resume').onclick = function(){
    if(!selectLessonById(d.lessonId)){
      alert('找不到上次的課次，可能已經被老師關閉。請重新選擇課次開始。'); return;
    }
    if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
    S.round = d.round; S.quizPts = d.score || 0;
    S.used = d.used || []; S.bestCombo = d.bestCombo || 0;
    S.wrong = d.wrong || []; S.defeats = d.defeats || 0;
    if(d.difficulty){ S.difficulty = d.difficulty; setOptRow('diff-row', 'diff', d.difficulty); }
    S.nickname = d.nickname || '';
    selectCharacter(ch);
    startBattle();
  };
  $('btn-fresh').onclick = function(){ RESUME = null; $('resume-box').hidden = true; };
}

/* 從快照還原整個戰況，然後直接出下一題（不重新生敵人、不補血） */
async function resumeFromSnap(snap){
  const base = ALL_CHARACTERS.filter(function(c){ return c.id === snap.selectedId; })[0];
  if(!base){ alert('這筆存檔的角色已經不存在，無法接續。'); return; }
  if(!selectLessonById(snap.lessonId)){
    alert('找不到存檔的課次「' + snap.lessonName + '」，可能已經被老師關閉。'); return;
  }
  if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
  selectCharacter(base);
  RESUME = null;
  S.difficulty = snap.difficulty || 'easy'; setOptRow('diff-row', 'diff', S.difficulty);
  if(snap.speed){ SPEED = snap.speed; setOptRow('speed-row', 'speed', snap.speed); }

  show('scr-battle');
  $('ticker').innerHTML = '';
  $('q-text').textContent = '讀取存檔中…';
  $('q-opts').innerHTML = '';
  S.used = snap.used || [];
  await preparePool();                       // 先把這一課的題庫載進來

  /* 依存檔的順序重建剩下的題目 */
  const byId = {};
  BANK_CACHE.forEach(function(q){ byId[q.id] = q; });
  S.pool = [];
  (snap.pool || []).forEach(function(x){
    const id = Array.isArray(x) ? x[0] : x;
    const q = byId[id];
    if(!q) return;                           // 老師刪掉的題目就跳過
    if(Array.isArray(x) && x[1]){
      const copy = clone(q); copy.options = shuffle(copy.options); copy.retry = true;
      S.pool.push(copy);
    }else S.pool.push(q);
  });

  ['round','qInRound','perRound','totalAnswered','quizPts','combo','bestCombo','sinceRun','sinceBest',
   'sp','spiritUsed','spiritCasts','blocked','counters','skillUses','waves','kos','defeats','defeated',
   'catSolveUsed','abUsedQ','wrong','retryIds','log',
   'streak','maxStreak','roundFull','perfectRounds','awakened','lvUps','raidDmg'].forEach(function(k){
    if(snap[k] !== undefined) S[k] = snap[k];
  });
  S.player = restoreChar(snap.player); S.pSt = snap.pSt;
  S.foes = snap.foes.map(restoreChar); S.foeSt = snap.foeSt; S.target = snap.target || 0;
  S.finished = false; S.busy = false; S.swapMode = false; S.current = null;
  S.mode = 'normal'; PENDING_MODE = 'normal'; S.dojoFixed = 0;
  $('btn-qsave').hidden = false;
  LAST_IMG.p = null; LAST_IMG.e = null;
  syncTarget();
  warmAnims();
  rollStage();
  paintHUD(true); renderFoes(); renderSpirits(); renderForms(); refreshAbilityBtn();
  BGM.auto('scr-battle');
  log('📌 從臨時存檔接續：第 ' + S.round + ' 回合第 ' + (S.qInRound + 1) + ' 題', 'var(--gold)');
  banner('CONTINUE!', true); sfx('round');
  nextQuestion();
}
