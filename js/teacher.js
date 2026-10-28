
const $ = id => document.getElementById(id);
let TOKEN = '', PAGE = 'overview', CACHE = {}, TREND_FOR = null;

/* ── 密碼閘 ── */
$('go').onclick = doLogin;
$('pw').onkeydown = e => { if(e.key === 'Enter') doLogin(); };
function doLogin(){
  const pw = $('pw').value.trim();
  if(!pw) return;
  $('go').disabled = true; $('gate-err').textContent = '驗證中…';
  google.script.run
    .withSuccessHandler(function(r){
      $('go').disabled = false;
      if(!r || !r.ok){ $('gate-err').textContent = (r && r.msg) || '密碼不正確。'; return; }
      TOKEN = r.token;
      try{ sessionStorage.setItem('t_token', TOKEN); }catch(e){}
      $('gate').hidden = true; $('main').hidden = false;
      loadFilters();
    })
    .withFailureHandler(function(e){
      $('go').disabled = false;
      $('gate-err').textContent = '連線失敗：' + (e && e.message ? e.message : e);
    })
    .teacherLogin(pw);
}
try{
  const t = sessionStorage.getItem('t_token');
  if(t){ TOKEN = t; $('gate').hidden = true; $('main').hidden = false; }
}catch(e){}

$('logout').onclick = function(){
  try{ sessionStorage.removeItem('t_token'); }catch(e){}
  location.reload();
};

/* ── 篩選器 ── */
function loadFilters(){
  google.script.run
    .withSuccessHandler(function(d){
      const c = $('f-cls'); c.innerHTML = '<option value="__ALL__">全部學生</option>';
      (d.classes || []).forEach(function(x){
        const o = document.createElement('option'); o.value = x; o.textContent = x; c.appendChild(o);
      });
      const l = $('f-lesson'); l.innerHTML = '<option value="__ALL__">全部課次</option>';
      (d.lessons || []).forEach(function(x){
        const o = document.createElement('option'); o.value = x.id; o.textContent = x.name; l.appendChild(o);
      });
      $('scope-note').textContent = '名冊登記 ' + (d.rosterCount || 0) + ' 位學生';
      render();
    })
    .withFailureHandler(showErr)
    .teacherFilters(TOKEN);
}
if(TOKEN) loadFilters();

$('f-cls').onchange = $('f-lesson').onchange = function(){ CACHE = {}; render(); };
$('reload').onclick = function(){ CACHE = {}; loadFilters(); };
document.querySelectorAll('.tab').forEach(function(t){
  t.onclick = function(){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
    t.classList.add('on'); PAGE = t.dataset.p; TREND_FOR = null; render();
  };
});

const cls = () => $('f-cls').value;
const les = () => $('f-lesson').value;
function showErr(e){
  const msg = String(e && e.message ? e.message : e);
  /* 通行碼失效（例如改過密碼）：清掉舊的，回到密碼畫面 */
  if(msg.indexOf('未授權') >= 0){
    try{ sessionStorage.removeItem('t_token'); }catch(_){}
    TOKEN = ''; CACHE = {};
    $('main').hidden = true; $('gate').hidden = false;
    $('gate-err').textContent = '登入已失效，請重新輸入教師密碼。';
    $('pw').value = ''; $('pw').focus();
    return;
  }
  $('body').innerHTML = '<div class="panel"><p class="empty warn">發生錯誤：'
    + (e && e.message ? e.message : e) + '</p></div>';
}
function loading(){ $('body').innerHTML = '<div class="loading">載入中…</div>'; }
const pct = v => (v == null ? '—' : v + '%');
const tone = v => v >= 80 ? 'good' : v >= 60 ? 'mid' : 'warn';
function esc(t){ const d = document.createElement('div'); d.textContent = t == null ? '' : t; return d.innerHTML; }

