import Loader from "./ui/loader";

export default function LoadingStateModal({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center gap-8 bg-white/70 backdrop-blur-sm z-50">
      <Loader />
      <div className="flex flex-col items-center justify-center text-center gap-2">
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}
