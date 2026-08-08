// 验证应用侧 classifyWithCls 的预处理与推理结果（sharp + onnxruntime-node）
import sharp from 'sharp'
import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODEL = path.join(__dirname, '..', 'models', 'nsfw-cls', 'nsfw-cls-yolo11s.onnx')
const SIZE = 224

async function classify(filePath) {
  const { data } = await sharp(filePath)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const size = SIZE * SIZE
  const float32 = new Float32Array(3 * size)
  for (let i = 0; i < size; i++) {
    float32[i] = data[i * 3] / 255.0
    float32[size + i] = data[i * 3 + 1] / 255.0
    float32[2 * size + i] = data[i * 3 + 2] / 255.0
  }
  const session = await ort.InferenceSession.create(MODEL)
  const inputTensor = new ort.Tensor('float32', float32, [1, 3, SIZE, SIZE])
  const results = await session.run({ [session.inputNames[0]]: inputTensor })
  const probs = results[session.outputNames[0]].data
  return { nsfw: probs[0], sfw: probs[1], input: session.inputNames[0], output: session.outputNames[0] }
}

// 与 Python 评测对比的样本：nsfw 清晰走光图 + sfw 普通腿照
const cases = [
  ['nsfw', 'datasets/nsfw-labeled/nsfw/9769ae0a_zzgnt5071490451001.jpg'],
  ['nsfw', 'datasets/nsfw-labeled/nsfw/0f5aa13a_zzgnt2046821435009.jpg'],
  ['sfw', 'datasets/nsfw-labeled/sfw/6348eb06_zzgnt2735183628002.jpg'],
  ['sfw', 'datasets/nsfw-labeled/sfw/d20fe27a_zzgnt2735183628003.jpg']
]

;(async () => {
  for (const [label, p] of cases) {
    if (!fs.existsSync(p)) { console.log(`SKIP ${p}`); continue }
    const r = await classify(p)
    console.log(`${label}: nsfw=${r.nsfw.toFixed(4)} sfw=${r.sfw.toFixed(4)} 判定=${r.nsfw >= 0.5 ? 'NSFW' : 'safe'}`)
  }
})().catch((e) => { console.error('FAIL:', e); process.exit(1) })
