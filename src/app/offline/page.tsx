"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1a1a1a] px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-[#1a1a1a]">
          A
        </div>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="mt-3 text-base leading-7 text-white/65">
          Reconnect to see your attendance.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-[#1a1a1a] transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
