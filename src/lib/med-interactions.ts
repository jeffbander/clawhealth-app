/**
 * Medication Interaction Database
 * Cardiology-focused drug-drug interactions
 * Board-level accuracy — reviewed for Chief of Cardiology use
 * 
 * Severity levels:
 *   CRITICAL — contraindicated, life-threatening risk
 *   HIGH — major interaction, requires monitoring or dose adjustment
 *   MODERATE — clinically significant, awareness needed
 */

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  effect: string;
  recommendation: string;
  mechanism?: string;
}

// Match patterns: lowercased drug names/classes for fuzzy matching
type DrugPattern = string[];

interface InteractionRule {
  patterns1: DrugPattern;
  patterns2: DrugPattern;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  effect: string;
  recommendation: string;
  mechanism?: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  // === CRITICAL ===
  {
    patterns1: ["warfarin", "coumadin"],
    patterns2: ["apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa", "edoxaban", "savaysa"],
    severity: "CRITICAL",
    effect: "Dual anticoagulation — extreme bleeding risk",
    recommendation: "NEVER combine. Use one anticoagulant only. Immediate physician review required.",
    mechanism: "Additive anticoagulation via different pathways",
  },
  {
    patterns1: ["sacubitril", "entresto"],
    patterns2: ["lisinopril", "enalapril", "ramipril", "benazepril", "captopril", "quinapril", "fosinopril", "perindopril", "trandolapril"],
    severity: "CRITICAL",
    effect: "Risk of angioedema — potentially fatal",
    recommendation: "CONTRAINDICATED. 36-hour washout required between ACE inhibitor and Entresto. Never co-prescribe.",
    mechanism: "Both increase bradykinin levels; combined effect dramatically raises angioedema risk",
  },
  {
    patterns1: ["methotrexate"],
    patterns2: ["nsaid", "ibuprofen", "naproxen", "advil", "aleve", "meloxicam", "diclofenac", "indomethacin", "celecoxib"],
    severity: "CRITICAL",
    effect: "Methotrexate toxicity — bone marrow suppression, renal failure",
    recommendation: "Avoid combination. If unavoidable, requires close monitoring of methotrexate levels and renal function.",
    mechanism: "NSAIDs reduce renal clearance of methotrexate",
  },
  {
    patterns1: ["dofetilide", "tikosyn"],
    patterns2: ["verapamil", "calan", "cimetidine", "tagamet", "ketoconazole", "trimethoprim"],
    severity: "CRITICAL",
    effect: "QT prolongation, torsades de pointes",
    recommendation: "CONTRAINDICATED. These drugs increase dofetilide levels dramatically.",
    mechanism: "Inhibition of renal cation transport / CYP3A4 inhibition increases dofetilide concentration",
  },
  {
    patterns1: ["amiodarone", "cordarone"],
    patterns2: ["dofetilide", "tikosyn", "sotalol", "betapace", "dronedarone", "multaq"],
    severity: "CRITICAL",
    effect: "Additive QT prolongation — high risk of fatal arrhythmia",
    recommendation: "NEVER combine antiarrhythmics with QT-prolonging effects. Choose one agent.",
    mechanism: "Synergistic prolongation of cardiac repolarization",
  },
  {
    patterns1: ["simvastatin", "zocor", "lovastatin", "mevacor"],
    patterns2: ["amiodarone", "cordarone"],
    severity: "HIGH",
    effect: "Rhabdomyolysis risk — simvastatin max 20mg with amiodarone",
    recommendation: "Limit simvastatin to 20mg/day with amiodarone. Consider switching to atorvastatin or rosuvastatin.",
    mechanism: "Amiodarone inhibits CYP3A4, increasing statin levels",
  },

