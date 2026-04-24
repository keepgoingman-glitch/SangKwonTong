import { useState, useEffect } from 'react'
import Connector from './Connector'
import MM from './MM'

// KT 로고 SVG
const KTLogo = ({ size = 32 }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 80 48" fill="none">
    <text x="0" y="40" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
  </svg>
)

// 네트워크 배경 도트 패턴
const NetworkBg = () => (
  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }} viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
    {[[60,120],[160,80],[280,140],[340,60],[80,250],[200,200],[320,280],[120,380],[260,340],[380,420],[50,500],[180,460],[300,520],[140,620],[260,580],[360,650]].map(([x,y],i) => (
      <g key={i}>
        <circle cx={x} cy={y} r="3" fill="#f59e0b" opacity="0.8"/>
        {i < 14 && <line x1={x} y1={y} x2={[60,160,280,340,80,200,320,120,260,380,50,180,300,140][i]} y2={[120,80,140,60,250,200,280,380,340,420,500,460,520,620][i]+80} stroke="#f59e0b" strokeWidth="0.8" opacity="0.4"/>}
      </g>
    ))}
  </svg>
)

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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg, #06111f 0%, #0a1f3d 40%, #0d1a35 70%, #06111f 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Noto Sans KR', sans-serif", color: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
      <NetworkBg />

      {/* 상단 KT 로고 */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', padding: '20px 24px 0', display: 'flex', alignItems: 'center' }}>
        <KTLogo size={36} />
      </div>

      {/* 메인 콘텐츠 */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px 40px', width: '100%', maxWidth: '420px' }}>

        {/* 앱 아이콘 */}
        <div style={{ marginBottom: '28px', position: 'relative' }}>
          <div style={{ width: '140px', height: '140px', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 0 60px rgba(245,158,11,0.4), 0 20px 40px rgba(0,0,0,0.6)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
            <img src="/icon-512.png" alt="상권통" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          {/* 발광 효과 */}
          <div style={{ position: 'absolute', inset: '-20px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)', zIndex: -1 }} />
        </div>

        {/* 타이틀 */}
        <h1 style={{ fontSize: '48px', fontWeight: '900', margin: '0 0 8px', letterSpacing: '-1px', background: 'linear-gradient(135deg, #ffffff 0%, #f59e0b 60%, #fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          상권통
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', margin: '0 0 48px', letterSpacing: '0.5px' }}>
          상권에서 고객과 KT가 소통하는 플랫폼
        </p>

        {/* 플랫폼 선택 카드 */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 관리자 */}
          <button onClick={() => goTo('connector')}
            style={{ width: '100%', background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)', border: '1.5px solid rgba(245,158,11,0.5)', borderRadius: '18px', padding: '20px 24px', cursor: 'pointer', textAlign: 'left', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '18px', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0, boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}>
              📊
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b', marginBottom: '4px' }}>관리자</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>영업기회 배분 · 직원 관리 · 성과 현황</div>
            </div>
            <div style={{ color: 'rgba(245,158,11,0.6)', fontSize: '20px' }}>›</div>
          </button>

          {/* 상권마스터 */}
          <button onClick={() => goTo('mm')}
            style={{ width: '100%', background: 'linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(74,222,128,0.04) 100%)', border: '1.5px solid rgba(74,222,128,0.45)', borderRadius: '18px', padding: '20px 24px', cursor: 'pointer', textAlign: 'left', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '18px', backdropFilter: 'blur(10px)' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: 'linear-gradient(135deg, #4ade80, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0, boxShadow: '0 4px 14px rgba(74,222,128,0.35)' }}>
              🏃
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#4ade80', marginBottom: '4px' }}>상권마스터</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>영업기회 확인 · 활동 결과 입력 · 성장 레벨</div>
            </div>
            <div style={{ color: 'rgba(74,222,128,0.6)', fontSize: '20px' }}>›</div>
          </button>
        </div>

        {/* 하단 KT 텍스트 */}
        <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KTLogo size={22} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>지역상권 연결 플랫폼</span>
        </div>
      </div>
    </div>
  )
}
