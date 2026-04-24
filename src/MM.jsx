import { useState, useCallback, useRef } from 'react'
import { db } from './supabase'

const KTLogo = () => (
  <svg width="36" height="22" viewBox="0 0 80 48" fill="none">
    <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
  </svg>
)
const PRODUCTS = ['인터넷', 'TV', '다량회선', '모바일', '일반전화']
const LEVELS = [
  { lv:1, name:'새싹',   min:0,  max:4,   color:'#4ade80', icon:'🌱' },
  { lv:2, name:'성장',   min:5,  max:9,   color:'#60a5fa', icon:'🌿' },
  { lv:3, name:'활발',   min:10, max:19,  color:'#f59e0b', icon:'⭐' },
  { lv:4, name:'전문가', min:20, max:34,  color:'#f97316', icon:'🔥' },
  { lv:5, name:'마스터', min:35, max:999, color:'#a78bfa', icon:'👑' },
]
const getLv = n => LEVELS.find(l => n >= l.min && n <= l.max) || LEVELS[0]
const S  = { bg:'#06111f', card:'#0d1f35', acc:'#4ade80', text:'#f1f5f9', sub:'#8aa3bc' }
const IS = { width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.14)', color:'#f1f5f9', padding:'14px 15px', borderRadius:'11px', fontSize:'16px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
const ST = ['성공','접촉완료','미처리','실패']
const SC = {
  '성공':    {bg:'#052e16',text:'#4ade80',border:'#14532d',dot:'#4ade80'},
  '접촉완료':{bg:'#1e3a5f',text:'#93c5fd',border:'#1e4976',dot:'#60a5fa'},
  '미처리':  {bg:'#2d1d00',text:'#fbbf24',border:'#451a03',dot:'#f59e0b'},
  '실패':    {bg:'#1f0505',text:'#f87171',border:'#450a0a',dot:'#f87171'},
}
function pct(n,d){return d>0?Math.round(n/d*100):0}
function Badge({s}){const c=SC[s]||SC['미처리'];return<span style={{background:c.bg,color:c.text,border:'1px solid '+c.border,fontSize:'12px',fontWeight:'700',padding:'4px 10px',borderRadius:'20px',whiteSpace:'nowrap'}}>{s}</span>}
function fmtAt(iso){if(!iso)return'';try{const d=new Date(iso);return d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+ ' ' +d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}catch{return iso}}

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

