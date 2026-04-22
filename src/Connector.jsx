import { useState, useRef, useCallback } from 'react'
import { db } from './supabase'

// ── 관리자 계정 (하드코딩) ────────────────────────────────────────
// 일반관리자 비밀번호는 총괄이 앱 내에서 변경 가능

// ── 이미지 압축 (Canvas) ──────────────────────────────────────────
async function compressImage(file, maxW=600, quality=0.55) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}

function fmtAt(iso){if(!iso)return'';try{const d=new Date(iso);return d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}catch{return iso}}

function PhotoPicker({ photos, onChange }) {
  const ref = React.useRef()
  const handleFile = async (e) => {
    const files = Array.from(e.target.files)
    const remaining = 2 - photos.length
    const compressed = await Promise.all(files.slice(0, remaining).map(f => compressImage(f)))
    onChange([...photos, ...compressed]); e.target.value = ''
  }
  const remove = (i) => onChange(photos.filter((_, idx) => idx !== i))
  return (
    <div>
      <div style={{display:'flex',gap:'8px',marginBottom:'6px',flexWrap:'wrap'}}>
        {photos.map((src,i) => (
          <div key={i} style={{position:'relative',width:'72px',height:'72px',borderRadius:'8px',overflow:'hidden',border:'1px solid rgba(255,255,255,0.15)'}}>
            <img src={src} alt="사진" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            <button onClick={()=>remove(i)} style={{position:'absolute',top:'3px',right:'3px',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',width:'18px',height:'18px',borderRadius:'50%',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>✕</button>
          </div>
        ))}
        {photos.length < 2 && (
          <button onClick={()=>ref.current.click()} style={{width:'72px',height:'72px',borderRadius:'8px',background:'rgba(255,255,255,0.05)',border:'2px dashed rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.4)',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>📷</button>
        )}
      </div>
      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>최대 2장 · 자동 압축됩니다</div>
      <input ref={ref} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleFile}/>
    </div>
  )
}

const SUPER_ID = 'admin'
const SUPER_PW_DEFAULT = '2026'

// 초기 팀관리자 계정 (총괄이 앱에서 수정 가능 → localStorage 저장)
const TEAM_DEFAULTS = {
  team1: { pw: '2026', name: '1팀 관리자', teamId: 'team1' },
  team2: { pw: '2026', name: '2팀 관리자', teamId: 'team2' },
  team3: { pw: '2026', name: '3팀 관리자', teamId: 'team3' },
  team4: { pw: '2026', name: '4팀 관리자', teamId: 'team4' },
}

function loadTeamAccounts() {
  try {
    const s = sessionStorage.getItem('sk-team-accounts')
    return s ? JSON.parse(s) : { ...TEAM_DEFAULTS }
  } catch { return { ...TEAM_DEFAULTS } }
}
function saveTeamAccounts(data) {
  try { sessionStorage.setItem('sk-team-accounts', JSON.stringify(data)) } catch {}
}

// ── 공통 상수 ─────────────────────────────────────────────────────
const KTLogo = () => (
  <svg width="36" height="22" viewBox="0 0 80 48" fill="none">
    <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
  </svg>
)
const C = { bg: '#06111f', card: '#0d1f35', acc: '#f59e0b', text: '#f1f5f9', sub: '#8aa3bc' }
const IS = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#f1f5f9', padding: '14px 16px', borderRadius: '12px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const TEAMS = [{ id: '', label: '팀 없음' }, { id: 'team1', label: '1팀' }, { id: 'team2', label: '2팀' }, { id: 'team3', label: '3팀' }, { id: 'team4', label: '4팀' }]
const ST = ['성공', '접촉완료', '미처리', '실패']
const SC = {
  '성공':    { bg: '#052e16', text: '#4ade80', border: '#14532d', dot: '#4ade80' },
  '접촉완료':{ bg: '#1e3a5f', text: '#93c5fd', border: '#1e4976', dot: '#60a5fa' },
  '미처리':  { bg: '#2d1d00', text: '#fbbf24', border: '#451a03', dot: '#f59e0b' },
  '실패':    { bg: '#1f0505', text: '#f87171', border: '#450a0a', dot: '#f87171' },
}
const riskStyle = r =>
  r >= 70 ? { bg: '#052e16', text: '#4ade80', border: '#14532d', label: '양호' }
  : r >= 40 ? { bg: '#2d1d00', text: '#fbbf24', border: '#451a03', label: '주의' }
  : { bg: '#1f0505', text: '#f87171', border: '#450a0a', label: '위험' }

function pct(n, d) { return d > 0 ? Math.round(n / d * 100) : 0 }

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
function mapRow(headers, row) {
  const find = (...cands) => { for (const c of cands) { const k = headers.find(k => k.includes(c)); if (k) return row[k] || '' } return '' }
  return {
    id: 'u' + Date.now() + Math.random().toString(36).slice(2, 6),
    address: find('주소', '위치', '대지', 'address'),
    area: find('면적', 'area', '㎡'),
    usage_type: find('용도', 'usage', '건축'),
    start_date: find('착공', '일자', '전입', 'date', '날짜'),
    col1: headers[0] ? row[headers[0]] || '' : '',
    col2: headers[1] ? row[headers[1]] || '' : '',
    col3: headers[2] ? row[headers[2]] || '' : '',
    col4: headers[3] ? row[headers[3]] || '' : '',
    _allCols: headers.map(h => ({ key: h, val: row[h] || '' })),
    products: [], assigned_to: '', assign_status: '미배분',
    activity_status: '미처리', activity_result: '', activity_memo: '', activity_contact: ''
  }
}

// ── 도넛 차트 ─────────────────────────────────────────────────────
function DonutChart({ data, total, size = 110 }) {
  const sw = Math.round(size * 0.14)
  const r = (size - sw) / 2 - 2
  const cx = size / 2; const cy = size / 2
  const circ = 2 * Math.PI * r
  let off = 0
  const slices = data.filter(d => d.value > 0).map(d => {
    const dash = (d.value / total) * circ
    const sl = { ...d, dash, gap: circ - dash, off }
    off += dash; return sl
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
          strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.off} />
      ))}
    </svg>
  )
}

