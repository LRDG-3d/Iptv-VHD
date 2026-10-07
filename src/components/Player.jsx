import { useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

const ICONS = {
  play: 'M8 5v14l11-7z',
  back: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z',
  fwd: 'M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z',
  rec: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  stop: 'M7 7h10v10H7z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
  mute: 'M3 9v6h4l5 5V4L7 9H3zm13.6 3l2.9-2.9-1.4-1.4-2.9 2.9-2.9-2.9-1.4 1.4 2.9 2.9-2.9 2.9 1.4 1.4 2.9-2.9 2.9 2.9 1.4-1.4z',
  fs: 'M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5zm12 0h2v5h-5v-2h3v-3z',
  fsx: 'M8 5h2v5H5V8h3V5zm6 0h2v3h3v2h-5V5zM5 14h5v5H8v-3H5v-2zm9 0h5v2h-3v3h-2v-5z',
  pip: 'M19 7h-8v6h8V7zm2-4H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H3V5h18v14z',
  prev: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  next: 'M16 6h2v12h-2zM6 18l8.5-6L6 6z',
  gear: 'M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1l-.4-2.7h-4l-.4 2.7a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z'
}

function Icon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={ICONS[name]} fill="currentColor" />
    </svg>
  )
}

const clock = (t) => {
  t = Math.floor(t || 0)
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0')
}

