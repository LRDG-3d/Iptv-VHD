// Convierte el texto de una lista M3U en un arreglo de canales
export function parseM3U(text) {
  const out = []
  let meta = null
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim()
    if (!l) continue
    if (l.startsWith('#EXTINF')) {
      const attr = (k) => (l.match(new RegExp(k + '="([^"]*)"', 'i')) || [])[1] || ''
      meta = {
        name: l.slice(l.lastIndexOf(',') + 1).trim() || attr('tvg-name') || 'Canal',
        logo: attr('tvg-logo'),
        group: attr('group-title').split(';')[0] || 'Sin categoría'
      }
    } else if (!l.startsWith('#') && meta) {
      out.push({ ...meta, url: l })
      meta = null
    }
  }
  return out
}

// Clasifica un item como serie o película (para la sección de series y películas)
export function classify(c) {
  const m = c.name.match(/(.*?)[\s._-]*S(\d{1,2})\s?E(\d{1,3})/i)
  if (m || /serie/i.test(c.group)) {
    const show = (m && m[1].trim()) || c.group
    return { ...c, kind: 'serie', show, season: m ? +m[2] : 0, ep: m ? +m[3] : 0, sub: m ? `${show} · T${+m[2]} E${+m[3]}` : c.group }
  }
  return { ...c, kind: 'pelicula', sub: c.group }
}
