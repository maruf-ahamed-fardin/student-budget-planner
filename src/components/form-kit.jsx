"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Icon } from "@/components/icons";
import { cx, IDLE } from "@/lib/utils";

/**
 * The plumbing every form shares: wiring a server action to useActionState,
 * toasts, a pending-aware submit button, labelled fields with their errors, and
 * a two-tap confirm for anything destructive.
 */

/**
 * `resetKey` changes on every result. Forms key their fields on it: after a
 * success the fields remount empty; after a failure they remount filled from
 * `values`, the echo of what was submitted. (React 19 resets an uncontrolled
 * form once its action finishes, so without the echo a typo would wipe the
 * whole form.)
 */
export function useAction(action, { onSuccess, toastSuccess = true } = {}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  // Only talks to external systems (toasts, a parent's dialog), which is what
  // effects are for. useActionState hands back a fresh object per submit, so
  // this fires once per result — including two identical failures in a row.
  useEffect(() => {
    if (state.status === "success") {
      if (toastSuccess) toast.success(state.message);
      onSuccessRef.current?.(state);
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, toastSuccess]);

  return {
    state,
    formAction,
    pending,
    errors: state.status === "error" ? (state.fieldErrors ?? {}) : {},
    values: state.status === "error" ? (state.values ?? {}) : {},
    resetKey: state.at ?? "initial",
  };
}

export function SubmitButton({ children, pendingLabel, className, variant = "btn-ink", ...props }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cx("btn", variant, className)}
      {...props}
    >
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Wraps a control with its label and error, wiring aria-invalid and
 * aria-describedby so a screen reader announces the message with the field.
 * `children` is a render function so the caller still owns the input.
 */
export function Field({ name, label, hint, error, children, className, idPrefix = "f" }) {
  const id = `${idPrefix}-${name}`;
  const messageId = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cx("min-w-0", className)}>
      {label && (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": messageId,
        className: "field",
      })}
      {error ? (
        <p id={messageId} className="mt-1.5 flex items-center gap-1 text-[0.8125rem] font-medium text-red">
          <Icon name="warning" size={13} />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-[0.8125rem] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A form-level error that isn't tied to one field. */
export function FormError({ state }) {
  if (state.status !== "error" || !state.fieldErrors || !state.message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-wash px-3 py-2 text-[0.8125rem] font-medium text-red">
      {state.message}
    </p>
  );
}

/**
 * Two taps instead of a browser confirm(): the first arms the button (it turns
 * red and says what it will do), the second submits. It disarms itself after a
 * few seconds, so a stray tap never lingers as a loaded gun.
 */
export function ConfirmSubmit({ label, confirmLabel = "Sure?", icon = "trash", compact = true }) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);

  if (armed || pending) {
    return (
      <button
        type="submit"
        disabled={pending}
        className="btn btn-danger btn-sm pop-in"
        aria-label={`Confirm: ${label}`}
      >
        {pending ? "…" : confirmLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      title={label}
      aria-label={label}
      className={compact ? "icon-btn danger" : "btn btn-sm"}
    >
      <Icon name={icon} size={16} />
      {!compact && label}
    </button>
  );
}

/** A tiny form posting hidden fields to a destructive action. */
export function DeleteForm({ action, fields, label, confirmLabel, compact, onSuccess }) {
  const { formAction } = useAction(action, { onSuccess });

  return (
    <form action={formAction} className="inline-flex">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ConfirmSubmit label={label} confirmLabel={confirmLabel} compact={compact} />
    </form>
  );
}
