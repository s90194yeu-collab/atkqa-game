/* 【16-bank.js】題庫載入
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   題庫載入
   ========================================================================== */
function fetchQuestions(){
  return new Promise(resolve=>{
    if(!inGAS) return resolve(null);
    let done = false;
    const finish = rows => { if(!done){ done = true; resolve(rows); } };
    setTimeout(()=>finish(null), 9000);
    google.script.run
      .withSuccessHandler(rows => finish(Array.isArray(rows) && rows.length ? rows : null))
      .withFailureHandler(()  => finish(null))
      .getAllQuestions(currentLesson ? currentLesson.id : '');
  });
}
const LETTERS = ['A','B','C','D','E','F'];
function normalize(raw, idx){
  const answers = (raw.answer||[]).map(String);
  // 洗牌前先記住原本的位置，解析裡的選項代號才能跟著換
  const opts = (raw.options||[]).map(function(t, i){
    return {text:String(t), correct:answers.indexOf(String(t))>=0, orig:i};
  });
  const mixed = shuffle(opts);
  const nCorrect = mixed.filter(function(o){ return o.correct; }).length;
  // 原代號 → 新代號 的對照
  const map = {};
  mixed.forEach(function(o, i){ map[LETTERS[o.orig]] = LETTERS[i]; });
  return { id: String(raw.id !== undefined ? raw.id : ('L'+idx)),
           cat: String(raw.cat || ''),
           q: String(raw.q||''),
           exp: remapLetters(String(raw.exp||''), map),
           options: mixed,
           type: nCorrect <= 1 ? 'single' : 'multi',
           nCorrect: nCorrect };
}

/* 把解析裡提到的選項代號換成洗牌後的代號。
   只處理「像選項代號」的寫法：(A) （A） A. A、 A， 選項A 答案A 等，
   避免誤傷正文中剛好出現的英文字母。 */
function remapLetters(text, map){
  if(!text) return text;
  const pat = /(^|[\s（(【「『，,、。：:／\/])([A-Fa-fＡ-Ｆａ-ｆ])(?=[\s）)】」』，,、。：:．.／\/]|$)/g;
  const norm = function(c){
    const code = c.charCodeAt(0);
    if(code >= 0xFF21 && code <= 0xFF26) return String.fromCharCode(code - 0xFF21 + 65);
    if(code >= 0xFF41 && code <= 0xFF46) return String.fromCharCode(code - 0xFF41 + 65);
    return c.toUpperCase();
  };
  return text.replace(pat, function(m, pre, ch){
    const k = norm(ch);
    return pre + (map[k] || ch);
  });
}
let BANK_CACHE = null;
async function preparePool(){
  let bank = (S.mode === 'dojo') ? dojoBank() : await fetchQuestions();
  if(!bank) bank = LOCAL_BANK;
  BANK_CACHE = bank.map(normalize);
  let all = BANK_CACHE.slice();
  if(S.used.length) all = all.filter(q => S.used.indexOf(q.id) < 0);
  S.pool = shuffle(all);
  S.perRound = Math.max(1, Math.ceil((S.pool.length + S.used.length) / CONFIG.rounds));
  if(S.mode === 'dojo') S.perRound = S.pool.length;   // 道場只有一回合，錯題全部打完為止
}

/* 錯題回收：把答錯的題目重新洗回題庫，排在本回合的後段 */
function recycleWrong(){
  if(!CONFIG.wrongRetry || !S.wrong.length || !BANK_CACHE) return 0;
  const back = [];
  S.wrong.forEach(function(id){
    const q = BANK_CACHE.filter(function(x){ return x.id === id; })[0];
    if(!q) return;
    const copy = clone(q);
    copy.options = shuffle(copy.options);   // 選項重新洗牌，不能靠位置記答案
    copy.retry = true;
    back.push(copy);
  });
  if(!back.length) return 0;
  S.retryIds = S.wrong.slice();
  S.wrong = [];
  // 放在題庫尾端（pop 取題，所以尾端＝先出）
  S.pool = S.pool.concat(shuffle(back));
  return back.length;
}