/* ── 取資料（帶快取，切分頁不重打） ── */
function pull(fn, key, cb){
  const k = key + '|' + cls() + '|' + les();
  if(CACHE[k]){ cb(CACHE[k]); return; }
  loading();
  google.script.run
    .withSuccessHandler(function(d){ CACHE[k] = d; cb(d); })
    .withFailureHandler(showErr)[fn](TOKEN, cls(), les());
}

/* ── 各分頁 ── */
function render(){
  if(PAGE === 'overview') return pull('teacherOverview', 'ov', drawOverview);
  if(PAGE === 'cats')     return pull('teacherOverview', 'ov', drawCats);
  if(PAGE === 'hard')     return pull('teacherHardQuestions', 'hard', drawHard);
  if(PAGE === 'students') return pull('teacherStudents', 'stu', drawStudents);
  if(PAGE === 'missing')  return pull('teacherMissing', 'miss', drawMissing);
  if(PAGE === 'class')    return drawClassCompare();
  if(PAGE === 'raid')     return drawRaid();
  if(PAGE === 'ai')       return drawAI();
}

function drawOverview(d){
  if(!d.answers) return $('body').innerHTML = '<div class="panel"><p class="empty">這個範圍還沒有作答紀錄。</p></div>';
  let h = '<div class="cards">'
    + kpi('參與學生', d.students, '人')
    + kpi('作答題次', d.answers, '題次')
    + kpi('平均得分率', d.avgRate + '%', '每題答對比例的平均')
    + kpi('全對率', d.fullRate + '%', '完全答對的比例')
    + kpi('重做率', d.retryRate + '%', '錯題重來的比例')
    + '</div>';
  h += '<div class="panel"><h3>各課次表現</h3><div class="scroll"><table class="tbl">'
     + '<tr><th>課次</th><th class="num">參與人數</th><th class="num">作答題次</th>'
     + '<th class="num">平均得分率</th><th class="num">全對率</th></tr>';
  d.lessons.forEach(function(x){
    h += '<tr><td>' + esc(x.name) + '</td><td class="num">' + x.students + '</td><td class="num">' + x.answers
       + '</td><td class="num ' + tone(x.avgRate) + '">' + pct(x.avgRate)
       + '</td><td class="num ' + tone(x.fullRate) + '">' + pct(x.fullRate) + '</td></tr>';
  });
  h += '</table></div></div>';
  $('body').innerHTML = h;
}
function kpi(t, v, s){
  return '<div class="kpi"><i>' + t + '</i><b>' + v + '</b><small>' + s + '</small></div>';
}

function drawCats(d){
  if(!d.cats.length) return $('body').innerHTML = '<div class="panel"><p class="empty">沒有題型資料。</p></div>';
  const sorted = d.cats.slice().sort((a,b)=>a.avgRate-b.avgRate);
  let h = '<div class="panel"><h3>八大題型・平均得分率<span>由弱到強</span></h3>';
  sorted.forEach(function(c){
    const col = c.avgRate >= 80 ? '#34d399' : c.avgRate >= 60 ? '#ffc533' : '#ff6f8e';
    h += '<div class="bar-row"><i>' + esc(c.cat) + '</i><u><b style="width:'
       + Math.max(2, c.avgRate) + '%;background:' + col + '"></b></u><em>' + pct(c.avgRate) + '</em></div>';
  });
  h += '</div>';

  h += '<div class="panel"><h3>得分率 vs 全對率<span>兩者落差大＝學生會一部分但不完整</span></h3>'
     + '<div class="scroll"><table class="tbl">'
     + '<tr><th>題型</th><th class="num">題次</th><th class="num">平均得分率</th>'
     + '<th class="num">全對率</th><th class="num">落差</th><th>判讀</th></tr>';
  sorted.forEach(function(c){
    const gap = Math.round((c.avgRate - c.fullRate) * 10) / 10;
    let note = '';
    if(c.answers < 10) note = '題次太少，數據僅供參考';
    else if(gap >= 25) note = '多為部分答對——概念大致有，細節不牢';
    else if(c.avgRate < 55) note = '整體偏弱，建議優先補強';
    else if(c.fullRate >= 75) note = '掌握良好';
    h += '<tr><td>' + esc(c.cat) + '</td><td class="num">' + c.answers
       + '</td><td class="num ' + tone(c.avgRate) + '">' + pct(c.avgRate)
       + '</td><td class="num ' + tone(c.fullRate) + '">' + pct(c.fullRate)
       + '</td><td class="num">' + gap + '</td><td style="color:var(--dim);font-size:.78rem">' + note + '</td></tr>';
  });
  h += '</table></div></div>';
  $('body').innerHTML = h;
}

