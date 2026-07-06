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

// 아파트명 → 코드 슬러그
function slug(s) {
  return String(s||'').replace(/[^가-힣a-zA-Z0-9]/g,'').slice(0,12) || 'apt'
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
  const t2 = m => { setToast(m); setTimeout(()=>setToast(''),2500) }

  useEffect(()=>{ load() }, [])
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
  const totScan = camps.reduce((a,c)=>a+(c.scan_count||0),0)
  const totLead = camps.reduce((a,c)=>a+(c.lead_count||0),0)

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
      <div style={{maxWidth:'460px',margin:'0 auto',padding:'16px'}}>
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
                    <div style={{fontSize:'11.5px',color:C.sub,marginTop:'2px'}}>{c.region||'-'} · {c.households?c.households+'세대':'세대수 미입력'}</div>
                  </div>
                  <span style={{fontSize:'10px',fontWeight:'800',padding:'3px 9px',borderRadius:'10px',background:c.status==='진행중'?'#e0edff':'#f1f5f9',color:c.status==='진행중'?C.blue:C.sub}}>{c.status}</span>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <div style={{flex:1,background:'#f8fafc',borderRadius:'8px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'17px',fontWeight:'900',color:C.blue}}>{c.scan_count||0}</div><div style={{fontSize:'10px',color:C.sub}}>스캔</div></div>
                  <div style={{flex:1,background:'#f8fafc',borderRadius:'8px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'17px',fontWeight:'900',color:C.green}}>{c.lead_count||0}</div><div style={{fontSize:'10px',color:C.sub}}>상담요청</div></div>
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
      <div style={{maxWidth:'460px',margin:'0 auto',padding:'20px 16px'}}>
        <h2 style={{fontSize:'20px',fontWeight:'900',color:C.navy,marginBottom:'4px'}}>새 아파트 캠페인</h2>
        <p style={{fontSize:'13px',color:C.sub,marginBottom:'20px'}}>아파트명을 입력하면 해당 단지 전용 랜딩 + QR이 생성됩니다</p>
        <div style={{marginBottom:'14px'}}><label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>아파트명 *</label><input value={form.apt_name} onChange={e=>setForm(p=>({...p,apt_name:e.target.value}))} placeholder="예: 명지 에일린의뜰" style={IS}/></div>
        <div style={{display:'flex',gap:'10px',marginBottom:'14px'}}>
          <div style={{flex:1}}><label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>세대수</label><input type="number" value={form.households} onChange={e=>setForm(p=>({...p,households:e.target.value}))} placeholder="980" style={IS}/></div>
          <div style={{flex:1}}><label style={{display:'block',fontSize:'13px',fontWeight:'700',color:C.text,marginBottom:'6px'}}>지역</label><input value={form.region} onChange={e=>setForm(p=>({...p,region:e.target.value}))} placeholder="강서구" style={IS}/></div>
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
      <div style={{maxWidth:'460px',margin:'0 auto',padding:'16px'}}>
        <div style={{fontSize:'19px',fontWeight:'900',color:C.navy,marginBottom:'2px'}}>{c.apt_name}</div>
        <div style={{fontSize:'12px',color:C.sub,marginBottom:'16px'}}>{c.apt_code}</div>

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
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:C.green}}>{c.lead_count||0}</div><div style={{fontSize:'11px',color:C.sub}}>상담요청</div></div>
          <div style={{flex:1,background:'#fff',border:'1px solid '+C.border,borderRadius:'12px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'22px',fontWeight:'900',color:C.amber}}>{c.scan_count>0?Math.round(c.lead_count/c.scan_count*100):0}%</div><div style={{fontSize:'11px',color:C.sub}}>전환율</div></div>
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
