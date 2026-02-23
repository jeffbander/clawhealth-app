> **To:** Albert, OpenClaw
> **From:** Manny
> **Date:** February 22, 2026
> **Subject:** Deliverable: Clinical Safety Review of ClawHealth Prompt Architecture

This document provides a formal clinical safety review of the three-tier prompt architecture currently implemented in the ClawHealth platform. The objective of this review is to proactively identify potential clinical risks, failure modes, and edge cases that could impact patient safety. The analysis concludes with a set of actionable recommendations to enhance the robustness and clinical integrity of the AI system.

## 1. Architecture Under Review

The system's design is a sophisticated three-tier model:

1.  **Tier 1 (Base System Prompt):** Establishes the AI's core persona, ethical boundaries, and general conversational rules.
2.  **Tier 2 (Disease-Specific Templates):** A library of structured clinical knowledge for over 18 medical conditions. These templates provide the AI with condition-specific monitoring protocols, escalation triggers, and medication guidance.
3.  **Tier 3 (Patient-Specific Overrides):** Per-patient customizations that allow the AI to adapt to individual patient needs, preferences, and allergies.

## 2. Clinical Safety Analysis and Recommendations

### 2.1. Override Hierarchy and Escalation Integrity

The most significant clinical risk identified is the current override hierarchy, which grants patient-specific overrides (Tier 3) precedence over disease-specific templates (Tier 2). While this is appropriate for accommodating patient preferences, it creates a critical failure mode where a patient preference could inadvertently suppress a life-saving clinical escalation.

**Identified Failure Mode:**

*   A patient with a history of hypertension provides an override: *"I get anxious when I see high blood pressure readings, so please don't alert me about them."*
*   The Hypertension disease template contains a hardcoded red flag to escalate any systolic blood pressure reading over 180 mmHg.
*   **Potential Outcome:** The AI, honoring the patient's override, fails to escalate a hypertensive emergency, placing the patient at imminent risk of a stroke or other catastrophic cardiovascular event.

**Recommendation:**

The integrity of clinical safety protocols must be absolute and non-negotiable. **Red-flag escalation triggers within the disease templates must be architecturally non-overridable.** The system logic must be revised to ensure that safety-critical protocols are immutable and always supersede patient-specific overrides. Patient preferences should only be permitted to modify non-clinical parameters, such as conversational style or the timing of routine check-ins.

### 2.2. Conflict Resolution for Comorbidities

The platform's ability to dynamically combine disease templates for patients with multiple conditions is a powerful feature. However, it also introduces the potential for the AI to provide conflicting or incomplete advice when the clinical guidelines for two conditions are not perfectly aligned.

**Identified Failure Mode:**

*   A patient has both Heart Failure and Chronic Kidney Disease (CKD).
*   The Heart Failure template advises liberal fluid intake to avoid dehydration, while the CKD template recommends strict fluid restriction.
*   **Potential Outcome:** The AI provides contradictory advice, confusing the patient and potentially leading to fluid overload, a dangerous condition for patients with both HF and CKD.

**Recommendation:**

A **clinical conflict resolution engine** must be developed. When the system detects that a patient's combination of disease templates contains conflicting guidance, the case should be automatically flagged and placed in a manual review queue for a human clinician. The AI's output should be suspended for that specific domain of conflict until the clinician provides a single, unified recommendation.

### 2.3. Gaps in Medication Interaction Checking

The newly implemented 15-rule drug interaction checker is a crucial safety feature. However, given the complexity of polypharmacy in the cardiac patient population, this initial set of rules is not exhaustive and leaves potential blind spots.

**Recommendation:**

1.  **Continuous Database Expansion:** The drug interaction database must be treated as a living library, continuously updated with new rules based on the latest clinical evidence and the most common medications prescribed to the patient population.
2.  **Real-Time Conversational Checking:** The AI must be programmed to perform a real-time drug interaction check whenever a patient mentions a new medication during an SMS conversation. This provides an immediate safety net for patient-reported medication changes that occur between physician visits.

### 2.4. Prompt Injection and AI Manipulation

Like all large language model-based systems, the ClawHealth platform is susceptible to prompt injection, where a malicious or even unintentional user input could cause the AI to deviate from its intended clinical function.

**Recommendation:**

1.  **System Prompt Fortification:** The base system prompt (Tier 1) must be fortified with explicit, hard-to-override instructions that reinforce the AI's clinical role and ethical boundaries. It should be instructed to recognize and disregard any user input that attempts to subvert its core mission.
2.  **Regular Adversarial Testing:** The system should undergo regular, automated adversarial testing designed to simulate a wide range of prompt injection attacks. The results of these tests should be used to continuously refine the system's defenses.

## 3. Proposed Enhancements to Clinical Flags

To further enhance the system's proactive monitoring capabilities, the following additions to the red/yellow flag rule set are recommended.

| Condition Monitored | Proposed Flag | Triggering Event | Clinical Rationale |
| :--- | :--- | :--- | :--- |
| **General Mental Health** | **Yellow** | Patient reports new or worsening symptoms of anxiety or depression. | The link between mental health and cardiac outcomes is well-established. Early identification of psychological distress is critical for holistic patient care. |
| **Heart Failure** | **Yellow** | Patient reports a weight gain of 3 or more pounds in a single 24-hour period. | This is a more sensitive and earlier indicator of acute fluid retention than the more common "5 pounds in a week" threshold. |
| **Atrial Fibrillation** | **Yellow** | Patient reports new-onset palpitations that last for more than one hour. | This could signify a change in the patient's arrhythmia burden or a conversion to a sustained arrhythmia, requiring prompt clinical evaluation. |
| **Post-Cardiac Surgery** | **Red** | Patient reports any signs of a potential surgical site infection (e.g., redness, swelling, purulent discharge, fever). | Post-operative wound infections can lead to serious complications, including sepsis, and require immediate medical attention. |

## 4. Conclusion

The three-tier prompt architecture is a robust and innovative foundation for an AI-driven care management platform. By implementing the safety-enhancing recommendations outlined in this review—specifically, making red flags non-overridable, implementing a clinical conflict resolution engine, and continuously expanding the system's clinical knowledge base—ClawHealth can set a new standard for safe, effective, and scalable virtual cardiac care.
