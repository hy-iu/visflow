# -*- coding: utf-8 -*-
"""对比 onnxruntime CUDA vs CPU 纯推理耗时（同一随机输入）"""
import os
import site
import time

# 与 nsfw_server.py 相同的 DLL 探测
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
x = np.random.rand(1, 3, 224, 224).astype(np.float32)


def bench(providers, name):
    sess = ort.InferenceSession(MODEL, providers=providers)
    out = sess.get_outputs()[0].name
    inp = sess.get_inputs()[0].name
    # 预热
    for _ in range(5):
        sess.run([out], {inp: x})
    t0 = time.time()
    for _ in range(50):
        sess.run([out], {inp: x})
    dt = (time.time() - t0) / 50 * 1000
    print(f"{name}: {dt:.2f} ms/张 (provider={sess.get_providers()[0]})")
    return dt


bench(["CPUExecutionProvider"], "CPU")
bench(["CUDAExecutionProvider", "CPUExecutionProvider"], "CUDA")
