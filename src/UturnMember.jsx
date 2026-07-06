import { useState, useEffect } from 'react'
import { db } from './supabase'

// ── U-TURN 팀원 화면 (배분받은 전략활동 확인 + 세부활동/성과 입력) ──
const C = { bg:'#0a0e1a', card:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.1)',
  text:'#f1f5f9', sub:'rgba(255,255,255,0.55)', red:'#E31937',
  u:'#c084fc', i:'#60a5fa', t:'#fbbf24', green:'#4ade80' }
const IS = { width:'100%', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.15)',
  color:'#f1f5f9', padding:'12px 14px', borderRadius:'10px', fontSize:'15px', outline:'none',
  boxSizing:'border-box', fontFamily:'inherit' }
const ST = ['성공','접촉완료','미처리','실패']
const SC = {
  '성공':    { bg:'rgba(74,222,128,0.15)', text:'#4ade80', bd:'rgba(74,222,128,0.4)' },
  '접촉완료':{ bg:'rgba(96,165,250,0.15)', text:'#60a5fa', bd:'rgba(96,165,250,0.4)' },
  '미처리':  { bg:'rgba(251,191,36,0.15)', text:'#fbbf24', bd:'rgba(251,191,36,0.4)' },
  '실패':    { bg:'rgba(227,25,55,0.15)',  text:'#ff5a6e', bd:'rgba(227,25,55,0.4)' },
}
function fmtAt(iso) {
  if (!iso) return ''
  try { const d = new Date(iso); return d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) }
  catch { return iso }
}
const pct = (n,d) => d>0 ? Math.round(n/d*100) : 0

// 전략활동 카드
function StrategyCard({ s, acts, onOpen }) {
  const myActs = acts.filter(a => a.strategy_id === s.id)
  const u = myActs.reduce((x,a)=>x+(a.u_new||0)+(a.u_mnp||0),0)
  const i = myActs.reduce((x,a)=>x+(a.i_count||0),0)
  const t = myActs.reduce((x,a)=>x+(a.t_count||0),0)
  const goalU = s.target_u||0, goalI = s.target_i||0, goalT = s.target_t||0
  const prC = { '높음':'#ff5a6e', '보통':'#fbbf24', '낮음':'#94a3b8' }[s.priority] || '#94a3b8'
  const stC = { '진행중':'#60a5fa', '완료':'#4ade80', '보류':'#94a3b8' }[s.status] || '#60a5fa'
  return (
    <div onClick={() => onOpen(s)} style={{ background:C.card, border:'1.5px solid '+C.border, borderLeft:'4px solid '+stC, borderRadius:'14px', padding:'15px', marginBottom:'12px', cursor:'pointer' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'4px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'10px', fontWeight:'800', padding:'2px 8px', borderRadius:'10px', background:'rgba(255,255,255,0.08)', color:prC }}>{s.priority}</span>
            <span style={{ fontSize:'10px', fontWeight:'800', padding:'2px 8px', borderRadius:'10px', background:'rgba(255,255,255,0.08)', color:stC }}>{s.status}</span>
            {s.due_date && <span style={{ fontSize:'11px', color:C.sub }}>~{s.due_date}</span>}
          </div>
          <div style={{ fontSize:'16px', fontWeight:'900', color:C.text }}>{s.title}</div>
          {s.description && <div style={{ fontSize:'12.5px', color:C.sub, marginTop:'3px', lineHeight:1.5 }}>{s.description}</div>}
        </div>
      </div>
      {/* UIT 진척 */}
      <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
        {[['U',u,goalU,C.u],['I',i,goalI,C.i],['T',t,goalT,C.t]].map(([lb,val,goal,col])=>(
          <div key={lb} style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:'9px', padding:'8px', textAlign:'center' }}>
            <div style={{ fontSize:'11px', fontWeight:'800', color:col }}>{lb}</div>
            <div style={{ fontSize:'15px', fontWeight:'900', color:C.text }}>{val}<span style={{ fontSize:'10px', color:C.sub }}>/{goal||'-'}</span></div>
            <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:'3px', height:'4px', marginTop:'4px', overflow:'hidden' }}>
              <div style={{ width:Math.min(pct(val,Math.max(goal,1)),100)+'%', height:'100%', background:col }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'10px' }}>
        <span style={{ fontSize:'11.5px', color:C.sub }}>내 세부활동 {myActs.length}건 · 성공 {myActs.filter(a=>a.activity_status==='성공').length}건</span>
        <span style={{ fontSize:'12px', fontWeight:'800', color:C.red }}>+ 활동 입력 ›</span>
      </div>
    </div>
  )
}

