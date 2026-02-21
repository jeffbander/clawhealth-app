export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-white overflow-hidden">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span className="text-xl font-bold" style={{ color: "#212070" }}>ClawHealth</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900 no-underline px-4 py-2">
              Physician Login
            </Link>
            <Link href="/enroll" className="text-sm font-semibold text-white no-underline px-5 py-2.5 rounded-full transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
              Patient Enrollment
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 relative">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #06ABEB, transparent)" }} />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #212070, transparent)" }} />
        </div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative">
          {/* Left — Copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Now Available — Mount Sinai Cardiology
            </div>
            <h1 className="text-[3.25rem] leading-[1.1] font-extrabold tracking-tight" style={{ color: "#00002D" }}>
              Your personal AI<br />
              <span style={{ color: "#06ABEB" }}>health coordinator</span>
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed max-w-lg">
              24/7 care between visits. Text anytime about your medications, symptoms, or questions — your AI coordinator knows your health history and works directly with your cardiologist.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/enroll" className="inline-flex items-center justify-center gap-2 text-white font-semibold text-base px-8 py-4 rounded-2xl no-underline transition-all hover:shadow-xl hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
                Get Started — It&apos;s Free
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 text-gray-600 font-semibold text-base px-8 py-4 rounded-2xl no-underline border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                How It Works
              </a>
            </div>
            {/* Trust row */}
            <div className="flex items-center gap-5 pt-2">
              {[
                { icon: "🔒", label: "HIPAA Compliant" },
                { icon: "👨‍⚕️", label: "Physician Supervised" },
                { icon: "🔐", label: "AES-256 Encrypted" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                  <span>{t.icon}</span> {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right — Phone mockup with SMS conversation */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              {/* Phone frame */}
              <div className="w-[320px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="bg-white rounded-[2.25rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="h-12 flex items-center justify-center text-xs font-semibold text-gray-500" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
                    <span className="text-white/90 text-xs">ClawHealth AI</span>
                  </div>
                  {/* Chat */}
                  <div className="px-4 py-5 space-y-4 min-h-[420px]">
                    {/* AI message */}
                    <div className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: "linear-gradient(135deg, #06ABEB, #212070)" }}>
                        <span className="text-white">🤖</span>
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[220px]">
                        <p className="text-sm text-gray-700 m-0 leading-relaxed">Good morning Margaret! 👋 Time for your morning medications. Have you taken your Entresto and Carvedilol?</p>
                        <span className="text-[10px] text-gray-400 mt-1.5 block">8:00 AM</span>
                      </div>
                    </div>
                    {/* Patient message */}
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-tr-md px-4 py-3 max-w-[220px]" style={{ background: "#212070" }}>
                        <p className="text-sm text-white m-0">Yes! All taken. My weight is 165 today</p>
                        <span className="text-[10px] text-white/50 mt-1.5 block text-right">8:12 AM</span>
                      </div>
                    </div>
                    {/* AI response */}
                    <div className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: "linear-gradient(135deg, #06ABEB, #212070)" }}>
                        <span className="text-white">🤖</span>
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[220px]">
                        <p className="text-sm text-gray-700 m-0 leading-relaxed">Great job! ✅ Your weight is stable — no change from yesterday. Keep it up!</p>
                        <span className="text-[10px] text-gray-400 mt-1.5 block">8:12 AM</span>
                      </div>
                    </div>
                    {/* Patient question */}
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-tr-md px-4 py-3 max-w-[220px]" style={{ background: "#212070" }}>
                        <p className="text-sm text-white m-0">Can I take ibuprofen for my knee?</p>
                        <span className="text-[10px] text-white/50 mt-1.5 block text-right">8:14 AM</span>
                      </div>
                    </div>
                    {/* AI clinical response */}
                    <div className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: "linear-gradient(135deg, #06ABEB, #212070)" }}>
                        <span className="text-white">🤖</span>
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[220px]">
                        <p className="text-sm text-gray-700 m-0 leading-relaxed">⚠️ Ibuprofen can interact with your heart medications. Try Tylenol instead, and I&apos;ll flag this for Dr. Bander to review.</p>
                        <span className="text-[10px] text-gray-400 mt-1.5 block">8:14 AM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-8 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg">✅</div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Meds Confirmed</div>
                  <div className="text-[11px] text-gray-400">Logged automatically</div>
                </div>
              </div>
              <div className="absolute -top-2 -right-8 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">👨‍⚕️</div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Dr. Bander notified</div>
                  <div className="text-[11px] text-gray-400">Drug interaction flagged</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof Bar ─────────────────────────────────── */}
      <section className="border-y border-gray-100 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-10 text-center">
          {[
            { value: "24/7", label: "Always Available" },
            { value: "100%", label: "HIPAA Compliant" },
            { value: "<30s", label: "Response Time" },
            { value: "AES-256", label: "Encryption" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-extrabold" style={{ color: "#212070" }}>{s.value}</div>
              <div className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold" style={{ color: "#00002D" }}>How It Works</h2>
            <p className="text-gray-500 mt-3 text-lg">Three simple steps to better heart health</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: "1",
                icon: "📋",
                title: "Your doctor enrolls you",
                desc: "Your cardiologist adds your medications, conditions, and care plan to ClawHealth. Everything is encrypted and HIPAA-compliant.",
              },
              {
                step: "2",
                icon: "💬",
                title: "Text anytime",
                desc: "Message your AI coordinator about medications, symptoms, side effects, or questions. It knows your complete health history.",
              },
              {
                step: "3",
                icon: "🫀",
                title: "Smarter care between visits",
                desc: "Daily check-ins, medication reminders, and symptom monitoring — with automatic alerts to your doctor when something needs attention.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-lg" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
                  <span>{s.icon}</span>
                </div>
                <div className="inline-block text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#e8f7fd", color: "#212070" }}>Step {s.step}</div>
                <h3 className="text-lg font-bold" style={{ color: "#00002D" }}>{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold" style={{ color: "#00002D" }}>What Your AI Coordinator Does</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "💊", title: "Medication Reminders", desc: "Daily reminders personalized to your schedule. Tracks when you take them." },
              { icon: "📊", title: "Vitals Tracking", desc: "Log weight, blood pressure, and symptoms by text. Spots concerning trends." },
              { icon: "🚨", title: "Smart Alerts", desc: "Detects warning signs and notifies your doctor automatically." },
              { icon: "💬", title: "24/7 Questions", desc: "Ask about side effects, drug interactions, diet — anytime." },
              { icon: "📅", title: "Visit Preparation", desc: "Summarizes your recent health data before appointments." },
              { icon: "🔒", title: "Completely Private", desc: "Bank-grade encryption. Your data is never sold or shared." },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h4 className="font-bold text-gray-900 mb-2">{f.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Physician Trust Section ──────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl font-extrabold" style={{ color: "#00002D" }}>Physician-Supervised AI</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            ClawHealth is built and supervised by board-certified cardiologists at Mount Sinai. 
            Your AI coordinator follows clinical protocols and escalates to your doctor when needed — 
            it never makes medical decisions on its own.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
            {[
              "Board-certified physician oversight",
              "ACC/AHA guideline-based protocols",
              "Automatic emergency escalation",
              "Complete audit trail",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-medium" style={{ color: "#212070" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#e8f7fd"/><path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#06ABEB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center rounded-3xl p-12 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
          <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 30% 50%, white, transparent)" }} />
          <div className="relative">
            <h2 className="text-3xl font-extrabold text-white mb-4">Ready to get started?</h2>
            <p className="text-white/70 text-lg mb-8 max-w-lg mx-auto">
              Join the cardiology patients already using ClawHealth for 24/7 care coordination. 
              It takes less than 2 minutes to enroll.
            </p>
            <Link href="/enroll" className="inline-flex items-center gap-2 bg-white font-bold text-base px-8 py-4 rounded-2xl no-underline transition-all hover:shadow-xl hover:-translate-y-0.5" style={{ color: "#212070" }}>
              Enroll Now — Free
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 5l5 5-5 5" stroke="#212070" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: "linear-gradient(135deg, #212070, #06ABEB)" }}>
              <span className="text-white text-[10px] font-bold">C</span>
            </div>
            <span className="text-sm font-bold" style={{ color: "#212070" }}>ClawHealth</span>
            <span className="text-xs text-gray-400 ml-2">© 2026</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <span>HIPAA Compliant</span>
            <span>•</span>
            <span>SOC 2</span>
            <span>•</span>
            <span>Mount Sinai Cardiology</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
