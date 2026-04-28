import { createContext, useContext, useState, useCallback } from 'react'

const SuccessContext = createContext(null)

export function SuccessProvider({ children }) {
  const [state, setState] = useState({ visible: false, message: '' })

  const showSuccess = useCallback((message) => {
    setState({ visible: true, message })
    setTimeout(() => setState({ visible: false, message: '' }), 2650)
  }, [])

  return (
    <SuccessContext.Provider value={showSuccess}>
      {children}
      {state.visible && (
        <div className="tx-success-overlay">
          <div className="tx-success-circle">
            <div className="tx-success-ring" />
            <div className="tx-success-ring" />
            <div className="tx-success-ring" />
            {[[0,-52],[37,-37],[52,0],[37,37],[0,52],[-37,37],[-52,0],[-37,-37]].map(([px, py], i) => (
              <span key={i} className="tx-particle" style={{ '--px': `${px}px`, '--py': `${py}px` }} />
            ))}
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <polyline
                points="11,28 21,38 41,16"
                stroke="#4ade80"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 52,
                  strokeDashoffset: 52,
                  animation: 'tx-check-draw 0.45s 0.28s cubic-bezier(0.22,1,0.36,1) both',
                }}
              />
            </svg>
          </div>
          <div className="tx-success-label">{state.message}</div>
        </div>
      )}
    </SuccessContext.Provider>
  )
}

export const useSuccess = () => useContext(SuccessContext)
