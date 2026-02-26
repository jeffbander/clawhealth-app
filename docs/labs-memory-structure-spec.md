# Labs / History / Trends Markdown Structure Specification

**Author:** Manny (ClawHealth AI)  
**Date:** 2026-02-25  
**Status:** Proposed — awaiting Albert's review  
**Responds to:** `request-labs-memory-structure.md`

---

## 1. Labs.md Structure

```markdown
# Labs.md — [Patient Name]
*Rolling lab updates. Keep newest entries at top; max 10 entries.*

## Latest Labs
- [2026-02-25] BNP: 450 pg/mL
- [2026-02-25] Potassium: 4.2 mEq/L
- [2026-02-25] Creatinine: 1.1 mg/dL
- [2026-02-24] INR: 2.3
- [2026-02-20] Hemoglobin: 13.5 g/dL

## Reference Ranges (Cardiology)
| Test | Normal | Yellow Flag | Red Flag |
|------|--------|-------------|----------|
| BNP | <100 pg/mL | 100-500 | >500 |
| Potassium | 3.5-5.0 mEq/L | 3.0-3.5 or 5.0-5.5 | <3.0 or >6.0 |
| Creatinine | 0.6-1.2 mg/dL | 1.2-2.0 | >4.0 |
| INR (on warfarin) | 2.0-3.0 | 1.5-2.0 or 3.0-4.0 | <1.5 or >4.0 |
| Troponin | <0.04 ng/mL | 0.04-0.4 | >0.4 |
```

### Format Rules
- Each entry: `- [YYYY-MM-DD] TestName: Value Unit`
- Newest entries at top
- Maximum 10 entries per section (older entries pruned on merge)
- Units always included
- Date always in ISO format

## 2. MedicalHistory.md Structure

```markdown
# MedicalHistory.md — [Patient Name]
*Longitudinal conditions, procedures, and notable history.*

## Conditions
- Heart Failure with reduced ejection fraction (HFrEF)
- Atrial Fibrillation (persistent)
- Type 2 Diabetes Mellitus
- Chronic Kidney Disease Stage 3a

## Procedures
- [2025-08] Cardiac catheterization — no significant CAD
- [2024-03] Pacemaker implantation (dual-chamber)
- [2023-11] Cardioversion for atrial fibrillation

## Allergies
- Penicillin (anaphylaxis)
- ACE inhibitors (angioedema — documented)

## Additional Notes
- Family history: father MI at age 52
- Social: former smoker (quit 2020), no alcohol
```

## 3. Trends.md Structure

```markdown
# Trends.md — [Patient Name]
*Track trajectory for vitals and symptoms over time.*

## Weight Trend
- 2026-02-25: Weight 185 lbs
- 2026-02-23: Weight 183 lbs
- 2026-02-20: Weight 182 lbs
→ Trend: +3 lbs over 5 days (FLAG for HF patients)

## Blood Pressure Trend
- 2026-02-25: BP 138/82
- 2026-02-23: BP 142/86
- 2026-02-20: BP 135/80
→ Trend: Stable, within target range

## Symptom Trend
- 2026-02-25: Mild ankle swelling (new)
- 2026-02-23: No symptoms reported
- 2026-02-20: Occasional palpitations (resolved)
```

## 4. Merge Strategy (EMR Paste)

When new EMR data is pasted, the merge follows these rules:

| File | Strategy | Details |
|------|----------|---------|
| Labs.md | **Prepend + deduplicate** | New labs go to top. If same test on same date exists, newer value wins. Cap at 10 entries. |
| MedicalHistory.md | **Append novel items** | New conditions/procedures added only if not already present (normalized string match). Never removes existing entries. |
| Trends.md | **Prepend + cap** | New data points added to top of each trend section. Cap at 10 entries per section. |
| CarePlan.md | **Append addenda** | New plan items go under "## EMR Addenda" with timestamp. Never overwrites existing plan content. |

### Conflict Resolution
- **Same test, same date, different value:** Newer value wins (later paste overwrites)
- **Contradictory conditions:** Both kept; flagged for physician review
- **Medication changes:** Always create UNVERIFIED entry; never auto-update active med list

## 5. Clinical Safety Considerations

1. **All EMR-pasted data enters as UNVERIFIED** — tagged with `sourceType: EMR_IMPORT` and `verificationStatus: UNVERIFIED`
2. **Critical lab values trigger immediate alerts** regardless of verification status (e.g., K+ > 6.0, Troponin > 0.4)
3. **Medication changes from EMR paste** create a PENDING_REVIEW entry, not an auto-update to the active med list
4. **The AI agent reads Labs.md** but treats values as informational context, not actionable orders
5. **Physician must verify** before any auto-generated care plan changes based on lab data

## 6. UI Presentation (Implemented)

The `LabsViewer` component renders Labs.md as a clinical-grade table:
- **Date grouping** — labs grouped by collection date
- **Color-coded status** — Normal (green), High (amber), Low (blue), Critical (red)
- **Reference ranges** — 30+ cardiology-relevant lab reference ranges built in
- **Toggle view** — Switch between rich table view and raw markdown
- **Critical value alerts** — Banner when critical values are present

The `VerificationQueue` component shows unverified items:
- Inline on patient detail page
- One-click verify/dispute actions
- Source type and confidence score displayed
- Clears automatically when all items reviewed

---

*This spec implements the hybrid storage model: structured clinical data in Postgres (with source attribution fields), soft context in markdown files. The markdown files are the human-readable layer; the database is the queryable/reportable layer.*
