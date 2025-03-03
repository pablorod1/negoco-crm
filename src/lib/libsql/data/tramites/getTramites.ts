import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
  TramiteVM,
  User,
} from "@/lib/core/types";
import { tursoClient } from "../../client";
import { DateRange } from "react-day-picker";

async function executeQuery<T>(query: string, args: string[]): Promise<T[]> {
  const result = await tursoClient.execute({ sql: query, args });
  return result.rows as T[]; // TypeScript ya sabe que rows es del tipo correcto
}

export const checkIfComercialHasSubcomerciales = async (
  userData: Partial<User> | User
) => {
  try {
    const rs = await tursoClient.execute({
      sql: `SELECT id FROM user WHERE super_id = ?;`,
      args: [userData.id as string],
    });

    if (rs.rows.length === 0) {
      return {
        success: false,
      };
    }

    return {
      success: true,
      ids: rs.rows.map((row) => row.id as string),
    };
  } catch (error) {
    console.error("Error al obtener subcomerciales:", error);
    return {
      success: false,
    };
  }
};

export const getTramites = async (
  page: number,
  rowsPerPage: number,
  userData: User,
  filterValue?: string,
  companyFilter?: string[],
  statusFilter?: string[],
  liquidezStatusFilter?: string[],
  contractTypeFilter?: string[]
): Promise<TramiteVM[]> => {
  try {
    const offset = (page - 1) * rowsPerPage;
    let query = `
      SELECT 
          t.id AS id,
          t.creation_date AS creation_date,
          t.renovation_date AS renovation_date,
          t.sales_name AS sales_name,
          t.comision_sales_person AS comision_sales_person,
          t.comision AS comision,
          t.status AS status,
          t.liquidez_status AS liquidez_status,
          c.name AS client_name,
          c.last_name AS client_last_name,
          c.email AS client_email,
          c.id AS client_id,
          COALESCE(GROUP_CONCAT(DISTINCT con.CUPS), '') AS CUPS,
          COALESCE(GROUP_CONCAT(DISTINCT con.company), '') AS companies,
          COALESCE(GROUP_CONCAT(DISTINCT con.plan), '') AS plans,
          COALESCE(GROUP_CONCAT(DISTINCT con.type), '') AS contract_types,
          COALESCE(GROUP_CONCAT(DISTINCT con.consumption), '') AS consumptions
      FROM 
          tramites t
      LEFT JOIN 
          clients c ON t.client_id = c.id
      LEFT JOIN 
          contracts con ON t.id = con.tramite_id
    `;

    const filters: string[] = [];
    const params: (string | number)[] = [];

    if (userData.role === "2") {
      const subcomerciales = await checkIfComercialHasSubcomerciales(userData);
      if (subcomerciales.success && subcomerciales.ids) {
        filters.push(
          `( t.user_id = ? OR (t.status != 'Borrador' AND t.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")})))`
        );
        params.push(userData.id, ...subcomerciales.ids);
      } else {
        filters.push(`t.user_id = ?`);
        params.push(userData.id);
      }
    } else {
      // For other roles, show all their own tramites but only non-Borrador tramites from others
    }

    // Dynamic filter generation
    const addTextFilter = (fields: string[], value: string) => {
      const likeConditions = fields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      filters.push(`(${likeConditions})`);
      fields.forEach(() => params.push(`%${value}%`));
    };

    if (filterValue) {
      addTextFilter(
        [
          "c.name",
          "c.last_name",
          `c.name || ' ' || c.last_name`,
          "c.email",
          "t.sales_name",
          "t.id",
          "con.CUPS",
        ],
        filterValue
      );
    }

    // Add array-based filters with null check
    const addArrayFilter = (column: string, filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
        params.push(...filterArray);
      }
    };

    addArrayFilter("con.company", companyFilter);
    addArrayFilter("t.status", statusFilter);
    addArrayFilter("con.type", contractTypeFilter);
    addArrayFilter("t.liquidez_status", liquidezStatusFilter);

    if (filters.length > 0) {
      query += ` WHERE ` + filters.join(" AND ");
    }

    // Group by main tramite fields
    query += ` GROUP BY 
      t.id, t.creation_date, t.renovation_date, t.sales_name, 
      t.comision_sales_person, t.comision, t.status, t.liquidez_status,
      c.name, c.last_name, c.email`;

    query += ` ORDER BY t.creation_date DESC`;

    // Add pagination
    query += ` LIMIT ? OFFSET ?;`;
    params.push(rowsPerPage, offset);

    const rs = await tursoClient.execute({
      sql: query,
      args: params,
    });

    return rs.rows.map((row) => {
      // Safe parsing with fallback to empty arrays
      const parseArray = (value: string) =>
        value ? value.split(",").filter(Boolean) : [];

      const parseNumericArray = (value: string) =>
        value
          ? value
              .split(",")
              .map(Number)
              .filter((x) => !isNaN(x))
          : [];

      return {
        id: row.id as string,
        creation_date: row.creation_date as string,
        renovation_date: row.renovation_date as string,
        sales_name: row.sales_name as string,
        client_name: `${row.client_name || ""} ${
          row.client_last_name || ""
        }`.trim(),
        client_email: row.client_email as string,
        client_id: row.client_id as string,
        CUPS: parseArray(row.CUPS as string),
        company: parseArray(row.companies as string),
        plan: parseArray(row.plans as string),
        contract_type: parseArray(row.contract_types as string),
        consumption: parseNumericArray(row.consumptions as string),
        comision_sales_person: row.comision_sales_person as number,
        comision: row.comision as number,
        status: row.status as string,
        liquidez_status: row.liquidez_status as string,
      };
    });
  } catch (error) {
    console.error("Error retrieving tramites:", error);
    return [];
  }
};

