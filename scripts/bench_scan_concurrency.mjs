// 实测 Node 扫描管线并发效果：串行 vs 4 并发（sharp 解码 + onnxruntime-node CPU）
import sharp from 'sharp'
import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SIZE = 224
const session = await ort.InferenceSession.create(path.join(ROOT, 'models', 'nsfw-cls', 'nsfw-cls-yolo11s.onnx'))
const files = fs.readdirSync(path.join(ROOT, 'datasets/nsfw-labeled/nsfw')).slice(0, 48)

async function classifyOne(f) {
  const p = path.join(ROOT, 'datasets/nsfw-labeled/nsfw', f)
  const { data } = await sharp(p)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const float32 = new Float32Array(3 * SIZE * SIZE)
  for (let i = 0; i < SIZE * SIZE; i++) {
    float32[i] = data[i * 3] / 255
    float32[SIZE * SIZE + i] = data[i * 3 + 1] / 255
    float32[2 * SIZE * SIZE + i] = data[i * 3 + 2] / 255
  }
  await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', float32, [1, 3, SIZE, SIZE]) })
}

// 串行
let t0 = Date.now()
for (const f of files) await classifyOne(f)
const serial = (Date.now() - t0) / files.length

// 4 并发（与 scanPendingImages 相同的 worker 池）
t0 = Date.now()
let next = 0
async function worker() {
  while (true) {
    const i = next++
    if (i >= files.length) return
    await classifyOne(files[i])
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()))
const conc4 = (Date.now() - t0) / files.length

console.log(`串行: ${serial.toFixed(1)} ms/张`)
console.log(`4 并发: ${conc4.toFixed(1)} ms/张（等效吞吐）`)
console.log(`加速比: ${(serial / conc4).toFixed(2)}x`)
console.log(`全量 23753 张: 串行 ${(serial * 23753 / 1000 / 60).toFixed(0)} 分钟 → 4并发 ${(conc4 * 23753 / 1000 / 60).toFixed(0)} 分钟`)
