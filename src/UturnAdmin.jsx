import { useState, useEffect } from 'react'
import { db } from './supabase'

// ── U-TURN 관리자 화면 (팀원관리 + 전략배분 + 성과현황) ──
// 팀 매핑: team1(김해)+team2(사하)=시너지2팀 합산
const UGROUPS = [
  { gid:'g_mkt',  label:'마케팅팀',      teamIds:['team5'],         color:'#f472b6' },
  { gid:'g_syn1', label:'시너지영업1팀', teamIds:['team3'],         color:'#fb923c' },
  { gid:'g_syn2', label:'시너지영업2팀', teamIds:['team1','team2'], color:'#4ade80' },
  { gid:'g_cs',   label:'CS운영팀',      teamIds:['team4'],         color:'#60a5fa' },
  { gid:'g_plan', label:'고객기획팀',    teamIds:['team6'],         color:'#c084fc' },
]
// 팀원 등록용 팀 선택지 (실제 team_id 단위 — 시너지2는 김해/사하 구분)
const TEAM_OPTS = [
  { id:'team5', label:'마케팅팀' },
  { id:'team3', label:'시너지영업1팀' },
  { id:'team1', label:'시너지2-김해팀' },
  { id:'team2', label:'시너지2-사하팀' },
  { id:'team4', label:'CS운영팀' },
  { id:'team6', label:'고객기획팀' },
]
function groupOf(teamId){ return UGROUPS.find(g=>g.teamIds.includes(teamId)) }
function teamLabel(teamId){ return TEAM_OPTS.find(t=>t.id===teamId)?.label || teamId || '-' }

const C = { text:'#f1f5f9', sub:'rgba(255,255,255,0.55)', card:'rgba(255,255,255,0.04)',
  border:'rgba(255,255,255,0.1)', red:'#E31937', u:'#c084fc', i:'#60a5fa', t:'#fbbf24', green:'#4ade80' }
const IS = { width:'100%', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.15)',
  color:'#f1f5f9', padding:'12px 14px', borderRadius:'10px', fontSize:'15px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
const pct=(n,d)=>d>0?Math.round(n/d*100):0
function fmtAt(iso){ if(!iso)return''; try{const d=new Date(iso);return d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})}catch{return iso} }

