import { useState, useCallback, useRef } from 'react'
import { db } from './supabase'

const KTLogo = () => (
  <svg width="36" height="22" viewBox="0 0 80 48" fill="none">
    <text x="0" y="40" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="44" fill="#E31937">kt</text>
  </svg>
)
const PRODUCTS = ['인터넷', 'TV', '다량회선', '모바일', '일반전화']
const LEVELS = [
  { lv:1, name:'새싹',   min:0,  max:4,   color:'#16a34a', icon:'🌱' },
  { lv:2, name:'성장',   min:5,  max:9,   color:'#2563eb', icon:'🌿' },
  { lv:3, name:'활발',   min:10, max:19,  color:'#d97706', icon:'⭐' },
  { lv:4, name:'전문가', min:20, max:34,  color:'#ea580c', icon:'🔥' },
  { lv:5, name:'마스터', min:35, max:999, color:'#7c3aed', icon:'👑' },
]
const getLv = n => LEVELS.find(l => n >= l.min && n <= l.max) || LEVELS[0]

const C = { bg:'#f4f6fb', card:'#fff', border:'#e2e8f0', acc:'#16a34a', accBg:'#f0fdf4', accBorder:'#bbf7d0', text:'#1e293b', sub:'#64748b', red:'#dc2626', blue:'#2563eb', acc2:'#e67e00' }
const IS = { width:'100%', background:'#f8fafc', border:'1.5px solid #e2e8f0', color:C.text, padding:'13px 15px', borderRadius:'10px', fontSize:'15px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }

const ST = ['성공','접촉완료','미처리','실패']
const SC = {
  '성공':    { bg:'#f0fdf4', text:'#15803d', border:'#bbf7d0', dot:'#22c55e' },
  '접촉완료':{ bg:'#eff6ff', text:'#1d4ed8', border:'#bfdbfe', dot:'#3b82f6' },
  '미처리':  { bg:'#fffbeb', text:'#b45309', border:'#fde68a', dot:'#f59e0b' },
  '실패':    { bg:'#fef2f2', text:'#b91c1c', border:'#fecaca', dot:'#ef4444' },
}
function pct(n,d){ return d>0?Math.round(n/d*100):0 }
function fmtAt(iso){ if(!iso)return''; try{const d=new Date(iso);return d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}catch{return iso} }
function Badge({s}){const c=SC[s]||SC['미처리'];return<span style={{background:c.bg,color:c.text,border:'1px solid '+c.border,fontSize:'12px',fontWeight:'700',padding:'4px 10px',borderRadius:'20px',whiteSpace:'nowrap'}}>{s}</span>}

// ── 이미지 압축 ───────────────────────────────────────────────────
async function compressImage(file,maxW=600,quality=0.55){
  return new Promise(resolve=>{
    const img=new Image();const url=URL.createObjectURL(file)
    img.onload=()=>{URL.revokeObjectURL(url);const scale=Math.min(1,maxW/img.width);const w=Math.round(img.width*scale);const h=Math.round(img.height*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',quality))}
    img.src=url
  })
}

// ── 도넛 차트 ─────────────────────────────────────────────────────
function DonutChart({data,total,size=110}){
  const sw=Math.round(size*0.14);const r=(size-sw)/2-2;const cx=size/2;const cy=size/2;const circ=2*Math.PI*r;let off=0
  const slices=data.filter(d=>d.value>0).map(d=>{const dash=(d.value/total)*circ;const sl={...d,dash,gap:circ-dash,off};off+=dash;return sl})
  return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)',display:'block'}}><circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw}/>{slices.map((s,i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.off}/>)}</svg>)
}

// ── 사진 선택 컴포넌트 ────────────────────────────────────────────
function PhotoPicker({photos,onChange}){
  const ref=useRef()
  const handleFile=async(e)=>{const files=Array.from(e.target.files);const rem=2-photos.length;const comp=await Promise.all(files.slice(0,rem).map(f=>compressImage(f)));onChange([...photos,...comp]);e.target.value=''}
  const remove=(i)=>onChange(photos.filter((_,idx)=>idx!==i))
  return(<div>
    <div style={{display:'flex',gap:'8px',marginBottom:'6px',flexWrap:'wrap'}}>
      {photos.map((src,i)=>(<div key={i} style={{position:'relative',width:'72px',height:'72px',borderRadius:'8px',overflow:'hidden',border:'1px solid #e2e8f0'}}><img src={src} alt="사진" style={{width:'100%',height:'100%',objectFit:'cover'}}/><button onClick={()=>remove(i)} style={{position:'absolute',top:'3px',right:'3px',background:'rgba(0,0,0,0.5)',border:'none',color:'#fff',width:'18px',height:'18px',borderRadius:'50%',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>✕</button></div>))}
      {photos.length<2&&(<button onClick={()=>ref.current.click()} style={{width:'72px',height:'72px',borderRadius:'8px',background:'#f8fafc',border:'2px dashed #e2e8f0',color:'#94a3b8',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>📷</button>)}
    </div>
    <div style={{fontSize:'11px',color:C.sub}}>최대 2장 · 자동 압축됩니다</div>
    <input ref={ref} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleFile}/>
  </div>)
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
  const goal=user?.goal||10;const sc=user?.success||0

  const card=(children)=><div style={{background:C.card,border:'1px solid '+C.border,borderRadius:'14px',padding:'16px',marginBottom:'12px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>{children}</div>

  return(<div>
    {card(<>
      <div style={{fontSize:'13px',color:C.sub,fontWeight:'700',marginBottom:'12px'}}>📦 배분 대비 활동률<span style={{fontWeight:'400',fontSize:'11px',marginLeft:'6px'}}>(배분 {assigned}건)</span></div>
      <div style={{display:'flex',gap:'14px',alignItems:'center'}}>
        <div style={{position:'relative',width:'110px',height:'110px',flexShrink:0}}>
          <DonutChart size={110} total={Math.max(assigned,1)} data={[{value:actTotal,color:C.acc},{value:Math.max(assigned-actTotal,0),color:'#e2e8f0'}]}/>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:C.acc}}>{pct(actTotal,Math.max(assigned,1))}%</div><div style={{fontSize:'11px',color:C.sub}}>활동률</div></div>
        </div>
        <div style={{flex:1}}>
          {[{label:'활동 완료',value:actTotal,color:C.acc},{label:'미활동',value:Math.max(assigned-actTotal,0),color:'#cbd5e1'}].map((r,i)=>(<div key={i} style={{marginBottom:'10px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'13px',color:i===1?C.sub:r.color,fontWeight:'700'}}>{r.label}</span><span style={{fontSize:'13px',fontWeight:'900',color:i===1?C.sub:r.color}}>{r.value}건 ({pct(r.value,Math.max(assigned,1))}%)</span></div>
            <div style={{background:'#f1f5f9',borderRadius:'3px',height:'6px'}}><div style={{width:pct(r.value,Math.max(assigned,1))+'%',background:r.color,height:'100%',borderRadius:'3px'}}/></div>
          </div>))}
        </div>
      </div>
    </>)}

    {card(<>
      <div style={{fontSize:'13px',color:C.sub,fontWeight:'700',marginBottom:'12px'}}>📊 {period} 활동 {periodTotal}건 상태 비율</div>
      <div style={{display:'flex',gap:'14px',alignItems:'center',marginBottom:'12px'}}>
        <div style={{position:'relative',width:'110px',height:'110px',flexShrink:0}}>
          <DonutChart size={110} total={Math.max(periodTotal,1)} data={ST.map(s=>({value:counts[s],color:SC[s].dot}))}/>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:C.acc}}>{counts['성공']}</div><div style={{fontSize:'11px',color:C.sub}}>성공</div></div>
        </div>
        <div style={{flex:1}}>{ST.map(s=>(<div key={s} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'7px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{width:'8px',height:'8px',borderRadius:'50%',background:SC[s].dot}}/><span style={{fontSize:'13px',color:C.text}}>{s}</span></div>
          <span style={{fontSize:'13px',fontWeight:'900',color:SC[s].dot}}>{counts[s]}건 ({pct(counts[s],Math.max(periodTotal,1))}%)</span>
        </div>))}</div>
      </div>
      <div style={{display:'flex',gap:'8px'}}>
        <div style={{flex:1,background:C.accBg,border:'1px solid '+C.accBorder,borderRadius:'10px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'11px',color:C.sub,marginBottom:'4px'}}>활동 대비 성공률</div><div style={{fontSize:'20px',fontWeight:'900',color:C.acc}}>{pct(counts['성공'],Math.max(actTotal,1))}%</div></div>
        <div style={{flex:1,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'10px',padding:'10px',textAlign:'center'}}><div style={{fontSize:'11px',color:C.sub,marginBottom:'4px'}}>배분 대비 성공률</div><div style={{fontSize:'20px',fontWeight:'900',color:'#d97706'}}>{pct(counts['성공'],Math.max(assigned,1))}%</div></div>
      </div>
    </>)}

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
      {ST.map(s=>(<div key={s} style={{background:SC[s].bg,border:'1px solid '+SC[s].border,borderRadius:'12px',padding:'14px',textAlign:'center'}}><div style={{fontSize:'26px',fontWeight:'900',color:SC[s].text}}>{counts[s]}</div><div style={{fontSize:'12px',color:SC[s].text,marginTop:'3px'}}>{s}</div><div style={{fontSize:'11px',color:SC[s].text,opacity:0.7}}>{pct(counts[s],Math.max(periodTotal,1))}%</div></div>))}
    </div>

    {card(<>
      <div style={{fontSize:'14px',fontWeight:'800',color:C.acc2,marginBottom:'12px'}}>📅 {now.getFullYear()}년 연간 누적</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        {[{label:'전체 활동',v:annual.length,c:C.acc2},{label:'성공',v:annualCounts['성공'],c:C.acc},{label:'접촉',v:annualCounts['접촉완료'],c:C.blue},{label:'미처리',v:annualCounts['미처리'],c:'#d97706'}].map((s2,i)=>(<div key={i} style={{flex:1,background:'#f8fafc',borderRadius:'10px',padding:'10px 6px',textAlign:'center',border:'1px solid #e2e8f0'}}><div style={{fontSize:'18px',fontWeight:'900',color:s2.c}}>{s2.v}</div><div style={{fontSize:'10px',color:C.sub,marginTop:'3px'}}>{s2.label}</div></div>))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span style={{fontSize:'13px',color:C.sub}}>연간 성공률</span><span style={{fontSize:'16px',fontWeight:'900',color:C.acc}}>{pct(annualCounts['성공'],Math.max(annual.length,1))}%</span></div>
    </>)}

    {card(<>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'14px',fontWeight:'700',color:C.text}}>이달 목표 진행</span><span style={{fontSize:'16px',fontWeight:'900',color:C.acc}}>{sc} / {goal}건</span></div>
      <div style={{background:'#e2e8f0',borderRadius:'6px',height:'10px',overflow:'hidden',marginBottom:'8px'}}><div style={{width:Math.min(pct(sc,goal),100)+'%',background:C.acc,height:'100%',borderRadius:'6px'}}/></div>
      <div style={{fontSize:'12px',color:C.sub}}>목표까지 <strong style={{color:C.acc}}>{Math.max(goal-sc,0)}건</strong> 남음</div>
    </>)}
  </div>)
}

// ── 활동결과 모달 ─────────────────────────────────────────────────
function ResultModal({lead,onClose,onSave}){
  const [form,setForm]=useState({status:lead.activity_status||'미처리',result:lead.activity_result||'',memo:lead.activity_memo||'',contact:lead.activity_contact||'',photos:(()=>{try{return JSON.parse(lead.photos||'[]')}catch{return[]}})()})
  const set=useCallback((k,v)=>setForm(prev=>({...prev,[k]:v})),[])
  const statBg={'미처리':'#f59e0b','접촉완료':C.blue,'성공':C.acc,'실패':C.red}
  return(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:999,backdropFilter:'blur(3px)'}}>
    <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'24px 20px 36px',width:'100%',maxWidth:'420px',boxShadow:'0 -4px 24px rgba(0,0,0,0.12)',position:'relative',maxHeight:'92vh',overflowY:'auto'}}>
      <button onClick={onClose} style={{position:'absolute',top:'16px',right:'16px',background:'#f1f5f9',border:'none',color:C.sub,width:'28px',height:'28px',borderRadius:'50%',fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      <h3 style={{fontSize:'18px',fontWeight:'900',marginBottom:'4px',color:C.text}}>활동 결과 {form.status!=='미처리'?'수정':'입력'}</h3>
      <p style={{color:C.sub,fontSize:'13px',marginBottom:'18px'}}>{lead._src==='c'?lead.address:lead.customer}</p>
      <div style={{marginBottom:'14px'}}>
        <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'8px',color:C.sub}}>방문 상태</div>
        <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
          {['미처리','접촉완료','성공','실패'].map(s=>(<button key={s} onClick={()=>set('status',s)} style={{padding:'10px 16px',background:form.status===s?statBg[s]:'#f8fafc',border:form.status===s?'none':'1.5px solid #e2e8f0',color:form.status===s?'#fff':C.sub,borderRadius:'10px',fontSize:'15px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>{s}</button>))}
        </div>
      </div>
      {[{k:'result',l:'결과 요약',p:'예: 계약완료, 재방문 예정'},{k:'contact',l:'연락처',p:'010-0000-0000'}].map(f=>(<div key={f.k} style={{marginBottom:'11px'}}>
        <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'6px',color:C.sub}}>{f.l}</div>
        <input type="text" placeholder={f.p} value={form[f.k]} onChange={e=>set(f.k,e.target.value)} style={IS}/>
      </div>))}
      <div style={{marginBottom:'14px'}}>
        <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'6px',color:C.sub}}>메모</div>
        <textarea placeholder="특이사항, 다음 액션 등" value={form.memo} onChange={e=>set('memo',e.target.value)} rows={3} style={{...IS,resize:'none'}}/>
      </div>
      <div style={{marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'8px',color:C.sub}}>사진 첨부 (최대 2장)</div>
        <PhotoPicker photos={form.photos} onChange={v=>set('photos',v)}/>
      </div>
      <button onClick={()=>onSave(form)} style={{width:'100%',padding:'15px',background:C.acc,border:'none',color:'#fff',borderRadius:'12px',fontSize:'17px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit'}}>저장하기</button>
    </div>
  </div>)
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function MM({onBack}){
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
      const [cl,ml]=await Promise.all([db.get('connector_leads','assigned_to=eq.'+encodeURIComponent(u.name)),db.get('mm_direct_leads','mm_username=eq.'+u.username+'&order=created_at.desc')])
      setCLeads(cl);setMLeads(ml);setUser(u);setScreen('main')
    }catch(e){setLerr('연결 오류: '+e.message)}
    setLding(false)
  }

  const saveResult=async(form)=>{
    if(!rm)return
    const now=new Date().toISOString()
    const upd={activity_status:form.status,activity_result:form.result,activity_memo:form.memo,activity_contact:form.contact,photos:JSON.stringify(form.photos),activity_at:now}
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
    const newLead={id:'m'+Date.now(),mm_username:user.username,customer:reg.customer,address:reg.address,contact:reg.contact,products:reg.products,note:reg.note,photos:JSON.stringify(reg.photos),activity_status:'미처리',activity_result:'',activity_memo:'',activity_contact:reg.contact,activity_at:''}
    try{await db.post('mm_direct_leads',newLead);setMLeads([newLead,...mLeads]);setRegDone(true);t2('등록 완료!');setTimeout(()=>{setRegDone(false);setReg({customer:'',address:'',contact:'',products:[],note:'',photos:[]});setTab('leads');setLeadTab('my')},1800)}
    catch(e){t2('등록 실패: '+e.message)}
  }

  const toggleP=p=>setReg(prev=>({...prev,products:prev.products.includes(p)?prev.products.filter(x=>x!==p):[...prev.products,p]}))

  const sc=user?.success||0;const lv=getLv(sc);const nextLv=LEVELS.find(l=>l.lv===lv.lv+1)
  const unproc=cLeads.filter(l=>(l.activity_status||'미처리')==='미처리').length
  const navTabs=[{id:'home',label:'활동현황',icon:'📊'},{id:'leads',label:'영업기회',icon:'📋'},{id:'register',label:'직접등록',icon:'➕'},{id:'growth',label:'내 성장',icon:'📈'}]

  if(screen==='login')return(
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#f8f9ff,#eef2ff)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'30px 28px',fontFamily:"'Noto Sans KR',sans-serif",color:C.text}}>
      <button onClick={onBack} style={{alignSelf:'flex-start',background:'transparent',border:'none',color:C.sub,fontSize:'15px',cursor:'pointer',marginBottom:'32px'}}>‹ 홈으로</button>
      <KTLogo/>
      <div style={{textAlign:'center',margin:'20px 0 36px'}}>
        <h1 style={{fontSize:'36px',fontWeight:'900',margin:'0 0 8px',color:C.text}}>상권마스터</h1>
        <p style={{color:C.sub,fontSize:'14px',margin:0}}>MM 전용 플랫폼</p>
      </div>
      <div style={{width:'100%',maxWidth:'360px',display:'flex',flexDirection:'column',gap:'12px'}}>
        <input type="text" placeholder="아이디" value={lid} onChange={e=>{setLid(e.target.value);setLerr('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{...IS,padding:'16px',fontSize:'17px',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}/>
        <input type="password" placeholder="비밀번호" value={lpw} onChange={e=>{setLpw(e.target.value);setLerr('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{...IS,padding:'16px',fontSize:'17px',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}/>
        {lerr&&<div style={{color:C.red,fontSize:'14px',textAlign:'center',background:'#fef2f2',border:'1px solid #fecaca',padding:'10px',borderRadius:'8px'}}>{lerr}</div>}
        <button onClick={handleLogin} disabled={lding} style={{background:lding?'#e2e8f0':C.acc,border:'none',color:lding?C.sub:'#fff',padding:'18px',borderRadius:'12px',fontSize:'18px',fontWeight:'900',cursor:lding?'not-allowed':'pointer',fontFamily:'inherit',marginTop:'6px',boxShadow:lding?'none':'0 4px 14px rgba(22,163,74,0.3)'}}>{lding?'로그인 중...':'로그인'}</button>
      </div>
      <p style={{color:C.sub,fontSize:'13px',marginTop:'28px',textAlign:'center'}}>계정이 없으신가요?<br/>관리자에게 문의하세요</p>
    </div>
  )

  return(
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Noto Sans KR',sans-serif",maxWidth:'420px',margin:'0 auto',display:'flex',flexDirection:'column'}}>
      {toast&&<div style={{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',background:'#f0fdf4',border:'1.5px solid #86efac',color:C.acc,padding:'12px 24px',borderRadius:'50px',fontSize:'15px',fontWeight:'700',zIndex:9999,whiteSpace:'nowrap',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>✅ {toast}</div>}
      {rm&&<ResultModal lead={rm} onClose={()=>setRm(null)} onSave={saveResult}/>}

      {/* 헤더 */}
      <div style={{background:'#fff',padding:'16px 20px 14px',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:50,boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <KTLogo/>
            <div>
              <div style={{fontSize:'16px',fontWeight:'900',color:C.acc,lineHeight:1}}>상권마스터</div>
              <div style={{fontSize:'11px',color:C.sub,marginTop:'2px'}}>{user?.name} MM · {user?.region}</div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',background:C.accBg,border:'1px solid '+C.accBorder,borderRadius:'20px',padding:'5px 12px'}}>
              <span style={{fontSize:'14px'}}>{lv.icon}</span><span style={{fontSize:'12px',fontWeight:'800',color:lv.color}}>Lv.{lv.lv} {lv.name}</span>
            </div>
            <button onClick={()=>{setScreen('login');setUser(null)}} style={{background:'transparent',border:'none',color:C.sub,fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}}>로그아웃</button>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
        {tab==='home'&&(
          <div>
            <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
              {['일간','주간','월간','연간'].map(p=>(<button key={p} onClick={()=>setPeriod(p)} style={{flex:1,padding:'9px 0',background:period===p?C.acc:'#fff',border:'1px solid '+(period===p?C.acc:'#e2e8f0'),color:period===p?'#fff':C.sub,borderRadius:'10px',fontSize:'14px',fontWeight:period===p?'900':'500',cursor:'pointer',fontFamily:'inherit'}}>{p}</button>))}
            </div>
            <div style={{background:'#fff',border:'1.5px solid '+lv.color+'44',borderRadius:'14px',padding:'14px 16px',marginBottom:'12px',display:'flex',alignItems:'center',gap:'12px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              <span style={{fontSize:'36px'}}>{lv.icon}</span>
              <div style={{flex:1}}><div style={{fontSize:'13px',color:C.sub}}>현재 레벨</div><div style={{fontSize:'22px',fontWeight:'900',color:lv.color}}>Lv.{lv.lv} {lv.name}</div></div>
              {nextLv&&<div style={{textAlign:'right'}}><div style={{fontSize:'11px',color:C.sub}}>다음까지</div><div style={{fontSize:'16px',fontWeight:'900',color:lv.color}}>{nextLv.min-sc}건</div></div>}
            </div>
            {unproc>0&&<div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:'12px',padding:'12px 16px',marginBottom:'12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:'14px',fontWeight:'800',color:'#b45309'}}>⚠️ 미처리 기회 {unproc}건</div>
              <button onClick={()=>{setTab('leads');setLeadTab('connector')}} style={{background:'#f59e0b',border:'none',color:'#fff',padding:'7px 12px',borderRadius:'8px',fontSize:'13px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit'}}>확인 →</button>
            </div>}
            <MMDashboard cLeads={cLeads} mLeads={mLeads} user={user} period={period}/>
          </div>
        )}

        {tab==='leads'&&(
          <div>
            <h2 style={{fontSize:'19px',fontWeight:'900',marginBottom:'14px',color:C.text}}>영업기회 관리</h2>
            <div style={{display:'flex',background:'#f1f5f9',borderRadius:'12px',padding:'4px',marginBottom:'14px'}}>
              <button onClick={()=>setLeadTab('connector')} style={{flex:1,padding:'10px',background:leadTab==='connector'?C.blue:'transparent',color:leadTab==='connector'?'#fff':C.sub,border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>📤 관리자 배분 ({cLeads.length})</button>
              <button onClick={()=>setLeadTab('my')} style={{flex:1,padding:'10px',background:leadTab==='my'?C.acc:'transparent',color:leadTab==='my'?'#fff':C.sub,border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>🔍 직접발굴 ({mLeads.length})</button>
            </div>

            {leadTab==='connector'&&(cLeads.length===0
              ?<div style={{textAlign:'center',padding:'50px 20px',color:C.sub}}>배분된 기회가 없습니다</div>
              :cLeads.map(l=>{
                const photos=(()=>{try{return JSON.parse(l.photos||'[]')}catch{return[]}})()
                return(<div key={l.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderLeft:'4px solid '+C.blue,borderRadius:'12px',padding:'14px',marginBottom:'10px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                    <div style={{flex:1,marginRight:'10px'}}>
                      <div style={{fontSize:'11px',color:C.blue,fontWeight:'700',marginBottom:'4px'}}>📤 관리자 배분</div>
                      <div style={{fontSize:'14px',fontWeight:'800',color:C.text,lineHeight:'1.4'}}>{l.address||l.col2||'-'}</div>
                      <div style={{color:C.sub,fontSize:'12px',marginTop:'3px'}}>{[l.col1,l.col3,l.col4].filter(Boolean).join(' · ')}</div>
                    </div>
                    <Badge s={l.activity_status||'미처리'}/>
                  </div>
                  {l.activity_at&&<div style={{fontSize:'11px',color:C.sub,marginBottom:'6px'}}>📅 {fmtAt(l.activity_at)}</div>}
                  {(l.activity_result||l.activity_contact||l.activity_memo)&&<div style={{background:'#f8fafc',borderRadius:'8px',padding:'8px 10px',marginBottom:'8px',fontSize:'13px',color:C.sub}}>
                    {l.activity_contact&&<div>📞 {l.activity_contact}</div>}
                    {l.activity_result&&<div>📝 {l.activity_result}</div>}
                    {l.activity_memo&&<div>💬 {l.activity_memo}</div>}
                  </div>}
                  {photos.length>0&&<div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>{photos.map((src,i)=><img key={i} src={src} alt="사진" style={{width:'60px',height:'60px',objectFit:'cover',borderRadius:'8px',border:'1px solid #e2e8f0'}}/>)}</div>}
                  <button onClick={()=>setRm({...l,_src:'c'})} style={{width:'100%',background:l.activity_status&&l.activity_status!=='미처리'?'#f8fafc':C.blueBg,border:'1px solid '+(l.activity_status&&l.activity_status!=='미처리'?'#e2e8f0':'#bfdbfe'),color:l.activity_status&&l.activity_status!=='미처리'?C.sub:C.blue,padding:'10px',borderRadius:'8px',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>
                    {l.activity_status&&l.activity_status!=='미처리'?'✏️ 결과 수정':'활동 결과 입력'}
                  </button>
                </div>)
              })
            )}

            {leadTab==='my'&&(mLeads.length===0
              ?<div style={{textAlign:'center',padding:'50px 20px',color:C.sub}}>직접 등록한 기회가 없습니다<br/><span style={{fontSize:'14px'}}>➕ 탭에서 등록하세요</span></div>
              :mLeads.map(l=>{
                const photos=(()=>{try{return JSON.parse(l.photos||'[]')}catch{return[]}})()
                return(<div key={l.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderLeft:'4px solid '+C.acc,borderRadius:'12px',padding:'14px',marginBottom:'10px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                    <div style={{flex:1,marginRight:'10px'}}>
                      <div style={{fontSize:'11px',color:C.acc,fontWeight:'700',marginBottom:'4px'}}>🔍 직접 발굴</div>
                      <div style={{fontSize:'15px',fontWeight:'800',color:C.text}}>{l.customer}</div>
                      <div style={{color:C.sub,fontSize:'12px',marginTop:'2px'}}>{l.address}{l.contact&&' · 📞 '+l.contact}</div>
                      {l.note&&<div style={{color:C.sub,fontSize:'12px',marginTop:'2px'}}>📋 {l.note}</div>}
                    </div>
                    <Badge s={l.activity_status||'미처리'}/>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'8px'}}>
                    {l.products?.map(p=><span key={p} style={{background:C.accBg,color:C.acc,border:'1px solid '+C.accBorder,fontSize:'11px',fontWeight:'700',padding:'3px 8px',borderRadius:'4px'}}>{p}</span>)}
                  </div>
                  {l.activity_at&&<div style={{fontSize:'11px',color:C.sub,marginBottom:'6px'}}>📅 {fmtAt(l.activity_at)}</div>}
                  {(l.activity_result||l.activity_contact||l.activity_memo)&&<div style={{background:'#f8fafc',borderRadius:'8px',padding:'8px 10px',marginBottom:'8px',fontSize:'13px',color:C.sub}}>
                    {l.activity_contact&&<div>📞 {l.activity_contact}</div>}
                    {l.activity_result&&<div>📝 {l.activity_result}</div>}
                    {l.activity_memo&&<div>💬 {l.activity_memo}</div>}
                  </div>}
                  {photos.length>0&&<div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>{photos.map((src,i)=><img key={i} src={src} alt="사진" style={{width:'60px',height:'60px',objectFit:'cover',borderRadius:'8px',border:'1px solid #e2e8f0'}}/>)}</div>}
                  <button onClick={()=>setRm({...l,_src:'m'})} style={{width:'100%',background:l.activity_status&&l.activity_status!=='미처리'?'#f8fafc':C.accBg,border:'1px solid '+(l.activity_status&&l.activity_status!=='미처리'?'#e2e8f0':C.accBorder),color:l.activity_status&&l.activity_status!=='미처리'?C.sub:C.acc,padding:'10px',borderRadius:'8px',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>
                    {l.activity_status&&l.activity_status!=='미처리'?'✏️ 결과 수정':'활동 결과 입력'}
                  </button>
                </div>)
              })
            )}
          </div>
        )}

        {tab==='register'&&(
          <div>
            <h2 style={{fontSize:'19px',fontWeight:'900',marginBottom:'18px',color:C.text}}>직접 발굴 등록</h2>
            {regDone
              ?<div style={{textAlign:'center',padding:'50px 20px',background:C.accBg,border:'1px solid '+C.accBorder,borderRadius:'18px'}}><div style={{fontSize:'56px',marginBottom:'14px'}}>✅</div><div style={{fontSize:'22px',fontWeight:'900',color:C.acc}}>등록 완료!</div></div>
              :<div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                {[{k:'customer',l:'고객명',p:'예: 행복분식',r:true},{k:'address',l:'주소',p:'예: 강남구 역삼동 123'},{k:'contact',l:'연락처',p:'010-0000-0000',t:'tel'}].map(f=>(<div key={f.k}>
                  <label style={{fontSize:'14px',color:C.sub,fontWeight:'700',display:'block',marginBottom:'7px'}}>{f.l} {f.r&&<span style={{color:C.red}}>*</span>}</label>
                  <input type={f.t||'text'} placeholder={f.p} value={reg[f.k]} onChange={e=>setReg(prev=>({...prev,[f.k]:e.target.value}))} style={IS}/>
                </div>))}
                <div>
                  <label style={{fontSize:'14px',color:C.sub,fontWeight:'700',display:'block',marginBottom:'9px'}}>상품군 <span style={{color:C.red}}>*</span> <span style={{fontSize:'12px',color:C.sub,fontWeight:'400'}}>(중복 선택)</span></label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                    {PRODUCTS.map(p=>{const sel=reg.products.includes(p);return(<button key={p} onClick={()=>toggleP(p)} style={{padding:'11px 16px',background:sel?C.acc:'#f8fafc',border:sel?'none':'1.5px solid #e2e8f0',color:sel?'#fff':C.sub,borderRadius:'10px',fontSize:'15px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>{sel?'✓ ':''}{p}</button>)})}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:'14px',color:C.sub,fontWeight:'700',display:'block',marginBottom:'7px'}}>비고 (상세사항)</label>
                  <textarea placeholder="특이사항, 상세 정보 등" value={reg.note} onChange={e=>setReg(prev=>({...prev,note:e.target.value}))} rows={3} style={{...IS,resize:'none'}}/>
                </div>
                <div>
                  <label style={{fontSize:'14px',color:C.sub,fontWeight:'700',display:'block',marginBottom:'8px'}}>사진 첨부 (최대 2장)</label>
                  <PhotoPicker photos={reg.photos} onChange={v=>setReg(prev=>({...prev,photos:v}))}/>
                </div>
                <button onClick={handleReg} disabled={!reg.customer||!reg.products.length} style={{background:reg.customer&&reg.products.length?C.acc:'#e2e8f0',border:'none',color:reg.customer&&reg.products.length?'#fff':C.sub,padding:'18px',borderRadius:'14px',fontSize:'18px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit'}}>등록하기</button>
              </div>
            }
          </div>
        )}

        {tab==='growth'&&(
          <div>
            <h2 style={{fontSize:'19px',fontWeight:'900',marginBottom:'16px',color:C.text}}>내 성장 레벨</h2>
            <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'20px',marginBottom:'16px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              <div style={{display:'flex',alignItems:'flex-end',gap:'8px',height:'120px',justifyContent:'center'}}>
                {LEVELS.map((l,i)=>{const reached=sc>=l.min;const cur=lv.lv===l.lv;const h=22+i*20;return(
                  <div key={l.lv} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                    <div style={{height:'20px',display:'flex',alignItems:'center'}}>{cur&&<span style={{fontSize:'13px',color:l.color}}>▼</span>}</div>
                    <div style={{width:'46px',height:h+'px',background:reached?l.color+'33':'#f1f5f9',borderRadius:'6px 6px 0 0',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'6px',border:cur?'2px solid '+l.color:'1px solid #e2e8f0'}}><span style={{fontSize:'16px'}}>{l.icon}</span></div>
                    <div style={{fontSize:'11px',fontWeight:'700',color:reached?l.color:'#94a3b8'}}>Lv.{l.lv}</div>
                  </div>
                )})}
              </div>
            </div>
            {LEVELS.map(l=>{const reached=sc>=l.min;const cur=lv.lv===l.lv;return(
              <div key={l.lv} style={{background:cur?l.color+'08':'#fff',border:cur?'2px solid '+l.color:'1px solid #e2e8f0',borderRadius:'12px',padding:'14px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                <span style={{fontSize:'26px'}}>{l.icon}</span>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}><span style={{fontSize:'16px',fontWeight:'800',color:reached?l.color:'#94a3b8'}}>Lv.{l.lv} {l.name}</span>{cur&&<span style={{background:l.color,color:'#fff',fontSize:'10px',fontWeight:'900',padding:'2px 8px',borderRadius:'10px'}}>현재</span>}</div>
                  <div style={{color:C.sub,fontSize:'13px',marginTop:'2px'}}>{l.lv<5?'성공 '+l.min+'~'+l.max+'건':'성공 '+l.min+'건 이상'}</div>
                </div>
                {reached&&<span style={{fontSize:'18px'}}>✅</span>}
              </div>
            )})}
          </div>
        )}
      </div>

      <div style={{background:'#fff',borderTop:'1px solid #e2e8f0',display:'flex',padding:'8px 0',boxShadow:'0 -2px 8px rgba(0,0,0,0.05)'}}>
        {navTabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:'none',border:'none',color:tab===t.id?C.acc:'#94a3b8',cursor:'pointer',padding:'6px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',fontFamily:'inherit'}}>
          <span style={{fontSize:'20px'}}>{t.icon}</span>
          <span style={{fontSize:'11px',fontWeight:tab===t.id?'800':'500'}}>{t.label}</span>
        </button>))}
      </div>
    </div>
  )
}
