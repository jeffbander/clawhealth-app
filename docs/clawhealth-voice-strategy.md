> **To:** Albert, OpenClaw
> **From:** Manny
> **Date:** February 22, 2026
> **Subject:** Deliverable: ClawHealth Voice Strategy Document

This document presents a comprehensive clinical and technical strategy for integrating an AI-powered voice communication system into the ClawHealth chronic cardiac care management platform. The strategy is designed to complement the existing SMS-based system, enhancing patient engagement and clinical oversight for a complex patient population at Mount Sinai West. The framework addresses patient segmentation, call scheduling, voice persona design, escalation protocols, cost-benefit analysis, technical integration, compliance considerations, and a recommended rollout plan.

## 1. Strategic Context and Patient Population

ClawHealth currently utilizes SMS via Twilio, powered by a Claude Sonnet 4.5-based AI, to manage patients with a range of chronic cardiac conditions. The patient demographic is notably diverse, including elderly individuals (ages 50-80), members of the Orthodox Jewish community with specific communication needs, and international VIP patients. The successful integration of a voice modality is critical for addressing the segments of this population for whom SMS is not the optimal communication channel.

## 2. Patient Communication Channel Framework

The selection of a communication channel—voice, SMS, or a hybrid approach—must be a patient-centric and clinically informed decision. A rigid, one-size-fits-all approach is insufficient. The following table outlines a decision framework for segmenting patients to the most appropriate channel.

| Patient Segment | Recommended Channel | Clinical Rationale and Implementation Notes |
| :--- | :--- | :--- |
| **High-Risk & Post-Discharge** | **Voice-First** | The immediate post-discharge period is a high-risk window. The nuance and empathy conveyed through voice are superior for daily clinical assessments and building patient trust. |
| **Elderly (70+) or Low Tech Literacy** | **Voice-First** | For patients with visual impairments, dexterity challenges, or a lack of familiarity with smartphones, voice calls are a more accessible and less burdensome communication method. |
| **Orthodox Jewish Patients** | **Hybrid (SMS with Voice Option)** | To respect religious observances (Shabbat, holidays), non-urgent communications should default to SMS. Voice calls for urgent matters should be scheduled on weekdays, with patients having the option to request voice follow-up. |
| **Stable & Tech-Savvy Patients** | **SMS-First** | For patients who are clinically stable and proficient with mobile technology, SMS remains a highly efficient and cost-effective channel for routine check-ins and data collection. |
| **VIP & International Patients** | **Patient Preference** | This cohort requires a bespoke approach. Onboarding should include a direct conversation to establish their preferred communication modality and scheduling requirements across different time zones. |

**Implementation:** The preferred communication channel will be established during the patient onboarding process and stored as a configurable parameter in the patient's profile. This setting can be updated at any time by the clinical team or upon patient request.

## 3. Call Cadence and Clinical Scheduling

A structured, proactive call schedule is fundamental to effective remote patient monitoring. The frequency and timing of calls should be dictated by clinical need rather than a uniform schedule.

| Call Type | Frequency & Trigger | Purpose and Clinical Logic |
| :--- | :--- | :--- |
| **Post-Discharge Welcome Call** | Once, within 24 hours of hospital discharge | To establish a personal connection, confirm understanding of the discharge plan and medications, and schedule the first clinical check-in. |
| **Daily Clinical Check-in** | Daily for the first 14 days post-discharge or for high-risk patients | Morning calls (9-11 AM local time) to assess for early signs of decompensation, monitor symptoms, and reinforce medication adherence. |
| **Weekly Clinical Review** | Weekly for stable patients | A scheduled touchpoint to review the prior week's progress, address any emerging concerns, and provide ongoing education and encouragement. |
| **Targeted Medication Reminders** | As needed, based on adherence data | Proactive calls placed 15-30 minutes prior to scheduled medication times, specifically for patients with a documented history of low adherence. |
| **Urgent Escalation Calls** | Immediate, triggered by red-flag events | Automated, immediate calls to instruct the patient on critical next steps (e.g., "This is a medical alert from Dr. Bander's office. Your reported symptoms of chest pain require immediate attention. Please call 911 now."). |

## 4. AI Voice Persona and Clinical Tone

The AI's voice persona is a critical determinant of patient trust and engagement. It must project a professional, clinical authority while maintaining a tone of warmth and empathy. The goal is to create an experience that feels like a natural extension of the Mount Sinai care team.

*   **Tone and Pacing:** The voice should be calm, reassuring, and professional. The pacing should be deliberate and slightly slower than a typical conversational speed to ensure comprehension, particularly for elderly patients or those with cognitive impairment. Strategic use of pauses is essential to allow patients adequate time to process information and formulate their responses.
*   **Language and Vocabulary:** All communication must be delivered in simple, clear language, adhering to a 5th to 6th-grade reading level. Clinical jargon must be avoided. If a technical term is unavoidable, it must be immediately followed by a simple, patient-friendly explanation.
*   **AI Introduction:** The AI must clearly identify itself at the beginning of every call to avoid confusion. For example: "Hello, this is the automated clinical assistant from Dr. Jeff Bander's cardiology practice at Mount Sinai West, calling on his behalf."
*   **Voice Selection:** A high-quality, natural-sounding voice from ElevenLabs is recommended. A voice with a warm, mid-range pitch and a standard American accent should be selected and tested with a patient focus group before full deployment.

