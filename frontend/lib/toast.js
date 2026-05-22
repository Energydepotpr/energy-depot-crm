'use client';
// Toast global ligero — alternativa a alert() / confirm() del browser.
// Uso: import { toast } from '@/lib/toast'; toast.success('Guardado'); toast.error('Falló');
// Para confirmar: const ok = await toast.confirm('¿Seguro?');

let _push = null;
let _pushConfirm = null;

export function registerToast(pushFn, pushConfirmFn) {
  _push = pushFn;
  _pushConfirm = pushConfirmFn;
}

function show(kind, msg, opts = {}) {
  // Fallback a alert si el provider no está montado (SSR / boot)
  if (!_push) {
    if (typeof window !== 'undefined') alert(msg);
    return;
  }
  _push({ kind, msg, ...opts });
}

export const toast = {
  success: (msg, opts) => show('success', msg, opts),
  error:   (msg, opts) => show('error', msg, opts),
  info:    (msg, opts) => show('info', msg, opts),
  warning: (msg, opts) => show('warning', msg, opts),
  confirm: (msg, opts = {}) => new Promise(resolve => {
    if (!_pushConfirm) {
      // Fallback al confirm nativo si no hay provider
      if (typeof window !== 'undefined') resolve(window.confirm(msg));
      else resolve(false);
      return;
    }
    _pushConfirm({ msg, ...opts, resolve });
  }),
};
