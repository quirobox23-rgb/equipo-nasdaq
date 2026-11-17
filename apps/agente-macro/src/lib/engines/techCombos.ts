/**
 * techCombos.ts — Zonas técnicas × contexto macro.
 * Migrado desde macro-intelligence/src/features/macro/techCombos.js
 */
import type { VerdictClass } from '@/types/macro'

export interface TechZone {
  key: string
  label: string
  description: string
}

export interface TechCombo {
  action: string
  rationale: string
  risk: 'bajo' | 'moderado' | 'alto'
}

export const TECH_ZONES: TechZone[] = [
  {
    key: 'soporte',
    label: 'Soporte clave',
    description: 'Precio en zona de soporte técnico relevante',
  },
  {
    key: 'resistencia',
    label: 'Resistencia clave',
    description: 'Precio en zona de resistencia técnica relevante',
  },
  {
    key: 'breakout',
    label: 'Breakout / Ruptura',
    description: 'Precio rompiendo nivel técnico relevante con volumen',
  },
  {
    key: 'pullback',
    label: 'Pullback / Retroceso',
    description: 'Retroceso dentro de tendencia establecida',
  },
  {
    key: 'acumulacion',
    label: 'Zona de acumulación',
    description: 'Rango estrecho con posible acumulación institucional',
  },
  {
    key: 'distribucion',
    label: 'Zona de distribución',
    description: 'Rango estrecho con posible distribución institucional',
  },
  {
    key: 'tendencia',
    label: 'En tendencia clara',
    description: 'Precio en tendencia definida sin niveles clave cercanos',
  },
  {
    key: 'rango',
    label: 'Dentro de rango',
    description: 'Precio oscilando dentro de rango sin tendencia',
  },
]

