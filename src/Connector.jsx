import { useState } from 'react'
import { db } from './supabase'

const riskStyle = r =>
  r >= 70 ? { bg: '#052e16', text: '#4ade80', border: '#14532d', label: '양호' }
  : r >= 40 ? { bg: '#2d1d00', text: '#fbbf24', border: '#451a03', label: '주의' }
  : { bg: '#1f0505', text: '#f87171', border: '#450a0a', label: '위험' }

const C = { bg: '#0b1220', card: '#131e30', border: '#1e3050', acc: '#f59e0b', text: '#f1f5f9', sub: '#94a3b8' }

export default function Connector({ onBack }) {
  const [screen, setScreen] = useState('login')
  const [lid, setLid] = useState(''); const [lpw, setLpw] = useState(''); const [lerr, setLerr] = useState('')
  const [tab, setTab] = useState('overview')
  const [users, setUsers] = useState([]); const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false); const [toast, setToast] = useState('')
  const [addModal, setAddModal] = useState(false); const [editModal, setEditModal] = useState(null)
  const [assignModal, setAssignModal] = useState(null); const [selMM, setSelMM] = useState('')
  const [filterSt, setFilterSt] = useState('전체')
  const [goalEdit, setGoalEdit] = useState({}); const [savedGoal, setSavedGoal] = useState(null)
  const [newU, setNewU] = useState({ name: '', username: '', password: '', region: '', goal: '10' })
  const [addErr, setAddErr] = useState('')

  const t2 = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = async () => {
    setLoading(true)
    try {
      const [u, l] = await Promise.all([db.get('mm_users', 'order=created_at.asc'), db.get('connector_leads', 'order=created_at.desc')])
      setUsers(u); setLeads(l)
    } catch (e) { t2('로드 오류: ' + e.message) }
    setLoading(false)
  }

  const handleLogin = () => {
    if (lid === 'admin' && lpw === 'admin1234') { setScreen('main'); load() }
    else setLerr('아이디 또는 비밀번호가 올바르지 않습니다')
  }

  const handleAdd = async () => {
    setAddErr('')
    if (!newU.name || !newU.username || !newU.password || !newU.region) { setAddErr('모든 항목을 입력하세요'); return }
    try {
      await db.post('mm_users', { username: newU.username, password: newU.password, name: newU.name, region: newU.region, goal: parseInt(newU.goal) || 10 })
      setAddModal(false); setNewU({ name: '', username: '', password: '', region: '', goal: '10' })
      t2(newU.name + ' MM 계정 생성!'); load()
    } catch { setAddErr('아이디 중복 또는 오류') }
  }

  const handleEdit = async () => {
    try { await db.patch('mm_users', 'id=eq.' + editModal.id, { name: editModal.name, password: editModal.password, region: editModal.region }); setEditModal(null); t2('수정 완료!'); load() }
    catch { t2('수정 실패') }
  }

  const handleDelete = async id => {
    try { await db.del('mm_users', 'id=eq.' + id); t2('삭제 완료'); load() } catch { t2('삭제 실패') }
  }

  const handleAssign = async leadId => {
    if (!selMM) return
    try { await db.patch('connector_leads', 'id=eq.' + leadId, { assigned_to: selMM, assign_status: '배분완료' }); setAssignModal(null); setSelMM(''); t2(selMM + ' MM에게 배분!'); load() }
    catch { t2('배분 실패') }
  }

  const bulkAssign = async () => {
    const un = leads.filter(l => l.assign_status === '미배분')
    if (!un.length || !users.length) return
    try { for (let i = 0; i < un.length; i++) await db.patch('connector_leads', 'id=eq.' + un[i].id, { assigned_to: users[i % users.length].name, assign_status: '배분완료' }); t2('자동 배분 완료!'); load() }
    catch { t2('배분 오류') }
  }

  const saveGoal = async uid => {
    const val = parseInt(goalEdit[uid]); if (!val || val < 1) return
    try { await db.patch('mm_users', 'id=eq.' + uid, { goal: val }); setSavedGoal(uid); setTimeout(() => setSavedGoal(null), 2000); t2('목표 저장!'); load() }
    catch { t2('저장 실패') }
  }

  const downloadCSV = () => {
    const rows = [['이름', '아이디', '지역', '성공', '목표', '달성률']].concat(users.map(u => [u.name, u.username, u.region, u.success, u.goal, Math.round(u.success / u.goal * 100) + '%']))
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = '상권통_성과_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click()
  }

  const navTabs = [{ id: 'overview', label: '팀 현황', icon: '📊' }, { id: 'staff', label: '직원 관리', icon: '👥' }, { id: 'leads', label: '기회 배분', icon: '📋' }, { id: 'goals', label: '목표 설정', icon: '🎯' }]
  const totalSuccess = users.reduce((a, u) => a + (u.success || 0), 0)
  const totalGoal = users.reduce((a, u) => a + (u.goal || 0), 0)
  const unassigned = leads.filter(l => l.assign_status === '미배분').length
  const filtered = filterSt === '전체' ? leads : leads.filter(l => l.assign_status === filterSt)

  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a1628,#0f1f38)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 24px', fontFamily: "'Noto Sans KR',sans-serif", color: C.text }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer', marginBottom: '24px' }}>← 홈으로</button>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ background: C.acc, color: '#0a1628', fontWeight: '900', fontSize: '14px', padding: '4px 14px', borderRadius: '4px', display: 'inline-block', marginBottom: '12px' }}>상권통</div>
        <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 6px' }}>커낵터</h1>
        <p style={{ color: C.sub, fontSize: '15px', margin: 0 }}>관리자 전용 플랫폼</p>
      </div>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <input type="text" placeholder="관리자 아이디" value={lid} onChange={e => { setLid(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', background: C.card, border: '1px solid ' + C.border, color: C.text, padding: '18px', borderRadius: '12px', fontSize: '20px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        <input type="password" placeholder="비밀번호" value={lpw} onChange={e => { setLpw(e.target.value); setLerr('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', background: C.card, border: '1px solid ' + C.border, color: C.text, padding: '18px', borderRadius: '12px', fontSize: '20px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        {lerr && <div style={{ color: '#f87171', fontSize: '15px', textAlign: 'center', background: 'rgba(248,113,113,0.1)', padding: '12px', borderRadius: '8px' }}>{lerr}</div>}
        <button onClick={handleLogin} style={{ background: C.acc, border: 'none', color: '#0a1628', padding: '20px', borderRadius: '12px', fontSize: '20px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>로그인</button>
      </div>
      <div style={{ marginTop: '24px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '14px 20px', textAlign: 'center' }}>
        <div style={{ color: C.acc, fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>초기 관리자 계정</div>
        <div style={{ color: C.sub, fontSize: '15px' }}>ID: admin &nbsp;|&nbsp; PW: admin1234</div>
      </div>
    </div>
  )

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Noto Sans KR',sans-serif", fontSize: '20px' }}>불러오는 중...</div>

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Noto Sans KR',sans-serif", maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: '#052e16', border: '1px solid #4ade80', color: '#4ade80', padding: '12px 22px', borderRadius: '40px', fontSize: '15px', fontWeight: '700', zIndex: 9999, whiteSpace: 'nowrap' }}>✅ {toast}</div>}

      {/* 계정추가 모달 */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998 }}>
          <div style={{ background: C.card, borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px' }}>신규 MM 계정 등록</h3>
            {addErr && <div style={{ color: '#f87171', fontSize: '14px', marginBottom: '12px', background: 'rgba(248,113,113,0.1)', padding: '10px', borderRadius: '6px' }}>{addErr}</div>}
            {[{ k: 'name', l: '이름', p: '홍길동' }, { k: 'username', l: '아이디', p: 'mm003' }, { k: 'password', l: '비밀번호', p: '초기 비밀번호' }, { k: 'region', l: '담당 지역', p: '예: 강남구' }, { k: 'goal', l: '목표(건)', p: '10', t: 'number' }].map(f => (
              <div key={f.k} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', color: C.sub, marginBottom: '5px', fontWeight: '600' }}>{f.l}</div>
                <input type={f.t || 'text'} placeholder={f.p} value={newU[f.k]} onChange={e => setNewU({ ...newU, [f.k]: e.target.value })} style={{ width: '100%', background: C.bg, border: '1px solid ' + C.border, color: C.text, padding: '13px', borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => { setAddModal(false); setAddErr('') }} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid ' + C.border, color: C.sub, borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleAdd} style={{ flex: 2, padding: '14px', background: C.acc, border: 'none', color: '#0b1220', borderRadius: '10px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>계정 생성</button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998 }}>
          <div style={{ background: C.card, borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px' }}>계정 수정</h3>
            {[{ k: 'name', l: '이름' }, { k: 'password', l: '비밀번호' }, { k: 'region', l: '담당 지역' }].map(f => (
              <div key={f.k} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', color: C.sub, marginBottom: '5px', fontWeight: '600' }}>{f.l}</div>
                <input type="text" value={editModal[f.k] || ''} onChange={e => setEditModal({ ...editModal, [f.k]: e.target.value })} style={{ width: '100%', background: C.bg, border: '1px solid ' + C.border, color: C.text, padding: '13px', borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setEditModal(null)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid ' + C.border, color: C.sub, borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleEdit} style={{ flex: 2, padding: '14px', background: C.acc, border: 'none', color: '#0b1220', borderRadius: '10px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 배분 모달 */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 998 }}>
          <div style={{ background: C.card, borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '6px' }}>MM 배분</h3>
            <p style={{ color: C.sub, fontSize: '14px', marginBottom: '16px' }}>{assignModal.address}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {users.map(u => (
                <button key={u.id} onClick={() => setSelMM(u.name)} style={{ padding: '14px 16px', background: selMM === u.name ? 'rgba(245,158,11,0.2)' : C.bg, border: selMM === u.name ? '2px solid ' + C.acc : '1px solid ' + C.border, borderRadius: '10px', color: C.text, fontSize: '16px', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{u.name} · {u.region}</span><span style={{ color: C.sub, fontSize: '14px' }}>성공 {u.success}건</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setAssignModal(null); setSelMM('') }} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid ' + C.border, color: C.sub, borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={() => handleAssign(assignModal.id)} disabled={!selMM} style={{ flex: 2, padding: '14px', background: selMM ? C.acc : '#1e293b', border: 'none', color: selMM ? '#0b1220' : '#475569', borderRadius: '10px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>배분하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#1a2f4a,#0b1220)', padding: '18px 20px 14px', borderBottom: '3px solid ' + C.acc }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: C.acc, color: '#0b1220', fontWeight: '900', fontSize: '12px', padding: '3px 9px', borderRadius: '4px' }}>상권통</span>
            <span style={{ color: C.acc, fontWeight: '900', fontSize: '18px' }}>커낵터</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={load} style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.sub, padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>🔄</button>
            <button onClick={() => setScreen('login')} style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.sub, padding: '6px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[{ l: '등록 MM', v: users.length, u: '명', a: false }, { l: '미배분', v: unassigned, u: '건', a: unassigned > 0 }, { l: '팀 성공', v: totalSuccess, u: '건', a: false }].map((s, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '900', color: s.a ? '#ef4444' : C.acc }}>{s.v}<span style={{ fontSize: '13px' }}>{s.u}</span></div>
              <div style={{ fontSize: '12px', color: C.sub }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
        {/* 팀 현황 */}
        {tab === 'overview' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px' }}>팀 현황</h2>
            {totalGoal > 0 && (
              <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>팀 달성률</span>
                  <span style={{ fontSize: '18px', fontWeight: '900', color: C.acc }}>{Math.round(totalSuccess / totalGoal * 100)}%</span>
                </div>
                <div style={{ background: '#1e293b', borderRadius: '6px', height: '12px', overflow: 'hidden' }}>
                  <div style={{ width: Math.min(totalSuccess / totalGoal * 100, 100) + '%', background: 'linear-gradient(90deg,#f59e0b,#f97316)', height: '100%', borderRadius: '6px' }} />
                </div>
              </div>
            )}
            {users.map(u => {
              const rate = u.goal > 0 ? Math.round(u.success / u.goal * 100) : 0
              const rs = riskStyle(rate)
              return (
                <div key={u.id} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div><div style={{ fontSize: '18px', fontWeight: '800' }}>{u.name} MM</div><div style={{ color: C.sub, fontSize: '14px', marginTop: '2px' }}>{u.region} · ID: {u.username}</div></div>
                    <span style={{ background: rs.bg, color: rs.text, border: '1px solid ' + rs.border, fontSize: '13px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px' }}>{rs.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    {[{ l: '성공', v: u.success, c: '#10b981' }, { l: '목표', v: u.goal, c: C.text }, { l: '달성률', v: rate + '%', c: C.acc }].map((s, i) => (
                      <div key={i} style={{ flex: 1, background: C.bg, borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: '12px', color: C.sub }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: Math.min(rate, 100) + '%', background: rate >= 70 ? '#10b981' : C.acc, height: '100%', borderRadius: '4px' }} />
                  </div>
                </div>
              )
            })}
            <button onClick={downloadCSV} style={{ width: '100%', background: C.acc, border: 'none', color: '#0b1220', padding: '16px', borderRadius: '12px', fontSize: '17px', fontWeight: '900', cursor: 'pointer', marginTop: '8px', fontFamily: 'inherit' }}>📥 엑셀(CSV) 다운로드</button>
          </div>
        )}

        {/* 직원 관리 */}
        {tab === 'staff' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div><h2 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px' }}>직원 관리</h2><p style={{ color: C.sub, fontSize: '14px', margin: 0 }}>MM 계정 생성/수정/삭제</p></div>
              <button onClick={() => { setAddModal(true); setAddErr('') }} style={{ background: C.acc, border: 'none', color: '#0b1220', padding: '10px 16px', borderRadius: '8px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가</button>
            </div>
            {users.map(u => (
              <div key={u.id} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div><div style={{ fontSize: '18px', fontWeight: '800' }}>{u.name} MM</div><div style={{ color: C.sub, fontSize: '14px', marginTop: '2px' }}>{u.region}</div></div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setEditModal({ ...u })} style={{ background: 'transparent', border: '1px solid ' + C.border, color: '#60a5fa', padding: '7px 14px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'transparent', border: '1px solid ' + C.border, color: '#f87171', padding: '7px 14px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[{ l: '아이디', v: u.username, c: C.acc }, { l: '비밀번호', v: u.password, c: C.sub }, { l: '목표', v: u.goal + '건', c: '#10b981' }].map((s, i) => (
                    <div key={i} style={{ background: C.bg, borderRadius: '6px', padding: '8px 12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>{s.l}</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 기회 배분 */}
        {tab === 'leads' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>기회 배분</h2>
              {unassigned > 0 && <button onClick={bulkAssign} style={{ background: C.acc, border: 'none', color: '#0b1220', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>자동배분({unassigned})</button>}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {['전체', '미배분', '배분완료'].map(s => (
                <button key={s} onClick={() => setFilterSt(s)} style={{ padding: '8px 16px', background: filterSt === s ? C.acc : 'transparent', border: filterSt === s ? 'none' : '1px solid ' + C.border, color: filterSt === s ? '#0b1220' : C.sub, borderRadius: '20px', fontSize: '14px', fontWeight: filterSt === s ? '800' : '500', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
              ))}
            </div>
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '16px' }}>영업기회가 없습니다</div>}
            {filtered.map(l => (
              <div key={l.id} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, marginRight: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', lineHeight: '1.4' }}>{l.address}</div>
                    <div style={{ color: C.sub, fontSize: '13px', marginTop: '3px' }}>{l.area}㎡ · {l.usage_type} · {l.start_date}</div>
                  </div>
                  <span style={{ background: l.assign_status === '미배분' ? '#2d1d00' : '#052e16', color: l.assign_status === '미배분' ? '#fbbf24' : '#4ade80', border: l.assign_status === '미배분' ? '1px solid #451a03' : '1px solid #14532d', fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{l.assign_status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                  {l.products?.map(p => <span key={p} style={{ background: 'rgba(245,158,11,0.15)', color: C.acc, border: '1px solid rgba(245,158,11,0.3)', fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '4px' }}>{p}</span>)}
                </div>
                {l.assign_status === '배분완료'
                  ? <div style={{ color: '#10b981', fontSize: '14px', fontWeight: '700' }}>👤 {l.assigned_to} MM</div>
                  : <button onClick={() => setAssignModal(l)} style={{ width: '100%', background: 'transparent', border: '1px solid ' + C.acc, color: C.acc, padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>MM 배분하기</button>}
              </div>
            ))}
          </div>
        )}

        {/* 목표 설정 */}
        {tab === 'goals' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px' }}>개인별 목표 설정</h2>
            {users.map(u => (
              <div key={u.id} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '12px', padding: '18px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div><div style={{ fontSize: '18px', fontWeight: '800' }}>{u.name} MM</div><div style={{ color: C.sub, fontSize: '14px' }}>{u.region}</div></div>
                  {savedGoal === u.id && <span style={{ color: '#10b981', fontWeight: '700', fontSize: '15px' }}>✅ 저장됨</span>}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.sub, fontSize: '14px', marginBottom: '6px' }}>현재 목표: <strong style={{ color: C.acc, fontSize: '18px' }}>{u.goal}건</strong></div>
                    <input type="number" placeholder="새 목표" value={goalEdit[u.id] || ''} onChange={e => setGoalEdit({ ...goalEdit, [u.id]: e.target.value })} style={{ width: '100%', background: C.bg, border: '1px solid ' + C.border, color: C.text, padding: '13px', borderRadius: '8px', fontSize: '18px', fontWeight: '700', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <button onClick={() => saveGoal(u.id)} style={{ background: C.acc, border: 'none', color: '#0b1220', padding: '13px 20px', borderRadius: '8px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#060c17', borderTop: '1px solid ' + C.border, display: 'flex', padding: '8px 0 6px' }}>
        {navTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: 'none', border: 'none', color: tab === t.id ? C.acc : '#475569', cursor: 'pointer', padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', fontFamily: 'inherit' }}>
            <span style={{ fontSize: '20px' }}>{t.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: tab === t.id ? '800' : '500' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