function drawHard(list){
  if(!list || !list.length) return $('body').innerHTML = '<div class="panel"><p class="empty">沒有作答紀錄。</p></div>';
  let h = '<div class="panel"><h3>易錯題排行<span>全對率由低到高，最多 20 題</span></h3>'
        + '<div class="scroll"><table class="tbl">'
        + '<tr><th>題號</th><th>題型</th><th class="num">題次</th><th class="num">全對率</th>'
        + '<th class="num">平均得分率</th><th>選項分布（紅＝最強誘答，綠＝正解）</th></tr>';
  list.forEach(function(q){
    h += '<tr><td><b>' + esc(q.lessonName || q.lesson || '') + '　' + esc(q.qid) + '</b>'
       + (q.stem ? '<div class="qstem">' + esc(q.stem) + '…</div>' : '')
       + '</td><td style="font-size:.76rem">' + esc(q.cat) + '</td>'
       + '<td class="num">' + q.attempts + '</td>'
       + '<td class="num ' + tone(q.fullRate) + '">' + pct(q.fullRate) + '</td>'
       + '<td class="num ' + tone(q.avgRate) + '">' + pct(q.avgRate) + '</td><td>';
    if(q.distract && q.distract.length){
      h += '<div class="dis">';
      q.distract.forEach(function(d){
        const cl = d.isAnswer ? 'ans' : (q.topWrong && d.opt === q.topWrong.opt ? 'hot' : '');
        h += '<span class="' + cl + '">' + d.opt + '　' + d.pct + '%</span>';
      });
      h += '</div>';
      if(q.topWrong && q.topWrong.text){
        h += '<div class="qstem">最強誘答 ' + q.topWrong.opt + '：' + esc(q.topWrong.text.slice(0,50)) + '</div>';
      }
    } else h += '<span style="color:var(--dim);font-size:.76rem">尚無選項紀錄</span>';
    h += '</td></tr>';
  });
  h += '</table></div>'
     + '<p class="qstem">錯的人若高度集中在同一個選項，通常是共同的迷思概念；'
     + '若分布很平均，比較可能是題目敘述不清或選項不夠精確。</p></div>';
  $('body').innerHTML = h;
}

function drawStudents(list){
  if(!list || !list.length) return $('body').innerHTML = '<div class="panel"><p class="empty">沒有作答紀錄。</p></div>';
  if(TREND_FOR) return drawTrend();
  let h = '<div class="panel"><h3>學生名單<span>依平均得分率由低到高，點姓名看成長曲線</span></h3>'
        + '<div class="scroll"><table class="tbl">'
        + '<tr><th>班級</th><th>座號</th><th>學號</th><th>姓名</th><th class="num">課次</th>'
        + '<th class="num">題次</th><th class="num">平均得分率</th><th class="num">全對率</th><th>最弱題型</th></tr>';
  list.forEach(function(s){
    h += '<tr><td>' + esc(s.cls) + '</td><td>' + esc(s.seat) + '</td><td>' + esc(s.sid) + '</td>'
       + '<td><button class="tab" style="padding:3px 10px;font-size:.78rem" onclick="openTrend(\''
       + esc(s.email) + '\')">' + esc(s.name || s.email) + '</button></td>'
       + '<td class="num">' + s.lessons + '</td><td class="num">' + s.answers + '</td>'
       + '<td class="num ' + tone(s.avgRate) + '">' + pct(s.avgRate) + '</td>'
       + '<td class="num ' + tone(s.fullRate) + '">' + pct(s.fullRate) + '</td>'
       + '<td style="font-size:.76rem;color:var(--dim)">' + esc(s.weakest) + '</td></tr>';
  });
  h += '</table></div></div>';
  $('body').innerHTML = h;
}