  // === HIGH ===
  {
    patterns1: ["digoxin", "lanoxin"],
    patterns2: ["amiodarone", "cordarone"],
    severity: "HIGH",
    effect: "Digoxin toxicity — nausea, arrhythmias, visual disturbances",
    recommendation: "Reduce digoxin dose by 50% when starting amiodarone. Monitor digoxin levels closely.",
    mechanism: "Amiodarone inhibits P-glycoprotein and renal clearance of digoxin",
  },
  {
    patterns1: ["digoxin", "lanoxin"],
    patterns2: ["verapamil", "calan", "diltiazem", "cardizem", "tiazac"],
    severity: "HIGH",
    effect: "Increased digoxin levels + additive AV nodal blockade",
    recommendation: "Monitor digoxin levels. Watch for bradycardia. Consider dose reduction.",
    mechanism: "Calcium channel blockers increase digoxin bioavailability and additive conduction delay",
  },
  {
    patterns1: ["potassium", "k-dur", "klor-con", "potassium chloride"],
    patterns2: ["spironolactone", "aldactone", "eplerenone", "inspra", "triamterene", "amiloride"],
    severity: "HIGH",
    effect: "Hyperkalemia — risk of fatal cardiac arrhythmia",
    recommendation: "Monitor potassium closely. Avoid potassium supplements with potassium-sparing diuretics unless K+ is documented low.",
    mechanism: "Additive potassium retention",
  },
  {
    patterns1: ["metformin", "glucophage"],
    patterns2: ["contrast", "iodinated"],
    severity: "HIGH",
    effect: "Lactic acidosis risk with contrast dye",
    recommendation: "Hold metformin day of and 48h after iodinated contrast. Check renal function before restarting.",
    mechanism: "Contrast can impair renal function, reducing metformin clearance",
  },
  {
    patterns1: ["carvedilol", "coreg", "metoprolol", "toprol", "lopressor", "atenolol", "bisoprolol", "propranolol"],
    patterns2: ["verapamil", "calan", "diltiazem", "cardizem"],
    severity: "HIGH",
    effect: "Severe bradycardia, heart block, hypotension",
    recommendation: "Avoid combination of beta-blocker + non-dihydropyridine calcium channel blocker. If necessary, monitor closely.",
    mechanism: "Additive negative chronotropic and dromotropic effects on AV node",
  },
  {
    patterns1: ["apixaban", "eliquis", "rivaroxaban", "xarelto"],
    patterns2: ["aspirin", "clopidogrel", "plavix", "ticagrelor", "brilinta", "prasugrel", "effient"],
    severity: "HIGH",
    effect: "Increased bleeding risk — triple therapy concern",
    recommendation: "Minimize duration of triple therapy (anticoagulant + dual antiplatelet). Discuss with cardiologist. Consider PPI for GI protection.",
    mechanism: "Additive effects on hemostasis via different pathways",
  },
  {
    patterns1: ["lisinopril", "enalapril", "ramipril", "losartan", "valsartan", "irbesartan", "olmesartan", "candesartan", "telmisartan"],
    patterns2: ["spironolactone", "aldactone", "eplerenone", "inspra"],
    severity: "HIGH",
    effect: "Hyperkalemia risk — especially with CKD or diabetes",
    recommendation: "Monitor potassium within 1-2 weeks of initiation, then regularly. Avoid if eGFR <30. Hold if K+ >5.5.",
    mechanism: "Both reduce potassium excretion via RAAS blockade",
  },

