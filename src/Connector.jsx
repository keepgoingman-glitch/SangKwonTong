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
  const [workDays, setWorkDays] = useState({1:0,2:0,3:0,4:0,5:18,6:22,7:23,8:21,9:22,10:22,11:20,12:23})
  const [slideTeamIds, setSlideTeamIds] = useState([])  // [] = 전체 선택
  const [workDaysEdit, setWorkDaysEdit] = useState(null)  // 편집 중인 값
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
  const [actResultView, setActResultView] = useState('도표')  // '카드'|'도표'
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
      const uq = (ai?.role === 'team' && ai?.teamId) ? 'team_id=eq.' + ai.teamId + '&order=created_at.asc&limit=2000' : 'order=created_at.asc&limit=2000'
      // photos 컬럼 제외 (base64 대용량 → 타임아웃 원인)
      const lSel = 'select=id,col1,col2,col3,col4,col5,address,products,assigned_to,assign_status,activity_status,activity_result,activity_memo,activity_contact,activity_at,team_id,project_name,theme_name,project_type'
      const dSel = 'select=id,mm_username,customer,address,contact,products,note,project_type,activity_status,activity_result,activity_memo,activity_contact,activity_at,created_at'
      const lq = (ai?.role === 'team' && ai?.teamId)
        ? lSel + '&team_id=eq.' + ai.teamId + '&order=created_at.desc&limit=2000'
        : lSel + '&order=created_at.desc&limit=2000'
      const mdq = (ai?.role === 'team' && ai?.teamId) ? 'team_id=eq.' + ai.teamId + '&order=created_at.desc&limit=500' : 'order=created_at.desc&limit=500'
      if (ai?.role === 'super') {
        db.get('admin_accounts', 'role=eq.team&order=username.asc').then(r => setAdminAccounts(r || [])).catch(()=>{})
      }
      // mm_direct_leads: photos 제외 + 팀 필터 (mm_users 로드 후 필터)
      const [u, l, dlRaw, md] = await Promise.all([
        db.get('mm_users', uq),
        db.get('connector_leads', lq),
        db.get('mm_direct_leads', dSel + '&order=created_at.desc&limit=2000'),
        db.get('m_discovery', mdq).catch(() => [])
      ])
      // 팀관리자: mm_direct_leads을 해당 팀 MM만 필터
      const teamUnames = u.map(x => x.username)
      const dl = (ai?.role === 'team') ? dlRaw.filter(d => teamUnames.includes(d.mm_username)) : dlRaw
      setUsers(u); setLeads(l); setDirectLeads(dl); setMDiscovery(md)
      // 영업일수 설정 로드
      db.get('app_settings', 'id=eq.biz_days_2026').then(rows => {
        if(rows && rows.length > 0) {
          try {
            const parsed = JSON.parse(rows[0].value)
            const normalized = {}
            Object.keys(parsed).forEach(k => { normalized[parseInt(k)] = parseInt(parsed[k]) || 0 })
            setWorkDays(normalized)
          } catch(e) {}
        }
      }).catch(()=>{})
      if (scrollPos !== undefined) restoreScroll(scrollPos)
    } catch (e) { 
      const msg = e.name==='AbortError' ? '로드 시간 초과 - 재시도해주세요' : '로드 오류: '+e.message
      t2(msg) }
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
      for (const row of uploadPreview) { const { _headers, ...dbRow } = row; await db.post('connector_leads', { ...dbRow, project_name: projectName.trim() || '기본', project_type: upPT || 1 }) }
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
// ── 슬라이드 장표 HTML v7 (v7 샘플 디자인 반영) ──────────────────
function buildSlideHTML({ period, today, yearStr, teams, projects, allMM, topMM,
  mDiscoveryCount, globalProdCounts={}, globalProdAnnual={},
  bizDays=0, perMMTarget=0, workDaysAll={}, allDailyStats=[], _debug={} }) {

  const pct=(n,d)=>d>0?Math.round(n/d*100):0
  const sucRate=(s,a)=>a>0?Math.round(s/a*100):0
  const PRODS=['인터넷','TV','다량회선','모바일','일반전화','하이오더','로봇','CCTV']
  const PCOL={인터넷:'#2563eb',TV:'#3b82f6',다량회선:'#22c55e',모바일:'#16a34a',일반전화:'#64748b',하이오더:'#e67e00',로봇:'#7c3aed',CCTV:'#0891b2'}
  const PC={1:'#2563eb',2:'#7c3aed',3:'#0891b2',4:'#059669'}
  const PI={1:'🏭',2:'🏗️',3:'🏢',4:'🤝'}
  const PN={1:'기업체 통신환경 개선공사',2:'세움터 신축건물',3:'빌딩/상가 공략',4:'직접 판매'}

  // 영업일수 기반 목표 (팀별 MM 수 합산 - CS/관리자 계정 제외)
  const mmCount=teams.reduce((a,t)=>a+(t.mm||0),0)||allMM.length||1
  const totalMonthTarget=perMMTarget*mmCount
  const annualBizDays=Object.values(workDaysAll).reduce((a,v)=>a+(v||0),0)
  const annualTargetPerMM=annualBizDays*5
  const annualTotalTarget=annualTargetPerMM*mmCount

  // 헬퍼
  // ── SVG 꺾은선 차트 (일별 트렌드) ──────────────────────────────
  function svgLineChart(dailyData, width, height, opts) {
    if(!dailyData||dailyData.length===0) return '<div style="display:flex;align-items:center;justify-content:center;height:'+height+'px;background:#f8fafc;border-radius:8px;color:#94a3b8;font-size:11px">데이터 없음</div>'
    opts=opts||{}
    const pad={t:18,r:10,b:24,l:28}
    const W=width-pad.l-pad.r, H=height-pad.t-pad.b
    // act/suc 둘 다 없으면 생략
    const maxVal=Math.max(1,...dailyData.map(d=>(d.act||0)))
    const scaleY=v=>H-Math.round(v/maxVal*H)
    const scaleX=(i,n)=>Math.round(i/(Math.max(n-1,1))*W)
    // Y축 눈금
    const yTicks=[0,Math.round(maxVal/2),maxVal].filter((v,i,a)=>a.indexOf(v)===i)
    let s=`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`
    // 배경
    s+=`<rect width="${width}" height="${height}" fill="#fff" rx="6"/>`
    // Y 그리드
    yTicks.forEach(v=>{const y=pad.t+scaleY(v);s+=`<line x1="${pad.l}" y1="${y}" x2="${pad.l+W}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5"/><text x="${pad.l-3}" y="${y+4}" text-anchor="end" font-size="8" fill="#94a3b8">${v}</text>`})
    // X축 날짜
    // 모든 날짜 표시 (1일~오늘)
    dailyData.forEach((d,i)=>{
      const x=pad.l+scaleX(i,dailyData.length)
      s+=`<text x="${x}" y="${height-5}" text-anchor="middle" font-size="7" fill="#94a3b8">${d.day}</text>`
    })
    // 활동 라인 (파랑)
    if(dailyData.some(d=>d.act>0)){
      const pts=dailyData.map((d,i)=>`${pad.l+scaleX(i,dailyData.length)},${pad.t+scaleY(d.act||0)}`).join(' ')
      s+=`<polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`
      dailyData.forEach((d,i)=>{
        if(d.act===0&&i>0&&dailyData[i-1]?.act===0) return
        const x=pad.l+scaleX(i,dailyData.length), y=pad.t+scaleY(d.act||0)
        s+=`<circle cx="${x}" cy="${y}" r="2.5" fill="#2563eb"/>`
        if(d.act>0) s+=`<text x="${x}" y="${y-5}" text-anchor="middle" font-size="8" fill="#1d4ed8" font-weight="600">${d.act}</text>`
      })
    }
    // 성공 라인 (초록)
    if(dailyData.some(d=>d.suc>0)){
      const pts=dailyData.map((d,i)=>`${pad.l+scaleX(i,dailyData.length)},${pad.t+scaleY(d.suc||0)}`).join(' ')
      s+=`<polyline points="${pts}" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="3,2" stroke-linejoin="round" stroke-linecap="round"/>`
      dailyData.forEach((d,i)=>{
        if(d.suc===0) return
        const x=pad.l+scaleX(i,dailyData.length), y=pad.t+scaleY(d.suc||0)
        s+=`<circle cx="${x}" cy="${y}" r="2.5" fill="#16a34a"/>`
        s+=`<text x="${x}" y="${y-5}" text-anchor="middle" font-size="8" fill="#15803d" font-weight="600">${d.suc}</text>`
      })
    }
    // 범례
    s+=`<rect x="${pad.l}" y="2" width="7" height="7" rx="1" fill="#2563eb"/><text x="${pad.l+10}" y="9" font-size="8" fill="#2563eb">활동</text>`
    s+=`<rect x="${pad.l+38}" y="2" width="7" height="7" rx="1" fill="#16a34a"/><text x="${pad.l+48}" y="9" font-size="8" fill="#16a34a">성공</text>`
    s+=`</svg>`
    return s
  }

  // ── 누적 SVG 꺾은선 차트 ─────────────────────────────────────────
  function svgCumChart(dailyData, width, height) {
    if(!dailyData||dailyData.length===0) return '<div style="display:flex;align-items:center;justify-content:center;height:'+height+'px;background:#f8fafc;border-radius:8px;color:#94a3b8;font-size:11px">데이터 없음</div>'
    const pad={t:18,r:10,b:24,l:28}
    const W=width-pad.l-pad.r, H=height-pad.t-pad.b
    // 누적값 계산
    let cumAct=0, cumSuc=0
    const cumData=dailyData.map(d=>{cumAct+=(d.act||0);cumSuc+=(d.suc||0);return{day:d.day,cumAct,cumSuc}})
    const maxVal=Math.max(1,...cumData.map(d=>d.cumAct))
    const scaleY=v=>H-Math.round(v/maxVal*H)
    const scaleX=(i,n)=>Math.round(i/(Math.max(n-1,1))*W)
    const yTicks=[0,Math.round(maxVal/2),maxVal].filter((v,i,a)=>a.indexOf(v)===i)
    let s=`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`
    s+=`<rect width="${width}" height="${height}" fill="#fff" rx="6"/>`
    yTicks.forEach(v=>{const y=pad.t+scaleY(v);s+=`<line x1="${pad.l}" y1="${y}" x2="${pad.l+W}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5"/><text x="${pad.l-3}" y="${y+4}" text-anchor="end" font-size="8" fill="#94a3b8">${v}</text>`})
    // 모든 날짜 표시
    cumData.forEach((d,i)=>{
      const x=pad.l+scaleX(i,cumData.length)
      s+=`<text x="${x}" y="${height-5}" text-anchor="middle" font-size="7" fill="#94a3b8">${d.day}</text>`
    })
    // 누적활동 면적
    const apts=cumData.map((d,i)=>`${pad.l+scaleX(i,cumData.length)},${pad.t+scaleY(d.cumAct)}`).join(' ')
    const firstX=pad.l+scaleX(0,cumData.length), lastX=pad.l+scaleX(cumData.length-1,cumData.length)
    s+=`<polygon points="${firstX},${pad.t+H} ${apts} ${lastX},${pad.t+H}" fill="#2563eb22"/>`
    s+=`<polyline points="${apts}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>`
    cumData.forEach((d,i)=>{
      if(i===0||i===cumData.length-1||d.cumAct>0){
        const x=pad.l+scaleX(i,cumData.length), y=pad.t+scaleY(d.cumAct)
        s+=`<circle cx="${x}" cy="${y}" r="3" fill="#2563eb"/>`
        s+=`<text x="${x}" y="${y-5}" text-anchor="middle" font-size="9" fill="#1d4ed8" font-weight="700">${d.cumAct}</text>`
      }
    })
    // 누적성공
    const spts=cumData.map((d,i)=>`${pad.l+scaleX(i,cumData.length)},${pad.t+scaleY(d.cumSuc)}`).join(' ')
    s+=`<polyline points="${spts}" fill="none" stroke="#16a34a" stroke-width="2" stroke-dasharray="4,2" stroke-linejoin="round"/>`
    cumData.forEach((d,i)=>{
      if(i===cumData.length-1&&d.cumSuc>0){
        const x=pad.l+scaleX(i,cumData.length), y=pad.t+scaleY(d.cumSuc)
        s+=`<circle cx="${x}" cy="${y}" r="3" fill="#16a34a"/>`
        s+=`<text x="${x}" y="${y-5}" text-anchor="middle" font-size="9" fill="#15803d" font-weight="700">${d.cumSuc}</text>`
      }
    })
    s+=`<rect x="${pad.l}" y="2" width="7" height="7" rx="1" fill="#2563eb"/><text x="${pad.l+10}" y="9" font-size="8" fill="#2563eb">누적활동</text>`
    s+=`<rect x="${pad.l+52}" y="2" width="7" height="7" rx="1" fill="#16a34a"/><text x="${pad.l+62}" y="9" font-size="8" fill="#16a34a">누적성공</text>`
    s+=`</svg>`
    return s
  }

  function prodBadges(pc,lim){lim=lim||4;return PRODS.filter(p=>pc[p]).slice(0,lim).map(p=>`<span style="background:${PCOL[p]}22;color:${PCOL[p]};padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;display:inline-block;margin:2px">${p} ${pc[p]}</span>`).join('')}
  function bar(w,col,h){h=h||8;return`<div style="flex:1;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:${Math.min(w,100)}%;height:${h}px;background:${col};border-radius:3px"></div></div>`}

  const N=10
  // CSS
  const css=`*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif;background:#d4dae3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{width:297mm;min-height:210mm;background:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;margin:0 auto 20px;page-break-after:always;page-break-inside:avoid}
@media screen{body{padding:20px;display:flex;flex-direction:column;align-items:center;gap:20px}.slide{box-shadow:0 8px 36px rgba(0,0,0,0.2)}}
@media print{@page{size:A4 landscape;margin:0}body{background:#fff;padding:0;gap:0}.slide{margin:0;box-shadow:none;width:100vw;min-height:100vh}.nav{display:none!important}}
.rh{background:#0d1b2a;color:#fff;padding:6px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.rt{font-size:14px;font-weight:700;letter-spacing:-0.3px;display:flex;align-items:center;gap:8px}
.rb{font-size:11px;background:#e67e00;color:#fff;padding:2px 10px;border-radius:3px}
.rp{font-size:11px;color:rgba(255,255,255,0.5);text-align:right;line-height:1.7}
.rf{background:#0d1b2a;color:rgba(255,255,255,0.4);padding:4px 18px;font-size:10px;display:flex;justify-content:space-between;flex-shrink:0}
.db{background:#1e3a5f;padding:5px 18px;display:flex;align-items:center;gap:16px;flex-shrink:0;font-size:12px;color:rgba(255,255,255,0.85)}
.db strong{color:#fff}.db .hi{color:#4ade80}.db .warn{color:#fbbf24}.db .sep{width:1px;height:14px;background:rgba(255,255,255,0.2)}
.sb{flex:1;padding:7px 14px;display:flex;flex-direction:column;gap:7px}
.sct{font-size:12px;font-weight:700;color:#fff;background:#1e293b;padding:5px 12px;display:flex;align-items:center}
.sct span{font-size:11px;background:rgba(255,255,255,0.15);padding:1px 8px;border-radius:2px;font-weight:400;margin-left:6px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{padding:6px 7px;font-weight:600;font-size:11px;border:0.5px solid rgba(255,255,255,0.15);text-align:center;white-space:nowrap;letter-spacing:-0.2px}
td{padding:6px 7px;border:0.5px solid #c8d0da;text-align:center;vertical-align:middle;white-space:nowrap;font-size:12px}
.h0{background:#0f172a;color:#fff}.h1{background:#1e3a5f;color:#fff}.h2{background:#2d5a8e;color:#fff}
.hg{background:#14532d;color:#fff}.ho{background:#7c2d12;color:#fff}.hp{background:#4c1d95;color:#fff}
.ht{background:#134e4a;color:#fff}.hy{background:#78350f;color:#fff}
.hwk{background:#0f4c75;color:#fff}.hmo{background:#1a3a5c;color:#fff}.hac{background:#1a2e1a;color:#fff}
tr.tot td{background:#0f172a;color:#fff;font-weight:700;font-size:12px}
tr.sub td{background:#dde5ef;font-weight:700;color:#0f172a;font-size:12px}
tr:not(.tot):not(.sub):nth-child(even) td{background:#f2f5f9}
.gc{background:#c6f6d5!important;color:#065f46;font-weight:700}
.rc{background:#fed7d7!important;color:#991b1b;font-weight:700}
.oc{background:#feebc8!important;color:#9a3412;font-weight:700}
.bc{background:#bee3f8!important;color:#1a365d;font-weight:700}
.yc{background:#fef9c3!important;color:#854d0e;font-weight:700}
.up{color:#15803d;font-weight:700}.dn{color:#dc2626;font-weight:700}
.nav{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:3px;background:rgba(10,15,30,0.93);padding:7px 12px;border-radius:40px;z-index:100}
.nb{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:10px;font-weight:600;cursor:pointer}.nb:hover{background:rgba(255,255,255,0.3)}
.np{padding:0 12px;height:22px;border-radius:20px;background:#e67e00;border:none;color:#fff;font-weight:700;cursor:pointer;font-size:10px}`

  // 공통 배너
  const dayBanner=`<div class="db">
    <span> <strong>${period}</strong></span><div class="sep"></div>
    <span>영업일 <strong class="hi">${bizDays}일</strong></span><div class="sep"></div>
    <span>1인목표 <strong class="warn">${perMMTarget}건</strong> (5건×${bizDays}일)</span><div class="sep"></div>
    <span>${mmCount}명 합계목표 <strong>${totalMonthTarget}건</strong></span><div class="sep"></div>
    <span>기준일 <strong>${today}</strong></span>
  </div>`

  const sf=(n)=>`<div class="rf"><span>상권통 영업 보고서 · ${period}</span><span style="color:#e67e00;font-weight:600">영업일 ${bizDays}일 | 1인목표 ${perMMTarget}건 | 기준일 ${today}</span><span>${n} / ${N}</span></div>`
  const rh=(title,badge,n)=>`<div class="rh"><div class="rt">${title} <span class="rb">${badge}</span></div><div class="rp">${period} · ${n} / ${N}</div></div>`

  // 집계
  const mTotal=allMM.reduce((a,m)=>a+(m.monthly?.success||0),0)
  const yTotal=allMM.reduce((a,m)=>a+(m.annual?.success||0),0)
  // 월간 활동 합계 (allMM 기준으로 계산 - 팀 집계와 정확히 일치)
  const mAct=allMM.reduce((a,m)=>a+(m.monthly?.mitDone||0),0)
  const mDirect=allMM.reduce((a,m)=>a+(m.monthly?.directDone||0),0)
  const mActAll=mAct+mDirect
  const mPE=PRODS.filter(p=>globalProdCounts[p]).map(p=>[p,globalProdCounts[p]])
  const maxPM=mPE.length?Math.max(...mPE.map(([,v])=>v)):1

  // ════ S1: 표지 ════
  const s1=`<div class="slide" id="s1">
  <div style="background:linear-gradient(145deg,#fff 0%,#eef4ff 45%,#e8f1fe 70%,#fdf4e8 100%);flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 60px;position:relative">
    <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#e67e00,#f59e0b,#e67e00)"></div>
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(37,99,235,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.03) 1px,transparent 1px);background-size:28px 28px"></div>
    <div style="position:relative;z-index:2">
      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(230,126,0,0.1);border:1.5px solid rgba(230,126,0,0.3);padding:5px 18px;border-radius:30px;margin-bottom:16px">
        <div style="width:7px;height:7px;border-radius:50%;background:#e67e00"></div>
        <span style="font-size:11px;font-weight:700;color:#b45309;letter-spacing:3px;text-transform:uppercase">KT 상권통 플랫폼</span>
      </div>
      <div style="font-size:52px;font-weight:700;color:#0f172a;line-height:1;margin-bottom:10px">영업 성과 보고서</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:20px">4대 프로젝트 · 팀별 · 직원별 활동 성과 분석</div>
      <div style="display:inline-flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #e67e00;padding:8px 24px;border-radius:8px;margin-bottom:20px;box-shadow:0 2px 12px rgba(230,126,0,0.12)">
        <span style="font-size:13px;font-weight:700;color:#e67e00">${period} 기준 &nbsp;|&nbsp; 영업일 ${bizDays}일 &nbsp;|&nbsp; 1인목표 ${perMMTarget}건</span>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 20px;margin-bottom:20px;font-size:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:left">
        <div>• 1인 일일 목표: <strong style="color:#e67e00">5건/일</strong></div>
        <div>• 월간 영업일: <strong style="color:#2563eb">${bizDays}일</strong></div>
        <div>• 1인 월간 목표: <strong style="color:#16a34a">${perMMTarget}건</strong></div>
        <div>• 활동 = 배분건 + 직접발굴</div>
        <div>• 활동률 = 활동건/월목표</div>
        <div>• 성공률 = 성공건/활동건</div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center">
        ${teams.map(t=>`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 24px;box-shadow:0 2px 10px rgba(0,0,0,0.06)">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:3px">${t.label}</div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">MM ${t.mm}명 · 목표 ${(t.mm*(perMMTarget||0))}건</div>
          <div style="display:flex;gap:10px">
            <div><div style="font-size:28px;font-weight:700;color:#16a34a;line-height:1">${t.monthly?.success||0}<span style="font-size:13px">건</span></div><div style="font-size:10px;color:#64748b">해당월 성공</div></div>
            <div style="border-left:1px solid #e2e8f0"></div>
            <div><div style="font-size:28px;font-weight:700;color:#2563eb;line-height:1">${(t.monthly?.mitDone||0)+(t.monthly?.directDone||0)}<span style="font-size:13px">건</span></div><div style="font-size:10px;color:#64748b">해당월 활동</div></div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>
  <div style="background:#0d1b2a;padding:6px 28px;display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.4)">
    <span>KT 상권통 플랫폼 · 영업관리 자동화</span>
    <span style="color:#e67e00;font-weight:600">상권통 SANGKWONTONG</span>
    <span>자동 생성 · ${today}</span>
  </div>
</div>`

  // ════ S2: 핵심성과 (주간→월간→누적) ════
  const s2=`<div class="slide" id="s2">
  ${rh(' 핵심 성과 요약','주간→월간→누적',2)}
  ${dayBanner}
  <div class="sb">
    <!-- 주간/월간/누적 KPI 박스 -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div style="border:2px solid #0f4c75;border-radius:10px;overflow:hidden">
        <div style="background:#0f4c75;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;text-align:center"> 주간 (이번주)</div>
        <div style="padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:5px">
          ${[
            {l:'활동건',v:teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0)+'건',c:'#2563eb'},
            {l:'주간목표',v:(mmCount*5*5)+'건',c:'#e67e00'},
            {l:'활동률',v:pct(teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0),mmCount*5*5)+'%',c:'#2563eb'},
            {l:'성공/성공률',v:(teams.reduce((a,t)=>a+(t.weekly?.success||0),0))+'건 / '+sucRate(teams.reduce((a,t)=>a+(t.weekly?.success||0),0),teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0))+'%',c:'#16a34a'},
          ].map(({l,v,c})=>`<div style="text-align:center;background:#f8fafc;border-radius:6px;padding:6px 4px"><div style="font-size:9px;color:#64748b;margin-bottom:2px">${l}</div><div style="font-size:16px;font-weight:700;color:${c};line-height:1">${v}</div></div>`).join('')}
        </div>
      </div>
      <div style="border:2px solid #1a3a5c;border-radius:10px;overflow:hidden">
        <div style="background:#1a3a5c;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;text-align:center"> 월간 (${period})</div>
        <div style="padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:5px">
          ${[
            {l:'활동건',v:mActAll+'건',c:'#2563eb'},
            {l:'월간목표',v:totalMonthTarget+'건',c:'#e67e00'},
            {l:'활동률',v:pct(mActAll,Math.max(totalMonthTarget,1))+'%',c:'#2563eb'},
            {l:'성공/성공률',v:mTotal+'건 / '+sucRate(mTotal,mActAll)+'%',c:'#16a34a'},
          ].map(({l,v,c})=>`<div style="text-align:center;background:#f8fafc;border-radius:6px;padding:6px 4px"><div style="font-size:9px;color:#64748b;margin-bottom:2px">${l}</div><div style="font-size:16px;font-weight:700;color:${c};line-height:1">${v}</div></div>`).join('')}
        </div>
      </div>
      <div style="border:2px solid #1a2e1a;border-radius:10px;overflow:hidden">
        <div style="background:#1a2e1a;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;text-align:center"> 연간 누적 (${yearStr})</div>
        <div style="padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:5px">
          ${[
            {l:'누적 활동',v:teams.reduce((a,t)=>a+(t.annual?.mitDone||0),0)+'건',c:'#475569'},
            {l:'연간목표',v:annualTotalTarget>0?annualTotalTarget+'건':'-',c:'#64748b'},
            {l:'활동률',v:annualTotalTarget>0?pct(teams.reduce((a,t)=>a+(t.annual?.mitDone||0),0),annualTotalTarget)+'%':'-',c:'#475569'},
            {l:'누적성공/성공률',v:yTotal+'건 / '+sucRate(yTotal,teams.reduce((a,t)=>a+(t.annual?.mitDone||0),0))+'%',c:'#16a34a'},
          ].map(({l,v,c})=>`<div style="text-align:center;background:#f8fafc;border-radius:6px;padding:6px 4px"><div style="font-size:9px;color:#64748b;margin-bottom:2px">${l}</div><div style="font-size:16px;font-weight:700;color:${c};line-height:1">${v}</div></div>`).join('')}
        </div>
      </div>
    </div>

    <!-- 팀별 주간/월간/누적 테이블 -->
    <div class="sct"> 팀별 × 주간/월간/누적 종합 현황</div>
    <table>
      <thead>
        <tr>
          <th class="h0" rowspan="2">팀</th><th class="h0" rowspan="2">MM</th>
          <th class="hwk" colspan="4"> 주간 (이번주)</th>
          <th class="hmo" colspan="4"> 월간 (${period})</th>
          <th class="hac" colspan="3"> 연간 누적</th>
        </tr>
        <tr>
          <th class="hwk">목표</th><th class="hwk">활동건</th><th class="hwk">활동률</th><th class="hwk" style="color:#86efac">성공/성공률</th>
          <th class="hmo">월목표</th><th class="hmo">활동건</th><th class="hmo">활동률</th><th class="hmo" style="color:#86efac">성공/성공률</th>
          <th class="hac">활동건</th><th class="hac">성공</th><th class="hac" style="color:#86efac">성공률</th>
        </tr>
      </thead>
      <tbody>
        ${teams.map(t=>{
          const wAct=t.weekly?.actAll||0, wSuc=t.weekly?.success||0, wGoal=t.mm*5*5
          const mActT=(t.monthly?.mitDone||0)+(t.monthly?.directDone||0), mSuc=t.monthly?.success||0, mGoal=t.mm*(perMMTarget||0)
          const yAct=t.annual?.actAll||(t.annual?.mitDone||0)+(t.annual?.directDone||0), ySuc=t.annual?.success||0
          return `<tr class="sub"><td>${t.label}</td><td>${t.mm}명</td>
            <td class="yc">${wGoal}건</td><td class="bc">${wAct}건</td><td class="${pct(wAct,Math.max(wGoal,1))>=50?'gc':'oc'}">${pct(wAct,Math.max(wGoal,1))}%</td><td class="gc">${wSuc}건 / ${sucRate(wSuc,wAct)}%</td>
            <td class="yc">${mGoal}건</td><td class="bc">${mActT}건</td><td class="${pct(mActT,Math.max(mGoal,1))>=50?'gc':'oc'}">${pct(mActT,Math.max(mGoal,1))}%</td><td class="gc">${mSuc}건 / ${sucRate(mSuc,mActT)}%</td>
            <td class="bc">${yAct}건</td><td class="gc">${ySuc}건</td><td class="gc">${sucRate(ySuc,yAct)}%</td>
          </tr>`
        }).join('')}
        <tr class="tot">
          <td>전 체</td><td>${mmCount}명</td>
          <td>${mmCount*5*5}건</td><td style="color:#60a5fa">${teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0)}건</td><td style="color:#fb923c">${pct(teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0),mmCount*5*5)}%</td><td style="color:#4ade80">${teams.reduce((a,t)=>a+(t.weekly?.success||0),0)}건 / ${sucRate(teams.reduce((a,t)=>a+(t.weekly?.success||0),0),teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0))}%</td>
          <td>${totalMonthTarget}건</td><td style="color:#60a5fa">${mActAll}건</td><td style="color:#fb923c">${pct(mActAll,Math.max(totalMonthTarget,1))}%</td><td style="color:#4ade80">${mTotal}건 / ${sucRate(mTotal,mActAll)}%</td>
          <td style="color:#60a5fa">${teams.reduce((a,t)=>a+(t.annual?.actAll||t.annual?.mitDone||0),0)}건</td><td style="color:#4ade80">${yTotal}건</td><td style="color:#4ade80">${sucRate(yTotal,teams.reduce((a,t)=>a+(t.annual?.actAll||t.annual?.mitDone||0),0))}%</td>
        </tr>
      </tbody>
    </table>

    <!-- 상품별 -->
    <div class="sct"> 상품별 성공 (월간 기준)</div>
    <table>
      <thead>
        <tr>
          <th class="h0">구분</th>
          ${PRODS.filter(p=>globalProdCounts[p]).map(p=>`<th class="h1">${p}</th>`).join('')}
          <th class="hg">합계</th><th class="hy">성공률</th>
        </tr>
      </thead>
      <tbody>
        ${teams.map(t=>`<tr><td class="sub" style="text-align:left">${t.label}</td>
          ${PRODS.filter(p=>globalProdCounts[p]).map(p=>`<td class="${((t.monthly?.prodCounts||t.prodCounts)||{})[p]?'gc':''}">${((t.monthly?.prodCounts||t.prodCounts)||{})[p]||'-'}</td>`).join('')}
          <td class="sub">${t.monthly?.success||0}건</td><td class="gc">${sucRate(t.monthly?.success||0,(t.monthly?.mitDone||0)+(t.monthly?.directDone||0))}%</td>
        </tr>`).join('')}
        <tr class="tot"><td>전 체</td>
          ${PRODS.filter(p=>globalProdCounts[p]).map(p=>`<td style="color:#93c5fd">${globalProdCounts[p]}</td>`).join('')}
          <td>${mTotal}건</td><td style="color:#4ade80">${sucRate(mTotal,mActAll)}%</td>
        </tr>
      </tbody>
    </table>
  <!-- 전체 일별 활동 트렌드 -->
  ${allDailyStats.length>0?`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px 8px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:9px;overflow:hidden">
      <div style="background:#1e3a5f;color:#fff;padding:4px 10px;font-size:10px;font-weight:700"> 일별 활동·성공 건수 (${period})</div>
      <div style="padding:6px">${svgLineChart(allDailyStats,430,88)}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:9px;overflow:hidden">
      <div style="background:#14532d;color:#fff;padding:4px 10px;font-size:10px;font-weight:700"> 누적 활동·성공 트렌드 (${period})</div>
      <div style="padding:6px">${svgCumChart(allDailyStats,430,88)}</div>
    </div>
  </div>`:''}
  </div>
  ${sf(2)}
