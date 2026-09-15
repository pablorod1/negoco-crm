import { DocumentacionProvider } from "@/core/contexts/DocumentacionContext";
import DocumentacionSidebar from "@/documentacion/components/DocumentacionSidebar";
import { DocumentLibrarySuppliersProvider } from "@/documentacion/contexts/DocumentLibrarySuppliersContext";

export default function DocumentacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DocumentacionProvider>
      <DocumentLibrarySuppliersProvider>
        {/*
          Alto fijo (viewport menos la cabecera de 3rem) para que el sidebar
          y el contenido tengan cada uno su propio scroll, en vez de mover
          toda la página.
        */}
        <section className="flex h-[calc(100dvh-3rem)] overflow-hidden">
          <DocumentacionSidebar />
          <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>
        </section>
      </DocumentLibrarySuppliersProvider>
    </DocumentacionProvider>
  );
}
