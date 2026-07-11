/**
 * @fileoverview Custom Electron protocol handlers.
 *
 * Registers two custom protocols using the modern `protocol.handle` API:
 *
 * - **`thumb://<imageId>`** – serves the generated thumbnail JPEG for an
 *   image given its UUID.
 * - **`local-image://<encoded-path>`** – serves an original image from disk
 *   using a URL-encoded absolute path, avoiding `file://` CSP issues.
 */

import path from 'path'
import fs from 'fs'
import { app, protocol, net } from 'electron'
import { pathToFileURL } from 'url'

/**
 * Register the `thumb://` and `local-image://` privilege schemes.
 *
 * **Must** be called before `app.whenReady()` (at module load time).
 */
export function registerProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'thumb',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true
      }
    },
    {
      scheme: 'local-image',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true
      }
    }
  ])
}

/**
 * Register the actual protocol handlers.
 *
 * **Must** be called after `app.whenReady()`.
 */
export function registerProtocols(): void {
  /* ---- thumb://<imageId> ---------------------------------------- */
  protocol.handle('thumb', (request) => {
    const url = new URL(request.url)
    // thumb://imageId  →  hostname is the image ID
    const imageId = url.hostname || url.pathname.replace(/^\/+/, '')
    const thumbPath = path.join(app.getPath('userData'), 'thumbs', `${imageId}.jpg`)
    return net.fetch(pathToFileURL(thumbPath).href)
  })

  /* ---- local-image://_/?path=<encoded-path> ----------------------------- */
  protocol.handle('local-image', (request) => {
    const url = new URL(request.url)
    
    let filePath: string
    if (url.searchParams.has('path')) {
      filePath = url.searchParams.get('path') as string
    } else {
      // Legacy support for local-image:///<encoded-path>
      filePath = decodeURIComponent(url.pathname)
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1)
      }
    }
    
    try {
      if (!fs.existsSync(filePath)) {
        console.warn('[Protocol] File does not exist:', filePath)
      }
    } catch (e) {
      console.error('[Protocol] Error checking existence:', e)
    }
    return net.fetch(pathToFileURL(filePath).href)
  })
}
