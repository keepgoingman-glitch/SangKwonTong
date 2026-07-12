import { useState, useEffect } from 'react'
import Connector from './Connector'
import React from 'react'
class ErrorBoundaryWrapper extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return <div style={{padding:'20px',background:'#fff',minHeight:'100vh',fontFamily:'monospace',color:'red'}}><h2>🚨 오류: {this.state.error?.message}</h2><pre style={{fontSize:'11px',whiteSpace:'pre-wrap',color:'#666'}}>{this.state.error?.stack?.slice(0,800)}</pre></div>
    return this.props.children
  }
}
import MM from './MM'
import QRPartners from './QRPartners'
import QRLanding from './QRLanding'
import AirconLanding from './AirconLanding'
import UturnGate from './UturnGate'

// 홈 아이콘(설치된 PWA)으로 빈 주소 진입 시, 저장해둔 매장 랜딩으로 보낸다.
// 일반 브라우저로 사이트를 직접 방문하는 경우(역할 선택)는 건드리지 않는다.
function resolveInitialPage() {
  const hash = window.location.hash.replace('#', '')
  if (hash) return hash   // 주소에 해시가 있으면 그대로 (QR 스캔 등)
  try {
    const params = new URLSearchParams(window.location.search)
    // ?c=CAMP-... : 캠페인 랜딩 (QR·홈아이콘 모두 이 쿼리를 지님)
    const campCode = params.get('c')
    if (campCode) {
      return 'qr-store-' + campCode
    }
    // ?s=매장코드 : 기존 QR 매장 랜딩 (홈아이콘 저장용)
    const storeCode = params.get('s')
    if (storeCode) {
      return 'qr-store-' + storeCode
    }
    // ?home=1 : 직원 강제진입 (혹시 남은 자동연결 플래그 제거)
    if (params.get('home') === '1') {
      try { localStorage.removeItem('sk_home_store') } catch (e) {}
      return 'home'
    }
    // ※ 자동복원(localStorage) 제거:
    //   루트 주소로 접속하면 항상 직원 로그인 화면을 띄운다.
    //   고객 랜딩은 QR(#/?c=) 또는 홈아이콘(?c=/?s= URL)로만 진입 → 직원/고객 확실히 분리.
  } catch (e) {}
  return 'home'
}

// 홈 저장 아이콘을 화면에 맞게 교체 (직원/고객 구분)
function setHomeIcon(href) {
  try {
    document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="icon"][data-dyn]').forEach(el => el.remove())
    const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = href; document.head.appendChild(a)
    const b = document.createElement('link'); b.rel = 'icon'; b.type = 'image/png'; b.href = href; b.setAttribute('data-dyn','1'); document.head.appendChild(b)
  } catch (e) {}
}

