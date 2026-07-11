import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { smartGroups, images } from '../db/schema'
import { eq, sql, and, like, desc, asc, gte, lte, SQL } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

function buildConditions(rules: any): SQL | undefined {
  const conds: SQL[] = []
  for (const r of rules.rules || []) {
    if (r.field === 'rating') {
      if (r.operator === 'eq') conds.push(eq(images.rating, r.value))
      else if (r.operator === 'gte') conds.push(gte(images.rating, r.value))
      else if (r.operator === 'lte') conds.push(lte(images.rating, r.value))
    } else if (r.field === 'colorLabel') { conds.push(eq(images.colorLabel, r.value))
    } else if (r.field === 'dateRange' && Array.isArray(r.value)) { conds.push(gte(images.createdAt, r.value[0])); conds.push(lte(images.createdAt, r.value[1]))
    } else if (r.field === 'fileType') { conds.push(like(images.mimeType, `%${r.value}%`))
    } else if (r.field === 'fileName') { conds.push(like(images.fileName, `%${r.value}%`)) }
  }
  if (!conds.length) return undefined
  return rules.match === 'any' ? sql`(${sql.join(conds, sql` OR `)})` : and(...conds)
}

export function registerSmartGroupHandlers(): void {
  ipcMain.handle('smartGroups:getAll', async () => { return getDb().select().from(smartGroups).all() })
  ipcMain.handle('smartGroups:create', async (_e, data: any) => {
    const db = getDb(); const id = uuidv4()
    db.insert(smartGroups).values({ id, name: data.name, rulesJson: JSON.stringify(data.rules || { match: 'all', rules: [] }), sortBy: data.sortBy || 'createdAt', sortDir: data.sortDir || 'desc', createdAt: Date.now() }).run()
    return db.select().from(smartGroups).where(eq(smartGroups.id, id)).get()
  })
  ipcMain.handle('smartGroups:update', async (_e, id: string, data: any) => {
    const db = getDb(); const u: any = {}
    if (data.name !== undefined) u.name = data.name
    if (data.rules !== undefined) u.rulesJson = JSON.stringify(data.rules)
    if (data.sortBy !== undefined) u.sortBy = data.sortBy
    if (data.sortDir !== undefined) u.sortDir = data.sortDir
    db.update(smartGroups).set(u).where(eq(smartGroups.id, id)).run()
    return db.select().from(smartGroups).where(eq(smartGroups.id, id)).get()
  })
  ipcMain.handle('smartGroups:delete', async (_e, id: string) => { getDb().delete(smartGroups).where(eq(smartGroups.id, id)).run() })
  ipcMain.handle('smartGroups:evaluate', async (_e, id: string) => {
    const db = getDb(); const group = db.select().from(smartGroups).where(eq(smartGroups.id, id)).get()
    if (!group?.rulesJson) return []
    const rules = JSON.parse(group.rulesJson); const where = buildConditions(rules)
    const sortFn = group.sortDir === 'asc' ? asc : desc
    const sortCol = group.sortBy === 'fileName' ? images.fileName : group.sortBy === 'rating' ? images.rating : images.createdAt
    return db.select().from(images).where(where).orderBy(sortFn(sortCol)).all()
  })
}