export const getTramiteByID = async (
  tramite_id: string
): Promise<{
  data?: {
    tramite: TramiteDB;
    client: ClientDB;
    contracts: ContractDB[];
    signer?: SignerDB;
    files?: TramiteFile[];
  };
  success: boolean;
}> => {
  try {
    const [
      tramiteResult,
      clientResult,
      contractsResult,
      signerResult,
      filesResult,
    ] = await Promise.all([
      executeQuery<TramiteDB>(`SELECT * FROM tramites WHERE id = ?`, [
        tramite_id,
      ]),
      executeQuery<ClientDB>(
        `SELECT * FROM clients WHERE id = (SELECT client_id FROM tramites WHERE id = ?)`,

        [tramite_id]
      ),
      executeQuery<ContractDB>(`SELECT * FROM contracts WHERE tramite_id = ?`, [
        tramite_id,
      ]),
      executeQuery<SignerDB>(
        `SELECT s.* FROM signers s 
           INNER JOIN tramites t ON t.client_id = s.client_id 
           WHERE t.id = ?`,
        [tramite_id]
      ),
      executeQuery<TramiteFile>(
        `SELECT * FROM tramite_files WHERE tramite_id = ?`,
        [tramite_id]
      ),
    ]);

    if (tramiteResult.length === 0) {
      throw new Error(`Trámite with id ${tramite_id} not found`);
    }

    return {
      data: {
        tramite: {
          ...tramiteResult[0],
          notes: JSON.parse(tramiteResult[0].notes as string),
        },
        client: clientResult[0],
        contracts: contractsResult,
        signer: signerResult[0],
        files: filesResult,
      },
      success: true,
    };
  } catch (error) {
    console.error("Error retrieving tramite by id:", error);
    return { success: false };
  }
};

