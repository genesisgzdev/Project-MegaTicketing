import CyberArena from './CyberArena';

export default function App() {
  return <div className="app-shell">
    <header className="site-header"><a href="#main" className="wordmark" aria-label="MegaTicketing, ir al contenido">mega<span>ticketing</span><span className="brand-dot" /></a><span className="header-note">Tu próximo plan empieza aquí</span></header>
    <main id="main"><div className="intro"><p className="eyebrow">Encuentra tu lugar</p><h1>Menos vueltas.<br /><span>Más ganas de ir.</span></h1><p>Elige un evento, encuentra tus asientos y revisa tu selección con la disponibilidad actual.</p></div><CyberArena /></main>
    <footer className="site-footer"><span>MegaTicketing</span><span>El precio y la disponibilidad se consultan al organizador.</span></footer>
  </div>;
}
