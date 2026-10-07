import { useState } from 'react'
import Section from './components/Section.jsx'

export default function App() {
  const [tab, setTab] = useState('live')
  return (
    <div className="app">
      <header>
        <h1>Mi IPTV</h1>
        <nav className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'live'} onClick={() => setTab('live')}>TV en vivo</button>
          <button role="tab" aria-selected={tab === 'vod'} onClick={() => setTab('vod')}>Series y películas</button>
        </nav>
      </header>
      <Section kind="live" active={tab === 'live'} />
      <Section kind="vod" active={tab === 'vod'} />
    </div>
  )
}
