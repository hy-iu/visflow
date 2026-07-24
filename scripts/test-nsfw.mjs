/**
 * NSFW Model Test Script
 * Run: node scripts/test-nsfw.mjs <image-path-or-folder> [--model MobileNetV2|MobileNetV2Mid|InceptionV3] [--threshold 0.45]
 *
 * Examples:
 *   node scripts/test-nsfw.mjs "F:\video\gazounotobira.com\10049\zzgnt5071490451012.jpg"
 *   node scripts/test-nsfw.mjs "F:\video\gazounotobira.com\10049" --model InceptionV3
 *   node scripts/test-nsfw.mjs "F:\video\gazounotobira.com\10049" --model MobileNetV2 --threshold 0.3
 */

import * as tf from '@tensorflow/tfjs'
import * as nsfwjs from 'nsfwjs'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

// Parse args
const args = process.argv.slice(2)
const targetPath = args[0]
const modelArg = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'InceptionV3'
const thresholdArg = args.includes('--threshold') ? parseFloat(args[args.indexOf('--threshold') + 1]) : 0.45

const MODEL_SIZES = { MobileNetV2: 224, MobileNetV2Mid: 224, InceptionV3: 299 }
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'])

if (!targetPath) {
  console.log('Usage: node scripts/test-nsfw.mjs <image-or-folder> [--model MobileNetV2|MobileNetV2Mid|InceptionV3] [--threshold 0.45]')
  process.exit(1)
}

async function main() {
  console.log(`\n=== NSFW Model Test ===`)
  console.log(`Model: ${modelArg} (${MODEL_SIZES[modelArg]}x${MODEL_SIZES[modelArg]})`)
  console.log(`Threshold: ${thresholdArg}`)
  console.log(`Backend: ${tf.getBackend()}`)
  console.log(`Target: ${targetPath}\n`)

  // Load model
  console.log('Loading model...')
  const t0 = Date.now()
  const size = MODEL_SIZES[modelArg] || 299
  const model = await nsfwjs.load(modelArg, { size })
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
  console.log('─'.repeat(90))
  console.log(
    'File'.padEnd(40) +
    'Drawing'.padStart(9) +
    'Hentai'.padStart(9) +
    'Neutral'.padStart(9) +
    'Porn'.padStart(9) +
    'Sexy'.padStart(9) +
    '  NSFW?'.padStart(9)
  )
  console.log('─'.repeat(90))

  let nsfwCount = 0
  const t1 = Date.now()

  for (const filePath of files) {
    try {
      const { data, info } = await sharp(filePath)
        .resize(size, size, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const tensor = tf.tensor3d(new Uint8Array(data.buffer), [info.height, info.width, info.channels])
      const predictions = await model.classify(tensor)
      tensor.dispose()

      const scores = {}
      for (const p of predictions) scores[p.className] = p.probability

      const nsfwScore = (scores['Porn'] || 0) + (scores['Hentai'] || 0) + (scores['Sexy'] || 0)
      const isNsfw = nsfwScore >= thresholdArg
      if (isNsfw) nsfwCount++

      const name = path.basename(filePath).slice(0, 38)
      console.log(
        name.padEnd(40) +
        ((scores['Drawing'] || 0) * 100).toFixed(1).padStart(8) + '%' +
        ((scores['Hentai'] || 0) * 100).toFixed(1).padStart(8) + '%' +
        ((scores['Neutral'] || 0) * 100).toFixed(1).padStart(8) + '%' +
        ((scores['Porn'] || 0) * 100).toFixed(1).padStart(8) + '%' +
        ((scores['Sexy'] || 0) * 100).toFixed(1).padStart(8) + '%' +
        (isNsfw ? '  ⚠️ YES' : '  ✅ no').padStart(9)
      )
    } catch (err) {
      console.log(`${path.basename(filePath).padEnd(40)} ERROR: ${err.message}`)
    }
  }

  const elapsed = Date.now() - t1
  console.log('─'.repeat(90))
  console.log(`\nResult: ${nsfwCount}/${files.length} flagged as NSFW (threshold=${thresholdArg})`)
  console.log(`Time: ${elapsed}ms total, ${(elapsed / files.length).toFixed(0)}ms/image`)
}

main().catch(console.error)
