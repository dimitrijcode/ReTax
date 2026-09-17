import Link from "next/link";

export default function ConnectPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="retax-watermark" aria-hidden="true">
        %
      </div>
      <section className="relative z-10 rounded-card bg-white p-8">
        <h1 className="text-4xl font-bold tracking-tight">Connect Google</h1>
        <p className="mt-4 text-lg leading-relaxed text-retax-text/80">
          Fixture mode already uses a demo calendar, a demo mail, and a laptop invoice. You do
          not need Google for this walkthrough.
        </p>
        <Link
          href="/"
          className="mt-10 inline-block rounded-button bg-retax-accent px-7 py-3.5 text-base font-semibold text-retax-text"
        >
          Back to scan
        </Link>
      </section>
    </main>
  );
}
