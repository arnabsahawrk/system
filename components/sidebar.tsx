"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, ListChecks, Settings as SettingsIcon, X } from "lucide-react";
import { BrandMark } from "./brand-mark";

/**
 * Slide-in drawer, same component at every screen width — simpler and more
 * consistent than maintaining a separate persistent desktop rail, and this
 * is a personal app mostly opened on one phone anyway.
 */
export function Sidebar({
  open,
  onClose,
  hasPasscode,
  onLockNow,
  onOpenSettings,
  locking,
}: {
  open: boolean;
  onClose: () => void;
  hasPasscode: boolean;
  onLockNow: () => void;
  onOpenSettings: () => void;
  locking: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-border bg-surface transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="font-mono text-sm font-bold uppercase tracking-[0.2em]">System</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-4 flex flex-col gap-1 px-3">
          {hasPasscode && (
            <SidebarItem icon={<Lock size={17} />} label="Lock App" onClick={onLockNow} disabled={locking} />
          )}
          <SidebarLink icon={<ListChecks size={17} />} label="Manage Tasks" href="/manage" />
          <SidebarItem icon={<SettingsIcon size={17} />} label="Settings" onClick={onOpenSettings} />
        </nav>

        <div className="mt-auto px-4 pb-6 pt-4">
          <span className="font-mono text-[11px] text-ink-faint">
            A project by{" "}
            <a
              href="https://arnabsaha.vercel.app/"
              className="text-accent underline decoration-dotted underline-offset-4 transition-colors hover:text-accent-strong"
            >
              Arnab Saha
            </a>
          </span>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left font-mono text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function SidebarLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {icon}
      {label}
    </Link>
  );
}
