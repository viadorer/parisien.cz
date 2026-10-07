// Cloudflare R2 (S3 API) – předpodepsané PUT URL pro nahrávání obrázků z adminu.
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';

const env = process.env;
const endpoint = env.R2_ENDPOINT || (env.R2_ACCOUNT_ID && `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

export const r2Configured = Boolean(
  endpoint && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME && env.R2_PUBLIC_URL,
);

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_BYTES = 8 * 1024 * 1024;

export async function presignUpload({ contentType, size, folder = 'posts' }) {
  const ext = EXT[contentType];
  if (!ext) throw new Error('Povolené formáty: JPG, PNG, WebP.');
  if (!(size > 0 && size <= MAX_BYTES)) throw new Error('Soubor je prázdný nebo větší než 8 MB.');
  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  const prefix = (env.R2_PREFIX || 'parisien').replace(/^\/+|\/+$/g, '');
  const key = `${prefix}/${folder}/${new Date().getFullYear()}/${randomBytes(8).toString('hex')}.${ext}`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }),
    { expiresIn: 300 },
  );
  return { uploadUrl, publicUrl: `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`, key };
}
