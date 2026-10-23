"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { deleteTransaction, saveTransaction } from "@/app/actions/ledger";
import { DeleteForm, Field, FormError, SubmitButton, useAction } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import {
  categoriesFor,
  cx,
  PAYMENT_METHODS,
  poishaToInput,
} from "@/lib/utils";

/**
 * One add/edit dialog for the whole app. Any button anywhere can open it — the
 * sidebar, the phone's centre tab, an "edit" pencil on a ledger row — and on a
 * keyboard, pressing N opens it from any page. Logging a ৳40 rickshaw ride has
 * to be faster than not bothering.
 *
 * It's a native <dialog>: focus is trapped, Esc closes it and the rest of the
 * page goes inert for free, with no focus-trap library.
 */

const OpenContext = createContext(() => {});
export const useEntryDialog = () => useContext(OpenContext);

export function EntryDialogProvider({ today, children }) {
  const dialog = useRef(null);
  const [entry, setEntry] = useState(null);
  const [session, setSession] = useState(0);

  const open = useCallback((tx = null) => {
    setEntry(tx);
    // A fresh key per opening: the form starts clean even if it was
    // abandoned half-filled last time.
    setSession((n) => n + 1);
    dialog.current?.showModal();
  }, []);

  const close = useCallback(() => dialog.current?.close(), []);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (target.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (dialog.current?.open) return;
      event.preventDefault();
      open();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <OpenContext value={open}>
      {children}
      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby="entry-title"
        // A click on the backdrop lands on the <dialog> itself, since the
        // form inside fills it edge to edge.
        onClick={(event) => event.target === dialog.current && close()}
      >
        <EntryForm key={session} entry={entry} today={today} onClose={close} />
        {entry && <EntryDelete key={`d${session}`} entry={entry} onClose={close} />}
      </dialog>
    </OpenContext>
  );
}

function EntryForm({ entry, today, onClose }) {
  const { state, formAction, errors, values, resetKey } = useAction(saveTransaction, {
    onSuccess: onClose,
  });

  return (
    <form action={formAction} className="flex flex-col">
      <div className="flex items-center justify-between border-b-[1.5px] border-dashed border-rule px-5 pt-4 pb-3">
        <div>
          <p className="eyebrow">{entry ? `Entry #${entry.id}` : "New entry"}</p>
          <h2 id="entry-title" className="text-xl font-extrabold">
            {entry ? "Fix the record" : "What happened?"}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
          <Icon name="close" />
        </button>
      </div>

      {entry && <input type="hidden" name="id" value={entry.id} />}
      <EntryFields key={resetKey} entry={entry} values={values} errors={errors} today={today} />

      <div className="px-5 pb-5">
        <FormError state={state} />
      </div>
    </form>
  );
}

/** Deleting lives in its own form: forms can't nest inside the edit form. */
function EntryDelete({ entry, onClose }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t-[1.5px] border-dashed border-rule px-5 py-3">
      <p className="text-xs text-ink-3">Logged by mistake?</p>
      <DeleteForm
        action={deleteTransaction}
        fields={{ id: entry.id }}
        label="Delete entry"
        confirmLabel="Yes, delete it"
        compact={false}
        onSuccess={onClose}
      />
    </div>
  );
}

function EntryFields({ entry, values, errors, today }) {
  const initialType = values.type || entry?.type || "expense";
  const [type, setType] = useState(initialType);
  const categories = categoriesFor(type);
  const initialCategory = values.category ?? entry?.category ?? "";
  const initialMethod = values.method ?? entry?.method ?? "cash";

  return (
    <div className="space-y-5 px-5 pt-4 pb-3">
      <fieldset>
        <legend className="sr-only">Type</legend>
        <div className="segmented">
          {["expense", "income"].map((option) => (
            <label key={option} className={cx(type === option && (option === "income" ? "text-green!" : "text-red!"))}>
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => setType(option)}
                className="sr-only"
              />
              <Icon name={option === "income" ? "up" : "down"} size={15} strokeWidth={2.4} />
              {option === "income" ? "Money in" : "Money out"}
            </label>
          ))}
        </div>
      </fieldset>

      <Field name="amount" label="Amount" error={errors.amount} idPrefix="entry">
        {(props) => (
          <div className="relative">
            <span className="bn pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-ink-3">
              ৳
            </span>
            <input
              {...props}
              className={cx(props.className, "field-lg pl-10")}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              defaultValue={values.amount ?? (entry ? poishaToInput(entry.amountPoisha) : "")}
              required
              autoFocus
            />
          </div>
        )}
      </Field>

      <fieldset>
        <legend className="label">Category</legend>
        {/* Keyed on type: the two lists are disjoint, so switching type must
            drop the old pick rather than submit a stale one. */}
        <div className="chips" key={type}>
          {categories.map((c) => (
            <label key={c.id}>
              <input
                type="radio"
                name="category"
                value={c.id}
                defaultChecked={c.id === initialCategory}
                required
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
        {errors.category && <p className="mt-1.5 text-[0.8125rem] font-medium text-red">{errors.category}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="occurredOn" label="Date" error={errors.occurredOn} idPrefix="entry">
          {(props) => (
            <input
              {...props}
              type="date"
              defaultValue={values.occurredOn ?? entry?.occurredOn ?? today}
              max={today}
              required
            />
          )}
        </Field>

        <Field name="method" label={type === "income" ? "Received via" : "Paid via"} error={errors.method} idPrefix="entry">
          {(props) => (
            <select {...props} defaultValue={initialMethod}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field name="description" label="Note (optional)" error={errors.description} idPrefix="entry">
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder={type === "income" ? "e.g. Allowance from Ammu" : "e.g. Rickshaw to campus"}
            defaultValue={values.description ?? entry?.description ?? ""}
          />
        )}
      </Field>

      {/* Pinned to the bottom of the sheet, so on a short phone screen the
          save button is always in reach without scrolling past the form. */}
      <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-between gap-3 border-t-[1.5px] border-dashed border-rule bg-card px-5 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-1 sm:pb-0">
        <p className="hidden items-center gap-1.5 text-xs text-ink-3 sm:flex">
          <kbd className="rounded border border-rule bg-card-2 px-1.5 font-mono text-[0.6875rem]">Esc</kbd>
          to close
        </p>
        <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
          <Icon name="check" size={16} strokeWidth={2.4} />
          {entry ? "Save changes" : "Add to ledger"}
        </SubmitButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Triggers                                                            *
 * ------------------------------------------------------------------ */

export function AddEntryButton({ className, children, label = "New entry" }) {
  const open = useEntryDialog();
  return (
    <button type="button" onClick={() => open()} className={className} aria-label={children ? undefined : label}>
      {children ?? label}
    </button>
  );
}

/** Wraps a ledger row's text so tapping it opens the editor — the phone's edit affordance. */
export function EntryRowButton({ entry, label, children }) {
  const open = useEntryDialog();
  return (
    <button type="button" onClick={() => open(entry)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${label}`}>
      {children}
    </button>
  );
}

export function EditEntryButton({ entry, label }) {
  const open = useEntryDialog();
  return (
    <button
      type="button"
      onClick={() => open(entry)}
      className="icon-btn"
      title={`Edit ${label}`}
      aria-label={`Edit ${label}`}
    >
      <Icon name="edit" size={16} />
    </button>
  );
}
