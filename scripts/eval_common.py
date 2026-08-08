# -*- coding: utf-8 -*-
"""NSFW 模型评测公共模块：数据集加载、指标计算、结果保存"""
import glob
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(ROOT, "datasets", "nsfw-labeled")
EVAL_DIR = os.path.join(DATASET_DIR, "eval")
MODELSCOPE_CACHE = os.environ.get("MODELSCOPE_CACHE", r"F:\models\modelscope")


def load_items():
    """返回 [{id, label(0=sfw/1=nsfw), path}]，label 二值化：nsfw=1"""
    with open(os.path.join(DATASET_DIR, "manifest.json"), encoding="utf-8") as f:
        m = json.load(f)
    items = []
    for it in m["items"]:
        items.append(
            {
                "id": it["id"],
                "label": 1 if it["label"] == "nsfw" else 0,
                "path": os.path.join(DATASET_DIR, it["datasetPath"].replace("/", os.sep)),
            }
        )
    return items


def find_model_dir(repo_name):
    """在 ModelScope 缓存中查找模型目录（含 config.json 的目录）"""
    for p in glob.glob(os.path.join(MODELSCOPE_CACHE, "**", repo_name), recursive=True):
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "config.json")):
            return p
    # modelscope 目录名可能被改写（. → _ 或 ___，org 大小写变化），用通配符兜底
    base = repo_name.split("/")[-1].replace(".", "*")
    for p in glob.glob(os.path.join(MODELSCOPE_CACHE, "**", base), recursive=True):
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "config.json")):
            return p
    raise FileNotFoundError(f"未找到模型目录: {repo_name}（cache={MODELSCOPE_CACHE}）")


def precision_recall(y_true, scores, thr):
    y_true = np.asarray(y_true)
    pred = (np.asarray(scores) >= thr).astype(int)
    tp = int(((pred == 1) & (y_true == 1)).sum())
    fp = int(((pred == 1) & (y_true == 0)).sum())
    fn = int(((pred == 0) & (y_true == 1)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def auc_score(y_true, scores):
    y_true = np.asarray(y_true)
    scores = np.asarray(scores, dtype=float)
    pos = scores[y_true == 1]
    neg = scores[y_true == 0]
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    # rank-based AUC (Mann-Whitney U)
    order = np.argsort(scores)
    ranks = np.empty(len(scores))
    ranks[order] = np.arange(1, len(scores) + 1)
    # 处理并列：取平均 rank
    sorted_scores = scores[order]
    i = 0
    while i < len(sorted_scores):
        j = i
        while j + 1 < len(sorted_scores) and sorted_scores[j + 1] == sorted_scores[i]:
            j += 1
        if j > i:
            avg = (ranks[order[i : j + 1]]).mean()
            ranks[order[i : j + 1]] = avg
        i = j + 1
    n_pos, n_neg = len(pos), len(neg)
    return float((ranks[y_true == 1].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def report(model_name, items, scores, extra=None):
    """打印指标表并保存 JSON 结果，返回 (best_f1, best_thr, auc)"""
    y_true = [it["label"] for it in items]
    a = auc_score(y_true, scores)

    # 阈值扫描找最优 F1
    best_f1, best_thr = -1.0, 0.5
    for thr in np.arange(0.01, 1.0, 0.01):
        _, _, f1 = precision_recall(y_true, scores, thr)
        if f1 > best_f1:
            best_f1, best_thr = f1, float(thr)

    p, r, f1 = precision_recall(y_true, scores, best_thr)
    print(f"\n=== {model_name} ===")
    print(f"样本: {len(items)}（nsfw {sum(y_true)} / sfw {len(items)-sum(y_true)}）")
    print(f"AUC: {a:.4f}")
    print(f"最优F1阈值 {best_thr:.2f}:  P={p:.3f}  R={r:.3f}  F1={f1:.3f}")
    print("阈值扫描（P/R/F1）:")
    for thr in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:
        pp, rr, ff = precision_recall(y_true, scores, thr)
        mark = "  <-- bestF1" if abs(thr - best_thr) < 0.005 else ""
        print(f"  thr={thr:.1f}: P={pp:.3f} R={rr:.3f} F1={ff:.3f}{mark}")

    os.makedirs(EVAL_DIR, exist_ok=True)
    out = {
        "model": model_name,
        "auc": a,
        "bestF1": {"threshold": best_thr, "precision": p, "recall": r, "f1": f1},
        "items": [
            {"id": it["id"], "label": it["label"], "score": float(s), "path": it["path"]}
            for it, s in zip(items, scores)
        ],
    }
    if extra:
        out["extra"] = extra
    out_path = os.path.join(EVAL_DIR, f"{model_name.replace('/', '_').replace(' ', '_')}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"结果已保存 -> {out_path}")
    return best_f1, best_thr, a
