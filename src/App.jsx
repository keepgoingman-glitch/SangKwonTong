import { useState } from 'react'
import Connector from './Connector'
import MM from './MM'

export default function App() {
  const [page, setPage] = useState('home')

  if (page === 'connector') return <Connector onBack={() => setPage('home')} />
  if (page === 'mm') return <MM onBack={() => setPage('home')} />

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a1628,#0f1f38)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 24px', fontFamily: "'Noto Sans KR',sans-serif", color: '#f1f5f9' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ background: '#f59e0b', color: '#0a1628', fontWeight: '900', fontSize: '14px', padding: '4px 16px', borderRadius: '4px', letterSpacing: '2px', display: 'inline-block', marginBottom: '16px' }}>상권통</div>
        <h1 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 10px' }}>소상공인 상권 플랫폼</h1>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>접속할 플랫폼을 선택하세요</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '320px' }}>
        <button onClick={() => setPage('connector')} style={{ background: 'linear-gradient(135deg,#1a2f4a,#0f1f38)', border: '2px solid #f59e0b', borderRadius: '16px', padding: '24px', cursor: 'pointer', textAlign: 'center', color: '#f1f5f9' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>📊</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b', marginBottom: '6px' }}>커낵터</div>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>관리자 전용 플랫폼</div>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>admin / admin1234</div>
        </button>
        <button onClick={() => setPage('mm')} style={{ background: 'linear-gradient(135deg,#091809,#0c1524)', border: '2px solid #4ade80', borderRadius: '16px', padding: '24px', cursor: 'pointer', textAlign: 'center', color: '#f1f5f9' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🏃</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#4ade80', marginBottom: '6px' }}>상권마스터</div>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>MM 전용 플랫폼</div>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>커낵터에서 발급된 계정 사용</div>
        </button>
      </div>
    </div>
  )
}
