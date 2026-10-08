"use client";

import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { euros, type StudyView } from "./api";

/**
 * Las propuestas siempre a mano: cuando su tarjeta sale de la vista al bajar
 * por las ofertas, aparecen abajo con el botón de completar.
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

  useEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setHidden(!entry.isIntersecting), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [anchor]);

  const show = hidden && study.status !== "closed" && study.proposals.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-gray-900 py-2 pl-4 pr-2 text-white shadow-2xl ring-1 ring-white/10"
        >
          <span className="whitespace-nowrap text-sm font-medium">
            {study.proposals.length} {study.proposals.length === 1 ? "propuesta" : "propuestas"}
          </span>
          <div className="hidden items-center gap-1.5 md:flex">
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
                {proposal.savings !== null && proposal.savings > 0 && <span className="text-success-300">−{euros(proposal.savings)}</span>}
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
    </AnimatePresence>
  );
}
