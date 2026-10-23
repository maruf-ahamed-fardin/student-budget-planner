"use client";

/**
 * Caught render errors. Shows the digest (a hash Next logs on the server)
 * rather than the message, which in production may describe internals.
 */
export default function Error({ error, reset }) {
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-4 py-16">
      <div className="card max-w-md p-8 text-center">
        <p className="hand text-3xl text-red">well, that broke.</p>
        <h1 className="mt-2 text-2xl font-extrabold">Something went wrong on our side.</h1>
        <p className="mt-2 text-ink-3">Your data is safe — nothing was half-saved. Try again in a moment.</p>
        {error?.digest && <p className="mt-3 font-mono text-xs text-ink-3">ref: {error.digest}</p>}
        <button type="button" onClick={() => reset()} className="btn btn-ink mt-6">
          Try again
        </button>
      </div>
    </main>
  );
}
