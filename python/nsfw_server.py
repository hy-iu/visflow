# -*- coding: utf-8 -*-
"""VisFlow NSFW 分类 GPU 推理服务（onnxruntime CUDA）

Electron 主进程以子进程方式启动本服务，通过 HTTP 调用：
  POST /classify  body = raw float32 CHW [1,3,224,224]（主进程 sharp 预处理）
                   ->  {"nsfw": 0.93, "sfw": 0.07}
  GET  /health    ->  {"ok": true, "provider": "CUDAExecutionProvider"}

启动后向 stdout 打印一行：NSFW_SERVER_READY <port>（ASCII，避免控制台编码问题）。

仅用标准库 + numpy + onnxruntime，无第三方框架依赖。
"""
import argparse
import json
import os
import site
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def add_dll_dirs():
    """onnxruntime CUDA 依赖探测：cuDNN 9（torch/lib）与 CUDA 13 运行时。

    必须在创建 InferenceSession 之前调用（provider DLL 动态加载）。
    - cuDNN 9：从 site-packages/torch/lib 自动探测（torch 自带）
    - CUDA 13 运行时（cublasLt64_13.dll 等）：环境变量 NSFW_CUDA_DLL_DIR（分号分隔）
      或已知本机目录 F:\\models\\llama.cpp（llama.cpp 的 cudart 包）
    通过前置 PATH 使 LoadLibrary 能搜到这些 DLL。
    """
    dirs = []
    for sp in site.getsitepackages():
        d = os.path.join(sp, "torch", "lib")
        if os.path.isdir(d) and any(f.startswith("cudnn64_9") for f in os.listdir(d)):
            dirs.append(d)
    for d in os.environ.get("NSFW_CUDA_DLL_DIR", "").split(";"):
        if d and os.path.isdir(d):
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

import numpy as np  # noqa: E402
import onnxruntime as ort  # noqa: E402

SIZE = 224
SESSION = None
PROVIDER = "CUDAExecutionProvider"


def get_session():
    global SESSION
    if SESSION is None:
        SESSION = ort.InferenceSession(ARGS.model, providers=[PROVIDER, "CPUExecutionProvider"])
    return SESSION


def classify(raw_bytes):
    sess = get_session()
    x = np.frombuffer(raw_bytes, dtype=np.float32).reshape(1, 3, SIZE, SIZE)
    out = sess.get_outputs()[0].name
    probs = sess.run([out], {sess.get_inputs()[0].name: x})[0][0]
    return float(probs[0]), float(probs[1])


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive，避免每请求新建 TCP 连接

    def log_message(self, fmt, *args):
        pass  # 静默访问日志

    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/health"):
            self._send(200, {"ok": True, "provider": get_session().get_providers()[0]})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/classify"):
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            expected = SIZE * SIZE * 3 * 4
            if length != expected:
                self._send(400, {"error": f"expected {expected} bytes, got {length}"})
                return
            raw = self.rfile.read(length)
            nsfw, sfw = classify(raw)
            self._send(200, {"nsfw": nsfw, "sfw": sfw})
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})


def main():
    global ARGS
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="nsfw-cls-yolo11s.onnx 绝对路径")
    ap.add_argument("--port", type=int, default=0, help="监听端口（0=随机）")
    ARGS = ap.parse_args()

    try:
        sess = get_session()
    except Exception as e:  # noqa: BLE001
        print(f"NSFW_SERVER_ERROR model load failed: {e}", flush=True)
        sys.exit(1)

    server = ThreadingHTTPServer(("127.0.0.1", ARGS.port), Handler)
    port = server.server_address[1]
    print(f"NSFW_SERVER_READY {port} provider={sess.get_providers()[0]}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
