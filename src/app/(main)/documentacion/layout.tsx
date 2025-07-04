import { DocumentacionProvider } from "@/core/contexts/DocumentacionContext";
import DocumentacionSidebar from "@/documentacion/components/DocumentacionSidebar";

export default function DocumentacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DocumentacionProvider>
      <section className="flex  h-full">
        <DocumentacionSidebar />
        <div className="w-full p-4">{children}</div>
      </section>
    </DocumentacionProvider>
  );
}

