import { useState, useEffect } from 'react'
import { db } from './supabase'
import QRCode from 'qrcode'

// ── 에어컨 캠페인 관리 (총괄관리자 전용) ──
// 아파트명 입력 → qr_campaigns 생성 → QR 이미지 생성 (A3 전단 X)
// 아파트별 스캔/상담 카운팅 + 성과(UIT) 수기입력
const C = {
  bg:'#f4f6fb', card:'#fff', border:'#e2e8f0', text:'#1e293b', sub:'#64748b',
  blue:'#2563eb', navy:'#123a72', green:'#16a34a', red:'#dc2626', amber:'#d97706',
  u:'#9333ea', i:'#2563eb', t:'#d97706'
}
const IS = { width:'100%', padding:'13px 14px', border:'1.5px solid '+C.border, borderRadius:'11px', fontSize:'15px', fontFamily:'inherit', outline:'none', boxSizing:'border-box', color:C.text, background:'#fff' }
const BASE_URL = (typeof window!=='undefined' ? window.location.origin : 'https://sang-kwon-tong.vercel.app')

// 아파트명 → 코드 슬러그 (ASCII만: 한글은 apt_code에 못 씀 → URL/쿼리 깨짐 방지)
function slug(s) {
  const ascii = String(s||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,12)
  return ascii || 'apt'   // 한글만 있으면 'apt' + 뒤의 타임스탬프로 유일성 확보
}

