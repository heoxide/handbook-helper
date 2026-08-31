import { getFluffImagesFromDetail, type FluffImageInfo } from '../../../shared/fluff-images'

export function FluffImageGallery({
  images,
  detail,
  className = 'fluff-images'
}: {
  images?: FluffImageInfo[]
  detail?: unknown
  className?: string
}) {
  const resolved = images?.length ? images : detail ? getFluffImagesFromDetail(detail) : []
  if (!resolved.length) return null

  return (
    <div className={className}>
      {resolved.map((img, index) => (
        <figure key={`${img.url}-${index}`} className="fluff-image-figure">
          <img
            className="fluff-image"
            src={img.url}
            alt={img.title ?? img.credit ?? 'Illustration'}
            width={img.width}
            height={img.height}
            loading="lazy"
            decoding="async"
          />
          {(img.title || img.credit) && (
            <figcaption className="fluff-image-caption">
              {img.title && <span className="fluff-image-title">{img.title}</span>}
              {img.credit && <span className="fluff-image-credit">{img.credit}</span>}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}
