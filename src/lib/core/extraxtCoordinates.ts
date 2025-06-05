export function extractCoordinatesFromUrl(
  urlString: string
): [number, number] | null {
  try {
    const url = new URL(urlString);

    // Patrón mejorado para coordenadas decimales
    const coordinatePattern = /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g;

    // Función para validar coordenadas
    const isValidCoordinate = (lat: number, lng: number): boolean => {
      return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    };

    // Función para extraer y validar coordenadas
    const extractAndValidate = (text: string) => {
      const matches = [...text.matchAll(coordinatePattern)];
      for (const match of matches) {
        const latitude = parseFloat(match[1]);
        const longitude = parseFloat(match[2]);
        if (
          !isNaN(latitude) &&
          !isNaN(longitude) &&
          isValidCoordinate(latitude, longitude)
        ) {
          return [latitude, longitude] as [number, number];
        }
      }
      return null;
    };

    // 1. Buscar en el path de la URL
    const pathResult = extractAndValidate(url.pathname);
    if (pathResult) return pathResult;

    // 2. Buscar en los parámetros de consulta
    for (const [, value] of url.searchParams.entries()) {
      const queryResult = extractAndValidate(value);
      if (queryResult) return queryResult;
    }

    // 3. Buscar en el fragmento de la URL (hash)
    if (url.hash) {
      const hashResult = extractAndValidate(url.hash);
      if (hashResult) return hashResult;
    }

    return null;
  } catch (error) {
    console.error("Error al parsear la URL:", error);
    return null;
  }
}
