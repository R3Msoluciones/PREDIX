import type { User } from "../../../drizzle/schema";

export function toPublicUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