</div>`

  // ════ S3: 4대 프로젝트 + 기업체 테마 상세 ════
  const allTot=projects.reduce((a,p)=>a+(p.adminOnly?p.total:p.directTotal),0)
  const mAllD=projects.reduce((a,p)=>a+(p.monthly?.done||p.done||0),0)
  const mAllS=projects.reduce((a,p)=>a+(p.monthly?.success||p.success||0),0)
  const yAllS=projects.reduce((a,p)=>a+(p.annual?.success||p.success||0),0)
  const proj1=projects.find(p=>p.id===1)||projects[0]||{}

  // allMM weekly lookup (S3에서 사용)
  const wkLookup={}; allMM.forEach(m=>{wkLookup[m.name]=m.weekly||{}})

  const s3=`<div class="slide" id="s3">
  ${rh(' 4대 프로젝트 활동 현황','테마별 상세 포함',3)}
  ${dayBanner}
  <div class="sb">
    <!-- 4대 프로젝트 요약 -->
    <table>
      <thead>
        <tr>
          <th class="h0" colspan="2">프로젝트</th>
          <th class="hwk" colspan="3"> 주간</th>
          <th class="hmo" colspan="4"> 월간</th>
          <th class="hac" colspan="2"> 누적</th>
        </tr>
        <tr>
          <th class="h0">No</th><th class="h0" style="text-align:left">프로젝트명</th>
          <th class="hwk">활동</th><th class="hwk">성공</th><th class="hwk">성공률</th>
          <th class="hmo">월목표</th><th class="hmo">활동건</th><th class="hmo">활동률</th><th class="hmo" style="color:#86efac">성공/성공률</th>
          <th class="hac">활동</th><th class="hac" style="color:#86efac">성공</th>
        </tr>
      </thead>
      <tbody>
        ${projects.map(p=>{
          const mD=p.monthly?.done||p.done||0, mS=p.monthly?.success||p.success||0
          // allMM weekly로 대체
          const _mmWk=(p.mmStats||[]).reduce((a,m)=>{const w=wkLookup[m.name]||{};return{act:a.act+(w.actAll||0),suc:a.suc+(w.success||0)}},{act:0,suc:0})
          const wD=_mmWk.act, wS=_mmWk.suc
          const dtot=p.adminOnly?p.total:p.directTotal
          const yD=p.annual?.done||p.done||0, yS=p.annual?.success||p.success||0
          const col=PC[p.id]||'#2563eb'
          return `<tr style="background:${col}0a">
            <td style="font-size:16px">${PI[p.id]||''}</td>
            <td style="text-align:left;font-weight:700;font-size:11px">${p.name||PN[p.id]}<br><span style="font-size:9px;color:${col};font-weight:400">${p.adminOnly?'관리자배분':'MM직접발굴'}${p.newBuildingCount>0?' (신축건물 포함 '+p.newBuildingCount+'건)':''}</span></td>
            <td class="bc">${wD}</td><td class="gc">${wS}</td><td class="gc">${sucRate(wS,wD)}%</td>
            <td class="yc">${dtot>0?dtot+'건':'-'}</td><td class="bc">${mD}건</td><td class="${pct(mD,Math.max(dtot,1))>=50?'gc':'oc'}">${dtot>0?pct(mD,Math.max(dtot,1))+'%':'-'}</td>
            <td class="gc">${mS}건 / ${sucRate(mS,mD)}%</td>
            <td class="bc">${yD}건</td><td class="gc">${yS}건</td>
          </tr>`
        }).join('')}
        <tr class="tot">
          <td colspan="2">전 체</td>
          <td>${projects.reduce((a,p)=>a+(p.weekly?.done||0),0)}</td><td style="color:#4ade80">${projects.reduce((a,p)=>a+(p.weekly?.success||0),0)}</td><td style="color:#4ade80">${sucRate(projects.reduce((a,p)=>a+(p.weekly?.success||0),0),projects.reduce((a,p)=>a+(p.weekly?.done||0),0))}%</td>
          <td>${totalMonthTarget}건</td><td style="color:#60a5fa">${mAllD}건</td><td style="color:#fb923c">${pct(mAllD,Math.max(totalMonthTarget,1))}%</td><td style="color:#4ade80">${mAllS}건 / ${sucRate(mAllS,mAllD)}%</td>
          <td>${projects.reduce((a,p)=>a+(p.annual?.done||p.done||0),0)}건</td><td style="color:#4ade80">${yAllS}건</td>
        </tr>
      </tbody>
    </table>

    <!-- 기업체 통신환경 테마 상세 -->
    <div class="sct" style="background:#1e3a5f">🏭 기업체 통신환경 개선공사 — 테마별 상세 <span>업로드 테마 기준 · 주간/월간/누적</span></div>
    <table>
      <thead>
        <tr>
          <th class="h1" style="text-align:left">테마명</th><th class="h1">배분</th>
          <th class="hwk" colspan="3"> 주간</th>
          <th class="hmo" colspan="5"> 월간</th>
          <th class="hg" colspan="2">성 과</th>
          <th class="hp" colspan="2">주요상품</th>
          <th class="hac" colspan="2">누적</th>
        </tr>
        <tr>
          <th class="h1" style="text-align:left"></th><th class="h1"></th>
          <th class="hwk">활동</th><th class="hwk">성공</th><th class="hwk">성공률</th>
          <th class="hmo">활동</th><th class="hmo">활동률</th><th class="hmo">접촉</th><th class="hmo">미처리</th><th class="hmo">실패</th>
          <th class="hg">성공</th><th class="hg">성공률</th>
          <th class="hp">#1</th><th class="hp">#2</th>
          <th class="hac">활동</th><th class="hac">성공</th>
        </tr>
      </thead>
      <tbody>
        ${(proj1.themes&&proj1.themes.length>0?proj1.themes:[{name:'(테마 없음)',total:proj1.total||0,done:proj1.monthly?.done||proj1.done||0,success:proj1.monthly?.success||proj1.success||0,mmStats:[]}]).map((t,i)=>{
          const actR=pct(t.done,Math.max(t.total,1))
          // 팀별 MM 그룹
          const teamGroups={}
          ;(t.mmStats||[]).forEach(m=>{if(!teamGroups[m.team])teamGroups[m.team]=[];teamGroups[m.team].push(m)})
          const teamNames=Object.keys(teamGroups)
          return `<tr style="background:${i%2?'#ddeeff':'#eef5ff'}">
            <td style="text-align:left;font-weight:800;color:#0f172a">${t.name}</td>
            <td class="bc">${t.total}건</td>
            <td class="bc">${t.weekly?.done||0}</td><td class="gc">${t.weekly?.success||0}</td><td class="gc">${sucRate(t.weekly?.success||0,t.weekly?.done||0)}%</td>
            <td class="bc">${t.monthly?.done||t.done||0}건</td><td class="${actR>=70?'gc':'oc'}">${actR}%</td>
            <td>-</td><td class="oc">${t.total-(t.monthly?.done||t.done||0)}</td><td class="rc">-</td>
            <td class="gc" style="font-size:14px">${t.monthly?.success||t.success}</td><td class="gc">${sucRate(t.monthly?.success||t.success,t.monthly?.done||t.done||0)}%</td>
            <td colspan="2"></td>
            <td class="bc">-</td><td class="gc">-</td>
          </tr>
          ${teamNames.map(team=>`
            <tr><td colspan="16" style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;text-align:left">${team}</td></tr>
            ${teamGroups[team].map(m=>{
              const mD=m.monthly?.done||0, mS=m.monthly?.success||0, wD=m.weekly?.done||0
              const isZero=mD===0&&m.total>0
              return `<tr style="background:${isZero?'#fef2f2':'#f0f7ff'}">
                <td style="text-align:left;font-size:11px;color:${isZero?'#dc2626':'#1e40af'};padding-left:18px">└ ${m.name}</td>
                <td style="font-size:11px">${m.total}건</td>
                <td class="bc" style="font-size:11px">${wD}</td><td class="gc" style="font-size:11px">${m.weekly?.success||0}</td><td style="font-size:11px">${sucRate(m.weekly?.success||0,wD)}%</td>
                <td class="${isZero?'rc':'bc'}" style="font-size:11px">${mD}건</td>
                <td class="${isZero?'rc':pct(mD,Math.max(m.total,1))>=70?'gc':'oc'}" style="font-size:11px">${pct(mD,Math.max(m.total,1))}%</td>
                <td colspan="3" style="font-size:10px;color:#64748b">${isZero?'⚠ 미활동':''}</td>
                <td class="${isZero?'rc':'gc'}" style="font-size:13px;font-weight:700">${mS}</td>
                <td class="${isZero?'rc':'gc'}" style="font-size:11px">${sucRate(mS,mD)}%</td>
                <td colspan="4"></td>
              </tr>`
            }).join('')}
          `).join('')}`
        }).join('')}
        <tr class="sub">
          <td style="text-align:left">소 계</td><td class="bc">${proj1.total||0}건</td>
          <td class="bc">${proj1.themes?.reduce((a,t)=>a+(t.weekly?.done||0),0)||0}</td><td class="gc">${proj1.themes?.reduce((a,t)=>a+(t.weekly?.success||0),0)||0}</td><td class="gc">-</td>
          <td class="bc">${proj1.monthly?.done||proj1.done||0}건</td><td class="gc">${pct(proj1.monthly?.done||proj1.done||0,Math.max(proj1.total||1,1))}%</td>
          <td colspan="3"></td>
          <td class="gc" style="font-size:14px">${proj1.monthly?.success||proj1.success||0}</td><td class="gc">${sucRate(proj1.monthly?.success||proj1.success||0,proj1.monthly?.done||proj1.done||0)}%</td>
          <td colspan="2">${prodBadges(proj1.prodCounts||{})}</td>
          <td class="bc">${proj1.annual?.done||0}건</td><td class="gc">${proj1.annual?.success||0}건</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${sf(3)}
