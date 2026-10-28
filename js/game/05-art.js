/* 【05-art.js】角色立繪、特色能力演出動畫、圖片載入
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   圖片替換表
   ── 想換掉任何角色的圖，把網址填在這裡就好，不用去動上面的角色資料
   ── 沒有網址（或網址失效）的角色會自動顯示對應顏色的替代卡
   ========================================================================== */
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
