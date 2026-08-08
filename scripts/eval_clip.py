# -*- coding: utf-8 -*-
"""CLIP 零样本 NSFW 评测（prompt ensemble）

Run: python scripts/eval_clip.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

from eval_common import load_items, find_model_dir, report

# 正类（NSFW）：走光/内衣可见/裸露/性行为
NSFW_PROMPTS = [
    "a photo showing visible underwear or panties",
    "an upskirt photo, underwear visible under skirt",
    "a nude photo with exposed body",
    "a photo of nudity, exposed breasts or genitalia",
    "explicit sexual content",
    "a sexually explicit photo",
]
# 负类（safe）：正常穿衣的日常照片（含腿部/裙子但未走光）
SFW_PROMPTS = [
    "a normal safe photo of a clothed person",
    "a photo of a girl wearing a skirt, no underwear visible",
    "an everyday street photo of people in clothing",
    "a photo of legs in stockings, not explicit",
    "a wholesome non-explicit photo",
]

BATCH = 32


def main():
    model_dir = find_model_dir("clip-vit-large-patch14")
    print(f"模型目录: {model_dir}")

    processor = CLIPProcessor.from_pretrained(model_dir)
    model = CLIPModel.from_pretrained(model_dir).to("cuda").eval()

    with torch.inference_mode():
        text = processor(text=NSFW_PROMPTS + SFW_PROMPTS, return_tensors="pt", padding=True).to("cuda")
        text_out = model.text_model(**{k: v for k, v in text.items() if k in ("input_ids", "attention_mask")})
        text_embeds = model.text_projection(text_out.pooler_output)
        text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)
    n_pos = len(NSFW_PROMPTS)

    items = load_items()
    scores = []
    with torch.inference_mode():
        for i in range(0, len(items), BATCH):
            batch = items[i : i + BATCH]
            imgs = [Image.open(it["path"]).convert("RGB") for it in batch]
            inputs = processor(images=imgs, return_tensors="pt").to("cuda")
            vis_out = model.vision_model(pixel_values=inputs["pixel_values"])
            img_embeds = model.visual_projection(vis_out.pooler_output)
            img_embeds = img_embeds / img_embeds.norm(dim=-1, keepdim=True)
            sim = (img_embeds @ text_embeds.T) * model.logit_scale.exp()
            pos = sim[:, :n_pos].mean(dim=-1)
            neg = sim[:, n_pos:].mean(dim=-1)
            p = torch.softmax(torch.stack([neg, pos], dim=-1), dim=-1)[:, 1]
            scores.extend(p.cpu().tolist())
            print(f"  {min(i+BATCH, len(items))}/{len(items)}", flush=True)

    report(
        "CLIP-ViT-L-zero-shot",
        items,
        scores,
        extra={"nsfw_prompts": NSFW_PROMPTS, "sfw_prompts": SFW_PROMPTS},
    )


if __name__ == "__main__":
    main()
