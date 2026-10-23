import { DeleteAccountForm, LogoutButton, PasswordForm, ProfileForm, SignOutEverywhereForm } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Card, CardHead, Notice, PageHeader } from "@/components/ui";
import { countSessions, requireUser } from "@/lib/auth";
import { getSummary } from "@/lib/queries";
import { formatFullDate, today } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const sessions = countSessions(user.id);
  const { count } = getSummary(user.id);
  const joined = today(user.createdAt);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Settings" title="Your account." note={`member since ${formatFullDate(joined)}`} />

      {user.isDemo ? (
        <Notice tone="amber" icon="clock" className="rise">
          This is a demo sandbox. Profile and password are locked, and everything here is deleted 24 hours after it
          was created. <a href="/signup" className="font-semibold underline">Create a real account</a> to keep a ledger.
        </Notice>
      ) : null}

      <Card i={1}>
        <CardHead title="Profile" />
        <ProfileForm user={user} />
      </Card>

      <Card i={2}>
        <CardHead title="Your data" hint={`${count} entries. It's yours — take it anywhere.`} />
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
          <a href="/api/export" className="btn" download>
            <Icon name="download" size={16} />
            Download ledger (CSV)
          </a>
          <p className="text-sm text-ink-3">Opens in Excel, Google Sheets or Numbers.</p>
        </div>
      </Card>

      <Card i={3}>
        <CardHead title="Security" hint="How your account is protected" />
        <ul className="grid gap-3 px-5 pb-2 text-sm sm:grid-cols-2">
          {[
            ["lock", "Password hashed with scrypt", "Never stored, never logged, not even by us."],
            ["shield", "Session cookie is httpOnly", "Page scripts can't read it, so an injected script can't steal it."],
            ["bolt", "Logins are rate-limited", "6 wrong tries locks that email for 15 minutes."],
            ["check", "Strict Content-Security-Policy", "Only scripts this app signed for the request can run."],
          ].map(([icon, title, body]) => (
            <li key={title} className="flex gap-3 rounded-lg bg-card-2 p-3">
              <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-green" />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-ink-3">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm">
            Signed in on <strong>{sessions}</strong> device{sessions === 1 ? "" : "s"}.
          </p>
          <SignOutEverywhereForm others={Math.max(0, sessions - 1)} />
        </div>
        {!user.isDemo && (
          <div className="border-t-[1.5px] border-dashed border-rule">
            <PasswordForm />
          </div>
        )}
      </Card>

      <Card i={4} className="border-red!">
        <CardHead title="Danger zone" />
        <DeleteAccountForm isDemo={Boolean(user.isDemo)} />
      </Card>

      <div className="md:hidden">
        <LogoutButton className="card justify-center" />
      </div>
    </div>
  );
}
