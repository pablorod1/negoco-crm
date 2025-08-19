import Loader from "@/core/components/ui/loader";

export default function LoadingStateCard() {
  return (
    <div className=" w-full h-72 flex justify-center items-center flex-col gap-8">
      <Loader />
      <div className="flex flex-col items-center justify-center text-center gap-2">
        <h2 className="text-lg font-bold text-gray-800">Cargando datos...</h2>
        <p className="text-xs text-gray-600">
          Espere unos segundos mientras se cargan los datos.
        </p>
      </div>
    </div>
  );
}
