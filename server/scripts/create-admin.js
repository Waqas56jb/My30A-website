import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name: 'Admin' },
})

let userId = data?.user?.id

if (error) {
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error(error.message)
    process.exit(1)
  }

  const existing = (usersData.users || []).find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  )

  if (!existing) {
    console.error(error.message)
    process.exit(1)
  }

  userId = existing.id
  const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { name: 'Admin' },
  })
  if (updateAuthError) {
    console.error(updateAuthError.message)
    process.exit(1)
  }
}

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .update({ name: 'Admin', email, roles: ['admin'] })
  .eq('id', userId)
  .select('id, email, roles')
  .single()

if (profileError) {
  console.error(profileError.message)
  process.exit(1)
}

console.log(`Admin ready: ${profile.email} roles=${profile.roles.join(',')} (${profile.id})`)