export const getClientsCount = async (
  userData: User
): Promise<{
  value: number;
  difference: number;
}> => {
  try {
    const query = `
      WITH current_week AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador' 
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', 'now')
        ${userData.role === "2" ? "AND t.user_id = ?" : ""}
      ),
      previous_week AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', 'now', '-1 month')
        ${userData.role === "2" ? "AND t.user_id = ?" : ""}
      ),
      all_time AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        ${userData.role === "2" ? "AND t.user_id = ?" : ""}
      )
      SELECT 
        at.total AS total,
        COALESCE(cw.total, 0) AS current_total,
        COALESCE(pw.total, 0) AS prev_total
      FROM all_time at
      LEFT JOIN current_week cw ON 1=1
      LEFT JOIN previous_week pw ON 1=1;
    `;

    const params: string[] =
      userData.role === "2" ? [userData.id, userData.id, userData.id] : [];

    const rs = await tursoClient.execute({ sql: query, args: params });

    const current = rs.rows[0] || { total: 0, current_total: 0, prev_total: 0 };

    const calculatePercentage = (
      currentValue: number,
      previousValue: number
    ) => {
      if (previousValue === 0) return currentValue > 0 ? 100 : 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    return {
      value: current.total as number,
      difference: calculatePercentage(
        Number(current.current_total),
        Number(current.prev_total)
      ),
    };
  } catch (error) {
    console.error("Error al obtener el total de clientes:", error);
    return {
      value: 0,
      difference: 0,
    };
  }
};

export const getActivePendingTramites = async (
  current_week: boolean,
  userData: User
): Promise<{
  total: number;
  active: { value: number; difference: number };
  pending: { value: number; difference: number };
}> => {
  try {
    let query = `
      WITH current_data AS (
          SELECT 
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'Pendiente de Firma' THEN 1 ELSE 0 END) AS pending
          FROM tramites WHERE status NOT LIKE 'Borrador'
    `;

    const params: (string | number)[] = [];

    if (current_week) {
      query += ` AND strftime('%Y-%W', creation_date) = strftime('%Y-%W', 'now')`;
    }

    if (userData.role === "2") {
      const subcomerciales = await checkIfComercialHasSubcomerciales(userData);
      query += ` AND`;
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        params.push(userData.id, ...subcomerciales.ids);
      } else {
        query += ` user_id = ?`;
        params.push(userData.id);
      }
    }

    query += `),
      previous_data AS (
          SELECT 
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'Pendiente de Firma' THEN 1 ELSE 0 END) AS pending
          FROM tramites WHERE status NOT LIKE 'Borrador'
          AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', 'now', '-1 month')
    `;

    if (userData.role !== "admin" && userData.role !== "1") {
      query += ` AND user_id = ?`;
      params.push(userData.id);
    }

    query += `)
      SELECT 
          cd.total AS total,
          cd.active AS active, 
          cd.pending AS pending,
          COALESCE(pd.active, 0) AS prev_active,
          COALESCE(pd.pending, 0) AS prev_pending
      FROM current_data cd
      LEFT JOIN previous_data pd ON 1=1;
    `;

    const rs = await tursoClient.execute({ sql: query, args: params });

    const current = rs.rows[0] || {
      total: 0,
      active: 0,
      pending: 0,
      prev_active: 0,
      prev_pending: 0,
    };

    const calculatePercentage = (
      currentValue: number,
      previousValue: number
    ) => {
      if (previousValue === 0) return currentValue > 0 ? currentValue * 100 : 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    const activeDifference = calculatePercentage(
      Number(current.active),
      Number(current.prev_active)
    );

    const pendingDifference = calculatePercentage(
      Number(current.pending),
      Number(current.prev_pending)
    );

    return {
      total: current.total as number,
      active: {
        value: current.active as number,
        difference: activeDifference,
      },
      pending: {
        value: current.pending as number,
        difference: pendingDifference,
      },
    };
  } catch (error) {
    console.error("Error al obtener el total de trámites:", error);
    return {
      total: 0,
      active: { value: 0, difference: 0 },
      pending: { value: 0, difference: 0 },
    };
  }
};

export const getActiveTramitesByUserID = async (
  userData: Partial<User> | User,
  time_range?:
    | "year"
    | "current_month"
    | "current_week"
    | "last_week"
    | "90d"
    | undefined,
  date_range?: DateRange
): Promise<{ field: string; value: number }[]> => {
  try {
    let query = `
      SELECT 
          date(creation_date) as date,
          COUNT(*) as value
      FROM tramites
      WHERE status = 'Activo'`;

    const params: (string | number)[] = [];

    if (userData.role === "2") {
      const subcomerciales = await checkIfComercialHasSubcomerciales(userData);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` AND (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        params.push(userData.id as string, ...subcomerciales.ids);
      } else {
        query += ` AND user_id = ?`;
        params.push(userData.id as string);
      }
    }

    let groupBy = "";

    // Filtros de acuerdo al time_range
    if (time_range) {
      switch (time_range) {
        case "year":
          query += ` AND creation_date >= date('now', 'start of year')`;
          groupBy = `strftime('%m', creation_date)`;
          break;
        case "current_month":
          query += ` AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', 'now')`;
          groupBy = `strftime('%d', creation_date)`;
          break;
        case "current_week":
          query += ` AND strftime('%Y-%W', creation_date) = strftime('%Y-%W', 'now')`;
          groupBy = `strftime('%w', creation_date)`;
          break;
        case "last_week":
          query += ` AND strftime('%Y-%W', creation_date) = strftime('%Y-%W', 'now', '-7 days')`;
          groupBy = `strftime('%w', creation_date)`;
          break;
        case "90d":
          query += ` AND creation_date >= date('now', '-90 days')`;
          groupBy = `date(creation_date)`;
          break;
      }
    }

    if (date_range && date_range.from && date_range.to) {
      query += ` AND date(creation_date) BETWEEN date(?) AND date(?)`;
      groupBy = `date(creation_date)`;
    }

    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }
    query += ` ORDER BY date(creation_date)`;

    if (date_range?.from && date_range?.to) {
      params.push(date_range.from.toISOString(), date_range.to.toISOString());
    }

    const rs = await tursoClient.execute({ sql: query, args: params });
    const results = new Map<string, number>();

    // Procesar resultados según el time_range
    if (time_range === "current_week" || time_range === "last_week") {
      const weekStart =
        time_range === "current_week"
          ? new Date()
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Ajustar al lunes

      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dayStr = day.toLocaleDateString("es-ES", { weekday: "long" });
        results.set(dayStr, 0);
      }

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const dayStr = date.toLocaleDateString("es-ES", { weekday: "long" });
        results.set(dayStr, Number(row.value));
      });
    } else if (time_range === "current_month") {
      const daysInMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ).getDate();

      for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = `${i}`;
        results.set(dayStr, 0);
      }

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const dayStr = `${date.getDate()}`;
        results.set(dayStr, Number(row.value));
      });
    } else if (time_range === "year") {
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

      months.forEach((month) => results.set(month, 0));

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const monthStr = months[date.getMonth()];
        results.set(monthStr, Number(row.value));
      });
    } else if (time_range === "90d") {
      const days = Array.from({ length: 90 }, (_, i) => i);

      days.forEach((day) => {
        const date = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
        const dayStr = date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        });
        results.set(dayStr, 0);
      });

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const dayStr = date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        });
        results.set(dayStr, Number(row.value));
      });
    } else if (date_range && date_range.from && date_range.to) {
      const fromDate = new Date(date_range.from);
      const toDate = new Date(date_range.to);

      // Iteramos sobre cada día en el rango de fechas
      for (
        let date = new Date(fromDate);
        date <= toDate;
        date.setDate(date.getDate() + 1)
      ) {
        const dateStr = date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        }); // Ejemplo: "martes 13"
        results.set(dateStr, 0);
      }

      // Poblar los valores obtenidos de la consulta
      rs.rows.forEach((row) => {
        const dateObj = new Date(row.date as string);
        const dateStr = dateObj.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        });

        if (results.has(dateStr)) {
          results.set(dateStr, Number(row.value));
        }
      });
    }

    return Array.from(results.entries()).map(([field, value]) => ({
      field,
      value,
    }));
  } catch (error) {
    console.error("Error al obtener trámites activos:", error);
    return [];
  }
};

