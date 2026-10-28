/* 【24-result.js】結算畫面
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   結算
   ========================================================================== */
async function endGame(reason){
  if(S.finished) return;
  S.finished = true; S.busy = false;
  if(S.mode !== 'dojo') discardProgress();   // 這一場結束了，下次回首頁不再詢問要不要接續

  const pPct = clamp(S.player.hp / S.player.maxHp * 100, 0, 100);
  const ePct = clamp(S.enemy.hp  / S.enemy.maxHp  * 100, 0, 100);
  const win  = (S.kos >= 3) || reason==='ko-win';
  const lose = reason==='ko-lose' || (S.kos === 0 && S.defeats > 0);

  if(reason === 'ko-lose'){
    screenFlash('red'); banner('K.O.'); sfx('ko'); shakeStage(true);
    await wait(1100);
  }

  if(S.qInRound > 0 && S.roundFull >= S.qInRound) S.perfectRounds++;
  if(S.mode === 'dojo') return endDojo(win);
  $('total-score').nextElementSibling.textContent = '分';
  const survive = (S.defeats > 0 && pPct <= 1) ? 0 : Math.round(pPct*3);
  const bonus   = S.kos * CONFIG.sweepBonus;   // 掃蕩獎金（擊破分數已在戰鬥中即時給）
  const winB    = win ? CONFIG.winBonus : 0;
  const comboB  = S.bestCombo * CONFIG.comboBonus;
  const roundB  = (S.round) * CONFIG.roundBonus;
  const raw = S.quizPts + survive + bonus + comboB + roundB + winB;
  const diffM = (S.difficulty === 'hard') ? CONFIG.hardScore : 1;
  S.finalScore = Math.round(raw * diffM) - S.defeats * 100;
  if(S.finalScore < 0) S.finalScore = 0;
  const evMul = eventScoreMul();                      // 每週活動的分數加乘
  if(evMul !== 1) S.finalScore = Math.round(S.finalScore * evMul);

  /* 只有「完整打完三個回合」才算數：中途被擊倒或提早結束都不列入。
     reason === 'time' 就是題目答完、回合跑滿的正常結束。 */
  const fullRun = (reason === 'time' && S.round >= CONFIG.rounds);
  /* tryUnlockCat 會把這位角色記進 CLEARED，典故卡要用「這一場之前」的狀態判斷 */
  const _base = S.player && (S.player.baseId || S.player.id);
  const _wasCleared = !!(_base && CLEARED[_base]);
  const gotCat  = fullRun ? tryUnlockCat() : null;
  const growthNews = settleGrowth(fullRun, Math.round(pPct), _wasCleared);

  const v = $('verdict');
  v.className = 'verdict ' + (win?'win':lose?'lose':'draw');
  v.textContent = win ? '🏆 掃蕩成功' : lose ? '💀 力有未逮' : '⚔️ 奮戰到底';
  $('total-score').textContent = S.finalScore;

  const catBox = $('unlock-note');
  if(gotCat){
    catBox.hidden = false;
    catBox.innerHTML = '';
    const t = document.createElement('b'); t.textContent = '🐾 解鎖新角色';
    const n = document.createElement('span'); n.textContent = gotCat.name;
    const d = document.createElement('small');
    d.textContent = '完整打完三個回合的獎勵。到「' + (UNI_LABEL[gotCat.universe]||'')
                  + '」分頁就能選用——牠比一般角色強一些，但不能進化，也不會有夥伴來合體。';
    catBox.append(t, n, d);
    sfx('awaken'); banner('CAT UNLOCKED!', true);
  }else{
    catBox.hidden = true;
  }

  $('breakdown').innerHTML='';
  [['答題得分', S.quizPts + ' 分'],
   ['作答題數', S.totalAnswered + ' 題'],
   ['完成回合', S.round + ' / ' + CONFIG.rounds + '（＋' + roundB + '）'],
   ['最高連擊', S.bestCombo + ' 連（＋' + comboB + '）'],
   ['殘存體力加分', survive + '（HP ' + Math.round(pPct) + '%）'],
   ['擊破敵人', S.kos + ' 名（清空 ' + S.waves + ' 波）'],
   ['掃蕩獎金', bonus],
   ['防禦與反擊', '擋下 ' + S.blocked + ' 傷害／反擊 ' + S.counters + ' 次'],
   ['特技與精神', '特技 ' + S.skillUses + ' 次／精神指令 ' + S.spiritCasts + ' 次'],
   ['掃蕩成功', winB],
   ['難度', (S.difficulty === 'hard' ? '困難（分數 ×' + CONFIG.hardScore + '）' : '普通')],
   ['戰敗次數', S.defeats + ' 次' + (S.defeats ? '（−' + (S.defeats*100) + '）' : '')]
  ].concat(evMul !== 1 ? [['活動加乘', '×' + evMul]] : []).forEach(function(row){
    const d = document.createElement('div'); d.className='brow';
    const a = document.createElement('span'); a.textContent = row[0];
    const b = document.createElement('b');    b.textContent = row[1];
    d.append(a,b); $('breakdown').appendChild(d);
  });

  paintGrowthNote(growthNews);
  $('save-box').hidden = false;
  $('board').hidden = true;
  $('btn-save').disabled = false;
  $('btn-save').textContent = '送出成績';
  const sw = $('save-who');
  if(ME && ME.allowed){
    sw.innerHTML = '';
    sw.appendChild(document.createTextNode('以這個帳號登錄成績：'));
    sw.appendChild(document.createElement('br'));
    const b = document.createElement('b'); b.textContent = myName();
    sw.appendChild(b);
    $('btn-save').disabled = false;
  }else{
    sw.textContent = '未以學校帳號登入，這場成績不會被登錄。';
    $('btn-save').disabled = true;
    $('btn-save').textContent = '無法登錄成績';
  }
  show('scr-result');
  sfx(win ? 'win' : 'lose');
}

