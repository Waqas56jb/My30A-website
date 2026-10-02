import nodemailer from 'nodemailer'
import { pickPublicUrl } from './urls.js'

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: SMTP_SECURE === 'true',
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 4000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  })
}

// Resend (https://resend.com) sends from the my30ahost.com domain once RESEND_API_KEY is set
// (EMAIL_FROM e.g. "My30A Host <noreply@my30ahost.com>", replies go to EMAIL_REPLY_TO). Without
// it, the SMTP settings above are used, as before.
async function sendWithResend({ to, subject, text }) {
  const from = process.env.EMAIL_FROM || 'My30A Host <noreply@my30ahost.com>'
  const replyTo = process.env.EMAIL_REPLY_TO || 'my30ahost@gmail.com'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: String(to).split(/[,;]\s*/).map((e) => e.trim()).filter(Boolean),
      subject,
      text,
      reply_to: replyTo,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Resend ${res.status}: ${body.message || res.statusText}`)
  }
  return { sent: true, via: 'resend' }
}

export async function sendEmail({ to, subject, text }) {
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendWithResend({ to, subject, text })
    } catch (error) {
      console.log('Email skipped:', error.message)
      return { skipped: true, reason: error.message }
    }
  }

  const transport = getTransport()
  if (!transport) {
    console.log('Email skipped: no RESEND_API_KEY or SMTP configured', { to, subject })
    return { skipped: true }
  }

  try {
    // Gmail SMTP always sends from the signed-in Gmail address, so show the brand name and send
    // replies to the client's inbox; Resend (above) sends from my30ahost.com itself.
    const address = String(process.env.OFFICIAL_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER).replace(/^.*<([^>]+)>.*$/, '$1')
    await transport.sendMail({
      from: { name: 'My30A Host', address },
      replyTo: process.env.EMAIL_REPLY_TO || 'my30ahost@gmail.com',
      to,
      subject,
      text,
    })
    return { sent: true }
  } catch (error) {
    console.log('Email skipped:', error.message)
    return { skipped: true, reason: error.message }
  }
}

export function loginUrlForRoles(roles) {
  const list = roles || []
  if (list.includes('admin')) {
    return pickPublicUrl(process.env.ADMIN_APP_URL) || 'http://localhost:5174'
  }
  return pickPublicUrl(process.env.CLIENT_APP_URL, process.env.PUBLIC_APP_URL)
}

export function welcomeLoginText({ name, email, password, loginUrl }) {
  return [
    `Hi ${name || 'there'},`,
    '',
    'Your My30A Host login is ready.',
    '',
    `Sign in at: ${loginUrl}`,
    `Email: ${email}`,
    `Temporary password: ${password}`,
    '',
    'Please change your password after signing in.',
  ].join('\n')
}

export async function sendWelcomeLogin({ name, email, password, roles }) {
  return sendEmail({
    to: email,
    subject: 'Your My30A Host login',
    text: welcomeLoginText({
      name,
      email,
      password,
      loginUrl: loginUrlForRoles(roles),
    }),
  })
}
