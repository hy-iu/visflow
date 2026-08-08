# -*- coding: utf-8 -*-
"""汇总所有评测结果生成详细数据表（Markdown）"""
import glob
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from eval_common import EVAL_DIR, auc_score  # noqa: E402

MODEL_NOTES = {
    "CLIP-ViT-L-linear-probe-CV": "CLIP ViT-L 线性探针（5折CV out-of-fold）",
    "CLIP-ViT-L-zero-shot": "CLIP ViT-L 零样本",
    "YOLO11s-cls-5fold-CV": "YOLO11s-cls 微调（5折CV out-of-fold）",
    "YOLO11s-cls-final-ONNX": "YOLO11s-cls 最终ONNX（全量训练自评,参考）",
    "Falconsai-ViT": "Falconsai ViT（审查专用,零样本）",
    "Qwen2.5-VL-3B-zero-shot": "Qwen2.5-VL-3B 零样本",
    "baseline-dual-model": "现行基线 nsfwjs+NudeNet 双模型",
    "Gemma4-E4B-brief-subset100": "Gemma4 原版 brief（子集100）",
    "Gemma4-E4B-detailed-subset100": "Gemma4 原版 detailed（子集100）",
    "Gemma4-E4B-detailed_en-subset100": "Gemma4 原版 detailed_en（子集100）",
    "Gemma4-E4B-moderator-subset100": "Gemma4 原版 moderator（子集100）",
    "Gemma4-E4B-factual-subset100": "Gemma4 原版 factual（子集100）",
    "Gemma4-E4B-upskirt_focus-subset100": "Gemma4 原版 upskirt_focus（子集100）",
    "Gemma4-nsfw-detailed-subset60": "Gemma4 原版 detailed（子集60）",
    "Gemma4-nsfw-contrast_cases-subset60": "Gemma4 原版 contrast_cases（子集60）",
    "Gemma4-nsfw-prior_contrast-subset60": "Gemma4 原版 prior_contrast（子集60）",
    "Gemma4-nsfw-prior_contrast": "Gemma4 原版 prior_contrast（全量500）",
    "Gemma4-ensemble-prior3-subset60": "Gemma4 ensemble prior3 均值（子集60）",
    "Gemma4-ensemble-prior3": "Gemma4 ensemble prior3 均值（全量500）",
    "Gemma4-ensemble-prior3-geo3": "Gemma4 ensemble prior3 几何平均（全量500）",
    "Gemma4-ensemble-prior3-median3": "Gemma4 ensemble prior3 中位数（全量500）",
    "Gemma4-ensemble-prior4-subset60": "Gemma4 ensemble prior4 均值（子集60）",
    "Gemma4-ensemble-top3-subset60": "Gemma4 ensemble top3 均值（子集60）",
    "Gemma4-nsfw-hybrid-subset60": "Gemma4 原版 hybrid（子集60）",
    "Gemma4-nsfw-exposure_question-subset60": "Gemma4 原版 exposure_question（子集60）",
    "Gemma4-nsfw-yesno_direct-subset60": "Gemma4 原版 yesno_direct（子集60）",
    "Gemma4-nsfw-cn_exposure-subset60": "Gemma4 原版 cn_exposure（子集60）",
    "Gemma4-nsfw-prior_note-subset60": "Gemma4 原版 prior_note（子集60）",
    "Gemma4-nsfw-detailed-llamacpp-logprob-subset60": "Gemma4 heretic logprob（子集60）",
    "Gemma4-nsfw-detailed-llamacpp-gen-subset60": "Gemma4 heretic 生成式（子集60）",
}


def scan_thresholds(labels, scores, step=0.05):
    """返回 [{threshold, precision, recall, f1}]"""
    out = []
    for t in [i * step for i in range(1, 20)]:
        tp = fp = fn = 0
        for l, s in zip(labels, scores):
            if s >= t:
                if l == 1:
                    tp += 1
                else:
                    fp += 1
            elif l == 1:
                fn += 1
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * p * r / (p + r) if p + r else 0.0
        out.append({"threshold": round(t, 2), "precision": p, "recall": r, "f1": f1})
    return out


def best_f1_from_scan(scan):
    return max(scan, key=lambda s: s["f1"])


