export const formatDate = (date: string): string => {
  const fecha = new Date(date);
  const day = fecha.getDate();
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const month = months[fecha.getMonth()];
  const year = fecha.getFullYear();
  return `${day} ${month} ${year}`;
};

export const formatDateTime = (date: string): string => {
  const fecha = new Date(date);
  const day = fecha.getDate();
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const month = months[fecha.getMonth()];
  const year = fecha.getFullYear();
  const hours = fecha.getHours();
  const minutes = fecha.getMinutes();
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (
    hoy.getDate() === day &&
    hoy.getMonth() === fecha.getMonth() &&
    hoy.getFullYear() === fecha.getFullYear()
  ) {
    return `Hoy a las ${hours}:${minutes < 10 ? "0" + minutes : minutes}`;
  } else if (
    ayer.getDate() === day &&
    ayer.getMonth() === fecha.getMonth() &&
    ayer.getFullYear() === fecha.getFullYear()
  ) {
    return `Ayer a las ${hours}:${minutes < 10 ? "0" + minutes : minutes}`;
  } else {
    return `${day} de ${month} de ${year} a las ${hours}:${
      minutes < 10 ? "0" + minutes : minutes
    }`;
  }
};

export const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
};
