# Entropia Markets

La pestaña de macro de Entropia: calendario económico con lo que espera el mercado, volatilidad y rango del NQ, geopolítica, resultados de las grandes del Nasdaq y análisis semanal.

Parte del código de Factor Macro (copiado el 17-11-2026 desde `santos-trader-factor-macro`, commit `923dea3`) con nombre, colores (azul, antracita y cian), tipografía (Space Grotesk + Inter) y distribución propios: navegación en pestañas horizontales en lugar de barra lateral. Es independiente: no comparte claves, base de datos, login ni analítica con Factor Macro.

## Arrancar

```bash
cd apps/agente-macro
cp .env.example .env.local   # y rellena tus propias claves
npm install
npm run dev                  # http://localhost:3001
```

Sin Firebase configurado no se puede entrar a las pestañas (piden sesión).
