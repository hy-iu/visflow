# -*- coding: utf-8 -*-
"""测 onnxruntime CUDA 会话多线程并发 run 是否真并行（同 session）"""
import os
import site
import threading
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

sess = ort.InferenceSession(r"models\nsfw-cls\nsfw-cls-yolo11s.onnx",
                            providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
out = sess.get_outputs()[0].name
inp = sess.get_inputs()[0].name
x = np.random.rand(1, 3, 224, 224).astype(np.float32)

# 串行基线
for _ in range(5):
    sess.run([out], {inp: x})
t0 = time.time()
for _ in range(100):
    sess.run([out], {inp: x})
serial = (time.time() - t0) / 100
print(f"串行: {serial*1000:.2f} ms/张")

# 并发：8 线程，每个线程 12 次
N_THREADS, PER = 8, 12


def worker():
    for _ in range(PER):
        sess.run([out], {inp: x})


t0 = time.time()
ths = [threading.Thread(target=worker) for _ in range(N_THREADS)]
for t in ths:
    t.start()
for t in ths:
    t.join()
dt = time.time() - t0
total = N_THREADS * PER
print(f"{N_THREADS} 线程并发 {total} 张: {dt:.2f}s = {dt/total*1000:.2f} ms/张（理论串行 {total*serial:.2f}s）")
print(f"加速比: {total*serial/dt:.2f}x")
