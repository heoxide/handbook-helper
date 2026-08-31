import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import { initWebHandbook } from './platform/init-web-handbook'
import { cacheRunningAppManifest } from './platform/web/app-update'
import './styles/global.css'

async function bootstrap() {
  await initWebHandbook()
  await cacheRunningAppManifest()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  )
}

void bootstrap()
