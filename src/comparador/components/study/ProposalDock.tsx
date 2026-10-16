"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { euros, type StudyView } from "./api";

const subscribeNothing = () => () => {};

/**
 * Las propuestas siempre a mano: cuando su tarjeta sale de la vista al bajar
 * por las ofertas, aparecen abajo con el botón de completar. En pantalla
 * ancha, abajo a la derecha sobre la columna lateral, para no tapar las
 * ofertas; y deja un hueco al final de la columna para que lo último no quede
 * debajo. Va en un portal: el contenedor de las páginas del CRM tiene
 * `contain: content`, que ata los `fixed` a su caja (el final de la página) y
 * no a la ventana.
 */
export function ProposalDock({
  study,
  anchor,
  onComplete,
}: {
  study: StudyView;
  anchor: RefObject<HTMLElement | null>;
  onComplete: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  // El portal, solo en el cliente y tras hidratar.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  useEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHidden(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [anchor]);

  const show =
    hidden && study.status !== "closed" && study.proposals.length > 0;

  return (
    <>
      {show && <div aria-hidden className="h-16" />}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {show && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-4 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-gray-900 py-2 pl-4 pr-2 text-white shadow-2xl ring-1 ring-white/10 xl:left-auto xl:right-6 xl:w-[360px] xl:translate-x-0"
              >
                <span className="flex-1 whitespace-nowrap text-sm font-medium">
                  {study.proposals.length}{" "}
                  {study.proposals.length === 1 ? "propuesta" : "propuestas"}
                </span>
                <div className="hidden items-center gap-1.5 md:flex xl:hidden">
                  {study.proposals.slice(-3).map((proposal) => (
                    <a
                      key={proposal.id}
                      href={proposal.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
                    >
                      <span className="font-semibold">{proposal.number}</span>
                      {proposal.comercializadoraName}
                      {proposal.savings !== null && proposal.savings > 0 && (
                        <span className="text-success-300">
                          −{euros(proposal.savings)}
                        </span>
                      )}
                      <ExternalLink className="size-3 text-white/50" />
                    </a>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onComplete}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                >
                  Completar estudio
                  <ArrowRight className="size-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/**
 * Una barra fija abajo, como la de propuestas (mismo sitio y mismo portal),
 * con hueco al final de la columna para que no tape lo último.
 */
export function FloatingBar({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return (
    <>
      <div aria-hidden className="h-24" />
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white shadow-2xl ring-1 ring-white/10 xl:left-auto xl:right-6 xl:w-[360px] xl:translate-x-0">
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
