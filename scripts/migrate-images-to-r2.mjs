// Nahraje optimalizované obrázky z ./images do R2 (prefix "parisien/site/").
// Použití:  R2_ENDPOINT=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET_NAME=… npm run migrate-images
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const need = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) { console.error('Chybí proměnné:', missing.join(', ')); process.exit(1); }

const client = new S3Client({
  region: 'auto', endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const prefix = (process.env.R2_PREFIX || 'parisien').replace(/^\/+|\/+$/g, '');
for (const f of await readdir('images')) {
  const type = TYPES[extname(f)]; if (!type) continue;
  const Key = `${prefix}/site/${f}`;
  await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key, Body: await readFile(join('images', f)), ContentType: type, CacheControl: 'public, max-age=31536000, immutable' }));
  console.log('✓', Key);
}