// ── 사진 선택 컴포넌트 ────────────────────────────────────────────
function PhotoPicker({ photos, onChange, accent }) {
  const ref = useRef()
  const ac = accent || '#4ade80'

  const handleFile = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const remaining = 2 - photos.length
    const toProcess = files.slice(0, remaining)
    const compressed = await Promise.all(toProcess.map(f => compressImage(f)))
    onChange([...photos, ...compressed])
    e.target.value = ''
  }
  const remove = (i) => onChange(photos.filter((_, idx) => idx !== i))

  return (
    <div>
      <div style={{display:'flex', gap:'8px', marginBottom:'8px', flexWrap:'wrap'}}>
        {photos.map((src, i) => (
          <div key={i} style={{position:'relative', width:'80px', height:'80px', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.15)'}}>
            <img src={src} alt="사진" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
            <button onClick={() => remove(i)} style={{position:'absolute',top:'3px',right:'3px',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',width:'20px',height:'20px',borderRadius:'50%',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>✕</button>
          </div>
        ))}
        {photos.length < 2 && (
          <button onClick={() => ref.current.click()} style={{width:'80px',height:'80px',borderRadius:'10px',background:'rgba(255,255,255,0.05)',border:'2px dashed rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.4)',fontSize:'24px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            📷
          </button>
        )}
      </div>
      <div style={{fontSize:'12px', color:'rgba(255,255,255,0.3)'}}>최대 2장 · 자동 압축됩니다</div>
      <input ref={ref} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleFile}/>
    </div>
  )
}

// ── 도넛 차트 ─────────────────────────────────────────────────────
function DonutChart({data,total,size=110}){
  const sw=Math.round(size*0.14);const r=(size-sw)/2-2;const cx=size/2;const cy=size/2
  const circ=2*Math.PI*r;let off=0
  const slices=data.filter(d=>d.value>0).map(d=>{const dash=(d.value/total)*circ;const sl={...d,dash,gap:circ-dash,off};off+=dash;return sl})
  return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)',display:'block'}}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw}/>
    {slices.map((s,i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.off}/>)}
  </svg>)
}

// ── MM 대시보드 ──────────────────────────────────────────────────
function MMDashboard({cLeads,mLeads,user,period}){
  const now=new Date();const allLeads=[...cLeads,...mLeads];const assigned=cLeads.length
  function inPeriod(l){const ds=l.start_date||'';if(!ds)return false;try{const d=new Date(ds);if(period==='일간')return d.toDateString()===now.toDateString();if(period==='주간'){const s2=new Date(now);s2.setDate(now.getDate()-now.getDay());const e=new Date(s2);e.setDate(s2.getDate()+6);return d>=s2&&d<=e}if(period==='월간')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();if(period==='연간')return d.getFullYear()===now.getFullYear()}catch{}return false}
  const filtered=allLeads.filter(inPeriod)
  const actTotal=filtered.filter(l=>l.activity_status&&l.activity_status!=='미처리').length
  const counts={};ST.forEach(s=>counts[s]=filtered.filter(l=>l.activity_status===s).length)
  const periodTotal=filtered.length
  const annual=allLeads.filter(l=>{try{return new Date(l.start_date||'').getFullYear()===now.getFullYear()}catch{return false}})
  const annualCounts={};ST.forEach(s=>annualCounts[s]=annual.filter(l=>l.activity_status===s).length)
  const curMonth=now.getMonth()
  const monthData=Array.from({length:curMonth+1},(_,i)=>{const rows=allLeads.filter(l=>{try{const d=new Date(l.start_date||'');return d.getFullYear()===now.getFullYear()&&d.getMonth()===i}catch{return false}});return{label:(i+1)+'월',total:rows.length,성공:rows.filter(l=>l.activity_status==='성공').length}})
  const maxT=Math.max(...monthData.map(d=>d.total),1)
  const goal=user?.goal||10;const sc=user?.success||0
  return(<div>
    <div style={{background:'rgba(13,31,53,0.9)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'16px',marginBottom:'12px'}}>
      <div style={{fontSize:'13px',color:S.sub,fontWeight:'700',marginBottom:'12px'}}>📦 배분 대비 활동률<span style={{color:'rgba(255,255,255,0.3)',fontWeight:'400',fontSize:'11px',marginLeft:'6px'}}>배분 {assigned}건 기준</span></div>
      <div style={{display:'flex',gap:'14px',alignItems:'center'}}>
        <div style={{position:'relative',width:'110px',height:'110px',flexShrink:0}}>
          <DonutChart size={110} total={Math.max(assigned,1)} data={[{value:actTotal,color:S.acc},{value:Math.max(assigned-actTotal,0),color:'rgba(255,255,255,0.08)'}]}/>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:S.acc}}>{pct(actTotal,Math.max(assigned,1))}%</div>
            <div style={{fontSize:'11px',color:S.sub}}>활동률</div>
          </div>
        </div>
        <div style={{flex:1}}>
          {[{label:'활동 완료',value:actTotal,color:S.acc},{label:'미활동',value:Math.max(assigned-actTotal,0),color:'rgba(255,255,255,0.25)'}].map((r,i)=>(
            <div key={i} style={{marginBottom:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'13px',color:r.color,fontWeight:'700'}}>{r.label}</span><span style={{fontSize:'13px',fontWeight:'900',color:r.color}}>{r.value}건 <span style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',fontWeight:'400'}}>({pct(r.value,Math.max(assigned,1))}%)</span></span></div>
              <div style={{background:'rgba(255,255,255,0.07)',borderRadius:'3px',height:'6px'}}><div style={{width:pct(r.value,Math.max(assigned,1))+'%',background:r.color,height:'100%',borderRadius:'3px'}}/></div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div style={{background:'rgba(13,31,53,0.9)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'16px',marginBottom:'12px'}}>
      <div style={{fontSize:'13px',color:S.sub,fontWeight:'700',marginBottom:'12px'}}>📊 {period} 활동 {periodTotal}건 상태 비율</div>
      <div style={{display:'flex',gap:'14px',alignItems:'center',marginBottom:'12px'}}>
        <div style={{position:'relative',width:'110px',height:'110px',flexShrink:0}}>
          <DonutChart size={110} total={Math.max(periodTotal,1)} data={ST.map(s=>({value:counts[s],color:SC[s].dot}))}/>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:'22px',fontWeight:'900',color:'#4ade80'}}>{counts['성공']}</div>
            <div style={{fontSize:'11px',color:S.sub}}>성공</div>
          </div>
        </div>
        <div style={{flex:1}}>{ST.map(s=>(<div key={s} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'7px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{width:'8px',height:'8px',borderRadius:'50%',background:SC[s].dot}}/><span style={{fontSize:'13px'}}>{s}</span></div>
          <span style={{fontSize:'13px',fontWeight:'900',color:SC[s].dot}}>{counts[s]}건 <span style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',fontWeight:'400'}}>({pct(counts[s],Math.max(periodTotal,1))}%)</span></span>
        </div>))}</div>
      </div>
      <div style={{display:'flex',gap:'8px'}}>
        <div style={{flex:1,background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:'10px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'11px',color:S.sub,marginBottom:'4px'}}>활동 대비 성공률</div><div style={{fontSize:'20px',fontWeight:'900',color:'#4ade80'}}>{pct(counts['성공'],Math.max(actTotal,1))}%</div></div>
        <div style={{flex:1,background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'10px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'11px',color:S.sub,marginBottom:'4px'}}>배분 대비 성공률</div><div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{pct(counts['성공'],Math.max(assigned,1))}%</div></div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
      {ST.map(s=>(<div key={s} style={{background:SC[s].bg,border:'1px solid '+SC[s].border,borderRadius:'12px',padding:'14px',textAlign:'center'}}><div style={{fontSize:'26px',fontWeight:'900',color:SC[s].text}}>{counts[s]}</div><div style={{fontSize:'12px',color:SC[s].text,opacity:0.85,marginTop:'3px'}}>{s}</div><div style={{fontSize:'11px',color:SC[s].text,opacity:0.5}}>{pct(counts[s],Math.max(periodTotal,1))}%</div></div>))}
    </div>
    <div style={{background:'linear-gradient(135deg,rgba(74,222,128,0.1),rgba(13,31,53,0.9))',border:'1.5px solid rgba(74,222,128,0.22)',borderRadius:'16px',padding:'16px',marginBottom:'12px'}}>
      <div style={{fontSize:'14px',fontWeight:'800',color:S.acc,marginBottom:'12px'}}>📅 {now.getFullYear()}년 연간 누적</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        {[{label:'전체 활동',v:annual.length,c:'#f59e0b'},{label:'성공',v:annualCounts['성공'],c:'#4ade80'},{label:'접촉',v:annualCounts['접촉완료'],c:'#60a5fa'},{label:'미처리',v:annualCounts['미처리'],c:'#fbbf24'}].map((s2,i)=>(
          <div key={i} style={{flex:1,background:'rgba(255,255,255,0.05)',borderRadius:'10px',padding:'10px 6px',textAlign:'center'}}><div style={{fontSize:'18px',fontWeight:'900',color:s2.c}}>{s2.v}</div><div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginTop:'3px'}}>{s2.label}</div></div>
        ))}
      </div>
      <div style={{fontSize:'12px',color:S.sub,marginBottom:'8px',fontWeight:'600'}}>월별 추이 <span style={{color:'rgba(74,222,128,0.6)',fontWeight:'400'}}>초록=성공</span></div>
      <div style={{display:'flex',gap:'4px',alignItems:'flex-end',height:'60px'}}>
        {monthData.map((d,i)=>(<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
          <div style={{fontSize:'9px',color:'#f59e0b',fontWeight:'800'}}>{d.total>0?d.total:''}</div>
          <div style={{width:'100%',position:'relative',height:Math.max(d.total/maxT*38,3)+'px',borderRadius:'3px 3px 0 0',background:'rgba(245,158,11,0.12)',overflow:'hidden'}}><div style={{position:'absolute',bottom:0,left:0,right:0,height:pct(d.성공,d.total)+'%',background:'#4ade80',borderRadius:'3px 3px 0 0'}}/></div>
          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>{d.label}</div>
        </div>))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:'10px'}}><span style={{fontSize:'12px',color:S.sub}}>연간 성공률</span><span style={{fontSize:'16px',fontWeight:'900',color:'#4ade80'}}>{pct(annualCounts['성공'],Math.max(annual.length,1))}%</span></div>
    </div>
    <div style={{background:'rgba(13,31,53,0.9)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'14px',padding:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'14px',fontWeight:'700'}}>이달 목표 진행</span><span style={{fontSize:'16px',fontWeight:'900',color:S.acc}}>{sc} / {goal}건</span></div>
      <div style={{background:'rgba(255,255,255,0.08)',borderRadius:'6px',height:'10px',overflow:'hidden',marginBottom:'8px'}}><div style={{width:Math.min(pct(sc,goal),100)+'%',background:'linear-gradient(90deg,#4ade80,#22c55e)',height:'100%',borderRadius:'6px'}}/></div>
      <div style={{fontSize:'12px',color:S.sub}}>목표까지 <strong style={{color:'#4ade80'}}>{Math.max(goal-sc,0)}건</strong> 남음</div>
    </div>
  </div>)
}

// ── 활동결과 모달 (사진 + 일시) ──────────────────────────────────
function ResultModal({ lead, onClose, onSave }) {
  const [form, setForm] = useState({
    status:  lead.activity_status  || '미처리',
    result:  lead.activity_result  || '',
    memo:    lead.activity_memo    || '',
    contact: lead.activity_contact || '',
    photos:  (() => { try { return JSON.parse(lead.photos || '[]') } catch { return [] } })(),
  })
  const set = useCallback((k, v) => setForm(prev => ({ ...prev, [k]: v })), [])
  const statColors = { '미처리':'#f59e0b', '접촉완료':'#60a5fa', '성공':'#4ade80', '실패':'#f87171' }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:999,backdropFilter:'blur(4px)'}}>
      <div style={{background:'linear-gradient(170deg,#0d1f35,#0a1628)',borderRadius:'20px 20px 0 0',padding:'24px 20px 36px',width:'100%',maxWidth:'420px',border:'1px solid rgba(255,255,255,0.1)',position:'relative',maxHeight:'92vh',overflowY:'auto'}}>
        <button onClick={onClose} style={{position:'absolute',top:'16px',right:'16px',background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'22px',cursor:'pointer'}}>✕</button>
        <h3 style={{fontSize:'18px',fontWeight:'900',marginBottom:'4px'}}>활동 결과 {form.status!=='미처리'?'수정':'입력'}</h3>
        <p style={{color:S.sub,fontSize:'13px',marginBottom:'18px'}}>{lead._src==='c'?lead.address:lead.customer}</p>

        {/* 방문 상태 */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'8px',color:S.sub}}>방문 상태</div>
          <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
            {['미처리','접촉완료','성공','실패'].map(s=>(
              <button key={s} onClick={()=>set('status',s)} style={{padding:'10px 16px',background:form.status===s?statColors[s]:'rgba(255,255,255,0.06)',border:form.status===s?'none':'1px solid rgba(255,255,255,0.1)',color:form.status===s?'#06111f':S.sub,borderRadius:'10px',fontSize:'15px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>{s}</button>
            ))}
          </div>
        </div>

        {/* 결과 요약 */}
        <div style={{marginBottom:'11px'}}>
          <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'6px',color:S.sub}}>결과 요약</div>
          <input type="text" placeholder="예: 계약완료, 재방문 예정" value={form.result} onChange={e=>set('result',e.target.value)} style={IS}/>
        </div>

        {/* 연락처 */}
        <div style={{marginBottom:'11px'}}>
          <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'6px',color:S.sub}}>연락처</div>
          <input type="tel" placeholder="010-0000-0000" value={form.contact} onChange={e=>set('contact',e.target.value)} style={IS}/>
        </div>

        {/* 메모 */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'6px',color:S.sub}}>메모</div>
          <textarea placeholder="특이사항, 다음 액션 등" value={form.memo} onChange={e=>set('memo',e.target.value)} rows={3} style={{...IS,resize:'none'}}/>
        </div>

        {/* 사진 */}
        <div style={{marginBottom:'20px'}}>
          <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'8px',color:S.sub}}>사진 첨부 (최대 2장)</div>
          <PhotoPicker photos={form.photos} onChange={v=>set('photos',v)} accent={S.acc}/>
        </div>

        <button onClick={()=>onSave(form)} style={{width:'100%',padding:'15px',background:'linear-gradient(135deg,#4ade80,#16a34a)',border:'none',color:'#06111f',borderRadius:'12px',fontSize:'17px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit'}}>저장하기</button>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function MM({ onBack }) {
  const [screen,setScreen]=useState('login')
  const [lid,setLid]=useState('');const [lpw,setLpw]=useState('');const [lerr,setLerr]=useState('');const [lding,setLding]=useState(false)
  const [user,setUser]=useState(null)
  const [tab,setTab]=useState('home');const [leadTab,setLeadTab]=useState('connector')
  const [period,setPeriod]=useState('월간')
  const [cLeads,setCLeads]=useState([]);const [mLeads,setMLeads]=useState([])
  const [rm,setRm]=useState(null)
  const [reg,setReg]=useState({customer:'',address:'',contact:'',products:[],note:'',photos:[]})
  const [regDone,setRegDone]=useState(false)
  const [toast,setToast]=useState('')

  const t2=msg=>{setToast(msg);setTimeout(()=>setToast(''),2500)}

  const handleLogin=async()=>{
    if(!lid||!lpw){setLerr('아이디와 비밀번호를 입력하세요');return}
    setLding(true);setLerr('')
    try{
      const users=await db.get('mm_users','username=eq.'+lid+'&password=eq.'+lpw)
      if(!users.length){setLerr('아이디 또는 비밀번호가 올바르지 않습니다');setLding(false);return}
      const u=users[0]
      const [cl,ml]=await Promise.all([
        db.get('connector_leads','assigned_to=eq.'+encodeURIComponent(u.name)),
        db.get('mm_direct_leads','mm_username=eq.'+u.username+'&order=created_at.desc')
      ])
      setCLeads(cl);setMLeads(ml);setUser(u);setScreen('main')
    }catch(e){setLerr('연결 오류: '+e.message)}
    setLding(false)
  }

  const saveResult=async(form)=>{
    if(!rm)return
    const now=new Date().toISOString()
    const upd={
      activity_status:form.status,
      activity_result:form.result,
      activity_memo:form.memo,
      activity_contact:form.contact,
      photos:JSON.stringify(form.photos),
      activity_at:now
    }
    try{
      if(rm._src==='c'){
        await db.patch('connector_leads','id=eq.'+rm.id,upd)
        const nc=cLeads.map(l=>l.id===rm.id?{...l,...upd}:l);setCLeads(nc)
        const sc=nc.filter(l=>l.activity_status==='성공').length+mLeads.filter(l=>l.activity_status==='성공').length
        await db.patch('mm_users','id=eq.'+user.id,{success:sc});setUser({...user,success:sc})
      }else{
        await db.patch('mm_direct_leads','id=eq.'+rm.id,upd)
        const nm=mLeads.map(l=>l.id===rm.id?{...l,...upd}:l);setMLeads(nm)
        const sc=cLeads.filter(l=>l.activity_status==='성공').length+nm.filter(l=>l.activity_status==='성공').length
        await db.patch('mm_users','id=eq.'+user.id,{success:sc});setUser({...user,success:sc})
      }
      setRm(null);t2('활동 결과 저장 완료!')
    }catch(e){t2('저장 실패: '+e.message)}
  }

  const handleReg=async()=>{
    if(!reg.customer||!reg.products.length)return
    const newLead={
      id:'m'+Date.now(),mm_username:user.username,
      customer:reg.customer,address:reg.address,contact:reg.contact,
      products:reg.products,note:reg.note,
      photos:JSON.stringify(reg.photos),
      activity_status:'미처리',activity_result:'',activity_memo:'',activity_contact:reg.contact,activity_at:''
    }
    try{
      await db.post('mm_direct_leads',newLead)
      setMLeads([newLead,...mLeads]);setRegDone(true);t2('등록 완료!')
      setTimeout(()=>{setRegDone(false);setReg({customer:'',address:'',contact:'',products:[],note:'',photos:[]});setTab('leads');setLeadTab('my')},1800)
    }catch(e){t2('등록 실패: '+e.message)}
  }

  const toggleP=p=>setReg(prev=>({...prev,products:prev.products.includes(p)?prev.products.filter(x=>x!==p):[...prev.products,p]}))

  const sc=user?.success||0;const lv=getLv(sc);const nextLv=LEVELS.find(l=>l.lv===lv.lv+1)
  const unproc=cLeads.filter(l=>(l.activity_status||'미처리')==='미처리').length
  const navTabs=[{id:'home',label:'활동현황',icon:'📊'},{id:'leads',label:'영업기회',icon:'📋'},{id:'register',label:'직접등록',icon:'➕'},{id:'growth',label:'내 성장',icon:'📈'}]

  if(screen==='login')return(
    <div style={{minHeight:'100vh',background:'linear-gradient(170deg,#06111f 0%,#0a1f3d 40%,#0d1a35 70%,#06111f 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'30px 28px',fontFamily:"'Noto Sans KR',sans-serif",color:S.text}}>
      <button onClick={onBack} style={{alignSelf:'flex-start',background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'15px',cursor:'pointer',marginBottom:'32px'}}>‹ 홈으로</button>
      <KTLogo/>
      <div style={{textAlign:'center',margin:'20px 0 36px'}}>
        <h1 style={{fontSize:'36px',fontWeight:'900',margin:'0 0 8px',background:'linear-gradient(135deg,#fff,#4ade80)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>상권마스터</h1>
        <p style={{color:'rgba(255,255,255,0.45)',fontSize:'14px',margin:0}}>MM 전용 플랫폼</p>
      </div>
      <div style={{width:'100%',maxWidth:'360px',display:'flex',flexDirection:'column',gap:'12px'}}>
        <input type="text" placeholder="아이디" value={lid} onChange={e=>{setLid(e.target.value);setLerr('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{...IS,padding:'16px',fontSize:'18px'}}/>
        <input type="password" placeholder="비밀번호" value={lpw} onChange={e=>{setLpw(e.target.value);setLerr('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{...IS,padding:'16px',fontSize:'18px'}}/>
        {lerr&&<div style={{color:'#f87171',fontSize:'14px',textAlign:'center',background:'rgba(248,113,113,0.1)',padding:'10px',borderRadius:'8px'}}>{lerr}</div>}
        <button onClick={handleLogin} disabled={lding} style={{background:lding?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#4ade80,#16a34a)',border:'none',color:lding?'#475569':'#06111f',padding:'18px',borderRadius:'14px',fontSize:'18px',fontWeight:'900',cursor:lding?'not-allowed':'pointer',fontFamily:'inherit',marginTop:'6px'}}>{lding?'로그인 중...':'로그인'}</button>
      </div>
      <p style={{color:'rgba(255,255,255,0.25)',fontSize:'13px',marginTop:'28px',textAlign:'center'}}>계정이 없으신가요?<br/>관리자에게 문의하세요</p>
    </div>
  )

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(170deg,#06111f,#0a1f3d,#06111f)',color:S.text,fontFamily:"'Noto Sans KR',sans-serif",maxWidth:'420px',margin:'0 auto',display:'flex',flexDirection:'column'}}>
      {toast&&<div style={{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',background:'#052e16',border:'1px solid #4ade80',color:'#4ade80',padding:'12px 24px',borderRadius:'50px',fontSize:'15px',fontWeight:'700',zIndex:9999,whiteSpace:'nowrap'}}>✅ {toast}</div>}
      {rm&&<ResultModal lead={rm} onClose={()=>setRm(null)} onSave={saveResult}/>}

      <div style={{background:'rgba(6,17,31,0.9)',padding:'16px 20px 14px',borderBottom:'1px solid rgba(74,222,128,0.18)',backdropFilter:'blur(10px)',position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <KTLogo/>
            <div><div style={{fontSize:'16px',fontWeight:'900',color:S.acc,lineHeight:1}}>상권마스터</div><div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',marginTop:'2px'}}>{user?.name} MM · {user?.region}</div></div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.22)',borderRadius:'20px',padding:'5px 12px'}}>
              <span style={{fontSize:'14px'}}>{lv.icon}</span><span style={{fontSize:'12px',fontWeight:'800',color:lv.color}}>Lv.{lv.lv} {lv.name}</span>
            </div>
            <button onClick={()=>{setScreen('login');setUser(null)}} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.22)',fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}}>로그아웃</button>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        {tab==='home'&&(
          <div>
            <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
              {['일간','주간','월간','연간'].map(p=>(
                <button key={p} onClick={()=>setPeriod(p)} style={{flex:1,padding:'9px 0',background:period===p?S.acc:'rgba(255,255,255,0.06)',border:period===p?'none':'1px solid rgba(255,255,255,0.1)',color:period===p?'#06111f':S.sub,borderRadius:'10px',fontSize:'14px',fontWeight:period===p?'900':'500',cursor:'pointer',fontFamily:'inherit'}}>{p}</button>
              ))}
            </div>
            <div style={{background:'rgba(13,31,53,0.9)',border:'1.5px solid '+lv.color+'44',borderRadius:'14px',padding:'14px 16px',marginBottom:'12px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{fontSize:'36px'}}>{lv.icon}</span>
              <div style={{flex:1}}><div style={{fontSize:'13px',color:S.sub}}>현재 레벨</div><div style={{fontSize:'22px',fontWeight:'900',color:lv.color}}>Lv.{lv.lv} {lv.name}</div></div>
              {nextLv&&<div style={{textAlign:'right'}}><div style={{fontSize:'11px',color:S.sub}}>다음까지</div><div style={{fontSize:'16px',fontWeight:'900',color:lv.color}}>{nextLv.min-sc}건</div></div>}
            </div>
            {unproc>0&&<div style={{background:'rgba(245,158,11,0.07)',border:'1.5px solid rgba(245,158,11,0.3)',borderRadius:'12px',padding:'12px 16px',marginBottom:'12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:'14px',fontWeight:'800',color:'#f59e0b'}}>⚠️ 미처리 기회 {unproc}건</div>
              <button onClick={()=>{setTab('leads');setLeadTab('connector')}} style={{background:'#f59e0b',border:'none',color:'#06111f',padding:'7px 12px',borderRadius:'8px',fontSize:'13px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit'}}>확인 →</button>
            </div>}
            <MMDashboard cLeads={cLeads} mLeads={mLeads} user={user} period={period}/>
          </div>
        )}

        {tab==='leads'&&(
          <div>
            <h2 style={{fontSize:'19px',fontWeight:'900',marginBottom:'14px',color:S.acc}}>영업기회 관리</h2>
            <div style={{display:'flex',background:'rgba(13,31,53,0.8)',borderRadius:'12px',padding:'4px',marginBottom:'14px',border:'1px solid rgba(255,255,255,0.07)'}}>
              <button onClick={()=>setLeadTab('connector')} style={{flex:1,padding:'10px',background:leadTab==='connector'?'#60a5fa':'transparent',color:leadTab==='connector'?'#06111f':S.sub,border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>📤 관리자 배분 ({cLeads.length})</button>
              <button onClick={()=>setLeadTab('my')} style={{flex:1,padding:'10px',background:leadTab==='my'?S.acc:'transparent',color:leadTab==='my'?'#06111f':S.sub,border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>🔍 직접발굴 ({mLeads.length})</button>
            </div>

            {leadTab==='connector'&&(cLeads.length===0
              ?<div style={{textAlign:'center',padding:'50px 20px',color:S.sub}}>배분된 기회가 없습니다</div>
              :cLeads.map(l=>{
                const photos=(()=>{try{return JSON.parse(l.photos||'[]')}catch{return[]}})()
                return(<div key={l.id} style={{background:'rgba(13,31,53,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderLeft:'3px solid #60a5fa',borderRadius:'14px',padding:'14px',marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                    <div style={{flex:1,marginRight:'10px'}}>
                      <div style={{fontSize:'11px',color:'#60a5fa',fontWeight:'700',marginBottom:'4px'}}>📤 관리자 배분</div>
                      <div style={{fontSize:'14px',fontWeight:'800',lineHeight:'1.4'}}>{l.address}</div>
                      <div style={{color:S.sub,fontSize:'12px',marginTop:'3px'}}>{l.area&&l.area+'㎡ · '}{l.usage_type}{l.start_date&&' · '+l.start_date}</div>
                    </div>
                    <Badge s={l.activity_status||'미처리'}/>
                  </div>
                  {l.activity_at&&<div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',marginBottom:'6px'}}>📅 {fmtAt(l.activity_at)}</div>}
                  {(l.activity_result||l.activity_contact||l.activity_memo)&&<div style={{background:'rgba(255,255,255,0.04)',borderRadius:'8px',padding:'8px 10px',marginBottom:'8px',fontSize:'13px',color:S.sub}}>
                    {l.activity_contact&&<div>📞 {l.activity_contact}</div>}
                    {l.activity_result&&<div>📝 {l.activity_result}</div>}
                    {l.activity_memo&&<div>💬 {l.activity_memo}</div>}
                  </div>}
                  {photos.length>0&&<div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
                    {photos.map((src,i)=><img key={i} src={src} alt="사진" style={{width:'64px',height:'64px',objectFit:'cover',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.15)'}}/>)}
                  </div>}
                  <button onClick={()=>setRm({...l,_src:'c'})} style={{width:'100%',background:'transparent',border:'1px solid rgba(96,165,250,0.35)',color:'#60a5fa',padding:'10px',borderRadius:'8px',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>
                    {l.activity_status&&l.activity_status!=='미처리'?'✏️ 결과 수정':'활동 결과 입력'}
                  </button>
                </div>)
              })
            )}

            {leadTab==='my'&&(mLeads.length===0
              ?<div style={{textAlign:'center',padding:'50px 20px',color:S.sub}}>직접 등록한 기회가 없습니다<br/><span style={{fontSize:'14px',opacity:0.6}}>➕ 탭에서 등록하세요</span></div>
              :mLeads.map(l=>{
                const photos=(()=>{try{return JSON.parse(l.photos||'[]')}catch{return[]}})()
                return(<div key={l.id} style={{background:'rgba(13,31,53,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderLeft:'3px solid #4ade80',borderRadius:'14px',padding:'14px',marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                    <div style={{flex:1,marginRight:'10px'}}>
                      <div style={{fontSize:'11px',color:S.acc,fontWeight:'700',marginBottom:'4px'}}>🔍 직접 발굴</div>
                      <div style={{fontSize:'15px',fontWeight:'800'}}>{l.customer}</div>
                      <div style={{color:S.sub,fontSize:'12px',marginTop:'2px'}}>{l.address}{l.contact&&' · 📞 '+l.contact}</div>
                      {l.note&&<div style={{color:S.sub,fontSize:'12px',marginTop:'2px'}}>📋 {l.note}</div>}
                    </div>
                    <Badge s={l.activity_status||'미처리'}/>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'10px'}}>
                    {l.products?.map(p=><span key={p} style={{background:'rgba(74,222,128,0.1)',color:S.acc,border:'1px solid rgba(74,222,128,0.22)',fontSize:'11px',fontWeight:'700',padding:'3px 8px',borderRadius:'4px'}}>{p}</span>)}
                  </div>
                  {l.activity_at&&<div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',marginBottom:'6px'}}>📅 {fmtAt(l.activity_at)}</div>}
                  {(l.activity_result||l.activity_contact||l.activity_memo)&&<div style={{background:'rgba(255,255,255,0.04)',borderRadius:'8px',padding:'8px 10px',marginBottom:'8px',fontSize:'13px',color:S.sub}}>
                    {l.activity_contact&&<div>📞 {l.activity_contact}</div>}
                    {l.activity_result&&<div>📝 {l.activity_result}</div>}
                    {l.activity_memo&&<div>💬 {l.activity_memo}</div>}
                  </div>}
                  {photos.length>0&&<div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
                    {photos.map((src,i)=><img key={i} src={src} alt="사진" style={{width:'64px',height:'64px',objectFit:'cover',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.15)'}}/>)}
                  </div>}
                  <button onClick={()=>setRm({...l,_src:'m'})} style={{width:'100%',background:'transparent',border:'1px solid rgba(74,222,128,0.35)',color:S.acc,padding:'10px',borderRadius:'8px',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>
                    {l.activity_status&&l.activity_status!=='미처리'?'✏️ 결과 수정':'활동 결과 입력'}
                  </button>
                </div>)
              })
            )}
          </div>
        )}

        {tab==='register'&&(
          <div>
            <h2 style={{fontSize:'19px',fontWeight:'900',marginBottom:'18px',color:S.acc}}>직접 발굴 등록</h2>
            {regDone
              ?<div style={{textAlign:'center',padding:'50px 20px',background:'rgba(5,46,22,0.3)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'18px'}}><div style={{fontSize:'56px',marginBottom:'14px'}}>✅</div><div style={{fontSize:'22px',fontWeight:'900',color:S.acc}}>등록 완료!</div></div>
              :<div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                {[{k:'customer',l:'고객명',p:'예: 행복분식',r:true},{k:'address',l:'주소',p:'예: 강남구 역삼동 123'},{k:'contact',l:'연락처',p:'010-0000-0000',t:'tel'}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:'14px',color:S.sub,fontWeight:'700',display:'block',marginBottom:'7px'}}>{f.l} {f.r&&<span style={{color:'#f87171'}}>*</span>}</label>
                    <input type={f.t||'text'} placeholder={f.p} value={reg[f.k]} onChange={e=>setReg(prev=>({...prev,[f.k]:e.target.value}))} style={IS}/>
                  </div>
                ))}
                <div>
                  <label style={{fontSize:'14px',color:S.sub,fontWeight:'700',display:'block',marginBottom:'9px'}}>상품군 <span style={{color:'#f87171'}}>*</span> <span style={{fontSize:'12px',color:'rgba(255,255,255,0.25)',fontWeight:'400'}}>(중복 선택)</span></label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                    {PRODUCTS.map(p=>{const sel=reg.products.includes(p);return(
                      <button key={p} onClick={()=>toggleP(p)} style={{padding:'11px 16px',background:sel?S.acc:'rgba(255,255,255,0.06)',border:sel?'none':'1px solid rgba(255,255,255,0.12)',color:sel?'#06111f':S.sub,borderRadius:'10px',fontSize:'15px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>{sel?'✓ ':''}{p}</button>
                    )})}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:'14px',color:S.sub,fontWeight:'700',display:'block',marginBottom:'7px'}}>비고 (상세사항)</label>
                  <textarea placeholder="특이사항, 상세 정보 등" value={reg.note} onChange={e=>setReg(prev=>({...prev,note:e.target.value}))} rows={3} style={{...IS,resize:'none'}}/>
                </div>
                <div>
                  <label style={{fontSize:'14px',color:S.sub,fontWeight:'700',display:'block',marginBottom:'8px'}}>사진 첨부 (최대 2장)</label>
                  <PhotoPicker photos={reg.photos} onChange={v=>setReg(prev=>({...prev,photos:v}))} accent={S.acc}/>
                </div>
                <button onClick={handleReg} disabled={!reg.customer||!reg.products.length} style={{background:reg.customer&&reg.products.length?'linear-gradient(135deg,#4ade80,#16a34a)':'rgba(255,255,255,0.08)',border:'none',color:reg.customer&&reg.products.length?'#06111f':'#475569',padding:'18px',borderRadius:'14px',fontSize:'18px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit'}}>등록하기</button>
              </div>
            }
          </div>
        )}

        {tab==='growth'&&(
          <div>
            <h2 style={{fontSize:'19px',fontWeight:'900',marginBottom:'16px',color:S.acc}}>내 성장 레벨</h2>
            <div style={{background:'rgba(13,31,53,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'16px',padding:'20px',marginBottom:'16px'}}>
              <div style={{display:'flex',alignItems:'flex-end',gap:'8px',height:'120px',justifyContent:'center'}}>
                {LEVELS.map((l,i)=>{const reached=sc>=l.min;const cur=lv.lv===l.lv;const h=22+i*20;return(
                  <div key={l.lv} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                    <div style={{height:'20px',display:'flex',alignItems:'center'}}>{cur&&<span style={{fontSize:'13px',color:l.color}}>▼</span>}</div>
                    <div style={{width:'46px',height:h+'px',background:reached?l.color:'rgba(255,255,255,0.07)',borderRadius:'6px 6px 0 0',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'6px',border:cur?'2px solid '+l.color:'none'}}><span style={{fontSize:'16px'}}>{l.icon}</span></div>
                    <div style={{fontSize:'11px',fontWeight:'700',color:reached?l.color:'rgba(255,255,255,0.2)'}}>Lv.{l.lv}</div>
                  </div>
                )})}
              </div>
            </div>
            {LEVELS.map(l=>{const reached=sc>=l.min;const cur=lv.lv===l.lv;return(
              <div key={l.lv} style={{background:cur?'rgba(13,31,53,0.9)':'rgba(13,31,53,0.6)',border:cur?'1.5px solid '+l.color+'55':'1px solid rgba(255,255,255,0.06)',borderRadius:'12px',padding:'14px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{fontSize:'26px'}}>{l.icon}</span>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}><span style={{fontSize:'16px',fontWeight:'800',color:reached?l.color:'rgba(255,255,255,0.25)'}}>Lv.{l.lv} {l.name}</span>{cur&&<span style={{background:l.color,color:'#06111f',fontSize:'10px',fontWeight:'900',padding:'2px 8px',borderRadius:'10px'}}>현재</span>}</div>
                  <div style={{color:'rgba(255,255,255,0.28)',fontSize:'13px',marginTop:'2px'}}>{l.lv<5?'성공 '+l.min+'~'+l.max+'건':'성공 '+l.min+'건 이상'}</div>
                </div>
                {reached&&<span style={{fontSize:'18px'}}>✅</span>}
              </div>
            )})}
          </div>
        )}
      </div>

      <div style={{background:'rgba(6,17,31,0.95)',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',padding:'8px 0',backdropFilter:'blur(10px)'}}>
        {navTabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:'none',border:'none',color:tab===t.id?S.acc:'rgba(255,255,255,0.3)',cursor:'pointer',padding:'6px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',fontFamily:'inherit'}}>
            <span style={{fontSize:'20px'}}>{t.icon}</span>
            <span style={{fontSize:'11px',fontWeight:tab===t.id?'800':'500'}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
