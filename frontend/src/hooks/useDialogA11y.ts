import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento accesible común para Modal, Drawer y BottomSheet:
 * bloquea el scroll del body, cierra con Escape, mantiene el foco dentro
 * del panel (Tab / Shift+Tab) y lo devuelve al elemento que abrió el diálogo.
 */
export function useDialogA11y<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusables = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    // El primer elemento suele ser el botón cerrar; preferimos el contenido.
    const initial = focusables().find((el) => !el.dataset.dialogClose) || focusables()[0] || panel;
    initial?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return panelRef;
}
