import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
export const auth = betterAuth({
  database: new DatabaseSync(':memory:'),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});
