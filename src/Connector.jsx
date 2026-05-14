import { useState, useRef, useCallback, useEffect } from 'react'
import { db } from './supabase'
import React from 'react'
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: '20px', background: '#fff', minHeight: '100vh', fontFamily: 'monospace', color: 'red' }}>
        <h2>🚨 오류 발생</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{this.state.error?.message || '알 수 없는 오류'}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#666' }}>{this.state.error?.stack?.slice(0,500)}</pre>
      </div>
    )
    return this.props.children
  }
}


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
  { id: 'team1', label: '김해팀' },
  { id: 'team2', label: '사하팀' },
  { id: 'team3', label: '3팀' },
  { id: 'team4', label: '4팀' },
]
// ── 4대 프로젝트 정의 ─────────────────────────────────────────────
const PT = [
  { id:1, label:'기업체 통신환경 개선공사', icon:'🏭', adminOnly:true },
  { id:2, label:'세움터 신축건물',           icon:'🏗️', adminOnly:true },
  { id:3, label:'빌딩/상가 공략',            icon:'🏢', adminOnly:false },
  { id:4, label:'직접 판매',                 icon:'🤝', adminOnly:false },
]
function ptLabel(id) { return PT.find(p=>p.id===id)?.label || '-' }
function ptIcon(id)  { return PT.find(p=>p.id===id)?.icon  || '📁' }
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
// ── 문자 공유 양식 생성 ──────────────────────────────────────────
function buildShareMsg(lead, mmName, teamName, extra) {
  const today = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\. /g,'-').replace('.','')
  const addr = lead.address || lead.col2 || ''
  const contact = lead.activity_contact || lead.contact || ''
  const products = Array.isArray(lead.products) ? lead.products.join('+') : (lead.col4 || '')
  const customer = lead.customer || ''
  const memo = lead.activity_result || lead.note || ''
  const visitDate = extra.visitDate || lead.col3 || '즉시'
  const col1info = lead.col1 ? ' (' + lead.col1 + ')' : ''
  return '[' + teamName + ' 영업정보 수신안내]\nㅇ영업정보제공자 : ' + teamName + ' ' + mmName +
    '\nㅇ수신일시 : ' + today +
    '\nㅇ고객요청상품 : ' + products + (products ? ' 신청' : '') + col1info +
    '\nㅇ추가컨설팅동의상품 : ' + (extra.addProducts || '') +
    '\nㅇ고객명 : ' + customer +
    '\nㅇ사업자번호 : ' + (extra.bizNo || '') +
    '\nㅇ연락처 : ' + contact +
    '\nㅇ주소 : ' + addr +
    '\nㅇ방문(상담)요청일 : ' + visitDate +
    '\nㅇ상담내용 : ' + (memo ? memo + '\n혜택 및 요금견적 등 빠른상담 바랍니다.' : '빠른상담 바랍니다.')
}

function ShareModal({ lead, mmName: defaultMM, onClose }) {
  const [mmName, setMmName] = useState(defaultMM || lead.assigned_to || '')
  const [teamName, setTeamName] = useState('서부산지사')
  const [visitDate, setVisitDate] = useState('즉시')
  const [bizNo, setBizNo] = useState('')
  const [addProducts, setAddProducts] = useState('')
  const [copied, setCopied] = useState(false)

  const msg = buildShareMsg(lead, mmName, teamName, { visitDate, bizNo, addProducts })

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) { await navigator.clipboard.writeText(msg) }
      else { const ta=document.createElement('textarea');ta.value=msg;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta) }
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    } catch { alert('복사 실패: 직접 선택 후 복사해주세요') }
  }

  const SIS = { width:'100%', background:'#f8fafc', border:'1.5px solid #e2e8f0', color:C.text, padding:'9px 12px', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000,backdropFilter:'blur(3px)'}}>
      <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px 18px 32px',width:'100%',maxWidth:'480px',boxShadow:'0 -4px 24px rgba(0,0,0,0.12)',maxHeight:'90vh',overflowY:'auto',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:'14px',right:'14px',background:'#f1f5f9',border:'none',color:C.sub,width:'28px',height:'28px',borderRadius:'50%',fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        <div style={{fontSize:'17px',fontWeight:'900',color:C.text,marginBottom:'14px'}}>📤 영업정보 문자 공유</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
          {[{label:'지사/팀명',val:teamName,set:setTeamName,placeholder:'예: 서부산지사 사하팀'},{label:'MM 이름',val:mmName,set:setMmName,placeholder:'홍길동'}].map(f=>(
            <div key={f.label}>
              <div style={{fontSize:'12px',color:C.sub,fontWeight:'600',marginBottom:'4px'}}>{f.label}</div>
              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={SIS}/>
            </div>
          ))}
          {[{label:'방문(상담)요청일',val:visitDate,set:setVisitDate,placeholder:'즉시 / 날짜'},{label:'사업자번호',val:bizNo,set:setBizNo,placeholder:'000-00-00000'}].map(f=>(
            <div key={f.label}>
              <div style={{fontSize:'12px',color:C.sub,fontWeight:'600',marginBottom:'4px'}}>{f.label}</div>
              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={SIS}/>
            </div>
          ))}
          <div style={{gridColumn:'1/-1'}}>
            <div style={{fontSize:'12px',color:C.sub,fontWeight:'600',marginBottom:'4px'}}>추가 컨설팅 동의 상품</div>
            <input value={addProducts} onChange={e=>setAddProducts(e.target.value)} placeholder='예: CCTV+카드단말기' style={SIS}/>
          </div>
        </div>
        <div style={{background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'13px',marginBottom:'12px',fontSize:'13px',color:C.text,lineHeight:'1.85',whiteSpace:'pre-wrap',fontFamily:'monospace',overflowX:'auto'}}>
          {msg}
        </div>
        <button onClick={handleCopy} style={{width:'100%',padding:'15px',background:copied?C.green:C.acc,border:'none',color:'#fff',borderRadius:'12px',fontSize:'17px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit',transition:'background 0.2s'}}>
          {copied ? '✅ 복사완료! 문자앱에 붙여넣기 하세요' : '📋 문자 양식 복사하기'}
        </button>
        <p style={{fontSize:'12px',color:C.sub,textAlign:'center',marginTop:'8px',marginBottom:0}}>복사 후 문자앱에서 붙여넣기(길게 누르기)</p>
      </div>
    </div>
  )
}


// ── 팀별 현황 대시보드 컴포넌트 ──────────────────────────────────
function TeamDashboard({ adminInfo, users, leads, directLeads, mDiscovery, adminAccounts, onUpdateLabel, isSuper }) {
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [labelForms, setLabelForms] = useState({})

  // 팀명 설정된 계정만 표시
  const visibleTeams = isSuper
    ? adminAccounts.filter(a => a.team_label)
    : adminAccounts.filter(a => a.team_id === adminInfo?.teamId && a.team_label)
  const unlabeledTeams = adminAccounts.filter(a => !a.team_label)

  // 팀 저장
  const handleSaveLabels = async () => {
    for (const [teamId, label] of Object.entries(labelForms)) {
      if (label !== undefined) {
        try { await db.patch('admin_accounts', 'team_id=eq.' + teamId, { team_label: label }) } catch {}
      }
    }
    onUpdateLabel()
    setShowLabelModal(false)
  }

  function TeamCard({ acc }) {
    const teamMM = users.filter(u => u.team_id === acc.team_id)
    const teamLeads = leads.filter(l => teamMM.map(u => u.name).includes(l.assigned_to))
    const teamDirect = directLeads.filter(l => teamMM.some(u => u.username === l.mm_username))
    const allLeads = [...teamLeads, ...teamDirect]
    const success = teamMM.reduce((a, u) => a + (u.success || 0), 0)
    const goal = teamMM.reduce((a, u) => a + (u.goal || 10), 0)
    const mit = teamLeads.filter(l => l.activity_status && l.activity_status !== '미처리').length  // MIT: 실제 활동한 건수
    const mDiscoveryCount = (mDiscovery || []).filter(m => m.team_id === acc.team_id).length  // M발굴: 실제 등록 건수
    const topMM = [...teamMM].sort((a, b) => (b.success||0) - (a.success||0)).slice(0, 3)
    const projects = [...new Set(teamLeads.map(l => l.project_name).filter(Boolean))]
    const rate = pct(success, Math.max(goal, 1))

    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid ' + C.blue, borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: C.text }}>{acc.team_label}</div>
            <div style={{ fontSize: '12px', color: C.sub, marginTop: '2px' }}>MM {teamMM.length}명 · 프로젝트 {projects.length}개</div>
          </div>
          <span style={{ background: rate >= 70 ? '#f0fdf4' : '#fff7ed', color: rate >= 70 ? C.green : C.acc, border: '1px solid ' + (rate >= 70 ? '#bbf7d0' : C.accBorder), fontSize: '13px', fontWeight: '800', padding: '4px 12px', borderRadius: '20px' }}>달성 {rate}%</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '12px' }}>
          {[{ l: '성공', v: success, c: C.green }, { l: '목표', v: goal, c: C.text }, { l: 'MIT', v: mit, c: C.blue }, { l: 'M발굴', v: mDiscoveryCount, c: '#7c3aed' }].map((s, i) => (
            <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: '900', color: s.c }}>{s.v}</div>
              <div style={{ fontSize: '10px', color: C.sub, marginTop: '2px' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.sub, marginBottom: '4px' }}><span>이달 목표 달성</span><span style={{ fontWeight: '700' }}>{success}/{goal}건</span></div>
          <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '10px', overflow: 'hidden' }}><div style={{ width: Math.min(rate, 100) + '%', background: rate >= 70 ? C.green : C.acc, height: '100%', borderRadius: '4px' }}/></div>
        </div>
        {topMM.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: C.sub, marginBottom: '8px' }}>🏅 팀 우수 MM</div>
            {topMM.map((u, i) => (
              <div key={u.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '14px' }}>{['🥇','🥈','🥉'][i]}</span><span style={{ fontSize: '13px', fontWeight: '700' }}>{u.name}</span></div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: C.green }}>{u.success || 0}건</span>
              </div>
            ))}
          </div>
        )}
        {projects.length > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: C.blue, marginBottom: '6px' }}>📁 진행중 프로젝트</div>
            {projects.map((p, i) => {
              const pLeads = teamLeads.filter(l => l.project_name === p)
              const done = pLeads.filter(l => l.activity_status && l.activity_status !== '미처리').length
              const total = pLeads.length
              return (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.text, marginBottom: '3px' }}>
                    <span style={{ fontWeight: '700' }}>{p}</span>
                    <span style={{ color: C.blue, fontWeight: '800' }}>{pct(done, total)}% ({done}/{total})</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '3px', height: '6px', overflow: 'hidden' }}><div style={{ width: pct(done, total) + '%', background: C.blue, height: '100%' }}/></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* 팀명 설정 모달 */}
      {showLabelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '22px 18px 32px', width: '100%', maxWidth: '480px', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowLabelModal(false)} style={{ position: 'absolute', top: '14px', right: '14px', background: '#f1f5f9', border: 'none', color: C.sub, width: '28px', height: '28px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            <div style={{ fontSize: '17px', fontWeight: '900', color: C.text, marginBottom: '6px' }}>🏷️ 팀 표시명 설정</div>
            <p style={{ fontSize: '13px', color: C.sub, marginBottom: '16px' }}>대시보드에 표시될 팀 이름을 지정하세요 (예: 김해팀, 사하팀)</p>
            {adminAccounts.map(a => (
              <div key={a.id || a.team_id} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', color: C.sub, fontWeight: '600', marginBottom: '4px' }}>{a.name} <span style={{ color: '#94a3b8', fontWeight: '400' }}>(ID: {a.username})</span></div>
                <input defaultValue={a.team_label || ''} onChange={e => setLabelForms(prev => ({ ...prev, [a.team_id]: e.target.value }))} placeholder="예: 김해팀, 사하팀..."
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc', color: C.text, boxSizing: 'border-box' }}/>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setShowLabelModal(false)} style={{ flex: 1, padding: '13px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: C.sub, borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleSaveLabels} style={{ flex: 2, padding: '13px', background: C.acc, border: 'none', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장 (즉시 반영)</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.text }}>팀별 현황</h2>
        {isSuper && <button onClick={() => setShowLabelModal(true)} style={{ background: C.accBg, border: '1px solid ' + C.accBorder, color: C.acc, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>🏷️ 팀명 설정</button>}
      </div>

      {/* 팀명 미설정 경고 */}
      {isSuper && unlabeledTeams.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', color: '#b45309' }}>⚠️ 팀명 미설정 {unlabeledTeams.length}개 팀 — 대시보드에 미표시</div>
          <button onClick={() => setShowLabelModal(true)} style={{ background: '#f59e0b', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>설정</button>
        </div>
      )}

      {/* 총괄: 전체 요약 */}
      {isSuper && visibleTeams.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg,#fff7ed,#fff)', border: '1.5px solid ' + C.accBorder, borderRadius: '14px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: C.acc, marginBottom: '10px' }}>🏆 전체 종합</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
            {[
              { l: '전체 MM', v: users.length + '명', c: C.text },
              { l: '총 성공', v: users.reduce((a, u) => a + (u.success||0), 0) + '건', c: C.green },
              { l: '활성 팀', v: visibleTeams.length + '팀', c: C.blue },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '900', color: s.c }}>{s.v}</div>
                <div style={{ fontSize: '11px', color: C.sub, marginTop: '3px' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 팀 카드 */}
      {visibleTeams.length === 0
        ? <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏷️</div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: C.text, marginBottom: '6px' }}>{isSuper ? '팀명이 설정된 팀이 없습니다' : '팀 정보를 불러오는 중...'}</div>
            {isSuper && <button onClick={() => setShowLabelModal(true)} style={{ background: C.acc, border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', marginTop: '8px' }}>🏷️ 팀명 설정하기</button>}
          </div>
        : visibleTeams.map(acc => <TeamCard key={acc.team_id} acc={acc}/>)
      }
    </div>
  )
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
function mapRow(headers, row, teamId, projectType, themeName) {
  const h = headers.slice(0, 5)
  const vals = h.map(k => row[k] || '')
  return {
    id: 'u' + Date.now() + Math.random().toString(36).slice(2, 6),
    col1: vals[0] || '', col2: vals[1] || '', col3: vals[2] || '',
    col4: vals[3] || '', col5: vals[4] || '',
    address: vals[1] || vals[0] || '',
    _headers: h,
    team_id: teamId || '',
    project_type: projectType || null,
    project_name: themeName || '',
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
    if (!form.name || !form.password) { alert('이름과 비밀번호를 입력하세요'); return }
    try {
      const patch = { name: form.name, password: form.password, region: form.region }
      if (isSuper) patch.team_id = form.team_id
      await db.patch('mm_users', 'id=eq.' + user.id, patch)
      onSave()
    } catch (e) { alert('수정 실패: ' + e.message) }
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

// ── 단건 배분 + 수정 모달 ────────────────────────────────────────
function AssignOneModal({ lead, users, onClose, onSave }) {
  const [selMM, setSelMM] = useState(lead.assigned_to || '')
  const [selPT, setSelPT] = useState(lead.project_type || 1)
  const [selTheme, setSelTheme] = useState(lead.project_name || lead.theme_name || '')
  const isReassign = lead.assign_status === '배분완료'
  const displayName = lead.address || lead.col2 || lead.col1 || '-'
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:998, backdropFilter:'blur(3px)' }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'22px 18px 36px', width:'100%', maxWidth:'480px', boxShadow:'0 -4px 24px rgba(0,0,0,0.12)', maxHeight:'88vh', overflowY:'auto', position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'14px', right:'14px', background:'#f1f5f9', border:'none', color:'#64748b', width:'28px', height:'28px', borderRadius:'50%', fontSize:'16px', cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:'17px', fontWeight:'900', color:'#1e293b', marginBottom:'4px' }}>{isReassign ? '⚡ 배분 수정' : '👤 MM 배분'}</div>
        <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'16px' }}>{displayName}</div>
        {isReassign && lead.assigned_to && (
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'8px 12px', marginBottom:'12px', fontSize:'12px', color:'#92400e' }}>
            현재: {lead.assigned_to} MM · {lead.project_name||'프로젝트 미지정'}
          </div>
        )}
        <div style={{ fontSize:'13px', fontWeight:'700', color:'#64748b', marginBottom:'8px' }}>👤 MM 선택</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'14px', maxHeight:'200px', overflowY:'auto' }}>
          {users.map(u => (
            <button key={u.id} onClick={() => setSelMM(u.name)}
              style={{ padding:'11px 14px', background:selMM===u.name?'#fff7ed':'#f8fafc', border:'1.5px solid '+(selMM===u.name?'#e67e00':'#e2e8f0'), borderRadius:'10px', color:'#1e293b', fontSize:'14px', fontWeight:selMM===u.name?'800':'500', cursor:'pointer', textAlign:'left', fontFamily:'inherit', display:'flex', justifyContent:'space-between' }}>
              <span>{u.name} MM · {u.region}</span>
              <span style={{ fontSize:'12px', color:'#64748b' }}>성공 {u.success||0}건</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize:'13px', fontWeight:'700', color:'#64748b', marginBottom:'8px' }}>📊 프로젝트 선택</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'12px' }}>
          {PT.map(p => (
            <button key={p.id} onClick={() => setSelPT(p.id)}
              style={{ padding:'8px 12px', background:selPT===p.id?'#1e293b':'#f8fafc', border:'1.5px solid '+(selPT===p.id?'#1e293b':'#e2e8f0'), color:selPT===p.id?'#fff':'#64748b', borderRadius:'8px', fontSize:'12px', fontWeight:selPT===p.id?'800':'500', cursor:'pointer', textAlign:'left', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'6px' }}>
              <span>{p.icon}</span><span>{p.id}. {p.label}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize:'13px', fontWeight:'700', color:'#64748b', marginBottom:'5px' }}>🏷️ 테마 (선택)</div>
        <input value={selTheme} onChange={e=>setSelTheme(e.target.value)} placeholder="예: 김해_테크노밸리_260427"
          style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:'inherit', background:'#f8fafc', marginBottom:'16px', boxSizing:'border-box' }}/>
        <button onClick={() => selMM && onSave(selMM, selPT, selTheme)} disabled={!selMM}
          style={{ width:'100%', padding:'14px', background:selMM?'#e67e00':'#e2e8f0', border:'none', color:selMM?'#fff':'#94a3b8', borderRadius:'12px', fontSize:'16px', fontWeight:'900', cursor:selMM?'pointer':'not-allowed', fontFamily:'inherit' }}>
          {selMM ? selMM + ' MM에게 배분 / 저장' : 'MM을 선택하세요'}
        </button>
      </div>
    </div>
  )
}

