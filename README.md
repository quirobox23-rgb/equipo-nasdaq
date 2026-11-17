# Equipo Nasdaq

Una oficina de agentes que te acompaña cuando operas el Nasdaq y te escribe por WhatsApp.
**Da contexto y avisos de riesgo. Nunca da señales de entrada ni de salida.**

## Cómo está organizada

Un **equipo por activo** (hoy Nasdaq; Oro ya está como plantilla en `src/equipo/definiciones.ts`), más **servicios personales** comunes a todos los equipos y un **coordinador**.

| Pieza | Qué hace |
|---|---|
| **Equipo del activo** (`src/equipo/`) | |
| · Estructura (`estructura.ts`) | Vigila los niveles de **tu estrategia** (máx/mín de Asia, Londres, ayer, noche) y avisa cuando el precio se acerca, los barre, los recupera o se queda al otro lado ("ya no parece un barrido, parece una ruptura en contra"). Añade volumen y posición respecto al VWAP. Siempre termina en "la decisión es tuya". |
| · Volatilidad y rango (`grafico.ts`) | Cuánto se mueve el activo de media al día (ATR de 14 días, en puntos: "cuenta con movimientos de unos 300 puntos"), nivel y saltos del VIX (o del GVZ en oro), y si el día ya va más largo de lo normal. |
| · Volumen (`grafico.ts`) | Volumen relativo a la misma hora de días anteriores. |
| · Noticias (`noticias.ts`) | Titulares (Fed, CNBC, MarketWatch) filtrados por palabras clave del activo y valorados con Claude. |
| · Macro (`macro.ts`) | Calendario de EE. UU. con hora exacta y ventanas de "no operes ahora" alrededor de CPI, NFP, FOMC, Warsh… |
| · Fed (`fed.ts`) | Discursos, actas y decisiones de tipos del día, con la ficha de quien habla (cargo, tono, si vota). Las fichas están en `config/fed.json`: añade a los miembros que quieras. |
| · Resultados (`earnings.ts`) | Solo las empresas que mueven el NQ (Nvidia, Apple, Microsoft, Amazon, Meta, Google, Tesla, Broadcom…): si presentan hoy antes de la apertura o después del cierre, qué espera el consenso y, si presentaron ayer tras el cierre, cómo salió. Nunca adivina el sentido. Necesita `FINNHUB_KEY` (gratis en finnhub.io). |
| **Servicios personales** (`src/personal/`) | |
| · Coach (`coach.ts`) | Te pregunta cómo estás, si has comido, tus **hábitos** (los que pongas en `config/coach.json`: meditar, boxeo…), si te ves en condiciones de operar y tu **sesgo** del día. Calcula tu aptitud y, según tu sesgo y las noticias de hoy, te dice con qué tener cuidado. Al cierre compara tu sesgo con lo que hizo el mercado y el domingo te da el recuento de la semana. Ficha preparada para el reloj (VFC, pulso, estrés). |
| · Gestor de cuentas (`gestor.ts`, `factorMetricas.ts`) | "Tienes 5 cuentas activas: 3 fondeadas y 2 en challenge." Lee tus cuentas activas y operaciones de **Factor Métricas** (solo lectura) y calcula el drawdown igual que la app. "Ojo con esta" al 50% y 80% de la pérdida diaria o cerca del drawdown. Sin Factor Métricas, usa `config/cuentas.json` y tus mensajes `pnl …`. |
| **Coordinador** (`src/coordinador.ts`) | Junta todo, pone el semáforo de **riesgo** 🟢🟠🔴 (los avisos de tu estrategia van aparte con 📍 y no lo cambian) y redacta con Claude. Si el texto pareciera una señal ("compra", "ponte corto"…), usa la plantilla. |

## La oficina en pantalla

Con `npm start`, abre `http://localhost:3000/oficina`: la oficina en 3D (sala de operaciones, despacho, sala de reuniones, zona de descanso, gimnasio y terraza con piscina, jardín y mascotas). Se puede girar, acercar y saltar a cada sala. Cuando un agente tiene un aviso camina a su mesa y se pone a trabajar (etiqueta roja si es una alerta); cuando no hay nada, se va a descansar. A la derecha, el semáforo y lo último que ha dicho cada uno. Se actualiza sola cada 30 segundos con lo que guarda la oficina en `data/estado-oficina.json`.

