# -*- coding: utf-8 -*-
"""测 onnxruntime CUDA 在不同 batch 下的每张耗时"""
import os
import site
import time

def add_dll_dirs():
    dirs = []
    for sp in site.getsitepackages():
        d = os.path.join(sp, "torch", "lib")
        if os.path.isdir(d) and any(f.startswith("cudnn64_9") for f in os.listdir(d)):
            dirs.append(d)
    for d in [r"F:\models\llama.cpp"]:
        if os.path.isdir(d):
            dirs.append(d)
    for d in dirs:
        try:
            os.add_dll_directory(d)
        except OSError:
            pass
    if dirs:
        os.environ["PATH"] = ";".join(dirs) + ";" + os.environ.get("PATH", "")

add_dll_dirs()

import numpy as np
import onnxruntime as ort

MODEL = r"models\nsfw-cls\nsfw-cls-yolo11s.onnx"
sess = ort.InferenceSession(MODEL, providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
out = sess.get_outputs()[0].name
inp = sess.get_inputs()[0].name

for bs in [1, 4, 8, 16, 32]:
    x = np.random.rand(bs, 3, 224, 224).astype(np.float32)
    for _ in range(3):
        sess.run([out], {inp: x})
    t0 = time.time()
    N = 10
    for _ in range(N):
        sess.run([out], {inp: x})
    dt = (time.time() - t0) / N
    print(f"batch={bs:2d}: {dt*1000:6.2f} ms/批 = {dt*1000/bs:5.2f} ms/张")
