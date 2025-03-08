import { DocumentacionProvider } from "@/lib/contexts/DocumentacionContext";
import DocumentacionSidebar from "@/components/documentacion/DocumentacionSidebar";

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
