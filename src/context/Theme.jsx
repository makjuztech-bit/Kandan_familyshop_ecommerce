import {createContext,useContext,useEffect,useState} from 'react'

const ThemeContext=createContext(null)
const KEY='kfs_theme'
const readTheme=()=>{try{return localStorage.getItem(KEY)==='dark'?'dark':'light'}catch{return'light'}}

export function ThemeProvider({children}){
 const [theme,setTheme]=useState(readTheme)
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem(KEY,theme)}catch{}},[theme])
 return <ThemeContext.Provider value={{theme,toggleTheme:()=>setTheme(t=>t==='light'?'dark':'light')}}>{children}</ThemeContext.Provider>
}

export function useTheme(){
 const theme=useContext(ThemeContext)
 if(!theme)throw new Error('useTheme must be used within ThemeProvider.')
 return theme
}
