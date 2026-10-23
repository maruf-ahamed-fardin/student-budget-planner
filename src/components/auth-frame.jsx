/** Shared frame for the log-in and sign-up pages. */

export function AuthFrame({ title, note, children, footer }) {
  return (
    <div className="mx-auto grid max-w-md px-4 py-12 sm:py-16">
      <div className="rise">
        <h1 className="text-4xl font-extrabold">{title}</h1>
        <p className="hand mt-1 -rotate-1 text-2xl text-ink-2">{note}</p>
      </div>
      <div className="card rise mt-6 p-6 sm:p-7" style={{ "--i": 1 }}>
        {children}
      </div>
      <p className="rise mt-6 text-center text-sm text-ink-2" style={{ "--i": 2 }}>
        {footer}
      </p>
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 font-mono text-[0.6875rem] font-semibold tracking-widest text-ink-3 uppercase">
      <span className="h-px flex-1 border-t-[1.5px] border-dashed border-rule" />
      or
      <span className="h-px flex-1 border-t-[1.5px] border-dashed border-rule" />
    </div>
  );
}
