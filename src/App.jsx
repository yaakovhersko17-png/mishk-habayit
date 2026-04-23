import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'

// Lazy load all pages so a crash in any one page doesn't break the whole app
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Wallets        = lazy(() => import('./pages/Wallets'))
const Transactions   = lazy(() => import('./pages/Transactions'))
const InvoiceScanner = lazy(() => import('./pages/InvoiceScanner'))
const InvoiceArchive = lazy(() => import('./pages/InvoiceArchive'))
const Categories     = lazy(() => import('./pages/Categories'))
const SmartInsights  = lazy(() => import('./pages/SmartInsights'))
const Reminders      = lazy(() => import('./pages/Reminders'))
const CalendarPage   = lazy(() => import('./pages/CalendarPage'))
const Notes          = lazy(() => import('./pages/Notes'))
const History        = lazy(() => import('./pages/History'))
const Reports        = lazy(() => import('./pages/Reports'))
const Settings       = lazy(() => import('./pages/Settings'))
const AdminPanel     = lazy(() => import('./pages/AdminPanel'))
const Trips          = lazy(() => import('./pages/Trips'))
const DinnerMeals    = lazy(() => import('./pages/DinnerMeals'))
const FinancePage    = lazy(() => import('./pages/FinancePage'))
const Goals          = lazy(() => import('./pages/Goals'))
const RecurringTransactions = lazy(() => import('./pages/RecurringTransactions'))
const Stores                = lazy(() => import('./pages/Stores'))

function Spinner() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{width:36,height:36,borderRadius:'50%',border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',animation:'spin 0.8s linear infinite'}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  return profile?.role === 'admin' ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter basename="/mishk-habayit/">
      <Suspense fallback={<Spinner />}>
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
            <Route path="trips"        element={<Trips />} />
            <Route path="reports"      element={<Reports />} />
            <Route path="settings"     element={<Settings />} />
            <Route path="dinners"      element={<DinnerMeals />} />
            <Route path="finance"      element={<FinancePage />} />
            <Route path="goals"        element={<Goals />} />
            <Route path="recurring"    element={<RecurringTransactions />} />
            <Route path="stores"       element={<Stores />} />
            <Route path="admin"        element={<AdminRoute><AdminPanel /></AdminRoute>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
