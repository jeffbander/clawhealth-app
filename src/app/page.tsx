import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const user = await currentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #212070 0%, #1a1a5c 50%, #06ABEB 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "1.5rem",
          padding: "3rem",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Logo / Brand */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "1rem",
              background: "linear-gradient(135deg, #212070, #06ABEB)",
              marginBottom: "1rem",
            }}
          >
            <span style={{ fontSize: "2rem" }}>🏥</span>
          </div>
          <h1
            style={{
              fontSize: "1.875rem",
              fontWeight: 700,
              color: "#212070",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            ClawHealth
          </h1>
          <p
            style={{
              fontSize: "1.125rem",
              color: "#64748b",
              marginTop: "0.5rem",
              fontWeight: 400,
            }}
          >
            AI Health Coordination
          </p>
        </div>

        <p
          style={{
            color: "#64748b",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}
        >
          HIPAA-compliant AI patient coordinators under physician supervision.
          Cardiology program powered by Mount Sinai West.
        </p>

        {/* Trust badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginBottom: "2rem",
          }}
        >
          {["HIPAA", "SOC 2", "Mount Sinai"].map((badge) => (
            <span
              key={badge}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                background: "#e8f7fd",
                color: "#212070",
                border: "1px solid #06ABEB",
              }}
            >
              ✓ {badge}
            </span>
          ))}
        </div>

        <Link
          href="/sign-in"
          style={{
            display: "block",
            background: "#DC298D",
            color: "white",
            padding: "0.875rem 2rem",
            borderRadius: "0.75rem",
            fontWeight: 600,
            fontSize: "1rem",
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Sign In
        </Link>

        <p style={{ marginTop: "1.25rem", fontSize: "0.8125rem", color: "#94a3b8" }}>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" style={{ color: "#06ABEB", fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