// ── 대시보드 섹션 ─────────────────────────────────────────────────
function DashboardSection({ leads, directLeads = [], users, period, actMonth = new Date().getMonth()+1, selMM, isSuper, teamId }) {
  const now = new Date()
  function inPeriod(dateStr) {
    if (!dateStr) return false
    try {
      const d = new Date(dateStr)
      if (period === '일간') return d.toDateString() === now.toDateString()
      if (period === '주간') { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return d >= s && d <= e }
      if (period === '월간') return d.getFullYear() === now.getFullYear() && d.getMonth() + 1 === actMonth
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
    activity_at: l.activity_at || l.created_at || '', assign_status: '직접발굴', _isDirect: true
  }))
  const myLeads = [...myAssignedLeads, ...myDirectLeads]
  const totalAssigned = myLeads.length || 1
  const filtered = myLeads.filter(l => { const inP = inPeriod(l._isDirect ? l.activity_at : l.activity_at); const matchMM = selMM === '전체' || l.assigned_to === selMM; return inP && matchMM })
  const actTotal = filtered.filter(l => l.activity_status && l.activity_status !== '미처리').length
  const counts = {}; ST.forEach(s => counts[s] = filtered.filter(l => l.activity_status === s).length)
  const periodTotal = filtered.length
  const annual = myLeads.filter(l => { try { return new Date(l.activity_at || '').getFullYear() === now.getFullYear() } catch { return false } })
  const annualCounts = {}; ST.forEach(s => annualCounts[s] = annual.filter(l => l.activity_status === s).length)
  const mmStats = myUsers.map(u => { const rows = filtered.filter(l => l.assigned_to === u.name); return { mm: u.name, total: rows.length, ...Object.fromEntries(ST.map(s => [s, rows.filter(l => l.activity_status === s).length])) } }).filter(s => s.total > 0).sort((a, b) => b['성공'] - a['성공'])

  const card = (children, extra = {}) => <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', ...extra }}>{children}</div>

  return (
    <div>
      {card(<>
        <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>📦 전체 영업기회 활동률 <span style={{ fontWeight: '400' }}>(배분+직접발굴 {totalAssigned}건)</span></div>
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

      {/* ── 상품별 성공 건수 ── */}
      {card(<>
        <div style={{ fontSize: '13px', color: C.sub, fontWeight: '700', marginBottom: '12px' }}>📦 상품별 성공 건수 ({period}{period==='월간'?' '+actMonth+'월':''})</div>
        {(() => {
          const successLeads = [...filtered.filter(l => l.activity_status === '성공'), ...annual.filter(l => period === '연간' && l.activity_status === '성공')]
          const actualSuccess = period === '연간' ? annual.filter(l=>l.activity_status==='성공') : filtered.filter(l=>l.activity_status==='성공')
          const PRODS = ['인터넷','TV','다량회선','모바일','일반전화','하이오더','로봇','CCTV']
          const prodCounts = {}
          actualSuccess.forEach(l => {
            const prods = Array.isArray(l.products) ? l.products : (() => { try { return JSON.parse(l.products||'[]') } catch { return [] } })()
            prods.forEach(p => { prodCounts[p] = (prodCounts[p]||0) + 1 })
          })
          const entries = Object.entries(prodCounts).sort((a,b)=>b[1]-a[1])
          const total = actualSuccess.length
          if (entries.length === 0) return <div style={{ fontSize:'13px', color:C.sub, textAlign:'center', padding:'8px' }}>성공 건수 없음</div>
          return (
            <div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
                {PRODS.map(p => {
                  const cnt = prodCounts[p] || 0
                  if (cnt === 0) return null
                  return (
                    <div key={p} style={{ background: C.greenBg, border: '1px solid ' + C.accBorder, borderRadius:'10px', padding:'8px 12px', textAlign:'center', minWidth:'70px' }}>
                      <div style={{ fontSize:'18px', fontWeight:'900', color:C.green }}>{cnt}</div>
                      <div style={{ fontSize:'11px', color:C.sub, marginTop:'2px' }}>{p}</div>
                      <div style={{ fontSize:'10px', color:C.green }}>{pct(cnt,Math.max(total,1))}%</div>
                    </div>
                  )
                })}
              </div>
              {entries.length > 0 && (
                <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'8px 10px' }}>
                  {entries.map(([p,cnt]) => (
                    <div key={p} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontSize:'12px', color:C.text, fontWeight:'600' }}>{p}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <div style={{ width:'80px', background:'#e2e8f0', borderRadius:'3px', height:'6px' }}>
                          <div style={{ width:pct(cnt,Math.max(total,1))+'%', background:C.green, height:'100%', borderRadius:'3px' }}/>
                        </div>
                        <span style={{ fontSize:'12px', fontWeight:'800', color:C.green, minWidth:'20px', textAlign:'right' }}>{cnt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </>, { marginBottom: '12px' })}

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
  const [period, setPeriod] = useState('일간'); const [selMM, setSelMM] = useState('전체')
  const [dashView, setDashView] = useState('전체 활동')  // '전체' | 프로젝트명
  const [dashTeam, setDashTeam] = useState('전체')  // 총괄: 팀 필터
  const [users, setUsers] = useState([]); const [leads, setLeads] = useState([])
  const [directLeads, setDirectLeads] = useState([]); const [mDiscovery, setMDiscovery] = useState([])
  const [loading, setLoading] = useState(false); const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false); const [editUser, setEditUser] = useState(null)
  const [editTeam, setEditTeam] = useState(null)
  const [filterSt, setFilterSt] = useState('전체')
  const [filterProject, setFilterProject] = useState('전체')
  // 활동결과 탭 기간 + 뷰 필터
  const [actPeriod, setActPeriod] = useState('전체')
  const [actMonth, setActMonth] = useState(new Date().getMonth() + 1)
  const [actView, setActView] = useState('전체')    // '전체'|'팀별'|'프로젝트별'|'테마별'
  const [actTeam, setActTeam] = useState('전체')   // 팀 필터 (총괄용)
  const [actProj, setActProj] = useState('전체')   // 프로젝트 필터
  const [actTheme, setActTheme] = useState('전체') // 테마 필터

  // ✅ 다중선택 상태 (배분용 + 삭제용 통합)
  const [selectMode, setSelectMode] = useState(null) // 'assign' | 'delete' | null
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showMultiAssign, setShowMultiAssign] = useState(false)

  const [goalEdit, setGoalEdit] = useState({}); const [savedGoal, setSavedGoal] = useState(null)
  const [csvHeaders, setCsvHeaders] = useState([]); const [uploadPreview, setUploadPreview] = useState([])
  const [projectName, setProjectName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [upPT, setUpPT] = useState(1)
  const [upTheme, setUpTheme] = useState('')
  const [dlLoading, setDlLoading] = useState(false)
  const [shareLead, setShareLead] = useState(null)
  const [assignTarget, setAssignTarget] = useState(null)
  const [mForm, setMForm] = useState({ site_name: '', address: '', contact: '', capacity: '', note: '', status: '발굴중' })
  const [showProjEdit, setShowProjEdit] = useState(false)
  const [projRenameVal, setProjRenameVal] = useState('')
  const [newThemeVal, setNewThemeVal] = useState('')
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
      // 전체 조회 후 클라이언트 필터 (쿼리 인코딩 문제 완전 회피)
      const rows = await db.get('admin_accounts', 'select=id,username,password,name,role,team_id,team_label')
      const matched = rows.filter(a => String(a.username).trim() === String(lid).trim())
      if (!matched.length) { setLerr('아이디 [' + lid + ']가 존재하지 않습니다'); return }
      const a = matched[0]
      if (String(a.password).trim() !== String(lpw).trim()) { setLerr('비밀번호가 올바르지 않습니다'); return }
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
      setUploadPreview(rows.map(r => mapRow(headers, r, adminInfo?.teamId || '', upPT, upTheme)))
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

// ── 슬라이드 장표 HTML 생성 (v3 - 프리미엄) ───────────────────────
// ── 슬라이드 장표 HTML 생성 v4 (10장 · A4 가로) ──────────────────
// ── 슬라이드 장표 HTML v5 (밝은 표지·월간/연간·MM별 정확) ──────────
// ── 슬라이드 장표 HTML 생성 v5 (10장 · A4 가로 · 월간/연간 구분) ──
// ── 슬라이드 장표 HTML v6 (10장 · 큰 차트 · 꽉 채움) ──
function buildSlideHTML({ period, today, yearStr, teams, projects, allMM, topMM, mDiscoveryCount, globalProdCounts = {}, globalProdAnnual = {} }) {
  const pct = (n,d) => d>0?Math.round(n/d*100):0
  const PRODS = ['인터넷','TV','다량회선','모바일','일반전화','하이오더','로봇','CCTV']
  const PCOL={인터넷:'#2563eb',TV:'#3b82f6',다량회선:'#22c55e',모바일:'#16a34a',일반전화:'#64748b',하이오더:'#e67e00',로봇:'#7c3aed',CCTV:'#0891b2'}
  const PC={1:'#2563eb',2:'#7c3aed',3:'#0891b2',4:'#059669'}
  const PL={1:'#dbeafe',2:'#ede9fe',3:'#cffafe',4:'#d1fae5'}
  const PB={1:'#93c5fd',2:'#a78bfa',3:'#67e8f9',4:'#6ee7b7'}
  const PT={1:'#1e40af',2:'#5b21b6',3:'#155e75',4:'#065f46'}
  const PI={1:'🏭',2:'🏗️',3:'🏢',4:'🤝'}
  const PN={1:'기업체 통신환경 개선공사',2:'세움터 신축건물',3:'빌딩/상가 공략',4:'직접 판매'}

  function donut(act,suc,tot,col,sz,sw){
    sz=sz||140;sw=sw||22;const r=(sz-sw)/2,c=sz/2,ci=2*Math.PI*r
    const aD=pct(act,Math.max(tot,1))/100*ci,sD=pct(suc,Math.max(tot,1))/100*ci
    return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'">'+
      '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="#e2e8f0" stroke-width="'+sw+'"/>'+
      '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="'+sw+'" stroke-dasharray="'+aD+' '+(ci-aD)+'" stroke-dashoffset="0" transform="rotate(-90 '+c+' '+c+')" stroke-linecap="round"/>'+
      '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="#16a34a" stroke-width="'+sw+'" stroke-dasharray="'+sD+' '+(ci-sD)+'" stroke-dashoffset="'+(-aD)+'" transform="rotate(-90 '+c+' '+c+')" stroke-linecap="round"/>'+
    '</svg>'
  }
  function prodDonut(pc,tot,sz){
    sz=sz||160;const sw=26,r=(sz-sw)/2,c=sz/2,ci=2*Math.PI*r
    const cols=['#2563eb','#3b82f6','#22c55e','#16a34a','#64748b','#e67e00','#7c3aed','#0891b2']
    let s='<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'"><circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="#e2e8f0" stroke-width="'+sw+'"/>',off=0
    PRODS.forEach((p,i)=>{if(!pc[p])return;const d=pct(pc[p],Math.max(tot,1))/100*ci;s+='<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+cols[i]+'" stroke-width="'+sw+'" stroke-dasharray="'+d+' '+(ci-d)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 '+c+' '+c+')" stroke-linecap="round"/>',off+=d})
    return s+'</svg>'
  }
  function bar(w,col,h){h=h||10;return '<div style="flex:1;background:#e2e8f0;border-radius:4px;overflow:hidden"><div style="width:'+Math.min(w,100)+'%;height:'+h+'px;background:'+col+';border-radius:4px"></div></div>'}
  function pd(t,bg,tc){return '<span style="background:'+bg+';color:'+tc+';padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;display:inline-block;margin:2px">'+t+'</span>'}
  function prBadges(pc,lim){lim=lim||5;return PRODS.filter(p=>pc[p]).slice(0,lim).map(p=>pd(p+' '+pc[p],PCOL[p]+'22',PCOL[p]||'#475569')).join('')}
  function dual(mv,yv,unit,mc,yc){unit=unit||'건';mc=mc||'#2563eb';yc=yc||'#475569';
    return '<div style="display:flex;gap:8px">'+
      '<div style="background:'+mc+'15;border:1.5px solid '+mc+'44;border-radius:8px;padding:4px 12px;text-align:center">'+
        '<div style="font-size:9px;color:'+mc+';font-weight:700;letter-spacing:0.5px">해당월</div>'+
        '<div style="font-size:22px;font-weight:700;color:'+mc+';line-height:1.1">'+mv+'<span style="font-size:11px">'+unit+'</span></div>'+
      '</div>'+
      '<div style="background:#f1f5f9;border:1.5px solid #cbd5e1;border-radius:8px;padding:4px 12px;text-align:center">'+
        '<div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:0.5px">연간누적</div>'+
        '<div style="font-size:22px;font-weight:700;color:'+yc+';line-height:1.1">'+yv+'<span style="font-size:11px">'+unit+'</span></div>'+
      '</div>'+
    '</div>'
  }

  const N=10
  const sh=(title,sub,n,ac)=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 32px 9px;border-bottom:3px solid '+(ac||'#e67e00')+';flex-shrink:0">'+
    '<div><div style="font-size:19px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">'+title+'</div>'+(sub?'<div style="font-size:11px;color:#64748b;margin-top:1px">'+sub+'</div>':'')+' </div>'+
    '<div style="font-size:10px;color:#94a3b8;text-align:right;line-height:1.8">'+period+' <span style="color:#e67e00;font-weight:600">/ '+yearStr+' 누적</span><br/>'+n+' / '+N+'</div></div>'
  const stb=(title,sub,n,col)=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 32px 9px;border-bottom:3px solid '+col+';flex-shrink:0">'+
    '<div><div style="font-size:22px;font-weight:700;color:'+col+'">'+title+'</div><div style="font-size:11px;color:#64748b;margin-top:1px">'+sub+'</div></div>'+
    '<div style="font-size:10px;color:#94a3b8;text-align:right;line-height:1.8">'+period+' <span style="color:#e67e00;font-weight:600">/ '+yearStr+' 누적</span><br/>'+n+' / '+N+'</div></div>'
  const sf=(n)=>'<div style="padding:5px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;flex-shrink:0">'+
    '<span>상권통 영업 보고서 · '+period+'</span><span style="color:#e67e00;font-weight:600">기준일: '+today+'</span><span>'+n+' / '+N+'</span></div>'

  const mTotal=teams.reduce((a,t)=>a+(t.monthly?.success||0),0)
  const yTotal=teams.reduce((a,t)=>a+(t.annual?.success||0),0)
  const mAct=teams.reduce((a,t)=>a+(t.monthly?.mitDone||0),0)
  const yAct=teams.reduce((a,t)=>a+(t.annual?.mitDone||0),0)
  const mLd=teams.reduce((a,t)=>a+(t.mitLeads||0),0)
  const mPE=PRODS.filter(p=>globalProdCounts[p]).map(p=>[p,globalProdCounts[p]])
  const yPE=PRODS.filter(p=>globalProdAnnual[p]).map(p=>[p,globalProdAnnual[p]])
  const maxPM=mPE.length?Math.max(...mPE.map(([,v])=>v)):1

  const css=`*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Apple SD Gothic Neo","Noto Sans KR",Malgun Gothic,sans-serif;background:#d4dae3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{width:297mm;min-height:210mm;background:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;margin:0 auto 20px;page-break-after:always;page-break-inside:avoid}
@media screen{body{padding:20px;display:flex;flex-direction:column;align-items:center;gap:20px}.slide{box-shadow:0 10px 40px rgba(0,0,0,0.2)}}
@media print{@page{size:A4 landscape;margin:0}body{background:#fff;padding:0;gap:0}.slide{margin:0;box-shadow:none;width:100vw;min-height:100vh}.nav{display:none!important}}
.sb{padding:12px 32px 14px;flex:1;display:flex;flex-direction:column;gap:10px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.dw{position:relative;display:inline-flex;flex-shrink:0}
.dc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:12px 14px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#0f172a;color:#fff}th{padding:8px 10px;text-align:left;font-weight:600;font-size:11px}
td{padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
tr:last-child td{border-bottom:none}tr:nth-child(even) td{background:#f8fafc}
.nav{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(10,15,30,0.92);padding:7px 12px;border-radius:50px;z-index:100}
.nb{width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:10px;font-weight:600;cursor:pointer}.nb:hover{background:rgba(255,255,255,0.25)}
.np{padding:0 12px;height:24px;border-radius:20px;background:#e67e00;border:none;color:#fff;font-weight:700;cursor:pointer;font-size:10px}`

  // ════════════ S1: 표지 ════════════
  const s1='<div class="slide" id="s1">'+
    '<div style="position:absolute;inset:0;background:linear-gradient(145deg,#ffffff 0%,#eef6ff 45%,#e8f1fe 70%,#fdf4e8 100%)"></div>'+
    '<div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#e67e00,#f59e0b,#e67e00)"></div>'+
    '<div style="position:absolute;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(230,126,0,0.07) 0%,transparent 70%);top:-140px;right:-120px"></div>'+
    '<div style="position:absolute;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,0.05) 0%,transparent 70%);bottom:-100px;left:-60px"></div>'+
    '<div style="position:absolute;inset:0;background-image:linear-gradient(rgba(37,99,235,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.03) 1px,transparent 1px);background-size:32px 32px"></div>'+
    '<div style="position:relative;z-index:10;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 60px">'+
      '<div style="display:inline-flex;align-items:center;gap:10px;background:rgba(230,126,0,0.1);border:1.5px solid rgba(230,126,0,0.3);padding:7px 22px;border-radius:30px;margin-bottom:22px">'+
        '<div style="width:9px;height:9px;border-radius:50%;background:#e67e00"></div>'+
        '<span style="font-size:13px;font-weight:700;color:#b45309;letter-spacing:3px;text-transform:uppercase">KT 상권통 플랫폼</span>'+
      '</div>'+
      '<div style="font-size:64px;font-weight:700;color:#0f172a;line-height:1;margin-bottom:14px">영업 성과 보고서</div>'+
      '<div style="font-size:17px;color:#64748b;margin-bottom:32px;line-height:1.6">4대 프로젝트 기반 영업활동 현황 분석</div>'+
      '<div style="display:inline-flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #e67e00;padding:10px 28px;border-radius:10px;margin-bottom:40px;box-shadow:0 2px 16px rgba(230,126,0,0.15)">'+
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67e00" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'+
        '<span style="font-size:15px;font-weight:700;color:#e67e00">'+period+' 기준</span>'+
      '</div>'+
      '<div style="display:flex;gap:24px;justify-content:center">'+
      teams.map(t=>'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px 36px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.07);min-width:140px">'+
        '<div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px">'+t.label+'</div>'+
        '<div style="font-size:12px;color:#94a3b8;margin-bottom:12px">MM '+t.mm+'명</div>'+
        '<div style="font-size:42px;font-weight:700;color:#16a34a;line-height:1">'+(t.monthly?.success||0)+'<span style="font-size:16px">건</span></div>'+
        '<div style="font-size:11px;color:#e67e00;font-weight:600;margin-top:3px">해당월</div>'+
        '<div style="font-size:22px;font-weight:700;color:#94a3b8;margin-top:6px;line-height:1">'+(t.annual?.success||0)+'<span style="font-size:12px">건</span></div>'+
        '<div style="font-size:10px;color:#94a3b8">연간누적</div>'+
      '</div>').join('')+
      '</div>'+
    '</div>'+
    '<div style="position:relative;z-index:10;padding:10px 52px;background:rgba(15,23,42,0.04);border-top:1px solid rgba(0,0,0,0.07);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">'+
      '<div style="font-size:12px;color:#94a3b8">KT 지역상권 영업관리 플랫폼</div>'+
      '<div style="font-size:14px;font-weight:700;color:#e67e00;letter-spacing:1px">상권통 SANGKWONTONG</div>'+
      '<div style="font-size:12px;color:#94a3b8">기준일: '+today+'</div>'+
    '</div>'+
  '</div>'

  // ════════════ S2: 핵심 성과 ════════════
  const s2='<div class="slide" id="s2">'+
    sh('핵심 성과 요약','전체 팀 통합 · 해당월 / 연간누적',2)+
    '<div class="sb">'+
    // 해당월 KPI 4개 (큰 숫자)
    '<div style="background:linear-gradient(135deg,#fff7ed,#fff);border:2px solid #fed7aa;border-radius:12px;padding:14px 18px">'+
      '<div style="font-size:12px;font-weight:700;color:#e67e00;margin-bottom:10px;letter-spacing:0.5px">📅 해당월 실적 ('+period+')</div>'+
      '<div class="g4">'+
      [['#16a34a','총 성공',mTotal,'건',pct(mTotal,Math.max(mAct,1))+'% 전환율'],
       ['#2563eb','MIT 활동완료',mAct,'건','배분 '+mLd+'건 중'],
       ['#e67e00','MIT 활동률',pct(mAct,Math.max(mLd,1)),'%',mAct+' / '+mLd+'건'],
       ['#7c3aed','성공 전환율',pct(mTotal,Math.max(mAct,1)),'%',mTotal+' / '+mAct+'건']
      ].map(([col,lbl,val,unit,sub])=>
        '<div style="background:#fff;border:2px solid '+col+'33;border-radius:10px;padding:14px 10px;text-align:center;position:relative;overflow:hidden">'+
          '<div style="position:absolute;top:0;left:0;right:0;height:4px;background:'+col+'"></div>'+
          '<div style="font-size:48px;font-weight:700;color:'+col+';line-height:1">'+val+'<span style="font-size:20px">'+unit+'</span></div>'+
          '<div style="font-size:13px;color:#374151;font-weight:600;margin-top:4px">'+lbl+'</div>'+
          '<div style="font-size:11px;color:#94a3b8;margin-top:2px">'+sub+'</div>'+
        '</div>'
      ).join('')+
      '</div>'+
    '</div>'+
    // 연간 KPI + 상품 (나란히)
    '<div class="g2" style="flex:1">'+
      // 좌: 연간
      '<div class="card">'+
        '<div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px">📊 연간누적 ('+yearStr+')</div>'+
        '<div class="g2" style="gap:8px;margin-bottom:12px">'+
        [['#16a34a','총 성공',yTotal,'건'],['#2563eb','MIT활동',yAct,'건'],
         ['#e67e00','활동률',pct(yAct,Math.max(mLd,1)),'%'],['#7c3aed','전환율',pct(yTotal,Math.max(yAct,1)),'%']
        ].map(([col,lbl,val,unit])=>
          '<div style="background:#fff;border:1px solid '+col+'33;border-radius:8px;padding:10px;text-align:center">'+
            '<div style="font-size:30px;font-weight:700;color:'+col+';line-height:1">'+val+'<span style="font-size:14px">'+unit+'</span></div>'+
            '<div style="font-size:11px;color:#64748b;margin-top:3px">'+lbl+'</div>'+
          '</div>'
        ).join('')+
        '</div>'+
        // 팀별 비교
        teams.map(t=>'<div style="margin-bottom:8px">'+
          '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:4px">'+
            '<span>'+t.label+'</span>'+
            '<span>해당월 <strong style="color:#16a34a">'+(t.monthly?.success||0)+'건</strong> / 연간 <strong style="color:#475569">'+(t.annual?.success||0)+'건</strong></span>'+
          '</div>'+
          bar(pct(t.monthly?.success||0,Math.max(mTotal,1)),'#16a34a',12)+
          '<div style="font-size:10px;color:#94a3b8;margin-top:3px">MIT활동률 '+pct(t.monthly?.mitDone||0,Math.max(t.mitLeads||1,1))+'%</div>'+
        '</div>').join('')+
      '</div>'+
      // 우: 상품 도넛
      '<div class="card">'+
        '<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px">📦 상품별 성공 실적 (해당월)</div>'+
        '<div style="display:flex;align-items:center;gap:16px;height:calc(100% - 30px)">'+
          '<div class="dw">'+prodDonut(globalProdCounts,mTotal,150)+'<div class="dc"><div style="font-size:32px;font-weight:700;color:#0f172a">'+mTotal+'</div><div style="font-size:11px;color:#64748b">성공건</div></div></div>'+
          '<div style="flex:1">'+
          (mPE.length>0
            ? mPE.slice(0,6).map(([p,cnt])=>'<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">'+
                '<span style="font-size:12px;font-weight:600;min-width:58px">'+p+'</span>'+
                bar(pct(cnt,maxPM),PCOL[p]||'#64748b',13)+
                '<span style="font-size:15px;font-weight:700;color:'+(PCOL[p]||'#64748b')+';min-width:28px;text-align:right">'+cnt+'</span>'+
              '</div>').join('')
            : '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">상품 데이터 없음<br/><span style="font-size:11px">활동 결과 입력 시 자동 집계</span></div>'
          )+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '</div>'+sf(2)+'</div>'

  // ════════════ S3: 4대 프로젝트 개요 (도넛 크게!) ════════════
  const allTot=projects.reduce((a,p)=>a+(p.adminOnly?p.total:p.directTotal),0)
  const mAllD=projects.reduce((a,p)=>a+(p.monthly?.done||p.done||0),0)
  const mAllS=projects.reduce((a,p)=>a+(p.monthly?.success||p.success||0),0)
  const yAllS=projects.reduce((a,p)=>a+(p.annual?.success||p.success||0),0)

  const s3='<div class="slide" id="s3">'+
    sh('4대 프로젝트 성과 개요','프로젝트별 활동 · 해당월 / 연간누적',3)+
    '<div class="sb" style="padding-top:10px">'+
    // 4개 프로젝트 카드 (큰 도넛)
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;flex:1">'+
    projects.map(p=>{
      const col=PC[p.id]||'#2563eb',lite=PL[p.id]||'#dbeafe',brd=PB[p.id]||'#93c5fd',txt=PT[p.id]||'#1e40af'
      const dtot=p.adminOnly?p.total:p.directTotal
      const mD=p.monthly?.done||p.done||0, mS=p.monthly?.success||p.success||0
      const yS=p.annual?.success||p.success||0
      const actR=pct(mD,Math.max(dtot,1)), sucR=pct(mS,Math.max(mD,1))
      return '<div style="background:'+lite+';border:2px solid '+brd+';border-radius:14px;padding:14px 12px;display:flex;flex-direction:column;align-items:center;text-align:center">'+
        '<div style="font-size:11px;font-weight:700;color:'+txt+';margin-bottom:6px;line-height:1.3">'+PI[p.id]+' '+p.id+'. '+PN[p.id]+'</div>'+
        '<div style="font-size:10px;color:'+txt+';opacity:0.6;margin-bottom:10px">'+(p.adminOnly?'관리자 배분 전용':'MM 직접발굴')+'</div>'+
        // 큰 도넛
        '<div class="dw" style="margin-bottom:10px">'+donut(mD,mS,Math.max(dtot,1),col,160,28)+
          '<div class="dc">'+
            '<div style="font-size:34px;font-weight:700;color:'+col+';line-height:1">'+actR+'<span style="font-size:16px">%</span></div>'+
            '<div style="font-size:10px;color:#64748b;margin-top:2px">활동률</div>'+
          '</div>'+
        '</div>'+
        // 숫자 요약
        '<div style="display:flex;gap:8px;margin-bottom:8px;width:100%;justify-content:center">'+
          '<div style="background:#fff;border:1px solid '+brd+';border-radius:7px;padding:6px 10px;flex:1">'+
            '<div style="font-size:22px;font-weight:700;color:'+col+'">'+mD+'</div>'+
            '<div style="font-size:9px;color:#64748b">활동</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #86efac;border-radius:7px;padding:6px 10px;flex:1">'+
            '<div style="font-size:22px;font-weight:700;color:#16a34a">'+mS+'</div>'+
            '<div style="font-size:9px;color:#64748b">성공</div>'+
          '</div>'+
        '</div>'+
        '<div style="font-size:10px;color:#64748b;margin-bottom:6px">연간 누적 <strong style="color:'+txt+'">'+yS+'건</strong> 성공</div>'+
        '<div style="font-size:11px;font-weight:600;color:#059669;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:3px 10px">전환율 '+sucR+'%</div>'+
        '<div style="margin-top:8px;display:flex;gap:3px;flex-wrap:wrap;justify-content:center">'+prBadges(p.prodCounts||{},3)+'</div>'+
      '</div>'
    }).join('')+
    '</div>'+
    // 전체 집계 바
    '<div style="background:#0f172a;border-radius:10px;padding:11px 20px;display:flex;justify-content:space-around;align-items:center">'+
      [['total','총 배분+직접',allTot,'#fff'],['mAllD','해당월 활동',mAllD,'#60a5fa'],['mAllS','해당월 성공',mAllS,'#4ade80'],['yAllS','연간 성공',yAllS,'#94a3b8'],
       ['actR','전체 활동률',pct(mAllD,Math.max(allTot,1))+'%','#fb923c'],['sucR','전환율',pct(mAllS,Math.max(mAllD,1))+'%','#c084fc']
      ].map(([,lbl,val,col],i,arr)=>
        '<div style="text-align:center">'+(i>0?'':'')+'<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-bottom:2px">'+lbl+'</div><div style="font-size:24px;font-weight:700;color:'+col+'">'+val+'</div></div>'+
        (i<arr.length-1?'<div style="width:1px;background:rgba(255,255,255,0.1);height:32px"></div>':'')
      ).join('')+
    '</div>'+
    '</div>'+sf(3)+'</div>'

  // ════════════ S4~7: 프로젝트 상세 ════════════
  function projSlide(p,sn){
    const col=PC[p.id]||'#2563eb',lite=PL[p.id]||'#dbeafe',brd=PB[p.id]||'#93c5fd',txt=PT[p.id]||'#1e40af'
    const dtot=p.adminOnly?p.total:p.directTotal
    const mD=p.monthly?.done||p.done||0,mS=p.monthly?.success||p.success||0
    const yD=p.annual?.done||p.done||0,yS=p.annual?.success||p.success||0
    const pc=p.prodCounts||{},prodE=PRODS.filter(x=>pc[x]).map(x=>[x,pc[x]])
    const maxP=prodE.length?Math.max(...prodE.map(([,v])=>v)):1
    const mm=p.mmStats||[]

    return '<div class="slide" id="s'+sn+'">'+
      stb(PI[p.id]+' '+PN[p.id],(p.adminOnly?'관리자 배분 전용':'MM 직접발굴')+(p.themes?.length?' · 테마 '+p.themes.length+'개':''),sn,col)+
      '<div class="sb">'+
      // KPI 4개 (큰)
      '<div class="g4">'+
      [
        [col,  p.adminOnly?'MIT 배분':'직접 등록', dtot+'건'],
        [col,  '해당월 활동', mD+'건 ('+pct(mD,Math.max(dtot,1))+'%)'],
        ['#16a34a','해당월 성공', mS+'건 ('+pct(mS,Math.max(mD,1))+'%)'],
        ['#475569','연간 누적 성공', yS+'건'],
      ].map(([c,lbl,val])=>
        '<div style="background:'+c+'12;border:2px solid '+c+'33;border-radius:10px;padding:12px 10px;text-align:center;position:relative;overflow:hidden">'+
          '<div style="position:absolute;top:0;left:0;right:0;height:4px;background:'+c+'"></div>'+
          '<div style="font-size:36px;font-weight:700;color:'+c+';line-height:1;margin-top:4px">'+val+'</div>'+
          '<div style="font-size:12px;color:#374151;font-weight:600;margin-top:5px">'+lbl+'</div>'+
        '</div>'
      ).join('')+
      '</div>'+
      '<div class="g2" style="flex:1">'+
      // 좌: 큰 도넛 + 상품
      '<div style="background:'+lite+';border:1.5px solid '+brd+';border-radius:12px;padding:14px;display:flex;flex-direction:column">'+
        '<div style="font-size:13px;font-weight:700;color:'+txt+';margin-bottom:10px">활동 현황 · 해당월 기준</div>'+
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">'+
          '<div class="dw">'+donut(mD,mS,Math.max(dtot,1),col,150,26)+
            '<div class="dc"><div style="font-size:28px;font-weight:700;color:'+col+'">'+pct(mD,Math.max(dtot,1))+'%</div><div style="font-size:10px;color:#64748b">활동률</div></div>'+
          '</div>'+
          '<div style="flex:1">'+dual(mS,yS,'건 성공','#16a34a')+
            '<div style="margin-top:8px;font-size:12px;color:#64748b">'+
              '활동: <strong style="color:'+col+'">'+mD+'건</strong> / 연간 <strong style="color:#475569">'+yD+'건</strong><br/>'+
              '미활동 잔여 <strong style="color:#e67e00">'+(dtot-mD)+'건</strong>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div style="font-size:12px;font-weight:700;color:'+txt+';margin-bottom:7px">상품별 성공</div>'+
        '<div style="flex:1">'+
        (prodE.length
          ? prodE.slice(0,6).map(([pp,cnt])=>
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">'+
              '<span style="font-size:13px;font-weight:600;min-width:58px">'+pp+'</span>'+
              bar(pct(cnt,maxP),PCOL[pp]||col,15)+
              '<span style="font-weight:700;color:'+(PCOL[pp]||col)+';font-size:16px;min-width:24px;text-align:right">'+cnt+'</span>'+
              '</div>'
            ).join('')
          : '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">상품 데이터 없음</div>'
        )+'</div>'+
      '</div>'+
      // 우: 테마 + MM별
      '<div style="display:flex;flex-direction:column;gap:10px">'+
      (p.themes?.length
        ? '<div class="card">'+
          '<div style="font-size:12px;font-weight:700;color:'+txt+';margin-bottom:8px">🏷️ 테마별 활동 현황</div>'+
          '<table><thead><tr><th>테마</th><th>배분</th><th style="color:#93c5fd">활동</th><th style="color:#86efac">성공</th></tr></thead><tbody>'+
          p.themes.map((t,i)=>'<tr><td style="font-weight:600;font-size:12px">'+t.name+'</td><td style="color:#64748b">'+t.total+'</td><td style="color:#2563eb;font-weight:700">'+t.done+'</td><td style="color:#16a34a;font-weight:700;font-size:14px">'+t.success+'</td></tr>').join('')+
          '</tbody></table></div>'
        : ''
      )+
      '<div class="card" style="flex:1">'+
        '<div style="font-size:12px;font-weight:700;color:'+txt+';margin-bottom:6px">👤 담당 MM별 활동 현황</div>'+
        '<div style="font-size:10px;color:#94a3b8;margin-bottom:8px;font-weight:600">해당월 / 연간누적 기준</div>'+
        (mm.length
          ? '<table><thead><tr><th>이름</th><th>팀</th><th>배분</th><th style="color:#93c5fd">해당월<br/>활동</th><th style="color:#86efac">해당월<br/>성공</th><th>연간<br/>성공</th></tr></thead><tbody>'+
            mm.map(m=>{const mDm=m.monthly?.mitDone||0,mSm=m.monthly?.success||0,ySm=m.annual?.success||0,zero=mDm===0&&m.mitAssigned>0
              return '<tr style="'+(zero?'background:#fef2f2':'')+' "><td><strong style="color:'+(zero?'#dc2626':'#0f172a')+'">'+m.name+'</strong></td>'+
                '<td style="font-size:10px;color:#64748b">'+m.team+'</td>'+
                '<td>'+m.mitAssigned+'</td>'+
                '<td style="color:#2563eb;font-weight:700;font-size:14px">'+mDm+'</td>'+
                '<td style="color:#16a34a;font-weight:700;font-size:14px">'+mSm+'</td>'+
                '<td style="color:#64748b;font-weight:600">'+ySm+'</td>'+
              '</tr>'
            }).join('')+
            '</tbody></table>'+
            (mm.some(m=>m.mitAssigned>0&&(m.monthly?.mitDone||0)===0)?'<div style="margin-top:6px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;font-size:11px;color:#991b1b;font-weight:600">⚠ '+mm.filter(m=>m.mitAssigned>0&&(m.monthly?.mitDone||0)===0).map(m=>m.name).join(', ')+' — 해당월 미활동</div>':'')
          : '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">담당 MM 없음</div>'
        )+
      '</div>'+
      '</div>'+
      '</div>'+
      '</div>'+sf(sn)+'</div>'
  }

  const s4=projSlide(projects[0]||{id:1,total:0,directTotal:0,done:0,success:0,prodCounts:{},themes:[],mmStats:[],monthly:{},annual:{}},4)
  const s5=projSlide(projects[1]||{id:2,total:0,directTotal:0,done:0,success:0,prodCounts:{},themes:[],mmStats:[],monthly:{},annual:{}},5)
  const s6=projSlide(projects[2]||{id:3,total:0,directTotal:0,done:0,success:0,prodCounts:{},themes:[],mmStats:[],monthly:{},annual:{}},6)
  const s7=projSlide(projects[3]||{id:4,total:0,directTotal:0,done:0,success:0,prodCounts:{},themes:[],mmStats:[],monthly:{},annual:{}},7)

  // ════════════ S8: 팀별 성과 ════════════
  const s8='<div class="slide" id="s8">'+
    sh('팀별 성과 현황','프로젝트별 · 상품별 · 해당월 / 연간누적',8)+
    '<div class="sb">'+
    '<div class="g2" style="flex:1">'+
    teams.map((t,ti)=>{
      const bg=ti===0?'#0f172a':'#1e3a5f',ms=t.monthly||{},ys=t.annual||{},pc=t.prodCounts||{}
      return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">'+
        '<div style="background:'+bg+';color:#fff;padding:12px 18px">'+
          '<div style="display:flex;justify-content:space-between;align-items:center">'+
            '<div><div style="font-size:20px;font-weight:700">'+t.label+'</div><div style="font-size:12px;opacity:0.45;margin-top:1px">MM '+t.mm+'명</div></div>'+
            dual(ms.success||0,ys.success||0,'건 성공').replace(/color:#2563eb/g,'color:#4ade80').replace(/border:1\.5px solid #2563eb44/,'border:1.5px solid rgba(74,222,128,0.3)').replace(/background:#2563eb15/,'background:rgba(74,222,128,0.12)')+
          '</div>'+
        '</div>'+
        '<div style="padding:14px 16px;flex:1;display:flex;flex-direction:column;gap:10px">'+
        '<div class="g3">'+
          '<div style="text-align:center;background:#f0fdf4;border-radius:9px;padding:10px">'+
            '<div style="font-size:9px;color:#94a3b8;font-weight:600">해당월</div>'+
            '<div style="font-size:32px;font-weight:700;color:#16a34a;line-height:1.1">'+(ms.success||0)+'</div>'+
            '<div style="font-size:11px;color:#64748b">성공건</div>'+
          '</div>'+
          '<div style="text-align:center;background:#eff6ff;border-radius:9px;padding:10px">'+
            '<div style="font-size:9px;color:#94a3b8;font-weight:600">해당월</div>'+
            '<div style="font-size:32px;font-weight:700;color:#2563eb;line-height:1.1">'+(ms.mitDone||0)+'</div>'+
            '<div style="font-size:11px;color:#64748b">MIT활동</div>'+
          '</div>'+
          '<div style="text-align:center;background:#f1f5f9;border-radius:9px;padding:10px">'+
            '<div style="font-size:9px;color:#94a3b8;font-weight:600">연간누적</div>'+
            '<div style="font-size:32px;font-weight:700;color:#475569;line-height:1.1">'+(ys.success||0)+'</div>'+
            '<div style="font-size:11px;color:#64748b">성공건</div>'+
          '</div>'+
        '</div>'+
        '<div>'+
          '<div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:5px">MIT 활동률 · 전환율</div>'+
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px">'+
            '<span style="min-width:52px;font-weight:600">활동률</span>'+
            bar(pct(ms.mitDone||0,Math.max(t.mitLeads||1,1)),'#2563eb',12)+
            '<strong style="color:#2563eb;min-width:36px">'+pct(ms.mitDone||0,Math.max(t.mitLeads||1,1))+'%</strong>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:8px;font-size:12px">'+
            '<span style="min-width:52px;font-weight:600">전환율</span>'+
            bar(pct(ms.success||0,Math.max(ms.mitDone||1,1)),'#16a34a',12)+
            '<strong style="color:#16a34a;min-width:36px">'+pct(ms.success||0,Math.max(ms.mitDone||1,1))+'%</strong>'+
          '</div>'+
        '</div>'+
        '<div>'+
          '<div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px">상품별 성공 실적</div>'+
          '<div style="display:flex;gap:4px;flex-wrap:wrap">'+prBadges(pc,6)+'</div>'+
        '</div>'+
        '</div>'+
      '</div>'
    }).join('')+
    '</div>'+
    '</div>'+sf(8)+'</div>'

  // ════════════ S9: 전직원 세부 ════════════
  const sorted=[...allMM].sort((a,b)=>(b.monthly?.success||b.success||0)-(a.monthly?.success||a.success||0))
  const medals=['🥇','🥈','🥉']
  const s9='<div class="slide" id="s9">'+
    sh('전직원 세부 활동 실적','전원 · 해당월 / 연간누적 · 성공 실적 내림차순',9)+
    '<div class="sb">'+
    '<table>'+
    '<thead><tr><th style="width:28px">#</th><th>이름</th><th>팀</th><th>MIT배분</th>'+
      '<th style="background:#1e3a8a">해당월<br/>활동</th>'+
      '<th style="background:#14532d">해당월<br/>성공</th>'+
      '<th>연간<br/>성공</th>'+
      '<th>직접<br/>발굴</th>'+
      '<th>주요 상품</th>'+
    '</tr></thead><tbody>'+
    sorted.map((m,i)=>{
      const ms=m.monthly||{},ys=m.annual||{}
      const mS=ms.success||m.success||0,yS=ys.success||m.success||0,mD=ms.mitDone||m.mitDone||0
      const zero=mD===0&&(m.mitAssigned||0)>0
      return '<tr style="'+(i===0?'background:#fefce8':zero?'background:#fef2f2':'')+'">'+
        '<td style="font-size:'+(i<3?'18':'13')+'px">'+(medals[i]||'<span style="color:#94a3b8;font-weight:600">'+(i+1)+'</span>')+'</td>'+
        '<td><strong style="font-size:'+(i===0?'15':'12')+'px;color:'+(zero?'#dc2626':'#0f172a')+'">'+m.name+'</strong></td>'+
        '<td style="font-size:11px;color:#64748b">'+m.team+'</td>'+
        '<td style="font-size:13px">'+m.mitAssigned+'</td>'+
        '<td style="color:#2563eb;font-weight:700;font-size:'+(i===0?'18':'14')+'px;background:#eff6ff">'+mD+'</td>'+
        '<td style="color:#16a34a;font-weight:700;font-size:'+(i===0?'20':'15')+'px;background:#f0fdf4">'+mS+'</td>'+
        '<td style="color:#475569;font-weight:600;font-size:13px">'+yS+'</td>'+
        '<td style="color:'+(ms.directDone>0?'#059669':'#94a3b8')+';font-weight:'+(ms.directDone>0?'700':'400')+'">'+(ms.directDone||0)+'</td>'+
        '<td>'+prBadges(m.prodCounts||{},3)+'</td>'+
      '</tr>'
    }).join('')+
    '</tbody></table>'+
    (sorted.some(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0)
      ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:9px 14px;font-size:12px;color:#991b1b;font-weight:600;margin-top:4px">⚠ '+sorted.filter(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0).map(m=>m.name).join(', ')+' — 해당월 활동 0건. 즉각 확인 필요</div>'
      : '')+
    '</div>'+sf(9)+'</div>'

  // ════════════ S10: 성과 우수자 ════════════
  const top5=[...allMM].sort((a,b)=>(b.monthly?.success||b.success||0)-(a.monthly?.success||a.success||0)).slice(0,5)
  const mCirc=['#f59e0b','#94a3b8','#b45309','#cbd5e1','#cbd5e1']
  const s10='<div class="slide" id="s10">'+
    sh('성과 우수자 현황','해당월 성공 기준 · 연간누적 병행 표시',10)+
    '<div style="padding:12px 32px 14px;flex:1;display:grid;grid-template-columns:1.4fr 0.6fr;gap:18px">'+
    '<div style="display:flex;flex-direction:column;gap:8px">'+
    (top5[0]?'<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:#fefce8;border:2px solid #fde68a;border-radius:12px">'+
      '<div style="width:44px;height:44px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🥇</div>'+
      '<div style="flex:1">'+
        '<div style="font-size:20px;font-weight:700">'+top5[0].name+'</div>'+
        '<div style="font-size:12px;color:#64748b;margin-bottom:5px">'+top5[0].team+' · MIT '+(top5[0].monthly?.mitDone||0)+'건 활동 · 직접발굴 '+(top5[0].monthly?.directDone||0)+'건</div>'+
        '<div style="display:flex;gap:3px;flex-wrap:wrap">'+prBadges(top5[0].prodCounts||{},5)+'</div>'+
      '</div>'+
      dual(top5[0].monthly?.success||0,top5[0].annual?.success||0,'건 성공','#16a34a')+
    '</div>':'<div style="color:#94a3b8;font-size:13px;padding:16px">성과 데이터 없음</div>')+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;flex:1">'+
    top5.slice(1).map((m,i)=>'<div style="display:flex;align-items:center;gap:9px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">'+
      '<div style="width:34px;height:34px;border-radius:50%;background:'+mCirc[i+1]+';display:flex;align-items:center;justify-content:center;font-size:'+(i<2?'18':'12')+'px;font-weight:700;color:#fff;flex-shrink:0">'+(medals[i+1]||(i+2))+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:14px;font-weight:700">'+m.name+'</div>'+
        '<div style="font-size:11px;color:#64748b">'+m.team+'</div>'+
        '<div style="display:flex;gap:2px;margin-top:3px;flex-wrap:wrap">'+prBadges(m.prodCounts||{},2)+'</div>'+
      '</div>'+
      '<div style="text-align:right;flex-shrink:0">'+
        '<div style="font-size:26px;font-weight:700;color:#16a34a;line-height:1">'+(m.monthly?.success||0)+'</div>'+
        '<div style="font-size:10px;color:#94a3b8">연간 '+(m.annual?.success||0)+'건</div>'+
      '</div>'+
    '</div>').join('')+
    '</div>'+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:10px">'+
    '<div class="card">'+
      '<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px">팀별 달성 현황</div>'+
      teams.map(t=>'<div style="margin-bottom:12px">'+
        '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:4px">'+
          '<span>'+t.label+'</span>'+
          '<span><strong style="color:#16a34a">'+(t.monthly?.success||0)+'건</strong> / 연간 <strong style="color:#64748b">'+(t.annual?.success||0)+'건</strong></span>'+
        '</div>'+
        bar(pct(t.monthly?.success||0,Math.max(mTotal,1)),'#16a34a',14)+
        '<div style="font-size:11px;color:#94a3b8;margin-top:3px">활동률 '+pct(t.monthly?.mitDone||0,Math.max(t.mitLeads||1,1))+'%</div>'+
      '</div>').join('')+
    '</div>'+
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:13px;flex:1">'+
      '<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:10px">이달 핵심 성과</div>'+
      '<div style="font-size:13px;color:#374151;line-height:2.2">'+
        (top5[0]?'<div>최고 <strong style="color:#16a34a;font-size:16px">'+(top5[0].monthly?.success||0)+'건</strong> '+top5[0].name+'</div>':'')+
        '<div>해당월 전체 <strong style="color:#16a34a">'+mTotal+'건</strong></div>'+
        '<div>연간 누적 <strong style="color:#475569">'+yTotal+'건</strong></div>'+
        '<div>MIT 활동률 <strong style="color:#e67e00">'+pct(mAct,Math.max(mLd,1))+'%</strong></div>'+
        (sorted.some(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0)?'<div style="color:#dc2626">'+sorted.filter(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0).map(m=>m.name).join('·')+' 미활동</div>':'')+
      '</div>'+
    '</div>'+
    '</div>'+
    '</div>'+sf(10)+'</div>'

  const navBtns=Array.from({length:N},(_,i)=>'<button class="nb" onclick="document.getElementById(\'s'+(i+1)+'\').scrollIntoView({behavior:\'smooth\'})">'+(i+1)+'</button>').join('')
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
    '<title>상권통 영업 보고서 - '+period+'</title><style>'+css+'</style></head><body>'+
    '<div class="nav">'+navBtns+'<button class="np" onclick="window.print()">인쇄/PDF</button></div>'+
    s1+s2+s3+s4+s5+s6+s7+s8+s9+s10+
    '</body></html>'
}


  const downloadActivity = async () => {
    setDlLoading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip(); const photoFolder = zip.folder('사진'); const dateStr = new Date().toISOString().slice(0,10)
      const myMMNames = myUsers.map(u=>u.name)
      const myMMUsernames = myUsers.map(u=>u.username)
      const filteredLeads = isSuper ? leads : leads.filter(l=>myMMNames.includes(l.assigned_to))
      const filteredDirect = isSuper ? directLeads : directLeads.filter(l=>myMMUsernames.includes(l.mm_username))
      const allItems = [...filteredLeads.map(l=>({...l,_type:'관리자배분',_name:l.address||'-'})),...filteredDirect.map(l=>({...l,_type:'직접발굴',_name:l.customer||'-'}))]
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
    { id: 'staff',     label: '직원관리', icon: '🧑‍💼' },
    { id: 'upload',    label: '업로드',   icon: '📤' },
    { id: 'leads',     label: '프로젝트', icon: '🎯' },
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
      {shareLead && <ShareModal lead={shareLead} mmName={shareLead.assigned_to || ''} onClose={() => setShareLead(null)} />}
      {showMultiAssign && <MultiAssignModal selectedIds={selectedIds} leads={leads} users={myUsers} onClose={() => setShowMultiAssign(false)} onSave={handleMultiAssign} />}
      {assignTarget && (
        <AssignOneModal lead={assignTarget} users={myUsers} onClose={() => setAssignTarget(null)}
          onSave={async (mmName, projectType, theme) => {
            const pos = saveScroll()
            try {
              const patch = { assigned_to: mmName, assign_status: '배분완료', project_type: projectType }
              if (theme !== undefined) patch.project_name = theme
              await db.patch('connector_leads', 'id=eq.' + assignTarget.id, patch)
              t2(mmName + ' MM에게 배분 완료!')
              setAssignTarget(null)
              load(null, pos)
            } catch(e) { t2('배분 실패: ' + e.message) }
          }}
        />
      )}

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
            <div key={i} style={{ flex: 1, background: s.hi ? '#fef2f2' : '#f8fafc', border: '1.5px solid ' + (s.hi ? C.red : '#e2e8f0'), borderRadius: '8px', padding: '5px 6px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ fontSize: s.hi ? '18px' : '15px', fontWeight: '900', color: s.hi ? C.red : C.acc }}>{s.v}{s.u}</span>
              <span style={{ fontSize: s.hi ? '12px' : '11px', color: s.hi ? C.red : C.sub, fontWeight: s.hi ? '700' : '400' }}>{s.l}</span>
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
            {/* 뷰 선택: pill 스타일 강조 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {[{v:'전체 활동',icon:'📊'},{v:'프로젝트별',icon:'📁'},...(isSuper?[{v:'팀별 현황',icon:'👥'}]:[])].map(({v,icon}) => (
                <button key={v} onClick={() => setDashView(v)}
                  style={{ padding: '8px 16px', background: dashView === v ? C.text : '#fff', border: '2px solid ' + (dashView === v ? C.text : '#e2e8f0'), color: dashView === v ? '#fff' : C.sub, borderRadius: '50px', fontSize: '13px', fontWeight: dashView === v ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', boxShadow: dashView === v ? '0 2px 8px rgba(0,0,0,0.15)' : 'none', transition: 'all 0.15s' }}>
                  {icon} {v}
                </button>
              ))}
            </div>

            {/* 기간 선택 */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['일간','주간','월간','연간'].map(p => (<button key={p} onClick={() => setPeriod(p)} style={{ padding: '7px 12px', background: period === p ? C.acc : '#fff', border: '1px solid ' + (period === p ? C.acc : '#e2e8f0'), color: period === p ? '#fff' : C.sub, borderRadius: '20px', fontSize: '13px', fontWeight: period === p ? '900' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>))}
              {period === '월간' && (
                <select value={actMonth} onChange={e => setActMonth(Number(e.target.value))}
                  style={{ padding: '7px 8px', border: '1px solid ' + C.acc, borderRadius: '20px', fontSize: '12px', color: C.acc, fontWeight: '800', outline: 'none', background: C.accBg, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {Array.from({length:12},(_,i) => <option key={i+1} value={i+1}>{i+1}월</option>)}
                </select>
              )}
            </div>

            {/* 전체 활동 뷰 */}
            {dashView === '전체 활동' && (
              <>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {['전체', ...myUsers.map(u => u.name)].map(mm => (<button key={mm} onClick={() => setSelMM(mm)} style={{ padding: '6px 12px', background: selMM === mm ? C.accBg : '#fff', border: '1px solid ' + (selMM === mm ? C.acc : '#e2e8f0'), color: selMM === mm ? C.acc : C.sub, borderRadius: '20px', fontSize: '12px', fontWeight: selMM === mm ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{mm}</button>))}
                </div>
                <DashboardSection leads={leads} directLeads={directLeads} users={users} period={period} actMonth={actMonth} selMM={selMM} isSuper={isSuper} teamId={adminInfo?.teamId} />
              </>
            )}

            {/* 프로젝트별 뷰 - 4대 프로젝트 기반 */}
            {dashView === '프로젝트별' && (() => {
              const now = new Date()
              function inP(dateStr) {
                if (period==='전체') return true
                if (!dateStr) return false
                try {
                  const d = new Date(dateStr)
                  if (period==='일간') return d.toDateString()===now.toDateString()
                  if (period==='주간') { const s=new Date(now);s.setDate(now.getDate()-now.getDay());const e=new Date(s);e.setDate(s.getDate()+6);return d>=s&&d<=e }
                  if (period==='월간') return d.getFullYear()===now.getFullYear()&&d.getMonth()+1===actMonth
                  if (period==='연간') return d.getFullYear()===now.getFullYear()
                } catch{}; return true
              }
              const myUnames = myUsers.map(u=>u.username)
              const myUNames = myUsers.map(u=>u.name)
              return (
                <div>
                  {PT.map(pt => {
                    // 배분 리드 (project_type 기준)
                    const ptLeads = leads.filter(l => l.project_type === pt.id && myUNames.includes(l.assigned_to))
                    const ptFiltered = ptLeads.filter(l => inP(l.activity_at))
                    const ptDone = ptFiltered.filter(l=>l.activity_status&&l.activity_status!=='미처리').length
                    const ptSuccess = ptFiltered.filter(l=>l.activity_status==='성공')
                    // 직접발굴 (3,4번만)
                    const ptDirect = !pt.adminOnly
                      ? directLeads.filter(l => myUnames.includes(l.mm_username) && l.project_type===pt.id).filter(l=>inP(l.activity_at))
                      : []
                    const ptDirectSuccess = ptDirect.filter(l=>l.activity_status==='성공')
                    // 테마 목록
                    const themes = [...new Set(ptLeads.map(l=>l.project_name).filter(Boolean))]
                    // 상품 집계
                    function countProds(successList) {
                      const pc={}
                      successList.forEach(l=>{
                        const pr=Array.isArray(l.products)?l.products:(()=>{try{return JSON.parse(l.products||'[]')}catch{return[]}})()
                        pr.forEach(p=>{pc[p]=(pc[p]||0)+1})
                      })
                      return pc
                    }
                    const pc = countProds([...ptSuccess, ...ptDirectSuccess])
                    const allSuccess = ptSuccess.length + ptDirectSuccess.length
                    const totalActivity = ptLeads.length + ptDirect.length
                    const borderColor = allSuccess > 0 ? C.green : ptDone > 0 ? C.blue : '#e2e8f0'
                    return (
                      <div key={pt.id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderLeft:'4px solid '+borderColor, borderRadius:'14px', padding:'16px', marginBottom:'14px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                        {/* 헤더 */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                          <div>
                            <div style={{ fontSize:'16px', fontWeight:'900', color:C.text }}>{pt.icon} {pt.id}. {pt.label}</div>
                            <div style={{ fontSize:'11px', color:C.sub, marginTop:'2px' }}>
                              {pt.adminOnly ? '관리자 배분 전용' : 'MM 직접등록 가능'}
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:'22px', fontWeight:'900', color:C.green }}>{allSuccess}</div>
                            <div style={{ fontSize:'10px', color:C.sub }}>성공건</div>
                          </div>
                        </div>
                        {/* KPI */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'10px' }}>
                          {[
                            {l:'전체배분', v:ptLeads.length, c:C.text},
                            {l:'활동완료', v:ptDone, c:C.blue},
                            {l:'성공', v:ptSuccess.length, c:C.green},
                            {l:'직접발굴', v:ptDirect.length, c:'#7c3aed'}
                          ].map((s,i)=>(
                            <div key={i} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'8px', textAlign:'center' }}>
                              <div style={{ fontSize:'18px', fontWeight:'900', color:s.c }}>{s.v}</div>
                              <div style={{ fontSize:'10px', color:C.sub, marginTop:'1px' }}>{s.l}</div>
                            </div>
                          ))}
                        </div>
                        {/* 활동률 바 */}
                        <div style={{ background:'#e8edf2', borderRadius:'4px', height:'8px', overflow:'hidden', marginBottom:'4px' }}>
                          <div style={{ width:Math.min(pct(ptDone, Math.max(ptLeads.length,1)),100)+'%', background:C.blue, height:'100%', borderRadius:'4px' }}/>
                        </div>
                        <div style={{ fontSize:'11px', color:C.sub, marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
                          <span>MIT활동률 {pct(ptDone, Math.max(ptLeads.length,1))}%</span>
                          <span>성공률 {pct(allSuccess, Math.max(ptDone+ptDirectSuccess.length,1))}%</span>
                        </div>
                        {/* 상품별 */}
                        {Object.keys(pc).length > 0 && (
                          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', padding:'8px 10px', marginBottom:'10px' }}>
                            <div style={{ fontSize:'11px', fontWeight:'700', color:C.green, marginBottom:'5px' }}>📦 성공 상품별</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                              {['인터넷','TV','다량회선','모바일','일반전화','하이오더','로봇','CCTV'].filter(p=>pc[p]).map(p=>(
                                <span key={p} style={{ background:'#fff', border:'1px solid #bbf7d0', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:'700', color:C.green }}>{p} {pc[p]}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 테마별 */}
                        {themes.length > 0 && (
                          <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'8px 10px' }}>
                            <div style={{ fontSize:'11px', fontWeight:'700', color:C.sub, marginBottom:'6px' }}>🏷️ 테마별 활동 현황</div>
                            {themes.map(tn => {
                              const tl = ptLeads.filter(l=>l.project_name===tn)
                              const tf = tl.filter(l=>inP(l.activity_at))
                              const td = tf.filter(l=>l.activity_status&&l.activity_status!=='미처리').length
                              const ts = tf.filter(l=>l.activity_status==='성공').length
                              return (
                                <div key={tn} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'12px', padding:'4px 0', borderBottom:'1px solid #e2e8f0' }}>
                                  <span style={{ color:C.text, fontWeight:'600' }}>• {tn}</span>
                                  <span style={{ color:C.sub }}>
                                    전체 {tl.length} · 활동 {td} · <span style={{ color:C.green, fontWeight:'800' }}>성공 {ts}</span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* 팀별 현황 뷰 (총괄만) */}
            {dashView === '팀별 현황' && isSuper && (
              <TeamDashboard adminInfo={adminInfo} users={users} leads={leads} directLeads={directLeads} mDiscovery={mDiscovery} adminAccounts={adminAccounts} isSuper={isSuper} onUpdateLabel={() => load()} />
            )}
          </div>
        )}

        {/* ── 활동결과 ─────────────────────────────────────────────── */}
        {tab === 'activity' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.text }}>활동결과</h2>
              <button onClick={() => load()} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: C.sub, padding: '7px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>🔄</button>
            </div>
            {/* 활동결과 뷰 선택 - pill 스타일 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {[{v:'전체',icon:'📋'},{v:'팀별',icon:'👥'},{v:'프로젝트별',icon:'📁'},{v:'테마별',icon:'🏷️'}].map(({v,icon}) => (
                <button key={v} onClick={() => { setActView(v); setActTeam('전체'); setActProj('전체'); setActTheme('전체') }}
                  style={{ padding: '7px 14px', background: actView === v ? C.acc : '#fff', border: '2px solid ' + (actView === v ? C.acc : '#e2e8f0'), color: actView === v ? '#fff' : C.sub, borderRadius: '50px', fontSize: '12px', fontWeight: actView === v ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {icon} {v}
                </button>
              ))}
            </div>
            {/* 기간 필터 */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['전체','일간','주간','월간','연간'].map(p => (
                <button key={p} onClick={() => setActPeriod(p)}
                  style={{ padding: '6px 11px', background: actPeriod === p ? C.text : '#fff', border: '1px solid ' + (actPeriod === p ? C.text : '#e2e8f0'), color: actPeriod === p ? '#fff' : C.sub, borderRadius: '20px', fontSize: '12px', fontWeight: actPeriod === p ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{p}</button>
              ))}
              {actPeriod === '월간' && (
                <select value={actMonth} onChange={e => setActMonth(Number(e.target.value))}
                  style={{ padding: '6px 8px', border: '1px solid ' + C.acc, borderRadius: '20px', fontSize: '12px', color: C.acc, fontWeight: '800', outline: 'none', background: C.accBg, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {Array.from({length:12},(_,i) => <option key={i+1} value={i+1}>{i+1}월</option>)}
                </select>
              )}
            </div>
            {(() => {
              const now = new Date()
              function inActP(dateStr) {
                if (actPeriod === '전체') return true
                if (!dateStr) return false
                try {
                  const d = new Date(dateStr)
                  if (actPeriod === '일간') return d.toDateString() === now.toDateString()
                  if (actPeriod === '주간') { const s2=new Date(now);s2.setDate(now.getDate()-now.getDay());const e2=new Date(s2);e2.setDate(s2.getDate()+6);return d>=s2&&d<=e2 }
                  if (actPeriod === '월간') return d.getFullYear()===now.getFullYear()&&d.getMonth()+1===actMonth
                  if (actPeriod === '연간') return d.getFullYear()===now.getFullYear()
                } catch { return false }
                return false
              }
              const myUN = myUsers.map(u => u.name)
              const myUnames = myUsers.map(u => u.username)
              // 팀 정보 (총괄용)
              const teamLabels = isSuper ? [...new Set(adminAccounts.filter(a=>a.team_label).map(a=>a.team_label))] : []
              function getTeamLabel(teamId) { return adminAccounts.find(a=>a.team_id===teamId)?.team_label || teamId }
              function getUserTeamLabel(username) { const u=users.find(x=>x.username===username||x.name===username); return u?getTeamLabel(u.team_id):'-' }

              let baseLeads = leads.filter(l => myUN.includes(l.assigned_to)).filter(l => inActP(l.activity_at))
              let baseDirect = directLeads.filter(l => myUnames.includes(l.mm_username)).filter(l => inActP(l.activity_at))

              // 팀별 필터
              if (actView === '팀별' && actTeam !== '전체') {
                const teamUsernames = users.filter(u=>getTeamLabel(u.team_id)===actTeam).map(u=>u.name)
                const teamMMusers = users.filter(u=>getTeamLabel(u.team_id)===actTeam).map(u=>u.username)
                baseLeads = baseLeads.filter(l=>teamUsernames.includes(l.assigned_to))
                baseDirect = baseDirect.filter(l=>teamMMusers.includes(l.mm_username))
              }
              // 프로젝트별 필터
              if ((actView === '프로젝트별' || actView === '테마별') && actProj !== '전체') {
                baseLeads = baseLeads.filter(l=>l.project_name===actProj)
              }
              // 테마별 필터
              if (actView === '테마별' && actTheme !== '전체') {
                baseLeads = baseLeads.filter(l=>l.theme_name===actTheme)
              }

              const allBase = [
                ...baseLeads.map(l=>({...l,_type:'배분',_name:l.address||l.col2||'-'})),
                ...baseDirect.map(l=>({...l,_type:'직접발굴',_name:l.customer||'-'}))
              ].sort((a,b)=>new Date(b.activity_at||0)-new Date(a.activity_at||0))
              const stCounts = {'전체': allBase.length, ...Object.fromEntries(ST.map(s=>[s, allBase.filter(l=>(l.activity_status||'미처리')===s).length]))}
              const allProjs = [...new Set(leads.filter(l=>myUN.includes(l.assigned_to)).map(l=>l.project_name).filter(Boolean))]
              const allThemes = actProj!=='전체' ? [...new Set(leads.filter(l=>l.project_name===actProj).map(l=>l.theme_name).filter(Boolean))] : [...new Set(leads.filter(l=>myUN.includes(l.assigned_to)).map(l=>l.theme_name).filter(Boolean))]
              const filtered = filterSt === '전체' ? allBase : allBase.filter(l => (l.activity_status||'미처리') === filterSt)

              return (
                <>
                  {/* 뷰별 서브 필터 */}
                  {actView === '팀별' && isSuper && teamLabels.length > 0 && (
                    <div style={{ display:'flex', gap:'5px', marginBottom:'8px', overflowX:'auto' }}>
                      {['전체',...teamLabels].map(t => (
                        <button key={t} onClick={()=>setActTeam(t)}
                          style={{ padding:'5px 11px', background:actTeam===t?C.blue:'#fff', border:'1px solid '+(actTeam===t?C.blue:'#e2e8f0'), color:actTeam===t?'#fff':C.sub, borderRadius:'20px', fontSize:'12px', fontWeight:actTeam===t?'800':'500', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>{t}</button>
                      ))}
                    </div>
                  )}
                  {(actView === '프로젝트별' || actView === '테마별') && (
                    <div style={{ display:'flex', gap:'5px', marginBottom:'6px', overflowX:'auto' }}>
                      {['전체',...allProjs].map(p => (
                        <button key={p} onClick={()=>{setActProj(p);setActTheme('전체')}}
                          style={{ padding:'5px 11px', background:actProj===p?'#1e293b':'#fff', border:'1px solid '+(actProj===p?'#1e293b':'#e2e8f0'), color:actProj===p?'#fff':C.sub, borderRadius:'20px', fontSize:'12px', fontWeight:actProj===p?'800':'500', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>📁 {p}</button>
                      ))}
                    </div>
                  )}
                  {actView === '테마별' && allThemes.length > 0 && (
                    <div style={{ display:'flex', gap:'5px', marginBottom:'8px', overflowX:'auto' }}>
                      {['전체',...allThemes].map(t => (
                        <button key={t} onClick={()=>setActTheme(t)}
                          style={{ padding:'5px 11px', background:actTheme===t?'#7c3aed':'#fff', border:'1px solid '+(actTheme===t?'#7c3aed':'#e2e8f0'), color:actTheme===t?'#fff':C.sub, borderRadius:'20px', fontSize:'12px', fontWeight:actTheme===t?'800':'500', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>🏷️ {t}</button>
                      ))}
                    </div>
                  )}
                  {/* 상태 필터 + 건수 */}
                  <div style={{ display:'flex', gap:'5px', marginBottom:'12px', overflowX:'auto', paddingBottom:'2px' }}>
                    {['전체',...ST].map(s => (
                      <button key={s} onClick={() => setFilterSt(s)}
                        style={{ padding:'6px 10px', background:filterSt===s?(s==='전체'?C.acc:SC[s]?.dot||C.acc):'#fff', border:'1px solid '+(filterSt===s?(s==='전체'?C.acc:SC[s]?.dot||C.acc):'#e2e8f0'), color:filterSt===s?'#fff':C.sub, borderRadius:'20px', fontSize:'12px', fontWeight:filterSt===s?'800':'500', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                        {s} <span style={{ opacity:0.85 }}>({stCounts[s]})</span>
                      </button>
                    ))}
                  </div>
                  {/* 카드 목록 */}
                  {filtered.length === 0
                    ? <div style={{ textAlign:'center', padding:'40px 20px', color:C.sub }}>해당 조건의 활동 결과가 없습니다</div>
                    : filtered.map((l, idx2) => {
                        const photos = (() => { try { return JSON.parse(l.photos||'[]') } catch { return [] } })()
                        const mmName = l.assigned_to || (users.find(u=>u.username===l.mm_username)?.name || l.mm_username)
                        return (
                          <div key={l.id+l._type+idx2} style={{ background:'#fff', border:'1px solid #e2e8f0', borderLeft:'4px solid '+(l._type==='배분'?C.acc:C.green), borderRadius:'12px', padding:'14px', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                              <div style={{ flex:1, marginRight:'10px' }}>
                                <div style={{ display:'flex', gap:'5px', alignItems:'center', marginBottom:'4px', flexWrap:'wrap' }}>
                                  <span style={{ fontSize:'11px', color:l._type==='배분'?C.acc:C.green, fontWeight:'700' }}>{l._type==='배분'?'📤 관리자배분':'🔍 직접발굴'}</span>
                                  <span style={{ fontSize:'11px', color:C.sub }}>· {mmName} MM</span>
                                  {l.project_type && <span style={{ fontSize:'10px', background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', padding:'2px 7px', borderRadius:'8px', fontWeight:'700', marginRight:'3px' }}>{ptIcon(l.project_type)} {ptLabel(l.project_type)}</span>}
                 {l.project_name && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', padding:'1px 6px', borderRadius:'8px' }}>🏷️ {l.project_name}</span>}
                                  {l.theme_name && <span style={{ fontSize:'10px', background:'#fdf4ff', color:'#7c3aed', border:'1px solid #e9d5ff', padding:'1px 6px', borderRadius:'8px' }}>🏷️ {l.theme_name}</span>}
                                </div>
                                <div style={{ fontSize:'14px', fontWeight:'800', color:C.text }}>{l._name}</div>
                                {l.activity_at && <div style={{ fontSize:'11px', color:C.sub, marginTop:'3px' }}>📅 {fmtAt(l.activity_at)}</div>}
                                {l.products?.length > 0 && (
                                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'4px' }}>
                                    {l.products.map(p => <span key={p} style={{ fontSize:'10px', background:'#eff6ff', color:C.blue, border:'1px solid #bfdbfe', padding:'2px 6px', borderRadius:'4px', fontWeight:'700' }}>📦 {p}</span>)}
                                  </div>
                                )}
                              </div>
                              <Badge s={l.activity_status || '미처리'} />
                            </div>
                            {(l.activity_contact || l.activity_result || l.activity_memo) && (
                              <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'8px 10px', marginBottom:'8px', fontSize:'13px', color:C.sub }}>
                                {l.activity_contact && <div>📞 {l.activity_contact}</div>}
                                {l.activity_result && <div>📝 {l.activity_result}</div>}
                                {l.activity_memo && <div>💬 {l.activity_memo}</div>}
                              </div>
                            )}
                            {photos.length > 0 && <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>{photos.map((src,i) => <img key={i} src={src} alt="사진" style={{ width:'60px', height:'60px', objectFit:'cover', borderRadius:'8px', border:'1px solid #e2e8f0' }} />)}</div>}
                            <button onClick={() => setShareLead(l)} style={{ width:'100%', background:'#fff7ed', border:'1.5px solid #fed7aa', color:C.acc, padding:'9px', borderRadius:'8px', fontSize:'13px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', marginTop:'4px' }}>
                              📤 채널 공유 문자 만들기
                            </button>
                          </div>
                        )
                      })
                  }
                </>
              )
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: '900', color: C.text }}>{u.name} MM</span>
                        {u.team_id && <span style={{ background: C.blueBg, color: C.blue, fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>{TEAMS.find(t => t.id === u.team_id)?.label}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', fontWeight: '700', padding: '2px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>ID: {u.username}</span>
                        <span style={{ color: C.sub, fontSize: '13px' }}>{u.region}</span>
                      </div>
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
            {/* 4대 프로젝트 선택 */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.text, marginBottom: '8px' }}>
                📊 프로젝트 선택 <span style={{ color: C.red }}>*</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {PT.map(p => (
                  <button key={p.id} onClick={() => setUpPT(p.id)}
                    style={{ padding: '10px 14px', background: upPT === p.id ? C.text : '#fff', border: '2px solid ' + (upPT === p.id ? C.text : '#e2e8f0'), color: upPT === p.id ? '#fff' : C.sub, borderRadius: '10px', fontSize: '13px', fontWeight: upPT === p.id ? '800' : '500', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{p.icon}</span>
                    <div>
                      <div style={{ fontWeight: '800' }}>{p.id}. {p.label}</div>
                      {p.adminOnly && <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '1px' }}>관리자 배분 전용</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* 테마명 입력 (선택사항) */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.text, marginBottom: '6px' }}>
                🏷️ 테마명 <span style={{ color: C.sub, fontSize: '12px', fontWeight: '400' }}>(선택 · 예: 김해_테크노밸리_260427)</span>
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
                  <button onClick={handleUpload} disabled={uploading || !projectName.trim()} style={{ flex: 2, padding: '13px', background: (uploading || !projectName.trim()) ? '#e2e8f0' : C.acc, border: 'none', color: (uploading || !projectName.trim()) ? C.sub : '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: (uploading || !projectName.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{uploading ? '업로드 중...' : (!upPT ? '프로젝트를 선택하세요' : `${uploadPreview.length}건 업로드`)}</button>
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
                <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: C.text }}>프로젝트 관리 <span style={{ fontSize: '14px', color: C.sub, fontWeight: '400' }}>({filtered.length}건)</span></h2>
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

            {/* 프로젝트 필터 + 이름 수정 */}
            {allProjects.length >= 1 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', color: C.sub, fontWeight: '600' }}>📁 프로젝트 선택</div>
                  <button onClick={() => setShowProjEdit(!showProjEdit)}
                    style={{ background: showProjEdit ? C.accBg : '#f8fafc', border: '1px solid ' + (showProjEdit ? C.acc : '#e2e8f0'), color: showProjEdit ? C.acc : C.sub, padding: '3px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✏️ 프로젝트명 수정
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {allProjects.map(p => (
                    <button key={p} onClick={() => setFilterProject(p)}
                      style={{ padding: '5px 12px', background: filterProject === p ? '#1e293b' : '#fff', border: '1px solid ' + (filterProject === p ? '#1e293b' : '#e2e8f0'), color: filterProject === p ? '#fff' : C.sub, borderRadius: '20px', fontSize: '12px', fontWeight: filterProject === p ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{p}</button>
                  ))}
                </div>
                {/* 프로젝트명 수정 패널 */}
                {showProjEdit && filterProject !== '전체' && (
                  <div style={{ background: C.accBg, border: '1px solid ' + C.accBorder, borderRadius: '10px', padding: '12px', marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: C.acc, marginBottom: '8px' }}>📝 「{filterProject}」 수정</div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input value={projRenameVal} onChange={e=>setProjRenameVal(e.target.value)} placeholder="새 프로젝트명"
                        style={{ flex:1, padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:'inherit', background:'#fff' }}/>
                      <button onClick={async () => {
                        if (!projRenameVal.trim() || projRenameVal === filterProject) return
                        const pos = saveScroll()
                        try {
                          // DB에서 해당 프로젝트명의 모든 lead 업데이트
                          const targets = leads.filter(l=>l.project_name===filterProject)
                          for (const l of targets) await db.patch('connector_leads','id=eq.'+l.id,{project_name:projRenameVal.trim()})
                          t2('프로젝트명 변경 완료!')
                          setFilterProject(projRenameVal.trim())
                          setProjRenameVal('')
                          load(null, pos)
                        } catch(e) { t2('변경 실패: '+e.message) }
                      }} style={{ background:C.acc, border:'none', color:'#fff', padding:'8px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>변경</button>
                    </div>
                    {/* 테마 관리 */}
                    <div style={{ borderTop:'1px solid '+C.accBorder, paddingTop:'8px' }}>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:C.acc, marginBottom:'6px' }}>🏷️ 테마 관리 (현재 프로젝트 하위 분류)</div>
                      {[...new Set(leads.filter(l=>l.project_name===filterProject).map(l=>l.theme_name).filter(Boolean))].map(tn => (
                        <div key={tn} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px',padding:'4px 0',borderBottom:'1px solid '+C.accBorder }}>
                          <span style={{ color:C.text,fontWeight:'600' }}>🔸 {tn}</span>
                          <span style={{ color:C.sub }}>{leads.filter(l=>l.project_name===filterProject&&l.theme_name===tn).length}건</span>
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
                        <input value={newThemeVal} onChange={e=>setNewThemeVal(e.target.value)} placeholder="새 테마명 (예: 녹산공단 1차)"
                          style={{ flex:1, padding:'7px 10px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'12px', outline:'none', fontFamily:'inherit', background:'#fff' }}/>
                        <button onClick={async () => {
                          if (!newThemeVal.trim() || filterProject==='전체') return
                          // 선택된 프로젝트+미배분 leads에 테마 적용
                          const pos = saveScroll()
                          const targets = leads.filter(l=>l.project_name===filterProject&&!l.theme_name)
                          if (!targets.length) { t2('적용할 건이 없습니다 (이미 테마 지정됨)'); return }
                          try {
                            for (const l of targets.slice(0,100)) await db.patch('connector_leads','id=eq.'+l.id,{theme_name:newThemeVal.trim()})
                            t2(Math.min(targets.length,100)+'건에 테마 적용!')
                            setNewThemeVal(''); load(null, pos)
                          } catch(e) { t2('적용 실패') }
                        }} style={{ background:C.green, border:'none', color:'#fff', padding:'7px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>적용</button>
                      </div>
                    </div>
                  </div>
                )}
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
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'5px' }}>
                   {l.project_type && <span style={{ background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', padding:'2px 7px', borderRadius:'8px', fontSize:'11px', fontWeight:'700' }}>{ptIcon(l.project_type)} {ptLabel(l.project_type)}</span>}
                   {l.project_name && <span style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', padding:'2px 6px', borderRadius:'8px', fontSize:'11px' }}>🏷️ {l.project_name}</span>}
                 </div>}
                  {/* A~E열 표시 */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', paddingRight: selectMode ? '28px' : '0' }}>
                    {[l.col1, l.col2, l.col3, l.col4, l.col5].map((v, i) => v ? (
                      <div key={i} style={{ flex: i < 2 ? '1 1 44%' : '1 1 28%', minWidth: '70px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '10px', color: C.sub, marginBottom: '2px' }}>{['A','B','C','D','E'][i]}열</div>
                        {i === 3 ? (
                          <span style={{ fontSize: '11px', fontWeight: '800', background: '#eff6ff', color: C.blue, border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '5px', display: 'inline-block' }}>📦 {v}</span>
                        ) : (
                          <div style={{ fontSize: i === 1 ? '13px' : '12px', fontWeight: '700', color: i === 0 ? C.acc : i === 1 ? C.text : C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
                        )}
                      </div>
                    ) : null)}
                  {/* 테마 표시 */}
                  {l.theme_name && <div style={{ width:'100%', marginTop:'4px' }}><span style={{ fontSize:'10px', background:'#fdf4ff', color:'#7c3aed', border:'1px solid #e9d5ff', padding:'2px 7px', borderRadius:'5px', fontWeight:'700' }}>🏷️ {l.theme_name}</span></div>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selectMode ? '0' : '8px' }}>
                    {l.assign_status === '배분완료' && <div style={{ fontSize: '13px', fontWeight: '700', color: C.green }}>👤 {l.assigned_to} MM · <span style={{ color: C.sub }}>{l.activity_status || '미처리'}</span></div>}
                    <span style={{ marginLeft: 'auto', background: l.assign_status === '미배분' ? '#fffbeb' : '#f0fdf4', color: l.assign_status === '미배분' ? '#b45309' : C.green, border: '1px solid ' + (l.assign_status === '미배분' ? '#fde68a' : '#bbf7d0'), fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>{l.assign_status}</span>
                  </div>

                  {!selectMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setAssignTarget(l)}
                          style={{ flex: 1, background: l.assign_status === '배분완료' ? '#f8fafc' : C.accBg, border: '1px solid ' + (l.assign_status === '배분완료' ? '#e2e8f0' : C.accBorder), color: l.assign_status === '배분완료' ? C.sub : C.acc, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {l.assign_status === '배분완료' ? '⚡ 재배분 / 수정' : '👤 MM 배분하기'}
                        </button>
                        {isSuper && <button onClick={() => {
                          const pos = saveScroll()
                          if (window.confirm('이 영업기회를 삭제하시겠습니까?')) db.del('connector_leads', 'id=eq.' + l.id).then(() => { t2('삭제 완료'); load(null, pos) }).catch(() => t2('삭제 실패'))
                        }} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: C.red, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>}
                      </div>
                      {/* 채널 공유 버튼 - 배분완료 건만 */}
                      {l.assign_status === '배분완료' && (
                        <button onClick={() => setShareLead(l)}
                          style={{ width: '100%', background: '#fff7ed', border: '1.5px solid #fed7aa', color: C.acc, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>
                          📤 채널 공유 문자 만들기
                        </button>
                      )}
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
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '20px' }}>
              {isSuper ? '전체 팀 데이터' : adminInfo?.name + ' 소속 직원 데이터'}를 내려받습니다
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* ① MM 성과 현황 */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px', color: C.text }}>📊 MM 성과 현황</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px' }}>이름 · 팀 · 지역 · 성공건수 · 목표 · 달성률</p>
                <button onClick={downloadPerf} style={{ width: '100%', background: C.acc, border: 'none', color: '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
                  📥 성과현황 ({myUsers.length}명)
                </button>
              </div>

              {/* ② 활동결과 ZIP - 일반관리자: 본인팀 직원 결과만 */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px', color: C.text }}>📋 영업기회 활동결과 (ZIP)</div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '4px' }}>관리자 배분 + 직접발굴 통합 · 사진 포함</p>
                <p style={{ color: C.acc, fontSize: '12px', marginBottom: '14px' }}>CSV + 사진폴더를 ZIP으로 다운로드</p>
                <button onClick={downloadActivity} disabled={dlLoading} style={{ width: '100%', background: dlLoading ? '#e2e8f0' : C.green, border: 'none', color: dlLoading ? C.sub : '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: dlLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {dlLoading ? '⏳ 생성 중...' : '📥 활동결과 ZIP (' + (leads.length + directLeads.length) + '건)'}
                </button>
              </div>

              {/* ③ 슬라이드 장표 - 모든 관리자 */}
              <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: C.text }}>🖥️ 슬라이드 장표 (HTML)</div>
                  <span style={{ background: '#eff6ff', color: C.blue, border: '1px solid #bfdbfe', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>오프라인 회의용</span>
                </div>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '4px' }}>팀별 성과 · 프로젝트 진행 · 우수직원 슬라이드</p>
                <p style={{ color: C.blue, fontSize: '12px', marginBottom: '14px' }}>
                  {isSuper ? '전체 팀 기준 · ' : adminInfo?.name + ' 기준 · '}브라우저에서 열어 인쇄/PDF 저장
                </p>
                <button onClick={() => {
                  // 팀 데이터 구성 (총괄: 전체팀, 일반: 본인팀)
                  // ── 실시간 데이터 구성 ──────────────────────────────
                  const slideAccs = isSuper
                    ? adminAccounts.filter(a => a.team_label)
                    : adminAccounts.filter(a => a.team_id === adminInfo?.teamId)

                  // 상품별 집계 헬퍼
                  function calcProdCounts(successLeads) {
                    const pc = {}
                    successLeads.forEach(l => {
                      const pr = Array.isArray(l.products) ? l.products
                        : (()=>{try{return JSON.parse(l.products||'[]')}catch{return[]}})()
                      pr.forEach(p => { pc[p] = (pc[p]||0)+1 })
                    })
                    return pc
                  }

                  // 팀별 데이터 (0명 팀 제외, 상품별 성공건수 포함)
                  const teamData = (slideAccs.length > 0 ? slideAccs : [{
                    team_id: adminInfo?.teamId, team_label: adminInfo?.name || '우리팀'
                  }]).map(acc => {
                    const tm = users.filter(u => u.team_id === acc.team_id)
                    if (tm.length === 0) return null
                    const tl = leads.filter(l => tm.map(u=>u.name).includes(l.assigned_to))
                    const td = directLeads.filter(l => tm.some(u=>u.username===l.mm_username))
                    const mitDone = tl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length
                    const successLeads = tl.filter(l=>l.activity_status==='성공')
                    const successDirect = td.filter(l=>l.activity_status==='성공')
                    return {
                      label: acc.team_label || acc.name || '팀',
                      mm: tm.length,
                      success: tm.reduce((a,u)=>a+(u.success||0),0),
                      goal: tm.reduce((a,u)=>a+(u.goal||10),0),
                      mitLeads: tl.length,
                      mitDone,
                      bulkRegistered: mDiscovery.filter(m=>tm.some(u=>u.username===m.registered_by)||m.team_id===acc.team_id).length,
                      prodCounts: calcProdCounts([...successLeads, ...successDirect])  // 팀 상품별 성공건수 (배분+직접발굴)
                    }
                  }).filter(Boolean)

                  // 전체 상품별 성공건수 (배분 + 직접발굴 모두 포함)
                  const myUnames = myUsers.map(u=>u.username)
                  const allSuccessLeads = leads.filter(l => myUsers.map(u=>u.name).includes(l.assigned_to) && l.activity_status==='성공')
                  const allSuccessDirect = directLeads.filter(l => myUnames.includes(l.mm_username) && l.activity_status==='성공')
                  const globalProdCounts = calcProdCounts([...allSuccessLeads, ...allSuccessDirect])

                  // 4대 프로젝트별 데이터
                  const projData = [1,2,3,4].map(ptId => {
                    // 배분 리드
                    const pl = leads.filter(l=>l.project_type===ptId && myUsers.map(u=>u.name).includes(l.assigned_to))
                    // 직접발굴 (3,4번)
                    const dl = (ptId>=3) ? directLeads.filter(l=>myUnames.includes(l.mm_username) && l.project_type===ptId) : []
                    const allLeads = [...pl, ...dl]
                    const successLeads = allLeads.filter(l=>l.activity_status==='성공')
                    const pt = PT.find(p=>p.id===ptId)
                    // 테마 목록
                    const themes = [...new Set(pl.map(l=>l.project_name).filter(Boolean))].map(tn => {
                      const tl = pl.filter(l=>l.project_name===tn)
                      return { name: tn, total: tl.length, done: tl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length, success: tl.filter(l=>l.activity_status==='성공').length }
                    })
                    return {
                      id: ptId,
                      name: pt?.label || '-',
                      icon: pt?.icon || '📁',
                      adminOnly: pt?.adminOnly || false,
                      total: pl.length,
                      directTotal: dl.length,
                      done: pl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                      success: successLeads.length,
                      prodCounts: calcProdCounts(successLeads),
                      themes
                    }
                  })

                  // 전직원 세부 데이터
                  const allMMData = myUsers.map(u => {
                    const uLeads = leads.filter(l=>l.assigned_to===u.name)
                    const uDirect = directLeads.filter(l=>l.mm_username===u.username)
                    const acc = slideAccs.find(a=>a.team_id===u.team_id)
                    const uSuccess = uLeads.filter(l=>l.activity_status==='성공')
                    return {
                      name: u.name,
                      team: acc?.team_label || adminInfo?.name || '-',
                      success: u.success||0,
                      goal: u.goal||10,
                      mitAssigned: uLeads.length,
                      mitDone: uLeads.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                      directDone: uDirect.length,
                      prodCounts: calcProdCounts(uSuccess)
                    }
                  })

                  const topData = [...allMMData].sort((a,b)=>b.success-a.success).slice(0,5)
                  const mDiscoveryTotal = isSuper ? mDiscovery.length : mDiscovery.filter(m=>m.team_id===adminInfo?.teamId).length

                  // 오늘 날짜 / 해당 월 / 연간 기준
                  const todayD = new Date()
                  const todayStr = todayD.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})
                  const curYear = todayD.getFullYear()
                  const curMonth = todayD.getMonth()+1
                  const periodStr = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long'})

                  // 기간 필터 헬퍼
                  function isThisMonth(dt) { if(!dt) return false; try{ const d=new Date(dt); return d.getFullYear()===curYear&&d.getMonth()+1===curMonth }catch{ return false } }
                  function isThisYear(dt)  { if(!dt) return false; try{ const d=new Date(dt); return d.getFullYear()===curYear }catch{ return false } }

                  // 팀별 월간+연간 데이터 (프로젝트별 MM 상세 포함)
                  const teamDataFull = (slideAccs.length>0?slideAccs:[{team_id:adminInfo?.teamId,team_label:adminInfo?.name||'우리팀'}]).map(acc=>{
                    const tm = users.filter(u=>u.team_id===acc.team_id)
                    if(tm.length===0) return null
                    const tl = leads.filter(l=>tm.map(u=>u.name).includes(l.assigned_to))
                    const td = directLeads.filter(l=>tm.some(u=>u.username===l.mm_username))
                    function teamStats(filterFn) {
                      const fl=tl.filter(l=>filterFn(l.activity_at))
                      const fd=td.filter(l=>filterFn(l.activity_at))
                      return {
                        mitLeads: tl.length,
                        mitDone: fl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                        success: fl.filter(l=>l.activity_status==='성공').length + fd.filter(l=>l.activity_status==='성공').length,
                        goal: tm.reduce((a,u)=>a+(u.goal||10),0),
                        prodCounts: calcProdCounts([...fl,...fd].filter(l=>l.activity_status==='성공'))
                      }
                    }
                    return {
                      label: acc.team_label||acc.name||'팀', mm: tm.length,
                      monthly: teamStats(isThisMonth),
                      annual:  teamStats(isThisYear),
                      // 기존 호환성
                      success: tm.reduce((a,u)=>a+(u.success||0),0),
                      goal: tm.reduce((a,u)=>a+(u.goal||10),0),
                      mitLeads: tl.length,
                      mitDone: tl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                      bulkRegistered: mDiscovery.filter(m=>tm.some(u=>u.username===m.registered_by)||m.team_id===acc.team_id).length,
                      prodCounts: calcProdCounts(tl.filter(l=>l.activity_status==='성공'))
                    }
                  }).filter(Boolean)

                  // 4대 프로젝트 데이터 (MM별 상세 포함)
                  const projDataFull = [1,2,3,4].map(ptId=>{
                    const pl = leads.filter(l=>l.project_type===ptId&&myUsers.map(u=>u.name).includes(l.assigned_to))
                    const dl = ptId>=3 ? directLeads.filter(l=>myUnames.includes(l.mm_username)&&l.project_type===ptId) : []
                    const pt = PT.find(p=>p.id===ptId)
                    function projStats(filterFn) {
                      const fl=pl.filter(l=>filterFn(l.activity_at))
                      const fd=dl.filter(l=>filterFn(l.activity_at))
                      const succ=[...fl,...fd].filter(l=>l.activity_status==='성공')
                      return { done: fl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length, success: succ.length, prodCounts: calcProdCounts(succ) }
                    }
                    // 담당 MM별 상세 (프로젝트 기준)
                    const mmStats = myUsers.map(u=>{
                      const uLeads = pl.filter(l=>l.assigned_to===u.name)
                      const uDirect = dl.filter(l=>l.mm_username===u.username)
                      const acc2 = slideAccs.find(a=>a.team_id===u.team_id)
                      if(uLeads.length===0&&uDirect.length===0) return null
                      const mMonthly = { mitDone: uLeads.filter(l=>isThisMonth(l.activity_at)&&l.activity_status&&l.activity_status!=='미처리').length, success: uLeads.filter(l=>isThisMonth(l.activity_at)&&l.activity_status==='성공').length + uDirect.filter(l=>isThisMonth(l.activity_at)&&l.activity_status==='성공').length }
                      const mAnnual  = { mitDone: uLeads.filter(l=>isThisYear(l.activity_at)&&l.activity_status&&l.activity_status!=='미처리').length, success: uLeads.filter(l=>isThisYear(l.activity_at)&&l.activity_status==='성공').length + uDirect.filter(l=>isThisYear(l.activity_at)&&l.activity_status==='성공').length }
                      return { name:u.name, team:acc2?.team_label||'-', mitAssigned:uLeads.length, directDone:uDirect.length, monthly:mMonthly, annual:mAnnual }
                    }).filter(Boolean)
                    const themes = [...new Set(pl.map(l=>l.project_name).filter(Boolean))].map(tn=>{
                      const tl2=pl.filter(l=>l.project_name===tn)
                      return { name:tn, total:tl2.length, done:tl2.filter(l=>l.activity_status&&l.activity_status!=='미처리').length, success:tl2.filter(l=>l.activity_status==='성공').length }
                    })
                    return { id:ptId, name:pt?.label||'-', icon:pt?.icon||'📁', adminOnly:pt?.adminOnly||false,
                      total:pl.length, directTotal:dl.length,
                      done:pl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                      success:pl.filter(l=>l.activity_status==='성공').length+dl.filter(l=>l.activity_status==='성공').length,
                      monthly: projStats(isThisMonth), annual: projStats(isThisYear),
                      prodCounts: calcProdCounts([...pl,...dl].filter(l=>l.activity_status==='성공')),
                      themes, mmStats }
                  })

                  // 전직원 월간+연간
                  const allMMDataFull = myUsers.map(u=>{
                    const uLeads = leads.filter(l=>l.assigned_to===u.name)
                    const uDirect = directLeads.filter(l=>l.mm_username===u.username)
                    const acc2 = slideAccs.find(a=>a.team_id===u.team_id)
                    function mmStats2(filterFn) {
                      const fl=uLeads.filter(l=>filterFn(l.activity_at))
                      const fd=uDirect.filter(l=>filterFn(l.activity_at))
                      return { mitDone: fl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length, directDone: fd.length, success: fl.filter(l=>l.activity_status==='성공').length+fd.filter(l=>l.activity_status==='성공').length, prodCounts: calcProdCounts([...fl,...fd].filter(l=>l.activity_status==='성공')) }
                    }
                    return { name:u.name, team:acc2?.team_label||adminInfo?.name||'-', mitAssigned:uLeads.length, directDone:uDirect.length, success:u.success||0, goal:u.goal||10, monthly:mmStats2(isThisMonth), annual:mmStats2(isThisYear), prodCounts:calcProdCounts(uLeads.filter(l=>l.activity_status==='성공')) }
                  })
                  const topDataFull = [...allMMDataFull].sort((a,b)=>b.success-a.success).slice(0,5)

                  // 전체 상품별 (월간+연간)
                  const allSuccM = [...leads.filter(l=>myUsers.map(u=>u.name).includes(l.assigned_to)&&l.activity_status==='성공'&&isThisMonth(l.activity_at)), ...directLeads.filter(l=>myUnames.includes(l.mm_username)&&l.activity_status==='성공'&&isThisMonth(l.activity_at))]
                  const allSuccY = [...leads.filter(l=>myUsers.map(u=>u.name).includes(l.assigned_to)&&l.activity_status==='성공'&&isThisYear(l.activity_at)), ...directLeads.filter(l=>myUnames.includes(l.mm_username)&&l.activity_status==='성공'&&isThisYear(l.activity_at))]
                  const globalProdMonthly = calcProdCounts(allSuccM)
                  const globalProdAnnual  = calcProdCounts(allSuccY)

                  const html = buildSlideHTML({
                    period: periodStr, today: todayStr, yearStr: curYear+'년',
                    teams: teamDataFull, projects: projDataFull,
                    allMM: allMMDataFull, topMM: topDataFull,
                    mDiscoveryCount: mDiscoveryTotal,
                    globalProdCounts: globalProdMonthly,
                    globalProdAnnual
                  })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
                  a.download = '상권통_보고서_' + new Date().toISOString().slice(0,7) + '.html'
                  a.click()
                  t2('슬라이드 장표 다운로드 완료!')
                }} style={{ width: '100%', background: C.blue, border: 'none', color: '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
                  🖨️ 슬라이드 장표 다운로드
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

    </div>
  )
}
