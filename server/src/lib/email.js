import nodemailer from 'nodemailer'

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

export async function sendEmail({ to, subject, text }) {
  const transport = getTransport()
  if (!transport) {
    console.log('Email skipped: SMTP not configured', { to, subject })
    return { skipped: true }
  }

  try {
    await transport.sendMail({
      from: process.env.OFFICIAL_EMAIL || process.env.SMTP_FROM,
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
    return process.env.ADMIN_APP_URL || 'http://localhost:5174'
  }
  return process.env.CLIENT_APP_URL || 'http://localhost:5173'
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