export const getTramitesCountByStatus = async (
  userData: User
): Promise<
  {
    status: string;
    total: number;
  }[]
> => {
  try {
    let query = `
      SELECT 
          status,
          COUNT(*) AS total
      FROM tramites 
    `;

    const params: (string | number)[] = [];

    if (userData.role === "2") {
      const subcomerciales = await checkIfComercialHasSubcomerciales(userData);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` WHERE (user_id = ? OR (status != 'Borrador' AND user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})))`;
        params.push(userData.id, ...subcomerciales.ids);
      } else {
        query += ` WHERE user_id = ?`;
        params.push(userData.id);
      }
    }

    query += ` GROUP BY status;`;

    const rs = await tursoClient.execute({ sql: query, args: params });

    return rs.rows.map((row) => ({
      status: row.status as string,
      total: row.total as number,
    }));
  } catch (error) {
    console.error("Error al obtener el total de trámites por estado:", error);
    return [];
  }
};

export const getComisionesPendientes = async (
  userData: User
): Promise<number> => {
  try {
    let query = `
      SELECT SUM(CASE WHEN liquidez_status IN (${
        userData.role === "2"
          ? "'Pendiente de Cobro', 'Cobrado por Comercializadora'"
          : "'Pendiente de Cobro'"
      }) THEN 1 ELSE 0 END) AS total
      FROM tramites`;

    const params: (string | number)[] = [];

    if (userData.role === "2") {
      const subcomerciales = await checkIfComercialHasSubcomerciales(userData);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` WHERE user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})`;
        params.push(userData.id, ...subcomerciales.ids);
      } else {
        query += ` WHERE user_id = ?`;
        params.push(userData.id);
      }
    }

    const rs = await tursoClient.execute({ sql: query, args: params });

    return rs.rows[0].total as number;
  } catch (error) {
    console.error("Error al obtener el total de comisiones pendientes:", error);
    return 0;
  }
};

