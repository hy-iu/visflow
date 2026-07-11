export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

export function getThumbUrl(imageId: string): string {
  return `thumb://${imageId}`
}

export function getImageUrl(filePath: string): string {
  // Pass the absolute path as a query parameter so that standard URL parsing
  // doesn't strip or lowercase the Windows drive letter.
  return `local-image://_/?path=${encodeURIComponent(filePath)}`
}

export interface CollectionTreeNode {
  id: string
  name: string
  parentId: string | null
  children: CollectionTreeNode[]
  [key: string]: any
}

export function buildCollectionTree(collections: any[]): CollectionTreeNode[] {
  const map = new Map<string, CollectionTreeNode>()
  const roots: CollectionTreeNode[] = []

  for (const c of collections) {
    map.set(c.id, { ...c, children: [] })
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as any as T
}

export function groupByDate(images: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>()
  for (const img of images) {
    const date = new Date(img.createdAt || img.importedAt || Date.now()).toLocaleDateString('zh-CN')
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(img)
  }
  return groups
}
