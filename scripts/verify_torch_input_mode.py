# -*- coding: utf-8 -*-
"""找出 torch best.pt forward 的正确输入约定（与 ONNX 输出对齐）"""
import numpy as np
import onnxruntime as ort
import torch
from ultralytics import YOLO

rng = np.random.default_rng(42)
x = rng.random((1, 3, 224, 224), dtype=np.float32)  # RGB [0,1]

sess = ort.InferenceSession(r"datasets\nsfw-labeled\nsfw-cls-yolo11s.onnx", providers=["CPUExecutionProvider"])
onnx_out = sess.run([sess.get_outputs()[0].name], {sess.get_inputs()[0].name: x})[0][0]
print("ONNX(RGB[0,1]):", onnx_out)

m = YOLO(r"datasets\nsfw-labeled\runs\final\weights\best.pt")
m.model.eval()

candidates = {
    "RGB[0,1]": x,
    "RGB[0,255]": x * 255,
    "BGR[0,1]": x[:, ::-1],
    "BGR[0,255]": x[:, ::-1] * 255,
}
with torch.no_grad():
    for name, arr in candidates.items():
        out = torch.softmax(m.model(torch.from_numpy(np.ascontiguousarray(arr))), dim=1)[0].numpy()
        diff = float(np.abs(onnx_out - out).max())
        print(f"torch {name:<12}: {out}  diff={diff:.6f}")