export const getMonthlyComisiones = async (
  userData: User
): Promise<{ month: string; total: number }[]> => {
  try {
    let query = `
      SELECT 
          strftime('%Y-%m', creation_date) AS month_key,
          SUM(${
            userData.role === "2" ? "comision_sales_person" : "comision"
          }) AS total
      FROM tramites
      WHERE strftime('%Y', creation_date) = strftime('%Y', 'now')`;

    const params: (string | number)[] = [];

    if (userData.role === "2") {
      const subcomerciales = await checkIfComercialHasSubcomerciales(userData);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` AND (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        params.push(userData.id, ...subcomerciales.ids);
      } else {
        query += ` AND user_id = ?`;
        params.push(userData.id);
      }
    }

    query += ` GROUP BY month_key ORDER BY month_key ASC`;

    const rs = await tursoClient.execute({ sql: query, args: params });

    // Mapeo de los nombres de los meses
    const monthNames = [
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

    // Crear un objeto con los datos obtenidos
    const comisionesMap = new Map<string, number>();
    rs.rows.forEach((row) => {
      const [, month] = String(row.month_key).split("-"); // Se obtiene el mes correctamente
      comisionesMap.set(month, row.total as number);
    });

    // Construir el array con todos los meses, rellenando los que no tienen datos con 0
    const result = monthNames.map((month, index) => {
      const monthKey = String(index + 1).padStart(2, "0"); // Formato "01", "02", etc.
      return {
        month,
        total: comisionesMap.get(monthKey) || 0, // Si no hay datos, se usa 0
      };
    });

    return result;
  } catch (error) {
    console.error("Error al obtener las comisiones mensuales:", error);
    return [];
  }
};

export const getRenewableTramites = async (): Promise<
  { id: string; renovationDate: string; sales_name: string }[]
> => {
  try {
    const rs = await tursoClient.execute(
      `SELECT id, sales_name, renovation_date AS renovationDate FROM tramites WHERE status = 'Activo';`
    );

    return rs.rows.map((row) => ({
      id: row.id as string,
      sales_name: row.sales_name as string,
      renovationDate: row.renovationDate as string,
    }));
  } catch (error) {
    console.error("Error al obtener trámites renovables:", error);
    return [];
  }
};

export const getMonthlyActivePendingTramites = async (): Promise<
  { month: string; active: number; pending: number }[]
> => {
  try {
    const rs = await tursoClient.execute(`
      WITH months AS (
        SELECT '01' AS month, 'Enero' AS month_name UNION ALL
        SELECT '02', 'Febrero' UNION ALL
        SELECT '03', 'Marzo' UNION ALL
        SELECT '04', 'Abril' UNION ALL
        SELECT '05', 'Mayo' UNION ALL
        SELECT '06', 'Junio' UNION ALL
        SELECT '07', 'Julio' UNION ALL
        SELECT '08', 'Agosto' UNION ALL
        SELECT '09', 'Septiembre' UNION ALL
        SELECT '10', 'Octubre' UNION ALL
        SELECT '11', 'Noviembre' UNION ALL
        SELECT '12', 'Diciembre'
      )
      SELECT 
        m.month_name AS month,
        COALESCE(SUM(CASE WHEN t.status = 'Activo' THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN t.status = 'Pendiente de Firma' THEN 1 ELSE 0 END), 0) AS pending
      FROM months m
      LEFT JOIN tramites t ON strftime('%m', t.creation_date) = m.month
        AND strftime('%Y', t.creation_date) = strftime('%Y', 'now') -- Filtra solo el año actual
      GROUP BY m.month, m.month_name
      ORDER BY m.month;
    `);

    return rs.rows.map((row) => ({
      month: row.month as string,
      active: row.active as number,
      pending: row.pending as number,
    }));
  } catch (error) {
    console.error("Error al obtener trámites activos y pendientes:", error);
    return [];
  }
};

export const getTeamTramites = async (
  userData: User,
  time_range?:
    | "year"
    | "current_month"
    | "current_week"
    | "last_week"
    | "90d"
    | undefined
): Promise<
  {
    user: Partial<User>;
    active: number;
  }[]
> => {
  try {
    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.image,
        u.role,
        u.super_id,
        COUNT(CASE WHEN t.status = 'Activo' THEN 1 END) as active
      FROM user u
      LEFT JOIN tramites t ON u.id = t.user_id
    `;
    const params: (string | number)[] = [];

    if (userData.role === "2") {
      // Para comerciales, obtener stats de sus subcomerciales
      query += ` WHERE u.super_id = ?`;
      params.push(userData.id);
    } else {
      // Para otros roles, obtener stats de todos los usuarios excepto él mismo
      query += ` WHERE u.id != ?`;
      params.push(userData.id);
    }

    if (time_range === "current_month") {
      query += ` AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', 'now')`;
    } else if (time_range === "current_week") {
      query += ` AND strftime('%Y-%W', t.creation_date) = strftime('%Y-%W', 'now')`;
    } else if (time_range === "last_week") {
      query += ` AND strftime('%Y-%W', t.creation_date) = strftime('%Y-%W', 'now', '-7 days')`;
    } else if (time_range === "90d") {
      query += ` AND t.creation_date >= date('now', '-90 days')`;
    } else if (time_range === "year") {
      query += ` AND strftime('%Y', t.creation_date) = strftime('%Y', 'now')`;
    }

    query += ` GROUP BY u.id, u.name, u.email, u.role, u.super_id, u.image;`;

    const rs = await tursoClient.execute({ sql: query, args: params });

    return rs.rows.map((row) => ({
      user: {
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        image: row.image as string,
        role: row.role as string,
        super_id: row.super_id as string,
      },
      active: (row.active as number) || 0,
    }));
  } catch (error) {
    console.error("Error al obtener trámites del equipo:", error);
    return [];
  }
};