// 팀원 추가/수정 모달
function MemberModal({ editUser, isSuper, myTeamId, onClose, onSaved }) {
  const [f, setF] = useState(editUser ? { name:editUser.name, username:editUser.username, password:'', region:editUser.region||'', team_id:editUser.team_id||'', goal:editUser.goal||10 }
    : { name:'', username:'', password:'', region:'', team_id:isSuper?'team5':myTeamId, goal:10 })
  const [err, setErr] = useState(''); const [saving,setSaving]=useState(false)
  const set=(k,v)=>setF(p=>({...p,[k]:v}))
  const save = async () => {
    setErr('')
    if (!f.name || !f.username || (!editUser && !f.password)) { setErr('이름·아이디·비밀번호를 입력하세요'); return }
    setSaving(true)
    try {
      if (editUser) {
        const patch = { name:f.name, region:f.region, team_id:f.team_id, goal:parseInt(f.goal)||10 }
        if (f.password.trim()) patch.password = f.password.trim()
        await db.patch('mm_users', 'id=eq.'+editUser.id, patch)
      } else {
        await db.post('mm_users', { username:f.username.trim(), password:f.password.trim(), name:f.name.trim(), region:f.region.trim(), team_id:f.team_id, goal:parseInt(f.goal)||10 })
      }
      onSaved()
    } catch(e) { setErr('저장 실패 (아이디 중복 가능): '+e.message); setSaving(false) }
  }
  const lbl=t=><div style={{fontSize:'12px',fontWeight:'700',color:C.sub,marginBottom:'5px'}}>{t}</div>
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1001, display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#0f1a30', borderRadius:'20px 20px 0 0', padding:'22px 18px 32px', width:'100%', maxWidth:'480px', maxHeight:'92vh', overflowY:'auto', position:'relative', border:'1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'14px', right:'14px', background:'rgba(255,255,255,0.1)', border:'none', color:C.text, width:'28px', height:'28px', borderRadius:'50%', fontSize:'16px', cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:'17px', fontWeight:'900', color:C.text, marginBottom:'16px' }}>{editUser?'✏️ 팀원 수정':'➕ 팀원 추가'}</div>
        {err && <div style={{ color:'#ff5a6e', fontSize:'13px', background:'rgba(227,25,55,0.12)', border:'1px solid rgba(227,25,55,0.3)', padding:'9px 11px', borderRadius:'8px', marginBottom:'10px' }}>{err}</div>}
        {lbl('이름')}<input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="홍길동" style={{...IS,marginBottom:'10px'}} />
        {lbl('아이디')}<input value={f.username} onChange={e=>set('username',e.target.value)} disabled={!!editUser} placeholder="mkt001" style={{...IS,marginBottom:'10px',opacity:editUser?0.5:1}} />
        {lbl(editUser?'비밀번호 (변경 시에만 입력)':'비밀번호')}<input value={f.password} onChange={e=>set('password',e.target.value)} placeholder="초기 비밀번호" style={{...IS,marginBottom:'10px'}} />
        {lbl('담당 지역 (선택)')}<input value={f.region} onChange={e=>set('region',e.target.value)} placeholder="예: 사하구" style={{...IS,marginBottom:'10px'}} />
        {lbl('소속 팀')}
        <select value={f.team_id} onChange={e=>set('team_id',e.target.value)} disabled={!isSuper} style={{...IS,marginBottom:'10px',opacity:isSuper?1:0.6}}>
          {TEAM_OPTS.map(t=><option key={t.id} value={t.id} style={{color:'#000'}}>{t.label}</option>)}
        </select>
        {lbl('월 목표(건)')}<input type="number" value={f.goal} onChange={e=>set('goal',e.target.value)} style={{...IS,marginBottom:'16px'}} />
        <button onClick={save} disabled={saving} style={{ width:'100%', padding:'14px', background:saving?'rgba(255,255,255,0.1)':C.red, border:'none', color:'#fff', borderRadius:'12px', fontSize:'16px', fontWeight:'900', cursor:saving?'wait':'pointer', fontFamily:'inherit' }}>{saving?'저장 중...':(editUser?'수정 저장':'팀원 생성')}</button>
      </div>
    </div>
  )
}

