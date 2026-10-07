// Cloudflare Worker: proxy https para canales http (solo para tus páginas)
const ALLOWED = ['https://lrdg-3d.github.io', 'http://localhost:5173']

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin') || ''
    const ok = ALLOWED.includes(origin)
    const cors = {
      'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0],
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length,Content-Range'
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (!ok) return new Response('Forbidden', { status: 403 })

    const self = new URL(req.url)
    const target = self.searchParams.get('url')
    if (!target || !/^https?:\/\//i.test(target)) return new Response('Falta ?url=', { status: 400, headers: cors })

    const headers = new Headers()
    const range = req.headers.get('Range')
    if (range) headers.set('Range', range)
    const r = await fetch(target, { headers, redirect: 'follow' })

    const type = r.headers.get('content-type') || ''
    const isPlaylist = /mpegurl/i.test(type) || /\.m3u8?(\?|$)/i.test(target)
    if (isPlaylist) {
      const text = await r.text()
      // Listas de canales (.m3u) se devuelven tal cual; solo se reescriben las HLS
      if (!text.includes('#EXT-X-')) return new Response(text, { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } })
      const prox = (u) => `${self.origin}/?url=${encodeURIComponent(new URL(u, r.url).href)}`
      const out = text.split('\n').map((l) => {
        const t = l.trim()
        if (!t) return l
        if (t.startsWith('#')) return l.replace(/URI="([^"]+)"/g, (_, u) => `URI="${prox(u)}"`)
        return prox(t)
      }).join('\n')
      return new Response(out, { headers: { ...cors, 'Content-Type': 'application/vnd.apple.mpegurl' } })
    }

    const h = new Headers(r.headers)
    for (const [k, v] of Object.entries(cors)) h.set(k, v)
    return new Response(r.body, { status: r.status, headers: h })
  }
}
