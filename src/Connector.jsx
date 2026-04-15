import { useState, useRef, useCallback } from 'react'
import { db } from './supabase'

const KTLogo = () => (
  <svg width="36" height="22" viewBox="0 0 80 48" fill="none">
    <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
  </svg>
)

const riskStyle = r =>
  r >= 70 ? { bg: '#052e16', text: '#4ade80', border: '#14532d', label: '양호' }
  : r >= 40 ? { bg: '#2d1d00', text: '#fbbf24', border: '#451a03', label: '주의' }
  : { bg: '#1f0505', text: '#f87171', border: '#450a0a', label: '위험' }

const C = { bg: '#06111f', card: '#0d1f35', border: 'rgba(255,255,255,0.08)', acc: '#f59e0b', text: '#f1f5f9', sub: '#8aa3bc' }

const IS = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#f1f5f9', padding: '14px 16px', borderRadius: '12px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

// ── 계정추가 모달 (자체 로컬 state → 커서점프 방지) ──────────────
function AddMMModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', region: '', goal: '10' })
  const [err, setErr] = useState('')

  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])

  const handleSave = async () => {
    setErr('')
    if (!form.name || !form.username || !form.password || !form.region) { setErr('모든 항목을 입력하세요'); return }
    try {
      await db.post('mm_users', { username: form.username, password: form.password, name: form.name, region: form.region, goal: parseInt(form.goal) || 10 })
      onSave(form.name)
    } catch { setErr('아이디 중복 또는 오류') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
        <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px' }}>신규 MM 계정 등록</h3>
        {err && <div style={{ color: '#f87171', fontSize: '14px', marginBottom: '12px', background: 'rgba(248,113,113,0.1)', padding: '10px', borderRadius: '8px' }}>{err}</div>}
        {[{ k: 'name', l: '이름', p: '홍길동' }, { k: 'username', l: '아이디', p: 'mm003' }, { k: 'password', l: '비밀번호', p: '초기 비밀번호' }, { k: 'region', l: '담당 지역', p: '예: 강남구' }, { k: 'goal', l: '목표(건)', p: '10', t: 'number' }].map(f => (
          <div key={f.k} style={{ marginBottom: '11px' }}>
            <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
            <input
              type={f.t || 'text'}
              placeholder={f.p}
              value={form[f.k]}
              onChange={e => set(f.k, e.target.value)}
              style={IS}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.sub, borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', borderRadius: '12px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>계정 생성</button>
        </div>
      </div>
    </div>
  )
}

// ── 계정수정 모달 (자체 로컬 state → 커서점프 방지) ──────────────
function EditMMModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ name: user.name, password: user.password, region: user.region })
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])

  const handleSave = async () => {
    try {
      await db.patch('mm_users', 'id=eq.' + user.id, { name: form.name, password: form.password, region: form.region })
      onSave()
    } catch { alert('수정 실패') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
        <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px' }}>계정 수정</h3>
        {[{ k: 'name', l: '이름' }, { k: 'password', l: '비밀번호' }, { k: 'region', l: '담당 지역' }].map(f => (
          <div key={f.k} style={{ marginBottom: '11px' }}>
            <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
            <input type="text" value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)} style={IS} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.sub, borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', borderRadius: '12px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        </div>
      </div>
    </div>
  )
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  })
  return { headers, rows }
}

function mapRow(headers, row) {
  const find = (...candidates) => {
    for (const c of candidates) {
      const k = headers.find(k => k.includes(c))
      if (k) return row[k] || ''
    }
    return ''
  }
  return {
    id: 'u' + Date.now() + Math.random().toString(36).slice(2, 6),
    address: find('주소', '위치', 'address', '대지'),
    area: find('면적', 'area', '㎡'),
    usage_type: find('용도', 'usage', '건축'),
    start_date: find('착공', '일자', 'date', '날짜'),
    products: [],
    assigned_to: '',
    assign_status: '미배분',
    activity_status: '미처리',
    activity_result: '',
    activity_memo: '',
    activity_contact: ''
  }
}