</div>`

  // ════ S4~7: 프로젝트 상세 슬라이드 ════
  function projSlide(p,sn){
    if(!p) return `<div class="slide" id="s${sn}"><div class="rh"><div class="rt">${PI[sn-3]||''} 프로젝트 ${sn-3} <span class="rb">데이터 없음</span></div></div></div>`
    const col=PC[p.id]||'#2563eb', dtot=p.adminOnly?p.total:p.directTotal
    const mD=p.monthly?.done||p.done||0, mS=p.monthly?.success||p.success||0
    const yD=p.annual?.done||0, yS=p.annual?.success||0
    const mm=p.mmStats||[]
    // allMM weekly lookup (projData weekly 대신 allMMData 사용 - 정확한 값)
    const wkMap={}; allMM.forEach(m=>{wkMap[m.name]=m.weekly||{}})
    const wD=mm.reduce((a,m)=>a+(wkMap[m.name]?.actAll||0),0)
    const wS=mm.reduce((a,m)=>a+(wkMap[m.name]?.success||0),0)
    const pc=p.prodCounts||{}, prodE=PRODS.filter(x=>pc[x]).map(x=>[x,pc[x]])
    const maxP=prodE.length?Math.max(...prodE.map(([,v])=>v)):1
    return `<div class="slide" id="s${sn}">
  <div class="rh"><div class="rt" style="color:#fff">${PI[p.id]||''} ${p.name||PN[p.id]} <span class="rb">프로젝트 ${p.id} 상세</span></div><div class="rp">${period} · ${sn} / ${N}</div></div>
  ${dayBanner}
  <div class="sb">
    <!-- KPI -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">
      ${[
        {bg:col+'22',bc:col+'44',c:col,l:p.adminOnly?'MIT 배분':'직접 등록',v:dtot+'건'},
        {bg:'#eff6ff',bc:'#93c5fd',c:'#2563eb',l:'주간 활동',v:wD+'건'},
        {bg:'#eff6ff',bc:'#93c5fd',c:'#2563eb',l:'월간 활동 / 활동률',v:mD+'건 / '+pct(mD,Math.max(dtot,1))+'%'},
        {bg:'#f0fdf4',bc:'#86efac',c:'#16a34a',l:'월간 성공 / 성공률',v:mS+'건 / '+sucRate(mS,mD)+'%'},
        {bg:'#f1f5f9',bc:'#cbd5e1',c:'#475569',l:'연간 누적 성공',v:yS+'건'},
        ...(p.newBuildingCount>0?[{bg:'#fff7ed',bc:'#fed7aa',c:'#9a3412',l:'신축건물 포함',v:p.newBuildingCount+'건'}]:[]),
      ].map(({bg,bc,c,l,v})=>`<div style="background:${bg};border:1.5px solid ${bc};border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:${c};font-weight:600;margin-bottom:2px">${l}</div><div style="font-size:20px;font-weight:700;color:${c};line-height:1">${v}</div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1">
      <!-- 좌: 상품별 -->
      <div style="background:${col}0f;border:1px solid ${col}44;border-radius:10px;padding:12px">
        <div class="sct" style="background:${col};margin:-12px -12px 10px -12px;padding:5px 10px">상품별 성공 + 주간/월간/누적</div>
        ${prodE.length?prodE.slice(0,6).map(([pp,cnt])=>`<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
          <span style="font-size:11px;font-weight:600;min-width:56px">${pp}</span>
          ${bar(pct(cnt,maxP),PCOL[pp]||col,13)}
          <span style="font-size:13px;font-weight:700;color:${PCOL[pp]||col};min-width:20px">${cnt}</span>
        </div>`).join(''):'<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px">상품 데이터 없음</div>'}
        ${(p.themes&&p.themes.length>0)?`
        <div style="margin-top:8px;font-size:11px;font-weight:700;color:${col}">🏷️ 테마별 (${p.themes.length}개)</div>
        <table style="margin-top:4px"><thead><tr>
          <th style="background:${col};color:#fff;text-align:left">테마</th>
          <th class="hwk">주간</th><th class="hmo">월배분</th><th class="hmo">활동</th><th class="hg">성공</th>
        </tr></thead><tbody>
          ${p.themes.map((t,i)=>`<tr style="background:${i%2?'#f8fafc':'#fff'}"><td style="text-align:left;font-weight:600;font-size:10px">${t.name}</td><td class="bc" style="font-size:10px">${Math.round(t.done*0.25)||0}</td><td style="font-size:10px">${t.total}</td><td class="bc" style="font-size:10px">${t.done}</td><td class="gc" style="font-size:12px">${t.success}</td></tr>`).join('')}
        </tbody></table>`:''}
      </div>
      <!-- 우: MM별 -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="background:#fff;border:1px solid ${col}44;border-radius:10px;padding:12px;flex:1">
          <div class="sct" style="background:${col};margin:-12px -12px 8px -12px;padding:5px 10px"> 담당 MM별 (주간/월간/누적)</div>
          ${mm.length?`<table><thead><tr>
            <th class="h0">MM</th><th class="h0">팀</th><th class="h0">배분</th><th class="h0">직접</th>
            <th class="hwk">주간활동</th><th class="hwk" style="color:#86efac">주간성공</th>
            <th class="hmo">월활동</th><th class="hmo">활동률</th><th class="hmo" style="color:#86efac">성공</th><th class="hmo" style="color:#86efac">성공률</th>
            <th class="hac">연간활동</th><th class="hac" style="color:#86efac">성공</th>
          </tr></thead><tbody>
            ${mm.map(m=>{const mDm=m.monthly?.mitDone||0,mSm=m.monthly?.success||0,zero=mDm===0&&m.mitAssigned>0
              const mWk=wkMap[m.name]||{}, mWkAct=mWk.actAll||0, mWkSuc=mWk.success||0
              return `<tr style="background:${zero?'#fef2f2':''}"><td><strong style="color:${zero?'#dc2626':'#0f172a'}">${m.name}</strong></td><td style="font-size:10px">${m.team}</td>
              <td style="font-size:11px">${m.mitAssigned}</td><td style="font-size:11px">${m.directTotal||0}</td>
              <td class="bc" style="font-size:11px">${mWkAct}</td><td class="gc" style="font-size:11px">${mWkSuc}</td>
              <td class="${zero?'rc':'bc'}">${m.monthly?.actAll||mDm}</td><td class="${zero?'rc':pct(m.monthly?.actAll||mDm,Math.max((m.mitAssigned||0)+(m.directTotal||0),1))>=60?'gc':'oc'}">${pct(m.monthly?.actAll||mDm,Math.max((m.mitAssigned||0)+(m.directTotal||0),1))}%</td>
              <td class="${zero?'rc':'gc'}" style="font-size:13px">${mSm}</td><td class="${zero?'rc':'gc'}">${sucRate(mSm,m.monthly?.actAll||mDm)}%</td>
              <td class="bc" style="font-size:11px">${m.annual?.actAll||m.annual?.mitDone||0}건</td><td class="gc" style="font-size:11px">${m.annual?.success||0}건</td>
              </tr>`}).join('')}
          </tbody></table>`:'<div style="text-align:center;padding:12px;color:#94a3b8;font-size:12px">담당 MM 없음</div>'}
          ${mm.some(m=>m.mitAssigned>0&&(m.monthly?.mitDone||0)===0)?`<div style="background:#fef2f2;border:0.5px solid #fecaca;border-radius:6px;padding:5px 10px;font-size:10px;color:#991b1b;font-weight:600;margin-top:6px">⚠ ${mm.filter(m=>m.mitAssigned>0&&(m.monthly?.mitDone||0)===0).map(m=>m.name).join(', ')} — 미활동</div>`:''}
        </div>
      </div>
    </div>

    <!-- 일별 트렌드 차트 -->
    ${(p.dailyStats&&p.dailyStats.length>0)?`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:#fff;border:1px solid ${col}33;border-radius:9px;overflow:hidden">
        <div style="background:${col};color:#fff;padding:4px 10px;font-size:10px;font-weight:700"> 일별 활동·성공 건수 트렌드</div>
        <div style="padding:6px">${svgLineChart(p.dailyStats,430,100)}</div>
      </div>
      <div style="background:#fff;border:1px solid ${col}33;border-radius:9px;overflow:hidden">
        <div style="background:${col};color:#fff;padding:4px 10px;font-size:10px;font-weight:700"> 누적 활동·성공 트렌드</div>
        <div style="padding:6px">${svgCumChart(p.dailyStats,430,100)}</div>
      </div>
    </div>`:''}

    <!-- 성공 건 세부 내역 -->
    ${(p.successCases&&p.successCases.length>0)?`
    <div style="background:#fff;border:1px solid ${col}33;border-radius:9px;overflow:hidden">
      <div style="background:${col};color:#fff;padding:4px 10px;font-size:10px;font-weight:700"> 성공 건 세부 내역 (해당월 · 최근 ${p.successCases.length}건)</div>
      <table style="font-size:10px">
        <thead><tr>
          <th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:left">일자</th>
          <th style="background:#1e293b;color:#fff;padding:4px 6px">활동자</th>
          <th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:left;min-width:80px">주소/고객</th>
          <th style="background:#14532d;color:#fff;padding:4px 6px;text-align:left">상품</th>
          <th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:left">결과</th>
          <th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:left">메모</th>
          <th style="background:#1e293b;color:#fff;padding:4px 6px">연락처</th>
        </tr></thead>
        <tbody>
          ${p.successCases.map((c,i)=>`<tr style="background:${i%2?'#f8fafc':'#fff'}">
            <td style="padding:3px 6px;color:#64748b">${c.date}</td>
            <td style="padding:3px 6px;text-align:center;font-weight:700;color:${col}">${c.mm}</td>
            <td style="padding:3px 6px;text-align:left;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.address}</td>
            <td style="padding:3px 6px;text-align:left;color:#16a34a;font-weight:600">${c.products}</td>
            <td style="padding:3px 6px;text-align:left;color:#2563eb">${c.result}</td>
            <td style="padding:3px 6px;text-align:left;color:#64748b;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.memo}</td>
            <td style="padding:3px 6px;text-align:center;color:#64748b">${c.contact}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`:'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;font-size:11px;color:#94a3b8">해당월 성공 건 없음</div>'}
  </div>
  ${sf(sn)}
</div>`
  }

  const s4=projSlide(projects[0],4)
  const s5=projSlide(projects[1],5)
  const s6=projSlide(projects[2],6)
  const s7=projSlide(projects[3],7)

  // ════ S8: 팀별 성과 ════
  const s8=`<div class="slide" id="s8">
  ${rh(' 팀별 성과 현황','프로젝트별 · 상품별 · 주간/월간/누적',8)}
  ${dayBanner}
  <div class="sb">
    <table>
      <thead>
        <tr>
          <th class="h0" rowspan="2">팀</th><th class="h0" rowspan="2">MM</th>
          <th class="hwk" colspan="4"> 주간</th>
          <th class="hmo" colspan="5"> 월간</th>
          <th class="hac" colspan="3"> 누적</th>
        </tr>
        <tr>
          <th class="hwk">목표</th><th class="hwk">활동</th><th class="hwk">활동률</th><th class="hwk" style="color:#86efac">성공/률</th>
          <th class="hmo">월목표</th><th class="hmo">활동</th><th class="hmo">활동률</th><th class="hmo" style="color:#86efac">성공</th><th class="hmo" style="color:#86efac">성공률</th>
          <th class="hac">활동</th><th class="hac">성공</th><th class="hac" style="color:#86efac">성공률</th>
        </tr>
      </thead>
      <tbody>
        ${teams.map(t=>{
          const wAct=t.weekly?.actAll||0, wSuc=t.weekly?.success||0, wGoal=t.mm*5*5
          const mActT=(t.monthly?.mitDone||0)+(t.monthly?.directDone||0), mSuc=t.monthly?.success||0, mGoal=t.mm*(perMMTarget||0)
          const yAct=t.annual?.actAll||(t.annual?.mitDone||0)+(t.annual?.directDone||0), ySuc=t.annual?.success||0
          return `<tr class="sub">
            <td style="font-size:13px">${t.label}</td><td>${t.mm}명</td>
            <td class="yc">${wGoal}건</td><td class="bc">${wAct}건</td><td class="${pct(wAct,Math.max(wGoal,1))>=50?'gc':'oc'}">${pct(wAct,Math.max(wGoal,1))}%</td><td class="gc">${wSuc}건 / ${sucRate(wSuc,wAct)}%</td>
            <td class="yc">${mGoal}건</td><td class="bc">${mActT}건</td><td class="${pct(mActT,Math.max(mGoal,1))>=50?'gc':'oc'}">${pct(mActT,Math.max(mGoal,1))}%</td><td class="gc" style="font-size:14px">${mSuc}건</td><td class="gc">${sucRate(mSuc,mActT)}%</td>
            <td class="bc">${yAct}건</td><td class="gc">${ySuc}건</td><td class="gc">${sucRate(ySuc,yAct)}%</td>
          </tr>`}).join('')}
        <tr class="tot">
          <td>전 체</td><td>${mmCount}명</td>
          <td>${mmCount*5*5}건</td><td style="color:#60a5fa">${teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0)}건</td><td style="color:#fb923c">${pct(teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0),mmCount*5*5)}%</td><td style="color:#4ade80">${teams.reduce((a,t)=>a+(t.weekly?.success||0),0)}건 / ${sucRate(teams.reduce((a,t)=>a+(t.weekly?.success||0),0),teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0))}%</td>
          <td>${totalMonthTarget}건</td><td style="color:#60a5fa">${mActAll}건</td><td style="color:#fb923c">${pct(mActAll,Math.max(totalMonthTarget,1))}%</td><td style="color:#4ade80;font-size:14px">${mTotal}건</td><td style="color:#4ade80">${sucRate(mTotal,mActAll)}%</td>
          <td style="color:#60a5fa">${teams.reduce((a,t)=>a+(t.annual?.actAll||t.annual?.mitDone||0),0)}건</td><td style="color:#4ade80">${yTotal}건</td><td style="color:#4ade80">${sucRate(yTotal,teams.reduce((a,t)=>a+(t.annual?.actAll||t.annual?.mitDone||0),0))}%</td>
        </tr>
      </tbody>
    </table>
    <!-- 팀×프로젝트 크로스 -->
    <div class="sct"> 팀별 × 프로젝트 크로스 집계 <span>월간 기준</span></div>
    <table>
      <thead>
        <tr>
          <th class="h0">팀</th>
          ${projects.map(p=>`<th class="h1" colspan="2" style="background:${PC[p.id]||'#1e3a5f'}">${PI[p.id]} ${(p.name||PN[p.id]).slice(0,6)}</th>`).join('')}
          <th class="hg" colspan="2">전체</th>
        </tr>
        <tr>
          <th class="h0"></th>
          ${projects.map(()=>'<th class="h2">활동</th><th class="hg">성공</th>').join('')}
          <th class="hg">활동</th><th class="hg">성공</th>
        </tr>
      </thead>
      <tbody>
        ${teams.map(t=>`<tr class="sub"><td>${t.label}</td>
          ${projects.map(p=>{
            const tLeads=(p.mmStats||[]).filter(m=>m.team===t.label)
            const tAct=tLeads.reduce((a,m)=>a+(m.monthly?.mitDone||0),0)
            const tSuc=tLeads.reduce((a,m)=>a+(m.monthly?.success||0),0)
            return `<td class="bc">${tAct}</td><td class="gc">${tSuc}</td>`
          }).join('')}
          <td class="bc">${(t.monthly?.mitDone||0)+(t.monthly?.directDone||0)}건</td><td class="gc" style="font-size:14px">${t.monthly?.success||0}건</td>
        </tr>`).join('')}
        <tr class="tot"><td>전 체</td>
          ${projects.map(p=>`<td>${p.monthly?.done||p.done||0}</td><td style="color:#4ade80">${p.monthly?.success||p.success||0}</td>`).join('')}
          <td>${mActAll}건</td><td style="color:#4ade80">${mTotal}건</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${sf(8)}
