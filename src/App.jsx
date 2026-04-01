import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Wallets from './pages/Wallets'
import Transactions from './pages/Transactions'
import InvoiceScanner from './pages/InvoiceScanner'
import InvoiceArchive from './pages/InvoiceArchive'
import Categories from './pages/Categories'
import SmartInsights from './pages/SmartInsights'
import Reminders from './pages/Reminders'
import CalendarPage from './pages/CalendarPage'
import Notes from './pages/Notes'
import History from './pages/History'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import AdminPanel from './pages/AdminPanel'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="mesh-bg min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div style={{width:48,height:48,borderRadius:'50%',border:'2px solid #8b5cf6',borderTopColor:'transparent',animation:'spin 0.8s linear infinite',margin:'0 auto 16px'}} />
        <p style={{color:'#94a3b8',fontSize:'0.875rem'}}>טוען...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="mesh-bg min-h-screen flex items-center justify-center">
      <div style={{width:48,height:48,borderRadius:'50%',border:'2px solid #8b5cf6',borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}} />
    </div>
  )
  return profile?.role === 'admin' ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="wallets"      element={<Wallets />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="scanner"      element={<InvoiceScanner />} />
          <Route path="invoices"     element={<InvoiceArchive />} />
          <Route path="categories"   element={<Categories />} />
          <Route path="insights"     element={<SmartInsights />} />
          <Route path="reminders"    element={<Reminders />} />
          <Route path="calendar"     element={<CalendarPage />} />
          <Route path="notes"        element={<Notes />} />
          <Route path="history"      element={<History />} />
          <Route path="reports"      element={<Reports />} />
          <Route path="settings"     element={<Settings />} />
          <Route path="admin"        element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
