export interface FireInputs {
  expenses: number
  savings: number
  returnRate: number
  age: number
  swr: number
  pensionAge: number
}

export type FireType = 'lean' | 'regular' | 'fat' | 'coast'

export const DEFAULT_FIRE: FireInputs = {
  expenses: 30000,
  savings: 1500,
  returnRate: 7,
  age: 40,
  swr: 4,
  pensionAge: 60,
}

export function calcYearsToTarget(
  current: number,
  target: number,
  monthlySavings: number,
  monthlyReturn: number,
): number {
  if (current >= target) return 0
  if (monthlySavings <= 0 && monthlyReturn <= 0) return Infinity
  let months = 0
  let value = current
  const maxMonths = 1200
  while (value < target && months < maxMonths) {
    value = value * (1 + monthlyReturn) + monthlySavings
    months++
  }
  return months / 12
}

export function calcCoastFire(
  targetAtRetirement: number,
  age: number,
  pensionAge: number,
  annualReturn: number,
): number {
  const years = Math.max(0, pensionAge - age)
  if (years <= 0) return targetAtRetirement
  return targetAtRetirement / Math.pow(1 + annualReturn / 100, years)
}

export interface FireResult {
  leanTarget: number
  regularTarget: number
  fatTarget: number
  coastTarget: number
  leanYears: number
  regularYears: number
  fatYears: number
  coastYears: number
  currentTarget: number
  currentYears: number
  progress: number
  ageAtFire: number
  passiveIncome: number
}

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback
}

export function calcFire(netWorth: number, inputs: FireInputs, type: FireType): FireResult {
  const expenses = Math.max(0, finite(inputs.expenses, DEFAULT_FIRE.expenses))
  const savings = finite(inputs.savings, DEFAULT_FIRE.savings)
  const returnRate = finite(inputs.returnRate, DEFAULT_FIRE.returnRate)
  const age = Math.max(0, finite(inputs.age, DEFAULT_FIRE.age))
  const swr = Math.max(0.01, finite(inputs.swr, DEFAULT_FIRE.swr))
  const pensionAge = Math.max(age, finite(inputs.pensionAge, DEFAULT_FIRE.pensionAge))
  const nw = finite(netWorth, 0)

  const regularTarget = expenses / (swr / 100)
  const leanTarget = (expenses * 0.6) / (swr / 100)
  const fatTarget = (expenses * 1.5) / (swr / 100)
  const coastTarget = calcCoastFire(regularTarget, age, pensionAge, returnRate)
  const monthlyReturn = returnRate / 100 / 12

  const leanYears = calcYearsToTarget(nw, leanTarget, savings, monthlyReturn)
  const regularYears = calcYearsToTarget(nw, regularTarget, savings, monthlyReturn)
  const fatYears = calcYearsToTarget(nw, fatTarget, savings, monthlyReturn)
  const coastYears =
    nw >= coastTarget ? 0 : calcYearsToTarget(nw, coastTarget, savings, monthlyReturn)

  let currentTarget = regularTarget
  let currentYears = regularYears
  if (type === 'lean') {
    currentTarget = leanTarget
    currentYears = leanYears
  } else if (type === 'fat') {
    currentTarget = fatTarget
    currentYears = fatYears
  } else if (type === 'coast') {
    currentTarget = coastTarget
    currentYears = coastYears
  }

  const progress =
    currentTarget > 0 ? Math.min(100, Math.max(0, (nw / currentTarget) * 100)) : 0

  return {
    leanTarget,
    regularTarget,
    fatTarget,
    coastTarget,
    leanYears,
    regularYears,
    fatYears,
    coastYears,
    currentTarget,
    currentYears,
    progress,
    ageAtFire:
      Number.isFinite(currentYears) && currentYears > 0
        ? Math.round(age + currentYears)
        : age,
    passiveIncome: nw * (swr / 100),
  }
}
