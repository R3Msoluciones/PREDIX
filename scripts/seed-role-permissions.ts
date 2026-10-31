/**
 * seed-role-permissions.ts — Siembra role_permissions con los valores de
 * DEFAULT_PERMISSIONS (server/_core/infra/permissions.ts). La tabla existía
 * desde hace tiempo (drizzle/schema.ts) pero nunca se conectó — requirePermission
 * seguía leyendo el objeto estático en memoria. Idempotente (TRUNCATE+INSERT,
 * mismo patrón que el resto de la carga de datos de este proyecto).
 *
 * Uso: pnpm exec tsx scripts/seed-role-permissions.ts
 */

import "dotenv/config";
import { seedDefaultPermissions } from "../server/services/permissionsCache";

async function main() {
  const count = await seedDefaultPermissions();
  console.log(`[seed-role-permissions] ${count} filas sembradas en role_permissions.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[seed-role-permissions] Error:", error);
    process.exit(1);
  });
