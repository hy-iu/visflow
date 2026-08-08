// 实测 YOLO11s-cls CPU 推理速度（sharp 解码 + onnxruntime-node）
import sharp from 'sharp'
import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const model = path.join(ROOT, 'models', 'nsfw-cls', 'nsfw-cls-yolo11s.onnx')
const session = await ort.InferenceSession.create(model)
const files = fs.readdirSync(path.join(ROOT, 'datasets/nsfw-labeled/nsfw')).slice(0, 30)
const size = 224
const t0 = Date.now()
for (const f of files) {
  const { data } = await sharp(path.join(ROOT, 'datasets/nsfw-labeled/nsfw', f))
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const float32 = new Float32Array(3 * size * size)
  for (let i = 0; i < size * size; i++) {
    float32[i] = data[i * 3] / 255
    float32[size * size + i] = data[i * 3 + 1] / 255
    float32[2 * size * size + i] = data[i * 3 + 2] / 255
  }
  await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', float32, [1, 3, size, size]) })
}
const dt = (Date.now() - t0) / files.length
console.log(`CPU 平均 ${dt.toFixed(1)} ms/张（含 sharp 解码），${files.length} 张`)

// 估算：全量 23753 张 pending
const pending = 23753
console.log(`全量扫描 ${pending} 张预计：${(dt * pending / 1000 / 60).toFixed(1)} 分钟（串行）`)
