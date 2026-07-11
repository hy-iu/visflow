import React from 'react'
import ReactDOM from 'react-dom'
import './ContextMenu.css'

export interface ContextMenuItem {
  label: string
  icon?: string
  onClick: () => void
  divider?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  position: { x: number; y: number }
  onClose: () => void
}

export default function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  // Ensure the menu stays within viewport boundaries
  const menuWidth = 180
  const menuHeight = items.length * 32
  const x = Math.min(position.x, window.innerWidth - menuWidth - 10)
  const y = Math.min(position.y, window.innerHeight - menuHeight - 10)

  return ReactDOM.createPortal(
    <>
      <div className="context-menu-overlay" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="context-menu" style={{ left: x, top: y }}>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {item.divider ? (
              <div className="context-menu__divider" />
            ) : (
              <div
                className="context-menu__item"
                onClick={() => {
                  item.onClick()
                  onClose()
                }}
              >
                {item.icon && <span className="context-menu__item-icon">{item.icon}</span>}
                <span className="context-menu__item-label">{item.label}</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </>,
    document.body
  )
}