// 전략활동 배분/수정 모달
function StrategyModal({ editStrat, isSuper, myTeamId, users, adminName, onClose, onSaved }) {
  const [f, setF] = useState(editStrat ? {
    title:editStrat.title, description:editStrat.description||'', team_id:editStrat.team_id||'',
    assigned_to:editStrat.assigned_to||'', target_u:editStrat.target_u||0, target_i:editStrat.target_i||0, target_t:editStrat.target_t||0,
    priority:editStrat.priority||'보통', status:editStrat.status||'진행중', due_date:editStrat.due_date||''
  } : { title:'', description:'', team_id:isSuper?'':myTeamId, assigned_to:'', target_u:0, target_i:0, target_t:0, priority:'보통', status:'진행중', due_date:'' })
  const [err,setErr]=useState(''); const [saving,setSaving]=useState(false)
  const set=(k,v)=>setF(p=>({...p,[k]:v}))
  // 선택된 팀의 팀원만
  const teamUsers = f.team_id ? users.filter(u=>u.team_id===f.team_id) : []
  const save = async () => {
    setErr('')
    if (!f.title.trim()) { setErr('전략활동명을 입력하세요'); return }
    if (!f.team_id) { setErr('대상 팀을 선택하세요'); return }
    setSaving(true)
    const row = {
      title:f.title.trim(), description:f.description.trim(), team_id:f.team_id, team_label:teamLabel(f.team_id),
      assigned_to:f.assigned_to||null, target_u:parseInt(f.target_u)||0, target_i:parseInt(f.target_i)||0, target_t:parseInt(f.target_t)||0,
      priority:f.priority, status:f.status, due_date:f.due_date||null, created_by:adminName||'관리자', updated_at:new Date().toISOString()
    }
    try {
      if (editStrat) await db.patch('uturn_strategies', 'id=eq.'+editStrat.id, row)
      else await db.post('uturn_strategies', row)
      onSaved()
    } catch(e){ setErr('저장 실패: '+e.message); setSaving(false) }
  }
  const lbl=t=><div style={{fontSize:'12px',fontWeight:'700',color:C.sub,marginBottom:'5px'}}>{t}</div>
  const numF=(k,col)=>(<input type="number" value={f[k]||0} onChange={e=>set(k,e.target.value)} style={{...IS,textAlign:'center',fontWeight:'800',color:col}} />)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1001, display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#0f1a30', borderRadius:'20px 20px 0 0', padding:'22px 18px 32px', width:'100%', maxWidth:'480px', maxHeight:'94vh', overflowY:'auto', position:'relative', border:'1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'14px', right:'14px', background:'rgba(255,255,255,0.1)', border:'none', color:C.text, width:'28px', height:'28px', borderRadius:'50%', fontSize:'16px', cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:'17px', fontWeight:'900', color:C.text, marginBottom:'16px' }}>{editStrat?'✏️ 전략활동 수정':'🎯 전략활동 배분'}</div>
        {err && <div style={{ color:'#ff5a6e', fontSize:'13px', background:'rgba(227,25,55,0.12)', border:'1px solid rgba(227,25,55,0.3)', padding:'9px 11px', borderRadius:'8px', marginBottom:'10px' }}>{err}</div>}
        {lbl('전략활동명')}<input value={f.title} onChange={e=>set('title',e.target.value)} placeholder="예: OO아파트 특판, △△산단 MNP" style={{...IS,marginBottom:'10px'}} />
        {lbl('세부 지시 내용')}<textarea value={f.description} onChange={e=>set('description',e.target.value)} rows={3} placeholder="구체적 지시사항·공략 방법" style={{...IS,resize:'vertical',minHeight:'70px',marginBottom:'12px'}} />
        {lbl('대상 팀')}
        <select value={f.team_id} onChange={e=>{set('team_id',e.target.value);set('assigned_to','')}} disabled={!isSuper} style={{...IS,marginBottom:'10px',opacity:isSuper?1:0.6}}>
          <option value="" style={{color:'#000'}}>팀 선택</option>
          {TEAM_OPTS.map(t=><option key={t.id} value={t.id} style={{color:'#000'}}>{t.label}</option>)}
        </select>
        {lbl('담당자 지정 (선택 · 미지정 시 팀 전체)')}
        <select value={f.assigned_to} onChange={e=>set('assigned_to',e.target.value)} style={{...IS,marginBottom:'12px'}}>
          <option value="" style={{color:'#000'}}>팀 전체</option>
          {teamUsers.map(u=><option key={u.id} value={u.name} style={{color:'#000'}}>{u.name}</option>)}
        </select>
        {/* UIT 목표 */}
        <div style={{ background:'rgba(227,25,55,0.08)', border:'1px solid rgba(227,25,55,0.3)', borderRadius:'12px', padding:'12px', marginBottom:'12px' }}>
          <div style={{ fontSize:'12.5px', fontWeight:'900', color:'#ff5a6e', marginBottom:'8px' }}>⤴ UIT 목표</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <div style={{ flex:1 }}>{lbl('U 목표')}{numF('target_u',C.u)}</div>
            <div style={{ flex:1 }}>{lbl('I 목표')}{numF('target_i',C.i)}</div>
            <div style={{ flex:1 }}>{lbl('T 목표')}{numF('target_t',C.t)}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          <div style={{ flex:1 }}>{lbl('우선순위')}
            <select value={f.priority} onChange={e=>set('priority',e.target.value)} style={IS}>
              {['높음','보통','낮음'].map(p=><option key={p} value={p} style={{color:'#000'}}>{p}</option>)}
            </select>
          </div>
          <div style={{ flex:1 }}>{lbl('상태')}
            <select value={f.status} onChange={e=>set('status',e.target.value)} style={IS}>
              {['진행중','완료','보류'].map(s=><option key={s} value={s} style={{color:'#000'}}>{s}</option>)}
            </select>
          </div>
        </div>
        {lbl('목표 기한 (선택)')}<input type="date" value={f.due_date} onChange={e=>set('due_date',e.target.value)} style={{...IS,marginBottom:'16px'}} />
        <button onClick={save} disabled={saving} style={{ width:'100%', padding:'14px', background:saving?'rgba(255,255,255,0.1)':C.red, border:'none', color:'#fff', borderRadius:'12px', fontSize:'16px', fontWeight:'900', cursor:saving?'wait':'pointer', fontFamily:'inherit' }}>{saving?'저장 중...':(editStrat?'수정 저장':'전략활동 배분')}</button>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──
export default function UturnAdmin({ adminInfo, onBack }) {
  const isSuper = adminInfo?.role === 'super'
  const myTeamId = adminInfo?.teamId
  const [tab, setTab] = useState('perf')  // perf | strategies | members
  const [users, setUsers] = useState([])
  const [strategies, setStrategies] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [memberModal, setMemberModal] = useState(null)   // {editUser} | 'new'
  const [stratModal, setStratModal] = useState(null)
  const [toast, setToast] = useState('')
  const t2 = m => { setToast(m); setTimeout(()=>setToast(''),2500) }

  useEffect(()=>{ load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      const [u, str, act] = await Promise.all([
        db.get('mm_users', 'select=id,username,name,region,goal,team_id&order=created_at.asc&limit=2000').catch(()=>[]),
        db.get('uturn_strategies', 'select=*&order=created_at.desc&limit=500').catch(()=>[]),
        db.get('uturn_activities', 'select=*&order=created_at.desc&limit=3000').catch(()=>[])
      ])
      // 중간관리자는 본인 팀만 (시너지2 관리자면 team1/team2 둘 다? → team_id 기준, 김해/사하 각각 관리자이므로 본인 것만)
      const fu = isSuper ? (u||[]) : (u||[]).filter(x=>x.team_id===myTeamId)
      setUsers(fu); setStrategies(str||[]); setActivities(act||[])
    } catch(e){ t2('로드 오류') }
    setLoading(false)
  }
  const delMember = async (u) => {
    if (!window.confirm('【'+u.name+'】 팀원 계정을 삭제하시겠습니까?')) return
    try { await db.del('mm_users','id=eq.'+u.id); t2('삭제 완료'); load() } catch { t2('삭제 실패') }
  }
  const delStrat = async (s) => {
    if (!window.confirm('전략활동 【'+s.title+'】을 삭제하시겠습니까?\n소속 세부활동도 함께 삭제됩니다.')) return
    try { await db.del('uturn_strategies','id=eq.'+s.id); t2('삭제 완료'); load() } catch { t2('삭제 실패') }
  }

  // ── 성과 집계 (그룹별, team1+team2 합산) ──
  const actByTeam = {}
  activities.forEach(a => { (actByTeam[a.team_id]=actByTeam[a.team_id]||[]).push(a) })
  const groupPerf = UGROUPS.map(g => {
    const acts = g.teamIds.flatMap(tid => actByTeam[tid]||[])
    const u = acts.reduce((x,a)=>x+(a.u_new||0)+(a.u_mnp||0),0)
    const i = acts.reduce((x,a)=>x+(a.i_count||0),0)
    const t = acts.reduce((x,a)=>x+(a.t_count||0),0)
    const success = acts.filter(a=>a.activity_status==='성공').length
    const memberCount = users.filter(x=>g.teamIds.includes(x.team_id)).length
    return { ...g, u, i, t, score:u*1.5+i+t, success, actCount:acts.length, memberCount }
  }).sort((a,b)=>b.score-a.score)
  const totScore = groupPerf.reduce((x,g)=>x+g.score,0)

  // 중간관리자면 본인 그룹만 표시
  const visiblePerf = isSuper ? groupPerf : groupPerf.filter(g=>g.teamIds.includes(myTeamId))

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(165deg,#0a0e1a 0%,#0f1a30 45%,#1a0e18 100%)', color:C.text, fontFamily:"'Noto Sans KR',sans-serif", paddingBottom:'40px' }}>
      {toast && <div style={{ position:'fixed', top:'18px', left:'50%', transform:'translateX(-50%)', background:'#1e293b', color:'#fff', padding:'11px 24px', borderRadius:'12px', zIndex:1002, fontSize:'14px', fontWeight:'700', boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}
      {memberModal && <MemberModal editUser={memberModal==='new'?null:memberModal} isSuper={isSuper} myTeamId={myTeamId} onClose={()=>setMemberModal(null)} onSaved={()=>{ setMemberModal(null); t2('저장 완료!'); load() }} />}
      {stratModal && <StrategyModal editStrat={stratModal==='new'?null:stratModal} isSuper={isSuper} myTeamId={myTeamId} users={users} adminName={adminInfo?.name} onClose={()=>setStratModal(null)} onSaved={()=>{ setStratModal(null); t2('저장 완료!'); load() }} />}

      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 18px 12px' }}>
        <button onClick={onBack} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:C.text, fontSize:'14px', padding:'7px 13px', borderRadius:'9px', cursor:'pointer', fontFamily:'inherit' }}>‹ 홈</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'16px', fontWeight:'900', color:'#ff5a6e' }}>⤴ U-TURN 관리</div>
          <div style={{ fontSize:'11px', color:C.sub }}>{isSuper?'총괄':teamLabel(myTeamId)+' 관리자'}</div>
        </div>
        <button onClick={load} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:C.text, fontSize:'15px', padding:'7px 11px', borderRadius:'9px', cursor:'pointer' }}>🔄</button>
      </div>

      <div style={{ maxWidth:'460px', margin:'0 auto', padding:'0 16px' }}>
        {/* 탭 */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
          {[['perf','📊 성과현황'],['strategies','🎯 전략활동'],['members','👥 팀원관리']].map(([id,lb])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:'11px 4px', background:tab===id?'rgba(227,25,55,0.15)':'rgba(255,255,255,0.04)', border:'1.5px solid '+(tab===id?'rgba(227,25,55,0.4)':C.border), color:tab===id?'#ff5a6e':C.sub, borderRadius:'11px', fontSize:'13.5px', fontWeight:tab===id?'800':'500', cursor:'pointer', fontFamily:'inherit' }}>{lb}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign:'center', padding:'40px', color:C.sub }}>불러오는 중...</div>}

        {/* ── 성과현황 ── */}
        {!loading && tab==='perf' && (<>
          {isSuper && (
            <div style={{ background:'rgba(227,25,55,0.1)', border:'1px solid rgba(227,25,55,0.3)', borderRadius:'14px', padding:'14px', marginBottom:'14px', textAlign:'center' }}>
              <div style={{ fontSize:'12px', color:C.sub, marginBottom:'4px' }}>지사 전체 UIT 스코어</div>
              <div style={{ fontSize:'30px', fontWeight:'900', color:'#fff' }}>{Math.round(totScore)}</div>
            </div>
          )}
          {visiblePerf.map((g,idx)=>(
            <div key={g.gid} style={{ background:C.card, border:'1px solid '+C.border, borderLeft:'4px solid '+g.color, borderRadius:'14px', padding:'14px', marginBottom:'11px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  {isSuper && <span style={{ fontSize:'14px', fontWeight:'900', color:idx===0?'#fbbf24':C.sub }}>{['🥇','🥈','🥉','4','5'][idx]}</span>}
                  <span style={{ fontSize:'15px', fontWeight:'900', color:C.text }}>{g.label}</span>
                  <span style={{ fontSize:'11px', color:C.sub }}>· {g.memberCount}명</span>
                </div>
                <span style={{ fontSize:'15px', fontWeight:'900', color:g.color }}>{Math.round(g.score)}</span>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                {[['U',g.u,C.u],['I',g.i,C.i],['T',g.t,C.t]].map(([lb,v,col])=>(
                  <div key={lb} style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:'9px', padding:'8px', textAlign:'center' }}>
                    <div style={{ fontSize:'18px', fontWeight:'900', color:col }}>{v}</div>
                    <div style={{ fontSize:'10px', color:C.sub }}>{lb}</div>
                  </div>
                ))}
                <div style={{ flex:1, background:'rgba(74,222,128,0.08)', borderRadius:'9px', padding:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:'18px', fontWeight:'900', color:C.green }}>{g.success}</div>
                  <div style={{ fontSize:'10px', color:C.sub }}>성공</div>
                </div>
              </div>
              {g.gid==='g_syn2' && <div style={{ fontSize:'10.5px', color:C.sub, marginTop:'8px' }}>※ 김해팀+사하팀 합산</div>}
            </div>
          ))}
        </>)}

        {/* ── 전략활동 ── */}
        {!loading && tab==='strategies' && (<>
          <button onClick={()=>setStratModal('new')} style={{ width:'100%', padding:'13px', background:C.red, border:'none', color:'#fff', borderRadius:'12px', fontSize:'15px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit', marginBottom:'14px' }}>🎯 새 전략활동 배분</button>
          {(isSuper?strategies:strategies.filter(s=>s.team_id===myTeamId)).length===0
            ? <div style={{ textAlign:'center', padding:'40px', color:C.sub, fontSize:'14px' }}>배분한 전략활동이 없습니다</div>
            : (isSuper?strategies:strategies.filter(s=>s.team_id===myTeamId)).map(s=>{
              const acts = activities.filter(a=>a.strategy_id===s.id)
              const u=acts.reduce((x,a)=>x+(a.u_new||0)+(a.u_mnp||0),0), i=acts.reduce((x,a)=>x+(a.i_count||0),0), t=acts.reduce((x,a)=>x+(a.t_count||0),0)
              const stC={'진행중':'#60a5fa','완료':'#4ade80','보류':'#94a3b8'}[s.status]||'#60a5fa'
              return (
                <div key={s.id} style={{ background:C.card, border:'1px solid '+C.border, borderLeft:'4px solid '+stC, borderRadius:'13px', padding:'13px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:'5px', alignItems:'center', marginBottom:'3px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'10px', fontWeight:'800', padding:'2px 7px', borderRadius:'9px', background:'rgba(255,255,255,0.08)', color:stC }}>{s.status}</span>
                        <span style={{ fontSize:'11px', color:g_color(s.team_id) }}>{teamLabel(s.team_id)}{s.assigned_to?' · '+s.assigned_to:' 전체'}</span>
                      </div>
                      <div style={{ fontSize:'15px', fontWeight:'900', color:C.text }}>{s.title}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', marginTop:'8px', marginBottom:'8px' }}>
                    {[['U',u,s.target_u,C.u],['I',i,s.target_i,C.i],['T',t,s.target_t,C.t]].map(([lb,v,goal,col])=>(
                      <div key={lb} style={{ flex:1, textAlign:'center', background:'rgba(255,255,255,0.04)', borderRadius:'8px', padding:'6px' }}>
                        <div style={{ fontSize:'13px', fontWeight:'900', color:col }}>{v}<span style={{ fontSize:'10px', color:C.sub }}>/{goal||'-'}</span></div>
                        <div style={{ fontSize:'9px', color:C.sub }}>{lb}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', color:C.sub }}>세부활동 {acts.length}건 · 성공 {acts.filter(a=>a.activity_status==='성공').length}건</span>
                    <div style={{ display:'flex', gap:'10px' }}>
                      <button onClick={()=>setStratModal(s)} style={{ background:'none', border:'none', color:C.i, fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>수정</button>
                      <button onClick={()=>delStrat(s)} style={{ background:'none', border:'none', color:C.sub, fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>삭제</button>
                    </div>
                  </div>
                </div>
              )
            })
          }
        </>)}

        {/* ── 팀원관리 ── */}
        {!loading && tab==='members' && (<>
          <button onClick={()=>setMemberModal('new')} style={{ width:'100%', padding:'13px', background:C.red, border:'none', color:'#fff', borderRadius:'12px', fontSize:'15px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit', marginBottom:'14px' }}>➕ 팀원 추가</button>
          {TEAM_OPTS.filter(to=>isSuper||to.id===myTeamId).map(to=>{
            const tu = users.filter(u=>u.team_id===to.id)
            if (tu.length===0 && !isSuper) return null
            return (
              <div key={to.id} style={{ marginBottom:'14px' }}>
                <div style={{ fontSize:'13px', fontWeight:'800', color:g_color(to.id), marginBottom:'7px' }}>{to.label} ({tu.length}명)</div>
                {tu.length===0
                  ? <div style={{ fontSize:'12px', color:C.sub, padding:'8px 0' }}>등록된 팀원 없음</div>
                  : tu.map(u=>(
                    <div key={u.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'11px', padding:'11px 13px', marginBottom:'7px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:'14px', fontWeight:'800', color:C.text }}>{u.name} <span style={{ fontSize:'11px', color:C.sub, fontWeight:'400' }}>({u.username})</span></div>
                        <div style={{ fontSize:'11.5px', color:C.sub }}>{u.region||'-'} · 목표 {u.goal||0}건</div>
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button onClick={()=>setMemberModal(u)} style={{ background:'rgba(96,165,250,0.15)', border:'none', color:C.i, padding:'6px 11px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>수정</button>
                        <button onClick={()=>delMember(u)} style={{ background:'rgba(227,25,55,0.12)', border:'none', color:'#ff5a6e', padding:'6px 11px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>삭제</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </>)}
      </div>
    </div>
  )
}
function g_color(teamId){ return groupOf(teamId)?.color || '#94a3b8' }
