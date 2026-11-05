#!/usr/bin/env python3
"""把 src/mt-antinarrow.js 同步进 dist 的自包含脚本 JSON，并校验 CDN 加载器版。

约定：dist JSON 为 4 空格缩进、非 ASCII 原样、CRLF、无尾换行；content 字段
存 src 的 LF 归一化文本（src 磁盘上是 CRLF，嵌入时统一为 LF）。

用法：python scripts/sync-dist.py [--check]
  --check  只核对不写入：dist content 是否与 src 一致、CDN 加载器 import 行是否有效
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'mt-antinarrow.js'
DIST_BUNDLED = ROOT / 'dist' / '酒馆助手脚本-防窄化沉浸全宽.json'
DIST_CDN = ROOT / 'dist' / '酒馆助手脚本-防窄化沉浸全宽-CDN加载器.json'
CDN_URL = 'https://cdn.jsdelivr.net/gh/Civinar-Riley/SillyTavern-AntiNarrow@1/src/mt-antinarrow.js'


def dump(data):
    return json.dumps(data, ensure_ascii=False, indent=4).replace('\n', '\r\n')


def load(path):
    raw = path.read_text(encoding='utf-8', newline='')
    data = json.loads(raw)
    if dump(data) != raw:
        # 未改动的数据无法逐字节还原，说明格式假设失效——报错而不是悄悄重排整个文件
        sys.exit(f'格式校验失败：{path.name} 与当前写入参数不一致，请先人工核对文件格式')
    return data


def main():
    check_only = '--check' in sys.argv[1:]
    src = SRC.read_text(encoding='utf-8')  # universal newlines：磁盘 CRLF 归一为 LF

    bundled = load(DIST_BUNDLED)
    if bundled['content'] == src:
        print(f'自包含版已是最新（{len(src)} 字符）')
    elif check_only:
        sys.exit('自包含版 content 与 src 不一致：请运行 python scripts/sync-dist.py')
    else:
        bundled['content'] = src
        DIST_BUNDLED.write_bytes(dump(bundled).encode('utf-8'))
        print(f'自包含版 content 已更新为 src（{len(src)} 字符）')

    cdn = load(DIST_CDN)
    if cdn['content'].strip() != "import '" + CDN_URL + "';":
        sys.exit(f'CDN 加载器 content 不是预期的单行 import（应为 {CDN_URL}）')
    print('CDN 加载器 import 行有效')


if __name__ == '__main__':
    main()
