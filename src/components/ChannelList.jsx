import { useEffect, useState } from 'react'

const PAGE = 120

export default function ChannelList({ view, current, favs, onPlay, onToggleFav, emptyText }) {
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [view])

  if (!view.length) return <div className="empty">{emptyText}</div>

  return (
    <>
      <ul>
        {view.slice(0, limit).map((c) => {
          const fav = favs.includes(c.url)
          return (
            <li
              key={c.url}
              className={current && current.url === c.url ? 'on' : ''}
              tabIndex={0}
              onClick={() => onPlay(c)}
              onKeyDown={(e) => e.key === 'Enter' && onPlay(c)}
            >
              {c.logo ? (
                <img loading="lazy" src={c.logo} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              ) : (
                <i />
              )}
              <span className="n">
                {c.name}
                <small>{c.sub || c.group}</small>
              </span>
              <button
                className="fav"
                aria-pressed={fav}
                aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                onClick={(e) => { e.stopPropagation(); onToggleFav(c.url) }}
              >
                {fav ? '★' : '☆'}
              </button>
            </li>
          )
        })}
      </ul>
      {limit < view.length && (
        <button className="more" onClick={() => setLimit(limit + PAGE)}>Mostrar más canales</button>
      )}
    </>
  )
}