function saveScore(){
  if(!(ME && ME.allowed)) return;
  const nick = myName();
  S.nickname = nick;
  $('btn-save').disabled = true;
  $('btn-save').textContent = '傳送中…';
  $('save-box').hidden = true;
  $('board').hidden = false;
  $('board-body').innerHTML = '<tr><td colspan="4">讀取排行榜…</td></tr>';

  const payload = { nickname:nick, character:S.player.name, score:S.finalScore,
                    quiz:S.quizPts, questions:S.totalAnswered,
                    difficulty:S.difficulty, defeats:S.defeats,
                    answers:S.log.slice(),
                    lessonId:   currentLesson ? currentLesson.id   : 'default',
                    lessonName: currentLesson ? currentLesson.name : '預設題庫' };
  if(inGAS){
    google.script.run
      .withSuccessHandler(function(res){
        renderBoard(res && res.board ? res.board : res);
        if(res && res.semester){
          SEMESTER = res.semester;
          if(SEMESTER.style) MY_STYLE = SEMESTER.style;
          paintSemester(); showSemResult(res);
        }
        loadBoards();
      })
      .withFailureHandler(function(){
        $('board-body').innerHTML = '<tr><td colspan="4">排行榜連線失敗，成績未寫入。</td></tr>';
      })
      .saveScoreAndGetLeaderboard(payload);
  }else{
    renderBoard([{name:nick, char:S.player.name, score:S.finalScore},
                 {name:'示範資料', char:'皮卡丘', score:1450}].sort((a,b)=>b.score-a.score));
  }
}
/* 結算畫面：這一場有沒有刷新本課紀錄、學期積分變成多少 */
function showSemResult(res){
  const box = $('sem-result');
  if(!res || !res.semester){ box.hidden = true; return; }
  box.hidden = false;
  const total = res.semester.total || 0;
  const t = titleOf(total);
  const prev = (res.prevBest === undefined || res.prevBest === null) ? -1 : res.prevBest;
  const p = $('sem-result-text');
  p.innerHTML = '';

  const line1 = document.createElement('span');
  if(res.improved){
    line1.className = 'up';
    line1.textContent = prev < 0
      ? '🎉 首次挑戰本課，登錄 ' + S.finalScore.toLocaleString() + ' 分！'
      : '🎉 刷新本課紀錄！' + prev.toLocaleString() + ' → ' + S.finalScore.toLocaleString() + ' 分';
  }else{
    line1.className = 'same';
    line1.textContent = '本課最佳仍是 ' + prev.toLocaleString() + ' 分（本次 ' +
                        S.finalScore.toLocaleString() + ' 分，未超過，學期積分不變）';
  }
  p.appendChild(line1);
  p.appendChild(document.createElement('br'));

  const line2 = document.createElement('span');
  line2.textContent = '學期總積分：' + total.toLocaleString() + ' 分';
  p.appendChild(line2);

  if(res.titleUp){
    const up = document.createElement('span');
    up.className = 'newtitle';
    up.style.color = t.color;
    up.textContent = '🏅 晉升稱號：' + t.icon + ' ' + t.name;
    p.appendChild(up);
    setTimeout(function(){ banner('NEW TITLE!'); sfx('win'); }, 600);
  }
}

/* 結算畫面：全體前三 ＋ 本課前五 */
function loadBoards(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(b){
      if(!b) return;
      const box = $('rank-box'); box.hidden = false; box.innerHTML = '';
      const mk = function(title, rows, key){
        const h = document.createElement('h4'); h.textContent = title;
        box.appendChild(h);
        if(!rows || !rows.length){
          const e = document.createElement('div'); e.className = 'rank-empty';
          e.textContent = '還沒有紀錄。'; box.appendChild(e); return;
        }
        rows.forEach(function(r, i){
          const d = document.createElement('div');
          d.className = 'rank-row' + (r.me ? ' me' : '');
          const n = document.createElement('em'); n.textContent = '#' + (i+1);
          const a = document.createElement('span');
          a.textContent = r.id + (r.title ? '　' + r.title : '') + (r.character ? '　' + r.character : '');
          const b2 = document.createElement('b');
          b2.textContent = (key === 'total' ? r.total : r.best).toLocaleString();
          d.append(n, a, b2); box.appendChild(d);
        });
      };
      mk('🏆 學期總積分　前三名', b.overall, 'total');
      mk('📖 本課最強　前五名', b.lesson, 'best');
    })
    .withFailureHandler(function(){})
    .getBoards(currentLesson ? currentLesson.id : 'default');
}

function renderBoard(list){
  const body = $('board-body'); body.innerHTML='';
  if(!Array.isArray(list) || !list.length){
    body.innerHTML = '<tr><td colspan="4">目前還沒有成績，你就是第一個。</td></tr>'; return;
  }
  list.forEach(function(s,i){
    const tr = document.createElement('tr');
    ['#'+(i+1), s.name||s.nickname||'—', s.char||s.character||'—', s.score].forEach(function(t){
      const td = document.createElement('td'); td.textContent = t; tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}
