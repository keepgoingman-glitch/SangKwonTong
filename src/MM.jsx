import { useState } from 'react'
import { db } from './supabase'

const KTLogo = () => (
  <svg width="36" height="22" viewBox="0 0 80 48" fill="none">
    <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
  </svg>
)

const PRODUCTS = ['인터넷', 'TV', '다량회선', '모바일', '일반전화']
const LEVELS = [
  { lv: 1, name: '새싹', min: 0, max: 4, color: '#4ade80', icon: '🌱' },
  { lv: 2, name: '성장', min: 5, max: 9, color: '#60a5fa', icon: '🌿' },
  { lv: 3, name: '활발', min: 10, max: 19, color: '#f59e0b', icon: '⭐' },
  { lv: 4, name: '전문가', min: 20, max: 34, color: '#f97316', icon: '🔥' },
  { lv: 5, name: '마스터', min: 35, max: 999, color: '#a78bfa', icon: '👑' },
]
const getLv = n => LEVELS.find(l => n >= l.min && n <= l.max) || LEVELS[0]

const S = { bg: '#06111f', card: '#0d1f35', border: 'rgba(255,255,255,0.08)', acc: '#4ade80', text: '#f1f5f9', sub: '#8aa3bc' }

function Badge({ s }) {
  const m = { '미처리': { bg: '#2d1d00', t: '#fbbf24', b: '#451a03' }, '접촉완료': { bg: '#1e3a5f', t: '#93c5fd', b: '#1e4976' }, '성공': { bg: '#052e16', t: '#4ade80', b: '#14532d' }, '실패': { bg: '#1f0505', t: '#f87171', b: '#450a0a' } }
  const c = m[s] || m['미처리']
  return <span style={{ background: c.bg, color: c.t, border: '1px solid ' + c.b, fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{s}</span>
}

export default function MM({ onBack }) {
  const [screen, setScreen] = useState('login')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState(''); const [lding, setLding] = useState(false)
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('home'); const [leadTab, setLeadTab] = useState('connector')
  const [cLeads, setCLeads] = useState([]); const [mLeads, setMLeads] = useState([])
  const [rm, setRm] = useState(null); const [rf, setRf] = useState({ status: '미처리', result: '', memo: '' })
  const [reg, setReg] = useState({ customer: '', address: '', products: [] }); const [regDone, setRegDone] = useState(false)
  const [toast, setToast] = useState('')

  const t2 = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleLogin = async () => {
    if (!lid || !lpw) { setLerr('아이디와 비밀번호를 입력하세요'); return }
    setLding(true); setLerr('')
    try {
      const users = await db.get('mm_users', 'username=eq.' + lid + '&password=eq.' + lpw)
      if (!users.length) { setLerr('아이디 또는 비밀번호가 올바르지 않습니다'); setLding(false); return }
      const u = users[0]
      const [cl, ml] = await Promise.all([
        db.get('connector_leads', 'assigned_to=eq.' + encodeURIComponent(u.name)),
        db.get('mm_direct_leads', 'mm_username=eq.' + u.username + '&order=created_at.desc')
      ])
      setCLeads(cl); setMLeads(ml); setUser(u); setScreen('main')
    } catch (e) { setLerr('연결 오류: ' + e.message) }
    setLding(false)
  }

  const saveResult = async () => {
    if (!rm) return
    const upd = { activity_status: rf.status, activity_result: rf.result, activity_memo: rf.memo }
    try {
      if (rm._src === 'c') {
        await db.patch('connector_leads', 'id=eq.' + rm.id, upd)
        const nc = cLeads.map(l => l.id === rm.id ? { ...l, ...upd } : l); setCLeads(nc)
        const sc = nc.filter(l => l.activity_status === '성공').length + mLeads.filter(l => l.activity_status === '성공').length
        await db.patch('mm_users', 'id=eq.' + user.id, { success: sc }); setUser({ ...user, success: sc })
      } else {
        await db.patch('mm_direct_leads', 'id=eq.' + rm.id, upd)
        const nm = mLeads.map(l => l.id === rm.id ? { ...l, ...upd } : l); setMLeads(nm)
        const sc = cLeads.filter(l => l.activity_status === '성공').length + nm.filter(l => l.activity_status === '성공').length
        await db.patch('mm_users', 'id=eq.' + user.id, { success: sc }); setUser({ ...user, success: sc })
      }
      setRm(null); t2('활동 결과 저장 완료!')
    } catch (e) { t2('저장 실패: ' + e.message) }
  }

  const handleReg = async () => {
    if (!reg.customer || !reg.products.length) return
    const newLead = { id: 'm' + Date.now(), mm_username: user.username, customer: reg.customer, address: reg.address, products: reg.products, activity_status: '미처리', activity_result: '', activity_memo: '' }
    try {
      await db.post('mm_direct_leads', newLead)
      setMLeads([newLead, ...mLeads]); setRegDone(true); t2('등록 완료!')
      setTimeout(() => { setRegDone(false); setReg({ customer: '', address: '', products: [] }); setTab('leads'); setLeadTab('my') }, 1800)
    } catch (e) { t2('등록 실패: ' + e.message) }
  }

  const toggleP = p => setReg({ ...reg, products: reg.products.includes(p) ? reg.products.filter(x => x !== p) : [...reg.products, p] })

  const sc = user?.success || 0; const goal = user?.goal || 10
  const lv = getLv(sc); const nextLv = LEVELS.find(l => l.lv === lv.lv + 1)
  const unproc = cLeads.filter(l => (l.activity_status || '미처리') === '미처리').length

  const navTabs = [
    { id: 'home', label: '홈', icon: '🏠' },
    { id: 'leads', label: '영업기회', icon: '📋' },
    { id: 'register', label: '직접등록', icon: '➕' },
    { id: 'growth', label: '내 성장', icon: '📈' },
  ]

  const InputStyle = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: S.text, padding: '15px 16px', borderRadius: '12px', fontSize: '17px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg,#06111f 0%,#0a1f3d 40%,#0d1a35 70%,#06111f 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 28px', fontFamily: "'Noto Sans KR',sans-serif", color: S.text }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '15px', cursor: 'pointer', marginBottom: '32px' }}>‹ 홈으로</button>
      <KTLogo />
      <div style={{ textAlign: 'center', margin: '20px 0 36px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px', background: 'linear-gradient(135deg,#fff,#4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>상권마스터</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', margin: 0 }}>MM 전용 플랫폼</p>
      </div>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input type="text" placeholder="아이디" value={lid} onChange={e => { setLid(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={InputStyle} />
        <input type="password" placeholder="비밀번호" value={lpw} onChange={e => { setLpw(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={InputStyle} />
        {lerr && <div style={{ color: '#f87171', fontSize: '14px', textAlign: 'center', background: 'rgba(248,113,113,0.1)', padding: '10px', borderRadius: '8px' }}>{lerr}</div>}
        <button onClick={handleLogin} disabled={lding}
          style={{ background: lding ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#4ade80,#16a34a)', border: 'none', color: lding ? '#475569' : '#06111f', padding: '18px', borderRadius: '14px', fontSize: '18px', fontWeight: '900', cursor: lding ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: '6px', boxShadow: lding ? 'none' : '0 6px 20px rgba(74,222,128,0.3)' }}>
          {lding ? '로그인 중...' : '로그인'}
        </button>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '28px', textAlign: 'center' }}>계정이 없으신가요?<br />관리자에게 문의하세요</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg,#06111f,#0a1f3d,#06111f)', color: S.text, fontFamily: "'Noto Sans KR',sans-serif", maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#052e16,#065f46)', border: '1px solid #4ade80', color: '#4ade80', padding: '12px 24px', borderRadius: '50px', fontSize: '15px', fontWeight: '700', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(74,222,128,0.3)' }}>✅ {toast}</div>}

      {/* 결과 입력 모달 */}
      {rm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '420px', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', position: 'relative' }}>
            <button onClick={() => setRm(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '4px' }}>활동 결과 입력</h3>
            <p style={{ color: S.sub, fontSize: '13px', marginBottom: '18px', lineHeight: '1.5' }}>{rm._src === 'c' ? rm.address : rm.customer}</p>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: S.sub }}>방문 상태</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['미처리', '접촉완료', '성공', '실패'].map(s => (
                  <button key={s} onClick={() => setRf({ ...rf, status: s })}
                    style={{ padding: '10px 18px', background: rf.status === s ? (s === '성공' ? '#4ade80' : s === '실패' ? '#f87171' : S.acc) : 'rgba(255,255,255,0.06)', border: rf.status === s ? 'none' : '1px solid rgba(255,255,255,0.1)', color: rf.status === s ? '#06111f' : S.sub, borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '6px', color: S.sub }}>결과 요약</div>
              <input type="text" placeholder="예: 계약완료, 재방문 예정" value={rf.result} onChange={e => setRf({ ...rf, result: e.target.value })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: S.text, padding: '13px', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '6px', color: S.sub }}>메모</div>
              <textarea placeholder="특이사항, 다음 액션 등" value={rf.memo} onChange={e => setRf({ ...rf, memo: e.target.value })} rows={3}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: S.text, padding: '13px', borderRadius: '10px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }} />
            </div>
            <button onClick={saveResult}
              style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg,#4ade80,#16a34a)', border: 'none', color: '#06111f', borderRadius: '12px', fontSize: '17px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장하기</button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ background: 'rgba(6,17,31,0.9)', padding: '16px 20px 14px', borderBottom: '1px solid rgba(74,222,128,0.2)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KTLogo />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: S.acc, lineHeight: 1 }}>상권마스터</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{user?.name} MM · {user?.region}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '20px', padding: '5px 12px' }}>
              <span style={{ fontSize: '14px' }}>{lv.icon}</span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: lv.color }}>Lv.{lv.lv} {lv.name}</span>
            </div>
            <button onClick={() => { setScreen('login'); setUser(null) }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* 홈 */}
        {tab === 'home' && (
          <div>
            {/* 레벨 카드 */}
            <div style={{ background: `linear-gradient(135deg, rgba(${lv.lv === 1 ? '74,222,128' : lv.lv === 2 ? '96,165,250' : lv.lv === 3 ? '245,158,11' : lv.lv === 4 ? '249,115,22' : '167,139,250'},0.12) 0%, rgba(13,31,53,0.8) 100%)`, border: '1.5px solid ' + lv.color + '44', borderRadius: '18px', padding: '20px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '44px' }}>{lv.icon}</div>
                <div>
                  <div style={{ fontSize: '13px', color: S.sub }}>현재 레벨</div>
                  <div style={{ fontSize: '26px', fontWeight: '900', color: lv.color }}>Lv.{lv.lv} {lv.name}</div>
                </div>
              </div>
              {nextLv && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: S.sub }}>다음 레벨까지</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: lv.color }}>{nextLv.min - sc}건 남음</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: Math.min(((sc - lv.min) / Math.max(lv.max - lv.min, 1)) * 100, 100) + '%', background: lv.color, height: '100%', borderRadius: '4px' }} />
                  </div>
                </div>
              )}
            </div>

            {/* 통계 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              {[{ l: '관리자 배분', v: cLeads.length, c: '#60a5fa', icon: '📤' }, { l: '직접 발굴', v: mLeads.length, c: '#4ade80', icon: '🔍' }, { l: '전체 성공', v: sc, c: lv.color, icon: '🏆' }, { l: '이달 목표', v: goal, c: '#f59e0b', icon: '🎯' }].map((s, i) => (
                <div key={i} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '22px' }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: s.c, lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: '12px', color: S.sub, marginTop: '3px' }}>{s.l}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 미처리 알림 */}
            {unproc > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.35)', borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#f59e0b' }}>⚠️ 미처리 기회 {unproc}건</div>
                  <div style={{ color: S.sub, fontSize: '12px', marginTop: '3px' }}>확인이 필요한 배분 기회가 있습니다</div>
                </div>
                <button onClick={() => { setTab('leads'); setLeadTab('connector') }}
                  style={{ background: '#f59e0b', border: 'none', color: '#06111f', padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>확인 →</button>
              </div>
            )}
          </div>
        )}

        {/* 영업기회 */}
        {tab === 'leads' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '14px', color: S.acc }}>영업기회 관리</h2>
            <div style={{ display: 'flex', background: 'rgba(13,31,53,0.8)', borderRadius: '12px', padding: '4px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setLeadTab('connector')}
                style={{ flex: 1, padding: '10px', background: leadTab === 'connector' ? '#60a5fa' : 'transparent', color: leadTab === 'connector' ? '#06111f' : S.sub, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>
                📤 관리자 배분 ({cLeads.length})
              </button>
              <button onClick={() => setLeadTab('my')}
                style={{ flex: 1, padding: '10px', background: leadTab === 'my' ? S.acc : 'transparent', color: leadTab === 'my' ? '#06111f' : S.sub, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>
                🔍 직접발굴 ({mLeads.length})
              </button>
            </div>

            {leadTab === 'connector' && (cLeads.length === 0
              ? <div style={{ textAlign: 'center', padding: '50px 20px', color: S.sub, fontSize: '16px' }}>배분된 기회가 없습니다</div>
              : cLeads.map(l => (
                <div key={l.id} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid #60a5fa', borderRadius: '14px', padding: '14px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '700', marginBottom: '4px' }}>📤 관리자 배분</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', lineHeight: '1.4' }}>{l.address}</div>
                      <div style={{ color: S.sub, fontSize: '12px', marginTop: '3px' }}>{l.area && l.area + '㎡ · '}{l.usage_type}{l.start_date && ' · ' + l.start_date}</div>
                    </div>
                    <Badge s={l.activity_status || '미처리'} />
                  </div>
                  {l.products?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                      {l.products.map(p => <span key={p} style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px' }}>{p}</span>)}
                    </div>
                  )}
                  {l.activity_memo && <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontSize: '13px', color: S.sub }}>💬 {l.activity_memo}</div>}
                  <button onClick={() => { setRm({ ...l, _src: 'c' }); setRf({ status: l.activity_status || '미처리', result: l.activity_result || '', memo: l.activity_memo || '' }) }}
                    style={{ width: '100%', background: 'transparent', border: '1px solid rgba(96,165,250,0.35)', color: '#60a5fa', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>활동 결과 입력</button>
                </div>
              ))
            )}

            {leadTab === 'my' && (mLeads.length === 0
              ? <div style={{ textAlign: 'center', padding: '50px 20px', color: S.sub, fontSize: '16px' }}>직접 등록한 기회가 없습니다<br /><span style={{ fontSize: '14px', opacity: 0.6 }}>➕ 탭에서 등록하세요</span></div>
              : mLeads.map(l => (
                <div key={l.id} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid #4ade80', borderRadius: '14px', padding: '14px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ fontSize: '11px', color: S.acc, fontWeight: '700', marginBottom: '4px' }}>🔍 직접 발굴</div>
                      <div style={{ fontSize: '15px', fontWeight: '800' }}>{l.customer}</div>
                      <div style={{ color: S.sub, fontSize: '12px', marginTop: '2px' }}>{l.address}</div>
                    </div>
                    <Badge s={l.activity_status || '미처리'} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                    {l.products?.map(p => <span key={p} style={{ background: 'rgba(74,222,128,0.12)', color: S.acc, border: '1px solid rgba(74,222,128,0.25)', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px' }}>{p}</span>)}
                  </div>
                  {l.activity_memo && <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontSize: '13px', color: S.sub }}>💬 {l.activity_memo}</div>}
                  <button onClick={() => { setRm({ ...l, _src: 'm' }); setRf({ status: l.activity_status || '미처리', result: l.activity_result || '', memo: l.activity_memo || '' }) }}
                    style={{ width: '100%', background: 'transparent', border: '1px solid rgba(74,222,128,0.35)', color: S.acc, padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>활동 결과 입력</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* 직접 등록 */}
        {tab === 'register' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '18px', color: S.acc }}>직접 발굴 등록</h2>
            {regDone
              ? <div style={{ textAlign: 'center', padding: '50px 20px', background: 'rgba(5,46,22,0.3)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '18px' }}>
                  <div style={{ fontSize: '56px', marginBottom: '14px' }}>✅</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: S.acc }}>등록 완료!</div>
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '14px', color: S.sub, fontWeight: '700', display: 'block', marginBottom: '8px' }}>고객명 <span style={{ color: '#f87171' }}>*</span></label>
                    <input type="text" placeholder="예: 행복분식, 우리빌딩" value={reg.customer} onChange={e => setReg({ ...reg, customer: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: S.text, padding: '15px 16px', borderRadius: '12px', fontSize: '18px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: S.sub, fontWeight: '700', display: 'block', marginBottom: '8px' }}>주소</label>
                    <input type="text" placeholder="예: 강남구 역삼동 123" value={reg.address} onChange={e => setReg({ ...reg, address: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: S.text, padding: '15px 16px', borderRadius: '12px', fontSize: '18px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: S.sub, fontWeight: '700', display: 'block', marginBottom: '10px' }}>상품군 <span style={{ color: '#f87171' }}>*</span> <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(중복 선택 가능)</span></label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {PRODUCTS.map(p => {
                        const sel = reg.products.includes(p)
                        return (
                          <button key={p} onClick={() => toggleP(p)}
                            style={{ padding: '11px 16px', background: sel ? S.acc : 'rgba(255,255,255,0.06)', border: sel ? 'none' : '1px solid rgba(255,255,255,0.12)', color: sel ? '#06111f' : S.sub, borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {sel ? '✓ ' : ''}{p}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button onClick={handleReg} disabled={!reg.customer || !reg.products.length}
                    style={{ background: reg.customer && reg.products.length ? 'linear-gradient(135deg,#4ade80,#16a34a)' : 'rgba(255,255,255,0.08)', border: 'none', color: reg.customer && reg.products.length ? '#06111f' : '#475569', padding: '18px', borderRadius: '14px', fontSize: '18px', fontWeight: '900', cursor: 'pointer', marginTop: '6px', fontFamily: 'inherit' }}>
                    등록하기
                  </button>
                </div>
            }
          </div>
        )}

        {/* 내 성장 */}
        {tab === 'growth' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '16px', color: S.acc }}>내 성장 레벨</h2>
            {/* 계단식 시각화 */}
            <div style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', justifyContent: 'center' }}>
                {LEVELS.map((l, i) => {
                  const reached = sc >= l.min; const cur = lv.lv === l.lv; const h = 22 + i * 20
                  return (
                    <div key={l.lv} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ height: '20px', display: 'flex', alignItems: 'center' }}>
                        {cur && <span style={{ fontSize: '13px', color: l.color }}>▼</span>}
                      </div>
                      <div style={{ width: '46px', height: h + 'px', background: reached ? l.color : 'rgba(255,255,255,0.08)', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6px', border: cur ? '2px solid ' + l.color : 'none', boxShadow: cur ? '0 0 16px ' + l.color + '55' : 'none' }}>
                        <span style={{ fontSize: '16px' }}>{l.icon}</span>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: reached ? l.color : 'rgba(255,255,255,0.2)' }}>Lv.{l.lv}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {LEVELS.map(l => {
              const reached = sc >= l.min; const cur = lv.lv === l.lv
              return (
                <div key={l.lv} style={{ background: cur ? `rgba(${l.lv === 1 ? '74,222,128' : l.lv === 2 ? '96,165,250' : l.lv === 3 ? '245,158,11' : l.lv === 4 ? '249,115,22' : '167,139,250'},0.08)` : 'rgba(13,31,53,0.8)', border: cur ? '1.5px solid ' + l.color + '55' : '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '26px' }}>{l.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: reached ? l.color : 'rgba(255,255,255,0.3)' }}>Lv.{l.lv} {l.name}</span>
                      {cur && <span style={{ background: l.color, color: '#06111f', fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '10px' }}>현재</span>}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '2px' }}>
                      {l.lv < 5 ? '성공 ' + l.min + '~' + l.max + '건' : '성공 ' + l.min + '건 이상'}
                    </div>
                  </div>
                  {reached && <span style={{ fontSize: '18px' }}>✅</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 하단 탭 */}
      <div style={{ background: 'rgba(6,17,31,0.95)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', padding: '8px 0 8px', backdropFilter: 'blur(10px)' }}>
        {navTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, background: 'none', border: 'none', color: tab === t.id ? S.acc : 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', fontFamily: 'inherit' }}>
            <span style={{ fontSize: '20px' }}>{t.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: tab === t.id ? '800' : '500' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
