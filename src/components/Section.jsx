import { useEffect, useMemo, useState } from 'react'
import Player from './Player.jsx'
import ChannelList from './ChannelList.jsx'
import { parseM3U, classify } from '../lib/m3u.js'
import { useLocalStorage } from '../lib/useLocalStorage.js'
import { viaProxy } from '../config.js'

const IPTV = 'https://iptv-org.github.io/iptv/'
const PRESETS = [
  ['Español (todos)', IPTV + 'languages/spa.m3u'],
  ['México', IPTV + 'countries/mx.m3u'],
  ['España', IPTV + 'countries/es.m3u'],
  ['Argentina', IPTV + 'countries/ar.m3u'],
  ['Colombia', IPTV + 'countries/co.m3u'],
  ['Chile', IPTV + 'countries/cl.m3u'],
  ['Perú', IPTV + 'countries/pe.m3u']
]
const TYPES = [['all', 'Todo'], ['pelicula', 'Películas'], ['serie', 'Series']]

// kind: 'live' = TV en vivo · 'vod' = series y películas (cada una con su propia fuente)
export default function Section({ kind, active }) {
  const vod = kind === 'vod'
  const [src, setSrc] = useLocalStorage(kind + ':src', vod ? '' : PRESETS[0][1])
  const [favs, setFavs] = useLocalStorage(kind + ':favs', [])
  const [urlInput, setUrlInput] = useState('')
  const [items, setItems] = useState([])
  const [msg, setMsg] = useState('')
  const [cur, setCur] = useState(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [tab, setTab] = useState('all')
  const [type, setType] = useState('all')
  const [srcOpen, setSrcOpen] = useState(!src)

  const apply = (list) => {
    const mapped = vod ? list.map(classify) : list
    setItems(mapped)
    setMsg(mapped.length ? '' : 'La lista no tiene contenido válido.')
    if (mapped.length) setSrcOpen(false)
  }

  useEffect(() => {
    if (!src) return
    const ctrl = new AbortController()
    setMsg('Cargando lista…')
    fetch(viaProxy(src), { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(); return r.text() })
      .then((t) => apply(parseM3U(t)))
      .catch((e) => {
        if (e.name === 'AbortError') return
        setItems([])
        setMsg('No se pudo cargar la lista. Revisa la URL y que el servidor permita acceso desde otras webs (CORS).')
      })
    return () => ctrl.abort()
  }, [src])

  const openFile = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    if (/\.m3u8?$/i.test(files[0].name)) return apply(parseM3U(await files[0].text()))
    apply(files.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ''), logo: '', group: 'Archivos locales', url: URL.createObjectURL(f) })))
  }

  const groups = useMemo(() => [...new Set(items.map((c) => c.group))].sort((a, b) => a.localeCompare(b)), [items])
  const view = useMemo(() => {
    const t = q.trim().toLowerCase()
    const v = items.filter((c) =>
      (tab === 'all' || favs.includes(c.url)) && (type === 'all' || c.kind === type) &&
      (!group || c.group === group) && (!t || c.name.toLowerCase().includes(t)))
    return type === 'serie' ? [...v].sort((a, b) => a.show.localeCompare(b.show) || a.season - b.season || a.ep - b.ep) : v
  }, [items, q, group, tab, type, favs])

  const step = (d) => {
    if (!view.length) return
    const i = cur ? view.findIndex((c) => c.url === cur.url) : -1
    setCur(view[(i + d + view.length) % view.length])
  }
  const toggleFav = (url) => setFavs((f) => (f.includes(url) ? f.filter((x) => x !== url) : [...f, url]))
  const loadUrl = () => urlInput.trim() && setSrc(urlInput.trim())

  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.target.matches('input,select,textarea')) return
      const k = e.key.toLowerCase()
      if (k === 'n') step(1)
      else if (k === 'p') step(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const info = msg || (!items.length && vod ? 'Agrega la URL de tu lista M3U o abre un archivo de tu celular para ver tus series y películas.' : '')

  return (
    <main hidden={!active}>
      <Player channel={cur} live={!vod} active={active} onPrev={() => step(-1)} onNext={() => step(1)} onEnded={() => vod && step(1)} />
      <aside className="side">
        <details className="source" open={srcOpen} onToggle={(e) => setSrcOpen(e.currentTarget.open)}>
          <summary>Fuente de {vod ? 'series y películas' : 'canales de TV'}</summary>
          <div className="srcbody">
            {!vod && (
              <select aria-label="Lista de canales" value={PRESETS.some((p) => p[1] === src) ? src : ''} onChange={(e) => e.target.value && setSrc(e.target.value)}>
                {!PRESETS.some((p) => p[1] === src) && <option value="">Lista personalizada</option>}
                {PRESETS.map(([n, u]) => <option key={u} value={u}>{n}</option>)}
              </select>
            )}
            <input type="url" placeholder="URL de tu lista .m3u" aria-label="URL de lista M3U" value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadUrl()} />
            <div className="row2">
              <button className="primary" onClick={loadUrl}>Cargar URL</button>
              <label className="btn">
                Archivo local
                <input type="file" hidden multiple={vod} accept={vod ? '.m3u,.m3u8,video/*' : '.m3u,.m3u8,text/plain'} onChange={openFile} />
              </label>
            </div>
          </div>
        </details>

        <div className="tools">
          <input type="search" placeholder={vod ? 'Buscar título' : 'Buscar canal'} aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
          {vod && (
            <div className="chips">
              {TYPES.map(([k, l]) => <button key={k} aria-pressed={type === k} onClick={() => setType(k)}>{l}</button>)}
            </div>
          )}
          <select aria-label="Categoría" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Todas las categorías</option>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
          <div className="tabs">
            <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Todos</button>
            <button aria-pressed={tab === 'fav'} onClick={() => setTab('fav')}>Favoritos</button>
            <span className="muted">{view.length} {vod ? 'títulos' : 'canales'}</span>
          </div>
        </div>

        {info ? (
          <div className="empty">{info}</div>
        ) : (
          <ChannelList view={view} current={cur} favs={favs} onPlay={setCur} onToggleFav={toggleFav}
            emptyText={tab === 'fav' ? 'Aún no tienes favoritos. Toca la estrella.' : 'No hay resultados con ese filtro.'} />
        )}
      </aside>
    </main>
  )
}
