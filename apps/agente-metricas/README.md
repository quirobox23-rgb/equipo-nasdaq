# Agente Métricas

El diario y las métricas de trading de Equipo Nasdaq: cuentas de fondeo, drawdown, métricas, mapas, rutina diaria e importación de operaciones desde CSV de muchas plataformas (Tradovate, NinjaTrader, Rithmic, Topstep, MT4/MT5, TradingView...).

Parte del código de Factor Métricas (copiado el 17-11-2026 desde `santos-trader-factor-metricas`, commit `acccb65`) con nombre, colores (azul, antracita y cian), tipografía (Space Grotesk + Inter) y distribución propios: navegación en pestañas horizontales. Es independiente: usa su propio Supabase, sin analítica, emails ni enlaces de Factor.

## Arrancar

```bash
cd apps/agente-metricas
cp env.example .env.local   # tu Supabase propio y los emails de admin
npm install
npm run dev
```

Sin Supabase configurado funciona en modo local con datos de ejemplo. Para la base de datos: proyecto nuevo en supabase.com y cargar `supabase/schema.sql` (cambia antes el email de admin del final).

---

## Notas del original

# EdgeLog · Trading Journal

Aplicación profesional de trading journal para traders de fondeo.

## Stack

- **React 18** + **Vite**
- **React Router v6** — navegación por páginas
- **Zustand** — estado global persistente
- **Recharts** — gráficos
- **date-fns** — utilidades de fecha

## Instalación

```bash
# 1. Entrar a la carpeta
cd edgelog

# 2. Instalar dependencias
npm install

# 3. Arrancar en desarrollo
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

## Estructura

```
edgelog/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx              ← Entry point
    ├── App.jsx               ← Router + rutas
    ├── index.css             ← Variables CSS globales + base styles
    ├── data/
    │   └── mockData.js       ← Datos simulados (trades, cuentas, cashflow)
    ├── store/
    │   └── useStore.js       ← Zustand store (trades, accounts, ritual, ui)
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.jsx          ← Sidebar + layout principal
    │   │   └── AppShell.module.css
    │   └── ui/
    │       └── index.jsx             ← Componentes reutilizables
    └── pages/
        ├── WeeklySummary.jsx   ✅ completa
        ├── Dashboard.jsx       ✅ completa
        ├── Portfolio.jsx       ✅ completa
        ├── Historial.jsx       ✅ completa
        ├── Approach.jsx        ✅ completa
        ├── Calendar.jsx        🔧 placeholder
        ├── MonteCarlo.jsx      🔧 placeholder
        ├── Kelly.jsx           🔧 placeholder
        ├── Rentabilidad.jsx    🔧 placeholder
        └── IaMentor.jsx        🔧 placeholder
```

## Páginas completadas

| Página | Ruta | Estado |
|--------|------|--------|
| Weekly Summary | `/weekly` | ✅ |
| Dashboard | `/dashboard` | ✅ |
| Portfolio | `/portfolio` | ✅ |
| Historial | `/historial` | ✅ |
| Approach/Mindset | `/approach` | ✅ |
| Calendar | `/calendar` | 🔧 |
| Monte Carlo | `/montecarlo` | 🔧 |
| Kelly / Sizing | `/kelly` | 🔧 |
| Rentabilidad | `/rentabilidad` | 🔧 |
| IA Mentor | `/ia` | 🔧 |

## Zustand Store

El store global está en `src/store/useStore.js` con estos slices:

- **tradesSlice** — CRUD de trades + selectores calculados
- **accountsSlice** — gestión de cuentas de fondeo
- **ritualSlice** — checklist pre-trade por fecha
- **cashflowSlice** — movimientos de inversión/payout
- **uiSlice** — filtros, fecha activa, formulario nuevo trade

Los datos se persisten en `localStorage` automáticamente via `zustand/middleware/persist`.
