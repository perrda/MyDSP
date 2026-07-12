import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const url = __BASE_PATH__ === '/' ? '/sw.js' : `${__BASE_PATH__}sw.js`
    void navigator.serviceWorker.register(url).catch(() => {
      /* ignore SW failures in dev */
    })
  })
}
