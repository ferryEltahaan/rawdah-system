import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldAlert, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  leaving?: boolean;
}

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmRequest {
  message: string;
  title: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

const TOAST_STYLES: Record<
  ToastType,
  { label: string; container: string; iconWrap: string; icon: React.ReactNode }
> = {
  success: {
    label: 'نجاح',
    container: 'border-emerald-200 bg-emerald-50/95',
    iconWrap: 'bg-emerald-100 border-emerald-200',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  },
  error: {
    label: 'تعذر إتمام العملية',
    container: 'border-rose-200 bg-rose-50/95',
    iconWrap: 'bg-rose-100 border-rose-200',
    icon: <XCircle className="w-4 h-4 text-rose-600" />,
  },
  warning: {
    label: 'تنبيه',
    container: 'border-amber-200 bg-amber-50/95',
    iconWrap: 'bg-amber-100 border-amber-200',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  },
  info: {
    label: 'معلومة',
    container: 'border-sky-200 bg-sky-50/95',
    iconWrap: 'bg-sky-100 border-sky-200',
    icon: <Info className="w-4 h-4 text-sky-600" />,
  },
};

const DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 5500,
  error: 7500,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, number>>(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 200);
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setToasts(prev => [...prev.slice(-3), { id, type, message }]);
      const timer = window.setTimeout(() => {
        timersRef.current.delete(id);
        removeToast(id);
      }, DURATIONS[type]);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const dismiss = useCallback(
    (id: number) => {
      const timer = timersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
      removeToast(id);
    },
    [removeToast]
  );

  const confirm = useCallback(
    (message: string, options?: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        setConfirmRequest({
          message,
          title: options?.title ?? 'تأكيد العملية',
          confirmLabel: options?.confirmLabel ?? 'تأكيد ومتابعة',
          danger: options?.danger ?? false,
          resolve,
        });
      }),
    []
  );

  // Escape = إلغاء / Enter = تأكيد
  useEffect(() => {
    if (!confirmRequest) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        confirmRequest.resolve(false);
        setConfirmRequest(null);
      } else if (e.key === 'Enter') {
        confirmRequest.resolve(true);
        setConfirmRequest(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmRequest]);

  // تنظيف المؤقتات عند إلغاء التركيب
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // أخطاء التخزين المحلي (امتلاء الحصة) تصل من dataService عبر حدث عام
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      push(
        'error',
        detail?.message ||
          'تعذر حفظ البيانات على هذا الجهاز — تأكد من توفر مساحة تخزين في المتصفح.'
      );
    };
    window.addEventListener('rawdah_storage_error', handler);
    return () => window.removeEventListener('rawdah_storage_error', handler);
  }, [push]);

  const api = useMemo<ToastContextValue>(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
      warning: (m: string) => push('warning', m),
      info: (m: string) => push('info', m),
      confirm,
    }),
    [push, confirm]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toasts Stack */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] flex flex-col gap-2 w-[min(92vw,430px)] pointer-events-none">
        {toasts.map(t => {
          const style = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg backdrop-blur-sm ${style.container} ${
                t.leaving ? 'toast-leave' : 'toast-enter'
              }`}
            >
              <div className={`p-1.5 rounded-xl border shrink-0 ${style.iconWrap}`}>{style.icon}</div>

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-[11px] font-black text-slate-900">{style.label}</div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5 leading-relaxed break-words">
                  {t.message}
                </div>
              </div>

              <button
                onClick={() => dismiss(t.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/70 transition-colors shrink-0"
                aria-label="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm Dialog */}
      {confirmRequest && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overlay-enter">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl modal-enter">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-2xl border shrink-0 ${
                  confirmRequest.danger
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <ShieldAlert
                  className={`w-5 h-5 ${
                    confirmRequest.danger ? 'text-rose-600' : 'text-amber-600'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">{confirmRequest.title}</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line">
                  {confirmRequest.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  confirmRequest.resolve(false);
                  setConfirmRequest(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  confirmRequest.resolve(true);
                  setConfirmRequest(null);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                  confirmRequest.danger
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {confirmRequest.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
