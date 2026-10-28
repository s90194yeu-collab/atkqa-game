
/* ============================================================================
   啟動診斷：把原本只會出現在主控台的錯誤，直接顯示在畫面上。
   確認一切正常之後，把 BOOT_DIAG 改成 false 就會完全關閉。
   ========================================================================== */
var BOOT_DIAG = false;
(function(){
  if(!BOOT_DIAG) return;
  var box = null, seen = {};
  window.__bootErr = function(title, detail){
    try{
      if(!box){
        box = document.createElement('div'); box.id = 'boot-err';
        var x = document.createElement('button'); x.textContent = '關閉';
        x.onclick = function(){ box.remove(); box = null; };
        box.appendChild(x);
        var h = document.createElement('b'); h.textContent = '⚠ 啟動診斷（這個訊息只有出問題時才會出現）';
        box.appendChild(h);
        (document.body || document.documentElement).appendChild(box);
      }
      var k = title + '|' + detail;
      if(seen[k]) return; seen[k] = 1;
      var c = document.createElement('code');
      c.textContent = title + '　' + detail;
      box.appendChild(c);
    }catch(e){}
  };
  window.addEventListener('error', function(e){
    window.__bootErr('JS 例外：', (e.message || '') + '　@ 第 ' + (e.lineno || '?') + ' 行');
  });
  window.addEventListener('unhandledrejection', function(e){
    window.__bootErr('未處理的 Promise：', String(e.reason));
  });
  /* 逾時監看：12 秒後回報哪些後端呼叫沒有回應 */
  window.__pending = {};
  window.__watch = function(name){
    window.__pending[name] = Date.now();
    setTimeout(function(){
      if(window.__pending[name]){
        window.__bootErr('後端無回應（逾時 12 秒）：', name
          + '　→ 多半是 Apps Script 沒有重新部署，或 Code.gs 有編譯錯誤');
      }
    }, 12000);
  };
  window.__done = function(name){ delete window.__pending[name]; };
})();
"use strict";
/* ============================================================================
   跨界國文大亂鬥　v2
   ── 部署於 Google Apps Script（HtmlService）
   ── 題庫來源：優先讀取試算表（getQuestions），失敗時退回本機示範題庫
   ========================================================================== */

/* ---------- 全域設定：老師調整參數只需要動這一段 ---------- */
const CONFIG = {
  rounds        : 3,     // 總回合數；每回合題數＝試算表總題數 ÷ 回合數
  wrongRetry    : true,  // 錯題回收：答錯的題目會在後面的回合再出一次
  defeatPenalty : 0.50,  // 戰敗代價：下一回合開場體力上限的比例
  revivePts     : 300,   // 原地復活的扣分（回復 50% 體力）
  swapPts       : 600,   // 換角色再戰的扣分（滿血新角色）
  enemyHpMulti  : {easy:1.00, hard:0.58},   // 困難模式：每隻敵人的血量比例
  enemyDmgMulti : {easy:1.00, hard:0.45},   // 困難模式：每隻敵人的傷害比例
  enemyCount    : {easy:1,    hard:3},      // 同時出場的敵人數
  hardActs      : 2,     // 困難模式每回合最多幾隻敵人出手
  hardScore     : 1.30,  // 困難模式的分數倍率
  aoeScale      : 0.72,  // 群體攻擊：對每個目標的傷害倍率
  zeroChargeSafe: true,  // 發動權 0 時直接看解析，對手不趁機攻擊（false＝對手照樣出手）
  confirmAnswer : true,  // 送出答案前跳出確認（手機防誤觸；不需要就改成 false）
  accBase       : 88,    // 命中率曲線：威力 50 時的命中率
  accSlope      : 0.34,  // 威力每 +1，命中率 -0.34（保證期望傷害單調遞增）
  accFloor      : 55,    // 命中率下限
  aoeAccPenalty : 18,    // 群體攻擊：命中率懲罰（威力低但不該又準又廣）
  assistRate    : 0.14,  // 同系列夥伴出手支援的機率
  assistPower   : 1.65,  // 合體攻擊的傷害倍率
  roundBonus    : 150,   // 每完成一回合的加分
  playerDmg     : 4.80,  // 玩家傷害係數（越大越好打）
  enemyDmg      : 1.20,  // 電腦傷害係數（越大越難）
  waveHeal      : 0.15,  // 清空一波後回復的體力比例

  /* 隱藏角色（闕闕）的特別待遇：狀態固定滿檔、SP 開局就很多 */
  secretBoost   : 0.20,  // 各項數值固定 +20%（不再隨機）
  secretSp      : 20,    // 開局 SP
  secretSpRound : 10,    // 每回合開始回復的 SP

  /* ── 特色能力的全畫面演出 ── */
  cutInHold     : 2000,  // 靜態圖停留（毫秒）
  cutInGif      : 10000, // GIF 停留（毫秒）
  cutInAnim     : 8000,  // 演出動畫停留（毫秒）。原始影片 8 秒，設一樣長才播得完整
  upgradeAt     : 0.40,  // 剩餘 HP 低於此比例觸發「大破換乘」
  upgradeHeal   : 300,   // 換乘回復量

  /* ── 隨機戰況：讓每一擊的數字都不一樣 ── */
  rollVar       : 0.20,  // 上場時各項數值的個體差異（±20%，每項獨立擲）
  varMin        : 0.72,  // 傷害浮動下限（原本 0.85）
  varMax        : 1.30,  // 傷害浮動上限（原本 1.15）
  critRate      : 0.12,  // 基礎爆擊率；全對再 +8%，零式系統再 +10%
  critMulti     : 1.85,  // 爆擊倍率
  glanceRate    : 0.15,  // 擦傷機率
  glanceMulti   : 0.62,  // 擦傷倍率
  counterRate   : 0.35,  // 防禦成功後的反擊機率

  /* ── 連擊：連續全對可疊加傷害 ── */
  comboStep     : 0.08,  // 每層連擊 +8% 傷害
  comboMax      : 5,     // 連擊上限
  comboBonus    : 60,    // 結算時每層最高連擊的加分

  ptsPerQuestion: 100,   // 每題滿分
  /* 題型加權：單選是全有全無，多選有部分給分，
     不加權的話多選題比例高的課次分數會系統性偏高 */
  typeWeight    : {single:1.30, multi:1.00},
  /* ── 計分：讓六種定位的期望總分接近 ──
     擊破分降低，另外開出防禦／反擊／特技的計分管道，
     否則防禦型一直防禦就會比攻擊型少快 1000 分 */
  winBonus      : 250,
  koBonus       : 70,    // 每擊破一名敵人的即時分數
  sweepBonus    : 30,    // 結算時每名敵人的額外掃蕩獎金
  blockPts      : 1.0,   // 每擋下 1 點傷害的分數
  counterPts    : 50,    // 反擊成功一次
  skillPts      : 40,    // 成功發動特技一次
  spiritPts     : 30     // 成功發動精神指令一次
};

/* ---------- 屬性相剋表 ---------- */
const TYPE_CHART = {
  火    :{good:['風','冥'], bad:['水','火'],  none:[]},
  風    :{good:['土','無'], bad:['火','雷'],  none:[]},
  土    :{good:['雷','光'], bad:['風','土'],  none:[]},
  雷    :{good:['水','風'], bad:['土','雷'],  none:[]},
  水    :{good:['火','土'], bad:['雷','水'],  none:[]},
  光    :{good:['冥'],      bad:['光'],       none:[]},
  冥    :{good:['光','無'], bad:['冥'],       none:[]},
  無    :{good:[],          bad:[],           none:[]},
  超能力:{good:['冥'],      bad:[],           none:[]},
  防禦  :{good:[], bad:[], none:[]},
  特技  :{good:[], bad:[], none:[]}
};
/* 呼吸法 → 屬性 */
const BREATH = {
  '水之呼吸':'水','火之神神樂':'火','炎之呼吸':'火','雷之呼吸':'電','獸之呼吸':'一般',
  '蟲之呼吸':'毒','音之呼吸':'一般','霞之呼吸':'冰','戀之呼吸':'超能力','蛇之呼吸':'毒',
  '風之呼吸':'飛行','岩之呼吸':'岩石'
};
/* 防禦屬性：鬼＝'鬼'（不再被一般／格鬥完全免疫），鋼彈＝'鋼'，劍士依呼吸法 */
function defTypeOf(c){
  if(c.defType) return c.defType;               // 角色自訂防禦屬性優先
  return BREATH[c.type] || c.type;              // 其餘依呼吸法或本身屬性
}
/* 命中率由威力決定（固定值，公平可預期） */
/* 命中率＝威力的線性函數。
   舊版是階梯式（90 以上一律 65%），會造成「期望傷害不隨威力遞增」的死區：
   威力 80～103 的期望傷害其實全都輸給威力 79，跨過門檻的第一格最虧。
   改成線性之後，期望傷害在整個威力範圍內單調遞增，威力調高就一定更強。
   常數經過擬合，全體招式的平均期望傷害與舊版相差 0.05%，不會通膨。 */
function accOf(power){
  if(power <= 0) return 100;
  const a = Math.round((CONFIG.accBase - CONFIG.accSlope * (power - 50)) * 10) / 10;
  /* 這裡不呼叫 clamp()：accOf 在角色初始化階段就會被用到，
     而 clamp 是 const，那時還在暫時性死區裡。 */
  return Math.max(CONFIG.accFloor, Math.min(100, a));
}

/* ============================================================================
   角色資料（圖片網址維持原樣，未更動）
   ========================================================================== */
const ALL_CHARACTERS = [
  /* ══ 神域 ══ */
  {id:'my_zeus',name:'眾神之王・宙斯',universe:'myth',clan:'greek',type:'雷',defType:'雷',hp:700,ability:{name:'弒父之雷',effect:'zero_system'},moves:[{name:'雷霆神域',type:'雷',power:74,kind:'attack'},{name:'神王之威',type:'防禦',power:0,defense:0.46,kind:'guard'},{name:'積雨蓄勢',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'my_zeus_bolt'},
  {id:'my_zeus_bolt',name:'雷霆權杖・宙斯',universe:'myth',clan:'greek',type:'雷',defType:'雷',hp:850,isUpgrade:true,ability:{name:'神王震怒',effect:'overdrive'},moves:[{name:'至高神域・落雷',type:'雷',power:94,kind:'attack'},{name:'奧林帕斯天罰',type:'雷',power:70,kind:'aoe'},{name:'神王結界',type:'防禦',power:0,defense:0.38,kind:'guard'}]},
  {id:'my_athena',name:'灰眼女神・雅典娜',universe:'myth',clan:'greek',type:'光',defType:'光',hp:720,ability:{name:'灰眼凝視',effect:'purge'},moves:[{name:'智慧神域',type:'光',power:72,kind:'attack'},{name:'橄欖之盾',type:'防禦',power:0,defense:0.36,kind:'guard'},{name:'戰術洞察',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'my_athena_aegis'},
  {id:'my_athena_aegis',name:'神盾持有・雅典娜',universe:'myth',clan:'greek',type:'光',defType:'光',hp:850,isUpgrade:true,ability:{name:'不敗之盾',effect:'fortress'},moves:[{name:'神盾神域',type:'光',power:92,kind:'attack'},{name:'埃癸斯',type:'防禦',power:0,defense:0.22,kind:'guard'},{name:'石化凝視',type:'特技',power:0,effect:'weaken',kind:'skill'}]},
  {id:'my_poseidon',name:'怒海之主・波賽頓',universe:'myth',clan:'greek',type:'水',defType:'水',hp:800,ability:{name:'撼地一擊',effect:'psyco_frame'},moves:[{name:'怒濤神域',type:'水',power:84,kind:'attack'},{name:'大海嘯',type:'水',power:62,kind:'aoe'},{name:'深淵之壁',type:'防禦',power:0,defense:0.28,kind:'guard'}]},
  {id:'my_thor',name:'雷槌之主・索爾',universe:'myth',clan:'norse',type:'雷',defType:'雷',hp:760,ability:{name:'雷神狂怒',effect:'overdrive'},moves:[{name:'符文・妙爾尼爾',type:'雷',power:86,kind:'attack'},{name:'符文・雷擊回旋',type:'雷',power:78,kind:'attack2'},{name:'巨人剋星',type:'防禦',power:0,defense:0.34,kind:'guard'}]},
  {id:'my_loki',name:'詭計之神・洛基',universe:'myth',clan:'norse',type:'冥',defType:'冥',hp:700,ability:{name:'詐術之神',effect:'lucky_star'},moves:[{name:'符文・謊言之刃',type:'冥',power:82,kind:'attack'},{name:'變形迴避',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'符文・惑心',type:'特技',power:0,effect:'blind',kind:'skill'}]},
  {id:'my_fenrir',name:'命運巨狼・芬里爾',universe:'myth',clan:'norse',type:'風',defType:'風',hp:680,ability:{name:'噬神之誓',effect:'nemesis'},nemesisOf:'myth',moves:[{name:'符文・裂爪',type:'風',power:74,kind:'attack'},{name:'低伏戒備',type:'防禦',power:0,defense:0.44,kind:'guard'},{name:'符文・蓄勢',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'my_fenrir_free'},
  {id:'my_fenrir_free',name:'掙鎖巨狼・芬里爾',universe:'myth',clan:'norse',type:'風',defType:'風',hp:820,isUpgrade:true,ability:{name:'黃昏降臨',effect:'last_burst'},moves:[{name:'符文・吞日',type:'風',power:96,kind:'attack'},{name:'諸神黃昏之顎',type:'風',power:70,kind:'aoe'},{name:'符文・疾走',type:'特技',power:0,effect:'focus',kind:'skill'}]},
  {id:'my_seraph',name:'烈焰六翼・熾天使',universe:'myth',clan:'angel',type:'火',defType:'火',hp:690,ability:{name:'燔祭',effect:'jackpot'},moves:[{name:'聖階・熾焰',type:'火',power:76,kind:'attack'},{name:'六翼環抱',type:'防禦',power:0,defense:0.42,kind:'guard'},{name:'聖階・煉淨',type:'特技',power:0,effect:'atk_up',kind:'skill'}],forms:['my_seraph_open','my_seraph_shield']},
  {id:'my_seraph_shield',name:'聖盾・熾天使',universe:'myth',clan:'angel',type:'火',defType:'火',hp:880,isUpgrade:true,ability:{name:'不燃之盾',effect:'fortress'},moves:[{name:'聖階・淨焰斬',type:'火',power:84,kind:'attack'},{name:'六翼聖盾',type:'防禦',power:0,defense:0.20,kind:'guard'},{name:'聖階・庇護',type:'特技',power:0,effect:'regen',kind:'skill'}]},
  {id:'my_seraph_open',name:'六翼展開・熾天使',universe:'myth',clan:'angel',type:'火',defType:'火',hp:830,isUpgrade:true,ability:{name:'聖焰全開',effect:'trans_am'},moves:[{name:'聖階・熾天焚世',type:'火',power:98,kind:'attack'},{name:'六翼齊振',type:'火',power:72,kind:'aoe'},{name:'聖階・臨在',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'my_cherub',name:'四面之瞳・智天使',universe:'myth',clan:'angel',type:'土',defType:'土',hp:820,ability:{name:'不動座天',effect:'endure'},moves:[{name:'聖階・四方之瞳',type:'土',power:82,kind:'attack'},{name:'全知注視',type:'土',power:60,kind:'aoe'},{name:'智慧之座',type:'防禦',power:0,defense:0.26,kind:'guard'}]},
  {id:'my_dominion',name:'執權掌轄・主天使',universe:'myth',clan:'angel',type:'無',defType:'無',hp:780,ability:{name:'神權執行',effect:'execute'},moves:[{name:'聖階・權柄',type:'無',power:84,kind:'attack'},{name:'秩序之環',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'聖階・裁定',type:'特技',power:0,effect:'weaken',kind:'skill'}]},
  /* ══ 誓約 ══ */
  {id:'oa_arthur',name:'拔劍少年・亞瑟',universe:'oath',clan:'medieval',type:'光',defType:'光',hp:550,moves:[{name:'誓約・拔劍',type:'光',power:62,kind:'attack'},{name:'少年之盾',type:'防禦',power:0,defense:0.55,kind:'guard'},{name:'誓約・靜心',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'oa_arthur_2'},
  {id:'oa_arthur_2',name:'石中劍・亞瑟王',universe:'oath',clan:'medieval',type:'光',defType:'光',hp:760,isUpgrade:true,ability:{name:'圓桌召集',effect:'revive'},moves:[{name:'誓約・王者之證',type:'光',power:80,kind:'attack'},{name:'圓桌之盾',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'誓約・號令',type:'特技',power:0,effect:'atk_up',kind:'skill'}],upgradeTo:'oa_arthur_3'},
  {id:'oa_arthur_3',name:'王者之劍・亞瑟王',universe:'oath',clan:'medieval',type:'光',defType:'光',hp:1000,isUpgrade:true,ability:{name:'誓約勝利之劍',effect:'fortress'},moves:[{name:'誓約・斷鋼神劍',type:'光',power:100,kind:'attack'},{name:'十三騎士衝鋒',type:'光',power:74,kind:'aoe'},{name:'王者結界',type:'防禦',power:0,defense:0.28,kind:'guard'}]},
  {id:'oa_lancelot',name:'湖上騎士・蘭斯洛特',universe:'oath',clan:'medieval',type:'土',defType:'土',hp:750,ability:{name:'圓桌第一',effect:'overdrive'},moves:[{name:'誓約・湖光劍',type:'土',power:86,kind:'attack'},{name:'誓約・突刺',type:'土',power:78,kind:'attack2'},{name:'騎士之禮',type:'防禦',power:0,defense:0.32,kind:'guard'}]},
  {id:'oa_robin',name:'綠林神射・羅賓漢',universe:'oath',clan:'medieval',type:'風',defType:'風',hp:700,ability:{name:'一箭穿心',effect:'jackpot'},moves:[{name:'誓約・綠林箭',type:'風',power:82,kind:'attack'},{name:'林間閃避',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'誓約・瞄準',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'oa_nightingale',name:'提燈天使・南丁格爾',universe:'oath',clan:'modern',type:'水',defType:'水',hp:780,ability:{name:'克里米亞天使',effect:'revive'},moves:[{name:'誓約・提燈',type:'水',power:80,kind:'attack'},{name:'白衣之盾',type:'防禦',power:0,defense:0.24,kind:'guard'},{name:'誓約・療護',type:'特技',power:0,effect:'heal',kind:'skill'}]},
  {id:'oa_turing',name:'密碼破譯・艾倫圖靈',universe:'oath',clan:'modern',type:'無',defType:'無',hp:760,ability:{name:'看穿密碼',effect:'zero_system'},moves:[{name:'誓約・解碼',type:'無',power:84,kind:'attack'},{name:'邏輯屏障',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'誓約・破譯',type:'特技',power:0,effect:'blind',kind:'skill'}]},
  {id:'oa_curie',name:'鐳光之母・瑪麗居禮',universe:'oath',clan:'modern',type:'雷',defType:'雷',hp:660,ability:{name:'實驗紀錄',effect:'seed_mode'},moves:[{name:'誓約・微光',type:'雷',power:74,kind:'attack'},{name:'鉛板防護',type:'防禦',power:0,defense:0.46,kind:'guard'},{name:'誓約・提純',type:'特技',power:0,effect:'charge',kind:'skill'}],forms:['oa_curie_rad','oa_curie_beam']},
  {id:'oa_curie_beam',name:'鐳射聚焦・瑪麗居禮',universe:'oath',clan:'modern',type:'雷',defType:'雷',hp:760,isUpgrade:true,ability:{name:'精準測定',effect:'zero_system'},moves:[{name:'誓約・鐳射聚焦',type:'雷',power:86,kind:'attack'},{name:'觀測遮罩',type:'防禦',power:0,defense:0.34,kind:'guard'},{name:'誓約・校準',type:'特技',power:0,effect:'focus',kind:'skill'}]},
  {id:'oa_curie_rad',name:'放射解放・瑪麗居禮',universe:'oath',clan:'modern',type:'雷',defType:'雷',hp:800,isUpgrade:true,ability:{name:'居禮輻射',effect:'last_burst'},moves:[{name:'誓約・鐳光解放',type:'雷',power:96,kind:'attack'},{name:'輻射擴散',type:'雷',power:70,kind:'aoe'},{name:'誓約・臨界',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  /* ══ 亂世 ══ */
  {id:'sg_nobunaga',name:'尾張大傻瓜・織田信長',universe:'sengoku',clan:'jsengoku',type:'火',defType:'火',hp:700,ability:{name:'桶狹間',effect:'blitz'},moves:[{name:'天下布武・第一陣',type:'火',power:76,kind:'attack'},{name:'傻瓜的從容',type:'防禦',power:0,defense:0.44,kind:'guard'},{name:'火繩備戰',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'sg_nobunaga_demon'},
  {id:'sg_nobunaga_demon',name:'第六天魔王・織田信長',universe:'sengoku',clan:'jsengoku',type:'火',defType:'火',hp:860,isUpgrade:true,ability:{name:'第六天魔王',effect:'overdrive'},moves:[{name:'天下布武・焦土',type:'火',power:98,kind:'attack'},{name:'比叡山燒討',type:'火',power:74,kind:'aoe'},{name:'三段擊',type:'特技',power:0,effect:'atk_up',kind:'skill'}]},
  {id:'sg_shingen',name:'甲斐之虎・武田信玄',universe:'sengoku',clan:'jsengoku',type:'風',defType:'風',hp:800,ability:{name:'甲斐之虎',effect:'endure'},moves:[{name:'風林火山・侵掠如火',type:'風',power:84,kind:'attack'},{name:'赤備突擊',type:'風',power:62,kind:'aoe'},{name:'不動如山',type:'防禦',power:0,defense:0.26,kind:'guard'}]},
  {id:'sg_kenshin',name:'越後之龍・上杉謙信',universe:'sengoku',clan:'jsengoku',type:'光',defType:'光',hp:780,ability:{name:'毘沙門天降臨',effect:'fortress'},moves:[{name:'毘沙門天・車懸',type:'光',power:80,kind:'attack'},{name:'毘之旗',type:'防禦',power:0,defense:0.24,kind:'guard'},{name:'軍神加護',type:'特技',power:0,effect:'def_up',kind:'skill'}]},
  {id:'sg_masamune',name:'獨眼龍・伊達政宗',universe:'sengoku',clan:'jsengoku',type:'雷',defType:'雷',hp:700,ability:{name:'獨眼龍',effect:'execute'},moves:[{name:'竹雀・迅雷',type:'雷',power:86,kind:'attack'},{name:'三日月斬',type:'雷',power:78,kind:'attack2'},{name:'隻眼之勘',type:'防禦',power:0,defense:0.34,kind:'guard'}]},
  {id:'sg_yukimura',name:'日本第一兵・真田幸村',universe:'sengoku',clan:'jsengoku',type:'火',defType:'火',hp:690,ability:{name:'日本第一兵',effect:'last_burst'},moves:[{name:'六文錢・赤備',type:'火',power:88,kind:'attack'},{name:'真田丸',type:'防禦',power:0,defense:0.32,kind:'guard'},{name:'決死覺悟',type:'特技',power:0,effect:'atk_up',kind:'skill'}]},
  {id:'sg_hideyoshi',name:'猴子・豐臣秀吉',universe:'sengoku',clan:'jsengoku',type:'土',defType:'土',hp:540,moves:[{name:'草履之志',type:'土',power:60,kind:'attack'},{name:'低頭陪笑',type:'防禦',power:0,defense:0.55,kind:'guard'},{name:'察言觀色',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'sg_hideyoshi_2'},
  {id:'sg_hideyoshi_2',name:'武將・豐臣秀吉',universe:'sengoku',clan:'jsengoku',type:'土',defType:'土',hp:760,isUpgrade:true,ability:{name:'中國大返還',effect:'purge'},moves:[{name:'一夜城',type:'土',power:80,kind:'attack'},{name:'墨俁之壁',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'人心收攬',type:'特技',power:0,effect:'atk_up',kind:'skill'}],upgradeTo:'sg_hideyoshi_3'},
  {id:'sg_hideyoshi_3',name:'關白・豐臣秀吉',universe:'sengoku',clan:'jsengoku',type:'土',defType:'土',hp:1000,isUpgrade:true,ability:{name:'關白宣下',effect:'retaliate'},moves:[{name:'天下人・惣無事令',type:'土',power:98,kind:'attack'},{name:'太閤檢地',type:'土',power:74,kind:'aoe'},{name:'大坂城',type:'防禦',power:0,defense:0.28,kind:'guard'}]},
  {id:'sg_ieyasu',name:'東照大權現・德川家康',universe:'sengoku',clan:'jsengoku',type:'無',defType:'無',hp:700,ability:{name:'三河武士',effect:'revive'},moves:[{name:'厭離穢土・忍',type:'無',power:72,kind:'attack'},{name:'三方原之恥',type:'防禦',power:0,defense:0.46,kind:'guard'},{name:'隱忍蓄力',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'sg_ieyasu_shogun'},
  {id:'sg_ieyasu_shogun',name:'天下人・德川家康',universe:'sengoku',clan:'jsengoku',type:'無',defType:'無',hp:900,isUpgrade:true,ability:{name:'二百年太平',effect:'seed_mode'},moves:[{name:'欣求淨土・大御所',type:'無',power:92,kind:'attack'},{name:'大坂之陣',type:'無',power:68,kind:'aoe'},{name:'江戶城',type:'防禦',power:0,defense:0.24,kind:'guard'}]},
  {id:'sg_mitsuhide',name:'三日天下・明智光秀',universe:'sengoku',clan:'jsengoku',type:'冥',defType:'冥',hp:700,ability:{name:'敵在本能寺',effect:'nemesis'},nemesisOf:'sengoku',moves:[{name:'桔梗紋・逆心',type:'冥',power:82,kind:'attack'},{name:'明智之慎',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'本能寺之算',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  /* ══ 逐鹿 ══ */
  {id:'zl_baiqi',name:'人屠・白起',universe:'zhulu',clan:'cwarring',type:'冥',defType:'冥',hp:700,ability:{name:'人屠之名',effect:'execute'},moves:[{name:'策・武安君至',type:'冥',power:88,kind:'attack'},{name:'策・長平大破',type:'冥',power:66,kind:'aoe'},{name:'策・按兵不動',type:'防禦',power:0,defense:0.34,kind:'guard'}]},
  {id:'zl_lianpo',name:'負荊請罪・廉頗',universe:'zhulu',clan:'cwarring',type:'土',defType:'土',hp:820,ability:{name:'廉頗未老',effect:'endure'},moves:[{name:'策・老當益壯',type:'土',power:82,kind:'attack'},{name:'策・堅壁不出',type:'防禦',power:0,defense:0.24,kind:'guard'},{name:'策・尚能飯否',type:'特技',power:0,effect:'regen',kind:'skill'}]},
  {id:'zl_zhangyi',name:'縱橫之舌・張儀',universe:'zhulu',clan:'cwarring',type:'光',defType:'光',hp:700,ability:{name:'三寸之舌',effect:'lucky_star'},moves:[{name:'策・以利誘之',type:'光',power:74,kind:'attack'},{name:'策・巧言令色',type:'防禦',power:0,defense:0.42,kind:'guard'},{name:'策・離間其君',type:'特技',power:0,effect:'blind',kind:'skill'}],forms:['zl_zhangyi_zong','zl_zhangyi_heng']},
  {id:'zl_zhangyi_zong',name:'合縱・張儀',universe:'zhulu',clan:'cwarring',type:'光',defType:'光',hp:800,isUpgrade:true,ability:{name:'合而為一',effect:'revive'},moves:[{name:'策・六國從親',type:'光',power:86,kind:'attack'},{name:'策・五國伐秦',type:'光',power:64,kind:'aoe'},{name:'策・盟書為證',type:'防禦',power:0,defense:0.32,kind:'guard'}]},
  {id:'zl_zhangyi_heng',name:'連橫・張儀',universe:'zhulu',clan:'cwarring',type:'光',defType:'光',hp:760,isUpgrade:true,ability:{name:'逐一擊破',effect:'overdrive'},moves:[{name:'策・散六國之從',type:'光',power:94,kind:'attack'},{name:'策・各個擊破',type:'防禦',power:0,defense:0.44,kind:'guard'},{name:'策・分而化之',type:'特技',power:0,effect:'weaken',kind:'skill'}]},
  {id:'zl_jingke',name:'易水寒歌・荊軻',universe:'zhulu',clan:'cwarring',type:'火',defType:'火',hp:660,ability:{name:'風蕭蕭兮',effect:'seed_mode'},moves:[{name:'策・袖中藏鋒',type:'火',power:74,kind:'attack'},{name:'策・從容不迫',type:'防禦',power:0,defense:0.46,kind:'guard'},{name:'策・藏鋒待發',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'zl_jingke_dagger'},
  {id:'zl_jingke_dagger',name:'圖窮匕見・荊軻',universe:'zhulu',clan:'cwarring',type:'火',defType:'火',hp:700,isUpgrade:true,ability:{name:'壯士不還',effect:'last_burst'},moves:[{name:'策・圖窮而匕見',type:'火',power:104,kind:'attack'},{name:'策・風蕭蕭兮',type:'特技',power:0,effect:'crit_up',kind:'skill'},{name:'策・環柱而走',type:'火',power:70,kind:'aoe'}]},
  {id:'zl_xiangyu',name:'西楚霸王・項羽',universe:'zhulu',clan:'chuhan',type:'火',defType:'火',hp:720,ability:{name:'一夫當關',effect:'blitz'},moves:[{name:'計・破釜沉舟',type:'火',power:76,kind:'attack'},{name:'計・喑噁叱吒',type:'防禦',power:0,defense:0.42,kind:'guard'},{name:'計・力拔山兮',type:'特技',power:0,effect:'atk_up',kind:'skill'}],upgradeTo:'zl_xiangyu_gaixia'},
  {id:'zl_xiangyu_gaixia',name:'垓下絕唱・項羽',universe:'zhulu',clan:'chuhan',type:'火',defType:'火',hp:880,isUpgrade:true,ability:{name:'無顏見江東',effect:'overdrive'},moves:[{name:'計・虞兮虞兮',type:'火',power:102,kind:'attack'},{name:'計・潰圍斬將',type:'火',power:76,kind:'aoe'},{name:'計・拔劍四顧',type:'特技',power:0,effect:'atk_up',kind:'skill'}]},
  {id:'zl_hanxin',name:'淮陰少年・韓信',universe:'zhulu',clan:'chuhan',type:'雷',defType:'雷',hp:540,moves:[{name:'計・俯出胯下',type:'雷',power:58,kind:'attack'},{name:'計・忍而不校',type:'防禦',power:0,defense:0.58,kind:'guard'},{name:'計・熟視良久',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'zl_hanxin_2'},
  {id:'zl_hanxin_2',name:'執戟郎・韓信',universe:'zhulu',clan:'chuhan',type:'雷',defType:'雷',hp:740,isUpgrade:true,ability:{name:'登壇拜將',effect:'zero_system'},moves:[{name:'計・明修棧道',type:'雷',power:80,kind:'attack'},{name:'計・持戟宿衛',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'計・暗度陳倉',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'zl_hanxin_3'},
  {id:'zl_hanxin_3',name:'兵仙・韓信',universe:'zhulu',clan:'chuhan',type:'雷',defType:'雷',hp:1000,isUpgrade:true,ability:{name:'多多益善',effect:'trans_am'},moves:[{name:'計・背水為陣',type:'雷',power:100,kind:'attack'},{name:'計・十面埋伏',type:'雷',power:74,kind:'aoe'},{name:'計・井陘之口',type:'防禦',power:0,defense:0.28,kind:'guard'}]},
  {id:'zl_zhangliang',name:'博浪飛椎・張良',universe:'zhulu',clan:'chuhan',type:'土',defType:'土',hp:550,moves:[{name:'計・博浪飛椎',type:'土',power:64,kind:'attack'},{name:'計・亡命下邳',type:'防禦',power:0,defense:0.56,kind:'guard'},{name:'計・伏於道左',type:'特技',power:0,effect:'evade_up',kind:'skill'}],upgradeTo:'zl_zhangliang_2'},
  {id:'zl_zhangliang_2',name:'圯上受書・張良',universe:'zhulu',clan:'chuhan',type:'土',defType:'土',hp:760,isUpgrade:true,ability:{name:'圯上老人',effect:'purge'},moves:[{name:'計・太公兵法',type:'土',power:80,kind:'attack'},{name:'計・納履圯下',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'計・孺子可教',type:'特技',power:0,effect:'crit_up',kind:'skill'}],upgradeTo:'zl_zhangliang_3'},
  {id:'zl_zhangliang_3',name:'帝者之師・張良',universe:'zhulu',clan:'chuhan',type:'光',defType:'光',hp:980,isUpgrade:true,ability:{name:'帝者之師',effect:'lucky_star'},moves:[{name:'計・運籌帷幄',type:'光',power:96,kind:'attack'},{name:'計・決勝千里',type:'光',power:72,kind:'aoe'},{name:'計・明哲保身',type:'防禦',power:0,defense:0.3,kind:'guard'}]},
  {id:'zl_xiaohe',name:'鎮國之柱・蕭何',universe:'zhulu',clan:'chuhan',type:'土',defType:'土',hp:820,ability:{name:'蕭何月下',effect:'revive'},moves:[{name:'計・鎮國撫百姓',type:'土',power:80,kind:'attack'},{name:'計・轉漕給饋',type:'土',power:60,kind:'aoe'},{name:'計・關中為本',type:'防禦',power:0,defense:0.26,kind:'guard'}]},
  {id:'zl_liubang',name:'泗水亭長・劉邦',universe:'zhulu',clan:'chuhan',type:'無',defType:'無',hp:560,moves:[{name:'計・提三尺劍',type:'無',power:60,kind:'attack'},{name:'計・脫身獨去',type:'防禦',power:0,defense:0.54,kind:'guard'},{name:'計・結交豪傑',type:'特技',power:0,effect:'heal',kind:'skill'}],upgradeTo:'zl_liubang_2'},
  {id:'zl_liubang_2',name:'沛公・劉邦',universe:'zhulu',clan:'chuhan',type:'無',defType:'無',hp:780,isUpgrade:true,ability:{name:'先入關中',effect:'seed_mode'},moves:[{name:'計・約法三章',type:'無',power:80,kind:'attack'},{name:'計・鴻門謝罪',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'計・善將將',type:'特技',power:0,effect:'atk_up',kind:'skill'}],upgradeTo:'zl_liubang_3'},
  {id:'zl_liubang_3',name:'漢高祖・劉邦',universe:'zhulu',clan:'chuhan',type:'無',defType:'無',hp:1020,isUpgrade:true,ability:{name:'大風起兮',effect:'fortress'},moves:[{name:'計・大風起兮',type:'無',power:96,kind:'attack'},{name:'計・威加海內',type:'無',power:72,kind:'aoe'},{name:'計・未央之基',type:'防禦',power:0,defense:0.26,kind:'guard'}]},
  {id:'zl_fanzeng',name:'亞父之謀・范增',universe:'zhulu',clan:'chuhan',type:'冥',defType:'冥',hp:760,ability:{name:'豎子不足與謀',effect:'nemesis'},nemesisOf:'zhulu',moves:[{name:'計・鴻門舉玦',type:'冥',power:78,kind:'attack'},{name:'計・亞父之諫',type:'防禦',power:0,defense:0.24,kind:'guard'},{name:'計・數目項王',type:'特技',power:0,effect:'weaken',kind:'skill'}]},
  {id:'zl_lvbu',name:'飛將・呂布',universe:'zhulu',clan:'sanguo',type:'火',defType:'火',hp:720,ability:{name:'人中呂布',effect:'jackpot'},moves:[{name:'略・飛將無雙',type:'火',power:78,kind:'attack'},{name:'略・虓虎之勇',type:'防禦',power:0,defense:0.42,kind:'guard'},{name:'略・勒馬按戟',type:'特技',power:0,effect:'charge',kind:'skill'}],forms:['zl_lvbu_ji','zl_lvbu_horse','zl_lvbu_bow']},
  {id:'zl_lvbu_ji',name:'方天畫戟・呂布',universe:'zhulu',clan:'sanguo',type:'火',defType:'火',hp:860,isUpgrade:true,ability:{name:'無雙亂舞',effect:'last_burst'},moves:[{name:'略・戟破三軍',type:'火',power:100,kind:'attack'},{name:'略・轅門射戟',type:'火',power:74,kind:'aoe'},{name:'略・戟舞如輪',type:'防禦',power:0,defense:0.4,kind:'guard'}]},
  {id:'zl_lvbu_horse',name:'赤兔・呂布',universe:'zhulu',clan:'sanguo',type:'火',defType:'火',hp:780,isUpgrade:true,ability:{name:'馬中赤兔',effect:'blitz'},moves:[{name:'略・赤兔踏陣',type:'火',power:92,kind:'attack'},{name:'略・馬上盤旋',type:'防禦',power:0,defense:0.38,kind:'guard'},{name:'略・一日千里',type:'特技',power:0,effect:'focus',kind:'skill'}]},
  {id:'zl_lvbu_bow',name:'強弓・呂布',universe:'zhulu',clan:'sanguo',type:'火',defType:'火',hp:760,isUpgrade:true,ability:{name:'百步穿楊',effect:'jackpot'},moves:[{name:'略・引弓而發',type:'火',power:94,kind:'attack'},{name:'略・引弓自守',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'略・矢無虛發',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'zl_guanyu',name:'美髯公・關羽',universe:'zhulu',clan:'sanguo',type:'土',defType:'土',hp:700,ability:{name:'溫酒斬華雄',effect:'execute'},moves:[{name:'略・拖刀而回',type:'土',power:74,kind:'attack'},{name:'略・忠義為盾',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'略・刮骨療毒',type:'特技',power:0,effect:'regen',kind:'skill'}],forms:['zl_guanyu_horse','zl_guanyu_blade']},
  {id:'zl_guanyu_blade',name:'青龍偃月・關羽',universe:'zhulu',clan:'sanguo',type:'土',defType:'土',hp:860,isUpgrade:true,ability:{name:'刀鋒所指',effect:'overdrive'},moves:[{name:'略・青龍出海',type:'土',power:96,kind:'attack'},{name:'略・橫刀立馬',type:'防禦',power:0,defense:0.36,kind:'guard'},{name:'略・溫酒未冷',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'zl_guanyu_horse',name:'赤兔千里・關羽',universe:'zhulu',clan:'sanguo',type:'土',defType:'土',hp:900,isUpgrade:true,ability:{name:'千里走單騎',effect:'fortress'},moves:[{name:'略・過關斬將',type:'土',power:92,kind:'attack'},{name:'略・水淹七軍',type:'土',power:70,kind:'aoe'},{name:'略・青龍橫刀',type:'防禦',power:0,defense:0.24,kind:'guard'}]},
  {id:'zl_zhaoyun',name:'常山之膽・趙雲',universe:'zhulu',clan:'sanguo',type:'風',defType:'風',hp:700,ability:{name:'一身是膽',effect:'blitz'},moves:[{name:'略・七進七出',type:'風',power:86,kind:'attack'},{name:'略・龍膽亮銀',type:'風',power:78,kind:'attack2'},{name:'略・懷主而戰',type:'防禦',power:0,defense:0.32,kind:'guard'}]},
  {id:'zl_zhugeliang',name:'臥龍・諸葛亮',universe:'zhulu',clan:'sanguo',type:'無',defType:'無',hp:560,moves:[{name:'略・隆中之對',type:'無',power:62,kind:'attack'},{name:'略・躬耕南陽',type:'防禦',power:0,defense:0.54,kind:'guard'},{name:'略・夜觀天象',type:'特技',power:0,effect:'crit_up',kind:'skill'}],upgradeTo:'zl_zhugeliang_2'},
  {id:'zl_zhugeliang_2',name:'羽扇綸巾・諸葛亮',universe:'zhulu',clan:'sanguo',type:'無',defType:'無',hp:780,isUpgrade:true,ability:{name:'舌戰群儒',effect:'purge'},moves:[{name:'略・草船借箭',type:'無',power:80,kind:'attack'},{name:'略・空城撫琴',type:'防禦',power:0,defense:0.36,kind:'guard'},{name:'略・借得東風',type:'特技',power:0,effect:'atk_up',kind:'skill'}],upgradeTo:'zl_zhugeliang_3'},
  {id:'zl_zhugeliang_3',name:'八陣圖・諸葛亮',universe:'zhulu',clan:'sanguo',type:'無',defType:'無',hp:1000,isUpgrade:true,ability:{name:'出師未捷',effect:'revive'},moves:[{name:'略・八陣圖成',type:'無',power:96,kind:'attack'},{name:'略・木牛流馬',type:'無',power:72,kind:'aoe'},{name:'略・石兵八陣',type:'防禦',power:0,defense:0.26,kind:'guard'}]},
  {id:'zl_zhouyu',name:'美周郎・周瑜',universe:'zhulu',clan:'sanguo',type:'水',defType:'水',hp:700,ability:{name:'曲有誤周郎顧',effect:'lucky_star'},moves:[{name:'略・火燒赤壁',type:'水',power:84,kind:'attack'},{name:'略・談笑自若',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'略・連環之計',type:'特技',power:0,effect:'blind',kind:'skill'}]},
  {id:'zl_simayi',name:'冢虎・司馬懿',universe:'zhulu',clan:'sanguo',type:'冥',defType:'冥',hp:780,ability:{name:'死諸葛走生仲達',effect:'zero_system'},moves:[{name:'略・鷹視狼顧',type:'冥',power:80,kind:'attack'},{name:'略・堅壁不戰',type:'防禦',power:0,defense:0.22,kind:'guard'},{name:'略・以逸待勞',type:'特技',power:0,effect:'weaken',kind:'skill'}]},
  /* ══ 梁山 ══ */
  {id:'sh_lu',name:'花和尚・魯智深',universe:'shuihu',clan:'shuihu',type:'土',defType:'土',hp:780,ability:{name:'不屈禪心',effect:'endure'},moves:[{name:'禪杖心法・第三重・倒卷簾',type:'土',power:84,kind:'attack'},{name:'倒拔垂楊柳',type:'土',power:62,kind:'aoe'},{name:'金剛樁',type:'防禦',power:0,defense:0.24,kind:'guard'}]},
  {id:'sh_lin',name:'豹子頭・林沖',universe:'shuihu',clan:'shuihu',type:'風',defType:'風',hp:700,ability:{name:'忍氣吞聲',effect:'purge'},moves:[{name:'槍法心法・第三重・寒潭影',type:'風',power:72,kind:'attack'},{name:'禁軍樁',type:'防禦',power:0,defense:0.34,kind:'guard'},{name:'調息・忍',type:'特技',power:0,effect:'def_up',kind:'skill'}],upgradeTo:'sh_lin_snow'},
  {id:'sh_lin_snow',name:'雪夜上梁山・林沖',universe:'shuihu',clan:'shuihu',type:'風',defType:'風',hp:820,isUpgrade:true,ability:{name:'逼上梁山',effect:'retaliate'},moves:[{name:'槍法心法・第七重・風雪迴',type:'風',power:96,kind:'attack'},{name:'山神廟烈火',type:'風',power:70,kind:'aoe'},{name:'調息・破',type:'特技',power:0,effect:'atk_up',kind:'skill'}]},
  {id:'sh_wu',name:'行者・武松',universe:'shuihu',clan:'shuihu',type:'火',defType:'火',hp:640,ability:{name:'三碗不過崗',effect:'blitz'},moves:[{name:'拳法心法・第四重・醉臥崗',type:'火',power:76,kind:'attack'},{name:'醉樁',type:'防禦',power:0,defense:0.52,kind:'guard'},{name:'調息・酒勁',type:'特技',power:0,effect:'charge',kind:'skill'}],forms:['sh_wu_blade','sh_wu_drunk']},
  {id:'sh_wu_drunk',name:'醉拳・武松',universe:'shuihu',clan:'shuihu',type:'火',defType:'火',hp:780,isUpgrade:true,ability:{name:'醉裡乾坤',effect:'lucky_star'},moves:[{name:'醉拳心法・第八重・踉蹌步',type:'火',power:88,kind:'attack'},{name:'踉蹌樁',type:'防禦',power:0,defense:0.38,kind:'guard'},{name:'調息・醉意',type:'特技',power:0,effect:'evade_up',kind:'skill'}]},
  {id:'sh_wu_blade',name:'雙戒刀・武松',universe:'shuihu',clan:'shuihu',type:'火',defType:'火',hp:800,isUpgrade:true,ability:{name:'醉打蔣門神',effect:'last_burst'},moves:[{name:'戒刀心法・第八重・雙月落',type:'火',power:94,kind:'attack'},{name:'血濺鴛鴦樓',type:'火',power:68,kind:'aoe'},{name:'行者樁',type:'防禦',power:0,defense:0.46,kind:'guard'}]},
  {id:'sh_li',name:'黑旋風・李逵',universe:'shuihu',clan:'shuihu',type:'冥',defType:'冥',hp:660,ability:{name:'殺得性起',effect:'jackpot'},moves:[{name:'板斧心法・第二重・開山手',type:'冥',power:78,kind:'attack'},{name:'莽樁',type:'防禦',power:0,defense:0.58,kind:'guard'},{name:'調息・怒',type:'特技',power:0,effect:'atk_up',kind:'skill'}],upgradeTo:'sh_li_rage'},
  {id:'sh_li_rage',name:'板斧狂化・李逵',universe:'shuihu',clan:'shuihu',type:'冥',defType:'冥',hp:900,isUpgrade:true,ability:{name:'不管不顧',effect:'overdrive'},moves:[{name:'雙斧心法・第九重・旋風怒',type:'冥',power:100,kind:'attack'},{name:'江州劫法場',type:'冥',power:72,kind:'aoe'},{name:'調息・狂',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'sh_wuyong',name:'智多星・吳用',universe:'shuihu',clan:'shuihu',type:'無',defType:'無',hp:720,ability:{name:'智珠在握',effect:'lucky_star'},moves:[{name:'智略心法・第五重・連環算',type:'無',power:82,kind:'attack'},{name:'羽扇樁',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'調息・料敵',type:'特技',power:0,effect:'blind',kind:'skill'}]},
  {id:'sh_dai',name:'神行太保・戴宗',universe:'shuihu',clan:'shuihu',type:'雷',defType:'雷',hp:700,ability:{name:'日行八百',effect:'execute'},moves:[{name:'神行心法・第六重・踏雲步',type:'雷',power:86,kind:'attack'},{name:'甲馬疾走',type:'雷',power:78,kind:'attack2'},{name:'疾風樁',type:'防禦',power:0,defense:0.36,kind:'guard'}]},
  {id:'sh_song',name:'鄆城押司・宋江',universe:'shuihu',clan:'shuihu',type:'光',defType:'光',hp:540,moves:[{name:'文書心法・第一重・執筆立',type:'光',power:60,kind:'attack'},{name:'押司樁',type:'防禦',power:0,defense:0.55,kind:'guard'},{name:'調息・周旋',type:'特技',power:0,effect:'heal',kind:'skill'}],upgradeTo:'sh_song_rain'},
  {id:'sh_song_rain',name:'及時雨・宋江',universe:'shuihu',clan:'shuihu',type:'光',defType:'光',hp:760,isUpgrade:true,ability:{name:'及時雨',effect:'revive'},moves:[{name:'仗義心法・第四重・散千金',type:'光',power:80,kind:'attack'},{name:'義樁',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'調息・散財',type:'特技',power:0,effect:'heal',kind:'skill'}],upgradeTo:'sh_song_lord'},
  {id:'sh_song_lord',name:'梁山之主・宋江',universe:'shuihu',clan:'shuihu',type:'光',defType:'光',hp:1000,isUpgrade:true,ability:{name:'替天行道',effect:'fortress'},moves:[{name:'替天行道・第十重・聚義旗',type:'光',power:98,kind:'attack'},{name:'聚義廳・百八星',type:'光',power:74,kind:'aoe'},{name:'忠義樁',type:'防禦',power:0,defense:0.3,kind:'guard'}]},
  /* ══ 學府 ══ */
  {id:'mj_moyan',name:'筆走龍蛇・墨言',universe:'major',clan:'humanities',type:'光',defType:'光',hp:560,moves:[{name:'必修・文字學',type:'光',power:62,kind:'attack'},{name:'引經據典',type:'防禦',power:0,defense:0.54,kind:'guard'},{name:'選修・修辭',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'mj_moyan_2'},
  {id:'mj_moyan_2',name:'引經據典・墨言',universe:'major',clan:'humanities',type:'光',defType:'光',hp:780,isUpgrade:true,ability:{name:'畢業專題・旁徵博引',effect:'purge'},moves:[{name:'必修・聲韻學',type:'光',power:80,kind:'attack'},{name:'論證之盾',type:'防禦',power:0,defense:0.38,kind:'guard'},{name:'選修・訓詁',type:'特技',power:0,effect:'crit_up',kind:'skill'}],upgradeTo:'mj_moyan_3'},
  {id:'mj_moyan_3',name:'一字千金・墨言',universe:'major',clan:'humanities',type:'光',defType:'光',hp:1000,isUpgrade:true,ability:{name:'畢業專題・一字定音',effect:'lucky_star'},moves:[{name:'必修・一字千金',type:'光',power:96,kind:'attack'},{name:'詩詞歌賦・全文默寫',type:'光',power:72,kind:'aoe'},{name:'文氣護體',type:'防禦',power:0,defense:0.28,kind:'guard'}]},
  {id:'mj_aili',name:'通譯萬邦・艾莉',universe:'major',clan:'humanities',type:'風',defType:'風',hp:680,ability:{name:'畢業專題・臨場反應',effect:'blitz'},moves:[{name:'必修・口說',type:'風',power:74,kind:'attack'},{name:'語境迴避',type:'防禦',power:0,defense:0.44,kind:'guard'},{name:'選修・聽力',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'mj_aili_sim'},
  {id:'mj_aili_sim',name:'同步口譯・艾莉',universe:'major',clan:'humanities',type:'風',defType:'風',hp:820,isUpgrade:true,ability:{name:'畢業專題・零時差',effect:'trans_am'},moves:[{name:'必修・同步口譯',type:'風',power:94,kind:'attack'},{name:'多語齊發',type:'風',power:68,kind:'aoe'},{name:'譯者之盾',type:'防禦',power:0,defense:0.36,kind:'guard'}]},
  {id:'mj_shike',name:'博古通今・史珂',universe:'major',clan:'humanities',type:'無',defType:'無',hp:820,ability:{name:'畢業專題・以史為鑑',effect:'endure'},moves:[{name:'必修・史料考證',type:'無',power:82,kind:'attack'},{name:'通史概論',type:'無',power:60,kind:'aoe'},{name:'史觀之壁',type:'防禦',power:0,defense:0.26,kind:'guard'}]},
  {id:'mj_xuansi',name:'叩問不休・玄思',universe:'major',clan:'humanities',type:'冥',defType:'冥',hp:700,ability:{name:'畢業專題・你怎麼知道',effect:'lucky_star'},moves:[{name:'必修・邏輯',type:'冥',power:82,kind:'attack'},{name:'懸置判斷',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'選修・詰問',type:'特技',power:0,effect:'blind',kind:'skill'}]},
  {id:'mj_lvming',name:'明鏡高懸・律明',universe:'major',clan:'humanities',type:'土',defType:'土',hp:560,moves:[{name:'必修・法學緒論',type:'土',power:60,kind:'attack'},{name:'程序保障',type:'防禦',power:0,defense:0.55,kind:'guard'},{name:'選修・舉證',type:'特技',power:0,effect:'def_up',kind:'skill'}],upgradeTo:'mj_lvming_2'},
  {id:'mj_lvming_2',name:'法庭辯士・律明',universe:'major',clan:'humanities',type:'土',defType:'土',hp:780,isUpgrade:true,ability:{name:'畢業專題・異議成立',effect:'retaliate'},moves:[{name:'必修・交互詰問',type:'土',power:78,kind:'attack'},{name:'無罪推定',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'選修・異議',type:'特技',power:0,effect:'weaken',kind:'skill'}],upgradeTo:'mj_lvming_3'},
  {id:'mj_lvming_3',name:'一槌定音・律明',universe:'major',clan:'humanities',type:'土',defType:'土',hp:1000,isUpgrade:true,ability:{name:'畢業專題・判決確定',effect:'fortress'},moves:[{name:'必修・終局判決',type:'土',power:94,kind:'attack'},{name:'集體訴訟',type:'土',power:70,kind:'aoe'},{name:'法槌落下',type:'防禦',power:0,defense:0.2,kind:'guard'}]},
  {id:'mj_jingwei',name:'運籌帷幄・經緯',universe:'major',clan:'humanities',type:'水',defType:'水',hp:700,ability:{name:'畢業專題・槓桿全開',effect:'overdrive'},moves:[{name:'必修・財報分析',type:'水',power:88,kind:'attack'},{name:'風險對沖',type:'防禦',power:0,defense:0.34,kind:'guard'},{name:'選修・成本控制',type:'特技',power:0,effect:'atk_up',kind:'skill'}]},
  {id:'mj_ama',name:'一鍵自動・阿碼',universe:'major',clan:'science',type:'無',defType:'無',hp:560,moves:[{name:'必修・程式設計',type:'無',power:62,kind:'attack'},{name:'例外處理',type:'防禦',power:0,defense:0.54,kind:'guard'},{name:'選修・除錯',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'mj_ama_2'},
  {id:'mj_ama_2',name:'全端工程・阿碼',universe:'major',clan:'science',type:'無',defType:'無',hp:760,isUpgrade:true,ability:{name:'畢業專題・自動化',effect:'blitz'},moves:[{name:'必修・演算法',type:'無',power:80,kind:'attack'},{name:'防火牆',type:'防禦',power:0,defense:0.38,kind:'guard'},{name:'選修・重構',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'mj_ama_3'},
  {id:'mj_ama_3',name:'系統架構・阿碼',universe:'major',clan:'science',type:'無',defType:'無',hp:980,isUpgrade:true,ability:{name:'畢業專題・全自動部署',effect:'trans_am'},moves:[{name:'必修・分散式系統',type:'無',power:96,kind:'attack'},{name:'批次處理',type:'無',power:72,kind:'aoe'},{name:'容錯機制',type:'防禦',power:0,defense:0.28,kind:'guard'}]},
  {id:'mj_dianguang',name:'萬伏之心・電光',universe:'major',clan:'science',type:'雷',defType:'雷',hp:690,ability:{name:'畢業專題・滿載輸出',effect:'overdrive'},moves:[{name:'必修・電路學',type:'雷',power:88,kind:'attack'},{name:'選修・脈衝放電',type:'雷',power:78,kind:'attack2'},{name:'絕緣護具',type:'防禦',power:0,defense:0.34,kind:'guard'}]},
  {id:'mj_gangchi',name:'鋼骨之軀・鋼齒',universe:'major',clan:'science',type:'土',defType:'土',hp:700,ability:{name:'畢業專題・安全係數',effect:'endure'},moves:[{name:'必修・材料力學',type:'土',power:74,kind:'attack'},{name:'結構補強',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'選修・應力分析',type:'特技',power:0,effect:'regen',kind:'skill'}],upgradeTo:'mj_gangchi_exo'},
  {id:'mj_gangchi_exo',name:'動力外骨骼・鋼齒',universe:'major',clan:'science',type:'土',defType:'土',hp:900,isUpgrade:true,ability:{name:'畢業專題・動力全開',effect:'fortress'},moves:[{name:'必修・液壓重擊',type:'土',power:92,kind:'attack'},{name:'全機動輾壓',type:'土',power:70,kind:'aoe'},{name:'外骨骼裝甲',type:'防禦',power:0,defense:0.22,kind:'guard'}]},
  {id:'mj_ouji',name:'算無遺策・歐幾',universe:'major',clan:'science',type:'光',defType:'光',hp:700,ability:{name:'畢業專題・大數法則',effect:'jackpot'},moves:[{name:'必修・機率論',type:'光',power:82,kind:'attack'},{name:'反證迴避',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'選修・期望值',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'mj_renxin',name:'妙手回春・仁心',universe:'major',clan:'science',type:'水',defType:'水',hp:560,moves:[{name:'必修・解剖學',type:'水',power:60,kind:'attack'},{name:'無菌隔離',type:'防禦',power:0,defense:0.55,kind:'guard'},{name:'選修・止血',type:'特技',power:0,effect:'heal',kind:'skill'}],upgradeTo:'mj_renxin_2'},
  {id:'mj_renxin_2',name:'主治醫師・仁心',universe:'major',clan:'science',type:'水',defType:'水',hp:800,isUpgrade:true,ability:{name:'畢業專題・黃金一小時',effect:'revive'},moves:[{name:'必修・臨床診斷',type:'水',power:78,kind:'attack'},{name:'加護病房',type:'防禦',power:0,defense:0.28,kind:'guard'},{name:'選修・急救',type:'特技',power:0,effect:'heal',kind:'skill'}],upgradeTo:'mj_renxin_3'},
  {id:'mj_renxin_3',name:'華佗再世・仁心',universe:'major',clan:'science',type:'水',defType:'水',hp:1000,isUpgrade:true,ability:{name:'畢業專題・起死回生',effect:'revive'},moves:[{name:'必修・外科手術',type:'水',power:92,kind:'attack'},{name:'群體防疫',type:'水',power:68,kind:'aoe'},{name:'生命維持',type:'防禦',power:0,defense:0.2,kind:'guard'}]},
  {id:'mj_maomao',name:'貓中神醫・毛毛',universe:'major',clan:'science',type:'火',defType:'火',hp:760,ability:{name:'畢業專題・全隊照護',effect:'purge'},moves:[{name:'必修・動物行為學',type:'火',power:84,kind:'attack'},{name:'保定術',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'選修・全體驅蟲',type:'特技',power:0,effect:'heal',kind:'skill'}]},
  /* ══ 淺山 ══ */
  {id:'wd_leopard',name:'雲紋獵手・雲豹',universe:'wild',clan:'wild',type:'火',defType:'火',hp:550,moves:[{name:'本能・撲擊',type:'火',power:62,kind:'attack'},{name:'樹冠隱蔽',type:'防禦',power:0,defense:0.52,kind:'guard'},{name:'本能・潛伏',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'wd_leopard_2'},
  {id:'wd_leopard_2',name:'台灣雲豹',universe:'wild',clan:'wild',type:'火',defType:'火',hp:780,isUpgrade:true,ability:{name:'淺山獵手',effect:'blitz'},moves:[{name:'野性・雲紋撕裂',type:'火',power:84,kind:'attack'},{name:'枝上迴避',type:'防禦',power:0,defense:0.42,kind:'guard'},{name:'野性・蓄勢',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'wd_leopard_3'},
  {id:'wd_leopard_3',name:'雲紋焰豹',universe:'wild',clan:'wild',type:'火',defType:'火',hp:980,isUpgrade:true,ability:{name:'森林之王',effect:'overdrive'},moves:[{name:'霸者・焚雲爪',type:'火',power:100,kind:'attack'},{name:'林間烈焰',type:'火',power:74,kind:'aoe'},{name:'焰紋護體',type:'防禦',power:0,defense:0.3,kind:'guard'}]},
  {id:'wd_cat',name:'淺山幽影・石虎',universe:'wild',clan:'wild',type:'無',defType:'無',hp:540,moves:[{name:'本能・突襲',type:'無',power:60,kind:'attack'},{name:'草叢潛行',type:'防禦',power:0,defense:0.54,kind:'guard'},{name:'本能・警戒',type:'特技',power:0,effect:'evade_up',kind:'skill'}],upgradeTo:'wd_cat_2'},
  {id:'wd_cat_2',name:'台灣石虎',universe:'wild',clan:'wild',type:'無',defType:'無',hp:740,isUpgrade:true,ability:{name:'天敵直覺',effect:'alaya_vijnana'},moves:[{name:'野性・幽影爪',type:'無',power:82,kind:'attack'},{name:'夜間迴避',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'野性・疾走',type:'特技',power:0,effect:'focus',kind:'skill'}],upgradeTo:'wd_cat_3'},
  {id:'wd_cat_3',name:'淺山之王',universe:'wild',clan:'wild',type:'無',defType:'無',hp:940,isUpgrade:true,ability:{name:'你看不見我',effect:'lucky_star'},moves:[{name:'霸者・無聲一擊',type:'無',power:96,kind:'attack'},{name:'領域巡狩',type:'無',power:70,kind:'aoe'},{name:'影遁',type:'防禦',power:0,defense:0.3,kind:'guard'}]},
  {id:'wd_salmon',name:'溯溪之王・櫻鮭',universe:'wild',clan:'wild',type:'水',defType:'水',hp:560,moves:[{name:'本能・擺尾',type:'水',power:60,kind:'attack'},{name:'順流',type:'防禦',power:0,defense:0.55,kind:'guard'},{name:'本能・迴游',type:'特技',power:0,effect:'regen',kind:'skill'}],upgradeTo:'wd_salmon_2'},
  {id:'wd_salmon_2',name:'櫻花鉤吻鮭',universe:'wild',clan:'wild',type:'水',defType:'水',hp:780,isUpgrade:true,ability:{name:'冰河孑遺',effect:'endure'},moves:[{name:'野性・逆流衝刺',type:'水',power:80,kind:'attack'},{name:'冷泉護體',type:'防禦',power:0,defense:0.38,kind:'guard'},{name:'野性・耐寒',type:'特技',power:0,effect:'heal',kind:'skill'}],upgradeTo:'wd_salmon_3'},
  {id:'wd_salmon_3',name:'溯源鮭王',universe:'wild',clan:'wild',type:'水',defType:'水',hp:1000,isUpgrade:true,ability:{name:'生命回歸',effect:'revive'},moves:[{name:'霸者・溯源',type:'水',power:94,kind:'attack'},{name:'千魚逆流',type:'水',power:70,kind:'aoe'},{name:'源頭之淵',type:'防禦',power:0,defense:0.26,kind:'guard'}]},
  {id:'wd_magpie',name:'長尾靈禽・藍鵲',universe:'wild',clan:'wild',type:'風',defType:'風',hp:540,moves:[{name:'本能・啄擊',type:'風',power:62,kind:'attack'},{name:'枝間跳躍',type:'防禦',power:0,defense:0.52,kind:'guard'},{name:'本能・鳴警',type:'特技',power:0,effect:'blind',kind:'skill'}],upgradeTo:'wd_magpie_2'},
  {id:'wd_magpie_2',name:'台灣藍鵲',universe:'wild',clan:'wild',type:'風',defType:'風',hp:720,isUpgrade:true,ability:{name:'家族共禦',effect:'purge'},moves:[{name:'野性・長尾旋擊',type:'風',power:82,kind:'attack'},{name:'群飛掩護',type:'防禦',power:0,defense:0.4,kind:'guard'},{name:'野性・銳鳴',type:'特技',power:0,effect:'crit_up',kind:'skill'}],upgradeTo:'wd_magpie_3'},
  {id:'wd_magpie_3',name:'長尾風鵲',universe:'wild',clan:'wild',type:'風',defType:'風',hp:920,isUpgrade:true,ability:{name:'長尾好運',effect:'jackpot'},moves:[{name:'霸者・風尾斬',type:'風',power:96,kind:'attack'},{name:'長尾陣風',type:'風',power:70,kind:'aoe'},{name:'風羽迴旋',type:'防禦',power:0,defense:0.3,kind:'guard'}]},
  {id:'wd_bear',name:'白月胸紋・黑熊',universe:'wild',clan:'wild',type:'光',defType:'光',hp:600,moves:[{name:'本能・熊掌',type:'光',power:62,kind:'attack'},{name:'縮成一團',type:'防禦',power:0,defense:0.5,kind:'guard'},{name:'本能・進食',type:'特技',power:0,effect:'heal',kind:'skill'}],upgradeTo:'wd_bear_2'},
  {id:'wd_bear_2',name:'台灣黑熊',universe:'wild',clan:'wild',type:'光',defType:'光',hp:840,isUpgrade:true,ability:{name:'山林霸主',effect:'fortress'},moves:[{name:'野性・撲抓',type:'光',power:82,kind:'attack'},{name:'厚毛皮',type:'防禦',power:0,defense:0.32,kind:'guard'},{name:'野性・威嚇',type:'特技',power:0,effect:'weaken',kind:'skill'}],upgradeTo:'wd_bear_3'},
  {id:'wd_bear_3',name:'白月胸熊',universe:'wild',clan:'wild',type:'光',defType:'光',hp:1050,isUpgrade:true,ability:{name:'白月加護',effect:'retaliate'},moves:[{name:'霸者・月輪一擊',type:'光',power:94,kind:'attack'},{name:'撼山吼',type:'光',power:70,kind:'aoe'},{name:'白月護體',type:'防禦',power:0,defense:0.22,kind:'guard'}]},
  {id:'wd_pangolin',name:'捲甲護身・穿山甲',universe:'wild',clan:'wild',type:'土',defType:'土',hp:700,ability:{name:'鱗甲護身',effect:'endure'},moves:[{name:'本能・掘擊',type:'土',power:72,kind:'attack'},{name:'捲成一球',type:'防禦',power:0,defense:0.32,kind:'guard'},{name:'本能・穴居',type:'特技',power:0,effect:'def_up',kind:'skill'}],upgradeTo:'wd_pangolin_2'},
  {id:'wd_pangolin_2',name:'磐岩甲獸',universe:'wild',clan:'wild',type:'土',defType:'土',hp:880,isUpgrade:true,ability:{name:'絕對防禦',effect:'fortress'},moves:[{name:'霸者・裂甲爪',type:'土',power:90,kind:'attack'},{name:'大地翻掘',type:'土',power:66,kind:'aoe'},{name:'磐岩之殼',type:'防禦',power:0,defense:0.18,kind:'guard'}]},
  {id:'wd_owl',name:'夜巡之眼・領角鴞',universe:'wild',clan:'wild',type:'冥',defType:'冥',hp:680,ability:{name:'夜之眼',effect:'alaya_vijnana'},moves:[{name:'本能・無聲撲擊',type:'冥',power:74,kind:'attack'},{name:'樹皮擬態',type:'防禦',power:0,defense:0.42,kind:'guard'},{name:'本能・夜視',type:'特技',power:0,effect:'crit_up',kind:'skill'}],upgradeTo:'wd_owl_2'},
  {id:'wd_owl_2',name:'夜幕冥鴞',universe:'wild',clan:'wild',type:'冥',defType:'冥',hp:820,isUpgrade:true,ability:{name:'暗夜降臨',effect:'jackpot'},moves:[{name:'霸者・冥夜爪',type:'冥',power:94,kind:'attack'},{name:'暗夜之瞳',type:'冥',power:68,kind:'aoe'},{name:'幽羽',type:'防禦',power:0,defense:0.34,kind:'guard'}]},
  {id:'wd_squirrel',name:'御風滑翔・鼯鼠',universe:'wild',clan:'wild',type:'雷',defType:'雷',hp:660,ability:{name:'滑翔疾襲',effect:'blitz'},moves:[{name:'本能・滑翔撲擊',type:'雷',power:74,kind:'attack'},{name:'樹洞躲避',type:'防禦',power:0,defense:0.44,kind:'guard'},{name:'本能・助跑',type:'特技',power:0,effect:'charge',kind:'skill'}],upgradeTo:'wd_squirrel_2'},
  {id:'wd_squirrel_2',name:'疾雷飛鼯',universe:'wild',clan:'wild',type:'雷',defType:'雷',hp:800,isUpgrade:true,ability:{name:'疾如迅雷',effect:'trans_am'},moves:[{name:'霸者・雷閃滑翔',type:'雷',power:96,kind:'attack'},{name:'林冠疾掠',type:'雷',power:70,kind:'aoe'},{name:'風膜',type:'防禦',power:0,defense:0.36,kind:'guard'}]},

  /* ══ 🐾 解鎖貓（七隻）══
     每個陣營一隻，用該陣營的角色打贏一場就會解鎖。
     整體強度約為一般角色的 112%，代價是：不能進化、也不能合體。
     clan 設為 'cat' 且全部 secret:true，所以 pickAlly() 永遠找不到夥伴。 */
  {id:'cat_myth',name:'神殿白貓・涅菲',universe:'myth',clan:'cat',type:'光',defType:'光',hp:930,secret:true,ability:{name:'神殿的午睡',effect:'revive'},moves:[{name:'神諭・白光爪',type:'光',power:89,kind:'attack'},{name:'聖壇臥姿',type:'防禦',power:0,defense:0.22,kind:'guard'},{name:'神諭・靜聽',type:'特技',power:0,effect:'heal',kind:'skill'}]},
  {id:'cat_oath',name:'圓桌灰貓・卡洛',universe:'oath',clan:'cat',type:'無',defType:'無',hp:1000,secret:true,ability:{name:'無名騎士',effect:'fortress'},moves:[{name:'誓約・爪痕',type:'無',power:79,kind:'attack'},{name:'圓桌下的座位',type:'防禦',power:0,defense:0.14,kind:'guard'},{name:'誓約・磨爪',type:'特技',power:0,effect:'def_up',kind:'skill'}]},
  {id:'cat_sengoku',name:'城下三花・阿市',universe:'sengoku',clan:'cat',type:'火',defType:'火',hp:710,secret:true,ability:{name:'天守閣的主人',effect:'overdrive'},moves:[{name:'城下・撲擊',type:'火',power:89,kind:'attack'},{name:'城下・回身抓',type:'火',power:82,kind:'attack2'},{name:'瓦上疾走',type:'防禦',power:0,defense:0.44,kind:'guard'}]},
  {id:'cat_zhulu',name:'墨玉黑貓・玄離',universe:'zhulu',clan:'cat',type:'冥',defType:'冥',hp:820,secret:true,ability:{name:'書房的第三隻眼',effect:'lucky_star'},moves:[{name:'墨玉・無聲一擊',type:'冥',power:89,kind:'attack'},{name:'硯台後的陰影',type:'防禦',power:0,defense:0.18,kind:'guard'},{name:'墨玉・凝視',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'cat_shuihu',name:'酒肆虎斑・大郎',universe:'shuihu',clan:'cat',type:'土',defType:'土',hp:780,secret:true,ability:{name:'賒帳的老主顧',effect:'endure'},moves:[{name:'酒肆・肉墊重擊',type:'土',power:89,kind:'attack'},{name:'酒肆・掀桌',type:'土',power:72,kind:'aoe'},{name:'酒缸旁的位置',type:'防禦',power:0,defense:0.42,kind:'guard'}]},
  {id:'cat_major',name:'圖書館貓・卷卷',universe:'major',clan:'cat',type:'雷',defType:'雷',hp:720,secret:true,ability:{name:'永遠的旁聽生',effect:'blitz'},moves:[{name:'必修・書頁疾風',type:'雷',power:89,kind:'attack'},{name:'選修・書架穿梭',type:'雷',power:82,kind:'attack2'},{name:'書堆裡的縫隙',type:'防禦',power:0,defense:0.18,kind:'guard'}]},
  {id:'cat_wild',name:'山徑石紋・阿淺',universe:'wild',clan:'cat',type:'風',defType:'風',hp:700,secret:true,ability:{name:'淺山的常客',effect:'jackpot'},moves:[{name:'淺山・風爪',type:'風',power:89,kind:'attack'},{name:'淺山・掃尾',type:'風',power:72,kind:'aoe'},{name:'石縫貼伏',type:'防禦',power:0,defense:0.44,kind:'guard'}]},

  /* ══ 特殊 ══ */
  {id:'sp_quewue',name:'闕闕',universe:'special',clan:'secret',type:'？？？',defType:'超能力',hp:750,secret:true,ability:{name:'直接解題',effect:'auto_solve'},moves:[{name:'隨便啦！',type:'超能力',power:83,kind:'aoe',accFixed:100},{name:'就是這樣喵～',type:'防禦',power:0,defense:0.1,kind:'guard'},{name:'要多久！！！',type:'特技',power:0,effect:'blind',kind:'skill'}]},
  {id:'sp_nanshan',name:'南山豹',universe:'special',clan:'special',type:'火',defType:'火',hp:720,ability:{name:'一舉登科',effect:'jackpot'},moves:[{name:'一舉登科・撲',type:'火',power:84,kind:'attack'},{name:'豹紋護身',type:'防禦',power:0,defense:0.3,kind:'guard'},{name:'考運加持',type:'特技',power:0,effect:'crit_up',kind:'skill'}]},
  {id:'sp_maomao',name:'貓貓',universe:'special',clan:'special',type:'光',defType:'光',hp:760,ability:{name:'全部塗掉',effect:'purge'},moves:[{name:'修正液一抹',type:'光',power:78,kind:'attack'},{name:'塗掉就沒事了',type:'防禦',power:0,defense:0.24,kind:'guard'},{name:'全部重寫',type:'特技',power:0,effect:'heal',kind:'skill'}]},
];
/* ============================================================================
   角色定位（能力值型態）
   ── atk 攻擊倍率／hp 血量倍率／def 防禦招式減傷再乘（越小越硬）
   ── crit 額外會心率／eva 閃避率／acc 命中修正
   ========================================================================== */
const ROLE_ORDER = ['attacker','guard','tank','lucky','swift','balance'];
const ROLES = {
  attacker:{name:'攻擊型', icon:'⚔️', color:'#ef4469', atk:1.18, hp:0.92, def:1.00, crit:0.03, eva:0.00, acc:0,  desc:'傷害最高，但血量偏薄，答錯一題就很傷。'},
  guard   :{name:'防禦型', icon:'🛡️', color:'#1f8fe5', atk:0.85, hp:1.05, def:0.65, crit:0.00, eva:0.05, acc:3,  desc:'防禦減傷再強化，反擊機率額外 +20%。'},
  tank    :{name:'耐久型', icon:'🧱', color:'#a8730c', atk:0.90, hp:1.28, def:0.90, crit:0.00, eva:0.00, acc:5,  desc:'血量最厚，答題失常時最耐得住。'},
  lucky   :{name:'幸運型', icon:'🍀', color:'#12a97c', atk:0.95, hp:0.95, def:1.00, crit:0.14, eva:0.18, acc:0,  desc:'高會心、高閃避，數字起伏最大的賭徒。'},
  swift   :{name:'速攻型', icon:'⚡', color:'#f0780f', atk:1.00, hp:0.90, def:1.00, crit:0.06, eva:0.10, acc:8,  desc:'命中率高又偶爾閃避，輸出最穩定。'},
  balance :{name:'均衡型', icon:'⚖️', color:'#6f6a99', atk:1.00, hp:1.00, def:1.00, crit:0.00, eva:0.03, acc:0,  desc:'各項平均，最好上手。'}
};

/* 每位角色的定位；想調整直接改這張表 */
const ROLE_BY_ID = {
  /* 神域 */
  my_zeus:'attacker', my_zeus_bolt:'attacker', my_athena:'guard', my_athena_aegis:'guard',
  my_poseidon:'tank', my_thor:'attacker', my_loki:'lucky', my_fenrir:'swift',
  my_fenrir_free:'swift', my_seraph:'attacker', my_seraph_open:'attacker', my_seraph_shield:'guard', my_cherub:'tank',
  my_dominion:'balance',
  /* 誓約 */
  oa_arthur:'balance', oa_arthur_2:'balance', oa_arthur_3:'attacker', oa_lancelot:'attacker',
  oa_robin:'lucky', oa_nightingale:'guard', oa_turing:'balance', oa_curie:'swift', oa_curie_beam:'lucky',
  oa_curie_rad:'attacker',
  /* 亂世 */
  sg_nobunaga:'attacker', sg_nobunaga_demon:'attacker', sg_shingen:'tank', sg_kenshin:'guard',
  sg_masamune:'swift', sg_yukimura:'attacker', sg_hideyoshi:'balance', sg_hideyoshi_2:'balance',
  sg_hideyoshi_3:'tank', sg_ieyasu:'tank', sg_ieyasu_shogun:'tank', sg_mitsuhide:'lucky',
  /* 逐鹿 */
  zl_baiqi:'attacker', zl_lianpo:'tank', zl_zhangyi:'lucky', zl_zhangyi_zong:'balance',
  zl_zhangyi_heng:'attacker', zl_jingke:'swift', zl_jingke_dagger:'attacker', zl_xiangyu:'attacker',
  zl_xiangyu_gaixia:'attacker', zl_hanxin:'swift', zl_hanxin_2:'swift', zl_hanxin_3:'swift',
  zl_zhangliang:'attacker', zl_zhangliang_2:'balance', zl_zhangliang_3:'lucky', zl_xiaohe:'tank',
  zl_liubang:'balance', zl_liubang_2:'balance', zl_liubang_3:'tank', zl_fanzeng:'guard',
  zl_lvbu:'attacker', zl_lvbu_ji:'attacker', zl_lvbu_horse:'swift', zl_lvbu_bow:'lucky',
  zl_guanyu:'tank', zl_guanyu_horse:'tank', zl_guanyu_blade:'attacker', zl_zhaoyun:'swift', zl_zhugeliang:'balance',
  zl_zhugeliang_2:'balance', zl_zhugeliang_3:'balance', zl_zhouyu:'lucky', zl_simayi:'guard',
  /* 梁山 */
  sh_lu:'tank', sh_lin:'guard', sh_lin_snow:'attacker', sh_wu:'attacker', sh_wu_drunk:'lucky',
  sh_wu_blade:'attacker', sh_li:'attacker', sh_li_rage:'attacker', sh_wuyong:'lucky',
  sh_dai:'swift', sh_song:'guard', sh_song_rain:'balance', sh_song_lord:'balance',
  /* 學府 */
  mj_moyan:'balance', mj_moyan_2:'balance', mj_moyan_3:'lucky', mj_aili:'swift',
  mj_aili_sim:'swift', mj_shike:'tank', mj_xuansi:'lucky', mj_lvming:'guard',
  mj_lvming_2:'guard', mj_lvming_3:'guard', mj_jingwei:'attacker', mj_ama:'swift',
  mj_ama_2:'swift', mj_ama_3:'swift', mj_dianguang:'attacker', mj_gangchi:'tank',
  mj_gangchi_exo:'tank', mj_ouji:'lucky', mj_renxin:'guard', mj_renxin_2:'guard',
  mj_renxin_3:'guard', mj_maomao:'balance',
  /* 淺山 */
  wd_leopard:'attacker', wd_leopard_2:'attacker', wd_leopard_3:'attacker', wd_cat:'swift',
  wd_cat_2:'swift', wd_cat_3:'swift', wd_salmon:'balance', wd_salmon_2:'balance',
  wd_salmon_3:'balance', wd_magpie:'lucky', wd_magpie_2:'lucky', wd_magpie_3:'lucky',
  wd_bear:'tank', wd_bear_2:'tank', wd_bear_3:'tank', wd_pangolin:'guard',
  wd_pangolin_2:'guard', wd_owl:'lucky', wd_owl_2:'lucky', wd_squirrel:'swift',
  wd_squirrel_2:'swift',
  /* 特殊 */
  sp_quewue:'balance',
  /* 解鎖貓 */
  cat_myth:'balance', cat_oath:'guard', cat_sengoku:'attacker', cat_zhulu:'lucky', cat_shuihu:'tank', cat_major:'swift', cat_wild:'attacker', sp_nanshan:'lucky', sp_maomao:'guard',
};
/* 總戰力：把血量、攻擊、命中、防禦、會心、閃避折算成一個數字，方便橫向比較 */
function battlePower(c){
  const r = roleOf(c);
  const hp   = (c.hp || 700) * 0.62;
  const am   = mainAtk(c) || {power:0, acc:100};
  const atk  = (am.power || 0) * r.atk * (am.acc / 100) * 15.5;
  const def  = (1 - guardVal(c)) * 370;
  const extra = Math.max(0, movesOf(c,'atk').length - 1) * 70;
  const luck = (r.crit * 400) + (r.eva * 500) + (r.acc * 4);
  const ab   = c.ability ? 120 : 0;
  const evo  = (c.upgradeTo || c.forms) ? 90 : 0;
  const aoe  = movesOf(c,'aoe').length ? 60 : 0;
  return Math.round(hp + atk + def + luck + ab + evo + extra + aoe);
}
function roleOf(c){ return ROLES[(c && c.role) || 'balance'] || ROLES.balance; }

/* 招式種類：attack 單體攻擊｜aoe 群體攻擊｜guard 防禦｜skill 特技
   角色不一定三種都有（例如善逸只有攻擊招），以下取用一律經過這些函式 */
function isAtkKind(k){ return k === 'attack' || k === 'aoe' || k === 'attack2' || k === 'attack3'; }
function movesOf(c, kind){
  if(!c || !c.moves) return [];
  if(kind === 'atk') return c.moves.filter(function(m){ return isAtkKind(m.kind); });
  return c.moves.filter(function(m){ return m.kind === kind; });
}
function mainAtk(c){ return movesOf(c,'atk')[0] || (c.moves && c.moves[0]); }
function mainGuard(c){ return movesOf(c,'guard')[0] || null; }
function mainSkill(c){ return movesOf(c,'skill')[0] || null; }
function guardVal(c){ const g = mainGuard(c); return g ? g.defense : 0.55; }
function kindLabel(m){
  return m.kind === 'guard' ? '防禦' : m.kind === 'skill' ? '特技'
       : m.kind === 'aoe'   ? '群攻' : '攻擊';
}

/* ============================================================================
   圖片替換表
   ── 想換掉任何角色的圖，把網址填在這裡就好，不用去動上面的角色資料
   ── 沒有網址（或網址失效）的角色會自動顯示對應顏色的替代卡
   ========================================================================== */
/* ── 角色小傳與招式典故 ────────────────────────────────────────────
   選完角色、按下開始戰鬥之前，會顯示在「今日狀態」旁邊。
   bio   : 角色小傳。第一段是生平典故，第二段（縮排那段）說明遊戲設定的由來。
           用 \n 換行。
   moves : 招式名稱 → 典故說明。key 必須和 moves 裡的招式名完全一致。
   兩者都可以只寫其中一項；整個角色沒寫就不顯示這一區。
   ────────────────────────────────────────────────────────────── */
const CHARACTER_LORE = {

  /* ══ ⚡ 神域 ══ */
  my_zeus: {
    bio:'奧林帕斯的眾神之王。以雷霆推翻父親克洛諾斯，抽籤得了天空，從此坐上神界的頂端。他既是秩序的維護者，也是最常違背秩序的人；既立誓保護誓約與賓客，自己卻總在人間留下一段又一段的風流。希臘人並不把他寫成完人——正因為他有缺點，才更像掌管人世的那個神。\n　　所以他是雷屬性的攻擊型。特色能力「弒父之雷」讓他此後攻擊 ×1.2、命中 +10——推翻克洛諾斯那一擊，是他一生所有力量的起點。連對 3 題即可換乘為「雷霆權杖・宙斯」：神王的權柄，本來就要靠實績來證明。',
    moves:{
      '雷霆神域':'手擲雷霆是宙斯最原始的形象。荷馬稱他「集雲者」，雷聲一響，眾神噤聲。',
      '神王之威':'神王不必動手。單是那一眼，就足以讓提坦與人類同時低頭。',
      '積雨蓄勢':'烏雲聚攏是落雷的前兆。他從不急著出手，因為天空從來不必趕時間。',
    }},
  my_athena: {
    bio:'從宙斯的頭顱中全副武裝誕生的女神。她掌管的不是殺戮，而是「有智慧的戰爭」——同樣是戰神，阿瑞斯代表血氣與混亂，雅典娜代表謀略與紀律。她與波賽頓爭奪雅典的守護權，波賽頓劈出海泉，她種下一株橄欖，市民選了橄欖：那代表和平與豐收，比海水更值得擁有。\n　　所以她是光屬性的防禦型。特色能力「灰眼凝視」解除自身所有負面狀態並回血——謀略的本質，就是把不利的局面先扳回原點。換乘條件是「體力保持在高檔」：她不打消耗戰，她要在最好的狀態下拿出埃癸斯。',
    moves:{
      '智慧神域':'她的武器是頭腦。開戰之前，勝負往往已經決定。',
      '橄欖之盾':'那株贏得雅典的橄欖樹。象徵和平的東西，也可以是最堅固的防線。',
      '戰術洞察':'灰眼女神的目光能穿透陣勢，看見對手真正的破綻。',
    }},
  my_poseidon: {
    bio:'宙斯的兄長，抽籤得了海洋。手持三叉戟，一擊能裂開大地、掀起海嘯，也能讓風平浪靜。希臘人既依賴海洋也畏懼海洋，於是把他寫得喜怒無常——他曾為雅典守護權之爭記恨，也曾因兒子被刺瞎而追著奧德修斯漂流十年。海不講道理，這就是海。\n　　所以他是水屬性的耐久型，血最厚、防禦最硬。他不進化，因為海不需要變成別的東西。特色能力「撼地一擊」直接削去對手兩百點體力，無視一切減傷——三叉戟頓地的時候，沒有人擋得住。',
    moves:{
      '怒濤神域':'三叉戟一頓，海面隆起如山。船隻在他面前，從來沒有還手的餘地。',
      '大海嘯':'整片海一起壓過來。這一擊不挑對象，範圍之內無人倖免。',
      '深淵之壁':'萬丈海水本身就是牆。越往下潛，壓力越大，你根本靠不近。',
    }},
  my_thor: {
    bio:'北歐的雷神，奧丁之子。他不是最聰明的神，卻是最可靠的那一個：巨人來犯，眾神第一個想到的永遠是他。武器妙爾尼爾是矮人打造的短柄鎚，擲出去必定命中，而且會自己飛回手中。諸神黃昏時他與耶夢加得同歸於盡——擊殺巨蟒後走了九步，倒在毒液裡。\n　　所以他是雷屬性的攻擊型，而且有兩招攻擊。他不進化——妙爾尼爾從第一天就是完成品，不需要再升級。特色能力「雷神狂怒」三回合內攻擊 ×1.6，是全遊戲最單純也最好用的爆發。',
    moves:{
      '符文・妙爾尼爾':'擲出必中，且會飛回。矮人趕工時被牛虻咬了一口，柄才短了一截。',
      '符文・雷擊回旋':'鎚子在半空迴轉再擊。他從不需要瞄準第二次。',
      '巨人剋星':'約頓海姆的巨人聽到雷聲就會退開。這個名聲，是他一鎚一鎚打出來的。',
    }},
  my_loki: {
    bio:'血緣上是巨人，卻與奧丁結為血兄弟。他是眾神最好用也最危險的工具：神器多半靠他的詭計弄來，災禍也多半由他而起。他能變形為母馬、鮭魚、蒼蠅，最後因設計害死光明神巴德爾而被囚禁。諸神黃昏時他掙脫鎖鏈，率領亡者的船隊反攻——他一直都站在那一邊。\n　　所以他是冥屬性的幸運型：高會心、高閃避，起伏最大。特色能力「詐術之神」三回合會心 +40%、閃避 +20%——用他就是在賭，而他一向賭得比別人大。他不進化，因為他從頭到尾都沒有真面目。',
    moves:{
      '符文・謊言之刃':'他從不說假話，只是把真話排成讓你誤會的順序。',
      '變形迴避':'母馬、鮭魚、蒼蠅、老婦。你打中的，未必是他。',
      '符文・惑心':'他曾讓瞎眼的霍德爾親手射出那支槲寄生。動手的不是他，主意是他出的。',
    }},
  my_fenrir: {
    bio:'洛基之子，命中註定要吞噬奧丁的巨狼。眾神眼看牠日漸長大，先後用兩道鐵鏈試探，都被牠掙斷。第三次矮人以貓的腳步聲、女人的鬍鬚、山的根等六樣「不存在之物」織成細如絲帶的格萊普尼爾，牠起疑，要求有神把手放進牠嘴裡作保——提爾伸出了右手。\n　　所以牠是風屬性的速攻型。特色能力「噬神之誓」是宿敵：對上神域陣營時傷害 ×1.5、受創 ×0.7——牠生來就是為了咬斷那些神的喉嚨。換乘條件是「累積受創」：鎖鏈勒得越緊，掙脫的力氣越大。',
    moves:{
      '符文・裂爪':'被鎖著的野獸，爪子反而磨得更利。',
      '低伏戒備':'牠不撲上來，只是壓低身子看著。等的是鎖鏈鬆動的那一刻。',
      '符文・蓄勢':'從被縛的第一天起，牠就一直在等。時間站在牠這邊。',
    }},
  my_seraph: {
    bio:'天使九階中的最高階。「熾天使」的字根意為「燃燒者」，《以賽亞書》記載他們有六翼：兩翼遮臉、兩翼遮腳、兩翼飛翔，日夜不停地呼喊「聖哉、聖哉、聖哉」。他們不執行審判，只負責在至高者的座前燃燒——那火焰不分善惡，靠近的一切都會被淨化。\n　　所以牠是火屬性的攻擊型。特色能力「燔祭」本次攻擊必定會心且傷害再 ×2。連續三題全對後可自由切換兩種形態：「六翼展開」全力焚燒，「聖盾」則六翼合攏轉為防禦型——同一位天使，收與放兩種姿態。',
    moves:{
      '聖階・熾焰':'那火不為傷害而燒。它只是靠近了，於是一切雜質都不見了。',
      '六翼環抱':'兩翼遮臉、兩翼遮腳、兩翼飛翔。收攏之時，就是最堅固的殼。',
      '聖階・煉淨':'先燒盡自己的雜質，才有資格燒別人的。',
    }},
  my_cherub: {
    bio:'天使九階的第二階，中譯「智天使」。《以西結書》寫他們有四張臉——人、獅、牛、鷹，前後左右同時朝向四方，身上布滿眼睛，行走時「不必轉身」。伊甸園東邊那把四面轉動的火焰劍，就是由他們把守。與後世畫作裡的小天使不同，原典裡的他們是令人生畏的。\n　　所以牠是土屬性的耐久型，還帶一招群體攻擊——四面之瞳同時看著四個方向，攻擊自然也不必挑對象。特色能力「不動座天」三回合減傷並持續回血。牠不進化：神座的抬轎者，本來就不該移動。',
    moves:{
      '聖階・四方之瞳':'四張臉朝著四個方向。你沒有辦法繞到牠背後，牠沒有背後。',
      '全知注視':'渾身都是眼睛。整個戰場同時落在牠的視線裡。',
      '智慧之座':'牠們是神座的抬轎者。座下之物，不會動搖。',
    }},
  my_dominion: {
    bio:'天使九階的第四階，掌管神權的執行與分配。他們不直接干預人間，而是把命令傳達給下級天使，確保秩序不被打亂——手持權杖或印璽，象徵「授權」而非「力量」本身。在整個階級體系裡，他們是最像行政官的一群：不衝在最前面，卻決定了誰該做什麼。\n　　所以牠是無屬性的均衡型——不剋任何屬性，也不被任何屬性剋，正好對應「秩序」這個概念。特色能力「神權執行」直接造成對手最大體力 18% 的傷害，不受任何減傷影響：被授予的權限，不容打折。',
    moves:{
      '聖階・權柄':'不是他的力量，是他被授予的力量。差別在於，後者不會用完。',
      '秩序之環':'越界的東西會被推回原位。這不是攻擊，是修正。',
      '聖階・裁定':'裁定一下，對手的權限就被削去一截。',
    }},

  /* ══ 🛡️ 誓約 ══ */
  oa_arthur: {
    bio:'拔出石中劍之前，他只是養父家中一個負責替兄長擦劍的少年。比武大會上蘭斯洛特忘了帶劍，他就近拔了插在石中的那一把——石上刻著「拔出此劍者，即為全英格蘭之王」。他自己都不相信。傳說裡最動人的從來不是他多強，而是他一開始有多不夠格。\n　　所以他是全陣營最弱的起手：血最少、威力最低，連特色能力都沒有。但他是三階角色——第 6 題後成為「石中劍・亞瑟王」，此後再連對 3 題即化為「王者之劍・亞瑟王」，定位從均衡型轉為攻擊型，血量翻近一倍。從擦劍的少年到全英格蘭之王，這段距離要靠你答出來。',
    moves:{
      '誓約・拔劍':'他只是想幫兄長找一把劍。歷史常常從這種小事開始。',
      '少年之盾':'還撐不住太多。但他一次也沒有把盾放下。',
      '誓約・靜心':'他深吸一口氣。手在抖，眼神沒有。',
    }},
  oa_lancelot: {
    bio:'圓桌武力第一的騎士，由湖中仙女撫養長大，故稱「湖上騎士」。他幾乎完美：最強、最忠、最有禮。唯一的裂縫是他愛上了王后桂妮薇兒——正是這段感情讓圓桌分裂、讓亞瑟的王國崩解。傳說特意讓最強的人敗給最人性的弱點，這是它最深的地方。\n　　所以他是土屬性的攻擊型，而且有兩招攻擊——圓桌第一的劍術，不需要花招。特色能力「圓桌第一」三回合攻擊 ×1.6。他不進化，因為他從登場就已經是巔峰；傳說裡他要輸的也從來不是武藝。',
    moves:{
      '誓約・湖光劍':'劍身映著湖水。那是他被撫養長大的地方，也是他唯一的家。',
      '誓約・突刺':'圓桌第一的劍術。一百場比武，只輸過自己。',
      '騎士之禮':'他向對手行禮才動手。這不是客套，是他僅存的體面。',
    }},
  oa_robin: {
    bio:'雪伍德森林的綠衣神射手。傳說裡他是被剝奪爵位的貴族，也可能只是個平民；版本很多，核心只有一句話——劫富濟貧。他的箭術在英國民謠中被寫成能射中八百步外的柳枝，甚至能一箭劈開先前射中靶心的那支箭。\n　　所以他是風屬性的幸運型。特色能力「一箭穿心」本次攻擊必定會心、傷害再 ×2——他的箭只要射出去，就沒有落空的道理。他不進化：綠林裡的自由人，沒有什麼身分好升級的。',
    moves:{
      '誓約・綠林箭':'一箭劈開靶心上先前那支箭。這種事他做過不只一次。',
      '林間閃避':'雪伍德的每一棵樹他都認得。在這裡，他不會被找到。',
      '誓約・瞄準':'拉滿，屏息。他從不倉促放箭。',
    }},
  oa_nightingale: {
    bio:'克里米亞戰爭時，英軍傷兵的死因大多不是槍傷，而是感染。她帶著護士團進駐野戰醫院，清洗、通風、分區、記錄，把死亡率從四成二降到二分。她夜裡提燈巡房，士兵稱她「提燈天使」。她也是統計圖表的先驅——用一張「玫瑰圖」說服了英國國會改革軍醫制度。\n　　所以她是水屬性的防禦型，防禦招硬度全陣營前列。特色能力「克里米亞天使」立刻回復最大體力的三成。她不進化，也沒有攻擊型的爆發——她的價值從來不是打倒誰，是讓自己人活下來。',
    moves:{
      '誓約・提燈':'她整夜提著燈巡房。傷兵記得的不是治療，是那盞燈。',
      '白衣之盾':'洗手、通風、分區。最不起眼的三件事，救的人最多。',
      '誓約・療護':'她說傷患不分敵我。俄軍的傷兵，她也一樣照顧。',
    }},
  oa_turing: {
    bio:'英國數學家，現代電腦科學的奠基者之一。二戰期間在布萊切利園主持破譯工作，設計出可以窮舉德軍 Enigma 密碼設定的機器，據估縮短戰爭達兩年以上。他更早提出的「圖靈機」模型，定義了什麼叫做「可計算」——今天所有的電腦都活在那個定義裡。\n　　所以他是無屬性的均衡型。特色能力「看穿密碼」讓此後攻擊 ×1.2、命中 +10，而且效果持續整場不會消失——一旦破譯成功，優勢就再也回不去了。他的特技是降低對手命中：知道對方在想什麼，本身就是一種防禦。',
    moves:{
      '誓約・解碼':'他不猜密碼。他讓機器把所有不可能的排除掉，剩下的就是答案。',
      '邏輯屏障':'凡是能被證明為假的，就進不來。',
      '誓約・破譯':'找到一句必定出現的話，整套密碼就從那裡裂開。',
    }},
  oa_curie: {
    bio:'從數噸瀝青鈾礦中提煉出十分之一克的鐳，靠的是四年不間斷的攪拌與結晶。她是第一位獲得諾貝爾獎的女性，也是唯一在兩個不同科學領域各得一次的人。她拒絕為鐳申請專利，說科學屬於全人類。她的實驗筆記至今仍有放射性，存放在鉛盒裡，要簽切結書才能翻閱。\n　　所以她是雷屬性的速攻型。特色能力「實驗紀錄」本回合無視屬性抗性且必定命中——數據不受立場影響。第四題後可自由切換兩種形態：「放射解放」轉為攻擊型放手一搏，「鐳射聚焦」則走精準路線。她真實的人生，也正是在這兩者之間。',
    moves:{
      '誓約・微光':'黑暗中那一點藍綠色的光。她第一次看見時，在棚屋裡坐了整夜。',
      '鉛板防護':'她那個年代還不知道要防護。這面鉛板，是後人替她補上的。',
      '誓約・提純':'數噸礦渣，換十分之一克。她攪了四年。',
    }},

  /* ══ 🏯 亂世 ══ */
  sg_nobunaga: {
    bio:'年輕時舉止荒唐，鄉里稱他「尾張的大傻瓜」，連家臣都憂心到切腹進諫。桶狹間一戰，他以兩千人奇襲今川義元的二萬五千大軍，一戰成名。他重用出身低微的秀吉、引進鐵砲三段擊、燒比叡山、自稱第六天魔王——在一個講究血統與規矩的時代，他是把規矩全部掀翻的那個人。\n　　所以他是火屬性的攻擊型。特色能力「桶狹間」讓本次攻擊連打兩次——以寡擊眾的關鍵從來不是硬拚，是打在對方沒想到的地方。換乘條件是「累積受創」：被逼到牆角的時候，他就不再假裝是個傻瓜了。',
    moves:{
      '天下布武・第一陣':'印章上刻著「天下布武」。他從不掩飾自己要什麼。',
      '傻瓜的從容':'人人都說他是傻瓜。他就一路傻到別人再也笑不出來。',
      '火繩備戰':'三千挺鐵砲、三段輪射。長篠一戰，武田的騎兵撞上了新的時代。',
    }},
  sg_shingen: {
    bio:'甲斐之虎。軍旗上「疾如風、徐如林、侵掠如火、不動如山」十四字取自《孫子兵法》，成為他一生的注腳。他築堤治水、開發金山、以「人是城、人是石垣」治國，意思是與其修城牆，不如經營人心。與上杉謙信在川中島對峙五次，是戰國最有名的宿敵。\n　　所以他是風屬性的耐久型，還帶一招群體攻擊——赤備騎兵衝起來不會只撞一個人。防禦招「不動如山」是全陣營最硬的減傷之一。特色能力「甲斐之虎」三回合減傷並持續回血。他不進化：山就是山。',
    moves:{
      '風林火山・侵掠如火':'旗上十四字出自《孫子・軍爭》。攻起來的時候像火，不留餘地。',
      '赤備突擊':'一色赤紅的騎兵隊。看到那片紅，敵陣往往先亂了。',
      '不動如山':'風林火山的最後一句，也是他的本色。你撼不動一座山。',
    }},
  sg_kenshin: {
    bio:'越後之龍。自稱毘沙門天的化身，軍旗只寫一個「毘」字。他一生出兵七十餘次幾乎不敗，卻很少為了土地開戰——多半是應鄰國之請「主持公道」。武田信玄領地缺鹽時，他不趁人之危，反而開放鹽路接濟，留下「敵に塩を送る」這句成語，意思與「雪中送炭」相近。\n　　所以他是光屬性的防禦型。特色能力「毘沙門天降臨」三回合內受傷只剩 55%——他真心相信自己是神的化身，這份信念本身就是最厚的鎧甲。他不進化，因為他從一開始就認定自己是誰。',
    moves:{
      '毘沙門天・車懸':'車懸之陣，全軍如車輪輪替衝鋒。川中島上，他一度殺到信玄本陣前。',
      '毘之旗':'旗上只有一個「毘」字。那是毘沙門天，也是他自己。',
      '軍神加護':'他真心相信自己是神的化身。信到那個程度，全軍也就跟著信了。',
    }},
  sg_masamune: {
    bio:'幼時因天花失去右眼，人稱獨眼龍。十八歲繼位，短短數年統一奧州南部，是戰國末期崛起最快的大名。他晚生了二十年——天下大勢已定，他只能在秀吉與家康之間週旋求存。傳說他曾身穿死裝束、扛著十字架去見秀吉謝罪，硬是靠這份膽識活了下來。\n　　所以他是雷屬性的速攻型，有兩招攻擊——他起步比別人晚，只好比別人快。特色能力「獨眼龍」直接削去對手最大體力的 18%。他不進化：晚生二十年這件事，是他這輩子補不回來的。',
    moves:{
      '竹雀・迅雷':'伊達家的家紋是竹與雀。他出手比誰都快，因為他起步比誰都晚。',
      '三日月斬':'頭盔上那彎巨大的金色弦月。刀光劃過時，形狀是一樣的。',
      '隻眼之勘':'少了一隻眼，反而看得更準。他自己是這麼說的。',
    }},
  sg_yukimura: {
    bio:'真田家的次子，被譽為「日本第一兵」。大坂之陣中，他在城外築起「真田丸」出丸，以寡擊眾重創德川軍；夏之陣最後一戰，他率赤備直衝家康本陣，一度逼得家康考慮切腹——那是家康一生中第二次被逼到那個地步。家紋六文錢，是渡冥河的船資：出陣即抱著必死之心。\n　　所以他是火屬性的攻擊型，威力全陣營最高之一。特色能力「日本第一兵」本次攻擊傷害 ×2.6——那是他衝向家康本陣的那一擊。他不進化，因為六文錢的意思就是不打算回來了。',
    moves:{
      '六文錢・赤備':'六文錢是渡河的船資。掛上這個家紋，就是不打算回來了。',
      '真田丸':'他在大坂城外多築了一座出丸。德川軍在那裡撞得頭破血流。',
      '決死覺悟':'夏之陣最後一日，他直取家康本陣。差一點就成功了。',
    }},
  sg_hideyoshi: {
    bio:'出身尾張的農家，本名木下藤吉郎。因為瘦小又機靈，信長叫他「猴子」。他從替信長提草鞋做起——傳說冬天他把草鞋揣在懷裡焐熱，信長一穿就記住了這個人。此後他一路從足輕爬到武將、關白、太閤，是日本史上出身最低而位極人臣的例子。\n　　所以他起手是全場最弱的角色之一：威力 60，沒有特色能力，防禦招只是「低頭陪笑」。但他是三階角色——第 6 題後成為「武將・豐臣秀吉」，此後再連對 3 題即化為「關白・豐臣秀吉」，定位從均衡型轉為耐久型，血量從 540 升到 1000。這條線是全遊戲落差最大的一條。',
    moves:{
      '草履之志':'他把主君的草鞋揣在懷裡焐熱。一切都從這雙鞋開始。',
      '低頭陪笑':'他不怕丟臉。丟臉的人活得下來，活下來才有以後。',
      '察言觀色':'他總是先看懂對方要什麼，再決定自己說什麼。',
    }},
  sg_ieyasu: {
    bio:'六歲當人質，此後在今川家寄人籬下十二年。三方原一戰他慘敗於武田信玄，據說逃回城後命人畫下自己驚恐的模樣，掛在身邊警惕一生。他熬過信長、熬過秀吉，在關原之戰後開創江戶幕府，換來兩百六十年的和平。有名的三句評語裡，他的那句是「不啼的杜鵑，就等到牠啼」。\n　　所以他是無屬性的耐久型，特技是蓄力——放棄一回合，換下一擊的倍率。特色能力「三河武士」立刻回血三成。第四題後換乘為「天下人・德川家康」。他的玩法就是他的人生：先撐住，再等，最後一次收完。',
    moves:{
      '厭離穢土・忍':'軍旗寫著「厭離穢土，欣求淨土」。他要的不是勝，是最後的太平。',
      '三方原之恥':'他把慘敗時的自畫像掛在身邊一輩子。那張畫比任何城牆都有用。',
      '隱忍蓄力':'等。他這一生最強的本事，就是等。',
    }},
  sg_mitsuhide: {
    bio:'信長帳下最有教養的家臣，通和歌、茶道與典章，是織田政權的行政骨幹。天正十年六月，他在前往支援羽柴軍的途中忽然轉向，說出「敵在本能寺」，包圍了正在寺中歇息的信長。政權維持了短短十一天，就在山崎被秀吉擊敗，史稱「三日天下」。他為什麼要反，至今沒有定論。\n　　所以他是冥屬性的幸運型。特色能力「敵在本能寺」是宿敵：對上亂世陣營時傷害 ×1.5、受創 ×0.7——他的宿敵，從來都在自己人裡面。他不進化，因為三日天下就是他全部的高度。',
    moves:{
      '桔梗紋・逆心':'明智家的水色桔梗紋。當那面旗轉向本能寺，全軍才知道要做什麼。',
      '明智之慎':'他一向謹慎。所以那一天的決定，更沒有人看得懂。',
      '本能寺之算':'他算得很準——只算漏了秀吉回師的速度。',
    }},

  /* ══ 🐉 逐鹿 ══ */
  zl_baiqi: {
    bio:'秦昭王時名將，號武安君。伊闕之戰破韓魏二十四萬，鄢郢之戰攻下楚都，長平之戰大破趙軍——《史記》記其坑殺降卒，趙國元氣自此不復。他一生七十餘戰未嘗敗績，後人稱「人屠」。最終因拒不出征而被賜死，臨死歎道：「我固當死。長平之事，足以死矣。」\n　　所以他是冥屬性的攻擊型，威力最高、還帶一招群體攻擊——長平之戰要處理的不是一個人。特色能力「人屠之名」直接削去對手最大體力的 18%。他不進化：七十餘戰未嘗敗績的人，沒有還要變強的空間。',
    moves:{
      '策・武安君至':'昭王封他武安君。這三個字傳到陣前，敵軍先亂三分。',
      '策・長平大破':'趙括代廉頗而戰，四十萬大軍盡沒。紙上談兵的代價。',
      '策・按兵不動':'他從不急攻。等到對方糧盡自亂，才是他動手的時候。',
    }},
  zl_lianpo: {
    bio:'趙國名將，與藺相如「將相和」的另一半。他曾因不服藺相如位居其上而百般刁難，聽聞相如「以先國家之急而後私讎」後，肉袒負荊登門謝罪，成就「負荊請罪」。晚年流亡他國，趙王想再用他，派使者探視。他一飯斗米、肉十斤，披甲上馬示以尚可用；使者受人賄賂，回報「一飯三遺矢」，趙王遂不召——「廉頗老矣，尚能飯否」由此而來。\n　　所以他是土屬性的耐久型，防禦招硬度極高，特技是每回合回血——「尚能飯否」問的就是身體撐不撐得住。特色能力「廉頗未老」三回合減傷並回血。他不進化，因為老將要證明的不是變強，是還沒退。',
    moves:{
      '策・老當益壯':'一飯斗米、肉十斤，披甲上馬。他用身體回答了那個問題。',
      '策・堅壁不出':'長平初期他堅守三年不戰，秦軍無可奈何。換將之後，才有了那場大敗。',
      '策・尚能飯否':'使者收了錢，回報說他一頓飯上了三次廁所。趙王就此不再召他。',
    }},
  zl_zhangyi: {
    bio:'戰國縱橫家，師從鬼谷子。早年遊說楚國時被誣偷玉，遭鞭笞幾死；回家後問妻子：「視吾舌尚在不？」妻笑曰「舌在也」，他說「足矣」。後入秦為相，以「連橫」瓦解六國「合縱」，靠一張嘴改變了天下形勢。曾以「商於之地六百里」誆騙楚懷王絕齊，事後改口只給六里。\n　　所以他是光屬性的幸運型，特技是降低對手命中——離間之後，對方連刀都揮不準。第三題後可自由切換兩種形態：「合縱・張儀」轉均衡型帶群體攻擊，「連橫・張儀」轉攻擊型逐一擊破。合縱與連橫本來就是同一張嘴說出來的兩套話。',
    moves:{
      '策・以利誘之':'他從不強迫誰。他只是讓對方自己算出「答應比較划算」。',
      '策・巧言令色':'他被打得半死，第一句話是問舌頭還在不在。在，就夠了。',
      '策・離間其君':'離間不必造謠。把真話說給對的人聽，就夠了。',
    }},
  zl_jingke: {
    bio:'燕國刺客。燕太子丹以樊於期首級與督亢地圖為引，使他入秦行刺。易水送別時高漸離擊筑，他和而歌曰：「風蕭蕭兮易水寒，壯士一去兮不復還。」殿上獻圖，圖窮而匕首見，追秦王繞柱而走，終究功敗垂成，被斬於殿前。司馬遷評他：「其志不成，然其立意較然，不欺其志。」\n　　所以他是火屬性的速攻型，特技是蓄力——圖還沒展到底，就還不是時候。換乘條件是「體力低於四成」，換乘後成為「圖窮匕見・荊軻」：威力 104 是全遊戲最高，但沒有防禦招，特色能力「壯士不還」傷害再 ×2.6。一去，就真的不回來了。',
    moves:{
      '策・袖中藏鋒':'匕首捲在地圖最裡層。獻圖的手，一路都很穩。',
      '策・從容不迫':'秦廷之上，他神色如常。同行的秦舞陽已經抖到站不住。',
      '策・藏鋒待發':'圖還沒展到底，就還不是時候。',
    }},
  zl_xiangyu: {
    bio:'楚將項燕之後，力能扛鼎。少時學書不成、學劍又不成，說「劍一人敵，不足學，學萬人敵」。鉅鹿之戰破釜沉舟，九戰九捷，諸侯將入轅門「無不膝行而前，莫敢仰視」。後與劉邦爭天下，垓下被圍，四面楚歌，作《垓下歌》：「力拔山兮氣蓋世，時不利兮騅不逝。」烏江亭長勸他渡江，他說無顏見江東父老，自刎而死，年三十一。\n　　所以他是火屬性的攻擊型。特色能力「一夫當關」讓本次攻擊連打兩次。換乘條件是「累積受創六成」——他從來不是被打敗的，他是被圍到最後才崩的。換乘後的「垓下絕唱・項羽」沒有防禦招：四面楚歌的時候，擋也沒有意義了。',
    moves:{
      '計・破釜沉舟':'渡河後鑿沉船隻、砸破鍋釜，只帶三日糧。退路沒了，就只剩往前。',
      '計・喑噁叱吒':'韓信形容他一怒之下，千人皆廢。這是天生的壓迫感。',
      '計・力拔山兮':'《垓下歌》的第一句。他到最後也不認為自己敗在戰場上。',
    }},
  zl_hanxin: {
    bio:'淮陰人，少時貧困，寄食漂母，受辱於市井少年——被逼從其胯下爬過，「一市人皆笑信，以為怯」。他先投項梁、項羽不得志，轉投劉邦仍只是治粟都尉，幸得蕭何月下追回，登壇拜為大將。此後明修棧道、暗度陳倉、背水為陣、十面埋伏，為漢定天下，後世稱「兵仙」。\n　　所以他起手是全場最弱：威力 58，防禦招叫「忍而不校」，沒有特色能力。但他是三階角色——第 6 題後成為「執戟郎・韓信」，此後再連對 3 題即化為「兵仙・韓信」，血量從 540 升到 1000、威力升到 100。從胯下到登壇，這中間隔的就是那幾題。',
    moves:{
      '計・俯出胯下':'他熟視良久，然後俯身爬了過去。全市的人都笑他懦弱。',
      '計・忍而不校':'能忍下這一時的，往往不是最軟弱的那個人。',
      '計・熟視良久':'他盯著對方看了很久才決定怎麼做。他一直都是這樣的人。',
    }},
  zl_zhangliang: {
    bio:'韓國貴族之後，五世相韓。秦滅韓後散盡家財求刺客，於博浪沙以百二十斤大鐵椎狙擊秦始皇，誤中副車，亡命下邳。在圯上為老人納履三次，得授《太公兵法》，老人稱「孺子可教」。此後輔佐劉邦，運籌帷幄之中，決勝千里之外。功成之後不受三萬戶封賞，只求留侯之位，晚年學辟穀導引，全身而退。\n　　所以他起手是土屬性的攻擊型——博浪沙那一擊靠的是一百二十斤的鐵椎，純粹的力氣。但他是三階角色，而且是全遊戲唯一連屬性都會變的：第 6 題後成為「圯上受書・張良」轉均衡型，此後再連對 3 題即化為「帝者之師・張良」轉光屬性幸運型。從刺客到軍師，他整個人都換了。',
    moves:{
      '計・博浪飛椎':'一百二十斤的大鐵椎。可惜砸中的是副車，不是那一輛。',
      '計・亡命下邳':'刺秦失敗，天下通緝。他改名換姓，躲了十年。',
      '計・伏於道左':'埋伏、等待、看準時機。他年輕時用在鐵椎上，後來用在天下上。',
    }},
  zl_xiaohe: {
    bio:'沛縣主吏掾，最早追隨劉邦的一批人。入咸陽時眾將爭搶金帛，唯獨他先收秦丞相府的律令圖籍——漢朝後來能掌握天下戶口、關隘、強弱，全靠這批文書。楚漢相爭時他鎮守關中，源源不絕供應兵員糧草。論功時劉邦定他第一，說「鎮國家，撫百姓，給餽饟，不絕糧道，吾不如蕭何」。\n　　所以他是土屬性的耐久型，還帶一招群體攻擊——糧草要送到的是整支軍隊。特色能力「蕭何月下」立刻回血三成，正是他追回韓信那一夜。他不進化：後勤這種事，做得再好也只是穩穩地做著。',
    moves:{
      '計・鎮國撫百姓':'高祖評功語。前線打得再猛，後方斷糧就全完了。',
      '計・轉漕給饋':'糧草從關中一車一車運到前線。這條路，他守了四年。',
      '計・關中為本':'眾將搶金銀，他搶檔案。天下的形勢，全在那幾卷竹簡裡。',
    }},
  zl_liubang: {
    bio:'沛縣泗水亭長，出身平民，好酒及色，不事生產。見秦始皇出巡歎曰「大丈夫當如此也」。起兵後屢戰屢敗，卻總能重新站起來。稱帝後在洛陽問群臣為何是他得天下，自答：「夫運籌帷幄之中，決勝千里之外，吾不如子房；鎮國家，撫百姓，吾不如蕭何；連百萬之軍，戰必勝，攻必取，吾不如韓信。此三者皆人傑，吾能用之，此吾所以取天下也。」\n　　所以他起手威力只有 60，防禦招叫「脫身獨去」，特技是回血——他打不贏任何人，但他跑得掉。他是三階角色：第 6 題後成為「沛公・劉邦」，此後再連對 3 題即化為「漢高祖・劉邦」，定位轉耐久型、血量 1020。他真正的能力，是活到最後。',
    moves:{
      '計・提三尺劍':'他說自己「以布衣提三尺劍取天下」。起點確實只有一把劍。',
      '計・脫身獨去':'鴻門宴上他借如廁之名脫身。能屈能伸，是他最大的本事。',
      '計・結交豪傑':'他不會打仗也不會治國。但天下的人才，都願意替他做事。',
    }},
  zl_fanzeng: {
    bio:'項羽的謀主，年七十始出，被尊為「亞父」——僅次於父親的意思。他看出劉邦「其志不在小」，鴻門宴上三次舉起所佩玉玦示意項羽動手，項羽默然不應。事後他拔劍撞碎玉斗，歎道：「豎子不足與謀！奪項王天下者，必沛公也。」後中陳平反間計，被項羽疏遠，怒而請歸，途中疽發背而死。\n　　所以他是冥屬性的防禦型，特技是削弱對手攻擊。特色能力「豎子不足與謀」是宿敵：對上逐鹿陣營時傷害 ×1.5、受創 ×0.7——他真正的敵人，是那個不肯聽他話的自己人。他不進化：七十歲才出山，已經沒有下一段了。',
    moves:{
      '計・鴻門舉玦':'玉玦的「玦」諧音「決」。他舉了三次，項羽三次都當作沒看見。',
      '計・亞父之諫':'僅次於父親的稱呼。可惜有這個名分，沒有這個分量。',
      '計・數目項王':'他一再使眼色。看得懂的人在對面，看不懂的人在旁邊。',
    }},
  zl_lvbu: {
    bio:'五原郡人，善弓馬，膂力過人，號「飛將」。先事丁原，後殺丁原投董卓，再殺董卓——因此被罵作三姓家奴。轅門射戟解紀靈、劉備之圍，一箭百步中戟小枝，諸將皆驚。《三國志》稱他「有虓虎之勇，而無英奇之略，輕狡反覆，唯利是視」。下邳兵敗被擒，求活於曹操，劉備一句話便斷了他的生路。\n　　所以他是火屬性的攻擊型。特色能力「人中呂布」本次攻擊必定會心、傷害再 ×2。第三題後可自由切換三種武裝，是全遊戲形態最多的角色：「方天畫戟」攻擊型帶群攻、「赤兔」轉速攻型、「強弓」轉幸運型高會心。三種打法，一個人。',
    moves:{
      '略・飛將無雙':'當時語曰「人中有呂布，馬中有赤兔」。這兩句是分開講的。',
      '略・虓虎之勇':'《三國志》原文。虓，虎怒吼之聲——有勇無謀，也是一種評價。',
      '略・勒馬按戟':'他按著戟不動。光是這個姿勢，就沒有人敢先上。',
    }},
  zl_guanyu: {
    bio:'河東解人，亡命奔涿郡，與劉備、張飛恩若兄弟。溫酒斬華雄、白馬解圍斬顏良，降曹後盡封所賜，掛印封金而去，千里尋兄。刮骨療毒時「割炙引酒，言笑自若」。襄樊之戰水淹七軍，威震華夏。後敗走麥城被擒殺。因其忠義，後世由侯而王、由王而帝、由帝而聖，最終成神。\n　　所以他是土屬性的耐久型，特技是每回合回血——刮骨療毒那一段，寫的就是他扛得住。特色能力「溫酒斬華雄」直接削去對手最大體力的 18%。連對 3 題後可切換「赤兔千里」與「青龍偃月」：一個是坐騎，一個是兵器，都是他的招牌。',
    moves:{
      '略・拖刀而回':'佯敗誘敵，回身一刀。快得讓人來不及反應。',
      '略・忠義為盾':'曹操待他極厚，他還是走了。留下的東西一件也沒帶。',
      '略・刮骨療毒':'華佗刮骨去毒，血流盈盤，他照樣飲酒下棋，言笑自若。',
    }},
  zl_zhaoyun: {
    bio:'常山真定人，身長八尺，姿顏雄偉。長坂坡單騎救主，懷抱幼主阿斗在曹軍中七進七出，護得母子周全。漢水之戰以寡敵眾、大開營門偃旗息鼓，曹軍疑有伏兵而退，劉備稱「子龍一身都是膽也」，軍中號為「虎威將軍」。他一生謹慎，勸阻劉備伐吳、諫止分田功臣，是蜀漢少數敢直言的人。\n　　所以他是風屬性的速攻型，有兩招攻擊——七進七出靠的是進得去也出得來。特色能力「一身是膽」讓本次攻擊連打兩次。他不進化：史書裡的趙雲一生謹慎，沒有什麼暴走的時刻。',
    moves:{
      '略・七進七出':'長坂坡上，他懷裡抱著的是還在襁褓中的阿斗。',
      '略・龍膽亮銀':'演義給他的槍。史書沒寫，但那個形象已經深入人心。',
      '略・懷主而戰':'他從來不是為自己打。這是他和呂布最大的差別。',
    }},
  zl_zhugeliang: {
    bio:'琅邪陽都人，躬耕於南陽，自比管仲、樂毅，時人稱「臥龍」。劉備三顧茅廬，他於草廬中析論天下大勢——先取荊益、西和諸戎、外結孫權、待天下有變兩路北伐，是為《隆中對》。此後聯吳抗曹、平定南中、六出祁山，〈出師表〉一句「鞠躬盡瘁，死而後已」，寫盡他的一生。\n　　所以他起手是無屬性的均衡型，威力只有 62，防禦招叫「躬耕南陽」——出山之前他只是個種田的。他是三階角色：第 6 題後成為「羽扇綸巾・諸葛亮」，此後再連對 3 題即化為「八陣圖・諸葛亮」，威力 96、帶群體攻擊，特色能力「出師未捷」回血三成。',
    moves:{
      '略・隆中之對':'一場對話定了三分天下。那年他二十七歲。',
      '略・躬耕南陽':'〈出師表〉：「臣本布衣，躬耕於南陽，苟全性命於亂世。」',
      '略・夜觀天象':'演義寫他觀星知命。史書寫的是他「治戎為長，奇謀為短」。',
    }},
  zl_zhouyu: {
    bio:'廬江舒人，長壯有姿貌，精音律——酒後聽人奏曲有誤必回頭一顧，時人謠曰「曲有誤，周郎顧」。赤壁之戰他力主抗曹，用黃蓋詐降、火攻連環船，一戰奠定三分。《三國志》稱他「性度恢廓」，演義為了突顯諸葛亮才把他寫成心胸狹隘——那並不是史書裡的周瑜。\n　　所以他是水屬性的幸運型——赤壁靠的是火，但成敗押在那一場東南風上。特技「連環之計」降低對手命中，正是把船鎖在一起的那一手。特色能力「曲有誤周郎顧」三回合大幅提升會心與閃避。他不進化：三十六歲就走了，沒有後面了。',
    moves:{
      '略・火燒赤壁':'黃蓋詐降、東南風起。曹軍的船是連在一起的。',
      '略・談笑自若':'大戰在即，他照樣從容。程普原本輕視他，後來說與他相交「如飲醇醪」。',
      '略・連環之計':'把船鎖在一起本是為了防暈船。防住了浪，防不住火。',
    }},
  zl_simayi: {
    bio:'河內溫人，號「冢虎」——蟄伏的虎。魏明帝時屢拒諸葛亮北伐，五丈原前堅壁不戰，諸葛亮遣人送女人衣物羞辱，他照收不誤，只問使者「諸葛公起居飲食如何」，聽說「食少事煩」，便斷定其不久於人世。他熬死了曹操三代人，最後發動高平陵之變，為晉朝奠基。他最厲害的武器是壽命。\n　　所以他是冥屬性的防禦型，防禦招硬度全遊戲最高之一，特技是削弱對手攻擊。特色能力「死諸葛走生仲達」讓此後攻擊 ×1.2、命中 +10 且持續整場。他不進化，因為他的策略從頭到尾只有一個：不必贏，活得比對方久就好。',
    moves:{
      '略・鷹視狼顧':'曹操說他有狼顧之相——身不動而頭能回望一百八十度。',
      '略・堅壁不戰':'諸葛亮送他女裝羞辱。他笑著收下，繼續不出戰。',
      '略・以逸待勞':'他不必贏。他只要活得比對方久。',
    }},

  /* ══ 🍶 梁山 ══ */
  sh_lu: {
    bio:'本名魯達，渭州經略府提轄。為救金翠蓮父女，三拳打死鎮關西鄭屠，亡命出家為僧，法號智深。因醉酒大鬧五臺山、打壞山門金剛，被薦往大相國寺看守菜園，倒拔垂楊柳降服潑皮。他一生莽撞，卻每一次莽撞都是為了別人。\n　　所以他是土屬性的耐久型，還帶一招群體攻擊——倒拔垂楊柳這種事，本來就不是針對某一個人。防禦招「金剛樁」是全陣營最硬。特色能力「不屈禪心」三回合減傷並回血。他不進化：他從第一頁到最後一頁都是同一個人。',
    moves:{
      '禪杖心法・第三重・倒卷簾':'六十二斤水磨禪杖。他使起來像一片捲起的簾子。',
      '倒拔垂楊柳':'眾潑皮要整他，他走過去把整棵柳樹連根拔起。從此再沒人敢惹。',
      '金剛樁':'五臺山的金剛他打壞過。站樁的姿勢，倒是學了個十足。',
    }},
  sh_lin: {
    bio:'東京八十萬禁軍槍棒教頭，妻美而遭高衙內覬覦。高俅設局誘他誤入白虎堂，刺配滄州。押解途中董超、薛霸幾乎要了他的命，幸得魯智深野豬林相救。看守草料場時遇大雪，屋塌避入山神廟，正聽見陸謙等人在門外談論如何燒死他——至此再無退路，殺了三人，雪夜奔上梁山。他一忍再忍，直到忍無可忍。\n　　所以他起手是風屬性的防禦型，特技叫「忍」。換乘條件是「體力低於四成」——風雪山神廟，退無可退。換乘後的「雪夜上梁山・林沖」定位直接轉為攻擊型，威力從 72 跳到 96，而且沒有防禦招了。他不是變強，他是不忍了。',
    moves:{
      '槍法心法・第三重・寒潭影':'林家槍法。出手不見刀光，像寒潭上一閃的影子。',
      '禁軍樁':'八十萬禁軍教頭的底子。守得住，就先不出手。',
      '調息・忍':'他忍了很久。發配、陷害、追殺，他都忍了。',
    }},
  sh_wu: {
    bio:'清河縣人，行者。景陽岡下連飲十八碗，店家勸「三碗不過崗」他偏要上山，赤手空拳打死吊睛白額大蟲。兄長武大郎被潘金蓮與西門慶所害，他手刃仇人為兄報仇，刺配孟州。醉打蔣門神、大鬧飛雲浦，血濺鴛鴦樓後改扮頭陀，人稱行者武松。\n　　所以他是火屬性的攻擊型，特技是蓄力——酒勁上來要一點時間。特色能力「三碗不過崗」讓本次攻擊連打兩次。連對 3 題後可切換「雙戒刀」與「醉拳」兩種形態：一個換兵器，一個換打法，都還是那個喝了十八碗的人。',
    moves:{
      '拳法心法・第四重・醉臥崗':'景陽岡上，他是醉著打的。酒越多，拳越沉。',
      '醉樁':'站得歪歪斜斜，卻怎麼推都不倒。這就是醉拳的門道。',
      '調息・酒勁':'三碗不過崗？他喝了十八碗，然後上山了。',
    }},
  sh_li: {
    bio:'沂州沂水縣人，黑旋風。使兩把板斧，脾氣火爆，殺人時常不分敵我，江州劫法場一路砍將出去，「不問軍官百姓，殺得屍橫遍地」。他對宋江死心塌地，宋江讓他往東他絕不往西。最後宋江飲下毒酒，怕他知情後造反壞了忠義之名，騙他同飲——他明白之後只說了一句：「生時服侍哥哥，死了也只是哥哥部下一個小鬼。」\n　　所以他是冥屬性的攻擊型，防禦招叫「莽樁」——他其實不會防禦，只是硬扛。特色能力「殺得性起」本次攻擊必定會心、傷害再 ×2。換乘條件是「累積受創六成」，換乘後的「板斧狂化」沒有防禦招：他火起來的時候，是真的什麼都不管了。',
    moves:{
      '板斧心法・第二重・開山手':'兩把板斧，招式只有一個字：劈。',
      '莽樁':'他不懂什麼防禦。硬扛而已。',
      '調息・怒':'他一火起來就六親不認。這既是他的破綻，也是他的力量。',
    }},
  sh_wuyong: {
    bio:'表字學究，道號加亮先生，人稱智多星。原是鄉村教書先生，智取生辰綱是他的成名作——在黃泥岡以蒙汗藥、白日鼠與熱天暑氣布局，一擔金珠寶貝不動聲色地換了主人。上梁山後任軍師，排兵布陣、招降納叛多出其手。他手不離羽扇，計不離連環。\n　　所以他是無屬性的幸運型，特技是降低對手命中——料敵在先，對方自然打不準。特色能力「智珠在握」三回合大幅提升會心與閃避。他不進化：智取生辰綱那一局已經是他的巔峰，之後他做的都是同一件事。',
    moves:{
      '智略心法・第五重・連環算':'智取生辰綱那一局，從天氣算到人心，一環扣一環。',
      '羽扇樁':'他不會武。羽扇一擋，靠的是對方猜不透他要做什麼。',
      '調息・料敵':'他總是先算對方會怎麼想，再決定自己怎麼做。',
    }},
  sh_dai: {
    bio:'江州兩院押牢節級，神行太保。會道術「甲馬」——在兩腿綁上四個甲馬符，作起法來日行八百里，若只綁兩個則是五百里。梁山泊的軍情傳遞、聯絡各路好漢多賴其腿。他曾與宋江同下江州牢城，後與李逵、張順等共同劫法場救出宋江。\n　　所以他是雷屬性的速攻型，有兩招攻擊——日行八百里的人，一回合當然不只出手一次。特色能力「日行八百」直接削去對手最大體力的 18%。他不進化：甲馬綁上就是那個速度，沒有更快的版本了。',
    moves:{
      '神行心法・第六重・踏雲步':'甲馬綁上，腳不沾地。八百里，一日可到。',
      '甲馬疾走':'四個甲馬八百里，兩個甲馬五百里。差別只在綁幾個。',
      '疾風樁':'他不擋。他只是已經不在那個位置了。',
    }},
  sh_song: {
    bio:'鄆城縣押司，表字公明。人矮貌黑，人稱「黑三郎」；因仗義疏財、救人急難，江湖上號「及時雨」。他為通風報信而殺了閻婆惜，亡命江湖，潯陽樓醉題反詩獲罪，被劫法場救上梁山，終成一百單八將之首。他一生最在意「忠義」二字，把「聚義廳」改為「忠義堂」，力主招安——也正是這條路，最後葬送了整個梁山。\n　　所以他起手是光屬性的防禦型，威力 60、防禦招叫「押司樁」，沒有特色能力——一個抄公文的小吏能有什麼武藝。他是三階角色：第 6 題後成為「及時雨・宋江」轉均衡型，此後再連對 3 題即化為「梁山之主・宋江」，威力 98、帶群體攻擊、血量 1000。全遊戲最完整的一條發跡線。',
    moves:{
      '文書心法・第一重・執筆立':'他起初只是個抄公文的押司。手裡拿的是筆，不是刀。',
      '押司樁':'一個小吏能有什麼防身本事。他靠的是人緣。',
      '調息・周旋':'錢他出，人情他還。這就是「及時雨」三個字的來歷。',
    }},

  /* ══ 🎓 學府 ══ */
  mj_moyan: {
    bio:'中文系。別人以為讀中文就是背課文，其實一入門先撞上的是文字、聲韻、訓詁這「小學三科」——一個字為什麼這樣寫、古人怎麼念、這個詞在唐朝是什麼意思，全都要查得出根據。他講話慢，因為每一句都想找到出處；他不急著贏，因為他知道一個字用錯，整段意思就歪了。袖子上總沾著墨，包包裡永遠有一本翻爛的工具書。\n　　所以他起手是光屬性的均衡型，威力 62——查證需要時間，一開始快不起來。他是三階角色：第 6 題後成為「引經據典・墨言」，此後再連對 3 題即化為「一字千金・墨言」，轉幸運型、帶群體攻擊。學士、碩士、博士，這條線在學府陣營共有四位角色走。',
    moves:{
      '必修・文字學':'從甲骨、金文一路追到楷書。字的長相，本身就是一部歷史。',
      '引經據典':'有出處他才敢說。沒出處的話，他寧可不說。',
      '選修・修辭':'同樣一件事，換個說法就能打動人。這就是修辭在做的事。',
    }},
  mj_aili: {
    bio:'外文系。她的專長不是「會講外語」，而是在兩種語言之間找到那條走得通的路。口譯時最難的從來不是單字，是文化——對方講了一個只有他們懂的笑話，她得在三秒內決定要直譯、意譯，還是乾脆換一個笑話。她常常話講到一半停住，不是想不起來，是在挑更準的那個字。\n　　所以她是風屬性的速攻型——口譯拚的就是反應速度。特色能力「臨場反應」讓本次攻擊連打兩次。連對 3 題後換乘為「同步口譯・艾莉」，帶群體攻擊：同時處理多種語言，本來就是她的專長。',
    moves:{
      '必修・口說':'她不怕說錯。怕說錯的人，永遠學不會一種語言。',
      '語境迴避':'同一句話在不同場合意思完全不同。她靠這個閃過去。',
      '選修・聽力':'翻譯的第一步不是開口，是聽懂對方真正想說什麼。',
    }},
  mj_shike: {
    bio:'歷史系。他最常講的一句話是「這件事以前發生過」。外人以為歷史系在背年代，實際上他們花最多時間的是「這份史料可信嗎」——誰寫的、為誰寫的、有沒有立場、有沒有旁證。他不容易被說服，也不容易被激怒；因為他看過太多當下覺得天大的事，幾十年後只剩史書上的一行。\n　　所以他是無屬性的耐久型，還帶一招群體攻擊——通史概論本來就是全面掃過一遍。特色能力「以史為鑑」三回合減傷並回血。他不進化：史料越讀越多，人不會忽然變成另一個人。',
    moves:{
      '必修・史料考證':'一手史料勝過十本二手轉述。他一定去翻原件。',
      '通史概論':'從上古到當代跑一遍。範圍最廣的一門課，也最累的一門。',
      '史觀之壁':'同一件事，不同立場的人寫出來完全不同。他先擋住的是成見。',
    }},
  mj_xuansi: {
    bio:'哲學系。他的攻擊方式是問問題。你說了一句話，他會反問你憑什麼這樣說；你回答了，他再問你那個前提又憑什麼。多數人撐不到第三層就開始生氣。他並不是要贏，他是真心想知道答案——只是這個過程對別人來說很像被拆房子。他隨身帶著一本書，永遠停在同一頁，因為每一段都要想很久。\n　　所以他是冥屬性的幸運型，特技是降低對手命中——被問到懷疑人生的時候，出手自然會歪。特色能力「你怎麼知道」三回合大幅提升會心與閃避。他不進化：哲學系的人不會畢業，他們只是換了一批問題繼續問。',
    moves:{
      '必修・邏輯':'前提對、推論對，結論才對。三個環節少一個都不行。',
      '懸置判斷':'不確定的事就先不下結論。這比急著表態難得多。',
      '選修・詰問':'蘇格拉底的方法：不給答案，只一直問，直到你自己發現漏洞。',
    }},
  mj_lvming: {
    bio:'法律系。他相信程序，甚至勝過相信真相——因為沒有程序保障，所謂真相往往只是聲音最大的人說了算。他習慣先問「證據呢」，再問「這證據怎麼來的」。朋友覺得他很難聊天，因為他連約吃飯都要先確認雙方對「六點」的定義一致。但真的出事時，大家第一個想到的也是他。\n　　所以他起手是土屬性的防禦型，防禦招叫「程序保障」，威力只有 60——程序走完之前，他不會動手。他是三階角色：第 6 題後成為「法庭辯士・律明」，此後再連對 3 題即化為「一槌定音・律明」，防禦招硬度 0.20 是全遊戲最硬。',
    moves:{
      '必修・法學緒論':'第一堂課先學的不是條文，是為什麼要有法律。',
      '程序保障':'程序不是拖延。程序是為了讓弱勢的一方也有機會說話。',
      '選修・舉證':'主張的人要負舉證責任。這一條救過很多無辜的人。',
    }},
  mj_jingwei: {
    bio:'企管系。他看世界的方式是資源配置——同樣的時間、人力、預算，怎麼擺才能產出最大。他不迷信努力，因為方向錯了，越努力賠越多。他隨身帶著一張試算表，聚餐分帳能算到小數點後兩位，但真正遇到值得投資的事，他也是全隊裡最敢押的那一個。\n　　所以他是水屬性的攻擊型，威力 88——投報率不夠他不會出手，一出手就要夠大。特色能力「槓桿全開」三回合攻擊 ×1.6。他不進化：他的成長不在自己身上，在他配置的資源上。',
    moves:{
      '必修・財報分析':'三大報表攤開，一家公司好不好，數字比廣告誠實。',
      '風險對沖':'把賭注分散開。他不是不冒險，他是不押身家。',
      '選修・成本控制':'省下來的每一塊，都等於多賺的一塊。',
    }},
  mj_ama: {
    bio:'資工系。他的信念是：同一件事做第二次，就該讓機器去做。他寫程式的時間常常比手動做完還久，但下次就再也不用做了。最常說的一句話是「它昨天還好好的啊」——通常說完就開始一行一行往回找。他不太會表達，可是他寫的工具默默幫全班省了幾百個小時。\n　　所以他起手是無屬性的速攻型，威力 62、特技是除錯——第一版程式總是跑不動。他是三階角色：第 6 題後成為「全端工程・阿碼」，此後再連對 3 題即化為「系統架構・阿碼」，帶群體攻擊。自動化的本質就是一次處理全部。',
    moves:{
      '必修・程式設計':'從第一個 Hello World 開始。所有人都是這樣起步的。',
      '例外處理':'寫程式不是假設一切順利，是假設什麼都可能出錯。',
      '選修・除錯':'錯誤訊息不是在罵你，是在告訴你哪裡出問題。',
    }},
  mj_dianguang: {
    bio:'電機系。從你按下開關到燈亮起來的那一瞬間，中間有一整個學門。他熟悉電壓、電流、阻抗這些看不見的東西，也習慣了那種「接錯一條線就會冒煙」的緊張感。他的實驗紀錄比誰都詳細，因為在他的領域裡，粗心的代價不是分數低，是有人受傷。\n　　所以他是雷屬性的攻擊型，有兩招攻擊——電路的輸出是連續的。特色能力「滿載輸出」三回合攻擊 ×1.6。他不進化：電壓拉滿就是極限，再上去是要出事的。',
    moves:{
      '必修・電路學':'歐姆定律看起來簡單，整個學門都建在它上面。',
      '選修・脈衝放電':'把能量壓縮在極短的時間內釋放。瞬間功率非常可觀。',
      '絕緣護具':'他從不徒手碰電。這不是膽小，這是專業。',
    }},
  mj_gangchi: {
    bio:'機械與土木。他看一座橋，看的不是造型，是應力怎麼傳到地基。他知道每一個結構都有極限，所以總會多留一倍餘裕——這叫安全係數，是工程師對「萬一」的敬意。他話不多，做事慢，但他說撐得住的東西，就真的撐得住。\n　　所以他是土屬性的耐久型，特技是每回合回血——結構補強做的就是持續維護。特色能力「安全係數」三回合減傷並回血。換乘條件是「累積受創」，換乘後的「動力外骨骼・鋼齒」防禦招硬度 0.22、帶群體攻擊：撐不住的時候，就換更強的結構。',
    moves:{
      '必修・材料力學':'每一種材料都有它的極限。知道極限在哪，才敢設計。',
      '結構補強':'不是加得越多越好。加在對的地方，一根就夠。',
      '選修・應力分析':'力量會沿著結構跑。找到它最後停在哪裡，那裡就是弱點。',
    }},
  mj_ouji: {
    bio:'數學系。他不賭運氣，他賭期望值。在他眼裡，所謂運氣好只是樣本數還不夠多；只要次數夠多，一切都會回到它該有的位置。他喜歡的不是計算，是證明——把一件事推到「不可能不成立」的那種確定感，他說那比任何情緒都可靠。\n　　所以他是光屬性的幸運型，特技提升會心率——期望值算得夠準，運氣就不只是運氣。特色能力「大數法則」本次攻擊必定會心、傷害再 ×2。他不進化：數學不會進化，它只會被證明。',
    moves:{
      '必修・機率論':'從機率上來說，你會輸。他只是把話說清楚而已。',
      '反證迴避':'要推翻一個命題，只需要找到一個反例。',
      '選修・期望值':'不要看單次結果。要看長期下來平均會怎麼樣。',
    }},
  mj_renxin: {
    bio:'醫學系。他背過的骨頭、肌肉、神經、血管加起來超過一千個名字，每一個都不能記錯。實習時他第一次面對真正的病人，手抖了很久——不是怕做錯，是忽然明白書上那些名詞底下，是一個活著的人。他學會的第一句話不是診斷，是「別怕，我在」。\n　　所以他起手是水屬性的防禦型，威力 60、特技是止血——實習醫師能做的就是先穩住。他是三階角色：第 6 題後成為「主治醫師・仁心」，此後再連對 3 題即化為「華佗再世・仁心」，防禦招硬度 0.20、特色能力「起死回生」直接回血三成。',
    moves:{
      '必修・解剖學':'醫學生的第一道關卡。人體的地圖，得先背在腦子裡。',
      '無菌隔離':'看不見的東西最危險。洗手這件事，救的人比手術刀多。',
      '選修・止血':'急救的第一步不是治療，是先讓血停下來。',
    }},
  mj_maomao: {
    bio:'獸醫系。他的病人不會說哪裡痛，只會躲、會抖、會咬人。所以他學的第一件事是「讀懂沒有語言的訊號」——耳朵的角度、尾巴的位置、瞳孔的大小。他也得同時面對飼主的焦慮，有時候安撫人比安撫動物還花時間。這一隊全是貓，所以他大概是最忙的一個。\n　　所以他是火屬性的均衡型，特技是全體治療——一窩有蟲就要一起處理。特色能力「全隊照護」解除自身所有負面狀態並回血。他不進化：獸醫的功力是一隻一隻累積的，沒有什麼戲劇性的那一刻。',
    moves:{
      '必修・動物行為學':'牠不說話，但牠一直在表達。看懂了才知道哪裡不對。',
      '保定術':'不是壓制，是讓牠在最少的掙扎下完成檢查。',
      '選修・全體驅蟲':'一隻有，全窩都有。這種事一定要一起處理。',
    }},

  /* ══ 🌿 淺山 ══ */
  wd_leopard: {
    bio:'台灣雲豹，台灣特有亞種，身上大塊雲朵狀的斑紋是牠的名字由來。牠是台灣曾有的第二大型貓科動物，善於爬樹，能頭下腳上地從樹幹倒著下來。排灣族與魯凱族視牠為引路的聖獸。然而自一九八三年之後，再也沒有可靠的野外目擊紀錄——牠可能已經從這座島上消失了。\n　　所以牠起手是火屬性的攻擊型，但威力只有 62——幼獸還撲不倒什麼。牠是三階角色：第 6 題後成為「台灣雲豹」，此後再連對 3 題即化為「雲紋焰豹」，威力 100、帶群體攻擊。淺山陣營的共通被動是「野性自癒」，每回合回復 5% 體力：野外的傷，本來就要自己好。',
    moves:{
      '本能・撲擊':'從樹上直接落下。牠的獵物通常沒有機會抬頭。',
      '樹冠隱蔽':'雲狀斑紋在斑駁的樹影裡幾乎看不見。這是牠最好的裝備。',
      '本能・潛伏':'牠可以在同一根樹枝上待上幾個小時，一動也不動。',
    }},
  wd_cat: {
    bio:'石虎，台灣現存唯一的野生貓科動物，也是全台最急迫的保育物種之一。牠只有家貓大小，額頭兩道白色縱紋、耳背有明顯白斑，是與家貓最好分辨的地方。牠住在淺山——那是人類活動與森林交界的地帶，也正因為如此，牠的棲地一直在退。路殺是牠最主要的死因。\n　　所以牠起手是無屬性的速攻型，特技是警戒——在淺山活著的第一件事是先發現危險。牠是三階角色：第 6 題後成為「台灣石虎」，此後再連對 3 題即化為「淺山之王」。「台灣石虎」的特色能力是天敵直覺：攻擊屬性剋制對手時傷害再 ×1.4，這是獵食者對弱點的本能。',
    moves:{
      '本能・突襲':'牠不追逐。牠等到距離夠近，才一次解決。',
      '草叢潛行':'淺山的草叢是牠的走廊。你經過時，牠可能就在三公尺外。',
      '本能・警戒':'耳背的白斑在暗處看起來像眼睛。從後面靠近牠並不容易。',
    }},
  wd_salmon: {
    bio:'櫻花鉤吻鮭，被稱為「國寶魚」。牠是冰河時期留下來的孑遺生物——當年隨冰河南下，冰河退去後被困在台灣高山的冷水溪流裡，再也回不了海。牠們現在只生活在雪霸的七家灣溪一帶，對水溫極度敏感，超過十七度就活不下去。\n　　所以牠起手是水屬性的均衡型，特技是迴游。牠是三階角色：第 6 題後成為「櫻花鉤吻鮭」，此後再連對 3 題即化為「溯源鮭王」，帶群體攻擊、特色能力「生命回歸」回血三成。逆流而上這件事，本來就要一段一段地完成。',
    moves:{
      '本能・擺尾':'在湍急的溪流裡逆流而上，靠的就是這一下一下的擺動。',
      '順流':'該退的時候退。牠不會硬撐在原地。',
      '本能・迴游':'牠記得出生的那片水域，也一直想回去。只是路已經不通了。',
    }},
  wd_magpie: {
    bio:'台灣藍鵲，台灣特有種，二○○七年網路票選為台灣國鳥。牠有寶藍色的羽毛、鮮紅的嘴喙與腳，尾羽長度幾乎是身體的兩倍，飛行時整群魚貫而過，像一串藍色的長綢帶，稱為「魚貫飛行」。牠們有「巢邊幫手」的習性——前一年的兄姊會留下來一起照顧新生的弟妹。\n　　所以牠起手是風屬性的幸運型，特技是鳴警。牠是三階角色：第 6 題後成為「台灣藍鵲」，此後再連對 3 題即化為「長尾風鵲」。二階的特色能力叫「家族共禦」——一隻叫了整群都來，這正是藍鵲真實的習性。',
    moves:{
      '本能・啄擊':'紅色的喙比看起來有力。牠護巢的時候連人都敢追。',
      '枝間跳躍':'牠很少長距離飛。多半是在枝與枝之間快速移動。',
      '本能・鳴警':'一隻發現危險就大聲叫，整群立刻集合。這是牠們的警報系統。',
    }},
  wd_bear: {
    bio:'台灣黑熊，台灣最大型的陸生動物，胸前有一道 V 字形的白色斑紋，被稱為「月熊」。牠其實非常怕人，多數的目擊紀錄都是牠先跑掉。研究者發現，被捕捉繫放的個體中有相當比例斷掌或斷趾——那是誤中陷阱留下的。整個台灣的野外族群估計只剩數百隻。\n　　所以牠起手是光屬性的耐久型，血量 600 是同期最高，特技是進食。牠是三階角色：第 6 題後成為「台灣黑熊」，此後再連對 3 題即化為「白月胸熊」，血量 1050 是全遊戲最高。體型最大的動物，本來就該是最耐打的那一個。',
    moves:{
      '本能・熊掌':'一掌的力量足以拍斷樹枝。牠只是很少真的用出來。',
      '縮成一團':'受到驚嚇時牠會先躲。攻擊從來不是牠的第一選項。',
      '本能・進食':'秋天牠要吃很多。青剛櫟的果實成熟時，牠會整天待在樹上。',
    }},
  wd_pangolin: {
    bio:'穿山甲，全身覆滿角質鱗片的哺乳類，遇到危險時會捲成一顆球，連獅子的牙都咬不開。牠沒有牙齒，靠長舌頭舔食螞蟻與白蟻，一晚可以吃掉數萬隻。牠也是全世界被走私最嚴重的哺乳動物——因為鱗片被誤信有藥效。台灣的保育成果在國際間相當受到肯定。\n　　所以牠是土屬性的防禦型，防禦招「捲成一球」硬度極高。特色能力「鱗甲護身」三回合減傷並回血。換乘條件是「累積受創」，換乘後的「磐岩甲獸」防禦招硬度 0.18 是全遊戲最硬——牠不還手，牠只是讓你咬不動。',
    moves:{
      '本能・掘擊':'那雙前爪本來是用來挖蟻窩的。挖土的力氣不小。',
      '捲成一球':'牠不還手。牠只是把自己變成一顆咬不開的球。',
      '本能・穴居':'牠挖的洞後來常常成為其他動物的家。',
    }},
  wd_owl: {
    bio:'領角鴞，台灣最常見的貓頭鷹之一，連都市公園也找得到。牠的羽色與樹皮幾乎一樣，白天貼在樹幹上動也不動，就算你抬頭正對著牠也很難發現。貓頭鷹的飛羽邊緣有細密的鋸齒，能把飛行時的氣流打散——所以牠俯衝的時候，獵物聽不見任何聲音。\n　　所以牠是冥屬性的幸運型，特技提升會心率——夜視讓牠看得見別人看不見的破綻。特色能力「夜之眼」是天敵直覺：攻擊屬性剋制對手時傷害再 ×1.4、對手屬性被自己剋制時受創 ×0.75。第四題後換乘為「夜幕冥鴞」。',
    moves:{
      '本能・無聲撲擊':'飛羽邊緣的鋸齒把風聲消掉了。牠來的時候是沒有聲音的。',
      '樹皮擬態':'牠貼在樹幹上就是一塊樹皮。你抬頭看過去也不會發現。',
      '本能・夜視':'牠的眼睛佔了頭骨很大的比例，所以眼球不能轉——只好轉頭。',
    }},
  wd_squirrel: {
    bio:'白面鼯鼠，台灣特有亞種，俗稱飛鼠。牠並不會真的飛，而是靠四肢之間的皮膜滑翔——從高處躍下，能一次滑行超過五十公尺，尾巴則像方向舵一樣控制轉向。牠是夜行性的，入夜後在林間活動，眼睛在手電筒下會反射出橘紅色的光。\n　　所以牠是雷屬性的速攻型，特技是助跑——滑翔之前總要先爬高。特色能力「滑翔疾襲」讓本次攻擊連打兩次。連對 3 題後換乘為「疾雷飛鼯」，帶群體攻擊：一次滑過整片林冠。',
    moves:{
      '本能・滑翔撲擊':'牠張開皮膜，從樹冠一路滑下來。這一段是不出聲的。',
      '樹洞躲避':'白天牠躲在樹洞裡睡覺。天亮之後，你幾乎看不到牠。',
      '本能・助跑':'滑翔之前要先爬高。牠往上爬的時候，就已經在準備了。',
    }},

  /* ══ 🐾 解鎖貓 ══ */
  cat_myth: {
    bio:'神殿裡一直有這麼一隻白貓。牠什麼時候來的沒有人記得，只知道祭司換過幾代，牠還在。\n牠總是睡在主神像腳邊的那塊石板上，據說那裡冬天不冷、夏天不熱。有人說牠是神留下來看家的，\n也有人說神只是懶得趕牠走。牠對誰都不特別親近，但每次有人真心祈求的時候，牠會抬一下眼睛。\n　　所以牠是光屬性的均衡型，各項平均、沒有明顯弱點，特色能力「神殿的午睡」立刻回復三成體力——\n睡飽了就沒事了，這是貓的哲學。牠是七隻解鎖貓之一：整體強度約為一般角色的 112%，\n代價是不能進化、也不會有夥伴來合體。用神域的角色打贏一場就能解鎖牠。',
    moves:{
      '神諭・白光爪':'牠伸了個懶腰，順手撓了一下。那道光是附贈的。',
      '聖壇臥姿':'牠往石板上一趴。那個位置，連神像的影子都繞著走。',
      '神諭・靜聽':'牠豎起耳朵聽了一下，然後繼續睡。傷口就好了。',
    }},
  cat_oath: {
    bio:'圓桌底下一直有個空位，是那隻灰貓的。牠不屬於任何一位騎士，也沒有人給牠取過正式的名字，\n但每次議事牠都在場。傳說有一次爭執到快要拔劍，牠忽然跳上桌子坐在正中央，\n所有人就這麼安靜下來了。從那之後，圓桌的規矩多了一條：貓在桌上的時候，不准吵架。\n　　所以牠是無屬性的防禦型，防禦硬度是全遊戲最高之一，特色能力「無名騎士」三回合內受傷只剩 55%。\n牠是七隻解鎖貓之一，強度約為一般角色的 112%，代價是不能進化、也不能合體。\n用誓約的角色打贏一場就能解鎖牠。',
    moves:{
      '誓約・爪痕':'牠在桌腳上留了幾道爪痕。那是牠簽的名。',
      '圓桌下的座位':'那個位置沒有人跟牠爭。也沒有人打得到牠。',
      '誓約・磨爪':'牠慢條斯理地磨著爪子。磨完之後，防禦就更硬了。',
    }},
  cat_sengoku: {
    bio:'城下町的三花貓，天守閣最高那一層是牠先住進去的。城主換了三任，牠一任也沒讓過。\n士兵說牠會在攻城前一天特別焦躁，來回踱步；也有人說那只是牠餓了。\n不管怎樣，這座城被圍過四次，牠四次都活了下來——而且每次都比守將更早知道哪裡有破口。\n　　所以牠是火屬性的攻擊型，有兩招攻擊，特色能力「天守閣的主人」三回合內攻擊 ×1.6。\n牠是七隻解鎖貓之一，強度約為一般角色的 112%，代價是不能進化、也不能合體。\n用亂世的角色打贏一場就能解鎖牠。',
    moves:{
      '城下・撲擊':'牠從瓦片上直接撲下來。屋簷是牠的高地。',
      '城下・回身抓':'牠假裝要跑，然後回身一爪。這招牠用了很多年。',
      '瓦上疾走':'牠在屋脊上跑得比誰都穩。追不到的。',
    }},
  cat_zhulu: {
    bio:'書房裡的黑貓，總是趴在硯台旁邊。牠不吵不鬧，只是看著——看誰在寫什麼、誰又把寫好的燒掉。\n幕僚們私下說這隻貓知道的機密比任何人都多，可惜牠不會說話。\n有一年主公在深夜寫下一封決定天下的信，寫完之後看了看貓，把信燒了。第二天他改了主意。\n　　所以牠是冥屬性的幸運型，高會心高閃避，特色能力「書房的第三隻眼」三回合大幅提升會心與閃避。\n牠是七隻解鎖貓之一，強度約為一般角色的 112%，代價是不能進化、也不能合體。\n用逐鹿的角色打贏一場就能解鎖牠。',
    moves:{
      '墨玉・無聲一擊':'牠出手的時候連墨都沒有晃。',
      '硯台後的陰影':'牠往硯台後面一縮，你就找不到牠了。',
      '墨玉・凝視':'牠盯著你看。被牠看久了，破綻自己會浮出來。',
    }},
  cat_shuihu: {
    bio:'酒肆裡的虎斑大貓，在這間店賒了三年的魚，老闆一次也沒趕過牠。\n江湖上的人來來去去，牠誰也不巴結，倒是有幾個亡命之徒每次進城都特地繞過來給牠帶點下酒菜。\n有一回官兵來搜人，牠不知怎麼把整張桌子掀了，趁亂那個人就跑掉了。老闆說那天的酒錢也不用算了。\n　　所以牠是土屬性的耐久型，還帶一招群體攻擊「掀桌」，特色能力「賒帳的老主顧」三回合減傷並持續回血。\n牠是七隻解鎖貓之一，強度約為一般角色的 112%，代價是不能進化、也不能合體。\n用梁山的角色打贏一場就能解鎖牠。',
    moves:{
      '酒肆・肉墊重擊':'看起來軟，落下來很沉。牠自己大概也不知道有多重。',
      '酒肆・掀桌':'那一桌連人帶菜全翻了。牠只是想跳過去而已。',
      '酒缸旁的位置':'牠靠著酒缸坐下。那裡誰也推不動。',
    }},
  cat_major: {
    bio:'圖書館的常駐住戶，館員一屆一屆畢業，牠還在。\n牠最喜歡趴在還書推車上，被推著繞過一排又一排的書架。學生說哪一排放什麼書，牠比館員還清楚——\n你在某一區來回找太久，牠會走過去，然後在某一格底下坐下來。通常那本書就在那裡。\n　　所以牠是雷屬性的速攻型，有兩招攻擊、命中最穩定，特色能力「永遠的旁聽生」讓本次攻擊連打兩次。\n牠是七隻解鎖貓之一，強度約為一般角色的 112%，代價是不能進化、也不能合體。\n用學府的角色打贏一場就能解鎖牠。',
    moves:{
      '必修・書頁疾風':'牠跑過去的時候，整排書都翻了一頁。',
      '選修・書架穿梭':'牠從書架的縫隙鑽過去。那個縫比牠看起來窄多了。',
      '書堆裡的縫隙':'牠躲進書堆。你要找到牠，得先把書全搬開。',
    }},
  cat_wild: {
    bio:'每天走同一條山徑的石紋貓。牠不屬於任何人，也不接受餵食——你放的東西牠會看一眼，然後繞過去。\n研究人員裝了自動相機，發現牠三年來的路線幾乎一模一樣，連轉彎的位置都不變。\n有人說牠在巡自己的領域，也有人說牠只是習慣了。淺山的動物都認得牠，包括那些比牠大得多的。\n　　所以牠是風屬性的攻擊型，帶一招群體攻擊「掃尾」，特色能力「淺山的常客」本次攻擊必定會心、傷害再 ×2。\n牠是七隻解鎖貓之一，強度約為一般角色的 112%，代價是不能進化、也不能合體。\n用淺山的角色打贏一場就能解鎖牠。',
    moves:{
      '淺山・風爪':'牠出爪的時候，風才跟上來。',
      '淺山・掃尾':'那條尾巴比看起來長。掃過去的範圍不小。',
      '石縫貼伏':'牠貼進石縫裡。那塊石頭本來就長那樣。',
    }},
  /* ══ 💠 特殊 ══ */
  sp_quewue: {
    bio:'不知道從哪裡冒出來的一隻貓。牠總是趴在講桌角落，半瞇著眼睛看學生答題，一副早就知道答案的樣子。你問牠問題，牠會歎一口氣，然後用紅筆在你的考卷上畫一個圈——那個圈永遠都畫在對的地方。牠出現的時候不多，但只要牠在，這一題就不會有懸念。\n　　牠是隱藏角色，要輸入密碼才找得到。第一招「隨便啦！」是命中率 100% 的群體攻擊——牠不瞄準，因為牠不需要瞄準。特色能力「直接解題」會自動選出正解，全遊戲只有牠有這個能力。牠不進化，也沒有任何合體夥伴：規則之外的東西，本來就不歸規則管。',
    moves:{
      '隨便啦！':'牠隨手一揮，全場的敵人一起中招。牠自己看起來完全不在乎。',
      '就是這樣喵～':'牠沒有真的擋。牠只是覺得沒什麼好緊張的。',
      '要多久！！！':'牠等得不耐煩了。被牠瞪一眼，誰都會慌。',
    }},
  sp_nanshan: {
    bio:'南山的守護豹，據說在考季前後特別容易出現。牠會在深夜巡過教室，把趴在桌上睡著的人的參考書翻到隔天要考的那一頁。沒有人證實過這件事，但每年都有人說自己遇過。牠不保證你會考好，牠只保證你會遇到你準備過的那一題。\n　　牠是火屬性的幸運型，特技提升會心率。特色能力「一舉登科」本次攻擊必定會心、傷害再 ×2——考運這種事，中了就是中了，沒有中間值。牠不進化：金榜題名只有一次。',
    moves:{
      '一舉登科・撲':'牠一撲而上。你只需要在對的那一刻剛好準備好。',
      '豹紋護身':'那身斑紋像一張護身符。至少牠自己是這麼相信的。',
      '考運加持':'牠繞著你走三圈。剩下的，還是要靠你自己。',
    }},
  sp_maomao: {
    bio:'一隻總是沾著白色粉末的貓。牠相信這世界上沒有什麼錯是不能重來的——寫錯了，塗掉；答錯了，再算一次；活得亂七八糟，就整張撕掉重寫。牠不太聰明，也不太強，但牠從來不覺得犯錯是什麼大不了的事。在一群厲害角色裡，牠大概是最讓人放鬆的那一個。\n　　牠是光屬性的防禦型，防禦招硬度很高，特技是回血。特色能力「全部塗掉」解除自身所有負面狀態並回復體力——這正是修正液的功能，把錯的痕跡抹掉，讓你重新來過。牠不進化：牠也不需要。',
    moves:{
      '修正液一抹':'先把礙事的東西塗掉再說。牠處理問題的方式一向直接。',
      '塗掉就沒事了':'牠把攻擊也塗掉了。這不合理，但確實有效。',
      '全部重寫':'整張撕掉，重來一次。牠說這沒什麼。',
    }},
};

const QUOTES = {
  /* 神域 */
  my_zeus               :['我的裁決，就是天理。','（神王之威，不容冒犯）','（積雨雲，正在聚攏）','以我之名——降下雷霆。'],
  my_zeus_bolt          :['眾神之上，只有我一人。','（神王結界，密不透風）','（權杖握緊，天空變色）','奧林帕斯——天罰！'],
  my_athena             :['戰爭是要用腦子打的。','（橄欖之盾，穩穩擋下）','（她已經算到第三步了）','看著我的眼睛。'],
  my_athena_aegis       :['看清這面盾，然後認輸。','（埃癸斯，任何攻擊都無效）','（石化的視線掃過）','這面盾，從未破過。'],
  my_poseidon           :['海不接受任何人的意見。','（深淵之壁，浪打不穿）','（海水正在退去⋯⋯）','三叉戟落下——大地為之震動。'],
  my_thor               :['錘子說了算。','（巨人剋星，硬碰硬）','（錘子在手上轉了一圈）','妙爾尼爾——全力一擊！'],
  my_loki               :['我沒騙你，我只是沒說實話。','（他好像變成別的東西了）','（真真假假，你分得出來嗎）','詐術之神，從不空手而回。'],
  my_fenrir             :['這條鎖鏈，總有一天會斷。','（低伏著，盯著鎖鏈）','（後腿蹬地，肌肉緊繃）','（牠用力扯了一下鎖鏈）'],
  my_fenrir_free        :['鎖鏈斷了。輪到你們了。','（不擋。牠只往前）','（疾走，快到看不清）','黃昏——降臨了。'],
  my_seraph             :['主的火，不問對錯。','（六翼收攏，護住全身）','（火焰在羽毛間流動）','以聖火燔祭，滌淨一切。'],
  my_seraph_open        :['六翼盡展——退散。','（六翼齊振，熱浪逼人）','（臨在，無所不至）','聖焰全開——退散！'],
  my_cherub             :['四面八方，我都看著。','（智慧之座，紋絲不動）','（四面之瞳同時睜開）','無論你從哪裡來，我都看得到。'],
  my_dominion           :['秩序，不容討論。','（秩序之環，自動修正）','（裁定已下，無可上訴）','神權執行——即刻生效。'],
  /* 誓約 */
  oa_arthur             :['這把劍……真的認我嗎？','（少年的盾，舉得有點抖）','（他深吸一口氣，靜下心）',''],
  oa_arthur_2           :['劍認了我，那我就走下去。','（圓桌之盾，穩了許多）','（號令一出，眾騎士응）','圓桌的弟兄們——集合！'],
  oa_arthur_3           :['以王之名——終結此戰。','（王者結界，光芒環繞）','（十三騎士，列陣完畢）','以王之名——斷鋼神劍！'],
  oa_lancelot           :['我為榮譽而戰，也為她。','（騎士之禮，也是防禦）','（劍尖對準了要害）','圓桌第一，不是虛名。'],
  oa_robin              :['富人的錢，本來就不是他們的。','（他往樹後一閃）','（拉滿弓，屏住呼吸）','這一箭，不會落空。'],
  oa_nightingale        :['傷患不分敵我。','（白衣之盾，護住傷者）','（她點亮了那盞燈）','燈還亮著，就沒有人會死。'],
  oa_turing             :['給我時間，沒有解不開的東西。','（邏輯屏障，無懈可擊）','（他在紙上寫下一串符號）','密碼，我看穿了。'],
  oa_curie              :['再測一次，數據會說話。','（鉛板後面，安全一些）','（提純，再提純）','再測一次。數據會說話。'],
  oa_curie_rad          :['我知道它會傷害我。我還是要做完。','（她已經不擋了）','（臨界⋯⋯就在此刻）','我知道它會傷我。我還是要做完。'],
  /* 亂世 */
  sg_nobunaga           :['人生五十年⋯⋯無聊死了。','（他懶洋洋地擋了一下）','（火繩點燃，三段列陣）','桶狹間那一戰，你聽過吧？'],
  sg_nobunaga_demon     :['神佛？燒了便是。','（不擋。他只是笑）','（三段擊，齊射）','神佛？我就是第六天魔王。'],
  sg_shingen            :['疾如風，徐如林。','（不動如山，撼不了分毫）','（赤備列陣，蓄勢待發）','疾如風，侵掠如火。'],
  sg_kenshin            :['義之所在，刀之所向。','（毘之旗，一夫當關）','（軍神加護，籠罩全軍）','毘沙門天——降臨。'],
  sg_masamune           :['我要是早生二十年，天下就是我的。','（隻眼之勘，避開要害）','（刀光一閃，快得看不見）','我要是早生二十年——'],
  sg_yukimura           :['六文錢在手，渡不了河也要衝。','（真田丸，寸土不讓）','（決死之覺悟，已定）','六文錢在手，衝！'],
  sg_hideyoshi          :['是是是，小的這就去辦。','（他低頭陪笑，躲過一擊）','（他在偷看對方的臉色）',''],
  sg_hideyoshi_2        :['我沒有家世，我只有腦子跟腿。','（墨俁之壁，一夜築成）','（他又收服了一個人）','我沒有家世，我只有腦子跟腿。'],
  sg_hideyoshi_3        :['從草履開始，我走到了這裡。','（大坂城，天下第一堅城）','（檢地令下，天下丈量）','從草履開始，我走到了這裡。'],
  sg_ieyasu             :['等。再等等。','（他忍下了。又一次）','（隱忍，蓄力，再等等）','三河的弟兄，還在。'],
  sg_ieyasu_shogun      :['等到了。','（江戶城，固若金湯）','（大御所之威，無人能擋）','等到了。這天下，是我的。'],
  sg_mitsuhide          :['敵人，就在本能寺。','（明智之慎，滴水不漏）','（他在算一件事⋯⋯）','敵人，就在本能寺。'],
  /* 逐鹿 */
  zl_baiqi              :['降者，亦斬。','（殺氣壓得人喘不過氣）','（他在算能坑多少）','降者，亦斬。'],
  zl_lianpo             :['我還吃得下三斗米。','（堅壁清野，寸步不讓）','（老將吃了三斗米）','老夫尚能飯！'],
  zl_zhangyi            :['我這條舌頭還在，就還有辦法。','（他笑著往旁邊挪了一步）','（一句話，兩國就翻臉了）','我這條舌頭還在，就還有辦法。'],
  zl_zhangyi_zong       :['六國同心，秦又如何？','（盟約之盾，六國同扛）','（合縱之勢，已成）','六國同心，秦又能如何？'],
  zl_zhangyi_heng       :['盟約？我拆給你看。','（他早就想好退路了）','（分化，離間，各懷鬼胎）','盟約？我拆給你看。'],
  zl_jingke             :['風蕭蕭兮易水寒。','（他從容地側了側身）','（匕首藏在圖裡）','風蕭蕭兮易水寒。'],
  zl_jingke_dagger      :['壯士一去兮不復還！','（不擋。他只往前）','（絕命一擊，就是現在）','壯士一去兮，不復還！'],
  zl_xiangyu            :['力拔山兮氣蓋世。','（霸王之威，逼退三步）','（力拔山兮，氣蓋世）','一夫當關，萬夫莫開！'],
  zl_xiangyu_gaixia     :['天亡我，非戰之罪。','（不擋了。四面都是楚歌）','（他拔劍四顧，心茫然）','天亡我，非戰之罪！'],
  zl_hanxin             :['⋯⋯忍這一時。','（他跪了下去，從胯下爬過）','（他記住了每一張臉）',''],
  zl_hanxin_2           :['終於有人肯聽我說話了。','（郎中之慎，不露鋒芒）','（明修棧道，暗度陳倉）','終於有人肯聽我說話了。'],
  zl_hanxin_3           :['陛下能將十萬。臣，多多益善。','（井陘之陣，滴水不漏）','（十面埋伏，已經布好）','陛下能將十萬。臣，多多益善。'],
  zl_zhangliang         :['誤中副車⋯⋯可惡！','（他拔腿就跑）','（大鐵椎，一百二十斤）',''],
  zl_zhangliang_2       :['原來，力氣是最沒用的東西。','（他從容地替老人納履）','（運籌，再運籌）','原來，力氣是最沒用的東西。'],
  zl_zhangliang_3       :['運籌帷幄之中，決勝千里之外。','（他早已算好退路）','（決勝千里，就在此刻）','運籌帷幄之中，決勝千里之外。'],
  zl_xiaohe             :['前線有人打，後方要有人管。','（鎮國之基，動搖不了）','（糧草源源不絕）','前線有人打，後方要有人管。'],
  zl_liubang            :['大丈夫當如是也！','（他掉頭就溜）','（他先敬對方一杯）',''],
  zl_liubang_2          :['我不會打仗，但我會用會打仗的人。','（鴻門宴上，他笑著喝酒）','（用人不疑，疑人不用）','我不會打仗，但我會用會打仗的人。'],
  zl_liubang_3          :['大風起兮雲飛揚。','（未央宮，天下之基）','（大風起，雲飛揚）','安得猛士兮守四方！'],
  zl_fanzeng            :['豎子不足與謀！','（亞父之諫，也是盾）','（玉玦，他舉了三次）','豎子不足與謀！'],
  zl_lvbu               :['天下誰人是我對手？','（三姓家奴？他不在乎）','（蓄力，就這一擊）','天下誰人是我對手？'],
  zl_lvbu_ji            :['戟到之處，寸草不生。','（戟舞一圈，無人能近）','（轅門一箭，百步穿楊）','戟到之處，寸草不生！'],
  zl_lvbu_horse         :['追不上我的。','（馬上一閃，蹤影全無）','（赤兔前蹄一揚）','追不上我的。'],
  zl_lvbu_bow           :['看好了，一箭而已。','（他側身避開，弓不離手）','（瞄準，屏息）','看好了，一箭而已。'],
  zl_guanyu             :['酒且斟下，某去便來。','（忠義之盾，護住身後）','（刮骨療毒，面不改色）','酒且斟下，某去便來。'],
  zl_guanyu_horse       :['千里之遙，也要回到兄長身邊。','（青龍偃月，橫在身前）','（水已經淹到七軍了）','千里之遙，也要回到兄長身邊。'],
  zl_zhaoyun            :['子龍在此，何人敢近！','（護主之盾，比命還重）','（銀槍一抖，七進七出）','子龍在此，何人敢近！'],
  zl_zhugeliang         :['苟全性命於亂世。','（草廬雖小，能避風雨）','（他抬頭看了看星象）',''],
  zl_zhugeliang_2       :['風，會來的。','（空城計。他在城樓上撫琴）','（東風⋯⋯要來了）','舌戰群儒，何足道哉。'],
  zl_zhugeliang_3       :['鞠躬盡瘁，死而後已。','（石兵八陣，進得去出不來）','（木牛流馬，連弩齊發）','鞠躬盡瘁，死而後已。'],
  zl_zhouyu             :['曲有誤，周郎顧。','（談笑自若，羽扇未動）','（連環計，已經串好了）','曲有誤，周郎顧。'],
  zl_simayi             :['我不急。我活得比你久。','（堅守不出。他不急）','（拖。再拖一陣子）','我不急。我活得比你久。'],
  /* 梁山 */
  sh_lu                 :['直來直往，最省事。','（金剛樁，穩如須彌）','（提一口氣，力從地起）','酒肉穿腸過，佛祖心中留！'],
  sh_lin                :['⋯⋯得罪了。','（禁軍樁，滴水不漏）','（忍。再忍一次就好。）','我不想惹事。真的。'],
  sh_lin_snow           :['我忍夠了——這一槍，還你！','（不擋了。）','（雪停了。）','我忍夠了——這一槍，還你！'],
  sh_wu                 :['再來三碗。','（醉樁，站得歪，倒不了）','（酒勁⋯⋯上來了）','三碗不過崗？我喝了十八碗。'],
  sh_wu_blade           :['三碗不過崗？我喝了十八碗。','（行者樁，刀不離手）','（雙刀交叉，寒光一閃）','蔣門神，你也有今天。'],
  sh_li                 :['鐵牛來也！','（莽樁——其實就是硬扛）','（我火了啊啊啊！）','管他是誰，一斧兩半！'],
  sh_li_rage            :['管他是誰，一斧兩半！','（不擋。他只想砍）','（殺紅了眼）','劫法場——誰也別想攔！'],
  sh_wuyong             :['這一步，三十招前就寫好了。','（羽扇一擋，恰恰好）','（你的下一步，我看得見）','智珠在握——請入甕吧。'],
  sh_dai                :['你眨個眼，我就到了。','（讓開比擋下快）','（甲馬繫緊⋯⋯）','日行八百里，這一趟取你性命。'],
  sh_song               :['⋯⋯我只是個抄公文的。','（押司樁，勉強擋著）','（先周旋看看吧。）',''],
  sh_song_rain          :['錢我出，事我扛。','（義樁，替弟兄擋下）','（錢我出，事我扛）','及時雨到——撐住！'],
  sh_song_lord          :['聚義廳上——百八星，齊聚！','（忠義樁，一夫當關）','（弟兄們，穩住。）','聚義廳上——百八星，齊聚！'],
  /* 學府 */
  mj_moyan              :['這個字……我查一下。','（他把書擋在身前）','（他翻了三本工具書）',''],
  mj_moyan_2            :['有出處的話，我就敢說。','（論證之盾，句句有據）','（訓詁完畢，字義確定）','有出處的話，我就敢說。'],
  mj_moyan_3            :['一字之差，天差地遠。','（文氣護體，字字千鈞）','（全文默寫，一字不差）','一字之差，天差地遠。'],
  mj_aili               :['Wait，這句中文怎麼講？','（她用語境繞了過去）','（聽力全開，一句不漏）','Sorry，我剛剛在翻譯。'],
  mj_aili_sim           :['你說你的，我翻我的，同時。','（譯者之盾，零時差）','（三種語言，同時輸出）','你說你的，我翻我的，同時。'],
  mj_shike              :['這件事，三百年前發生過。','（史觀之壁，考證扎實）','（他翻出了三份一手史料）','這件事，三百年前發生過。'],
  mj_xuansi             :['那你怎麼知道你知道？','（他懸置了判斷）','（一句反問，全盤動搖）','那你怎麼知道你知道？'],
  mj_lvming             :['依法……應該是這樣沒錯吧？','（程序保障，先擋再說）','（他慢慢地整理證據）',''],
  mj_lvming_2           :['異議！這與本案無關。','（無罪推定，不能亂來）','（異議！這與本案無關）','審判長，我方主張——'],
  mj_lvming_3           :['本庭宣判——你，敗訴。','（法槌一落，無可爭辯）','（集體訴訟，全體受償）','本庭宣判——你，敗訴。'],
  mj_jingwei            :['這個投報率，我不能接受。','（風險對沖，損失有限）','（成本壓到最低）','槓桿全開——這筆我吃下了。'],
  mj_ama                :['它昨天還好好的啊。','（他包了一層 try-catch）','（他在找那個分號）',''],
  mj_ama_2              :['我把它包成一個函式了。','（防火牆擋下了）','（重構完畢，程式碼乾淨了）','我把它包成一個函式了。'],
  mj_ama_3              :['我把它自動化了。以後不用再問我。','（容錯機制，掛了也還在跑）','（批次處理，一次全解決）','我把它自動化了。以後不用問我。'],
  mj_dianguang          :['電壓拉滿，退後。','（絕緣護具，電不到他）','（脈衝充能，三、二、一）','電壓拉滿——退後！'],
  mj_gangchi            :['這個結構，撐得住。','（結構補強，撐得住）','（應力分析，找到弱點了）','安全係數三倍。放心撞。'],
  mj_gangchi_exo        :['安全係數三倍。放心撞。','（外骨骼裝甲，正面硬扛）','（液壓全開，扭力最大）','動力全開——輾過去！'],
  mj_ouji               :['從機率上來說，你會輸。','（他早就算過機率了）','（期望值，正的）','從機率上來說，你會輸。'],
  mj_renxin             :['這個……我還在實習。','（無菌隔離，先別碰）','（先止血，其他之後再說）',''],
  mj_renxin_2           :['讓開，我來。','（加護病房，撐住）','（急救，爭取每一秒）','讓開，我來。'],
  mj_renxin_3           :['別怕。交給我。','（生命維持，絕不放手）','（全面消毒，群體防疫）','別怕。交給我。'],
  mj_maomao             :['乖，不會痛的。','（保定術，牠不動了）','（全體驅蟲，一隻都不放過）','乖，不會痛的。'],
  /* 淺山 */
  wd_leopard            :['（幼獸低低地叫了一聲）','（幼豹縮進樹冠陰影裡）','（牠壓低身子，一動不動）',''],
  wd_leopard_2          :['（雲紋在枝葉間閃過）','（牠在枝上一閃）','（後腿蓄力，隨時撲出）','（雲紋在枝葉間閃過）'],
  wd_leopard_3          :['（一聲長嘯，林間再無聲響）','（焰紋護體，靠近就燙）','（火光沿著雲紋燒起來）','（一聲長嘯，林間再無聲響）'],
  wd_cat                :['（草叢動了一下，又靜了）','（牠鑽進草叢不見了）','（耳朵轉了一圈，全神戒備）',''],
  wd_cat_2              :['（你聽見腳步，卻找不到牠）','（夜色裡，牠側身避開）','（牠跑起來沒有聲音）','（你聽見腳步，卻找不到牠）'],
  wd_cat_3              :['（牠一直都在，只是你沒發現）','（影子動了，牠不見了）','（整片淺山都是牠的巡邏路線）','（牠一直都在，只是你沒發現）'],
  wd_salmon             :['（稚魚在冷泉裡打了個轉）','（牠順著水流溜走了）','（牠往上游看了一眼）',''],
  wd_salmon_2           :['（牠記得水的方向）','（冷泉護體，牠不怕冷）','（牠記得水的方向）','（冰河退了，牠留了下來）'],
  wd_salmon_3           :['（逆流而上，是牠唯一知道的方向）','（源頭之淵，深不見底）','（千萬條魚，一齊逆流）','（逆流而上，是牠唯一知道的方向）'],
  wd_magpie             :['（雛鳥歪頭看了看你）','（雛鳥往樹枝上一跳）','（牠尖聲叫了一下）',''],
  wd_magpie_2           :['（一隻叫了，整群都來了）','（同伴圍了過來）','（一聲銳鳴，全林警戒）','（一隻叫了，整群都來了）'],
  wd_magpie_3           :['（藍色的長尾劃過天空，像一道閃電）','（長尾一掃，風就轉向了）','（尾羽張開，陣風四起）','（藍色的長尾劃過天空）'],
  wd_bear               :['（小熊還不太會用牠的爪子）','（小熊縮成一團）','（牠專心地吃著）',''],
  wd_bear_2             :['（牠站起來了，比你想的還高）','（厚毛皮，打不痛牠）','（牠站起來，發出低吼）','（牠比你想的還高）'],
  wd_bear_3             :['（胸前的白月，是這座山的印記）','（白月護體，堅不可摧）','（一聲吼，整座山都在震）','（胸前的白月，是這座山的印記）'],
  wd_pangolin           :['（牠捲起來了，什麼也不管）','（牠捲成一球，什麼也不管）','（牠往地下鑽了進去）','（鱗甲一片壓一片，咬不動）'],
  wd_pangolin_2         :['（連牙齒都咬不動的殼）','（磐岩之殼，連牙都崩了）','（大地被牠翻了起來）','（絕對防禦。真的絕對）'],
  wd_owl                :['（牠一動也不動，像一塊樹皮）','（牠貼在樹幹上，像塊樹皮）','（牠的瞳孔在黑暗中放大）','（黑暗裡，兩隻眼睛亮著）'],
  wd_owl_2              :['（黑暗裡，只有兩隻眼睛亮著）','（幽羽無聲，抓不到牠）','（暗夜之瞳，全域掃視）','（夜是牠的。你只是闖進來）'],
  wd_squirrel           :['（牠張開了膜，往下一躍）','（牠躲進樹洞裡）','（牠退後幾步，準備助跑）','（牠張開膜，往下一躍）'],
  wd_squirrel_2         :['（樹冠之間，一道白光掠過）','（風膜一張，滑開了）','（林冠之間，一道白光）','（快得像打雷）'],
  /* 特殊 */
  sp_quewue             :['隨便啦！','就是這樣喵～','要多久！！！','⋯⋯答案，我早就看穿了。'],
  sp_nanshan            :['這題我猜的，但我猜對了。','（豹紋一閃，牠躲開了）','（牠對著考卷拜了一下）','一舉登科——中了！'],
  sp_maomao             :['錯了？塗掉就好啦。','（塗掉就沒事了）','（整張重寫一次）','錯了？塗掉就好啦。'],
  /* 新形態與解鎖貓 */
  my_seraph_shield  :['六翼合攏——此處不容侵犯。','（六翼聖盾，火焰化為屏障）','（庇護之光落下）','不燃之盾，護住身後的一切。'],
  oa_curie_beam     :['數據不會騙人。看好了。','（觀測遮罩，誤差歸零）','（校準完畢，偏差 0.01）','精準測定——你的弱點在這裡。'],
  zl_guanyu_blade   :['青龍出海，斬！','（橫刀立馬，一夫當關）','（溫酒未冷，刀已還鞘）','刀鋒所指，即是歸途。'],
  sh_wu_drunk       :['站不穩才打得到你。','（踉蹌樁，歪歪斜斜卻倒不了）','（醉意上湧，身法更飄）','醉裡乾坤大——來，再喝。'],
  cat_myth          :['（牠在神壇上翻了個身，光就跟著轉了個方向）','（聖壇臥姿，連神像的影子都繞著走）','（牠豎起耳朵聽了一下）','神殿的午睡——睡飽就沒事了。'],
  cat_oath          :['（牠坐在圓桌下面。那個位置從來沒有人跟牠爭）','（圓桌下的座位，誰也打不到）','（牠慢條斯理地磨著爪子）','無名騎士——貓在桌上時，不准吵架。'],
  cat_sengoku       :['（天守閣最高那一層，是牠先住進去的）','（瓦上疾走，屋簷是牠的高地）','（牠假裝要跑，然後回身一爪）','天守閣的主人——這座城我守四次了。'],
  cat_zhulu         :['（牠在硯台旁邊看了整晚。誰寫了什麼，牠都知道）','（硯台後的陰影，你找不到牠）','（牠盯著你看，破綻自己會浮出來）','書房的第三隻眼——我什麼都看見了。'],
  cat_shuihu        :['（牠在這間店賒了三年的魚。老闆一次也沒趕過牠）','（靠著酒缸坐下，誰也推不動）','（那一桌連人帶菜全翻了）','賒帳的老主顧——這頓也記我帳上。'],
  cat_major         :['（牠在圖書館待了很多年。哪一排放什麼書，牠比館員還清楚）','（牠躲進書堆，你得把書全搬開）','（牠跑過去時，整排書都翻了一頁）','永遠的旁聽生——這本你要找的，在這裡。'],
  cat_wild          :['（牠不屬於任何人。牠只是每天都走同一條山徑）','（貼進石縫，那塊石頭本來就長那樣）','（牠出爪的時候，風才跟上來）','淺山的常客——這條路，我走了三年。'],
};

/* ── 角色立繪 ────────────────────────────────────────────────
   來源：Google Drive 直連（lh3.googleusercontent.com/d/檔案ID）。
   圖片要設成「知道連結的任何人皆可檢視」，否則會載入失敗。
   沒有列在這裡的角色，會自動使用陣營色的替代卡。 */
const IMAGE_OVERRIDES = {
  sp_nanshan        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sp_nanshan.webp?v=c21f531635',
  sp_maomao         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sp_maomao.webp?v=b58fd99309',
  my_zeus          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_zeus.webp?v=60cf43de42',
  my_zeus_bolt     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_zeus_bolt.webp?v=cb26007317',
  my_athena        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_athena.webp?v=47b9edd0d1',
  my_athena_aegis  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_athena_aegis.webp?v=6e2a905f79',
  my_poseidon      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_poseidon.webp?v=3552e58bb9',
  my_thor          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_thor.webp?v=3853daa0f0',
  my_loki          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_loki.webp?v=b6d21d5196',
  my_fenrir        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_fenrir.webp?v=bbf46b07b7',
  my_fenrir_free   : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_fenrir_free.webp?v=6729d5ce85',
  my_seraph        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_seraph.webp?v=844fd7b6e4',
  my_seraph_shield : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_seraph_shield.webp?v=5920466585',
  my_seraph_open   : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_seraph_open.webp?v=ccd151d96a',
  my_cherub        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_cherub.webp?v=ee9d0ecd80',
  my_dominion      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/my_dominion.webp?v=3e1b8311db',
  oa_arthur        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_arthur.webp?v=8ef241fda7',
  oa_arthur_2      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_arthur_2.webp?v=a538c06411',
  oa_arthur_3      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_arthur_3.webp?v=09f1f81708',
  oa_lancelot      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_lancelot.webp?v=30a7b4183a',
  oa_robin         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_robin.webp?v=5e183d33c3',
  oa_nightingale   : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_nightingale.webp?v=c2d6c2a283',
  oa_turing        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_turing.webp?v=a15c454efb',
  oa_curie         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_curie.webp?v=c06cd0dd2a',
  oa_curie_beam    : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_curie_beam.webp?v=a2e80dbe81',
  oa_curie_rad     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/oa_curie_rad.webp?v=8d62fa7791',
  sg_nobunaga      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_nobunaga.webp?v=0f655c3ef6',
  sg_nobunaga_demon: 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_nobunaga_demon.webp?v=e20e199cfd',
  sg_shingen       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_shingen.webp?v=094a36e3ad',
  sg_kenshin       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_kenshin.webp?v=f515a1d16e',
  sg_masamune      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_masamune.webp?v=d1b2e4161e',
  sg_yukimura      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_yukimura.webp?v=78e8cb1536',
  sg_hideyoshi     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_hideyoshi.webp?v=7b4f0159cc',
  sg_hideyoshi_2   : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_hideyoshi_2.webp?v=fb54f8cb9d',
  sg_hideyoshi_3   : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_hideyoshi_3.webp?v=f8bc3ff93b',
  sg_ieyasu        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_ieyasu.webp?v=82bade9e37',
  sg_ieyasu_shogun : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_ieyasu_shogun.webp?v=d97fceab84',
  sg_mitsuhide     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sg_mitsuhide.webp?v=04de76b01e',
  zl_baiqi         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_baiqi.webp?v=860d091e9f',
  zl_lianpo        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_lianpo.webp?v=cb59da255d',
  zl_zhangyi       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhangyi.webp?v=06a1df9651',
  zl_zhangyi_zong  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhangyi_zong.webp?v=a1574fb432',
  zl_zhangyi_heng  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhangyi_heng.webp?v=b107419500',
  zl_jingke        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_jingke.webp?v=74c01f5c0f',
  zl_jingke_dagger : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_jingke_dagger.webp?v=0632d0e059',
  zl_xiangyu       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_xiangyu.webp?v=8c4ca2e72b',
  zl_xiangyu_gaixia: 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_xiangyu_gaixia.webp?v=2d2dc9a394',
  zl_hanxin        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_hanxin.webp?v=3809bc3dea',
  zl_hanxin_2      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_hanxin_2.webp?v=cacd3e29cb',
  zl_hanxin_3      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_hanxin_3.webp?v=d32692058f',
  zl_zhangliang    : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhangliang.webp?v=6087e0b071',
  zl_zhangliang_2  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhangliang_2.webp?v=af5948c16c',
  zl_zhangliang_3  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhangliang_3.webp?v=52db14eee1',
  zl_xiaohe        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_xiaohe.webp?v=341fadad5c',
  zl_liubang       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_liubang.webp?v=5d4c3ac1ac',
  zl_liubang_2     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_liubang_2.webp?v=b2100fa895',
  zl_liubang_3     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_liubang_3.webp?v=85a559418e',
  zl_fanzeng       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_fanzeng.webp?v=7d0c7e1d7d',
  zl_lvbu          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_lvbu.webp?v=0371a4a37d',
  zl_lvbu_ji       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_lvbu_ji.webp?v=76fd57175c',
  zl_lvbu_horse    : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_lvbu_horse.webp?v=4273203dbc',
  zl_lvbu_bow      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_lvbu_bow.webp?v=0f63406a18',
  zl_guanyu        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_guanyu.webp?v=6e6e761ee3',
  zl_guanyu_blade  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_guanyu_blade.webp?v=53aa07b0fc',
  zl_guanyu_horse  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_guanyu_horse.webp?v=f480ed72a6',
  zl_zhaoyun       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhaoyun.webp?v=8510f15e91',
  zl_zhugeliang    : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhugeliang.webp?v=eaa09a5f03',
  zl_zhugeliang_2  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhugeliang_2.webp?v=f67a1d576e',
  zl_zhugeliang_3  : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhugeliang_3.webp?v=83bb690382',
  zl_zhouyu        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_zhouyu.webp?v=128062e80b',
  zl_simayi        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/zl_simayi.webp?v=71f51ec78f',
  sh_lu            : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_lu.webp?v=7dd0584ecd',
  sh_lin           : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_lin.webp?v=3af6a46a44',
  sh_lin_snow      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_lin_snow.webp?v=4668c1d18d',
  sh_wu            : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_wu.webp?v=96784b7207',
  sh_wu_drunk      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_wu_drunk.webp?v=c332a2aa43',
  sh_wu_blade      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_wu_blade.webp?v=1ea6ac1641',
  sh_li            : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_li.webp?v=07d2b0573a',
  sh_li_rage       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_li_rage.webp?v=f33a220e8e',
  sh_wuyong        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_wuyong.webp?v=ceaab00bcd',
  sh_dai           : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_dai.webp?v=b6956c0975',
  sh_song          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_song.webp?v=75bb27ca5a',
  sh_song_rain     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_song_rain.webp?v=03cbd82c2f',
  sh_song_lord     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/sh_song_lord.webp?v=611fc00a86',
  mj_moyan         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_moyan.webp?v=83629e383b',
  mj_moyan_2       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_moyan_2.webp?v=0cd8451003',
  mj_moyan_3       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_moyan_3.webp?v=ca60329f4a',
  mj_aili          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_aili.webp?v=ef7475dff0',
  mj_aili_sim      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_aili_sim.webp?v=1c266436b6',
  mj_shike         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_shike.webp?v=41f4512347',
  mj_xuansi        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_xuansi.webp?v=7282bd45cd',
  mj_lvming        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_lvming.webp?v=5428ef5bad',
  mj_lvming_2      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_lvming_2.webp?v=e00493a540',
  mj_lvming_3      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_lvming_3.webp?v=9312a444c7',
  mj_jingwei       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_jingwei.webp?v=41d91563ed',
  mj_ama           : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_ama.webp?v=0b87901d73',
  mj_ama_2         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_ama_2.webp?v=679ae0d068',
  mj_ama_3         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_ama_3.webp?v=f30b0abce5',
  mj_dianguang     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_dianguang.webp?v=158de6627a',
  mj_gangchi       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_gangchi.webp?v=50bea01e19',
  mj_gangchi_exo   : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_gangchi_exo.webp?v=444a639183',
  mj_ouji          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_ouji.webp?v=61292dc84c',
  mj_renxin        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_renxin.webp?v=924e6d8498',
  mj_renxin_2      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_renxin_2.webp?v=6e0a362778',
  mj_renxin_3      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_renxin_3.webp?v=87fd45e904',
  mj_maomao        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/mj_maomao.webp?v=11f2f0840b',
  wd_leopard       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_leopard.webp?v=10d329e750',
  wd_leopard_2     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_leopard_2.webp?v=14a8807b07',
  wd_leopard_3     : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_leopard_3.webp?v=56ec0a214a',
  wd_cat           : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_cat.webp?v=f8368f483a',
  wd_cat_2         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_cat_2.webp?v=ea132e5ef3',
  wd_cat_3         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_cat_3.webp?v=24427a292f',
  wd_salmon        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_salmon.webp?v=ed8ee1d6f3',
  wd_salmon_2      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_salmon_2.webp?v=5ee89932d3',
  wd_salmon_3      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_salmon_3.webp?v=6a8abc4357',
  wd_magpie        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_magpie.webp?v=f7c3c64a68',
  wd_magpie_2      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_magpie_2.webp?v=e26d493cc9',
  wd_magpie_3      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_magpie_3.webp?v=0dde81bf77',
  wd_bear          : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_bear.webp?v=06e91a2679',
  wd_bear_2        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_bear_2.webp?v=06958db94c',
  wd_bear_3        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_bear_3.webp?v=f715c9be74',
  wd_pangolin      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_pangolin.webp?v=89efcae53a',
  wd_pangolin_2    : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_pangolin_2.webp?v=655f37799a',
  wd_owl           : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_owl.webp?v=c37c57a092',
  wd_owl_2         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_owl_2.webp?v=de19bf6103',
  wd_squirrel      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_squirrel.webp?v=13d7251c23',
  wd_squirrel_2    : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/wd_squirrel_2.webp?v=81c4856c57',
  cat_myth         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/cat_myth.webp?v=682df0da42',
  cat_oath         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/cat_oath.webp?v=2169d8fa53',
  cat_sengoku      : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/cat_sengoku.webp?v=61494ab1c7',
  cat_zhulu        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/cat_zhulu.webp?v=c7b5fc6445',
  cat_shuihu       : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/cat_shuihu.webp?v=c127f34c56',
  cat_major        : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/cat_major.webp?v=a0b7877bf0',
  cat_wild         : 'https://s90194yeu-collab.github.io/atkqa-game/assets/img/cat_wild.webp?v=c4c376662d',
};


/* Drive 的分享連結轉成可以直接當圖片用的網址 */
function normalizeImgUrl(u){
  if(!u) return u;
  /* GitHub 版：試算表填的 Drive 圖，若 GitHub 上已有同一張就改用 GitHub */
  const gid = String(u).match(/(?:\/d\/|[?&]id=|\/file\/d\/)([A-Za-z0-9_-]{20,})/);
  if(gid && window.ATKQA_ASSETS && ATKQA_ASSETS.img[gid[1]]) return ATKQA_ASSETS.img[gid[1]];
  const m = String(u).match(
    /drive\.google\.com\/(?:file\/d\/|open\?id=|thumbnail\?id=|uc\?(?:[\w=&]*?)id=)([A-Za-z0-9_-]{15,})/);
  return m ? ('https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w600') : u;
}
/* 也可以完全不動程式碼：在試算表建一張「圖片」工作表（A 欄角色ID、B 欄網址），
   或把圖片丟進指定的 Drive 資料夾（檔名＝角色ID），啟動時會自動套用。 */

const UNIVERSE_COLOR = {
  myth:'#f2ad00', oath:'#4b7ff0', sengoku:'#ff7a3a', zhulu:'#e8465b',
  shuihu:'#3fae62', major:'#14b5a6', wild:'#b0773f', special:'#9c64f0'
};

/* ── 特色能力演出動畫 ────────────────────────────────────────
   發動特色能力時全螢幕播放的動態 WebP。
   來源：原創版/攻擊影片/<陣營>/<角色名稱>　（由 MP4 轉成動態 WebP）
   只有最高階型態有動畫（中間進化階段沿用立繪）。

   用動態 WebP 而不是 MP4 的原因：
   <img> 就能播，不受瀏覽器自動播放政策限制，也沒有 Content-Type、
   range request、CORS 這些問題 —— 立繪走同一條路，已經證實可用。
   檔案必須設為「知道連結的任何人皆可檢視」。 */
const ATTACK_ANIMS = {
  /* ── 神域 ── */
  my_zeus_bolt     : 'https://lh3.googleusercontent.com/d/1rRPJtG2DpFkQEbQAvNsiVg3ra9netBJC',   // 雷霆權杖・宙斯
  my_athena_aegis  : 'https://lh3.googleusercontent.com/d/1iKg6RLa0Uz9wfkKIiQmhfRHzp99-JVS6',   // 神盾持有・雅典娜
  my_poseidon      : 'https://lh3.googleusercontent.com/d/1vWE-M8XvHaBrXMg8G3EIE1EkFPtrSVY2',   // 怒海之主・波賽頓
  my_thor          : 'https://lh3.googleusercontent.com/d/1QGD8cKdfBRkR_bkkIiAjAft9OFD8fZH5',   // 雷槌之主・索爾
  my_loki          : 'https://lh3.googleusercontent.com/d/1AINJp5wY8UfC4F3JO741EBsBPOqmhb0H',   // 詭計之神・洛基
  my_fenrir_free   : 'https://lh3.googleusercontent.com/d/1OPE9vT-1OxWOWLMYRcajC_bGO224_e0Y',   // 掙鎖巨狼・芬里爾
  my_seraph_shield : 'https://lh3.googleusercontent.com/d/1teGM_SvYzfmkq7k9ef9ogl38F_irZBdW',   // 聖盾・熾天使
  my_seraph_open   : 'https://lh3.googleusercontent.com/d/1bplpmXdadZGxoyyHJ8C3XbdgZ_QVL11f',   // 六翼展開・熾天使
  my_cherub        : 'https://lh3.googleusercontent.com/d/1ct4EZDQhmeFiUGxPAlrc92PEyBfzHUrj',   // 四面之瞳・智天使
  my_dominion      : 'https://lh3.googleusercontent.com/d/11xmK7-ToqeMHiteYVCtKCajwiNqsObDx',   // 執權掌轄・主天使
  /* ── 誓約 ── */
  oa_arthur_3      : 'https://lh3.googleusercontent.com/d/1FpDfu8kW1IwTWAzLw6FGdiy_GYfcjpuL',   // 王者之劍・亞瑟王
  oa_lancelot      : 'https://lh3.googleusercontent.com/d/1D64fy0adNo6oPQ2AUykc6mOJl3anRZxe',   // 湖上騎士・蘭斯洛特
  oa_robin         : 'https://lh3.googleusercontent.com/d/1_ZqyYLDZ778Inwe3yRbQqAo-sZjgX-li',   // 綠林神射・羅賓漢
  oa_nightingale   : 'https://lh3.googleusercontent.com/d/1x9mGVcmfjgyZfRb9wmM89UBL2CcVYeQg',   // 提燈天使・南丁格爾
  oa_turing        : 'https://lh3.googleusercontent.com/d/16fw55D0tsUjYI1htYpMfwHPBUb48BT7u',   // 密碼破譯・艾倫圖靈
  oa_curie_beam    : 'https://lh3.googleusercontent.com/d/1ysxIuM9fhkasyqOHf_W3DUqY5EhADvcf',   // 鐳射聚焦・瑪麗居禮
  oa_curie_rad     : 'https://lh3.googleusercontent.com/d/1P80yl_9xnVdXkDp0FBqJg3THWMHbksDz',   // 放射解放・瑪麗居禮
  /* ── 亂世 ── */
  sg_nobunaga_demon: 'https://lh3.googleusercontent.com/d/1F3rfyqiXXi3GEoFZYgg-GtuYTg-QUf_4',   // 第六天魔王・織田信長
  sg_shingen       : 'https://lh3.googleusercontent.com/d/1e9C_QJLFnlV6BzyVHBu2YKDJznwYQu3x',   // 甲斐之虎・武田信玄
  sg_kenshin       : 'https://lh3.googleusercontent.com/d/1HhxbYV21GaYaZiVUhw8yiqtPPhLqHQt1',   // 越後之龍・上杉謙信
  sg_masamune      : 'https://lh3.googleusercontent.com/d/1tcfSuJJa1tOuR1t7_qXQuHD4f310OweT',   // 獨眼龍・伊達政宗
  sg_yukimura      : 'https://lh3.googleusercontent.com/d/1-jY82nvOO6VO-d2mX-w2gUA4rD_LW5OM',   // 日本第一兵・真田幸村
  sg_hideyoshi_3   : 'https://lh3.googleusercontent.com/d/1IxbaIV-htvySQG3ydRnAOsT19TQAtOHM',   // 關白・豐臣秀吉
  sg_ieyasu_shogun : 'https://lh3.googleusercontent.com/d/1wATRD69L7qbINAb3e9sDIMudXF18WpYx',   // 天下人・德川家康
  sg_mitsuhide     : 'https://lh3.googleusercontent.com/d/1AZCNC3V_-bLGdCv7qqRmiYpK3KbgikKi',   // 三日天下・明智光秀
  /* ── 逐鹿 ── */
  zl_baiqi         : 'https://lh3.googleusercontent.com/d/13xHD8i1b2OKgifNYAYn3agvIAURrRxck',   // 人屠・白起
  zl_lianpo        : 'https://lh3.googleusercontent.com/d/1p8DiITzAWaALzdzBCCFtWatzi49nNdjy',   // 負荊請罪・廉頗
  zl_zhangyi_zong  : 'https://lh3.googleusercontent.com/d/1ihOnETkE6zmcBhAcx-aNrk7t9_r3p6eq',   // 合縱・張儀
  zl_zhangyi_heng  : 'https://lh3.googleusercontent.com/d/1Wowi0IBSknhUYA8iMei096NCGl89hQ17',   // 連橫・張儀
  zl_jingke_dagger : 'https://lh3.googleusercontent.com/d/1RRkGvgqZWM1PgAaCRS2WgwkocQXnF-B7',   // 圖窮匕見・荊軻
  zl_xiangyu_gaixia: 'https://lh3.googleusercontent.com/d/19aQU4TKIvBQtNY3zQlz1nTRA3E9iQNCU',   // 垓下絕唱・項羽
  zl_hanxin_3      : 'https://lh3.googleusercontent.com/d/1tDyw8GMzoh063Q-hYLUHztPb3hROEto2',   // 兵仙・韓信
  zl_zhangliang_3  : 'https://lh3.googleusercontent.com/d/1NQbD1XPharg4jN8LfXeX5Nl3oNutkw-w',   // 帝者之師・張良
  zl_xiaohe        : 'https://lh3.googleusercontent.com/d/1dKSv1IGgXL51OJl41a78Z1f4WYbTrWNb',   // 鎮國之柱・蕭何
  zl_liubang_3     : 'https://lh3.googleusercontent.com/d/1oxg9oA5v4JjceqCuD6oAbhV4P-tX1KPC',   // 漢高祖・劉邦
  zl_fanzeng       : 'https://lh3.googleusercontent.com/d/1xU45fInaVnJuIqpaN5zHHWTS3lSiNMYP',   // 亞父之謀・范增
  zl_lvbu_ji       : 'https://lh3.googleusercontent.com/d/146eM1oNC2BoewRTMCSt0zh6VYbQoKaMi',   // 方天畫戟・呂布
  zl_lvbu_horse    : 'https://lh3.googleusercontent.com/d/1KhWxTywHqHmZHdlobwupvZV7WV-oqMPI',   // 赤兔・呂布
  zl_lvbu_bow      : 'https://lh3.googleusercontent.com/d/1PaGyAt4YiAiklBivB0ZTSxCPA50pxdCy',   // 強弓・呂布
  zl_guanyu_blade  : 'https://lh3.googleusercontent.com/d/1SXNdXqYuhnHhQ8ssbmMHqan8aRzEQMQf',   // 青龍偃月・關羽
  zl_guanyu_horse  : 'https://lh3.googleusercontent.com/d/1ZTTWGQ3msiT1CxtzOaEcXQiDCiF2_R4U',   // 赤兔千里・關羽
  zl_zhaoyun       : 'https://lh3.googleusercontent.com/d/1iPeU38MQa8SAdEHejPn5K1aKj0g6YHaH',   // 常山之膽・趙雲
  zl_zhugeliang_3  : 'https://lh3.googleusercontent.com/d/1_0rUl4j3k_d0mHp45-bbYOsht4e3wdYr',   // 八陣圖・諸葛亮
  zl_zhouyu        : 'https://lh3.googleusercontent.com/d/1Wm9rmOO-km56r2HDNM2Uhvor99UGcrlY',   // 美周郎・周瑜
  zl_simayi        : 'https://lh3.googleusercontent.com/d/1T8h1qWI0Qiy2AdKZMa2rRmaogN2vu0J6',   // 冢虎・司馬懿
  /* ── 梁山 ── */
  sh_lu            : 'https://lh3.googleusercontent.com/d/1V7QPMHyrklm2g_1ckBhrZhr8oKaeU_9Z',   // 花和尚・魯智深
  sh_lin_snow      : 'https://lh3.googleusercontent.com/d/1sxweZ-SCjVVZCpy7YZu2_j8wVeVfKp-Y',   // 雪夜上梁山・林沖
  sh_wu_drunk      : 'https://lh3.googleusercontent.com/d/1T0AzboI-2QqSmCpTURbzzmUCO7nR00Iu',   // 醉拳・武松
  sh_wu_blade      : 'https://lh3.googleusercontent.com/d/1bVijpWeP723-OO-4VFkN4qxY8LH0r9sl',   // 雙戒刀・武松
  sh_li_rage       : 'https://lh3.googleusercontent.com/d/1LThQc9WaEja5q4CnxJbsuHozognW2os8',   // 板斧狂化・李逵
  sh_wuyong        : 'https://lh3.googleusercontent.com/d/1BcJmV6O35oIJuitWJ2rsgXjLFeWVwYVG',   // 智多星・吳用
  sh_dai           : 'https://lh3.googleusercontent.com/d/1JmaG9lZpeKEJ9Sa2B5lAS3qoceCuxlqp',   // 神行太保・戴宗
  sh_song_lord     : 'https://lh3.googleusercontent.com/d/12SU_zpiqZJTG-Zp-dRtYrwBdtlP1Z-W-',   // 梁山之主・宋江
  /* ── 學府 ── */
  mj_moyan_3       : 'https://lh3.googleusercontent.com/d/1YjOEj88DS36fqykefeJAe68pfKEuy2Xn',   // 一字千金・墨言
  mj_aili_sim      : 'https://lh3.googleusercontent.com/d/1nOmONlbcZ-niweHkYmEMyr0nCk8hJiCy',   // 同步口譯・艾莉
  mj_shike         : 'https://lh3.googleusercontent.com/d/1y6VFTKW1NU0jGdGHQF7UGATWKztDxqgZ',   // 博古通今・史珂
  mj_xuansi        : 'https://lh3.googleusercontent.com/d/1jXP3jMOzLy2r9PV7_5Aa0TYVEPMhvOzV',   // 叩問不休・玄思
  mj_lvming_3      : 'https://lh3.googleusercontent.com/d/17I_3TmI04qvFwkOf7rNXfQ4lAEB7fr6c',   // 一槌定音・律明
  mj_jingwei       : 'https://lh3.googleusercontent.com/d/1yI0RagurtusKs7l9mcz_LS_0s4x1J4Cd',   // 運籌帷幄・經緯
  mj_ama_3         : 'https://lh3.googleusercontent.com/d/1IpDYrGQT_p8VBw2AMEjgLypQXP0m1Z_B',   // 系統架構・阿碼
  mj_dianguang     : 'https://lh3.googleusercontent.com/d/1gqjRp3czfTslFMmSh4WnYIUwPRoOQsF1',   // 萬伏之心・電光
  mj_gangchi_exo   : 'https://lh3.googleusercontent.com/d/1Mcq80Zr7rnQBqAMjKCkq0Gz0t7bJ5vXg',   // 動力外骨骼・鋼齒
  mj_ouji          : 'https://lh3.googleusercontent.com/d/1G2z9dYPp2lBLzmL7qP57OQF4-Jt8Bwu2',   // 算無遺策・歐幾
  mj_renxin_3      : 'https://lh3.googleusercontent.com/d/1XfTTNYsPJHrjuIxmcy9dMKqsFHllnng9',   // 華佗再世・仁心
  mj_maomao        : 'https://lh3.googleusercontent.com/d/1TbFwvz2IpT4QRIIEYpoVpFkeRzKkQuIW',   // 貓中神醫・毛毛
  /* ── 淺山 ── */
  wd_leopard_3     : 'https://lh3.googleusercontent.com/d/1BLnBNZ9Zn__2ehSYcvWxLXlk49O7dYy8',   // 雲紋焰豹
  wd_cat_3         : 'https://lh3.googleusercontent.com/d/1pGiSCpsfRUX6QI0XmHQ9ZRk3pgTJpDcp',   // 淺山之王
  wd_salmon_3      : 'https://lh3.googleusercontent.com/d/1GYNVB7bGYGo1EWwIp_37QPspfXI-nLqM',   // 溯源鮭王
  wd_magpie_3      : 'https://lh3.googleusercontent.com/d/1vU4o28DLR6TvJ9gHOX_3WrEwsZwsi_hH',   // 長尾風鵲
  wd_bear_3        : 'https://lh3.googleusercontent.com/d/10BuKakgKG-HpKb9ugRr8wMN5QeUfWCub',   // 白月胸熊
  wd_pangolin_2    : 'https://lh3.googleusercontent.com/d/1LOiRANOeOR2Gdt1HNpq807tcSh1v2j7y',   // 磐岩甲獸
  wd_owl_2         : 'https://lh3.googleusercontent.com/d/1ZII2kFrzRyNw_OfBRd93Npb1MnwofFfZ',   // 夜幕冥鴞
  wd_squirrel_2    : 'https://lh3.googleusercontent.com/d/1f7fDb9XcbAGP_4DhK3aJJ4RuyxKnDNE0',   // 疾雷飛鼯
  /* ── 神域 ── */
  cat_myth         : 'https://lh3.googleusercontent.com/d/1YjGL0T4nzkNwgXwuYTOB9-Ji-Kj8_kJi',   // 神殿白貓・涅菲
  /* ── 誓約 ── */
  cat_oath         : 'https://lh3.googleusercontent.com/d/1o7XgMmopO3XmVVzfADCgp_TPigu2KmYD',   // 圓桌灰貓・卡洛
  /* ── 亂世 ── */
  cat_sengoku      : 'https://lh3.googleusercontent.com/d/1x66mbz6r68zuog1ntt09v1TpNX3nbgx6',   // 城下三花・阿市
  /* ── 逐鹿 ── */
  cat_zhulu        : 'https://lh3.googleusercontent.com/d/15Efhsjdo-HiN3ocl12INUCIH5wTLeRrO',   // 墨玉黑貓・玄離
  /* ── 梁山 ── */
  cat_shuihu       : 'https://lh3.googleusercontent.com/d/1clKk8Px7ZGQMQrxPDYjJ0fB_d107LHhE',   // 酒肆虎斑・大郎
  /* ── 學府 ── */
  cat_major        : 'https://lh3.googleusercontent.com/d/1THbTDIXhDMUT90p7zR64WKE4P3PpjCY2',   // 圖書館貓・卷卷
  /* ── 淺山 ── */
  cat_wild         : 'https://lh3.googleusercontent.com/d/1zOmSrakKuOtqVpUl0uv2mHm-eMWo0JxX',   // 山徑石紋・阿淺
};

/* 產生替代卡（純 SVG，不需外部檔案） */
function placeholderImg(name, universe){
  const col = UNIVERSE_COLOR[universe] || '#8899aa';
  const esc = t => t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const clean = String(name||'?').replace(/[（(].*$/,'').replace(/\s/g,'').trim();
  // 每行兩個字，最多三行；超過就在第三行結尾加省略號
  const lines = [];
  for(let k = 0; k < clean.length && lines.length < 3; k += 2) lines.push(clean.substr(k, 2));
  if(clean.length > 6 && lines.length === 3) lines[2] = lines[2].substr(0,1) + '…';
  const fs = lines.length >= 3 ? 34 : 42;
  const lh = fs + 6;
  const top = 200 - (lines.length - 1) * lh / 2;   // 讓整組字在下半部置中
  const texts = lines.map((t,idx)=>
    '<text x="105" y="' + (top + idx*lh) + '" text-anchor="middle" font-size="' + fs +
    '" font-family="sans-serif" font-weight="bold" fill="#ffffff" opacity="0.95" ' +
    'letter-spacing="2">' + esc(t) + '</text>').join('');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 280">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + col + '" stop-opacity="0.42"/>' +
      '<stop offset="1" stop-color="' + col + '" stop-opacity="0.04"/>' +
    '</linearGradient></defs>' +
    '<rect x="8" y="8" width="194" height="264" rx="16" fill="url(#g)" stroke="' + col + '" stroke-width="2.5"/>' +
    '<circle cx="105" cy="96" r="42" fill="none" stroke="' + col + '" stroke-width="2" stroke-dasharray="7 6" opacity="0.6"/>' +
    '<circle cx="105" cy="96" r="16" fill="' + col + '" opacity="0.55"/>' +
    texts +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* 綁定圖片：關閉 referer（部分網站以此擋外連）、失敗時換上替代卡 */
/* 角色台詞：出招時在頭上冒出對白框 */
function say(ch, kind, side, foeIdx){
  const q = QUOTES[ch.id];
  if(!q) return;
  const idx = {attack:0, guard:1, skill:2, ability:3}[kind];
  const text = q[idx];
  if(!text) return;

  // 非主目標的敵人：台詞掛在牠自己的小卡上，不要蓋住主角色
  if(side === 'e' && foeIdx !== undefined && foeIdx !== S.target){
    const card = $('foe-list') && $('foe-list').children[foeSlot(foeIdx)];
    if(card){
      const old = card.querySelector('.mini-say');
      if(old) old.remove();
      const el = document.createElement('div');
      el.className = 'mini-say';
      el.textContent = text.length > 18 ? text.slice(0, 18) + '…' : text;
      card.appendChild(el);
      setTimeout(function(){ el.remove(); }, paceMs(2400));
    }
    log('💬 ' + ch.name + '：' + text, 'var(--dim)');
    return;
  }

  const host = $(side === 'p' ? 'f-p' : 'f-e');
  if(!host) return;
  const old = host.querySelector('.speech');
  if(old) old.remove();
  const el = document.createElement('div');
  el.className = 'speech';
  el.textContent = text;
  host.appendChild(el);
  setTimeout(function(){
    el.classList.add('out');
    setTimeout(function(){ el.remove(); }, 300);
  }, paceMs(2600));
}

/* 合體支援演出：一定會顯示夥伴（沒有圖就用替代立繪） */
function assistCutIn(ally, label){
  return new Promise(function(resolve){
    const wrap = document.createElement('div'); wrap.className = 'cutin assist-cut';
    const im = document.createElement('img');
    im.referrerPolicy = 'no-referrer';
    im.onerror = function(){ im.onerror = null; im.src = ally.ph; };
    const cap = document.createElement('span'); cap.textContent = label + '　' + ally.name;
    wrap.append(im, cap); document.body.appendChild(wrap);
    im.src = ally.img || ally.ph;
    setTimeout(function(){
      wrap.classList.add('out');
      setTimeout(function(){ wrap.remove(); }, 420);
      resolve();
    }, paceMs(1800));
  });
}

/* 出招演出：有圖才播，沒圖或載入失敗就直接跳過 */
/* 判斷是不是 GIF：只要路徑中出現 .gif 即可。
   維基類網址常把副檔名放在路徑中間，例如
   …/炎舞.gif/revision/latest/scale-to-width-down/180?cb=…
   所以不能只認結尾；但也不能誤判 a.gifted.png 這種。 */
/* 判斷是不是動圖（立繪用；演出影片走另一條路） */
const isGif = u => /\.gif(?![a-z0-9])/i.test(String(u || ''));

/* 特色能力演出：一場一次的高光時刻，快速模式也照播（只是短一點）。
   演出圖載入失敗時退回角色立繪，永遠會有畫面回饋。 */
/* 從 Drive 網址取出檔案 ID（分享連結、preview、直連格式都認得） */
function driveId(u){
  const m = String(u || '').match(/(?:\/d\/|[?&]id=)([A-Za-z0-9_-]{15,})/);
  return m ? m[1] : '';
}

/* ── 演出動畫預載 ──────────────────────────────────────────
   答題階段就把待會用得到的動態 WebP 抓進瀏覽器快取，
   出招時直接顯示，不會出現空白等待。
   動態 WebP 用 <img> 播，不受自動播放政策限制，也沒有 CORS 問題。 */
const ANIM_CACHE = {};
/* GitHub 版：演出動畫依「角色名稱.webp」放在 GitHub 的 assets/anim/。
   檔案還沒上傳時會自動退回 Drive 的網址，不會壞掉。 */
const ANIM_OK = {}, ANIM_FILE = {};
let ANIM_MISS = {};
try{ ANIM_MISS = JSON.parse(sessionStorage.getItem('atkqa_anim_miss') || '{}'); }catch(e){}
function ghAnim(ch){
  const f = ANIM_FILE[ch.id];
  return (f && window.ATKQA_SITE) ? (ATKQA_SITE + 'assets/anim/' + encodeURIComponent(f) + '.webp') : '';
}
function animSources(ch){
  if(!ch || !ch.atkAnim) return [];
  if(ANIM_OK[ch.id]) return [ANIM_OK[ch.id]];
  const gh = ghAnim(ch), out = [];
  if(gh && !ANIM_MISS[gh]) out.push(gh);
  out.push(ch.atkAnim);
  return out;
}
function markAnim(ch, url, ok){
  if(ok){ ANIM_OK[ch.id] = url; return; }
  if(url === ghAnim(ch)){
    ANIM_MISS[url] = 1;
    try{ sessionStorage.setItem('atkqa_anim_miss', JSON.stringify(ANIM_MISS)); }catch(e){}
  }
}
function preloadAnimFor(ch){
  const srcs = animSources(ch);
  let i = 0;
  const next = function(){
    if(i >= srcs.length) return;
    const url = srcs[i++];
    const im = preloadAnim(url);
    if(im.complete && im.naturalWidth){ markAnim(ch, url, true); return; }
    im.addEventListener('load', function(){ markAnim(ch, url, true); }, {once:true});
    im.addEventListener('error', function(){ markAnim(ch, url, false); delete ANIM_CACHE[url]; next(); }, {once:true});
  };
  next();
}
function preloadAnim(url){
  if(!url) return null;
  if(ANIM_CACHE[url]) return ANIM_CACHE[url];
  const im = new Image();
  im.referrerPolicy = 'no-referrer';
  im.decoding = 'async';
  im.src = url;
  ANIM_CACHE[url] = im;
  return im;
}

/* ── 檢測工具 ────────────────────────────────────────────
   在主控台輸入 checkAnims() 會逐一測試演出動畫是否載得到。 */
function checkAnims(n){
  n = n || 8;
  const ids = Object.keys(ATTACK_ANIMS).slice(0, n);
  console.log('開始檢測 ' + ids.length + ' 支演出動畫…');
  ids.forEach(function(id){
    const ch = ALL_CHARACTERS.filter(c=>c.id===id)[0];
    const im = new Image();
    im.referrerPolicy = 'no-referrer';
    im.onload  = function(){
      console.log('✅ ' + (ch ? ch.name : id) + '　' + im.naturalWidth + '×' + im.naturalHeight);
    };
    im.onerror = function(){
      console.log('❌ ' + (ch ? ch.name : id) + '　載入失敗（檢查分享權限是否為「知道連結的任何人」）');
    };
    im.src = ATTACK_ANIMS[id];
  });
  return '檢測已送出，結果會陸續出現在主控台。';
}

/* 每題開始時呼叫：把我方與敵方的演出動畫先抓下來 */
function warmAnims(){
  const list = [S.player].concat((S.foes && S.foes.length) ? S.foes : [S.enemy]);
  list.forEach(function(c){ if(c && c.atkAnim) preloadAnimFor(c); });
}

/* 特色能力演出：一場一次的高光時刻。
   來源依序嘗試：影片 → 圖片 → 角色立繪 → 替代卡，永遠會有畫面回饋。 */
/* 特色能力演出：一場一次的高光時刻。
   最高階型態有專屬 MP4，其餘退回角色立繪。
   影片一定要能自己播起來 —— 沒有播放鍵、沒有控制列、手機不跳全螢幕。 */
function cutIn(ch, moveName){
  return new Promise(function(resolve){
    const wrap = document.createElement('div'); wrap.className = 'cutin';
    const cap = document.createElement('span'); cap.textContent = moveName;
    wrap.appendChild(cap); document.body.appendChild(wrap);

    let done = false, node = null;
    const close = function(hold, why){
      if(done) return; done = true;
      if(why) log(why, 'var(--dim)');
      setTimeout(function(){
        wrap.classList.add('out');
        setTimeout(function(){ wrap.remove(); }, 420);
      }, hold);
      resolve();
    };

    /* 依序嘗試：演出動畫 → 角色立繪 → 替代卡。永遠會有畫面回饋。 */
    const tries = [];
    animSources(ch).forEach(function(u){ tries.push({url:u, anim:true}); });
    if(ch.img)     tries.push({url:ch.img,     anim:false});
    if(ch.ph)      tries.push({url:ch.ph,      anim:false});

    let i = 0;
    const step = function(){
      if(i >= tries.length){
        if(node) node.remove();
        close(CONFIG.cutInHold, '🎬 演出素材無法載入，僅顯示招式名。');
        return;
      }
      const cur = tries[i++];
      const im = document.createElement('img');
      im.referrerPolicy = 'no-referrer';
      im.onerror = function(){
        if(cur.anim) markAnim(ch, cur.url, false);
        if(cur.anim && !(tries[i] && tries[i].anim)) log('🎬 演出動畫載入失敗，改用角色立繪。', 'var(--dim)');
        step();
      };
      im.onload = function(){
        if(cur.anim) markAnim(ch, cur.url, true);
        /* 動畫播完整段才收，靜態圖只停留短時間 */
        const hold = cur.anim ? CONFIG.cutInAnim : CONFIG.cutInHold;
        close(hold, cur.anim ? '🎬 演出：動畫播放中' : null);
      };
      if(node) node.remove();
      node = im; wrap.insertBefore(im, cap);
      /* 預載過的話瀏覽器會直接從快取取用，不會重新下載 */
      im.src = cur.url;
    };
    step();
  });
}

function bindImg(el, ch){
  el.referrerPolicy = 'no-referrer';
  const alts = [];
  const m = String(ch.img || '').match(/thumbnail\?id=([A-Za-z0-9_-]+)/);
  if(m) alts.push('https://drive.google.com/uc?export=view&id=' + m[1]);
  let i = 0;
  el.onerror = function(){
    if(i < alts.length){ el.src = alts[i++]; return; }   // Drive 換另一種取圖方式再試
    el.onerror = null; el.src = ch.ph;                   // 都失敗才用替代立繪
  };
  el.src = ch.img;
}

/* 依威力補上命中率與鋼彈彈藥上限，並準備圖片 */
/* 彈藥系統已移除：每回合補滿、上限遠高於題數，形同虛設 */
ALL_CHARACTERS.forEach(c=>{
  c.moves.forEach(m=>{
    m.acc = (m.accFixed !== undefined) ? m.accFixed : accOf(m.power);
    if(m.kind === 'aoe' && m.accFixed === undefined) m.acc = Math.max(35, m.acc - CONFIG.aoeAccPenalty);
  });
  c.role = ROLE_BY_ID[c.id] || 'balance';
  c.baseHp = c.hp;                             // 保留原始值，供試算表覆寫後重算
  c.hp = Math.round(c.hp * roleOf(c).hp);      // 血量依定位調整
  c.ph = placeholderImg(c.name, c.universe);
  if(IMAGE_OVERRIDES[c.id]) c.img = normalizeImgUrl(IMAGE_OVERRIDES[c.id]);
  /* 演出動畫：保留原始網址。
     不能走 normalizeImgUrl —— 那支會轉成 thumbnail（靜態縮圖），動畫就不會動了。 */
  if(ATTACK_ANIMS[c.id]){ c.atkAnim = ATTACK_ANIMS[c.id]; ANIM_FILE[c.id] = c.name; }
  if(!c.img) c.img = c.ph;
});

/* ============================================================================
   精神指令（參考超級機器人大戰）
   ── SP 由答題取得：全對 +3、部分正確 +1、答錯 +0
   ── 每題行動前可花 SP 發動一道，效果立即生效
   ========================================================================== */
const SPIRITS = {
  focus  : {name:'集中', sp:2, icon:'🎯', desc:'2 回合內命中 +25、閃避 +15'},
  hit    : {name:'必中', sp:3, icon:'✔️', desc:'下一擊必定命中，無視閃避'},
  dodge  : {name:'必閃', sp:3, icon:'💨', desc:'下一次被攻擊必定閃過，無視對手命中率'},
  accel  : {name:'加速', sp:2, icon:'⚡', desc:'本回合必定搶得先攻'},
  hotblood:{name:'熱血', sp:5, icon:'🔥', desc:'本次攻擊傷害 ×2（可與「魂」疊加）'},
  soul   : {name:'魂',   sp:8, icon:'💥', desc:'本次攻擊傷害 ×2.5 且必定會心（可與「熱血」疊加成 ×3.5）'},
  iron   : {name:'鐵壁', sp:4, icon:'🛡️', desc:'本回合受到的傷害 ×0.25'},
  guts   : {name:'根性', sp:4, icon:'❤️', desc:'立刻回復 35% 體力'},
  luck   : {name:'幸運', sp:4, icon:'🍀', desc:'本題的戰鬥分數 ×2（擊破、擋下、反擊）'},
  bless  : {name:'祝福', sp:4, icon:'🌟', desc:'本題的答題分數 ×2'},
  friend : {name:'友情', sp:3, icon:'🤝', desc:'本次行動必定發動合體支援'},
  awaken : {name:'覺醒', sp:9, icon:'🌀', desc:'本題可以再行動一次'}
};
/* 每個定位能用的指令不同，形成各自的玩法 */
const ROLE_SPIRITS = {
  attacker: ['hotblood','hit','soul','luck','accel'],
  guard   : ['iron','bless','guts','focus','friend'],
  tank    : ['guts','iron','bless','hotblood','friend'],
  lucky   : ['luck','dodge','focus','soul','bless'],
  swift   : ['accel','hit','focus','awaken','luck'],
  balance : ['focus','bless','hotblood','guts','friend']
};
function spiritsOf(c){ return ROLE_SPIRITS[(c && c.role) || 'balance'] || ROLE_SPIRITS.balance; }

function renderSpirits(){
  const box = $('sp-list');
  if(!box || !S.player) return;
  $('sp-now').textContent = S.sp;
  box.innerHTML = '';
  spiritsOf(S.player).forEach(function(key){
    const sp = SPIRITS[key];
    const b = document.createElement('button');
    const used = S.spiritUsed[key];
    const afford = S.sp >= sp.sp && !used && !S.busy && !S.resolved;
    b.className = 'spirit' + (afford ? '' : ' off') + (used ? ' used' : '');
    b.disabled = !afford;
    const t = document.createElement('b'); t.textContent = sp.icon + ' ' + sp.name;
    const c = document.createElement('em'); c.textContent = used ? '已用' : sp.sp + ' SP';
    const d = document.createElement('span'); d.textContent = sp.desc;
    b.append(t, c, d);
    b.onclick = function(){ castSpirit(key); };
    box.appendChild(b);
  });
}

function castSpirit(key){
  const sp = SPIRITS[key];
  if(!sp || S.sp < sp.sp || S.spiritUsed[key] || S.busy || S.resolved) return;
  S.sp -= sp.sp;
  S.spiritUsed[key] = true;
  S.spiritCasts++;
  switch(key){
    case 'focus'   : S.pSt.spFocus = 2; break;
    case 'hit'     : S.pSt.spHit = 1; break;
    case 'dodge'   : S.pSt.spDodge = 1; break;
    case 'accel'   : S.pSt.spAccel = 1; break;
    /* 熱血與魂改成「加成疊加」而非互相覆蓋：
       單用熱血 ×2.0、單用魂 ×2.5、兩個都用 ×3.5（1 ＋1.0 ＋1.5）。
       原本兩者共用 spDmg，先魂後熱血還會被降級成 ×2.0。 */
    case 'hotblood': S.pSt.spDmg = (S.pSt.spDmg > 1 ? S.pSt.spDmg : 1) + 1.0; break;
    case 'soul'    : S.pSt.spDmg = (S.pSt.spDmg > 1 ? S.pSt.spDmg : 1) + 1.5;
                     S.pSt.spCrit = 1; break;
    case 'iron'    : S.pSt.spIron = 1; break;
    case 'guts'    : { const h = Math.round(S.player.maxHp*0.35);
                       S.player.hp = Math.min(S.player.maxHp, S.player.hp + h);
                       popNumber('f-p','+'+h,'heal'); sfx('heal'); break; }
    case 'luck'    : S.pSt.spLuck = 1; break;
    case 'bless'   : S.pSt.spBless = 1; break;
    case 'friend'  : S.pSt.spFriend = 1; break;
    case 'awaken'  : S.pSt.spAwaken = 1; break;
  }
  auraFx('p'); sfx('buff');
  banner(sp.name + '！', true);
  S.quizPts += CONFIG.spiritPts;
  log('🌀 精神指令【' + sp.name + '】發動：' + sp.desc +
      '（＋' + CONFIG.spiritPts + ' 分）', 'var(--ion)');
  paintHUD(); renderSpirits();
  /* 招式面板要一起重繪：有些指令會改變狀態，
     而且發動權 0 的那一題，主按鈕的「放棄行動」出路必須保留住。 */
  if(!S.resolved && !S.busy && S.current) refreshTacticsButton();
}

/* 依目前發動權重設主按鈕。發動權 0 時一定留一條路可以走。 */
function refreshTacticsButton(){
  const btn = $('main-btn'); if(!btn) return;
  if(S.charge <= 0){
    S.move = null;
    btn.disabled = false;
    btn.textContent = CONFIG.zeroChargeSafe ? '➡️ 看解析，進入下一題'
                                            : '➡️ 這題放棄行動，進入下一題';
    btn.onclick = skipTurn;
  }else if(!S.move){
    btn.textContent = '請選擇一招'; btn.disabled = true;
  }
}

/* ============================================================================
   學期積分與稱號
   ── 每課只採計最高分，重刷同一課不會累加，只會刷新該課的最佳成績
   ── 學期總積分＝各課最佳分數的總和
   ========================================================================== */
/* ── 稱號：九階門檻共用，18 種風格 ──
   門檻以「一學期約 12 課」估算：單場滿分約 3,200，六成正確約 1,700。
   換課數時按比例調整，Code.gs 的 TITLE_MIN 要一起改。 */
const TITLE_MIN = [0, 1200, 3500, 7000, 11500, 17000, 23000, 30000, 38000];
const TITLE_STYLES = [
  {k:'scholar', name:'古代科舉',   icon:'📜', color:'#c98200', t:['童生','秀才','舉人','貢士','進士','探花','榜眼','狀元','文曲星']},
  {k:'royal',   name:'帝王封建',   icon:'👑', color:'#e0661a', t:['平民','士人','校尉','將軍','侯爵','公爵','親王','攝政王','皇帝']},
  {k:'rpg',     name:'奇幻冒險',   icon:'⚔️', color:'#12a97c', t:['旅人','見習冒險者','銅級冒險者','銀級冒險者','金級冒險者','白金冒險者','勇者','大勇者','傳說勇者']},
  {k:'wuxia',   name:'武俠江湖',   icon:'🗡️', color:'#a8730c', t:['江湖客','後起之秀','成名高手','一方之雄','絕頂高手','一派宗師','武林盟主','三教頂峰','天下第一']},
  {k:'magic',   name:'魔法與魔王', icon:'🔮', color:'#8b68ee', t:['旁聽生','見習魔法師','正式魔法師','高等魔法師','大魔導士','賢者','大賢者','魔王','暴風之王']},
  {k:'myth',    name:'神域諸神',   icon:'⚡', color:'#c99200', t:['凡人','祭司','神使','半神','守護神','主神','司命者','創世神','萬神之上']},
  {k:'oath',    name:'圓桌誓約',   icon:'🛡️', color:'#3f72e6', t:['侍從','見習騎士','正式騎士','圓桌之席','領主','大公','攝政','護國公','王']},
  {k:'sengoku', name:'戰國亂世',   icon:'🏯', color:'#ee6420', t:['足輕','小姓','侍大將','家老','城主','大名','守護','天下人','第六天魔王']},
  {k:'zhulu',   name:'逐鹿中原',   icon:'🐉', color:'#e03b52', t:['布衣','士人','門客','幕僚','謀士','軍師','丞相','國士無雙','帝者之師']},
];

/* 舊風格代號 → 新風格代號（與 Code.gs 的 STYLE_ALIAS 一致）
   學生先前選過的舊風格自動平移，不必重選 */
const STYLE_ALIAS = { slayer:'sengoku', gundam:'myth', aot:'oath', lineage:'zhulu' };

const STYLE_BY_KEY = {};
TITLE_STYLES.forEach(function(x){ STYLE_BY_KEY[x.k] = x; });

let MY_STYLE = 'rpg';        // 預設風格：奇幻冒險
function styleObj(k){
  if(STYLE_ALIAS[k]) k = STYLE_ALIAS[k];
  return STYLE_BY_KEY[k] || STYLE_BY_KEY.rpg || STYLE_BY_KEY.scholar;
}
function tierOf(total){
  let i = 0;
  TITLE_MIN.forEach(function(m, k){ if(total >= m) i = k; });
  return i;
}
function titleOf(total, key){
  const st = styleObj(key || MY_STYLE), i = tierOf(total);
  return {name: st.t[i], icon: st.icon, color: st.color, min: TITLE_MIN[i], tier: i};
}
function nextTitle(total, key){
  const st = styleObj(key || MY_STYLE), i = tierOf(total);
  if(i >= TITLE_MIN.length - 1) return null;
  return {name: st.t[i+1], icon: st.icon, color: st.color, min: TITLE_MIN[i+1]};
}

let SEMESTER = null;          // {total, lessons:[{id,name,best,plays}]}
let LAST_BEST = null;         // 這一場開打前，本課的最佳分數

let ME = {email:'', shortId:'', allowed:false, domains:[]};
function loadUser(){
  if(!inGAS){ paintLogin(); return; }
  if(window.__watch) window.__watch('getUserInfo');
  google.script.run
    .withSuccessHandler(function(u){
      if(window.__done) window.__done('getUserInfo');
      ME = u || ME; paintLogin(); loadSemester();
      loadUnlocks();   /* 放在回呼裡：此時所有 let 變數都已初始化 */
      loadGrowth();
      if(ME.allowed) loadDojo();
    })
    .withFailureHandler(function(e){
      if(window.__done) window.__done('getUserInfo');
      if(window.__bootErr) window.__bootErr('getUserInfo 失敗：', (e && e.message) || String(e));
      paintLogin();
    })
    .getUserInfo();
}
function paintLogin(){
  const guest = !ME.allowed;
  $('sem-box').hidden = guest;
  $('login-box').hidden = !guest;
  if(guest){
    $('login-who').textContent = ME.email
      ? ('目前登入：' + ME.email + '（非本校帳號）')
      : '目前未登入';
    $('login-note').textContent = ME.email
      ? '這個帳號不會登記成績。要累積學期積分與稱號，請改用學校帳號登入。'
      : '不登入也可以正常遊玩，只是不會留下任何紀錄。要累積學期積分與稱號，請用學校帳號登入。';
    const d = $('login-domains'); d.innerHTML = '';
    (ME.domains || ['gm.nssh.ntpc.edu.tw','stdmail.nssh.ntpc.edu.tw']).forEach(function(x){
      const b = document.createElement('code'); b.textContent = '@' + x; d.appendChild(b);
    });
  }
}

function loadSemester(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(d){
      SEMESTER = d || {total:0, lessons:[]};
      if(SEMESTER.style) MY_STYLE = SEMESTER.style;
      paintSemester();
      if(LESSONS.length) renderLessons(LESSONS);   // 讓課次選單顯示各課最佳成績
    })
    .withFailureHandler(function(){})
    .getSemester();
}

let STYLE_QUOTA = null;
function openStyles(){
  const total = (SEMESTER && SEMESTER.total) || 0;
  const grid = $('style-grid'); grid.innerHTML = '';
  TITLE_STYLES.forEach(function(st){
    const cur = tierOf(total);
    const card = document.createElement('button');
    card.className = 'style-card' + (st.k === MY_STYLE ? ' on' : '');
    const h = document.createElement('h4');
    h.textContent = st.icon + ' ' + st.name + (st.k === MY_STYLE ? '　（使用中）' : '');
    h.style.color = st.color;
    const now = document.createElement('div');
    now.className = 'now'; now.style.color = st.color;
    now.textContent = '目前：' + st.t[cur];
    const box = document.createElement('div'); box.className = 'style-tiers';
    st.t.forEach(function(name, i){
      const d = document.createElement('div');
      d.className = 'style-tier' + (i < cur ? ' got' : i === cur ? ' cur' : '');
      const a = document.createElement('span'); a.textContent = name;
      const b = document.createElement('em'); b.textContent = TITLE_MIN[i].toLocaleString();
      d.append(a, b); box.appendChild(d);
    });
    card.append(h, now, box);
    card.onclick = function(){ pickStyle(st); };
    grid.appendChild(card);
  });
  if(inGAS && STYLE_QUOTA === null){
    google.script.run.withSuccessHandler(function(q){
      STYLE_QUOTA = q || {ok:false};
      $('style-quota').textContent = STYLE_QUOTA.ok ? '目前可更換一次' : '本期已更換過';
    }).withFailureHandler(function(){}).canChangeStyle();
  }else if(STYLE_QUOTA){
    $('style-quota').textContent = STYLE_QUOTA.ok ? '目前可更換一次' : '本期已更換過';
  }
  show('scr-styles');
}

function pickStyle(st){
  if(st.k === MY_STYLE) return;
  if(!ME.allowed){ alert('需要以學校帳號登入，才能設定稱號風格。'); return; }
  if(STYLE_QUOTA && !STYLE_QUOTA.ok){
    alert('這個時段已經換過稱號風格了。\n每月 1 號與 15 號各開放一次更換機會。');
    return;
  }
  if(!confirm('要把稱號風格改成「' + st.name + '」嗎？\n每個月 1 號與 15 號各能換一次。')) return;
  if(!inGAS){ MY_STYLE = st.k; paintSemester(); openStyles(); return; }
  google.script.run
    .withSuccessHandler(function(r){
      if(r && r.ok){
        MY_STYLE = st.k; STYLE_QUOTA = {ok:false};
        sfx('win'); banner('稱號更新！', true);
        paintSemester(); openStyles();
      }else alert((r && r.msg) || '更換失敗。');
    })
    .withFailureHandler(function(){ alert('連線失敗，請稍後再試。'); })
    .setStyle(st.k);
}

function paintSemester(){
  const box = $('sem-box');
  if(!box) return;
  if(!SEMESTER){ box.hidden = true; return; }
  box.hidden = false;
  const total = SEMESTER.total || 0;
  const t = titleOf(total), nx = nextTitle(total);

  $('sem-title').textContent = t.icon + ' ' + t.name;
  $('sem-title').style.color = t.color;
  $('sem-desc').textContent = styleObj(MY_STYLE).name + '風格　·　第 ' + (t.tier+1) + ' 階 / 9';
  $('sem-total').textContent = total.toLocaleString();

  const bar = $('sem-bar'), lab = $('sem-next');
  if(nx){
    const span = nx.min - t.min;
    const got = total - t.min;
    bar.style.width = Math.round(clamp(got / span, 0.02, 1) * 100) + '%';
    bar.style.background = nx.color;
    lab.textContent = '距離「' + nx.name + '」還差 ' + (nx.min - total).toLocaleString() + ' 分';
  }else{
    bar.style.width = '100%'; bar.style.background = t.color;
    lab.textContent = '已達最高稱號';
  }

  const list = $('sem-lessons'); list.innerHTML = '';
  const ls = (SEMESTER.lessons || []).slice().sort(function(a,b){ return b.best - a.best; });
  if(!ls.length){
    const d = document.createElement('div');
    d.className = 'lesson-empty';
    d.textContent = '還沒有任何課次的成績。每一課只採計你的最高分，隨時可以回來刷新。';
    list.appendChild(d);
    return;
  }
  ls.forEach(function(L){
    const d = document.createElement('div'); d.className = 'sem-row';
    const a = document.createElement('span'); a.textContent = L.name || L.id;
    const b = document.createElement('b'); b.textContent = L.best.toLocaleString();
    const c = document.createElement('em'); c.textContent = '挑戰 ' + (L.plays || 1) + ' 次';
    d.append(a, c, b); list.appendChild(d);
  });
}

/* ============================================================================
   課程選單：由試算表「課程」工作表提供，可切換不同題庫
   ========================================================================== */
let LESSONS = [], currentLesson = null;

function loadLessons(){
  if(!inGAS) return renderLessons([]);
  if(window.__watch) window.__watch('getLessons');
  google.script.run
    .withSuccessHandler(function(rows){
      if(window.__done) window.__done('getLessons');
      LESSONS = Array.isArray(rows) ? rows : []; renderLessons(LESSONS);
    })
    .withFailureHandler(function(e){
      if(window.__done) window.__done('getLessons');
      if(window.__bootErr) window.__bootErr('getLessons 失敗：', (e && e.message) || String(e));
      renderLessons([]);
    })
    .getLessons();
}

function renderLessons(list){
  const grid = $('lesson-grid');
  const info = $('lesson-info');
  const box = $('lesson-list'); box.innerHTML = '';

  if(!list.length){
    currentLesson = null;
    grid.hidden = true; info.hidden = true;
    const d = document.createElement('div'); d.className = 'lesson-empty';
    d.textContent = '目前使用預設題庫。老師可在試算表新增「課程」工作表，各課次就會出現在這個選單裡。';
    box.appendChild(d);
    $('lesson-hint').textContent = '';
    $('lesson-tag').textContent = '';
    loadRaid();
    return;
  }

  grid.hidden = false; info.hidden = false;
  $('lesson-hint').textContent = '共 ' + list.length + ' 課';
  grid.innerHTML = '';
  let idx = 0;
  list.forEach(function(L, i){
    const b = document.createElement('button');
    b.className = 'lg' + (i === 0 ? ' on' : '');
    b.dataset.i = String(i);
    const t = document.createElement('b'); t.textContent = L.name || L.id;
    const c = document.createElement('span'); c.textContent = (L.count || 0) + ' 題';
    b.append(t, c);
    const done = SEMESTER && SEMESTER.lessons &&
                 SEMESTER.lessons.filter(function(x){ return x.id === L.id; })[0];
    if(done){
      const m = document.createElement('i'); m.textContent = '最佳 ' + done.best;
      b.appendChild(m);
    }
    b.onclick = function(){
      grid.querySelectorAll('.lg').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on'); idx = i; pick(); sfx('select');
    };
    grid.appendChild(b);
  });

  const pick = function(){
    currentLesson = list[idx] || list[0];
    const L = currentLesson;
    info.innerHTML = '';
    if(L.desc){
      const d = document.createElement('div');
      d.textContent = L.desc;
      info.appendChild(d);
    }
    const d2 = document.createElement('div');
    const per = L.count ? Math.max(1, Math.ceil(L.count / CONFIG.rounds)) : 0;
    d2.innerHTML = L.count
      ? ('題庫 <b>' + L.count + '</b> 題　·　每回合 <b>' + per + '</b> 題　·　共 <b>' +
         CONFIG.rounds + '</b> 回合')
      : '這一課的題庫是空的，請老師確認試算表。';
    info.appendChild(d2);
    // 已完成的最佳成績
    if(SEMESTER && SEMESTER.lessons){
      const done = SEMESTER.lessons.filter(function(x){ return x.id === L.id; })[0];
      const d3 = document.createElement('div');
      d3.textContent = done
        ? ('你在這一課的最佳成績：' + done.best.toLocaleString() + ' 分（已挑戰 ' + done.plays + ' 次）')
        : '這一課還沒有成績，第一次挑戰就會登錄。';
      info.appendChild(d3);
    }
    $('lesson-tag').textContent = L.name || '';
    paintRaid(); loadRaid();
  };
  pick();
}

/* ============================================================================
   題庫
   ── 正式使用時由 Google 試算表提供；以下為離線示範題（可留作備援）
   ── 資料格式：{q:題幹, options:[選項…], answer:[正解文字…], exp:解析}
   ========================================================================== */
const LOCAL_BANK = [
  {q:"〈桃花源記〉：「晉太元中，武陵人，捕魚為業……」下列敘述適當的是：",options:["寫出時間地點皆為虛構","「忘」是進入桃花源的關鍵","「緣」字意思為攀爬","「逢」暗示純屬偶然機緣"],answer:["「忘」是進入桃花源的關鍵","「逢」暗示純屬偶然機緣"],exp:"忘路之遠近，無心而得；逢，不期而遇。「緣」為沿著。開頭有明確年號地名，非全然虛構筆法。"},
  {q:"〈桃花源記〉中「黃髮垂髫」，可用以代指老年人的是：",options:["黃髮","束髮","潘鬢","皓首"],answer:["黃髮","皓首"],exp:"黃髮、皓首指老人；束髮為男子成童之年；潘鬢典出潘岳，指兩鬢斑白、年華漸老，多用於中年。"},
  {q:"關於陶淵明，下列詩文吟詠對象為他的是：",options:["自謂羲皇人","生事不曾問，肯愧家中婦","莫怪先生懶折腰","耐寒唯有東籬菊"],answer:["自謂羲皇人","生事不曾問，肯愧家中婦","莫怪先生懶折腰"],exp:"前三者分別扣合陶淵明自比上古之民、不營生計、不為五斗米折腰；末句詠菊而非詠人。"},
  {q:"〈桃花源記〉一文所描述之季節，與下列何者相同？",options:["寒梅著花未","春眠不覺曉，處處聞啼鳥","玲瓏望秋月","晚來天欲雪"],answer:["春眠不覺曉，處處聞啼鳥"],exp:"「芳草鮮美，落英繽紛」為桃花盛開之春景。"},
  {q:"下列各組「」內的字，讀音前後相同的是：",options:["吹毛求「疵」／「齜」牙咧嘴","嘆「惋」／手「腕」","落英「繽」紛／「嬪」妃","土地平「曠」／個性粗「獷」"],answer:["嘆「惋」／手「腕」"],exp:"惋、腕皆讀ㄨㄢˋ。疵ㄘ／齜ㄗ；繽ㄅㄧㄣ／嬪ㄆㄧㄣˊ；曠ㄎㄨㄤˋ／獷ㄍㄨㄤˇ。"},
  {q:"〈桃花源記〉：「此人一一為具言所聞，皆嘆惋。」意謂桃源中人：",options:["對漁人的際遇感到欣羨","感嘆世事多變、亂離久而未平","嘆息漁人未能常居此地","對自己不知世事感到羞愧"],answer:["感嘆世事多變、亂離久而未平"],exp:"聽聞秦以後朝代更迭、戰亂相尋，故為之嘆惋。"},
  {q:"下列「」內詞語，古今意義不同的是：",options:["率「妻子」邑人來此絕境","阡陌「交通」，雞犬相聞","乃不知有漢，「無論」魏晉","「芳草」鮮美，落英繽紛"],answer:["率「妻子」邑人來此絕境","阡陌「交通」，雞犬相聞","乃不知有漢，「無論」魏晉"],exp:"妻子＝妻與子女；交通＝交錯相通；無論＝更不必說。芳草古今同義。"},
  {q:"關於「便『要』還家，設酒殺雞作食」，敘述正確的是：",options:["「要」意為邀請","「要」在此讀作ㄧㄠ","「要」與「要求」之「要」同義","「要」為通同字，同「邀」"],answer:["「要」意為邀請","「要」在此讀作ㄧㄠ","「要」為通同字，同「邀」"],exp:"要通「邀」，讀ㄧㄠ，邀請之意，與「要求」（ㄧㄠˋ）不同。"},
  {q:"下列作品確為陶淵明所作的是：",options:["〈五柳先生傳〉","〈歸去來兮辭〉","〈醉翁亭記〉","〈飲酒〉詩"],answer:["〈五柳先生傳〉","〈歸去來兮辭〉","〈飲酒〉詩"],exp:"〈醉翁亭記〉為北宋歐陽脩所作。"},
  {q:"「初極狹，才通人；復行數十步，豁然開朗。」其中「豁然開朗」的意涵，敘述正確的是：",options:["由狹隘幽暗轉為開闊明亮","可引申指心中疑惑頓時明白","與「茅塞頓開」意思相近","專指道路寬廣筆直，無他義"],answer:["由狹隘幽暗轉為開闊明亮","可引申指心中疑惑頓時明白","與「茅塞頓開」意思相近"],exp:"本義寫空間由窄而寬，後可引申為心境或情勢忽然明朗。"},
  {q:"漁人「處處誌之」，其後「尋向所誌，遂迷不復得路」。此一安排的作用是：",options:["暗示桃花源乃寄託理想的虛構之境","呼應桃源人「不足為外人道也」之囑","反襯漁人背信，終不可再得","說明漁人記性不佳，做記號失敗"],answer:["暗示桃花源乃寄託理想的虛構之境","呼應桃源人「不足為外人道也」之囑","反襯漁人背信，終不可再得"],exp:"迷不復得路，使桃源由實入虛，強化理想境地不可求的意味。"},
  {q:"由「自云先世避秦時亂……乃不知有漢，無論魏晉」可推知：",options:["桃源中人於秦末避亂而入","與外界隔絕約五、六百年","曾親身經歷漢、魏、晉三朝","對朝代更迭一無所知"],answer:["桃源中人於秦末避亂而入","與外界隔絕約五、六百年","對朝代更迭一無所知"],exp:"自秦末至晉太元約五、六百年；正因隔絕，故不曾經歷漢魏晉。"},
  {q:"下列各組「」內的字，讀音前後不相同的是：",options:["便「舍」船／屋「舍」儼然","「怡」然自樂／「貽」笑大方","「豁」然開朗／「豁」出去","阡「陌」／「莫」名其妙"],answer:["便「舍」船／屋「舍」儼然","「豁」然開朗／「豁」出去"],exp:"舍ㄕㄜˇ（捨棄）／舍ㄕㄜˋ（房屋）；豁ㄏㄨㄛˋ／豁ㄏㄨㄛ。怡、貽皆ㄧˊ；陌、莫皆ㄇㄛˋ。"},
  {q:"關於〈桃花源記〉的旨趣，敘述適當的是：",options:["寄寓對亂世的批判與不滿","反映對淳樸安樂社會的嚮往","主張積極入世、建功立業","寄託作者歸隱田園的情懷"],answer:["寄寓對亂世的批判與不滿","反映對淳樸安樂社會的嚮往","寄託作者歸隱田園的情懷"],exp:"全文以理想社會對照現實亂離，與作者歸隱之志相合，非勸人求取功名。"}
];

/* ============================================================================
   小工具
   ========================================================================== */
const $  = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
let SPEED = 1;                                   // 1＝一般，0.45＝快速模式
const wait = ms => new Promise(r=>setTimeout(r, Math.round(ms * SPEED)));
const paceMs = ms => Math.round(ms * SPEED);     // 給動畫用的時間換算
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
/* 安全捲動：舊瀏覽器或內嵌環境若沒有 scrollIntoView，不該讓整段流程中斷 */
function scrollTo_(el, opt){
  try{ if(el && typeof el.scrollIntoView === 'function') el.scrollIntoView(opt); }catch(e){}
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
const inGAS = typeof google !== 'undefined' && google.script && google.script.run;

/* ============================================================================
   音效引擎
   ========================================================================== */
const SFX = (function(){
  let ctx = null, muted = false;
  function get(){
    if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function env(g,t,dur,vol){
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  }
  function tone(f1,f2,dur,type,vol,delay){
    const c=get(); if(!c) return;
    const t=c.currentTime+(delay||0), o=c.createOscillator(), g=c.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(f1,t);
    if(f2) o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);
    env(g,t,dur,vol||0.11); o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+0.05);
  }
  function noise(dur,f1,f2,vol,delay,q){
    const c=get(); if(!c) return;
    const t=c.currentTime+(delay||0), n=Math.max(1,Math.floor(c.sampleRate*dur));
    const buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=c.createBufferSource(); src.buffer=buf;
    const flt=c.createBiquadFilter(); flt.type='bandpass'; flt.Q.value=q||1.1;
    flt.frequency.setValueAtTime(f1,t);
    if(f2) flt.frequency.exponentialRampToValueAtTime(Math.max(60,f2),t+dur);
    const g=c.createGain(); env(g,t,dur,vol||0.14);
    src.connect(flt).connect(g).connect(c.destination); src.start(t); src.stop(t+dur+0.05);
  }
  const BANK = {
    tap    : ()=>{ tone(620,760,.05,'square',.08); },
    select : ()=>{ tone(520,0,.05,'square',.09); tone(780,0,.07,'square',.08,.05); },
    charge : ()=>{ tone(440,0,.09,'triangle',.10); tone(660,0,.09,'triangle',.10,.08); tone(880,0,.14,'triangle',.11,.16); },
    perfect: ()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,0,.16,'triangle',.11,i*.07)); noise(.25,3000,900,.05,.28,2); },
    fail   : ()=>{ tone(300,150,.24,'sawtooth',.09); },
    swing  : ()=>{ noise(.16,1800,320,.13,0,.8); },
    slash  : ()=>{ noise(.14,2600,500,.15,0,.9); tone(1400,300,.1,'square',.06,.02); },
    beam   : ()=>{ tone(1500,220,.3,'sawtooth',.09); noise(.3,2400,500,.09,0,1.6); },
    impact : ()=>{ noise(.2,900,120,.2,0,.7); tone(150,52,.22,'sine',.16); },
    crit   : ()=>{ noise(.34,1600,90,.24,0,.6); tone(200,45,.36,'sawtooth',.17);
                   tone(1200,2400,.14,'square',.10,.02); [784,1047,1319].forEach((f,i)=>tone(f,0,.2,'triangle',.09,.12+i*.05)); },
    glance : ()=>{ noise(.1,1400,700,.09,0,2); tone(420,300,.08,'square',.05); },
    guard  : ()=>{ tone(880,760,.1,'square',.11); tone(1320,1180,.12,'square',.08,.01); noise(.12,3200,1400,.09,0,3); },
    counter: ()=>{ tone(1046,0,.07,'square',.11); tone(1568,0,.1,'square',.10,.07); noise(.14,2200,600,.11,.06,1.2); },
    miss   : ()=>{ noise(.12,900,1600,.07,0,1.4); },
    buff   : ()=>{ [523,698,880].forEach((f,i)=>tone(f,0,.18,'triangle',.10,i*.06)); },
    debuff : ()=>{ [660,520,392].forEach((f,i)=>tone(f,0,.18,'sawtooth',.08,i*.06)); },
    heal   : ()=>{ [784,988,1175].forEach((f,i)=>tone(f,0,.22,'sine',.11,i*.07)); },
    assist : ()=>{ [659,880,1175,1568].forEach((f,i)=>tone(f,0,.16,'square',.10,i*.05)); noise(.3,1800,600,.1,.1,1); },
    awaken : ()=>{ tone(220,880,.5,'sawtooth',.10); noise(.5,400,3000,.08,0,1.2);
                   [523,659,784,1047,1319].forEach((f,i)=>tone(f,0,.3,'triangle',.09,.2+i*.06)); },
    ko     : ()=>{ noise(.6,1200,60,.24,0,.5); tone(180,40,.7,'sawtooth',.18); },
    round  : ()=>{ [392,523,659,784].forEach((f,i)=>tone(f,0,.24,'triangle',.11,i*.09)); },
    win    : ()=>{ [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,0,.22,'triangle',.12,i*.1)); },
    lose   : ()=>{ [440,392,330,262].forEach((f,i)=>tone(f,0,.3,'triangle',.11,i*.16)); }
  };
  return { play(n){ if(muted) return; (BANK[n]||BANK.tap)(); },
           toggle(){ muted=!muted; if(!muted) BANK.tap(); return muted; },
           isMuted(){ return muted; } };
})();
const sfx = n => SFX.play(n);

/* ============================================================================
   背景音樂
   ── 三首循環曲：menu 主選單曲／battle 戰鬥曲／boss 頭目曲（最後一回合）。
      錯題道場沿用戰鬥曲，但加上低通濾波，聽起來比較安靜、適合專心訂正。
   ── 音檔放在老師的 Drive，由伺服器 getBgm() 讀出；瀏覽器會存進 IndexedDB，
      之後只有檔案更新才會重新下載。
   ── 瀏覽器規定「使用者先點一下」才能出聲，所以第一次點擊畫面後才開始播放。
   ========================================================================== */
const BGM = (function(){
  const PREF_KEY = 'atkqa_bgm_v1';
  const DB_NAME = 'atkqa_bgm', STORE = 'tracks';
  const VOL = 0.45;            // 整體音量：留空間給音效
  const DIM = 0.5;             // 錯題道場：音量再壓低一半
  const FADE = 0.9;            // 換曲時的淡入淡出（秒）
  const SILENT = 'data:audio/wav;base64,UklGRt0BAABXQVZFZm10IBAAAAABAAEAIlYAACJWAAABAAgAZGF0YbkBAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=';
  const NAMES = ['menu', 'battle', 'boss'];
  /* iPhone／iPad 的 <audio> 不能調音量，只有那裡才改走 Web Audio；
     其他裝置直接調 <audio> 音量，最單純、最不容易出錯。 */
  const NEED_WA = (function(){
    try{ const a = new Audio(); a.volume = 0.5; return Math.abs(a.volume - 0.5) > 0.01; }catch(e){ return false; }
  })();
  let on = true;
  try{ if(localStorage.getItem(PREF_KEY) === '0') on = false; }catch(e){}
  let ctx = null, master = null, lp = null, unlocked = false;
  let want = null, wantDim = false, cur = null, chain = Promise.resolve();
  let status = '尚未開始';
  const T = {};
  NAMES.forEach(function(n){ T[n] = { name:n, el:null, gain:null, ready:false, loading:null, failed:false, err:'' }; });

  function note(msg, show){
    status = msg;
    try{ console.info('[BGM] ' + msg); }catch(e){}
    if(show) toast(msg);
    paintButtons();
  }
  let toastT = null;
  function toast(msg){
    const el = $('bgm-toast');
    if(!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function(){ el.hidden = true; }, 4500);
  }

  /* ── IndexedDB 快取（任何一步失敗或太久沒回應，都當作沒有快取） ── */
  function withTimeout(pr, ms){
    return Promise.race([pr, new Promise(function(r){ setTimeout(function(){ r(null); }, ms); })]);
  }
  function idb(){
    return withTimeout(new Promise(function(res){
      try{
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function(){ r.result.createObjectStore(STORE); };
        r.onsuccess = function(){ res(r.result); };
        r.onerror = function(){ res(null); };
        r.onblocked = function(){ res(null); };
      }catch(e){ res(null); }
    }), 1500);
  }
  function idbGet(k){
    return idb().then(function(db){ return withTimeout(new Promise(function(res){
      if(!db) return res(null);
      try{
        const q = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
        q.onsuccess = function(){ res(q.result || null); };
        q.onerror = function(){ res(null); };
      }catch(e){ res(null); }
    }), 1500); });
  }
  function idbPut(k, v){
    return idb().then(function(db){
      if(!db) return;
      try{ db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); }catch(e){}
    });
  }
  function b64ToBuf(b64){
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  /* ── 音量：0～1 的相對值，實際音量＝相對值 × 總音量（× 道場減半） ── */
  function level(){ return on ? VOL * (wantDim ? DIM : 1) : 0; }
  function graph(){
    if(ctx) return ctx;
    try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ ctx = null; return null; }
    master = ctx.createGain(); master.gain.value = level();
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
    lp.connect(master); master.connect(ctx.destination);
    return ctx;
  }
  function element(t){
    if(t.el) return t.el;
    const el = new Audio(); el.loop = true; el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.addEventListener('error', function(){
      if(t.ready){ t.err = '音檔無法播放（' + ((el.error && el.error.code) || '?') + '）'; note('🎵 ' + t.err, true); }
    });
    t.el = el;
    if(NEED_WA && graph()){
      try{
        const src = ctx.createMediaElementSource(el);
        t.gain = ctx.createGain(); t.gain.gain.value = 0;
        src.connect(t.gain); t.gain.connect(lp);
      }catch(e){ t.gain = null; }
    }
    if(!t.gain) el.volume = 0;
    t.v = 0;
    return el;
  }
  function ramp(t, v, dur){
    if(!t.el) return;
    t.v = v;
    if(t.gain){
      const g = t.gain.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(v, now + dur);
      return;
    }
    clearInterval(t.iv);
    const from = t.el.volume, to = v * level(), steps = 12;
    let i = 0;
    t.iv = setInterval(function(){
      i++;
      try{ t.el.volume = Math.max(0, Math.min(1, from + (to - from) * i / steps)); }catch(e){}
      if(i >= steps) clearInterval(t.iv);
    }, Math.max(10, dur * 1000 / steps));
  }
  function relevel(){                // 開關或進出道場時，把目前曲子調到新音量
    if(master){
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(level(), now + 0.4);
    }
    NAMES.forEach(function(n){ const t = T[n]; if(t.el && !t.gain && t.v) ramp(t, t.v, 0.4); });
  }
  function startPlay(t){
    if(ctx && ctx.state === 'suspended') ctx.resume();
    const p = t.el.play();
    if(p && p.then){
      p.then(function(){ note('▶ 播放中：' + t.name); })
       .catch(function(e){
         const n = e && e.name || '';
         if(n === 'NotAllowedError') note('🎵 瀏覽器擋下自動播放，點一下畫面就會開始', true);
         else if(n === 'AbortError') return;          // 換曲時中斷前一首，屬正常狀況
         else note('🎵 音樂檔無法播放（檔案讀不到或格式不支援：' + n + '）', true);
       });
    }
  }

  /* ── GitHub 版：音檔放在 GitHub 的 assets/bgm/，瀏覽器會自己快取 ── */
  function load(name){
    const t = T[name];
    if(!t || t.ready || t.failed) return Promise.resolve();
    try{
      element(t).src = (window.ATKQA_SITE || '') + 'assets/bgm/bgm_' + name + '.m4a?v=96c403b17a';
      t.ready = true;
      note('✔ ' + name + ' 已就緒');
    }catch(e){ t.failed = true; t.err = String(e && e.message || e); }
    if(t.ready && want === name) apply();
    return Promise.resolve();
  }
  /* 一首一首依序下載；第一首稍微錯開，避免全班同時向伺服器要檔案 */
  let first = true;
  function queue(name){
    const wait = first ? Math.random() * 1500 : 0;
    first = false;
    chain = chain.then(function(){
      return new Promise(function(r){ setTimeout(r, wait); });
    }).then(function(){ return load(name); });
    return chain;
  }
  function prefetch(){
    if(!on) return;
    if(want === 'menu' || !want) queue('battle');
    else queue('boss');
  }

  /* ── 切換到 want 這首 ── */
  function apply(){
    if(!unlocked || !on || document.hidden) return;
    if(lp){
      const now = ctx.currentTime;
      lp.frequency.cancelScheduledValues(now);
      lp.frequency.setTargetAtTime(wantDim ? 900 : 20000, now, 0.25);
    }
    if(cur && cur !== want && T[cur] && T[cur].el){
      const old = T[cur];
      ramp(old, 0, FADE);
      clearTimeout(old.stopT);
      old.stopT = setTimeout(function(){ if(cur !== old.name) old.el.pause(); }, FADE * 1000 + 120);
    }
    cur = want;
    const t = T[want];
    if(!t) return;
    if(t.failed){ return; }
    if(!t.ready){ queue(want); return; }      // 下載完會再呼叫 apply()
    clearTimeout(t.stopT);
    if(t.el.paused) startPlay(t);
    ramp(t, 1, FADE);
  }
  function pauseAll(){
    NAMES.forEach(function(n){
      const t = T[n];
      if(t.el && !t.el.paused){ ramp(t, 0, 0.25); setTimeout(function(){ if(!on) t.el.pause(); }, 320); }
    });
    cur = null;
  }

  /* ── 每次點擊都檢查一次：該播卻沒在播（被瀏覽器擋下）就在這次點擊裡補播 ── */
  function onGesture(){
    if(!unlocked){
      unlocked = true;
      if(NEED_WA){ const c = graph(); if(c && c.state === 'suspended') c.resume(); }
      apply();
      NAMES.forEach(function(n){                // 在手勢內先「播一下」每個 <audio>（音量 0），之後才能自由播放
        const t = T[n], el = element(t);
        if(cur === n && t.ready) return;
        if(!t.ready) el.src = SILENT;
        const p = el.play();
        if(p && p.then) p.then(function(){ if(cur !== n || !t.ready) el.pause(); }).catch(function(){});
      });
      if(on) setTimeout(prefetch, 20000 + Math.random() * 20000);
      return;
    }
    if(ctx && ctx.state === 'suspended') ctx.resume();
    if(on && cur && T[cur] && T[cur].ready && T[cur].el.paused && !document.hidden){
      startPlay(T[cur]); ramp(T[cur], 1, FADE);
    }
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function(ev){ document.addEventListener(ev, onGesture, true); });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      NAMES.forEach(function(n){ const t = T[n]; if(t.el && !t.el.paused) t.el.pause(); });
    }else if(cur && on){
      const t = T[cur];
      if(t && t.ready) startPlay(t);
    }
  });

  /* ── 依畫面決定曲目 ── */
  function pick(id){
    if(id === 'scr-round') return null;                     // 回合結算：沿用目前的戰鬥音樂
    if(id === 'scr-battle'){
      let dojo = false, last = false;
      try{ dojo = S.mode === 'dojo'; last = S.round >= CONFIG.rounds; }catch(e){}
      if(dojo) return { name:'battle', dim:true };
      return { name: last ? 'boss' : 'battle', dim:false };
    }
    return { name:'menu', dim:false };
  }
  let screenId = '';
  function paintButtons(id){
    if(id) screenId = id;
    const b = $('btn-bgm');
    if(b){
      b.hidden = (screenId === 'scr-battle');
      b.classList.toggle('off', !on);
      b.title = (on ? '背景音樂：開（點一下關閉）' : '背景音樂：關（點一下開啟）') + '\n狀態：' + status;
    }
    const m = $('btn-mute');
    if(m){
      const sfxOff = SFX.isMuted();
      m.textContent = (!on && sfxOff) ? '🔇' : (!on ? '🔉' : (sfxOff ? '🎵' : '🔊'));
      m.title = '聲音：' + (on ? '音樂開' : '音樂關') + '・' + (sfxOff ? '音效關' : '音效開');
    }
  }
  function auto(id){
    id = id || ((document.querySelector('.screen.on') || {}).id) || '';
    paintButtons(id);
    const r = pick(id);
    if(!r) return;
    const changed = (want !== r.name), dimChanged = (wantDim !== r.dim);
    want = r.name; wantDim = r.dim;
    if(dimChanged) relevel();
    apply();
    if(changed && unlocked && on && want !== 'menu') setTimeout(prefetch, 20000 + Math.random() * 20000);
  }
  function set(v){
    on = !!v;
    try{ localStorage.setItem(PREF_KEY, on ? '1' : '0'); }catch(e){}
    if(on){
      NAMES.forEach(function(n){ if(T[n].failed){ T[n].failed = false; T[n].err = ''; } });   // 開啟時重試失敗的曲子
      relevel(); apply();
    }else{ relevel(); pauseAll(); }
    paintButtons();
  }
  /* 🎵 鈕：音樂開著卻沒在播（下載失敗或被擋）時，按一下是「重試／開始播放」，不是關掉 */
  function button(){
    const t = T[want];
    if(on && unlocked && t && !(t.ready && t.el && !t.el.paused)){
      if(t.failed){ t.failed = false; t.err = ''; }
      note('🎵 重新嘗試播放⋯', true);
      apply();
      return;
    }
    set(!on);
    toast(on ? '🎵 背景音樂：開' : '🎵 背景音樂：關');
  }
  return { auto: auto, set: set, button: button, isOn: function(){ return on; },
           state: function(){ return { on: on, unlocked: unlocked, cur: cur, want: want, dim: wantDim,
             webAudio: !!ctx, ctx: ctx ? ctx.state : '', status: status,
             ready: NAMES.filter(function(n){ return T[n].ready; }),
             failed: NAMES.filter(function(n){ return T[n].failed; }),
             playing: NAMES.filter(function(n){ return T[n].el && !T[n].el.paused; }),
             volume: NAMES.map(function(n){ return T[n].el ? +T[n].el.volume.toFixed(2) : null; }) }; } };
})();

/* ============================================================================
   狀態效果
   ========================================================================== */
/* ============================================================================
   戰場場景：SVG 插畫
   ── 每個場景都是程式畫出來的向量圖（遠景、中景、前景、粒子四層），
      不用外部圖片；固定亂數種子，所以每次畫出來都一樣。
   ── 不用 SVG 濾鏡（手機算模糊很吃力），光暈一律用放射漸層。
   ========================================================================== */
const SCENE = (function(){
  const W = 1600, H = 900;
  const f = n => Math.round(n * 10) / 10;
  function rng(seed){
    let a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const lin = (id, stops, x2, y2) =>
    '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 || 0) + '" y2="' + (y2 === undefined ? 1 : y2) + '">' +
    stops.map(s => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] !== undefined ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') +
    '</linearGradient>';
  const rad = (id, stops) =>
    '<radialGradient id="' + id + '">' +
    stops.map(s => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '" stop-opacity="' + (s[2] === undefined ? 1 : s[2]) + '"/>').join('') +
    '</radialGradient>';
  const glow = (x, y, rx, ry, id) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + (ry || rx) + '" fill="url(#' + id + ')"/>';

  /* 平滑起伏的山丘 */
  function hills(r, y, amp, n, fill, attr){
    const p = [];
    for(let i = 0; i <= n; i++) p.push([i * W / n, y - r() * amp]);
    let d = 'M0 ' + H + 'L0 ' + f(p[0][1]);
    for(let i = 0; i < n; i++){
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      d += 'C' + f(mx) + ' ' + f(p[i][1]) + ' ' + f(mx) + ' ' + f(p[i + 1][1]) + ' ' + f(p[i + 1][0]) + ' ' + f(p[i + 1][1]);
    }
    return '<path d="' + d + 'L' + W + ' ' + H + 'Z" fill="' + fill + '" ' + (attr || '') + '/>';
  }
  /* 尖峰山脈，可加雪頂 */
  function peaks(r, y, amp, n, fill, cap){
    const pts = [[0, y]];
    for(let i = 0; i < n; i++){
      const x = (i + 0.5) * W / n + (r() - 0.5) * W / n * 0.5;
      pts.push([x, y - amp * (0.55 + r() * 0.45)]);
      pts.push([(i + 1) * W / n, y - amp * r() * 0.25]);
    }
    let s = '<path d="M0 ' + H + pts.map(p => 'L' + f(p[0]) + ' ' + f(p[1])).join('') + 'L' + W + ' ' + H + 'Z" fill="' + fill + '"/>';
    if(cap){
      for(let i = 1; i < pts.length - 1; i += 2){
        const [x, py] = pts[i], [lx, ly] = pts[i - 1], [rx, ry] = pts[i + 1];
        const t = 0.28;
        const ax = x + (lx - x) * t, ay = py + (ly - py) * t, bx = x + (rx - x) * t, by = py + (ry - py) * t;
        s += '<path d="M' + f(x) + ' ' + f(py) + 'L' + f(ax) + ' ' + f(ay) + 'L' + f(ax + (x - ax) * 0.45) + ' ' + f(ay - 6) +
             'L' + f(x) + ' ' + f(ay + 8) + 'L' + f(bx - (bx - x) * 0.4) + ' ' + f(by - 4) + 'L' + f(bx) + ' ' + f(by) + 'Z" fill="' + cap + '"/>';
      }
    }
    return s;
  }
  function cloud(x, y, s, fill, op){
    const c = (cx, cy, rr) => '<circle cx="' + f(x + cx * s) + '" cy="' + f(y + cy * s) + '" r="' + f(rr * s) + '"/>';
    return '<g fill="' + fill + '" opacity="' + (op === undefined ? 1 : op) + '">' +
      '<rect x="' + f(x - 70 * s) + '" y="' + f(y - 6 * s) + '" width="' + f(150 * s) + '" height="' + f(34 * s) + '" rx="' + f(17 * s) + '"/>' +
      c(-38, 6, 30) + c(-6, -16, 40) + c(34, -2, 32) + c(62, 12, 20) + '</g>';
  }
  const sparkle = (x, y, s, fill, op) =>
    '<path d="M' + f(x) + ' ' + f(y - s) + 'Q' + f(x + s * .16) + ' ' + f(y - s * .16) + ' ' + f(x + s) + ' ' + f(y) +
    'Q' + f(x + s * .16) + ' ' + f(y + s * .16) + ' ' + f(x) + ' ' + f(y + s) + 'Q' + f(x - s * .16) + ' ' + f(y + s * .16) + ' ' +
    f(x - s) + ' ' + f(y) + 'Q' + f(x - s * .16) + ' ' + f(y - s * .16) + ' ' + f(x) + ' ' + f(y - s) + 'Z" fill="' + fill + '" opacity="' + (op || 1) + '"/>';
  function dots(r, n, x0, y0, x1, y1, r0, r1, fill, op0, op1){
    let s = '<g fill="' + fill + '">';
    for(let i = 0; i < n; i++){
      s += '<circle cx="' + f(x0 + r() * (x1 - x0)) + '" cy="' + f(y0 + r() * (y1 - y0)) + '" r="' + f(r0 + r() * (r1 - r0)) +
           '" opacity="' + f((op0 + r() * (op1 - op0)) * 100) / 100 + '"/>';
    }
    return s + '</g>';
  }
  /* 花瓣／葉片 */
  const leaf = (x, y, len, ang, fill, op) =>
    '<path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(ang) + ')" d="M0 0C' + f(len * .3) + ' ' + f(-len * .16) + ' ' +
    f(len * .7) + ' ' + f(-len * .14) + ' ' + f(len) + ' 0C' + f(len * .7) + ' ' + f(len * .14) + ' ' + f(len * .3) + ' ' + f(len * .16) + ' 0 0Z" fill="' + fill + '"' +
    (op ? ' opacity="' + op + '"' : '') + '/>';
  const wrap = (defs, body) =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice"><defs>' + defs + '</defs>' + body + '</svg>';
  const bg = id => '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + ')"/>';

  /* ── 12 個場景 ─────────────────────────────────────────── */
  const ART = {};

  ART['星海戰域'] = function(){
    const r = rng(11);
    let d = lin('sk', [[0,'#a9a2ff'],[.45,'#d4c6ff'],[1,'#ffd9ec']]) +
      rad('nb1', [[0,'#ffb3dc',.7],[1,'#ffb3dc',0]]) + rad('nb2', [[0,'#9fd7ff',.65],[1,'#9fd7ff',0]]) +
      lin('pl', [[0,'#fff1b8'],[1,'#ff9fb0']], 1, 1) + lin('isl', [[0,'#b8a6f5'],[1,'#8c7ddb']]) +
      lin('cr', [[0,'#e8fbff'],[1,'#8fd3ff']], 1, 1) + lin('hz', [[0,'#fff',0],[1,'#fff',.7]]);
    let b = bg('sk') + glow(1150, 260, 520, 330, 'nb1') + glow(330, 200, 460, 300, 'nb2') + glow(760, 620, 420, 200, 'nb1');
    b += dots(r, 90, 0, 0, W, 640, 1, 2.6, '#fff', .35, .95);
    for(let i = 0; i < 12; i++) b += sparkle(r() * W, r() * 560, 6 + r() * 16, i % 3 ? '#fff' : '#fff6c8', .7 + r() * .3);
    // 帶環行星
    b += '<g transform="translate(1290 200) rotate(-18)">' +
         '<ellipse rx="180" ry="40" fill="none" stroke="#fff" stroke-width="10" opacity=".5"/>' +
         '<circle r="96" fill="url(#pl)"/>' +
         '<path d="M-90 -28 Q0 -46 90 -28" stroke="#fff" stroke-width="10" fill="none" opacity=".35"/>' +
         '<path d="M-96 10 Q0 -6 96 10" stroke="#ffd0d8" stroke-width="14" fill="none" opacity=".55"/>' +
         '<path d="M-180 0 A180 40 0 0 0 180 0" fill="none" stroke="#fff" stroke-width="10" opacity=".9"/></g>';
    b += '<circle cx="250" cy="150" r="38" fill="#fff8dc"/><circle cx="238" cy="140" r="8" fill="#f3e3b8"/><circle cx="262" cy="166" r="6" fill="#f3e3b8"/>';
    // 浮空島
    [[260, 720, 1.1], [820, 790, 1.5], [1380, 700, 1.0]].forEach(function(p){
      const [x, y, s] = p;
      b += '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
        '<path d="M-150 0 Q-110 120 -20 170 Q10 120 40 150 Q110 90 150 0Z" fill="url(#isl)"/>' +
        '<ellipse cx="0" cy="0" rx="152" ry="26" fill="#d9ccff"/><ellipse cx="0" cy="-6" rx="140" ry="18" fill="#efe8ff"/>' +
        '<path d="M-60 -6 L-44 -86 L-28 -6Z" fill="url(#cr)"/><path d="M-30 -6 L-14 -56 L0 -6Z" fill="#c4ecff"/>' +
        '<path d="M50 -6 L66 -70 L82 -6Z" fill="url(#cr)"/><path d="M-44 -86 L-38 -10 L-52 -10Z" fill="#fff" opacity=".6"/></g>';
    });
    b += '<rect y="700" width="' + W + '" height="200" fill="url(#hz)"/>';
    return wrap(d, b);
  };

  ART['熔岩火山'] = function(){
    const r = rng(23);
    let d = lin('sk', [[0,'#ffe6c8'],[.55,'#ffc9ad'],[1,'#ffb3a4']]) +
      rad('gl', [[0,'#fff1a8',.95],[.4,'#ffb25c',.55],[1,'#ff8a5c',0]]) +
      lin('vo', [[0,'#c9706e'],[1,'#a95560']]) + lin('lv', [[0,'#fff2a0'],[1,'#ff7a3a']]) +
      lin('fg', [[0,'#b45b62'],[1,'#8f4352']]);
    let b = bg('sk') + peaks(r, 640, 220, 7, '#f4b9a7') + peaks(r, 700, 150, 9, '#eaa294');
    b += glow(800, 300, 360, 260, 'gl');
    for(let i = 0; i < 7; i++) b += cloud(700 + i * 34 - r() * 40, 230 - i * 34, .8 + i * .22, i % 2 ? '#fff3ea' : '#f7d9d0', .9 - i * .06);
    b += '<path d="M260 900 C430 760 600 520 700 330 Q800 300 900 330 C1000 520 1170 760 1340 900Z" fill="url(#vo)"/>';
    b += '<path d="M800 318 Q850 322 900 330 C1000 520 1170 760 1340 900 L960 900 C900 700 860 500 800 318Z" fill="#9a4c58" opacity=".35"/>';
    b += '<path d="M700 330 Q800 300 900 330 Q800 352 700 330Z" fill="#ffe28a"/>';
    b += '<path d="M760 340 C740 460 690 560 640 700" stroke="#c96a68" stroke-width="22" fill="none" opacity=".45"/>';
    // 熔岩流
    ['M790 338 C780 470 720 560 690 700 C680 760 640 820 610 900', 'M830 338 C850 450 900 560 930 660 C950 740 1000 820 1040 900',
     'M810 340 C810 420 800 500 820 580'].forEach(function(p){
      b += '<path d="' + p + '" stroke="#ff8a3d" stroke-width="22" fill="none" stroke-linecap="round"/>' +
           '<path d="' + p + '" stroke="url(#lv)" stroke-width="9" fill="none" stroke-linecap="round"/>';
    });
    b += hills(r, 840, 70, 6, 'url(#fg)');
    for(let i = 0; i < 9; i++){
      const x = r() * W, y = 830 + r() * 50;
      b += '<path d="M' + f(x) + ' ' + f(y) + 'l' + f(20 + r() * 30) + ' ' + f(-8 + r() * 16) + 'l' + f(18 + r() * 24) + ' ' + f(6 + r() * 10) + '" stroke="#ffb35c" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>';
    }
    b += dots(r, 60, 300, 120, 1300, 860, 1.5, 4.5, '#ffd36b', .5, 1);
    b += dots(r, 24, 400, 200, 1200, 700, 1, 2.5, '#fff', .6, 1);
    return wrap(d, b);
  };

  ART['月下竹林'] = function(){
    const r = rng(37);
    let d = lin('sk', [[0,'#c9ece4'],[.5,'#e3f6ea'],[1,'#f3fbe9']]) +
      rad('mh', [[0,'#fffbe6',.95],[.35,'#fffbe6',.5],[1,'#fffbe6',0]]) +
      rad('ff', [[0,'#fff9b0',1],[1,'#fff9b0',0]]) + lin('mist', [[0,'#fff',0],[1,'#fff',.85]]);
    let b = bg('sk') + glow(1170, 200, 300, 300, 'mh') + '<circle cx="1170" cy="200" r="104" fill="#fffdf0"/>' +
            '<circle cx="1140" cy="180" r="14" fill="#f3efd6"/><circle cx="1200" cy="226" r="10" fill="#f3efd6"/>';
    const stalk = function(x, w, col, node, hi, lean){
      let s = '<g transform="translate(' + f(x) + ' 0) rotate(' + f(lean) + ' 0 900)">' +
              '<rect x="' + f(-w / 2) + '" y="-40" width="' + f(w) + '" height="980" rx="' + f(w / 2) + '" fill="' + col + '"/>';
      if(hi) s += '<rect x="' + f(-w / 2 + w * .18) + '" y="-40" width="' + f(w * .16) + '" height="980" fill="' + hi + '" opacity=".55"/>';
      for(let y = 60 + r() * 60; y < 900; y += 110 + r() * 40){
        s += '<rect x="' + f(-w / 2 - 1) + '" y="' + f(y) + '" width="' + f(w + 2) + '" height="' + f(Math.max(3, w * .14)) + '" rx="2" fill="' + node + '"/>';
        if(r() < .45){
          const dir = r() < .5 ? -1 : 1;
          for(let k = 0; k < 3; k++) s += leaf(dir * w / 2, y, w * 2.4 + r() * w, dir < 0 ? 180 + 20 + k * 22 : -20 - k * 22, col);
        }
      }
      return s + '</g>';
    };
    for(let i = 0; i < 16; i++) b += stalk(i * 104 + r() * 60, 14 + r() * 6, '#c4e9d2', '#a9dbbd', null, (r() - .5) * 3);
    b += '<rect y="420" width="' + W + '" height="200" fill="#fff" opacity=".25"/>';
    for(let i = 0; i < 9; i++) b += stalk(i * 190 + r() * 90, 24 + r() * 8, '#95d4ad', '#76c194', '#c5f0d5', (r() - .5) * 4);
    b += hills(r, 800, 60, 5, '#e2f5e6') + '<rect y="640" width="' + W + '" height="260" fill="url(#mist)"/>';
    [[40, 46, -2], [190, 40, 1.5], [1430, 50, 2], [1560, 42, -1.5]].forEach(function(p){
      b += stalk(p[0], p[1], '#5db887', '#469f70', '#8fe0b0', p[2]);
    });
    for(let i = 0; i < 22; i++){
      const x = 200 + r() * 1200, y = 300 + r() * 520;
      b += glow(x, y, 14, 14, 'ff') + '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="2.6" fill="#fffbd0"/>';
    }
    return wrap(d, b);
  };

  ART['冰封凍原'] = function(){
    const r = rng(41);
    let d = lin('sk', [[0,'#c6e6ff'],[.5,'#e3f4ff'],[1,'#f6fbff']]) +
      lin('au1', [[0,'#8ff0d0',0],[.5,'#8ff0d0',.75],[1,'#8ff0d0',0]], 1, 0) +
      lin('au2', [[0,'#c7b2ff',0],[.5,'#c7b2ff',.6],[1,'#c7b2ff',0]], 1, 0) +
      lin('ice', [[0,'#e9f8ff'],[1,'#8fc9ef']], 1, 1) + lin('gr', [[0,'#fff'],[1,'#e2f1ff']]);
    let b = bg('sk');
    b += '<path d="M-50 230 C250 120 520 300 820 190 C1100 90 1350 250 1650 140 L1650 220 C1350 330 1100 170 820 270 C520 380 250 200 -50 310Z" fill="url(#au1)"/>';
    b += '<path d="M-50 140 C300 60 600 210 900 120 C1200 40 1400 160 1650 80 L1650 130 C1400 210 1200 90 900 170 C600 260 300 110 -50 190Z" fill="url(#au2)"/>';
    b += dots(r, 40, 0, 0, W, 400, 1, 2, '#fff', .5, 1);
    b += peaks(r, 640, 300, 6, '#b7d5f0', '#fff') + peaks(r, 720, 200, 8, '#cfe3f7', '#fff');
    b += hills(r, 790, 50, 5, 'url(#gr)');
    // 冰晶
    [[150, 900, 1.3], [330, 900, .8], [1270, 900, 1.1], [1460, 900, 1.5], [1560, 900, .7]].forEach(function(p){
      const [x, y, s] = p;
      b += '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
        '<path d="M-70 0 L-40 -190 L-10 0Z" fill="url(#ice)"/><path d="M-30 0 L10 -280 L50 0Z" fill="url(#ice)"/>' +
        '<path d="M30 0 L70 -150 L95 0Z" fill="url(#ice)"/><path d="M10 -280 L18 -20 L-6 -20Z" fill="#fff" opacity=".7"/>' +
        '<path d="M-40 -190 L-34 -20 L-48 -20Z" fill="#fff" opacity=".6"/></g>';
    });
    for(let i = 0; i < 26; i++){
      const x = r() * W, y = r() * 860, s = 3 + r() * 6;
      b += '<g stroke="#fff" stroke-width="' + f(s / 3.5) + '" stroke-linecap="round" opacity="' + f(.55 + r() * .45) + '">' +
           [0, 60, 120].map(a => '<line transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + a + ')" x1="' + (-s) + '" x2="' + s + '"/>').join('') + '</g>';
    }
    b += dots(r, 60, 0, 0, W, H, 1.5, 3.5, '#fff', .5, .95);
    return wrap(d, b);
  };

  ART['雷雲風暴'] = function(){
    const r = rng(53);
    let d = lin('sk', [[0,'#bdb2ee'],[.55,'#d9d1fa'],[1,'#efeaff']]) +
      rad('bo', [[0,'#fffbd0',.95],[1,'#fffbd0',0]]) + lin('fg', [[0,'#a597dd'],[1,'#8a7cc9']]);
    let b = bg('sk') + peaks(r, 720, 240, 6, '#c7bdf0') + peaks(r, 780, 140, 9, '#b6aae6');
    // 雨絲
    let rain = '<g stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".35">';
    for(let i = 0; i < 90; i++){ const x = r() * 1800 - 100, y = r() * 900; rain += '<line x1="' + f(x) + '" y1="' + f(y) + '" x2="' + f(x - 26) + '" y2="' + f(y + 70) + '"/>'; }
    b += rain + '</g>';
    // 閃電
    [[420, 170, 1], [1180, 140, 1.25], [880, 210, .7]].forEach(function(p){
      const [x, y, s] = p;
      const bolt = 'M0 0 L-46 150 L-6 150 L-40 300 L60 110 L16 110 L46 0Z';
      b += glow(x, y + 160 * s, 150 * s, 200 * s, 'bo') +
        '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="' + bolt + '" fill="#fff36b" stroke="#fffbe0" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/>';
    });
    // 厚雲
    for(let i = 0; i < 9; i++) b += cloud(i * 200 - 40 + r() * 60, 70 + r() * 70, 1.6 + r() * .8, i % 2 ? '#c9bff2' : '#b2a6e6', 1);
    for(let i = 0; i < 8; i++) b += cloud(i * 220 + r() * 80, 40 + r() * 40, 1.3 + r() * .6, '#e8e3ff', .95);
    b += hills(r, 830, 70, 5, 'url(#fg)');
    return wrap(d, b);
  };

  ART['黃昏廢墟'] = function(){
    const r = rng(67);
    let d = lin('sk', [[0,'#f4c3da'],[.5,'#ffd3bb'],[1,'#ffe8c4']]) +
      rad('sun', [[0,'#fff6d0',1],[.35,'#ffe4b0',.7],[1,'#ffd0b0',0]]) +
      lin('col', [[0,'#e8b7c2'],[1,'#c98d9d']], 1, 0) + lin('fg', [[0,'#e2a2a8'],[1,'#c98390']]);
    let b = bg('sk') + glow(800, 560, 520, 360, 'sun') + '<circle cx="800" cy="560" r="140" fill="#fff4cf"/>' +
      '<rect x="640" y="560" width="320" height="10" fill="#ffe0b8"/><rect x="660" y="590" width="280" height="9" fill="#ffe0b8"/>';
    b += hills(r, 700, 90, 6, '#f1b9b7') + hills(r, 760, 60, 7, '#eaa9ad');
    const column = function(x, h, broken, w){
      w = w || 60;
      let top = broken ? 'M' + f(x - w / 2) + ' ' + f(900 - h) + 'L' + f(x - w / 6) + ' ' + f(900 - h - 26) + 'L' + f(x + w / 8) + ' ' + f(900 - h - 6) + 'L' + f(x + w / 2) + ' ' + f(900 - h - 34)
                       : 'M' + f(x - w / 2) + ' ' + f(900 - h) + 'L' + f(x + w / 2) + ' ' + f(900 - h);
      let s = '<path d="' + top + 'L' + f(x + w / 2) + ' 900L' + f(x - w / 2) + ' 900Z" fill="url(#col)"/>';
      for(let k = -1; k <= 1; k++) s += '<rect x="' + f(x + k * w / 4 - 2) + '" y="' + f(900 - h + 10) + '" width="4" height="' + f(h - 10) + '" fill="#b97f90" opacity=".35"/>';
      if(!broken) s += '<rect x="' + f(x - w / 2 - 14) + '" y="' + f(900 - h - 24) + '" width="' + f(w + 28) + '" height="26" rx="4" fill="#d9a3b0"/>';
      return s;
    };
    b += column(120, 380, false) + column(240, 300, true) + column(1330, 420, false, 66) + column(1470, 260, true, 66);
    // 拱門
    b += '<path d="M480 900 L480 610 Q560 520 640 610 L640 900 L600 900 L600 625 Q560 575 520 625 L520 900Z" fill="#d79aaa"/>';
    b += '<path d="M960 900 L960 650 L1120 650 L1120 900 L1080 900 L1080 700 Q1040 660 1000 700 L1000 900Z" fill="#cf93a3"/>';
    b += hills(r, 850, 40, 6, 'url(#fg)');
    for(let i = 0; i < 26; i++){ const x = r() * W, y = 835 + r() * 50; b += leaf(x, y, 20 + r() * 16, -60 - r() * 60, '#d98e9a'); }
    for(let i = 0; i < 7; i++){ const x = 400 + r() * 800, y = 140 + r() * 220, s = 10 + r() * 8;
      b += '<path d="M' + f(x - s) + ' ' + f(y) + 'Q' + f(x - s / 2) + ' ' + f(y - s / 2) + ' ' + f(x) + ' ' + f(y) + 'Q' + f(x + s / 2) + ' ' + f(y - s / 2) + ' ' + f(x + s) + ' ' + f(y) + '" stroke="#c48298" stroke-width="3" fill="none" stroke-linecap="round"/>'; }
    return wrap(d, b);
  };

  ART['深海遺跡'] = function(){
    const r = rng(79);
    let d = lin('sk', [[0,'#c4f4f0'],[.5,'#a3dcee'],[1,'#8cc4e6']]) +
      lin('ray', [[0,'#fff',.55],[1,'#fff',0]]) + lin('pil', [[0,'#9bd3dc'],[1,'#6fb1c2']], 1, 0) + lin('sand', [[0,'#d6f0e4'],[1,'#b9e0d6']]);
    let b = bg('sk');
    for(let i = 0; i < 6; i++){ const x = 150 + i * 260 + r() * 80;
      b += '<path d="M' + f(x) + ' -20 L' + f(x + 90) + ' -20 L' + f(x + 260) + ' 900 L' + f(x + 60) + ' 900Z" fill="url(#ray)" opacity="' + f(.35 + r() * .35) + '"/>'; }
    b += hills(r, 700, 80, 6, '#9fd3e3');
    // 沉沒神殿
    b += '<g fill="url(#pil)"><rect x="560" y="430" width="480" height="40" rx="8"/><path d="M540 430 L800 330 L1060 430Z"/>';
    [600, 700, 900, 1000].forEach(function(x, i){ b += '<rect x="' + x + '" y="' + (470 + (i === 2 ? 60 : 0)) + '" width="44" height="' + (i === 2 ? 310 : 370) + '"/>'; });
    b += '</g><rect x="880" y="490" width="70" height="26" rx="6" fill="#86c3cf" transform="rotate(14 915 503)"/>';
    b += hills(r, 820, 60, 6, 'url(#sand)');
    // 海草與珊瑚
    for(let i = 0; i < 14; i++){
      const x = r() * W, h = 120 + r() * 200, col = i % 3 ? '#6cc9a4' : '#4fb592';
      let p = 'M' + f(x) + ' 900';
      for(let y = 900, k = 0; y > 900 - h; y -= 40, k++) p += 'Q' + f(x + (k % 2 ? 22 : -22)) + ' ' + f(y - 20) + ' ' + f(x) + ' ' + f(y - 40);
      b += '<path d="' + p + '" stroke="' + col + '" stroke-width="' + f(10 + r() * 6) + '" fill="none" stroke-linecap="round"/>';
    }
    [[260, 900], [1300, 900], [1460, 900]].forEach(function(p){
      const [x, y] = p;
      b += '<g stroke="#ff9fb8" stroke-width="12" stroke-linecap="round" fill="none"><path d="M' + x + ' ' + y + 'L' + x + ' ' + (y - 110) + '"/><path d="M' + x + ' ' + (y - 60) + 'Q' + (x - 40) + ' ' + (y - 80) + ' ' + (x - 46) + ' ' + (y - 130) + '"/>' +
           '<path d="M' + x + ' ' + (y - 40) + 'Q' + (x + 44) + ' ' + (y - 60) + ' ' + (x + 50) + ' ' + (y - 120) + '"/></g>';
    });
    // 魚與氣泡
    for(let i = 0; i < 7; i++){ const x = 100 + r() * 1400, y = 120 + r() * 420, s = .6 + r() * .7, dir = r() < .5 ? 1 : -1;
      b += '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s * dir) + ' ' + f(s) + ')" d="M0 0 Q30 -22 60 0 Q30 22 0 0Z M58 0 L78 -14 L78 14Z" fill="#fff" opacity=".55"/>'; }
    for(let i = 0; i < 40; i++){ const x = r() * W, y = r() * H, rr = 3 + r() * 9;
      b += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rr) + '" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-width="2" stroke-opacity=".7"/>'; }
    return wrap(d, b);
  };

  ART['黃沙古城'] = function(){
    const r = rng(89);
    let d = lin('sk', [[0,'#ffe2a8'],[.55,'#fff0cc'],[1,'#fff6e0']]) + rad('sun', [[0,'#fffbe8',1],[1,'#fff3c4',0]]) +
      lin('wall', [[0,'#e2b37d'],[1,'#c98f5a']]);
    let b = bg('sk') + glow(1240, 200, 260, 260, 'sun') + '<circle cx="1240" cy="200" r="78" fill="#fffbea"/>';
    b += hills(r, 660, 70, 4, '#f7dca2');
    // 城牆與城樓
    let wall = '<g fill="url(#wall)"><rect x="0" y="560" width="1600" height="200"/>';
    for(let x = 0; x < 1600; x += 46) wall += '<rect x="' + x + '" y="536" width="28" height="30" rx="3"/>';
    wall += '</g><rect x="0" y="600" width="1600" height="6" fill="#c48852" opacity=".5"/><rect x="0" y="680" width="1600" height="6" fill="#c48852" opacity=".4"/>';
    b += wall;
    const tower = function(cx, s){
      return '<g transform="translate(' + cx + ' 560) scale(' + s + ')">' +
        '<rect x="-130" y="-120" width="260" height="120" fill="#d9a36c"/>' +
        '<path d="M-200 -120 Q-150 -128 -120 -170 L120 -170 Q150 -128 200 -120Z" fill="#a8604a"/>' +
        '<rect x="-100" y="-210" width="200" height="44" fill="#e3b27c"/>' +
        '<path d="M-160 -206 Q-120 -212 -100 -250 L100 -250 Q120 -212 160 -206Z" fill="#a8604a"/>' +
        '<rect x="-60" y="-110" width="24" height="40" fill="#b97a4c"/><rect x="36" y="-110" width="24" height="40" fill="#b97a4c"/>' +
        '<path d="M-60 200 L-60 70 Q0 10 60 70 L60 200Z" fill="#9b5e3c"/></g>';
    };
    b += tower(800, 1);
    [[560, '#ef6a5a'], [1040, '#ef6a5a'], [300, '#f0a03c'], [1300, '#f0a03c']].forEach(function(p){
      b += '<line x1="' + p[0] + '" y1="410" x2="' + p[0] + '" y2="560" stroke="#8f5a3a" stroke-width="5"/>' +
           '<path d="M' + p[0] + ' 414 Q' + (p[0] + 40) + ' 424 ' + (p[0] + 70) + ' 414 L' + (p[0] + 70) + ' 470 Q' + (p[0] + 40) + ' 480 ' + p[0] + ' 470Z" fill="' + p[1] + '"/>';
    });
    b += hills(r, 790, 60, 4, '#f3cd85') + hills(r, 860, 50, 3, '#ecbd6c');
    for(let i = 0; i < 5; i++){ const x = 200 + r() * 1200, y = 100 + r() * 200, s = 9 + r() * 6;
      b += '<path d="M' + f(x - s) + ' ' + f(y) + 'Q' + f(x - s / 2) + ' ' + f(y - s / 2) + ' ' + f(x) + ' ' + f(y) + 'Q' + f(x + s / 2) + ' ' + f(y - s / 2) + ' ' + f(x + s) + ' ' + f(y) + '" stroke="#c99a5a" stroke-width="3" fill="none" stroke-linecap="round"/>'; }
    b += dots(r, 50, 0, 600, W, H, 1, 2.6, '#fff4d6', .5, .9);
    return wrap(d, b);
  };

  ART['櫻花庭園'] = function(){
    const r = rng(97);
    let d = lin('sk', [[0,'#ffdcec'],[.55,'#ffeef5'],[1,'#fff7f0']]) + lin('pond', [[0,'#d9f0fb'],[1,'#bfe3f5']]) +
      lin('tr', [[0,'#c79595'],[1,'#a87777']], 1, 0);
    let b = bg('sk');
    b += '<path d="M380 600 L760 260 Q800 236 840 260 L1220 600Z" fill="#f2d3e6"/><path d="M718 298 L760 260 Q800 236 840 260 L882 298 Q850 316 820 300 Q800 318 780 300 Q750 316 718 298Z" fill="#fff"/>';
    b += hills(r, 640, 50, 5, '#f7dce8') + hills(r, 720, 40, 6, '#f4cfdf');
    // 鳥居
    b += '<g fill="#ff6f61"><rect x="1120" y="420" width="26" height="330"/><rect x="1294" y="420" width="26" height="330"/>' +
         '<rect x="1100" y="440" width="240" height="20"/><path d="M1060 392 Q1220 410 1380 392 L1376 418 Q1220 432 1064 418Z"/></g>' +
         '<path d="M1056 386 Q1220 404 1384 386 L1380 396 Q1220 414 1060 396Z" fill="#4a3a52"/>';
    // 池塘
    b += '<ellipse cx="620" cy="800" rx="300" ry="54" fill="url(#pond)"/><ellipse cx="560" cy="792" rx="80" ry="6" fill="#fff" opacity=".7"/><ellipse cx="700" cy="812" rx="50" ry="4" fill="#fff" opacity=".6"/>';
    // 石燈籠
    b += '<g fill="#d8c6cf"><rect x="250" y="760" width="70" height="20" rx="4"/><rect x="272" y="680" width="26" height="82"/><rect x="242" y="640" width="86" height="44" rx="6"/>' +
         '<path d="M226 646 Q285 600 344 646Z"/></g><rect x="268" y="652" width="34" height="22" rx="4" fill="#fff6c8"/>';
    // 櫻花樹
    const tree = function(x, y, s, flip){
      let t = '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')">' +
        '<path d="M-14 0 C-10 -80 -30 -150 -80 -210 L-60 -220 C-20 -170 0 -130 6 -90 C20 -150 60 -190 120 -210 L126 -194 C70 -170 30 -120 18 -60 C16 -30 16 -10 14 0Z" fill="url(#tr)"/>';
      for(let i = 0; i < 26; i++){
        const cx = -110 + r() * 260, cy = -330 + r() * 160, rr = 30 + r() * 30;
        t += '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(rr) + '" fill="' + ['#ffc6dc', '#ffd9e8', '#ffb3cf', '#ffe6ef'][i % 4] + '"/>';
      }
      return t + '</g>';
    };
    b += tree(150, 900, 1.25, false) + tree(1520, 900, 1.15, true) + tree(880, 740, .55, false);
    b += hills(r, 860, 30, 6, '#f6d6e2');
    for(let i = 0; i < 46; i++) b += leaf(r() * W, r() * 880, 10 + r() * 10, r() * 360, ['#ffb3cf', '#ffc6dc', '#ff9fc0'][i % 3], .9);
    return wrap(d, b);
  };

  ART['軌道要塞'] = function(){
    const r = rng(103);
    let d = lin('sk', [[0,'#d9e4fa'],[.55,'#ecf1fb'],[1,'#f6f8fd']]) + lin('pl', [[0,'#bfe0ff'],[1,'#7fb4ef']]) +
      rad('atm', [[.82,'#ffffff',0],[.9,'#ffffff',.85],[1,'#ffffff',0]]) + lin('hull', [[0,'#eef3fb'],[1,'#b8c6e3']]);
    let b = bg('sk');
    let grid = '<g stroke="#c4d2ee" stroke-width="1.5" opacity=".6">';
    for(let x = 0; x <= W; x += 80) grid += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="900"/>';
    for(let y = 0; y <= H; y += 80) grid += '<line x1="0" y1="' + y + '" x2="1600" y2="' + y + '"/>';
    b += grid + '</g>' + dots(r, 50, 0, 0, W, 520, 1, 2.2, '#fff', .6, 1);
    // 行星弧面
    b += glow(800, 1820, 1240, 1240, 'atm') + '<circle cx="800" cy="1820" r="1120" fill="url(#pl)"/>';
    for(let i = 0; i < 8; i++) b += '<ellipse cx="' + f(150 + r() * 1300) + '" cy="' + f(760 + r() * 120) + '" rx="' + f(80 + r() * 140) + '" ry="' + f(10 + r() * 12) + '" fill="#fff" opacity=".55"/>';
    // 太空站
    b += '<g transform="translate(800 300)">' +
      '<ellipse rx="330" ry="70" fill="none" stroke="#c8d4ee" stroke-width="26"/><ellipse rx="330" ry="70" fill="none" stroke="#fff" stroke-width="8"/>' +
      '<rect x="-470" y="-22" width="940" height="44" rx="22" fill="url(#hull)"/>' +
      '<g fill="#8fb0ea" stroke="#fff" stroke-width="3">' +
      [-600, -520, 440, 520].map(x => '<rect x="' + x + '" y="-90" width="80" height="180" rx="6"/>').join('') + '</g>' +
      '<circle r="96" fill="url(#hull)"/><circle r="62" fill="#dbe6fb"/><circle r="30" fill="#fff3a6"/>';
    for(let i = 0; i < 10; i++) b += '<circle cx="' + (-430 + i * 96) + '" cy="0" r="6" fill="#fff3a6"/>';
    b += '</g>';
    // 浮動平台
    [[230, 560, .9], [1390, 520, 1.1]].forEach(function(p){
      b += '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')"><path d="M-80 0 L-40 -40 L40 -40 L80 0 L40 40 L-40 40Z" fill="url(#hull)"/>' +
           '<path d="M-80 0 L80 0" stroke="#fff" stroke-width="4"/><circle r="10" fill="#9fd0ff"/></g>';
    });
    return wrap(d, b);
  };

  ART['血月鬼域'] = function(){
    const r = rng(113);
    let d = lin('sk', [[0,'#e2b9d6'],[.55,'#efd0e3'],[1,'#f7e4ee']]) + rad('mh', [[0,'#ffb3c4',.8],[1,'#ffb3c4',0]]) +
      rad('wisp', [[0,'#e6f8ff',1],[.45,'#a8e1ff',.8],[1,'#a8e1ff',0]]);
    let b = bg('sk') + glow(800, 280, 420, 380, 'mh') + '<circle cx="800" cy="280" r="170" fill="#ff9db2"/>' +
      '<circle cx="760" cy="250" r="160" fill="#ffb6c6"/>' +
      '<circle cx="720" cy="220" r="26" fill="#ff9db2" opacity=".7"/><circle cx="830" cy="320" r="34" fill="#ff9db2" opacity=".6"/><circle cx="700" cy="330" r="16" fill="#ff9db2" opacity=".6"/>';
    b += hills(r, 700, 70, 6, '#e3bfd6') + hills(r, 780, 50, 7, '#d8aecb');
    const tree = function(x, s, flip){
      return '<g transform="translate(' + x + ' 900) scale(' + (flip ? -s : s) + ' ' + s + ')" fill="#a77d9c">' +
        '<path d="M-20 0 C-14 -120 -30 -220 -16 -330 C-60 -380 -110 -390 -150 -440 L-140 -452 C-100 -410 -60 -400 -14 -360 C-6 -420 20 -460 70 -500 L78 -488 C34 -450 10 -400 8 -340 C40 -360 90 -370 130 -400 L136 -388 C96 -356 50 -340 10 -310 C16 -200 22 -100 22 0Z"/></g>';
    };
    b += tree(120, 1.35, false) + tree(1490, 1.25, true) + tree(1330, .7, false);
    // 墓碑與鳥居
    [[420, 800], [520, 820], [1080, 810], [1180, 790]].forEach(function(p){
      b += '<path d="M' + (p[0] - 30) + ' ' + (p[1] + 60) + 'L' + (p[0] - 30) + ' ' + p[1] + 'Q' + p[0] + ' ' + (p[1] - 40) + ' ' + (p[0] + 30) + ' ' + p[1] + 'L' + (p[0] + 30) + ' ' + (p[1] + 60) + 'Z" fill="#c69cbb"/>';
    });
    b += '<g fill="#b98aad"><rect x="700" y="600" width="18" height="230"/><rect x="882" y="600" width="18" height="230"/><rect x="684" y="620" width="232" height="14"/><path d="M660 580 Q800 594 940 580 L936 602 Q800 614 664 602Z"/></g>';
    b += hills(r, 860, 30, 6, '#cfa3c2');
    // 鬼火
    for(let i = 0; i < 9; i++){ const x = 200 + r() * 1200, y = 380 + r() * 380, s = .7 + r() * .7;
      b += glow(x, y, 40 * s, 40 * s, 'wisp') + '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s) + ')" d="M0 16 C-16 16 -18 0 -8 -10 C-8 -20 -2 -30 -6 -44 C8 -34 18 -20 16 -2 C22 -10 22 -18 20 -24 C28 -12 26 16 0 16Z" fill="#d6f2ff"/>' +
             '<ellipse cx="' + f(x) + '" cy="' + f(y + 4 * s) + '" rx="' + f(5 * s) + '" ry="' + f(7 * s) + '" fill="#fff"/>'; }
    for(let i = 0; i < 6; i++){ const x = 300 + r() * 1000, y = 90 + r() * 220, s = .6 + r() * .5;
      b += '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s) + ')" d="M0 0 Q-14 -12 -30 -6 Q-22 0 -26 8 Q-12 2 0 10 Q12 2 26 8 Q22 0 30 -6 Q14 -12 0 0Z" fill="#9b6f90"/>'; }
    return wrap(d, b);
  };

  ART['翠綠平原'] = function(){
    const r = rng(127);
    let d = lin('sk', [[0,'#b8e2ff'],[.55,'#dcf1ff'],[1,'#f2fbff']]) + rad('sun', [[0,'#fffbe0',1],[1,'#fff6c8',0]]) +
      lin('path', [[0,'#fff3d6'],[1,'#f3dfb4']]);
    let b = bg('sk') + glow(260, 150, 230, 230, 'sun') + '<circle cx="260" cy="150" r="70" fill="#fffbe6"/>';
    [[520, 150, 1.4], [980, 110, 1.1], [1340, 190, 1.6], [180, 330, .9], [760, 300, .8]].forEach(p => { b += cloud(p[0], p[1], p[2], '#fff', .95); });
    b += hills(r, 620, 120, 4, '#c4ebc6') + hills(r, 700, 90, 5, '#a6e0a8');
    // 風車
    b += '<g transform="translate(1190 560)"><path d="M-26 0 L-16 -150 L16 -150 L26 0Z" fill="#f2dcc0" stroke="#d9bd9a" stroke-width="3"/><rect x="-8" y="-40" width="16" height="26" rx="8" fill="#c9a27a"/><path d="M-24 -150 L0 -186 L24 -150Z" fill="#f08a7a"/>' +
         '<g transform="translate(0 -158) rotate(18)" fill="#fffdf6">' + [0, 90, 180, 270].map(a => '<rect transform="rotate(' + a + ')" x="-11" y="-130" width="22" height="120" rx="4" stroke="#d9bd9a" stroke-width="3"/>').join('') +
         '</g><circle cy="-158" r="10" fill="#f08a7a"/></g>';
    b += hills(r, 790, 80, 5, '#86d38c');
    b += '<path d="M640 900 C700 820 860 790 880 740 C900 700 840 690 860 660 L900 660 C900 700 980 720 960 760 C930 820 820 860 820 900Z" fill="url(#path)"/>';
    // 圓樹
    [[180, 760, 1.2], [320, 790, .9], [1420, 770, 1.3], [1540, 800, 1]].forEach(function(p){
      b += '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')"><rect x="-8" y="-20" width="16" height="70" rx="6" fill="#b48a6a"/>' +
           '<circle cy="-60" r="58" fill="#5fbf6e"/><circle cx="-26" cy="-80" r="30" fill="#7ad08a"/></g>';
    });
    b += hills(r, 870, 30, 6, '#74c97c');
    b += dots(r, 40, 0, 760, W, 900, 3, 6, '#fff7a8', .8, 1) + dots(r, 30, 0, 760, W, 900, 3, 6, '#ffc2d9', .8, 1) + dots(r, 20, 0, 760, W, 900, 3, 5, '#ffffff', .8, 1);
    return wrap(d, b);
  };

  /* 細紙紋：小張的雜訊圖鋪滿，讓平塗色塊有一點手感 */
  function grainTile(){
    const r = rng(7);
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">';
    for(let i = 0; i < 260; i++){
      s += '<rect x="' + f(r() * 180) + '" y="' + f(r() * 180) + '" width="' + f(1 + r() * 1.6) + '" height="' + f(1 + r() * 1.6) + '" fill="' +
           (r() < .5 ? '#ffffff' : '#5c5590') + '" opacity="' + f((r() < .5 ? .25 : .07) * 100) / 100 + '"/>';
    }
    return s + '</svg>';
  }
  const toUrl = svg => 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  const CACHE = {};
  let GRAIN = null;
  return {
    names: Object.keys(ART),
    svg: name => ART[name] ? ART[name]() : '',
    /* 戰場背景：紙紋疊在插畫上 */
    image: function(name){
      if(!ART[name]) return '';
      if(!GRAIN) GRAIN = toUrl(grainTile());
      if(!CACHE[name]) CACHE[name] = toUrl(ART[name]());
      return GRAIN + ',' + CACHE[name];
    }
  };
})();

/* 戰場背景：每回合隨機換一個。base 是插畫載入前的底色 */
const STAGES = [
  {name:'星海戰域', base:'#d4c6ff'}, {name:'熔岩火山', base:'#ffc9ad'}, {name:'月下竹林', base:'#e3f6ea'},
  {name:'冰封凍原', base:'#e3f4ff'}, {name:'雷雲風暴', base:'#d9d1fa'}, {name:'黃昏廢墟', base:'#ffd3bb'},
  {name:'深海遺跡', base:'#a3dcee'}, {name:'黃沙古城', base:'#fff0cc'}, {name:'櫻花庭園', base:'#ffeef5'},
  {name:'軌道要塞', base:'#ecf1fb'}, {name:'血月鬼域', base:'#efd0e3'}, {name:'翠綠平原', base:'#dcf1ff'}
];
function rollStage(){
  const st = STAGES[Math.floor(Math.random()*STAGES.length)];
  const el = $('stage');
  const bgEl = $('stage-bg');
  if(bgEl){ bgEl.style.backgroundColor = st.base; bgEl.style.backgroundImage = SCENE.image(st.name); }
  log('🏟️ 戰場：' + st.name, 'var(--dim)');
}

const STATUS_INFO = {
  atkUp  :{label:'攻擊提升', color:'var(--ember)'},
  defUp  :{label:'防禦提升', color:'var(--ion)'},
  evadeUp:{label:'閃避提升', color:'var(--jade)'},
  focus  :{label:'必中集中', color:'var(--gold)'},
  charge :{label:'蓄力',     color:'var(--gold)'},
  poison :{label:'中毒',     color:'#5fae1a'},
  blind  :{label:'命中下降', color:'#7d78a3'},
  weaken :{label:'攻擊下降', color:'#8b68ee'},
  fragile:{label:'防禦破損', color:'var(--ember)'},
  critUp :{label:'會心提升', color:'var(--gold)'},
  regen  :{label:'持續回復', color:'var(--jade)'},
  thorns :{label:'荊棘反傷', color:'var(--ember)'},
  smite  :{label:'追加傷害', color:'var(--gold)'},
  burst  :{label:'最後爆發', color:'var(--ember)'},
  jackpot:{label:'必中會心', color:'var(--gold)'},
  extraHit:{label:'連續攻擊', color:'var(--ember)'},
  alwaysCounter:{label:'必定反擊', color:'var(--ion)'},
  odrive :{label:'火力全開', color:'var(--ember)'},
  fort   :{label:'要塞化',   color:'var(--ion)'},
  lucky  :{label:'幸運星',   color:'var(--jade)'},
  seed   :{label:'覺醒',     color:'var(--ion)'},
  zero   :{label:'系統輔助', color:'var(--jade)'},
  alaya  :{label:'天敵直覺', color:'var(--jade)'},
  nemesis:{label:'宿敵',     color:'var(--ember)'},
  master :{label:'誓約之盾', color:'var(--u-oath)'},
  muzan  :{label:'下剋上',   color:'var(--u-sengoku)'}
};
/* 同一個特技，不同定位的強度不一樣：
   攻擊型的增傷最猛、防禦型的減傷最硬、耐久型的回復最多、幸運型的閃避與會心最高 */
const SKILL_MAG = {
  atk_up  :{attacker:1.55, swift:1.35, lucky:1.35, balance:1.30, tank:1.25, guard:1.20},
  def_up  :{guard:0.50,    tank:0.62,  balance:0.72, swift:0.75, lucky:0.75, attacker:0.82},
  evade_up:{lucky:0.32,    swift:0.26, balance:0.20, guard:0.20, tank:0.15, attacker:0.15},
  focus   :{swift:0.45,    lucky:0.40, attacker:0.35, balance:0.32, guard:0.30, tank:0.30},
  charge  :{attacker:2.20, swift:1.90, lucky:1.90, balance:1.80, tank:1.70, guard:1.60},
  smite   :{attacker:90,   swift:65,   lucky:65,   balance:60,  tank:55,   guard:50},
  crit_up :{lucky:0.35,    attacker:0.28, swift:0.28, balance:0.22, tank:0.20, guard:0.20},
  heal    :{tank:0.20,     guard:0.15, balance:0.13, swift:0.12, lucky:0.12, attacker:0.10},
  regen   :{tank:0.09,     guard:0.07, balance:0.06, swift:0.05, lucky:0.05, attacker:0.05},
  drain   :{tank:70,       guard:60,   lucky:60,   balance:55,  swift:50,  attacker:50},
  thorns  :{guard:0.55,    tank:0.45,  balance:0.35, attacker:0.30, swift:0.30, lucky:0.30},
  poison  :{balance:0.07,  guard:0.06, tank:0.06,  lucky:0.05,  swift:0.05, attacker:0.05},
  blind   :{balance:32,    guard:30,   lucky:26,   swift:24,    tank:24,   attacker:22},
  weaken  :{balance:0.66,  guard:0.68, tank:0.70,  lucky:0.74,  swift:0.74, attacker:0.78},
  reload  :{balance:0.08,  guard:0.08, tank:0.08,  lucky:0.08,  swift:0.08, attacker:0.08}
};
function mag(effect, role){
  const t = SKILL_MAG[effect];
  return t ? (t[role || 'balance'] !== undefined ? t[role] : t.balance) : 0;
}
function skillText(effect, role){
  const v = mag(effect, role);
  switch(effect){
    case 'atk_up'  : return '接下來 2 回合攻擊 ×' + v.toFixed(2);
    case 'def_up'  : return '接下來 2 回合受到的傷害 ×' + v.toFixed(2);
    case 'evade_up': return '接下來 2 回合閃避率 +' + Math.round(v*100) + '%';
    case 'focus'   : return '下一擊必定命中，會心率 +' + Math.round(v*100) + '%';
    case 'charge'  : return '下一擊傷害 ×' + v.toFixed(2);
    case 'smite'   : return '下一擊額外追加 ' + v + ' 點固定傷害';
    case 'crit_up' : return '接下來 2 回合會心率 +' + Math.round(v*100) + '%';
    case 'heal'    : return '立刻回復最大體力的 ' + Math.round(v*100) + '%';
    case 'regen'   : return '接下來 3 回合每回合回復 ' + Math.round(v*100) + '% 體力';
    case 'drain'   : return '抽取對手 ' + v + ' 點體力補給自己';
    case 'thorns'  : return '接下來 2 回合，受擊時反彈 ' + Math.round(v*100) + '% 傷害';
    case 'poison'  : return '對手中毒 3 回合，每回合流失 ' + Math.round(v*100) + '% 體力';
    case 'blind'   : return '對手 2 回合命中率 −' + v;
    case 'weaken'  : return '對手 2 回合攻擊 ×' + v.toFixed(2) + '，防禦破損';
    case 'reload'  : return '立刻回復 20% 體力並穩住陣腳';
    default        : return '';
  }
}
const SKILL_TEXT = new Proxy({}, { get:(t,k)=>skillText(String(k), 'balance') });
const ABILITY_TEXT = {
  overdrive   :'火力全開！3 回合內攻擊 ×1.6',
  fortress    :'要塞化！3 回合內受到的傷害 ×0.55',
  revive      :'立刻回復最大體力的 30%',
  lucky_star  :'3 回合內會心 +40%、閃避 +20%',
  execute     :'鎖定弱點，直接造成對手最大體力 18% 的傷害',
  purge       :'解除自身所有負面狀態並回復 15% 體力',
  trans_am    :'全力運轉！3 回合內攻擊 ×1.5',
  zero_system :'看穿弱點，此後攻擊 ×1.2、命中 +10',
  seed_mode   :'極限集中！本回合無視屬性抗性且必定命中',
  alaya_vijnana:'天敵直覺！攻擊屬性剋制對手時，傷害再 ×1.4、受創 ×0.75',
  nemesis     :'宿敵！對上指定陣營時，造成傷害 ×1.5、受到傷害 ×0.7',
  ntd_system  :'（舊版能力，已由「宿敵」nemesis 取代）',
  psyco_frame :'共鳴爆發，直接削減對手 200 體力',
  auto_solve  :'直接看穿答案：作答前發動可自動選出正解（每題都能使用）',
  last_burst  :'孤注一擲！本次攻擊傷害 ×2.6',
  retaliate   :'反擊態勢！3 回合內反傷 55%，且防禦必定反擊',
  endure      :'不屈！3 回合內受到的傷害 ×0.55，每回合回復 8% 體力',
  jackpot     :'幸運爆發！本次攻擊必定會心，傷害再 ×2',
  blitz       :'疾風連擊！本次攻擊連打兩次'
};
function newStatus(){
  return {atkUp:0,defUp:0,evadeUp:0,focus:0,charge:0,poison:0,blind:0,weaken:0,fragile:0,
          critUp:0,regen:0,thorns:0,smite:0,burst:0,jackpot:0,extraHit:0,alwaysCounter:0,
          atkUpMul:1.3,defUpMul:0.72,evadeUpVal:0.2,focusCrit:0.32,chargeMul:1.8,
          critUpVal:0.22,regenPct:0.06,thornsVal:0.35,smiteVal:60,
          poisonPct:0.05,blindVal:25,weakenMul:0.72,
          odrive:0,odriveMul:1,fort:0,lucky:0,seed:0,zero:false,alaya:false,nemesis:false,
          abilitySealed:false,
          spFocus:0,spHit:0,spDodge:0,spAccel:0,spDmg:0,spCrit:0,spIron:0,
          spLuck:0,spBless:0,spFriend:0,spAwaken:0,
          master:false,muzan:false,usedAb:{},upgraded:false,guard:undefined};
}

const CLAN_PASSIVE = {
  myth   :{name:'神威',     sp:4,        desc:'開場 SP +4'},
  oath   :{name:'誓約之盾',  master:true, desc:'防禦招減傷再 ×0.5'},
  sengoku:{name:'下剋上',    zero:true,   desc:'攻擊 ×1.2、命中 +10'},
  zhulu  :{name:'兵法',      evadeUp:99, evadeUpVal:0.05, critUp:99, critUpVal:0.08,
                                          desc:'先攻 +8、閃避 +5%、會心 +8%'},
  shuihu :{name:'義氣',      thorns:99,  thornsVal:0.15, desc:'受擊反彈 15%'},
  major  :{name:'預修學分',  spTick:2,    desc:'每題 SP +2'},
  wild   :{name:'野性自癒',  regen:99,   regenPct:0.05,  desc:'每回合回復 5% 體力'},
  special:{name:'',          desc:''}
};
/* phase: 'init' 開場／換角色／敵方登場　'tick' 每題開始 */
function applyClanPassive(ch, st, isPlayer, phase){
  if(!ch || !st) return;
  const p = CLAN_PASSIVE[ch.universe];
  if(!p) return;
  if(p.master) st.master = true;
  if(p.zero)   st.zero   = true;
  /* 長效狀態只在「空著」時補回，避免蓋掉特技暫時給的更強數值 */
  if(p.evadeUp && st.evadeUp <= 0){ st.evadeUp = p.evadeUp; st.evadeUpVal = p.evadeUpVal; }
  if(p.critUp  && st.critUp  <= 0){ st.critUp  = p.critUp;  st.critUpVal  = p.critUpVal; }
  if(p.thorns  && st.thorns  <= 0){ st.thorns  = p.thorns;  st.thornsVal  = p.thornsVal; }
  if(p.regen   && st.regen   <= 0){ st.regen   = p.regen;   st.regenPct   = p.regenPct; }
  if(isPlayer && phase === 'init' && p.sp)     S.sp += p.sp;
  if(isPlayer && phase === 'tick' && p.spTick) S.sp += p.spTick;
}

function tickStatus(st){
  ['atkUp','defUp','evadeUp','poison','blind','weaken','fragile','odrive','fort','lucky','seed',
   'critUp','regen','thorns','alwaysCounter','spFocus']
    .forEach(k=>{ if(st[k] > 0) st[k]--; });
  ['spHit','spDodge','spAccel','spDmg','spCrit','spIron','spLuck','spBless','spFriend','spAwaken']
    .forEach(k=>{ st[k] = 0; });
}

/* ============================================================================
   畫面特效
   ========================================================================== */
const MELEE_TYPES = ['近戰','格鬥','物理','一般','岩石','地面','土'];
function fxKindOf(move){
  const t = BREATH[move.type] || move.type;
  return MELEE_TYPES.indexOf(t) >= 0 ? 'slash' : 'beam';
}
function addFx(hostId, cls, life){
  const host = $(hostId); if(!host) return;
  const el = document.createElement('div'); el.className = cls;
  host.appendChild(el); setTimeout(()=>el.remove(), life || 800);
}
function popNumber(where, n, cls){
  const host = $(where); if(!host) return;
  const el = document.createElement('div');
  el.className = 'pop' + (cls ? ' '+cls : '');
  el.textContent = (typeof n === 'number') ? '-'+n : n;
  host.appendChild(el); setTimeout(()=>el.remove(), 1000);
}
function banner(text, cyan){
  const el = document.createElement('div');
  el.className = 'banner' + (cyan ? ' cyan' : '');
  el.textContent = text; el.style.left='50%'; el.style.transform='translate(-50%,0)';
  document.body.appendChild(el); setTimeout(()=>el.remove(), 960);
}
function screenFlash(tone){
  const el = document.createElement('div');
  el.className = 'screenflash' + (tone ? ' '+tone : '');
  document.body.appendChild(el); setTimeout(()=>el.remove(), 320);
}
function shakeStage(hard){
  const s = $('stage');
  s.classList.add(hard ? 'shake-hard' : 'shake');
  setTimeout(()=>s.classList.remove('shake','shake-hard'), hard ? 520 : 360);
}
function hpFlash(side){
  const bar = $(side+'-bar'); if(!bar) return;
  bar.classList.add('flash'); setTimeout(()=>bar.classList.remove('flash'), 340);
}
function impact(side, hard){
  const host = side === 'p' ? 'f-p' : 'f-e';
  $(host).classList.add('hit'); setTimeout(()=>$(host).classList.remove('hit'), 440);
  addFx(host,'spark',430); addFx(host,'wave',580);
  hpFlash(side); shakeStage(hard);
}
function lunge(side){
  const img = $(side === 'p' ? 'p-img' : 'e-img');
  img.classList.add(side === 'p' ? 'lunge-l' : 'lunge-r');
  setTimeout(()=>img.classList.remove('lunge-l','lunge-r'), 450);
}
function attackFx(targetSide, kind){
  const host = targetSide === 'p' ? 'f-p' : 'f-e';
  if(kind === 'slash'){ addFx(host,'slashfx',420); addFx(host,'slashfx b',520); sfx('slash'); }
  else { addFx(host,'beamfx',480); sfx('beam'); }
}
function auraFx(side, cls){
  addFx(side === 'p' ? 'f-p' : 'f-e', cls || 'shieldfx', 780);
}
/* 合體時的支援角立繪 */
function showAssist(side, ally){
  const box = $(side + '-assist');
  if(!box) return;
  box.innerHTML = '';
  const im = document.createElement('img');
  im.referrerPolicy = 'no-referrer';
  im.onerror = function(){ im.onerror = null; im.src = ally.ph; };
  im.src = ally.img;
  const nm = document.createElement('span'); nm.textContent = ally.name;
  box.append(im, nm);
  box.classList.add('on');
  setTimeout(()=>box.classList.remove('on'), 2600);
}

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

/* ============================================================================
   選角畫面
   ========================================================================== */
const UNIVERSES = [
  {k:'myth',    label:'⚡ 神域', keys:['myth']},
  {k:'oath',    label:'🛡️ 誓約', keys:['oath']},
  {k:'sengoku', label:'🏯 亂世', keys:['sengoku']},
  {k:'zhulu',   label:'🐉 逐鹿', keys:['zhulu']},
  {k:'shuihu',  label:'🍶 梁山', keys:['shuihu']},
  {k:'major',   label:'🎓 學府', keys:['major']},
  {k:'wild',    label:'🌿 淺山', keys:['wild']},
  {k:'special', label:'💠 特殊', keys:['special']}
];
const UNI_LABEL = {
  myth:'⚡ 神域', oath:'🛡️ 誓約', sengoku:'🏯 亂世', zhulu:'🐉 逐鹿',
  shuihu:'🍶 梁山', major:'🎓 學府', wild:'🌿 淺山', special:'💠 特殊'
};
/* 試算表 C 欄可以寫「神域」或「⚡ 神域」，兩種都認得 */
const UNI_BY_LABEL = {
  '⚡ 神域':'myth', '🛡️ 誓約':'oath', '🏯 亂世':'sengoku', '🐉 逐鹿':'zhulu',
  '🍶 梁山':'shuihu', '🎓 學府':'major', '🌿 淺山':'wild', '💠 特殊':'special',
  '神域':'myth', '誓約':'oath', '亂世':'sengoku', '逐鹿':'zhulu',
  '梁山':'shuihu', '學府':'major', '淺山':'wild', '特殊':'special'
};
const UNIVERSE_FILTER = {};
UNIVERSES.forEach(u=>{ UNIVERSE_FILTER[u.k] = u.keys; });
let selected = null;

/* 隱藏角色：輸入密碼才會出現在陣容中（僅本次開啟有效） */
const SECRET_PW = { sp_quewue:'nsshchiue' };
const UNLOCKED  = {};

/* ── 解鎖貓：陣營 → 角色ID ──────────────────────────────
   用該陣營的角色打贏一場，就解鎖那一隻。進化過也算，
   因為 applyForm() 不會改動 universe。 */
const CAT_BY_UNI = {
  myth     :'cat_myth',
  oath     :'cat_oath',
  sengoku  :'cat_sengoku',
  zhulu    :'cat_zhulu',
  shuihu   :'cat_shuihu',
  major    :'cat_major',
  wild     :'cat_wild'
};

/* 從試算表讀回已解鎖的角色，重新整理也不會消失 */
function loadUnlocks(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(d){
      d = d || {};
      (d.unlocked || []).forEach(function(id){ UNLOCKED[id] = true; });
      CLEARED = {};
      (d.cleared || []).forEach(function(id){ CLEARED[id] = true; });
      if(rosterBuilt) renderRoster(LAST_FILTER.key || UNIVERSES[0].k, LAST_FILTER.mode);
    })
    .withFailureHandler(function(){})
    .getUnlocks();
}

/* 已完整打完三回合的角色ID（跨場累積，存在試算表）
   用 var 宣告：這個物件會被啟動流程中較早的程式碼碰到，
   let 的暫時性死區會直接拋 ReferenceError。 */
var CLEARED = {};

/* 某陣營需要幾位角色才能解鎖＝該陣營可選角色的半數（無條件進位），貓本身不算 */
function catQuota(uni){
  const n = ALL_CHARACTERS.filter(c=>c.universe===uni && !c.isUpgrade && !c.secret).length;
  return Math.ceil(n / 2);
}
function catProgress(uni){
  const ids = ALL_CHARACTERS.filter(c=>c.universe===uni && !c.isUpgrade && !c.secret).map(c=>c.id);
  return ids.filter(id=>CLEARED[id]).length;
}

/* 一場完整打完三回合之後呼叫：記錄這位角色，並檢查是否湊齊解鎖 */
function tryUnlockCat(){
  const uni  = S.player && S.player.universe;
  const base = (S.player && S.player.baseId) || (S.player && S.player.id);
  if(!base || CLEARED[base]){ return checkCatUnlock(uni); }
  CLEARED[base] = true;
  if(inGAS){
    google.script.run.withFailureHandler(function(){ }).addCleared(base);
  }
  return checkCatUnlock(uni);
}
function checkCatUnlock(uni){
  const id = CAT_BY_UNI[uni];
  if(!id || UNLOCKED[id]) return null;
  if(catProgress(uni) < catQuota(uni)) return null;
  const cat = ALL_CHARACTERS.filter(c=>c.id===id)[0];
  if(!cat) return null;
  UNLOCKED[id] = true;
  if(inGAS){
    google.script.run.withFailureHandler(function(){ }).addUnlock(id);
  }
  return cat;
}

/* 七隻全解鎖的獎勵：每場可額外使用一次「直接解題」 */
function allCatsUnlocked(){
  return Object.values(CAT_BY_UNI).every(id=>UNLOCKED[id]);
}
/* 用遮蔽輸入框取代 prompt，旁人看不到打了什麼 */
function unlockSecret(){
  $('pw-input').value = '';
  $('pw-msg').textContent = '';
  $('pw-box').hidden = false;
  $('pw-box').style.display = 'flex';
  setTimeout(function(){ $('pw-input').focus(); }, 60);
}
function closePw(){
  $('pw-box').hidden = true;
  $('pw-box').style.display = 'none';
}
function submitPw(){
  const v = ($('pw-input').value || '').trim();
  if(!v) return;
  let hit = null;
  Object.keys(SECRET_PW).forEach(k=>{ if(SECRET_PW[k] === v) hit = k; });
  if(!hit){
    sfx('fail');
    $('pw-msg').textContent = '密碼錯誤，請再試一次。';
    $('pw-input').value = '';
    $('pw-input').focus();
    return;
  }
  const ch = ALL_CHARACTERS.filter(c=>c.id===hit)[0];
  closePw();
  if(UNLOCKED[hit]){ alert('「' + (ch?ch.name:'') + '」已經解鎖了。'); return; }
  UNLOCKED[hit] = true;
  sfx('awaken'); banner('UNLOCKED!', true);
  renderRoster(LAST_FILTER.key || UNIVERSES[0].k, LAST_FILTER.mode);
  alert('隱藏角色解鎖：' + (ch?ch.name:'') + '\n請到「特殊」陣營選用。');
}

function buildTabs(){
  const box = $('tabs');
  UNIVERSES.forEach((u,i)=>{
    const b = document.createElement('button');
    b.className = 'tab' + (i===0?' on':'');
    b.dataset.u = u.k; b.textContent = u.label;
    b.onclick = ()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
      b.classList.add('on'); renderRoster(u.k, 'universe'); sfx('tap');
    };
    box.appendChild(b);
  });
  const rnd = document.createElement('button');
  rnd.className = 'tab rnd'; rnd.id = 'btn-random'; rnd.textContent = '🎲 隨機選角';
  rnd.onclick = pickRandom;
  box.appendChild(rnd);

  /* 第二排：依定位挑角色 */
  const rbox = $('role-tabs');
  const lb = document.createElement('span');
  lb.className = 'tabs-label'; lb.textContent = '依定位';
  rbox.appendChild(lb);
  ROLE_ORDER.forEach(function(rk){
    const r = ROLES[rk];
    const b = document.createElement('button');
    b.className = 'tab role-tab';
    b.dataset.role = rk; b.style.color = r.color; b.style.setProperty('--tc', r.color);
    b.textContent = r.icon + ' ' + r.name;
    b.onclick = function(){
      document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
      b.classList.add('on');
      renderRoster(rk, 'role'); sfx('tap');
    };
    rbox.appendChild(b);
  });
  const cx = document.createElement('button');
  cx.className = 'tab rnd'; cx.textContent = '📋 角色清冊';
  cx.onclick = function(){ openCodex(); sfx('tap'); };
  rbox.appendChild(cx);
}

let rosterBuilt = false;
let LAST_FILTER = {key:null, mode:'universe'};
/* ── 角色清冊：同類型角色的橫向比較 ── */
let CODEX_ROLE = 'attacker', CODEX_SORT = 'power', codexBuilt = false;
const CODEX_SORTS = [
  {k:'power', label:'依攻擊威力'},
  {k:'hp',    label:'依血量'},
  {k:'guard', label:'依防禦硬度'},
  {k:'acc',   label:'依命中率'},
  {k:'name',  label:'依名稱'}
];
function openCodex(role){
  if(role) CODEX_ROLE = role;
  if(!codexBuilt){
    codexBuilt = true;
    const tb = $('codex-tabs');
    ROLE_ORDER.forEach(function(rk){
      const r = ROLES[rk];
      const b = document.createElement('button');
      b.className = 'tab role-tab'; b.dataset.role = rk; b.style.color = r.color; b.style.setProperty('--tc', r.color);
      b.textContent = r.icon + ' ' + r.name;
      b.onclick = function(){ CODEX_ROLE = rk; renderCodex(); sfx('tap'); };
      tb.appendChild(b);
    });
    const sb = $('codex-sort');
    CODEX_SORTS.forEach(function(o){
      const b = document.createElement('button');
      b.className = 'sortbtn'; b.dataset.sort = o.k; b.textContent = o.label;
      b.onclick = function(){ CODEX_SORT = o.k; renderCodex(); sfx('tap'); };
      sb.appendChild(b);
    });
  }
  renderCodex();
  show('scr-codex');
}

function renderCodex(){
  document.querySelectorAll('#codex-tabs .role-tab').forEach(function(t){
    t.classList.toggle('on', t.dataset.role === CODEX_ROLE);
  });
  document.querySelectorAll('#codex-sort .sortbtn').forEach(function(t){
    t.classList.toggle('on', t.dataset.sort === CODEX_SORT);
  });

  const r = ROLES[CODEX_ROLE];
  const box = $('codex-role'); box.innerHTML = '';
  const card = document.createElement('div'); card.className = 'role-card';
  const h = document.createElement('h3');
  h.style.color = r.color; h.textContent = r.icon + ' ' + r.name;
  const p = document.createElement('p'); p.textContent = r.desc;
  const st = document.createElement('div'); st.className = 'role-stats';
  [['傷害倍率', '×' + r.atk.toFixed(2)],
   ['血量倍率', '×' + r.hp.toFixed(2)],
   ['額外會心', '+' + Math.round(r.crit*100) + '%'],
   ['閃避率',   Math.round(r.eva*100) + '%'],
   ['命中修正', (r.acc >= 0 ? '+' : '') + r.acc]].forEach(function(row){
    const d = document.createElement('div'); d.className = 'rs';
    const i = document.createElement('i'); i.textContent = row[0];
    const b = document.createElement('b'); b.textContent = row[1];
    d.append(i, b); st.appendChild(d);
  });
  card.append(h, p, st); box.appendChild(card);

  let list = ALL_CHARACTERS.filter(function(c){
    return c.role === CODEX_ROLE && (!c.secret || UNLOCKED[c.id]);
  });
  const sorters = {
    power: function(a,b){ return (mainAtk(b).power||0) - (mainAtk(a).power||0); },
    hp:    function(a,b){ return b.hp - a.hp; },
    guard: function(a,b){ return guardVal(a) - guardVal(b); },
    acc:   function(a,b){ return (mainAtk(b).acc||0) - (mainAtk(a).acc||0); },
    name:  function(a,b){ return a.name.localeCompare(b.name, 'zh-Hant'); }
  };
  list = list.slice().sort(sorters[CODEX_SORT] || sorters.power);

  const grid = $('codex-list'); grid.innerHTML = '';
  list.forEach(function(c){
    const el = document.createElement('div');
    el.className = 'cx';
    el.style.setProperty('--uc', 'var(--u-' + c.universe + ')');

    const top = document.createElement('div'); top.className = 'cx-top';
    const im = document.createElement('img'); im.loading = 'lazy'; im.alt = c.name;
    bindImg(im, c);
    const nm = document.createElement('div'); nm.className = 'cx-name';
    const nb = document.createElement('b'); nb.textContent = c.name;
    const ns = document.createElement('span');
    ns.textContent = UNI_LABEL[c.universe] + '　總戰力 ' + battlePower(c);
    nm.append(nb, ns);
    top.append(im, nm);
    if(!c.isUpgrade){
      const pick = document.createElement('button');
      pick.className = 'cx-pick'; pick.textContent = '選這位';
      pick.onclick = function(){ codexPick(c); };
      top.appendChild(pick);
    }else{
      const tag = document.createElement('span');
      tag.className = 'cx-stage'; tag.textContent = '進化形態';
      el.appendChild(tag);
    }

    const bars = document.createElement('div'); bars.className = 'cx-bars';
    const cam = mainAtk(c) || {power:0, acc:100};
    const hard = Math.round((1 - guardVal(c)) * 100);
    [['血量', c.hp, (c.hp-400)/900, '#34d399', c.hp],
     ['威力', cam.power, (cam.power-50)/55, '#ff6f8e', cam.power],
     ['硬度', hard, (hard-30)/60, '#5ab8ff', hard + '%'],
     ['命中', cam.acc, (cam.acc-60)/40, '#ffc533', cam.acc + '%']
    ].forEach(function(row){
      const d = document.createElement('div'); d.className = 'cxb';
      const i = document.createElement('i'); i.textContent = row[0];
      const u = document.createElement('u'); const f = document.createElement('b');
      f.style.width = Math.round(clamp(row[2], 0.06, 1) * 100) + '%';
      f.style.background = row[3];
      u.appendChild(f);
      const e = document.createElement('em'); e.textContent = row[4];
      d.append(i, u, e); bars.appendChild(d);
    });

    const txt = document.createElement('div'); txt.className = 'cx-txt';
    const sk = mainSkill(c);
    const l1 = document.createElement('div');
    if(sk){
      l1.innerHTML = '<b>特技</b>　';
      l1.append(document.createTextNode(sk.name + '：' + skillText(sk.effect, c.role)));
    }else{
      const extras = movesOf(c,'atk').slice(1);
      l1.innerHTML = '<b>招式</b>　';
      l1.append(document.createTextNode(
        extras.length ? extras.map(function(m){ return m.name; }).join('／') : '（僅有主要招式）'));
    }
    txt.appendChild(l1);
    if(c.ability){
      const l2 = document.createElement('div');
      l2.innerHTML = '<b>能力</b>　';
      l2.append(document.createTextNode(c.ability.name + '：' + (ABILITY_TEXT[c.ability.effect] || '')));
      txt.appendChild(l2);
    }else{
      const l2 = document.createElement('div');
      l2.textContent = '（第一階段，換乘後才有特色能力）';
      txt.appendChild(l2);
    }
    if(c.upgradeTo || c.forms){
      const up = (c.forms || [c.upgradeTo]).map(function(id){
        const f = ALL_CHARACTERS.filter(x=>x.id===id)[0];
        return f ? f.name : '';
      }).filter(Boolean).join('、');
      const l3 = document.createElement('div');
      l3.innerHTML = '<b>換乘</b>　';
      l3.append(document.createTextNode(up + '（' + awakenText(c) + '）'));
      txt.appendChild(l3);
    }

    const q = QUOTES[c.id];
    if(q){
      const l4 = document.createElement('div');
      l4.innerHTML = '<b>台詞</b>　';
      l4.append(document.createTextNode('「' + q[0] + '」'));
      txt.appendChild(l4);
    }
    el.append(top, bars, txt);
    grid.appendChild(el);
  });
}

function codexPick(c){
  if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
  const tab = Array.prototype.filter.call(document.querySelectorAll('#tabs .tab'),
              function(t){ return t.dataset.u === c.universe; })[0];
  if(tab) tab.classList.add('on');
  renderRoster(c.universe, 'universe');
  const card = Array.prototype.filter.call(document.querySelectorAll('.pick'),
               function(x){ return x.dataset.id === c.id; })[0];
  if(card){
    document.querySelectorAll('.pick').forEach(function(p){ p.classList.remove('on'); });
    card.classList.add('on');
  }
  selectCharacter(c);
  show('scr-select');
  if(card) scrollTo_(card, {behavior:'smooth', block:'center'});
  sfx('select');
}

/* 隨機挑一位角色：自動切到該陣營、選起來並捲到畫面中央 */
function pickRandom(){
  const pool = ALL_CHARACTERS.filter(c=>!c.isUpgrade && (!c.secret || UNLOCKED[c.id]));
  if(!pool.length) return;
  const c = pool[Math.floor(Math.random()*pool.length)];
  const tab = Array.prototype.filter.call(document.querySelectorAll('.tab'),
              function(t){ return t.dataset.u === c.universe; })[0];
  if(tab){
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
    tab.classList.add('on');
  }
  renderRoster(c.universe);
  const card = Array.prototype.filter.call(document.querySelectorAll('.pick'),
               function(x){ return x.dataset.id === c.id; })[0];
  if(card){
    document.querySelectorAll('.pick').forEach(function(p){ p.classList.remove('on'); });
    card.classList.add('on');
    scrollTo_(card, {behavior:'smooth', block:'center'});
  }
  selectCharacter(c);
  banner('RANDOM!', true); sfx('assist');
}

function renderRoster(filter, mode){
  rosterBuilt = true;
  mode = mode || 'universe';
  LAST_FILTER = {key:filter, mode:mode};
  const grid = $('roster'); grid.innerHTML = '';
  const keys = (mode === 'universe') ? (UNIVERSE_FILTER[filter] || null) : null;
  ALL_CHARACTERS.filter(function(c){
    if(c.isUpgrade) return false;
    if(c.secret && !UNLOCKED[c.id]) return false;
    if(mode === 'role') return c.role === filter;
    return !keys || keys.indexOf(c.universe) >= 0;
  }).forEach(c=>{
    const card = document.createElement('button');
    card.className = 'pick'; card.dataset.id = c.id;
    card.style.setProperty('--uc', 'var(--u-'+c.universe+')');
    const port = document.createElement('div'); port.className = 'pick-port';
    const img = document.createElement('img');
    img.alt = c.name; img.loading = 'lazy'; bindImg(img, c);
    port.appendChild(img);
    const pw = document.createElement('span');
    pw.className = 'pw'; pw.textContent = battlePower(c);
    port.appendChild(pw);
    if(c.upgradeTo || c.forms){
      const ev = document.createElement('span');
      ev.className = 'evo'; ev.textContent = c.forms ? '三形態' : '可進化';
      ev.title = awakenText(c);
      port.appendChild(ev);
    }
    const nm = document.createElement('b'); nm.textContent = c.name;
    const tp = document.createElement('small');
    tp.textContent = c.type + '　HP ' + c.hp;
    const r = roleOf(c);
    const rt = document.createElement('span');
    rt.className = 'role-tag'; rt.style.color = r.color;
    rt.textContent = r.icon + ' ' + r.name;
    card.append(port, nm, tp, rt);
    card.onclick = ()=>{
      document.querySelectorAll('.pick').forEach(p=>p.classList.remove('on'));
      card.classList.add('on'); selectCharacter(c); sfx('select');
    };
    card.onmouseenter = ()=>previewCharacter(c);
    card.onmouseleave = restorePreview;
    grid.appendChild(card);
  });

  // 未解鎖的隱藏角色，只在對應的陣營／定位分頁顯示成 ？？？ 卡片
  if(!grid.children.length && mode === 'role')
    rosterEmptyNote(grid, '這個定位目前沒有可選角色。');

  ALL_CHARACTERS.filter(c=>c.secret && !UNLOCKED[c.id]).forEach(c=>{
    if(mode === 'role'){ if(c.role !== filter) return; }
    else if(keys && keys.indexOf(c.universe) < 0) return;
    const card = document.createElement('button');
    card.className = 'pick locked';
    card.style.setProperty('--uc', 'var(--u-'+c.universe+')');
    const isCat = (CAT_BY_UNI[c.universe] === c.id);
    const port = document.createElement('div');
    port.className = 'pick-port' + (isCat ? ' cat-lock' : '');
    if(isCat){
      /* 明講牠是一隻貓——不知道有東西可拿，就不會有人想去拿 */
      const paw = document.createElement('div'); paw.className = 'cat-silhouette';
      paw.textContent = '🐈';
      const q = document.createElement('span'); q.className = 'cat-q'; q.textContent = '？';
      port.append(paw, q);
    }else{
      const img = document.createElement('img');
      img.alt = '？？？'; img.src = placeholderImg('？？？', c.universe);
      port.appendChild(img);
    }
    const nm = document.createElement('b');
    const tp = document.createElement('small');
    const rt = document.createElement('span');
    rt.className = 'role-tag'; rt.style.color = 'var(--gold)';

    if(isCat){
      const need = catQuota(c.universe), got = catProgress(c.universe);
      const left = Math.max(0, need - got);
      nm.textContent = '？？？貓';
      nm.style.color = 'var(--gold)';
      tp.textContent = '完整通關角色　' + got + ' / ' + need;
      rt.textContent = left ? ('🐾 還差 ' + left + ' 位') : '🐾 快解鎖了！';
      /* 進度條，讓「還差幾位」一眼看得出來 */
      const bar = document.createElement('div'); bar.className = 'cat-bar';
      const fill = document.createElement('i');
      fill.style.width = Math.round(Math.min(1, got / Math.max(1, need)) * 100) + '%';
      bar.appendChild(fill);
      card.onclick = ()=>{
        sfx('tap');
        alert('🐈 這個陣營藏著一隻貓。\n\n'
          + '牠比一般角色強一些，但不能進化，也不會有夥伴來合體。\n\n'
          + '── 解鎖方式 ──\n用「' + (UNI_LABEL[c.universe]||'') + '」的角色完整打完三個回合，\n'
          + '累積 ' + need + ' 位不同的角色即可。\n目前進度：' + got + ' / ' + need + '\n\n'
          + '（中途被擊倒或提早結束不算數）\n\n'
          + '七個陣營的貓全部收齊之後，\n之後不論用哪位角色，每場都能多用一次「直接解題」。');
      };
      card.append(port, nm, tp, bar, rt);
    }else{
      const img2 = document.createElement('img');
      nm.textContent = '？？？';
      tp.textContent = '？？？　HP ???';
      rt.textContent = '🔒 需要密碼';
      card.onclick = ()=>{ sfx('tap'); unlockSecret(); };
      card.append(port, nm, tp, rt);
    }
    grid.appendChild(card);
  });
}

/* 滑鼠移到角色卡時，下方預覽框先顯示那位角色 */
function previewCharacter(c){
  if(selected && selected.id === c.id) return;
  paintShowcase(c);
  bindImg($('dk-img'), c);
  $('dk-name').textContent = c.name;
  const r = roleOf(c);
  $('dk-info').textContent = r.icon + ' ' + r.name + '　' + r.desc;
}
function restorePreview(){
  if(selected) selectCharacter(selected);
  else{
    $('dk-img').src = placeholderImg('？', 'special');
    $('sc-img').src = placeholderImg('？', 'special');
    $('sc-role').textContent = '';
    $('sc-evo').hidden = true;
    $('sc-power').hidden = true;
    $('sc-quote').hidden = true;
    $('sc-name').textContent = '尚未選擇角色';
    $('sc-sub').textContent = '把滑鼠移到角色上可以先預覽，點一下選定出戰。';
    $('sc-moves').innerHTML = '';
    $('dk-name').textContent = '尚未選擇角色';
    $('dk-info').textContent = '把滑鼠移到角色上可以先預覽，點一下選定出戰';
  }
}

function rosterEmptyNote(grid, msg){
  const d = document.createElement('div');
  d.className = 'roster-empty'; d.textContent = msg;
  grid.appendChild(d);
}

function paintShowcase(c, locked){
  const r = roleOf(c);
  bindImg($('sc-img'), c);
  const rt = $('sc-role');
  rt.textContent = r.icon + ' ' + r.name; rt.style.color = r.color;
  $('sc-name').textContent = c.name;
  $('sc-sub').textContent = UNI_LABEL[c.universe] + '　' + c.type + '　HP ' + c.hp + '　' + r.desc;

  const evo = $('sc-evo');
  if(c.upgradeTo || c.forms){
    evo.hidden = false;
    evo.textContent = (c.forms ? '✦ 多形態' : '✦ 可換乘') + '　' + awakenText(c);
  }else evo.hidden = true;

  const pw = $('sc-power');
  pw.hidden = false;
  $('sc-power-n').textContent = battlePower(c).toLocaleString();

  const q = QUOTES[c.id] || [];
  const qb = $('sc-quote');
  if(q[0]){ qb.hidden = false; qb.textContent = '「' + q[0] + '」'; }
  else qb.hidden = true;

  if(locked){
    const art = $('sc-art');
    art.classList.remove('locked');
    void art.offsetWidth;
    art.classList.add('locked');
  }

  const box = $('sc-moves'); box.innerHTML = '';
  const rows = [];
  c.moves.forEach(function(m){
    if(isAtkKind(m.kind)){
      rows.push([m.kind === 'aoe' ? 'aoe' : 'attack', kindLabel(m), m.name,
        (m.kind === 'aoe' ? '群體攻擊　' : '') + '威力 ' + m.power + '　命中 ' + m.acc + '%',
        rows.length ? '' : q[0]]);
    }else if(m.kind === 'guard'){
      rows.push(['guard','防禦', m.name,
        '減傷至 ' + Math.round(m.defense*100) + '%，有機會反擊', q[1]]);
    }else{
      rows.push(['skill','特技', m.name, skillText(m.effect, c.role), q[2]]);
    }
  });
  if(c.ability) rows.push(['ability','必殺', c.ability.name,
                           ABILITY_TEXT[c.ability.effect] || '', q[3]]);
  else rows.push(['ability','必殺', '（換乘後取得）', '第一階段角色沒有特色能力', '']);
  rows.forEach(function(row){
    const d = document.createElement('div'); d.className = 'sc-mv k-' + row[0];
    const tag = document.createElement('em'); tag.textContent = row[1];
    const nb = document.createElement('b'); nb.textContent = row[2];
    const sp = document.createElement('span'); sp.textContent = row[3];
    d.append(tag, nb, sp);
    if(row[4]){ const qq = document.createElement('q'); qq.textContent = '「' + row[4] + '」'; d.appendChild(qq); }
    box.appendChild(d);
  });
}

function selectCharacter(c){
  selected = c;
  paintShowcase(c, true);
  sfx('select');
  bindImg($('dk-img'), c);
  $('dk-name').textContent = c.name;
  const r = roleOf(c);
  $('dk-info').textContent = r.icon + ' ' + r.name + '　' + r.desc;
  const st = $('dk-stats'); st.innerHTML = '';
  [['攻擊', r.atk/1.3, '#ff6f8e'], ['血量', c.hp/1100, '#34d399'],
   ['會心', (0.12+r.crit)/0.30, '#ffc533'], ['閃避', r.eva/0.20, '#5ab8ff']].forEach(function(row){
    const d = document.createElement('div'); d.className='stat';
    const lb = document.createElement('span'); lb.textContent = row[0];
    const tr = document.createElement('span'); tr.className='track';
    const fi = document.createElement('i');
    fi.style.width = Math.round(clamp(row[1],0.08,1)*100)+'%';
    fi.style.background = row[2];
    tr.appendChild(fi); d.append(lb,tr); st.appendChild(d);
  });
  const mv = $('dk-moves'); mv.innerHTML = '';
  c.moves.forEach(m=>{
    const d = document.createElement('div'); d.className = 'mv-chip';
    const b = document.createElement('b'); b.textContent = m.name;
    let txt = '';
    if(isAtkKind(m.kind)) txt = kindLabel(m) + '　威力 ' + m.power + '｜命中 ' + m.acc + '%';
    else if(m.kind === 'guard') txt = '防禦　減傷至 ' + Math.round(m.defense*100) + '%';
    else txt = '特技　' + skillText(m.effect, c.role);
    d.append(b, document.createTextNode(txt));
    mv.appendChild(d);
  });
  if(c.ability){
    const d = document.createElement('div'); d.className = 'mv-chip ab';
    const b = document.createElement('b'); b.textContent = '★ ' + c.ability.name;
    d.append(b, document.createTextNode(ABILITY_TEXT[c.ability.effect] || ''));
    mv.appendChild(d);
  }
  $('btn-start').disabled = false;
}

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

/* ============================================================================
   戰鬥流程
   ========================================================================== */
function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  $(id).classList.add('on'); window.scrollTo(0,0);
  BGM.auto(id);
}
function log(msg, color){
  const t = $('ticker');
  const p = document.createElement('p');
  p.textContent = msg; if(color) p.style.color = color;
  t.appendChild(p); t.scrollTop = t.scrollHeight;
  while(t.children.length > 60) t.removeChild(t.firstChild);
}

/* 個體差異：每次上場時「每一項」各自擲一次（預設 ±20%），
   所以同一角色可能今天血厚但手軟、明天招式兇猛卻很脆 */
function rollIndividual(ch){
  // 隱藏角色不擲骰，各項固定加成，狀態永遠最好
  const boost = ch.secret ? (1 + CONFIG.secretBoost) : 0;
  const jitter = boost
    ? function(){ return boost; }
    : function(){ return 1 + (Math.random()*2 - 1) * CONFIG.rollVar; };
  const rec = {hp:0, power:0, guard:0, acc:0};
  const jHp = jitter();
  ch.hp = Math.round(ch.hp * jHp); ch.maxHp = ch.hp; rec.hp = jHp - 1;

  let pn = 0, an = 0, gn = 0;
  ch.moves.forEach(function(m){
    if(m.power > 0){
      const j = jitter();
      m.power = Math.max(1, Math.round(m.power * j));
      rec.power += j - 1; pn++;
    }
    if(m.defense !== undefined){
      const j = jitter();
      m.defense = clamp(m.defense / j, 0.08, 0.85);   // 除法：數值越小越硬
      rec.guard += j - 1; gn++;
    }
    const ja = jitter();
    m.acc = clamp(Math.round((m.acc || 100) * ja), 35, 100);
    rec.acc += ja - 1; an++;
  });
  if(pn) rec.power /= pn;
  if(an) rec.acc /= an;
  if(gn) rec.guard /= gn; else rec.guard = 0;
  ch.cond = rec;
  ch.rolled = true;
  return ch;
}

/* 把個體差異翻成一句人話 */
function conditionReport(ch){
  const c = ch.cond;
  if(!c) return null;
  const items = [{k:'體力', v:c.hp}, {k:'威力', v:c.power}, {k:'命中', v:c.acc}];
  if(c.guard !== 0) items.push({k:'防禦', v:c.guard});
  const lv = function(v){
    if(v >=  0.10) return {t:'大幅提升', c:'var(--jade)'};
    if(v >=  0.04) return {t:'略為提升', c:'#5fae1a'};
    if(v <= -0.10) return {t:'明顯低落', c:'var(--ember)'};
    if(v <= -0.04) return {t:'略為低落', c:'var(--gold)'};
    return {t:'一如往常', c:'var(--dim)'};
  };
  const vs = items.map(function(x){ return x.v; });
  const avg = vs.reduce(function(a,b){ return a+b; }, 0) / vs.length;
  const spread = Math.max.apply(null, vs) - Math.min.apply(null, vs);
  let head, color;
  if(spread >= 0.24){ head = '各有所長的一天'; color = 'var(--gold)'; }
  else if(avg >= 0.08){ head = '狀態絕佳！'; color = 'var(--jade)'; }
  else if(avg <= -0.08){ head = '狀態不太好⋯⋯'; color = 'var(--ember)'; }
  else { head = '狀態平穩'; color = 'var(--dim)'; }
  return {head:head, color:color, items:items.map(function(x){
    const l = lv(x.v);
    return {k:x.k, t:l.t, c:l.c, pct:(x.v >= 0 ? '+' : '') + Math.round(x.v*100) + '%'};
  })};
}

function showCondition(){
  const rp = conditionReport(S.player);
  if(!rp) return;
  $('cond-name').textContent = S.player.name;
  $('cond-head').textContent = rp.head;
  $('cond-head').style.color = rp.color;
  const box = $('cond-list'); box.innerHTML = '';
  rp.items.forEach(function(x){
    const d = document.createElement('div'); d.className = 'cond-row';
    const a = document.createElement('span'); a.textContent = x.k;
    const b = document.createElement('b'); b.textContent = x.t; b.style.color = x.c;
    const c = document.createElement('em'); c.textContent = x.pct; c.style.color = x.c;
    d.append(a, b, c); box.appendChild(d);
  });
  paintLore(S.player);
  /* 每次進來都從頭看起，免得殘留上一次的捲動位置 */
  const _cc = document.querySelector('.cond-card');
  if(_cc) _cc.scrollTop = 0;
  log('📋 今日狀態：' + rp.head + '　' +
      rp.items.map(function(x){ return x.k + ' ' + x.pct; }).join('　'), 'var(--gold)');
  const box2 = $('cond-box');
  box2.hidden = false;
  box2.style.display = 'flex';
  $('cond-go').onclick = function(){
    box2.hidden = true;
    box2.style.display = 'none';     // 雙保險，確保一定關得掉
    sfx('tap');
    banner('ROUND ' + S.round); sfx('round');
  };
}

async function startBattle(){
  if(!selected) return;
  // 中途換角色：不重跑題庫，直接換人接著打
  if(S.swapMode){
    S.swapMode = false;
    const keepSp = S.sp;
    S.player = rollIndividual(clone(selected));
    S.player.baseId = selected.id;
    S.pSt = newStatus();
    applyClanPassive(S.player, S.pSt, true, 'init');
    warmAnims();   // 換角色後立刻開始抓新角色的演出影片
    S.sp = keepSp;
    LAST_IMG.p = null;
    $('btn-start').textContent = '出戰！';
    show('scr-battle');
    paintHUD(true); renderSpirits(); refreshAbilityBtn();
    banner(S.player.name + ' 參戰！', true); sfx('awaken');
    log('🔄 ' + S.player.name + ' 接替上場，滿血再戰！', 'var(--gold)');
    showCondition();
    finishQuestion();
    return;
  }
  sfx('charge');
  S.player = rollIndividual(clone(selected));
  S.player.baseId = selected.id;      // 進化後 id 會被覆蓋，先留住原始角色
  S.pSt = newStatus(); S.eSt = newStatus();
  applyClanPassive(S.player, S.pSt, true, 'init');
  warmAnims();   // 開場就開始抓演出影片，不要等到出招才下載
  S.combo = 0; S.bestCombo = 0; S.sinceRun = 0; S.sinceBest = 0;
  S.catSolveUsed = false;   // 集滿七貓的「直接解題」每場重置
  S.finished = false; S.busy = false;
  if(!RESUME){ S.round = 1; S.quizPts = 0; S.used = []; S.totalAnswered = 0; }
  S.waves = 0; S.kos = 0;
  S.sp = 0; S.spiritUsed = {}; S.spiritCasts = 0;
  if(selected && selected.secret) S.sp = CONFIG.secretSp;
  S.blocked = 0; S.counters = 0; S.skillUses = 0;
  S.mode = PENDING_MODE || 'normal';
  if(S.mode === 'dojo') S.difficulty = 'easy';      // 道場固定一對一
  S.streak = 0; S.maxStreak = 0; S.roundFull = 0; S.perfectRounds = 0; S.awakened = false;
  S.lvUps = []; S.dojoFixed = 0; S.raidDmg = 0;
  $('btn-qsave').hidden = (S.mode === 'dojo');      // 道場不存進度
  $('ticker').innerHTML = '';
  applyStartBonuses();

  show('scr-battle');
  $('q-text').textContent = '題庫連線中…';
  $('q-opts').innerHTML = '';
  await preparePool();

  if(RESUME && RESUME.hpPct) S.player.hp = Math.max(60, Math.round(S.player.maxHp * RESUME.hpPct));
  if(S.round > CONFIG.rounds){ S.round = 1; S.used = []; await preparePool(); }
  RESUME = null;
  startRound();
}

function startRound(){
  S.qInRound = 0; S.roundFull = 0;
  S.spiritUsed = {};          // 每回合各指令可再用一次
  if(S.player && S.player.secret && S.round > 1){
    S.sp += CONFIG.secretSpRound;
    log('🌀 精神力湧現：SP ＋' + CONFIG.secretSpRound + '（目前 ' + S.sp + '）', 'var(--ion)');
  }
  const back = recycleWrong();
  if(back) log('🔁 上一回合答錯的 ' + back + ' 題，這回合會再出一次。', 'var(--gold)');
  spawnEnemies();
  if(S.round > 1){
    if(S.defeated){
      S.player.hp = Math.max(1, Math.round(S.player.maxHp * CONFIG.defeatPenalty));
      S.defeated = false;
      log('🩹 上回合戰敗，本回合只能以 ' + Math.round(CONFIG.defeatPenalty*100) +
          '% 體力再戰。', 'var(--ember)');
    }else{
      const heal = Math.round(S.player.maxHp * 0.25);
      S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
      log('🔧 回合間補給：回復 ' + heal + ' 點體力。', 'var(--jade)');
    }
  }
  rollStage();
  paintHUD(true);
  BGM.auto('scr-battle');              // 最後一回合換成頭目曲
  if(S.round === 1) showCondition();
  else { banner('ROUND ' + S.round); sfx('round'); }
  const foeNames = S.foes.map(function(e){ return e.name; }).join('、');
  log('⚡ 第 ' + S.round + ' 回合開始：' + S.player.name + '　VS　' + foeNames, 'var(--gold)');
  if(S.difficulty === 'hard' && S.foes.length > 1)
    log('⚔️ 困難模式：點右側名單可切換攻擊目標。', 'var(--dim)');
  nextQuestion();
}

/* 依難度生出一到多位敵人；S.enemy／S.eSt 永遠指向目前鎖定的目標 */
function spawnEnemies(){
  const d = S.difficulty;
  const n = CONFIG.enemyCount[d] || 1;
  const hpM = CONFIG.enemyHpMulti[d] || 1;
  const pool = ALL_CHARACTERS.filter(c=>!c.isUpgrade && !c.secret && c.id !== S.player.id);
  S.foes = []; S.foeSt = [];
  const picked = shuffle(pool).slice(0, n);
  picked.forEach(function(src){
    const e = rollIndividual(clone(src));
    e.hp = Math.max(60, Math.round(e.hp * hpM));
    if(S.mode === 'dojo'){ e.hp = Math.round(e.hp * 1.4); e.name = '【菁英】' + e.name; }   // 錯題化身的菁英怪
    e.maxHp = e.hp;
    S.foes.push(e); S.foeSt.push(newStatus());
    applyClanPassive(e, S.foeSt[S.foeSt.length - 1], false, 'init');
  });
  S.target = 0;
  syncTarget();
}

/* 讓 S.enemy／S.eSt 指向目前目標，其餘戰鬥程式碼不必改寫 */
function syncTarget(){
  if(!S.foes.length) return;
  if(S.target >= S.foes.length || S.foes[S.target].hp <= 0){
    const alive = S.foes.map(function(e,i){ return {e:e,i:i}; })
                        .filter(function(x){ return x.e.hp > 0; });
    S.target = alive.length ? alive[0].i : 0;
  }
  S.enemy = S.foes[S.target];
  S.eSt   = S.foeSt[S.target];
  LAST_IMG.e = null;
}
/* 小卡沒有主目標，索引要換算 */
function foeSlot(i){ return i > S.target ? i - 1 : i; }
function aliveFoes(){ return S.foes.filter(function(e){ return e.hp > 0; }); }
function allFoesDown(){ return S.foes.length > 0 && aliveFoes().length === 0; }

/* 目標選擇列：困難模式才顯示 */
function renderFoes(){
  const box = $('foe-list');
  if(!box) return;
  if(S.foes.length <= 1){ box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '';
  S.foes.forEach(function(e, i){
    if(i === S.target) return;              // 主攻擊目標已顯示在上方大圖
    const st = S.foeSt[i];
    const b = document.createElement('button');
    const down = e.hp <= 0;
    b.className = 'foe' + (down ? ' down' : '');
    b.disabled = down;
    const im = document.createElement('img');
    im.referrerPolicy = 'no-referrer';
    im.onerror = function(){ im.onerror = null; im.src = e.ph; };
    im.src = e.img || e.ph;
    const nm = document.createElement('b'); nm.textContent = e.name;
    const bar = document.createElement('u');
    const fi = document.createElement('i');
    const pct = clamp(e.hp / e.maxHp * 100, 0, 100);
    fi.style.width = pct + '%';
    fi.style.background = pct <= 20 ? '#ff3535' : pct <= 50 ? '#ffb32b' : '#1fc478';
    bar.appendChild(fi);
    const hp = document.createElement('span');
    hp.textContent = down ? '倒下' : Math.max(0, Math.ceil(e.hp)) + ' / ' + e.maxHp;
    b.append(im, nm, bar, hp);
    if(st.upgraded || (e.upgradeTo || e.forms)){
      const tag = document.createElement('em');
      tag.textContent = st.upgraded ? '已換乘' : '可進化';
      b.appendChild(tag);
    }
    b.onclick = function(){
      if(S.busy || down) return;
      S.target = i; syncTarget(); paintHUD(); renderFoes(); sfx('select');
      if(S.answered && !S.resolved) buildTactics();   // 命中率隨目標改變，重算
      log('🎯 鎖定目標：' + S.foes[i].name, 'var(--gold)');
    };
    box.appendChild(b);
  });
}

const LAST_IMG = {p:null, e:null};
function paintHUD(init){
  const side = (k, c, st)=>{
    if(!c || !st) return;
    $(k+'-name').textContent = c.name;
    const pct = clamp(c.hp / c.maxHp * 100, 0, 100);
    const fill = $(k+'-fill');
    fill.style.width = pct + '%';
    fill.className = 'hp-fill' + (pct<=20?' low':pct<=50?' mid':'');
    if(init) $(k+'-ghost').style.width = pct + '%';
    else requestAnimationFrame(()=>{ $(k+'-ghost').style.width = pct + '%'; });
    $(k+'-hp').textContent = Math.max(0,Math.ceil(c.hp)) + ' / ' + c.maxHp;
    if(LAST_IMG[k] !== c.img){ LAST_IMG[k] = c.img; bindImg($(k+'-img'), c); }

    const chips = $(k+'-chips'); chips.innerHTML = '';
    const add=(txt,col)=>{const x=document.createElement('span');x.className='chip';x.textContent=txt;x.style.color=col;chips.appendChild(x);};
    const r = roleOf(c); add(r.icon + ' ' + r.name, r.color);
    Object.keys(STATUS_INFO).forEach(key=>{
      const v = st[key];
      if(v === true || (typeof v === 'number' && v > 0)){
        const info = STATUS_INFO[key];
        add(info.label + (typeof v === 'number' && v > 1 ? ' ' + v : ''), info.color);
      }
    });
    if(st.guard !== undefined) add('防禦姿態','var(--ion)');
    $(k+'-ammo').textContent = (k === 'e') ? threatText(c, st) : '';
  };
  side('p', S.player, S.pSt);
  side('e', S.enemy,  S.eSt);
  renderFoes();
  $('r-round').textContent = 'R' + S.round;
  $('r-now').textContent = Math.min(S.qInRound+1, S.perRound);
  $('r-max').textContent = '/ ' + S.perRound;
  $('r-score').textContent = S.quizPts;
  $('combo-box').classList.toggle('on', S.combo > 0);
  $('r-combo').textContent = '×' + (1 + S.combo*CONFIG.comboStep).toFixed(2);
}

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

/* ── 換乘條件：每位角色依自身特質決定何時覺醒 ──
   hp    ：體力低於某比例（絕境爆發型）
   combo ：連續全對達到指定次數（實力碾壓型）
   turn  ：撐過指定題數（後期強化型）
   hpHigh：體力仍高於某比例時（狀態極佳才變身）
   damage：單場累積受創達最大體力的某倍數（越打越強）  */
const AWAKEN_RULE = {
  /* 神域 */
  my_zeus               :{type:'combo', v:3, desc:'連續 3 題全對'},
  my_athena             :{type:'hpHigh', v:0.55, desc:'狀態極佳時'},
  my_fenrir             :{type:'damage', v:0.55, desc:'掙脫格萊普尼爾'},
  my_seraph             :{type:'combo', v:3, desc:'連續 3 題全對'},
  /* 誓約 */
  oa_arthur             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  oa_arthur_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  oa_curie              :{type:'turn', v:4, desc:'第 4 題後'},
  /* 亂世 */
  sg_nobunaga           :{type:'damage', v:0.55, desc:'受創後化身第六天魔王'},
  sg_hideyoshi          :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  sg_hideyoshi_2        :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  sg_ieyasu             :{type:'turn', v:4, desc:'第 4 題後'},
  /* 逐鹿 */
  zl_zhangyi            :{type:'turn', v:3, desc:'第 3 題後'},
  zl_jingke             :{type:'hp', v:0.40, desc:'圖已到盡頭'},
  zl_xiangyu            :{type:'damage', v:0.60, desc:'承受足夠傷害後'},
  zl_hanxin             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_hanxin_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  zl_zhangliang         :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_zhangliang_2       :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  zl_liubang            :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_liubang_2          :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  zl_lvbu               :{type:'turn', v:3, desc:'第 3 題後'},
  zl_guanyu             :{type:'combo', v:3, desc:'連續 3 題全對'},
  zl_zhugeliang         :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_zhugeliang_2       :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  /* 梁山 */
  sh_lin                :{type:'hp', v:0.40, desc:'風雪山神廟，退無可退'},
  sh_wu                 :{type:'combo', v:3, desc:'連續 3 題全對'},
  sh_li                 :{type:'damage', v:0.60, desc:'承受足夠傷害後'},
  sh_song               :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  sh_song_rain          :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  /* 學府 */
  mj_moyan              :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_moyan_2            :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  mj_aili               :{type:'combo', v:3, desc:'連續 3 題全對'},
  mj_lvming             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_lvming_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  mj_ama                :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_ama_2              :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  mj_gangchi            :{type:'damage', v:0.55, desc:'承受足夠傷害後'},
  mj_renxin             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_renxin_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  /* 淺山 */
  wd_leopard            :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_leopard_2          :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_cat                :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_cat_2              :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_salmon             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_salmon_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_magpie             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_magpie_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_bear               :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_bear_2             :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_pangolin           :{type:'damage', v:0.55, desc:'承受足夠傷害後'},
  wd_owl                :{type:'turn', v:4, desc:'第 4 題後'},
  wd_squirrel           :{type:'combo', v:3, desc:'連續 3 題全對'},
};
function awakenReady(ch, st){
  const rule = AWAKEN_RULE[ch.id] || {type:'hp', v:CONFIG.upgradeAt};
  switch(rule.type){
    case 'combo' : return (rule.since ? S.sinceBest : S.bestCombo) >= rule.v;
    case 'turn'  : return S.totalAnswered >= rule.v;
    case 'hpHigh': return ch.hp >= ch.maxHp * rule.v && S.totalAnswered >= 2;
    case 'damage': return (st.taken || 0) >= ch.maxHp * rule.v;
    default      : return ch.hp <= ch.maxHp * rule.v;
  }
}
function awakenText(c){
  const rule = AWAKEN_RULE[c.id];
  return rule ? rule.desc : ('體力低於 ' + Math.round(CONFIG.upgradeAt*100) + '% 時換乘');
}

/* ---------- 換裝／換乘 ---------- */
/* 把角色換成另一個形態；keepRatio 為真時保留體力百分比（形態切換用） */
function applyForm(ch, up, keepRatio){
  const ratio = ch.maxHp ? ch.hp / ch.maxHp : 1;
  ch.id = up.id; ch.name = up.name; ch.img = up.img; ch.ph = up.ph;
  ch.ability = up.ability; ch.role = up.role; ch.type = up.type;
  ch.defType = up.defType; ch.atkImg = up.atkImg;
  ch.moves = clone(up.moves); ch.maxHp = up.hp;
  ch.upgradeTo = up.upgradeTo;
  if(keepRatio) ch.hp = Math.max(1, Math.round(ch.maxHp * ratio));
}

/* 學生自由切換合體形態，體力比例保留，不消耗回合 */
function switchForm(id){
  if(S.busy || S.resolved || !S.player.formList) return;
  if(S.player.id === id) return;
  const up = ALL_CHARACTERS.filter(c=>c.id===id)[0];
  if(!up) return;
  applyForm(S.player, up, true);
  LAST_IMG.p = null;
  log('🔄 合體變形：' + S.player.name + '！', 'var(--gold)');
  auraFx('p'); sfx('awaken'); banner(S.player.name, true);
  paintHUD(); renderForms(); refreshAbilityBtn();
  if(S.answered) buildTactics();
}

function renderForms(){
  // 尚未換乘、但有換乘條件的角色：在戰術面板顯示達成條件
  const hint = $('t-evo');
  if(hint){
    const canEvo = S.player && !S.pSt.upgraded && (S.player.upgradeTo || S.player.forms);
    if(canEvo){
      hint.hidden = false;
      hint.textContent = '✦ 換乘條件：' + awakenText(S.player);
    }else hint.hidden = true;
  }
  const box = $('t-forms');
  if(!S.player || !S.player.formList){ box.hidden = true; return; }
  box.hidden = false;
  const grid = $('forms-grid'); grid.innerHTML = '';
  S.player.formList.forEach(function(id){
    const f = ALL_CHARACTERS.filter(c=>c.id===id)[0];
    if(!f) return;
    const b = document.createElement('button');
    b.className = 'form-btn' + (S.player.id === id ? ' on' : '');
    const n = document.createElement('b'); n.textContent = f.name;
    const t = document.createElement('span');
    t.textContent = roleOf(f).name + '　威力 ' + (mainAtk(f).power || 0);
    b.append(n, t);
    b.onclick = function(){ switchForm(id); sfx('select'); };
    grid.appendChild(b);
  });
}

function awaken(ch, st, side){
  if(side === 'x'){                      // 非畫面上的目標：只換資料，不播特效
    const l2 = ch.forms || (ch.upgradeTo ? [ch.upgradeTo] : null);
    if(st.upgraded || !l2 || ch.hp <= 0 || !awakenReady(ch, st)) return;
    const u2 = ALL_CHARACTERS.filter(function(c){ return c.id === l2[0]; })[0];
    if(!u2) return;
    st.upgraded = true;
    const carry2 = ch.hp;
    applyForm(ch, u2, false);
    ch.hp = Math.min(ch.maxHp, carry2 + CONFIG.upgradeHeal);
    if(ch.upgradeTo) st.upgraded = false;
    log('⚠️ ' + ch.name + ' 換乘了！', 'var(--gold)');
    return;
  }
  const list = ch.forms || (ch.upgradeTo ? [ch.upgradeTo] : null);
  if(st.upgraded || !list || ch.hp<=0) return;
  if(!awakenReady(ch, st)) return;
  const up = ALL_CHARACTERS.filter(c=>c.id===list[0])[0];
  if(!up) return;
  st.upgraded = true;
  const carry = ch.hp;
  const baseId = ch.id;              // applyForm 會覆蓋 ch.id，先留住觸發者
  /* 下一段的連擊從這一刻重新起算，換乘前累積的不算數 */
  if(side === 'p'){ S.sinceRun = 0; S.sinceBest = 0; S.awakened = true; }
  applyForm(ch, up, false);
  ch.hp = Math.min(ch.maxHp, carry + CONFIG.upgradeHeal);
  if(ch.forms){ ch.formList = ch.forms; ch.forms = null; }   // 之後可自由切換
  if(ch.upgradeTo) st.upgraded = false;                      // 還有下一階段就能再進化
  /* 換乘文案依觸發條件分兩種語氣：正向成長 vs 逆境爆發 */
  const _r = AWAKEN_RULE[baseId] || {};
  const _positive = (_r.type === 'combo' || _r.type === 'turn' || _r.type === 'hpHigh');
  log((_positive
        ? '🌟 ' + (_r.desc || '時機成熟') + '──蛻變完成！　✨ '
        : '⚠️ ' + (_r.desc || '瀕臨極限') + '──潛能爆發！　✨ ') + ch.name + '，登場！',
      _positive ? 'var(--jade)' : 'var(--gold)');
  screenFlash('cyan'); banner('AWAKEN!', true);
  popNumber(side==='p'?'f-p':'f-e', '+'+CONFIG.upgradeHeal, 'heal');
  auraFx(side);
  $(side+'-img').classList.add('glow');
  setTimeout(()=>$(side+'-img').classList.remove('glow'), 900);
  sfx('awaken'); paintHUD();
  if(side==='p'){ renderForms(); refreshAbilityBtn(); }
  if(side==='p' && S.answered && !S.resolved) buildTactics();
}

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

/* ============================================================================
   成長系統
   ── 題型熟練度：每個題型全對越多題，等級越高；出到該題型時，出招傷害小幅加成
   ── 典故卡：用角色完整打完三回合就解鎖他的招式典故，通關 3／5 次升銀框／金框
   ── 成就徽章：18 個，存在試算表「成長」工作表
   ── 全班討伐：每一課、每一班一隻共用的討伐目標，全班的作答累計成傷害
   ── 每週活動：老師在「活動」工作表填寫，開放期間自動生效
   ── 錯題道場：錯題本裡的題目變成菁英怪，訂正成功就從錯題本移除
   這些都是外加的成長層，戰鬥的核心數值完全沒動。
   ========================================================================== */
const MASTERY = {
  cats: ['A1_形音義','A2_成語詞語','A3_語法修辭','A4_排序與填空',
         'A5_作家與國學常識','A6_諸子與文化常識','B1_文言文課內理解','B2_白話文課內理解'],
  steps: [0, 5, 15, 30, 50, 80],      // Lv1～Lv5 需要的累計全對題數
  dmgPerLv: 0.03                      // 每一級：這類題目出招傷害 +3%（Lv5 為 +15%）
};
const CAT_ICON = {
  'A1_形音義':'🔤', 'A2_成語詞語':'📚', 'A3_語法修辭':'🧩', 'A4_排序與填空':'🧱',
  'A5_作家與國學常識':'🏛️', 'A6_諸子與文化常識':'☯️', 'B1_文言文課內理解':'📜', 'B2_白話文課內理解':'📖'
};
const CAT_SHORT = {
  'A1_形音義':'形音義', 'A2_成語詞語':'成語詞語', 'A3_語法修辭':'語法修辭', 'A4_排序與填空':'排序填空',
  'A5_作家與國學常識':'作家國學', 'A6_諸子與文化常識':'諸子文化', 'B1_文言文課內理解':'文言理解', 'B2_白話文課內理解':'白話理解'
};
const CARD_TIERS = [{n:5, k:'gold', t:'金框'}, {n:3, k:'silver', t:'銀框'}, {n:1, k:'bronze', t:'銅框'}];
const RAID_REWARD_SP = 5;             // 全班討伐成功：這一課開場 SP +5
const DOJO_MAX = 20;                  // 錯題道場一次最多 20 題
const ACHIEVEMENTS = [
  {id:'first_game',    icon:'🌱', name:'初出茅廬', desc:'完整打完第一場三回合'},
  {id:'streak10',      icon:'🔥', name:'十連全對', desc:'單場連續全對 10 題'},
  {id:'perfect_round', icon:'💯', name:'完美回合', desc:'一個回合的題目全部全對'},
  {id:'iron',          icon:'🛡️', name:'毫髮無傷', desc:'打完三回合時體力還有 80% 以上'},
  {id:'hard_clear',    icon:'⚔️', name:'以一敵三', desc:'困難模式完整打完三回合'},
  {id:'slayer',        icon:'💥', name:'萬夫莫敵', desc:'單場擊破 6 名以上敵人'},
  {id:'comeback',      icon:'🔄', name:'捲土重來', desc:'戰敗後再起，仍完整打完三回合'},
  {id:'spirit',        icon:'🌀', name:'精神領袖', desc:'單場使用精神指令 8 次'},
  {id:'awaken',        icon:'🦋', name:'破繭',     desc:'在戰鬥中換乘或變形'},
  {id:'all_cats',      icon:'🐾', name:'七貓之主', desc:'解鎖全部七隻貓'},
  {id:'scholar',       icon:'🎓', name:'博學',     desc:'八大題型都達到 Lv1'},
  {id:'master',        icon:'👑', name:'一代宗師', desc:'任一題型達到 Lv5'},
  {id:'hundred',       icon:'🗡️', name:'百題斬',   desc:'累計全對 100 題'},
  {id:'clans',         icon:'🏳️', name:'群英薈萃', desc:'七個陣營各有一位角色完整通關'},
  {id:'collector',     icon:'🃏', name:'典藏家',   desc:'收集 20 張典故卡'},
  {id:'golden',        icon:'🌟', name:'金框收藏', desc:'任一張典故卡升到金框'},
  {id:'dojo10',        icon:'💎', name:'錯題剋星', desc:'在錯題道場訂正 10 題'},
  {id:'raid',          icon:'🏆', name:'討伐英雄', desc:'全班討伐成功，而且你有出力'}
];

let GROWTH = {mastery:{}, ach:{}, cards:{}, stats:{}, guest:true, loaded:false};
let EVENTS = [];
let RAID = {};                 // 課程ID → 討伐狀態
let DOJO_ITEMS = null;         // 錯題本（null＝還沒讀）
let DOJO_MAP = {};
let PENDING_MODE = 'normal';   // 下一場要打的模式：normal／dojo

function todayKey(){
  const d = new Date();
  return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
}
function curLessonId(){ return currentLesson ? currentLesson.id : 'default'; }

/* ── 題型熟練度 ── */
function catKeyOf(c){
  c = String(c || '');
  if(MASTERY.cats.indexOf(c) >= 0) return c;
  return MASTERY.cats.filter(function(k){ const p = k.split('_'); return p[0] === c || p[1] === c; })[0] || '';
}
function lvOfOk(ok){
  let lv = 0;
  MASTERY.steps.forEach(function(s, i){ if(ok >= s) lv = i; });
  return lv;
}
function masteryOk(cat){ const m = GROWTH.mastery[catKeyOf(cat)]; return m ? (m.ok || 0) : 0; }
function masteryLv(cat){ return catKeyOf(cat) ? lvOfOk(masteryOk(cat)) : 0; }
function totalFull(){
  return MASTERY.cats.reduce(function(s, c){ return s + masteryOk(c); }, 0);
}
/* 每答完一題就在本機累加，升級時當場告訴學生 */
function addMastery(cat, full){
  const k = catKeyOf(cat);
  if(!k) return;
  const m = GROWTH.mastery[k] || (GROWTH.mastery[k] = {n:0, ok:0});
  const before = lvOfOk(m.ok || 0);
  m.n = (m.n || 0) + 1;
  if(full) m.ok = (m.ok || 0) + 1;
  const after = lvOfOk(m.ok);
  if(after > before){
    const name = k.split('_')[1];
    S.lvUps.push(name + ' Lv' + after);
    log('📗 「' + name + '」熟練度升到 Lv' + after + '！這類題目出招傷害 +' +
        Math.round(after * MASTERY.dmgPerLv * 100) + '%', 'var(--jade)');
    banner(CAT_SHORT[k] + ' Lv' + after + '!', true);
  }
}

/* ── 每週活動 ── */
function splitKV(v){
  v = String(v || '');
  const i = v.search(/[:：]/);
  if(i < 0) return ['', parseFloat(v) || 0];
  return [v.slice(0, i).trim(), parseFloat(v.slice(i + 1)) || 0];
}
function eventScoreMul(){
  let m = 1;
  EVENTS.forEach(function(ev){
    if(ev.code !== 'score') return;
    const kv = splitKV(ev.value);
    if(kv[0] && kv[0] !== curLessonId()) return;
    m *= clamp(kv[1] || 1, 1, 3);
  });
  return m;
}
/* 我方出招的額外倍率：題型熟練度 × 活動加成。只在 damage() 裡、攻擊方是玩家時使用 */
function growthDmgMul(move){
  let m = 1;
  if(S.current){
    const lv = masteryLv(S.current.cat);
    if(lv) m *= 1 + lv * MASTERY.dmgPerLv;
  }
  EVENTS.forEach(function(ev){
    const kv = splitKV(ev.value), pct = clamp(kv[1], 0, 100) / 100;
    if(ev.code === 'elem' && move && (move.type === kv[0] || BREATH[move.type] === kv[0])) m *= 1 + pct;
    if(ev.code === 'clan' && S.player && S.player.universe === (UNI_BY_LABEL[kv[0]] || kv[0])) m *= 1 + pct;
  });
  return m;
}
/* 開場時生效的活動與全班討伐獎勵 */
function applyStartBonuses(){
  EVENTS.forEach(function(ev){
    if(ev.code === 'sp'){
      const n = clamp(parseInt(ev.value, 10) || 0, 0, 20);
      if(n){ S.sp += n; log('🎪 活動「' + ev.name + '」：開場 SP +' + n, 'var(--grape)'); }
    }else if(ev.code === 'hp'){
      const p = clamp(parseFloat(ev.value) || 0, 0, 50);
      if(p){
        S.player.maxHp = Math.round(S.player.maxHp * (1 + p / 100));
        S.player.hp = S.player.maxHp;
        log('🎪 活動「' + ev.name + '」：體力 +' + p + '%', 'var(--grape)');
      }
    }else{
      log('🎪 活動「' + ev.name + '」：' + (ev.desc || ev.value), 'var(--grape)');
    }
  });
  const r = RAID[curLessonId()];
  if(S.mode === 'normal' && r && r.defeated){
    S.sp += RAID_REWARD_SP;
    log('🏆 全班已討伐「' + r.name + '」：開場 SP +' + RAID_REWARD_SP, 'var(--gold)');
  }
}

/* ── 典故卡 ── */
function cardIds(){
  return ALL_CHARACTERS.filter(function(c){ return !c.isUpgrade && CHARACTER_LORE[c.id]; })
                       .map(function(c){ return c.id; });
}
/* 改版前就通關過的角色（CLEARED）直接算有一張銅框 */
function cardClears(id){ return Math.max(Number(GROWTH.cards[id]) || 0, CLEARED[id] ? 1 : 0); }
function tierOfN(n){ return CARD_TIERS.filter(function(t){ return n >= t.n; })[0] || null; }
function cardTier(id){ return tierOfN(cardClears(id)); }
function cardCount(){ return cardIds().filter(function(id){ return cardClears(id) > 0; }).length; }
/* 訪客沒有收集系統，典故全部開放 */
function loreUnlocked(id){ return GROWTH.guest || !GROWTH.loaded || cardClears(id) > 0; }

/* ── 成就 ── */
function clansCleared(){
  const done = {};
  ALL_CHARACTERS.forEach(function(c){
    if(!c.isUpgrade && c.universe !== 'special' && cardClears(c.id) > 0) done[c.universe] = 1;
  });
  return Object.keys(done).length;
}
function evalAchievements(game){
  const got = [];
  const add = function(id){ if(!GROWTH.ach[id] && got.indexOf(id) < 0) got.push(id); };
  if(game){
    if(game.fullRun) add('first_game');
    if(S.maxStreak >= 10) add('streak10');
    if(S.perfectRounds >= 1) add('perfect_round');
    if(game.fullRun && game.hpPct >= 80) add('iron');
    if(game.fullRun && S.difficulty === 'hard') add('hard_clear');
    if(S.kos >= 6) add('slayer');
    if(game.fullRun && S.defeats > 0) add('comeback');
    if(S.spiritCasts >= 8) add('spirit');
    if(S.awakened) add('awaken');
  }
  if(allCatsUnlocked()) add('all_cats');
  const lvs = MASTERY.cats.map(masteryLv);
  if(lvs.every(function(l){ return l >= 1; })) add('scholar');
  if(lvs.some(function(l){ return l >= 5; })) add('master');
  if(totalFull() >= 100) add('hundred');
  if(clansCleared() >= 7) add('clans');
  if(cardCount() >= 20) add('collector');
  if(cardIds().some(function(id){ return cardClears(id) >= 5; })) add('golden');
  if((Number(GROWTH.stats.dojoFixed) || 0) >= 10) add('dojo10');
  const r = RAID[curLessonId()];
  if(r && r.defeated && r.me > 0) add('raid');
  return got;
}
/* 寫回試算表；回傳值以伺服器為準（避免兩台裝置互相覆蓋） */
function pushGrowth(patch){
  const ids = Object.keys(patch.ach || {});
  ids.forEach(function(id){ GROWTH.ach[id] = todayKey(); });
  if(!inGAS || GROWTH.guest) return;
  google.script.run
    .withSuccessHandler(function(r){
      if(r && r.ok){ GROWTH.ach = r.ach || GROWTH.ach; GROWTH.cards = r.cards || GROWTH.cards; GROWTH.stats = r.stats || GROWTH.stats; }
      paintGrowth();
    })
    .withFailureHandler(function(){})
    .saveGrowth(patch);
}
/* 累積型成就（例如七貓、博學）不一定在戰鬥中達成，回首頁時補檢查一次 */
function syncCumulativeAch(){
  if(!GROWTH.loaded || GROWTH.guest) return;
  const got = evalAchievements(null);
  if(!got.length) return;
  const ach = {}; got.forEach(function(id){ ach[id] = 1; });
  pushGrowth({ach: ach});
}

/* ── 讀取 ── */
function loadGrowth(){
  if(!inGAS){ GROWTH.loaded = true; paintGrowth(); return; }
  google.script.run
    .withSuccessHandler(function(g){
      g = g || {};
      GROWTH = {mastery: g.mastery || {}, ach: g.ach || {}, cards: g.cards || {}, stats: g.stats || {},
                guest: !!g.guest, loaded: true};
      paintGrowth(); syncCumulativeAch();
    })
    .withFailureHandler(function(){ GROWTH.loaded = true; paintGrowth(); })
    .getGrowth();
}
function loadEvents(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(list){ EVENTS = Array.isArray(list) ? list : []; paintEvents(); })
    .withFailureHandler(function(){})
    .getEvents();
}
function loadRaid(){
  if(!inGAS) return;
  const id = curLessonId();
  google.script.run
    .withSuccessHandler(function(r){ if(r){ RAID[id] = r; if(id === curLessonId()) paintRaid(); } })
    .withFailureHandler(function(){})
    .getRaid(id);
}
function loadDojo(cb){
  if(!inGAS){ DOJO_ITEMS = []; if(cb) cb(); return; }
  google.script.run
    .withSuccessHandler(function(wb){ DOJO_ITEMS = (wb && wb.items) || []; paintGrowth(); if(cb) cb(); })
    .withFailureHandler(function(){ if(cb) cb(); })
    .getWrongBook();
}

/* ── 首頁：活動橫幅 ── */
function paintEvents(){
  const box = $('event-strip');
  if(!box) return;
  box.innerHTML = '';
  box.hidden = !EVENTS.length;
  EVENTS.forEach(function(ev){
    const d = document.createElement('div'); d.className = 'ev';
    const b = document.createElement('b'); b.textContent = '🎪 ' + ev.name;
    const s = document.createElement('span');
    s.textContent = (ev.desc || ev.value) + (ev.end ? '　至 ' + ev.end.slice(5).replace('-', '/') : '');
    d.append(b, s); box.appendChild(d);
  });
}

/* ── 首頁：我的成長 ── */
function paintGrowth(){
  const box = $('growth-box');
  if(!box) return;
  box.hidden = false;
  $('growth-sum').textContent = GROWTH.guest ? '登入學校帳號才會保存' : ('累計全對 ' + totalFull() + ' 題');

  const grid = $('mastery-grid'); grid.innerHTML = '';
  MASTERY.cats.forEach(function(k){
    const ok = masteryOk(k), lv = lvOfOk(ok);
    const next = MASTERY.steps[lv + 1];
    const base = MASTERY.steps[lv];
    const d = document.createElement('div'); d.className = 'ms lv' + lv;
    const top = document.createElement('div'); top.className = 'ms-top';
    const nm = document.createElement('b'); nm.textContent = CAT_ICON[k] + ' ' + CAT_SHORT[k];
    const lb = document.createElement('em'); lb.textContent = 'Lv' + lv;
    top.append(nm, lb);
    const bar = document.createElement('u'); const fill = document.createElement('i');
    fill.style.width = (next ? Math.round((ok - base) / (next - base) * 100) : 100) + '%';
    bar.appendChild(fill);
    const tx = document.createElement('small');
    tx.textContent = next ? ('全對 ' + ok + '／' + next + ' 升級') : ('全對 ' + ok + '　已滿級');
    d.append(top, bar, tx);
    d.title = '出到這類題目時，出招傷害 +' + Math.round(lv * MASTERY.dmgPerLv * 100) + '%';
    grid.appendChild(d);
  });

  const shelf = $('ach-shelf'); shelf.innerHTML = '';
  let n = 0;
  ACHIEVEMENTS.forEach(function(a){
    const got = !!GROWTH.ach[a.id];
    if(got) n++;
    const b = document.createElement('button');
    b.className = 'ach' + (got ? ' got' : '');
    b.textContent = a.icon;
    b.setAttribute('aria-label', a.name);
    b.onclick = function(){
      shelf.querySelectorAll('.ach').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      $('ach-detail').innerHTML = '';
      const t = document.createElement('b'); t.textContent = a.icon + ' ' + a.name;
      const s = document.createElement('span');
      s.textContent = a.desc + (got ? '　✓ ' + GROWTH.ach[a.id] + ' 達成' : '　（尚未達成）');
      $('ach-detail').append(t, s);
      sfx('tap');
    };
    shelf.appendChild(b);
  });
  $('ach-count').textContent = n + ' / ' + ACHIEVEMENTS.length;
  $('cards-count').textContent = cardCount() + ' / ' + cardIds().length;
  $('dojo-count').textContent = DOJO_ITEMS === null ? '' : (DOJO_ITEMS.length + ' 題');
}

/* ── 首頁：全班討伐 ── */
function raidBossOf(lessonId){
  const pool = ALL_CHARACTERS.filter(function(c){ return !c.isUpgrade && !c.secret; });
  let h = 0;
  String(lessonId).split('').forEach(function(ch){ h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
  return pool[h % pool.length];
}
function paintRaid(){
  const box = $('raid-box');
  if(!box) return;
  const r = RAID[curLessonId()];
  if(!r || r.off){ box.hidden = true; return; }
  box.hidden = false;
  $('raid-cls').textContent = r.cls === '未分班' ? '未分班' : (r.cls + ' 班');
  const boss = raidBossOf(curLessonId());
  if(boss) bindImg($('raid-img'), boss);
  $('raid-name').textContent = r.name;
  const left = Math.max(0, r.hp - r.dmg);
  const pct = r.hp ? clamp(left / r.hp * 100, 0, 100) : 0;
  $('raid-fill').style.width = pct + '%';
  $('raid-hp').textContent = r.defeated ? '討伐成功！' : (left.toLocaleString() + ' / ' + r.hp.toLocaleString());
  box.classList.toggle('down', !!r.defeated);
  $('raid-info').textContent = '全班 ' + r.joined + ' 人出戰，累計 ' + r.dmg.toLocaleString() + ' 點傷害' +
    (r.guest ? '' : '　你出了 ' + r.me.toLocaleString() + ' 點');
  const top = $('raid-top'); top.innerHTML = '';
  (r.top || []).forEach(function(t, i){
    const s = document.createElement('span'); s.className = t.me ? 'me' : '';
    s.textContent = ['🥇','🥈','🥉'][i] + ' ' + t.id + '　' + t.dmg;
    top.appendChild(s);
  });
  $('raid-reward').textContent = r.defeated
    ? '🏆 獎勵生效中：這一課開場 SP +' + RAID_REWARD_SP
    : '全對一題造成 10 點傷害。打倒後，全班在這一課開場 SP +' + RAID_REWARD_SP + '。';
}

/* ── 典故圖鑑 ── */
let CARD_FILTER = 'all';
function openCards(){
  const tabs = $('cards-tabs');
  if(!tabs.children.length){
    [{k:'all', label:'全部'}].concat(UNIVERSES).forEach(function(u, i){
      const b = document.createElement('button');
      b.className = 'tab' + (i === 0 ? ' on' : ''); b.dataset.u = u.k === 'all' ? '' : u.k;
      b.textContent = u.label;
      b.onclick = function(){
        tabs.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
        b.classList.add('on'); CARD_FILTER = u.k; renderCards(); sfx('tap');
      };
      tabs.appendChild(b);
    });
  }
  renderCards();
  show('scr-cards');
}
function renderCards(){
  const grid = $('card-grid'); grid.innerHTML = '';
  const ids = cardIds();
  $('cards-tag').textContent = '已收集 ' + cardCount() + ' / ' + ids.length;
  ids.forEach(function(id){
    const c = ALL_CHARACTERS.filter(function(x){ return x.id === id; })[0];
    if(!c || (CARD_FILTER !== 'all' && c.universe !== CARD_FILTER)) return;
    const n = cardClears(id), tier = cardTier(id);
    const hidden = c.secret && !UNLOCKED[id];
    const b = document.createElement('button');
    b.className = 'lcard' + (tier ? ' ' + tier.k : ' locked');
    b.style.setProperty('--uc', 'var(--u-' + c.universe + ')');
    const port = document.createElement('div'); port.className = 'lcard-port';
    const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
    if(hidden) img.src = placeholderImg('？？？', c.universe); else bindImg(img, c);
    port.appendChild(img);
    if(tier){ const t = document.createElement('em'); t.textContent = tier.t; port.appendChild(t); }
    const nm = document.createElement('b'); nm.textContent = hidden ? '？？？' : c.name;
    const tx = document.createElement('small');
    tx.textContent = n ? ('通關 ' + n + ' 次') : '🔒 完整通關一次解鎖';
    b.append(port, nm, tx);
    b.onclick = function(){ if(!hidden) openCardDetail(c); sfx('tap'); };
    grid.appendChild(b);
  });
}
function openCardDetail(c){
  const lore = CHARACTER_LORE[c.id] || {};
  const n = cardClears(c.id), tier = cardTier(c.id), open = n > 0 || GROWTH.guest;
  const box = $('card-detail');
  box.className = 'cond-card card-detail' + (tier ? ' ' + tier.k : '');
  bindImg($('cd-img'), c);
  $('cd-name').textContent = c.name;
  $('cd-sub').textContent = (UNI_LABEL[c.universe] || '') + '　' + roleOf(c).name + '　' +
    (tier ? tier.t + '・通關 ' + n + ' 次' : '尚未解鎖');
  $('cd-bio').textContent = lore.bio || '';
  const mv = $('cd-moves'); mv.innerHTML = '';
  const entries = Object.keys(lore.moves || {});
  if(open){
    entries.forEach(function(k){
      const d = document.createElement('div'); d.className = 'lore-mv';
      const b = document.createElement('b'); b.textContent = k + '：';
      d.append(b, document.createTextNode(lore.moves[k]));
      mv.appendChild(d);
    });
  }else{
    const d = document.createElement('div'); d.className = 'lore-lock';
    d.textContent = '🔒 招式典故 ' + entries.length + ' 則：用' + c.name + '完整打完三回合就能解鎖。';
    mv.appendChild(d);
  }
  const q = (QUOTES[c.id] || [])[0];
  $('cd-quote').hidden = !q;
  $('cd-quote').textContent = q ? '「' + q + '」' : '';
  const next = CARD_TIERS.slice().reverse().filter(function(t){ return n < t.n; })[0];
  $('cd-next').textContent = next ? ('再通關 ' + (next.n - n) + ' 次升到' + next.t) : '已經是最高等級的金框';
  box.hidden = false;
}

/* ── 錯題道場 ── */
function startDojo(){
  if(!inGAS || !(ME && ME.allowed)){ alert('錯題道場需要用學校帳號登入，才讀得到你的錯題本。'); return; }
  const go = function(){
    if(!DOJO_ITEMS || !DOJO_ITEMS.length){ alert('錯題本是空的——目前沒有需要訂正的題目，太強了！'); return; }
    PENDING_MODE = 'dojo';
    if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
    $('lesson-tag').textContent = '⚔️ 錯題道場：' + Math.min(DOJO_MAX, DOJO_ITEMS.length) + ' 題';
    show('scr-select'); sfx('tap');
  };
  if(DOJO_ITEMS === null){ $('dojo-count').textContent = '讀取中…'; loadDojo(go); }
  else go();
}
/* 道場的題庫：錯題本裡的題目（不同課的同一題號要分開，所以用 課程ID|題號 當編號） */
function dojoBank(){
  DOJO_MAP = {};
  return (DOJO_ITEMS || []).slice(0, DOJO_MAX).map(function(it){
    const key = it.key || ((it.lessonId || 'default') + '|' + it.id);
    DOJO_MAP[key] = it;
    return {id: key, q: it.q, options: it.options, answer: it.answer, exp: it.exp, cat: it.cat};
  });
}
function dojoResolved(){
  const it = DOJO_MAP[S.current && S.current.id];
  if(S.charge < 1 || !it || it._fixed) return;
  it._fixed = true; S.dojoFixed++;
  log('💎 訂正成功！這一題已從錯題本移除。', 'var(--jade)');
  if(inGAS) google.script.run.withFailureHandler(function(){}).markCorrected(it.id, it.cat || '', it.lessonId || '');
}

/* ── 一場結束：結算成長 ── */
function settleGrowth(fullRun, hpPct, wasCleared){
  const news = {card:null, ach:[], lv:S.lvUps.slice(), raid:Math.round(S.raidDmg)};
  const patch = {ach:{}, cards:{}, stats:{games:1}};
  GROWTH.stats.games = (Number(GROWTH.stats.games) || 0) + 1;
  if(fullRun){
    patch.stats.fullRuns = 1;
    GROWTH.stats.fullRuns = (Number(GROWTH.stats.fullRuns) || 0) + 1;
    const base = (S.player && S.player.baseId) || (S.player && S.player.id);
    if(base && CHARACTER_LORE[base]){
      const stored = Number(GROWTH.cards[base]) || 0;
      const before = tierOfN(Math.max(stored, wasCleared ? 1 : 0));
      /* 改版前通關過（只記在 CLEARED）的角色，這一場算第二次 */
      const legacy = (stored === 0 && wasCleared);
      GROWTH.cards[base] = legacy ? 2 : stored + 1;
      patch.cards[base] = legacy ? 2 : 1;
      const after = cardTier(base);
      news.card = {c: ALL_CHARACTERS.filter(function(x){ return x.id === base; })[0],
                   first: !before, tier: after, up: !!(before && after && before.k !== after.k)};
    }
  }
  const got = evalAchievements({fullRun: fullRun, hpPct: hpPct});
  got.forEach(function(id){ patch.ach[id] = 1; });
  news.ach = got;
  pushGrowth(patch);
  return news;
}
/* 結算畫面的「這一場的收穫」 */
function paintGrowthNote(news){
  const box = $('growth-note');
  box.innerHTML = '';
  const rows = [];
  if(news.card && news.card.c){
    if(news.card.first) rows.push(['🃏', '解鎖典故卡', news.card.c.name + '（可在首頁「典故圖鑑」閱讀招式典故）']);
    else if(news.card.up) rows.push(['🃏', '典故卡升級', news.card.c.name + ' → ' + news.card.tier.t]);
  }
  news.ach.forEach(function(id){
    const a = ACHIEVEMENTS.filter(function(x){ return x.id === id; })[0];
    if(a) rows.push([a.icon, '新成就', a.name + '：' + a.desc]);
  });
  news.lv.forEach(function(t){ rows.push(['📗', '熟練度升級', t]); });
  if(news.raid > 0) rows.push(['⚔️', '討伐貢獻', '這一場對全班討伐目標造成 ' + news.raid + ' 點傷害' +
                                (ME && ME.allowed ? '（送出成績後計入）' : '（登入學校帳號才會計入）')]);
  if(news.dojo !== undefined) rows.unshift(['💎', '錯題訂正', '這一場訂正了 ' + news.dojo + ' 題']);
  box.hidden = !rows.length;
  if(!rows.length) return;
  const h = document.createElement('h4'); h.textContent = '這一場的收穫';
  box.appendChild(h);
  rows.forEach(function(r){
    const d = document.createElement('div'); d.className = 'gn';
    const i = document.createElement('i'); i.textContent = r[0];
    const t = document.createElement('div');
    const b = document.createElement('b'); b.textContent = r[1];
    const s = document.createElement('span'); s.textContent = r[2];
    t.append(b, s); d.append(i, t); box.appendChild(d);
  });
  if(news.ach.length){ setTimeout(function(){ banner('ACHIEVEMENT!', true); sfx('awaken'); }, 700); }
}
/* 錯題道場的結算：不計學期積分，只記訂正與成長 */
function endDojo(win){
  const total = Object.keys(DOJO_MAP).length;
  GROWTH.stats.dojoFixed = (Number(GROWTH.stats.dojoFixed) || 0) + S.dojoFixed;
  const patch = {ach:{}, cards:{}, stats:{dojoFixed: S.dojoFixed, dojoRuns: 1}};
  const got = evalAchievements({fullRun:false, hpPct:0});
  got.forEach(function(id){ patch.ach[id] = 1; });
  pushGrowth(patch);
  DOJO_ITEMS = null;                       // 錯題本變了，下次重新讀

  const v = $('verdict');
  v.className = 'verdict win';
  v.textContent = '💎 道場修行完成';
  $('total-score').textContent = S.dojoFixed + ' / ' + total;
  $('total-score').nextElementSibling.textContent = '題訂正';
  $('unlock-note').hidden = true;
  $('breakdown').innerHTML = '';
  [['訂正成功', S.dojoFixed + ' 題'],
   ['還要再練', Math.max(0, total - S.dojoFixed) + ' 題'],
   ['作答題數', S.totalAnswered + ' 題'],
   ['最高連續全對', S.maxStreak + ' 題'],
   ['擊破菁英', S.kos + ' 名'],
   ['精神指令', S.spiritCasts + ' 次']].forEach(function(row){
    const d = document.createElement('div'); d.className = 'brow';
    const a = document.createElement('span'); a.textContent = row[0];
    const b = document.createElement('b'); b.textContent = row[1];
    d.append(a, b); $('breakdown').appendChild(d);
  });
  paintGrowthNote({card:null, ach:got, lv:S.lvUps.slice(), raid:0, dojo:S.dojoFixed});
  $('save-box').hidden = true;
  $('board').hidden = true;
  $('rank-box').hidden = true;
  $('sem-result').hidden = false;
  $('sem-result-text').textContent = '錯題道場不計學期積分。訂正成功的題目已經從錯題本移除，學習分析頁也會同步更新。';
  show('scr-result');
  sfx('win');
}



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

/* ============================================================================
   啟動
   ========================================================================== */
/* 橫式優先：直向時顯示轉向提示（可自行略過） */
document.body.classList.add('force-landscape');
$('rot-ignore').onclick = function(){
  document.body.classList.remove('force-landscape');
  sfx('tap');
};

/* 逐步啟動：任何一步出錯都會被記下來並顯示，但不會中斷後面的步驟。
   舊版是連續呼叫，前面一炸後面全部不執行——那正是「畫面卡住」的成因。 */
[['buildTabs', buildTabs], ['restorePreview', restorePreview],
 ['loadLessons', loadLessons], ['loadUser', loadUser],
 ['loadImageMap', loadImageMap], ['loadCharacterTable', loadCharacterTable],
 ['loadProgress', loadProgress], ['loadEvents', loadEvents], ['paintGrowth', paintGrowth]
].forEach(function(step){
  try{ step[1](); }
  catch(err){
    if(window.__bootErr) window.__bootErr('啟動步驟 ' + step[0] + ' 失敗：', err && err.message ? err.message : String(err));
    console.error('[boot] ' + step[0], err);
  }
});

document.querySelectorAll('#diff-row .optbtn').forEach(function(b){
  b.onclick = function(){
    document.querySelectorAll('#diff-row .optbtn').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on'); S.difficulty = b.dataset.diff; sfx('select');
  };
});
document.querySelectorAll('#speed-row .optbtn').forEach(function(b){
  b.onclick = function(){
    document.querySelectorAll('#speed-row .optbtn').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on'); SPEED = parseFloat(b.dataset.speed); sfx('select');
  };
});

$('btn-goto-select').onclick = function(){
  PENDING_MODE = 'normal';
  $('lesson-tag').textContent = currentLesson ? (currentLesson.name || '') : '';
  if(!rosterBuilt) renderRoster(UNIVERSES[0].k);   // 第一次進來才建立陣容
  show('scr-select'); sfx('tap');
};
$('btn-back-home').onclick = function(){
  PENDING_MODE = 'normal';
  $('lesson-tag').textContent = currentLesson ? (currentLesson.name || '') : '';
  show('scr-home'); sfx('tap');
};
$('btn-cards').onclick = function(){ openCards(); sfx('tap'); };
$('btn-dojo').onclick = startDojo;
$('btn-cards-back').onclick = function(){ show('scr-home'); sfx('tap'); };
$('cd-close').onclick = function(){ $('card-detail').hidden = true; };
$('btn-home-rules').onclick = function(){ $('scr-rules').classList.add('on'); };
$('btn-home-codex').onclick = function(){ openCodex(); sfx('tap'); };
/* 學生端一鍵清除：只刪自己的資料，需要連按兩次確認 */
$('btn-wipe').onclick = function(){
  if(!(ME && ME.allowed)){ alert('未以學校帳號登入，沒有可清除的紀錄。'); return; }
  if(!confirm('確定要清除你的所有紀錄嗎？\n\n包含：學期積分、各課最佳成績、作答紀錄、錯題本、存檔進度。\n這個動作無法復原。')) return;
  if(!confirm('最後確認：真的要全部清除嗎？')) return;
  if(!inGAS){ alert('本機預覽模式，沒有連線到試算表。'); return; }
  const b = $('btn-wipe');
  b.disabled = true; b.textContent = '清除中⋯⋯';
  google.script.run
    .withSuccessHandler(function(r){
      alert((r && r.msg) || '已清除。');
      location.reload();
    })
    .withFailureHandler(function(){
      b.disabled = false; b.textContent = '🗑️ 清除我的所有紀錄';
      alert('清除失敗，請稍後再試。');
    })
    .deleteMyData();
};

$('pw-ok').onclick = submitPw;
$('pw-cancel').onclick = closePw;
$('pw-input').addEventListener('keydown', function(e){
  if(e.key === 'Enter') submitPw();
  if(e.key === 'Escape') closePw();
});

$('btn-styles').onclick = function(){ openStyles(); sfx('tap'); };
/* 學習分析改成獨立網頁，用超連結另開視窗（避免主程式過大） */
$('btn-stats').onclick = function(){
  sfx('tap');
  const base = (ME && ME.analysisUrl) ? ME.analysisUrl : '';
  if(!base){ alert('請先部署網頁應用程式，學習分析才有網址可以開啟。'); return; }
  window.open(base, '_blank');
};
$('btn-teacher').onclick = function(){
  sfx('tap');
  /* 教師後臺與遊戲共用同一個網址，用 ?page=teacher 分流。
     真正的把關在後臺頁面本身（要輸入密碼），這個按鈕只是入口。 */
  /* gameUrl 由 getUserInfo() 提供。若那支呼叫還沒回來（或失敗），
     就退回用目前的網址推導——Apps Script 網頁跑在 iframe 裡，
     真正的外層網址在 referrer 或 ancestorOrigins，都拿不到時才提示。 */
  let base = (ME && ME.gameUrl) ? ME.gameUrl : '';
  if(!base){
    try{
      const ref = document.referrer || '';
      if(ref.indexOf('/macros/') >= 0) base = ref.split('?')[0];
    }catch(e){}
  }
  if(!base){
    alert('還在取得網址，請稍等一兩秒再按一次。\n\n'
        + '如果一直不行，代表網頁應用程式尚未部署，\n'
        + '或者可以直接在網址列的部署網址後面加上　?page=teacher');
    return;
  }
  window.open(base + '?page=teacher', '_blank');
};
$('btn-styles-back').onclick = function(){ show('scr-home'); sfx('tap'); };
$('btn-login').onclick = function(){
  /* 在原頁面直接換到 Google 帳號選擇頁，選好帳號後自動回到遊戲（不開新分頁）。
     Apps Script 網頁跑在 iframe 裡，必須用 target="_top" 讓「整個頁面」跳轉；
     回來的網址（continue）一定要帶，否則 Google 會把人留在 Google 首頁。 */
  let back = (ME && ME.gameUrl) ? ME.gameUrl : '';
  if(!back){
    try{
      const ref = document.referrer || '';
      if(ref.indexOf('/macros/') >= 0) back = ref.split('?')[0].split('#')[0];
    }catch(e){}
  }
  if(!back){
    alert('還在取得遊戲網址，請稍等一兩秒再按一次「用學校帳號登入」。');
    return;
  }
  const u = 'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(back);
  /* 提示文字裡附一個備用連結：萬一瀏覽器擋下整頁跳轉，學生可以自己點 */
  const note = $('login-note');
  note.textContent = '正在前往 Google 登入頁，選好學校帳號後會自動回到遊戲。沒有跳轉的話請';
  const alt = document.createElement('a');
  alt.href = u; alt.target = '_blank'; alt.rel = 'noopener';
  alt.textContent = '點這裡另開登入頁';
  alt.style.cssText = 'color:var(--sakura-d,#e0559b);font-weight:700;text-decoration:underline';
  note.appendChild(alt);
  note.appendChild(document.createTextNode('（登入後回到這頁重新整理）。'));
  const a = document.createElement('a');
  a.href = u; a.target = '_top';
  document.body.appendChild(a); a.click(); a.remove();
};

$('btn-codex-back').onclick = function(){
  show(rosterBuilt ? 'scr-select' : 'scr-home'); sfx('tap');
};

function refreshRoster(){
  if(!rosterBuilt) return;            // 還沒進選角畫面就不必重繪
  const active = document.querySelector('.tab.on');
  renderRoster(active && active.dataset.u ? active.dataset.u : UNIVERSES[0].k);
  if(selected){
    const fresh = ALL_CHARACTERS.filter(x=>x.id===selected.id)[0];
    if(fresh){ selected = fresh; selectCharacter(fresh); }
  }else restorePreview();
}

function loadImageMap(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(map){
      if(!map || typeof map !== 'object') return;
      let n = 0;
      ALL_CHARACTERS.forEach(function(c){ if(map[c.id]){ c.img = normalizeImgUrl(map[c.id]); n++; } });
      if(n) refreshRoster();
    })
    .withFailureHandler(function(){})
    .getImageMap();
}

/* 學生自創角色：試算表出現內建清單沒有的角色ID，就依該列建立新角色。
   數值一律夾在合理範圍內，避免出現一拳打死人的角色。 */
function createCharacter(r){
  if(!r.id || !r.name) return null;
  if(!/^[A-Za-z0-9_]{2,24}$/.test(r.id)) return null;      // ID 只收英數與底線
  const cl = function(v, lo, hi, d){ v = Number(v); return isNaN(v) || !v ? d : Math.max(lo, Math.min(hi, v)); };
  const ch = {
    id: r.id,
    name: String(r.name).slice(0, 12),
    universe: UNI_BY_LABEL[r.universe] || 'special',
    clan: 'custom',
    type: String(r.type || '自創角色').slice(0, 8),
    defType: '一般',
    custom: true,
    hp: cl(r.hp, 450, 1000, 720),
    ability: { name: String(r.abName || '全力以赴').slice(0, 12),
               effect: ABILITY_TEXT[r.abEff] ? r.abEff : 'overdrive' },
    moves: [
      { name: String(r.atkName || '普通攻擊').slice(0, 12),
        type: TYPE_CHART[r.atkType] ? r.atkType : '一般',
        power: cl(r.atkPower, 50, 100, 80), kind: 'attack' },
      { name: String(r.gdName || '防禦姿態').slice(0, 12),
        type: '防禦', power: 0, defense: cl(r.gdDef, 0.15, 0.70, 0.42), kind: 'guard' },
      { name: String(r.skName || '凝神').slice(0, 12),
        type: '特技', power: 0,
        effect: SKILL_MAG[r.skEff] ? r.skEff : 'focus', kind: 'skill' }
    ]
  };
  ch.role = ROLES[r.role] ? r.role : 'balance';
  ch.moves.forEach(function(m){
    m.acc = (m.accFixed !== undefined) ? m.accFixed : accOf(m.power);
    if(m.kind === 'aoe' && m.accFixed === undefined) m.acc = Math.max(35, m.acc - CONFIG.aoeAccPenalty);
  });
  ch.baseHp = ch.hp;
  ch.hp = Math.round(ch.hp * roleOf(ch).hp);
  ch.ph = placeholderImg(ch.name, ch.universe);
  ch.img = ch.ph;
  ALL_CHARACTERS.push(ch);
  return ch;
}

/* 從試算表「角色」工作表覆寫角色設定：留白的欄位就沿用內建值 */
function loadCharacterTable(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(rows){
      if(!Array.isArray(rows) || !rows.length) return;
      let n = 0;
      rows.forEach(function(r){
        let c = ALL_CHARACTERS.filter(x=>x.id === r.id)[0];
        if(!c){ c = createCharacter(r); if(!c) return; }
        n++;
        if(r.name)      c.name = r.name;
        if(r.type)      c.type = r.type;
        if(r.role && ROLES[r.role]) c.role = r.role;
        if(r.hp)        c.baseHp = r.hp;
        if(r.img)       c.img = normalizeImgUrl(r.img);
        if(r.atkImg)    c.atkImg = normalizeImgUrl(r.atkImg);
        if(r.atkName && mainAtk(c))   mainAtk(c).name = r.atkName;
        // 招式：試算表的三組欄位可整組覆寫，留白則沿用內建
        const KIND_MAP = {'攻擊':'attack','群攻':'aoe','防禦':'guard','特技':'skill'};
        if(Array.isArray(r.moves)){
          const built = [];
          r.moves.forEach(function(mm){
            if(!mm || !mm.name) return;
            const k = KIND_MAP[mm.kind] || mm.kind || 'attack';
            if(k === 'guard'){
              built.push({name:mm.name, type:'防禦', power:0,
                          defense: clamp(mm.defense || 0.45, 0.05, 0.85), kind:'guard'});
            }else if(k === 'skill'){
              built.push({name:mm.name, type:'特技', power:0,
                          effect: SKILL_MAG[mm.effect] ? mm.effect : 'focus', kind:'skill'});
            }else{
              const pw = clamp(mm.power || 80, 1, 120);
              const kk = (k === 'aoe') ? 'aoe' : 'attack';
              built.push({name:mm.name, type: TYPE_CHART[mm.type] ? mm.type : '一般',
                          power:pw,
                          acc: kk === 'aoe' ? Math.max(35, accOf(pw) - CONFIG.aoeAccPenalty) : accOf(pw),
                          kind: kk});
            }
          });
          if(built.length && built.some(function(x){ return isAtkKind(x.kind); })) c.moves = built;
        }
        if(r.abName)    c.ability.name = r.abName;
        if(r.abEff && ABILITY_TEXT[r.abEff]) c.ability.effect = r.abEff;
        c.hp = Math.round(c.baseHp * roleOf(c).hp);
        c.ph = placeholderImg(c.name, c.universe);
        if(!c.img) c.img = c.ph;
      });
      if(n) refreshRoster();
    })
    .withFailureHandler(function(){})
    .getCharacterTable();
}

$('btn-start').onclick = startBattle;
$('btn-save').onclick  = saveScore;
$('btn-again').onclick = function(){ location.reload(); };
/* 戰鬥畫面的聲音鈕：全開 → 只關音樂 → 全關 → 全開 */
$('btn-mute').onclick  = function(){
  const music = BGM.isOn(), fx = !SFX.isMuted();
  if(music && fx){ BGM.set(false); log('🔉 背景音樂關閉（音效保留）', 'var(--dim)'); }
  else if(!music && fx){ SFX.toggle(); BGM.set(false); log('🔇 音樂與音效都已關閉', 'var(--dim)'); }
  else { if(SFX.isMuted()) SFX.toggle(); BGM.set(true); log('🔊 音樂與音效已開啟', 'var(--dim)'); }
};
$('btn-bgm').onclick = function(){ BGM.button(); sfx('tap'); };
BGM.auto();                          // 開頁時先畫好按鈕狀態（真正播放要等第一次點擊）
$('rd-save').onclick   = function(){ saveNow(true); };
$('btn-qsave').onclick = openQuickSave;
$('qs-leave').onclick  = function(){ doQuickSave(true); };
$('qs-stay').onclick   = function(){ doQuickSave(false); };
$('qs-cancel').onclick = function(){ $('qs-box').hidden = true; };
$('rd-next').onclick   = continueNextRound;
$('rd-quit').onclick   = function(){ endGame('time'); };

$('btn-rules').onclick = function(){ $('scr-rules').classList.add('on'); };
$('rules-close').onclick = function(){ $('scr-rules').classList.remove('on'); };

document.addEventListener('keydown', function(e){
  if(!$('scr-battle').classList.contains('on')) return;
  if(e.target.tagName === 'INPUT') return;
  const n = parseInt(e.key,10);
  if(n>=1 && n<=6){
    const el = document.querySelectorAll('.opt')[n-1];
    if(el && !el.disabled) toggleOption(n-1, el);
  }
  if(e.key === 'Enter'){
    const btn = $('main-btn');
    if(!btn.disabled) btn.click();
  }
});
