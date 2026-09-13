export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-ink-faint uppercase">
      <span aria-hidden className="size-1.5 animate-breathe rounded-full bg-accent" />
      {label}…
    </p>
  );
}
