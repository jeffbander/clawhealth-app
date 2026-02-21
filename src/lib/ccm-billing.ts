/**
 * ClawHealth CCM Billing Engine
 *
 * Calculates Chronic Care Management (CCM) billable minutes and CPT codes
 * from patient interaction logs.
 *
 * CPT Codes (2024 rates, non-facility):
 *   99490 — First 20 min/month complex CCM:  ~$64/patient/month
 *   99439 — Each add'l 20 min block (×2 max): ~$47/patient/month
 *   99491 — First 30 min, PHYSICIAN time:    ~$84/patient/month
 *   99487 — Complex CCM, first 60 min:       ~$134/patient/month
 *
 * Qualifying interactions (CMS guidance):
 *   - Patient care coordination calls/messages
 *   - Medication management contacts
 *   - Care plan updates and reviews
 *   - Alert review and response
 *   - Care transitions management
 *
 * Time credits (conservative, defensible estimates):
 *   AI message exchange:        2 min
 *   Physician note/review:      5 min
 *   Alert review + response:    3 min
 *   Care plan update:          15 min
 *   Proactive outreach:         2 min
 */

export interface CCMPatientMonth {
  patientId: string
  patientName: string
  riskLevel: string
  primaryDx: string | null
  month: string // YYYY-MM

  // Interaction counts
  aiMessages: number
  physicianMessages: number
  alertsResolved: number
  proactiveOutreaches: number

  // Calculated minutes
  totalMinutes: number
  aiMinutes: number
  physicianMinutes: number

  // Billing eligibility
  qualifies99490: boolean  // 20+ min
  qualifies99439_1: boolean // 40+ min (first add'l block)
  qualifies99439_2: boolean // 60+ min (second add'l block)
  qualifies99491: boolean  // 30+ min physician time

  // Revenue
  estimatedRevenue: number
  billableCodes: string[]
}

export interface CCMSummary {
  month: string
  totalPatients: number
  qualifyingPatients: number
  totalMinutes: number
  estimatedMonthlyRevenue: number
  estimatedAnnualRevenue: number
  byRiskLevel: Record<string, { count: number; qualifying: number; revenue: number }>
  topPatients: CCMPatientMonth[]
  nearlyQualifying: CCMPatientMonth[] // 10-19 min — one more contact away
}

// CMS reimbursement rates (2024, non-facility)
const CCM_RATES = {
  '99490': 64,   // first 20 min
  '99439_1': 47, // +20 min block #1
  '99439_2': 47, // +20 min block #2
  '99491': 84,   // physician 30 min
}

// Minutes credited per interaction type
const TIME_CREDITS = {
  AI: 2,          // AI message exchange
  PHYSICIAN: 5,   // physician review/message
  ALERT: 3,       // alert review + response
  CARE_PLAN: 15,  // care plan creation/update
  PROACTIVE: 2,   // proactive outreach (cron-generated)
}

function calcRevenue(minutes: number, physicianMinutes: number): { revenue: number; codes: string[] } {
  const codes: string[] = []
  let revenue = 0

  if (minutes >= 20) {
    codes.push('99490')
    revenue += CCM_RATES['99490']
  }
  if (minutes >= 40) {
    codes.push('99439')
    revenue += CCM_RATES['99439_1']
  }
  if (minutes >= 60) {
    codes.push('99439')
    revenue += CCM_RATES['99439_2']
  }
  if (physicianMinutes >= 30) {
    // 99491 can be billed instead of 99490 when physician time ≥30min
    if (!codes.includes('99490')) {
      codes.push('99491')
      revenue += CCM_RATES['99491']
    }
  }

  return { revenue, codes }
}

/**
 * Calculate CCM billing data for all patients in an organization
 * for the specified month (YYYY-MM format, defaults to current month)
 */
