import { THEME } from "../ui/theme";

export function BlockedView() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-paper p-6 font-mono text-ink"
      style={{
        backgroundColor: THEME.paper,
        color: THEME.ink,
        fontFamily: THEME.font,
      }}
    >
      <section
        className="w-full max-w-lg rounded-xl bg-paper p-8"
        style={{
          backgroundColor: THEME.paper,
          color: THEME.ink,
          border: `1.5px solid ${THEME.ink}`,
        }}
      >
        <p className="mb-4 text-xs font-bold uppercase tracking-widest">tap2stacks</p>
        <h1 className="text-xl font-bold">tap2stacks is not available in your region.</h1>
      </section>
    </main>
  );
}
