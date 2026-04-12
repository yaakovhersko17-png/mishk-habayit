import { createRoot } from 'react-dom/client'
import { Component } from 'react'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { Toaster } from 'react-hot-toast'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      return (
        <div style={{background:'#0f0f1a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:'monospace',direction:'ltr'}}>
          <div style={{background:'#1e1e3a',border:'1px solid #f87171',borderRadius:'12px',padding:'24px',maxWidth:'540px',width:'100%',color:'#e2e8f0'}}>
            <h2 style={{color:'#f87171',margin:'0 0 16px'}}>App failed to load</h2>
            <p style={{color:'#94a3b8',fontSize:'0.8rem',margin:'0 0 4px'}}>VITE_SUPABASE_URL: <span style={{color: url?'#4ade80':'#f87171'}}>{url ? '✅ set' : '❌ missing'}</span></p>
            <p style={{color:'#94a3b8',fontSize:'0.8rem',margin:'0 0 16px'}}>VITE_SUPABASE_ANON_KEY: <span style={{color: key?'#4ade80':'#f87171'}}>{key ? '✅ set' : '❌ missing'}</span></p>
            <pre style={{color:'#f87171',fontSize:'0.75rem',whiteSpace:'pre-wrap',wordBreak:'break-all',background:'#0f0f1a',padding:'12px',borderRadius:'8px',margin:0}}>{String(this.state.error)}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Register Service Worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/mishk-habayit/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ThemeProvider>
    <AuthProvider>
      <App />
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: {
            background: '#1e1e3a',
            color: '#e2e8f0',
            border: '1px solid rgba(108,99,255,0.3)',
            borderRadius: '12px',
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            direction: 'rtl',
          },
          success: { iconTheme: { primary: '#4ade80', secondary: '#1e1e3a' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#1e1e3a' } },
        }}
      />
    </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
)
