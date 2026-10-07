import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import {StoreProvider} from './context/Store'
import {ThemeProvider} from './context/Theme'
import App from './App'
import './index.css'
createRoot(document.getElementById('root')).render(<ThemeProvider><BrowserRouter><StoreProvider><App/></StoreProvider></BrowserRouter></ThemeProvider>)
