import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import {StoreProvider} from './context/Store'
import App from './App'
import './index.css'
try{localStorage.removeItem('kfs_theme')}catch{}
createRoot(document.getElementById('root')).render(<BrowserRouter><StoreProvider><App/></StoreProvider></BrowserRouter>)