export default function Player({ channel, onPrev, onNext, live = true, active = true, onEnded }) {
  const boxRef = useRef(null)
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const timer = useRef(null)
  const uiRef = useRef(true)
  const wasHidden = useRef(false)

  const [status, setStatus] = useState({ msg: 'Elige un canal de la lista' })
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [vol, setVol] = useState(1)
  const [ui, setUi] = useState(true)
  const [isFs, setIsFs] = useState(false)
  const [levels, setLevels] = useState([])
  const [level, setLevel] = useState(-1)
  const [menu, setMenu] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [rec, setRec] = useState(false)
  const [recTime, setRecTime] = useState(0)
  const [toast, setToast] = useState('')
  const recRef = useRef(null)
  const chunks = useRef([])
  const toastT = useRef(null)

  /* ---------- Mostrar / ocultar controles ---------- */
  const wake = useCallback(() => {
    uiRef.current = true
    setUi(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        uiRef.current = false
        setUi(false)
      }
    }, 3000)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { if (!ui) setMenu(false) }, [ui])

  /* ---------- Carga del canal ---------- */
  useEffect(() => {
    const video = videoRef.current
    if (!channel) return
    const url = channel.url
    let hls = null
    let tries = 0

    setLevels([]); setLevel(-1); setMenu(false)
    video.removeAttribute('src')
    video.load()

    if (location.protocol === 'https:' && url.startsWith('http:')) {
      setStatus({ msg: 'Este canal usa http y el navegador lo bloquea en páginas https. Prueba otro canal.', err: true })
      return
    }
    setStatus({ msg: 'Conectando…', busy: true })

    const direct = () => {
      video.src = url
      video.play().catch(() => {})
    }

    if (Hls.isSupported() && !/\.(mp4|webm|m4v|mov|mkv)(\?|$)/i.test(url)) {
      hls = new Hls({ enableWorker: true })
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls.levels.map((l, i) => ({ i, h: l.height })).filter((l) => l.h).reverse())
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return
        if (d.details === 'manifestParsingError') {
          hls.destroy(); hls = null; hlsRef.current = null; direct(); return
        }
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && tries++ < 2) { hls.startLoad(); return }
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && tries++ < 2) { hls.recoverMediaError(); return }
        setStatus({ msg: 'Este canal no está disponible ahora. Prueba con otro.', err: true })
      })
    } else {
      direct()
    }
    wake()

    return () => {
      const mr = recRef.current
      if (mr && mr.state !== 'inactive') mr.stop()
      recRef.current = null
      setRec(false)
      if (hls) hls.destroy()
      hlsRef.current = null
    }
  }, [channel, wake])

  /* ---------- Acciones ---------- */
  const goLive = () => {
    const h = hlsRef.current
    if (live && h && h.liveSyncPosition) videoRef.current.currentTime = h.liveSyncPosition
  }
  const togglePlay = () => {
    const v = videoRef.current
    if (!channel) return
    if (v.paused) { goLive(); v.play().catch(() => {}) } else v.pause()
  }
  const toggleMute = () => { const v = videoRef.current; v.muted = !v.muted }
  const changeVol = (e) => {
    const v = videoRef.current
    v.volume = +e.target.value
    v.muted = v.volume === 0
  }
  const toggleFs = () => {
    const box = boxRef.current
    if (document.fullscreenElement) document.exitFullscreen()
    else if (box.requestFullscreen) box.requestFullscreen()
    else videoRef.current.webkitEnterFullscreen?.()
  }
  const pip = () => {
    const v = videoRef.current
    if (document.pictureInPictureEnabled && v.readyState) v.requestPictureInPicture().catch(() => {})
  }
  const pickLevel = (i) => {
    if (hlsRef.current) hlsRef.current.currentLevel = i
    setLevel(i); setMenu(false)
  }

  useEffect(() => { if (!active) videoRef.current?.pause() }, [active])
  const seekBy = (d) => { const v = videoRef.current; v.currentTime = Math.max(0, v.currentTime + d) }
  const seekTo = (e) => { videoRef.current.currentTime = +e.target.value }

  /* ---------- Grabación ---------- */
  const flash = (msg) => {
    setToast(msg)
    clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(''), 4000)
  }
  useEffect(() => () => clearTimeout(toastT.current), [])
  useEffect(() => {
    if (!rec) return
    const id = setInterval(() => setRecTime((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [rec])

  const startRec = () => {
    const v = videoRef.current
    const cap = v.captureStream || v.mozCaptureStream
    if (!cap || typeof MediaRecorder === 'undefined') {
      flash('Tu navegador no permite grabar desde la página.')
      return
    }
    if (!playing) { flash('Inicia el canal antes de grabar.'); return }
    try {
      const stream = cap.call(v)
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        .find((t) => MediaRecorder.isTypeSupported(t))
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const name = (channel?.name || 'canal').replace(/[^\w-]+/g, '_')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      chunks.current = []
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      mr.onstop = () => {
        const type = mr.mimeType || 'video/webm'
        const blob = new Blob(chunks.current, { type })
        chunks.current = []
        if (!blob.size) {
          flash('La grabación quedó vacía. Este canal no permite grabar desde la página.')
          return
        }
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${name}-${stamp}.${type.includes('mp4') ? 'mp4' : 'webm'}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 10000)
      }
      mr.start(1000)
      recRef.current = mr
      setRecTime(0)
      setRec(true)
    } catch {
      flash('No se pudo iniciar la grabación.')
    }
  }
  const stopRec = () => {
    const mr = recRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    recRef.current = null
    setRec(false)
  }
  const fmt = (t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Atajos: espacio/k pausa, m silencio, f pantalla completa
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches('input,select,textarea,button')) return
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'k') { e.preventDefault(); togglePlay() }
      else if (k === 'm') toggleMute()
      else if (k === 'f') toggleFs()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const idle = !ui && playing
  const stop = (e) => e.stopPropagation()

  return (
    <section className="stage">
      <div
        ref={boxRef}
        className={'screen' + (idle ? ' idle' : '')}
        onMouseMove={wake}
        onPointerDown={() => { wasHidden.current = !uiRef.current; wake() }}
        onClick={() => {
          if (wasHidden.current) { wasHidden.current = false; return }
          togglePlay()
        }}
        onDoubleClick={toggleFs}
      >
        <video
          ref={videoRef}
          playsInline
          disablePictureInPicture={false}
          onPlay={() => setPlaying(true)}
          onTimeUpdate={(e) => !live && setTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => !live && setDur(isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
          onEnded={onEnded}
          onPause={() => setPlaying(false)}
          onPlaying={() => setStatus(null)}
          onWaiting={() => channel && setStatus({ msg: 'Cargando…', busy: true })}
          onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVol(e.currentTarget.volume) }}
        />

        {status && (
          <div className={'status' + (status.err ? ' err' : '')}>
            {status.busy && <span className="spin" />}
            <span>{status.msg}</span>
          </div>
        )}

        {rec && (
          <div className="recbadge"><span className="dot" /> REC {fmt(recTime)}</div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}

        {channel && !playing && !status && (
          <div className="bigplay" aria-hidden="true"><Icon name="play" size={40} /></div>
        )}

        {channel && (
          <>
            <div className="top">
              {channel.logo && <img src={channel.logo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              <div>
                <strong>{channel.name}</strong>
                <span>{channel.group}</span>
              </div>
            </div>

            <div className="bar" onClick={stop} onDoubleClick={stop}>
              {!live && (
                <div className="seek">
                  <span>{clock(time)}</span>
                  <input type="range" min="0" max={dur || 0} step="1" value={Math.min(time, dur || 0)} onChange={seekTo} aria-label="Posición" />
                  <span>{clock(dur)}</span>
                </div>
              )}
              <div className="ctrl">
                <div className="grp">
                  <button className="ib" onClick={onPrev} aria-label="Anterior"><Icon name="prev" /></button>
                  {!live && <button className="ib" onClick={() => seekBy(-10)} aria-label="Retroceder 10 segundos"><Icon name="back" /></button>}
                  <button className="ib" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
                    <Icon name={playing ? 'pause' : 'play'} />
                  </button>
                  {!live && <button className="ib" onClick={() => seekBy(10)} aria-label="Adelantar 10 segundos"><Icon name="fwd" /></button>}
                  <button className="ib" onClick={onNext} aria-label="Siguiente"><Icon name="next" /></button>
                  {live && <button className="live" onClick={goLive} aria-label="Ir al directo"><span className="dot" /> EN VIVO</button>}
                </div>
                <div className="grp">
                  <div className="volume">
                    <button className="ib" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
                      <Icon name={muted || vol === 0 ? 'mute' : 'vol'} />
                    </button>
                    <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol} onChange={changeVol} aria-label="Volumen" />
                  </div>
                  {live && (
                    <button className={'ib' + (rec ? ' recording' : '')} onClick={rec ? stopRec : startRec} aria-label={rec ? 'Detener grabación' : 'Grabar'}>
                      <Icon name={rec ? 'stop' : 'rec'} />
                    </button>
                  )}
                  {levels.length > 1 && (
                    <div className="qwrap">
                      <button className="ib" onClick={() => setMenu(!menu)} aria-label="Calidad" aria-expanded={menu}><Icon name="gear" /></button>
                      {menu && (
                        <div className="menu" role="menu">
                          <button role="menuitemradio" aria-checked={level === -1} onClick={() => pickLevel(-1)}>Auto</button>
                          {levels.map((l) => (
                            <button key={l.i} role="menuitemradio" aria-checked={level === l.i} onClick={() => pickLevel(l.i)}>{l.h}p</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <button className="ib pipbtn" onClick={pip} aria-label="Mini reproductor"><Icon name="pip" /></button>
                  <button className="ib" onClick={toggleFs} aria-label="Pantalla completa"><Icon name={isFs ? 'fsx' : 'fs'} /></button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
