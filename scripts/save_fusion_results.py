"""把融合结果（几何平均/中位数）生成正式评测结果文件"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))

from eval_common import EVAL_DIR, load_items, report  # noqa: E402

rows = json.load(open(os.path.join(EVAL_DIR, "Gemma4-ensemble-prior3-progress.json"), encoding="utf-8"))
# rows: [{id, score, label, parts:[prior_contrast, contrast_cases, factual]}]

by_id = {it["id"]: it for it in load_items()}
items = [by_id[r["id"]] for r in rows]

for name, fn in {
    "geo3": lambda ps: math.exp(sum(math.log(max(p, 1e-9)) for p in ps) / len(ps)),
    "median3": lambda ps: sorted(ps)[1],
}.items():
    scores = [fn(r["parts"]) for r in rows]
    report(f"Gemma4-ensemble-prior3-{name}", items, scores,
           extra={"fuse": name, "variants": ["prior_contrast", "contrast_cases", "factual"]})
    print(f"[OK] {name} 结果已保存")
