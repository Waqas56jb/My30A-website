import { supabase } from './supabase.js'

const BUCKET = 'grocery-uploads'

export async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw error
  if ((buckets || []).some((bucket) => bucket.name === BUCKET)) return

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: '8MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })
  if (createError && !String(createError.message).toLowerCase().includes('already')) {
    throw createError
  }
}

export async function uploadFile(buffer, filePath, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  return filePath
}

export async function getSignedUrl(filePath, expiresIn = 3600) {
  if (!filePath) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresIn)
  if (error) return null
  return data.signedUrl
}

export { BUCKET }
