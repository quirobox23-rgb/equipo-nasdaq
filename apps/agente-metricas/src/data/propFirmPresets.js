// ─────────────────────────────────────────────
//  PROP FIRM PRESETS
//
//  Biblioteca de reglas por firma/programa, para que un trader no
//  tenga que saber de memoria qué % de drawdown o qué tipo de límite
//  usa su firma — lo elige por nombre y el formulario se autocompleta.
//
//  IMPORTANTE — estas reglas las cambian las propias firmas sin
//  avisar. Cada preset lleva `verifiedAt` (última vez que se
//  confirmó contra fuentes públicas) y una `note` con matices que NO
//  se pueden reducir a un número (fases, reglas de consistencia,
//  días mínimos). El preset es un punto de partida, no un sustituto
//  de revisar las reglas actuales en la web de la firma antes de
//  operar dinero real — así se lo mostramos siempre al usuario.
//
//  drawdownType usa los mismos valores que config/drawdownEngine.js
//  (DRAWDOWN_TYPES): 'static' | 'trailing_eod'.
//
//  Añadir una firma nueva = añadir un objeto aquí. No toca ningún
//  otro archivo.
// ─────────────────────────────────────────────

export const PROP_FIRM_PRESETS = [
  {
    id: 'ftmo-2step',
    firm: 'FTMO',
    label: 'FTMO — Challenge 2 pasos',
    phase: 'Phase 1',
    profitTarget: 10,
    maxDrawdown: 10,
    maxDailyDD: 5,
    drawdownType: 'static',
    note: 'Fase 1: objetivo 10%. Fase 2 (Verification): objetivo baja a 5%, mismos límites de pérdida. Mínimo 4 días de trading por fase, sin límite de tiempo.',
    verifiedAt: '2026-08',
  },
  {
    id: 'ftmo-1step',
    firm: 'FTMO',
    label: 'FTMO — Challenge 1 paso',
    phase: 'Phase 1',
    profitTarget: 10,
    maxDrawdown: 10,
    maxDailyDD: 3,
    drawdownType: 'trailing_eod',
    note: 'Un solo paso, objetivo 10%. Incluye "Best Day Rule" (regla de consistencia) — configurala manualmente si tu challenge la exige.',
    verifiedAt: '2026-08',
  },
  {
    id: 'the5ers-highstakes',
    firm: 'The5ers',
    label: 'The5ers — High Stakes',
    phase: 'Phase 1',
    profitTarget: 10,
    maxDrawdown: 10,
    maxDailyDD: 5,
    drawdownType: 'static',
    note: 'Fase 1: objetivo 10%. Fase 2: objetivo baja a 5%. Mínimo 3 días de trading.',
    verifiedAt: '2026-08',
  },
  {
    id: 'apex-50k-eod',
    firm: 'Apex Trader Funding',
    label: 'Apex Trader Funding — $50K EOD (post 4.0)',
    phase: 'Phase 1',
    size: 50000,
    profitTarget: 6,     // $3,000 sobre $50,000
    maxDrawdown: 4,      // $2,000 trailing, sobre $50,000
    maxDailyDD: 2,       // $1,000 DLL, sobre $50,000
    drawdownType: 'trailing_eod',
    note: 'Regla EOD por defecto desde Apex 4.0 (marzo 2026): trailing se congela al llegar al balance inicial + $100. Sin límite de días mínimos en evaluación; en cuenta financiada, regla de consistencia del 50% (el mejor día no puede superar el 50% del profit total al pedir payout).',
    verifiedAt: '2026-08',
  },
  {
    id: 'topstep-50k',
    firm: 'Topstep',
    label: 'Topstep — Trading Combine $50K',
    phase: 'Phase 1',
    size: 50000,
    profitTarget: 6,     // $3,000 sobre $50,000
    maxDrawdown: 4,      // $2,000 trailing MLL, sobre $50,000
    maxDailyDD: 2,       // $1,000 DLL (opcional en TopstepX, activo en NinjaTrader)
    drawdownType: 'trailing_eod',
    note: 'El trailing MLL se congela al llegar al balance inicial (no sigue subiendo). Regla de consistencia: el mejor día no puede superar el 50% del objetivo de profit. Sin límite de tiempo para completar el Combine.',
    verifiedAt: '2026-08',
  },
]

export function getPreset(id) {
  return PROP_FIRM_PRESETS.find(p => p.id === id) || null
}

// ─────────────────────────────────────────────
//  COMISIONES POR FIRMA (futuros, $ por contrato ida y vuelta)
//
//  Solo cifras CONFIRMADAS con un CSV real contra el balance de la
//  plataforma (ver tests/imports/cases.json). Son de contratos MICRO
//  (MNQ/MES); en minis la comisión es otra y hay que cambiarla a mano
//  o calcularla al importar ("¿No cuadra con tu plataforma?").
//  `match` se busca en minúscula dentro del nombre de la firma.
// ─────────────────────────────────────────────
export const FIRM_COMMISSIONS = [
  { match: ['apex'],                     perContract: 1.04, verifiedAt: '2026-10', source: 'Legacy 1/2 (Tradovate)' },
  { match: ['fundednext', 'funded next'], perContract: 1.91, verifiedAt: '2026-10', source: 'FundedNext 50K (Tradovate), 08/10/2026' },
]

export function commissionForFirm(name) {
  const n = String(name || '').toLowerCase()
  if (!n) return null
  return FIRM_COMMISSIONS.find(c => c.match.some(m => n.includes(m))) || null
}
