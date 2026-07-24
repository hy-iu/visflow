/**
 * NudeNet Model Test Script (TFJS Graph Model - Object Detection)
 * Run: node scripts/test-nudenet.mjs <image-path-or-folder>
 *
 * Detects specific body parts and determines if content is NSFW.
 * Much more accurate than nsfwjs for revealing/underwear content.
 */

import * as tf from '@tensorflow/tfjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import sharp from 'sharp'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODEL_DIR = path.resolve(__dirname, '../models/nudenet')
const MODEL_JSON = path.join(MODEL_DIR, 'model.json')

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'])
const INPUT_SIZE = 416 // resize longest side to this for performance

// Default model classes (16 classes)
const LABELS = [
  'exposed anus',      // 0
  'exposed armpits',   // 1
  'belly',             // 2
  'exposed belly',     // 3
  'buttocks',          // 4
  'exposed buttocks',  // 5
  'female face',       // 6
  'male face',         // 7
  'feet',              // 8
  'exposed feet',      // 9
  'breast',            // 10
  'exposed breast',    // 11
  'vagina',            // 12
  'exposed vagina',    // 13
  'male breast',       // 14
  'exposed penis',     // 15
]

// Composite definitions: which classes indicate person/sexy/nude
const COMPOSITE = {
  person: [6, 7],                              // faces
  sexy: [1, 2, 3, 4, 8, 9, 10, 15],           // armpits, belly, buttocks, feet, breast, penis
  nude: [0, 5, 11, 12, 13],                    // exposed anus/buttocks/breast/vagina
}

// NSFW = any "nude" detection OR "sexy" with high confidence
const MIN_SCORE = 0.3
const MAX_RESULTS = 50
const IOU_THRESHOLD = 0.5

const targetPath = process.argv[2]
if (!targetPath) {
  console.log('Usage: node scripts/test-nudenet.mjs <image-or-folder>')
  process.exit(1)
}

async function main() {
  console.log(`\n=== NudeNet Object Detection Test ===`)
  console.log(`Model: ${MODEL_DIR}`)
  console.log(`Target: ${targetPath}\n`)

  // Force cpu backend - WASM has concat4D issues with this graph model
  await tf.setBackend('cpu')
  await tf.ready()
  console.log('Backend:', tf.getBackend())

  // Load graph model from local files (pure JS tfjs can't use file:// fetch)
  console.log('Loading model...')
  const t0 = Date.now()
  const modelJson = JSON.parse(fs.readFileSync(MODEL_JSON, 'utf8'))
  const weightsManifest = modelJson.weightsManifest
  const weightData = []
  for (const group of weightsManifest) {
    for (const shardPath of group.paths) {
      weightData.push(fs.readFileSync(path.join(MODEL_DIR, shardPath)))
    }
  }
  const weightSpecs = weightsManifest.flatMap(g => g.weights)
  const model = await tf.loadGraphModel(
    tf.io.fromMemory({ modelTopology: modelJson.modelTopology, weightSpecs, weightData: Buffer.concat(weightData) })
  )
  console.log(`Model loaded in ${Date.now() - t0}ms\n`)

  // Collect files
  let files = []
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    for (const f of fs.readdirSync(targetPath)) {
      if (IMAGE_EXTS.has(path.extname(f).toLowerCase())) {
        files.push(path.join(targetPath, f))
      }
    }
  } else {
    files.push(targetPath)
  }

  console.log(`Found ${files.length} image(s)\n`)
  console.log('─'.repeat(100))

  let nsfwCount = 0

  for (const filePath of files) {
    try {
      const t1 = Date.now()

      // Decode image with sharp → resize for performance → raw RGB
      const { data, info } = await sharp(filePath)
        .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      // Create tensor: [1, height, width, 3] float32
      const inputTensor = tf.tidy(() => {
        const img = tf.tensor3d(new Uint8Array(data.buffer), [info.height, info.width, 3])
        return tf.cast(img.expandDims(0), 'float32')
      })

      // Run inference using actual graph node names from signature
      const OUTPUT_NODES = [
        'filtered_detections/map/TensorArrayStack/TensorArrayGatherV3',   // boxes [batch, 300, 4]
        'filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3', // scores [batch, 300]
        'filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3', // classes [batch, 300]
      ]
      const [boxesT, scoresT, classesT] = await model.executeAsync(inputTensor, OUTPUT_NODES)

      // Parse results
      const boxes = await boxesT.array()
      const scores = await scoresT.data()
      const classes = await classesT.data()

      // NMS
      const nmsT = await tf.image.nonMaxSuppressionAsync(boxes[0], scores, MAX_RESULTS, IOU_THRESHOLD, MIN_SCORE)
      const nms = await nmsT.data()

      const parts = []
      for (const idx of nms) {
        const id = classes[idx]
        parts.push({
          score: scores[idx],
          id,
          class: LABELS[id],
        })
      }

      // Determine status
      const person = parts.some(p => COMPOSITE.person.includes(p.id))
      const sexy = parts.some(p => COMPOSITE.sexy.includes(p.id))
      const nude = parts.some(p => COMPOSITE.nude.includes(p.id))
      const isNsfw = nude || sexy

      if (isNsfw) nsfwCount++

      const elapsed = Date.now() - t1
      const name = path.basename(filePath).slice(0, 40)
      const status = nude ? '🔴 NUDE' : sexy ? '🟡 SEXY' : '✅ SAFE'
      const partsStr = parts.length > 0
        ? parts.map(p => `${p.class}(${(p.score * 100).toFixed(0)}%)`).join(', ')
        : 'none'

      console.log(`${status}  ${name}`)
      console.log(`      Parts: ${partsStr}  [${elapsed}ms]`)
      console.log('')

      // Cleanup
      tf.dispose([inputTensor, boxesT, scoresT, classesT, nmsT])

    } catch (err) {
      console.log(`ERROR ${path.basename(filePath)}: ${err.message}\n`)
    }
  }

  console.log('─'.repeat(100))
  console.log(`\nResult: ${nsfwCount}/${files.length} flagged as NSFW (nude or sexy)`)
}

main().catch(console.error)
