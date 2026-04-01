import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  return (
    <div className="mesh-bg" style={{minHeight:'100vh',display:'flex'}}>
      <Sidebar />
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        <Header />
        <main style={{flex:1,padding:'1.5rem',overflowY:'auto'}}>
          <Outlet />
          <footer style={{textAlign:'center',color:'#334155',fontSize:'0.75rem',marginTop:'3rem',paddingBottom:'1rem'}}>
            ⚡ נבנה ע"י י.הרשקו ⚡
          </footer>
        </main>
      </div>
    </div>
  )
}
