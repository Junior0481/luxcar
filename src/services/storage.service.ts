import { supabase, SUPABASE_URL } from '../lib/supabase';

export type VehicleImageKind = 'vehicles' | 'trade-in';

const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;
const PUBLIC_BUCKET_PATH = '/storage/v1/object/public/vehicles/';

export function buildVehicleImagePaths(companyId: string, kind: VehicleImageKind, imageId: string) {
  if (!companyId.trim()) throw new Error('A imagem precisa estar associada a uma concessionária.');
  if (!imageId.trim()) throw new Error('Não foi possível gerar o identificador da imagem.');
  const imagePath = `${companyId}/${kind}/${imageId}.webp`;
  return { imagePath, thumbnailPath: `${companyId}/${kind}/${imageId}_thumb.webp` };
}

export async function compressImage(file: File, maxSize: number): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Arquivo inválido: selecione uma imagem PNG, JPG ou WEBP.');
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error('A imagem excede o limite de 15 MB. Escolha um arquivo menor.');
  }
  if (!Number.isFinite(maxSize) || maxSize < 1) {
    throw new Error('O tamanho máximo da imagem é inválido.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível abrir esta imagem. Escolha outro arquivo.');
  }

  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível comprimir a imagem em WebP.')),
        'image/webp',
        0.82,
      );
    });
  } finally {
    bitmap.close();
  }
}

function storageObjectPath(url: string): string | null {
  if (!url || url.startsWith('data:')) return null;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(SUPABASE_URL).origin) return null;
    const markerIndex = parsed.pathname.indexOf(PUBLIC_BUCKET_PATH);
    if (markerIndex < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + PUBLIC_BUCKET_PATH.length));
  } catch {
    return null;
  }
}

export function thumbUrl(url: string): string {
  const path = storageObjectPath(url);
  if (!path) return url;
  const filename = path.slice(path.lastIndexOf('/') + 1);
  if (!filename.toLowerCase().endsWith('.webp') || filename.toLowerCase().endsWith('_thumb.webp')) return url;
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\.webp$/i, '_thumb.webp');
  return parsed.toString();
}

export async function uploadVehicleImage(
  file: File,
  { companyId, kind }: { companyId: string; kind: VehicleImageKind },
): Promise<string> {
  const imageId = crypto.randomUUID();
  const { imagePath, thumbnailPath } = buildVehicleImagePaths(companyId, kind, imageId);
  const [largeImage, thumbnail] = await Promise.all([compressImage(file, 1600), compressImage(file, 480)]);
  const bucket = supabase.storage.from('vehicles');

  const { error: imageError } = await bucket.upload(imagePath, largeImage, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (imageError) throw new Error(imageError.message || 'Não foi possível enviar a foto do veículo.');

  const { error: thumbnailError } = await bucket.upload(thumbnailPath, thumbnail, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (thumbnailError) {
    await bucket.remove([imagePath]);
    throw new Error(thumbnailError.message || 'Não foi possível enviar a miniatura da foto.');
  }

  const { data } = bucket.getPublicUrl(imagePath);
  return data.publicUrl;
}

export async function deleteVehicleImage(url: string): Promise<void> {
  const imagePath = storageObjectPath(url);
  if (!imagePath) return;
  const filename = imagePath.slice(imagePath.lastIndexOf('/') + 1);
  const imageId = filename.replace(/\.webp$/i, '');
  if (!imageId || filename.toLowerCase().endsWith('_thumb.webp')) return;
  const directory = imagePath.slice(0, imagePath.lastIndexOf('/') + 1);
  const { error } = await supabase.storage.from('vehicles').remove([
    imagePath,
    `${directory}${imageId}_thumb.webp`,
  ]);
  if (error) throw new Error(error.message || 'Não foi possível remover as fotos do Storage.');
}
