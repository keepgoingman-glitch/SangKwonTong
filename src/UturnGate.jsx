import { useState } from 'react'
import { db } from './supabase'
import UturnAdmin from './UturnAdmin'
import UturnMember from './UturnMember'

// U-TURN 통합 로그인 게이트 — 관리자(admin_accounts) 또는 팀원(mm_users) 로그인
export default function UturnGate({ onBack }) {
  const [screen, setScreen] = useState('login')  // login | admin | member
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [err, setErr] = useState('')
  const [adminInfo, setAdminInfo] = useState(null)
  const [mmInfo, setMmInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleLogin = async () => {
    setErr(''); setBusy(true)
    const id = String(lid).trim(), pw = String(lpw).trim()
    try {
      // 1) 관리자(admin_accounts) 먼저 시도
      const a = await db.rpc('verify_admin_login', { p_username: id, p_password: pw }).catch(()=>null)
      if (a && a.length) {
        setAdminInfo({ role: a[0].role, name: a[0].name, teamId: a[0].team_id || null })
        setScreen('admin'); setBusy(false); return
      }
      // 2) 팀원(mm_users) 시도
      const m = await db.rpc('verify_mm_login', { p_username: id, p_password: pw }).catch(()=>null)
      if (m && m.length) {
        setMmInfo({ username: m[0].username, name: m[0].name, region: m[0].region, team_id: m[0].team_id })
        setScreen('member'); setBusy(false); return
      }
      setErr('아이디 또는 비밀번호가 올바르지 않습니다'); setBusy(false)
    } catch (e) { setErr('연결 오류: ' + e.message); setBusy(false) }
  }

  if (screen === 'admin') return <UturnAdmin adminInfo={adminInfo} onBack={onBack} />
  if (screen === 'member') return <UturnMember mmInfo={mmInfo} onBack={onBack} />

  // 로그인 화면
  const IS = { width:'100%', background:'#f8fafc', border:'1.5px solid #e2e8f0', color:'#1e293b', padding:'14px 15px', borderRadius:'11px', fontSize:'16px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
  return (
    <div style={{ minHeight:'100vh', background:'#f4f6fb', display:'flex', flexDirection:'column', fontFamily:"'Noto Sans KR',sans-serif", color:'#1e293b' }}>
      <div style={{ padding:'18px 20px' }}>
        <button onClick={onBack} style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#64748b', fontSize:'14px', padding:'7px 13px', borderRadius:'9px', cursor:'pointer', fontFamily:'inherit' }}>‹ 홈으로</button>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', padding:'0 24px 80px' }}>
        <img src="/uturn-hero.png" alt="U-TURN" style={{ width:'100%', maxWidth:'300px', objectFit:'contain', marginBottom:'8px' }} />
        <h1 style={{ fontSize:'26px', fontWeight:'900', margin:'8px 0 4px', color:'#E31937' }}>U-TURN 로그인</h1>
        <p style={{ color:'#64748b', fontSize:'13.5px', marginBottom:'32px', textAlign:'center' }}>관리자·팀원 계정으로 로그인하세요</p>
        <div style={{ width:'100%', maxWidth:'360px', display:'flex', flexDirection:'column', gap:'12px' }}>
          <input placeholder="아이디" value={lid} onChange={e=>setLid(e.target.value)} style={IS} />
          <input type="password" placeholder="비밀번호" value={lpw} onChange={e=>setLpw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={IS} />
          {err && <div style={{ color:'#E31937', fontSize:'13.5px', background:'rgba(227,25,55,0.12)', border:'1px solid rgba(227,25,55,0.3)', padding:'11px', borderRadius:'10px' }}>{err}</div>}
          <button onClick={handleLogin} disabled={busy} style={{ padding:'15px', background:busy?'#e2e8f0':'#E31937', border:'none', color:'#fff', borderRadius:'12px', fontSize:'17px', fontWeight:'900', cursor:busy?'wait':'pointer', fontFamily:'inherit', marginTop:'4px' }}>{busy?'확인 중...':'로그인'}</button>
        </div>
      </div>
    </div>
  )
}
