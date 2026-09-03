import 'dotenv/config'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Fatal: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY is not set; Stripe capture/refund will be skipped')
}

if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
  console.warn(
    'Warning: SMTP is not fully configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD); emails will be skipped'
  )
}
