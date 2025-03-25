import { Client } from "@libsql/client";

export const getObjectivesTramitesValues = async (
  tursoClient: Client,
  id: string,
  role: string,
  period: string
) => {
  try {
    // Convertir el período en un rango de fechas
    const [month, year] = period.split(" ");

    // Mapeo de nombres de meses en español a números
    const monthMap: { [key: string]: string } = {
      enero: "01",
      febrero: "02",
      marzo: "03",
      abril: "04",
      mayo: "05",
      junio: "06",
      julio: "07",
      agosto: "08",
      septiembre: "09",
      octubre: "10",
      noviembre: "11",
      diciembre: "12",
    };

    // Construir el prefijo de fecha para la consulta
    const datePrefixToSearch = `${year}-${monthMap[month]}`;

    const res = await tursoClient.execute({
      sql: `SELECT COUNT(id) as active_count,
            ${
              role !== "2"
                ? "SUM(comision) as comision"
                : "SUM(comision_sales_person) as comision"
            }
            FROM tramites 
            WHERE user_id = ? 
            AND substr(activation_date, 1, 7) = ? 
            AND status = 'Activo'`,
      args: [id, datePrefixToSearch],
    });

    // Obtener el conteo de la primera fila
    const activeTramitesCount = res.rows[0]?.active_count ?? 0;
    const comision = res.rows[0]?.comision ?? 0;

    return {
      active: activeTramitesCount,
      comision,
    };
  } catch (error) {
    console.error("Error al obtener trámites activos:", error);
    return {
      active: 0,
      comision: 0,
    };
  }
};

export const getComparativasRatio = async (
  tursoClient: Client,
  id: string,
  period: string
) => {
  try {
    const [month, year] = period.split(" ");

    // Mapeo de nombres de meses en español a números
    const monthMap: { [key: string]: string } = {
      enero: "01",
      febrero: "02",
      marzo: "03",
      abril: "04",
      mayo: "05",
      junio: "06",
      julio: "07",
      agosto: "08",
      septiembre: "09",
      octubre: "10",
      noviembre: "11",
      diciembre: "12",
    };

    // Construir el prefijo de fecha para la consulta
    const datePrefixToSearch = `${year}-${monthMap[month]}`;

    const res = await tursoClient.execute({
      sql: `SELECT 
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS total,
      COALESCE(SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END), 0) AS processed
    FROM comparativas WHERE substr(creation_date, 1, 7) = ?
      AND status IN ('completed', 'processed')
      AND user_id = ?`,
      args: [datePrefixToSearch, id],
    });

    const rows = res.rows[0];
    const { total, processed } = rows;

    if (!total || !processed) {
      return 0; // Para evitar división por cero
    }

    const processedNum = Number(processed);
    const sum = Number(total) + processedNum;

    if (sum === 0) {
      return 0; // Para evitar división por cero
    }

    const result = Math.round((processedNum / sum) * 100);

    return result;
  } catch (error) {
    console.error("Error fetching monthly comparativas data:", error);
    return 0;
  }
};
