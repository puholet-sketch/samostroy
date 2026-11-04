/** Тарифы договора дизайна и исключения пунктов (эталон ryba + 4.1.x). */

export type DesignTariffId = 'standard' | 'full' | 'max'

export type DesignStageId = 'plan' | 'viz' | 'drawings' | 'materials'

export type DesignStage = {
  id: DesignStageId
  /** Пункт состава работ */
  clauseCompose: '4.1.1' | '4.1.2' | '4.1.3' | '4.1.4'
  /** Пункт оплаты */
  clausePay: '4.4.1' | '4.4.2' | '4.4.3' | '4.4.4'
  short: string
  composeText: string
  payHint: string
}

/** Этапы соответствуют эталону: состав 4.1.x и оплата 4.4.x */
export const DESIGN_STAGES: DesignStage[] = [
  {
    id: 'plan',
    clauseCompose: '4.1.1',
    clausePay: '4.4.1',
    short: 'обмерный план и планировочное решение',
    composeText:
      '4.1.1. Обмерный план и планировочное решение — включены в стоимость договора.',
    payHint: 'в течение 3 рабочих дней с момента подписания договора (обмерный план и планировочные решения)',
  },
  {
    id: 'viz',
    clauseCompose: '4.1.2',
    clausePay: '4.4.2',
    short: 'визуализация интерьера',
    composeText: '4.1.2. Визуализация интерьера — включена в стоимость договора.',
    payHint: 'в течение 3 рабочих дней перед первым вариантом визуализации',
  },
  {
    id: 'drawings',
    clauseCompose: '4.1.3',
    clausePay: '4.4.3',
    short: 'рабочие чертежи',
    composeText: '4.1.3. Рабочие чертежи — включены в стоимость договора.',
    payHint: 'в течение 3 рабочих дней перед разработкой рабочих чертежей',
  },
  {
    id: 'materials',
    clauseCompose: '4.1.4',
    clausePay: '4.4.4',
    short: 'ведомость чистовых материалов',
    composeText: '4.1.4. Ведомость чистовых материалов — включена в стоимость договора.',
    payHint: 'в течение 3 рабочих дней перед ведомостью чистовых материалов',
  },
]

export type DesignTariff = {
  id: DesignTariffId
  label: string
  ratePerM2: number
  /** Пункты, которые исключаются из договора */
  excludeClauses: string[]
}

export const DESIGN_TARIFFS: DesignTariff[] = [
  {
    id: 'standard',
    label: 'Стандарт',
    ratePerM2: 2000,
    excludeClauses: ['4.4.4', '4.4.2', '4.1.4', '4.1.2'],
  },
  {
    id: 'full',
    label: 'Полный',
    ratePerM2: 3900,
    excludeClauses: ['4.4.4', '4.1.4'],
  },
  {
    id: 'max',
    label: 'Максимальный',
    ratePerM2: 4700,
    excludeClauses: [],
  },
]

export function getDesignTariff(id: DesignTariffId): DesignTariff {
  return DESIGN_TARIFFS.find((t) => t.id === id) ?? DESIGN_TARIFFS[2]
}

/** Этапы, оставшиеся после исключений тарифа */
export function includedDesignStages(tariffId: DesignTariffId): DesignStage[] {
  const excl = new Set(getDesignTariff(tariffId).excludeClauses)
  return DESIGN_STAGES.filter(
    (s) => !excl.has(s.clauseCompose) && !excl.has(s.clausePay),
  )
}
