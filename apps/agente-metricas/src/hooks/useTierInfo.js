import {
  useStore, useTier, useAccounts, useCsvImportedCount, useCanImportCsvNow, useCanAddTrade, useIsTester,
} from '@/store/useStore'
import { TIER_LIMITS, accountLimitFor, blueprintLimitFor, tradeLimitFor, csvTradesLimitFor, canExportData, hasFeature } from '@/config/features'

// ─────────────────────────────────────────────
//  useTierInfo — versión "rica" de useTier()
//
//  useTier() (en useStore.js) ya existe y devuelve solo el string del
//  tier actual — se sigue usando tal cual en toda la app. Este hook
//  es un AÑADIDO, para los sitios que necesiten el objeto completo
//  (isFree/isPro/límites/restantes...) sin repetir esta lógica en
//  cada componente.
//
//  Sistema de 3 tiers: free / intermedio / pro (+ variantes
//  tester-free / tester-intermedio / tester-pro, que se comportan
//  exactamente como su tier real correspondiente).
// ─────────────────────────────────────────────
export function useTierInfo() {
  const tier = useTier()
  const accounts = useAccounts()
  const csvImportedCount = useCsvImportedCount()
  const canImportCsvNow  = useCanImportCsvNow()
  const canAddTrade      = useCanAddTrade()
  const isTester         = useIsTester()

  const baseTier = tier.startsWith('tester-') ? tier.replace('tester-', '') : tier
  const maxAccounts = accountLimitFor(tier)

  return {
    tier,
    baseTier,
    isFree:       baseTier === 'free',
    isIntermedio: baseTier === 'intermedio',
    isPro:        baseTier === 'pro',
    isTester,
    isPaid: baseTier !== 'free',
    canUseFeature: (feature) => hasFeature(tier, feature),
    maxAccounts,
    maxBlueprints:  blueprintLimitFor(tier),
    maxTotalTrades: tradeLimitFor(tier),
    maxCsvTrades:   csvTradesLimitFor(tier),
    canExportData:  canExportData(tier),
    accountsUsed: accounts.length,
    accountsRemaining: maxAccounts === Infinity ? '∞' : Math.max(0, maxAccounts - accounts.length),
    canAddMoreAccounts: accounts.length < maxAccounts,
    csvImportedCount,
    canImportCsvNow,
    canAddTrade,
  }
}