rows = []
for path in glob.glob(os.path.join(EVAL_DIR, "*.json")):
    fn = os.path.basename(path)
    if "progress" in fn:
        continue
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        continue
    items = d.get("items") or []
    labels = [it.get("label", 0) for it in items]
    key = d.get("model") or fn[:-5]

    # baseline 用 nsfwjsScore 当 score 参与排序（AUC 供参考），判定仍以 threshold 为准
    if "nsfwjsScore" in (items[0] if items else {}):
        scores = [it.get("nsfwjsScore", 0) for it in items]
    else:
        scores = [it.get("score", 0) for it in items]

    auc = None
    if scores and any(s is not None for s in scores):
        try:
            auc = auc_score(labels, scores)
        except Exception:
            auc = None

    scan = scan_thresholds(labels, scores) if scores else []
    best = best_f1_from_scan(scan) if scan else {}
    # 优先用原始 JSON 的精确 bestF1（0.01 步长），否则用重算的扫描值
    bf = d.get("bestF1") or {}
    if bf.get("f1") is not None:
        best = {"threshold": bf.get("threshold", 0), "precision": bf.get("precision", 0),
                "recall": bf.get("recall", 0), "f1": bf.get("f1", 0)}
    # baseline 固定阈值模型：P/R/F1 按固定阈值计算，不参与扫描
    fixed = None
    if "nsfwjsScore" in (items[0] if items else {}) and d.get("threshold") is not None:
        thr = d["threshold"]
        tp = fp = fn = 0
        for it in items:
            pred = 1 if it.get("nsfwjsScore", 0) >= thr else 0
            if pred == 1 and it["label"] == 1:
                tp += 1
            elif pred == 1:
                fp += 1
            elif it["label"] == 1:
                fn += 1
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        fixed = {"threshold": thr, "precision": p, "recall": r,
                 "f1": 2 * p * r / (p + r) if p + r else 0.0}
    rows.append(
        {
            "key": key,
            "fn": fn,
            "n": len(items),
            "auc": auc,
            "scan": scan,
            "best": best,
            "fixed": fixed,
            "threshold": d.get("threshold"),
            "is_baseline": "nsfwjsScore" in (items[0] if items else {}),
        }
    )

rows.sort(key=lambda r: (r["auc"] if r["auc"] is not None else -1), reverse=True)

lines = []
lines.append("# NSFW 模型评测详细数据表")
lines.append("")
lines.append("数据集：500 张（nsfw 300 / sfw 200），真人街拍走光/内衣可见为主")
lines.append("")
lines.append("| 排名 | 模型 | 说明 | 样本 | AUC | bestF1 阈值 | P | R | F1 |")
lines.append("|---|---|---|---|---|---|---|---|---|")
for i, r in enumerate(rows, 1):
    note = MODEL_NOTES.get(r["key"]) or r["key"]
    b = r["fixed"] if r["is_baseline"] else r["best"]
    auc = f"{r['auc']:.4f}" if r["auc"] is not None else "-"
    if r["is_baseline"]:
        auc = "-"  # 双模型无排序分数，AUC 无意义
    thr = f"{b.get('threshold', 0):.2f}" if b else "-"
    p = f"{b.get('precision', 0):.3f}" if b else "-"
    rr = f"{b.get('recall', 0):.3f}" if b else "-"
    f1 = f"{b.get('f1', 0):.3f}" if b else "-"
    if r["key"].startswith("YOLO11s-cls-final"):
        note = note + "（⚠ 训练集自评，不具参考性）"
    lines.append(f"| {i} | {r['key']} | {note} | {r['n']} | {auc} | {thr} | {p} | {rr} | {f1} |")

lines.append("")
lines.append("## 重点模型阈值扫描明细（P/R/F1）")
lines.append("")
KEY_SCANS = [
    "CLIP-ViT-L-linear-probe-CV",
    "Gemma4-ensemble-prior3-geo3",
    "YOLO11s-cls-5fold-CV",
    "Gemma4-ensemble-prior3-median3",
    "Gemma4-nsfw-prior_contrast",
    "baseline-dual-model",
]
for r in rows:
    if r["key"] not in KEY_SCANS or not r["scan"]:
        continue
    b = r["fixed"] if r["is_baseline"] else r["best"]
    head = f"### {MODEL_NOTES.get(r['key'], r['key'])}"
    if r["auc"] is not None:
        head += f"（AUC {r['auc']:.4f}）"
    if b:
        head += f"  bestF1={b['f1']:.3f} @thr={b['threshold']:.2f}（P={b['precision']:.3f} R={b['recall']:.3f}）"
    lines.append(head)
    lines.append("")
    if r["is_baseline"]:
        lines.append("（固定阈值模型，无阈值扫描）")
        lines.append("")
        continue
    lines.append("| 阈值 | P | R | F1 |")
    lines.append("|---|---|---|---|")
    for s in r["scan"]:
        lines.append(f"| {s['threshold']:.2f} | {s['precision']:.3f} | {s['recall']:.3f} | {s['f1']:.3f} |")
    lines.append("")

out = os.path.join(EVAL_DIR, "SUMMARY.md")
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"[OK] 已保存 -> {out}（{len(rows)} 个结果）")
