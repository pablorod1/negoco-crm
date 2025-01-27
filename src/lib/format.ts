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
