import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { addCollection } from '@iconify/react'
import vscodeIcons from '@iconify-json/vscode-icons/icons.json'
import App from './App'

addCollection(vscodeIcons)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
