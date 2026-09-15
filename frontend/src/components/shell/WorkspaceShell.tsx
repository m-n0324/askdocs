import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { cx } from "@/utils";

interface IWorkspaceShellProps {
  title: string;
  nav: ReactNode;
  children: ReactNode;
}

/** Sidebar + main area. Below md the sidebar becomes a slide-over drawer. */
export function WorkspaceShell({ title, nav, children }: IWorkspaceShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

  // Following any link inside the drawer should close it.
  const closeOnLinkClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a")) setIsMenuOpen(false);
  };

  return (
    <div className="min-h-dvh md:grid md:h-dvh md:grid-cols-[17rem_minmax(0,1fr)]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-rule bg-paper/95 px-4 backdrop-blur md:hidden">
        <Wordmark className="text-xl" />
        <span className="mx-3 min-w-0 flex-1 truncate text-center font-display text-lg">{title}</span>
        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="workspace-nav"
          onClick={() => setIsMenuOpen(true)}
          className="rounded-sm px-2 py-1 font-mono text-[11px] tracking-[0.14em] text-ink uppercase hover:bg-paper-sunk"
        >
          Menu
        </button>
      </header>

      {isMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 z-30 animate-fade-in bg-ink/30 md:hidden"
        />
      )}

      <aside
        id="workspace-nav"
        onClick={closeOnLinkClick}
        className={cx(
          "fixed inset-y-0 left-0 z-40 w-[17rem] border-r border-rule bg-paper-sunk transition-[transform,visibility] duration-300 ease-out",
          "md:visible md:static md:z-auto md:translate-x-0 md:transition-none",
          // `invisible` keeps the hidden drawer's links out of the Tab order.
          isMenuOpen ? "visible translate-x-0" : "invisible -translate-x-full",
        )}
      >
        {nav}
      </aside>

      <main className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col md:h-dvh md:min-h-0 md:overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
