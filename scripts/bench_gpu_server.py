# -*- coding: utf-8 -*-
"""找 nsfw_server.py 的监听端口并用 float32 数组协议测速"""
import struct
import subprocess
import time
import urllib.request

# 找 python 进程监听的端口
out = subprocess.run(["netstat", "-ano"], capture_output=True).stdout.decode("gbk", errors="ignore")
pids = set()
r = subprocess.run(
    ["powershell", "-NoProfile", "-Command", "(Get-Process python -ErrorAction SilentlyContinue).Id"],
    capture_output=True,
)
for tok in r.stdout.decode("utf-8", errors="ignore").split():
    if tok.isdigit():
        pids.add(tok)

ports = []
for line in out.splitlines():
    if "LISTENING" in line and "127.0.0.1" in line:
        parts = line.split()
        if len(parts) >= 5 and parts[-1] in pids:
            ports.append(parts[1].split(":")[-1])
print("python 监听端口:", ports)

# health
url = f"http://127.0.0.1:{ports[0]}"
h = json = None
import json as _json
h = _json.load(urllib.request.urlopen(url + "/health", timeout=10))
print("health:", h)

# 构造 float32 CHW 数组（纯随机，只测速度）
import numpy as np
x = np.random.rand(1, 3, 224, 224).astype(np.float32)
raw = x.tobytes()
print("payload bytes:", len(raw))

# 预热
for _ in range(3):
    req = urllib.request.Request(url + "/classify", data=raw, headers={"Content-Type": "application/octet-stream"})
    urllib.request.urlopen(req, timeout=30).read()

t0 = time.time()
for _ in range(20):
    req = urllib.request.Request(url + "/classify", data=raw, headers={"Content-Type": "application/octet-stream"})
    resp = _json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
dt = (time.time() - t0) / 20 * 1000
print(f"GPU 纯推理稳态 {dt:.1f} ms/张（HTTP + 推理，无解码）")
print("结果:", resp)
