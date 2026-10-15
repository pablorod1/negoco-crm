/**
 * Genera `src/comparador/market/ree-profile.ts` con el perfil de consumo de la
 * 2.0TD de REE, resumido por mes, tipo de día y hora.
 *
 *   pnpm tsx src/scripts/comparador/ree-profile.ts <perfiles-iniciales.xlsx>
 *
 * El Excel es la «Propuesta de perfiles iniciales de consumo y demanda de
 * referencia» del año, en ree.es (Clientes > Consumidor > Gestión de medidas
 * eléctricas > Consulta de perfiles de consumo). Trae un coeficiente por hora
 * del año; aquí se queda la media de cada mes, tipo de día y hora, que sirve
 * para cualquier año.
 */
import { writeFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { dayType } from "@/comparador/market/calendar";

async function main() {
  const file = process.argv[2];
  if (!file?.endsWith(".xlsx")) throw new Error("Uso: ree-profile.ts <perfiles-iniciales.xlsx>");
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames.find((name) => /perfiles iniciales/i.test(name)) ?? ""];
  if (!sheet) throw new Error("No está la hoja «Perfiles Iniciales»");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const header = rows.findIndex((row) => row.some((cell) => /^P2\.0TD/.test(String(cell))));
  const column = rows[header].findIndex((cell) => /^P2\.0TD/.test(String(cell)));
  const title = rows.slice(0, header).flat().find((cell) => /perfil inicial \d{4}/i.test(String(cell)));
  const year = Number(String(title).match(/\d{4}/)?.[0]);
  if (!year) throw new Error("No se encuentra el año del perfil");

  // [mes][tipo de día][hora 0–23]: suma y número de coeficientes.
  const sums = Array.from({ length: 12 }, () => Array.from({ length: 3 }, () => new Array<number>(24).fill(0)));
  const counts = Array.from({ length: 12 }, () => Array.from({ length: 3 }, () => new Array<number>(24).fill(0)));
  for (const row of rows.slice(header + 1)) {
    const [month, day, hour] = [Number(row[0]), Number(row[1]), Number(row[2])];
    const value = Number(row[column]);
    // La hora 25 es la que se repite el día del cambio de hora de octubre.
    if (!month || !day || !hour || hour > 24 || !Number.isFinite(value)) continue;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const type = ["laborable", "sabado", "festivo"].indexOf(dayType(date));
    sums[month - 1][type][hour - 1] += value;
    counts[month - 1][type][hour - 1] += 1;
  }
  const profile = sums.map((types, month) =>
    types.map((hours, type) =>
      hours.map((sum, hour) => {
        const count = counts[month][type][hour];
        // Relativo a la media del año: solo importa el peso de cada hora frente a las demás.
        return count > 0 ? Number(((sum / count) * 8760).toFixed(4)) : 1;
      }),
    ),
  );

  const output = `// Generado por src/scripts/comparador/ree-profile.ts con el perfil inicial ${year} de REE. No editar a mano.

/**
 * Perfil de consumo de la 2.0TD de REE (P2.0TD): peso de cada hora local (0–23)
 * por mes (0–11) y tipo de día (laborable, sábado, festivo), relativo a la
 * media del año. Pondera el precio de OMIE de cada hora por lo que consume en
 * ella un cliente doméstico, como hacen las comercializadoras al facturar.
 */
export const REE_PROFILE_YEAR = ${year};

export const REE_PROFILE: readonly (readonly (readonly number[])[])[] = ${JSON.stringify(profile)};
`;
  await writeFile("src/comparador/market/ree-profile.ts", output);
  console.log(`Perfil ${year} escrito en src/comparador/market/ree-profile.ts`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