// 24 combinaciones: 8 zonas × 3 veredictos
export const TECH_COMBOS: Record<string, Record<VerdictClass, TechCombo>> = {
  soporte: {
    trade: {
      action: 'LARGO en soporte — Setup ideal',
      rationale: 'Confluencia perfecta: macro favorable + precio en soporte. Busca entrada con stop justo por debajo. R/R ≥ 2:1.',
      risk: 'bajo',
    },
    caution: {
      action: 'ESPERAR confirmación en soporte',
      rationale: 'Macro ambigua en soporte clave. No entres al primer toque. Espera vela de reversión o VPOC hold antes de comprometer capital.',
      risk: 'moderado',
    },
    'no-trade': {
      action: 'SOPORTE PUEDE ROMPER — No operar',
      rationale: 'Macro agresivamente bajista. Los soportes no aguantan contra vientos macro. No intentes el rebote; puede ser una trampa.',
      risk: 'alto',
    },
  },
  resistencia: {
    trade: {
      action: 'REDUCIR LARGO en resistencia / evaluar corto',
      rationale: 'Macro favorable pero precio en resistencia. Toma parcial de beneficios en largos. Nuevo largo solo tras ruptura confirmada.',
      risk: 'moderado',
    },
    caution: {
      action: 'ESPERAR ruptura o rechazo claro',
      rationale: 'Resistencia + macro sin dirección clara = zona de máxima indecisión. Operarla es un juego de azar. Espera fuera.',
      risk: 'moderado',
    },
    'no-trade': {
      action: 'CORTO en resistencia — Confluencia bajista',
      rationale: 'Macro bajista + resistencia técnica = setup de corto de alta probabilidad. Entra corto con stop sobre la resistencia.',
      risk: 'bajo',
    },
  },
  breakout: {
    trade: {
      action: 'SEGUIR RUPTURA — Setup de alta probabilidad',
      rationale: 'Ruptura técnica confirmada por macro favorable. Entra en el retesteo del nivel roto o en la consolidación post-ruptura.',
      risk: 'bajo',
    },
    caution: {
      action: 'BREAKOUT FALSO posible — Confirmar',
      rationale: 'Sin confluencia macro. Muchos breakouts sin respaldo macro resultan en trampas. Espera cierre de vela y retest antes de entrar.',
      risk: 'moderado',
    },
    'no-trade': {
      action: 'IGNORAR RUPTURA — Falsa señal técnica',
      rationale: 'Contra macro bajista, los breakouts al alza suelen ser trampas para alcistas. Si el precio rompe al alza, es probable que regrese.',
      risk: 'alto',
    },
  },
  pullback: {
    trade: {
      action: 'COMPRAR PULLBACK — Entrada en tendencia',
      rationale: 'Pullback en tendencia con respaldo macro. Es el setup más clásico y consistente. Entra en Fibonacci 38-50% con stop en swing bajo.',
      risk: 'bajo',
    },
    caution: {
      action: 'PULLBACK PROFUNDO posible — Gestiona tamaño',
      rationale: 'La macro sin dirección puede convertir un pullback en reversión. Reduce tamaño de posición al 50% si decides entrar.',
      risk: 'moderado',
    },
    'no-trade': {
      action: 'PULLBACK = DISTRIBUCIÓN — No compres',
      rationale: 'En entorno bajista, cada rally/pullback es una oportunidad de venta para institucionales. No compres "barato" contra tendencia macro.',
      risk: 'alto',
    },
  },
  acumulacion: {
    trade: {
      action: 'ACUMULACIÓN REAL — Preparar entrada',
      rationale: 'Rango estrecho + macro alcista es firma de acumulación institucional. Posiciónate dentro del rango con stop bajo el rango.',
      risk: 'bajo',
    },
    caution: {
      action: 'RANGO INDEFINIDO — Sin catalizador claro',
      rationale: 'Sin apoyo macro, el rango puede extenderse indefinidamente. Opera solo si tienes una señal técnica adicional (volumen, VPOC, etc.).',
      risk: 'moderado',
    },
    'no-trade': {
      action: 'POSIBLE DISTRIBUCIÓN DISFRAZADA',
      rationale: 'En macro bajista, lo que parece acumulación puede ser distribución. Espera ruptura al alza con volumen antes de plantearte largo.',
      risk: 'alto',
    },
  },
  distribucion: {
    trade: {
      action: 'CORTO DESDE DISTRIBUCIÓN — Alta probabilidad',
      rationale: 'Distribución técnica + macro bajista es la señal de corto más confiable. Entra corto al fallo de ruptura alcista.',
      risk: 'bajo',
    },
    caution: {
      action: 'DISTRIBUCIÓN AMBIGUA — Espera confirmación',
      rationale: 'Sin dirección macro clara, el patrón de distribución necesita confirmación. Espera ruptura al alza (trampa) o caída clara del rango.',
      risk: 'moderado',
    },
    'no-trade': {
      action: 'POSIBLE ACUMULACIÓN — No entres corto',
      rationale: 'Con macro alcista, lo que parece distribución puede resolver al alza. No vayas contra la macro con cortos especulativos.',
      risk: 'alto',
    },
  },
  tendencia: {
    trade: {
      action: 'SEGUIR TENDENCIA — Máxima convicción',
      rationale: 'Tendencia técnica alineada con macro alcista. No busques techos. Mantén la posición y sube el stop detrás del precio.',
      risk: 'bajo',
    },
    caution: {
      action: 'TENDENCIA EN DUDA — Reduce exposición',
      rationale: 'La tendencia puede continuar o revertir. Sin apoyo macro claro, considera reducir posición al 50% y esperar catalizador.',
      risk: 'moderado',
    },
    'no-trade': {
      action: 'TENDENCIA ALCISTA CONTRA MACRO — Peligro',
      rationale: 'El precio sube pero la macro es bajista. Esto raramente dura. No te unas a la tendencia; considera posición corta cuando la tendencia ceda.',
      risk: 'alto',
    },
  },
  rango: {
    trade: {
      action: 'REBOTE DE RANGO INFERIOR — Entrada selectiva',
      rationale: 'Macro favorable + extremo bajo del rango = setup de scalp alcista. Stop bajo el rango. Objetivo: extremo alto del rango.',
      risk: 'moderado',
    },
    caution: {
      action: 'RANGO — Sin operativa recomendada',
      rationale: 'Rango técnico + macro indefinida = el entorno más difícil para operar. La relación R/R no justifica la entrada. Espera fuera.',
      risk: 'alto',
    },
    'no-trade': {
      action: 'RANGO CON SESGO BAJISTA — Evitar',
      rationale: 'El precio puede romper el rango a la baja con la macro. No operes el rebote desde el extremo inferior; busca rupturas bajistas.',
      risk: 'alto',
    },
  },
}

export function getTechCombo(
  zoneKey: string,
  verdictClass: VerdictClass,
): TechCombo | null {
  const zone = TECH_COMBOS[zoneKey]
  if (!zone) return null
  return zone[verdictClass] ?? null
}