// ── 월별 트렌드 ───────────────────────────────────────────────────
function MonthlyTrend({ leads }) {
  const now = new Date()
  const year = now.getFullYear()
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  const curMonth = now.getMonth()
  const data = months.slice(0, curMonth + 1).map((label, i) => {
    const rows = leads.filter(l => { const d = new Date(l.activity_status !== '미처리' ? l.updated_at || l.start_date || '' : ''); return d.getFullYear() === year && d.getMonth() === i })
    // 간략화: start_date 기준 전체 건
    const all = leads.filter(l => { try { const d = new Date(l.start_date); return d.getFullYear() === year && d.getMonth() === i } catch { return false } })
    return { label, total: all.length, 성공: all.filter(l => l.activity_status === '성공').length }
  })
  const maxT = Math.max(...data.map(d => d.total), 1)
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end', height: '70px', padding: '0 2px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '800' }}>{d.total > 0 ? d.total : ''}</div>
          <div style={{ width: '100%', position: 'relative', height: Math.max(d.total / maxT * 46, 4) + 'px', borderRadius: '4px 4px 0 0', background: 'rgba(245,158,11,0.12)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: pct(d.성공, d.total) + '%', background: '#4ade80', borderRadius: '4px 4px 0 0' }} />
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── 대시보드 섹션 ─────────────────────────────────────────────────
function DashboardSection({ leads, users, period, selMM, isSuper, teamId }) {
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

  // 배분된 전체 기회 (팀 필터 적용)
  const myUsers = isSuper ? users : users.filter(u => u.team_id === teamId)
  const myUserNames = myUsers.map(u => u.name)
  const myLeads = leads.filter(l => myUserNames.includes(l.assigned_to) || (isSuper && !l.assigned_to))
  const totalAssigned = myLeads.length || 1

  // 기간+MM 필터
  const filtered = myLeads.filter(l => {
    const inP = inPeriod(l.start_date)
    const matchMM = selMM === '전체' || l.assigned_to === selMM
    return inP && matchMM
  })

  const actTotal = filtered.filter(l => l.activity_status && l.activity_status !== '미처리').length
  const counts = {}; ST.forEach(s => counts[s] = filtered.filter(l => l.activity_status === s).length)
  const periodTotal = filtered.length

  // 연간 누적
  const annual = myLeads.filter(l => { try { return new Date(l.start_date).getFullYear() === now.getFullYear() } catch { return false } })
  const annualCounts = {}; ST.forEach(s => annualCounts[s] = annual.filter(l => l.activity_status === s).length)

  // 팀원별
  const mmStats = myUsers.map(u => {
    const rows = filtered.filter(l => l.assigned_to === u.name)
    return { mm: u.name, total: rows.length, ...Object.fromEntries(ST.map(s => [s, rows.filter(l => l.activity_status === s).length])) }
  }).filter(s => s.total > 0).sort((a, b) => b['성공'] - a['성공'])

  return (
    <div>
      {/* ① 배분 대비 활동률 도넛 */}
      <div style={{ background: 'rgba(13,31,53,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>
          📦 전체 배분 대비 활동률
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '400', fontSize: '11px', marginLeft: '6px' }}>배분 {totalAssigned}건 기준</span>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
            <DonutChart size={110} total={totalAssigned} data={[
              { value: actTotal, color: '#f59e0b' },
              { value: Math.max(totalAssigned - actTotal, 0), color: 'rgba(255,255,255,0.08)' }
            ]} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: C.acc }}>{pct(actTotal, totalAssigned)}%</div>
              <div style={{ fontSize: '11px', color: C.sub }}>활동률</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {[{ label: '활동 완료', value: actTotal, color: C.acc }, { label: '미활동', value: Math.max(totalAssigned - actTotal, 0), color: 'rgba(255,255,255,0.25)' }].map((r, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: r.color, fontWeight: '700' }}>{r.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: r.color }}>{r.value}건 <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>({pct(r.value, totalAssigned)}%)</span></span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '3px', height: '6px' }}>
                  <div style={{ width: pct(r.value, totalAssigned) + '%', background: r.color, height: '100%', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ② 활동 상태별 비율 도넛 */}
      <div style={{ background: 'rgba(13,31,53,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>📊 {period} 활동 {periodTotal}건 상태 비율</div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
            <DonutChart size={110} total={Math.max(periodTotal, 1)} data={ST.map(s => ({ value: counts[s], color: SC[s].dot }))} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#4ade80' }}>{counts['성공']}</div>
              <div style={{ fontSize: '11px', color: C.sub }}>성공</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {ST.map(s => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: SC[s].dot }} />
                  <span style={{ fontSize: '13px' }}>{s}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '900', color: SC[s].dot }}>
                  {counts[s]}건 <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>({pct(counts[s], Math.max(periodTotal, 1))}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: C.sub }}>활동 대비 성공률</span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#4ade80' }}>{pct(counts['성공'], Math.max(actTotal, 1))}%</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: C.sub }}>배분 대비 성공률</span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: C.acc }}>{pct(counts['성공'], totalAssigned)}%</span>
          </div>
        </div>
      </div>

      {/* ③ 상태별 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {ST.map(s => (
          <div key={s} style={{ background: SC[s].bg, border: '1px solid ' + SC[s].border, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: '900', color: SC[s].text }}>{counts[s]}</div>
            <div style={{ fontSize: '12px', color: SC[s].text, opacity: 0.85, marginTop: '3px' }}>{s}</div>
            <div style={{ fontSize: '11px', color: SC[s].text, opacity: 0.5, marginTop: '2px' }}>{pct(counts[s], Math.max(periodTotal, 1))}%</div>
          </div>
        ))}
      </div>

      {/* ④ 연간 누적 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(13,31,53,0.9))', border: '1.5px solid rgba(245,158,11,0.22)', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '800', color: C.acc, marginBottom: '12px' }}>📅 {new Date().getFullYear()}년 연간 누적</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {[{ label: '전체 활동', v: annual.length, c: C.acc }, { label: '성공', v: annualCounts['성공'], c: '#4ade80' }, { label: '미처리', v: annualCounts['미처리'], c: '#fbbf24' }, { label: '실패', v: annualCounts['실패'], c: '#f87171' }].map((s, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: '900', color: s.c }}>{s.v}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: C.sub, marginBottom: '8px', fontWeight: '600' }}>월별 추이 <span style={{ color: 'rgba(74,222,128,0.6)', fontWeight: '400' }}>초록=성공</span></div>
        <MonthlyTrend leads={myLeads} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <span style={{ fontSize: '12px', color: C.sub }}>연간 성공률</span>
          <span style={{ fontSize: '16px', fontWeight: '900', color: '#4ade80' }}>{pct(annualCounts['성공'], Math.max(annual.length, 1))}%</span>
        </div>
      </div>

      {/* ⑤ 팀원별 현황 (관리자만, 전체 선택 시) */}
      {selMM === '전체' && mmStats.length > 0 && (
        <div style={{ background: 'rgba(13,31,53,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>👥 팀원별 현황</div>
          {mmStats.map((s, i) => (
            <div key={s.mm} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: i === 0 ? C.acc : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900', color: i === 0 ? '#0a0f1e' : C.sub, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '4px' }}>{s.mm} MM <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '400' }}>({s.total}건)</span></div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {ST.map(st => s[st] > 0 && <span key={st} style={{ fontSize: '11px', background: SC[st].bg, color: SC[st].text, border: '1px solid ' + SC[st].border, padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>{st} {s[st]}</span>)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#4ade80' }}>{s['성공']}</div>
                <div style={{ fontSize: '10px', color: C.sub }}>성공</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MM 계정추가 모달 ─────────────────────────────────────────────
function AddMMModal({ onClose, onSave, isSuper }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', region: '', goal: '10', team_id: '' })
  const [err, setErr] = useState('')
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])
  const handleSave = async () => {
    setErr('')
    if (!form.name || !form.username || !form.password || !form.region) { setErr('모든 항목을 입력하세요'); return }
    try {
      await db.post('mm_users', { username: form.username, password: form.password, name: form.name, region: form.region, goal: parseInt(form.goal) || 10, team_id: form.team_id })
      onSave(form.name)
    } catch { setErr('아이디 중복 또는 오류') }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
        <h3 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '16px' }}>신규 MM 계정 등록</h3>
        {err && <div style={{ color: '#f87171', fontSize: '14px', marginBottom: '12px', background: 'rgba(248,113,113,0.1)', padding: '10px', borderRadius: '8px' }}>{err}</div>}
        {[{ k: 'name', l: '이름', p: '홍길동' }, { k: 'username', l: '아이디', p: 'mm010' }, { k: 'password', l: '비밀번호', p: '초기 비밀번호' }, { k: 'region', l: '담당 지역', p: '예: 강남구' }, { k: 'goal', l: '목표(건)', p: '10', t: 'number' }].map(f => (
          <div key={f.k} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
            <input type={f.t || 'text'} placeholder={f.p} value={form[f.k]} onChange={e => set(f.k, e.target.value)} style={IS} />
          </div>
        ))}
        {isSuper && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>팀 배정</div>
            <select value={form.team_id} onChange={e => set('team_id', e.target.value)} style={{ ...IS, color: '#f1f5f9' }}>
              {TEAMS.map(t => <option key={t.id} value={t.id} style={{ background: '#0d1f35' }}>{t.label}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.sub, borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', borderRadius: '12px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>계정 생성</button>
        </div>
      </div>
    </div>
  )
}

// ── MM 계정수정 모달 ─────────────────────────────────────────────
function EditMMModal({ user, onClose, onSave, isSuper }) {
  const [form, setForm] = useState({ name: user.name, password: user.password, region: user.region, team_id: user.team_id || '' })
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])
  const handleSave = async () => {
    try {
      const patch = { name: form.name, password: form.password, region: form.region }
      if (isSuper) patch.team_id = form.team_id
      await db.patch('mm_users', 'id=eq.' + user.id, patch)
      onSave()
    } catch { alert('수정 실패') }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
        <h3 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '16px' }}>계정 수정 — {user.name}</h3>
        {[{ k: 'name', l: '이름' }, { k: 'password', l: '비밀번호' }, { k: 'region', l: '담당 지역' }].map(f => (
          <div key={f.k} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
            <input type="text" value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)} style={IS} />
          </div>
        ))}
        {isSuper && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>팀 배정</div>
            <select value={form.team_id} onChange={e => set('team_id', e.target.value)} style={{ ...IS, color: '#f1f5f9' }}>
              {TEAMS.map(t => <option key={t.id} value={t.id} style={{ background: '#0d1f35' }}>{t.label}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.sub, borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', borderRadius: '12px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ── 팀관리자 계정 수정 모달 (총괄 전용) ──────────────────────────
function EditTeamAdminModal({ teamId, teamData, onClose, onSave }) {
  const [form, setForm] = useState({ name: teamData.name, pw: teamData.pw })
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
        <h3 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '6px' }}>팀관리자 수정</h3>
        <p style={{ color: C.sub, fontSize: '13px', marginBottom: '16px' }}>ID: {teamId} (변경불가)</p>
        {[{ k: 'name', l: '표시 이름', p: '예: 1팀 관리자' }, { k: 'pw', l: '비밀번호', p: '새 비밀번호' }].map(f => (
          <div key={f.k} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: C.sub, marginBottom: '4px', fontWeight: '600' }}>{f.l}</div>
            <input type="text" placeholder={f.p} value={form[f.k]} onChange={e => set(f.k, e.target.value)} style={IS} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.sub, borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={() => onSave(teamId, form)} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', borderRadius: '12px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function Connector({ onBack }) {
  const [screen, setScreen] = useState('login')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState('')
  const [adminInfo, setAdminInfo] = useState(null)
  const [teamAccounts, setTeamAccounts] = useState(loadTeamAccounts)

  const [tab, setTab] = useState('dashboard')
  const [period, setPeriod] = useState('월간')
  const [selMM, setSelMM] = useState('전체')

  const [users, setUsers] = useState([]); const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false); const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false); const [editUser, setEditUser] = useState(null)
  const [editTeam, setEditTeam] = useState(null)
  const [assignModal, setAssignModal] = useState(null); const [selMMA, setSelMMA] = useState('')
  const [filterSt, setFilterSt] = useState('전체')
  const [goalEdit, setGoalEdit] = useState({}); const [savedGoal, setSavedGoal] = useState(null)
  const [csvHeaders, setCsvHeaders] = useState([]); const [uploadPreview, setUploadPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dlLoading, setDlLoading] = useState(false)
  const fileRef = useRef()

  const isSuper = adminInfo?.role === 'super'

  const t2 = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = async (info) => {
    const ai = info || adminInfo
    setLoading(true)
    try {
      const uq = (ai?.role === 'team' && ai?.teamId) ? 'team_id=eq.' + ai.teamId + '&order=created_at.asc' : 'order=created_at.asc'
      const [u, l] = await Promise.all([db.get('mm_users', uq), db.get('connector_leads', 'order=created_at.desc')])
      setUsers(u); setLeads(l)
    } catch (e) { t2('로드 오류: ' + e.message) }
    setLoading(false)
  }

  const handleLogin = () => {
    // 총괄 체크
    if (lid === SUPER_ID && lpw === SUPER_PW_DEFAULT) {
      const info = { role: 'super', name: '총괄관리자', teamId: null }
      setAdminInfo(info); setScreen('main'); load(info); return
    }
    // 팀관리자 체크
    const ta = teamAccounts[lid]
    if (ta && ta.pw === lpw) {
      const info = { role: 'team', name: ta.name, teamId: ta.teamId }
      setAdminInfo(info); setScreen('main'); load(info); return
    }
    setLerr('아이디 또는 비밀번호가 올바르지 않습니다')
  }

  const handleSaveTeamAdmin = (teamId, form) => {
    const updated = { ...teamAccounts, [teamId]: { ...teamAccounts[teamId], name: form.name, pw: form.pw } }
    setTeamAccounts(updated); saveTeamAccounts(updated)
    setEditTeam(null); t2('팀관리자 계정 수정 완료!')
  }

  const handleDelete = async id => { try { await db.del('mm_users', 'id=eq.' + id); t2('삭제 완료'); load() } catch { t2('삭제 실패') } }

  const handleAssign = async (leadId, mmName) => {
    try { await db.patch('connector_leads', 'id=eq.' + leadId, { assigned_to: mmName, assign_status: '배분완료' }); setAssignModal(null); setSelMMA(''); t2(mmName + ' MM에게 배분!'); load() }
    catch { t2('배분 실패') }
  }
  const bulkAssign = async () => {
    const un = leads.filter(l => l.assign_status === '미배분')
    if (!un.length || !users.length) return
    try { for (let i = 0; i < un.length; i++) await db.patch('connector_leads', 'id=eq.' + un[i].id, { assigned_to: users[i % users.length].name, assign_status: '배분완료' }); t2('자동 배분 완료!'); load() }
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
      const mapped = rows.map(r => mapRow(headers, r))
      setUploadPreview(mapped)
      if (!mapped.length) t2('데이터가 없습니다')
    }
    reader.readAsText(file, 'UTF-8'); e.target.value = ''
  }
  const handleUpload = async () => {
    if (!uploadPreview.length) return
    setUploading(true)
    try {
      for (const row of uploadPreview) { const { _allCols, ...dbRow } = row; await db.post('connector_leads', dbRow) }
      t2(uploadPreview.length + '건 업로드 완료!'); setUploadPreview([]); setCsvHeaders([]); load(); setTab('leads')
    } catch (e) { t2('업로드 오류: ' + e.message) }
    setUploading(false)
  }
  const dl = (name, rows) => {
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }))
    a.download = name + '_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click()
  }
  const downloadPerf = () => dl('상권통_성과현황', [['이름','아이디','팀','지역','성공','목표','달성률']].concat(users.map(u => [u.name, u.username, u.team_id || '-', u.region, u.success, u.goal, pct(u.success, u.goal) + '%'])))
  const downloadActivity = async () => {
    setDlLoading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const photoFolder = zip.folder('사진')
      const dateStr = new Date().toISOString().slice(0,10)

      // CSV 헤더
      const headers = ['번호','주소/고객명','배분MM','배분상태','활동상태','결과요약','메모','연락처','활동일시','사진파일명']
      const rows = [headers]

      leads.forEach((l, idx) => {
        let photos = []
        try { photos = JSON.parse(l.photos || '[]') } catch {}

        // 사진 파일을 ZIP에 추가
        const photoNames = photos.map((b64, pi) => {
          const ext = b64.startsWith('data:image/png') ? 'png' : 'jpg'
          const name = `${String(idx+1).padStart(3,'0')}_${pi+1}.${ext}`
          const data = b64.replace(/^data:image\/\w+;base64,/, '')
          photoFolder.file(name, data, { base64: true })
          return name
        })

        rows.push([
          idx + 1,
          l.address || l.customer || '-',
          l.assigned_to || '-',
          l.assign_status || '-',
          l.activity_status || '미처리',
          l.activity_result || '',
          l.activity_memo || '',
          l.activity_contact || '',
          l.activity_at ? new Date(l.activity_at).toLocaleString('ko-KR') : '',
          photoNames.join(' / ') || '없음'
        ])
      })

      const csv = rows.map(r =>
        r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')
      ).join('\n')

      zip.file('활동결과_' + dateStr + '.csv', '\uFEFF' + csv)

      // README 추가
      zip.file('README.txt', [
        '상권통 활동결과 다운로드',
        '다운로드 일시: ' + new Date().toLocaleString('ko-KR'),
        '총 건수: ' + leads.length + '건',
        '',
        '[파일 구성]',
        '활동결과_' + dateStr + '.csv  →  엑셀에서 열기',
        '사진/  →  활동 사진 폴더 (파일명이 CSV의 사진파일명과 일치)',
        '',
        '사진파일명 형식: 번호_사진번호.jpg',
        '예) 001_1.jpg = 1번 항목의 첫 번째 사진'
      ].join('\n'))

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = '상권통_활동결과_' + dateStr + '.zip'
      a.click()
      t2('다운로드 완료! ZIP 파일을 확인하세요.')
    } catch(e) {
      t2('다운로드 오류: ' + e.message)
    }
    setDlLoading(false)
  }

  const navTabs = [
    { id: 'dashboard', label: '활동현황', icon: '📊' },
    { id: 'staff', label: '직원 관리', icon: '👥' },
    { id: 'upload', label: '업로드', icon: '📤' },
    { id: 'leads', label: '기회 배분', icon: '📋' },
    { id: 'download', label: '다운로드', icon: '📥' },
  ]

  const myUsers = isSuper ? users : users.filter(u => u.team_id === adminInfo?.teamId)
  const unassigned = leads.filter(l => l.assign_status === '미배분').length
  const filtered = filterSt === '전체' ? leads : leads.filter(l => l.assign_status === filterSt)

  // ── 로그인 화면 ─────────────────────────────────────────────────
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

      {showAdd && <AddMMModal isSuper={isSuper} onClose={() => setShowAdd(false)} onSave={name => { setShowAdd(false); t2(name + ' MM 계정 생성!'); load() }} />}
      {editUser && <EditMMModal user={editUser} isSuper={isSuper} onClose={() => setEditUser(null)} onSave={() => { setEditUser(null); t2('수정 완료!'); load() }} />}
      {editTeam && <EditTeamAdminModal teamId={editTeam} teamData={teamAccounts[editTeam]} onClose={() => setEditTeam(null)} onSave={handleSaveTeamAdmin} />}

      {/* 배분 모달 */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'linear-gradient(170deg,#0d1f35,#0a1628)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
            <button onClick={() => { setAssignModal(null); setSelMMA('') }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '4px' }}>{assignModal.assign_status === '배분완료' ? '⚡ 재배분' : 'MM 배분'}</h3>
            <p style={{ color: C.sub, fontSize: '13px', marginBottom: '16px' }}>{assignModal.address}</p>
            {assignModal.assign_status === '배분완료' && <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: C.acc }}>현재: {assignModal.assigned_to} MM</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '250px', overflowY: 'auto' }}>
              {myUsers.map(u => (
                <button key={u.id} onClick={() => setSelMMA(u.name)}
                  style={{ padding: '13px 16px', background: selMMA === u.name ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.05)', border: selMMA === u.name ? '1.5px solid ' + C.acc : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: C.text, fontSize: '15px', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{u.name} · {u.region}</span>
                  <span style={{ color: C.sub, fontSize: '12px' }}>성공 {u.success}건</span>
                </button>
              ))}
            </div>
            <button onClick={() => handleAssign(assignModal.id, selMMA)} disabled={!selMMA}
              style={{ width: '100%', padding: '15px', background: selMMA ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.07)', border: 'none', color: selMMA ? '#0a0f1e' : '#475569', borderRadius: '12px', fontSize: '17px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '17px', fontWeight: '900', color: C.acc }}>관리자</span>
                <span style={{ background: isSuper ? 'rgba(245,158,11,0.2)' : 'rgba(96,165,250,0.2)', color: isSuper ? C.acc : '#60a5fa', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', border: '1px solid ' + (isSuper ? 'rgba(245,158,11,0.35)' : 'rgba(96,165,250,0.35)') }}>
                  {isSuper ? '총괄' : adminInfo?.name}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>상권통 관리자 플랫폼</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={load} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>🔄</button>
            <button onClick={() => { setScreen('login'); setAdminInfo(null) }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[{ l: '등록 MM', v: myUsers.length, u: '명', hi: false }, { l: '미배분', v: unassigned, u: '건', hi: unassigned > 0 }, { l: '팀 성공', v: myUsers.reduce((a, u) => a + (u.success || 0), 0), u: '건', hi: false }].map((s, i) => (
            <div key={i} style={{ flex: 1, background: s.hi ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.07)', border: '1px solid ' + (s.hi ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.18)'), borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: s.hi ? '#f87171' : C.acc }}>{s.v}<span style={{ fontSize: '12px' }}>{s.u}</span></div>
              <div style={{ fontSize: '11px', color: C.sub, marginTop: '2px' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* 대시보드 탭 */}
        {tab === 'dashboard' && (
          <div>
            {/* 기간 선택 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {['일간', '주간', '월간', '연간'].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: '9px 0', background: period === p ? C.acc : 'rgba(255,255,255,0.06)', border: period === p ? 'none' : '1px solid rgba(255,255,255,0.1)', color: period === p ? '#0a0f1e' : C.sub, borderRadius: '10px', fontSize: '14px', fontWeight: period === p ? '900' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
              ))}
            </div>
            {/* MM 필터 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['전체', ...myUsers.map(u => u.name)].map(mm => (
                <button key={mm} onClick={() => setSelMM(mm)} style={{ padding: '6px 13px', background: selMM === mm ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', border: selMM === mm ? '1px solid ' + C.acc : '1px solid rgba(255,255,255,0.08)', color: selMM === mm ? C.acc : C.sub, borderRadius: '20px', fontSize: '13px', fontWeight: selMM === mm ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{mm}</button>
              ))}
            </div>
            <DashboardSection leads={leads} users={users} period={period} selMM={selMM} isSuper={isSuper} teamId={adminInfo?.teamId} />
          </div>
        )}

        {/* 직원 관리 탭 */}
        {tab === 'staff' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.acc }}>직원 관리</h2>
              <button onClick={() => setShowAdd(true)} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', padding: '10px 16px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가</button>
            </div>

            {/* 총괄만: 팀관리자 계정 관리 섹션 */}
            {isSuper && (
              <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#60a5fa', marginBottom: '12px' }}>🔑 팀관리자 계정</div>
                {Object.entries(teamAccounts).map(([tid, ta]) => (
                  <div key={tid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: '700' }}>{ta.name}</span>
                      <span style={{ color: C.sub, fontSize: '13px', marginLeft: '8px' }}>ID: {tid}</span>
                    </div>
                    <button onClick={() => setEditTeam(tid)} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                  </div>
                ))}
              </div>
            )}

            {myUsers.map(u => {
              const rate = u.goal > 0 ? pct(u.success, u.goal) : 0
              const rs = riskStyle(rate)
              return (
                <div key={u.id} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {u.name} MM
                        {u.team_id && <span style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>{TEAMS.find(t => t.id === u.team_id)?.label}</span>}
                      </div>
                      <div style={{ color: C.sub, fontSize: '13px', marginTop: '2px' }}>{u.region}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: rs.bg, color: rs.text, border: '1px solid ' + rs.border, fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>{rs.label}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setEditUser(u)} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                        <button onClick={() => handleDelete(u.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    {[{ l: '성공', v: u.success, c: '#4ade80' }, { l: '목표', v: u.goal, c: C.text }, { l: '달성률', v: rate + '%', c: C.acc }].map((s, i) => (
                      <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: '11px', color: C.sub }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" placeholder="목표 수정" value={goalEdit[u.id] || ''} onChange={e => setGoalEdit({ ...goalEdit, [u.id]: e.target.value })}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: C.text, padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
                    <button onClick={() => saveGoal(u.id)} style={{ background: savedGoal === u.id ? '#4ade80' : C.acc, border: 'none', color: '#0a0f1e', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {savedGoal === u.id ? '✅' : '목표 저장'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 자료 업로드 */}
        {tab === 'upload' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', marginBottom: '6px', color: C.acc }}>자료 업로드</h2>
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '16px' }}>CSV 파일 업로드 → 영업기회 자동 등록</p>
            <div onClick={() => fileRef.current.click()} style={{ background: 'rgba(245,158,11,0.05)', border: '2px dashed rgba(245,158,11,0.35)', borderRadius: '14px', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '14px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: C.acc, marginBottom: '4px' }}>CSV 파일 선택</div>
              <div style={{ color: C.sub, fontSize: '13px' }}>클릭하여 파일 선택 (.csv)</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
            </div>
            {csvHeaders.length > 0 && (
              <div style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: C.acc, marginBottom: '10px' }}>📋 인식된 컬럼 ({csvHeaders.length}개)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {csvHeaders.slice(0, 5).map((h, i) => <span key={i} style={{ background: 'rgba(245,158,11,0.1)', color: C.acc, border: '1px solid rgba(245,158,11,0.25)', fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }}>{i + 1}. {h}</span>)}
                  {csvHeaders.length > 5 && <span style={{ color: C.sub, fontSize: '12px', padding: '4px 0' }}>+{csvHeaders.length - 5}개</span>}
                </div>
              </div>
            )}
            {uploadPreview.length > 0 && (
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px', color: '#4ade80' }}>✅ {uploadPreview.length}건 인식됨</div>
                {uploadPreview.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                      {r._allCols && r._allCols.slice(0, 6).map((col, ci) => (
                        <div key={ci}>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{col.key}</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: ci === 0 ? C.acc : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.val || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {uploadPreview.length > 5 && <div style={{ color: C.sub, fontSize: '13px', textAlign: 'center', marginBottom: '10px' }}>외 {uploadPreview.length - 5}건...</div>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button onClick={() => { setUploadPreview([]); setCsvHeaders([]) }} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                  <button onClick={handleUpload} disabled={uploading} style={{ flex: 2, padding: '13px', background: uploading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: uploading ? '#475569' : '#0a0f1e', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
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
                <button key={s} onClick={() => setFilterSt(s)} style={{ padding: '8px 16px', background: filterSt === s ? C.acc : 'rgba(255,255,255,0.06)', border: filterSt === s ? 'none' : '1px solid rgba(255,255,255,0.1)', color: filterSt === s ? '#0a0f1e' : C.sub, borderRadius: '20px', fontSize: '14px', fontWeight: filterSt === s ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
              ))}
            </div>
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '50px 20px', color: C.sub, fontSize: '16px' }}>영업기회가 없습니다</div>}
            {filtered.map(l => (
              <div key={l.id} style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: '8px' }}>
                  {[{ label: '구분/유형', v: l.col1 || l.usage_type || '-', c: C.acc }, { label: '주소', v: l.address || l.col2 || '-', c: C.text }, { label: '일자', v: l.start_date || l.col3 || '-', c: C.sub }, { label: '상품', v: l.col4 || '-', c: C.sub }].map((d, i) => (
                    <div key={i}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{d.label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: d.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  {l.assign_status === '배분완료' && <div style={{ color: '#4ade80', fontSize: '13px', fontWeight: '700' }}>👤 {l.assigned_to} MM · <span style={{ color: C.sub }}>{l.activity_status || '미처리'}</span></div>}
                  <span style={{ marginLeft: 'auto', background: l.assign_status === '미배분' ? '#2d1d00' : '#052e16', color: l.assign_status === '미배분' ? '#fbbf24' : '#4ade80', border: l.assign_status === '미배분' ? '1px solid #451a03' : '1px solid #14532d', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>{l.assign_status}</span>
                </div>
                <button onClick={() => { setAssignModal(l); setSelMMA(l.assigned_to || '') }} style={{ width: '100%', background: 'transparent', border: '1px solid ' + (l.assign_status === '미배분' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)'), color: l.assign_status === '미배분' ? C.acc : C.sub, padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
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
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '20px' }}>데이터를 엑셀(CSV)로 내려받습니다</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>📊 MM 성과 현황</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px' }}>이름 · 팀 · 지역 · 성공건수 · 목표 · 달성률</p>
                <button onClick={downloadPerf} style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0a0f1e', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>📥 성과현황 ({myUsers.length}명)</button>
              </div>
              <div style={{ background: 'rgba(13,31,53,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>📋 영업기회 활동결과</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px' }}>주소 · 배분MM · 활동상태 · 결과요약 · 연락처</p>
                <button onClick={downloadActivity} disabled={dlLoading} style={{ width: '100%', background: dlLoading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: dlLoading ? '#475569' : '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: dlLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {dlLoading ? '⏳ 생성 중...' : `📥 활동결과 ZIP (${leads.length}건)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 탭 */}
      <div style={{ background: 'rgba(6,17,31,0.95)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', padding: '8px 0', backdropFilter: 'blur(10px)' }}>
        {navTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: 'none', border: 'none', color: tab === t.id ? C.acc : 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '6px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', fontFamily: 'inherit', minWidth: '54px' }}>
            <span style={{ fontSize: '18px' }}>{t.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: tab === t.id ? '800' : '500', whiteSpace: 'nowrap' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