let TREND_DATA = null;
function openTrend(email){
  TREND_FOR = email; loading();
  google.script.run
    .withSuccessHandler(function(d){ TREND_DATA = d; drawTrend(); })
    .withFailureHandler(showErr)
    .teacherStudentTrend(TOKEN, email);
}
function drawTrend(){
  const d = TREND_DATA;
  if(!d) return;
  let h = '<div class="panel"><h3>個人成長曲線<span>' + esc(d.email) + '</span></h3>'
        + '<button class="btn ghost" style="margin-bottom:12px" onclick="TREND_FOR=null;render()">← 回名單</button>';
  if(!d.trend.length){ h += '<p class="empty">沒有紀錄。</p></div>'; $('body').innerHTML = h; return; }
  h += '<div class="scroll"><table class="tbl"><tr><th>課次</th><th class="num">題次</th>'
     + '<th class="num">平均得分率</th><th class="num">全對率</th></tr>';
  d.trend.forEach(function(t){
    h += '<tr><td>' + esc(t.name) + '</td><td class="num">' + t.answers + '</td>'
       + '<td class="num ' + tone(t.avgRate) + '">' + pct(t.avgRate) + '</td>'
       + '<td class="num ' + tone(t.fullRate) + '">' + pct(t.fullRate) + '</td></tr>';
  });
  h += '</table></div></div>';

  h += '<div class="panel"><h3>各題型表現</h3>';
  Object.keys(d.cats).sort((a,b)=>d.cats[a]-d.cats[b]).forEach(function(c){
    const v = d.cats[c];
    const col = v >= 80 ? '#34d399' : v >= 60 ? '#ffc533' : '#ff6f8e';
    h += '<div class="bar-row"><i>' + esc(c) + '</i><u><b style="width:'
       + Math.max(2, v) + '%;background:' + col + '"></b></u><em>' + pct(v) + '</em></div>';
  });
  h += '</div>';

  if(d.wrong && d.wrong.length){
    h += '<div class="panel"><h3>錯題紀錄<span>最多 60 筆</span></h3><div class="scroll"><table class="tbl">'
       + '<tr><th>題號</th><th>題型</th><th>課次</th><th class="num">得分率</th><th>作答</th><th>正解</th></tr>';
    d.wrong.forEach(function(w){
      h += '<tr><td>' + esc(w.qid) + '</td><td style="font-size:.76rem">' + esc(w.cat) + '</td>'
         + '<td style="font-size:.76rem">' + esc(w.lesson) + '</td>'
         + '<td class="num ' + tone(w.rate) + '">' + pct(w.rate) + '</td>'
         + '<td class="warn">' + esc(w.picked || '未作答') + '</td>'
         + '<td class="good">' + esc(w.answer) + '</td></tr>';
    });
    h += '</table></div></div>';
  }
  $('body').innerHTML = h;
}

function drawMissing(list){
  if(!list || !list.length) return $('body').innerHTML =
    '<div class="panel"><p class="empty good">這個範圍內，名冊上的學生都有作答紀錄。</p></div>';
  let h = '<div class="panel"><h3>未參與名單<span>名冊上有、但這個範圍沒有紀錄：' + list.length + ' 人</span></h3>'
        + '<div class="scroll"><table class="tbl"><tr><th>班級</th><th>座號</th><th>學號</th><th>姓名</th><th>信箱</th></tr>';
  list.forEach(function(s){
    h += '<tr><td>' + esc(s.cls) + '</td><td>' + esc(s.seat) + '</td><td>' + esc(s.sid) + '</td>'
       + '<td>' + esc(s.name) + '</td><td style="color:var(--dim);font-size:.76rem">' + esc(s.email) + '</td></tr>';
  });
  h += '</table></div><p class="qstem">名冊沒登記的學生不會出現在這裡。'
     + '可以在 Apps Script 執行 <code>syncRosterFromLogs()</code> 把玩過的人自動補進名冊。</p></div>';
  $('body').innerHTML = h;
}

