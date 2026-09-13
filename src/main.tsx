import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom' // ← HashRouter pas BrowserRouter
import App from './App'
import './styles/main.scss'

const dark = localStorage.getItem('darkMode')

if (dark === 'true') {
  document.body.classList.add('dark-mode')
}

const container = document.getElementById('root')
if (!container) throw new Error('Élément #root introuvable.')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
