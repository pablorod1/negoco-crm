// Regenera src/core/integrations/imagina-energia/municipios.data.ts a partir
// del catálogo oficial de Imagina (docs/imagina-energia/municipios.enum.yml).
//
//   npm run imagina:municipios
//
// El YAML es un enum plano; se lee línea a línea para no añadir dependencias.
import { readFile, writeFile } from "node:fs/promises";

const SOURCE = new URL(
  "../../docs/imagina-energia/municipios.enum.yml",
  import.meta.url,
);
const TARGET = new URL(
  "../core/integrations/imagina-energia/municipios.data.ts",
  import.meta.url,
);

const HEADER = `// Generado por src/scripts/generate-imagina-municipios.ts a partir de
// docs/imagina-energia/municipios.enum.yml (catálogo oficial de Imagina).
// No editar a mano: npm run imagina:municipios

export const IMAGINA_MUNICIPIOS: readonly string[] = [
`;

async function main() {
  const source = await readFile(SOURCE, "utf8");
  const names = source
    .split("\n")
    .map((line) => line.match(/^\s+-\s+(.+?)\s*$/)?.[1])
    .filter((name): name is string => Boolean(name));

  const unique = [...new Set(names)];
  if (unique.length !== names.length) {
    console.warn(
      `Aviso: ${names.length - unique.length} municipios duplicados en el YAML`,
    );
  }

  const body = unique.map((name) => `  ${JSON.stringify(name)},`).join("\n");
  await writeFile(TARGET, `${HEADER}${body}\n];\n`);
  console.log(`${unique.length} municipios → ${TARGET.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
