# -*- coding: utf-8 -*-
"""基线（nsfwjs + NudeNet 双模型）指标分析

Run: python scripts/eval_baseline_report.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

from eval_common import EVAL_DIR, precision_recall, auc_score

with open(os.path.join(EVAL_DIR, "baseline-dual-model.json"), encoding="utf-8") as f:
    data = json.load(f)

items = data["items"]
y = np.array([it["label"] for it in items])
nsfwjs = np.array([it.get("nsfwjsScore", 0.0) for it in items])
yolo_nsfw = np.array([it.get("yoloMaxNsfw", 0.0) for it in items])
yolo_sexy = np.array([it.get("yoloMaxSexy", 0.0) for it in items])
yolo_max = np.maximum(yolo_nsfw, yolo_sexy)

print(f"样本: {len(items)}（nsfw {y.sum()} / sfw {(1-y).sum()}）")

for name, s in [
    ("nsfwjs-InceptionV3 (P+H+S)", nsfwjs),
    ("NudeNet-v3 max(各类置信度)", yolo_max),
    ("组合分数 max(nsfwjs, yolo)", np.maximum(nsfwjs, yolo_max)),
]:
    a = auc_score(y, s)
    best_f1, best_thr = -1, 0.5
    for thr in np.arange(0.01, 1.0, 0.01):
        _, _, f1 = precision_recall(y, s, thr)
        if f1 > best_f1:
            best_f1, best_thr = f1, thr
    p, r, f1 = precision_recall(y, s, best_thr)
    print(f"\n=== {name} ===")
    print(f"AUC: {a:.4f}   最优F1阈值{best_thr:.2f}: P={p:.3f} R={r:.3f} F1={f1:.3f}")
    for thr in [0.3, 0.45, 0.6]:
        pp, rr, ff = precision_recall(y, s, thr)
        print(f"  thr={thr:.2f}: P={pp:.3f} R={rr:.3f} F1={ff:.3f}")

# 应用现行逻辑：nsfwjs>=0.45 或 yolo命中(conf>=0.55)
app_pred = (nsfwjs >= 0.45) | (yolo_max >= 0.55)
tp = int(((app_pred == 1) & (y == 1)).sum())
fp = int(((app_pred == 1) & (y == 0)).sum())
fn = int(((app_pred == 0) & (y == 1)).sum())
print("\n=== 应用现行判定逻辑（nsfwjs>=0.45 OR yolo命中） ===")
print(f"P={tp/(tp+fp):.3f}  R={tp/(tp+fn):.3f}  F1={2*tp/(2*tp+fp+fn):.3f}   (TP={tp} FP={fp} FN={fn})")
