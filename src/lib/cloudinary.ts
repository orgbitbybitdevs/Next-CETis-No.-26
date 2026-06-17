import { z } from 'zod';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 2_000_000;
const maxWidth = 1600;

export const cloudinaryUploadResponseSchema = z.object({
  public_id: z.string(),
  secure_url: z.string().url(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  format: z.string()
});

export type CloudinaryUploadResult = z.infer<typeof cloudinaryUploadResponseSchema>;

export async function prepareReportImage(file: File): Promise<File> {
  if (!allowedTypes.has(file.type)) {
    throw new Error('Solo se permiten imágenes jpg, jpeg, png o webp.');
  }

  if (file.size > maxBytes) {
    throw new Error('La imagen debe pesar 2 MB o menos.');
  }

  const bitmap = await createImageBitmap(file);
  if (bitmap.width > maxWidth) {
    bitmap.close();
    throw new Error('La imagen debe medir maximo 1600px de ancho.');
  }

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / bitmap.width);
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('No se pudo procesar la imagen.');
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.82);
  });

  if (!blob) {
    throw new Error('No se pudo comprimir la imagen.');
  }

  if (blob.size > maxBytes) {
    throw new Error('La imagen comprimida sigue superando 2 MB.');
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
}

export async function uploadUnsignedComplaintImage(input: {
  file: File;
  uid: string;
  idToken: string;
}) {
  const gate = await fetch('/api/cloudinary-signature', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reportType: 'complaint' })
  });

  if (!gate.ok) {
    throw new Error(await gate.text());
  }

  const params = (await gate.json()) as {
    cloudName: string;
    uploadPreset: string;
    folder: string;
    publicId: string;
    tags: string[];
    context: Record<string, string>;
    apiKey?: string;
    timestamp?: number;
    signature?: string;
  };

  const data = new FormData();
  data.set('file', input.file);
  data.set('upload_preset', params.uploadPreset);
  data.set('folder', params.folder);
  data.set('public_id', params.publicId);
  data.set('tags', params.tags.join(','));
  data.set(
    'context',
    Object.entries(params.context)
      .map(([key, value]) => `${key}=${value}`)
      .join('|')
  );
  if (params.apiKey && params.timestamp && params.signature) {
    data.set('api_key', params.apiKey);
    data.set('timestamp', String(params.timestamp));
    data.set('signature', params.signature);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`, {
    method: 'POST',
    body: data
  });

  if (!response.ok) {
    throw new Error('No se pudo subir la imagen.');
  }

  return cloudinaryUploadResponseSchema.parse(await response.json());
}
