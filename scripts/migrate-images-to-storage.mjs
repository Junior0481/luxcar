import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');
const pageSize = 500;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de executar.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tables = [
  { name: 'vehicles', kind: 'vehicles' },
  { name: 'trade_in_vehicles', kind: 'trade-in' },
];

function buildPaths(companyId, kind, imageId) {
  const directory = `${companyId}/${kind}/${imageId}`;
  return [`${directory}.webp`, `${directory}_thumb.webp`];
}

async function uploadDataImage(dataUrl, companyId, kind) {
  const match = /^data:(image\/[a-z\d.+-]+);base64,([\s\S]+)$/i.exec(dataUrl);
  if (!match) throw new Error('A imagem em base64 não possui um formato de imagem válido.');

  const source = Buffer.from(match[2], 'base64');
  if (!source.length) throw new Error('A imagem em base64 está vazia.');
  const imageId = randomUUID();
  const paths = buildPaths(companyId, kind, imageId);
  const [largeImage, thumbnail] = await Promise.all([
    sharp(source).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    sharp(source).rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
  ]);

  const bucket = supabase.storage.from('vehicles');
  const uploads = await Promise.all([
    bucket.upload(paths[0], largeImage, { contentType: 'image/webp', cacheControl: '31536000', upsert: false }),
    bucket.upload(paths[1], thumbnail, { contentType: 'image/webp', cacheControl: '31536000', upsert: false }),
  ]);
  const uploadError = uploads.find((result) => result.error)?.error;
  if (uploadError) {
    await bucket.remove(paths);
    throw new Error(uploadError.message || 'Não foi possível enviar as imagens para o Storage.');
  }

  const { data } = bucket.getPublicUrl(paths[0]);
  return { publicUrl: data.publicUrl, paths };
}

async function migrateTable({ name, kind }) {
  let offset = 0;
  let migratedRecords = 0;
  let migratedImages = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from(name)
      .select('id, company_id, images')
      .not('images', 'is', null)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Falha ao consultar ${name}: ${error.message}`);
    if (!rows?.length) break;

    for (const row of rows) {
      const images = Array.isArray(row.images) ? row.images : [];
      const dataImages = images.filter((url) => typeof url === 'string' && url.startsWith('data:'));
      if (!dataImages.length) continue;

      if (!row.company_id) {
        console.error(`${name}/${row.id}: ignorado — registro sem company_id.`);
        continue;
      }
      if (dryRun) {
        console.log(`${name}/${row.id} (empresa ${row.company_id}): migraria ${dataImages.length} imagem(ns) para ${row.company_id}/${kind}/`);
        migratedRecords += 1;
        migratedImages += dataImages.length;
        continue;
      }

      const uploadedPaths = [];
      try {
        const converted = new Map();
        for (const dataUrl of dataImages) {
          const upload = await uploadDataImage(dataUrl, row.company_id, kind);
          uploadedPaths.push(...upload.paths);
          converted.set(dataUrl, upload.publicUrl);
        }
        const nextImages = images.map((url) => converted.get(url) || url);
        const { error: updateError } = await supabase
          .from(name)
          .update({ images: nextImages })
          .eq('id', row.id)
          .eq('company_id', row.company_id);
        if (updateError) throw new Error(updateError.message);
        console.log(`${name}/${row.id}: migradas ${dataImages.length} imagem(ns).`);
        migratedRecords += 1;
        migratedImages += dataImages.length;
      } catch (migrationError) {
        if (uploadedPaths.length) await supabase.storage.from('vehicles').remove(uploadedPaths);
        console.error(`${name}/${row.id}: ${migrationError.message}`);
        process.exitCode = 1;
      }
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`${name}: ${migratedRecords} registro(s), ${migratedImages} imagem(ns) ${dryRun ? 'encontrados para migrar' : 'migrados'}.`);
}

for (const table of tables) {
  await migrateTable(table);
}

if (dryRun) console.log('Dry run concluído; nenhuma alteração foi feita no banco ou no Storage.');
