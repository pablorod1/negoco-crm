"use client";
import Loader from "../ui/loader";

export default function FullScreenLoaderComponent({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="flex flex-col items-center justify-center w-full min-h-screen h-full gap-12">
      <Loader />
      <div className="flex flex-col items-center justify-center text-center gap-2">
        <h2 className="text-2xl font-bold text-gray-800">
          {title ? title : "Cargando datos..."}
        </h2>
        <p className="text-sm text-gray-600">
          {description
            ? description
            : "Espere unos segundos mientras se cargan los datos."}
        </p>
      </div>
    </section>
  );
}
