import "dotenv/config";
import { eq, isNull } from "drizzle-orm";
import { getDb } from "../server/config/db";
import { users } from "../drizzle/schema";
import { hashPassword } from "../server/_core/auth/password";

const TEMP_PASSWORD = "Demo@2026";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No hay conexión a base de datos (DATABASE_URL). Abortando.");
    process.exit(1);
  }

  const pending = await db.select().from(users).where(isNull(users.passwordHash));
  if (pending.length === 0) {
    console.log("Ningún usuario sin contraseña. Nada que hacer.");
    return;
  }

  const passwordHash = await hashPassword(TEMP_PASSWORD);
  for (const user of pending) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    console.log(`Contraseña temporal asignada a ${user.email ?? user.openId} (${user.institutionalRole})`);
  }

  console.log(`\n${pending.length} usuario(s) actualizados con la contraseña temporal "${TEMP_PASSWORD}".`);
  console.log("IMPORTANTE: cambiar estas contraseñas antes de producción.");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
