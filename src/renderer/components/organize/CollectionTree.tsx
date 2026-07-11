import React, { useState } from 'react'
import { useViewStore } from '../../stores/useViewStore'
import { CollectionTreeNode } from '../../lib/utils'
import './CollectionTree.css'

interface CollectionTreeProps {
  nodes: CollectionTreeNode[]
  level?: number
  onContextMenu?: (e: React.MouseEvent, node: any) => void
}

export default function CollectionTree({ nodes, level = 0, onContextMenu }: CollectionTreeProps) {
  const currentView = useViewStore((s) => s.currentView)
  const currentViewId = useViewStore((s) => s.currentViewId)
  const navigateTo = useViewStore((s) => s.navigateTo)

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleNodeClick = (node: CollectionTreeNode) => {
    navigateTo('collection', node.id, node.name)
  }

  const startEditing = (node: CollectionTreeNode, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNodeId(node.id)
    setEditValue(node.name)
  }

  const saveRename = async (id: string) => {
    if (editValue.trim() === '') return
    try {
      await window.api.updateCollection(id, { name: editValue })
      // Trigger a state reload in the parent store
      const loadCollections = (await import('../../stores/useLibraryStore')).useLibraryStore.getState().loadCollections
      loadCollections()
    } catch (err) {
      console.error(err)
    } finally {
      setEditingNodeId(null)
    }
  }

  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedNodes.has(node.id)
        const isActive = currentView === 'collection' && currentViewId === node.id
        const hasChildren = node.children && node.children.length > 0
        const isEditing = editingNodeId === node.id

        return (
          <React.Fragment key={node.id}>
            <div
              className={`collection-tree__node ${isActive ? 'collection-tree__node--active' : ''}`}
              style={{ paddingLeft: `${16 + level * 16}px` }}
              onClick={() => handleNodeClick(node)}
              onDoubleClick={(e) => startEditing(node, e)}
              onContextMenu={(e) => onContextMenu && onContextMenu(e, node)}
            >
              <span
                className={`collection-tree__arrow ${!hasChildren ? 'collection-tree__arrow--hidden' : ''} ${isExpanded ? 'collection-tree__arrow--expanded' : ''}`}
                onClick={(e) => toggleExpand(node.id, e)}
              >
                ▸
              </span>
              <span className="collection-tree__icon">📁</span>
              {isEditing ? (
                <input
                  type="text"
                  className="collection-tree__rename-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveRename(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(node.id)
                    else if (e.key === 'Escape') setEditingNodeId(null)
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="collection-tree__name">{node.name}</span>
              )}
              {node.imageCount > 0 && <span className="collection-tree__badge">{node.imageCount}</span>}
              <div className="collection-tree__actions">
                <button
                  className="collection-tree__action-btn"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (confirm(`确定要删除分类 "${node.name}" 吗？此操作不会删除本地图片本身。`)) {
                      try {
                        await window.api.deleteCollection(node.id)
                        const loadCollections = (await import('../../stores/useLibraryStore')).useLibraryStore.getState().loadCollections
                        loadCollections()
                        const viewStore = (await import('../../stores/useViewStore')).useViewStore.getState()
                        if (viewStore.currentView === 'collection' && viewStore.currentViewId === node.id) {
                          viewStore.navigateTo('all')
                        }
                      } catch (err) {
                        console.error(err)
                      }
                    }
                  }}
                  title="删除分类"
                >
                  🗑️
                </button>
              </div>
            </div>

            {hasChildren && isExpanded && (
              <div className="collection-tree__children">
                <CollectionTree nodes={node.children} level={level + 1} onContextMenu={onContextMenu} />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}
