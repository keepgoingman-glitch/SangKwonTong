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
  { id:5, label:'M플러스',                      icon:'🔍', adminOnly:false },
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
    const mDiscoveryCount = (mDiscovery || []).filter(m => m.team_id === acc.team_id).length  // M플러스: 실제 등록 건수
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
          {[{ l: '성공', v: success, c: C.green }, { l: '목표', v: goal, c: C.text }, { l: 'MIT', v: mit, c: C.blue }, { l: 'M플러스', v: mDiscoveryCount, c: '#7c3aed' }].map((s, i) => (
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
// 여러 성공건의 상품별 회선수 합산 (관리자용)
function calcProdTotals(leads) {
  const totals = {}
  leads.filter(l=>l.activity_status==='성공').forEach(l=>{
    try {
      const p = JSON.parse(l.won_products||'null')
      if (!p) return
      if (Array.isArray(p)) p.forEach(n=>{totals[n]=(totals[n]||0)+1})
      else Object.entries(p).forEach(([n,v])=>{totals[n]=(totals[n]||0)+Number(v)})
    } catch {}
  })
  return totals
}
function ProdSummaryText(leads) {
  const t = calcProdTotals(leads)
  const e = Object.entries(t).filter(([,v])=>v>0)
  return e.length ? e.map(([n,v])=>n+' '+v).join(' / ') : null
}

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
  const sucLeads = filtered.filter(l=>l.activity_status==='성공')
  const sucProdSummary = ProdSummaryText(sucLeads)
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
              {sucProdSummary&&<div style={{fontSize:'11px',fontWeight:'700',color:'#15803d',marginTop:'2px'}}>{sucProdSummary}</div>}
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
          const PRODS = ['인터넷','TV-M','TV-B','모바일','USIM','전화','약정갱신','기타','하이오더','로봇','CCTV']
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
  const [slideTeamIds, setSlideTeamIds] = useState([])
  const [droppedThemes, setDroppedThemes] = useState([])  // 드랍된 테마 목록
  const [mDiscStage, setMDiscStage] = useState('전체')
  const [qrPartners, setQrPartners] = useState([])
  const [qrStores, setQrStores] = useState([])
  const [qrLeads, setQrLeads] = useState([])
  const [qrView, setQrView] = useState('overview')
  const [showQrForm, setShowQrForm] = useState(false)
  const [qrForm, setQrForm] = useState({ username:'', password:'', name:'', team_id:'' })
  const [slideMonth, setSlideMonth] = useState(new Date().getMonth()+1)  // 슬라이드 대상 월  // [] = 전체 선택
  const [workDaysEdit, setWorkDaysEdit] = useState(null)  // 편집 중인 값
  const [period, setPeriod] = useState('일간'); const [selMM, setSelMM] = useState('전체')
  const [dashView, setDashView] = useState('전체 활동')  // '전체' | 프로젝트명
  const [dashTeam, setDashTeam] = useState('전체')  // 총괄: 팀 필터
  const [users, setUsers] = useState([]); const [leads, setLeads] = useState([])
  const [agencies, setAgencies] = useState([])
  const [directLeads, setDirectLeads] = useState([]); const [mDiscovery, setMDiscovery] = useState([])
  const [loading, setLoading] = useState(false); const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false); const [editUser, setEditUser] = useState(null)
  const [editTeam, setEditTeam] = useState(null)
  const [filterSt, setFilterSt] = useState('전체')
  const [actSearch, setActSearch] = useState('')
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
      const lSel = 'select=id,col1,col2,col3,col4,col5,address,products,assigned_to,assign_status,activity_status,activity_result,activity_memo,activity_contact,activity_at,team_id,project_name,theme_name,project_type,won_products,won_lines,circuit_number,activation_date'
      const dSel = 'select=id,mm_username,customer,address,contact,products,note,project_type,activity_status,activity_result,activity_memo,activity_contact,activity_at,created_at,won_products,won_lines,circuit_number,activation_date'
      const lq = (ai?.role === 'team' && ai?.teamId)
        ? lSel + '&team_id=eq.' + ai.teamId + '&order=created_at.desc&limit=2000'
        : lSel + '&order=created_at.desc&limit=2000'
      const mdq = 'select=*&' + ((ai?.role === 'team' && ai?.teamId) ? 'team_id=eq.' + ai.teamId + '&order=created_at.desc&limit=500' : 'order=created_at.desc&limit=500')
      if (ai?.role === 'super') {
        db.get('admin_accounts', 'role=eq.team&order=username.asc').then(r => setAdminAccounts(r || [])).catch(()=>{})
      }
      // mm_direct_leads: photos 제외 + 팀 필터 (mm_users 로드 후 필터)
      const [u, l, dlRaw, md, qrP, qrS, qrL, agcy] = await Promise.all([
        db.get('mm_users', uq),
        db.get('connector_leads', lq),
        db.get('mm_direct_leads', dSel + '&order=created_at.desc&limit=2000'),
        db.get('m_discovery', mdq).catch(() => []),
        db.get('qr_partners', 'select=*&order=created_at.desc').catch(() => []),
        db.get('qr_stores', 'select=*&order=created_at.desc&limit=1000').catch(() => []),
        db.get('qr_leads', 'select=*&order=created_at.desc&limit=2000').catch(() => []),
        db.get('agencies', 'select=*&order=type.asc,name.asc').catch(() => [])
      ])
      // 팀관리자: mm_direct_leads을 해당 팀 MM만 필터
      const teamUnames = u.map(x => x.username)
      const dl = (ai?.role === 'team') ? dlRaw.filter(d => teamUnames.includes(d.mm_username)) : dlRaw
      setUsers(u); setLeads(l); setDirectLeads(dl); setMDiscovery(md)
      setQrPartners(qrP||[]); setQrStores(qrS||[]); setQrLeads(qrL||[]); setAgencies(agcy||[])
      // 드랍된 테마 로드
      db.get('app_settings', 'id=eq.dropped_themes').then(rows=>{
        try{const v=rows?.[0]?.value;setDroppedThemes(v?JSON.parse(v):[])}catch{setDroppedThemes([])}
      })
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
  const handleDelete = async (id, name) => { if (!window.confirm('【' + (name||'이 직원') + '】 계정을 정말로 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.')) return; try { await db.del('mm_users', 'id=eq.' + id); t2('삭제 완료'); load() } catch { t2('삭제 실패') } }

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
  bizDays=0, perMMTarget=0, workDaysAll={}, allDailyStats=[], _debug={}, reportMode='current', momData=null }) {
  const isPast = reportMode==='past'

  const pct=(n,d)=>d>0?Math.round(n/d*100):0
  const sucRate=(s,a)=>a>0?Math.round(s/a*100):0
  const PRODS=['인터넷','TV-M','TV-B','모바일','USIM','전화','약정갱신','기타','하이오더','로봇','CCTV']
  const PRODLABEL=p=>({'다량회선':'TV-B','일반전화':'전화','TV':'TV-M'}[p]||p)
  const PC={1:'#2563eb',2:'#d97706',3:'#7c3aed',4:'#16a34a',5:'#0891b2'}
  const mmCount=teams.reduce((a,t)=>a+(t.mm||0),0)||allMM.length||1
  const totalMonthTarget=perMMTarget*mmCount
  const annualTarget=Object.values(workDaysAll).reduce((a,v)=>a+(Number(v)||0),0)*5*mmCount

  // ── 전체 통계 (allMM 기준) ──
  const mAct=allMM.reduce((a,m)=>a+(m.monthly?.actAll||0),0)
  const mSuc=allMM.reduce((a,m)=>a+(m.monthly?.success||0),0)
  const wAct=allMM.reduce((a,m)=>a+(m.weekly?.actAll||0),0)
  const wSuc=allMM.reduce((a,m)=>a+(m.weekly?.success||0),0)
  const yAct=allMM.reduce((a,m)=>a+(m.annual?.actAll||0),0)
  const ySuc=allMM.reduce((a,m)=>a+(m.annual?.success||0),0)
  const wkTarget=mmCount*5*5

  // 상품 분류: 인터넷 / TV-M / TV-B / 모바일(+USIM) / 기타 (구버전 명칭 호환)
  function prodGroup(pc){
    const inet=pc['인터넷']||0
    const tv=(pc['TV-M']||0)+(pc['TV']||0)            // 구 'TV' → TV-M
    const tvbiz=(pc['TV-B']||0)+(pc['다량회선']||0)    // 구 '다량회선' → TV-B
    const mob=(pc['모바일']||0)+(pc['USIM']||0)        // 모바일+USIM 합산
    const known=['인터넷','TV-M','TV','TV-B','다량회선','모바일','USIM']
    const etc=Object.entries(pc).filter(([k])=>!known.includes(k)).reduce((a,[,v])=>a+v,0)
    return {inet,tv,tvbiz,mob,etc,total:inet+tv+tvbiz+mob+etc}
  }

  const css=`
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{font-family:'Noto Sans KR','Malgun Gothic',sans-serif;background:#1a1a2e}
  .slide{width:1280px;height:720px;background:#fff;margin:20px auto;position:relative;overflow:hidden;display:flex;flex-direction:column;page-break-after:always}
  table{border-collapse:collapse;width:100%}
  th{background:#16213e;color:#fff;padding:8px 6px;font-size:12px;font-weight:700;border:1px solid #2a3a5c;text-align:center}
  td{padding:7px 6px;font-size:12.5px;border:1px solid #e2e8f0;text-align:center;color:#1e293b}
  .rh{padding:16px 36px 10px;display:flex;justify-content:space-between;align-items:center}
  .rt{font-size:23px;font-weight:900;color:#16213e}
  .rb{font-size:12px;background:#fff7ed;color:#e67e00;border:1px solid #fed7aa;padding:3px 12px;border-radius:20px;font-weight:700;margin-left:10px}
  .rd{font-size:12px;color:#94a3b8}
  .dbar{background:#16213e;color:#fff;padding:8px 36px;display:flex;gap:24px;font-size:13px;font-weight:600}
  .dbar b{color:#fbbf24}
  .body{flex:1;padding:14px 36px;overflow:hidden}
  .bc{color:#2563eb;font-weight:700}.gc{color:#16a34a;font-weight:700}
  .oc{color:#d97706;font-weight:700}.rc{color:#dc2626;font-weight:700}
  .wk-bg{background:#eff6ff!important}
  .mo-bg{background:#f0fdf4!important}
  .yr-bg{background:#faf5ff!important}
  .prod-bg{background:#fffbeb!important}
  .prod-bg-alt{background:#fef3c7!important}
  .ftr{background:#16213e;color:rgba(255,255,255,0.55);padding:6px 36px;display:flex;justify-content:space-between;font-size:11px}
  .ftr b{color:#fbbf24}
  .print-btn{position:fixed;top:16px;right:16px;z-index:999;background:#e67e00;color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.3);font-family:inherit}
  .print-btn:hover{background:#d97706}
  .kgroup{flex:1;border-radius:14px;padding:12px 16px;border:1.5px solid}
  .kgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px}
  .kcell{text-align:center}
  .kv{font-size:23px;font-weight:900}
  .kl{font-size:10.5px;color:#64748b;margin-top:1px}
  @media print{body{background:#fff;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.slide{margin:0;box-shadow:none}.print-btn,.print-hint{display:none!important};@page{size:1280px 720px;margin:0}}
  `

  const TOTAL_PAGES = 9
  function rh(title, badge, num){
    return `<div class="rh"><div><span class="rt">${title}</span>${badge?`<span class="rb">${badge}</span>`:''}</div><div class="rd">${today} · ${num}/${TOTAL_PAGES}</div></div>`
  }
  const dbar=`<div class="dbar"><span>${period}</span><span>영업일 <b>${bizDays}일</b></span><span>1인목표 <b>${perMMTarget}건</b> (5건×${bizDays}일)</span><span><b>${mmCount}명</b> 합계목표 <b>${totalMonthTarget}건</b></span><span>기준일 <b>${today}</b></span></div>`
  function ftr(num){
    return `<div class="ftr"><span>상권통 영업 보고서 · ${period}</span><span><b>영업일 ${bizDays}일 | 1인목표 ${perMMTarget}건 | 기준일 ${today}</b></span><span>${num} / ${TOTAL_PAGES}</span></div>`
  }

  // ════ S1: 표지 ════
  const s1=`<div class="slide" id="s1" style="background:linear-gradient(135deg,#16213e 0%,#1a1a2e 60%,#0f3460 100%);justify-content:center;align-items:center;color:#fff">
  <div style="text-align:center">
    <div style="font-size:15px;letter-spacing:6px;color:#e67e00;font-weight:700;margin-bottom:18px">SANGKWONTONG REPORT</div>
    <h1 style="font-size:54px;font-weight:900;margin-bottom:10px">상권통 영업활동 보고서</h1>
    <div style="font-size:20px;color:rgba(255,255,255,0.7);margin-bottom:14px">${period} 실적 현황${isPast?' (월마감)':''}</div>
    <div style="display:inline-block;background:rgba(230,126,0,0.15);border:1px solid rgba(230,126,0,0.5);border-radius:30px;padding:8px 26px;font-size:14px;color:#fbbf24;font-weight:700;margin-bottom:32px">영업일 ${bizDays}일 | 1인목표 ${perMMTarget}건 | ${mmCount}명 합계목표 ${totalMonthTarget}건</div>
    <div style="display:flex;gap:16px;justify-content:center">
      ${teams.map(t=>`<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:18px 30px;min-width:200px">
        <div style="font-size:17px;font-weight:800;color:#e67e00;margin-bottom:8px">${t.label}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.9">MM ${t.mm}명 · 목표 ${t.goal||t.mm*perMMTarget}건<br/>${isPast?'월마감':'월간'} 활동 <b style="color:#60a5fa">${t.monthly?.actAll||0}건</b> · 성공 <b style="color:#4ade80">${t.monthly?.success||0}건</b></div>
      </div>`).join('')}
    </div>
  </div>
  <div style="position:absolute;bottom:24px;width:100%;display:flex;justify-content:space-between;padding:0 50px;font-size:11px;color:rgba(255,255,255,0.4)">
    <span>KT 상권통 플랫폼 · 영업관리 자동화</span>
    <span style="color:#e67e00;font-weight:600">상권통 SANGKWONTONG</span>
    <span>자동 생성 · ${today}</span>
  </div>
</div>`

  // ════ S2: 핵심 성과 요약 (팀별 표 + 좌측 상품 컬럼) ════
  const teamProdRows = teams.map(t=>({t, pg:prodGroup(t.monthly?.prodCounts||{})}))
  const allProdMonthly = prodGroup(teamProdRows.reduce((acc,{pg})=>({
    '인터넷':(acc['인터넷']||0)+pg.inet,'TV':(acc['TV']||0)+pg.tv,'다량회선':(acc['다량회선']||0)+pg.tvbiz,'모바일':(acc['모바일']||0)+pg.mob,'기타':(acc['기타']||0)+pg.etc
  }),{}))

  const s2=`<div class="slide" id="s2">
  ${rh('핵심 성과 요약', isPast?'월마감 → 누적':'주간 → 월간 → 누적', 2)}
  ${dbar}
  <div class="body">
    <div style="display:flex;gap:12px;margin-bottom:12px">
      ${isPast?'':`<div class="kgroup" style="background:#eff6ff;border-color:#bfdbfe">
        <div style="font-size:13px;font-weight:800;color:#1d4ed8">주간 (이번주)</div>
        <div class="kgrid">
          <div class="kcell"><div class="kv" style="color:#2563eb">${wAct}<span style="font-size:13px">건</span></div><div class="kl">활동건</div></div>
          <div class="kcell"><div class="kv" style="color:#64748b">${wkTarget}<span style="font-size:13px">건</span></div><div class="kl">주간목표</div></div>
          <div class="kcell"><div class="kv" style="color:#2563eb">${pct(wAct,wkTarget)}<span style="font-size:13px">%</span></div><div class="kl">활동률</div></div>
          <div class="kcell"><div class="kv" style="color:#16a34a">${wSuc}<span style="font-size:13px">건</span></div><div class="kl">성공 / ${sucRate(wSuc,wAct)}%</div></div>
        </div>
      </div>`}
      <div class="kgroup" style="background:#f0fdf4;border-color:#bbf7d0">
        <div style="font-size:13px;font-weight:800;color:#15803d">${isPast?'월마감':'월간'} (${period.replace(' (월마감)','')})</div>
        <div class="kgrid">
          <div class="kcell"><div class="kv" style="color:#2563eb">${mAct}<span style="font-size:13px">건</span></div><div class="kl">활동건</div></div>
          <div class="kcell"><div class="kv" style="color:#64748b">${totalMonthTarget}<span style="font-size:13px">건</span></div><div class="kl">월간목표</div></div>
          <div class="kcell"><div class="kv" style="color:#2563eb">${pct(mAct,totalMonthTarget)}<span style="font-size:13px">%</span></div><div class="kl">활동률</div></div>
          <div class="kcell"><div class="kv" style="color:#16a34a">${mSuc}<span style="font-size:13px">건</span></div><div class="kl">성공 / ${sucRate(mSuc,mAct)}%</div></div>
        </div>
      </div>
      <div class="kgroup" style="background:#faf5ff;border-color:#e9d5ff">
        <div style="font-size:13px;font-weight:800;color:#7c3aed">연간 누적 (${yearStr})</div>
        <div class="kgrid">
          <div class="kcell"><div class="kv" style="color:#7c3aed">${yAct}<span style="font-size:13px">건</span></div><div class="kl">누적 활동</div></div>
          <div class="kcell"><div class="kv" style="color:#64748b">${annualTarget||'-'}<span style="font-size:13px">건</span></div><div class="kl">연간목표</div></div>
          <div class="kcell"><div class="kv" style="color:#7c3aed">${annualTarget?pct(yAct,annualTarget):'-'}<span style="font-size:13px">%</span></div><div class="kl">활동률</div></div>
          <div class="kcell"><div class="kv" style="color:#16a34a">${ySuc}<span style="font-size:13px">건</span></div><div class="kl">누적성공 / ${sucRate(ySuc,yAct)}%</div></div>
        </div>
      </div>
    </div>
    <div style="font-size:14px;font-weight:800;color:#16213e;margin-bottom:6px">팀별 × ${isPast?'월마감/누적':'주간/월간/누적'} 종합 현황 <span style="font-size:11px;color:#94a3b8;font-weight:400">— 좌측: 상품별 성과 (월간, 회선)</span></div>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width:75px">팀</th>
          <th rowspan="2">MM</th>
          <th colspan="5" style="background:#b45309">상품별 성과 (월간, 회선)</th>
          ${isPast?'':'<th colspan="4" style="background:#1d4ed8">주간 (이번주)</th>'}
          <th colspan="4" style="background:#15803d">${isPast?'월마감':'월간'}</th>
          <th colspan="3" style="background:#7c3aed">연간 누적</th>
        </tr>
        <tr>
          <th style="background:#d97706">인터넷</th><th style="background:#d97706">TV-M</th><th style="background:#d97706">TV-B</th><th style="background:#d97706">모바일</th><th style="background:#d97706">기타</th>
          ${isPast?'':'<th style="background:#2563eb">목표</th><th style="background:#2563eb">활동</th><th style="background:#2563eb">활동률</th><th style="background:#2563eb">성공/률</th>'}
          <th style="background:#16a34a">월목표</th><th style="background:#16a34a">활동</th><th style="background:#16a34a">활동률</th><th style="background:#16a34a">성공/률</th>
          <th style="background:#9333ea">활동</th><th style="background:#9333ea">성공</th><th style="background:#9333ea">성공률</th>
        </tr>
      </thead>
      <tbody>
        ${teamProdRows.map(({t,pg})=>{
          const tw=t.weekly||{}, tm2=t.monthly||{}, ty=t.annual||{}
          const tGoal=t.mm*perMMTarget, twGoal=t.mm*5*5
          return `<tr>
          <td style="font-weight:800">${t.label}</td><td>${t.mm}명</td>
          <td class="prod-bg" style="font-weight:800;color:#b45309">${pg.inet||'-'}</td><td class="prod-bg" style="font-weight:700">${pg.tv||'-'}</td><td class="prod-bg" style="font-weight:700">${pg.tvbiz||'-'}</td><td class="prod-bg" style="font-weight:700">${pg.mob||'-'}</td><td class="prod-bg" style="color:#64748b">${pg.etc||'-'}</td>
          ${isPast?'':`<td class="wk-bg">${twGoal}건</td><td class="wk-bg bc">${tw.actAll||0}건</td><td class="wk-bg oc">${pct(tw.actAll||0,twGoal)}%</td><td class="wk-bg gc">${tw.success||0}건/${sucRate(tw.success||0,tw.actAll||0)}%</td>`}
          <td class="mo-bg">${tGoal}건</td><td class="mo-bg bc">${tm2.actAll||0}건</td><td class="mo-bg">${pct(tm2.actAll||0,tGoal)}%</td><td class="mo-bg gc">${tm2.success||0}건/${sucRate(tm2.success||0,tm2.actAll||0)}%</td>
          <td class="yr-bg bc">${ty.actAll||0}건</td><td class="yr-bg gc">${ty.success||0}건</td><td class="yr-bg">${sucRate(ty.success||0,ty.actAll||0)}%</td>
        </tr>`}).join('')}
        <tr style="font-weight:900">
          <td style="background:#16213e;color:#fff">전 체</td><td style="background:#16213e;color:#fff">${mmCount}명</td>
          <td style="background:#b45309;color:#fff">${allProdMonthly.inet||'-'}</td><td style="background:#b45309;color:#fff">${allProdMonthly.tv||'-'}</td><td style="background:#b45309;color:#fff">${allProdMonthly.tvbiz||'-'}</td><td style="background:#b45309;color:#fff">${allProdMonthly.mob||'-'}</td><td style="background:#b45309;color:#fff">${allProdMonthly.etc||'-'}</td>
          ${isPast?'':`<td style="background:#1d4ed8;color:#fff">${wkTarget}건</td><td style="background:#1d4ed8;color:#bfdbfe">${wAct}건</td><td style="background:#1d4ed8;color:#fff">${pct(wAct,wkTarget)}%</td><td style="background:#1d4ed8;color:#86efac">${wSuc}건/${sucRate(wSuc,wAct)}%</td>`}
          <td style="background:#15803d;color:#fff">${totalMonthTarget}건</td><td style="background:#15803d;color:#bbf7d0">${mAct}건</td><td style="background:#15803d;color:#fff">${pct(mAct,totalMonthTarget)}%</td><td style="background:#15803d;color:#bbf7d0">${mSuc}건/${sucRate(mSuc,mAct)}%</td>
          <td style="background:#7c3aed;color:#e9d5ff">${yAct}건</td><td style="background:#7c3aed;color:#e9d5ff">${ySuc}건</td><td style="background:#7c3aed;color:#fff">${sucRate(ySuc,yAct)}%</td>
        </tr>
      </tbody>
    </table>
    <div style="font-size:14px;font-weight:800;color:#16213e;margin:12px 0 6px">상품별 성공 상세 <span style="font-size:11px;color:#15803d;font-weight:700">(월간 기준, 회선)</span></div>
    <table>
      <thead><tr><th style="width:80px">구분</th>${PRODS.map(p=>`<th>${PRODLABEL(p)}</th>`).join('')}<th style="background:#166534">합계</th></tr></thead>
      <tbody>
        ${teams.map((t,i)=>{
          const pc2=t.monthly?.prodCounts||{}
          const tot=Object.values(pc2).reduce((a,v)=>a+v,0)
          return `<tr style="background:${i%2?'#f8fafc':'#fff'}">
            <td style="font-weight:800">${t.label}</td>
            ${PRODS.map(p=>`<td class="${p==='인터넷'?'bc':''}">${pc2[p]||'-'}</td>`).join('')}
            <td style="background:#f0fdf4;font-weight:900;color:#15803d">${tot||'-'}</td>
          </tr>`}).join('')}
        <tr style="background:#16213e;color:#fff;font-weight:900">
          <td style="color:#fff">전 체</td>
          ${PRODS.map(p=>{
            const v=teams.reduce((a,t)=>a+((t.monthly?.prodCounts||{})[p]||0),0)
            return `<td style="color:${p==='인터넷'?'#60a5fa':'#fff'}">${v||'-'}</td>`
          }).join('')}
          <td style="background:#166534;color:#fff">${teams.reduce((a,t)=>a+Object.values(t.monthly?.prodCounts||{}).reduce((x,y)=>x+y,0),0)||'-'}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${ftr(2)}
</div>`

  // ════ SVG 라인 차트 생성기 ════
  function svgLineChart(data, opts){
    const {w=560,h=105,padL=34,padR=14,padT=16,padB=16} = opts||{}
    if(!data.length) return '<div style="color:#94a3b8;font-size:12px;padding:30px;text-align:center">데이터 없음</div>'
    const cw=w-padL-padR, ch=h-padT-padB
    const maxV=Math.max(...data.map(d=>Math.max(d.act,d.suc)),1)
    const xs=i=>padL+(data.length===1?cw/2:i*(cw/(data.length-1)))
    const ys=v=>padT+ch-(v/maxV)*ch
    const lblStep=Math.max(1,Math.ceil(data.length/8))
    const actPath=data.map((d,i)=>(i===0?'M':'L')+xs(i).toFixed(1)+','+ys(d.act).toFixed(1)).join(' ')
    const sucPath=data.map((d,i)=>(i===0?'M':'L')+xs(i).toFixed(1)+','+ys(d.suc).toFixed(1)).join(' ')
    const actDots=data.map((d,i)=>d.act>0?`<circle cx="${xs(i).toFixed(1)}" cy="${ys(d.act).toFixed(1)}" r="3" fill="#2563eb"/><text x="${xs(i).toFixed(1)}" y="${(ys(d.act)-7).toFixed(1)}" font-size="9.5" fill="#2563eb" text-anchor="middle" font-weight="700">${d.act}</text>`:'').join('')
    const sucDots=data.map((d,i)=>d.suc>0?`<circle cx="${xs(i).toFixed(1)}" cy="${ys(d.suc).toFixed(1)}" r="3" fill="#16a34a"/><text x="${xs(i).toFixed(1)}" y="${(ys(d.suc)+13).toFixed(1)}" font-size="9.5" fill="#16a34a" text-anchor="middle" font-weight="700">${d.suc}</text>`:'').join('')
    const xLabels=data.map((d,i)=>(i%lblStep===0||i===data.length-1)?`<text x="${xs(i).toFixed(1)}" y="${h-5}" font-size="9.5" fill="#94a3b8" text-anchor="middle">${d.day}일</text>`:'').join('')
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">
      <line x1="${padL}" y1="${padT+ch}" x2="${w-padR}" y2="${padT+ch}" stroke="#e2e8f0"/>
      <line x1="${padL}" y1="${padT}" x2="${w-padR}" y2="${padT}" stroke="#f1f5f9" stroke-dasharray="3"/>
      <text x="${padL-5}" y="${padT+4}" font-size="9.5" fill="#94a3b8" text-anchor="end">${maxV}</text>
      <text x="${padL-5}" y="${padT+ch+4}" font-size="9.5" fill="#94a3b8" text-anchor="end">0</text>
      <path d="${actPath}" fill="none" stroke="#2563eb" stroke-width="2.2"/>
      <path d="${sucPath}" fill="none" stroke="#16a34a" stroke-width="2" stroke-dasharray="5,3"/>
      ${actDots}${sucDots}${xLabels}
    </svg>`
  }
  function svgCumChart(data, opts){
    const {w=560,h=105,padL=40,padR=14,padT=16,padB=16} = opts||{}
    if(!data.length) return '<div style="color:#94a3b8;font-size:12px;padding:30px;text-align:center">데이터 없음</div>'
    let ca=0, cs=0
    const cum=data.map(d=>{ca+=d.act;cs+=d.suc;return{day:d.day,cumAct:ca,cumSuc:cs}})
    const cw=w-padL-padR, ch=h-padT-padB
    const maxV=Math.max(cum[cum.length-1].cumAct,1)
    const xs=i=>padL+(cum.length===1?cw/2:i*(cw/(cum.length-1)))
    const ys=v=>padT+ch-(v/maxV)*ch
    const lblStep=Math.max(1,Math.ceil(cum.length/8))
    const actPath=cum.map((d,i)=>(i===0?'M':'L')+xs(i).toFixed(1)+','+ys(d.cumAct).toFixed(1)).join(' ')
    const areaPath=actPath+` L${xs(cum.length-1).toFixed(1)},${(padT+ch).toFixed(1)} L${padL},${(padT+ch).toFixed(1)} Z`
    const sucPath=cum.map((d,i)=>(i===0?'M':'L')+xs(i).toFixed(1)+','+ys(d.cumSuc).toFixed(1)).join(' ')
    const marks=cum.map((d,i)=>{
      if(i===0||i===cum.length-1||(i%lblStep===0&&d.cumAct>0)){
        return `<circle cx="${xs(i).toFixed(1)}" cy="${ys(d.cumAct).toFixed(1)}" r="3" fill="#2563eb"/><text x="${xs(i).toFixed(1)}" y="${(ys(d.cumAct)-7).toFixed(1)}" font-size="9.5" fill="#2563eb" text-anchor="middle" font-weight="700">${d.cumAct}</text>`
      }
      return ''
    }).join('')
    const lastSuc=cum[cum.length-1]
    const xLabels=cum.map((d,i)=>(i%lblStep===0||i===cum.length-1)?`<text x="${xs(i).toFixed(1)}" y="${h-5}" font-size="9.5" fill="#94a3b8" text-anchor="middle">${d.day}일</text>`:'').join('')
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">
      <line x1="${padL}" y1="${padT+ch}" x2="${w-padR}" y2="${padT+ch}" stroke="#e2e8f0"/>
      <text x="${padL-5}" y="${padT+4}" font-size="9.5" fill="#94a3b8" text-anchor="end">${maxV}</text>
      <text x="${padL-5}" y="${padT+ch+4}" font-size="9.5" fill="#94a3b8" text-anchor="end">0</text>
      <path d="${areaPath}" fill="rgba(37,99,235,0.08)"/>
      <path d="${actPath}" fill="none" stroke="#2563eb" stroke-width="2.4"/>
      <path d="${sucPath}" fill="none" stroke="#16a34a" stroke-width="2" stroke-dasharray="5,3"/>
      ${marks}
      <circle cx="${xs(cum.length-1).toFixed(1)}" cy="${ys(lastSuc.cumSuc).toFixed(1)}" r="3.5" fill="#16a34a"/>
      <text x="${xs(cum.length-1).toFixed(1)}" y="${(ys(lastSuc.cumSuc)+14).toFixed(1)}" font-size="10" fill="#16a34a" text-anchor="middle" font-weight="800">${lastSuc.cumSuc}</text>
      ${xLabels}
    </svg>`
  }

  // ════ 전월 대비 비교 섹션 ════
  function momSection(){
    if(!momData) return ''
    const p=momData.prev, c=momData.cur
    const diff=(cur,prev)=>cur-prev
    const pct=(cur,prev)=>prev>0?Math.round((cur-prev)/prev*100):(cur>0?100:0)
    const arrow=(d)=>d>0?'▲':d<0?'▼':'-'
    const col=(d)=>d>0?'#16a34a':d<0?'#dc2626':'#94a3b8'
    const row=(label,cur,prev,suffix,isRate)=>{
      const d=Math.round((cur-prev)*10)/10
      const p2=isRate?(d>0?'+'+d+'%p':d+'%p'):(pct(cur,prev)>=0?'+'+pct(cur,prev)+'%':pct(cur,prev)+'%')
      return `<tr>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;font-weight:700;background:#f8fafc">${label}</td>
        <td style="padding:7px 6px;border:1px solid #e2e8f0;text-align:center;color:#64748b">${prev}${suffix}</td>
        <td style="padding:7px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:800">${cur}${suffix}</td>
        <td style="padding:7px 6px;border:1px solid #e2e8f0;text-align:center;color:${col(d)};font-weight:800">${arrow(d)} ${Math.abs(d)}${isRate?'%p':''}<br><span style="font-size:9.5px">${isRate?'':p2}</span></td>
      </tr>`
    }
    // 막대 그래프 (활동/성공/회선)
    const mx=Math.max(p.act,c.act,1)
    const bh=(v)=>Math.max(Math.round(v/mx*82),2)
    const grp=(x,label,pv,cv,colPrev,colCur)=>{
      const ph=bh(pv),ch=bh(cv)
      return `
        <rect x="${x}" y="${118-ph}" width="30" height="${ph}" fill="${colPrev}" rx="3"/>
        <rect x="${x+34}" y="${118-ch}" width="30" height="${ch}" fill="${colCur}" rx="3"/>
        <text x="${x+15}" y="${113-ph}" font-size="9.5" fill="#64748b" text-anchor="middle" font-weight="700">${pv}</text>
        <text x="${x+49}" y="${113-ch}" font-size="9.5" fill="${colCur}" text-anchor="middle" font-weight="800">${cv}</text>
        <text x="${x+32}" y="134" font-size="10.5" fill="#334155" text-anchor="middle" font-weight="700">${label}</text>`
    }
    const totDiffPct=pct(c.act,p.act), succDiffPct=pct(c.success,p.success), lineDiffPct=pct(c.lines,p.lines)
    const trend = (totDiffPct>=0&&succDiffPct>=0) ? '전 지표 상승세' : (totDiffPct<0&&succDiffPct<0) ? '전월 대비 하락, 활동량 점검 필요' : '지표별 혼조'
    const sumCol = (totDiffPct>=0&&succDiffPct>=0)?'#15803d':(totDiffPct<0&&succDiffPct<0)?'#b91c1c':'#92400e'
    const sumBg = (totDiffPct>=0&&succDiffPct>=0)?'#f0fdf4':(totDiffPct<0&&succDiffPct<0)?'#fef2f2':'#fffbeb'
    const sumBd = (totDiffPct>=0&&succDiffPct>=0)?'#bbf7d0':(totDiffPct<0&&succDiffPct<0)?'#fecaca':'#fde68a'
    return `
    <div style="border-top:2px dashed #cbd5e1;padding-top:9px;margin-top:9px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:15px;font-weight:900;color:#16213e">전월 대비 실적 비교</span>
        <span style="font-size:11px;color:#94a3b8">${momData.prevLabel} → ${momData.curLabel}</span>
      </div>
      <div style="display:flex;gap:14px">
        <div style="flex:1.15">
          <table style="width:100%;border-collapse:collapse;font-size:11.5px">
            <thead><tr>
              <th style="background:#16213e;color:#fff;padding:7px 10px;text-align:left;border:1px solid #2a3a5c">구분</th>
              <th style="background:#475569;color:#fff;padding:7px 6px;border:1px solid #2a3a5c">전월(${momData.prevLabel})</th>
              <th style="background:#16213e;color:#fff;padding:7px 6px;border:1px solid #2a3a5c">당월(${momData.curLabel})</th>
              <th style="background:#0891b2;color:#fff;padding:7px 6px;border:1px solid #2a3a5c">증감</th>
            </tr></thead>
            <tbody>
              ${row('활동 건수',c.act,p.act,'건',false)}
              ${row('성공 건수',c.success,p.success,'건',false)}
              ${row('성공률',c.rate,p.rate,'%',true)}
              ${row('수주 회선',c.lines,p.lines,'개',false)}
            </tbody>
          </table>
        </div>
        <div style="flex:1;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;text-align:center">활동 · 성공 · 회선 비교</div>
          <svg width="100%" height="142" viewBox="0 0 320 142">
            <line x1="20" y1="118" x2="305" y2="118" stroke="#cbd5e1" stroke-width="1.5"/>
            ${grp(35,'활동',p.act,c.act,'#94a3b8','#2563eb')}
            ${grp(130,'성공',p.success,c.success,'#86efac','#16a34a')}
            ${grp(225,'회선',p.lines,c.lines,'#fcd34d','#e67e00')}
          </svg>
          <div style="display:flex;justify-content:center;gap:14px;margin-top:4px;font-size:10px">
            <span style="color:#94a3b8;font-weight:700">■ 전월</span>
            <span style="color:#2563eb;font-weight:700">■ 당월</span>
          </div>
        </div>
      </div>
      <div style="margin-top:6px;background:${sumBg};border:1px solid ${sumBd};border-radius:8px;padding:6px 14px;font-size:11px;color:${sumCol};font-weight:600">
        전월 대비 활동 ${totDiffPct>=0?'+':''}${totDiffPct}%, 성공 ${succDiffPct>=0?'+':''}${succDiffPct}%, 수주 회선 ${lineDiffPct>=0?'+':''}${lineDiffPct}% · ${trend}
      </div>
    </div>`
  }

  // ════ S3: 활동 트렌드 (일별 + 누적 차트) ════
  const dailyAct=allDailyStats.reduce((a,d)=>a+d.act,0)
  const dailySuc=allDailyStats.reduce((a,d)=>a+d.suc,0)
  const bestDay=allDailyStats.reduce((b,d)=>d.act>(b?.act||0)?d:b,null)
  const s3t=`<div class="slide" id="s3t">
  ${rh('활동 트렌드 분석', period.replace(' (월마감)','')+' 일별·누적 추이', 3)}
  ${dbar}
  <div class="body">
    <div style="display:flex;gap:10px;margin-bottom:7px">
      <div style="flex:1;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:8px;text-align:center"><div style="font-size:24px;font-weight:900;color:#2563eb">${dailyAct}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">${isPast?'월마감':'월간'} 총 활동</div></div>
      <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:8px;text-align:center"><div style="font-size:21px;font-weight:900;color:#16a34a">${dailySuc}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">${isPast?'월마감':'월간'} 총 성공</div></div>
      <div style="flex:1;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:8px;text-align:center"><div style="font-size:21px;font-weight:900;color:#e67e00">${bestDay?bestDay.day+'일':'-'}</div><div style="font-size:11px;color:#64748b;margin-top:2px">최다 활동일 (${bestDay?.act||0}건)</div></div>
      <div style="flex:1;background:#faf5ff;border:1.5px solid #e9d5ff;border-radius:12px;padding:8px;text-align:center"><div style="font-size:21px;font-weight:900;color:#7c3aed">${allDailyStats.length?Math.round(dailyAct/allDailyStats.length*10)/10:0}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">일평균 활동</div></div>
    </div>
    <div style="display:flex;gap:14px">
      <div style="flex:1;background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <div style="background:#16213e;color:#fff;padding:7px 16px;font-size:13px;font-weight:800">일별 활동·성공 건수 (${period.replace(' (월마감)','')})</div>
        <div style="padding:8px 14px 4px">
          <div style="display:flex;gap:14px;margin-bottom:2px;font-size:11px">
            <span style="color:#2563eb;font-weight:700">■ 활동</span>
            <span style="color:#16a34a;font-weight:700">■ 성공</span>
          </div>
          ${svgLineChart(allDailyStats,{})}
        </div>
      </div>
      <div style="flex:1;background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <div style="background:#16213e;color:#fff;padding:7px 16px;font-size:13px;font-weight:800">누적 활동·성공 트렌드 (${period.replace(' (월마감)','')})</div>
        <div style="padding:8px 14px 4px">
          <div style="display:flex;gap:14px;margin-bottom:2px;font-size:11px">
            <span style="color:#2563eb;font-weight:700">■ 누적활동</span>
            <span style="color:#16a34a;font-weight:700">■ 누적성공</span>
          </div>
          ${svgCumChart(allDailyStats,{})}
        </div>
      </div>
    </div>
    <div style="margin-top:7px;font-size:10px;color:#94a3b8">※ 일자별 집계 기준: 배분건은 활동일(activity_at), 직접발굴은 결과입력일 우선 · 성공건은 개통일자 기준으로 반영</div>
    ${momSection()}
  </div>
  ${ftr(3)}
</div>`

  // ════ S4: 프로젝트 종합 표 ════
  const projRows = projects.map(p=>{
    const wD=(p.mmStats||[]).reduce((a,m)=>a+(m.weekly?.actAll||0),0)
    const wS=(p.mmStats||[]).reduce((a,m)=>a+(m.weekly?.success||0),0)
    const mD=p.monthly?.done||0, mS=p.monthly?.success||0
    const yD2=p.annual?.done||0, yS2=p.annual?.success||0
    const pg=prodGroup(p.monthly?.prodCounts||{})
    return {p,wD,wS,mD,mS,yD:yD2,yS:yS2,pg}
  })
  const sumRow=projRows.reduce((a,r)=>({
    wD:a.wD+r.wD,wS:a.wS+r.wS,mD:a.mD+r.mD,mS:a.mS+r.mS,yD:a.yD+r.yD,yS:a.yS+r.yS,
    inet:a.inet+r.pg.inet,tv:a.tv+r.pg.tv,tvbiz:a.tvbiz+r.pg.tvbiz,mob:a.mob+r.pg.mob,etc:a.etc+r.pg.etc
  }),{wD:0,wS:0,mD:0,mS:0,yD:0,yS:0,inet:0,tv:0,tvbiz:0,mob:0,etc:0})

  const s3=`<div class="slide" id="s3">
  ${rh('프로젝트별 종합 현황', (isPast?'월마감 → 누적':'주간 → 월간 → 누적')+' + 상품별 실적 (월간)', 4)}
  ${dbar}
  <div class="body">
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width:185px;text-align:left;padding-left:12px">프로젝트</th>
          <th rowspan="2">대상건수</th>
          ${isPast?'':'<th colspan="2" style="background:#1d4ed8">주간</th>'}
          <th colspan="3" style="background:#15803d">${isPast?'월마감':'월간'}</th>
          <th colspan="2" style="background:#7c3aed">누적</th>
          <th colspan="6" style="background:#b45309">상품별 실적 (월간, 회선)</th>
        </tr>
        <tr>
          ${isPast?'':'<th style="background:#2563eb">활동</th><th style="background:#2563eb">성공</th>'}
          <th style="background:#16a34a">활동</th><th style="background:#16a34a">성공</th><th style="background:#16a34a">성공률</th>
          <th style="background:#9333ea">활동</th><th style="background:#9333ea">성공</th>
          <th style="background:#d97706">인터넷</th><th style="background:#d97706">TV-M</th><th style="background:#d97706">TV-B</th><th style="background:#d97706">모바일</th><th style="background:#d97706">기타</th><th style="background:#92400e">합계</th>
        </tr>
      </thead>
      <tbody>
        ${projRows.map(({p,wD,wS,mD,mS,yD,yS,pg})=>`
        <tr>
          <td style="text-align:left;font-weight:800;color:${PC[p.id]||'#1e293b'};padding-left:12px">${p.icon} ${p.name}</td>
          <td>${(p.total||0)+(p.directTotal||0)}건</td>
          ${isPast?'':`<td class="wk-bg bc">${wD}</td><td class="wk-bg gc">${wS}</td>`}
          <td class="mo-bg bc">${mD}</td><td class="mo-bg gc">${mS}</td><td class="mo-bg">${sucRate(mS,mD)}%</td>
          <td class="yr-bg bc">${yD}</td><td class="yr-bg gc">${yS}</td>
          <td class="prod-bg">${pg.inet||'-'}</td><td class="prod-bg">${pg.tv||'-'}</td><td class="prod-bg">${pg.tvbiz||'-'}</td><td class="prod-bg">${pg.mob||'-'}</td><td class="prod-bg">${pg.etc||'-'}</td>
          <td class="prod-bg-alt" style="font-weight:900;color:#92400e">${pg.total||'-'}</td>
        </tr>`).join('')}
        <tr style="font-weight:900">
          <td style="text-align:left;background:#16213e;color:#fff;padding-left:12px">합 계</td>
          <td style="background:#16213e;color:#fff">${projRows.reduce((a,r)=>a+((r.p.total||0)+(r.p.directTotal||0)),0)}건</td>
          ${isPast?'':`<td style="background:#1d4ed8;color:#fff">${sumRow.wD}</td><td style="background:#1d4ed8;color:#86efac">${sumRow.wS}</td>`}
          <td style="background:#15803d;color:#fff">${sumRow.mD}</td><td style="background:#15803d;color:#bbf7d0">${sumRow.mS}</td><td style="background:#15803d;color:#fff">${sucRate(sumRow.mS,sumRow.mD)}%</td>
          <td style="background:#7c3aed;color:#fff">${sumRow.yD}</td><td style="background:#7c3aed;color:#e9d5ff">${sumRow.yS}</td>
          <td style="background:#b45309;color:#fff">${sumRow.inet}</td><td style="background:#b45309;color:#fff">${sumRow.tv}</td><td style="background:#b45309;color:#fff">${sumRow.tvbiz}</td><td style="background:#b45309;color:#fff">${sumRow.mob}</td><td style="background:#b45309;color:#fff">${sumRow.etc}</td>
          <td style="background:#92400e;color:#fff">${sumRow.inet+sumRow.tv+sumRow.tvbiz+sumRow.mob+sumRow.etc}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:8px;font-size:11px;color:#94a3b8">※ 상품별 실적 = <b style="color:#15803d">월간</b> 성공건의 수주 상품·회선수 · TV-M=일반TV, TV-B=舊 다량회선 · 회선수 미입력 건은 상품당 1회선</div>
    <div style="margin-top:12px;display:flex;gap:8px;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px">
      <span style="font-size:12px;font-weight:700;color:#475569">범례:</span>
      ${isPast?'':'<span style="background:#eff6ff;border:1px solid #bfdbfe;padding:3px 12px;border-radius:6px;font-size:11px;color:#1d4ed8;font-weight:700">주간</span>'}
      <span style="background:#f0fdf4;border:1px solid #bbf7d0;padding:3px 12px;border-radius:6px;font-size:11px;color:#15803d;font-weight:700">${isPast?'월마감':'월간'}</span>
      <span style="background:#faf5ff;border:1px solid #e9d5ff;padding:3px 12px;border-radius:6px;font-size:11px;color:#7c3aed;font-weight:700">누적</span>
      <span style="background:#fffbeb;border:1px solid #fde68a;padding:3px 12px;border-radius:6px;font-size:11px;color:#b45309;font-weight:700">상품 (월간)</span>
    </div>
  </div>
  ${ftr(4)}
</div>`

  // ════ S4~S8: 프로젝트별 세부 ════
  function projDetailSlide(p, sn){
    if(!p) return `<div class="slide" id="s${sn}"><div class="rh"><div class="rt">프로젝트 데이터 없음</div></div>${ftr(sn)}</div>`
    const col=PC[p.id]||'#2563eb'
    const wD=(p.mmStats||[]).reduce((a,m)=>a+(m.weekly?.actAll||0),0)
    const wS=(p.mmStats||[]).reduce((a,m)=>a+(m.weekly?.success||0),0)
    const mD=p.monthly?.done||0, mS=p.monthly?.success||0
    const yD2=p.annual?.done||0, yS2=p.annual?.success||0
    const dtot=(p.total||0)+(p.directTotal||0)
    const pg=prodGroup(p.monthly?.prodCounts||{})
    const prodE=PRODS.filter(x=>(p.monthly?.prodCounts||{})[x]).map(x=>[PRODLABEL(x),p.monthly.prodCounts[x]])
    const mm=p.mmStats||[]
    const cases=p.successCases||[]

    return `<div class="slide" id="s${sn}">
  ${rh(p.icon+' '+p.name,'프로젝트 세부 현황',sn)}
  ${dbar}
  <div class="body">
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <div style="flex:1;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:900;color:${col}">${dtot}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">${p.adminOnly?'배분 건수':'직접등록 건수'}</div></div>
      ${isPast?'':`<div style="flex:1;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:900;color:#2563eb">${wD}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">주간 활동 (성공 ${wS})</div></div>`}
      <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:900;color:#2563eb">${mD}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">${isPast?'월마감':'월간'} 활동 (활동률 ${pct(mD,Math.max(dtot,1))}%)</div></div>
      <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:900;color:#16a34a">${mS}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">${isPast?'월마감':'월간'} 성공 (성공률 ${sucRate(mS,mD)}%)</div></div>
      <div style="flex:1;background:#faf5ff;border:1.5px solid #e9d5ff;border-radius:12px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:900;color:#7c3aed">${yS2}<span style="font-size:13px">건</span></div><div style="font-size:11px;color:#64748b;margin-top:2px">누적 성공 (활동 ${yD2})</div></div>
    </div>
    <div style="display:flex;gap:14px">
      <div style="flex:1.4;overflow:hidden">
        <div style="font-size:13.5px;font-weight:800;color:#16213e;margin-bottom:6px">담당 MM별 활동 현황</div>
        <table>
          <thead><tr><th style="text-align:left;padding-left:10px">MM</th><th>팀</th><th>배분/등록</th>${isPast?'':'<th style="background:#1d4ed8">주간활동</th><th style="background:#1d4ed8">주간성공</th>'}<th style="background:#15803d">${isPast?'월마감활동':'월간활동'}</th><th style="background:#15803d">${isPast?'월마감성공':'월간성공'}</th><th>성공률</th></tr></thead>
          <tbody>
            ${mm.length===0?`<tr><td colspan="${isPast?6:8}" style="color:#94a3b8;padding:20px">활동 MM 없음</td></tr>`:mm.slice(0,9).map((m,i)=>{
              const mwk=m.weekly||{}
              const mD2=m.monthly?.done||m.monthly?.mitDone||0, mS2=m.monthly?.success||0
              const zero=mD2===0&&((m.mitAssigned||0)+(m.directTotal||0))>0
              return `<tr style="background:${zero?'#fef2f2':i%2?'#f8fafc':'#fff'}">
                <td style="text-align:left;font-weight:700;color:${zero?'#dc2626':'#1e293b'};padding-left:10px">${m.name}</td>
                <td style="font-size:11px">${m.team||'-'}</td>
                <td>${(m.mitAssigned||0)+(m.directTotal||0)}건</td>
                ${isPast?'':`<td class="wk-bg bc">${mwk.actAll||0}</td><td class="wk-bg gc">${mwk.success||0}</td>`}
                <td class="mo-bg ${zero?'rc':'bc'}">${mD2}</td><td class="mo-bg gc">${mS2}</td>
                <td>${sucRate(mS2,mD2)}%</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
        <div style="font-size:13.5px;font-weight:800;color:#16213e;margin:10px 0 6px">상품별 수주 실적 <span style="font-size:11px;color:#15803d;font-weight:700">(월간)</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px 15px;text-align:center;min-width:78px"><div style="font-size:19px;font-weight:900;color:#2563eb">${pg.inet}</div><div style="font-size:10.5px;color:#64748b">인터넷</div></div>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:9px 15px;text-align:center;min-width:78px"><div style="font-size:19px;font-weight:900;color:#d97706">${pg.tv}</div><div style="font-size:10.5px;color:#64748b">TV-M</div></div>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 15px;text-align:center;min-width:78px"><div style="font-size:19px;font-weight:900;color:#ea580c">${pg.tvbiz}</div><div style="font-size:10.5px;color:#64748b">TV-B</div></div>
          <div style="background:#ede9fe;border:1px solid #ddd6fe;border-radius:10px;padding:9px 15px;text-align:center;min-width:78px"><div style="font-size:19px;font-weight:900;color:#7c3aed">${pg.mob}</div><div style="font-size:10.5px;color:#64748b">모바일</div></div>
          <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:9px 15px;text-align:center;min-width:78px"><div style="font-size:19px;font-weight:900;color:#475569">${pg.etc}</div><div style="font-size:10.5px;color:#64748b">기타</div></div>
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:9px 15px;text-align:center;min-width:78px"><div style="font-size:19px;font-weight:900;color:#15803d">${pg.total}</div><div style="font-size:10.5px;color:#15803d;font-weight:700">합계 회선</div></div>
        </div>
        ${prodE.length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${prodE.map(([k,v])=>`<span style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:2px 10px;font-size:11px;color:#475569">${k} ${v}</span>`).join('')}</div>`:''}
      </div>
      <div style="flex:1;overflow:hidden">
        <div style="font-size:13.5px;font-weight:800;color:#16213e;margin-bottom:6px">이번 달 성공 건 세부 내역</div>
        ${cases.length===0?'<div style="color:#94a3b8;font-size:13px;padding:20px;text-align:center;background:#f8fafc;border-radius:10px">이번 달 성공 건이 없습니다</div>':`
        <table>
          <thead><tr><th>일자</th><th>MM</th><th style="text-align:left">고객/주소</th><th>상품·회선</th></tr></thead>
          <tbody>
            ${cases.slice(0,11).map((c,i)=>`<tr style="background:${i%2?'#f8fafc':'#fff'}">
              <td style="font-size:11px">${c.date}</td>
              <td style="font-size:11px;font-weight:700">${c.mm}</td>
              <td style="text-align:left;font-size:11px;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.address}</td>
              <td style="font-size:10px">${(c.products||'').replace(/다량회선/g,'TV Biz')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${cases.length>11?`<div style="font-size:11px;color:#94a3b8;text-align:center;margin-top:4px">외 ${cases.length-11}건</div>`:''}`}
      </div>
    </div>
  </div>
  ${ftr(sn)}
</div>`
  }

  const s4=projDetailSlide(projects[0],5)
  const s5=projDetailSlide(projects[1],6)
  const s6=projDetailSlide(projects[2],7)
  const s7=projDetailSlide(projects[3],8)
  const s8=projDetailSlide(projects[4],9)

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>상권통 보고서 ${today}</title><style>${css}</style></head><body>
<button class="print-btn" onclick="if(!window._pdfTipShown){window._pdfTipShown=true;alert('▣ PDF 저장 시 색상이 유지되려면:\n\n인쇄 창에서 \'설정 더보기\' 또는 \'옵션\'을 펼친 뒤\n【배경 그래픽】 항목을 반드시 체크하세요.\n\n(체크하지 않으면 표 색상이 흰색으로 나옵니다)');}window.print()">🖨 PDF 저장 / 인쇄</button>
<div class="print-hint" style="position:fixed;top:62px;right:16px;z-index:999;background:#fffbeb;border:1.5px solid #fde68a;color:#92400e;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:600;max-width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.15);line-height:1.5">💡 인쇄 시 <b>[배경 그래픽]</b> 체크해야<br>색상이 유지됩니다</div>
${s1}${s2}${s3t}${s3}${s4}${s5}${s6}${s7}${s8}
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
  const droppedSet = new Set(droppedThemes)
  const filtered = leads
    .filter(l => !droppedSet.has(l.project_name))  // 드랍된 테마 제외
    .filter(l => filterSt === '전체' || l.assign_status === filterSt)
    .filter(l => filterProject === '전체' || (l.project_name || '기본') === filterProject)
  const mFiltered = mFilterSt === '전체' ? mDiscovery : mDiscovery.filter(m => m.status === mFilterSt)

  const navTabs = [
    { id: 'dashboard', label: '활동현황', icon: '📊' },

    { id: 'activity',  label: '활동결과', icon: '📋' },
    { id: 'staff',     label: '직원관리', icon: '🧑‍💼' },
    { id: 'upload',    label: '업로드',   icon: '📤' },
    { id: 'leads',     label: '프로젝트', icon: '🎯' },
    { id: 'mdiscovery',label: 'M플러스',   icon: '🔍' },
    { id: 'qrpartners',label: 'QR파트너스', icon: '📱' },
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
                    const ptDirect = directLeads.filter(l => myUnames.includes(l.mm_username) && l.project_type===pt.id).filter(l=>inP(l.activity_at))
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
              // 프로젝트별 필터 (1=기업체, 2=세움터, 3=빌딩/상가, 4=직접판매, 5=M플러스)
              if (actView === '프로젝트별' && actProj !== '전체') {
                const pid = Number(actProj)
                if (pid === 5) {
                  // M플러스은 m_discovery 기반 → baseLeads/baseDirect 비움, M플러스 별도 처리
                  baseLeads = []; baseDirect = []
                } else {
                  // 프로젝트별: 배분 리드 + 직접발굴 리드 모두 project_type 기준 (재분류 반영)
                  baseLeads = baseLeads.filter(l=>(l.project_type===pid)||(pid===1&&!l.project_type))
                  baseDirect = baseDirect.filter(l=>l.project_type===pid)
                }
              }

              const allBase = [
                ...baseLeads.map(l=>({...l,_type:'배분',_name:l.address||l.col2||'-'})),
                ...baseDirect.map(l=>({...l,_type:'직접발굴',_name:l.customer||'-'}))
              ].sort((a,b)=>new Date(b.activity_at||0)-new Date(a.activity_at||0))
              const stCounts = {'전체': allBase.length, ...Object.fromEntries(ST.map(s=>[s, allBase.filter(l=>(l.activity_status||'미처리')===s).length]))}
              const allProjs = [...new Set(leads.filter(l=>myUN.includes(l.assigned_to)).map(l=>l.project_name).filter(Boolean))]
              const allThemes = actProj!=='전체' ? [...new Set(leads.filter(l=>l.project_name===actProj).map(l=>l.theme_name).filter(Boolean))] : [...new Set(leads.filter(l=>myUN.includes(l.assigned_to)).map(l=>l.theme_name).filter(Boolean))]
              const _actQ = actSearch.trim().toLowerCase()
              const _matchActSearch = l => { if(!_actQ) return true; const f=[l.address,l.col2,l.customer,l.col1,l._name,l.activity_contact,l.contact,l.col3].filter(Boolean).join(' ').toLowerCase(); return f.includes(_actQ) }
              const filtered = (filterSt === '전체' ? allBase : allBase.filter(l => (l.activity_status||'미처리') === filterSt)).filter(_matchActSearch)

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
                  {actView === '프로젝트별' && (
                    <div style={{ display:'flex', gap:'5px', marginBottom:'6px', overflowX:'auto', paddingBottom:'4px' }}>
                      {[{id:'전체',label:'전체',icon:'📋'},{id:'1',label:'기업체',icon:'🏭'},{id:'2',label:'세움터',icon:'🏗️'},{id:'3',label:'빌딩/상가',icon:'🏢'},{id:'4',label:'직접판매',icon:'🤝'},{id:'5',label:'M플러스',icon:'🔍'}].map(p => (
                        <button key={p.id} onClick={()=>setActProj(p.id)}
                          style={{ padding:'5px 11px', background:actProj===p.id?'#1e293b':'#fff', border:'1.5px solid '+(actProj===p.id?'#1e293b':'#e2e8f0'), color:actProj===p.id?'#fff':C.sub, borderRadius:'20px', fontSize:'12px', fontWeight:actProj===p.id?'700':'500', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>{p.icon} {p.label}</button>
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
                  {/* 영업기회 검색 */}
                  <div style={{position:'relative',marginBottom:'10px'}}>
                    <input type="text" value={actSearch} onChange={e=>setActSearch(e.target.value)} placeholder="🔍 주소 · 고객명 · 연락처로 검색 (카드 보기에서 결과 확인)" style={{width:'100%',padding:'11px 38px 11px 14px',border:'1.5px solid #e2e8f0',borderRadius:'10px',fontSize:'13px',fontFamily:'inherit',boxSizing:'border-box'}}/>
                    {actSearch&&<button onClick={()=>setActSearch('')} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'#e2e8f0',border:'none',borderRadius:'50%',width:'22px',height:'22px',fontSize:'12px',cursor:'pointer',color:'#64748b'}}>✕</button>}
                  </div>
                  {actSearch&&<div style={{marginBottom:'8px',fontSize:'12px',color:C.acc,fontWeight:'700'}}>🔍 '{actSearch}' 검색결과 {filtered.length}건{actResultView==='도표'?' · 카드 보기로 전환하면 목록이 보입니다':''}</div>}
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
                     const prodSummary=ProdSummaryText(allCombined)
                    const totProspect=allCombined.filter(l=>l.activity_status==='접촉완료').length
                    const totFail=allCombined.filter(l=>l.activity_status==='실패').length
                    // M플러스은 mDiscovery에서 집계
                    const totStar=isSuper?mDiscovery.length:mDiscovery.filter(m=>m.team_id===adminInfo?.teamId).length
                    return(<>
                      {/* 프로세스 요약 */}
                      <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'14px',overflowX:'auto',paddingBottom:'4px'}}>
                        {[{icon:'🎯',label:'타겟선정',val:totTarget,col:'#e67e00'},{icon:'📞',label:'고객접촉',val:totContact,col:C.blue},{icon:'🏆',label:'성공',val:totSuccess,col:C.green,sub:prodSummary},{icon:'💫',label:'가망',val:totProspect,col:'#7c3aed'},{icon:'⭐',label:'단골등록',val:totStar,col:'#f59e0b'}].map((s,i,arr)=>(
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
                               const prodSumRow=ProdSummaryText(rows)
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
                                <td style={{padding:'8px 10px',textAlign:'center',color:C.green,fontWeight:'900',fontSize:'14px'}}>{success}{prodSumRow&&<div style={{fontSize:'10px',color:'#15803d',fontWeight:'700',marginTop:'2px',whiteSpace:'nowrap'}}>{prodSumRow}</div>}</td>
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
                      <button onClick={() => handleDelete(u.id, u.name)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: C.red, padding: '6px 11px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
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
                    <div key={p} style={{display:'inline-flex',alignItems:'center',gap:'2px',position:'relative'}}>
                      <button onClick={() => setFilterProject(p)}
                        style={{ padding: '5px 12px', background: droppedThemes.includes(p) ? '#fee2e2' : filterProject === p ? '#1e293b' : '#fff', border: '1px solid ' + (droppedThemes.includes(p) ? '#fca5a5' : filterProject === p ? '#1e293b' : '#e2e8f0'), color: droppedThemes.includes(p) ? '#dc2626' : filterProject === p ? '#fff' : C.sub, borderRadius: '20px', fontSize: '12px', fontWeight: filterProject === p ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', textDecoration: droppedThemes.includes(p) ? 'line-through' : 'none' }}>{p}{droppedThemes.includes(p) ? ' 🚫' : ''}</button>
                      {p !== '전체' && (
                        <button title={droppedThemes.includes(p)?'드랍 해제':'드랍'} onClick={async()=>{
                          const next = droppedThemes.includes(p) ? droppedThemes.filter(x=>x!==p) : [...droppedThemes, p]
                          setDroppedThemes(next)
                          await db.patch('app_settings','dropped_themes',{value:JSON.stringify(next)}).catch(()=>
                            db.post('app_settings',{id:'dropped_themes',value:JSON.stringify(next)})
                          )
                        }} style={{background:'none',border:'none',cursor:'pointer',fontSize:'11px',padding:'2px 4px',color: droppedThemes.includes(p)?'#16a34a':'#94a3b8'}} title={droppedThemes.includes(p)?'드랍 해제':'이 테마 드랍'}>
                          {droppedThemes.includes(p)?'↩':'✕'}
                        </button>
                      )}
                    </div>
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

        {/* ── M플러스 ────────────────────────────────────────────────── */}
        {tab === 'mdiscovery' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
              <h2 style={{ fontSize: '19px', fontWeight: '900', color: C.text }}>🔍 M플러스 관리</h2>
            </div>
            <p style={{ color: C.sub, fontSize: '13px', marginBottom: '12px' }}>MM이 등록한 모바일 벌크영업 사이트 진행 현황</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px',marginBottom:'14px'}}>
              {[['접촉중','#0891b2','#e0f2fe'],['발굴성공','#7c3aed','#ede9fe'],['영업중','#d97706','#fef3c7'],['영업종료','#16a34a','#dcfce7'],['발굴실패','#dc2626','#fee2e2']].map(([s,c,bg])=>(
                <div key={s} onClick={()=>setMDiscStage(mDiscStage===s?'전체':s)} style={{background:mDiscStage===s?c:bg,borderRadius:'12px',padding:'14px 8px',textAlign:'center',cursor:'pointer'}}>
                  <div style={{fontSize:'18px',fontWeight:'900',color:mDiscStage===s?'#fff':c}}>{mDiscovery.filter(m=>(m.stage||'접촉중')===s).length}</div>
                  <div style={{fontSize:'11px',fontWeight:'700',color:mDiscStage===s?'#fff':c}}>{s}</div>
                </div>
              ))}
            </div>
            {(()=>{
              let wire=0,mob=0,sites=0
              mDiscovery.forEach(m=>{try{const recs=JSON.parse(m.daily_records||'[]');if(recs.length)sites++;recs.forEach(r=>{wire+=Number(r.net||0)+Number(r.tv||0)+Number(r.renew||0);mob+=Number(r.wireChange||0)+Number(r.mnp||0)+Number(r.second||0)})}catch{}})
              return(wire>0||mob>0)?(
                <div style={{display:'flex',gap:'10px',marginBottom:'14px'}}>
                  <div style={{flex:1,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:'#2563eb'}}>{wire}</div><div style={{fontSize:'11px',color:C.sub}}>유선 실적 (인터넷/TV/약정갱신)</div></div>
                  <div style={{flex:1,background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:'#7c3aed'}}>{mob}</div><div style={{fontSize:'11px',color:C.sub}}>무선 실적 (기변/MNP/2nd)</div></div>
                  <div style={{flex:1,background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:'#e67e00'}}>{sites}</div><div style={{fontSize:'11px',color:C.sub}}>영업 진행 현장</div></div>
                </div>
              ):null
            })()}
            <div style={{display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px'}}>
              {['전체','접촉중','발굴성공','영업중','영업종료','발굴실패'].map(s=>(
                <button key={s} onClick={()=>setMDiscStage(s)} style={{flex:'none',padding:'6px 14px',background:mDiscStage===s?'#1e293b':'#fff',border:'1px solid '+(mDiscStage===s?'#1e293b':'#e2e8f0'),borderRadius:'20px',fontSize:'12px',fontWeight:mDiscStage===s?'700':'400',color:mDiscStage===s?'#fff':'#64748b',cursor:'pointer',fontFamily:'inherit'}}>{s}</button>
              ))}
            </div>
            {(mDiscovery.filter(m=>mDiscStage==='전체'||(m.stage||'접촉중')===mDiscStage)).length===0
              ?<div style={{textAlign:'center',padding:'40px',color:C.sub}}>등록된 M플러스 현장이 없습니다</div>
              :mDiscovery.filter(m=>mDiscStage==='전체'||(m.stage||'접촉중')===mDiscStage).map(m=>{
                const stg=m.stage||'접촉중'
                const sc={'접촉중':['#e0f2fe','#0369a1'],'발굴성공':['#ede9fe','#6d28d9'],'영업중':['#fef3c7','#92400e'],'영업종료':['#dcfce7','#15803d'],'발굴실패':['#fee2e2','#b91c1c']}[stg]
                let recs=[];try{recs=JSON.parse(m.daily_records||'[]')}catch{}
                const wireT=recs.reduce((a,r)=>a+Number(r.net||0)+Number(r.tv||0)+Number(r.renew||0),0)
                const mobT=recs.reduce((a,r)=>a+Number(r.wireChange||0)+Number(r.mnp||0)+Number(r.second||0),0)
                return(
                  <div key={m.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'14px',marginBottom:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                      <span style={{fontWeight:'800',fontSize:'15px',color:C.text}}>{m.customer_name||m.site_name}</span>
                      <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'10px',fontWeight:'700',background:sc[0],color:sc[1]}}>{stg}</span>
                    </div>
                    <div style={{fontSize:'12px',color:C.sub,marginBottom:'3px'}}>👤 {m.registered_by}{m.industry?' · '+m.industry:''}{m.emp_count?' · 임직원 '+m.emp_count:''}</div>
                    <div style={{fontSize:'12px',color:C.sub,marginBottom:'3px'}}>📍 {m.address||'-'}{m.contact?' · 📞 '+m.contact:''}</div>
                    {m.agency_name&&<div style={{fontSize:'12px',color:'#7c3aed',marginBottom:'3px'}}>🤝 연계 대리점: {m.agency_name}{m.agency_manager?' ('+m.agency_manager+')':''}{m.sales_schedule?' · 일정 '+m.sales_schedule:''}</div>}
                    {(wireT>0||mobT>0)&&<div style={{display:'flex',gap:'8px',marginTop:'6px'}}>
                      <span style={{fontSize:'11px',background:'#eff6ff',color:'#2563eb',padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>유선 {wireT}건</span>
                      <span style={{fontSize:'11px',background:'#faf5ff',color:'#7c3aed',padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>무선 {mobT}건</span>
                      <span style={{fontSize:'11px',color:'#94a3b8'}}>· {recs.length}일 실적</span>
                    </div>}
                    {stg==='영업종료'&&m.site_review&&<div style={{fontSize:'12px',color:'#374151',padding:'8px 10px',background:'#f0fdf4',borderRadius:'8px',marginTop:'6px'}}>📝 {m.site_review}</div>}
                    {m.result&&<div style={{fontSize:'12px',color:'#374151',marginTop:'4px',padding:'6px 10px',background:'#f8fafc',borderRadius:'6px'}}>결과: {m.result}</div>}
                  </div>
                )
              })
            }
          </div>
        )}
        {tab === 'qrpartners' && (
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '900', color: C.text, marginBottom:'4px' }}>📱 QR 파트너스 관리</h2>
            <p style={{ color: C.sub, fontSize: '13px', marginBottom: '14px' }}>무인매장 QR 제휴 영업 직원 및 성과 현황</p>
            {/* 전체 요약 */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
              <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:'12px',padding:'14px 8px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:'#e67e00'}}>{qrPartners.length}</div><div style={{fontSize:'11px',color:C.sub}}>활동 직원</div></div>
              <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'12px',padding:'14px 8px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:'#2563eb'}}>{qrStores.length}</div><div style={{fontSize:'11px',color:C.sub}}>등록 매장</div></div>
              <div style={{background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:'12px',padding:'14px 8px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:'#7c3aed'}}>{qrLeads.length}</div><div style={{fontSize:'11px',color:C.sub}}>상담 요청</div></div>
              <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'12px',padding:'14px 8px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:'#16a34a'}}>{qrLeads.filter(l=>l.status==='가입성공').length}</div><div style={{fontSize:'11px',color:C.sub}}>가입 성공</div></div>
            </div>
            {/* 직원 계정 등록 버튼 */}
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'10px'}}>
              <button onClick={()=>{setQrForm({username:'',password:'2026',name:'',team_id:adminAccounts[0]?.team_id||'team1'});setShowQrForm(true)}} style={{background:C.acc,color:'#fff',border:'none',borderRadius:'10px',padding:'8px 14px',fontSize:'13px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>+ 직원 계정 등록</button>
            </div>
            {/* 뷰 전환 */}
            <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
              {[['overview','직원별 성과'],['accounts','직원 계정'],['stores','매장 목록'],['leads','상담 내역']].map(([v,label])=>(
                <button key={v} onClick={()=>setQrView(v)} style={{flex:1,padding:'8px',background:qrView===v?'#1e293b':'#fff',border:'1.5px solid '+(qrView===v?'#1e293b':'#e2e8f0'),color:qrView===v?'#fff':C.sub,borderRadius:'10px',fontSize:'13px',fontWeight:qrView===v?'700':'500',cursor:'pointer',fontFamily:'inherit'}}>{label}</button>
              ))}
            </div>
            {/* 직원별 성과 */}
            {qrView==='overview'&&(
              qrPartners.length===0
              ?<div style={{textAlign:'center',padding:'40px',color:C.sub}}>등록된 QR 파트너스 직원이 없습니다</div>
              :qrPartners.map(p=>{
                const pStores=qrStores.filter(s=>s.partner_username===p.username)
                const pLeads=qrLeads.filter(l=>l.partner_username===p.username)
                const pScans=pStores.reduce((a,s)=>a+(s.scan_count||0),0)
                const pSuccess=pLeads.filter(l=>l.status==='가입성공').length
                return(
                  <div key={p.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'14px',marginBottom:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                      <span style={{fontSize:'15px',fontWeight:'800'}}>👤 {p.name}</span>
                      <span style={{fontSize:'11px',color:C.sub}}>{p.username}</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px'}}>
                      <div style={{textAlign:'center',background:'#fff7ed',borderRadius:'8px',padding:'8px 4px'}}><div style={{fontSize:'16px',fontWeight:'900',color:'#e67e00'}}>{pStores.length}</div><div style={{fontSize:'10px',color:C.sub}}>매장</div></div>
                      <div style={{textAlign:'center',background:'#eff6ff',borderRadius:'8px',padding:'8px 4px'}}><div style={{fontSize:'16px',fontWeight:'900',color:'#2563eb'}}>{pScans}</div><div style={{fontSize:'10px',color:C.sub}}>스캔</div></div>
                      <div style={{textAlign:'center',background:'#faf5ff',borderRadius:'8px',padding:'8px 4px'}}><div style={{fontSize:'16px',fontWeight:'900',color:'#7c3aed'}}>{pLeads.length}</div><div style={{fontSize:'10px',color:C.sub}}>상담</div></div>
                      <div style={{textAlign:'center',background:'#f0fdf4',borderRadius:'8px',padding:'8px 4px'}}><div style={{fontSize:'16px',fontWeight:'900',color:'#16a34a'}}>{pSuccess}</div><div style={{fontSize:'10px',color:C.sub}}>성공</div></div>
                    </div>
                  </div>
                )
              })
            )}
            {/* 직원 계정 관리 */}
            {qrView==='accounts'&&(
              <div>
                <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'10px',padding:'10px 12px',marginBottom:'12px',fontSize:'12px',color:'#1d4ed8',lineHeight:1.6}}>💡 상권마스터(MM) 계정은 자동으로 QR 파트너스 로그인이 가능합니다. 아래는 QR 파트너스 전용으로 추가 등록된 직원입니다.</div>
                {qrPartners.length===0
                  ?<div style={{textAlign:'center',padding:'40px',color:C.sub}}>등록된 직원이 없습니다</div>
                  :qrPartners.map(p=>(
                    <div key={p.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'13px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:'14px',fontWeight:'800'}}>👤 {p.name}</div>
                        <div style={{fontSize:'12px',color:C.sub,marginTop:'2px'}}>아이디: <b>{p.username}</b> · 비번: {p.password} · {adminAccounts.find(a=>a.team_id===p.team_id)?.team_label||p.team_id||'-'}</div>
                      </div>
                      <button onClick={async()=>{
                        if(!confirm('【'+p.name+'】 QR 파트너스 직원 계정을 정말로 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.'))return
                        await db.del('qr_partners','id=eq.'+p.id).catch(e=>alert('삭제 실패: '+e.message))
                        setQrPartners(prev=>prev.filter(x=>x.id!==p.id))
                      }} style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',borderRadius:'8px',padding:'6px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>삭제</button>
                    </div>
                  ))
                }
              </div>
            )}
            {/* 매장 목록 */}
            {qrView==='stores'&&(
              qrStores.length===0
              ?<div style={{textAlign:'center',padding:'40px',color:C.sub}}>등록된 매장이 없습니다</div>
              :qrStores.map(s=>{
                const sLeads=qrLeads.filter(l=>l.store_code===s.store_code)
                return(
                  <div key={s.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'12px',marginBottom:'8px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                      <span style={{fontWeight:'800',fontSize:'14px'}}>{s.store_name}</span>
                      <span style={{fontSize:'11px',background:'#fff7ed',color:'#b45309',padding:'2px 8px',borderRadius:'8px',fontWeight:'700'}}>{s.industry}</span>
                    </div>
                    <div style={{fontSize:'12px',color:C.sub}}>👤 {s.partner_name} · 📍 {s.address||'-'}</div>
                    <div style={{display:'flex',gap:'8px',marginTop:'6px'}}>
                      <span style={{fontSize:'11px',background:'#eff6ff',color:'#2563eb',padding:'2px 8px',borderRadius:'6px',fontWeight:'700'}}>스캔 {s.scan_count||0}</span>
                      <span style={{fontSize:'11px',background:'#faf5ff',color:'#7c3aed',padding:'2px 8px',borderRadius:'6px',fontWeight:'700'}}>상담 {sLeads.length}</span>
                      <span style={{fontSize:'11px',background:'#f0fdf4',color:'#16a34a',padding:'2px 8px',borderRadius:'6px',fontWeight:'700'}}>성공 {sLeads.filter(l=>l.status==='가입성공').length}</span>
                    </div>
                  </div>
                )
              })
            )}
            {/* 상담 내역 */}
            {qrView==='leads'&&(
              qrLeads.length===0
              ?<div style={{textAlign:'center',padding:'40px',color:C.sub}}>상담 요청이 없습니다</div>
              :qrLeads.map(l=>{
                const sc={'상담요청':['#fef3c7','#92400e'],'연결완료':['#eff6ff','#1d4ed8'],'가입성공':['#dcfce7','#15803d'],'실패':['#fee2e2','#dc2626']}[l.status]||['#f1f5f9','#64748b']
                return(
                  <div key={l.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'11px',marginBottom:'7px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                      <span style={{fontWeight:'700',fontSize:'13px'}}>{l.customer_name} · {l.customer_contact}</span>
                      <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'8px',background:sc[0],color:sc[1],fontWeight:'700'}}>{l.status}</span>
                    </div>
                    <div style={{fontSize:'11px',color:C.sub}}>🏪 {l.store_name} · 👤 {qrPartners.find(p=>p.username===l.partner_username)?.name||l.partner_username} · {l.interest_product}</div>
                    <div style={{fontSize:'10px',color:'#94a3b8',marginTop:'2px'}}>{new Date(l.created_at).toLocaleString('ko-KR')}</div>
                  </div>
                )
              })
            )}
          {/* QR 직원 계정 등록 폼 */}
          {showQrForm&&(
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,display:'flex',alignItems:'flex-end'}}>
              <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px',width:'100%',maxWidth:'440px',margin:'0 auto'}}>
                <div style={{fontWeight:'900',fontSize:'17px',marginBottom:'16px'}}>📱 QR 파트너스 직원 등록</div>
                {[['username','아이디','예: qr1',true],['password','비밀번호','예: 2026',true],['name','이름','예: 홍길동',true]].map(([k,label,ph,req])=>(
                  <div key={k} style={{marginBottom:'10px'}}>
                    <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>{label}{req&&<span style={{color:'#dc2626'}}> *</span>}</div>
                    <input value={qrForm[k]||''} onChange={e=>setQrForm(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                      style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'9px 11px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit'}}/>
                  </div>
                ))}
                <div style={{marginBottom:'10px'}}>
                  <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>소속 팀</div>
                  <select value={qrForm.team_id} onChange={e=>setQrForm(p=>({...p,team_id:e.target.value}))}
                    style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'9px 11px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit',background:'#fff'}}>
                    {adminAccounts.length===0?<option value="team1">팀1</option>:adminAccounts.map(a=><option key={a.team_id} value={a.team_id}>{a.team_label||a.name}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',gap:'8px',marginTop:'14px'}}>
                  <button onClick={()=>setShowQrForm(false)} style={{flex:1,padding:'12px',background:'#f1f5f9',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>취소</button>
                  <button onClick={async()=>{
                    if(!qrForm.username||!qrForm.password||!qrForm.name){alert('아이디·비밀번호·이름을 입력하세요');return}
                    const dup=qrPartners.find(p=>(p.username||'').toLowerCase()===qrForm.username.trim().toLowerCase())
                    if(dup){alert('이미 존재하는 아이디입니다');return}
                    const code='QRP-'+qrForm.username.trim()+'-'+String(Date.now()).slice(-4)
                    const newP={username:qrForm.username.trim(),password:qrForm.password.trim(),name:qrForm.name.trim(),team_id:qrForm.team_id,qr_code:code}
                    const res=await db.post('qr_partners',newP).catch(e=>{alert('등록 실패: '+e.message);return null})
                    if(res){setQrPartners(prev=>[{...newP,id:(Array.isArray(res)?res[0]?.id:res?.id)||Date.now()},...prev]);setShowQrForm(false);setQrView('accounts')}
                  }} style={{flex:2,padding:'12px',background:C.acc,color:'#fff',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>등록</button>
                </div>
              </div>
            </div>
          )}

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
                {/* 보고서 대상 월 선택 */}
                <div style={{marginBottom:'12px'}}>
                  <div style={{fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>📅 보고서 대상 월</div>
                  <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                    {Array.from({length:new Date().getMonth()+1},(_,i)=>i+1).map(m=>(
                      <button key={m} onClick={()=>setSlideMonth(m)}
                        style={{padding:'6px 13px',background:slideMonth===m?'#1e293b':'#fff',border:'1.5px solid '+(slideMonth===m?'#1e293b':'#e2e8f0'),color:slideMonth===m?'#fff':C.sub,borderRadius:'8px',fontSize:'13px',fontWeight:slideMonth===m?'800':'500',cursor:'pointer',fontFamily:'inherit'}}>
                        {m}월{m===new Date().getMonth()+1?' (현재)':''}
                      </button>
                    ))}
                  </div>
                  <div style={{fontSize:'11px',color:C.sub,marginTop:'5px'}}>
                    {slideMonth===new Date().getMonth()+1?'현재 월: 주간/월간/누적 데이터 표시':'지난 월: 월마감/누적 데이터 표시 (주간 제외)'}
                  </div>
                </div>
                <button onClick={() => {
                  try {
                  // 팀 데이터 구성 (총괄: 전체팀, 일반: 본인팀)
                  // ── 실시간 데이터 구성 ──────────────────────────────
                  // 드랍된 테마 제외
                  const _droppedSet = new Set(droppedThemes)
                  const slideAccs = isSuper
                    ? adminAccounts.filter(a => a.team_label && (slideTeamIds.length === 0 || slideTeamIds.includes(a.team_id)))
                    : adminAccounts.filter(a => a.team_id === adminInfo?.teamId)

                  // 상품별 집계 헬퍼
                  function calcProdCounts(successLeads) {
                    const pc = {}
                    successLeads.forEach(l => {
                      // won_products(상품별 회선수) 우선, 없으면 products(상품명)
                      let used = false
                      try {
                        const wp = JSON.parse(l.won_products||'null')
                        if (wp && !Array.isArray(wp)) { Object.entries(wp).forEach(([p,v])=>{pc[p]=(pc[p]||0)+Number(v)}); used = true }
                        else if (Array.isArray(wp) && wp.length) { wp.forEach(p=>{pc[p]=(pc[p]||0)+1}); used = true }
                      } catch {}
                      if (!used) {
                        const pr = Array.isArray(l.products) ? l.products
                          : (()=>{try{return JSON.parse(l.products||'[]')}catch{return[]}})()
                        pr.forEach(p => { pc[p] = (pc[p]||0)+1 })
                      }
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
                  // 선택된 월 기준 (slideMonth: 1~12)
                  const _selM = (slideMonth||(_m2+1)) - 1
                  const _isPastMonth = _selM < _m2
                  const _moStart = new Date(_y2,_selM,1).getTime()
                  const _moEnd   = new Date(_y2,_selM+1,1).getTime()-1
                  const _yrStart = new Date(_y2,0,1).getTime()
                  const _yrEnd   = new Date(_y2+1,0,1).getTime()-1
                  function _ms(dt){if(!dt)return -1;try{const t=new Date(dt).getTime();return isNaN(t)?-1:t}catch{return -1}}
                  const _inWk = dt=>{const t=_ms(dt);return t>=_wkMon&&t<=_wkSun}
                  const _inMo = dt=>{const t=_ms(dt);return t>=_moStart&&t<=_moEnd}
                  const _inYr = dt=>{const t=_ms(dt);return t>=_yrStart&&t<=_yrEnd}
                  // ── 기간 필터 헬퍼 (projData 앞에서 정의해야 사용 가능) ──
                  function isThisMonth(dt) { if(!dt)return false;try{const d=new Date(dt);return d.getFullYear()===curYear&&d.getMonth()+1===(slideMonth||curMonth)}catch{return false} }
                  function isThisYear(dt)  { if(!dt)return false;try{const d=new Date(dt);return d.getFullYear()===curYear}catch{return false} }
                  function isThisWeek(dt)  { if(!dt)return false;try{const d=new Date(dt);const now=new Date();const mon=new Date(now);mon.setHours(0,0,0,0);mon.setDate(now.getDate()-((now.getDay()+6)%7));const sun=new Date(mon);sun.setDate(mon.getDate()+6);sun.setHours(23,59,59,999);return d>=mon&&d<=sun}catch{return false} }

                  // 4대 프로젝트별 데이터 (주간/월간/연간 + mmStats + 테마주간 + 일별)
                  const todayDayNum = new Date().getDate()
                  const projData = [1,2,3,4].map(ptId => {
                    // project_type null인 기존 리드는 project 1로 처리 (업로드 당시 미설정)
                    const pl = leads.filter(l=>_droppedSet.size===0||!_droppedSet.has(l.project_name)).filter(l=>{
                      if(!myUsers.map(u=>u.name).includes(l.assigned_to)) return false
                      if(l.project_type===ptId) return true
                      // project_type 미설정(null) 리드는 project 1(배분)으로 포함
                      if(ptId===1 && (l.project_type===null||l.project_type===undefined)) return true
                      return false
                    })
                    const dl = directLeads.filter(l=>myUnames.includes(l.mm_username) && l.project_type===ptId)
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
                  const periodStr = curYear+'년 '+(slideMonth||curMonth)+'월'+(_isPastMonth?' (월마감)':'')
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
                  const todayDayNumAll = _isPastMonth ? new Date(_y2,_selM+1,0).getDate() : new Date().getDate()
                  const allDailyStats = Array.from({length:todayDayNumAll},(_,i)=>{const d=i+1;return allDailyMap[d]||{day:d,act:0,suc:0}})

                  // 영업일수 기반 목표 계산
                  const curBizDays = workDays[slideMonth||curMonth] || 0
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
                    const tl = leads.filter(l=>tm.map(u=>u.name).includes(l.assigned_to)&&(!_droppedSet.has(l.project_name)))
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
                  const projDataFull = [1,2,3,4,5].map(ptId=>{
                    const pl = leads.filter(l=>l.project_type===ptId&&myUsers.map(u=>u.name).includes(l.assigned_to))
                    const dl = directLeads.filter(l=>myUnames.includes(l.mm_username)&&l.project_type===ptId)
                    const pt = PT.find(p=>p.id===ptId)
                    function projStats(filterFn) {
                      const fl=pl.filter(l=>filterFn(l.activity_at))
                      const fd=dl.filter(l=>filterFn(l.activity_at||l.created_at))
                      const succ=[...fl,...fd].filter(l=>l.activity_status==='성공')
                      // 배분활동(미처리 제외) + 직접발굴 전체
                      return { done: fl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length + fd.length, success: succ.length, prodCounts: calcProdCounts(succ) }
                    }
                    // 담당 MM별 상세 (프로젝트 기준)
                    const mmStats = myUsers.map(u=>{
                      const uLeads = pl.filter(l=>l.assigned_to===u.name)
                      const uDirect = dl.filter(l=>l.mm_username===u.username)
                      const acc2 = slideAccs.find(a=>a.team_id===u.team_id)
                      if(uLeads.length===0&&uDirect.length===0) return null
                      const _mMit = uLeads.filter(l=>_inMo(l.activity_at)&&l.activity_status&&l.activity_status!=='미처리').length
                      const _mDir = uDirect.filter(l=>_inMo(l.activity_at||l.created_at)).length
                      const mMonthly = { mitDone: _mMit, done: _mMit + _mDir, success: uLeads.filter(l=>_inMo(l.activity_at)&&l.activity_status==='성공').length + uDirect.filter(l=>_inMo(l.activity_at)&&l.activity_status==='성공').length }
                      // 프로젝트별 주간 (해당 프로젝트 리드만)
                      const _wMit = uLeads.filter(l=>_inWk(l.activity_at)&&l.activity_status&&l.activity_status!=='미처리').length
                      const _wDir = uDirect.filter(l=>_inWk(l.activity_at||l.created_at)).length
                      const mWeekly = { done: _wMit + _wDir, actAll: _wMit + _wDir, success: uLeads.filter(l=>_inWk(l.activity_at)&&l.activity_status==='성공').length + uDirect.filter(l=>_inWk(l.activity_at)&&l.activity_status==='성공').length }
                      const mAnnual  = { mitDone: uLeads.filter(l=>isThisYear(l.activity_at)&&l.activity_status&&l.activity_status!=='미처리').length, success: uLeads.filter(l=>isThisYear(l.activity_at)&&l.activity_status==='성공').length + uDirect.filter(l=>isThisYear(l.activity_at)&&l.activity_status==='성공').length }
                      return { name:u.name, team:acc2?.team_label||'-', mitAssigned:uLeads.length, directTotal:uDirect.length, directDone:uDirect.length, weekly:mWeekly, monthly:mMonthly, annual:mAnnual }
                    }).filter(Boolean)
                    const themes = [...new Set(pl.map(l=>l.project_name).filter(Boolean))].map(tn=>{
                      const tl2=pl.filter(l=>l.project_name===tn)
                      return { name:tn, total:tl2.length, done:tl2.filter(l=>l.activity_status&&l.activity_status!=='미처리').length, success:tl2.filter(l=>l.activity_status==='성공').length }
                    })
                    // 이번 달 성공 건 세부 (최대 20건)
                    const successCases = [...pl,...dl]
                      .filter(l=>l.activity_status==='성공'&&isThisMonth(l.activity_at||l.created_at))
                      .sort((a,b)=>new Date(b.activity_at||b.created_at||0)-new Date(a.activity_at||a.created_at||0))
                      .slice(0,20).map(l=>({
                        date:(l.activity_at||l.created_at)?new Date(l.activity_at||l.created_at).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}):'-',
                        mm:l.assigned_to||myUsers.find(u=>u.username===l.mm_username)?.name||'-',
                        address:l.address||l.customer||'-',
                        products:(()=>{
                          try{const wp=JSON.parse(l.won_products||'null');if(wp&&!Array.isArray(wp))return Object.entries(wp).map(([k,v])=>k+' '+v).join(', ');if(Array.isArray(wp)&&wp.length)return wp.join(', ')}catch{}
                          return Array.isArray(l.products)?l.products.join(', '):(l.products||'-')
                        })()
                      }))
                    return { id:ptId, name:pt?.label||'-', icon:pt?.icon||'📁', adminOnly:pt?.adminOnly||false,
                      total:pl.length, directTotal:dl.length,
                      done:pl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length,
                      success:pl.filter(l=>l.activity_status==='성공').length+dl.filter(l=>l.activity_status==='성공').length,
                      monthly: projStats(isThisMonth), annual: projStats(isThisYear),
                      prodCounts: calcProdCounts([...pl,...dl].filter(l=>l.activity_status==='성공')),
                      themes, mmStats, successCases }
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

                  // ── 전월 대비 비교 데이터 계산 ──
                  const _prevM = _selM - 1
                  const _prevY = _prevM < 0 ? _y2-1 : _y2
                  const _prevMonthIdx = _prevM < 0 ? 11 : _prevM
                  const _prevStart = new Date(_prevY,_prevMonthIdx,1).getTime()
                  const _prevEnd = new Date(_prevY,_prevMonthIdx+1,1).getTime()-1
                  const _inPrev = dt=>{const t=_ms(dt);return t>=_prevStart&&t<=_prevEnd}
                  function momStats(inFn){
                    const cl = leads.filter(l=>myUsers.map(u=>u.name).includes(l.assigned_to)&&inFn(l.activity_at))
                    const dl = directLeads.filter(l=>myUnames.includes(l.mm_username)&&inFn(l.activity_at||l.created_at))
                    const all = [...cl,...dl]
                    const act = cl.filter(l=>l.activity_status&&l.activity_status!=='미처리').length + dl.length
                    const succ = all.filter(l=>l.activity_status==='성공')
                    const lines = succ.reduce((sum,l)=>{
                      try{const wp=JSON.parse(l.won_products||'null');if(wp&&!Array.isArray(wp))return sum+Object.values(wp).reduce((a,v)=>a+(+v||0),0);if(Array.isArray(wp))return sum+wp.length}catch{}
                      return sum+(l.won_lines||1)
                    },0)
                    return { act, success:succ.length, lines, rate: act>0?Math.round(succ.length/act*1000)/10:0 }
                  }
                  const momData = { prev: momStats(_inPrev), cur: momStats(_inMo),
                    prevLabel:(_prevMonthIdx+1)+'월', curLabel:(_selM+1)+'월' }

                  const html = buildSlideHTML({ _debug: dbgInfo, reportMode: _isPastMonth?'past':'current',
                    bizDays: curBizDays, perMMTarget, workDaysAll: workDays,
                    allDailyStats,
                    period: periodStr, today: todayStr, yearStr: curYear+'년',
                    teams: teamDataFull, projects: projDataFull,
                    allMM: allMMData, topMM: [...allMMData].sort((a,b)=>(b.monthly?.success||0)-(a.monthly?.success||0)).slice(0,5),
                    mDiscoveryCount: mDiscoveryTotal,
                    globalProdCounts: globalProdMonthly,
                    globalProdAnnual,
                    momData
                  })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
                  a.download = '상권통_보고서_' + curYear + '-' + String(slideMonth||curMonth).padStart(2,'0') + (_isPastMonth?'_월마감':'') + '.html'
                  a.click()
                  t2('슬라이드 장표 다운로드 완료!')
                  } catch(err) { t2('슬라이드 오류: ' + err.message); console.error('Slide err:', err) }
                }} style={{ width: '100%', background: C.blue, border: 'none', color: '#fff', padding: '13px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>
                  📥 슬라이드 장표 다운로드
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
          {/* ═══ 패스앤슈팅 대리점 관리 (CSV 업로드) ═══ */}
            <div style={{marginTop:'24px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'16px'}}>
              <div style={{fontSize:'15px',fontWeight:'800',color:'#7c3aed',marginBottom:'8px'}}>🤝 패스앤슈팅 대리점 관리</div>
              <p style={{fontSize:'12px',color:C.sub,marginBottom:'12px',lineHeight:1.6}}>
                활동결과 입력 시 선택할 대리점 목록을 CSV로 등록합니다. 파일 형식은 <b>유형,대리점명</b> 2개 컬럼이며,
                업로드 시 <b style={{color:'#dc2626'}}>기존 목록은 전체 교체</b>됩니다. 유형(1단계)은 CSV에 입력된 값으로 자동 생성됩니다.
              </p>
              <div style={{background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',fontSize:'11.5px',color:'#6d28d9',lineHeight:1.7}}>
                <div style={{fontWeight:'700',marginBottom:'4px'}}>📄 CSV 예시 (첫 줄 헤더 포함)</div>
                <div style={{fontFamily:'monospace',background:'#fff',borderRadius:'6px',padding:'8px 10px',color:'#334155',fontSize:'11px',whiteSpace:'pre'}}>유형,대리점명{'\n'}유선대리점,행복유선대리점{'\n'}유통대리점,강서유통{'\n'}플라자,사상플라자{'\n'}KTS,김해KTS{'\n'}직접판매,본사직판팀</div>
              </div>
              <div style={{display:'flex',gap:'10px',alignItems:'center',marginBottom:'14px',flexWrap:'wrap'}}>
                <label style={{background:'#7c3aed',color:'#fff',padding:'10px 18px',borderRadius:'10px',fontSize:'13px',fontWeight:'800',cursor:'pointer'}}>
                  📤 CSV 파일 선택
                  <input type="file" accept=".csv" style={{display:'none'}} onChange={async e=>{
                    const file=e.target.files?.[0]; if(!file)return
                    try{
                      const text=await file.text()
                      const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
                      // 첫 줄이 헤더(유형/대리점명 포함)면 건너뜀
                      const start=(/유형|type/i.test(lines[0])&&/대리점|name/i.test(lines[0]))?1:0
                      const rows=[]
                      for(let i=start;i<lines.length;i++){
                        const parts=lines[i].split(',').map(s=>s.trim().replace(/^["']|["']$/g,''))
                        if(parts.length>=2&&parts[0]&&parts[1]) rows.push({type:parts[0],name:parts[1]})
                      }
                      if(rows.length===0){t2('유효한 데이터가 없습니다. CSV 형식을 확인하세요');e.target.value='';return}
                      if(!window.confirm('대리점 '+rows.length+'개를 등록합니다.\n\n기존 목록은 모두 삭제되고 새 목록으로 교체됩니다.\n계속하시겠습니까?')){e.target.value='';return}
                      // 전체 교체: 기존 삭제 후 일괄 등록
                      await db.del('agencies','id=gte.0').catch(()=>{})
                      await db.post('agencies',rows)
                      const fresh=await db.get('agencies','select=*&order=type.asc,name.asc')
                      setAgencies(fresh||[])
                      t2('대리점 '+rows.length+'개 등록 완료!')
                    }catch(err){t2('업로드 실패: '+err.message)}
                    e.target.value=''
                  }}/>
                </label>
                <span style={{fontSize:'12px',color:C.sub}}>현재 등록: <b style={{color:'#7c3aed'}}>{agencies.length}</b>개</span>
              </div>
              {/* 등록된 대리점 미리보기 (유형별 그룹) */}
              {agencies.length>0&&(
                <div style={{borderTop:'1px solid #f1f5f9',paddingTop:'12px'}}>
                  {[...new Set(agencies.map(a=>a.type))].map(type=>(
                    <div key={type} style={{marginBottom:'10px'}}>
                      <div style={{fontSize:'12px',fontWeight:'800',color:'#6d28d9',marginBottom:'5px'}}>{type} <span style={{color:'#94a3b8',fontWeight:'400'}}>({agencies.filter(a=>a.type===type).length})</span></div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                        {agencies.filter(a=>a.type===type).map(a=>(
                          <span key={a.id} style={{fontSize:'11px',background:'#f5f3ff',color:'#5b21b6',border:'1px solid #e9d5ff',borderRadius:'14px',padding:'3px 10px'}}>{a.name}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          {/* 드랍된 테마 관리 */}
            {droppedThemes.length>0&&(
              <div style={{marginTop:'24px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'16px'}}>
                <div style={{fontSize:'15px',fontWeight:'800',color:'#dc2626',marginBottom:'12px'}}>🚫 드랍된 테마 관리</div>
                <p style={{fontSize:'12px',color:C.sub,marginBottom:'12px'}}>아래 테마들은 리드 목록 및 슬라이드 성과에서 제외됩니다. ✕ 버튼을 눌러 드랍 해제할 수 있습니다.</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                  {droppedThemes.map(t=>(
                    <div key={t} style={{display:'flex',alignItems:'center',gap:'6px',background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:'20px',padding:'5px 12px'}}>
                      <span style={{fontSize:'12px',color:'#dc2626',textDecoration:'line-through'}}>{t}</span>
                      <button onClick={async()=>{
                        const next=droppedThemes.filter(x=>x!==t)
                        setDroppedThemes(next)
                        await db.patch('app_settings','dropped_themes',{value:JSON.stringify(next)}).catch(()=>
                          db.post('app_settings',{id:'dropped_themes',value:JSON.stringify(next)})
                        )
                      }} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:'50%',width:'16px',height:'16px',fontSize:'10px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  )
}
