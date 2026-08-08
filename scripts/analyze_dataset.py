# -*- coding: utf-8 -*-
"""分析数据集来源目录构成，判断内容类型分布"""
import json
import collections
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

d = json.load(open(r"datasets\nsfw-labeled\manifest.json", encoding="utf-8"))

for label in ("safe", "nsfw"):
    items = [i for i in d["items"] if i["label"] == label]
    dirs = collections.Counter()
    for i in items:
        p = i["sourcePath"].replace("/", "\\")
        parts = p.split("\\")
        # 盘符 + 前两级目录
        key = "\\".join(parts[:4]) if len(parts) >= 4 else p
        dirs[key] += 1
    print(f"== [{label}] {len(items)} 张，来源目录 Top25 ==")
    for k, v in dirs.most_common(25):
        print(f"  {v:4d}  {k}")
    print()
