import { useState, useEffect } from 'react'
import { db } from './supabase'

// ── 에어컨 클린케어 테마 랜딩 (QR 캠페인) ──
// storeCode(apt_code)로 qr_campaigns 조회 → 아파트명 표시 → qr_theme_leads 저장
const C = {
  blue:'#1e6fe8', blueD:'#1553b8', blueL:'#4a90f0', navy:'#123a72',
  ink:'#1a2a44', gray:'#5a6b85', line:'#e3ecf7', sky:'#e8f2fd',
  red:'#e63946', green:'#12b76a', amber:'#f79009'
}
const BRANDS = ['삼성','LG','캐리어','기타']
const TYPES = ['천장형','스탠드','벽걸이','기타']
const COUNTS = ['1','2','3','4']
const TIMES = ['즉시','오전','오후','저녁']

export default function AirconLanding({ aptCode, onBack }) {
  const [camp, setCamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ name:'', dong:'', brand:'', type:'', count:'', phone:'', time:'', agree:false })
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState('')
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  useEffect(() => {
    (async () => {
      try {
        if (aptCode) {
          const rows = await db.get('qr_campaigns', 'select=*&apt_code=eq.' + encodeURIComponent(aptCode))
          if (rows && rows[0]) {
            setCamp(rows[0])
            // 스캔 카운트 +1 (직접 UPDATE — RPC 권한 문제 회피)
            try { await db.patch('qr_campaigns', 'apt_code=eq.' + encodeURIComponent(aptCode),
              { scan_count: (rows[0].scan_count || 0) + 1 }) } catch(e) { console.warn('scan bump fail', e) }
          }
        }
      } catch(e) { console.warn(e) }
      setLoading(false)
    })()
  }, [aptCode])

  const t2 = m => { setToast(m); setTimeout(()=>setToast(''),2500) }

  const phoneFmt = v => {
    let s = v.replace(/[^0-9]/g,'').slice(0,11)
    if (s.length>7) return s.slice(0,3)+'-'+s.slice(3,7)+'-'+s.slice(7)
    if (s.length>3) return s.slice(0,3)+'-'+s.slice(3)
    return s
  }

  async function submit() {
    if (!f.name.trim() || !f.dong.trim() || !f.brand || !f.type || !f.count || f.phone.length<12 || !f.time) {
      t2('필수 항목을 모두 입력해주세요'); return
    }
    if (!f.agree) { t2('개인정보 수집·이용에 동의해주세요'); return }
    try {
      await db.post('qr_theme_leads', [{
        apt_code: aptCode, apt_name: camp ? camp.apt_name : '',
        customer: f.name.trim(), dong_ho: f.dong.trim(), brand: f.brand,
        ac_type: f.type, ac_count: parseInt(f.count) || 1, phone: f.phone.trim(),
        pref_time: f.time, status: '상담요청'
      }])
      // 상담요청 카운트 +1 (직접 UPDATE — 트리거 의존 제거)
      try {
        const cur = await db.get('qr_campaigns', 'select=lead_count&apt_code=eq.' + encodeURIComponent(aptCode))
        const lc = (cur && cur[0] ? cur[0].lead_count : 0) || 0
        await db.patch('qr_campaigns', 'apt_code=eq.' + encodeURIComponent(aptCode), { lead_count: lc + 1 })
      } catch(e) { console.warn('lead bump fail', e) }
      setDone(true)
    } catch(e) { t2('제출 실패: ' + e.message) }
  }

  const aptName = camp ? camp.apt_name : '우리 아파트'
  const tel = camp && camp.contact_tel ? camp.contact_tel : '051-971-1111'

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#eef4fc',color:C.gray,fontFamily:"'Pretendard',sans-serif"}}>불러오는 중...</div>

  // ── 완료 화면 ──
  if (done) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#2c7ef0,#1553b8)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',fontFamily:"'Pretendard',sans-serif",color:'#fff',textAlign:'center'}}>
      <div style={{fontSize:64,marginBottom:16}}>✅</div>
      <h1 style={{fontSize:28,fontWeight:900,letterSpacing:'-1px',lineHeight:1.4}}>상담 요청이<br/>접수되었습니다</h1>
      <p style={{fontSize:16,color:'rgba(255,255,255,0.85)',marginTop:14,lineHeight:1.6,fontWeight:500}}>
        <b style={{color:'#ffe14d'}}>{f.name}</b>님, 곧 전문 상담원이<br/>남겨주신 연락처로 연락드리겠습니다.
      </p>
      <div style={{marginTop:28,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:16,padding:'18px 24px'}}>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.7)'}}>급하신 경우 대표번호</div>
        <div style={{fontSize:24,fontWeight:900,color:'#fff',marginTop:4,letterSpacing:'0.5px'}}>{tel}</div>
      </div>
    </div>
  )

  const S = {
    input:{width:'100%',padding:'15px 16px',background:'#fff',border:'1.5px solid '+C.line,borderRadius:13,fontSize:16,fontFamily:'inherit',fontWeight:600,outline:'none',color:C.ink,boxSizing:'border-box',letterSpacing:'-0.3px'},
    chip:on=>({flex:1,minWidth:'calc(25% - 6px)',padding:'14px 6px',textAlign:'center',background:on?C.blue:'#fff',border:'1.5px solid '+(on?C.blue:C.line),borderRadius:13,fontSize:15,fontWeight:on?900:700,color:on?'#fff':C.gray,cursor:'pointer',fontFamily:'inherit',letterSpacing:'-0.4px',transition:'all .15s'})
  }

  return (
    <div style={{minHeight:'100vh',background:'#eef4fc',fontFamily:"'Pretendard',-apple-system,sans-serif",color:C.ink,lineHeight:1.45}}>
      <div style={{maxWidth:440,margin:'0 auto',background:'#fff',position:'relative',overflow:'hidden'}}>

        {/* 신뢰바 */}
        <div style={{background:C.navy,color:'#fff',padding:'9px 16px',textAlign:'center',fontSize:13,fontWeight:700,letterSpacing:'-0.3px'}}>
          <b style={{color:'#8ec5ff'}}>S전자서비스 공식 파트너</b> · 서비스파트너 등록업체
        </div>

        {/* 히어로 */}
        <div style={{background:'linear-gradient(165deg,#2c7ef0,#1e6fe8 55%,#1553b8)',padding:'24px 22px 26px',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:-60,right:-50,width:220,height:220,background:'radial-gradient(circle,rgba(255,255,255,0.22),transparent 65%)',borderRadius:'50%'}}/>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.95)',color:C.blueD,fontSize:13,fontWeight:800,padding:'7px 15px',borderRadius:30,marginBottom:15,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',position:'relative',letterSpacing:'-0.3px'}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:C.red}}/>{aptName} 입주민 전용
          </div>
          <h1 style={{fontSize:30,fontWeight:900,lineHeight:1.3,color:'#fff',letterSpacing:'-1px',position:'relative',textShadow:'0 2px 12px rgba(0,0,0,0.15)'}}>
            우리 가족 안심 숨결,<br/><span style={{color:'#ffe14d'}}>숨은 세균</span>부터 잡으세요
          </h1>
          <p style={{fontSize:15,color:'rgba(255,255,255,0.92)',marginTop:11,lineHeight:1.6,fontWeight:500,position:'relative',letterSpacing:'-0.3px'}}>
            눈에 보이지 않는 곰팡이와 세균,<br/>완벽 분해 살균 세척으로 해결합니다.
          </p>
        </div>

        {/* 긴급 */}
        <div style={{background:C.navy,color:'#fff',padding:'13px 20px',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:22}}>📢</span>
          <span style={{fontSize:16,fontWeight:800,lineHeight:1.35,letterSpacing:'-0.5px'}}><b style={{color:'#8ec5ff'}}>{aptName}</b> 입주민께만 드리는 긴급 제안</span>
        </div>

        {/* BEFORE/AFTER */}
        <div style={{padding:'30px 22px'}}>
          <div style={{fontSize:23,fontWeight:900,color:C.navy,textAlign:'center',lineHeight:1.35,letterSpacing:'-0.8px',marginBottom:5}}>
            방치하면 <span style={{color:C.blue}}>위험</span>, 케어하면 <span style={{color:C.blue}}>안심</span>
          </div>
          <div style={{fontSize:14,color:C.gray,textAlign:'center',marginBottom:18,fontWeight:500,letterSpacing:'-0.3px'}}>에어컨 내부는 지금 어떤 상태일까요?</div>
          <div style={{display:'flex',gap:11}}>
            <div style={{flex:1,borderRadius:16,overflow:'hidden',border:'1.5px solid '+C.line,background:'#fff',boxShadow:'0 4px 16px rgba(30,111,232,0.06)'}}>
              <div style={{padding:9,textAlign:'center',fontSize:14,fontWeight:900,color:'#fff',background:'#64748b',letterSpacing:'-0.3px'}}>BEFORE</div>
              <div style={{height:120,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',background:'linear-gradient(135deg,#e2e5ea,#cdd3dc)'}}>
                <svg width="120" height="80" viewBox="0 0 120 80">
                  <rect x="10" y="14" width="100" height="40" rx="7" fill="#f0ede6" stroke="#b8b0a2" strokeWidth="2"/>
                  <rect x="14" y="20" width="92" height="20" rx="3" fill="#d8d0c0"/>
                  <circle cx="30" cy="30" r="4" fill="#5a6b3a" opacity="0.7"/><circle cx="45" cy="27" r="5" fill="#4a5a2a" opacity="0.6"/>
                  <circle cx="62" cy="31" r="3.5" fill="#6a7a4a" opacity="0.7"/><circle cx="78" cy="28" r="4.5" fill="#4a5a2a" opacity="0.6"/>
                  <circle cx="92" cy="30" r="3" fill="#5a6b3a" opacity="0.7"/>
                  <path d="M20 54 L18 66 M40 54 L38 68 M60 54 L60 68 M80 54 L82 68 M100 54 L102 66" stroke="#9a9080" strokeWidth="2" opacity="0.5"/>
                </svg>
                <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',fontSize:11,fontWeight:800,padding:'3px 11px',borderRadius:20,whiteSpace:'nowrap',background:'rgba(70,80,95,0.85)',color:'#fff'}}>곰팡이 · 세균</div>
              </div>
              <div style={{padding:'11px 10px 14px',fontSize:13,color:C.gray,lineHeight:1.6,textAlign:'center',fontWeight:600,letterSpacing:'-0.3px'}}>보이지 않는 <b style={{color:C.red,fontWeight:800}}>곰팡이</b>가<br/>아이 호흡기를 위협</div>
            </div>
            <div style={{flex:1,borderRadius:16,overflow:'hidden',border:'1.5px solid '+C.line,background:'#fff',boxShadow:'0 4px 16px rgba(30,111,232,0.06)'}}>
              <div style={{padding:9,textAlign:'center',fontSize:14,fontWeight:900,color:'#fff',background:C.blue,letterSpacing:'-0.3px'}}>AFTER</div>
              <div style={{height:120,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',background:'linear-gradient(135deg,#e3f0ff,#c5e0ff)'}}>
                <svg width="120" height="80" viewBox="0 0 120 80">
                  <rect x="10" y="14" width="100" height="40" rx="7" fill="#fff" stroke="#1e6fe8" strokeWidth="2"/>
                  <rect x="14" y="20" width="92" height="20" rx="3" fill="#e3f0ff"/>
                  <path d="M20 30 h80 M20 34 h80" stroke="#4a90f0" strokeWidth="1.5" opacity="0.5"/>
                  <path d="M20 54 L18 68 M40 54 L38 70 M60 54 L60 70 M80 54 L82 70 M100 54 L102 68" stroke="#4a90f0" strokeWidth="2.5" opacity="0.7"/>
                  <text x="30" y="12" fontSize="11" fill="#1e6fe8">✦</text><text x="85" y="12" fontSize="11" fill="#1e6fe8">✦</text>
                </svg>
                <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',fontSize:11,fontWeight:800,padding:'3px 11px',borderRadius:20,whiteSpace:'nowrap',background:C.blue,color:'#fff'}}>완벽 살균 세척</div>
              </div>
              <div style={{padding:'11px 10px 14px',fontSize:13,color:C.gray,lineHeight:1.6,textAlign:'center',fontWeight:600,letterSpacing:'-0.3px'}}><b style={{color:C.blue,fontWeight:800}}>전문가</b>의 분해<br/>살균으로 새 것처럼</div>
            </div>
          </div>
        </div>

        {/* 위험 경고 */}
        <div style={{margin:'0 22px',background:'#fff4f4',border:'1.5px solid #ffd4d4',borderRadius:14,padding:'15px 16px',display:'flex',gap:11,alignItems:'flex-start'}}>
          <span style={{fontSize:24,flexShrink:0}}>⚠️</span>
          <div style={{fontSize:14,color:'#8a2027',lineHeight:1.6,fontWeight:600,letterSpacing:'-0.3px'}}>에어컨 내부의 찌든 때와 세균은 <b style={{fontWeight:900}}>영유아 호흡기 질환·알레르기</b>의 원인이 됩니다.</div>
        </div>

        {/* 공식 파트너 */}
        <div style={{margin:'26px 22px 0',background:'linear-gradient(145deg,#f0f7ff,#e0edfd)',border:'1.5px solid #d5e8fb',borderRadius:18,padding:'24px 20px',textAlign:'center',position:'relative',overflow:'hidden'}}>
          <div style={{width:70,height:70,margin:'0 auto 12px',background:'linear-gradient(145deg,'+C.blueL+','+C.blue+')',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,color:'#fff',boxShadow:'0 8px 22px rgba(30,111,232,0.35)'}}>✓</div>
          <h3 style={{fontSize:21,fontWeight:900,color:C.navy,letterSpacing:'-0.7px'}}>S전자서비스 <span style={{color:C.blue}}>공식 파트너</span></h3>
          <p style={{fontSize:14,color:C.gray,marginTop:8,lineHeight:1.6,fontWeight:600,letterSpacing:'-0.3px'}}>가전 구조를 가장 잘 아는 전문가가<br/>정교하게 케어합니다.</p>
        </div>

        {/* 시공 약속 */}
        <div style={{margin:'14px 22px 0',background:'linear-gradient(145deg,'+C.blue+','+C.blueD+')',borderRadius:18,padding:'24px 22px',textAlign:'center',color:'#fff',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,background:'radial-gradient(circle,rgba(255,255,255,0.18),transparent 70%)',borderRadius:'50%'}}/>
          <div style={{fontSize:24,fontWeight:900,letterSpacing:'-0.8px',lineHeight:1.35,position:'relative'}}>상담 후 <span style={{color:'#ffe14d',fontSize:32}}>10일</span> 이내<br/>시공 완료 약속</div>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.85)',marginTop:10,lineHeight:1.6,fontWeight:600,position:'relative',letterSpacing:'-0.3px'}}>우리 단지 전용 <b style={{color:'#ffe14d'}}>독점 무상 케어</b><br/>및 <b style={{color:'#ffe14d'}}>3년 지속 케어 상담</b> 제공</div>
        </div>

        {/* 혜택 */}
        <div style={{padding:'26px 22px 6px'}}>
          {[['우리 단지 ','입주민 전용',' 특별가'],['','완벽 분해',' 살균 세척 (시운전 포함)'],['시공 후 ','3년',' 케어 상담 무상']].map((p,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:13,background:'#f6faff',border:'1.5px solid '+C.line,borderRadius:14,padding:'14px 16px',marginBottom:9}}>
              <span style={{width:30,height:30,background:'linear-gradient(145deg,'+C.green+',#0e9d5c)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:17,flexShrink:0,boxShadow:'0 4px 12px rgba(18,183,106,0.3)'}}>✓</span>
              <span style={{fontSize:15,fontWeight:700,color:C.ink,letterSpacing:'-0.4px'}}>{p[0]}<b style={{color:C.blue,fontWeight:900}}>{p[1]}</b>{p[2]}</span>
            </div>
          ))}
        </div>

        {/* 한정 */}
        <div style={{margin:'16px 22px 0',background:'linear-gradient(135deg,#fff8ec,#ffefd0)',border:'2px dashed '+C.amber,borderRadius:16,padding:16,textAlign:'center'}}>
          <div style={{fontSize:14,color:'#b45309',fontWeight:800,letterSpacing:'-0.3px'}}>🔥 선착순 한정 · 마감 임박</div>
          <div style={{fontSize:26,fontWeight:900,margin:'3px 0',letterSpacing:'-1px',color:C.navy}}><span style={{color:C.red}}>50세대</span> 한정 접수 중</div>
        </div>

        {/* 폼 */}
        <div style={{padding:'32px 22px 18px',background:'linear-gradient(180deg,#f6faff,#eaf3ff)'}}>
          <div style={{textAlign:'center',marginBottom:20}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:6,background:'#e8f8f0',border:'1px solid #b3ecce',color:C.green,fontSize:13,fontWeight:800,padding:'6px 14px',borderRadius:30,marginBottom:12,letterSpacing:'-0.3px'}}>🔒 가입 없이 · 간편 신청</span>
            <h2 style={{fontSize:26,fontWeight:900,color:C.navy,letterSpacing:'-1px',lineHeight:1.3}}>지금 바로 무상 상담</h2>
            <p style={{fontSize:14,color:C.gray,marginTop:6,fontWeight:500,letterSpacing:'-0.3px'}}>우리 집 에어컨 상태, 전문가가 진단해드려요</p>
          </div>

          <Field label="고객명" C={C}><input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="성함을 입력해주세요" style={S.input}/></Field>
          <Field label="동/호수" C={C}><input value={f.dong} onChange={e=>set('dong',e.target.value)} placeholder="예: 101동 1203호" style={S.input}/></Field>
          <Field label="에어컨 제조사" C={C}>
            <select value={f.brand} onChange={e=>set('brand',e.target.value)} style={S.input}>
              <option value="">선택해주세요</option>
              {BRANDS.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="에어컨 유형" C={C}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {TYPES.map(t=><div key={t} onClick={()=>set('type',t)} style={S.chip(f.type===t)}>{t}</div>)}
            </div>
          </Field>
          <Field label="대수" C={C}>
            <div style={{display:'flex',gap:8}}>
              {COUNTS.map(c=><div key={c} onClick={()=>set('count',c)} style={S.chip(f.count===c)}>{c==='4'?'4대+':c+'대'}</div>)}
            </div>
          </Field>
          <Field label="연락처" C={C}><input value={f.phone} onChange={e=>set('phone',phoneFmt(e.target.value))} placeholder="010-0000-0000" inputMode="numeric" style={S.input}/></Field>
          <Field label="상담 원하는 시간" C={C}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {TIMES.map(t=><div key={t} onClick={()=>set('time',t)} style={S.chip(f.time===t)}>{t}</div>)}
            </div>
          </Field>

          <div onClick={()=>set('agree',!f.agree)} style={{display:'flex',gap:11,alignItems:'flex-start',background:'#fff',border:'1.5px solid '+C.line,borderRadius:13,padding:14,margin:'6px 0 16px',cursor:'pointer'}}>
            <div style={{width:24,height:24,border:'2px solid '+(f.agree?C.blue:'#c3d0e0'),background:f.agree?C.blue:'transparent',borderRadius:7,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#fff',transition:'all .2s'}}>{f.agree?'✓':''}</div>
            <div style={{fontSize:13,color:C.gray,lineHeight:1.55,fontWeight:500,letterSpacing:'-0.3px'}}><b style={{color:C.red,fontWeight:800}}>(필수)</b> 개인정보 수집·이용 동의 — 상담 연락 목적으로 이름·동호수·연락처를 수집하며, 담당 직원에게만 전달됩니다.</div>
          </div>

          <button onClick={submit} style={{width:'100%',padding:19,background:'linear-gradient(135deg,#2c7ef0,#1e6fe8)',border:'none',borderRadius:15,color:'#fff',fontSize:19,fontWeight:900,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 10px 28px rgba(30,111,232,0.4)',letterSpacing:'-0.5px'}}>무상 상담 요청 보내기 →</button>
        </div>

        {/* 대표번호 */}
        <div style={{background:C.navy,color:'#fff',padding:'26px 22px',textAlign:'center'}}>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.7)',fontWeight:600,letterSpacing:'-0.3px'}}>지금 바로 우리 집 에어컨 무상 상담받기</div>
          <div style={{fontSize:30,fontWeight:900,color:'#8ec5ff',margin:'6px 0',letterSpacing:'0.5px'}}>{tel}</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.45)',marginTop:12,lineHeight:1.6,fontWeight:500}}>S전자서비스 공식 제휴 · 서비스파트너 등록업체</div>
        </div>

      </div>

      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:C.green,color:'#fff',padding:'16px 28px',borderRadius:14,fontSize:15,fontWeight:800,boxShadow:'0 10px 34px rgba(18,183,106,0.4)',zIndex:200,letterSpacing:'-0.3px'}}>{toast}</div>}
    </div>
  )
}

// 모듈 레벨 정의 — 컴포넌트 내부에 두면 매 렌더마다 재생성되어 input 포커스가 풀림
function Field({ label, C, children }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:15,fontWeight:800,color:C.ink,marginBottom:7,letterSpacing:'-0.4px'}}>{label} <span style={{color:C.red}}>*</span></label>
      {children}
    </div>
  )
}
