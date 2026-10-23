import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="tnum text-[7rem] leading-none font-bold tracking-tighter">
          4<span className="bn text-red">৳</span>4
        </p>
        <h1 className="mt-4 text-3xl font-extrabold">This page went missing.</h1>
        <p className="hand mt-2 -rotate-1 text-2xl text-ink-2">like money on the 25th of the month</p>
        <Link href="/" className="btn btn-ink mt-8">
          Take me home
        </Link>
      </div>
    </main>
  );
}
