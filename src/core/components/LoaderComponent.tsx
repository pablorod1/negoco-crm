import Loader from "./ui/loader";

export default function LoaderComponent({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="flex flex-col items-center justify-center w-full h-[400px] gap-12">
      <Loader />
      <div className="flex flex-col items-center justify-center text-center">
        <h2 className="text-lg font-bold text-gray-800">
          {title ? title : "Cargando datos..."}
        </h2>
        <p className="text-xs text-gray-600">
          {description
            ? description
            : "Espere unos segundos mientras se cargan los datos."}
        </p>
      </div>
    </section>
  );
}
