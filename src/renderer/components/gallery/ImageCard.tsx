import React, { useState, useCallback } from 'react'
import './ImageCard.css'

interface ImageCardProps {
  image: any
  isSelected: boolean
  onSelect: (id: string, multi?: boolean) => void
  onOpen: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

function renderStars(rating: number) {
  const stars: React.ReactNode[] = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        className={
          i <= rating
            ? 'image-card__rating-star--filled'
            : 'image-card__rating-star--empty'
        }
      >
        {i <= rating ? '★' : '☆'}
      </span>
    )
  }
  return stars
}

export const ImageCard: React.FC<ImageCardProps> = React.memo(({
  image,
  isSelected,
  onSelect,
  onOpen,
  onContextMenu,
}) => {
  const [loaded, setLoaded] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        e.preventDefault()
        onSelect(image.id, true)
      } else {
        onOpen(image.id)
      }
    },
    [image.id, onSelect, onOpen]
  )

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect(image.id, e.shiftKey)
    },
    [image.id, onSelect]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu) {
        e.preventDefault()
        onContextMenu(e, image.id)
      }
    },
    [image.id, onContextMenu]
  )

  const handleLoad = useCallback(() => {
    setLoaded(true)
  }, [])

  const cardClass = [
    'image-card',
    isSelected && 'image-card--selected',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass} onClick={handleClick} onContextMenu={handleContextMenu}>
      {/* Shimmer placeholder */}
      {!loaded && <div className="image-card__shimmer" />}

      {/* Thumbnail image */}
      <img
        className={`image-card__img ${loaded ? 'image-card__img--loaded' : 'image-card__img--loading'}`}
        src={`thumb://${image.id}`}
        alt={image.fileName || ''}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={handleLoad}
      />

      {/* Hover overlay gradient */}
      <div className="image-card__overlay" />

      {/* Selection checkbox */}
      <div className="image-card__checkbox" onClick={handleCheckboxClick}>
        {isSelected ? '✓' : ''}
      </div>

      {/* Rating stars */}
      {image.rating > 0 && (
        <div className="image-card__rating">{renderStars(image.rating)}</div>
      )}
    </div>
  )
}, (prev, next) => {
  return prev.image.id === next.image.id &&
    prev.isSelected === next.isSelected &&
    prev.onSelect === next.onSelect &&
    prev.onOpen === next.onOpen &&
    prev.onContextMenu === next.onContextMenu
})
