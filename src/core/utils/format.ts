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
    return `${day} de ${month} a las ${hours < 10 ? "0" + hours : hours}:${
      minutes < 10 ? "0" + minutes : minutes
    }`;
  }
};

export const formatTimestamp = (date: string): string => {
  // Asegúrate de que 'date' es un objeto Date válido
  const fecha = new Date(Number(date) * 1000);

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
  const hours = fecha.getHours();
  const minutes = fecha.getMinutes();

  // Formatear minutos para tener siempre 2 dígitos
  const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;

  return `${day} ${month} ${year} ${hours}:${formattedMinutes}`;
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

export const formatComission = (comission: number): string => {
  // Primero formateamos con toLocaleString para el formato español
  let formatted = comission.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Si por alguna razón no se está mostrando el separador de miles,
  // podemos verificar manualmente si necesitamos agregar el punto
  if (comission >= 1000 && !formatted.includes(".")) {
    // Convertimos a string y manipulamos manualmente
    const parts = formatted.split(",");
    const integerPart = parts[0].replace(" €", "").replace("€", "");

    // Formateamos manualmente el entero con puntos
    let formattedInteger = "";
    for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
      if (count > 0 && count % 3 === 0) {
        formattedInteger = "." + formattedInteger;
      }
      formattedInteger = integerPart[i] + formattedInteger;
    }

    // Reconstruimos con la parte decimal
    formatted = formattedInteger + "," + parts[1];
  }

  // Aseguramos que no haya espacio entre el número y el símbolo
  return formatted.replace(" €", "€");
};