export async function calculateCCMBilling(
  prisma: any,
  orgId: string,
  month?: string
): Promise<CCMSummary> {
  const now = new Date()
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, mon] = targetMonth.split('-').map(Number)

  const monthStart = new Date(year, mon - 1, 1)
  const monthEnd = new Date(year, mon, 0, 23, 59, 59)

  // Load all patients with their month's conversations and alerts
  const patients = await prisma.patient.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      encFirstName: true,
      encLastName: true,
      riskLevel: true,
      primaryDx: true,
      conversations: {
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        select: { role: true, createdAt: true, audioUrl: true },
      },
      alerts: {
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
          resolved: true,
        },
        select: { id: true, resolvedAt: true },
      },
      carePlans: {
        where: {
          updatedAt: { gte: monthStart, lte: monthEnd },
        },
        select: { id: true, updatedAt: true },
      },
    },
  })

  const { decryptPHI } = await import('./encryption')

  const patientMonths: CCMPatientMonth[] = patients.map((p: any) => {
    let firstName = 'Patient'
    let lastName = ''
    try { firstName = decryptPHI(p.encFirstName) } catch {}
    try { lastName = decryptPHI(p.encLastName) } catch {}

    const aiMessages = p.conversations.filter((c: any) => c.role === 'AI').length
    const physicianMessages = p.conversations.filter((c: any) => c.role === 'PHYSICIAN').length
    const proactiveOutreaches = p.conversations.filter((c: any) =>
      c.role === 'AI' && c.audioUrl?.startsWith('cron://')
    ).length

    const alertsResolved = p.alerts.length
    const carePlanUpdates = p.carePlans.length

    const aiMinutes = (aiMessages - proactiveOutreaches) * TIME_CREDITS.AI
      + proactiveOutreaches * TIME_CREDITS.PROACTIVE
    const physicianMinutes = physicianMessages * TIME_CREDITS.PHYSICIAN
    const alertMinutes = alertsResolved * TIME_CREDITS.ALERT
    const carePlanMinutes = carePlanUpdates * TIME_CREDITS.CARE_PLAN

    const totalMinutes = aiMinutes + physicianMinutes + alertMinutes + carePlanMinutes

    const { revenue, codes } = calcRevenue(totalMinutes, physicianMinutes)

    return {
      patientId: p.id,
      patientName: `${firstName} ${lastName}`.trim(),
      riskLevel: p.riskLevel,
      primaryDx: p.primaryDx,
      month: targetMonth,
      aiMessages,
      physicianMessages,
      alertsResolved,
      proactiveOutreaches,
      totalMinutes,
      aiMinutes,
      physicianMinutes,
      qualifies99490: totalMinutes >= 20,
      qualifies99439_1: totalMinutes >= 40,
      qualifies99439_2: totalMinutes >= 60,
      qualifies99491: physicianMinutes >= 30,
      estimatedRevenue: revenue,
      billableCodes: codes,
    }
  })

  const qualifying = patientMonths.filter(p => p.qualifies99490)
  const nearlyQualifying = patientMonths.filter(p =>
    !p.qualifies99490 && p.totalMinutes >= 10
  )

  const totalRevenue = patientMonths.reduce((sum, p) => sum + p.estimatedRevenue, 0)

  const byRiskLevel: Record<string, { count: number; qualifying: number; revenue: number }> = {}
  for (const p of patientMonths) {
    if (!byRiskLevel[p.riskLevel]) {
      byRiskLevel[p.riskLevel] = { count: 0, qualifying: 0, revenue: 0 }
    }
    byRiskLevel[p.riskLevel].count++
    if (p.qualifies99490) byRiskLevel[p.riskLevel].qualifying++
    byRiskLevel[p.riskLevel].revenue += p.estimatedRevenue
  }

  return {
    month: targetMonth,
    totalPatients: patients.length,
    qualifyingPatients: qualifying.length,
    totalMinutes: patientMonths.reduce((sum, p) => sum + p.totalMinutes, 0),
    estimatedMonthlyRevenue: totalRevenue,
    estimatedAnnualRevenue: totalRevenue * 12,
    byRiskLevel,
    topPatients: [...patientMonths]
      .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
      .slice(0, 10),
    nearlyQualifying: nearlyQualifying.sort((a, b) => b.totalMinutes - a.totalMinutes),
  }
}

/**
 * Get a patient's CCM status for the current month
 */
export async function getPatientCCMStatus(
  prisma: any,
  patientId: string
): Promise<Omit<CCMPatientMonth, 'patientName' | 'primaryDx'>> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [conversations, resolvedAlerts, carePlans, patient] = await Promise.all([
    prisma.conversation.findMany({
      where: { patientId, createdAt: { gte: monthStart } },
      select: { role: true, audioUrl: true },
    }),
    prisma.alert.count({
      where: { patientId, resolved: true, createdAt: { gte: monthStart } },
    }),
    prisma.carePlan.count({
      where: { patientId, updatedAt: { gte: monthStart } },
    }),
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { riskLevel: true },
    }),
  ])

  const aiMessages = conversations.filter((c: any) => c.role === 'AI').length
  const physicianMessages = conversations.filter((c: any) => c.role === 'PHYSICIAN').length
  const proactiveOutreaches = conversations.filter((c: any) =>
    c.role === 'AI' && c.audioUrl?.startsWith('cron://')
  ).length

  const aiMinutes = (aiMessages - proactiveOutreaches) * TIME_CREDITS.AI
    + proactiveOutreaches * TIME_CREDITS.PROACTIVE
  const physicianMinutes = physicianMessages * TIME_CREDITS.PHYSICIAN
  const totalMinutes = aiMinutes + physicianMinutes
    + resolvedAlerts * TIME_CREDITS.ALERT
    + carePlans * TIME_CREDITS.CARE_PLAN

  const { revenue, codes } = calcRevenue(totalMinutes, physicianMinutes)

  return {
    patientId,
    riskLevel: patient?.riskLevel ?? 'MEDIUM',
    month,
    aiMessages,
    physicianMessages,
    alertsResolved: resolvedAlerts,
    proactiveOutreaches,
    totalMinutes,
    aiMinutes,
    physicianMinutes,
    qualifies99490: totalMinutes >= 20,
    qualifies99439_1: totalMinutes >= 40,
    qualifies99439_2: totalMinutes >= 60,
    qualifies99491: physicianMinutes >= 30,
    estimatedRevenue: revenue,
    billableCodes: codes,
  }
}
