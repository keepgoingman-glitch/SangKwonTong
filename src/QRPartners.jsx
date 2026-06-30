import { useState, useCallback, useRef, useEffect, Fragment } from 'react'
import { db } from './supabase'
import QRCode from 'qrcode'

const C = {
  bg:'#f8fafc', text:'#0f172a', sub:'#64748b', acc:'#e67e00', accBg:'#fff7ed', accBorder:'#fed7aa',
  blue:'#2563eb', blueBg:'#eff6ff', green:'#16a34a', red:'#dc2626'
}

// KT 정식 로고 (public/kt-logo.png)
const KTLogo = ({ h=20 }) => (
  <img src="/kt-logo.png" alt="kt" style={{height:h,width:'auto',display:'inline-block',verticalAlign:'middle'}}/>
)

// ── 대분류: 상가용 / 아파트용 ──
const CATEGORIES = {
  store:{ label:'상가용', icon:'🏪', desc:'무인매장·점포 부착' },
  apart:{ label:'아파트용', icon:'🏢', desc:'아파트·주거단지 부착' },
}

// 업종별 A3 전단 문구 템플릿 (상가용)
const INDUSTRY_TEMPLATES = {
  '무인문구점':{
    cat:'store', icon:'✏️', char:'🧑‍🎓', deco:'✏️', industry:'문구점',
    main:'#1d4ed8', dark:'#1e3a8a', barFrom:'#1e3a8a', barTo:'#1d4ed8', barTitle:'#fbbf24', accent:'#E60012',
    speech:'우리 동네 학생·\n학부모 필수혜택!', speechAlign:'left',
    headline:'고객님만을 위한\n특별한 ', headlineHi:'통신 혜택!',
    memo:'인터넷·TV·휴대폰\n우리집 통신비\n얼마나 |아낄 수 있을까?',
    qrLabel:'QR 찍고\n3분 만에 확인!',
    benefits:[['🎁','통신비 절감\n맞춤 컨설팅'],['💰','매장 관리비\n지원 혜택'],['💡','학생·학부모\n특별 제휴']]
  },
  '무인빨래방':{
    cat:'store', icon:'🧺', char:'🫧', deco:'🧺', industry:'빨래방',
    main:'#0284c7', dark:'#0369a1', barFrom:'#075985', barTo:'#0284c7', barTitle:'#7dd3fc', accent:'#0284c7',
    speech:'빨래 돌리는 동안\n똑똑하게 챙기세요!', speechAlign:'right',
    headline:'고객님이라면?', headlineHi:'',
    bubble:'우리집 통신비,\n아직도 비싸게 내고 있을 수 있어요!',
    checks:['인터넷 + TV 결합 할인','휴대폰 요금제 할인','가족결합 추가 할인'],
    qrLabel:'QR 찍고\n무료 진단 받아보세요!',
    badge:'3분이면 OK!',
    benefits:[['💰','통신비 절감\n컨설팅'],['⚡','매장 전기세\n지원 혜택'],['💗','1인 가구\n맞춤 제휴']]
  },
  '셀프카페':{
    cat:'store', icon:'☕', char:'☕', deco:'☕', industry:'카페',
    main:'#b45309', dark:'#92400e', barFrom:'#3f6212', barTo:'#4d7c0f', barTitle:'#bef264', accent:'#16a34a',
    speech:'카페에서 쉬는 시간,\n통신비도 쉬어가세요!', speechAlign:'right',
    headline:'이용 고객님을 위한\n', headlineHi:'특별한 혜택!', headlineHiColor:'#16a34a',
    memo:'내 통신비\n|숨은 할인 찾고\n매달 아껴보세요!',
    qrLabel:'QR 찍고\n지금 바로 확인!',
    benefits:[['☕','데이터 무제한\n요금제'],['📺','인터넷+TV\n결합 할인'],['🎬','OTT·콘텐츠\n추가 혜택']]
  },
  '무인서점':{
    cat:'store', icon:'📖', char:'📚', deco:'📖', industry:'서점',
    main:'#7c3aed', dark:'#6d28d9', barFrom:'#5b21b6', barTo:'#7c3aed', barTitle:'#ddd6fe', accent:'#7c3aed',
    speech:'책 보는 여유,\n통신비도 여유롭게!', speechAlign:'right',
    headline:'고객님을 위한\n', headlineHi:'콘텐츠 혜택!', headlineHiColor:'#7c3aed',
    memo:'책도 OTT도\n|결합하면 더 똑똑\n매달 아껴보세요!',
    qrLabel:'QR 찍고\n혜택 확인!',
    benefits:[['📖','인터넷+OTT\n결합 할인'],['🎬','콘텐츠 구독\n할인 혜택'],['💜','독서 회원\n특별 제휴']]
  },
  '무인의류':{
    cat:'store', icon:'👕', char:'🛍️', deco:'👗', industry:'의류매장',
    main:'#db2777', dark:'#be185d', barFrom:'#9d174d', barTo:'#db2777', barTitle:'#fbcfe8', accent:'#db2777',
    speech:'스타일에 데이터를\n더해보세요!', speechAlign:'right',
    headline:'고객님만을 위한\n', headlineHi:'멤버십 혜택!', headlineHiColor:'#db2777',
    memo:'쇼핑 멤버십에\n|통신 할인까지\n한 번에 챙기기!',
    qrLabel:'QR 찍고\n혜택 확인!',
    benefits:[['🛍️','멤버십+통신\n결합 할인'],['💰','매장 관리비\n지원 혜택'],['💗','쇼핑 회원\n특별 제휴']]
  },
  '무인마트':{
    cat:'store', icon:'🛒', char:'👨‍👩‍👧', deco:'🛒', industry:'마트',
    main:'#16a34a', dark:'#15803d', barFrom:'#14532d', barTo:'#15803d', barTitle:'#86efac', accent:'#ea580c',
    speech:'장 볼 때 아끼는 센스,\n통신비도 챙기세요!', speechAlign:'right',
    headline:'고객님만을 위한\n스마트한 ', headlineHi:'통신 혜택!',
    memo:'인터넷·TV·휴대폰\n지금 그대로 두면\n|손해볼 수 있어요!',
    qrLabel:'QR 찍고\n우리집 통신비\n진단받기!',
    benefits:[['🛍️','통신비 절감\n컨설팅'],['🎁','매장 관리비\n지원 혜택'],['📱','가족결합\n맞춤 혜택']]
  },
  '기타매장':{
    cat:'store', icon:'🏪', char:'📲', deco:'✨', industry:'매장',
    main:'#e67e00', dark:'#d97706', barFrom:'#b45309', barTo:'#d97706', barTitle:'#fcd34d', accent:'#E60012',
    speech:'우리 매장 고객님께\n드리는 특별 혜택!', speechAlign:'right',
    headline:'고객님만을 위한\n특별한 ', headlineHi:'통신 혜택!',
    memo:'인터넷·TV·휴대폰\n우리집 통신비\n|얼마나 아낄까?',
    qrLabel:'QR 찍고\n3분 만에 확인!',
    benefits:[['🎁','통신비 절감\n컨설팅'],['💰','매장 관리비\n지원 혜택'],['📱','맞춤 결합\n특별 혜택']]
  },
  // ── 아파트용 ──
  '아파트단지':{
    cat:'apart', icon:'🏢', char:'🏡', deco:'🔑', industry:'아파트',
    main:'#0B4FCB', dark:'#072E7A', barFrom:'#072E7A', barTo:'#0B4FCB', barTitle:'#9DC2FF', accent:'#0B4FCB',
    speech:'우리 단지 입주민\n전용 통신 혜택!', speechAlign:'right',
    headline:'입주민만을 위한\n', headlineHi:'특별 통신 혜택!', headlineHiColor:'#0B4FCB',
    memo:'인터넷·TV·휴대폰\n우리집 통신비\n|얼마나 아낄 수 있을까?',
    qrLabel:'QR 찍고\n우리집 통신비\n3분 진단!',
    benefits:[['🏢','단지 전용\n결합 할인'],['📺','인터넷+TV\n묶음 혜택'],['👨‍👩‍👧','가족결합\n추가 할인']]
  },
  '신축입주':{
    cat:'apart', icon:'🔑', char:'📦', deco:'🏠', industry:'신축입주',
    main:'#0E7C6B', dark:'#0A5C50', barFrom:'#0A5C50', barTo:'#0E9B86', barTitle:'#7EE7D5', accent:'#0E9B86',
    speech:'새 집에 딱 맞는\n인터넷 한 번에!', speechAlign:'right',
    headline:'신규 입주 가구\n', headlineHi:'설치 혜택!', headlineHiColor:'#0E9B86',
    memo:'이사하면서\n인터넷·TV도\n|한 번에 설치하기!',
    qrLabel:'QR 찍고\n설치 가능 여부\n바로 확인!',
    benefits:[['🔑','신규 설치\n지원 혜택'],['⚡','당일 설치\n가능 확인'],['🎁','입주 가구\n전용 사은품']]
  },
  '오피스텔':{
    cat:'apart', icon:'🏬', char:'💼', deco:'🏙️', industry:'오피스텔',
    main:'#5B3FE0', dark:'#432DB0', barFrom:'#432DB0', barTo:'#5B3FE0', barTitle:'#C9BCFF', accent:'#5B3FE0',
    speech:'1인 가구·직장인\n맞춤 통신 혜택!', speechAlign:'right',
    headline:'입주민을 위한\n', headlineHi:'스마트 혜택!', headlineHiColor:'#5B3FE0',
    memo:'혼자 살아도\n|결합 할인으로\n통신비 절약!',
    qrLabel:'QR 찍고\n맞춤 요금제\n확인하기!',
    benefits:[['💼','1인 가구\n맞춤 요금'],['📶','초고속\n인터넷'],['🎬','OTT 결합\n할인 혜택']]
  },
  '빌라주택':{
    cat:'apart', icon:'🏘️', char:'🏡', deco:'🌳', industry:'빌라주택',
    main:'#B45309', dark:'#92400E', barFrom:'#92400E', barTo:'#D97706', barTitle:'#FCD34D', accent:'#D97706',
    speech:'우리 동네 주민\n전용 통신 혜택!', speechAlign:'right',
    headline:'동네 주민을 위한\n', headlineHi:'통신 혜택!', headlineHiColor:'#D97706',
    memo:'인터넷·TV·휴대폰\n|결합하면 더 저렴\n매달 아껴보세요!',
    qrLabel:'QR 찍고\n혜택 확인!',
    benefits:[['🏘️','주택 맞춤\n결합 할인'],['📺','인터넷+TV\n묶음 혜택'],['👨‍👩‍👧','가족결합\n추가 할인']]
  },
}
const INDUSTRIES = Object.keys(INDUSTRY_TEMPLATES)
const industriesOf = (cat) => INDUSTRIES.filter(k => INDUSTRY_TEMPLATES[k].cat === cat)

