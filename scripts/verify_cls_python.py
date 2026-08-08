# -*- coding: utf-8 -*-
"""Python 侧：用 PIL 预处理跑最终 ONNX，输出指定样本分数（与 verify_cls_app.mjs 对照）"""
import json
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image

ONNX_PATH = r"datasets/nsfw-labeled/nsfw-cls-yolo11s.onnx"
SIZE = 224

# 与 verify_cls_app.mjs 相同的样本
CASES = [
    r"datasets/nsfw-labeled/nsfw/a4a835f0_zzgnt5071490451002.jpg",
    r"datasets/nsfw-labeled/nsfw/f3a838d7_zzgnt81435271.jpg",
    r"datasets/nsfw-labeled/nsfw/d6afc233_pntre02526007.jpg",
    r"datasets/nsfw-labeled/sfw/6348eb06_zzgnt2735183628002.jpg",
    r"datasets/nsfw-labeled/sfw/d20fe27a_zzgnt2735183628003.jpg",
]


def preprocess(img):
    """与 verify_onnx.py 一致：短边缩放+中心裁剪，[0,1]"""
    w, h = img.size
    scale = SIZE / min(w, h)
    img = img.resize((round(w * scale), round(h * scale)), Image.BILINEAR)
    w, h = img.size
    left, top = (w - SIZE) // 2, (h - SIZE) // 2
    img = img.crop((left, top, left + SIZE, top + SIZE))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr.transpose(2, 0, 1)[None]


def main():
    sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
    in_name = sess.get_inputs()[0].name
    out = sess.get_outputs()[0]
    for p in CASES:
        if not os.path.exists(p):
            print(f"SKIP {p}")
            continue
        img = Image.open(p).convert("RGB")
        x = preprocess(img)
        probs = sess.run([out.name], {in_name: x})[0][0]
        print(f"{os.path.basename(p)}: nsfw={probs[0]:.4f} sfw={probs[1]:.4f}")


if __name__ == "__main__":
    main()
