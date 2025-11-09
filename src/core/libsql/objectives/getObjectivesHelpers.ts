import { Client } from "@libsql/client";
import { getSubcomerciales } from "../users/getSubcomerciales";

export const getObjectivesTramitesValues = async (
  tursoClient: Client,
  id: string,
  role: string,
  period: string,
  isSubcomercial: boolean
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

    // Para el conteo de trámites activos
    let queryActive = `SELECT COUNT(id) as active_count
    FROM tramites 
    WHERE substr(activation_date, 1, 7) = ?
    AND status = 'Activo'`;

    // Para las comisiones (todos los trámites con activation_date)
    let queryComision = `SELECT ${
      role === "2"
        ? "SUM(comision_sales_person) as comision"
        : "SUM(comision) as comision"
    }
    FROM tramites 
    WHERE substr(activation_date, 1, 7) = ? AND status = 'Activo'`; //

    const params = [datePrefixToSearch];
    const paramsComision = [datePrefixToSearch];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      if (subcomerciales.success && subcomerciales.ids) {
        const userFilter = ` AND (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        queryActive += userFilter;
        queryComision += userFilter;
        params.push(id, ...subcomerciales.ids);
        paramsComision.push(id, ...subcomerciales.ids);
      } else {
        queryActive += ` AND user_id = ?`;
        queryComision += ` AND user_id = ?`;
        params.push(id);
        paramsComision.push(id);
      }
    }

    // Ejecutar query para contar trámites activos
    const resActive = await tursoClient.execute({
      sql: queryActive,
      args: params,
    });

    // Ejecutar query para comisiones (si no es subcomercial)
    let comisionTotal = 0;
    if (!isSubcomercial) {
      const resComision = await tursoClient.execute({
        sql: queryComision,
        args: paramsComision,
      });
      comisionTotal = Number(resComision.rows[0]?.comision);
    }

    // Obtener el conteo de la primera fila
    const activeTramitesCount = Number(resActive.rows[0]?.active_count ?? 0);

    console.log("Comision Total:", comisionTotal);
    return {
      active: activeTramitesCount,
      comision: comisionTotal,
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
