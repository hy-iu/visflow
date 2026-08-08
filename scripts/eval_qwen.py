# -*- coding: utf-8 -*-
"""Qwen2.5-VL-3B 零样本 NSFW 评测

按用户的标记口径给出指令（走光/内衣可见/裸露/性行为=NSFW），
取首 token 在 Yes/No 上的 softmax 概率作为 NSFW 分数。

Run: python scripts/eval_qwen.py
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForImageTextToText

from eval_common import load_items, find_model_dir, report

PROMPT = (
    "请判断这张图片是否属于NSFW内容。\n"
    "NSFW的定义：可以看到内衣、内裤、臀部走光（如裙底、内裤外露），或者有裸露、性行为画面。\n"
    "注意：穿着裙子或短裤但没有走光的正常日常照片不算NSFW。\n"
    "只回答一个词：Yes 或 No。"
)


def main():
    model_dir = find_model_dir("Qwen2.5-VL-3B-Instruct")
    print(f"模型目录: {model_dir}")

    processor = AutoProcessor.from_pretrained(model_dir)
    model = (
        AutoModelForImageTextToText.from_pretrained(
            model_dir, torch_dtype=torch.bfloat16, attn_implementation="sdpa"
        )
        .to("cuda")
        .eval()
    )

    tok = processor.tokenizer
    yes_ids = [t for w in ["Yes", " yes", "YES", "Yes."] for t in tok.encode(w, add_special_tokens=False)]
    no_ids = [t for w in ["No", " no", "NO", "No."] for t in tok.encode(w, add_special_tokens=False)]
    print("Yes token ids:", yes_ids, "No token ids:", no_ids)

    messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": PROMPT}]}]
    text_tpl = processor.apply_chat_template(messages, add_generation_prompt=True)

    items = load_items()
    # 支持断点续跑：读取已保存的中间结果
    import os as _os
    from eval_common import EVAL_DIR as _EVAL_DIR
    cache_path = _os.path.join(_EVAL_DIR, "qwen-progress.json")
    done = {}
    if _os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            done = {r["id"]: r["score"] for r in json.load(f)}
        print(f"断点续跑：已有 {len(done)} 条结果")

    scores = []
    with torch.inference_mode():
        for n, it in enumerate(items):
            if it["id"] in done:
                scores.append(done[it["id"]])
                continue
            img = Image.open(it["path"]).convert("RGB")
            # 限制最长边，避免超大图产生海量 vision token 导致卡死
            img.thumbnail((1280, 1280))
            inputs = processor(text=[text_tpl], images=[img], return_tensors="pt", padding=True).to("cuda")
            out = model.generate(**inputs, max_new_tokens=1, output_scores=True, return_dict_in_generate=True)
            logits = out.scores[0][0]
            yes = logits[yes_ids].max().float()
            no = logits[no_ids].max().float()
            p = torch.softmax(torch.stack([no, yes]), dim=-1)[1].item()
            scores.append(p)
            done[it["id"]] = p
            if (n + 1) % 25 == 0:
                os.makedirs(_EVAL_DIR, exist_ok=True)
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump([{"id": k, "score": v} for k, v in done.items()], f)
                print(f"  {n+1}/{len(items)}", flush=True)

    report("Qwen2.5-VL-3B-zero-shot", items, scores)


if __name__ == "__main__":
    main()
