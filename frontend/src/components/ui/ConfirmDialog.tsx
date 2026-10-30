import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` pinta la acción de confirmar en rojo (eliminar, quitar, liberar). */
  tone?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Reemplazo accesible de `window.confirm`: `const ok = await confirm({...})`.
 */
export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={options !== null}
        onClose={() => close(false)}
        title={options?.title}
        role="alertdialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {options?.cancelLabel || 'Cancelar'}
            </Button>
            <Button
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => close(true)}
            >
              {options?.confirmLabel || 'Confirmar'}
            </Button>
          </>
        }
      >
        <div style={{ color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)' }}>
          {options?.message}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Sin provider (p. ej. en tests aislados) se usa el diálogo nativo.
    return async ({ title, message }) =>
      window.confirm(typeof message === 'string' ? `${title}\n\n${message}` : title);
  }
  return ctx;
};
