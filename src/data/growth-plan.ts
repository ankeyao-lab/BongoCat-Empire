export const defaultDailyPressBudget = 5000
export const defaultActiveDaysPerWeek = 5
export const legacyDefaultThresholds = [0, 2000, 8000, 20000, 45000, 85000, 140000, 220000, 320000]
const weeklyFractions = [0, 3, 10, 20, 35, 50, 65, 82, 100]

export function weeklyThresholds(dailyPressBudget: number, activeDaysPerWeek: number): number[] {
  if (!Number.isSafeInteger(dailyPressBudget) || dailyPressBudget < 1 || dailyPressBudget > Math.floor(Number.MAX_SAFE_INTEGER / 7)
    || !Number.isInteger(activeDaysPerWeek) || activeDaysPerWeek < 1 || activeDaysPerWeek > 7) {
    throw new Error('日均按键需为有效的正整数，每周活跃天数需为 1–7 天。')
  }
  const target = dailyPressBudget * activeDaysPerWeek
  if (target < 8) throw new Error('一套主题至少需要 8 次按键，才能分成九个等级。')
  const thresholds = [0]
  for (let index = 1; index < weeklyFractions.length; index += 1) {
    const rounded = Math.floor(target / 100) * weeklyFractions[index] + Math.round((target % 100) * weeklyFractions[index] / 100)
    thresholds.push(Math.max(thresholds[index - 1] + 1, Math.min(rounded, target - (8 - index))))
  }
  return thresholds
}

export const defaultWeeklyThresholds = weeklyThresholds(defaultDailyPressBudget, defaultActiveDaysPerWeek)
