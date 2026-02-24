import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ParsedPatient {
  firstName: string
  lastName: string
  dateOfBirth: string
  phone: string
  conditions: string[]
  medications: Array<{
    drugName: string
    dose: string
    frequency: string
    route: string
  }>
  medicalSummary: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  primaryDx: string
  procedures: string[]
  labs: Array<{
    name: string
    value: string
    unit: string
    date: string
  }>
  vitals: Array<{
    type: string
    value: string
    unit: string
    date: string
  }>
  symptoms: string[]
  planItems: string[]
}

function stripCodeFences(text: string): string {
  return text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
}

export async function parseEmrText(emrText: string): Promise<ParsedPatient> {
  const completion = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    system: `You are a medical data extraction assistant. Parse EMR/clinical text and return ONLY valid JSON.\n\nExtract these fields:\n- firstName, lastName, dateOfBirth (YYYY-MM-DD if available), phone\n- conditions: string[]\n- medications: [{drugName,dose,frequency,route}]\n- medicalSummary: 2-3 sentence factual summary\n- riskLevel: LOW/MEDIUM/HIGH/CRITICAL using cardiology context\n- primaryDx\n- procedures: notable procedures/surgeries as string[]\n- labs: [{name,value,unit,date}] for any mentioned lab values\n- vitals: [{type,value,unit,date}] for weight, BP, HR, glucose, O2, temp if present\n- symptoms: string[] clinically relevant symptom mentions\n- planItems: string[] treatment/follow-up recommendations in the source\n\nRules:\n- Do not fabricate details.\n- Use empty strings/arrays when absent.\n- Keep medication route default "oral" if unknown.\n- Return JSON only, no markdown.`,
    messages: [{
      role: 'user',
      content: `Parse this EMR text into structured data:\n\n${emrText}`,
    }],
  })

  const text = completion.content[0]?.type === 'text' ? completion.content[0].text : '{}'
  const parsed = JSON.parse(stripCodeFences(text)) as Partial<ParsedPatient>

  return {
    firstName: parsed.firstName ?? '',
    lastName: parsed.lastName ?? '',
    dateOfBirth: parsed.dateOfBirth ?? '',
    phone: parsed.phone ?? '',
    conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
    medications: Array.isArray(parsed.medications) ? parsed.medications.map((med) => ({
      drugName: med?.drugName ?? '',
      dose: med?.dose ?? '',
      frequency: med?.frequency ?? '',
      route: med?.route ?? 'oral',
    })) : [],
    medicalSummary: parsed.medicalSummary ?? '',
    riskLevel: parsed.riskLevel && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.riskLevel)
      ? parsed.riskLevel
      : 'MEDIUM',
    primaryDx: parsed.primaryDx ?? '',
    procedures: Array.isArray(parsed.procedures) ? parsed.procedures : [],
    labs: Array.isArray(parsed.labs) ? parsed.labs.map((lab) => ({
      name: lab?.name ?? '',
      value: lab?.value ?? '',
      unit: lab?.unit ?? '',
      date: lab?.date ?? '',
    })) : [],
    vitals: Array.isArray(parsed.vitals) ? parsed.vitals.map((vital) => ({
      type: vital?.type ?? '',
      value: vital?.value ?? '',
      unit: vital?.unit ?? '',
      date: vital?.date ?? '',
    })) : [],
    symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
    planItems: Array.isArray(parsed.planItems) ? parsed.planItems : [],
  }
}
