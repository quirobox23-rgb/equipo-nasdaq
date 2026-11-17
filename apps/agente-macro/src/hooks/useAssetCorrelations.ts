/**
 * useAssetCorrelations.ts — Correlaciones entre señales de activos.
 * Migrado desde macro-intelligence/src/hooks/index.js → useAssetCorrelations
 */
'use client'
import { useMemo } from 'react'
import type { MacroSignal, SignalDirection } from '@/types/macro'

export interface AssetCorrelation {
  pair: string
  correlation: 'positiva' | 'negativa' | 'neutral'
  description: string
  strength: number // 0-1
}

// Correlaciones históricas conocidas entre pares de activos
const BASE_CORRELATIONS: Record<string, { corr: number; desc: string }> = {
  'USD-NQ': {
    corr: -0.7,
    desc: 'USD y NQ tienden a moverse en direcciones opuestas (dólar fuerte = NQ presionado)',
  },
  'USD-GOLD': {
    corr: -0.6,
    desc: 'Dólar fuerte presiona el oro (correlación inversa histórica)',
  },
  'NQ-GOLD': {
    corr: 0.3,
    desc: 'Correlación débil positiva: ambos se benefician del entorno dovish',
  },
}

function dirToNum(dir: SignalDirection): number {
  if (dir === 'up')   return 1
  if (dir === 'down') return -1
  return 0
}

export function useAssetCorrelations(signals: MacroSignal[]): AssetCorrelation[] {
  return useMemo(() => {
    if (!signals.length) return []

    const sigMap: Partial<Record<string, SignalDirection>> = {}
    for (const s of signals) {
      sigMap[s.asset] = s.dir
    }

    const results: AssetCorrelation[] = []
    const pairs = [
      ['USD', 'NQ'],
      ['USD', 'GOLD'],
      ['NQ', 'GOLD'],
    ] as const

    for (const [a, b] of pairs) {
      const dirA = sigMap[a]
      const dirB = sigMap[b]
      if (!dirA || !dirB) continue

      const key = `${a}-${b}`
      const base = BASE_CORRELATIONS[key]
      if (!base) continue

      const actualProduct = dirToNum(dirA) * dirToNum(dirB)
      const expectedSign = Math.sign(base.corr)

      let correlation: 'positiva' | 'negativa' | 'neutral'
      if (actualProduct === 0) {
        correlation = 'neutral'
      } else if (Math.sign(actualProduct) === expectedSign) {
        correlation = expectedSign > 0 ? 'positiva' : 'negativa'
      } else {
        // Divergencia respecto al patrón histórico
        correlation = 'neutral'
      }

      results.push({
        pair: `${a} / ${b}`,
        correlation,
        description: base.desc,
        strength: Math.abs(base.corr),
      })
    }

    return results
  }, [signals])
}
