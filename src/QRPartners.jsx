import { useState, useCallback, useRef, useEffect } from 'react'
import { db } from './supabase'
import QRCode from 'qrcode'

const C = {
  bg:'#f8fafc', text:'#0f172a', sub:'#64748b', acc:'#e67e00', accBg:'#fff7ed', accBorder:'#fed7aa',
  blue:'#2563eb', blueBg:'#eff6ff', green:'#16a34a', red:'#dc2626'
}

// 업종별 A3 전단 문구 템플릿
const INDUSTRY_TEMPLATES = {
  '무인문구점':{ icon:'📚', headline:(s)=>`우리 아이 스마트폰 요금,\n가족이 함께 묶으면 매달 절약!`, sub:(s)=>`KT와 ${s}가 함께하는\n가족 통신비 절감 이벤트`, color:'#2563eb' },
  '무인빨래방':{ icon:'🧺', headline:(s)=>`빨래 기다리는 5분,\n통신비 줄이는 시간으로`, sub:(s)=>`1인 가구 인터넷+모바일 결합\nKT와 ${s}가 함께합니다`, color:'#0891b2' },
  '셀프카페':{ icon:'☕', headline:(s)=>`카페에서 일하는 당신께,\n데이터 걱정 없는 무제한`, sub:(s)=>`KT와 ${s}가 함께하는\n데이터 혜택 이벤트`, color:'#d97706' },
  '무인서점':{ icon:'📖', headline:(s)=>`책과 콘텐츠를 한 번에,\nOTT 결합으로 더 똑똑하게`, sub:(s)=>`KT와 ${s}가 함께하는\n콘텐츠 혜택 이벤트`, color:'#7c3aed' },
  '무인의류':{ icon:'👕', headline:(s)=>`스타일에 데이터를 더하다,\n멤버십 할인 제휴`, sub:(s)=>`KT와 ${s}가 함께하는\n멤버십 혜택 이벤트`, color:'#db2777' },
  '무인마트':{ icon:'🛒', headline:(s)=>`온 가족 인터넷+TV 결합,\n통신비를 확 줄이세요`, sub:(s)=>`KT와 ${s}가 함께하는\n가족 결합 이벤트`, color:'#16a34a' },
  '기타':{ icon:'🏪', headline:(s)=>`KT 통신비 절감 혜택,\n지금 QR로 확인하세요`, sub:(s)=>`KT와 ${s}가 함께하는\n특별 제휴 이벤트`, color:'#e67e00' }
}
const INDUSTRIES = Object.keys(INDUSTRY_TEMPLATES)

