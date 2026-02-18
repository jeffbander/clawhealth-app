export const dynamic = "force-dynamic";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
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
      <SignIn />
    </main>
  );
}
