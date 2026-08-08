# -*- coding: utf-8 -*-
"""列出 ModelScope 仓库文件清单"""
import json
import sys
import urllib.request

repo = sys.argv[1] if len(sys.argv) > 1 else "unsloth/gemma-4-E4B-it-GGUF"
url = f"https://modelscope.cn/api/v1/models/{repo}/repo/files?Recursive=true"
data = json.load(urllib.request.urlopen(url, timeout=30))
files = data["Data"]["Files"]
for f in files:
    if f["Type"] == "blob":
        mb = f["Size"] / 1e6
        print(f"{mb:9.1f} MB  {f['Path']}")
