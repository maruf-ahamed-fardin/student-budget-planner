import { deleteGoal } from "@/app/actions/ledger";
import { Ring } from "@/components/charts";
import { DeleteForm } from "@/components/form-kit";
import { GoalForm, GoalMoneyForm } from "@/components/forms";
import { Card, CardHead, Empty, Odometer, PageHeader, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getGoalHistory, getGoals, getSavedTotal, getSummary } from "@/lib/queries";
import { daysBetween, formatDayMonth, formatFullDate, formatTaka, today } from "@/lib/utils";

export const metadata = { title: "Goals" };

/**
 * Savings goals. Money saved here is tracked separately from the ledger: it's
 * still yours (it counts in the balance) but the dashboard shows it as
 * "parked", so it stops looking like spending money.
 */
export default async function GoalsPage() {
  const user = await requireUser();
  const now = today();

  const goals = getGoals(user.id);
  const history = getGoalHistory(user.id, 10);
  const saved = getSavedTotal(user.id);
  const balance = getSummary(user.id).balancePoisha;
  const targets = goals.reduce((s, g) => s + g.targetPoisha, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Goals"
        title="Name it. Save for it."
        note={goals.length ? `${formatTaka(saved)} of ${formatTaka(targets)} saved across ${goals.length} goal${goals.length === 1 ? "" : "s"}` : "money with a name is harder to waste"}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {goals.length === 0 ? (
            <Card i={1}>
              <Empty icon="flag" title="No goals yet" body="Start one on the right. Even ৳50 a week adds up to a used phone by the end of the year." />
            </Card>
          ) : (
            goals.map((goal, i) => {
              const pct = (goal.savedPoisha / goal.targetPoisha) * 100;
              const done = goal.savedPoisha >= goal.targetPoisha;
              const remaining = Math.max(0, goal.targetPoisha - goal.savedPoisha);
              const daysLeft = goal.deadline ? daysBetween(now, goal.deadline) : null;
              // What it takes per month to land on time, rounded up to whole Taka.
              const perMonth =
                daysLeft !== null && daysLeft > 0 && !done
                  ? Math.ceil(remaining / Math.max(1, daysLeft / 30) / 100) * 100
                  : null;

              return (
                <Card key={goal.id} i={i + 1} className="lift p-5">
                  <div className="flex gap-5">
                    <Ring percent={pct} done={done} size={96}>
                      <span className="tnum text-lg font-bold">{Math.min(999, Math.floor(pct))}%</span>
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="line-clamp-2 text-lg leading-tight font-extrabold break-words">{goal.name}</h2>
                        <DeleteForm action={deleteGoal} fields={{ id: goal.id }} label={`Delete ${goal.name}`} confirmLabel="Delete" />
                      </div>
                      <p className="tnum text-sm">
                        <span className="font-bold">{formatTaka(goal.savedPoisha)}</span>
                        <span className="text-ink-3"> of {formatTaka(goal.targetPoisha)}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {done ? (
                          <Pill tone="green">Fully funded</Pill>
                        ) : (
                          <Pill>{formatTaka(remaining)} to go</Pill>
                        )}
                        {goal.deadline &&
                          (daysLeft < 0 ? (
                            <Pill tone={done ? "neutral" : "red"}>Deadline passed</Pill>
                          ) : (
                            <Pill tone={daysLeft <= 14 && !done ? "amber" : "neutral"}>
                              by {formatFullDate(goal.deadline)} · {daysLeft}d
                            </Pill>
                          ))}
                        {perMonth !== null && <Pill tone="hl">{formatTaka(perMonth)}/month to make it</Pill>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 border-t-[1.5px] border-dashed border-rule pt-4">
                    <GoalMoneyForm goalId={goal.id} name={goal.name} />
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <Card i={2} className="bg-ink! p-5 text-paper dark:bg-card-2! dark:text-ink">
            <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.12em] text-hl uppercase">Parked in goals</p>
            <p className="mt-2 text-4xl font-bold">
              <Odometer value={formatTaka(saved)} />
            </p>
            <p className="mt-1 text-sm opacity-70">
              {formatTaka(Math.max(0, balance - saved))} of your balance is still free to spend.
            </p>
          </Card>

          <Card i={3}>
            <CardHead title="New goal" />
            <GoalForm today={now} />
          </Card>

          {history.length > 0 && (
            <Card i={4} flat>
              <CardHead title="Recent moves" />
              <ul className="space-y-2 px-5 pb-5">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 font-mono text-[0.6875rem] text-ink-3 uppercase">{formatDayMonth(entry.occurredOn)}</span>
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <span className={`tnum font-semibold ${entry.amountPoisha > 0 ? "text-green" : "text-red"}`}>
                      {entry.amountPoisha > 0 ? "+" : "−"}
                      {formatTaka(Math.abs(entry.amountPoisha))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