## Tu estrategia

Se define en `config/estrategias/<equipo>.json`. La de Nasdaq viene con tu escenario de barrido de liquidez de Asia:

- `niveles`: qué niveles vigilar (`asia`, `londres`, `ayer`, `noche`).
- `vigilar`: qué fases avisar (`aproximacion`, `barrido`, `recuperacion`, `aceptacion`).
- `distanciaAproximacion`: a cuántos puntos cuenta como "se acerca".
- `minutosAceptacion`: cuántos minutos cerrando al otro lado convierten un barrido en ruptura.
- `ventana`: horas de Nueva York en las que vigilar (por defecto 02:00 a 11:30, de Londres a la primera parte de NY).
- `sesiones`: horas de Asia y Londres en Nueva York.

Para añadir otro activo: `EQUIPOS=nasdaq,gold` en `.env` y un `config/estrategias/gold.json`.

Con `SOLO_TEXTO=1` los mensajes no llevan precios exactos, solo contexto (el modo pensado para clientes, sin licencia de redistribución de CME).

## Horario

| Cuándo (hora de España) | Qué |
|---|---|
| 08:30 de lunes a viernes | Guía del día: fecha, macro y Fed, resultados, cuentas, volatilidad y rango esperado, y la pregunta del coach (hábitos, condiciones y sesgo) |
| 15:00 (09:00 Nueva York) | Antes de la apertura: qué ha cambiado, noticias, tu aptitud y tus cuentas |
| 08:00 a 17:30, cada 5 min | Vigilancia: avisos de tu estrategia (desde Londres) y de riesgo. Solo escribe si hay algo nuevo; los de riesgo tienen un máximo por hora |
| 22:15 (16:15 Nueva York) | Cierre del día |
| Domingo 19:00 | Resumen semanal: semana que viene, cómo has estado, cuentas y briefing de Factor Macro |

Las tareas de mercado van en hora de Nueva York, así que los cambios de hora de EE. UU. y Europa no las descuadran.

## Hablarle a la oficina (Telegram o WhatsApp)

- Cualquier mensaje se toma como tu check-in del día: `7h, sí, comido bien, medité, tranquila, me veo bien, bajista`. Puedes contestar en varias veces.
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

### Telegram (gratis, recomendado para empezar)

1. En Telegram, habla con @BotFather, envía `/newbot` y copia el token en `TELEGRAM_TOKEN`.
2. Escribe `/start` a tu bot y ejecuta `npm run tarea -- telegram-id`; copia el número en `TELEGRAM_CHAT_ID`.
3. `npm start`: la oficina te escribe por Telegram y lee tus respuestas sin necesidad de servidor público.

### WhatsApp

Hace falta la WhatsApp Cloud API de Meta (no basta la app de WhatsApp Business del móvil):

1. En developers.facebook.com, una app de tipo Business con el producto WhatsApp y un número para la oficina.
2. Un token permanente (usuario del sistema) en `WHATSAPP_TOKEN` y el id del número en `WHATSAPP_PHONE_NUMBER_ID`.
3. El webhook apuntando a `https://<tu-servidor>/webhook` con el mismo `WHATSAPP_VERIFY_TOKEN`, suscrito a `messages`.
4. Una plantilla de tipo *Utility* llamada `aviso_oficina`, en español, con el cuerpo `{{1}}`. Meta solo deja escribir texto libre en las 24 h siguientes a tu último mensaje; fuera de esa ventana la oficina usa la plantilla. Contestar al check-in de la mañana mantiene la ventana abierta todo el día.

### Dónde alojarla

Necesita estar encendida en horario de mercado (horarios + escucha de mensajes): Railway, Render o un VPS pequeño. Guarda su estado en `DATA_DIR` (por defecto `./data`), así que usa un disco persistente.

## Próximas fases

- Conexión de solo lectura con Tradovate para las cuentas, si tu firma lo permite.
- Seguimiento de cuentas concretas de X.
- Datos del reloj (Garmin, Apple Health, Oura o Whoop) en la ficha de bienestar.
