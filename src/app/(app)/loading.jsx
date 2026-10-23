/** Shown while a signed-in page's data loads: ruled ledger lines, shimmering. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton h-10 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-flat h-36 p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-4 h-9 w-40" />
          </div>
        ))}
      </div>
      <div className="card-flat space-y-4 p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton size-9" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton h-2.5 w-1/4" />
            </div>
            <div className="skeleton h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
