import json
import math

from eval_common import auc_score

rows = json.load(open(r"datasets/nsfw-labeled/eval/Gemma4-ensemble-prior3-progress.json", encoding="utf-8"))
print(f"样本数: {len(rows)}")
# rows: [{id, score, label, parts:[prior_contrast, contrast_cases, factual]}]

labels = [r["label"] for r in rows]


def best_f1(labels_, scores):
    best = None
    for thr in [i / 100 for i in range(0, 101)]:
        preds = [1 if s >= thr else 0 for s in scores]
        tp = sum(1 for l, p in zip(labels_, preds) if l == 1 and p == 1)
        fp = sum(1 for l, p in zip(labels_, preds) if l == 0 and p == 1)
        fn = sum(1 for l, p in zip(labels_, preds) if l == 1 and p == 0)
        p = tp / (tp + fp) if tp + fp else 0
        r = tp / (tp + fn) if tp + fn else 0
        f1 = 2 * p * r / (p + r) if p + r else 0
        if best is None or f1 > best[3]:
            best = (thr, p, r, f1)
    return best


fusions = {
    "mean3": lambda ps: sum(ps) / len(ps),
    "geo3": lambda ps: math.exp(sum(math.log(max(p, 1e-9)) for p in ps) / len(ps)),
    "max3": lambda ps: max(ps),
    "min3": lambda ps: min(ps),
    "w2_1_1": lambda ps: (2 * ps[0] + ps[1] + ps[2]) / 4,
    "w1_2_1": lambda ps: (ps[0] + 2 * ps[1] + ps[2]) / 4,
    "w3_1_1": lambda ps: (3 * ps[0] + ps[1] + ps[2]) / 5,
    "median3": lambda ps: sorted(ps)[1],
    "logit_mean": lambda ps: 1 / (1 + math.exp(-sum(math.log(max(p, 1e-9) / max(1 - p, 1e-9)) for p in ps) / len(ps))),
}

print(f"{'融合方式':<10} {'AUC':>8} {'bestF1':>8}  P/R@thr")
for name, fn in fusions.items():
    scores = [fn(r["parts"]) for r in rows]
    auc = auc_score(labels, scores)
    thr, p, r, f1 = best_f1(labels, scores)
    print(f"{name:<10} {auc:8.4f} {f1:8.4f}  P={p:.3f} R={r:.3f} @thr={thr}")

# 单变体对照
for i, v in enumerate(["prior_contrast", "contrast_cases", "factual"]):
    scores = [r["parts"][i] for r in rows]
    auc = auc_score(labels, scores)
    thr, p, r, f1 = best_f1(labels, scores)
    print(f"{v:<10} {auc:8.4f} {f1:8.4f}  P={p:.3f} R={r:.3f} @thr={thr}")
