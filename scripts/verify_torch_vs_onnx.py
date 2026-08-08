# -*- coding: utf-8 -*-
"""验证 torch(best.pt) 与 ONNX 推理输出一致性（同一 float32 输入）"""
import numpy as np
import onnxruntime as ort
import torch
from ultralytics import YOLO

rng = np.random.default_rng(42)
x = rng.random((1, 3, 224, 224), dtype=np.float32)  # [0,1] 输入

# ONNX
sess = ort.InferenceSession(r"datasets\nsfw-labeled\nsfw-cls-yolo11s.onnx", providers=["CPUExecutionProvider"])
onnx_out = sess.run([sess.get_outputs()[0].name], {sess.get_inputs()[0].name: x})[0][0]
print("ONNX  :", onnx_out)

# torch (best.pt)，模型内置归一化，直接 forward
m = YOLO(r"datasets\nsfw-labeled\runs\final\weights\best.pt")
m.model.eval()
with torch.no_grad():
    logits = m.model(torch.from_numpy(x))  # ClassificationModel.forward
    torch_out = torch.softmax(logits, dim=1)[0].numpy()
print("torch :", torch_out)
print("max diff:", float(np.abs(onnx_out - torch_out).max()))
