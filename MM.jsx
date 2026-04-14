import { useState } from 'react'
import { dbGet, dbPost, dbPatch } from './supabase'

const PRODUCTS = ['인터넷','TV','다량회선','모바일','일반전화']
const LEVELS = [
  { lv:1, name:'새싹', min:0, max:4, color:'#4ade80', icon:'🌱' },
  { lv:2, name:'성장', min:5, max:9, color:'#60a5fa', icon:'🌿' },
  { lv:3, name:'활발', min:10, max:19, color:'#f59e0b', icon:'⭐' },
  { lv:4, name:'전문가', min:20, max:34, color:'#f97316', icon:'🔥' },
  { lv:5, name:'마스터', min:35, max:999, color:'#a78bfa', icon:'👑' },
]

function getLv(n) { return LEVELS.find(l => n>=l.min && n<=l.max) || LEVELS[0] }

function Badge({ s }) {
  const m = { '미처리':{bg:'#2d1d00',t:'#fbbf24',b:'#451a03'}, '접촉완료':{bg:'#1e3a5f',t:'#93c5fd',b:'#1e4976'}, '성공':{bg:'#052e16',t:'#4ade80',b:'#14532d'}, '실패':{bg:'#1f0505',t:'#f87171',b:'#450a0a'} }
  const c = m[s] || m['미처리']
  return <span style={{ background:c.bg, color:c.t, border:'1px solid '+c.b, fontSize:'12px', fontWeight:'700', padding:'4px 10px', borderRadius:'20px', whiteSpace:'nowrap' }}>{s}</span>
}

