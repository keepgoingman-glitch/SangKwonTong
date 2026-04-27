import { useState, useEffect } from 'react'
import Connector from './Connector'
import MM from './MM'

export default function App() {
  const [page, setPage] = useState(window.location.hash.replace('#', '') || 'home')
  useEffect(() => {
    const handler = () => setPage(window.location.hash.replace('#', '') || 'home')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  const goTo = (p) => { window.location.hash = p; setPage(p) }
  const goHome = () => { window.location.hash = ''; setPage('home') }
  if (page === 'connector') return <Connector onBack={goHome} />
  if (page === 'mm') return <MM onBack={goHome} />
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#f8f9ff,#eef2ff)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'30px 24px', fontFamily:"'Noto Sans KR',sans-serif", color:'#1e293b' }}>
      <div style={{ textAlign:'center', marginBottom:'48px' }}>
        <div style={{ background:'#e67e00', color:'#fff', fontWeight:'900', fontSize:'14px', padding:'4px 16px', borderRadius:'4px', letterSpacing:'2px', display:'inline-block', marginBottom:'16px' }}>상권통</div>
        <h1 style={{ fontSize:'32px', fontWeight:'900', margin:'0 0 10px', color:'#1e293b' }}>소상공인 상권 플랫폼</h1>
        <p style={{ color:'#64748b', fontSize:'16px' }}>접속할 플랫폼을 선택하세요</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'16px', width:'100%', maxWidth:'320px' }}>
        <button onClick={() => goTo('connector')} style={{ background:'#fff', border:'2px solid #e67e00', borderRadius:'16px', padding:'24px', cursor:'pointer', textAlign:'center', color:'#1e293b', boxShadow:'0 4px 16px rgba(230,126,0,0.15)' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📊</div>
          <div style={{ fontSize:'20px', fontWeight:'900', color:'#e67e00', marginBottom:'6px' }}>관리자</div>
          <div style={{ color:'#64748b', fontSize:'14px' }}>관리자 전용 플랫폼</div>
        </button>
        <button onClick={() => goTo('mm')} style={{ background:'#fff', border:'2px solid #16a34a', borderRadius:'16px', padding:'24px', cursor:'pointer', textAlign:'center', color:'#1e293b', boxShadow:'0 4px 16px rgba(22,163,74,0.15)' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏃</div>
          <div style={{ fontSize:'20px', fontWeight:'900', color:'#16a34a', marginBottom:'6px' }}>상권마스터</div>
          <div style={{ color:'#64748b', fontSize:'14px' }}>MM 전용 플랫폼</div>
        </button>
      </div>
    </div>
  )
}
