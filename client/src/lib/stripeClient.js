import { loadStripe } from '@stripe/stripe-js'

const KEY = String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim()

// Loaded once and reused for every Elements instance in the app (Stripe's own recommendation).
export const stripePromise = KEY ? loadStripe(KEY) : null
export const stripeConfigured = Boolean(KEY)
