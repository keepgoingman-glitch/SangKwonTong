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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#06111f 0%,#0c1f3f 40%,#0a1830 70%,#06111f 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'Noto Sans KR',sans-serif", color: '#f1f5f9',
      padding: '0', overflowX: 'hidden', position: 'relative',
    }}>
      {/* 배경 장식 점들 */}
      {[[10,15],[85,8],[5,60],[92,55],[15,85],[80,80]].map(([x,y],i)=>(
        <div key={i} style={{position:'absolute',left:x+'%',top:y+'%',width:'6px',height:'6px',borderRadius:'50%',background:'rgba(245,158,11,0.4)',boxShadow:'0 0 12px rgba(245,158,11,0.3)'}}/>
      ))}

      {/* KT 로고 */}
      <div style={{ position: 'absolute', top: '18px', left: '20px' }}>
        <svg width="36" height="22" viewBox="0 0 80 48" fill="none">
          <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
        </svg>
      </div>

      {/* 상단 여백 */}
      <div style={{ height: '64px' }} />

      {/* 앱 아이콘 - 실제 이미지 */}
      <img
        src="/icon-app.png"
        alt="상권통"
        style={{
          width: '200px', height: '200px', borderRadius: '36px',
          objectFit: 'cover',
          boxShadow: '0 0 60px rgba(245,158,11,0.25), 0 20px 60px rgba(0,0,0,0.5)',
          marginBottom: '24px',
        }}
      />

      {/* 타이틀 */}
      <h1 style={{
        fontSize: '44px', fontWeight: '900', margin: '0 0 10px',
        background: 'linear-gradient(135deg,#ffffff 30%,#f59e0b 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        letterSpacing: '-1px',
      }}>상권통</h1>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', margin: '0 0 40px', textAlign: 'center', lineHeight: 1.5 }}>
        상권에서 고객과 KT가 소통하는 플랫폼
      </p>

      {/* 플랫폼 선택 카드 */}
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 20px', boxSizing: 'border-box' }}>

        {/* 관리자 카드 */}
        <button onClick={() => goTo('connector')} style={{
          background: 'rgba(13,25,50,0.85)', border: '1.5px solid rgba(245,158,11,0.5)',
          borderRadius: '18px', padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '16px', color: '#f1f5f9',
          boxShadow: '0 4px 24px rgba(245,158,11,0.1)', backdropFilter: 'blur(4px)',
          transition: 'all 0.2s', fontFamily: 'inherit',
        }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: '14px', flexShrink: 0,
            background: 'linear-gradient(145deg,#e67e00,#f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(230,126,0,0.4)', fontSize: '26px',
          }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#f59e0b', marginBottom: '4px' }}>관리자</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.4 }}>
              영업기회 배분 · 직원 관리 · 성과 현황
            </div>
          </div>
          <div style={{ color: 'rgba(245,158,11,0.6)', fontSize: '20px' }}>›</div>
        </button>

        {/* 상권마스터 카드 */}
        <button onClick={() => goTo('mm')} style={{
          background: 'rgba(5,20,12,0.85)', border: '1.5px solid rgba(74,222,128,0.4)',
          borderRadius: '18px', padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '16px', color: '#f1f5f9',
          boxShadow: '0 4px 24px rgba(74,222,128,0.08)', backdropFilter: 'blur(4px)',
          transition: 'all 0.2s', fontFamily: 'inherit',
        }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: '14px', flexShrink: 0,
            background: 'linear-gradient(145deg,#16a34a,#4ade80)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(22,163,74,0.4)', fontSize: '26px',
          }}>🏃</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#4ade80', marginBottom: '4px' }}>상권마스터</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.4 }}>
              영업기회 확인 · 활동 결과 입력 · 성장 레벨
            </div>
          </div>
          <div style={{ color: 'rgba(74,222,128,0.6)', fontSize: '20px' }}>›</div>
        </button>
      </div>

      {/* 하단 */}
      <div style={{ marginTop: 'auto', padding: '32px 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="24" height="15" viewBox="0 0 80 48" fill="none">
          <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
        </svg>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>지역상권 연결 플랫폼</span>
      </div>
    </div>
  )
}
