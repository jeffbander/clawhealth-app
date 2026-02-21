"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "info" | "health" | "confirm" | "done";

export default function PatientEnrollPage() {
  const [step, setStep] = useState<Step>("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [patientId, setPatientId] = useState("");

  const CONDITION_OPTIONS = [
    "Heart Failure",
    "Atrial Fibrillation",
    "Coronary Artery Disease",
    "Hypertension",
    "Diabetes",
    "High Cholesterol",
    "Heart Valve Disease",
    "Prior Heart Attack",
    "Arrhythmia",
    "Other",
  ];

  function toggleCondition(c: string) {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const e164 = phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`;

      // Build EMR-like text from patient input for the onboard API
      const emrText = [
        `Patient: ${firstName} ${lastName}`,
        `DOB: ${dob}`,
        `Phone: ${e164}`,
        "",
        conditions.length > 0 ? `CONDITIONS:\n${conditions.map((c) => `- ${c}`).join("\n")}` : "",
        medications ? `MEDICATIONS:\n${medications}` : "",
        additionalInfo ? `ADDITIONAL INFORMATION:\n${additionalInfo}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/patients/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone: e164, dob, conditions, medications, additionalInfo, emrText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrollment failed");

      setPatientId(data.patientId);
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="text-lg font-bold" style={{ color: "#212070" }}>ClawHealth</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {(["info", "health", "confirm"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s || (step as string) === "done"
                      ? "text-white"
                      : (["info", "health", "confirm"].indexOf(step as "info" | "health" | "confirm") > i || (step as string) === "done")
                      ? "text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                  style={
                    step === s || ["info", "health", "confirm"].indexOf(step as "info" | "health" | "confirm") > i || (step as string) === "done"
                      ? { background: "linear-gradient(135deg, #212070, #06ABEB)" }
                      : {}
                  }
                >
                  {["info", "health", "confirm"].indexOf(step as "info" | "health" | "confirm") > i || (step as string) === "done" ? "✓" : i + 1}
                </div>
                {i < 2 && <div className={`w-6 h-0.5 rounded ${["info", "health", "confirm"].indexOf(step as "info" | "health" | "confirm") > i || (step as string) === "done" ? "bg-[#06ABEB]" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        {/* ── Step 1: Basic Info ─── */}
        {step === "info" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: "#00002D" }}>Let&apos;s get you set up</h1>
              <p className="text-gray-500 mt-1">We&apos;ll use your phone number to communicate with you via text message.</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">First Name</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06ABEB] focus:border-transparent"
                    placeholder="Margaret"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">Last Name</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06ABEB] focus:border-transparent"
                    placeholder="Sullivan"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Phone Number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06ABEB] focus:border-transparent"
                  placeholder="(212) 555-1234"
                />
                <span className="text-xs text-gray-400 mt-1 block">We&apos;ll text you at this number. Standard messaging rates apply.</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Date of Birth</span>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06ABEB] focus:border-transparent"
                />
              </label>
            </div>
            <button
              onClick={() => setStep("health")}
              disabled={!firstName || !lastName || !phone || phone.replace(/\D/g, "").length < 10}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: Health Info ─── */}
        {step === "health" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: "#00002D" }}>Your health information</h1>
              <p className="text-gray-500 mt-1">Optional — your doctor can add this later. But the more we know, the better we can help.</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div>
                <span className="text-sm font-semibold text-gray-700 block mb-3">Heart conditions (select all that apply)</span>
                <div className="flex flex-wrap gap-2">
                  {CONDITION_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCondition(c)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                        conditions.includes(c)
                          ? "text-white border-transparent"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                      style={conditions.includes(c) ? { background: "linear-gradient(135deg, #212070, #06ABEB)" } : {}}
                    >
                      {conditions.includes(c) ? "✓ " : ""}{c}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Current medications</span>
                <textarea
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06ABEB] focus:border-transparent resize-y"
                  placeholder={"Example:\nLisinopril 10mg daily\nMetoprolol 25mg twice daily\nAtorvastatin 40mg at bedtime"}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Anything else we should know?</span>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06ABEB] focus:border-transparent resize-y"
                  placeholder="Allergies, prior surgeries, concerns..."
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("info")}
                className="flex-1 py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="flex-[2] py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
              >
                Continue
              </button>
            </div>
            <button onClick={() => setStep("confirm")} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">
              Skip — my doctor will add this
            </button>
          </div>
        )}

        {/* ── Step 3: Confirm ─── */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: "#00002D" }}>Confirm your enrollment</h1>
              <p className="text-gray-500 mt-1">Review your information before we create your account.</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Name</span>
                <span className="text-sm font-semibold text-gray-900">{firstName} {lastName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Phone</span>
                <span className="text-sm font-semibold text-gray-900">{phone}</span>
              </div>
              {dob && (
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Date of Birth</span>
                  <span className="text-sm font-semibold text-gray-900">{new Date(dob + "T12:00:00").toLocaleDateString()}</span>
                </div>
              )}
              {conditions.length > 0 && (
                <div className="flex justify-between items-start py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Conditions</span>
                  <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                    {conditions.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {medications && (
                <div className="py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500 block mb-1">Medications</span>
                  <span className="text-sm text-gray-700 whitespace-pre-wrap">{medications}</span>
                </div>
              )}
            </div>

            {/* Consent */}
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 space-y-2">
              <h4 className="text-sm font-bold text-blue-900">By enrolling, you agree that:</h4>
              <ul className="text-sm text-blue-700 space-y-1.5">
                <li>• ClawHealth may text you about your health at the number provided</li>
                <li>• Your health information is encrypted and stored securely</li>
                <li>• This is <strong>not</strong> a replacement for emergency care — call 911 for emergencies</li>
                <li>• You can text STOP at any time to opt out</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("health")}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-[2] py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}
              >
                {loading ? "Creating your account..." : "✅ Enroll Now"}
              </button>
            </div>
          </div>
        )}

        {/* ── Done ─── */}
        {step === "done" && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl bg-emerald-50">
              🎉
            </div>
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: "#00002D" }}>You&apos;re enrolled!</h1>
              <p className="text-gray-500 mt-2 text-lg">Welcome to ClawHealth, {firstName}.</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 text-left">
              <h3 className="font-bold text-gray-900">What happens next:</h3>
              <div className="space-y-3">
                {[
                  { icon: "📱", text: "You'll receive a welcome text at your phone number shortly" },
                  { icon: "👨‍⚕️", text: "Your cardiologist will review and complete your health profile" },
                  { icon: "💬", text: `Text (929) 412-1499 anytime with questions about your health` },
                  { icon: "⏰", text: "You'll get daily check-ins and medication reminders" },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <span className="text-sm text-gray-600">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 rounded-2xl border border-amber-100 px-5 py-4 text-left">
              <p className="text-sm text-amber-800">
                <strong>Remember:</strong> For chest pain, difficulty breathing, or any emergency — call <strong>911</strong> immediately. ClawHealth is not a substitute for emergency medical care.
              </p>
            </div>
            <Link href="/" className="inline-block text-sm font-semibold no-underline px-6 py-3 rounded-2xl text-white" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
              Back to Home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