// 세부활동 입력 모달 (UIT 우선 + 상권통 동일 항목)
function ActivityModal({ strategy, editAct, mmInfo, onClose, onSaved }) {
  const [f, setF] = useState(editAct ? {
    customer: editAct.customer||'', address: editAct.address||'', contact: editAct.contact||'',
    u_new: editAct.u_new||0, u_mnp: editAct.u_mnp||0, i_count: editAct.i_count||0, t_count: editAct.t_count||0,
    activity_status: editAct.activity_status||'미처리', activity_result: editAct.activity_result||'',
    activity_memo: editAct.activity_memo||'', activation_date: editAct.activation_date||'',
    circuit_number: editAct.circuit_number||'', agency_type: editAct.agency_type||'', agency_name: editAct.agency_name||''
  } : {
    customer:'', address:'', contact:'', u_new:0, u_mnp:0, i_count:0, t_count:0,
    activity_status:'미처리', activity_result:'', activity_memo:'', activation_date:'', circuit_number:'', agency_type:'', agency_name:''
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const num = (k) => (
    <div style={{ flex:1 }}>
      <input type="number" inputMode="numeric" value={f[k]||0} onChange={e=>set(k,parseInt(e.target.value)||0)}
        style={{ ...IS, textAlign:'center', fontWeight:'800', padding:'11px 8px' }} />
    </div>
  )
  const handleSave = async () => {
    if (!f.customer.trim() && !f.address.trim()) { alert('고객/업체명 또는 주소를 입력하세요'); return }
    setSaving(true)
    // U/I/T → won_products 포맷으로도 저장 (상권통 집계 호환)
    const wp = {}
    if (f.u_new+f.u_mnp>0) wp['모바일'] = f.u_new + f.u_mnp
    if (f.i_count>0) wp['인터넷'] = f.i_count
    if (f.t_count>0) wp['TV-M'] = f.t_count
    const row = {
      strategy_id: strategy.id, mm_username: mmInfo.username, mm_name: mmInfo.name, team_id: mmInfo.team_id||'',
      customer: f.customer.trim(), address: f.address.trim(), contact: f.contact.trim(),
      u_new: f.u_new, u_mnp: f.u_mnp, i_count: f.i_count, t_count: f.t_count,
      activity_status: f.activity_status, activity_result: f.activity_result, activity_memo: f.activity_memo,
      won_products: JSON.stringify(wp), activation_date: f.activation_date, circuit_number: f.circuit_number,
      agency_type: f.agency_type, agency_name: f.agency_name, activity_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
    try {
      if (editAct) await db.patch('uturn_activities', 'id=eq.'+editAct.id, row)
      else await db.post('uturn_activities', row)
      onSaved()
    } catch(e) { alert('저장 실패: '+e.message); setSaving(false) }
  }
  const lbl = (txt,col) => <div style={{ fontSize:'12px', fontWeight:'700', color:col||C.sub, marginBottom:'5px' }}>{txt}</div>
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1001, display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#0f1a30', borderRadius:'20px 20px 0 0', padding:'20px 18px 32px', width:'100%', maxWidth:'480px', maxHeight:'94vh', overflowY:'auto', position:'relative', border:'1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'14px', right:'14px', background:'rgba(255,255,255,0.1)', border:'none', color:C.text, width:'28px', height:'28px', borderRadius:'50%', fontSize:'16px', cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:'17px', fontWeight:'900', color:C.text, marginBottom:'2px' }}>{editAct?'✏️ 세부활동 수정':'➕ 세부활동 입력'}</div>
        <div style={{ fontSize:'12.5px', color:C.red, fontWeight:'700', marginBottom:'16px' }}>{strategy.title}</div>

        {/* 대상 정보 */}
        {lbl('고객/업체명')}
        <input value={f.customer} onChange={e=>set('customer',e.target.value)} placeholder="예: OO상가 김사장" style={{ ...IS, marginBottom:'10px' }} />
        {lbl('주소')}
        <input value={f.address} onChange={e=>set('address',e.target.value)} placeholder="예: 부산 사하구 ..." style={{ ...IS, marginBottom:'10px' }} />
        {lbl('연락처')}
        <input value={f.contact} onChange={e=>set('contact',e.target.value)} placeholder="010-..." style={{ ...IS, marginBottom:'16px' }} />

        {/* UIT 성과 — 우선 항목 */}
        <div style={{ background:'rgba(227,25,55,0.08)', border:'1px solid rgba(227,25,55,0.3)', borderRadius:'12px', padding:'13px', marginBottom:'16px' }}>
          <div style={{ fontSize:'13px', fontWeight:'900', color:'#ff5a6e', marginBottom:'10px' }}>⤴ UIT 성과 <span style={{ fontWeight:'400', color:C.sub, fontSize:'11px' }}>· 기변은 실적 제외</span></div>
          <div style={{ marginBottom:'10px' }}>
            {lbl('U · USIM (신규 / MNP)', C.u)}
            <div style={{ display:'flex', gap:'8px' }}>
              <div style={{ flex:1 }}><div style={{ fontSize:'10.5px', color:C.sub, textAlign:'center', marginBottom:'3px' }}>신규</div>{num('u_new')}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:'10.5px', color:C.sub, textAlign:'center', marginBottom:'3px' }}>MNP</div>{num('u_mnp')}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <div style={{ flex:1 }}>{lbl('I · 인터넷', C.i)}{num('i_count')}</div>
            <div style={{ flex:1 }}>{lbl('T · TV', C.t)}{num('t_count')}</div>
          </div>
        </div>

        {/* 활동 상태 */}
        {lbl('활동 상태')}
        <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
          {ST.map(s=>{ const c=SC[s]; const on=f.activity_status===s; return (
            <button key={s} onClick={()=>set('activity_status',s)} style={{ flex:1, padding:'10px 4px', background:on?c.bg:'rgba(255,255,255,0.04)', border:'1.5px solid '+(on?c.bd:'rgba(255,255,255,0.1)'), color:on?c.text:C.sub, borderRadius:'9px', fontSize:'13px', fontWeight:on?'800':'500', cursor:'pointer', fontFamily:'inherit' }}>{s}</button>
          )})}
        </div>

        {/* 성공 시 추가 */}
        {f.activity_status==='성공' && (
          <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
            <div style={{ flex:1 }}>{lbl('개통일')}<input value={f.activation_date} onChange={e=>set('activation_date',e.target.value)} placeholder="2026-07-06" style={IS} /></div>
            <div style={{ flex:1 }}>{lbl('회선번호')}<input value={f.circuit_number} onChange={e=>set('circuit_number',e.target.value)} placeholder="회선번호" style={IS} /></div>
          </div>
        )}

        {lbl('활동 결과')}
        <input value={f.activity_result} onChange={e=>set('activity_result',e.target.value)} placeholder="예: MNP 3회선 계약" style={{ ...IS, marginBottom:'10px' }} />
        {lbl('메모 (선택)')}
        <textarea value={f.activity_memo} onChange={e=>set('activity_memo',e.target.value)} rows={2} placeholder="추가 메모" style={{ ...IS, resize:'vertical', minHeight:'54px', marginBottom:'10px' }} />

        {/* 대리점 (선택) */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
          <div style={{ flex:1 }}>{lbl('대리점 유형 (선택)')}<input value={f.agency_type} onChange={e=>set('agency_type',e.target.value)} placeholder="유통/유선" style={IS} /></div>
          <div style={{ flex:1 }}>{lbl('대리점명 (선택)')}<input value={f.agency_name} onChange={e=>set('agency_name',e.target.value)} placeholder="대리점명" style={IS} /></div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width:'100%', padding:'15px', background:saving?'rgba(255,255,255,0.1)':C.red, border:'none', color:'#fff', borderRadius:'12px', fontSize:'16px', fontWeight:'900', cursor:saving?'wait':'pointer', fontFamily:'inherit' }}>
          {saving?'저장 중...':(editAct?'수정 저장':'세부활동 저장')}
        </button>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──
export default function UturnMember({ mmInfo, onBack }) {
  const [tab, setTab] = useState('strategies')  // strategies | myperf
  const [strategies, setStrategies] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [openStrategy, setOpenStrategy] = useState(null)   // 상세 보기
  const [actModal, setActModal] = useState(null)           // {strategy, editAct}
  const [toast, setToast] = useState('')

  const t2 = m => { setToast(m); setTimeout(()=>setToast(''),2500) }
  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      // 내 팀 또는 나에게 배분된 전략 + 내 세부활동
      const [str, act] = await Promise.all([
        db.get('uturn_strategies', 'select=*&order=created_at.desc&limit=300').catch(()=>[]),
        db.get('uturn_activities', 'select=*&mm_username=eq.'+mmInfo.username+'&order=created_at.desc&limit=500').catch(()=>[])
      ])
      // 내 팀(team_id) 대상 or 나 지정(assigned_to) 전략만
      const mine = (str||[]).filter(s =>
        (!s.team_id || s.team_id === mmInfo.team_id) &&
        (!s.assigned_to || s.assigned_to === mmInfo.name)
      )
      setStrategies(mine); setActivities(act||[])
    } catch(e) { t2('로드 오류') }
    setLoading(false)
  }
  const handleDeleteAct = async (a) => {
    if (!window.confirm('이 세부활동을 삭제하시겠습니까?')) return
    try { await db.del('uturn_activities', 'id=eq.'+a.id); setActivities(p=>p.filter(x=>x.id!==a.id)); t2('삭제 완료') } catch { t2('삭제 실패') }
  }

  // 내 UIT 누적
  const myU = activities.reduce((x,a)=>x+(a.u_new||0)+(a.u_mnp||0),0)
  const myI = activities.reduce((x,a)=>x+(a.i_count||0),0)
  const myT = activities.reduce((x,a)=>x+(a.t_count||0),0)
  const myScore = myU*1.5 + myI + myT

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(165deg,#0a0e1a 0%,#0f1a30 45%,#1a0e18 100%)', color:C.text, fontFamily:"'Noto Sans KR',sans-serif", paddingBottom:'40px' }}>
      {toast && <div style={{ position:'fixed', top:'18px', left:'50%', transform:'translateX(-50%)', background:'#1e293b', color:'#fff', padding:'11px 24px', borderRadius:'12px', zIndex:1002, fontSize:'14px', fontWeight:'700', boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</div>}

      {actModal && <ActivityModal strategy={actModal.strategy} editAct={actModal.editAct} mmInfo={mmInfo} onClose={()=>setActModal(null)} onSaved={()=>{ setActModal(null); t2('저장 완료!'); load() }} />}

      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 18px 12px' }}>
        <button onClick={onBack} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:C.text, fontSize:'14px', padding:'7px 13px', borderRadius:'9px', cursor:'pointer', fontFamily:'inherit' }}>‹ 홈</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'16px', fontWeight:'900', color:'#ff5a6e' }}>⤴ U-TURN</div>
          <div style={{ fontSize:'11px', color:C.sub }}>{mmInfo.name} · {mmInfo.region||'팀원'}</div>
        </div>
        <button onClick={load} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:C.text, fontSize:'15px', padding:'7px 11px', borderRadius:'9px', cursor:'pointer' }}>🔄</button>
      </div>

      {/* 내 UIT 요약 */}
      <div style={{ maxWidth:'440px', margin:'0 auto', padding:'0 16px' }}>
        <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'16px', padding:'14px', marginBottom:'14px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
            <span style={{ fontSize:'13px', fontWeight:'800', color:C.text }}>내 UIT 누적</span>
            <span style={{ fontSize:'13px', fontWeight:'900', color:'#ff5a6e' }}>스코어 {Math.round(myScore)}</span>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {[['U · 신규·MNP',myU,C.u],['I · 인터넷',myI,C.i],['T · TV',myT,C.t]].map(([lb,v,col])=>(
              <div key={lb} style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                <div style={{ fontSize:'22px', fontWeight:'900', color:col }}>{v}</div>
                <div style={{ fontSize:'10px', color:C.sub, marginTop:'2px' }}>{lb}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
          {[['strategies','🎯 내 전략활동'],['myperf','📋 내 활동내역']].map(([id,lb])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:'11px', background:tab===id?'rgba(227,25,55,0.15)':'rgba(255,255,255,0.04)', border:'1.5px solid '+(tab===id?'rgba(227,25,55,0.4)':C.border), color:tab===id?'#ff5a6e':C.sub, borderRadius:'11px', fontSize:'14px', fontWeight:tab===id?'800':'500', cursor:'pointer', fontFamily:'inherit' }}>{lb}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign:'center', padding:'40px', color:C.sub }}>불러오는 중...</div>}

        {/* 전략활동 목록 */}
        {!loading && tab==='strategies' && (<>
          {strategies.length===0
            ? <div style={{ textAlign:'center', padding:'50px 20px', color:C.sub }}>
                <div style={{ fontSize:'38px', marginBottom:'10px' }}>🎯</div>
                <div style={{ fontSize:'15px', fontWeight:'700' }}>배분된 전략활동이 없습니다</div>
                <div style={{ fontSize:'12.5px', marginTop:'4px' }}>관리자가 전략활동을 배분하면 여기에 표시됩니다</div>
              </div>
            : strategies.map(s => <StrategyCard key={s.id} s={s} acts={activities} onOpen={(st)=>setOpenStrategy(st)} />)
          }
        </>)}

        {/* 내 활동내역 */}
        {!loading && tab==='myperf' && (<>
          {activities.length===0
            ? <div style={{ textAlign:'center', padding:'50px 20px', color:C.sub }}>입력한 세부활동이 없습니다</div>
            : activities.map(a => {
              const c = SC[a.activity_status]||SC['미처리']
              const strat = strategies.find(s=>s.id===a.strategy_id)
              return (
                <div key={a.id} style={{ background:C.card, border:'1px solid '+C.border, borderLeft:'4px solid '+c.text, borderRadius:'13px', padding:'13px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'5px' }}>
                    <div style={{ fontSize:'14px', fontWeight:'800', color:C.text }}>{a.customer||a.address||'-'}</div>
                    <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'10px', background:c.bg, color:c.text, border:'1px solid '+c.bd }}>{a.activity_status}</span>
                  </div>
                  {strat && <div style={{ fontSize:'11px', color:'#ff5a6e', marginBottom:'4px' }}>🎯 {strat.title}</div>}
                  {a.address && a.address!==a.customer && <div style={{ fontSize:'12px', color:C.sub }}>📍 {a.address}</div>}
                  <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
                    {(a.u_new+a.u_mnp)>0 && <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 9px', borderRadius:'8px', background:'rgba(192,132,252,0.15)', color:C.u }}>U {a.u_new+a.u_mnp} (신규{a.u_new}/MNP{a.u_mnp})</span>}
                    {a.i_count>0 && <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 9px', borderRadius:'8px', background:'rgba(96,165,250,0.15)', color:C.i }}>I {a.i_count}</span>}
                    {a.t_count>0 && <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 9px', borderRadius:'8px', background:'rgba(251,191,36,0.15)', color:C.t }}>T {a.t_count}</span>}
                  </div>
                  {a.activity_result && <div style={{ fontSize:'12px', color:C.sub, marginTop:'6px' }}>📝 {a.activity_result}</div>}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px' }}>
                    <span style={{ fontSize:'11px', color:C.sub }}>{fmtAt(a.activity_at||a.created_at)}</span>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={()=>{ const s=strategies.find(x=>x.id===a.strategy_id)||{id:a.strategy_id,title:'(전략)'}; setActModal({strategy:s,editAct:a}) }} style={{ background:'none', border:'none', color:C.i, fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>수정</button>
                      <button onClick={()=>handleDeleteAct(a)} style={{ background:'none', border:'none', color:C.sub, fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>삭제</button>
                    </div>
                  </div>
                </div>
              )
            })
          }
        </>)}
      </div>

      {/* 전략 상세 → 세부활동 목록 + 입력 */}
      {openStrategy && (() => {
        const s = openStrategy
        const myActs = activities.filter(a=>a.strategy_id===s.id)
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(4px)' }}>
            <div style={{ background:'#0f1a30', borderRadius:'20px 20px 0 0', padding:'20px 18px 32px', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflowY:'auto', position:'relative', border:'1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={()=>setOpenStrategy(null)} style={{ position:'absolute', top:'14px', right:'14px', background:'rgba(255,255,255,0.1)', border:'none', color:C.text, width:'28px', height:'28px', borderRadius:'50%', fontSize:'16px', cursor:'pointer' }}>✕</button>
              <div style={{ fontSize:'11px', color:'#ff5a6e', fontWeight:'700', marginBottom:'3px' }}>🎯 전략활동</div>
              <div style={{ fontSize:'18px', fontWeight:'900', color:C.text, marginBottom:'4px' }}>{s.title}</div>
              {s.description && <div style={{ fontSize:'13px', color:C.sub, marginBottom:'12px', lineHeight:1.5 }}>{s.description}</div>}
              <button onClick={()=>{ setOpenStrategy(null); setActModal({strategy:s,editAct:null}) }} style={{ width:'100%', padding:'13px', background:C.red, border:'none', color:'#fff', borderRadius:'11px', fontSize:'15px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit', marginBottom:'16px' }}>➕ 세부활동 입력</button>
              <div style={{ fontSize:'13px', fontWeight:'800', color:C.text, marginBottom:'8px' }}>내 세부활동 ({myActs.length})</div>
              {myActs.length===0
                ? <div style={{ textAlign:'center', padding:'20px', color:C.sub, fontSize:'13px' }}>아직 입력한 활동이 없습니다</div>
                : myActs.map(a=>{ const c=SC[a.activity_status]||SC['미처리']; return (
                  <div key={a.id} onClick={()=>{ setOpenStrategy(null); setActModal({strategy:s,editAct:a}) }} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid '+C.border, borderRadius:'11px', padding:'11px', marginBottom:'8px', cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'13px', fontWeight:'700', color:C.text }}>{a.customer||a.address||'-'}</span>
                      <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'9px', background:c.bg, color:c.text }}>{a.activity_status}</span>
                    </div>
                    <div style={{ display:'flex', gap:'5px', marginTop:'5px', flexWrap:'wrap' }}>
                      {(a.u_new+a.u_mnp)>0 && <span style={{ fontSize:'10px', color:C.u }}>U{a.u_new+a.u_mnp}</span>}
                      {a.i_count>0 && <span style={{ fontSize:'10px', color:C.i }}>I{a.i_count}</span>}
                      {a.t_count>0 && <span style={{ fontSize:'10px', color:C.t }}>T{a.t_count}</span>}
                    </div>
                  </div>
                )})
              }
            </div>
          </div>
        )
      })()}
    </div>
  )
}
