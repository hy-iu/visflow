# -*- coding: utf-8 -*-
"""Gemma-4-E4B prompt ensemble 评测：同一张图多个 prompt 各取 logprob 分数后融合

Run:
python scripts/eval_gemma_ensemble.py --subset 60
"""
import argparse
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from eval_common import EVAL_DIR, load_items, report  # noqa: E402
from eval_gemma import PROMPTS, chat, score_from_resp, set_model  # noqa: E402

VARIANT_GROUPS = {
    "top3": ["detailed", "contrast_cases", "factual"],
    "top4": ["detailed", "contrast_cases", "factual", "moderator"],
    "prior3": ["prior_contrast", "contrast_cases", "factual"],
    "prior4": ["prior_contrast", "contrast_cases", "factual", "detailed"],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", default="top3", choices=list(VARIANT_GROUPS))
    ap.add_argument("--subset", type=int, default=0, help="分层抽样子集大小（0=全量）")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--workers", type=int, default=1, help="并发请求数（拉高 GPU 利用率）")
    args = ap.parse_args()

    variants = VARIANT_GROUPS[args.group]
    set_model("gemma4-e4b-nsfw")

    items = load_items()
    if args.subset:
        pos = [it for it in items if it["label"] == 1]
        neg = [it for it in items if it["label"] == 0]
        random.Random(args.seed).shuffle(pos)
        random.Random(args.seed).shuffle(neg)
        n_pos = round(args.subset * len(pos) / len(items))
        items = pos[:n_pos] + neg[: args.subset - n_pos]
        print(f"子集评测: {len(items)} 张（nsfw {n_pos} / sfw {len(items)-n_pos}）")

    name = f"Gemma4-ensemble-{args.group}" + (f"-subset{args.subset}" if args.subset else "")
    cache_path = os.path.join(EVAL_DIR, f"{name}-progress.json")
    os.makedirs(EVAL_DIR, exist_ok=True)
    done = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            done = {r["id"]: r for r in json.load(f)}
        print(f"断点续跑：已有 {len(done)} 条")

    scores, errs = [], 0

    def run_one(it):
        """worker：单张图多个变体评分后取平均，内部已捕获异常"""
        parts = []
        try:
            for v in variants:
                resp = chat(it["path"], PROMPTS[v])
                p, _, _ = score_from_resp(resp)
                if p is None:
                    raise ValueError(f"{v} 无法解析 Yes/No")
                parts.append(p)
        except Exception as e:
            print(f"  [!] 失败: {os.path.basename(it['path'])}: {e}", flush=True)
            return it, 0.5, []
        return it, sum(parts) / len(parts), parts  # 算术平均

    pending = [it for it in items if it["id"] not in done]
    for it in items:
        if it["id"] in done:
            scores.append(done[it["id"]]["score"])
    if pending:
        from concurrent.futures import ThreadPoolExecutor

        done_n = len(scores)
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
            for n, (it, p, parts) in enumerate(ex.map(run_one, pending), start=1):
                scores.append(p)
                done[it["id"]] = {"id": it["id"], "score": p, "label": it["label"], "parts": parts}
                if (done_n + n) % 10 == 0:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(list(done.values()), f)
                    print(f"  {done_n+n}/{len(items)}", flush=True)

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(list(done.values()), f)
    report(name, items, scores, extra={"group": args.group, "variants": variants, "errors": errs})


if __name__ == "__main__":
    main()
