import { useState, useRef, useCallback, useEffect } from 'react'
import { db } from './supabase'

// ── 관리자 계정 → Supabase admin_accounts 테이블 ─────────────────

// ── 라이트 테마 색상 ──────────────────────────────────────────────
const C = {
  bg:      '#f4f6fb',
  card:    '#ffffff',
  border:  '#e2e8f0',
  acc:     '#e67e00',
  accBg:   '#fff7ed',
  accBorder:'#fed7aa',
  text:    '#1e293b',
  sub:     '#64748b',
  green:   '#16a34a',
  greenBg: '#f0fdf4',
  red:     '#dc2626',
  blue:    '#2563eb',
  blueBg:  '#eff6ff',
  header:  '#1e293b',
}

const IS = {
  width: '100%',
  background: '#f8fafc',
  border: '1.5px solid #e2e8f0',
  color: C.text,
  padding: '13px 15px',
  borderRadius: '10px',
  fontSize: '15px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const KTLogo = () => (
  <svg width="36" height="22" viewBox="0 0 80 48" fill="none">
    <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
  </svg>
)

const TEAMS = [
  { id: '', label: '팀 없음' },
  { id: 'team1', label: '1팀' },
  { id: 'team2', label: '2팀' },
  { id: 'team3', label: '3팀' },
  { id: 'team4', label: '4팀' },
]
const ST = ['성공', '접촉완료', '미처리', '실패']
const SC = {
  '성공':    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  '접촉완료':{ bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  '미처리':  { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  '실패':    { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
}
function pct(n, d) { return d > 0 ? Math.round(n / d * 100) : 0 }
function fmtAt(iso) {
  if (!iso) return ''
  try { const d = new Date(iso); return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
function Badge({ s }) {
  const c = SC[s] || SC['미처리']
  return <span style={{ background: c.bg, color: c.text, border: '1px solid ' + c.border, fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{s}</span>
}
function riskStyle(r) {
  if (r >= 70) return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: '양호' }
  if (r >= 40) return { bg: '#fffbeb', text: '#b45309', border: '#fde68a', label: '주의' }
  return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: '위험' }
}

// ── CSV 파싱 ──────────────────────────────────────────────────────
function parseCSV(text) {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
    const obj = {}; headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  })
  return { headers, rows }
}
function mapRow(headers, row, teamId) {
  const h = headers.slice(0, 5)
  const vals = h.map(k => row[k] || '')
  return {
    id: 'u' + Date.now() + Math.random().toString(36).slice(2, 6),
    col1: vals[0] || '', col2: vals[1] || '', col3: vals[2] || '',
    col4: vals[3] || '', col5: vals[4] || '',
    address: vals[1] || vals[0] || '',
    _headers: h,
    team_id: teamId || '',
    project_name: '',
    products: [], assigned_to: '', assign_status: '미배분',
    activity_status: '미처리', activity_result: '', activity_memo: '',
    activity_contact: '', photos: '[]', activity_at: ''
  }
}

// ── 이미지 압축 ───────────────────────────────────────────────────
async function compressImage(file, maxW = 600, quality = 0.55) {
  return new Promise(resolve => {
    const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale); const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}

// ── 도넛 차트 ─────────────────────────────────────────────────────
function DonutChart({ data, total, size = 110 }) {
  const sw = Math.round(size * 0.14); const r = (size - sw) / 2 - 2
  const cx = size / 2; const cy = size / 2; const circ = 2 * Math.PI * r
  let off = 0
  const slices = data.filter(d => d.value > 0).map(d => {
    const dash = (d.value / total) * circ
    const sl = { ...d, dash, gap: circ - dash, off }; off += dash; return sl
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
      {slices.map((s, i) => <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.off} />)}
    </svg>
  )
}

// ── 모달 공통 래퍼 ────────────────────────────────────────────────
function Modal({ onClose, title, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(3px)' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: '#f1f5f9', border: 'none', color: C.sub, width: '28px', height: '28px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        {title && <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '18px', color: C.text }}>{title}</h3>}
        {children}
      </div>
    </div>
  )
}

// ── MM 계정 모달들 ────────────────────────────────────────────────
function AddMMModal({ onClose, onSave, isSuper, defaultTeamId }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', region: '', goal: '10', team_id: defaultTeamId || '' })
  const [err, setErr] = useState('')
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])
  const handleSave = async () => {
    setErr('')
    if (!form.name || !form.username || !form.password || !form.region) { setErr('모든 항목을 입력하세요'); return }
    try { await db.post('mm_users', { username: form.username, password: form.password, name: form.name, region: form.region, goal: parseInt(form.goal) || 10, team_id: form.team_id }); onSave(form.name) }
    catch { setErr('아이디 중복 또는 오류') }
  }
  return (
    <Modal onClose={onClose} title="신규 MM 계정 등록">
      {err && <div style={{ color: C.red, fontSize: '14px', marginBottom: '12px', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px', borderRadius: '8px' }}>{err}</div>}
      {[{ k: 'name', l: '이름', p: '홍길동' }, { k: 'username', l: '아이디', p: 'mm010' }, { k: 'password', l: '비밀번호', p: '초기 비밀번호' }, { k: 'region', l: '담당 지역', p: '예: 강남구' }, { k: 'goal', l: '목표(건)', p: '10', t: 'number' }].map(f => (
        <div key={f.k} style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
          <input type={f.t || 'text'} placeholder={f.p} value={form[f.k]} onChange={e => set(f.k, e.target.value)} style={IS} />
        </div>
      ))}
      {isSuper && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>팀 배정</div>
          <select value={form.team_id} onChange={e => set('team_id', e.target.value)} style={{ ...IS, color: C.text }}>
            {TEAMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={onClose} style={{ flex: 1, padding: '13px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
        <button onClick={handleSave} style={{ flex: 2, padding: '13px', background: C.acc, border: 'none', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>계정 생성</button>
      </div>
    </Modal>
  )
}

function EditMMModal({ user, onClose, onSave, isSuper }) {
  const [form, setForm] = useState({ name: user.name, password: user.password, region: user.region, team_id: user.team_id || '' })
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])
  const handleSave = async () => {
    try { const patch = { name: form.name, password: form.password, region: form.region }; if (isSuper) patch.team_id = form.team_id; await db.patch('mm_users', 'id=eq.' + user.id, patch); onSave() }
    catch { alert('수정 실패') }
  }
  return (
    <Modal onClose={onClose} title={`계정 수정 — ${user.name}`}>
      {[{ k: 'name', l: '이름' }, { k: 'password', l: '비밀번호' }, { k: 'region', l: '담당 지역' }].map(f => (
        <div key={f.k} style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
          <input type="text" value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)} style={IS} />
        </div>
      ))}
      {isSuper && <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>팀 배정</div><select value={form.team_id} onChange={e => set('team_id', e.target.value)} style={{ ...IS, color: C.text }}>{TEAMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={onClose} style={{ flex: 1, padding: '13px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
        <button onClick={handleSave} style={{ flex: 2, padding: '13px', background: C.acc, border: 'none', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
      </div>
    </Modal>
  )
}

function EditTeamAdminModal({ teamId, teamData, onClose, onSave }) {
  const [form, setForm] = useState({ name: teamData.name, pw: teamData.pw })
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])
  return (
    <Modal onClose={onClose} title="팀관리자 계정 수정">
      <p style={{ color: C.sub, fontSize: '13px', marginBottom: '16px' }}>ID: {teamId} (변경불가) · 변경사항은 영구 저장됩니다</p>
      {[{ k: 'name', l: '표시 이름' }, { k: 'pw', l: '비밀번호' }].map(f => (
        <div key={f.k} style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
          <input type="text" value={form[f.k]} onChange={e => set(f.k, e.target.value)} style={IS} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={onClose} style={{ flex: 1, padding: '13px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
        <button onClick={() => onSave(teamId, form)} style={{ flex: 2, padding: '13px', background: C.acc, border: 'none', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장 (영구 반영)</button>
      </div>
    </Modal>
  )
}

// ── 다중선택 배분 모달 ────────────────────────────────────────────
function MultiAssignModal({ selectedIds, leads, users, onClose, onSave }) {
  const [selMM, setSelMM] = useState('')
  const selectedLeads = leads.filter(l => selectedIds.has(l.id))
  return (
    <Modal onClose={onClose} title={`MM 일괄 배분 (${selectedIds.size}건)`}>
      <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px' }}>선택한 {selectedIds.size}건을 한 명의 MM에게 배분합니다</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '240px', overflowY: 'auto' }}>
        {users.map(u => (
          <button key={u.id} onClick={() => setSelMM(u.name)}
            style={{ padding: '13px 16px', background: selMM === u.name ? C.accBg : '#f8fafc', border: selMM === u.name ? '2px solid ' + C.acc : '1.5px solid #e2e8f0', borderRadius: '10px', color: C.text, fontSize: '15px', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{u.name} · {u.region}</span>
            <span style={{ color: C.sub, fontSize: '12px' }}>성공 {u.success || 0}건</span>
          </button>
        ))}
      </div>
      <button onClick={() => selMM && onSave(selMM)} disabled={!selMM}
        style={{ width: '100%', padding: '14px', background: selMM ? C.acc : '#e2e8f0', border: 'none', color: selMM ? '#fff' : C.sub, borderRadius: '10px', fontSize: '16px', fontWeight: '900', cursor: selMM ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
        {selMM ? `${selMM} MM에게 배분` : 'MM을 선택하세요'}
      </button>
    </Modal>
  )
}

// ── 대시보드 섹션 ─────────────────────────────────────────────────
function DashboardSection({ leads, directLeads = [], users, period, selMM, isSuper, teamId }) {
  const now = new Date()
  function inPeriod(dateStr) {
    if (!dateStr) return false
    try {
      const d = new Date(dateStr)
      if (period === '일간') return d.toDateString() === now.toDateString()
      if (period === '주간') { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return d >= s && d <= e }
      if (period === '월간') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      if (period === '연간') return d.getFullYear() === now.getFullYear()
    } catch { return false }
    return false
  }
  const myUsers = isSuper ? users : users.filter(u => u.team_id === teamId)
  const myUserNames = myUsers.map(u => u.name)
  const myAssignedLeads = leads.filter(l => myUserNames.includes(l.assigned_to))
  // 직접발굴: 해당 팀 MM의 직접발굴 건 포함
  const myDirectLeads = directLeads.filter(l => myUsers.some(u => u.username === l.mm_username)).map(l => ({
    ...l, assigned_to: myUsers.find(u => u.username === l.mm_username)?.name || l.mm_username,
    start_date: l.created_at || '', assign_status: '직접발굴', _isDirect: true
  }))
  const myLeads = [...myAssignedLeads, ...myDirectLeads]
  const totalAssigned = myLeads.length || 1
  const filtered = myLeads.filter(l => { const inP = inPeriod(l.start_date); const matchMM = selMM === '전체' || l.assigned_to === selMM; return inP && matchMM })
  const actTotal = filtered.filter(l => l.activity_status && l.activity_status !== '미처리').length
  const counts = {}; ST.forEach(s => counts[s] = filtered.filter(l => l.activity_status === s).length)
  const periodTotal = filtered.length
  const annual = myLeads.filter(l => { try { return new Date(l.start_date || '').getFullYear() === now.getFullYear() } catch { return false } })
  const annualCounts = {}; ST.forEach(s => annualCounts[s] = annual.filter(l => l.activity_status === s).length)
  const mmStats = myUsers.map(u => { const rows = filtered.filter(l => l.assigned_to === u.name); return { mm: u.name, total: rows.length, ...Object.fromEntries(ST.map(s => [s, rows.filter(l => l.activity_status === s).length])) } }).filter(s => s.total > 0).sort((a, b) => b['성공'] - a['성공'])

  const card = (children, extra = {}) => <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', ...extra }}>{children}</div>

  return (
    <div>
      {card(<>
        <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>📦 전체 배분 대비 활동률 <span style={{ fontWeight: '400' }}>(배분 {totalAssigned}건)</span></div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
            <DonutChart size={110} total={totalAssigned} data={[{ value: actTotal, color: C.acc }, { value: Math.max(totalAssigned - actTotal, 0), color: '#e2e8f0' }]} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: C.acc }}>{pct(actTotal, totalAssigned)}%</div>
              <div style={{ fontSize: '11px', color: C.sub }}>활동률</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {[{ label: '활동 완료', value: actTotal, color: C.acc }, { label: '미활동', value: Math.max(totalAssigned - actTotal, 0), color: '#cbd5e1' }].map((r, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontSize: '13px', color: r.color === '#cbd5e1' ? C.sub : r.color, fontWeight: '700' }}>{r.label}</span><span style={{ fontSize: '13px', fontWeight: '900', color: r.color === '#cbd5e1' ? C.sub : r.color }}>{r.value}건 ({pct(r.value, totalAssigned)}%)</span></div>
                <div style={{ background: '#f1f5f9', borderRadius: '3px', height: '6px' }}><div style={{ width: pct(r.value, totalAssigned) + '%', background: r.color, height: '100%', borderRadius: '3px' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {card(<>
        <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>📊 {period} 활동 {periodTotal}건 상태 비율</div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
            <DonutChart size={110} total={Math.max(periodTotal, 1)} data={ST.map(s => ({ value: counts[s], color: SC[s].dot }))} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '900', color: C.green }}>{counts['성공']}</div>
              <div style={{ fontSize: '11px', color: C.sub }}>성공</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>{ST.map(s => (<div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: SC[s].dot }} /><span style={{ fontSize: '13px', color: C.text }}>{s}</span></div><span style={{ fontSize: '13px', fontWeight: '900', color: SC[s].dot }}>{counts[s]}건 ({pct(counts[s], Math.max(periodTotal, 1))}%)</span></div>))}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, background: C.greenBg, border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px', textAlign: 'center' }}><div style={{ fontSize: '11px', color: C.sub, marginBottom: '4px' }}>활동 대비 성공률</div><div style={{ fontSize: '20px', fontWeight: '900', color: C.green }}>{pct(counts['성공'], Math.max(actTotal, 1))}%</div></div>
          <div style={{ flex: 1, background: C.accBg, border: '1px solid ' + C.accBorder, borderRadius: '10px', padding: '10px', textAlign: 'center' }}><div style={{ fontSize: '11px', color: C.sub, marginBottom: '4px' }}>배분 대비 성공률</div><div style={{ fontSize: '20px', fontWeight: '900', color: C.acc }}>{pct(counts['성공'], totalAssigned)}%</div></div>
        </div>
      </>)}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {ST.map(s => (<div key={s} style={{ background: SC[s].bg, border: '1px solid ' + SC[s].border, borderRadius: '12px', padding: '14px', textAlign: 'center' }}><div style={{ fontSize: '26px', fontWeight: '900', color: SC[s].text }}>{counts[s]}</div><div style={{ fontSize: '12px', color: SC[s].text, marginTop: '3px' }}>{s}</div><div style={{ fontSize: '11px', color: SC[s].text, opacity: 0.7 }}>{pct(counts[s], Math.max(periodTotal, 1))}%</div></div>))}
      </div>

      {card(<>
        <div style={{ fontSize: '14px', fontWeight: '800', color: C.acc, marginBottom: '12px' }}>📅 {now.getFullYear()}년 연간 누적</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {[{ label: '전체 활동', v: annual.length, c: C.acc }, { label: '성공', v: annualCounts['성공'], c: C.green }, { label: '미처리', v: annualCounts['미처리'], c: '#f59e0b' }, { label: '실패', v: annualCounts['실패'], c: C.red }].map((s, i) => (<div key={i} style={{ flex: 1, background: '#f8fafc', borderRadius: '10px', padding: '10px 6px', textAlign: 'center', border: '1px solid #e2e8f0' }}><div style={{ fontSize: '18px', fontWeight: '900', color: s.c }}>{s.v}</div><div style={{ fontSize: '10px', color: C.sub, marginTop: '3px' }}>{s.label}</div></div>))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}><span style={{ fontSize: '13px', color: C.sub }}>연간 성공률</span><span style={{ fontSize: '16px', fontWeight: '900', color: C.green }}>{pct(annualCounts['성공'], Math.max(annual.length, 1))}%</span></div>
      </>)}

      {selMM === '전체' && mmStats.length > 0 && card(<>
        <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>👥 팀원별 현황</div>
        {mmStats.map((s, i) => (<div key={s.mm} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: i === 0 ? C.acc : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900', color: i === 0 ? '#fff' : C.sub, flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: '14px', fontWeight: '800', color: C.text, marginBottom: '4px' }}>{s.mm} MM <span style={{ fontSize: '12px', color: C.sub, fontWeight: '400' }}>({s.total}건)</span></div><div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>{ST.map(st => s[st] > 0 && <span key={st} style={{ fontSize: '11px', background: SC[st].bg, color: SC[st].text, border: '1px solid ' + SC[st].border, padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>{st} {s[st]}</span>)}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: '18px', fontWeight: '900', color: C.green }}>{s['성공']}</div><div style={{ fontSize: '10px', color: C.sub }}>성공</div></div>
        </div>))}
      </>)}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function Connector({ onBack }) {
  const [screen, setScreen] = useState('login')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState('')
  const [adminInfo, setAdminInfo] = useState(null)
  const [adminAccounts, setAdminAccounts] = useState([]) // DB에서 로드

  const [tab, setTab] = useState('dashboard')
  const [period, setPeriod] = useState('월간'); const [selMM, setSelMM] = useState('전체')
  const [users, setUsers] = useState([]); const [leads, setLeads] = useState([])
  const [directLeads, setDirectLeads] = useState([]); const [mDiscovery, setMDiscovery] = useState([])
  const [loading, setLoading] = useState(false); const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false); const [editUser, setEditUser] = useState(null)
  const [editTeam, setEditTeam] = useState(null)
  const [filterSt, setFilterSt] = useState('전체')
  const [filterProject, setFilterProject] = useState('전체')

  // ✅ 다중선택 상태 (배분용 + 삭제용 통합)
  const [selectMode, setSelectMode] = useState(null) // 'assign' | 'delete' | null
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showMultiAssign, setShowMultiAssign] = useState(false)

  const [goalEdit, setGoalEdit] = useState({}); const [savedGoal, setSavedGoal] = useState(null)
  const [csvHeaders, setCsvHeaders] = useState([]); const [uploadPreview, setUploadPreview] = useState([])
  const [projectName, setProjectName] = useState('')
  const [uploading, setUploading] = useState(false); const [dlLoading, setDlLoading] = useState(false)
  const [mForm, setMForm] = useState({ site_name: '', address: '', contact: '', capacity: '', note: '', status: '발굴중' })
  const [mEditId, setMEditId] = useState(null); const [mFilterSt, setMFilterSt] = useState('전체')
  const fileRef = useRef()
  const scrollRef = useRef()  // ✅ 스크롤 위치 유지용

  const isSuper = adminInfo?.role === 'super'
  const t2 = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // ✅ 스크롤 위치 저장/복원
  const saveScroll = () => scrollRef.current?.scrollTop || 0
  const restoreScroll = (pos) => { setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = pos }, 50) }

  const load = async (info, scrollPos) => {
    const ai = info || adminInfo
    setLoading(true)
    try {
      const uq = (ai?.role === 'team' && ai?.teamId) ? 'team_id=eq.' + ai.teamId + '&order=created_at.asc' : 'order=created_at.asc'
      const lq = (ai?.role === 'team' && ai?.teamId) ? 'team_id=eq.' + ai.teamId + '&order=created_at.desc' : 'order=created_at.desc'
      const mdq = (ai?.role === 'team' && ai?.teamId) ? 'team_id=eq.' + ai.teamId + '&order=created_at.desc' : 'order=created_at.desc'
      if (ai?.role === 'super') {
        db.get('admin_accounts', 'role=eq.team&order=username.asc').then(r => setAdminAccounts(r || [])).catch(()=>{})
      }
      const [u, l, dl, md] = await Promise.all([
        db.get('mm_users', uq),
        db.get('connector_leads', lq),
        db.get('mm_direct_leads', 'order=created_at.desc'),
        db.get('m_discovery', mdq).catch(() => [])
      ])
      setUsers(u); setLeads(l); setDirectLeads(dl); setMDiscovery(md)
      if (scrollPos !== undefined) restoreScroll(scrollPos)
    } catch (e) { t2('로드 오류: ' + e.message) }
    setLoading(false)
  }

  const handleLogin = async () => {
    setLerr('')
    try {
      const rows = await db.get('admin_accounts', 'username=eq.' + lid + '&password=eq.' + lpw)
      if (!rows || !rows.length) { setLerr('아이디 또는 비밀번호가 올바르지 않습니다'); return }
      const a = rows[0]
      const info = { role: a.role, name: a.name, teamId: a.team_id || null }
      setAdminInfo(info); setScreen('main'); load(info)
    } catch (e) { setLerr('연결 오류: ' + e.message) }
  }

  const handleSaveTeamAdmin = async (teamId, form) => {
    try {
      await db.patch('admin_accounts', 'username=eq.' + teamId, { name: form.name, password: form.pw })
      const rows = await db.get('admin_accounts', 'role=eq.team&order=username.asc')
      setAdminAccounts(rows)
      setEditTeam(null); t2('팀관리자 계정 수정 완료! (즉시 반영)')
    } catch (e) { t2('수정 실패: ' + e.message) }
  }
  const handleDelete = async id => { try { await db.del('mm_users', 'id=eq.' + id); t2('삭제 완료'); load() } catch { t2('삭제 실패') } }

  // ✅ 단건 배분 (스크롤 유지)
  const handleAssignOne = async (leadId, mmName) => {
    const pos = saveScroll()
    try { await db.patch('connector_leads', 'id=eq.' + leadId, { assigned_to: mmName, assign_status: '배분완료' }); t2(mmName + ' MM에게 배분!'); load(null, pos) }
    catch { t2('배분 실패') }
  }

  // ✅ 다중 배분 (스크롤 유지)
  const handleMultiAssign = async (mmName) => {
    if (!mmName || selectedIds.size === 0) return
    const pos = saveScroll()
    try {
      for (const id of selectedIds) await db.patch('connector_leads', 'id=eq.' + id, { assigned_to: mmName, assign_status: '배분완료' })
      t2(`${selectedIds.size}건을 ${mmName} MM에게 배분!`)
      setSelectedIds(new Set()); setSelectMode(null); setShowMultiAssign(false)
      load(null, pos)
    } catch { t2('배분 오류') }
  }

  // ✅ 일괄 삭제 (스크롤 유지)
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return
    const pos = saveScroll()
    try {
      for (const id of selectedIds) await db.del('connector_leads', 'id=eq.' + id)
      t2(selectedIds.size + '건 삭제 완료'); setSelectedIds(new Set()); setSelectMode(null)
      load(null, pos)
    } catch { t2('삭제 오류') }
  }

  const bulkAssign = async () => {
    const pos = saveScroll()
    const myUN = myUsers.map(u => u.name)
    const un = leads.filter(l => l.assign_status === '미배분')
    if (!un.length || !myUsers.length) return
    try { for (let i = 0; i < un.length; i++) await db.patch('connector_leads', 'id=eq.' + un[i].id, { assigned_to: myUsers[i % myUsers.length].name, assign_status: '배분완료' }); t2('자동 배분 완료!'); load(null, pos) }
    catch { t2('배분 오류') }
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
      setUploadPreview(rows.map(r => mapRow(headers, r, adminInfo?.teamId || '')))
      if (!rows.length) t2('데이터가 없습니다')
    }
    reader.readAsText(file, 'UTF-8'); e.target.value = ''
  }
  const handleUpload = async () => {
    if (!uploadPreview.length) return
    setUploading(true)
    try {
      for (const row of uploadPreview) { const { _headers, ...dbRow } = row; await db.post('connector_leads', { ...dbRow, project_name: projectName.trim() || '기본' }) }
      t2(uploadPreview.length + '건 업로드 완료!'); setUploadPreview([]); setCsvHeaders([]); setProjectName(''); load(); setTab('leads')
    } catch (e) { t2('업로드 오류: ' + e.message) }
    setUploading(false)
  }
  const downloadPerf = () => {
    const rows = [['이름','아이디','팀','지역','성공','목표','달성률']].concat(myUsers.map(u => [u.name,u.username,u.team_id||'-',u.region,u.success,u.goal,pct(u.success,u.goal)+'%']))
    const csv = rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv'})); a.download='상권통_성과현황_'+new Date().toISOString().slice(0,10)+'.csv'; a.click()
  }
  const downloadActivity = async () => {
    setDlLoading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip(); const photoFolder = zip.folder('사진'); const dateStr = new Date().toISOString().slice(0,10)
      const allItems = [...leads.map(l=>({...l,_type:'관리자배분',_name:l.address||'-'})),...directLeads.map(l=>({...l,_type:'직접발굴',_name:l.customer||'-'}))]
      const headers = ['번호','구분','고객명/주소','배분MM','활동상태','결과요약','메모','연락처','활동일시','사진파일명']
      const rows = [headers]
      allItems.forEach((l, idx) => {
        let photos = []; try { photos = JSON.parse(l.photos || '[]') } catch {}
        const photoNames = photos.map((b64, pi) => { const ext = b64.startsWith('data:image/png')?'png':'jpg'; const name=`${String(idx+1).padStart(3,'0')}_${pi+1}.${ext}`; photoFolder.file(name, b64.replace(/^data:image\/\w+;base64,/,''), {base64:true}); return name })
        rows.push([idx+1,l._type,l._name,l.assigned_to||l.mm_username||'-',l.activity_status||'미처리',l.activity_result||'',l.activity_memo||'',l.activity_contact||'',l.activity_at?new Date(l.activity_at).toLocaleString('ko-KR'):'',photoNames.join(' / ')||'없음'])
      })
      zip.file('활동결과_'+dateStr+'.csv', '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'))
      const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}})
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='상권통_활동결과_'+dateStr+'.zip'; a.click()
      t2('다운로드 완료!')
    } catch(e) { t2('다운로드 오류: '+e.message) }
    setDlLoading(false)
  }
  const saveMDiscovery = async () => {
    if (!mForm.site_name) { t2('영업사이트명을 입력하세요'); return }
    try {
      if (mEditId) { await db.patch('m_discovery', 'id=eq.'+mEditId, {...mForm, registered_by: adminInfo?.name, team_id: adminInfo?.teamId||''}); t2('수정 완료!') }
      else { await db.post('m_discovery', {id:'m'+Date.now(),...mForm, registered_by: adminInfo?.name, team_id: adminInfo?.teamId||''}); t2('등록 완료!') }
      setMForm({site_name:'',address:'',contact:'',capacity:'',note:'',status:'발굴중'}); setMEditId(null); load()
    } catch(e) { t2('저장 오류: '+e.message) }
  }

  // ✅ 체크박스 토글 (스크롤 유지)
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
    })
  }
  const toggleAll = () => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)))
  }

  const myUsers = isSuper ? users : users.filter(u => u.team_id === adminInfo?.teamId)
  const unassigned = leads.filter(l => l.assign_status === '미배분').length
  const allProjects = ['전체', ...Array.from(new Set(leads.map(l => l.project_name || '기본').filter(Boolean)))]
  const filtered = leads
    .filter(l => filterSt === '전체' || l.assign_status === filterSt)
    .filter(l => filterProject === '전체' || (l.project_name || '기본') === filterProject)
  const mFiltered = mFilterSt === '전체' ? mDiscovery : mDiscovery.filter(m => m.status === mFilterSt)

  const navTabs = [
    { id: 'dashboard', label: '활동현황', icon: '📊' },
    { id: 'activity',  label: '활동결과', icon: '📋' },
    { id: 'staff',     label: '직원관리', icon: '👥' },
    { id: 'upload',    label: '업로드',   icon: '📤' },
    { id: 'leads',     label: '기회배분', icon: '🎯' },
    { id: 'mdiscovery',label: 'M발굴',   icon: '🔍' },
    { id: 'download',  label: '다운로드', icon: '📥' },
  ]

  // ── 라이트 로그인 ────────────────────────────────────────────────
  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f8f9ff,#eef2ff)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 28px', fontFamily: "'Noto Sans KR',sans-serif", color: C.text }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: C.sub, fontSize: '15px', cursor: 'pointer', marginBottom: '32px' }}>‹ 홈으로</button>
      <KTLogo />
      <div style={{ textAlign: 'center', margin: '20px 0 36px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px', color: C.text }}>관리자</h1>
        <p style={{ color: C.sub, fontSize: '14px', margin: 0 }}>상권통 관리자 전용 플랫폼</p>
      </div>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input type="text" placeholder="아이디" value={lid} onChange={e => { setLid(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...IS, padding: '16px', fontSize: '17px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
        <input type="password" placeholder="비밀번호" value={lpw} onChange={e => { setLpw(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...IS, padding: '16px', fontSize: '17px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
        {lerr && <div style={{ color: C.red, fontSize: '14px', textAlign: 'center', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px', borderRadius: '8px' }}>{lerr}</div>}
        <button onClick={handleLogin} style={{ background: C.acc, border: 'none', color: '#fff', padding: '18px', borderRadius: '12px', fontSize: '18px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit', marginTop: '6px', boxShadow: '0 4px 14px rgba(230,126,0,0.3)' }}>로그인</button>
      </div>
    </div>
  )

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Noto Sans KR',sans-serif", fontSize: '18px' }}>불러오는 중...</div>

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Noto Sans KR',sans-serif", maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#f0fdf4', border: '1.5px solid #86efac', color: C.green, padding: '12px 24px', borderRadius: '50px', fontSize: '15px', fontWeight: '700', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>✅ {toast}</div>}

      {showAdd && <AddMMModal isSuper={isSuper} defaultTeamId={isSuper ? '' : adminInfo?.teamId} onClose={() => setShowAdd(false)} onSave={name => { setShowAdd(false); t2(name + ' MM 계정 생성!'); load() }} />}
      {editUser && <EditMMModal user={editUser} isSuper={isSuper} onClose={() => setEditUser(null)} onSave={() => { setEditUser(null); t2('수정 완료!'); load() }} />}
      {editTeam && adminAccounts.find(a=>a.username===editTeam) && <EditTeamAdminModal teamId={editTeam} teamData={{name: adminAccounts.find(a=>a.username===editTeam)?.name || '', pw: adminAccounts.find(a=>a.username===editTeam)?.password || ''}} onClose={() => setEditTeam(null)} onSave={handleSaveTeamAdmin} />}
      {showMultiAssign && <MultiAssignModal selectedIds={selectedIds} leads={leads} users={myUsers} onClose={() => setShowMultiAssign(false)} onSave={handleMultiAssign} />}

      {/* 헤더 */}
      {/* 헤더+탭 통합 고정 영역 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '10px 16px 8px', borderBottom: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KTLogo />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '17px', fontWeight: '900', color: C.text }}>관리자</span>
                <span style={{ background: isSuper ? C.accBg : C.blueBg, color: isSuper ? C.acc : C.blue, fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', border: '1px solid ' + (isSuper ? C.accBorder : '#bfdbfe') }}>
                  {isSuper ? '총괄' : adminInfo?.name}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: C.sub, marginTop: '2px' }}>상권통 관리자 플랫폼</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => load()} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>🔄</button>
            <button onClick={() => { setScreen('login'); setAdminInfo(null) }} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
          {[{ l: '등록 MM', v: myUsers.length, u: '명', hi: false }, { l: '미배분', v: unassigned, u: '건', hi: unassigned > 0 }, { l: '팀 성공', v: myUsers.reduce((a, u) => a + (u.success || 0), 0), u: '건', hi: false }].map((s, i) => (
            <div key={i} style={{ flex: 1, background: s.hi ? '#fef2f2' : '#f8fafc', border: '1px solid ' + (s.hi ? '#fecaca' : '#e2e8f0'), borderRadius: '8px', padding: '5px 6px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ fontSize: '15px', fontWeight: '900', color: s.hi ? C.red : C.acc }}>{s.v}{s.u}</span>
              <span style={{ fontSize: '11px', color: C.sub }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 상단 탭 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', overflowX: 'auto', padding: '0' }}>
        {navTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: '0 0 auto', background: 'none', border: 'none', borderBottom: tab === t.id ? '2.5px solid ' + C.acc : '2.5px solid transparent', color: tab === t.id ? C.acc : '#94a3b8', cursor: 'pointer', padding: '9px 14px 7px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            <span style={{ fontSize: '16px' }}>{t.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: tab === t.id ? '800' : '500', whiteSpace: 'nowrap' }}>{t.label}</span>
          </button>
        ))}
      </div>

      </div>{/* end sticky wrapper */}

      {/* 컨텐츠 영역 (스크롤 ref) */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

        {/* ── 활동현황 ────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {['일간','주간','월간','연간'].map(p => (<button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: '9px 0', background: period === p ? C.acc : '#fff', border: period === p ? 'none' : '1px solid #e2e8f0', color: period === p ? '#fff' : C.sub, borderRadius: '10px', fontSize: '14px', fontWeight: period === p ? '900' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>))}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['전체', ...myUsers.map(u => u.name)].map(mm => (<button key={mm} onClick={() => setSelMM(mm)} style={{ padding: '6px 13px', background: selMM === mm ? C.accBg : '#fff', border: '1px solid ' + (selMM === mm ? C.acc : '#e2e8f0'), color: selMM === mm ? C.acc : C.sub, borderRadius: '20px', fontSize: '13px', fontWeight: selMM === mm ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{mm}</button>))}
            </div>
            <DashboardSection leads={leads} directLeads={directLeads} users={users} period={period} selMM={selMM} isSuper={isSuper} teamId={adminInfo?.teamId} />
          </div>
        )}

        {/* ── 활동결과 실시간 ─────────────────────────────────────── */}
        {tab === 'activity' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.text }}>활동결과 실시간</h2>
              <button onClick={() => load()} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>🔄 새로고침</button>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto' }}>
              {['전체', ...ST].map(s => (<button key={s} onClick={() => setFilterSt(s)} style={{ padding: '6px 13px', background: filterSt === s ? C.acc : '#fff', border: '1px solid ' + (filterSt === s ? C.acc : '#e2e8f0'), color: filterSt === s ? '#fff' : C.sub, borderRadius: '20px', fontSize: '13px', fontWeight: filterSt === s ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{s}</button>))}
            </div>
            {(() => {
              const myUN = myUsers.map(u => u.name)
              const actLeads = leads.filter(l => myUN.includes(l.assigned_to)).filter(l => filterSt === '전체' || l.activity_status === filterSt)
              const actDirect = directLeads.filter(l => myUsers.some(u => u.username === l.mm_username)).filter(l => filterSt === '전체' || l.activity_status === filterSt)
              const all = [...actLeads.map(l=>({...l,_type:'배분',_name:l.address})),...actDirect.map(l=>({...l,_type:'직접발굴',_name:l.customer}))].sort((a,b)=>new Date(b.activity_at||0)-new Date(a.activity_at||0))
              if (!all.length) return <div style={{ textAlign: 'center', padding: '50px 20px', color: C.sub }}>활동 결과가 없습니다</div>
              return all.map((l, idx) => {
                const photos = (() => { try { return JSON.parse(l.photos || '[]') } catch { return [] } })()
                return (
                  <div key={l.id+l._type} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid ' + (l._type === '배분' ? C.acc : C.green), borderRadius: '12px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1, marginRight: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: l._type === '배분' ? C.acc : C.green, fontWeight: '700' }}>{l._type === '배분' ? '📤 관리자배분' : '🔍 직접발굴'}</span>
                          <span style={{ fontSize: '11px', color: C.sub }}>· {l.assigned_to || l.mm_username} MM</span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: C.text }}>{l._name}</div>
                        {l.activity_at && <div style={{ fontSize: '11px', color: C.sub, marginTop: '3px' }}>📅 {fmtAt(l.activity_at)}</div>}
                      </div>
                      <Badge s={l.activity_status || '미처리'} />
                    </div>
                    {(l.activity_contact || l.activity_result || l.activity_memo) && (
                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px', fontSize: '13px', color: C.sub }}>
                        {l.activity_contact && <div>📞 {l.activity_contact}</div>}
                        {l.activity_result && <div>📝 {l.activity_result}</div>}
                        {l.activity_memo && <div>💬 {l.activity_memo}</div>}
                      </div>
                    )}
                    {photos.length > 0 && <div style={{ display: 'flex', gap: '6px' }}>{photos.map((src, i) => <img key={i} src={src} alt="사진" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />)}</div>}
                  </div>
                )
              })
            })()}
          </div>
        )}

        {/* ── 직원 관리 ────────────────────────────────────────────── */}
        {tab === 'staff' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.text }}>직원 관리</h2>
              <button onClick={() => setShowAdd(true)} style={{ background: C.acc, border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가</button>
            </div>
            {isSuper && (
              <div style={{ background: C.blueBg, border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: C.blue, marginBottom: '4px' }}>🔑 팀관리자 계정 (총괄 전용)</div>
                <div style={{ fontSize: '11px', color: C.sub, marginBottom: '10px' }}>변경사항은 모든 기기에 즉시 반영됩니다</div>
                {adminAccounts.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div><span style={{ fontSize: '14px', fontWeight: '700', color: C.text }}>{a.name}</span><span style={{ color: C.sub, fontSize: '13px', marginLeft: '8px' }}>ID: {a.username}</span></div>
                    <button onClick={() => setEditTeam(a.username)} style={{ background: '#fff', border: '1px solid #bfdbfe', color: C.blue, padding: '5px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                  </div>
                ))}
                {adminAccounts.length === 0 && <div style={{ fontSize: '13px', color: C.sub }}>팀관리자 계정 로딩 중...</div>}
              </div>
            )}
            {myUsers.map(u => {
              const rate = pct(u.success || 0, u.goal || 1); const rs = riskStyle(rate)
              return (
                <div key={u.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: C.text, display: 'flex', alignItems: 'center', gap: '8px' }}>{u.name} MM {u.team_id && <span style={{ background: C.blueBg, color: C.blue, fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>{TEAMS.find(t => t.id === u.team_id)?.label}</span>}</div>
                      <div style={{ color: C.sub, fontSize: '13px', marginTop: '2px' }}>{u.region}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: rs.bg, color: rs.text, border: '1px solid ' + rs.border, fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>{rs.label}</span>
                      <button onClick={() => setEditUser(u)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: C.blue, padding: '6px 11px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                      <button onClick={() => handleDelete(u.id)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: C.red, padding: '6px 11px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    {[{ l: '성공', v: u.success || 0, c: C.green }, { l: '목표', v: u.goal, c: C.text }, { l: '달성률', v: rate + '%', c: C.acc }].map((s, i) => (<div key={i} style={{ flex: 1, background: '#f8fafc', borderRadius: '8px', padding: '7px', textAlign: 'center', border: '1px solid #e2e8f0' }}><div style={{ fontSize: '17px', fontWeight: '900', color: s.c }}>{s.v}</div><div style={{ fontSize: '11px', color: C.sub }}>{s.l}</div></div>))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" placeholder="목표 수정" value={goalEdit[u.id] || ''} onChange={e => setGoalEdit({ ...goalEdit, [u.id]: e.target.value })} style={{ flex: 1, ...IS, padding: '9px', fontSize: '14px' }} />
                    <button onClick={() => saveGoal(u.id)} style={{ background: savedGoal === u.id ? C.green : C.acc, border: 'none', color: '#fff', padding: '9px 13px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{savedGoal === u.id ? '✅' : '목표 저장'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 업로드 ──────────────────────────────────────────────── */}
        {tab === 'upload' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '6px', color: C.text }}>자료 업로드</h2>
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '16px' }}>CSV 파일 업로드 → A~E열을 영업기회로 등록</p>
            {/* 프로젝트명 입력 */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.text, marginBottom: '6px' }}>
                📁 프로젝트명 <span style={{ color: C.red }}>*</span>
                <span style={{ fontSize: '12px', color: C.sub, fontWeight: '400', marginLeft: '8px' }}>기회배분 탭에서 프로젝트별 구분됩니다</span>
              </div>
              <input
                type="text"
                placeholder="예: 부산 강서구 2025-04, 사하팀 4월"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                style={{ ...IS, borderColor: projectName.trim() ? C.acc : '#e2e8f0' }}
              />
            </div>
            <div onClick={() => fileRef.current.click()} style={{ background: C.accBg, border: '2px dashed ' + C.acc, borderRadius: '14px', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '14px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: C.acc, marginBottom: '4px' }}>CSV 파일 선택</div>
              <div style={{ color: C.sub, fontSize: '13px' }}>1행 = 헤더, 2행부터 데이터로 등록됩니다</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
            </div>
            {csvHeaders.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: C.acc, marginBottom: '8px' }}>📋 인식된 컬럼 (A~{String.fromCharCode(64+Math.min(csvHeaders.length,5))}열)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {csvHeaders.slice(0, 5).map((h, i) => <span key={i} style={{ background: C.accBg, color: C.acc, border: '1px solid ' + C.accBorder, fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }}>{['A','B','C','D','E'][i]}열: {h}</span>)}
                </div>
              </div>
            )}
            {uploadPreview.length > 0 && (
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px', color: C.green }}>✅ {uploadPreview.length}건 인식됨 (2행~)</div>
                {uploadPreview.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[r.col1, r.col2, r.col3, r.col4, r.col5].map((v, ci) => (
                        <div key={ci} style={{ flex: ci < 2 ? '1 1 44%' : '1 1 28%', minWidth: '70px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '10px', color: C.sub, marginBottom: '2px', fontWeight: '600' }}>{r._headers?.[ci] || `${['A','B','C','D','E'][ci]}열`}</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: ci === 0 ? C.acc : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {uploadPreview.length > 5 && <div style={{ color: C.sub, fontSize: '13px', textAlign: 'center', marginBottom: '10px' }}>외 {uploadPreview.length - 5}건...</div>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button onClick={() => { setUploadPreview([]); setCsvHeaders([]) }} style={{ flex: 1, padding: '13px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                  <button onClick={handleUpload} disabled={uploading || !projectName.trim()} style={{ flex: 2, padding: '13px', background: (uploading || !projectName.trim()) ? '#e2e8f0' : C.acc, border: 'none', color: (uploading || !projectName.trim()) ? C.sub : '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: (uploading || !projectName.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{uploading ? '업로드 중...' : (!projectName.trim() ? '프로젝트명을 입력하세요' : `${uploadPreview.length}건 업로드`)}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 기회 배분 ────────────────────────────────────────────── */}
        {tab === 'leads' && (
          <div>
            {/* 모드 선택 헤더 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.text }}>기회 배분 <span style={{ fontSize: '14px', color: C.sub, fontWeight: '400' }}>({filtered.length}건)</span></h2>
                {!selectMode && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {unassigned > 0 && <button onClick={bulkAssign} style={{ background: C.acc, border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>자동배분({unassigned})</button>}
                    <button onClick={() => { setSelectMode('assign'); setSelectedIds(new Set()) }} style={{ background: C.blueBg, border: '1px solid #bfdbfe', color: C.blue, padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>☑ 일괄배분</button>
                    {isSuper && <button onClick={() => { setSelectMode('delete'); setSelectedIds(new Set()) }} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: C.red, padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>🗑 선택삭제</button>}
                  </div>
                )}
              </div>

              {/* 선택 모드 액션 바 */}
              {selectMode && (
                <div style={{ background: selectMode === 'delete' ? '#fef2f2' : C.blueBg, border: '1px solid ' + (selectMode === 'delete' ? '#fecaca' : '#bfdbfe'), borderRadius: '10px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: selectMode === 'delete' ? C.red : C.blue, flex: '1 1 auto' }}>
                    {selectedIds.size > 0 ? `${selectedIds.size}건 선택됨` : '선택할 항목을 탭하세요'}
                  </span>
                  {/* ✅ 전체선택 / 전체해제 */}
                  <button onClick={toggleAll} style={{ background: '#fff', border: '1px solid #e2e8f0', color: C.text, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {selectedIds.size === filtered.length ? '전체해제' : '전체선택'}
                  </button>
                  {selectMode === 'assign' && (
                    <button onClick={() => selectedIds.size > 0 && setShowMultiAssign(true)} disabled={selectedIds.size === 0}
                      style={{ background: selectedIds.size > 0 ? C.blue : '#e2e8f0', border: 'none', color: selectedIds.size > 0 ? '#fff' : C.sub, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                      배분하기
                    </button>
                  )}
                  {selectMode === 'delete' && (
                    <button onClick={handleBulkDelete} disabled={selectedIds.size === 0}
                      style={{ background: selectedIds.size > 0 ? C.red : '#e2e8f0', border: 'none', color: selectedIds.size > 0 ? '#fff' : C.sub, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                      {selectedIds.size > 0 ? `${selectedIds.size}건 삭제` : '선택 없음'}
                    </button>
                  )}
                  <button onClick={() => { setSelectMode(null); setSelectedIds(new Set()) }} style={{ background: '#fff', border: '1px solid #e2e8f0', color: C.sub, padding: '6px 10px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                </div>
              )}
            </div>

            {/* 프로젝트 필터 */}
            {allProjects.length > 2 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', color: C.sub, fontWeight: '600', marginBottom: '6px' }}>📁 프로젝트</div>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {allProjects.map(p => (
                    <button key={p} onClick={() => setFilterProject(p)}
                      style={{ padding: '5px 12px', background: filterProject === p ? '#1e293b' : '#fff', border: '1px solid ' + (filterProject === p ? '#1e293b' : '#e2e8f0'), color: filterProject === p ? '#fff' : C.sub, borderRadius: '20px', fontSize: '12px', fontWeight: filterProject === p ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{p}</button>
                  ))}
                </div>
              </div>
            )}
            {/* 배분상태 필터 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              {['전체','미배분','배분완료'].map(s => (<button key={s} onClick={() => setFilterSt(s)} style={{ padding: '8px 16px', background: filterSt === s ? C.acc : '#fff', border: '1px solid ' + (filterSt === s ? C.acc : '#e2e8f0'), color: filterSt === s ? '#fff' : C.sub, borderRadius: '20px', fontSize: '14px', fontWeight: filterSt === s ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>))}
            </div>

            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '50px 20px', color: C.sub }}>영업기회가 없습니다</div>}

            {filtered.map(l => {
              const isSelected = selectedIds.has(l.id)
              return (
                <div key={l.id}
                  onClick={selectMode ? () => toggleSelect(l.id) : undefined}
                  style={{ background: isSelected ? (selectMode === 'delete' ? '#fef2f2' : C.blueBg) : '#fff', border: isSelected ? '2px solid ' + (selectMode === 'delete' ? C.red : C.blue) : '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '10px', cursor: selectMode ? 'pointer' : 'default', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', position: 'relative' }}>
                  {/* ✅ 체크박스 */}
                  {selectMode && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', width: '22px', height: '22px', borderRadius: '6px', background: isSelected ? (selectMode === 'delete' ? C.red : C.blue) : '#f1f5f9', border: '2px solid ' + (isSelected ? (selectMode === 'delete' ? C.red : C.blue) : '#e2e8f0'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: '900' }}>
                      {isSelected ? '✓' : ''}
                    </div>
                  )}
                  {/* 프로젝트 배지 */}
                  {l.project_name && <div style={{ marginBottom: '5px' }}><span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>📁 {l.project_name}</span></div>}
                  {/* A~E열 표시 */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', paddingRight: selectMode ? '28px' : '0' }}>
                    {[l.col1, l.col2, l.col3, l.col4, l.col5].map((v, i) => v ? (
                      <div key={i} style={{ flex: i < 2 ? '1 1 44%' : '1 1 28%', minWidth: '70px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '10px', color: C.sub, marginBottom: '2px' }}>{['A','B','C','D','E'][i]}열</div>
                        <div style={{ fontSize: i === 1 ? '13px' : '12px', fontWeight: '700', color: i === 0 ? C.acc : i === 1 ? C.text : C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
                      </div>
                    ) : null)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selectMode ? '0' : '8px' }}>
                    {l.assign_status === '배분완료' && <div style={{ fontSize: '13px', fontWeight: '700', color: C.green }}>👤 {l.assigned_to} MM · <span style={{ color: C.sub }}>{l.activity_status || '미처리'}</span></div>}
                    <span style={{ marginLeft: 'auto', background: l.assign_status === '미배분' ? '#fffbeb' : '#f0fdf4', color: l.assign_status === '미배분' ? '#b45309' : C.green, border: '1px solid ' + (l.assign_status === '미배분' ? '#fde68a' : '#bbf7d0'), fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>{l.assign_status}</span>
                  </div>

                  {!selectMode && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => {
                        // 단건 배분: 간단 모달
                        const mm = myUsers.find(u => window.confirm(`"${u.name}" MM에게 배분하시겠습니까?\n\n취소하면 다음 MM 선택`))
                        if (mm) handleAssignOne(l.id, mm.name)
                      }}
                        style={{ flex: 1, background: l.assign_status === '배분완료' ? '#f8fafc' : C.accBg, border: '1px solid ' + (l.assign_status === '배분완료' ? '#e2e8f0' : C.accBorder), color: l.assign_status === '배분완료' ? C.sub : C.acc, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {l.assign_status === '배분완료' ? '⚡ 재배분' : 'MM 배분하기'}
                      </button>
                      {isSuper && <button onClick={() => {
                        const pos = saveScroll()
                        if (window.confirm('이 영업기회를 삭제하시겠습니까?')) db.del('connector_leads', 'id=eq.' + l.id).then(() => { t2('삭제 완료'); load(null, pos) }).catch(() => t2('삭제 실패'))
                      }} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: C.red, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── M발굴 ────────────────────────────────────────────────── */}
        {tab === 'mdiscovery' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '4px', color: C.text }}>M발굴 관리</h2>
            <p style={{ color: C.sub, fontSize: '13px', marginBottom: '16px' }}>모바일 벌크영업 가능한 영업사이트 발굴 · 등록 · 성과 관리</p>
            <div style={{ background: '#fff', border: '1px solid ' + C.accBorder, borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: C.acc, marginBottom: '12px' }}>{mEditId ? '✏️ 수정 중' : '➕ 신규 발굴 등록'}</div>
              {[{ k: 'site_name', l: '영업사이트명', p: '예: 김해 산업단지 A구역', r: true }, { k: 'address', l: '위치/주소', p: '예: 경남 김해시' }, { k: 'contact', l: '담당자 연락처', p: '010-0000-0000' }, { k: 'capacity', l: '예상 규모', p: '예: 50세대' }].map(f => (
                <div key={f.k} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l} {f.r && <span style={{ color: C.red }}>*</span>}</div>
                  <input type="text" placeholder={f.p} value={mForm[f.k] || ''} onChange={e => setMForm(prev => ({ ...prev, [f.k]: e.target.value }))} style={IS} />
                </div>
              ))}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>진행 상태</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['발굴중','접촉중','계약완료','미성사'].map(s => (<button key={s} onClick={() => setMForm(prev => ({ ...prev, status: s }))} style={{ padding: '9px 14px', background: mForm.status === s ? C.acc : '#f8fafc', border: mForm.status === s ? 'none' : '1px solid #e2e8f0', color: mForm.status === s ? '#fff' : C.sub, borderRadius: '8px', fontSize: '14px', fontWeight: mForm.status === s ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>))}
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>결과 / 비고</div>
                <textarea placeholder="영업 결과, 특이사항 등" value={mForm.note || ''} onChange={e => setMForm(prev => ({ ...prev, note: e.target.value }))} rows={2} style={{ ...IS, resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {mEditId && <button onClick={() => { setMEditId(null); setMForm({ site_name: '', address: '', contact: '', capacity: '', note: '', status: '발굴중' }) }} style={{ flex: 1, padding: '13px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>}
                <button onClick={saveMDiscovery} style={{ flex: 2, padding: '13px', background: C.acc, border: 'none', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>{mEditId ? '수정 저장' : '등록하기'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto' }}>
              {['전체','발굴중','접촉중','계약완료','미성사'].map(s => (<button key={s} onClick={() => setMFilterSt(s)} style={{ padding: '6px 13px', background: mFilterSt === s ? C.acc : '#fff', border: '1px solid ' + (mFilterSt === s ? C.acc : '#e2e8f0'), color: mFilterSt === s ? '#fff' : C.sub, borderRadius: '20px', fontSize: '13px', fontWeight: mFilterSt === s ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{s}</button>))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {[{ label: '전체', v: mDiscovery.length, c: C.acc }, { label: '접촉중', v: mDiscovery.filter(m => m.status === '접촉중').length, c: C.blue }, { label: '계약완료', v: mDiscovery.filter(m => m.status === '계약완료').length, c: C.green }].map((s, i) => (<div key={i} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: '900', color: s.c }}>{s.v}</div><div style={{ fontSize: '11px', color: C.sub, marginTop: '3px' }}>{s.label}</div></div>))}
            </div>
            {mFiltered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: C.sub }}>등록된 발굴 사이트가 없습니다</div>}
            {mFiltered.map(m => {
              const stCol = { '발굴중': '#f59e0b', '접촉중': C.blue, '계약완료': C.green, '미성사': C.red }[m.status]
              return (
                <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: C.text, marginBottom: '3px' }}>{m.site_name}</div>
                      <div style={{ color: C.sub, fontSize: '13px' }}>{m.address}</div>
                      {m.capacity && <div style={{ color: C.sub, fontSize: '12px' }}>규모: {m.capacity}</div>}
                      {m.contact && <div style={{ color: C.sub, fontSize: '12px' }}>📞 {m.contact}</div>}
                      {m.note && <div style={{ color: C.sub, fontSize: '12px', marginTop: '4px' }}>📋 {m.note}</div>}
                      <div style={{ fontSize: '11px', color: C.sub, marginTop: '4px' }}>등록: {m.registered_by} · {fmtAt(m.created_at)}</div>
                    </div>
                    <span style={{ background: stCol + '18', color: stCol, border: '1px solid ' + stCol + '44', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{m.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setMEditId(m.id); setMForm({ site_name: m.site_name, address: m.address, contact: m.contact, capacity: m.capacity, note: m.note, status: m.status }) }} style={{ flex: 1, background: C.accBg, border: '1px solid ' + C.accBorder, color: C.acc, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>✏️ 수정</button>
                    {isSuper && <button onClick={async () => { if (window.confirm('삭제하시겠습니까?')) { try { await db.del('m_discovery', 'id=eq.' + m.id); t2('삭제 완료'); load() } catch { t2('삭제 실패') } } }} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: C.red, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 다운로드 ─────────────────────────────────────────────── */}
        {tab === 'download' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '6px', color: C.text }}>다운로드</h2>
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '20px' }}>데이터를 엑셀(CSV)로 내려받습니다</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px', color: C.text }}>📊 MM 성과 현황</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px' }}>이름 · 팀 · 지역 · 성공건수 · 목표 · 달성률</p>
                <button onClick={downloadPerf} style={{ width: '100%', background: C.acc, border: 'none', color: '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>📥 성과현황 ({myUsers.length}명)</button>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px', color: C.text }}>📋 영업기회 활동결과 (ZIP)</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '4px' }}>관리자 배분 + 직접발굴 통합 · 사진 포함</p>
                <p style={{ color: C.acc, fontSize: '12px', marginBottom: '14px' }}>CSV + 사진폴더를 ZIP으로 다운로드</p>
                <button onClick={downloadActivity} disabled={dlLoading} style={{ width: '100%', background: dlLoading ? '#e2e8f0' : C.green, border: 'none', color: dlLoading ? C.sub : '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: dlLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {dlLoading ? '⏳ 생성 중...' : `📥 활동결과 ZIP (${leads.length + directLeads.length}건)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
