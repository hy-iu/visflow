# -*- coding: utf-8 -*-
"""CLIP ViT-L 图像特征 + 逻辑回归线性探针（5折CV）

零样本 CLIP 已很强；探针进一步贴合用户标记口径。
Run: python scripts/finetune_clip_probe.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import torch
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from transformers import CLIPProcessor, CLIPModel

from eval_common import load_items, find_model_dir, report

BATCH = 32


def main():
    model_dir = find_model_dir("clip-vit-large-patch14")
    processor = CLIPProcessor.from_pretrained(model_dir)
    model = CLIPModel.from_pretrained(model_dir).to("cuda").eval()

    items = load_items()
    feats = []
    with torch.inference_mode():
        for i in range(0, len(items), BATCH):
            batch = items[i : i + BATCH]
            imgs = [Image.open(it["path"]).convert("RGB") for it in batch]
            inputs = processor(images=imgs, return_tensors="pt").to("cuda")
            vis_out = model.vision_model(pixel_values=inputs["pixel_values"])
            emb = model.visual_projection(vis_out.pooler_output)
            emb = emb / emb.norm(dim=-1, keepdim=True)
            feats.append(emb.cpu().float().numpy())
            if (i // BATCH) % 4 == 0:
                print(f"  特征提取 {min(i+BATCH, len(items))}/{len(items)}", flush=True)
    X = np.concatenate(feats, axis=0)
    y = np.array([it["label"] for it in items])

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = np.zeros(len(items))
    for k, (tr, va) in enumerate(skf.split(X, y)):
        clf = LogisticRegression(C=1.0, max_iter=2000)
        clf.fit(X[tr], y[tr])
        scores[va] = clf.predict_proba(X[va])[:, 1]
        print(f"  fold {k+1} acc={(clf.predict(X[va]) == y[va]).mean():.3f}", flush=True)

    report("CLIP-ViT-L-linear-probe-CV", items, scores)


if __name__ == "__main__":
    main()
