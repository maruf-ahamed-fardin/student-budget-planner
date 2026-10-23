import { redirect } from "next/navigation";

import { AuthFrame, Divider } from "@/components/auth-frame";
import { AuthSwitch, DemoButton, SignupForm } from "@/components/forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <AuthFrame
      title="Open your khata."
      note="free, private, no card needed"
      footer={
        <>
          Already have one? <AuthSwitch href="/login">Log in</AuthSwitch>
        </>
      }
    >
      <SignupForm />
      <Divider />
      <DemoButton>Look around first</DemoButton>
      <p className="mt-4 text-center text-xs text-ink-3">
        Your password is hashed with scrypt and never stored. No email marketing, no trackers.
      </p>
    </AuthFrame>
  );
}
