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

// Public buckets: profile photos ('avatars') and host logos / property photos ('brand') — safe to
// show anywhere, no signed URLs needed.
const AVATAR_BUCKET = 'avatars'
const readyBuckets = new Set()
export async function uploadPublicImage(bucket, buffer, filePath, contentType) {
  if (!readyBuckets.has(bucket)) {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!(buckets || []).some((b) => b.name === bucket)) {
      const { error } = await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: '5MB',
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
      })
      if (error && !String(error.message).toLowerCase().includes('already')) throw error
    }
    readyBuckets.add(bucket)
  }
  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, { contentType, upsert: true })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
}

export function uploadAvatar(buffer, filePath, contentType) {
  return uploadPublicImage(AVATAR_BUCKET, buffer, filePath, contentType)
}
