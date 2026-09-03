import app from './app.js'

const PORT = process.env.PORT || 4000

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })
}

export default app