export default function Connector({ onBack }) {
  const [screen, setScreen] = useState('login')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState('')
  const [tab, setTab] = useState('overview')
  const [users, setUsers] = useState([]); const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false); const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [assignModal, setAssignModal] = useState(null); const [selMM, setSelMM] = useState('')
  const [filterSt, setFilterSt] = useState('전체')
  const [goalEdit, setGoalEdit] = useState({}); const [savedGoal, setSavedGoal] = useState(null)
  // CSV 업로드
  const [csvHeaders, setCsvHeaders] = useState([])
  const [uploadPreview, setUploadPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const t2 = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = async () => {
    setLoading(true)
    try {
      const [u, l] = await Promise.all([db.get('mm_users', 'order=created_at.asc'), db.get('connector_leads', 'order=created_at.desc')])
      setUsers(u); setLeads(l)
    } catch (e) { t2('로드 오류: ' + e.message) }
    setLoading(false)
  }

  const handleLogin = () => {
    if (lid === 'admin' && lpw === 'admin1234') { setScreen('main'); load() }
    else setLerr('아이디 또는 비밀번호가 올바르지 않습니다')
  }

  const handleDelete = async id => {
    try { await db.del('mm_users', 'id=eq.' + id); t2('삭제 완료'); load() } catch { t2('삭제 실패') }
  }

  // 기회 배분 (신규 + 재배분 모두)
  const handleAssign = async (leadId, mmName) => {
    try {
      await db.patch('connector_leads', 'id=eq.' + leadId, { assigned_to: mmName, assign_status: '배분완료' })
      setAssignModal(null); setSelMM(''); t2(mmName + ' MM에게 배분!'); load()
    } catch { t2('배분 실패') }
  }

  const bulkAssign = async () => {
    const un = leads.filter(l => l.assign_status === '미배분')
    if (!un.length || !users.length) return
    try {
      for (let i = 0; i < un.length; i++) await db.patch('connector_leads', 'id=eq.' + un[i].id, { assigned_to: users[i % users.length].name, assign_status: '배분완료' })
      t2('자동 배분 완료!'); load()
    } catch { t2('배분 오류') }
  }

  const saveGoal = async uid => {
    const val = parseInt(goalEdit[uid]); if (!val || val < 1) return
    try { await db.patch('mm_users', 'id=eq.' + uid, { goal: val }); setSavedGoal(uid); setTimeout(() => setSavedGoal(null), 2000); t2('목표 저장!'); load() }
    catch { t2('저장 실패') }
  }

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const { headers, rows } = parseCSV(ev.target.result)
      setCsvHeaders(headers)
      const mapped = rows.map(r => mapRow(headers, r)).filter(r => r.address)
      setUploadPreview(mapped)
      if (!mapped.length) t2('주소 컬럼을 찾을 수 없습니다')
    }
    reader.readAsText(file, 'UTF-8'); e.target.value = ''
  }

  const handleUpload = async () => {
    if (!uploadPreview.length) return
    setUploading(true)
    try {
      for (const row of uploadPreview) await db.post('connector_leads', row)
      t2(uploadPreview.length + '건 업로드 완료!'); setUploadPreview([]); setCsvHeaders([]); load(); setTab('leads')
    } catch (e) { t2('업로드 오류: ' + e.message) }
    setUploading(false)
  }

  const dl = (name, rows) => {
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }))
    a.download = name + '_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click()
  }
  const downloadPerf = () => dl('상권통_성과현황', [['이름', '아이디', '지역', '성공', '목표', '달성률']].concat(users.map(u => [u.name, u.username, u.region, u.success, u.goal, Math.round(u.success / u.goal * 100) + '%'])))
  const downloadActivity = () => dl('상권통_활동결과', [['주소', '면적', '용도', '착공일', '배분MM', '배분상태', '활동상태', '결과요약', '메모', '연락처']].concat(leads.map(l => [l.address, l.area, l.usage_type, l.start_date, l.assigned_to, l.assign_status, l.activity_status || '미처리', l.activity_result || '', l.activity_memo || '', l.activity_contact || ''])))

  const navTabs = [
    { id: 'overview', label: '팀 현황', icon: '📊' },
    { id: 'staff', label: '직원 관리', icon: '👥' },
    { id: 'upload', label: '업로드', icon: '📤' },
    { id: 'leads', label: '기회 배분', icon: '📋' },
    { id: 'download', label: '다운로드', icon: '📥' },
  ]

  const totalSuccess = users.reduce((a, u) => a + (u.success || 0), 0)
  const totalGoal = users.reduce((a, u) => a + (u.goal || 0), 0)
  const unassigned = leads.filter(l => l.assign_status === '미배분').length
  const filtered = filterSt === '전체' ? leads : leads.filter(l => l.assign_status === filterSt)

  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg,#06111f 0%,#0a1f3d 40%,#0d1a35 70%,#06111f 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 28px', fontFamily: "'Noto Sans KR',sans-serif", color: C.text }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '15px', cursor: 'pointer', marginBottom: '32px' }}>‹ 홈으로</button>
      <KTLogo />
      <div style={{ textAlign: 'center', margin: '20px 0 36px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px', background: 'linear-gradient(135deg,#fff,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>관리자</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', margin: 0 }}>상권통 관리자 전용 플랫폼</p>
      </div>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input type="text" placeholder="아이디" value={lid} onChange={e => { setLid(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...IS, padding: '16px', fontSize: '18px' }} />
        <input type="password" placeholder="비밀번호" value={lpw} onChange={e => { setLpw(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...IS, padding: '16px', fontSize: '18px' }} />
        {lerr && <div style={{ color: '#f87171', fontSize: '14px', textAlign: 'center', background: 'rgba(248,113,113,0.1)', padding: '10px', borderRadius: '8px' }}>{lerr}</div>}
        <button onClick={handleLogin} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', padding: '18px', borderRadius: '14px', fontSize: '18px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit', marginTop: '6px' }}>로그인</button>
      </div>
    </div>
  )

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Noto Sans KR',sans-serif", fontSize: '18px' }}>불러오는 중...</div>

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg,#06111f,#0a1f3d,#06111f)', color: C.text, fontFamily: "'Noto Sans KR',sans-serif", maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#052e16', border: '1px solid #4ade80', color: '#4ade80', padding: '12px 24px', borderRadius: '50px', fontSize: '15px', fontWeight: '700', zIndex: 9999, whiteSpace: 'nowrap' }}>✅ {toast}</div>}

      {showAdd && <AddMMModal onClose={() => setShowAdd(false)} onSave={name => { setShowAdd(false); t2(name + ' MM 계정 생성!'); load() }} />}
      {editUser && <EditMMModal user={editUser} onClose={() => setEditUser(null)} onSave={() => { setEditUser(null); t2('수정 완료!'); load() }} />}

      {/* 배분 모달 */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', position: 'relative' }}>
            <button onClick={() => { setAssignModal(null); setSelMM('') }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '4px' }}>
              {assignModal.assign_status === '배분완료' ? '⚡ 재배분' : 'MM 배분'}
            </h3>
            <p style={{ color: C.sub, fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>{assignModal.address}</p>
            {assignModal.assign_status === '배분완료' && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: C.acc }}>
                현재 배분: {assignModal.assigned_to} MM → 다른 MM으로 변경 가능
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {users.map(u => (
                <button key={u.id} onClick={() => setSelMM(u.name)}
                  style={{ padding: '14px 16px', background: selMM === u.name ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.05)', border: selMM === u.name ? '1.5px solid ' + C.acc : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: C.text, fontSize: '16px', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{u.name} · {u.region}</span>
                  <span style={{ color: C.sub, fontSize: '13px' }}>성공 {u.success}건</span>
                </button>
              ))}
            </div>
            <button onClick={() => handleAssign(assignModal.id, selMM)} disabled={!selMM}
              style={{ width: '100%', padding: '15px', background: selMM ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.07)', border: 'none', color: selMM ? '#0a0f1e' : '#475569', borderRadius: '12px', fontSize: '17px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
              {assignModal.assign_status === '배분완료' ? '재배분하기' : '배분하기'}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ background: 'rgba(6,17,31,0.9)', padding: '16px 20px 14px', borderBottom: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KTLogo />
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: C.acc, lineHeight: 1 }}>관리자</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>상권통 관리자 플랫폼</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={load} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>🔄</button>
            <button onClick={() => setScreen('login')} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[{ l: '등록 MM', v: users.length, u: '명', hi: false }, { l: '미배분', v: unassigned, u: '건', hi: unassigned > 0 }, { l: '팀 성공', v: totalSuccess, u: '건', hi: false }].map((s, i) => (
            <div key={i} style={{ flex: 1, background: s.hi ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.07)', border: '1px solid ' + (s.hi ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)'), borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: s.hi ? '#f87171' : C.acc }}>{s.v}<span style={{ fontSize: '12px' }}>{s.u}</span></div>
              <div style={{ fontSize: '11px', color: C.sub, marginTop: '2px' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* 팀 현황 */}
        {tab === 'overview' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '14px', color: C.acc }}>팀 현황</h2>
            {totalGoal > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700' }}>팀 전체 달성률</span>
                  <span style={{ fontSize: '17px', fontWeight: '900', color: C.acc }}>{Math.round(totalSuccess / totalGoal * 100)}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                  <div style={{ width: Math.min(totalSuccess / totalGoal * 100, 100) + '%', background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', height: '100%', borderRadius: '6px' }} />
                </div>
              </div>
            )}
            {users.map(u => {
              const rate = u.goal > 0 ? Math.round(u.success / u.goal * 100) : 0
              const rs = riskStyle(rate)
              return (
                <div key={u.id} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: '800' }}>{u.name} MM</div>
                      <div style={{ color: C.sub, fontSize: '13px', marginTop: '2px' }}>{u.region} · ID: {u.username}</div>
                    </div>
                    <span style={{ background: rs.bg, color: rs.text, border: '1px solid ' + rs.border, fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px' }}>{rs.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    {[{ l: '성공', v: u.success, c: '#4ade80' }, { l: '목표', v: u.goal, c: C.text }, { l: '달성률', v: rate + '%', c: C.acc }].map((s, i) => (
                      <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: '11px', color: C.sub, marginTop: '2px' }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ width: Math.min(rate, 100) + '%', background: rate >= 70 ? '#4ade80' : C.acc, height: '100%', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" placeholder="목표 수정" value={goalEdit[u.id] || ''} onChange={e => setGoalEdit({ ...goalEdit, [u.id]: e.target.value })}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.text, padding: '10px 12px', borderRadius: '8px', fontSize: '15px', outline: 'none', fontFamily: 'inherit' }} />
                    <button onClick={() => saveGoal(u.id)}
                      style={{ background: savedGoal === u.id ? '#4ade80' : C.acc, border: 'none', color: '#0a0f1e', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {savedGoal === u.id ? '✅ 저장' : '목표 저장'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 직원 관리 */}
        {tab === 'staff' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.acc }}>직원 관리</h2>
              <button onClick={() => setShowAdd(true)}
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', padding: '10px 16px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가</button>
            </div>
            {users.map(u => (
              <div key={u.id} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: '800' }}>{u.name} MM</div>
                    <div style={{ color: C.sub, fontSize: '13px', marginTop: '2px' }}>{u.region}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setEditUser(u)} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', padding: '7px 14px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', padding: '7px 14px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[{ l: '아이디', v: u.username, c: C.acc }, { l: '비밀번호', v: u.password, c: C.sub }, { l: '목표', v: u.goal + '건', c: '#4ade80' }].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 12px' }}>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>{s.l}</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 자료 업로드 */}
        {tab === 'upload' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '6px', color: C.acc }}>자료 업로드</h2>
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '18px' }}>CSV 파일을 업로드하면 영업기회로 자동 등록됩니다</p>
            <div onClick={() => fileRef.current.click()}
              style={{ background: 'rgba(245,158,11,0.05)', border: '2px dashed rgba(245,158,11,0.35)', borderRadius: '14px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '14px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>📂</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: C.acc, marginBottom: '4px' }}>CSV 파일 선택</div>
              <div style={{ color: C.sub, fontSize: '13px' }}>클릭하여 파일 선택 (.csv)</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
            </div>

            {/* CSV 파일에서 읽은 컬럼명 자동 표시 */}
            {csvHeaders.length > 0 && (
              <div style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: C.acc, marginBottom: '10px' }}>📋 인식된 컬럼 (상위 5개)</div>
                {csvHeaders.slice(0, 5).map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '7px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', minWidth: '24px', textAlign: 'center' }}>{i + 1}</span>
                    <span style={{ background: 'rgba(245,158,11,0.1)', color: C.acc, fontSize: '13px', fontWeight: '700', padding: '3px 12px', borderRadius: '6px' }}>{h}</span>
                  </div>
                ))}
                {csvHeaders.length > 5 && <div style={{ color: C.sub, fontSize: '12px', marginTop: '4px' }}>외 {csvHeaders.length - 5}개 컬럼...</div>}
              </div>
            )}

            {uploadPreview.length > 0 && (
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px', color: '#4ade80' }}>✅ {uploadPreview.length}건 인식됨</div>
                {uploadPreview.slice(0, 4).map((r, i) => (
                  <div key={i} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>{r.address || '(주소 없음)'}</div>
                    <div style={{ color: C.sub, fontSize: '12px', marginTop: '2px' }}>{r.area && r.area + '㎡ · '}{r.usage_type}{r.start_date && ' · ' + r.start_date}</div>
                  </div>
                ))}
                {uploadPreview.length > 4 && <div style={{ color: C.sub, fontSize: '13px', textAlign: 'center', marginBottom: '10px' }}>외 {uploadPreview.length - 4}건...</div>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button onClick={() => { setUploadPreview([]); setCsvHeaders([]) }} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                  <button onClick={handleUpload} disabled={uploading}
                    style={{ flex: 2, padding: '13px', background: uploading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: uploading ? '#475569' : '#0a0f1e', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {uploading ? '업로드 중...' : `${uploadPreview.length}건 업로드`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 기회 배분 */}
        {tab === 'leads' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.acc }}>기회 배분</h2>
              {unassigned > 0 && <button onClick={bulkAssign} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>자동배분({unassigned})</button>}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              {['전체', '미배분', '배분완료'].map(s => (
                <button key={s} onClick={() => setFilterSt(s)}
                  style={{ padding: '8px 16px', background: filterSt === s ? C.acc : 'rgba(255,255,255,0.06)', border: filterSt === s ? 'none' : '1px solid rgba(255,255,255,0.1)', color: filterSt === s ? '#0a0f1e' : C.sub, borderRadius: '20px', fontSize: '14px', fontWeight: filterSt === s ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
              ))}
            </div>
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '50px 20px', color: C.sub, fontSize: '16px' }}>영업기회가 없습니다</div>}
            {filtered.map(l => (
              <div key={l.id} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, marginRight: '10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '800', lineHeight: '1.4' }}>{l.address}</div>
                    <div style={{ color: C.sub, fontSize: '12px', marginTop: '3px' }}>{l.area && l.area + '㎡ · '}{l.usage_type}{l.start_date && ' · ' + l.start_date}</div>
                  </div>
                  <span style={{ background: l.assign_status === '미배분' ? '#2d1d00' : '#052e16', color: l.assign_status === '미배분' ? '#fbbf24' : '#4ade80', border: l.assign_status === '미배분' ? '1px solid #451a03' : '1px solid #14532d', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{l.assign_status}</span>
                </div>
                {l.assign_status === '배분완료' && (
                  <div style={{ color: '#4ade80', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
                    👤 {l.assigned_to} MM · <span style={{ color: C.sub }}>{l.activity_status || '미처리'}</span>
                  </div>
                )}
                {/* 배분/재배분 버튼 항상 표시 */}
                <button onClick={() => { setAssignModal(l); setSelMM(l.assigned_to || '') }}
                  style={{ width: '100%', background: 'transparent', border: '1px solid ' + (l.assign_status === '미배분' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)'), color: l.assign_status === '미배분' ? C.acc : C.sub, padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {l.assign_status === '배분완료' ? '⚡ 재배분하기' : 'MM 배분하기'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 다운로드 */}
        {tab === 'download' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '6px', color: C.acc }}>다운로드</h2>
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '22px' }}>데이터를 엑셀(CSV)로 내려받습니다</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>📊 MM 성과 현황</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px', lineHeight: '1.6' }}>이름 · 아이디 · 지역 · 성공건수 · 목표 · 달성률</p>
                <button onClick={downloadPerf} style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>📥 성과현황 다운로드 ({users.length}명)</button>
              </div>
              <div style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>📋 영업기회 활동결과</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px', lineHeight: '1.6' }}>주소 · 배분MM · 활동상태 · 결과요약 · 메모 · 연락처 포함</p>
                <button onClick={downloadActivity} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>📥 활동결과 다운로드 ({leads.length}건)</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: 'rgba(6,17,31,0.95)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', padding: '8px 0', backdropFilter: 'blur(10px)' }}>
        {navTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, background: 'none', border: 'none', color: tab === t.id ? C.acc : 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '6px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', fontFamily: 'inherit', minWidth: '54px' }}>
            <span style={{ fontSize: '18px' }}>{t.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: tab === t.id ? '800' : '500', whiteSpace: 'nowrap' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
