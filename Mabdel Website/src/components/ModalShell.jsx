import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// Accessible modal frame: dialog semantics, Escape and backdrop-click to close,
// focus moved in on open, Tab kept inside, focus returned to the opener on close.
export default function ModalShell({ titleId, onClose, children, className = '' }) {
  const panelRef = useRef(null);
  // Callers pass a fresh inline onClose each render; keep it in a ref so the effect
  // below (which moves focus) runs once instead of stealing focus on every re-render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement;
    const panel = panelRef.current;
    const focusable = () =>
      Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
        (node) => !node.disabled,
      );
    (focusable()[0] || panel).focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 text-start"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`bg-[#111318] border border-[#1E2530] rounded-[20px] p-[22px] w-full max-w-sm max-h-[90vh] overflow-y-auto outline-none ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
