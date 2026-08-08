import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { ImageCard } from './ImageCard'
import { MasonryLayout } from './MasonryLayout'
import { imageKey } from '../../lib/utils'
import './FolderLayout.css'

/** Max images to render per folder in unwrap (horizontal scroll) mode */
const UNWRAP_RENDER_LIMIT = 60
/** Max images to render per folder in wrap grid mode */
const WRAP_GRID_RENDER_LIMIT = 200

/** Per-folder summary produced by the main-process folder index */
interface FolderSummary {
  dirPath: string
  dirName: string
  count: number
  latestImportedAt: number
  latestCreatedAt: number
}

/** Recursive directory tree node built from the folder index */
interface TreeNode {
  dirPath: string
  /** Display name (segment name, or joined path for compressed chains) */
  name: string
  ownCount: number
  totalCount: number
  latestImportedAt: number
  latestCreatedAt: number
  summary: FolderSummary | null
  children: TreeNode[]
}

function sepOf(p: string) {
  return p.includes('\\') ? '\\' : '/'
}

/* ------------------------------------------------------------------ */
/*  Lazy image content (mounted only near the viewport)                */
/* ------------------------------------------------------------------ */

interface LazyContentProps {
  summary: FolderSummary
  images: any[] | undefined
  contentReady: boolean
  layoutStyle: 'grid' | 'masonry'
  foldersWrap: boolean
  gridSize: number
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const LazyFolderContent: React.FC<LazyContentProps> = ({
  summary,
  images,
  contentReady,
  layoutStyle,
  foldersWrap,
  gridSize,
  onContextMenu,
}) => {
  const openViewer = useViewStore((s) => s.openViewer)
  const selectedImageIds = useLibraryStore((s) => s.selectedImageIds)
  const selectImage = useLibraryStore((s) => s.selectImage)
  const [showAll, setShowAll] = useState(false)
  const [inView, setInView] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Mount the (potentially huge) image cards only when scrolled near the
  // viewport; headers render immediately from the folder index.
  useEffect(() => {
    if (inView) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView])

  if (!inView) {
    return <div ref={rootRef} className="folder-row__lazy-placeholder" />
  }
  if (!contentReady) {
    return <div className="folder-row__lazy-placeholder">正在加载图片索引…</div>
  }

  const rowHeightMap: Record<number, number> = { 1: 130, 2: 190, 3: 270 }
  const rowHeight = rowHeightMap[gridSize] || 190
  const gridCellSizeMap: Record<number, string> = { 1: '150px', 2: '200px', 3: '280px' }
  const cellSize = gridCellSizeMap[gridSize] || '200px'
  const gridStyle = { '--grid-cell-size': cellSize } as React.CSSProperties
  const trackStyle = { '--row-height': `${rowHeight}px` } as React.CSSProperties

  const list = images || []

  if (!foldersWrap) {
    // Unwrap: Horizontal scroll row (limit rendered count)
    const renderLimit = showAll ? list.length : UNWRAP_RENDER_LIMIT
    const visibleImages = list.slice(0, renderLimit)
    return (
      <div className={`folder-row__track folder-row__track--${layoutStyle}`} style={trackStyle}>
        {visibleImages.map((image) => (
          <ImageCard
            key={imageKey(image)}
            image={image}
            isSelected={selectedImageIds.has(image.id)}
            onSelect={selectImage}
            onOpen={openViewer}
            onContextMenu={onContextMenu}
          />
        ))}
        {!showAll && list.length > UNWRAP_RENDER_LIMIT && (
          <button className="folder-row__show-more" onClick={() => setShowAll(true)}>
            +{list.length - UNWRAP_RENDER_LIMIT}
          </button>
        )}
      </div>
    )
  }

  // Wrap: Folder grid or masonry columns
  if (layoutStyle === 'masonry') {
    return <MasonryLayout images={list} onContextMenu={onContextMenu} />
  }
  const renderLimit = showAll ? list.length : WRAP_GRID_RENDER_LIMIT
  const visibleImages = list.slice(0, renderLimit)
  return (
    <div className="folder-row__grid" style={gridStyle}>
      {visibleImages.map((image) => (
        <ImageCard
          key={imageKey(image)}
          image={image}
          isSelected={selectedImageIds.has(image.id)}
          onSelect={selectImage}
          onOpen={openViewer}
          onContextMenu={onContextMenu}
        />
      ))}
      {!showAll && list.length > WRAP_GRID_RENDER_LIMIT && (
        <button className="folder-row__show-more folder-row__show-more--grid" onClick={() => setShowAll(true)}>
          显示全部 {list.length} 张
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Flat folder row (used in 平铺 mode)                                */
/* ------------------------------------------------------------------ */

interface FolderRowProps {
  summary: FolderSummary
  images: any[] | undefined
  contentReady: boolean
  layoutStyle: 'grid' | 'masonry'
  foldersWrap: boolean
  gridSize: number
  onContextMenu?: (e: React.MouseEvent, id: string) => void
  onRemoveFolder?: (dirName: string, dirPath: string, count: number) => void
}

const FolderRow: React.FC<FolderRowProps> = React.memo(({
  summary,
  images,
  contentReady,
  layoutStyle,
  foldersWrap,
  gridSize,
  onContextMenu,
  onRemoveFolder,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`folder-row ${collapsed ? 'folder-row--collapsed' : ''}`}>
      <div
        className="folder-row__header"
        onClick={(e) => {
          e.stopPropagation()
          setCollapsed((prev) => !prev)
        }}
      >
        <div className="folder-row__header-info">
          <span className="folder-row__title">
            <span className={`folder-row__arrow ${collapsed ? '' : 'folder-row__arrow--expanded'}`}>▸</span>
            📁 {summary.dirName}
          </span>
          <span className="folder-row__path" title={summary.dirPath}>{summary.dirPath}</span>
        </div>
        <div className="folder-row__header-right">
          <span className="folder-row__count">{summary.count} 张图片</span>
          {onRemoveFolder && (
            <button
              className="folder-row__action-btn"
              title="将此文件夹的图片全部移出图库"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveFolder(summary.dirName, summary.dirPath, summary.count)
              }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="folder-row__content">
          <LazyFolderContent
            summary={summary}
            images={images}
            contentReady={contentReady}
            layoutStyle={layoutStyle}
            foldersWrap={foldersWrap}
            gridSize={gridSize}
            onContextMenu={onContextMenu}
          />
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  return prev.summary.dirPath === next.summary.dirPath &&
    prev.summary.count === next.summary.count &&
    prev.summary.dirName === next.summary.dirName &&
    prev.images === next.images &&
    prev.contentReady === next.contentReady &&
    prev.layoutStyle === next.layoutStyle &&
    prev.foldersWrap === next.foldersWrap &&
    prev.gridSize === next.gridSize &&
    prev.onContextMenu === next.onContextMenu &&
    prev.onRemoveFolder === next.onRemoveFolder
})

/* ------------------------------------------------------------------ */
/*  Recursive directory tree (used in 树状 mode)                       */
/* ------------------------------------------------------------------ */

interface TreeNodeViewProps {
  node: TreeNode
  depth: number
  contentMap: Map<string, any[]>
  contentReady: boolean
  layoutStyle: 'grid' | 'masonry'
  foldersWrap: boolean
  gridSize: number
  onContextMenu?: (e: React.MouseEvent, id: string) => void
  onRemoveFolder?: (dirName: string, dirPath: string, count: number) => void
}

function TreeNodeView({
  node,
  depth,
  contentMap,
  contentReady,
  layoutStyle,
  foldersWrap,
  gridSize,
  onContextMenu,
  onRemoveFolder,
}: TreeNodeViewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const hasChildren = node.children.length > 0
  const hasOwn = node.summary !== null

  return (
    <div className="folder-tree-node">
      <div
        className="folder-row__header folder-tree-node__header"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={(e) => {
          e.stopPropagation()
          setCollapsed((prev) => !prev)
        }}
      >
        <div className="folder-row__header-info">
          <span className="folder-row__title">
            <span
              className={`folder-row__arrow ${!hasChildren && !hasOwn ? 'folder-row__arrow--hidden' : collapsed ? '' : 'folder-row__arrow--expanded'}`}
            >
              ▸
            </span>
            {hasChildren ? '📂' : '📁'} {node.name}
          </span>
          <span className="folder-row__path" title={node.dirPath}>{node.dirPath}</span>
        </div>
        <div className="folder-row__header-right">
          <span className="folder-row__count">
            {hasChildren ? `${node.children.length} 个子文件夹 · ` : ''}{node.totalCount} 张图片
          </span>
          {onRemoveFolder && node.totalCount > 0 && (
            <button
              className="folder-row__action-btn"
              title="将此目录下的图片全部移出图库"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveFolder(node.name, node.dirPath, node.totalCount)
              }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      {!collapsed && (hasOwn || hasChildren) && (
        <div className="folder-tree-node__body">
          {hasOwn && (
            <div className="folder-row__content">
              <LazyFolderContent
                summary={node.summary!}
                images={contentMap.get(node.dirPath)}
                contentReady={contentReady}
                layoutStyle={layoutStyle}
                foldersWrap={foldersWrap}
                gridSize={gridSize}
                onContextMenu={onContextMenu}
              />
            </div>
          )}
          {hasChildren && (
            <div className="folder-tree-node__children">
              {node.children.map((child) => (
                <TreeNodeView
                  key={child.dirPath}
                  node={child}
                  depth={depth + 1}
                  contentMap={contentMap}
                  contentReady={contentReady}
                  layoutStyle={layoutStyle}
                  foldersWrap={foldersWrap}
                  gridSize={gridSize}
                  onContextMenu={onContextMenu}
                  onRemoveFolder={onRemoveFolder}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tree construction                                                  */
/* ------------------------------------------------------------------ */

/** Build a real directory tree from flat folder summaries. */
function buildFolderTree(index: FolderSummary[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()
  const ensure = (dirPath: string, name: string): TreeNode => {
    let node = nodeMap.get(dirPath)
    if (!node) {
      node = {
        dirPath,
        name,
        ownCount: 0,
        totalCount: 0,
        latestImportedAt: 0,
        latestCreatedAt: 0,
        summary: null,
        children: []
      }
      nodeMap.set(dirPath, node)
    }
    return node
  }

  // Leaf nodes that directly contain images
  for (const s of index) {
    const node = ensure(s.dirPath, s.dirName)
    node.summary = s
    node.ownCount = s.count
    node.latestImportedAt = s.latestImportedAt
    node.latestCreatedAt = s.latestCreatedAt
  }

  // Intermediate ancestor nodes up to the filesystem root
  for (const s of index) {
    let parts = s.dirPath.split(/[/\\]/)
    while (parts.length > 1) {
      parts = parts.slice(0, -1)
      const parentPath = parts.join(sepOf(s.dirPath))
      ensure(parentPath, parts[parts.length - 1] || parentPath)
    }
  }

  // Link children / collect roots
  const roots: TreeNode[] = []
  for (const [dirPath, node] of nodeMap) {
    const parts = dirPath.split(/[/\\]/)
    if (parts.length <= 1) {
      roots.push(node)
      continue
    }
    const parent = nodeMap.get(parts.slice(0, -1).join(sepOf(dirPath)))
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  // Compact single-child chains without own images (VS Code style),
  // e.g. C: → Users → name becomes one root labelled "C:\Users\name".
  const compact = (node: TreeNode): TreeNode => {
    node.children = node.children.map(compact)
    let cur = node
    while (!cur.summary && cur.children.length === 1) {
      const child = cur.children[0]
      cur = { ...child, name: `${cur.name}${sepOf(child.dirPath)}${child.name}` }
    }
    return cur
  }
  const compacted = roots.map(compact)

  // Aggregate subtree counts / timestamps bottom-up
  const aggregate = (node: TreeNode) => {
    node.totalCount = node.ownCount
    for (const child of node.children) {
      aggregate(child)
      node.totalCount += child.totalCount
      if (child.latestImportedAt > node.latestImportedAt) node.latestImportedAt = child.latestImportedAt
      if (child.latestCreatedAt > node.latestCreatedAt) node.latestCreatedAt = child.latestCreatedAt
    }
  }
  compacted.forEach(aggregate)

  return compacted
}

interface FolderLayoutProps {
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

function parseDirectory(filePath: string) {
  const isWindows = filePath.includes('\\')
  const separator = isWindows ? '\\' : '/'
  const parts = filePath.split(/[/\\]/)
  parts.pop()
  const dirPath = parts.join(separator)
  const dirName = parts[parts.length - 1] || dirPath
  return { dirPath, dirName }
}

export const FolderLayout: React.FC<FolderLayoutProps> = ({ onContextMenu }) => {
  const images = useLibraryStore((s) => s.images)
  const isLoading = useLibraryStore((s) => s.isLoading)
  const loadAll = useLibraryStore((s) => s.loadAll)
  const layoutStyle = useViewStore((s) => s.layoutStyle)
  const foldersWrap = useViewStore((s) => s.foldersWrap)
  const gridSize = useViewStore((s) => s.gridSize)
  const foldersSortBy = useViewStore((s) => s.foldersSortBy)
  const foldersGroupBy = useViewStore((s) => s.foldersGroupBy)
  const sortDir = useViewStore((s) => s.sortDir)
  const nsfwFilter = useViewStore((s) => s.nsfwFilter)
  const searchQuery = useViewStore((s) => s.searchQuery)

  // Folder index (headers + counts) comes from the main process so the tree
  // paints instantly; image cards are attached lazily afterwards.
  const [index, setIndex] = useState<FolderSummary[]>([])
  const [indexLoaded, setIndexLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    window.api
      .getFolderIndex({ nsfwFilter, search: searchQuery || undefined })
      .then((idx) => {
        if (alive) {
          setIndex(idx)
          setIndexLoaded(true)
        }
      })
      .catch((err) => {
        console.error('Failed to load folder index:', err)
        if (alive) setIndexLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [nsfwFilter, searchQuery, images])

  const compareSummaries = useCallback((a: { name?: string; dirName?: string; dirPath: string; count?: number; totalCount?: number; latestImportedAt: number; latestCreatedAt: number }, b: any) => {
    const nameA = (a.name ?? a.dirName ?? '') as string
    const nameB = (b.name ?? b.dirName ?? '') as string
    const countA = (a.count ?? a.totalCount ?? 0) as number
    const countB = (b.count ?? b.totalCount ?? 0) as number
    let valA: any = nameA
    let valB: any = nameB
    if (foldersSortBy === 'count') {
      valA = countA
      valB = countB
    } else if (foldersSortBy === 'path') {
      valA = a.dirPath
      valB = b.dirPath
    } else if (foldersSortBy === 'importedAt') {
      valA = a.latestImportedAt
      valB = b.latestImportedAt
    } else if (foldersSortBy === 'createdAt') {
      valA = a.latestCreatedAt
      valB = b.latestCreatedAt
    }
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDir === 'asc' ? valA - valB : valB - valA
    }
    return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
  }, [foldersSortBy, sortDir])

  const sortedIndex = useMemo(() => {
    const list = [...index]
    list.sort(compareSummaries)
    return list
  }, [index, compareSummaries])

  // Recursive directory tree for 树状 mode
  const tree = useMemo(() => {
    if (foldersGroupBy !== 'parent') return null
    const nodes = buildFolderTree(index)
    const sortNodes = (list: TreeNode[]) => {
      list.sort(compareSummaries)
      list.forEach((n) => sortNodes(n.children))
    }
    sortNodes(nodes)
    return nodes
  }, [index, foldersGroupBy, compareSummaries])

  // Attach image cards from the store once they arrive (lean rows, no EXIF)
  const contentMap = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const img of images) {
      if (!img.filePath) continue
      const { dirPath } = parseDirectory(img.filePath)
      const list = map.get(dirPath)
      if (list) list.push(img)
      else map.set(dirPath, [img])
    }
    return map
  }, [images])

  const contentReady = !isLoading && images.length > 0

  // Remove every image under a folder prefix from the library (originals stay on disk)
  const handleRemoveFolder = useCallback(async (dirName: string, dirPath: string, count: number) => {
    if (count === 0) return
    if (!confirm(`确定要将「${dirName}」的 ${count} 张图片全部移出图库吗？\n此操作不会删除您磁盘上的原图文件，可随时重新导入。`)) return
    try {
      // Prefer in-memory lists; fall back to a prefix query for tree nodes
      // or rows whose content was never mounted.
      let list = contentMap.get(dirPath)
      if (!list || list.length !== count) {
        list = await window.api.getImages({ dirPath, nsfwFilter, search: searchQuery || undefined })
      }
      if (list.length === 0) return
      await window.api.deleteImagesBatch(list.map((img: any) => img.id))
      loadAll()
    } catch (err) {
      console.error(err)
    }
  }, [contentMap, nsfwFilter, searchQuery, loadAll])

  if (!indexLoaded) {
    return (
      <div className="folder-layout">
        <div className="folder-row__lazy-placeholder">正在加载文件夹索引…</div>
      </div>
    )
  }

  if (indexLoaded && sortedIndex.length === 0) {
    return (
      <div className="folder-layout__empty">
        <span className="folder-layout__empty-icon">📁</span>
        <span className="folder-layout__empty-title">{images.length === 0 ? '你的图库空空如也' : '未识别到文件夹'}</span>
        <span className="folder-layout__empty-desc">
          {images.length === 0
            ? '请点击右上角的“导入”按钮，或将文件夹拖拽到此处开始导入。'
            : '未能在图库图片的路径中解析出有效的文件夹。'}
        </span>
      </div>
    )
  }

  return (
    <div className="folder-layout">
      {tree ? (
        tree.map((node) => (
          <TreeNodeView
            key={node.dirPath}
            node={node}
            depth={0}
            contentMap={contentMap}
            contentReady={contentReady}
            layoutStyle={layoutStyle}
            foldersWrap={foldersWrap}
            gridSize={gridSize}
            onContextMenu={onContextMenu}
            onRemoveFolder={handleRemoveFolder}
          />
        ))
      ) : (
        sortedIndex.map((summary) => (
          <FolderRow
            key={summary.dirPath}
            summary={summary}
            images={contentMap.get(summary.dirPath)}
            contentReady={contentReady}
            layoutStyle={layoutStyle}
            foldersWrap={foldersWrap}
            gridSize={gridSize}
            onContextMenu={onContextMenu}
            onRemoveFolder={handleRemoveFolder}
          />
        ))
      )}
    </div>
  )
}
