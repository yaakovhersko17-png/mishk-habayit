import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')).render(
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
)
