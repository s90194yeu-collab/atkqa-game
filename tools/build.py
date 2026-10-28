#!/usr/bin/env python3
"""
關於答對率等於攻擊力這件事 —— 建置工具（只用 Python 標準函式庫）

用法：在儲存庫根目錄執行  python3 tools/build.py

做的事：
  1. 依下方 PAGES 的清單，把 src/*.html 樣板裡的 <!--@STYLES-->、<!--@SCRIPTS-->
     換成實際的 <link>／<script>（絕對網址＋內容雜湊，瀏覽器才會抓到新版），輸出到 pages/。
  2. 有安裝 Node.js 時，檢查每個 js 檔有沒有語法錯誤。
  3. 產生 release.json；Apps Script 執行 installGitHubFrontend 時會用它核對版本。

改了 js/、css/、src/ 之後都要重新執行，再把變動推上 GitHub。
"""
import glob, hashlib, json, os, shutil, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://s90194yeu-collab.github.io/atkqa-game/'

# 每個畫面要載入的檔案（依序）。萬用字元會依檔名排序，所以檔名前面的編號就是載入順序。
PAGES = {
    'game':    {'css': ['css/game/*.css'], 'js': ['assets/manifest.js', 'js/game/*.js']},
    'stats':   {'css': ['css/stats.css'],  'js': ['js/stats.js']},
    'teacher': {'css': ['css/teacher.css'], 'js': ['js/teacher.js']},
}

def sha(data):
    return hashlib.sha256(data if isinstance(data, bytes) else data.encode('utf-8')).hexdigest()

def expand(patterns):
    out = []
    for p in patterns:
        hits = sorted(glob.glob(os.path.join(ROOT, p)))
        if not hits:
            sys.exit('[build] 找不到檔案：' + p)
        out += [os.path.relpath(h, ROOT).replace(os.sep, '/') for h in hits]
    return out

def tag(rel, kind):
    v = sha(open(os.path.join(ROOT, rel), 'rb').read())[:10]
    url = SITE + rel + '?v=' + v
    return ('<link rel="stylesheet" href="%s">' % url) if kind == 'css' else ('<script src="%s"></script>' % url)

def check_js(files):
    node = shutil.which('node')
    if not node:
        print('[build] 沒有 Node.js，略過語法檢查')
        return
    bad = []
    for rel in files:
        r = subprocess.run([node, '--check', os.path.join(ROOT, rel)], capture_output=True, text=True)
        if r.returncode:
            bad.append(rel + '\n' + r.stderr.strip())
    if bad:
        sys.exit('[build] 語法錯誤：\n' + '\n\n'.join(bad))

def main():
    pages = {}
    all_js = []
    os.makedirs(os.path.join(ROOT, 'pages'), exist_ok=True)
    for name, spec in PAGES.items():
        src = open(os.path.join(ROOT, 'src', name + '.html'), encoding='utf-8').read()
        css, js = expand(spec['css']), expand(spec['js'])
        all_js += js
        for marker in ('<!--@STYLES-->', '<!--@SCRIPTS-->'):
            if src.count(marker) != 1:
                sys.exit('[build] src/%s.html 必須剛好有一個 %s' % (name, marker))
        html = (src.replace('<!--@STYLES-->', '\n'.join(tag(f, 'css') for f in css))
                   .replace('<!--@SCRIPTS-->', '\n'.join(tag(f, 'js') for f in js)))
        html = html.replace('<!-- 畫面樣板：tools/build.py 會把 @STYLES／@SCRIPTS 換成實際的檔案清單，輸出到 pages/。請改這裡，不要直接改 pages/。 -->',
                            '<!-- 由 tools/build.py 從 src/%s.html 產生，請勿直接修改。程式與素材在 GitHub，由 Google Apps Script 提供給學生。 -->' % name)
        out = os.path.join(ROOT, 'pages', name + '.html')
        open(out, 'w', encoding='utf-8').write(html)
        data = open(out, 'rb').read()
        pages[name] = {'file': 'pages/%s.html' % name, 'sha256': sha(data), 'bytes': len(data),
                       'css': len(css), 'js': len(js)}
    check_js(sorted(set(all_js)))
    release = 'r' + time.strftime('%Y%m%d') + '-' + sha(json.dumps(pages, sort_keys=True))[:8]
    images = len(glob.glob(os.path.join(ROOT, 'assets/img/*.webp')))
    music = len(glob.glob(os.path.join(ROOT, 'assets/bgm/*.m4a')))
    json.dump({'release': release, 'site': SITE, 'pages': pages, 'images': images, 'music': music},
              open(os.path.join(ROOT, 'release.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('[build] 完成 %s　%s' % (release, '、'.join('%s（%d css／%d js）' % (k, v['css'], v['js']) for k, v in pages.items())))
    print('[build] 推上 GitHub、等 1～2 分鐘後，在 Apps Script 執行 installGitHubFrontend 切換到這一版。')

if __name__ == '__main__':
    main()
