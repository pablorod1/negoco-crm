export function ComercializadorasHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-4xl font-extrabold text-primary-600 drop-shadow-sm tracking-tight">
          Comercializadoras
        </h1>
        <p className="text-muted-foreground">
          Gestiona las comercializadoras energéticas y sus trámites asociados
        </p>
      </div>
    </div>
  );
}
