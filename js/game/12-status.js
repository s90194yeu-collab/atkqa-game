/* 【12-status.js】戰場清單、狀態效果、特技與特色能力說明、陣營被動
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
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
