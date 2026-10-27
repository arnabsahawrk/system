import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** The back arrow and title shared by the inner pages (Manage tasks, Insights).
 * Static, so the route-level loading screens can show it before any data or
 * client code has arrived. */
export function PageHeader({ title }: { title: string }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-8 sm:px-6">
      <Link
        href="/"
        aria-label="Back"
        className="rounded-lg p-2 text-ink-muted transition-all duration-200 hover:bg-surface-2 hover:text-ink active:scale-90"
      >
        <ArrowLeft size={18} />
      </Link>
      <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em]">{title}</h1>
    </header>
  );
}
