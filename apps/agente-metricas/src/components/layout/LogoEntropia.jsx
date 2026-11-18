// Logo de Entropia (public/entropia-logo*.png): blanco en oscuro, grafito en claro,
// con el nombre del módulo al lado.
export default function LogoEntropia({ alto = 22, modulo = 'Analytics' }) {
  return (
    <span className="logo-entropia">
      <img src={`${import.meta.env.BASE_URL}entropia-logo.png`} alt="entropia" className="logo-oscuro" style={{ height: alto }} />
      <img src={`${import.meta.env.BASE_URL}entropia-logo-oscuro.png`} alt="entropia" className="logo-claro" style={{ height: alto }} />
      {modulo && <span className="logo-modulo" style={{ fontSize: Math.max(10, alto * 0.48) }}>{modulo}</span>}
    </span>
  )
}
