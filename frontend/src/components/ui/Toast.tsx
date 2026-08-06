import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "../../lib/cn";

export type ToastTone = "default" | "success" | "danger";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss. Errors default to persistent (undefined). */
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `toast-${++idCounter}`;
      const tone = toast.tone ?? "default";
      // Success/default toasts auto-dismiss after 4s; danger toasts persist
      // until manually dismissed, per the design system.
      const duration = toast.duration ?? (tone === "danger" ? undefined : 4000);
      setToasts((prev) => [...prev, { ...toast, id, tone }]);
      if (duration) {
        timers.current.set(
          id,
          setTimeout(() => dismissToast(id), duration),
        );
      }
      return id;
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const toneIcon: Record<ToastTone, typeof CheckCircle2 | null> = {
  default: null,
  success: CheckCircle2,
  danger: AlertCircle,
};

const toneBarClass: Record<ToastTone, string> = {
  default: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      // w-96 = 384px: the closest on-grid width to the design spec's
      // ~360px toast max-width — no native Tailwind key lands on 360 exactly.
      className="fixed bottom-6 right-6 z-50 flex w-96 max-w-full flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const tone = toast.tone ?? "default";
  const Icon = toneIcon[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className={cn(
        "flex animate-slide-up-fade items-start gap-2 overflow-hidden rounded-md border border-border-subtle bg-surface shadow-md",
      )}
    >
      <div className={cn("w-1 self-stretch", toneBarClass[tone])} aria-hidden="true" />
      <div className="flex flex-1 items-start gap-2 py-4 pr-4">
        {Icon && (
          <Icon
            className={cn("mt-1 size-4", tone === "success" ? "text-success" : "text-danger")}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        <div className="flex-1">
          <p className="text-label font-medium text-text-primary">{toast.title}</p>
          {toast.description && <p className="mt-1 text-caption text-text-secondary">{toast.description}</p>}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-text-tertiary transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:shadow-focus"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
