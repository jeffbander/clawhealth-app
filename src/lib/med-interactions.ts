/**
 * Medication Interaction Checker
 * Flags known dangerous combinations for cardiology patients
 * Source: ACC/AHA guidelines, UpToDate, Lexicomp references
 * 
 * NOT a replacement for a pharmacist — flags for physician review
 */

export interface DrugInteraction {
  severity: "critical" | "major" | "moderate";
  drug1: string;
  drug2: string;
  description: string;
  clinicalSignificance: string;
  recommendation: string;
}

interface InteractionRule {
  patterns1: string[];
  patterns2: string[];
  severity: "critical" | "major" | "moderate";
  description: string;
  clinicalSignificance: string;
  recommendation: string;
}

// Known cardiology-relevant drug interactions
const INTERACTION_RULES: InteractionRule[] = [
  // === CRITICAL ===
  {
    patterns1: ["entresto", "sacubitril", "valsartan/sacubitril"],
    patterns2: ["lisinopril", "enalapril", "ramipril", "captopril", "benazepril", "fosinopril", "quinapril"],
    severity: "critical",
    description: "ARNI + ACE inhibitor: risk of angioedema",
    clinicalSignificance: "Concomitant use is CONTRAINDICATED. Risk of life-threatening angioedema.",
    recommendation: "36-hour washout required between ACE inhibitor and Entresto. Never use together.",
  },
  {
    patterns1: ["warfarin", "coumadin"],
    patterns2: ["apixaban", "eliquis", "rivaroxaban", "xarelto", "edoxaban", "savaysa", "dabigatran", "pradaxa"],
    severity: "critical",
    description: "Dual anticoagulation: warfarin + DOAC",
    clinicalSignificance: "Dramatically increased bleeding risk. No clinical benefit from dual anticoagulation.",
    recommendation: "Use only ONE anticoagulant. Bridge transitions carefully with appropriate washout.",
  },
  {
    patterns1: ["methotrexate"],
    patterns2: ["trimethoprim", "bactrim", "sulfamethoxazole"],
    severity: "critical",
    description: "Methotrexate + TMP/SMX: bone marrow suppression",
    clinicalSignificance: "TMP/SMX inhibits methotrexate renal clearance → potentially fatal pancytopenia.",
    recommendation: "Avoid combination. Use alternative antibiotic.",
  },
  // === MAJOR ===
  {
    patterns1: ["amiodarone", "cordarone"],
    patterns2: ["warfarin", "coumadin"],
    severity: "major",
    description: "Amiodarone potentiates warfarin effect",
    clinicalSignificance: "Amiodarone inhibits CYP2C9 → 30-50% increase in warfarin effect. INR can rise dangerously.",
    recommendation: "Reduce warfarin dose by 30-50% when starting amiodarone. Monitor INR closely (weekly x 4-6 weeks).",
  },
  {
    patterns1: ["amiodarone", "cordarone"],
    patterns2: ["digoxin", "lanoxin"],
    severity: "major",
    description: "Amiodarone increases digoxin levels",
    clinicalSignificance: "Amiodarone increases digoxin levels by ~70%. Risk of digoxin toxicity (nausea, arrhythmia, vision changes).",
    recommendation: "Reduce digoxin dose by 50% when starting amiodarone. Monitor digoxin levels.",
  },
  {
    patterns1: ["spironolactone", "aldactone", "eplerenone", "inspra"],
    patterns2: ["lisinopril", "enalapril", "ramipril", "losartan", "valsartan", "irbesartan", "candesartan", "olmesartan", "entresto", "sacubitril"],
    severity: "major",
    description: "MRA + RAAS inhibitor: hyperkalemia risk",
    clinicalSignificance: "Both raise potassium. Combined use significantly increases hyperkalemia risk, especially with renal impairment.",
    recommendation: "Monitor potassium closely (within 1 week of starting, then q2-4 weeks). Hold if K+ >5.5. Avoid if eGFR <30.",
  },
  {
    patterns1: ["ibuprofen", "advil", "motrin", "naproxen", "aleve", "meloxicam", "diclofenac", "celecoxib", "indomethacin"],
    patterns2: ["warfarin", "coumadin", "apixaban", "eliquis", "rivaroxaban", "xarelto", "clopidogrel", "plavix", "ticagrelor", "brilinta", "prasugrel"],
    severity: "major",
    description: "NSAID + anticoagulant/antiplatelet: bleeding risk",
    clinicalSignificance: "NSAIDs increase GI bleeding risk. Combined with blood thinners → significantly elevated bleeding risk.",
    recommendation: "Avoid NSAIDs in anticoagulated patients. Use acetaminophen for pain. If NSAID unavoidable, add PPI.",
  },
  {
    patterns1: ["ibuprofen", "advil", "motrin", "naproxen", "aleve", "meloxicam", "diclofenac", "celecoxib", "indomethacin"],
    patterns2: ["furosemide", "lasix", "torsemide", "bumetanide", "bumex", "hydrochlorothiazide", "hctz", "chlorthalidone", "metolazone"],
    severity: "major",
    description: "NSAID + diuretic: reduced diuretic efficacy + AKI risk",
    clinicalSignificance: "NSAIDs cause sodium and fluid retention, directly opposing diuretics. Risk of acute kidney injury, especially in HF.",
    recommendation: "Avoid NSAIDs in heart failure patients on diuretics. Use acetaminophen.",
  },
  {
    patterns1: ["diltiazem", "verapamil"],
    patterns2: ["metoprolol", "carvedilol", "atenolol", "bisoprolol", "propranolol", "nadolol", "sotalol"],
    severity: "major",
    description: "Non-dihydropyridine CCB + beta-blocker: bradycardia/heart block",
    clinicalSignificance: "Both slow AV conduction. Combined use risks symptomatic bradycardia, heart block, or hemodynamic collapse.",
    recommendation: "Avoid combination unless under specialist supervision with monitoring. Amlodipine is safe with beta-blockers.",
  },
  {
    patterns1: ["flecainide", "tambocor", "propafenone", "rythmol"],
    patterns2: ["metoprolol", "carvedilol", "atenolol", "sotalol"],
    severity: "major",
    description: "IC antiarrhythmic + beta-blocker: proarrhythmic risk",
    clinicalSignificance: "IC antiarrhythmics can organize atrial flutter to 1:1 conduction. Beta-blocker provides AV node protection but combination needs careful monitoring.",
    recommendation: "Use together only under electrophysiology guidance. Monitor for bradycardia and proarrhythmic effects.",
  },
  // === MODERATE ===
  {
    patterns1: ["atorvastatin", "lipitor", "simvastatin", "zocor", "lovastatin"],
    patterns2: ["amiodarone", "cordarone"],
    severity: "moderate",
    description: "Statin + amiodarone: myopathy risk",
    clinicalSignificance: "Amiodarone inhibits CYP3A4 → increased statin levels → elevated risk of myopathy/rhabdomyolysis.",
    recommendation: "Limit simvastatin to 20mg/day with amiodarone. Atorvastatin is lower risk. Monitor for muscle pain.",
  },
  {
    patterns1: ["metformin", "glucophage"],
    patterns2: ["furosemide", "lasix", "torsemide", "bumetanide"],
    severity: "moderate",
    description: "Metformin + loop diuretic: lactic acidosis risk with dehydration",
    clinicalSignificance: "Diuretic-induced volume depletion can impair renal function → metformin accumulation → lactic acidosis risk.",
    recommendation: "Monitor renal function. Hold metformin if dehydrated or eGFR <30. Ensure adequate hydration.",
  },
  {
    patterns1: ["potassium", "k-dur", "klor-con", "potassium chloride"],
    patterns2: ["spironolactone", "aldactone", "eplerenone", "inspra", "triamterene"],
    severity: "moderate",
    description: "Potassium supplement + potassium-sparing diuretic: hyperkalemia",
    clinicalSignificance: "Additive potassium retention → risk of dangerous hyperkalemia.",
    recommendation: "Monitor potassium closely. Typically avoid supplementation with MRAs unless documented hypokalemia.",
  },
  {
    patterns1: ["clopidogrel", "plavix"],
    patterns2: ["omeprazole", "prilosec", "esomeprazole", "nexium"],
    severity: "moderate",
    description: "Clopidogrel + PPI: reduced antiplatelet effect",
    clinicalSignificance: "Omeprazole/esomeprazole inhibit CYP2C19 → reduced clopidogrel activation → potential stent thrombosis risk.",
    recommendation: "Use pantoprazole instead (minimal CYP2C19 interaction). If PPI needed with clopidogrel, pantoprazole is preferred.",
  },
  {
    patterns1: ["amlodipine", "norvasc"],
    patterns2: ["simvastatin", "zocor"],
    severity: "moderate",
    description: "Amlodipine increases simvastatin levels",
    clinicalSignificance: "Amlodipine inhibits CYP3A4 → increased simvastatin exposure → elevated myopathy risk.",
    recommendation: "Limit simvastatin to 20mg/day with amlodipine. Consider switching to atorvastatin or rosuvastatin.",
  },
];

function matchesDrug(drugName: string, patterns: string[]): boolean {
  const lower = drugName.toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

/**
 * Check a list of medications for known interactions
 * Returns all flagged interactions sorted by severity
 */
export function checkInteractions(
  medications: Array<{ drugName: string; active: boolean }>
): DrugInteraction[] {
  const activeMeds = medications.filter(m => m.active);
  const interactions: DrugInteraction[] = [];

  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      const med1 = activeMeds[i].drugName;
      const med2 = activeMeds[j].drugName;

      for (const rule of INTERACTION_RULES) {
        const match1to2 = matchesDrug(med1, rule.patterns1) && matchesDrug(med2, rule.patterns2);
        const match2to1 = matchesDrug(med1, rule.patterns2) && matchesDrug(med2, rule.patterns1);

        if (match1to2 || match2to1) {
          interactions.push({
            severity: rule.severity,
            drug1: med1,
            drug2: med2,
            description: rule.description,
            clinicalSignificance: rule.clinicalSignificance,
            recommendation: rule.recommendation,
          });
        }
      }
    }
  }

  // Sort: critical > major > moderate
  const severityOrder = { critical: 0, major: 1, moderate: 2 };
  interactions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return interactions;
}
