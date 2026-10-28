/* 【03-characters.js】角色資料 ALL_CHARACTERS、六種定位
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
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