export default function App() {
  const [page, setPage] = useState(resolveInitialPage())
  useEffect(() => {
    const handler = () => setPage(window.location.hash.replace('#', '') || 'home')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  // 고객 랜딩이 아닌 화면(직원/관리자/메인)에서는 직원용 아이콘 사용
  useEffect(() => {
    if (!page.startsWith('qr-store-')) setHomeIcon('/icon-app.png')
  }, [page])
  const goTo = (p) => {
    // 직원이 역할(관리자/상권마스터/QR파트너스)로 진입 → 이 기기는 직원용
    // 고객 자동연결 플래그를 제거해 직원 홈저장이 고객 랜딩으로 새지 않게 함
    try { localStorage.removeItem('sk_home_store') } catch (e) {}
    window.location.hash = p; setPage(p)
  }
  const goHome = () => { window.location.hash = ''; setPage('home') }

  // U-TURN 대시보드 (전 직원 공용)
  if (page === 'uturn') return <ErrorBoundaryWrapper><UturnGate onBack={goHome} /></ErrorBoundaryWrapper>
  // 관리자 (딥링크 #connector#uturn → U-TURN 탭 자동 진입 지원)
  if (page === 'connector' || page.startsWith('connector#')) {
    const sub = page.includes('#') ? page.split('#')[1] : null
    return <ErrorBoundaryWrapper><Connector onBack={goHome} initialTab={sub} /></ErrorBoundaryWrapper>
  }
  // 상권통 (구 상권마스터) — QR은 이 안의 탭으로 편입 (딥링크 #mm#qr → QR 탭)
  if (page === 'mm' || page.startsWith('mm#')) {
    const sub = page.includes('#') ? page.split('#')[1] : null
    return <MM onBack={goHome} initialTab={sub} />
  }
  // 고객 QR 랜딩: #qr-store-XXX  (CAMP-으로 시작하면 테마 캠페인 랜딩)
  if (page.startsWith('qr-store-')) {
    const code = page.replace('qr-store-','')
    if (code.startsWith('CAMP-')) return <ErrorBoundaryWrapper><AirconLanding aptCode={code} onBack={goHome} /></ErrorBoundaryWrapper>
    return <ErrorBoundaryWrapper><QRLanding storeCode={code} onBack={goHome} /></ErrorBoundaryWrapper>
  }
  // 구 직원 QR 직접 접속 링크(#qr-partner-XXX)는 상권통으로 흡수
  if (page === 'qrpartners' || page.startsWith('qr-partner-')) return <MM onBack={goHome} initialTab="qr" />

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(165deg,#0a0e1a 0%,#0f1a30 45%,#1a0e18 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'Noto Sans KR',sans-serif", color: '#f1f5f9',
      padding: '0', overflowX: 'hidden', position: 'relative',
    }}>
      {/* 배경 장식 */}
      {[[10,15],[85,10],[6,58],[92,52],[16,86],[82,82]].map(([x,y],i)=>(
        <div key={i} style={{position:'absolute',left:x+'%',top:y+'%',width:'6px',height:'6px',borderRadius:'50%',background:'rgba(227,25,55,0.35)',boxShadow:'0 0 12px rgba(227,25,55,0.3)'}}/>
      ))}

      {/* 상단 KT 로고 */}
      <div style={{ position: 'absolute', top: '18px', left: '20px' }}>
        <svg width="34" height="21" viewBox="0 0 80 48" fill="none">
          <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
        </svg>
      </div>

      <div style={{ height: '40px' }} />

      {/* U-TURN 히어로 이미지 (슬로건 문구는 이미지에 포함되어 있음) */}
      <img src="/uturn-hero.png" alt="U-TURN" style={{ width: '100%', maxWidth: '360px', objectFit: 'contain', marginBottom: '28px' }} />

      {/* 3개 진입 카드 */}
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '13px', padding: '0 20px', boxSizing: 'border-box' }}>

        {/* U-TURN 대시보드 */}
        <button onClick={() => goTo('uturn')} style={{
          background: 'linear-gradient(135deg,rgba(227,25,55,0.18),rgba(15,26,48,0.9))', border: '1.5px solid rgba(227,25,55,0.6)',
          borderRadius: '18px', padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '16px', color: '#f1f5f9',
          boxShadow: '0 4px 24px rgba(227,25,55,0.15)', fontFamily: 'inherit',
        }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '14px', flexShrink: 0, background: 'linear-gradient(145deg,#E31937,#ff5a6e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(227,25,55,0.45)', fontSize: '28px', fontWeight: '900', color: '#fff', transform: 'scaleX(-1)' }}>⤴</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#ff5a6e', marginBottom: '4px' }}>U-TURN 대시보드</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.4 }}>UIT 기반 활동 및 성과관리</div>
          </div>
          <div style={{ color: 'rgba(255,90,110,0.7)', fontSize: '20px' }}>›</div>
        </button>

        {/* 상권통 (구 상권마스터) */}
        <button onClick={() => goTo('mm')} style={{
          background: 'rgba(5,20,12,0.85)', border: '1.5px solid rgba(74,222,128,0.4)',
          borderRadius: '18px', padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '16px', color: '#f1f5f9',
          boxShadow: '0 4px 24px rgba(74,222,128,0.08)', fontFamily: 'inherit',
        }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '14px', flexShrink: 0, background: 'linear-gradient(145deg,#16a34a,#4ade80)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,163,74,0.4)', fontSize: '26px' }}>🏃</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#4ade80', marginBottom: '4px' }}>상권통</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.4 }}>영업기회 · 활동 결과 입력 · QR 파트너스</div>
          </div>
          <div style={{ color: 'rgba(74,222,128,0.6)', fontSize: '20px' }}>›</div>
        </button>

        {/* 관리자 */}
        <button onClick={() => goTo('connector')} style={{
          background: 'rgba(13,25,50,0.85)', border: '1.5px solid rgba(245,158,11,0.5)',
          borderRadius: '18px', padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '16px', color: '#f1f5f9',
          boxShadow: '0 4px 24px rgba(245,158,11,0.1)', fontFamily: 'inherit',
        }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '14px', flexShrink: 0, background: 'linear-gradient(145deg,#e67e00,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(230,126,0,0.4)', fontSize: '26px' }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#f59e0b', marginBottom: '4px' }}>관리자</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.4 }}>영업기회 배분 · UIT 관리 · 성과 현황</div>
          </div>
          <div style={{ color: 'rgba(245,158,11,0.6)', fontSize: '20px' }}>›</div>
        </button>
      </div>

      {/* 하단 */}
      <div style={{ marginTop: 'auto', padding: '30px 0 22px', textAlign: 'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'7px' }}>
          <svg width="22" height="14" viewBox="0 0 80 48" fill="none"><text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text></svg>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12.5px' }}>U-TURN 플랫폼</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '10px', letterSpacing: '1px', marginTop: '4px' }}>TURN THE GAME. TURN THE CUSTOMER. TURN THE RESULT.</div>
      </div>
    </div>
  )
}