function drawClassCompare(){
  loading();
  google.script.run
    .withSuccessHandler(function(list){
      if(!list || !list.length) return $('body').innerHTML =
        '<div class="panel"><p class="empty">沒有資料。班級要先在「學生名冊」工作表登記才會出現。</p></div>';
      let h = '<div class="panel"><h3>班級橫向比較<span>此頁不受上方「班級」篩選影響</span></h3>'
            + '<div class="scroll"><table class="tbl">'
            + '<tr><th>班級</th><th class="num">參與/名冊</th><th class="num">題次</th>'
            + '<th class="num">平均得分率</th><th class="num">全對率</th></tr>';
      list.forEach(function(c){
        h += '<tr><td><b>' + esc(c.cls) + '</b></td><td class="num">' + c.students + ' / ' + c.roster
           + '</td><td class="num">' + c.answers + '</td>'
           + '<td class="num ' + tone(c.avgRate) + '">' + pct(c.avgRate) + '</td>'
           + '<td class="num ' + tone(c.fullRate) + '">' + pct(c.fullRate) + '</td></tr>';
      });
      h += '</table></div></div>';
      const cats = {};
      list.forEach(c => Object.keys(c.cats).forEach(k => cats[k] = 1));
      const ck = Object.keys(cats).sort();
      if(ck.length){
        h += '<div class="panel"><h3>各班題型得分率</h3><div class="scroll"><table class="tbl"><tr><th>班級</th>';
        ck.forEach(k => h += '<th class="num" style="font-size:.68rem">' + esc(k) + '</th>');
        h += '</tr>';
        list.forEach(function(c){
          h += '<tr><td>' + esc(c.cls) + '</td>';
          ck.forEach(function(k){
            const v = c.cats[k];
            h += '<td class="num ' + (v == null ? '' : tone(v)) + '">' + (v == null ? '—' : v) + '</td>';
          });
          h += '</tr>';
        });
        h += '</table></div></div>';
      }
      $('body').innerHTML = h;
    })
    .withFailureHandler(showErr)
    .teacherClassCompare(TOKEN, les());
}