export default function QRPartners({ onBack }) {
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('stores')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState('')
  const [toast, setToast] = useState('')
  const [stores, setStores] = useState([])
  const [leads, setLeads] = useState([])
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [storeForm, setStoreForm] = useState({ category:'store', store_name:'', industry:'무인문구점', owner_contact:'', address:'', benefit_note:'월1건 통신비지원 / 2건이상 관리비지원' })
  const [flyerStore, setFlyerStore] = useState(null)
  // 실시간 알림용: 마지막으로 본 상담 수
  const [seenLeadCount, setSeenLeadCount] = useState(0)
  const [newLeadIds, setNewLeadIds] = useState([])

  const t2 = useCallback((m)=>{ setToast(m); setTimeout(()=>setToast(''),2500) },[])

  // 매장 수정 시작
  const startEdit = (s)=>{
    const tpl = INDUSTRY_TEMPLATES[s.industry]||INDUSTRY_TEMPLATES['기타매장']
    setEditingId(s.id)
    setStoreForm({ category:tpl.cat, store_name:s.store_name||'', industry:s.industry||'무인문구점', owner_contact:s.owner_contact||'', address:s.address||'', benefit_note:s.benefit_note||'' })
    setShowStoreForm(true)
  }
  // 매장 삭제
  const delStore = async (s)=>{
    if(!window.confirm(`'${s.store_name}'을(를) 삭제할까요?\n등록된 매장이 목록에서 제거됩니다.`)) return
    await db.del('qr_stores','id=eq.'+s.id).catch(e=>{alert('삭제 실패: '+e.message)})
    setStores(prev=>prev.filter(x=>x.id!==s.id))
    t2('매장이 삭제되었습니다')
  }

  const load = useCallback(async (u)=>{
    try {
      const [st, ld] = await Promise.all([
        db.get('qr_stores','select=*&partner_username=eq.'+u.username+'&order=created_at.desc').catch(()=>[]),
        db.get('qr_leads','select=*&partner_username=eq.'+u.username+'&order=created_at.desc').catch(()=>[])
      ])
      setStores(st||[]); setLeads(ld||[])
      return ld||[]
    } catch(e){ console.error(e); return [] }
  },[])

  const login = async ()=>{
    setLerr('')
    if(!lid||!lpw){ setLerr('아이디와 비밀번호를 입력하세요'); return }
    try {
      const idTrim = lid.trim(), pwTrim = lpw.trim()
      const all = await db.get('qr_partners','select=*').catch(()=>[])
      let u = (all||[]).find(p => (p.username||'').toLowerCase() === idTrim.toLowerCase() && (p.password||'').trim() === pwTrim)
      if(!u){
        const mms = await db.get('mm_users','select=*').catch(()=>[])
        const mm = (mms||[]).find(m => (m.username||'').toLowerCase() === idTrim.toLowerCase() && String(m.password||'').trim() === pwTrim)
        if(mm){
          const code = 'QRP-'+mm.username+'-'+String(Date.now()).slice(-4)
          const newP = { username:mm.username, password:String(mm.password), name:mm.name, team_id:mm.team_id, qr_code:code }
          const res = await db.post('qr_partners', newP).catch(()=>null)
          u = { ...newP, id:(Array.isArray(res)?res[0]?.id:res?.id)||Date.now() }
        }
      }
      if(!u){ setLerr('아이디 또는 비밀번호가 올바르지 않습니다'); return }
      if(!u.qr_code){
        const code = 'QRP-'+u.username+'-'+String(Date.now()).slice(-4)
        await db.patch('qr_partners','id=eq.'+u.id,{qr_code:code}).catch(()=>{})
        u.qr_code = code
      }
      setUser(u)
      const ld = await load(u)
      setSeenLeadCount(ld.length)
      setScreen('main')
    } catch(e){ setLerr('연결 오류: '+e.message) }
  }

  // ── 실시간 상담 알림: 30초마다 새 상담 확인 ──
  useEffect(()=>{
    if(screen!=='main'||!user) return
    const timer = setInterval(async ()=>{
      try{
        const ld = await db.get('qr_leads','select=*&partner_username=eq.'+user.username+'&order=created_at.desc').catch(()=>null)
        if(ld && ld.length > leads.length){
          const known = new Set(leads.map(x=>x.id))
          const fresh = ld.filter(x=>!known.has(x.id))
          setNewLeadIds(prev=>[...new Set([...prev, ...fresh.map(x=>x.id)])])
          setLeads(ld)
          t2('🔔 새 상담 요청 '+fresh.length+'건 도착!')
        }
      }catch(e){}
    }, 30000)
    return ()=>clearInterval(timer)
  },[screen,user,leads,t2])

  // 상담 실적 탭 열면 읽음 처리
  useEffect(()=>{ if(tab==='leads'){ setSeenLeadCount(leads.length); setNewLeadIds([]) } },[tab,leads.length])
  const unreadCount = Math.max(0, leads.length - seenLeadCount)

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

  const totalScans = stores.reduce((a,s)=>a+(s.scan_count||0),0)
  const totalLeads = leads.length
  const successLeads = leads.filter(l=>l.status==='가입성공').length
  const monthLeads = leads.filter(l=>{const d=new Date(l.created_at);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}).length

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Noto Sans KR',sans-serif",maxWidth:'440px',margin:'0 auto',display:'flex',flexDirection:'column'}}>
      {toast&&<div style={{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',background:C.accBg,border:'1.5px solid '+C.accBorder,color:C.acc,padding:'12px 24px',borderRadius:'50px',fontSize:'14px',fontWeight:'700',zIndex:500,boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>{toast}</div>}
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,0.05)',position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px 0'}}>
          <span style={{fontSize:'17px',fontWeight:'900',color:C.acc,display:'flex',alignItems:'center',gap:'6px'}}><KTLogo h={16}/> QR 파트너스</span>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'12px',color:C.sub}}>{user?.name}</span>
            <button onClick={onBack} style={{background:'none',border:'none',color:C.sub,fontSize:'12px',cursor:'pointer'}}>로그아웃</button>
          </div>
        </div>
        <div style={{display:'flex',padding:'6px 4px 0',gap:'2px'}}>
          {[['stores','내 매장','🏪'],['leads','상담 실적','📞'],['myqr','내 QR','📱']].map(([id,label,icon])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,position:'relative',background:'none',border:'none',borderBottom:tab===id?'2.5px solid '+C.acc:'2.5px solid transparent',color:tab===id?C.acc:'#94a3b8',cursor:'pointer',padding:'8px 4px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',fontFamily:'inherit'}}>
              <span style={{fontSize:'18px'}}>{icon}</span>
              <span style={{fontSize:'11px',fontWeight:tab===id?'800':'500'}}>{label}</span>
              {id==='leads'&&unreadCount>0&&<span style={{position:'absolute',top:'2px',right:'18px',background:C.red,color:'#fff',fontSize:'10px',fontWeight:'800',minWidth:'17px',height:'17px',borderRadius:'9px',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',boxShadow:'0 1px 4px rgba(220,38,38,0.4)'}}>{unreadCount}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
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
              <button onClick={()=>{setEditingId(null);setStoreForm({category:'store',store_name:'',industry:'무인문구점',owner_contact:'',address:'',benefit_note:'월1건 통신비지원 / 2건이상 관리비지원'});setShowStoreForm(true)}} style={{background:C.acc,color:'#fff',border:'none',borderRadius:'10px',padding:'8px 14px',fontSize:'13px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>+ 등록</button>
            </div>
            {stores.length===0
              ?<div style={{textAlign:'center',padding:'40px 0',color:C.sub,fontSize:'14px'}}>등록된 매장이 없습니다<br/><span style={{fontSize:'12px'}}>매장·아파트를 등록하면 전용 QR 전단을 만들 수 있습니다</span></div>
              :stores.map(s=>{
                const tpl=INDUSTRY_TEMPLATES[s.industry]||INDUSTRY_TEMPLATES['기타매장']
                const storeLeads=leads.filter(l=>l.store_code===s.store_code)
                const catLabel = CATEGORIES[tpl.cat]?.label||'상가용'
                return(
                  <div key={s.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'14px',marginBottom:'10px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                      <span style={{fontSize:'15px',fontWeight:'800'}}>{tpl.icon} {s.store_name}</span>
                      <div style={{display:'flex',gap:'4px'}}>
                        <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'10px',background:tpl.cat==='apart'?'#EAF2FF':'#FFF7ED',color:tpl.cat==='apart'?'#0B4FCB':'#e67e00',fontWeight:'800'}}>{catLabel}</span>
                        <span style={{fontSize:'11px',padding:'2px 10px',borderRadius:'10px',background:(tpl.main||'#888')+'18',color:tpl.main,fontWeight:'700'}}>{s.industry}</span>
                      </div>
                    </div>
                    <div style={{fontSize:'12px',color:C.sub,marginBottom:'3px'}}>📍 {s.address||'-'}</div>
                    {s.owner_contact&&<div style={{fontSize:'12px',color:C.sub,marginBottom:'3px'}}>📞 {tpl.cat==='apart'?'관리사무소':'점주'}: {s.owner_contact}</div>}
                    <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                      <span style={{fontSize:'11px',background:C.blueBg,color:C.blue,padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>스캔 {s.scan_count||0}</span>
                      <span style={{fontSize:'11px',background:'#faf5ff',color:'#7c3aed',padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>상담 {storeLeads.length}</span>
                      <span style={{fontSize:'11px',background:'#f0fdf4',color:C.green,padding:'3px 10px',borderRadius:'8px',fontWeight:'700'}}>성공 {storeLeads.filter(l=>l.status==='가입성공').length}</span>
                    </div>
                    <div style={{display:'flex',gap:'6px',marginTop:'10px'}}>
                      <button onClick={()=>setFlyerStore(s)} style={{flex:1,background:C.accBg,border:'1px solid '+C.accBorder,color:C.acc,borderRadius:'10px',padding:'10px',fontSize:'12.5px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>📄 A3 전단/QR</button>
                      <button onClick={()=>startEdit(s)} style={{background:'#f1f5f9',border:'1px solid #e2e8f0',color:C.sub,borderRadius:'10px',padding:'10px 14px',fontSize:'12.5px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>✏️ 수정</button>
                      <button onClick={()=>delStore(s)} style={{background:'#fef2f2',border:'1px solid #fecaca',color:C.red,borderRadius:'10px',padding:'10px 14px',fontSize:'12.5px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>🗑</button>
                    </div>
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
                const isNew = newLeadIds.includes(l.id)
                return(
                  <div key={l.id} style={{background:'#fff',border:isNew?'1.5px solid '+C.red:'1px solid #e2e8f0',borderRadius:'12px',padding:'12px',marginBottom:'8px',position:'relative'}}>
                    {isNew&&<span style={{position:'absolute',top:'-7px',left:'12px',background:C.red,color:'#fff',fontSize:'10px',fontWeight:'800',padding:'2px 8px',borderRadius:'8px'}}>NEW</span>}
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

        {tab==='myqr'&&<MyQRTab user={user}/>}
      </div>

      {/* 매장 등록 폼 */}
      {showStoreForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px',width:'100%',maxWidth:'440px',margin:'0 auto',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontWeight:'900',fontSize:'17px',marginBottom:'16px'}}>{editingId?'✏️ 부착처 수정':'📋 부착처 등록'}</div>

            {/* 1단계: 대분류 */}
            <div style={{marginBottom:'14px'}}>
              <div style={{fontSize:'12px',color:C.sub,marginBottom:'6px',fontWeight:'600'}}>① 유형 선택 <span style={{color:C.red}}>*</span></div>
              <div style={{display:'flex',gap:'8px'}}>
                {Object.entries(CATEGORIES).map(([key,c])=>{
                  const on=storeForm.category===key
                  return(
                    <button key={key} onClick={()=>setStoreForm(p=>({...p,category:key,industry:industriesOf(key)[0]}))} style={{flex:1,padding:'14px 10px',background:on?(key==='apart'?'#EAF2FF':'#FFF7ED'):'#fff',border:'2px solid '+(on?(key==='apart'?'#0B4FCB':'#e67e00'):'#e2e8f0'),borderRadius:'14px',cursor:'pointer',fontFamily:'inherit',textAlign:'center'}}>
                      <div style={{fontSize:'26px',marginBottom:'4px'}}>{c.icon}</div>
                      <div style={{fontSize:'14px',fontWeight:'800',color:on?(key==='apart'?'#0B4FCB':'#e67e00'):C.text}}>{c.label}</div>
                      <div style={{fontSize:'10px',color:C.sub,marginTop:'2px'}}>{c.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2단계: 세부 업종 */}
            <div style={{marginBottom:'10px'}}>
              <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>② 세부 {storeForm.category==='apart'?'유형':'업종'} <span style={{color:C.red}}>*</span></div>
              <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                {industriesOf(storeForm.category).map(ind=>(
                  <button key={ind} onClick={()=>setStoreForm(p=>({...p,industry:ind}))} style={{padding:'7px 12px',background:storeForm.industry===ind?'#1e293b':'#fff',border:'1.5px solid '+(storeForm.industry===ind?'#1e293b':'#e2e8f0'),color:storeForm.industry===ind?'#fff':C.sub,borderRadius:'20px',fontSize:'12px',fontWeight:storeForm.industry===ind?'700':'500',cursor:'pointer',fontFamily:'inherit'}}>{INDUSTRY_TEMPLATES[ind].icon} {ind}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:'10px'}}>
              <div style={{fontSize:'12px',color:C.sub,marginBottom:'4px',fontWeight:'600'}}>{storeForm.category==='apart'?'단지명':'매장명'} <span style={{color:C.red}}>*</span></div>
              <input value={storeForm.store_name} onChange={e=>setStoreForm(p=>({...p,store_name:e.target.value}))} placeholder={storeForm.category==='apart'?'예: 풍유롯데캐슬':'예: 행복문구'}
                style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'9px 11px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            {[['owner_contact',storeForm.category==='apart'?'관리사무소 연락처':'사업주 연락처','예: 010-1234-5678'],['address','주소','예: 김해시 풍유동 117']].map(([k,label,ph])=>(
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
              <button onClick={()=>{setShowStoreForm(false);setEditingId(null)}} style={{flex:1,padding:'12px',background:'#f1f5f9',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>취소</button>
              <button onClick={async()=>{
                if(!storeForm.store_name){alert('이름을 입력하세요');return}
                const {category,...rest}=storeForm
                if(editingId){
                  // 수정
                  await db.patch('qr_stores','id=eq.'+editingId,rest).catch(e=>{alert('수정 실패: '+e.message);return})
                  setStores(p=>p.map(x=>x.id===editingId?{...x,...rest}:x))
                  setShowStoreForm(false);setEditingId(null);t2('수정 완료!')
                } else {
                  // 신규 등록
                  const code='QRS-'+user.username+'-'+String(Date.now()).slice(-6)
                  const newStore={...rest,partner_username:user.username,partner_name:user.name,team_id:user.team_id,store_code:code,scan_count:0,created_at:new Date().toISOString()}
                  const res=await db.post('qr_stores',newStore).catch(e=>{alert('저장 실패: '+e.message);return null})
                  if(res){setStores(p=>[{...newStore,id:(Array.isArray(res)?res[0]?.id:res?.id)||Date.now()},...p]);setShowStoreForm(false);t2('등록 완료!')}
                }
              }} style={{flex:2,padding:'12px',background:C.acc,color:'#fff',border:'none',borderRadius:'10px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>{editingId?'수정 저장':'등록'}</button>
            </div>
          </div>
        </div>
      )}

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
        💡 매장·아파트별 전용 전단은 <b>내 매장</b> 탭에서 각 항목의 'A3 전단 다운로드'로 만들 수 있습니다. 부착처별 QR은 어디서 유입됐는지 정확히 추적됩니다.
      </div>
    </div>
  )
}

// ── A3 전단 모달 ──
function FlyerModal({ store, onClose }){
  const [qrUrl, setQrUrl] = useState('')
  const [variant, setVariant] = useState('A')   // A 클린 / B 볼드 / C 혜택강조
  const flyerRef = useRef()
  const tpl = INDUSTRY_TEMPLATES[store.industry]||INDUSTRY_TEMPLATES['기타매장']
  const isApart = tpl.cat==='apart'
  useEffect(()=>{
    const url = window.location.origin + '/#qr-store-' + store.store_code
    QRCode.toDataURL(url,{width:600,margin:1,color:{dark:'#0f172a',light:'#ffffff'},errorCorrectionLevel:'H'}).then(setQrUrl).catch(()=>{})
  },[store])

  const downloadPNG = async ()=>{
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(flyerRef.current,{scale:3,backgroundColor:'#fdfcf8',useCORS:true})
    const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='전단_'+store.store_name+'.png';a.click()
  }
  const downloadPDF = ()=>{ window.print() }

  const renderMemo = (memo)=>{
    if(!memo) return null
    return memo.split('\n').map((line,i)=>{
      if(line.includes('|')){
        const [pre,hi] = line.split('|')
        return <div key={i}>{pre}<span style={{background:'#fef08a',padding:'0 3px',borderRadius:'3px'}}>{hi}</span></div>
      }
      return <div key={i}>{line}</div>
    })
  }
  const QR_BLOCK = (size)=>(
    qrUrl ? <img src={qrUrl} alt="QR" style={{width:size,height:size,display:'block'}}/> : <div style={{width:size,height:size,background:'#f1f5f9'}}/>
  )
  const placeLabel = isApart ? '입주민' : '고객'

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:200,display:'flex',flexDirection:'column',alignItems:'center',overflowY:'auto',padding:'16px'}}>
      <style>{`@media print{body *{visibility:hidden}#flyer-print,#flyer-print *{visibility:visible}#flyer-print{position:absolute;top:0;left:50%;transform:translateX(-50%);margin:0}.no-print{display:none!important}}`}</style>
      <div className="no-print" style={{display:'flex',gap:'8px',marginBottom:'14px',width:'100%',maxWidth:'420px',position:'sticky',top:0,zIndex:10}}>
        <button onClick={onClose} style={{flex:1,padding:'13px',background:'rgba(255,255,255,0.95)',border:'none',borderRadius:'12px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',fontSize:'14px'}}>닫기</button>
        <button onClick={downloadPNG} style={{flex:1.3,padding:'13px',background:'#2563eb',color:'#fff',border:'none',borderRadius:'12px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',fontSize:'14px',boxShadow:'0 4px 12px rgba(37,99,235,0.4)'}}>📥 이미지 저장</button>
        <button onClick={downloadPDF} style={{flex:1.3,padding:'13px',background:'#e67e00',color:'#fff',border:'none',borderRadius:'12px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',fontSize:'14px',boxShadow:'0 4px 12px rgba(230,126,0,0.4)'}}>🖨 PDF/인쇄</button>
      </div>

      {/* 시안 선택 */}
      <div className="no-print" style={{display:'flex',gap:'6px',marginBottom:'12px',width:'100%',maxWidth:'420px'}}>
        {[['A','클린 미니멀'],['B','볼드 임팩트'],['C','혜택 강조']].map(([v,nm])=>(
          <button key={v} onClick={()=>setVariant(v)} style={{flex:1,padding:'9px 4px',background:variant===v?'#1e293b':'rgba(255,255,255,0.92)',color:variant===v?'#fff':'#475569',border:'none',borderRadius:'10px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',fontSize:'12px'}}>시안 {v}<div style={{fontSize:'9.5px',fontWeight:'600',opacity:0.8,marginTop:'1px'}}>{nm}</div></button>
        ))}
      </div>

      {/* ════ A3 전단 ════ */}
      <div id="flyer-print" ref={flyerRef} style={{width:'400px',height:'507px',background: variant==='B' ? tpl.dark : '#fdfcf8',borderRadius:'8px',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.4)',display:'flex',flexDirection:'column',position:'relative',fontFamily:"'Pretendard','Noto Sans KR',sans-serif",backgroundImage: variant==='B' ? `radial-gradient(circle at 1px 1px,rgba(255,255,255,0.06) 1px,transparent 0)` : 'radial-gradient(circle at 1px 1px,rgba(0,0,0,0.03) 1px,transparent 0)',backgroundSize:'8px 8px'}}>

        {/* 시안 C: 상단 혜택 배너 */}
        {variant==='C' && (
          <div style={{background:`linear-gradient(90deg,${tpl.barFrom},${tpl.barTo})`,padding:'7px 24px',display:'flex',justifyContent:'center',gap:'14px',position:'relative',zIndex:3}}>
            {tpl.benefits.map(([ic,tx],i)=>(
              <span key={i} style={{fontSize:'10px',color:'#fff',fontWeight:'700',whiteSpace:'nowrap'}}>{ic} {tx.replace('\n',' ')}</span>
            ))}
          </div>
        )}

        {/* 상단 KT × 매장명 (정식 로고) */}
        <div style={{padding:'18px 24px 0',display:'flex',alignItems:'center',gap:'9px',position:'relative',zIndex:2}}>
          <span style={{display:'inline-flex',background: variant==='B'?'#fff':'transparent',borderRadius:'5px',padding: variant==='B'?'3px 6px':'0'}}><img src="/kt-logo.png" alt="kt" style={{height:'28px',width:'auto'}} crossOrigin="anonymous"/></span>
          <span style={{fontSize:'16px',color: variant==='B'?'rgba(255,255,255,0.5)':'#cbd5e1'}}>×</span>
          <span style={{fontSize:'18px',fontWeight:'800',color: variant==='B' ? '#fff' : tpl.dark}}>{store.store_name}</span>
        </div>

        <div style={{position:'absolute',top: variant==='C'?'42px':'20px',right:'20px',fontSize:'10px',fontWeight:'700',color: variant==='B' ? tpl.barTitle : tpl.dark,textAlign:'right',lineHeight:1.4,whiteSpace:'pre-line',zIndex:2}}>{tpl.speech}</div>

        <div style={{padding:'14px 24px 0',position:'relative',zIndex:2}}>
          <div style={{fontSize:'36px',fontWeight:'900',color: variant==='B' ? tpl.barTitle : tpl.main,lineHeight:1,letterSpacing:'-2px'}}>{store.store_name}</div>
          <div style={{fontSize:'22px',fontWeight:'800',color: variant==='B' ? '#fff' : '#1e293b',lineHeight:1.25,marginTop:'7px',letterSpacing:'-1px',whiteSpace:'pre-line'}}>{tpl.headline}<span style={{color: variant==='B' ? tpl.barTitle : (tpl.headlineHiColor||tpl.accent)}}>{tpl.headlineHi}</span></div>
        </div>

        {tpl.bubble ? (
          <div style={{flex:1,padding:'12px 24px 0',position:'relative',zIndex:2}}>
            <div style={{background:'#fff',border:'2px solid '+tpl.main,borderRadius:'14px',padding:'10px 13px',fontSize:'12px',fontWeight:'800',color:tpl.dark,textAlign:'center',boxShadow:'0 3px 10px rgba(0,0,0,0.07)',whiteSpace:'pre-line'}}>{tpl.bubble}</div>
            <div style={{display:'flex',gap:'12px',marginTop:'13px',alignItems:'center'}}>
              <div style={{flexShrink:0,background:'#fff',padding:'8px',borderRadius:'11px',border:'3px solid '+tpl.main,boxShadow:'0 4px 14px rgba(0,0,0,0.12)'}}>{QR_BLOCK('94px')}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'12.5px',fontWeight:'900',color:tpl.dark,marginBottom:'6px',whiteSpace:'pre-line'}}>{tpl.qrLabel}</div>
                <div style={{fontSize:'10px',color:'#334155',fontWeight:'600',lineHeight:1.85}}>
                  {(tpl.checks||[]).map((c,i)=><div key={i}>✓ {c}</div>)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{flex:1,display:'flex',alignItems:'center',padding:'10px 24px 0',gap:'10px',position:'relative',zIndex:2}}>
            <div style={{flex:1,background:'#fff',borderRadius:'10px',padding:'12px 13px',boxShadow:'0 3px 12px rgba(0,0,0,0.08)',transform:'rotate(-2deg)',borderLeft:'3px solid '+tpl.main}}>
              <div style={{fontSize:'14px',fontWeight:'800',color:'#1e293b',lineHeight:1.5}}>{renderMemo(tpl.memo)}</div>
            </div>
            <div style={{flexShrink:0,textAlign:'center'}}>
              <div style={{fontSize:'11.5px',fontWeight:'800',color:tpl.main,marginBottom:'5px',whiteSpace:'pre-line'}}>{tpl.qrLabel}</div>
              <div style={{background:'#fff',padding:'8px',borderRadius:'11px',border:'3px solid '+tpl.accent,boxShadow:'0 4px 14px rgba(0,0,0,0.12)'}}>{QR_BLOCK('92px')}</div>
            </div>
          </div>
        )}

        <div style={{position:'absolute',bottom:'72px',right:'22px',fontSize:'50px',zIndex:1}}>{tpl.char}</div>
        <div style={{position:'absolute',bottom:'76px',left:'24px',fontSize:'30px',zIndex:1}}>{tpl.deco}</div>
        {tpl.badge && <div style={{position:'absolute',bottom:'120px',right:'120px',background:'#fce7f3',color:'#be185d',fontSize:'11px',fontWeight:'900',width:'50px',height:'50px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',lineHeight:1.1,boxShadow:'0 3px 10px rgba(0,0,0,0.12)',zIndex:2}}>{tpl.badge}</div>}

        {variant!=='C' && <div style={{background:`linear-gradient(90deg,${tpl.barFrom},${tpl.barTo})`,padding:'12px 18px 13px'}}>
          <div style={{textAlign:'center',fontSize:'12.5px',fontWeight:'900',marginBottom:'8px',color:tpl.barTitle}}>{store.store_name} {placeLabel} 전용 혜택</div>
          <div style={{display:'flex',justifyContent:'space-around',gap:'6px'}}>
            {tpl.benefits.map(([ic,tx],i)=>(
              <Fragment key={i}>
                {i>0 && <div style={{width:'1px',background:'rgba(255,255,255,0.2)'}}/>}
                <div style={{textAlign:'center',flex:1}}>
                  <div style={{fontSize:'21px',marginBottom:'2px'}}>{ic}</div>
                  <div style={{fontSize:'9.5px',color:'#fff',fontWeight:'600',lineHeight:1.3,whiteSpace:'pre-line'}}>{tx}</div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>}
      </div>
      <div className="no-print" style={{height:'24px'}}/>
    </div>
  )
}