export default function QRPartners({ onBack }) {
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('stores')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState('')
  const [toast, setToast] = useState('')
  const [stores, setStores] = useState([])
  const [leads, setLeads] = useState([])
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [storeForm, setStoreForm] = useState({ store_name:'', industry:'무인문구점', owner_contact:'', address:'', benefit_note:'월1건 통신비지원 / 2건이상 관리비지원' })
  const [flyerStore, setFlyerStore] = useState(null)

  const t2 = useCallback((m)=>{ setToast(m); setTimeout(()=>setToast(''),2500) },[])

  const load = useCallback(async (u)=>{
    try {
      const [st, ld] = await Promise.all([
        db.get('qr_stores','select=*&partner_username=eq.'+u.username+'&order=created_at.desc').catch(()=>[]),
        db.get('qr_leads','select=*&partner_username=eq.'+u.username+'&order=created_at.desc').catch(()=>[])
      ])
      setStores(st||[]); setLeads(ld||[])
    } catch(e){ console.error(e) }
  },[])

  const login = async ()=>{
    setLerr('')
    if(!lid||!lpw){ setLerr('아이디와 비밀번호를 입력하세요'); return }
    try {
      const idTrim = lid.trim(), pwTrim = lpw.trim()
      // 1) QR 파트너스 계정 조회 (대소문자 무시)
      const all = await db.get('qr_partners','select=*').catch(()=>[])
      let u = (all||[]).find(p => (p.username||'').toLowerCase() === idTrim.toLowerCase() && (p.password||'').trim() === pwTrim)
      // 2) 없으면 상권마스터(mm_users) 계정으로 로그인 시도 → QR 파트너스 자동 등록
      if(!u){
        const mms = await db.get('mm_users','select=*').catch(()=>[])
        const mm = (mms||[]).find(m => (m.username||'').toLowerCase() === idTrim.toLowerCase() && String(m.password||'').trim() === pwTrim)
        if(mm){
          // QR 파트너스에 자동 등록
          const code = 'QRP-'+mm.username+'-'+String(Date.now()).slice(-4)
          const newP = { username:mm.username, password:String(mm.password), name:mm.name, team_id:mm.team_id, qr_code:code }
          const res = await db.post('qr_partners', newP).catch(()=>null)
          u = { ...newP, id:(Array.isArray(res)?res[0]?.id:res?.id)||Date.now() }
        }
      }
      if(!u){ setLerr('아이디 또는 비밀번호가 올바르지 않습니다'); return }
      // QR 코드 없으면 생성
      if(!u.qr_code){
        const code = 'QRP-'+u.username+'-'+String(Date.now()).slice(-4)
        await db.patch('qr_partners','id=eq.'+u.id,{qr_code:code}).catch(()=>{})
        u.qr_code = code
      }
      setUser(u); await load(u); setScreen('main')
    } catch(e){ setLerr('연결 오류: '+e.message) }
  }

  // ── 로그인 화면 ──
  if(screen==='login') return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#1a1410,#2d1f12)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'30px 28px',fontFamily:"'Noto Sans KR',sans-serif",color:'#fff'}}>
      <button onClick={onBack} style={{alignSelf:'flex-start',background:'transparent',border:'none',color:'rgba(255,255,255,0.6)',fontSize:'15px',cursor:'pointer',marginBottom:'32px'}}>‹ 홈으로</button>
      <div style={{fontSize:'64px',marginBottom:'12px'}}>📱</div>
      <h1 style={{fontSize:'34px',fontWeight:'900',margin:'0 0 8px',color:'#fff'}}>QR 파트너스</h1>
      <p style={{color:'rgba(255,255,255,0.6)',fontSize:'14px',margin:'0 0 36px',textAlign:'center'}}>무인매장 QR 제휴 영업</p>
      <div style={{width:'100%',maxWidth:'340px',display:'flex',flexDirection:'column',gap:'12px'}}>
        <input value={lid} onChange={e=>setLid(e.target.value)} placeholder="아이디"
          style={{padding:'15px 18px',borderRadius:'12px',border:'1.5px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'#fff',fontSize:'15px',fontFamily:'inherit',boxSizing:'border-box'}}/>
        <input value={lpw} onChange={e=>setLpw(e.target.value)} type="password" placeholder="비밀번호" onKeyDown={e=>e.key==='Enter'&&login()}
          style={{padding:'15px 18px',borderRadius:'12px',border:'1.5px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'#fff',fontSize:'15px',fontFamily:'inherit',boxSizing:'border-box'}}/>
        {lerr&&<div style={{color:'#fca5a5',fontSize:'13px',textAlign:'center'}}>{lerr}</div>}
        <button onClick={login} style={{padding:'15px',borderRadius:'12px',border:'none',background:'linear-gradient(145deg,#e67e00,#f59e0b)',color:'#fff',fontSize:'16px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',marginTop:'4px'}}>로그인</button>
      </div>
    </div>
  )

  // 통계
  const totalScans = stores.reduce((a,s)=>a+(s.scan_count||0),0)
  const totalLeads = leads.length
  const successLeads = leads.filter(l=>l.status==='가입성공').length
  const monthLeads = leads.filter(l=>{const d=new Date(l.created_at);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}).length

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Noto Sans KR',sans-serif",maxWidth:'440px',margin:'0 auto',display:'flex',flexDirection:'column'}}>
      {toast&&<div style={{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',background:C.accBg,border:'1.5px solid '+C.accBorder,color:C.acc,padding:'12px 24px',borderRadius:'50px',fontSize:'14px',fontWeight:'700',zIndex:500,boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>{toast}</div>}
      {/* 헤더 + 네비 */}
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,0.05)',position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px 0'}}>
          <span style={{fontSize:'17px',fontWeight:'900',color:C.acc}}>📱 QR 파트너스</span>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'12px',color:C.sub}}>{user?.name}</span>
            <button onClick={onBack} style={{background:'none',border:'none',color:C.sub,fontSize:'12px',cursor:'pointer'}}>로그아웃</button>
          </div>
        </div>
        <div style={{display:'flex',padding:'6px 4px 0',gap:'2px'}}>
          {[['stores','내 매장','🏪'],['leads','상담 실적','📞'],['myqr','내 QR','📱']].map(([id,label,icon])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,background:'none',border:'none',borderBottom:tab===id?'2.5px solid '+C.acc:'2.5px solid transparent',color:tab===id?C.acc:'#94a3b8',cursor:'pointer',padding:'8px 4px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',fontFamily:'inherit'}}>
              <span style={{fontSize:'18px'}}>{icon}</span>
              <span style={{fontSize:'11px',fontWeight:tab===id?'800':'500'}}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
        {/* 대시보드 요약 (공통) */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px',marginBottom:'14px'}}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'10px 6px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:C.acc}}>{stores.length}</div><div style={{fontSize:'10px',color:C.sub}}>등록 매장</div></div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'10px 6px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:C.blue}}>{totalScans}</div><div style={{fontSize:'10px',color:C.sub}}>QR 스캔</div></div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'10px 6px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:'#7c3aed'}}>{totalLeads}</div><div style={{fontSize:'10px',color:C.sub}}>상담 요청</div></div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'10px 6px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:C.green}}>{successLeads}</div><div style={{fontSize:'10px',color:C.sub}}>가입 성공</div></div>
        </div>

        {/* 내 매장 탭 */}
        {tab==='stores'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
              <h2 style={{fontSize:'18px',fontWeight:'900',margin:0}}>🏪 내 매장</h2>
              <button onClick={()=>setShowStoreForm(true)} style={{background:C.acc,color:'#fff',border:'none',borderRadius:'10px',padding:'8px 14px',fontSize:'13px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>+ 매장 등록</button>
            </div>
            {stores.length===0
              ?<div style={{textAlign:'center',padding:'40px 0',color:C.sub,fontSize:'14px'}}>등록된 매장이 없습니다<br/><span style={{fontSize:'12px'}}>매장을 등록하면 전용 QR 전단을 만들 수 있습니다</span></div>
              :stores.map(s=>{
                const tpl=INDUSTRY_TEMPLATES[s.industry]||INDUSTRY_TEMPLATES['기타']
                const storeLeads=leads.filter(l=>l.store_code===s.store_code)
                return(
                  <div key={s.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'14px',marginBottom:'10px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                      <span style={{fontSize:'15px',fontWeight:'800'}}>{tpl.icon} {s.store_name}</span>
                      <span style={{fontSize:'11px',padding:'2px 10px',borderRadius:'10px',background:tpl.color+'18',color:tpl.color,fontWeight:'700'}}>{s.industry}</span>
                    </div>
                    <div style={{fontSize:'12px',color:C.sub,marginBottom:'3px'}}>📍 {s.address||'-'}</div>
                    {s.owner_contact&&<div style={{fontSize:'12px',color:C.sub,marginBottom:'3px'}}>📞 점주: {s.owner_contact}</div>}
                    <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                      <span style={{fontSize:'11px',background:C.blueBg,color:C.blue,padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>스캔 {s.scan_count||0}</span>
                      <span style={{fontSize:'11px',background:'#faf5ff',color:'#7c3aed',padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>상담 {storeLeads.length}</span>
                      <span style={{fontSize:'11px',background:'#f0fdf4',color:C.green,padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>성공 {storeLeads.filter(l=>l.status==='가입성공').length}</span>
                    </div>
                    <button onClick={()=>setFlyerStore(s)} style={{width:'100%',marginTop:'10px',background:C.accBg,border:'1px solid '+C.accBorder,color:C.acc,borderRadius:'10px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>📄 A3 전단 / QR 다운로드</button>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* 상담 실적 탭 */}
        {tab==='leads'&&(
          <div>
            <h2 style={{fontSize:'18px',fontWeight:'900',margin:'0 0 12px'}}>📞 상담 실적</h2>
            <div style={{background:C.accBg,border:'1px solid '+C.accBorder,borderRadius:'10px',padding:'10px 12px',marginBottom:'12px',fontSize:'12px',color:'#92400e'}}>이번 달 상담 요청 <b>{monthLeads}건</b> · 누적 성공 <b>{successLeads}건</b></div>
            {leads.length===0
              ?<div style={{textAlign:'center',padding:'40px 0',color:C.sub,fontSize:'14px'}}>아직 상담 요청이 없습니다<br/><span style={{fontSize:'12px'}}>고객이 QR로 접속해 상담을 요청하면 표시됩니다</span></div>
              :leads.map(l=>{
                const sc={'상담요청':['#fef3c7','#92400e'],'연결완료':['#eff6ff','#1d4ed8'],'가입성공':['#dcfce7','#15803d'],'실패':['#fee2e2','#dc2626']}[l.status]||['#f1f5f9','#64748b']
                return(
                  <div key={l.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'12px',marginBottom:'8px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'}}>
                      <span style={{fontWeight:'800',fontSize:'14px'}}>{l.customer_name||'고객'}</span>
                      <select value={l.status} onChange={async e=>{
                        await db.patch('qr_leads','id=eq.'+l.id,{status:e.target.value}).catch(()=>{})
                        setLeads(prev=>prev.map(x=>x.id===l.id?{...x,status:e.target.value}:x))
                      }} style={{fontSize:'11px',padding:'3px 8px',borderRadius:'8px',border:'1px solid '+sc[1],background:sc[0],color:sc[1],fontWeight:'700',fontFamily:'inherit'}}>
                        {['상담요청','연결완료','가입성공','실패'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{fontSize:'12px',color:C.sub}}>🏪 {l.store_name} · 📞 {l.customer_contact||'-'}</div>
                    {l.interest_product&&<div style={{fontSize:'12px',color:C.blue,marginTop:'3px'}}>관심: {l.interest_product}</div>}
                    <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px'}}>{new Date(l.created_at).toLocaleString('ko-KR')}</div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* 내 QR 탭 */}
        {tab==='myqr'&&<MyQRTab user={user}/>}
      </div>

      {/* 매장 등록 폼 */}
      {showStoreForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px',width:'100%',maxWidth:'440px',margin:'0 auto',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontWeight:'900',fontSize:'17px',marginBottom:'16px'}}>🏪 매장 등록</div>
            <div style={{marginBottom:'10px'}}>
              <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>매장명 <span style={{color:C.red}}>*</span></div>
              <input value={storeForm.store_name} onChange={e=>setStoreForm(p=>({...p,store_name:e.target.value}))} placeholder="예: 행복문구"
                style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'9px 11px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div style={{marginBottom:'10px'}}>
              <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>업종 <span style={{color:C.red}}>*</span></div>
              <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                {INDUSTRIES.map(ind=>(
                  <button key={ind} onClick={()=>setStoreForm(p=>({...p,industry:ind}))} style={{padding:'7px 12px',background:storeForm.industry===ind?'#1e293b':'#fff',border:'1.5px solid '+(storeForm.industry===ind?'#1e293b':'#e2e8f0'),color:storeForm.industry===ind?'#fff':C.sub,borderRadius:'20px',fontSize:'12px',fontWeight:storeForm.industry===ind?'700':'500',cursor:'pointer',fontFamily:'inherit'}}>{INDUSTRY_TEMPLATES[ind].icon} {ind}</button>
                ))}
              </div>
            </div>
            {[['owner_contact','사업주 연락처','예: 010-1234-5678'],['address','주소','예: 김해시 풍유동 117']].map(([k,label,ph])=>(
              <div key={k} style={{marginBottom:'10px'}}>
                <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>{label}</div>
                <input value={storeForm[k]} onChange={e=>setStoreForm(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'9px 11px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
            <div style={{marginBottom:'10px'}}>
              <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>혜택 조건</div>
              <textarea value={storeForm.benefit_note} onChange={e=>setStoreForm(p=>({...p,benefit_note:e.target.value}))} rows={2}
                style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'9px 11px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
            </div>
            <div style={{display:'flex',gap:'8px',marginTop:'14px'}}>
              <button onClick={()=>setShowStoreForm(false)} style={{flex:1,padding:'12px',background:'#f1f5f9',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>취소</button>
              <button onClick={async()=>{
                if(!storeForm.store_name){alert('매장명을 입력하세요');return}
                const code='QRS-'+user.username+'-'+String(Date.now()).slice(-6)
                const newStore={...storeForm,partner_username:user.username,partner_name:user.name,team_id:user.team_id,store_code:code,scan_count:0,created_at:new Date().toISOString()}
                const res=await db.post('qr_stores',newStore).catch(e=>{alert('저장 실패: '+e.message);return null})
                if(res){setStores(p=>[{...newStore,id:(Array.isArray(res)?res[0]?.id:res?.id)||Date.now()},...p]);setShowStoreForm(false);setStoreForm({store_name:'',industry:'무인문구점',owner_contact:'',address:'',benefit_note:'월1건 통신비지원 / 2건이상 관리비지원'});t2('매장 등록 완료!')}
              }} style={{flex:2,padding:'12px',background:C.acc,color:'#fff',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* A3 전단 모달 */}
      {flyerStore&&<FlyerModal store={flyerStore} onClose={()=>setFlyerStore(null)}/>}
    </div>
  )
}

// ── 내 QR 탭 ──
function MyQRTab({ user }){
  const [dataUrl, setDataUrl] = useState('')
  useEffect(()=>{
    const url = window.location.origin + '/#qr-partner-' + (user?.qr_code||user?.username)
    QRCode.toDataURL(url,{width:400,margin:2,color:{dark:'#16213e',light:'#ffffff'}}).then(setDataUrl).catch(()=>{})
  },[user])
  const download=()=>{
    if(!dataUrl)return
    const a=document.createElement('a');a.href=dataUrl;a.download='내QR_'+user.name+'.png';a.click()
  }
  return(
    <div>
      <h2 style={{fontSize:'18px',fontWeight:'900',margin:'0 0 12px'}}>📱 내 QR 코드</h2>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'24px',textAlign:'center'}}>
        <div style={{fontSize:'13px',color:C.sub,marginBottom:'16px'}}>이 QR은 <b>{user?.name}</b>님의 고유 코드입니다</div>
        {dataUrl&&<img src={dataUrl} alt="QR" style={{width:'220px',height:'220px',borderRadius:'12px',border:'1px solid #e2e8f0'}}/>}
        <div style={{fontSize:'11px',color:'#94a3b8',margin:'12px 0',fontFamily:'monospace'}}>{user?.qr_code}</div>
        <button onClick={download} style={{width:'100%',background:C.acc,color:'#fff',border:'none',borderRadius:'12px',padding:'13px',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>📥 QR 이미지 다운로드</button>
      </div>
      <div style={{marginTop:'14px',background:C.accBg,border:'1px solid '+C.accBorder,borderRadius:'12px',padding:'14px',fontSize:'12px',color:'#92400e',lineHeight:1.7}}>
        💡 매장별 전용 전단은 <b>내 매장</b> 탭에서 각 매장의 'A3 전단 다운로드'로 만들 수 있습니다. 매장별 QR은 어느 매장에서 유입됐는지 정확히 추적됩니다.
      </div>
    </div>
  )
}

// ── A3 전단 모달 ──
function FlyerModal({ store, onClose }){
  const [qrUrl, setQrUrl] = useState('')
  const flyerRef = useRef()
  const tpl = INDUSTRY_TEMPLATES[store.industry]||INDUSTRY_TEMPLATES['기타']
  useEffect(()=>{
    const url = window.location.origin + '/#qr-store-' + store.store_code
    QRCode.toDataURL(url,{width:600,margin:1,color:{dark:'#16213e',light:'#ffffff'}}).then(setQrUrl).catch(()=>{})
  },[store])

  const downloadPNG = async ()=>{
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(flyerRef.current,{scale:2,backgroundColor:'#ffffff'})
    const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='전단_'+store.store_name+'.png';a.click()
  }
  const downloadPDF = ()=>{ window.print() }

  const hl = tpl.headline(store.store_name)
  const sub = tpl.sub(store.store_name)

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',flexDirection:'column',alignItems:'center',overflowY:'auto',padding:'16px'}}>
      <style>{`@media print{body *{visibility:hidden}#flyer-print,#flyer-print *{visibility:visible}#flyer-print{position:absolute;top:0;left:0;width:210mm;height:297mm}.no-print{display:none!important}}`}</style>
      <div className="no-print" style={{display:'flex',gap:'8px',marginBottom:'12px',width:'100%',maxWidth:'400px'}}>
        <button onClick={onClose} style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.9)',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>닫기</button>
        <button onClick={downloadPNG} style={{flex:1,padding:'12px',background:'#2563eb',color:'#fff',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>📥 이미지</button>
        <button onClick={downloadPDF} style={{flex:1,padding:'12px',background:'#e67e00',color:'#fff',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>🖨 PDF/인쇄</button>
      </div>
      {/* A3 비율(가로세로 1:1.414) 전단 */}
      <div id="flyer-print" ref={flyerRef} style={{width:'360px',aspectRatio:'1/1.414',background:'#fff',borderRadius:'8px',overflow:'hidden',boxShadow:'0 10px 40px rgba(0,0,0,0.3)',display:'flex',flexDirection:'column',fontFamily:"'Noto Sans KR',sans-serif"}}>
        {/* 상단 색상바 */}
        <div style={{background:'linear-gradient(135deg,'+tpl.color+','+tpl.color+'dd)',padding:'24px 24px 20px',color:'#fff',textAlign:'center'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'8px'}}>
            <span style={{fontSize:'20px',fontWeight:'900',background:'#fff',color:'#E31937',padding:'2px 10px',borderRadius:'6px'}}>kt</span>
            <span style={{fontSize:'15px',fontWeight:'700',opacity:0.95}}>×</span>
            <span style={{fontSize:'16px',fontWeight:'800'}}>{store.store_name}</span>
          </div>
          <div style={{fontSize:'13px',opacity:0.9}}>{tpl.icon} 함께하는 특별 혜택</div>
        </div>
        {/* 헤드라인 */}
        <div style={{flex:1,padding:'28px 24px',display:'flex',flexDirection:'column',justifyContent:'center',textAlign:'center'}}>
          <div style={{fontSize:'24px',fontWeight:'900',color:'#16213e',lineHeight:1.4,marginBottom:'16px',whiteSpace:'pre-line'}}>{hl}</div>
          <div style={{fontSize:'15px',color:tpl.color,fontWeight:'700',lineHeight:1.5,whiteSpace:'pre-line',marginBottom:'24px'}}>{sub}</div>
          {/* QR */}
          <div style={{background:'#f8fafc',borderRadius:'16px',padding:'20px',display:'flex',flexDirection:'column',alignItems:'center',border:'2px dashed '+tpl.color}}>
            {qrUrl&&<img src={qrUrl} alt="QR" style={{width:'150px',height:'150px'}}/>}
            <div style={{fontSize:'15px',fontWeight:'900',color:'#16213e',marginTop:'12px'}}>📲 QR 스캔하고 혜택받기</div>
            <div style={{fontSize:'12px',color:C.sub,marginTop:'4px'}}>카메라로 QR을 비춰주세요</div>
          </div>
        </div>
        {/* 혜택 강조 */}
        <div style={{background:'#fff7ed',padding:'16px 24px',borderTop:'2px solid '+tpl.color}}>
          <div style={{fontSize:'13px',fontWeight:'800',color:'#b45309',textAlign:'center',lineHeight:1.6}}>
            🎁 가입 시 매장 점주님께<br/>통신비 · 관리비 지원 혜택!
          </div>
        </div>
        {/* 하단 */}
        <div style={{background:'#16213e',padding:'10px',textAlign:'center'}}>
          <span style={{fontSize:'11px',color:'rgba(255,255,255,0.7)'}}>KT 상권통 · 무인매장 제휴 이벤트</span>
        </div>
      </div>
      <div className="no-print" style={{height:'20px'}}/>
    </div>
  )
}
