export default function EnvMissing({ missing }) {
  return (
    <div className="login-screen">
      <div className="card">
        <h1>Configuration needed</h1>
        <p className="sub">
          This build is missing environment variables. In Vercel open the project → Settings →
          Environment Variables, add these, then Redeploy.
        </p>
        <ul>
          {(missing || []).map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
