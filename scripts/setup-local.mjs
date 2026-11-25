import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
const path = new URL('../api/.dev.vars', import.meta.url);
if (!existsSync(path)) {
  writeFileSync(
    path,
    `APP_ORIGIN=http://localhost:8788\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\n`,
  );
  console.log('Created api/.dev.vars with a random local secret.');
} else console.log('Existing api/.dev.vars kept.');