## 5. Integration with Clinical Escalation Engine

The voice system must be tightly integrated with the existing red/yellow flag clinical escalation engine. The communication modality for an alert should be determined by its clinical urgency.

| Alert Level | Communication Action | Workflow |
| :--- | :--- | :--- |
| **Red Flag** | **Immediate Automated Voice Call** | A red flag (e.g., severe chest pain, shortness of breath at rest) triggers an immediate, automated voice call instructing the patient to seek emergency care. Simultaneously, a high-priority alert is pushed to the physician dashboard. |
| **Yellow Flag** | **Scheduled AI Voice Call** | A yellow flag (e.g., significant weight gain, sustained high blood pressure) triggers a scheduled AI-driven voice call within 12-24 hours to investigate the issue. An alert is also sent to the physician dashboard for clinical review. |
| **SMS Non-Response** | **Automated Voice Call Follow-up** | If a patient fails to respond to a time-sensitive SMS message within a predefined window (e.g., 2 hours), the system automatically initiates a voice call to ensure the information is received. |

## 6. Cost-Benefit and ROI Analysis

The integration of AI-powered voice represents a strategic investment in scalable, high-quality patient care. The following table provides a comparative analysis of the estimated costs.

| Metric | ElevenLabs AI Voice Call | Human Nurse Call |
| :--- | :--- | :--- |
| **Estimated Cost per Minute** | $0.10 - $0.15 [1] | $5.00 - $12.00 [2] |
| **Cost per 5-Minute Call** | $0.50 - $0.75 | $25.00 - $60.00 |
| **Operational Availability** | 24/7/365 | Primarily business hours, with significantly higher costs for after-hours support |

**Return on Investment (ROI) Projection:**

*   **Direct Cost Savings:** By automating routine check-ins and clinical monitoring calls, the platform can significantly reduce the reliance on costly human nurse call centers. For every 1,000 five-minute calls automated, the projected cost savings range from approximately $24,250 to $59,250.
*   **Enhanced Revenue Capture:** The detailed, automated documentation of patient interactions provided by the voice platform can provide robust support for billing Chronic Care Management (CCM) codes (e.g., CPT 99490, 99491), leading to increased and more consistent revenue.
*   **Improved Clinical Outcomes:** The primary ROI driver is the improvement in patient health. Proactive, consistent voice engagement has been shown to improve medication adherence, enable earlier detection of clinical deterioration, and ultimately reduce costly hospital readmissions.

## 7. Technical Integration and Architecture

The voice system will be integrated as a new modality within the existing three-tier prompt architecture. The `ConditionTemplate` schema in the database will be extended to include voice-specific fields, such as `voiceIntroductionScript` and `voiceCallFlows`.

*   **Telephony and TTS:** Twilio's Voice API will serve as the telephony backbone for initiating and managing calls. ElevenLabs will be integrated to provide real-time, high-quality text-to-speech generation for the AI's voice.
*   **Latency Optimization:** Minimizing latency is paramount for a natural conversational experience. The system will be architected to reduce the delay between patient utterance and AI response. This will involve techniques such as pre-generating common audio phrases and utilizing a high-performance tier of the ElevenLabs API.

## 8. HIPAA Compliance and Patient Privacy

Strict adherence to HIPAA is a non-negotiable requirement. The following compliance measures will be implemented.

*   **Business Associate Agreements (BAAs):** A signed BAA will be executed with ElevenLabs and all other third-party vendors that handle Protected Health Information (PHI) [3].
*   **Explicit Patient Consent:** Patients must provide explicit, documented consent to be contacted by the AI voice assistant as part of the initial onboarding process.
*   **Call Recording and Encryption:** All voice interactions will be recorded for clinical documentation and quality assurance. Patients will be notified at the beginning of each call that the conversation is being recorded. All recordings will be encrypted both in transit and at rest.
*   **Patient Authentication:** Before discussing any PHI, the AI will verify the patient's identity by confirming their full name and date of birth.

## 9. Phased Rollout and Implementation Plan

A carefully managed, phased rollout is recommended to mitigate risk and allow for iterative refinement based on real-world feedback.

1.  **Phase 1 (Internal Validation):** Rigorous internal testing of the voice system with a cohort of internal users to identify and resolve any technical bugs or usability issues.
2.  **Phase 2 (Controlled Pilot Program):** A controlled pilot with a small, select group of 10-20 high-risk, post-discharge patients. This phase will involve intensive monitoring of system performance and gathering of feedback from both patients and clinicians.
3.  **Phase 3 (Gradual Expansion):** A gradual expansion of the program to include additional patient segments, prioritized by clinical need and suitability for voice communication.
4.  **Phase 4 (Full Platform Integration):** Following successful validation in the prior phases, the voice system will be integrated as a standard feature available to all eligible ClawHealth patients.

---

### References

[1] ElevenLabs. (2026). *Pricing*. Retrieved from https://elevenlabs.io/pricing
[2] Anytime Telecare. (2026). *How Much Do Nurse Triage Services Cost?*. Retrieved from https://anytimetelecare.com/nurse-triage-and-after-hours-care/how-much-does-nurse-triage-services-cost/
[3] Dialzara. (2026). *HIPAA Compliant AI Voice Agent: Security & Compliance Guide*. Retrieved from https://dialzara.com/blog/ai-phone-agent-compliance-security-and-hipaa-guide