/* ── 全班討伐與每週活動 ── */
function drawRaid(){
  loading();
  google.script.run
    .withSuccessHandler(function(d){
      d = d || {rows:[], events:[]};
      let h = '<div class="panel"><h3>進行中的活動<span>在試算表「活動」工作表新增或關閉</span></h3>';
      if(!d.events || !d.events.length){
        h += '<p class="empty">目前沒有進行中的活動。第一次使用請在 Apps Script 執行 <code>setupGrowthSheets()</code>，'
           + '會建立「活動」與「班級討伐」兩張設定表（範例列預設不啟用）。</p>';
      }else{
        h += '<div class="scroll"><table class="tbl"><tr><th>活動</th><th>效果</th><th>期間</th></tr>';
        d.events.forEach(function(e){
          h += '<tr><td><b>' + esc(e.name) + '</b></td><td>' + esc(e.desc || (e.code + '：' + e.value)) + '</td>'
             + '<td style="white-space:nowrap">' + esc(e.start || '即日起') + ' ～ ' + esc(e.end || '不限') + '</td></tr>';
        });
        h += '</table></div>';
      }
      h += '</div>';

      h += '<div class="panel"><h3>全班討伐進度<span>血量＝班級人數 × ' + (d.hpPerStudent || 200)
         + '，全對一題造成 10 點；上方「課次」可篩選</span></h3>';
      if(!d.rows || !d.rows.length){
        h += '<p class="empty">還沒有任何班級出戰。</p>';
      }else{
        h += '<div class="scroll"><table class="tbl"><tr><th>課次</th><th>班級</th><th>討伐目標</th>'
           + '<th class="num">出戰/名冊</th><th style="min-width:160px">進度</th><th>狀態</th></tr>';
        d.rows.forEach(function(r){
          const pct = r.hp ? Math.min(100, Math.round(r.dmg / r.hp * 100)) : 0;
          h += '<tr><td style="font-size:.8rem">' + esc(r.lessonName) + '</td><td><b>' + esc(r.cls) + '</b></td>'
             + '<td>' + esc(r.name) + (r.on ? '' : '<div class="qstem">（已關閉）</div>') + '</td>'
             + '<td class="num">' + r.joined + ' / ' + (r.roster || '—') + '</td>'
             + '<td><div class="mini"><i style="width:' + pct + '%"></i></div>'
             + '<div class="qstem">' + r.dmg.toLocaleString() + ' / ' + r.hp.toLocaleString() + '（' + pct + '%）</div></td>'
             + '<td class="' + (r.defeated ? 'good' : 'mid') + '" style="font-weight:700;white-space:nowrap">'
             + (r.defeated ? '🏆 已討伐' : '進行中') + '</td></tr>';
        });
        h += '</table></div>';
      }
      h += '<p class="qstem">想調整某一課的名稱或血量，請到「班級討伐」工作表新增一列：課程ID、名稱、血量（空白＝自動）、啟用（0＝關閉）。</p></div>';
      $('body').innerHTML = h;
    })
    .withFailureHandler(showErr)
    .teacherRaid(TOKEN, les());
}

/* ── AI 建議 ── */
function drawAI(){
  $('body').innerHTML = '<div class="panel"><h3>AI 教學建議</h3>'
    + '<p class="qstem">依目前的篩選範圍產生完整的教學診斷報告，'
    + '包含題型強弱、易錯題逐題檢討、誘答迷思推測與可執行的教學調整建議。<br>'
    + '報告很長，產生約需 30～60 秒。範圍越大越久，若想快一點可先選定單一班級或課次。</p>'
    + '<button class="btn" id="ai-go">產生報告</button>'
    + '<div id="ai-out" style="margin-top:16px"></div></div>';
  $('ai-go').onclick = function(){
    $('ai-go').disabled = true;
    $('ai-out').innerHTML = '<p class="loading">AI 分析中…　完整報告約需 30～60 秒，請不要關閉頁面。</p>';
    google.script.run
      .withSuccessHandler(function(r){
        $('ai-go').disabled = false;
        if(!r || !r.ok){ $('ai-out').innerHTML = '<p class="empty">' + esc((r && r.text) || '無法產生。') + '</p>'; return; }
        let foot = r.ai ? ('由 ' + esc(r.model || 'Gemini') + ' 產生')
                        : '系統彙整（未使用 AI）';
        if(!r.ai && r.err) foot += '<br><span class="warn">AI 失敗原因：' + esc(r.err) + '</span>';
        $('ai-out').innerHTML = '<div class="ai">' + md(r.text) + '</div>'
          + '<p class="qstem" style="margin-top:14px">' + foot + '</p>';
      })
      .withFailureHandler(function(e){
        $('ai-go').disabled = false;
        $('ai-out').innerHTML = '<p class="empty warn">失敗：' + esc(e && e.message ? e.message : e) + '</p>';
      })
      .teacherAdvice(TOKEN, cls(), les());
  };
}

/* 極簡 Markdown（標題、粗體、行內碼、清單） */
function md(t){
  let h = esc(t);
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>')
       .replace(/^## (.*)$/gm, '<h2>$1</h2>')
       .replace(/^# (.*)$/gm, '<h2>$1</h2>')
       .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/`(.+?)`/g, '<code>$1</code>')
       .replace(/^[-*] (.*)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, function(m){ return '<ul>' + m + '</ul>'; });
  return h;
}
