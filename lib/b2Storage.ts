/**
 * Backblaze B2 Storage Utility (S3-compatible)
 * Uses AWS SDK v3 — B2 officially supports the S3-compatible API.
 *
 * Bucket: buildingmaterial (private)
 * Endpoint: s3.us-east-005.backblazeb2.com
 *
 * OPTIMISATION: S3Client is created once as a module-level singleton.
 * Previously getB2Client() created a new client on every call (upload, delete, signed URL).
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Singleton S3Client — created once, reused for every operation ────────────
let _b2Client: S3Client | null = null;

function getB2Client(): S3Client {
  if (_b2Client) return _b2Client;

  const endpoint = process.env.B2_ENDPOINT;
  const region   = process.env.B2_REGION || 'us-east-005';
  const keyId    = process.env.B2_KEY_ID;
  const appKey   = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !keyId || !appKey) {
    throw new Error(
      'Missing Backblaze B2 configuration. Check B2_ENDPOINT, B2_KEY_ID, B2_APPLICATION_KEY in .env.local',
    );
  }

  _b2Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: appKey,
    },
    // B2 requires path-style URLs (no virtual-hosted style)
    forcePathStyle: true,
    // Keep-alive to reuse TCP connections between requests
    requestHandler: {
      requestTimeout: 30_000,
    } as any,
  });

  return _b2Client;
}

const BUCKET_NAME = process.env.B2_BUCKET_NAME || 'buildingmaterial';

// ─── Upload ───────────────────────────────────────────────────────────────────
/**
 * Upload a file buffer to Backblaze B2.
 * @returns The object key stored in B2 and a 7-day presigned URL.
 */
export async function uploadToB2(
  buffer: Buffer,
  key: string,
  mimeType: string,
): Promise<{ fileKey: string; fileUrl: string }> {
  const client = getB2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  // Generate a 7-day presigned URL for immediate viewing
  const fileUrl = await getB2SignedUrl(key, 7 * 24 * 60 * 60);

  return { fileKey: key, fileUrl };
}

// ─── Delete ───────────────────────────────────────────────────────────────────
/**
 * Delete a file from Backblaze B2 by object key.
 */
export async function deleteFromB2(key: string): Promise<void> {
  const client = getB2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
  );
}

// ─── Presigned URL ────────────────────────────────────────────────────────────
/**
 * Generate a presigned GET URL for a private B2 object.
 * @param expiresIn seconds until URL expires (default 1 hour)
 */
export async function getB2SignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getB2Client();
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

// ─── Key generation ───────────────────────────────────────────────────────────
/**
 * Generate a unique, structured object key for B2.
 * Pattern: sale-documents/{shopId}/{YYYY-MM}/{timestamp}-{random}.{ext}
 */
export function generateB2Key(shopId: string | number, originalName: string): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const timestamp = now.getTime();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  return `sale-documents/${shopId}/${yearMonth}/${timestamp}-${random}.${ext}`;
}