</div>`

  // ════ S9: 전직원 세부 (주간/월간/누적) ════
  const sorted=[...allMM].sort((a,b)=>(b.monthly?.success||b.success||0)-(a.monthly?.success||a.success||0))
  const medals=['','','']
  const s9=`<div class="slide" id="s9">
  ${rh(' 전직원 세부 활동 실적','주간→월간→누적 · 5건/일 목표',9)}
  ${dayBanner}
  <div class="sb">
    <table>
      <thead>
        <tr>
          <th class="h0" rowspan="2">#</th><th class="h0" rowspan="2">MM</th><th class="h0" rowspan="2">팀</th>
          <th class="hwk" colspan="3"> 주간</th>
          <th class="hmo" colspan="5"> 월간 (목표 ${perMMTarget}건)</th>
          <th class="hac" colspan="3"> 연간 누적</th>
        </tr>
        <tr>
          <th class="hwk">활동</th><th class="hwk">활동률</th><th class="hwk" style="color:#86efac">성공/률</th>
          <th class="hmo">월목표</th><th class="hmo">활동</th><th class="hmo">활동률</th><th class="hmo" style="color:#86efac">성공</th><th class="hmo" style="color:#86efac">성공률</th>
          <th class="hac">활동</th><th class="hac">성공</th><th class="hac" style="color:#86efac">성공률</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((m,i)=>{
          const ms=m.monthly||{}, ys=m.annual||{}, ws=m.weekly||{}
          const mSuc=ms.success||m.success||0, ySuc=ys.success||0
          const mActM=ms.actAll||(ms.mitDone||0)+(ms.directDone||0), yActM=ys.actAll||(ys.mitDone||0)+(ys.directDone||0)
          const wActM=(ws.actAll||0), wSuc=ws.success||0
          const mmGoal=perMMTarget||0
          const zero=mActM===0&&(m.mitAssigned||0)>0
          return `<tr style="background:${i===0?'#fefce8':zero?'#fef2f2':''}">
            <td style="font-size:${i<3?'16':'13'}px">${medals[i]||'<span style="color:#94a3b8;font-weight:600">'+(i+1)+'</span>'}</td>
            <td><strong style="color:${zero?'#dc2626':'#0f172a'}">${m.name}</strong></td>
            <td style="font-size:10px;color:#64748b">${m.team}</td>
            <td class="bc">${wActM}건</td><td class="${pct(wActM,25)>=50?'gc':'oc'}">${pct(wActM,25)}%</td><td class="gc">${wSuc}건 / ${sucRate(wSuc,wActM)}%</td>
            <td class="yc">${mmGoal}건</td>
            <td class="${zero?'rc':'bc'}">${mActM}건</td>
            <td class="${zero?'rc':pct(mActM,Math.max(mmGoal,1))>=50?'gc':'oc'}">${pct(mActM,Math.max(mmGoal,1))}%</td>
            <td class="${zero?'rc':'gc'}" style="font-size:${i===0?'16':'13'}px">${mSuc}건</td>
            <td class="${zero?'rc':'gc'}">${sucRate(mSuc,mActM)}%</td>
            <td class="bc">${yActM}건</td><td class="gc">${ySuc}건</td><td class="gc">${sucRate(ySuc,yActM)}%</td>
          </tr>`
        }).join('')}
        <tr class="tot">
          <td colspan="3">합계</td>
          <td>${teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0)}건</td><td style="color:#fb923c">${pct(teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0),mmCount*25)}%</td><td style="color:#4ade80">${teams.reduce((a,t)=>a+(t.weekly?.success||0),0)}건 / ${sucRate(teams.reduce((a,t)=>a+(t.weekly?.success||0),0),teams.reduce((a,t)=>a+(t.weekly?.actAll||0),0))}%</td>
          <td>${totalMonthTarget}건</td><td style="color:#60a5fa">${mActAll}건</td><td style="color:#fb923c">${pct(mActAll,Math.max(totalMonthTarget,1))}%</td><td style="color:#4ade80;font-size:14px">${mTotal}건</td><td style="color:#4ade80">${sucRate(mTotal,mActAll)}%</td>
          <td style="color:#60a5fa">${teams.reduce((a,t)=>a+(t.annual?.actAll||t.annual?.mitDone||0),0)}건</td><td style="color:#4ade80">${yTotal}건</td><td style="color:#4ade80">${sucRate(yTotal,teams.reduce((a,t)=>a+(t.annual?.actAll||t.annual?.mitDone||0),0))}%</td>
        </tr>
      </tbody>
    </table>
    ${sorted.some(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0)?`<div style="background:#fef2f2;border:0.5px solid #fecaca;border-radius:6px;padding:7px 12px;font-size:11px;color:#991b1b;font-weight:600">⚠ ${sorted.filter(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0).map(m=>m.name).join(', ')} — 해당월 활동 0건. 즉각 확인 필요</div>`:''}
  </div>
  ${sf(9)}
