import { redirect } from "next/navigation";

import { AuthFrame, Divider } from "@/components/auth-frame";
import { AuthSwitch, DemoButton, LoginForm } from "@/components/forms";
import { Notice } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/utils";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }) {
  const { next, error } = await searchParams;
  const destination = safeNextPath(next);
  if (await getCurrentUser()) redirect(destination);

  return (
    <AuthFrame
      title="Welcome back."
      note="your khata missed you"
      footer={
        <>
          New here? <AuthSwitch href="/signup">Create an account</AuthSwitch>
        </>
      }
    >
      {error === "demo-limit" && (
        <Notice tone="amber" className="mb-5">
          Too many demo sandboxes from this network in the last hour. Try again later, or create an account.
        </Notice>
      )}
      <LoginForm next={destination} />
      <Divider />
      <DemoButton>Just looking? Open a demo</DemoButton>
    </AuthFrame>
  );
}
