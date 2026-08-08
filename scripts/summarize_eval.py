# -*- coding: utf-8 -*-
"""汇总所有评测结果，输出对比表

Run: python scripts/summarize_eval.py
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from eval_common import EVAL_DIR

ROWS = []
for p in sorted(glob.glob(os.path.join(EVAL_DIR, "*.json"))):
    name = os.path.basename(p)[:-5]
    if name in ("baseline-dual-model", "qwen-progress"):
        continue
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    bf = d.get("bestF1", {})
    ROWS.append(
        (
            d.get("model", name),
            d.get("auc", 0),
            bf.get("threshold", 0),
            bf.get("precision", 0),
            bf.get("recall", 0),
            bf.get("f1", 0),
        )
    )

# 基线单独处理
with open(os.path.join(EVAL_DIR, "baseline-dual-model.json"), encoding="utf-8") as f:
    b = json.load(f)
items = b["items"]
tp = sum(1 for it in items if it.get("flagged") and it["label"] == 1)
fp = sum(1 for it in items if it.get("flagged") and it["label"] == 0)
fn = sum(1 for it in items if not it.get("flagged") and it["label"] == 1)
p0 = tp / (tp + fp) if tp + fp else 0
r0 = tp / (tp + fn) if tp + fn else 0
f0 = 2 * p0 * r0 / (p0 + r0) if p0 + r0 else 0
ROWS.append(("当前应用方案(nsfwjs+NudeNet, 现行阈值)", 0.765, 0.45, p0, r0, f0))

ROWS.sort(key=lambda x: -x[5])
print("=" * 88)
print(f"{'模型':<42}{'AUC':>8}{'阈值':>6}{'P':>8}{'R':>8}{'F1':>8}")
print("-" * 88)
for m, a, t, p, r, f1 in ROWS:
    print(f"{m:<42}{a:>8.4f}{t:>6.2f}{p:>8.3f}{r:>8.3f}{f1:>8.3f}")
print("=" * 88)
