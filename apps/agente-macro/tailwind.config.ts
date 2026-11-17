import type { Config } from 'tailwindcss'

// Tokens de marca — mismos valores que santos-trader-design.css /
// paleta-2-verde-santos.css (Paleta 2 — Verde Santos), llevados a Tailwind
// porque este proyecto es Tailwind-first (a diferencia del HTML estático
// de Agente Métricas, que consume las variables CSS directamente).
//
// Reglas (no renegociar sin motivo — ver buenas-practicas-ui-design.md):
//   - brand/brand-deep/accent: SOLO marca — botones,
//     CTAs, íconos de acción/navegación, links, focus rings. Nunca para
//     mostrar un resultado. Equivalen a --brand/--brand-deep/
//     --accent en Agente Métricas — nombre compuesto (no "green"/
//     "lime" sueltos) porque esos ya existen en la paleta nativa de
//     Tailwind (green-500, lime-400...) y colisionarían en silencio.
//   - pos/neg/neutral (semáforo): SOLO para resultados — sesgo alcista/
//     bajista/neutral, escenarios beat/inline/miss, regime risk-on/off.
//     Independiente de la marca a propósito.
//   - base.*: neutros de interfaz (fondo, paneles, bordes, texto).
//     Equivalen a --bg/--bg2/--bg3/--text/--text2 en Agente Métricas —
//     mismos valores, nombre namespaced bajo "base" en vez de sueltos
//     por legibilidad Tailwind (bg-base-bg en vez de bg-bg).
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // brand vía variable CSS (ver globals.css :root/
        // [data-theme="light"]) — a diferencia de secondary/tertiary,
        // cambia en claro (pasa a valer lo mismo que brand-deep,
        // el verde vivo no se lee bien sobre blanco). .btn-primary
        // hardcodea el hex real en vez de usar esta clase, para que el
        // botón con gradiente siga vivo en los dos temas — ver globals.css.
        'brand': { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', dim: '#1f8a1e' },
        // brand-deep — segundo acento de marca, en uso activo (gradiente
        // de marca, btn-primary, ai-bubble). Reemplazó al lima como segundo
        // tono del --accent-gradient (antes green→tertiary/lima, ahora
        // secondary→green, oscuro → claro). accent (el lima original) queda de
        // suplente, sin uso activo. Ninguno de los dos cambia por tema.
        'brand-deep': { DEFAULT: '#1E40AF' },
        'accent': { DEFAULT: '#22D3EE' },
        pos: { DEFAULT: '#5aa469', dim: '#1c3323' },
        neg: { DEFAULT: '#ed553b', dim: '#3a221d' },
        neutral: { DEFAULT: '#f6d55c', dim: '#3a3220' },
        // base.* usa variables CSS (canales RGB espacio-separados, ver
        // globals.css) para poder cambiar de tema con [data-theme="light"]
        // sin perder el soporte de opacidad de Tailwind (bg-base-panel2/60).
        // pos/neg/neutral/brand-deep/accent quedan arriba con
        // hex fijo — mismo valor en dark y light. brand es la única
        // excepción (ver nota arriba), igual que en Agente Métricas.
        base: {
          bg: 'rgb(var(--base-bg) / <alpha-value>)',
          panel: 'rgb(var(--base-panel) / <alpha-value>)',
          panel2: 'rgb(var(--base-panel2) / <alpha-value>)',
          line: 'rgb(var(--base-line) / <alpha-value>)',
          text: 'rgb(var(--base-text) / <alpha-value>)',
          muted: 'rgb(var(--base-muted) / <alpha-value>)',
          // Tercer tono de gris — equivalente a --text3 en Factor
          // Métricas (más apagado que muted, para captions).
          faint: 'rgb(var(--base-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
