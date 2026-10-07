// URL de tu Cloudflare Worker (sin barra al final). Ejemplo:
// export const PROXY = 'https://iptv-proxy.tuusuario.workers.dev'
export const PROXY = 'iptv-vhd.e-je-mployajwhw.workers.dev'

// En páginas https, los canales http pasan por el proxy (si está configurado)
export const viaProxy = (u) =>
  PROXY && u.startsWith('http:') && location.protocol === 'https:'
    ? PROXY + '/?url=' + encodeURIComponent(u)
    : u
