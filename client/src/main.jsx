import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import EnvMissing from './components/EnvMissing.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { missingEnv } from './lib/config.js'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {missingEnv.length ? <EnvMissing missing={missingEnv} /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
)
