# -*- coding: utf-8 -*-
"""验证导出的 ONNX 分类模型（onnxruntime 推理，与应用侧运行方式一致）

Run: python scripts/verify_onnx.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import onnxruntime as ort
from PIL import Image

from eval_common import load_items, DATASET_DIR, report

ONNX_PATH = os.path.join(DATASET_DIR, "nsfw-cls-yolo11s.onnx")


def preprocess(img: Image.Image, size=224) -> np.ndarray:
    """导出的 ONNX 已内置 ImageNet 归一化，只需短边缩放+中心裁剪到 [0,1]"""
    w, h = img.size
    scale = size / min(w, h)
    img = img.resize((round(w * scale), round(h * scale)), Image.BILINEAR)
    w, h = img.size
    left, top = (w - size) // 2, (h - size) // 2
    img = img.crop((left, top, left + size, top + size))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr.transpose(2, 0, 1)[None]  # NCHW


def main():
    sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
    in_name = sess.get_inputs()[0].name
    out = sess.get_outputs()[0]
    print(f"输入: {sess.get_inputs()[0].name} {sess.get_inputs()[0].shape}")
    print(f"输出: {out.name} {out.shape}")

    items = load_items()
    scores = []
    for n, it in enumerate(items):
        img = Image.open(it["path"]).convert("RGB")
        x = preprocess(img)
        probs = sess.run([out.name], {in_name: x})[0][0]
        # ultralytics 分类类别按字母序：0=nsfw, 1=sfw
        scores.append(float(probs[0]))
        if (n + 1) % 100 == 0:
            print(f"  {n+1}/{len(items)}", flush=True)

    # 训练集内评估（仅验证 ONNX 导出正确性；泛化指标看 5折CV）
    report("YOLO11s-cls-final-ONNX(全量样本,参考)", items, scores)


if __name__ == "__main__":
    main()
