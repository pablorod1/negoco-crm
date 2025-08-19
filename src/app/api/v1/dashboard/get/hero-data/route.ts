import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

interface DashboardCardValue {
  total: number;
  value: number;
  prev_value: number;
  difference: number;
}

interface DashboardHeroData {
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  comisionesPendientes: number;
  totalBalance: number;
  comparativas: DashboardCardValue;
}

export async function POST(req: NextRequest) {
  try {
    const {
      id,
      role,
    }: {
      id: string;
      role: string;
    } = await req.json();

    if (!id || !role) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Obtener subcomerciales si el rol es "2"
    let subcomerciales: { success: boolean; ids?: string[] } = {
      success: false,
    };
    if (role === "2") {
      subcomerciales = await getSubcomerciales(tursoClient, id);
    }

    const createUserFilter = (includeSubcomerciales: boolean = true) => {
      const params: (string | number)[] = [];
      let filter = "";

      if (role === "2") {
        if (
          includeSubcomerciales &&
          subcomerciales.success &&
          subcomerciales.ids
        ) {
          filter = `AND (user_id = ? OR user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")}))`;
          params.push(id, ...subcomerciales.ids);
        } else {
          filter = `AND user_id = ?`;
          params.push(id);
        }
      } else if (role !== "admin" && role !== "1") {
        filter = `AND user_id = ?`;
        params.push(id);
      }

      return { filter, params };
    };

    // 1. Obtener datos de clientes
    const clientsUserFilter = createUserFilter();
    const clientsQuery = `
      WITH current_month AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador' 
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now'))
        ${clientsUserFilter.filter.replace("AND", "AND t.")}
      ),
      previous_month AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now', '-1 month'))
        ${clientsUserFilter.filter.replace("AND", "AND t.")}
      ),
      all_time AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        ${clientsUserFilter.filter.replace("AND", "AND t.")}
      )
      SELECT 
        a.total AS total,
        COALESCE(c.total, 0) AS current_total,
        COALESCE(p.total, 0) AS prev_total
      FROM all_time a, current_month c, previous_month p;
    `;

    const activeTramitesUserFilter = createUserFilter();
    const activeTramitesQuery = `
      WITH current_data AS (
          SELECT 
              SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS total,
              SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS active
          FROM tramites 
          WHERE 1=1 ${activeTramitesUserFilter.filter}
      ),
      previous_data AS (
          SELECT 
              SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS active
          FROM tramites
          WHERE 1=1 ${role !== "admin" && role !== "1" ? "AND user_id = ?" : ""}
      )
      SELECT 
          cd.total AS total,
          cd.active AS active, 
          COALESCE(pd.active, 0) AS prev_active
      FROM current_data cd
      LEFT JOIN previous_data pd ON 1=1;
    `;

    // 3. Obtener comisiones pendientes
    const comisionesPendientesUserFilter = createUserFilter();
    const comisionesPendientesQuery = `
      SELECT SUM(CASE WHEN liquidez_status IN (${
        role === "2"
          ? "'Pendiente de Cobro', 'Cobrado por Comercializadora'"
          : "'Pendiente de Cobro'"
      }) THEN 1 ELSE 0 END) AS total
      FROM tramites
      WHERE 1=1 ${comisionesPendientesUserFilter.filter}
    `;

    // 4. Obtener balance mensual
    const balanceUserFilter = createUserFilter();
    const balanceQuery = `
      SELECT 
          strftime('%Y-%m', activation_date) AS month_key,
          SUM(${role === "2" ? "comision_sales_person" : "comision"}) AS total
      FROM tramites
      WHERE strftime('%Y', activation_date) = strftime('%Y', 'now')
      ${balanceUserFilter.filter}
      GROUP BY month_key ORDER BY month_key ASC
    `;

    // 5. Obtener comparativas completadas
    const comparativasUserFilter = createUserFilter();
    const comparativasQuery = `
      SELECT
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS total, 
        SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS prev_completed
      FROM comparativas
      WHERE 1=1 ${comparativasUserFilter.filter}
    `;

    // Ejecutar todas las consultas
    const [
      clientsResult,
      activeTramitesResult,
      comisionesPendientesResult,
      balanceResult,
      comparativasResult,
    ] = await Promise.all([
      tursoClient.execute({
        sql: clientsQuery,
        args: [
          ...clientsUserFilter.params,
          ...clientsUserFilter.params,
          ...clientsUserFilter.params,
        ],
      }),
      tursoClient.execute({
        sql: activeTramitesQuery,
        args: [
          ...activeTramitesUserFilter.params,
          ...(role !== "admin" && role !== "1" ? [id] : []),
        ],
      }),
      tursoClient.execute({
        sql: comisionesPendientesQuery,
        args: comisionesPendientesUserFilter.params,
      }),
      tursoClient.execute({
        sql: balanceQuery,
        args: balanceUserFilter.params,
      }),
      tursoClient.execute({
        sql: comparativasQuery,
        args: comparativasUserFilter.params,
      }),
    ]);

    const calculatePercentage = (
      currentValue: number,
      previousValue: number
    ) => {
      if (previousValue === 0) return currentValue > 0 ? 100 : 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    // Procesar resultados de clientes
    const clientsData = clientsResult.rows[0] || {
      total: 0,
      current_total: 0,
      prev_total: 0,
    };
    const clientsDifference = calculatePercentage(
      Number(clientsData.current_total || 0),
      Number(clientsData.prev_total || 0)
    );

    const activeTramitesData = activeTramitesResult.rows[0] || {
      total: 0,
      active: 0,
      prev_active: 0,
    };
    const activeTramitesDifference = calculatePercentage(
      Number(activeTramitesData.active || 0),
      Number(activeTramitesData.prev_active || 0)
    );

    // Procesar comisiones pendientes
    const comisionesPendientes = Number(
      comisionesPendientesResult.rows[0]?.total || 0
    );

    // Procesar balance total
    const balanceData = balanceResult.rows;
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

    const comisionesMap = new Map<string, number>();
    balanceData.forEach((row) => {
      const [, month] = String(row.month_key).split("-");
      comisionesMap.set(month, row.total as number);
    });

    const balanceArray = monthNames.map((month, index) => {
      const monthKey = String(index + 1).padStart(2, "0");
      return {
        month,
        total: comisionesMap.get(monthKey) || 0,
      };
    });

    const totalBalance = balanceArray.reduce(
      (acc, item) => acc + item.total,
      0
    );

    // Procesar comparativas
    const comparativasData = comparativasResult.rows[0] || {
      total: 0,
      completed: 0,
      prev_completed: 0,
    };
    const comparativasDifference = calculatePercentage(
      Number(comparativasData.completed || 0),
      Number(comparativasData.prev_completed || 0)
    );

    // Construir respuesta
    const heroData: DashboardHeroData = {
      clients: {
        total: Number(clientsData.total || 0),
        value: Number(clientsData.current_total || 0),
        prev_value: Number(clientsData.prev_total || 0),
        difference: clientsDifference,
      },
      activeTramites: {
        total: Number(activeTramitesData.total || 0),
        value: Number(activeTramitesData.active || 0),
        prev_value: Number(activeTramitesData.prev_active || 0),
        difference: activeTramitesDifference,
      },
      comisionesPendientes,
      totalBalance,
      comparativas: {
        total: Number(comparativasData.total || 0),
        value: Number(comparativasData.completed || 0),
        prev_value: Number(comparativasData.prev_completed || 0),
        difference: comparativasDifference,
      },
    };

    return NextResponse.json({
      success: true,
      data: heroData,
    });
  } catch (error) {
    console.error("Error fetching dashboard hero data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching dashboard hero data",
      },
      { status: 500 }
    );
  }
}
