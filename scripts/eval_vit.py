# -*- coding: utf-8 -*-
"""评测 Falconsai/nsfw_image_detection（ViT 二分类）

Run: python scripts/eval_vit.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
from PIL import Image
from transformers import ViTImageProcessor, ViTForImageClassification

from eval_common import load_items, find_model_dir, report

BATCH = 32


def main():
    model_dir = find_model_dir("nsfw_image_detection")
    print(f"模型目录: {model_dir}")

    processor = ViTImageProcessor.from_pretrained(model_dir)
    model = ViTForImageClassification.from_pretrained(model_dir).to("cuda").eval()
    id2label = model.config.id2label
    print("类别映射:", id2label)
    nsfw_idx = next(k for k, v in id2label.items() if v.lower() == "nsfw")

    items = load_items()
    scores = []
    with torch.inference_mode():
        for i in range(0, len(items), BATCH):
            batch = items[i : i + BATCH]
            imgs = [Image.open(it["path"]).convert("RGB") for it in batch]
            inputs = processor(images=imgs, return_tensors="pt").to("cuda")
            logits = model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)[:, nsfw_idx]
            scores.extend(probs.cpu().tolist())
            print(f"  {min(i+BATCH, len(items))}/{len(items)}", flush=True)

    report("Falconsai-ViT", items, scores)


if __name__ == "__main__":
    main()