</div>`

  // ════ S10: 성과 우수자 ════
  const top5=[...allMM].sort((a,b)=>(b.monthly?.success||b.success||0)-(a.monthly?.success||a.success||0)).slice(0,5)
  const s10=`<div class="slide" id="s10">
  ${rh(' 성과 우수자 현황','해당월 성공 기준 · 연간 병행',10)}
  ${dayBanner}
  <div style="padding:10px 14px;flex:1;display:grid;grid-template-columns:1.4fr 0.6fr;gap:16px">
    <div style="display:flex;flex-direction:column;gap:8px">
      <div class="sct"> TOP 성과자 (해당월 성공 기준)</div>
      ${top5[0]?`<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#fefce8;border:1.5px solid #fde68a;border-radius:10px;margin-bottom:6px">
        <div style="width:38px;height:38px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:700">${top5[0].name} <span style="font-size:12px;color:#64748b">${top5[0].team}</span></div>
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">월활동 ${(top5[0].monthly?.mitDone||0)+(top5[0].monthly?.directDone||0)}건 · 활동률 ${pct((top5[0].monthly?.mitDone||0)+(top5[0].monthly?.directDone||0),Math.max(perMMTarget,1))}%</div>
          <div>${prodBadges(top5[0].prodCounts||{},5)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:36px;font-weight:700;color:#16a34a;line-height:1">${top5[0].monthly?.success||0}<span style="font-size:14px">건</span></div>
          <div style="font-size:10px;color:#64748b">연간 ${top5[0].annual?.success||0}건</div>
        </div>
      </div>`:'<div style="color:#94a3b8;font-size:13px;padding:16px">성과 데이터 없음</div>'}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${top5.slice(1).map((m,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px">
          <div style="width:30px;height:30px;border-radius:50%;background:${['#94a3b8','#b45309','#cbd5e1','#cbd5e1'][i]};display:flex;align-items:center;justify-content:center;font-size:${i<2?'16':'12'}px;font-weight:700;color:#fff;flex-shrink:0">${medals[i+1]||(i+2)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700">${m.name} <span style="font-size:10px;color:#64748b">${m.team}</span></div>
            <div style="font-size:11px;color:#64748b">활동률 ${pct((m.monthly?.mitDone||0)+(m.monthly?.directDone||0),Math.max(perMMTarget,1))}%</div>
            <div style="font-size:10px">${prodBadges(m.prodCounts||{},2)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:22px;font-weight:700;color:#16a34a">${m.monthly?.success||0}</div>
            <div style="font-size:9px;color:#94a3b8">연간 ${m.annual?.success||0}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div class="sct">팀별 달성 현황</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
        ${teams.map(t=>{
          const mActT=(t.monthly?.mitDone||0)+(t.monthly?.directDone||0)
          const mGoal=t.mm*(perMMTarget||0)
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:3px">
              <span>${t.label}</span><span>성공 <strong style="color:#16a34a">${t.monthly?.success||0}건</strong> / 연간 ${t.annual?.success||0}건</span>
            </div>
            <div style="background:#e2e8f0;border-radius:3px;height:10px;overflow:hidden">
              <div style="width:${Math.min(pct(mActT,Math.max(mGoal,1)),100)}%;height:10px;background:#2563eb;border-radius:3px"></div>
            </div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px">활동 ${mActT}건 / 목표 ${mGoal}건 (${pct(mActT,Math.max(mGoal,1))}%) · 성공률 ${sucRate(t.monthly?.success||0,mActT)}%</div>
          </div>`}).join('')}
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;flex:1">
        <div style="font-size:11px;font-weight:700;color:#166534;margin-bottom:8px">이달 핵심 성과</div>
        <div style="font-size:12px;color:#374151;line-height:2.2">
          ${top5[0]?`<div>최고: ${top5[0].name} <strong style="color:#16a34a;font-size:14px">${top5[0].monthly?.success||0}건</strong></div>`:''}
          <div>월간 전체 성공 <strong style="color:#16a34a">${mTotal}건</strong> / 활동률 <strong style="color:#e67e00">${pct(mActAll,Math.max(totalMonthTarget,1))}%</strong></div>
          <div>연간 누적 <strong style="color:#475569">${yTotal}건</strong></div>
          ${sorted.some(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0)?`<div style="color:#dc2626">${sorted.filter(m=>(m.monthly?.mitDone||0)===0&&(m.mitAssigned||0)>0).map(m=>m.name).join('·')} 미활동</div>`:''}
        </div>
      </div>
    </div>
  </div>
  ${sf(10)}
</div>`

  // 네비
  const navBtns=Array.from({length:N},(_,i)=>`<button class="nb" onclick="document.getElementById('s${i+1}').scrollIntoView({behavior:'smooth'})">${i+1}</button>`).join('')
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>상권통 영업 보고서 - ${period}</title><style>${css}</style></head><body>
<div class="nav">${navBtns}<button class="np" onclick="window.print()">인쇄/PDF</button></div>
${s1}${s2}${s3}${s4}${s5}${s6}${s7}${s8}${s9}${s10}
</body></html>`
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
    ...(isSuper ? [{ id: 'settings', label: '설정', icon: '⚙️' }] : []),
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
                baseDirect = [] // 특정 배분 테마 선택 시 직접발굴 제외 (직접발굴은 project_name 없음)
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
                  {/* 뷰 전환 버튼 */}
                  <div style={{display:'flex',justifyContent:'flex-end',gap:'6px',marginBottom:'10px'}}>
                    {['도표','카드'].map(v=>(
                      <button key={v} onClick={()=>setActResultView(v)}
                        style={{padding:'6px 14px',borderRadius:'20px',border:'1.5px solid '+(actResultView===v?C.acc:'#e2e8f0'),background:actResultView===v?C.acc:'#fff',color:actResultView===v?'#fff':C.sub,fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>
                        {v==='도표'?'📊 도표 보기':'📋 카드 보기'}
                      </button>
                    ))}
                  </div>

                  {/* 도표 뷰 */}
                  {actResultView==='도표'&&(()=>{
                    // 프로세스별 MM 통계
                    const mmNames=[...new Set([...baseLeads.map(l=>l.assigned_to||''),...baseDirect.map(l=>users.find(u=>u.username===l.mm_username)?.name||l.mm_username||'')].filter(Boolean))]
                    const getTeam=(name)=>{const u=users.find(u=>u.name===name);const a=adminAccounts.find(a=>a.team_id===u?.team_id);return a?.team_label||'-'}
                    const allCombined=[...baseLeads,...baseDirect.map(l=>({...l,assigned_to:users.find(u=>u.username===l.mm_username)?.name||l.mm_username}))]
                    const totTarget=allCombined.length
                    const totContact=allCombined.filter(l=>l.activity_status&&l.activity_status!=='미처리').length
                    const totSuccess=allCombined.filter(l=>l.activity_status==='성공').length
                    const totProspect=allCombined.filter(l=>l.activity_status==='접촉완료').length
                    const totFail=allCombined.filter(l=>l.activity_status==='실패').length
                    // M발굴은 mDiscovery에서 집계
                    const totStar=isSuper?mDiscovery.length:mDiscovery.filter(m=>m.team_id===adminInfo?.teamId).length
                    return(<>
                      {/* 프로세스 요약 */}
                      <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'14px',overflowX:'auto',paddingBottom:'4px'}}>
                        {[{icon:'🎯',label:'타겟선정',val:totTarget,col:'#e67e00'},{icon:'📞',label:'고객접촉',val:totContact,col:C.blue},{icon:'🏆',label:'성공',val:totSuccess,col:C.green},{icon:'💫',label:'가망',val:totProspect,col:'#7c3aed'},{icon:'⭐',label:'단골등록',val:totStar,col:'#f59e0b'}].map((s,i,arr)=>(
                          <div key={s.label} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                            <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'8px 12px',textAlign:'center',minWidth:'80px'}}>
                              <div style={{fontSize:'22px',fontWeight:'900',color:s.col}}>{s.val}</div>
                              <div style={{fontSize:'10px',color:C.sub,marginTop:'2px'}}>{s.icon} {s.label}</div>
                            </div>
                            {i<arr.length-1&&<div style={{fontSize:'16px',color:'#cbd5e1',flexShrink:0}}>›</div>}
                          </div>
                        ))}
                        <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                          <div style={{fontSize:'16px',color:'#cbd5e1',flexShrink:0}}>|</div>
                          <div style={{background:'#fff',border:'1.5px solid #fecaca',borderRadius:'10px',padding:'8px 12px',textAlign:'center',minWidth:'80px'}}>
                            <div style={{fontSize:'22px',fontWeight:'900',color:C.red}}>{totFail}</div>
                            <div style={{fontSize:'10px',color:C.sub,marginTop:'2px'}}>❌ 실패</div>
                          </div>
                        </div>
                      </div>
                      {/* MM별 도표 */}
                      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',overflow:'hidden'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                          <thead>
                            <tr style={{background:'#0f172a',color:'#fff'}}>
                              <th style={{padding:'9px 10px',textAlign:'left',fontWeight:'600'}}>MM명</th>
                              <th style={{padding:'9px 10px',fontWeight:'600'}}>팀</th>
                              <th style={{padding:'9px 10px',fontWeight:'600',color:'#fb923c'}}>🎯타겟</th>
                              <th style={{padding:'9px 10px',fontWeight:'600',color:'#93c5fd'}}>📞접촉</th>
                              <th style={{padding:'9px 10px',fontWeight:'600',color:'#86efac'}}>🏆성공</th>
                              <th style={{padding:'9px 10px',fontWeight:'600',color:'#c4b5fd'}}>💫가망</th>
                              <th style={{padding:'9px 10px',fontWeight:'600',color:'#fcd34d'}}>⭐단골</th>
                              <th style={{padding:'9px 10px',fontWeight:'600',color:'#fca5a5'}}>❌실패</th>
                              <th style={{padding:'9px 10px',fontWeight:'600'}}>접촉률</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mmNames.map((name,idx2)=>{
                              const rows=allCombined.filter(l=>l.assigned_to===name)
                              const target=rows.length
                              const contact=rows.filter(l=>l.activity_status&&l.activity_status!=='미처리').length
                              const success=rows.filter(l=>l.activity_status==='성공').length
                              const prospect=rows.filter(l=>l.activity_status==='접촉완료').length
                              const fail=rows.filter(l=>l.activity_status==='실패').length
                              const star=mDiscovery.filter(m=>users.find(u=>u.name===name)?.username===m.registered_by).length
                              const rate=target>0?Math.round(contact/target*100):0
                              const isZero=target>0&&contact===0
                              return(<tr key={name} style={{background:isZero?'#fef2f2':idx2%2===1?C.bg:'#fff',borderBottom:'1px solid #e2e8f0'}}>
                                <td style={{padding:'8px 10px',fontWeight:'700',color:isZero?C.red:C.text}}>{name}</td>
                                <td style={{padding:'8px 10px',fontSize:'11px',color:C.sub,textAlign:'center'}}>{getTeam(name)}</td>
                                <td style={{padding:'8px 10px',textAlign:'center',color:C.sub}}>{target}</td>
                                <td style={{padding:'8px 10px',textAlign:'center',color:C.blue,fontWeight:'700'}}>{contact}</td>
                                <td style={{padding:'8px 10px',textAlign:'center',color:C.green,fontWeight:'900',fontSize:'14px'}}>{success}</td>
                                <td style={{padding:'8px 10px',textAlign:'center',color:'#7c3aed',fontWeight:'700'}}>{prospect}</td>
                                <td style={{padding:'8px 10px',textAlign:'center',color:'#f59e0b',fontWeight:'700'}}>{star}</td>
                                <td style={{padding:'8px 10px',textAlign:'center',color:C.red}}>{fail}</td>
                                <td style={{padding:'8px 10px'}}>
                                  <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                                    <div style={{flex:1,background:'#e2e8f0',borderRadius:'3px',height:'7px',overflow:'hidden'}}><div style={{width:rate+'%',height:'7px',background:rate>=70?C.green:rate>0?C.blue:C.red,borderRadius:'3px'}}></div></div>
                                    <span style={{fontSize:'11px',fontWeight:'700',color:rate>=70?C.green:rate>0?C.blue:C.red,minWidth:'30px'}}>{rate}%</span>
                                  </div>
                                </td>
                              </tr>)
                            })}
                            {/* 합계 행 */}
                            <tr style={{background:'#0f172a',color:'#fff',fontWeight:'700'}}>
                              <td style={{padding:'8px 10px'}} colSpan={2}>합계</td>
                              <td style={{padding:'8px 10px',textAlign:'center'}}>{totTarget}</td>
                              <td style={{padding:'8px 10px',textAlign:'center',color:'#93c5fd'}}>{totContact}</td>
                              <td style={{padding:'8px 10px',textAlign:'center',color:'#86efac',fontSize:'14px'}}>{totSuccess}</td>
                              <td style={{padding:'8px 10px',textAlign:'center',color:'#c4b5fd'}}>{totProspect}</td>
                              <td style={{padding:'8px 10px',textAlign:'center',color:'#fcd34d'}}>{totStar}</td>
                              <td style={{padding:'8px 10px',textAlign:'center',color:'#fca5a5'}}>{totFail}</td>
                              <td style={{padding:'8px 10px',color:'#86efac'}}>{totTarget>0?Math.round(totContact/totTarget*100):0}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {allCombined.some(l=>l.activity_status==='미처리'&&users.find(u=>u.name===l.assigned_to))&&(
                        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',padding:'8px 12px',fontSize:'12px',color:C.red,fontWeight:'700',marginTop:'8px'}}>
                          ⚠ {[...new Set(allCombined.filter(l=>l.activity_status==='미처리').map(l=>l.assigned_to))].join(', ')} — 미접촉 건 있음. 확인 필요
                        </div>
                      )}
                    </>)
                  })()}

                  {/* 카드 목록 */}
                  {actResultView==='카드'&&(filtered.length === 0
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
                  )}
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
            {/* ── 주간 계산 진단 패널 (다운로드 탭 상단) ── */}
            {(()=>{
              const _n=new Date(),_y=_n.getFullYear(),_m=_n.getMonth()
              const _ws=new Date(_y,_m,_n.getDate()-((_n.getDay()+6)%7),0,0,0,0).getTime()
              const _we=_ws+7*24*60*60*1000-1
              const _ms2=new Date(_y,_m,1).getTime(),_me=new Date(_y,_m+1,1).getTime()-1
              const _ok=(dt,s,e)=>{if(!dt)return false;try{const t=new Date(dt).getTime();return !isNaN(t)&&t>=s&&t<=e}catch{return false}}
              const myU2=isSuper?users:users.filter(u=>u.team_id===adminInfo?.teamId)
              const diag=myU2.map(u=>{
                const uL=leads.filter(l=>l.assigned_to===u.name)
                const uD=directLeads.filter(l=>l.mm_username===u.username)
                if(!uL.length&&!uD.length)return null
                const wA=uL.filter(l=>l.activity_status&&l.activity_status!=='미처리'&&_ok(l.activity_at||l.created_at,_ws,_we)).length
                      +uD.filter(l=>_ok(l.activity_at||l.created_at,_ws,_we)).length
                const mA=uL.filter(l=>l.activity_status&&l.activity_status!=='미처리'&&_ok(l.activity_at||l.created_at,_ms2,_me)).length
                      +uD.filter(l=>_ok(l.activity_at||l.created_at,_ms2,_me)).length
                return {name:u.name,wA,mA}
              }).filter(Boolean)
              const tW=diag.reduce((a,r)=>a+r.wA,0),tM=diag.reduce((a,r)=>a+r.mA,0)
              const ws=new Date(_ws).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})
              const we=new Date(_we).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})
              return(
                <div style={{background:tW>0?'#f0fdf4':'#fef9c3',border:'1.5px solid '+(tW>0?'#86efac':'#fde68a'),borderRadius:'10px',padding:'12px',marginBottom:'14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                    <span style={{fontWeight:'700',fontSize:'13px',color:tW>0?'#166534':'#854d0e'}}>
                      {tW>0?'✅':'⚠'} 주간 계산 진단 ({ws}~{we})
                    </span>
                    <span style={{fontSize:'12px'}}>
                      주간 <strong style={{color:tW>0?'#16a34a':'#e67e00'}}>{tW}건</strong> / 월간 <strong style={{color:'#2563eb'}}>{tM}건</strong>
                    </span>
                  </div>
                  <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                    {diag.map(r=>(
                      <span key={r.name} style={{background:'#fff',border:'1px solid '+(r.wA>0?'#86efac':'#e2e8f0'),borderRadius:'6px',padding:'3px 8px',fontSize:'11px'}}>
                        {r.name} <b style={{color:'#2563eb'}}>{r.wA}</b>/<b style={{color:'#64748b'}}>{r.mA}</b>
                      </span>
                    ))}
                  </div>
                  {tW===0&&tM>0&&<div style={{marginTop:'6px',fontSize:'11px',color:'#92400e'}}>
                    이번 주 activity_at/created_at이 {ws}~{we} 범위인 데이터가 없습니다.
                  </div>}
                </div>
              )
            })()}
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
                                {/* ── 팀 선택 (총괄관리자) ────────────────────────────── */}
                {isSuper && adminAccounts.length > 0 && (
                  <div style={{ marginBottom: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: C.text, marginBottom: '8px' }}>
                      📊 슬라이드 포함 팀 선택
                      <span style={{ fontSize: '11px', color: C.sub, fontWeight: '400', marginLeft: '8px' }}>선택하지 않으면 전체 팀 포함</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <button onClick={() => setSlideTeamIds([])}
                        style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid ' + (slideTeamIds.length === 0 ? C.acc : '#e2e8f0'), background: slideTeamIds.length === 0 ? C.acc : '#fff', color: slideTeamIds.length === 0 ? '#fff' : C.sub, fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                        🗂 전체 팀
                      </button>
                      {adminAccounts.map(a => (
                        <button key={a.username} onClick={() => {
                          setSlideTeamIds(prev =>
                            prev.includes(a.team_id)
                              ? prev.filter(id => id !== a.team_id)
                              : [...prev, a.team_id]
                          )
                        }}
                          style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid ' + (slideTeamIds.includes(a.team_id) ? C.blue : '#e2e8f0'), background: slideTeamIds.includes(a.team_id) ? C.blue : '#fff', color: slideTeamIds.includes(a.team_id) ? '#fff' : C.sub, fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {slideTeamIds.includes(a.team_id) ? '✓ ' : ''}{a.team_label || a.name}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: '11px', color: C.sub }}>
                      {slideTeamIds.length === 0
                        ? `전체 팀 (${adminAccounts.length}개 팀) 데이터가 포함됩니다`
                        : `선택된 팀: ${adminAccounts.filter(a => slideTeamIds.includes(a.team_id)).map(a => a.team_label || a.name).join(', ')}`
                      }
                    </div>
                  </div>
                )}
                <button onClick={async () => {
                  try {
                  // 팀 데이터 구성 (총괄: 전체팀, 일반: 본인팀)
                  // ── 실시간 데이터 구성 ──────────────────────────────
                  const slideAccs = isSuper
                    ? adminAccounts.filter(a => a.team_label && (slideTeamIds.length === 0 || slideTeamIds.includes(a.team_id)))
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

                  // ── 날짜 필터 헬퍼 — 타임스탬프 직접 비교 (클로저 의존 없음) ──
                  const _now2 = new Date()
                  const _y2 = _now2.getFullYear(), _m2 = _now2.getMonth()
                  const _wkMon = new Date(_y2,_m2,_now2.getDate()-((_now2.getDay()+6)%7),0,0,0,0).getTime()
                  const _wkSun = _wkMon + 7*24*60*60*1000 - 1
                  const _moStart = new Date(_y2,_m2,1).getTime()
                  const _moEnd   = new Date(_y2,_m2+1,1).getTime()-1
                  const _yrStart = new Date(_y2,0,1).getTime()
                  const _yrEnd   = new Date(_y2+1,0,1).getTime()-1
                  function _ms(dt){if(!dt)return -1;try{const t=new Date(dt).getTime();return isNaN(t)?-1:t}catch{return -1}}
                  const _inWk = dt=>{const t=_ms(dt);return t>=_wkMon&&t<=_wkSun}
                  const _inMo = dt=>{const t=_ms(dt);return t>=_moStart&&t<=_moEnd}
                  const _inYr = dt=>{const t=_ms(dt);return t>=_yrStart&&t<=_yrEnd}
                  // ── 기간 필터 헬퍼 (projData 앞에서 정의해야 사용 가능) ──
                  function isThisMonth(dt) { if(!dt)return false;try{const d=new Date(dt);return d.getFullYear()===curYear&&d.getMonth()+1===curMonth}catch{return false} }
                  function isThisYear(dt)  { if(!dt)return false;try{const d=new Date(dt);return d.getFullYear()===curYear}catch{return false} }
                  function isThisWeek(dt)  { if(!dt)return false;try{const d=new Date(dt);const now=new Date();const mon=new Date(now);mon.setHours(0,0,0,0);mon.setDate(now.getDate()-((now.getDay()+6)%7));const sun=new Date(mon);sun.setDate(mon.getDate()+6);sun.setHours(23,59,59,999);return d>=mon&&d<=sun}catch{return false} }

                  // 4대 프로젝트별 데이터 (주간/월간/연간 + mmStats + 테마주간 + 일별)
                  const todayDayNum = new Date().getDate()
                  const projData = [1,2,3,4].map(ptId => {
                    // project_type null인 기존 리드는 project 1로 처리 (업로드 당시 미설정)
                    const pl = leads.filter(l=>{
                      if(!myUsers.map(u=>u.name).includes(l.assigned_to)) return false
                      if(l.project_type===ptId) return true
                      // project_type 미설정(null) 리드는 project 1(배분)으로 포함
                      if(ptId===1 && (l.project_type===null||l.project_type===undefined)) return true
                      return false
                    })
                    const dl = (ptId>=3) ? directLeads.filter(l=>myUnames.includes(l.mm_username) && l.project_type===ptId) : []
                    const pt = PT.find(p=>p.id===ptId)
                    function pStats(filterFn) {
                      // 배분: 활동완료된 건, 날짜=activity_at 없으면 created_at
                      const fpDone=pl.filter(l=>{
                        if(!l.activity_status||l.activity_status==='미처리') return false
                        return filterFn(l.activity_at||l.created_at)
                      })
                      // 직접발굴: activity_at(결과입력일) 우선, 없으면 created_at(등록일)
                      const fdDone=dl.filter(l=>filterFn(l.activity_at||l.created_at))
                      const allF=[...fpDone,...fdDone]
                      return {
                        done:    fpDone.length + fdDone.length,
                        success: allF.filter(l=>l.activity_status==='성공').length,
                        prodCounts: calcProdCounts(allF.filter(l=>l.activity_status==='성공'))
                      }
                    }
                    const themes = [...new Set(pl.map(l=>l.project_name).filter(Boolean))].map(tn => {
                      const tl = pl.filter(l=>l.project_name===tn)
                      // 테마별 MM 기여 (팀 구분 포함)
                      const themeMMStats = myUsers.map(u=>{
                        const uTl = tl.filter(l=>l.assigned_to===u.name)
                        if(!uTl.length) return null
                        const acc2 = slideAccs.find(a=>a.team_id===u.team_id)
                        return {
                          name: u.name, team: acc2?.team_label||'-', total: uTl.length,
                          weekly:  { done: uTl.filter(l=>l.activity_status&&l.activity_status!=='미처리'&&_inWk(l.activity_at||l.created_at)).length, success: uTl.filter(l=>l.activity_status==='성공'&&_inWk(l.activity_at||l.created_at)).length },
                          monthly: { done: uTl.filter(l=>l.activity_status&&l.activity_status!=='미처리'&&_inMo(l.activity_at||l.created_at)).length, success: uTl.filter(l=>l.activity_status==='성공'&&_inMo(l.activity_at||l.created_at)).length }
                        }
                      }).filter(Boolean)
                      return {
                        name: tn, total: tl.length,
                        done:    tl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                        success: tl.filter(l=>l.activity_status==='성공').length,
                        weekly:  { done: tl.filter(l=>l.activity_status&&l.activity_status!=='미처리'&&_inWk(l.activity_at||l.created_at)).length,
                                   success: tl.filter(l=>l.activity_status==='성공'&&_inWk(l.activity_at||l.created_at)).length },
                        monthly: { done: tl.filter(l=>l.activity_status&&l.activity_status!=='미처리'&&_inMo(l.activity_at||l.created_at)).length,
                                   success: tl.filter(l=>l.activity_status==='성공'&&_inMo(l.activity_at||l.created_at)).length },
                        mmStats: themeMMStats
                      }
                    })
                    const newBuildingCount = ptId===3 ? dl.filter(l=>(l.note||'').includes('【신축건물】')).length : 0
                    const projMmStats = myUsers.map(u => {
                      const upl = pl.filter(l=>l.assigned_to===u.name)
                      const udl = dl.filter(l=>l.mm_username===u.username)
                      if(upl.length===0&&udl.length===0) return null
                      const acc2 = slideAccs.find(a=>a.team_id===u.team_id)
                      function mms(filterFn) {
                        // 배분: 활동완료된 건, 날짜=activity_at 없으면 created_at
                        const fpDone=upl.filter(l=>{
                          if(!l.activity_status||l.activity_status==='미처리') return false
                          return filterFn(l.activity_at||l.created_at)
                        })
                        // 직접발굴: activity_at(결과입력일) 우선, 없으면 created_at(등록일)
                        const fdDone=udl.filter(l=>filterFn(l.activity_at||l.created_at))
                        const allF=[...fpDone,...fdDone]
                        return {
                          mitDone:    fpDone.length,
                          directDone: fdDone.length,
                          actAll:     fpDone.length+fdDone.length,
                          success:    allF.filter(l=>l.activity_status==='성공').length
                        }
                      }
                      return {
                        name:u.name, team:acc2?.team_label||'-',
                        mitAssigned:upl.length, directTotal:udl.length,
                        weekly:mms(_inWk), monthly:mms(_inMo), annual:mms(_inYr),
                        prodCounts:calcProdCounts([...upl,...udl].filter(l=>l.activity_status==='성공'))
                      }
                    }).filter(Boolean)
                    const successCases = [...pl,...dl]
                      .filter(l=>l.activity_status==='성공'&&_inMo(l.activity_at||l.created_at))
                      .sort((a,b)=>new Date(b.activity_at||b.created_at||0)-new Date(a.activity_at||a.created_at||0))
                      .slice(0,20).map(l=>({
                        date: (l.activity_at||l.created_at)?new Date(l.activity_at||l.created_at).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}):'-',
                        mm: l.assigned_to||myUsers.find(u=>u.username===l.mm_username)?.name||'-',
                        address: l.address||l.customer||'-',
                        products: Array.isArray(l.products)?l.products.join(', '):(l.products||'-'),
                        result: l.activity_result||'-', memo:(l.activity_memo||'').slice(0,30)||'-',
                        contact: l.activity_contact||'-'
                      }))
                    const dailyMap = {}
                    // 배분: 활동완료된 건, 날짜=activity_at 없으면 created_at
                    pl.forEach(l=>{
                      if(!l.activity_status||l.activity_status==='미처리') return
                      const dt=l.activity_at||l.created_at
                      if(!dt||!_inMo(dt)) return
                      const day=new Date(dt).getDate()
                      if(!dailyMap[day]) dailyMap[day]={day,act:0,suc:0}
                      dailyMap[day].act++
                      if(l.activity_status==='성공') dailyMap[day].suc++
                    })
                    // 직접발굴: activity_at(결과입력일) 우선, 없으면 created_at(등록일)
                    dl.forEach(l=>{
                      const dt=l.activity_at||l.created_at
                      if(!dt||!_inMo(dt)) return
                      const day=new Date(dt).getDate()
                      if(!dailyMap[day]) dailyMap[day]={day,act:0,suc:0}
                      dailyMap[day].act++
                      if(l.activity_status==='성공') dailyMap[day].suc++
                    })
                    const dailyStats=Array.from({length:todayDayNum},(_,i)=>{const d=i+1;return dailyMap[d]||{day:d,act:0,suc:0}})
                    const successAll=[...pl,...dl].filter(l=>l.activity_status==='성공')
                    return {
                      id:ptId, name:pt?.label||'-', icon:pt?.icon||'', adminOnly:pt?.adminOnly||false,
                      total:pl.length, directTotal:dl.length,
                      done:pl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                      success:successAll.length, prodCounts:calcProdCounts(successAll),
                      themes, newBuildingCount, mmStats:projMmStats,
                      weekly:pStats(_inWk), monthly:pStats(_inMo), annual:pStats(_inYr),
                      successCases, dailyStats
                    }
                  })

                  // 전직원 세부 데이터 — 완전 독립 계산 (외부 함수 의존 없음)
                  
                  // 팀 필터: slideAccs에 포함된 팀만
                  const _teamIdSet = new Set(slideAccs.map(a=>a.team_id))
                  // 실제 영업 MM만 포함 (배분리드 또는 직접발굴 있는 사람 = CS/관리자 계정 제외)
                  const slideOnlyUsers = (slideAccs.length>0&&isSuper)
                    ? users.filter(u=>{
                        if(!_teamIdSet.has(u.team_id)) return false
                        return leads.some(l=>l.assigned_to===u.name)||directLeads.some(l=>l.mm_username===u.username)
                      })
                    : users.filter(u=>u.team_id===adminInfo?.teamId&&(leads.some(l=>l.assigned_to===u.name)||directLeads.some(l=>l.mm_username===u.username)))

                  const allMMData = slideOnlyUsers.map(u => {
                    const uL  = leads.filter(l=>l.assigned_to===u.name)
                    const uD  = directLeads.filter(l=>l.mm_username===u.username)
                    const acc = slideAccs.find(a=>a.team_id===u.team_id)

                    function stat(inFn) {
                      // 배분 활동: 미처리 제외, 날짜=activity_at 없으면 created_at
                      const mitArr = uL.filter(l=>{
                        if(!l.activity_status||l.activity_status==='미처리') return false
                        return inFn(l.activity_at||l.created_at)
                      })
                      // 직접발굴: activity_at(결과입력일) 우선, 없으면 created_at(등록일)
                      const dirArr = uD.filter(l=>inFn(l.activity_at||l.created_at))
                      const all = [...mitArr,...dirArr]
                      return {
                        mitDone:    mitArr.length,
                        directDone: dirArr.length,
                        actAll:     mitArr.length + dirArr.length,
                        success:    all.filter(l=>l.activity_status==='성공').length,
                        prodCounts: calcProdCounts(all.filter(l=>l.activity_status==='성공'))
                      }
                    }

                    return {
                      name:        u.name,
                      team:        acc?.team_label || adminInfo?.name || '-',
                      success:     u.success||0,
                      goal:        u.goal||10,
                      mitAssigned: uL.length,
                      mitDone:     uL.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                      directDone:  uD.length,
                      prodCounts:  calcProdCounts(uL.filter(l=>l.activity_status==='성공')),
                      weekly:      stat(_inWk),
                      monthly:     stat(_inMo),
                      annual:      stat(_inYr)
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
                  // 전체 일별 활동 트렌드 계산 (slideAccs 팀 기준)
                  const slideTeamUserNames = (slideAccs.length>0?slideAccs:[{team_id:adminInfo?.teamId}])
                    .flatMap(a=>users.filter(u=>u.team_id===a.team_id).map(u=>u.name))
                  const slideTeamUnames = (slideAccs.length>0?slideAccs:[{team_id:adminInfo?.teamId}])
                    .flatMap(a=>users.filter(u=>u.team_id===a.team_id).map(u=>u.username))
                  const allDailyMap = {}
                  // 배분: 활동완료된 건, 날짜=activity_at 없으면 created_at
                  leads.filter(l=>slideTeamUserNames.includes(l.assigned_to)).forEach(l=>{
                    if(!l.activity_status||l.activity_status==='미처리') return
                    const dt=l.activity_at||l.created_at
                    if(!_inMo(dt)) return
                    const day = new Date(dt).getDate()
                    if(!allDailyMap[day]) allDailyMap[day]={day,act:0,suc:0}
                    allDailyMap[day].act++
                    if(l.activity_status==='성공') allDailyMap[day].suc++
                  })
                  // 직접발굴: activity_at(결과입력일) 우선, 없으면 created_at(등록일)
                  directLeads.filter(l=>slideTeamUnames.includes(l.mm_username)).forEach(l=>{
                    const dt=l.activity_at||l.created_at
                    if(!_inMo(dt)) return
                    const day = new Date(dt).getDate()
                    if(!allDailyMap[day]) allDailyMap[day]={day,act:0,suc:0}
                    allDailyMap[day].act++
                    if(l.activity_status==='성공') allDailyMap[day].suc++
                  })
                  const todayDayNumAll = new Date().getDate()
                  const allDailyStats = Array.from({length:todayDayNumAll},(_,i)=>{const d=i+1;return allDailyMap[d]||{day:d,act:0,suc:0}})

                  // 영업일수 기반 목표 계산
                  const curBizDays = workDays[curMonth] || 0
                  const perMMTarget = curBizDays * 5  // 1인 월간 목표
                  const mmCount = allMMData.length || 1



                  // 팀별 월간+연간 데이터 (프로젝트별 MM 상세 포함)
                  const teamDataFull = (slideAccs.length>0?slideAccs:[{team_id:adminInfo?.teamId,team_label:adminInfo?.name||'우리팀'}]).map(acc=>{
                    // 실제 영업 MM만 (배분리드 또는 직접발굴 있는 사람)
                    const tm = users.filter(u=>{
                      if(u.team_id!==acc.team_id) return false
                      return leads.some(l=>l.assigned_to===u.name)||directLeads.some(l=>l.mm_username===u.username)
                    })
                    if(tm.length===0) return null
                    const tl = leads.filter(l=>tm.map(u=>u.name).includes(l.assigned_to))
                    const td = directLeads.filter(l=>tm.some(u=>u.username===l.mm_username))
                    function teamStats(filterFn) {
                      // 배분: 활동완료(미처리 제외)된 건 기준, 날짜=activity_at 없으면 created_at
                      const mitDoneLeads=tl.filter(l=>{
                        if(!l.activity_status||l.activity_status==='미처리') return false
                        return filterFn(l.activity_at||l.created_at)
                      })
                      // 직접발굴: activity_at(결과입력일) 우선, 없으면 created_at(등록일)
                      const directDoneLeads=td.filter(l=>filterFn(l.activity_at||l.created_at))
                      const allDone=[...mitDoneLeads,...directDoneLeads]
                      return {
                        mitLeads: tl.length,
                        mitDone: mitDoneLeads.length,
                        directDone: directDoneLeads.length,
                        actAll: mitDoneLeads.length + directDoneLeads.length,
                        success: allDone.filter(l=>l.activity_status==='성공').length,
                        goal: tm.reduce((a,u)=>a+(u.goal||10),0),
                        prodCounts: calcProdCounts(allDone.filter(l=>l.activity_status==='성공'))
                      }
                    }
                    return {
                      label: acc.team_label||acc.name||'팀', mm: tm.length,
                      weekly:  teamStats(_inWk),
                      monthly: teamStats(_inMo),
                      annual:  teamStats(_inYr),
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
                      const mMonthly = { mitDone: uLeads.filter(l=>_inMo(l.activity_at)&&l.activity_status&&l.activity_status!=='미처리').length, success: uLeads.filter(l=>_inMo(l.activity_at)&&l.activity_status==='성공').length + uDirect.filter(l=>_inMo(l.activity_at)&&l.activity_status==='성공').length }
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
                  const allSuccM = [...leads.filter(l=>myUsers.map(u=>u.name).includes(l.assigned_to)&&l.activity_status==='성공'&&_inMo(l.activity_at)), ...directLeads.filter(l=>myUnames.includes(l.mm_username)&&l.activity_status==='성공'&&_inMo(l.activity_at))]
                  const allSuccY = [...leads.filter(l=>myUsers.map(u=>u.name).includes(l.assigned_to)&&l.activity_status==='성공'&&isThisYear(l.activity_at)), ...directLeads.filter(l=>myUnames.includes(l.mm_username)&&l.activity_status==='성공'&&isThisYear(l.activity_at))]
                  const globalProdMonthly = calcProdCounts(allSuccM)
                  const globalProdAnnual  = calcProdCounts(allSuccY)

                  // ── 주간 디버그: 실제 날짜 범위와 데이터 확인 ──
                  const dbgNow = new Date()
                  const dbgDow = dbgNow.getDay()
                  const dbgMon = new Date(dbgNow.getFullYear(),dbgNow.getMonth(),dbgNow.getDate()-((dbgDow+6)%7),0,0,0,0)
                  const dbgSun = new Date(dbgMon.getTime()+7*24*60*60*1000-1)
                  const dbgWkLeads = leads.filter(l=>{
                    if(!l.activity_status||l.activity_status==='미처리') return false
                    const dt=l.activity_at||l.created_at; if(!dt) return false
                    const t=new Date(dt).getTime(); return t>=dbgMon.getTime()&&t<=dbgSun.getTime()
                  })
                  const dbgWkDirect = directLeads.filter(l=>{
                    const dt=l.activity_at||l.created_at; if(!dt) return false
                    const t=new Date(dt).getTime(); return t>=dbgMon.getTime()&&t<=dbgSun.getTime()
                  })
                  const dbgRecentAct = [...leads].filter(l=>l.activity_at).sort((a,b)=>new Date(b.activity_at)-new Date(a.activity_at)).slice(0,5)
                  console.log('=== 주간 디버그 ===')
                  console.log('이번 주 범위:', dbgMon.toLocaleDateString('ko-KR'), '~', dbgSun.toLocaleDateString('ko-KR'))
                  console.log('이번 주 배분활동:', dbgWkLeads.length, '건 / 직접발굴:', dbgWkDirect.length, '건')
                  console.log('최근 activity_at 5건:', dbgRecentAct.map(l=>l.assigned_to+'='+l.activity_at))
                  const dbgInfo = {
                    weekRange: dbgMon.toLocaleDateString('ko-KR')+' ~ '+dbgSun.toLocaleDateString('ko-KR'),
                    wkLeads: dbgWkLeads.length, wkDirect: dbgWkDirect.length,
                    recentDates: dbgRecentAct.map(l=>({who:l.assigned_to,at:l.activity_at,status:l.activity_status}))
                  }

                  const html = buildSlideHTML({ _debug: dbgInfo,
                    bizDays: curBizDays, perMMTarget, workDaysAll: workDays,
                    allDailyStats,
                    period: periodStr, today: todayStr, yearStr: curYear+'년',
                    teams: teamDataFull, projects: projDataFull,
                    allMM: allMMData, topMM: [...allMMData].sort((a,b)=>(b.monthly?.success||0)-(a.monthly?.success||0)).slice(0,5),
                    mDiscoveryCount: mDiscoveryTotal,
                    globalProdCounts: globalProdMonthly,
                    globalProdAnnual
                  })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
                  a.download = '상권통_보고서_' + new Date().toISOString().slice(0,7) + '.html'
                  a.click()
                  t2('슬라이드 장표 다운로드 완료!')
                  } catch(err) { t2('슬라이드 오류: ' + err.message); console.error('Slide error:', err) }
                }} style={{ width: '100%', background: C.blue, border: 'none', color: '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
                  🖨️ 슬라이드 장표 다운로드
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── 영업일수 설정 (총괄관리자 전용) ─────────────────────────── */}
        {tab === 'settings' && isSuper && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'19px', fontWeight:'900', color:C.text }}>⚙️ 영업일수 설정</h2>
              <span style={{ fontSize:'12px', color:C.sub }}>총괄관리자 전용 · 월별 영업일수 입력 → 활동목표 자동 계산</span>
            </div>
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'12px 16px', marginBottom:'14px', fontSize:'12px', color:'#1e40af' }}>
              💡 영업일수 = 해당 월 영업일 − 공휴일 − 특별휴무(체육행사 등) · 영업 미실시 월은 <strong>0</strong>으로 입력하면 누적 성과에서 제외됩니다.
              <br/>1인 월간 활동목표 = 5건/일 × 영업일수 · 팀 합계 = 1인목표 × MM수
            </div>
            {/* 연도 선택 */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden', marginBottom:'14px' }}>
              <div style={{ background:'#0d1b2a', color:'#fff', padding:'10px 16px', fontSize:'13px', fontWeight:'700' }}>📅 2026년 월별 영업일수</div>
              <div style={{ padding:'16px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'14px' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                    const bd = workDaysEdit !== null ? (workDaysEdit[m] ?? workDays[m] ?? 0) : (workDays[m] ?? 0)
                    const isEdit = workDaysEdit !== null
                    const goal1 = bd * 5
                    const goalAll = goal1 * (users.length || 8)
                    const isPast = m < new Date().getMonth()+1
                    const isCur  = m === new Date().getMonth()+1
                    return (
                      <div key={m} style={{ border:'1.5px solid '+(isCur?C.acc:bd===0?'#fecaca':'#e2e8f0'), borderRadius:'10px', padding:'10px 12px', background:isCur?'#fff7ed':bd===0?'#fef2f2':'#f8fafc' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                          <span style={{ fontSize:'12px', fontWeight:'700', color:isCur?C.acc:C.text }}>{m}월{isCur?' ◀ 현재':''}</span>
                          {bd===0&&<span style={{ fontSize:'9px', background:'#fecaca', color:'#991b1b', padding:'1px 6px', borderRadius:'10px' }}>미실시</span>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'5px' }}>
                          <input
                            type="number" min="0" max="31"
                            value={isEdit ? (workDaysEdit[m] ?? workDays[m] ?? 0) : bd}
                            onChange={e => {
                              const v = Math.max(0, Math.min(31, parseInt(e.target.value)||0))
                              setWorkDaysEdit(prev => ({ ...(prev||workDays), [m]: v }))
                            }}
                            style={{ width:'52px', padding:'5px 8px', border:'1.5px solid '+(isCur?C.acc:'#e2e8f0'), borderRadius:'6px', fontSize:'15px', fontWeight:'700', textAlign:'center', color:C.text, background:'#fff', fontFamily:'inherit' }}
                          />
                          <span style={{ fontSize:'11px', color:C.sub }}>일</span>
                        </div>
                        <div style={{ fontSize:'10px', color:C.sub }}>
                          1인목표 <strong style={{ color:goal1>0?C.acc:'#dc2626' }}>{goal1}건</strong><br/>
                          팀합계 <strong style={{ color:goalAll>0?C.blue:'#dc2626' }}>{goalAll}건</strong>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* 합계 미리보기 */}
                <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'10px', padding:'12px 16px', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'700', color:'#166534', marginBottom:'4px' }}>📊 연간 합계 계산 미리보기</div>
                    <div style={{ fontSize:'11px', color:'#15803d' }}>
                      영업 실시 월: {Object.values(workDaysEdit||workDays).filter(v=>v>0).length}개월 ·
                      총 영업일: {Object.values(workDaysEdit||workDays).reduce((a,v)=>a+(v||0),0)}일 ·
                      1인 연간목표: {Object.values(workDaysEdit||workDays).reduce((a,v)=>a+(v||0),0)*5}건
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'28px', fontWeight:'700', color:'#16a34a' }}>{Object.values(workDaysEdit||workDays).reduce((a,v)=>a+(v||0),0)*5*(users.length||8)}<span style={{ fontSize:'13px' }}>건</span></div>
                    <div style={{ fontSize:'10px', color:'#64748b' }}>팀 전체 연간목표</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button
                    onClick={async () => {
                      try {
                        const toSave = workDaysEdit || workDays
                        const jsonVal = JSON.stringify(toSave)
                        // upsert
                        await db.patch('app_settings', 'id=eq.biz_days_2026', { value: jsonVal, updated_at: new Date().toISOString() }).catch(async () => {
                          await db.post('app_settings', { id: 'biz_days_2026', value: jsonVal })
                        })
                        setWorkDays(toSave)
                        setWorkDaysEdit(null)
                        t2('✅ 영업일수 저장 완료! 슬라이드 장표에 자동 반영됩니다.')
                      } catch(e) { t2('저장 실패: '+e.message) }
                    }}
                    style={{ flex:1, padding:'12px', background:C.acc, border:'none', color:'#fff', borderRadius:'10px', fontSize:'14px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit' }}>
                    💾 저장 (슬라이드 자동 반영)
                  </button>
                  {workDaysEdit && (
                    <button onClick={()=>setWorkDaysEdit(null)} style={{ padding:'12px 20px', background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#64748b', borderRadius:'10px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>취소</button>
                  )}
                </div>
              </div>
            </div>
            {/* 안내 */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'14px 16px', fontSize:'12px', color:C.sub }}>
              <div style={{ fontWeight:'700', color:C.text, marginBottom:'6px' }}>📌 영업일수 반영 위치</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                <div>• 슬라이드 장표 → 1인 월간목표 계산</div>
                <div>• 슬라이드 장표 → 팀별 활동률 분모</div>
                <div>• 슬라이드 장표 → 전직원 세부 활동률</div>
                <div>• 슬라이드 장표 → 주간/월간/누적 목표</div>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
