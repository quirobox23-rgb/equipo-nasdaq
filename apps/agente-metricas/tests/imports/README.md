# Batería de pruebas de importación

Cada caso es un CSV real exportado de la plataforma más lo que tiene que dar
la app (`cases.json`). Correr con:

    npm run test:imports

Para añadir un caso: copiar el CSV a esta carpeta y agregar una entrada en
`cases.json` con el formato esperado, la cantidad de trades, el PnL bruto, los
contratos y, si se conoce, el balance de la plataforma antes y después
(`platform`). Con el balance se comprueba que la comisión por contrato
calculada coincide con `commissionPerContract`.

`operations` es cuántas operaciones completas salen al juntar los cierres
parciales y los aumentos de una misma posición (`src/lib/operations.js`). Los
casos sintéticos de esa agrupación (parciales, reversión, cobertura, etc.) se
corren con:

    npm run test:operations
