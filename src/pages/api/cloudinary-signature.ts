import type { APIRoute } from 'astro';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseAuth';
import { writeRateLimit } from '@/lib/server/firestoreRest';

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha1(message: string) {
  const data = new TextEncoder().encode(message);
  return toHex(await crypto.subtle.digest('SHA-1', data));
}

function cloudinaryContext(context: Record<string, string>) {
  return Object.entries(context)
    .map(([key, value]) => `${key}=${value}`)
    .join('|');
}

function dateId(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const projectId = env.PUBLIC_FIREBASE_PROJECT_ID;
    const user = await verifyFirebaseIdToken(request, projectId);
    const idToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const body = (await request.json().catch(() => null)) as { reportType?: string } | null;

    if (body?.reportType !== 'complaint') {
      return new Response('Only complaint reports can request image upload parameters.', { status: 400 });
    }

    const today = dateId();
    await writeRateLimit(projectId, idToken, `${user.uid}_${today}_upload`, {
      uid: user.uid,
      scope: 'cloudinaryUpload',
      day: today,
      updatedAt: new Date(),
    }, 3);

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = env.CLOUDINARY_UPLOAD_FOLDER || 'cetis26/reportes';
    const publicId = `report_${timestamp}_${randomId()}`;
    const tags = ['cetis26', 'complaint', 'hidden_until_review'];
    const context = {
      visibility: 'hidden_until_review',
      review_status: 'pending',
      uploader_uid_hash: await sha1(`${user.uid}:${today}`)
    };
    const uploadPreset = env.PUBLIC_CLOUDINARY_UNSIGNED_PRESET;

    const response: Record<string, unknown> = {
      cloudName: env.PUBLIC_CLOUDINARY_CLOUD_NAME,
      uploadPreset,
      folder,
      publicId,
      tags,
      context
    };

    if (env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      const paramsToSign = {
        context: cloudinaryContext(context),
        folder,
        public_id: publicId,
        tags: tags.join(','),
        timestamp,
        upload_preset: uploadPreset
      };
      const canonical = Object.entries(paramsToSign)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      response.apiKey = env.CLOUDINARY_API_KEY;
      response.timestamp = timestamp;
      response.signature = await sha1(`${canonical}${env.CLOUDINARY_API_SECRET}`);
    }

    return Response.json(response);
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response('Unable to authorize image upload.', { status: 500 });
  }
};
