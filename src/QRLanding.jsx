import { useState, useEffect } from 'react'
import { db } from './supabase'

// 고객이 QR 스캔 후 접속하는 상담 요청 페이지
export default function QRLanding({ storeCode, onBack }){
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ customer_name:'', customer_contact:'', interest_product:'인터넷' })
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  useEffect(()=>{
    (async()=>{
      try{
        const rows = await db.get('qr_stores','select=*&store_code=eq.'+encodeURIComponent(storeCode))
        const s = rows?.[0]
        setStore(s||null)
        // 스캔 카운트 증가
        if(s){ await db.patch('qr_stores','id=eq.'+s.id,{scan_count:(s.scan_count||0)+1}).catch(()=>{}) }
      }catch(e){ console.error(e) }
      setLoading(false)
    })()
  },[storeCode])

  const submit = async ()=>{
    setErr('')
    if(!form.customer_name||!form.customer_contact){ setErr('이름과 연락처를 입력해주세요'); return }
    try{
      await db.post('qr_leads',{
        store_code:storeCode, store_name:store?.store_name, partner_username:store?.partner_username,
        customer_name:form.customer_name, customer_contact:form.customer_contact,
        interest_product:form.interest_product, status:'상담요청', team_id:store?.team_id,
        created_at:new Date().toISOString()
      })
      setDone(true)
    }catch(e){ setErr('전송 실패: '+e.message) }
  }

  if(loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Noto Sans KR',sans-serif",color:'#64748b'}}>불러오는 중...</div>

  if(!store) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Noto Sans KR',sans-serif",padding:'30px',textAlign:'center'}}>
      <div style={{fontSize:'48px',marginBottom:'16px'}}>😅</div>
      <div style={{fontSize:'16px',fontWeight:'700',color:'#0f172a'}}>유효하지 않은 QR입니다</div>
      <button onClick={onBack} style={{marginTop:'20px',background:'#e67e00',color:'#fff',border:'none',borderRadius:'10px',padding:'12px 24px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>홈으로</button>
    </div>
  )

  if(done) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Noto Sans KR',sans-serif",padding:'30px',textAlign:'center',background:'linear-gradient(160deg,#f0fdf4,#dcfce7)'}}>
      <div style={{fontSize:'64px',marginBottom:'16px'}}>🎉</div>
      <h1 style={{fontSize:'24px',fontWeight:'900',color:'#15803d',margin:'0 0 10px'}}>상담 요청 완료!</h1>
      <p style={{fontSize:'14px',color:'#374151',lineHeight:1.6}}>KT 담당자가 곧 연락드리겠습니다.<br/>관심 가져주셔서 감사합니다 😊</p>
      <div style={{marginTop:'24px',background:'#fff',borderRadius:'14px',padding:'16px 20px',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
        <div style={{fontSize:'12px',color:'#64748b'}}>접수 매장</div>
        <div style={{fontSize:'15px',fontWeight:'800',color:'#0f172a'}}>{store.store_name}</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',fontFamily:"'Noto Sans KR',sans-serif",background:'#f8fafc',display:'flex',flexDirection:'column',maxWidth:'440px',margin:'0 auto'}}>
      {/* 헤더 */}
      <div style={{background:'linear-gradient(135deg,#16213e,#0f3460)',padding:'30px 24px',color:'#fff',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'10px'}}>
          <span style={{fontSize:'22px',fontWeight:'900',background:'#fff',color:'#E31937',padding:'2px 12px',borderRadius:'6px'}}>kt</span>
          <span style={{fontSize:'16px',opacity:0.9}}>×</span>
          <span style={{fontSize:'18px',fontWeight:'800'}}>{store.store_name}</span>
        </div>
        <div style={{fontSize:'14px',opacity:0.85}}>통신비 절감 혜택 상담 신청</div>
      </div>
      {/* 폼 */}
      <div style={{flex:1,padding:'24px'}}>
        <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
          <div style={{fontSize:'14px',fontWeight:'800',color:'#b45309',marginBottom:'6px'}}>🎁 지금 상담 신청하면</div>
          <div style={{fontSize:'13px',color:'#92400e',lineHeight:1.6}}>KT 통신 상품 가입 시 다양한 혜택과 함께, 우리 동네 <b>{store.store_name}</b>도 응원받습니다!</div>
        </div>
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'13px',color:'#64748b',marginBottom:'6px',fontWeight:'600'}}>이름 <span style={{color:'#dc2626'}}>*</span></div>
          <input value={form.customer_name} onChange={e=>setForm(p=>({...p,customer_name:e.target.value}))} placeholder="성함을 입력해주세요"
            style={{width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'13px 14px',fontSize:'15px',boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'13px',color:'#64748b',marginBottom:'6px',fontWeight:'600'}}>연락처 <span style={{color:'#dc2626'}}>*</span></div>
          <input value={form.customer_contact} onChange={e=>setForm(p=>({...p,customer_contact:e.target.value}))} type="tel" placeholder="010-0000-0000"
            style={{width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'13px 14px',fontSize:'15px',boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        <div style={{marginBottom:'20px'}}>
          <div style={{fontSize:'13px',color:'#64748b',marginBottom:'6px',fontWeight:'600'}}>관심 상품</div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            {['인터넷','TV','모바일','인터넷+TV','결합상품','잘모름'].map(p=>(
              <button key={p} onClick={()=>setForm(f=>({...f,interest_product:p}))} style={{padding:'9px 14px',background:form.interest_product===p?'#16213e':'#fff',border:'1.5px solid '+(form.interest_product===p?'#16213e':'#e2e8f0'),color:form.interest_product===p?'#fff':'#64748b',borderRadius:'20px',fontSize:'13px',fontWeight:form.interest_product===p?'700':'500',cursor:'pointer',fontFamily:'inherit'}}>{p}</button>
            ))}
          </div>
        </div>
        {err&&<div style={{color:'#dc2626',fontSize:'13px',marginBottom:'12px',textAlign:'center'}}>{err}</div>}
        <button onClick={submit} style={{width:'100%',background:'#e67e00',color:'#fff',border:'none',borderRadius:'12px',padding:'15px',fontSize:'16px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>상담 신청하기</button>
        <div style={{fontSize:'11px',color:'#94a3b8',textAlign:'center',marginTop:'12px',lineHeight:1.5}}>제출하신 정보는 상담 목적으로만 사용됩니다.</div>
      </div>
    </div>
  )
}
