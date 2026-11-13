import { Fragment, ReactNode, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';
import clsx from 'clsx';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className ?? 'h-5 w-5')} aria-hidden />;
}

/** Loading / error / empty wrapper for a data region. */
export function DataState({
  loading,
  error,
  empty,
  emptyText = 'Belum ada data',
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
        <Spinner /> Memuat…
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p className="text-slate-300">{error}</p>
        {onRetry && (
          <button className="btn-ghost btn-sm" onClick={onRetry}>
            Coba lagi
          </button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-slate-500">
        <Inbox className="h-8 w-8" />
        <p>{emptyText}</p>
      </div>
    );
  return <>{children}</>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={clsx('w-full card bg-dark-800 p-6 shadow-2xl', wide ? 'max-w-2xl' : 'max-w-lg')}>
                <div className="flex items-center justify-between mb-5">
                  <Dialog.Title className="text-lg font-semibold text-white">{title}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Tutup">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

/** Confirmation dialog for destructive actions. `onConfirm` may throw to keep it open. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; message: ReactNode; onConfirm: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = (title: string, message: ReactNode, onConfirm: () => Promise<void>) =>
    setState({ title, message, onConfirm });

  const dialog = (
    <Modal open={!!state} onClose={() => !busy && setState(null)} title={state?.title ?? ''}>
      <p className="text-sm text-slate-300 mb-6">{state?.message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => setState(null)} disabled={busy}>
          Batal
        </button>
        <button
          className="btn-danger"
          disabled={busy}
          onClick={async () => {
            if (!state) return;
            setBusy(true);
            try {
              await state.onConfirm();
              setState(null);
            } catch {
              /* caller shows the error */
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner className="h-4 w-4" />} Ya, lanjutkan
        </button>
      </div>
    </Modal>
  );
  return { confirm, dialog };
}

export function StatCard({ label, value, icon, hint }: { label: string; value: ReactNode; icon: ReactNode; hint?: string }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className="rounded-xl bg-primary-500/15 text-primary-500 p-3">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-semibold text-white mt-0.5">{value}</p>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-300',
  'B+': 'bg-teal-500/15 text-teal-300',
  B: 'bg-sky-500/15 text-sky-300',
  'C+': 'bg-amber-500/15 text-amber-300',
  C: 'bg-amber-500/15 text-amber-300',
  D: 'bg-orange-500/15 text-orange-300',
  E: 'bg-rose-500/15 text-rose-300',
};

export function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-slate-500">–</span>;
  return <span className={clsx('badge', GRADE_COLOR[grade] ?? 'bg-slate-700 text-slate-200')}>{grade}</span>;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800 text-sm text-slate-400">
      <span>
        Halaman {page} dari {totalPages}
      </span>
      <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Sebelumnya
      </button>
      <button className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Berikutnya
      </button>
    </div>
  );
}