export default function AirconCampaign({ adminInfo, onBack }) {
  const [tab, setTab] = useState('list')  // list | create | detail
  const [camps, setCamps] = useState([])
  const [leads, setLeads] = useState([])
  const [perfs, setPerfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)   // 선택 캠페인
  const [qrUrl, setQrUrl] = useState('')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ apt_name:'', households:'', region:'', contact_tel:'051-971-1111' })
  const [saving, setSaving] = useState(false)
  const [editCamp, setEditCamp] = useState(null)
  const [editForm, setEditForm] = useState({ apt_name:'', households:'', region:'', contact_tel:'', status:'진행중' })
  const t2 = m => { setToast(m); setTimeout(()=>setToast(''),2500) }

  // ── 웹 푸시 알림 구독 (총괄관리자 폰에서 1회 설정) ──
  const VAPID_PUBLIC = 'BA4viCmG__RR2DkCKbNLGNP0Lha8lN0pVX8aSbVvYhqlOswkuTojSVcvWDBL5vMm8eHkMLH8l2vEdsZGQa3Asho'
  const [pushOn, setPushOn] = useState(false)
  useEffect(() => {
    // 이미 구독돼 있는지 확인
    (async () => {
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.getRegistration()
          if (reg) { const sub = await reg.pushManager.getSubscription(); if (sub) setPushOn(true) }
        }
      } catch(e) {}
    })()
  }, [])
  const urlB64ToUint8 = (base64) => {
    const pad = '='.repeat((4 - base64.length % 4) % 4)
    const b64 = (base64 + pad).replace(/-/g,'+').replace(/_/g,'/')
    const raw = atob(b64); const arr = new Uint8Array(raw.length)
    for (let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i)
    return arr
  }
  const enablePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { t2('이 브라우저는 알림 미지원'); return }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { t2('알림 권한이 거부되었습니다'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) })
      }
      const j = sub.toJSON()
      // DB 저장 (endpoint UNIQUE라 중복이면 무시됨)
      await db.post('push_subscriptions', [{
        endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
        label: (adminInfo?.name || '총괄') + '-' + (navigator.platform || 'phone')
      }]).catch(async (e) => {
        // 중복 endpoint면 무시
        if (String(e.message||'').includes('409') || String(e.message||'').includes('duplicate')) return
        throw e
      })
      setPushOn(true); t2('✅ 알림이 켜졌습니다')
    } catch(e) { t2('알림 설정 실패: ' + e.message) }
  }
  const testPush = async () => {
    try {
      const base = window.location.origin
      const r = await fetch(base + '/api/send-push', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title:'🔔 테스트 알림', body:'푸시 알림이 정상 작동합니다.', url: base + '/#connector' })
      })
      const d = await r.json().catch(()=>({}))
      if (r.ok) t2('테스트 발송: ' + (d.sent||0) + '건')
      else t2('발송 실패: ' + (d.error||r.status))
    } catch(e) { t2('발송 오류: ' + e.message) }
  }

  const saveEdit = async () => {
    if (!editForm.apt_name.trim()) { t2('아파트명을 입력하세요'); return }
    try {
      await db.patch('qr_campaigns', 'id=eq.' + editCamp.id, {
        apt_name: editForm.apt_name.trim(), households: parseInt(editForm.households)||0,
        region: editForm.region.trim(), contact_tel: editForm.contact_tel.trim()||'051-971-1111',
        status: editForm.status
      })
      t2('수정 완료'); setEditCamp(null)
      // 상세 열려있으면 갱신
      if (detail && detail.id === editCamp.id) setDetail({ ...detail, ...editForm, households:parseInt(editForm.households)||0 })
      load()
    } catch(e) { t2('수정 실패: ' + e.message) }
  }

  useEffect(()=>{ load() }, [])

  // ── 신규 상담 실시간 알림 (30초 폴링) ──
  const [newAlert, setNewAlert] = useState(null)  // 새 상담 알림
  const lastCountRef = (typeof window!=='undefined') ? (window.__acLastLead = window.__acLastLead || { v:null }) : { v:null }
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const rows = await db.get('qr_theme_leads', 'select=id,customer,apt_name,created_at&order=created_at.desc&limit=100')
        const cnt = rows ? rows.length : 0
        if (lastCountRef.v === null) { lastCountRef.v = cnt; return }
        if (cnt > lastCountRef.v) {
          const newest = rows[0]
          setNewAlert({ customer: newest?.customer || '', apt: newest?.apt_name || '', diff: cnt - lastCountRef.v })
          // 알림음 (지원 브라우저)
          try {
            const AC = window.AudioContext || window.webkitAudioContext
            if (AC) { const ac = new AC(); const o = ac.createOscillator(); const g = ac.createGain()
              o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.value = 0.1
              o.start(); o.stop(ac.currentTime + 0.15) }
          } catch(e) {}
          setLeads(rows.length ? await db.get('qr_theme_leads','select=*&order=created_at.desc&limit=1000').catch(()=>leads) : leads)
          load()
        }
        lastCountRef.v = cnt
      } catch(e) {}
    }, 30000)
    return () => clearInterval(timer)
  }, [])
  const load = async () => {
    setLoading(true)
    try {
      const [cp, ld, pf] = await Promise.all([
        db.get('qr_campaigns', 'select=*&theme=eq.aircon&order=created_at.desc').catch(()=>[]),
        db.get('qr_theme_leads', 'select=*&order=created_at.desc&limit=1000').catch(()=>[]),
        db.get('qr_campaign_perf', 'select=*').catch(()=>[])
      ])
      setCamps(cp||[]); setLeads(ld||[]); setPerfs(pf||[])
    } catch(e) { t2('로드 오류') }
    setLoading(false)
  }

  // 캠페인 생성
  const createCamp = async () => {
    if (!form.apt_name.trim()) { t2('아파트명을 입력하세요'); return }
    setSaving(true)
    const code = 'CAMP-aircon-' + slug(form.apt_name) + '-' + String(Date.now()).slice(-4)
    try {
      await db.post('qr_campaigns', [{
        theme:'aircon', apt_name:form.apt_name.trim(), apt_code:code,
        households:parseInt(form.households)||0, region:form.region.trim(),
        contact_tel:form.contact_tel.trim()||'051-971-1111',
        scan_count:0, lead_count:0, status:'진행중', created_by:adminInfo?.name||'관리자'
      }])
      t2('캠페인 생성 완료!')
      setForm({ apt_name:'', households:'', region:'', contact_tel:'051-971-1111' })
      setTab('list'); load()
    } catch(e) { t2('생성 실패: '+e.message) }
    setSaving(false)
  }

  // QR 이미지 생성
  const genQR = async (camp) => {
    const url = BASE_URL + '/#qr-store-' + camp.apt_code
    try {
      const dataUrl = await QRCode.toDataURL(url, { width:600, margin:2, errorCorrectionLevel:'H', color:{ dark:'#123a72', light:'#ffffff' } })
      setQrUrl(dataUrl)
    } catch(e) { t2('QR 생성 실패') }
  }
  const downloadQR = (camp) => {
    if (!qrUrl) return
    const a = document.createElement('a'); a.href = qrUrl; a.download = 'QR_'+camp.apt_name+'.png'; a.click()
  }

  // 성과 저장
  const savePerf = async (aptCode, y, m, vals) => {
    try {
      const existing = perfs.find(p=>p.apt_code===aptCode && p.year===y && p.month===m)
      const row = { apt_code:aptCode, year:y, month:m,
        visit_count:parseInt(vals.visit)||0, contract_cnt:parseInt(vals.contract)||0,
        u_result:parseInt(vals.u)||0, i_result:parseInt(vals.i)||0, t_result:parseInt(vals.t)||0,
        revenue:parseInt(vals.revenue)||0, updated_by:adminInfo?.name||'관리자', updated_at:new Date().toISOString() }
      if (existing) await db.patch('qr_campaign_perf', 'id=eq.'+existing.id, row)
      else await db.post('qr_campaign_perf', [row])
      t2('성과 저장 완료!'); load()
    } catch(e) { t2('저장 실패: '+e.message) }
  }

  const campLeads = code => leads.filter(l=>l.apt_code===code)

  // 상담 문자 형식 복사
  const copyLead = (l) => {
    const camp = camps.find(c => c.apt_code === l.apt_code)
    const addr = (camp && camp.region) ? camp.region : ''
    const txt = [
      '[에어컨 클린케어 상담 요청]',
      '▪ 아파트: ' + (l.apt_name || camp?.apt_name || ''),
      addr ? ('▪ 주소: ' + addr) : null,
      '▪ 고객명: ' + l.customer,
      '▪ 동/호수: ' + (l.dong_ho || '-'),
      '▪ 제조사: ' + (l.brand || '-'),
      '▪ 유형: ' + (l.ac_type || '-') + ' / ' + (l.ac_count || 1) + '대',
      '▪ 연락처: ' + l.phone,
      '▪ 희망시간: ' + (l.pref_time || '-'),
      '▪ 상태: ' + (l.status || '상담요청')
    ].filter(Boolean).join('\n')
    if (navigator.clipboard) { navigator.clipboard.writeText(txt); t2('문자 형식으로 복사됨') }
    else t2('복사 미지원 브라우저')
  }

  // 개별 상담 삭제
  const delLead = async (l) => {
    if (!window.confirm('【' + l.customer + '】 상담 요청을 삭제할까요?')) return
    try { await db.del('qr_theme_leads', 'id=eq.' + l.id); t2('삭제 완료'); load() }
    catch(e) { t2('삭제 실패: ' + e.message) }
  }

  // 캠페인 삭제
  const delCamp = async (c) => {
    if (!window.confirm('【' + c.apt_name + '】 캠페인을 삭제할까요?\n소속 상담 요청도 함께 삭제됩니다.')) return
    try {
      await db.del('qr_theme_leads', 'apt_code=eq.' + encodeURIComponent(c.apt_code)).catch(()=>{})
      await db.del('qr_campaign_perf', 'apt_code=eq.' + encodeURIComponent(c.apt_code)).catch(()=>{})
      await db.del('qr_campaigns', 'id=eq.' + c.id)
      t2('캠페인 삭제 완료'); setDetail(null); setTab('list'); load()
    } catch(e) { t2('삭제 실패: ' + e.message) }
  }
  const totScan = camps.reduce((a,c)=>a+(c.scan_count||0),0)
  const totLead = leads.length   // 실제 상담 개수 (lead_count 누적 대신 → 이중카운트 방지)

  const Header = () => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'#fff',borderBottom:'1px solid '+C.border,position:'sticky',top:0,zIndex:50}}>
      <button onClick={()=>{ if(tab==='detail'||tab==='create'){setTab('list');setDetail(null);setQrUrl('')} else onBack&&onBack() }} style={{background:'#f1f5f9',border:'1px solid '+C.border,color:C.sub,fontSize:'13px',padding:'7px 12px',borderRadius:'8px',cursor:'pointer',fontFamily:'inherit'}}>‹ {tab==='list'?'뒤로':'목록'}</button>
      <span style={{fontSize:'15px',fontWeight:'900',color:C.navy}}>❄️ 에어컨 캠페인</span>
      <button onClick={load} style={{background:'#f1f5f9',border:'1px solid '+C.border,color:C.sub,fontSize:'14px',padding:'7px 11px',borderRadius:'8px',cursor:'pointer'}}>🔄</button>
    </div>
  )

  // ── 목록 화면 ──
  if (tab==='list') return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Pretendard','Noto Sans KR',sans-serif",color:C.text,paddingBottom:'40px'}}>
      <Header/>
      {toast&&<div style={{position:'fixed',top:'70px',left:'50%',transform:'translateX(-50%)',background:'#1e293b',color:'#fff',padding:'11px 22px',borderRadius:'12px',zIndex:100,fontSize:'14px',fontWeight:'700'}}>{toast}</div>}
      {newAlert && (
        <div onClick={()=>{setNewAlert(null)}} style={{position:'fixed',top:'62px',left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#16a34a,#0e9d5c)',color:'#fff',padding:'13px 20px',borderRadius:'14px',zIndex:150,fontSize:'14px',fontWeight:'800',boxShadow:'0 8px 28px rgba(22,163,74,0.4)',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px',maxWidth:'90%'}}>
          <span style={{fontSize:'20px'}}>🔔</span>
          <span>신규 상담 {newAlert.diff}건! {newAlert.apt} {newAlert.customer}님<br/><span style={{fontSize:'11px',opacity:0.85,fontWeight:'600'}}>탭하여 확인 →</span></span>
        </div>
      )}
      {editCamp && <EditCampModal editForm={editForm} setEditForm={setEditForm} onSave={saveEdit} onClose={()=>setEditCamp(null)} C={C} IS={IS} />}
      <div style={{maxWidth:'460px',margin:'0 auto',padding:'16px'}}>
        {/* 푸시 알림 설정 */}
        <div style={{background:pushOn?'#f0fdf4':'#fff7ed',border:'1px solid '+(pushOn?'#bbf7d0':'#fed7aa'),borderRadius:'14px',padding:'13px 15px',marginBottom:'14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'22px'}}>{pushOn?'🔔':'🔕'}</span>
            <div>
              <div style={{fontSize:'13.5px',fontWeight:'800',color:pushOn?'#15803d':'#b45309'}}>{pushOn?'폰 알림 켜짐':'폰 알림 받기'}</div>
              <div style={{fontSize:'11px',color:C.sub,marginTop:'1px'}}>{pushOn?'앱을 꺼도 새 상담 알림이 옵니다':'앱을 꺼도 신규 상담 알림 받기'}</div>
            </div>
          </div>
          {pushOn
            ? <button onClick={testPush} style={{padding:'8px 12px',background:'#dcfce7',border:'none',color:'#15803d',borderRadius:'9px',fontSize:'12px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>테스트</button>
            : <button onClick={enablePush} style={{padding:'8px 14px',background:C.amber,border:'none',color:'#fff',borderRadius:'9px',fontSize:'12.5px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>알림 켜기</button>}
        </div>
        {/* 요약 */}
        <div style={{display:'flex',gap:'10px',marginBottom:'14px'}}>
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'14px',padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:'24px',fontWeight:'900',color:C.navy}}>{camps.length}</div>
            <div style={{fontSize:'11px',color:C.sub,marginTop:'2px'}}>진행 캠페인</div>
          </div>
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'14px',padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:'24px',fontWeight:'900',color:C.blue}}>{totScan}</div>
            <div style={{fontSize:'11px',color:C.sub,marginTop:'2px'}}>총 스캔</div>
          </div>
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'14px',padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:'24px',fontWeight:'900',color:C.green}}>{totLead}</div>
            <div style={{fontSize:'11px',color:C.sub,marginTop:'2px'}}>총 상담요청</div>
          </div>
        </div>

        <button onClick={()=>setTab('create')} style={{width:'100%',padding:'14px',background:C.navy,border:'none',color:'#fff',borderRadius:'12px',fontSize:'15px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit',marginBottom:'16px'}}>+ 새 아파트 캠페인 만들기</button>

        {loading ? <div style={{textAlign:'center',padding:'40px',color:C.sub}}>불러오는 중...</div>
          : camps.length===0 ? <div style={{textAlign:'center',padding:'50px 20px',color:C.sub}}><div style={{fontSize:'40px',marginBottom:'10px'}}>❄️</div><div style={{fontSize:'15px',fontWeight:'700'}}>등록된 캠페인이 없습니다</div><div style={{fontSize:'12.5px',marginTop:'4px'}}>아파트명을 입력해 첫 캠페인을 만드세요</div></div>
          : camps.map(c=>{
            const cl = campLeads(c.apt_code)
            const success = cl.filter(l=>l.status==='시공완료').length
            return (
              <div key={c.id} onClick={()=>{setDetail(c);setTab('detail');setQrUrl('');genQR(c)}} style={{background:'#fff',border:'1px solid '+C.border,borderLeft:'4px solid '+C.blue,borderRadius:'14px',padding:'15px',marginBottom:'11px',cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                  <div>
                    <div style={{fontSize:'16px',fontWeight:'900',color:C.text}}>{c.apt_name}</div>
                    <div style={{fontSize:'11.5px',color:C.sub,marginTop:'2px'}}>{c.region||'주소 미입력'} · {c.households?c.households+'세대':'세대수 미입력'}</div>
                  </div>
                  <span style={{fontSize:'10px',fontWeight:'800',padding:'3px 9px',borderRadius:'10px',background:c.status==='진행중'?'#e0edff':'#f1f5f9',color:c.status==='진행중'?C.blue:C.sub}}>{c.status}</span>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <div style={{flex:1,background:'#f8fafc',borderRadius:'8px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'17px',fontWeight:'900',color:C.blue}}>{c.scan_count||0}</div><div style={{fontSize:'10px',color:C.sub}}>스캔</div></div>
                  <div style={{flex:1,background:'#f8fafc',borderRadius:'8px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'17px',fontWeight:'900',color:C.green}}>{cl.length}</div><div style={{fontSize:'10px',color:C.sub}}>상담요청</div></div>
                  <div style={{flex:1,background:'#f8fafc',borderRadius:'8px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'17px',fontWeight:'900',color:C.amber}}>{success}</div><div style={{fontSize:'10px',color:C.sub}}>시공완료</div></div>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )

  // ── 생성 화면 ──
  if (tab==='create') return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Pretendard','Noto Sans KR',sans-serif",color:C.text}}>
      <Header/>
      {toast&&<div style={{position:'fixed',top:'70px',left:'50%',transform:'translateX(-50%)',background:'#1e293b',color:'#fff',padding:'11px 22px',borderRadius:'12px',zIndex:100,fontSize:'14px',fontWeight:'700'}}>{toast}</div>}
      {newAlert && (
        <div onClick={()=>{setNewAlert(null)}} style={{position:'fixed',top:'62px',left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#16a34a,#0e9d5c)',color:'#fff',padding:'13px 20px',borderRadius:'14px',zIndex:150,fontSize:'14px',fontWeight:'800',boxShadow:'0 8px 28px rgba(22,163,74,0.4)',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px',maxWidth:'90%'}}>
          <span style={{fontSize:'20px'}}>🔔</span>
          <span>신규 상담 {newAlert.diff}건! {newAlert.apt} {newAlert.customer}님<br/><span style={{fontSize:'11px',opacity:0.85,fontWeight:'600'}}>탭하여 확인 →</span></span>
        </div>
      )}
      <div style={{maxWidth:'460px',margin:'0 auto',padding:'20px 16px'}}>
        <h2 style={{fontSize:'20px',fontWeight:'900',color:C.navy,marginBottom:'4px'}}>새 아파트 캠페인</h2>
        <p style={{fontSize:'13px',color:C.sub,marginBottom:'20px'}}>아파트명을 입력하면 해당 단지 전용 랜딩 + QR이 생성됩니다</p>
        <div style={{marginBottom:'14px'}}><label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>아파트명 *</label><input value={form.apt_name} onChange={e=>setForm(p=>({...p,apt_name:e.target.value}))} placeholder="예: 명지 에일린의뜰" style={IS}/></div>
        <div style={{marginBottom:'14px'}}><label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>주소</label><input value={form.region} onChange={e=>setForm(p=>({...p,region:e.target.value}))} placeholder="예: 부산 강서구 명지국제5로 000" style={IS}/></div>
        <div style={{marginBottom:'14px'}}>
          <div style={{flex:1}}><label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>세대수</label><input type="number" value={form.households} onChange={e=>setForm(p=>({...p,households:e.target.value}))} placeholder="980" style={IS}/></div>
        </div>
        <div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>대표번호</label><input value={form.contact_tel} onChange={e=>setForm(p=>({...p,contact_tel:e.target.value}))} placeholder="051-971-1111" style={IS}/></div>
        <button onClick={createCamp} disabled={saving} style={{width:'100%',padding:'15px',background:saving?'#cbd5e1':C.navy,border:'none',color:'#fff',borderRadius:'12px',fontSize:'16px',fontWeight:'900',cursor:saving?'wait':'pointer',fontFamily:'inherit'}}>{saving?'생성 중...':'캠페인 생성 + QR 발급'}</button>
      </div>
    </div>
  )

  // ── 상세 화면 (QR + 상담목록 + 성과입력) ──
  const c = detail
  const cl = campLeads(c.apt_code)
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()+1
  const curPerf = perfs.find(p=>p.apt_code===c.apt_code && p.year===y && p.month===m) || {}
  const landingUrl = BASE_URL + '/#qr-store-' + c.apt_code

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Pretendard','Noto Sans KR',sans-serif",color:C.text,paddingBottom:'40px'}}>
      <Header/>
      {toast&&<div style={{position:'fixed',top:'70px',left:'50%',transform:'translateX(-50%)',background:'#1e293b',color:'#fff',padding:'11px 22px',borderRadius:'12px',zIndex:100,fontSize:'14px',fontWeight:'700'}}>{toast}</div>}
      {newAlert && (
        <div onClick={()=>{setNewAlert(null)}} style={{position:'fixed',top:'62px',left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#16a34a,#0e9d5c)',color:'#fff',padding:'13px 20px',borderRadius:'14px',zIndex:150,fontSize:'14px',fontWeight:'800',boxShadow:'0 8px 28px rgba(22,163,74,0.4)',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px',maxWidth:'90%'}}>
          <span style={{fontSize:'20px'}}>🔔</span>
          <span>신규 상담 {newAlert.diff}건! {newAlert.apt} {newAlert.customer}님<br/><span style={{fontSize:'11px',opacity:0.85,fontWeight:'600'}}>탭하여 확인 →</span></span>
        </div>
      )}
      {editCamp && <EditCampModal editForm={editForm} setEditForm={setEditForm} onSave={saveEdit} onClose={()=>setEditCamp(null)} C={C} IS={IS} />}
      <div style={{maxWidth:'460px',margin:'0 auto',padding:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
          <div>
            <div style={{fontSize:'19px',fontWeight:'900',color:C.navy,marginBottom:'2px'}}>{c.apt_name}</div>
            <div style={{fontSize:'12px',color:C.sub}}>{c.apt_code}</div>
          </div>
          <div style={{display:'flex',gap:'6px',flexShrink:0}}>
            <button onClick={()=>{ setEditCamp(c); setEditForm({ apt_name:c.apt_name, households:c.households||'', region:c.region||'', contact_tel:c.contact_tel||'', status:c.status||'진행중' }) }} style={{padding:'7px 12px',background:'#e0edff',border:'none',color:C.blue,borderRadius:'8px',fontSize:'12px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>수정</button>
            <button onClick={()=>delCamp(c)} style={{padding:'7px 12px',background:'#fee2e2',border:'none',color:C.red,borderRadius:'8px',fontSize:'12px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>삭제</button>
          </div>
        </div>

        {/* QR */}
        <div style={{background:'#fff',border:'1px solid '+C.border,borderRadius:'16px',padding:'20px',textAlign:'center',marginBottom:'14px'}}>
          <div style={{fontSize:'13px',fontWeight:'800',color:C.text,marginBottom:'12px'}}>📱 캠페인 QR 코드</div>
          {qrUrl ? <img src={qrUrl} alt="QR" style={{width:'200px',height:'200px',margin:'0 auto',display:'block',borderRadius:'12px',border:'1px solid '+C.border}}/> : <div style={{padding:'60px',color:C.sub}}>QR 생성 중...</div>}
          <div style={{fontSize:'11px',color:C.sub,marginTop:'10px',wordBreak:'break-all'}}>{landingUrl}</div>
          <div style={{display:'flex',gap:'8px',marginTop:'14px'}}>
            <button onClick={()=>downloadQR(c)} style={{flex:1,padding:'12px',background:C.navy,border:'none',color:'#fff',borderRadius:'10px',fontSize:'14px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>⬇ QR 이미지 저장</button>
            <button onClick={()=>{navigator.clipboard&&navigator.clipboard.writeText(landingUrl);t2('링크 복사됨')}} style={{flex:1,padding:'12px',background:'#f1f5f9',border:'1px solid '+C.border,color:C.sub,borderRadius:'10px',fontSize:'14px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>🔗 링크 복사</button>
          </div>
        </div>

        {/* 카운트 */}
        <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:C.blue}}>{c.scan_count||0}</div><div style={{fontSize:'11px',color:C.sub}}>QR 스캔</div></div>
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:C.green}}>{cl.length}</div><div style={{fontSize:'11px',color:C.sub}}>상담요청</div></div>
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:C.amber}}>{c.scan_count>0?Math.round(cl.length/c.scan_count*100):0}%</div><div style={{fontSize:'11px',color:C.sub}}>전환율</div></div>
        </div>

        {/* 성과 수기입력 */}
        <div style={{background:'#fff',border:'1px solid '+C.border,borderRadius:'16px',padding:'16px',marginBottom:'14px'}}>
          <div style={{fontSize:'14px',fontWeight:'900',color:C.text,marginBottom:'12px'}}>📊 {m}월 성과 입력</div>
          <PerfForm curPerf={curPerf} onSave={vals=>savePerf(c.apt_code,y,m,vals)} C={C} IS={IS}/>
        </div>

        {/* 상담 목록 */}
        <div style={{fontSize:'14px',fontWeight:'900',color:C.text,marginBottom:'10px'}}>📞 상담 요청 ({cl.length})</div>
        {cl.length===0 ? <div style={{textAlign:'center',padding:'30px',color:C.sub,fontSize:'13px',background:'#fff',borderRadius:'12px',border:'1px solid '+C.border}}>아직 상담 요청이 없습니다</div>
          : cl.map(l=>{
            const sc = {'상담요청':['#fef3c7','#92400e'],'연결완료':['#e0edff','#1d4ed8'],'방문예약':['#ede9fe','#6d28d9'],'시공완료':['#dcfce7','#15803d'],'실패':['#fee2e2','#dc2626']}[l.status]||['#f1f5f9','#64748b']
            return (
              <div key={l.id} style={{background:'#fff',border:'1px solid '+C.border,borderRadius:'12px',padding:'13px',marginBottom:'9px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{fontSize:'15px',fontWeight:'800',color:C.text}}>{l.customer} <span style={{fontSize:'12px',color:C.sub,fontWeight:'400'}}>{l.dong_ho}</span></span>
                  <select value={l.status} onChange={async e=>{try{await db.patch('qr_theme_leads','id=eq.'+l.id,{status:e.target.value});t2('상태 변경');load()}catch{t2('실패')}}} style={{fontSize:'11px',fontWeight:'700',padding:'4px 8px',borderRadius:'10px',border:'1px solid '+sc[1],background:sc[0],color:sc[1],fontFamily:'inherit'}}>
                    {['상담요청','연결완료','방문예약','시공완료','실패'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{fontSize:'12.5px',color:C.sub,lineHeight:1.7}}>
                  📱 {l.brand} · {l.ac_type} · {l.ac_count}대<br/>
                  📞 {l.phone} · 희망: {l.pref_time}
                </div>
                <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
                  <button onClick={()=>copyLead(l)} style={{flex:1,padding:'9px',background:'#e0edff',border:'none',color:C.blue,borderRadius:'9px',fontSize:'12.5px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>📋 문자 복사</button>
                  <button onClick={()=>delLead(l)} style={{padding:'9px 14px',background:'#fee2e2',border:'none',color:C.red,borderRadius:'9px',fontSize:'12.5px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>삭제</button>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// 성과 입력 폼
function PerfForm({ curPerf, onSave, C, IS }) {
  const [v, setV] = useState({
    visit:curPerf.visit_count||'', contract:curPerf.contract_cnt||'',
    u:curPerf.u_result||'', i:curPerf.i_result||'', t:curPerf.t_result||'', revenue:curPerf.revenue||''
  })
  useEffect(()=>{ setV({visit:curPerf.visit_count||'',contract:curPerf.contract_cnt||'',u:curPerf.u_result||'',i:curPerf.i_result||'',t:curPerf.t_result||'',revenue:curPerf.revenue||''}) },[curPerf.id])
  const F = (k,label,color) => (
    <div style={{flex:1}}>
      <div style={{fontSize:'11px',color:C.sub,fontWeight:'700',marginBottom:'4px',textAlign:'center'}}>{label}</div>
      <input type="number" value={v[k]} onChange={e=>setV(p=>({...p,[k]:e.target.value}))} placeholder="0" style={{...IS,textAlign:'center',fontWeight:'800',padding:'10px 4px',color:color||C.text}}/>
    </div>
  )
  return (
    <div>
      <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>{F('visit','방문상담')}{F('contract','시공계약')}{F('revenue','매출(만원)')}</div>
      <div style={{fontSize:'11px',color:C.sub,fontWeight:'700',margin:'6px 0 5px'}}>UIT 연계 성과 (에어컨 상담→통신 전환)</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>{F('u','U (신규·MNP)',C.u)}{F('i','I (인터넷)',C.i)}{F('t','T (TV)',C.t)}</div>
      <button onClick={()=>onSave(v)} style={{width:'100%',padding:'12px',background:C.blue,border:'none',color:'#fff',borderRadius:'10px',fontSize:'14px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>성과 저장</button>
    </div>
  )
}

// 캠페인 수정 모달
function EditCampModal({ editForm, setEditForm, onSave, onClose, C, IS }) {
  const set = (k,v) => setEditForm(p=>({...p,[k]:v}))
  const lbl = t => <label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>{t}</label>
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'24px 20px 32px',width:'100%',maxWidth:'460px',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{fontSize:'17px',fontWeight:'900',color:C.navy,marginBottom:'18px'}}>✏️ 캠페인 수정</div>
        <div style={{marginBottom:'14px'}}>{lbl('아파트명 *')}<input value={editForm.apt_name} onChange={e=>set('apt_name',e.target.value)} style={IS}/></div>
        <div style={{marginBottom:'14px'}}>{lbl('주소')}<input value={editForm.region} onChange={e=>set('region',e.target.value)} placeholder="예: 부산 강서구 명지국제5로 000" style={IS}/></div>
        <div style={{marginBottom:'14px'}}>
          <div style={{flex:1}}>{lbl('세대수')}<input type="number" value={editForm.households} onChange={e=>set('households',e.target.value)} style={IS}/></div>
        </div>
        <div style={{marginBottom:'14px'}}>{lbl('대표번호')}<input value={editForm.contact_tel} onChange={e=>set('contact_tel',e.target.value)} style={IS}/></div>
        <div style={{marginBottom:'20px'}}>{lbl('상태')}
          <select value={editForm.status} onChange={e=>set('status',e.target.value)} style={IS}>
            <option value="진행중">진행중</option><option value="종료">종료</option>
          </select>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <button onClick={onClose} style={{flex:1,padding:'14px',background:'#f1f5f9',border:'none',color:C.sub,borderRadius:'12px',fontSize:'15px',fontWeight:'800',cursor:'pointer',fontFamily:'inherit'}}>취소</button>
          <button onClick={onSave} style={{flex:2,padding:'14px',background:C.navy,border:'none',color:'#fff',borderRadius:'12px',fontSize:'15px',fontWeight:'900',cursor:'pointer',fontFamily:'inherit'}}>수정 저장</button>
        </div>
      </div>
    </div>
  )
}