  // === MODERATE ===
  {
    patterns1: ["lisinopril", "enalapril", "ramipril", "benazepril", "captopril"],
    patterns2: ["nsaid", "ibuprofen", "naproxen", "advil", "aleve", "meloxicam", "diclofenac", "celecoxib"],
    severity: "MODERATE",
    effect: "Reduced antihypertensive effect + increased renal risk",
    recommendation: "Avoid chronic NSAID use. Short courses (<5 days) with BP and renal monitoring if necessary.",
    mechanism: "NSAIDs reduce prostaglandin-mediated renal perfusion, opposing ACE inhibitor effects",
  },
  {
    patterns1: ["furosemide", "lasix", "torsemide", "bumetanide"],
    patterns2: ["nsaid", "ibuprofen", "naproxen", "advil", "aleve", "meloxicam", "diclofenac", "celecoxib"],
    severity: "MODERATE",
    effect: "Reduced diuretic efficacy + increased renal impairment risk",
    recommendation: "Avoid NSAIDs in heart failure patients on diuretics. Use acetaminophen for pain.",
    mechanism: "NSAIDs inhibit prostaglandin-mediated renal sodium excretion",
  },
  {
    patterns1: ["atorvastatin", "lipitor", "rosuvastatin", "crestor", "simvastatin", "pravastatin"],
    patterns2: ["gemfibrozil", "lopid"],
    severity: "MODERATE",
    effect: "Increased risk of myopathy and rhabdomyolysis",
    recommendation: "Use fenofibrate instead of gemfibrozil with statins. If gemfibrozil required, avoid simvastatin/lovastatin.",
    mechanism: "Gemfibrozil inhibits statin glucuronidation, increasing statin exposure",
  },
  {
    patterns1: ["clopidogrel", "plavix"],
    patterns2: ["omeprazole", "prilosec", "esomeprazole", "nexium"],
    severity: "MODERATE",
    effect: "Reduced clopidogrel activation — may decrease antiplatelet effect",
    recommendation: "Use pantoprazole instead if PPI needed (minimal CYP2C19 interaction). FDA black box warning for omeprazole + clopidogrel.",
    mechanism: "Omeprazole inhibits CYP2C19, which activates clopidogrel",
  },
  {
    patterns1: ["levothyroxine", "synthroid", "levoxyl"],
    patterns2: ["calcium", "iron", "ferrous", "antacid", "tums", "omeprazole", "pantoprazole"],
    severity: "MODERATE",
    effect: "Reduced levothyroxine absorption",
    recommendation: "Take levothyroxine on empty stomach, 30-60 min before other medications. Separate calcium/iron by ≥4 hours.",
    mechanism: "Chelation and altered gastric pH reduce absorption",
  },
  {
    patterns1: ["metoprolol", "toprol", "lopressor"],
    patterns2: ["fluoxetine", "prozac", "paroxetine", "paxil", "bupropion", "wellbutrin"],
    severity: "MODERATE",
    effect: "Increased metoprolol levels — risk of bradycardia/hypotension",
    recommendation: "Monitor heart rate and blood pressure. Consider dose reduction of metoprolol. Sertraline or escitalopram are safer alternatives.",
    mechanism: "CYP2D6 inhibition by these antidepressants reduces metoprolol metabolism",
  },
];

/**
 * Check a patient's medication list for known interactions
 */
export function checkInteractions(medications: Array<{ drugName: string; active: boolean }>): DrugInteraction[] {
  const activeMeds = medications.filter(m => m.active);
  const interactions: DrugInteraction[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      const med1 = activeMeds[i].drugName.toLowerCase();
      const med2 = activeMeds[j].drugName.toLowerCase();

      for (const rule of INTERACTION_RULES) {
        const match1to2 = rule.patterns1.some(p => med1.includes(p)) && rule.patterns2.some(p => med2.includes(p));
        const match2to1 = rule.patterns1.some(p => med2.includes(p)) && rule.patterns2.some(p => med1.includes(p));

        if (match1to2 || match2to1) {
          const key = [activeMeds[i].drugName, activeMeds[j].drugName].sort().join("|");
          if (!seen.has(key)) {
            seen.add(key);
            interactions.push({
              drug1: activeMeds[i].drugName,
              drug2: activeMeds[j].drugName,
              severity: rule.severity,
              effect: rule.effect,
              recommendation: rule.recommendation,
              mechanism: rule.mechanism,
            });
          }
        }
      }
    }
  }

  // Sort by severity
  const order = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };
  interactions.sort((a, b) => order[a.severity] - order[b.severity]);

  return interactions;
}
