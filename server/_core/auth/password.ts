import bcrypt from "bcryptjs";

// bcryptjs (puro JS) en vez de bcrypt nativo — evita depender de node-gyp/binarios
// prebuilt en el build de Railway (deploy directo, sin Docker).
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