export default function MM() {
  const [screen, setScreen] = useState('login')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState(''); const [lding, setLding] = useState(false)
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('home')
  const [leadTab, setLeadTab] = useState('connector')
  const [cLeads, setCLeads] = useState([])
  const [mLeads, setMLeads] = useState([])
  const [rm, setRm] = useState(null)
  const [rf, setRf] = useState({ status:'미처리', result:'', memo:'' })
  const [reg, setReg] = useState({ customer:'', address:'', products:[] })
  const [regDone, setRegDone] = useState(false)
  const [toast, setToast] = useState('')

  function t2(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function handleLogin() {
    if (!lid||!lpw) { setLerr('아이디와 비밀번호를 입력하세요'); return }
    setLding(true); setLerr('')
    try {
      const users = await dbGet('mm_users', 'username=eq.'+lid+'&password=eq.'+lpw)
      if (!users.length) { setLerr('아이디 또는 비밀번호가 올바르지 않습니다'); setLding(false); return }
      const u = users[0]
      const [cl, ml] = await Promise.all([
        dbGet('connector_leads', 'assigned_to=eq.'+encodeURIComponent(u.name)),
        dbGet('mm_direct_leads', 'mm_username=eq.'+u.username+'&order=created_at.desc')
      ])
      setCLeads(cl); setMLeads(ml); setUser(u); setScreen('main')
    } catch(e) { setLerr('연결 오류: ' + e.message) }
    setLding(false)
  }

  async function saveResult() {
    if (!rm) return
    const src = rm._src
    try {
      if (src==='c') {
        await dbPatch('connector_leads','id=eq.'+rm.id,{activity_status:rf.status,activity_result:rf.result,activity_memo:rf.memo})
        const updated = cLeads.map(l => l.id===rm.id?{...l,activity_status:rf.status,activity_result:rf.result,activity_memo:rf.memo}:l)
        setCLeads(updated)
        const sc = updated.filter(l=>l.activity_status==='성공').length + mLeads.filter(l=>l.activity_status==='성공').length
        await dbPatch('mm_users','id=eq.'+user.id,{success:sc})
        setUser({...user,success:sc})
      } else {
        await dbPatch('mm_direct_leads','id=eq.'+rm.id,{activity_status:rf.status,activity_result:rf.result,activity_memo:rf.memo})
        const updated = mLeads.map(l => l.id===rm.id?{...l,activity_status:rf.status,activity_result:rf.result,activity_memo:rf.memo}:l)
        setMLeads(updated)
        const sc = cLeads.filter(l=>l.activity_status==='성공').length + updated.filter(l=>l.activity_status==='성공').length
        await dbPatch('mm_users','id=eq.'+user.id,{success:sc})
        setUser({...user,success:sc})
      }
      setRm(null); t2('활동 결과 저장 완료!')
    } catch(e) { t2('저장 실패: '+e.message) }
  }

  async function handleReg() {
    if (!reg.customer||!reg.products.length) return
    const newLead = { id:'m'+Date.now(), mm_username:user.username, customer:reg.customer, address:reg.address, products:reg.products, activity_status:'미처리', activity_result:'', activity_memo:'' }
    try {
      await dbPost('mm_direct_leads', newLead)
      setMLeads([newLead,...mLeads])
      setRegDone(true); t2('영업기회 등록 완료!')
      setTimeout(()=>{setRegDone(false);setReg({customer:'',address:'',products:[]});setTab('leads');setLeadTab('my')},1800)
    } catch(e) { t2('등록 실패: '+e.message) }
  }

  function toggleP(p) { setReg({...reg,products:reg.products.includes(p)?reg.products.filter(x=>x!==p):[...reg.products,p]}) }

  const sc = user?.success || 0
  const goal = user?.goal || 10
  const lv = getLv(sc)
  const nextLv = LEVELS.find(l => l.lv===lv.lv+1)
  const unproc = cLeads.filter(l=>(l.activity_status||'미처리')==='미처리').length

  const S = { bg:'#0c1524', card:'#131e30', border:'#1e3050', accent:'#4ade80', text:'#f1f5f9', sub:'#94a3b8' }
  const navTabs = [{id:'home',label:'홈',icon:'🏠'},{id:'leads',label:'영업기회',icon:'📋'},{id:'register',label:'직접등록',icon:'➕'},{id:'growth',label:'내 성장',icon:'📈'}]

  if (screen==='login') return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#0c1524,#091809)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'30px 24px', fontFamily:"'Noto Sans KR',sans-serif", color:S.text }}>
      <a href="#" style={{ color:'#64748b', fontSize:'13px', marginBottom:'24px', textDecoration:'none' }}>← 홈으로</a>
      <div style={{ textAlign:'center', marginBottom:'32px' }}>
        <div style={{ background:S.accent, color:'#0c1524', fontWeight:'900', fontSize:'14px', padding:'4px 14px', borderRadius:'4px', display:'inline-block', marginBottom:'12px' }}>상권통</div>
        <h1 style={{ fontSize:'28px', fontWeight:'900', margin:'0 0 8px' }}>상권마스터 플랫폼</h1>
        <p style={{ color:S.sub, fontSize:'15px', margin:0 }}>MM 전용 로그인</p>
      </div>
      <div style={{ width:'100%', maxWidth:'360px', display:'flex', flexDirection:'column', gap:'14px' }}>
        <input type="text" placeholder="아이디" value={lid} onChange={e=>{setLid(e.target.value);setLerr('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{ width:'100%', background:S.card, border:'1px solid '+S.border, color:S.text, padding:'20px', borderRadius:'12px', fontSize:'22px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
        <input type="password" placeholder="비밀번호" value={lpw} onChange={e=>{setLpw(e.target.value);setLerr('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{ width:'100%', background:S.card, border:'1px solid '+S.border, color:S.text, padding:'20px', borderRadius:'12px', fontSize:'22px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
        {lerr && <div style={{ color:'#f87171', fontSize:'15px', textAlign:'center', background:'rgba(248,113,113,0.1)', padding:'12px', borderRadius:'8px' }}>{lerr}</div>}
        <button onClick={handleLogin} disabled={lding} style={{ background:lding?'#1e293b':S.accent, border:'none', color:lding?'#475569':'#0c1524', padding:'20px', borderRadius:'12px', fontSize:'20px', fontWeight:'900', cursor:lding?'not-allowed':'pointer', fontFamily:'inherit' }}>{lding?'로그인 중...':'로그인'}</button>
      </div>
      <p style={{ color:'#475569', fontSize:'14px', marginTop:'24px', textAlign:'center' }}>계정이 없으신가요?<br/>커낵터 관리자에게 문의하세요</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.bg, color:S.text, fontFamily:"'Noto Sans KR',sans-serif", maxWidth:'420px', margin:'0 auto', display:'flex', flexDirection:'column' }}>
      {toast && <div style={{ position:'fixed', top:'16px', left:'50%', transform:'translateX(-50%)', background:'#052e16', border:'1px solid #4ade80', color:'#4ade80', padding:'12px 22px', borderRadius:'40px', fontSize:'15px', fontWeight:'700', zIndex:9999, whiteSpace:'nowrap' }}>✅ {toast}</div>}

      {rm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:S.card, borderRadius:'16px 16px 0 0', padding:'24px 20px 32px', width:'100%', maxWidth:'420px' }}>
            <h3 style={{ fontSize:'18px', fontWeight:'900', marginBottom:'4px' }}>활동 결과 입력</h3>
            <p style={{ color:S.sub, fontSize:'14px', marginBottom:'16px' }}>{rm._src==='c'?rm.address:rm.customer}</p>
            <div style={{ marginBottom:'14px' }}>
              <div style={{ fontSize:'15px', fontWeight:'700', marginBottom:'8px' }}>방문 상태</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {['미처리','접촉완료','성공','실패'].map(s => (
                  <button key={s} onClick={()=>setRf({...rf,status:s})} style={{ padding:'11px 18px', background:rf.status===s?S.accent:'transparent', border:rf.status===s?'none':'1px solid '+S.border, color:rf.status===s?'#0c1524':S.sub, borderRadius:'8px', fontSize:'15px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'15px', fontWeight:'700', marginBottom:'6px' }}>결과 요약</div>
              <input type="text" placeholder="예: 계약완료, 재방문 예정" value={rf.result} onChange={e=>setRf({...rf,result:e.target.value})} style={{ width:'100%', background:S.bg, border:'1px solid '+S.border, color:S.text, padding:'13px', borderRadius:'8px', fontSize:'16px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
            </div>
            <div style={{ marginBottom:'18px' }}>
              <div style={{ fontSize:'15px', fontWeight:'700', marginBottom:'6px' }}>메모</div>
              <textarea placeholder="특이사항, 다음 액션 등" value={rf.memo} onChange={e=>setRf({...rf,memo:e.target.value})} rows={3} style={{ width:'100%', background:S.bg, border:'1px solid '+S.border, color:S.text, padding:'13px', borderRadius:'8px', fontSize:'15px', outline:'none', boxSizing:'border-box', fontFamily:'inherit', resize:'none' }} />
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={()=>setRm(null)} style={{ flex:1, padding:'14px', background:'transparent', border:'1px solid '+S.border, color:S.sub, borderRadius:'10px', fontSize:'16px', cursor:'pointer', fontFamily:'inherit' }}>취소</button>
              <button onClick={saveResult} style={{ flex:2, padding:'14px', background:S.accent, border:'none', color:'#0c1524', borderRadius:'10px', fontSize:'16px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit' }}>저장하기</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background:'linear-gradient(135deg,#091809,#0c1524)', padding:'18px 20px 14px', borderBottom:'3px solid '+S.accent }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
              <span style={{ background:S.accent, color:'#0c1524', fontWeight:'900', fontSize:'11px', padding:'3px 8px', borderRadius:'4px' }}>상권통</span>
              <span style={{ color:S.accent, fontWeight:'900', fontSize:'16px' }}>상권마스터 플랫폼</span>
            </div>
            <div style={{ color:S.sub, fontSize:'16px' }}>
              <strong style={{ color:S.text, fontSize:'18px' }}>{user?.name}</strong> MM
              <span style={{ color:'#64748b', fontSize:'13px', marginLeft:'8px' }}>{user?.region}</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
            <div style={{ background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.4)', borderRadius:'10px', padding:'8px 12px', textAlign:'center' }}>
              <div style={{ fontSize:'18px' }}>{lv.icon}</div>
              <div style={{ fontSize:'12px', fontWeight:'900', color:lv.color }}>{lv.name}</div>
            </div>
            <button onClick={()=>{setScreen('login');setUser(null)}} style={{ background:'transparent', border:'none', color:'#475569', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>로그아웃</button>
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'18px' }}>
        {tab==='home' && (
          <div>
            <div style={{ background:'rgba(74,222,128,0.06)', border:'2px solid '+lv.color, borderRadius:'14px', padding:'18px', marginBottom:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                <div style={{ fontSize:'42px' }}>{lv.icon}</div>
                <div>
                  <div style={{ fontSize:'13px', color:S.sub }}>현재 레벨</div>
                  <div style={{ fontSize:'26px', fontWeight:'900', color:lv.color }}>Lv.{lv.lv} {lv.name}</div>
                </div>
              </div>
              {nextLv && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                    <span style={{ fontSize:'14px', color:S.sub }}>다음 레벨까지</span>
                    <span style={{ fontSize:'15px', fontWeight:'800', color:lv.color }}>{nextLv.min-sc}건 남음</span>
                  </div>
                  <div style={{ background:'#1e293b', borderRadius:'4px', height:'10px', overflow:'hidden' }}>
                    <div style={{ width:Math.min(((sc-lv.min)/Math.max(lv.max-lv.min,1))*100,100)+'%', background:lv.color, height:'100%', borderRadius:'4px' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
              {[{l:'커낵터 배분',v:cLeads.length,c:'#60a5fa'},{l:'직접 발굴',v:mLeads.length,c:S.accent},{l:'전체 성공',v:sc,c:lv.color},{l:'이달 목표',v:goal,c:'#f59e0b'}].map((s,i) => (
                <div key={i} style={{ background:S.card, border:'1px solid '+S.border, borderRadius:'10px', padding:'14px', textAlign:'center' }}>
                  <div style={{ fontSize:'28px', fontWeight:'900', color:s.c }}>{s.v}<span style={{ fontSize:'14px' }}>건</span></div>
                  <div style={{ fontSize:'13px', color:S.sub, marginTop:'4px' }}>{s.l}</div>
                </div>
              ))}
            </div>
            {unproc>0 && (
              <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:'12px', padding:'14px 16px' }}>
                <div style={{ fontSize:'16px', fontWeight:'800', color:'#f59e0b', marginBottom:'8px' }}>⚠️ 미처리 기회 {unproc}건</div>
                <button onClick={()=>{setTab('leads');setLeadTab('connector')}} style={{ background:'#f59e0b', border:'none', color:'#0c1524', padding:'10px 20px', borderRadius:'8px', fontSize:'15px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit' }}>확인하기 →</button>
              </div>
            )}
          </div>
        )}

        {tab==='leads' && (
          <div>
            <h2 style={{ fontSize:'20px', fontWeight:'900', marginBottom:'14px' }}>영업기회 관리</h2>
            <div style={{ display:'flex', background:S.bg, borderRadius:'10px', padding:'4px', marginBottom:'16px', border:'1px solid '+S.border }}>
              <button onClick={()=>setLeadTab('connector')} style={{ flex:1, padding:'11px', background:leadTab==='connector'?'#60a5fa':'transparent', color:leadTab==='connector'?'#0c1524':S.sub, border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>📤 커낵터 ({cLeads.length})</button>
              <button onClick={()=>setLeadTab('my')} style={{ flex:1, padding:'11px', background:leadTab==='my'?S.accent:'transparent', color:leadTab==='my'?'#0c1524':S.sub, border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>🔍 직접발굴 ({mLeads.length})</button>
            </div>
            {leadTab==='connector' && (cLeads.length===0
              ? <div style={{ textAlign:'center', padding:'40px', color:'#475569', fontSize:'16px' }}>배분된 기회가 없습니다</div>
              : cLeads.map(l => (
                <div key={l.id} style={{ background:S.card, border:'1px solid '+S.border, borderLeft:'3px solid #60a5fa', borderRadius:'10px', padding:'14px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                    <div style={{ flex:1, marginRight:'8px' }}>
                      <div style={{ fontSize:'12px', color:'#60a5fa', fontWeight:'700', marginBottom:'4px' }}>📤 커낵터 배분</div>
                      <div style={{ fontSize:'15px', fontWeight:'800', lineHeight:'1.4' }}>{l.address}</div>
                      <div style={{ color:S.sub, fontSize:'13px', marginTop:'3px' }}>{l.area}㎡ · {l.usage_type} · {l.start_date}</div>
                    </div>
                    <Badge s={l.activity_status||'미처리'} />
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'10px' }}>
                    {l.products?.map(p => <span key={p} style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', fontSize:'12px', fontWeight:'700', padding:'3px 9px', borderRadius:'4px' }}>{p}</span>)}
                  </div>
                  {l.activity_memo && <div style={{ background:S.bg, borderRadius:'6px', padding:'8px', marginBottom:'10px', fontSize:'13px', color:S.sub }}>💬 {l.activity_memo}</div>}
                  <button onClick={()=>{setRm({...l,_src:'c'});setRf({status:l.activity_status||'미처리',result:l.activity_result||'',memo:l.activity_memo||''})}} style={{ width:'100%', background:'transparent', border:'1px solid #60a5fa', color:'#60a5fa', padding:'10px', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>활동 결과 입력</button>
                </div>
              ))
            )}
            {leadTab==='my' && (mLeads.length===0
              ? <div style={{ textAlign:'center', padding:'40px', color:'#475569', fontSize:'16px' }}>직접 등록한 기회가 없습니다<br/><span style={{ fontSize:'14px' }}>+ 탭에서 등록하세요</span></div>
              : mLeads.map(l => (
                <div key={l.id} style={{ background:S.card, border:'1px solid '+S.border, borderLeft:'3px solid '+S.accent, borderRadius:'10px', padding:'14px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                    <div style={{ flex:1, marginRight:'8px' }}>
                      <div style={{ fontSize:'12px', color:S.accent, fontWeight:'700', marginBottom:'4px' }}>🔍 직접 발굴</div>
                      <div style={{ fontSize:'16px', fontWeight:'800' }}>{l.customer}</div>
                      <div style={{ color:S.sub, fontSize:'13px', marginTop:'2px' }}>{l.address}</div>
                    </div>
                    <Badge s={l.activity_status||'미처리'} />
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'10px' }}>
                    {l.products?.map(p => <span key={p} style={{ background:'rgba(74,222,128,0.15)', color:S.accent, border:'1px solid rgba(74,222,128,0.3)', fontSize:'12px', fontWeight:'700', padding:'3px 9px', borderRadius:'4px' }}>{p}</span>)}
                  </div>
                  {l.activity_memo && <div style={{ background:S.bg, borderRadius:'6px', padding:'8px', marginBottom:'10px', fontSize:'13px', color:S.sub }}>💬 {l.activity_memo}</div>}
                  <button onClick={()=>{setRm({...l,_src:'m'});setRf({status:l.activity_status||'미처리',result:l.activity_result||'',memo:l.activity_memo||''})}} style={{ width:'100%', background:'transparent', border:'1px solid '+S.accent, color:S.accent, padding:'10px', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>활동 결과 입력</button>
                </div>
              ))
            )}
          </div>
        )}

        {tab==='register' && (
          <div>
            <h2 style={{ fontSize:'20px', fontWeight:'900', marginBottom:'18px' }}>직접 발굴 등록</h2>
            {regDone
              ? <div style={{ textAlign:'center', padding:'50px 20px', background:'rgba(5,46,22,0.4)', border:'1px solid #14532d', borderRadius:'14px' }}><div style={{ fontSize:'54px', marginBottom:'12px' }}>✅</div><div style={{ fontSize:'22px', fontWeight:'900', color:S.accent }}>등록 완료!</div></div>
              : <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
                  <div>
                    <label style={{ fontSize:'16px', color:S.sub, fontWeight:'700', display:'block', marginBottom:'8px' }}>고객명 <span style={{ color:'#ef4444' }}>*</span></label>
                    <input type="text" placeholder="예: 행복분식, 우리빌딩" value={reg.customer} onChange={e=>setReg({...reg,customer:e.target.value})} style={{ width:'100%', background:S.card, border:'1px solid '+S.border, color:S.text, padding:'16px', borderRadius:'10px', fontSize:'18px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'16px', color:S.sub, fontWeight:'700', display:'block', marginBottom:'8px' }}>주소</label>
                    <input type="text" placeholder="예: 강남구 역삼동 123" value={reg.address} onChange={e=>setReg({...reg,address:e.target.value})} style={{ width:'100%', background:S.card, border:'1px solid '+S.border, color:S.text, padding:'16px', borderRadius:'10px', fontSize:'18px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'16px', color:S.sub, fontWeight:'700', display:'block', marginBottom:'10px' }}>상품군 <span style={{ color:'#ef4444' }}>*</span> <span style={{ fontSize:'14px', color:'#64748b', fontWeight:'400' }}>(중복 선택)</span></label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                      {PRODUCTS.map(p => {
                        const sel = reg.products.includes(p)
                        return <button key={p} onClick={()=>toggleP(p)} style={{ padding:'13px 18px', background:sel?S.accent:S.card, border:sel?'none':'1px solid '+S.border, color:sel?'#0c1524':S.sub, borderRadius:'8px', fontSize:'16px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>{sel?'✓ ':''}{p}</button>
                      })}
                    </div>
                  </div>
                  <button onClick={handleReg} disabled={!reg.customer||!reg.products.length} style={{ background:reg.customer&&reg.products.length?S.accent:'#1e293b', border:'none', color:reg.customer&&reg.products.length?'#0c1524':'#475569', padding:'18px', borderRadius:'12px', fontSize:'18px', fontWeight:'900', cursor:'pointer', marginTop:'6px', fontFamily:'inherit' }}>등록하기</button>
                </div>
            }
          </div>
        )}

        {tab==='growth' && (
          <div>
            <h2 style={{ fontSize:'20px', fontWeight:'900', marginBottom:'16px' }}>내 성장 레벨</h2>
            <div style={{ background:S.card, border:'1px solid '+S.border, borderRadius:'14px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ display:'flex', alignItems:'flex-end', gap:'8px', height:'120px', justifyContent:'center' }}>
                {LEVELS.map((l,i) => {
                  const reached = sc>=l.min; const cur = lv.lv===l.lv; const h = 24+i*20
                  return (
                    <div key={l.lv} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                      <div style={{ height:'20px', display:'flex', alignItems:'center' }}>{cur&&<span style={{ fontSize:'12px', color:l.color }}>▼</span>}</div>
                      <div style={{ width:'44px', height:h+'px', background:reached?l.color:'#1e293b', borderRadius:'6px 6px 0 0', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'5px', border:cur?'2px solid '+l.color:'none' }}><span style={{ fontSize:'15px' }}>{l.icon}</span></div>
                      <div style={{ fontSize:'10px', fontWeight:'700', color:reached?l.color:'#475569' }}>Lv.{l.lv}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            {LEVELS.map(l => {
              const reached=sc>=l.min; const cur=lv.lv===l.lv
              return (
                <div key={l.lv} style={{ background:cur?'rgba(74,222,128,0.05)':S.card, border:cur?'2px solid '+l.color:'1px solid '+S.border, borderRadius:'12px', padding:'14px 16px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'26px' }}>{l.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                      <span style={{ fontSize:'17px', fontWeight:'800', color:reached?l.color:'#475569' }}>Lv.{l.lv} {l.name}</span>
                      {cur&&<span style={{ background:l.color, color:'#0c1524', fontSize:'11px', fontWeight:'900', padding:'2px 8px', borderRadius:'10px' }}>현재</span>}
                    </div>
                    <div style={{ color:'#64748b', fontSize:'13px', marginTop:'2px' }}>{l.lv<5?'성공 '+l.min+'~'+l.max+'건':'성공 '+l.min+'건 이상'}</div>
                  </div>
                  {reached&&<span style={{ fontSize:'20px' }}>✅</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ background:'#060c17', borderTop:'1px solid '+S.border, display:'flex', padding:'8px 0 6px' }}>
        {navTabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:'none', border:'none', color:tab===t.id?S.accent:'#475569', cursor:'pointer', padding:'6px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', fontFamily:'inherit' }}>
            <span style={{ fontSize:'20px' }}>{t.icon}</span>
            <span style={{ fontSize:'11px', fontWeight:tab===t.id?'800':'500' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
