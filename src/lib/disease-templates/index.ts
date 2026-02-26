/**
 * ClawHealth — Condition-to-Template Routing Map
 *
 * Each entry maps a regex pattern (matched against the patient's condition string)
 * to the corresponding clinical template file.
 *
 * Matching is case-insensitive. Patterns are ordered from most specific to most
 * general to avoid false-positive matches.
 *
 * Existing conditions (3):
 *   HeartFailure.md, Afib.md, Diabetes.md
 *
 * New conditions (12):
 *   CKD.md, COPD.md, Thyroid.md, Obesity.md, AnxietyDepression.md,
 *   DVT_PE.md, PAD.md, ValvularHeartDisease.md, PostCardiacSurgery.md,
 *   Hyperlipidemia.md, ChronicPain.md, SleepApnea.md
 */

const CONDITION_TO_TEMPLATE: Array<{ match: RegExp; file: string }> = [

  // ─── Existing Conditions ────────────────────────────────────────────────────

  {
    // Heart Failure: HFrEF, HFpEF, HFmrEF, congestive heart failure (CHF)
    match: /heart\s*failure|hfr?ef|hfpef|hfmref|chf|congestive\s*heart/i,
    file: 'HeartFailure.md',
  },
  {
    // Atrial Fibrillation: AFib, AF, flutter
    match: /atrial\s*fi(b|brillation)|afib|a-fib|a\.fib|atrial\s*flutter/i,
    file: 'Afib.md',
  },
  {
    // Diabetes: Type 1, Type 2, DM, T1DM, T2DM, IDDM, NIDDM, pre-diabetes
    match: /diabet(es|ic)|dm\s*[12]?|t[12]\s*dm|type\s*[12]\s*d(iabetes|m)|iddm|niddm|pre-?diabet/i,
    file: 'Diabetes.md',
  },

  // ─── New Conditions ──────────────────────────────────────────────────────────

  {
    // Post-Cardiac Surgery: CABG, valve replacement, bypass, sternotomy
    // Listed before more general cardiac terms to avoid misrouting
    match: /post[- ]?cardiac\s*surg(ery|ical)|cabg|coronary\s*artery\s*bypass|valve\s*replacement|valve\s*repair|cardiac\s*surg(ery|ical)|sternotomy|post[- ]?op(erative)?\s*(cardiac|heart|valve|cabg)/i,
    file: 'PostCardiacSurgery.md',
  },
  {
    // Valvular Heart Disease: aortic stenosis, mitral regurgitation, valve disease
    match: /valvular|valve\s*disease|aortic\s*sten(osis)?|aortic\s*regurg(itation)?|mitral\s*sten(osis)?|mitral\s*regurg(itation)?|mitral\s*valve\s*prolapse|mvp|tricuspid|pulmonic\s*valve/i,
    file: 'ValvularHeartDisease.md',
  },
  {
    // Pulmonary Embolism & DVT: deep vein thrombosis, blood clot, anticoagulation
    match: /pulmonary\s*embol(ism|us)|pe\b|deep\s*vein\s*thrombosis|dvt|venous\s*thromboembol(ism|us)|vte|blood\s*clot\s*(in\s*(leg|lung))?/i,
    file: 'DVT_PE.md',
  },
  {
    // Peripheral Artery Disease: PAD, claudication, peripheral vascular disease
    match: /peripheral\s*artery\s*disease|peripheral\s*arterial\s*disease|\bpad\b|peripheral\s*vascular\s*disease|\bpvd\b|claudication|limb\s*ischemia/i,
    file: 'PAD.md',
  },
  {
    // Chronic Kidney Disease: CKD, renal failure, ESRD, dialysis, nephropathy
    match: /chronic\s*kidney\s*disease|\bckd\b|renal\s*(failure|insufficiency|disease)|end[- ]?stage\s*renal|\besrd\b|dialysis|nephropathy|glomerulonephritis|nephrotic/i,
    file: 'CKD.md',
  },
  {
    // COPD / Asthma: chronic obstructive pulmonary disease, emphysema, bronchitis
    match: /\bcopd\b|chronic\s*obstructive\s*pulmonary|emphysema|chronic\s*bronchitis|asthma|reactive\s*airway|bronchospasm|obstructive\s*lung/i,
    file: 'COPD.md',
  },
  {
    // Thyroid: hypothyroidism, hyperthyroidism, Hashimoto, Graves, thyroid disease
    match: /hypo\s*thyroid(ism)?|hyper\s*thyroid(ism)?|thyroid\s*disease|hashimoto|graves\s*disease|thyrotoxicosis|myxedema|goiter/i,
    file: 'Thyroid.md',
  },
  {
    // Obesity / Weight Management: BMI, overweight, GLP-1, bariatric
    match: /obes(ity|e)|overweight|weight\s*management|weight\s*loss\s*program|bmi\s*[>≥]\s*3[05]|glp-?1|semaglutide|liraglutide|tirzepatide|bariatric/i,
    file: 'Obesity.md',
  },
  {
    // Anxiety / Depression: mental health, mood disorder, SSRI, SNRI
    match: /anxiety|depress(ion|ed|ive)|mental\s*health|mood\s*disorder|panic\s*disorder|generalized\s*anxiety|\bgad\b|\bmdd\b|major\s*depressive|ssri|snri|antidepressant/i,
    file: 'AnxietyDepression.md',
  },
  {
    // Hyperlipidemia: high cholesterol, dyslipidemia, statin, LDL
    match: /hyperlipidemia|hyperchol(esterol(emia)?)?|dyslipidemia|high\s*cholesterol|elevated\s*(ldl|cholesterol|lipids)|statin\s*therapy|ldl[- ]?lowering/i,
    file: 'Hyperlipidemia.md',
  },
  {
    // Chronic Pain: fibromyalgia, neuropathic pain, musculoskeletal pain
    match: /chronic\s*pain|fibromyalgia|neuropathic\s*pain|musculoskeletal\s*pain|chronic\s*back\s*pain|osteoarthritis|degenerative\s*joint|pain\s*management/i,
    file: 'ChronicPain.md',
  },
  {
    // Sleep Apnea: OSA, CPAP, BIPAP, PAP therapy, sleep-disordered breathing
    match: /sleep\s*apnea|obstructive\s*sleep\s*apnea|\bosa\b|central\s*sleep\s*apnea|\bcsa\b|\bcpap\b|\bbipap\b|pap\s*therapy|sleep[- ]?disordered\s*breathing/i,
    file: 'SleepApnea.md',
  },
];

export default CONDITION_TO_TEMPLATE;
