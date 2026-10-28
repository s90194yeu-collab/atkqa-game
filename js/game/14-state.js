/* 【14-state.js】遊戲狀態 S
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   遊戲狀態
   ========================================================================== */
const S = {
  player:null, enemy:null,
  pSt:newStatus(), eSt:newStatus(),
  pool:[], used:[], current:null,
  round:1, perRound:0, qInRound:0, totalAnswered:0,
  picked:new Set(), answered:false, resolved:false,
  charge:0, quizPts:0, combo:0, bestCombo:0, sinceRun:0, sinceBest:0,
  move:null, busy:false, finished:false, finalScore:0,
  nickname:'',
  wrong:[],          // 答錯待重出的題目
  retryIds:[],       // 這一輪是重出題的題號
  log:[],            // 作答紀錄，回合結束時送回試算表
  difficulty:'easy', // easy＝一對一；hard＝一對多
  foes:[], foeSt:[], target:0,
  defeats:0, defeated:false,
  waves:0, kos:0, swapMode:false, abUsedQ:null, catSolveUsed:false,
  sp:0, spiritUsed:{}, spiritCasts:0,
  blocked:0, counters:0, skillUses:0,
  /* 成長系統用的紀錄，不參與戰鬥計算 */
  mode:'normal', streak:0, maxStreak:0, roundFull:0, perfectRounds:0, awakened:false,
  lvUps:[], dojoFixed:0, raidDmg:0
};
let RESUME = null;
