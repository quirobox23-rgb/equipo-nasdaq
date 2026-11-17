# Equipo Nasdaq

Una oficina de agentes que te acompaña cuando operas el Nasdaq y te escribe por WhatsApp.
**Da contexto y avisos de riesgo. Nunca da señales de entrada ni de salida.**

## El equipo

| Agente | Qué hace |
|---|---|
| Jefe de oficina (`src/agentes/jefe.ts`) | Junta lo que dicen los demás, pone el semáforo 🟢🟠🔴 y redacta el mensaje con Claude. Si el texto pareciera una señal ("compra", "ponte corto"…), lo descarta y usa la plantilla. |
| Macro (`macro.ts`) | Calendario económico de EE. UU. con hora exacta (el mismo feed que usa Factor Macro). Marca ventanas de "no operes ahora" alrededor de CPI, NFP, FOMC, discursos de Warsh, etc. |
| Noticias (`noticias.ts`) | Lee titulares (Fed, CNBC, MarketWatch), filtra por palabras clave y, con Claude, valora si pueden mover el Nasdaq. |
| Gráfico (`grafico.ts`) | NQ y VIX en velas de 5 min: máximo/mínimo de ayer y de la noche, rango medio, volumen relativo a la misma hora y saltos de volatilidad. |
| Bienestar (`bienestar.ts`) | Te pregunta cómo estás, entiende respuestas como "6h, sí, nerviosa" y calcula una nota de aptitud para operar. La ficha ya tiene campos para el reloj (VFC, pulso en reposo, estrés). |
| Cuentas (`cuentas.ts`) | Reglas de tus cuentas de fondeo: pérdida diaria, drawdown (trailing o estático) y objetivo. Avisa "ojo con esta" al 50% y al 80% de la pérdida diaria o cerca del drawdown. |

## Horario

| Cuándo (hora de España) | Qué |
|---|---|
| 08:30 de lunes a viernes | Guía del día: agenda macro, niveles, cuentas y pregunta de bienestar |
| 15:00 (09:00 Nueva York) | Antes de la apertura: qué ha cambiado, noticias, tu aptitud y tus cuentas |
| 15:30 a 17:30, cada 5 min | Vigilancia: solo escribe si hay algo nuevo, con un máximo de avisos por hora |
| 22:15 (16:15 Nueva York) | Cierre del día |
| Domingo 19:00 | Resumen semanal: semana que viene, cómo has estado, cuentas y briefing de Factor Macro |

Las tareas de mercado van en hora de Nueva York, así que los cambios de hora de EE. UU. y Europa no las descuadran.

## Hablarle a la oficina por WhatsApp

- Cualquier mensaje se toma como tu check-in del día: `7h, sí, tranquila`.
- Para actualizar una cuenta: `pnl cuenta1 -250` o `pnl cuenta1 -250 saldo 49750`.

## Puesta en marcha

```bash
npm install
cp .env.example .env              # y rellénalo
cp config/cuentas.ejemplo.json config/cuentas.json   # y pon tus reglas
npm test
npm run tarea -- guia             # prueba una tarea a mano (sin WhatsApp sale por consola)
npm start                         # arranca horarios y webhook
```

### WhatsApp

Hace falta la WhatsApp Cloud API de Meta (no basta la app de WhatsApp Business del móvil):

1. En developers.facebook.com, una app de tipo Business con el producto WhatsApp y un número para la oficina.
2. Un token permanente (usuario del sistema) en `WHATSAPP_TOKEN` y el id del número en `WHATSAPP_PHONE_NUMBER_ID`.
3. El webhook apuntando a `https://<tu-servidor>/webhook` con el mismo `WHATSAPP_VERIFY_TOKEN`, suscrito a `messages`.
4. Una plantilla de tipo *Utility* llamada `aviso_oficina`, en español, con el cuerpo `{{1}}`. Meta solo deja escribir texto libre en las 24 h siguientes a tu último mensaje; fuera de esa ventana la oficina usa la plantilla. Contestar al check-in de la mañana mantiene la ventana abierta todo el día.

### Dónde alojarla

Necesita estar encendida todo el día (horarios + webhook): Railway, Render o un VPS pequeño. Guarda su estado en `DATA_DIR` (por defecto `./data`), así que usa un disco persistente.

## Próximas fases

- Conexión de solo lectura con Tradovate para las cuentas, si tu firma lo permite.
- Seguimiento de cuentas concretas de X.
- Datos del reloj (Garmin, Apple Health, Oura o Whoop) en la ficha de bienestar.
