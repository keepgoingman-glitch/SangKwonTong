import { useState, useEffect } from 'react'
import { db } from './supabase'

// U-TURN 팀 정의 (5개 부서)
const UTEAMS = [
  { id: 'team_mkt',  label: '마케팅팀',      color: '#f472b6' },
  { id: 'team1',     label: '시너지영업1팀', color: '#fb923c' },
  { id: 'team2',     label: '시너지영업2팀', color: '#4ade80' },
  { id: 'team_cs',   label: 'CS운영팀',      color: '#60a5fa' },
  { id: 'team_plan', label: '고객기획팀',    color: '#c084fc' },
]
const pct = (n, d) => d > 0 ? Math.round(n / d * 100) : 0

// 원형 게이지
function RingGauge({ value, goal, color, label, sub }) {
  const p = Math.min(pct(value, goal), 100)
  const r = 42, c = 2 * Math.PI * r
  const dash = (p / 100) * c
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <div style={{ position: 'relative', width: '104px', height: '104px' }}>
        <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
          <circle cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`} style={{ transition: 'stroke-dasharray 0.6s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>/ {goal}</div>
        </div>
      </div>
      <div style={{ fontSize: '13px', fontWeight: '800', color, marginTop: '8px' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{sub} · {p}%</div>
    </div>
  )
}

export default function UturnDashboard({ onBack, onGo }) {
  const now = new Date()
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [ym] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try {
      const rows = await db.get('uturn_scores', 'select=*&year=eq.' + ym.y + '&month=eq.' + ym.m)
      setScores(rows || [])
    } catch (e) { setScores([]) }
    setLoading(false)
  }

  // 팀별 점수 매핑
  const byTeam = {}
  scores.forEach(s => { byTeam[s.team_id] = s })
  // 지사 전체 합계
  const tot = scores.reduce((a, s) => ({
    ug: a.ug + (s.u_goal || 0), ua: a.ua + (s.u_actual || 0),
    ig: a.ig + (s.i_goal || 0), ia: a.ia + (s.i_actual || 0),
    tg: a.tg + (s.t_goal || 0), ta: a.ta + (s.t_actual || 0),
  }), { ug: 0, ua: 0, ig: 0, ia: 0, tg: 0, ta: 0 })
  // UIT 스코어 (U 가중 1.5)
  const teamScore = s => s ? (s.u_actual || 0) * 1.5 + (s.i_actual || 0) + (s.t_actual || 0) : 0
  const ranked = [...UTEAMS].map(t => ({ ...t, s: byTeam[t.id], score: teamScore(byTeam[t.id]) }))
    .sort((a, b) => b.score - a.score)
  const totGoalScore = tot.ug * 1.5 + tot.ig + tot.tg
  const totActScore = tot.ua * 1.5 + tot.ia + tot.ta

  const cards = [
    { id: 'connector', icon: '📊', title: '대시보드', sub: '실시간 성과 · 목표 달성률 · 팀 순위', c: '#38bdf8', bg: 'rgba(56,189,248,0.08)', bd: 'rgba(56,189,248,0.35)' },
    { id: 'mm', icon: '🎯', title: '미션 & 활동', sub: '오늘의 미션 · 활동 등록 · 결과 입력', c: '#4ade80', bg: 'rgba(74,222,128,0.08)', bd: 'rgba(74,222,128,0.35)' },
    { id: 'mm#qr', icon: '🤝', title: 'QR 파트너스', sub: '무인매장 QR 전단 · 제휴 영업 · 상담 실적', c: '#c084fc', bg: 'rgba(192,132,252,0.08)', bd: 'rgba(192,132,252,0.35)' },
    { id: 'connector#uturn', icon: '🏆', title: '랭킹 & 보상', sub: '개인/팀 랭킹 · 배지 · 리워드', c: '#fbbf24', bg: 'rgba(251,191,36,0.08)', bd: 'rgba(251,191,36,0.4)' },
    { id: 'mm', icon: '💡', title: '베스트 프랙티스', sub: '성공 사례 · 노하우 공유 · 실패 분석', c: '#22d3ee', bg: 'rgba(34,211,238,0.08)', bd: 'rgba(34,211,238,0.3)' },
    { id: 'connector', icon: '📈', title: '분석 & 리포트', sub: '성과 분석 · 통계 리포트 · 인사이트', c: '#a78bfa', bg: 'rgba(167,139,250,0.08)', bd: 'rgba(167,139,250,0.3)' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(165deg,#0a0e1a 0%,#0f1a30 45%,#1a0e18 100%)', color: '#f1f5f9', fontFamily: "'Noto Sans KR',sans-serif", paddingBottom: '32px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#f1f5f9', fontSize: '14px', padding: '7px 13px', borderRadius: '9px', cursor: 'pointer', fontFamily: 'inherit' }}>‹ 홈</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px', fontWeight: '900', color: '#E31937' }}>kt</span>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'rgba(255,255,255,0.9)' }}>서부산지사</span>
        </div>
        <button onClick={load} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#f1f5f9', fontSize: '15px', padding: '7px 11px', borderRadius: '9px', cursor: 'pointer' }}>🔄</button>
      </div>

      {/* U-TURN 히어로 */}
      <div style={{ textAlign: 'center', padding: '4px 0 14px' }}>
        <img src="/uturn-hero.png" alt="U-TURN" style={{ width: '100%', maxWidth: '340px', objectFit: 'contain' }} />
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: '-6px' }}>
          상반기의 부진을 <b style={{ color: '#fbbf24' }}>TURN</b>하고 고객을 <b style={{ color: '#E31937' }}>KT</b>로 <b style={{ color: '#fbbf24' }}>TURN</b>한다!
        </div>
      </div>

      <div style={{ maxWidth: '440px', margin: '0 auto', padding: '0 16px' }}>
        {/* 지사 UIT 전투 게이지 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '18px 14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>⚡ 지사 UIT 전투 게이지</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{ym.m}월 · 기변 제외 · 신규/MNP만</span>
          </div>
          {loading
            ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.5)' }}>불러오는 중...</div>
            : <div style={{ display: 'flex', gap: '6px' }}>
                <RingGauge value={tot.ua} goal={tot.ug} color="#c084fc" label="U · USIM" sub="신규·MNP" />
                <RingGauge value={tot.ia} goal={tot.ig} color="#60a5fa" label="I · 인터넷" sub="신규" />
                <RingGauge value={tot.ta} goal={tot.tg} color="#fbbf24" label="T · TV" sub="신규" />
              </div>
          }
          <div style={{ marginTop: '14px', background: 'rgba(227,25,55,0.12)', border: '1px solid rgba(227,25,55,0.35)', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>UIT 종합 달성 (U×1.5)</span>
            <span style={{ fontSize: '15px', fontWeight: '900', color: '#fff' }}>{Math.round(totActScore)} <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>/ {Math.round(totGoalScore)}</span> <span style={{ color: '#4ade80' }}>{pct(totActScore, totGoalScore)}%</span></span>
          </div>
        </div>

        {/* 팀 대항 리더보드 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '16px 14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '12px' }}>🏆 팀 대항 리더보드 <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '400' }}>· UIT 스코어</span></div>
          {ranked.map((t, i) => {
            const gS = t.s ? (t.s.u_goal || 0) * 1.5 + (t.s.i_goal || 0) + (t.s.t_goal || 0) : 0
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i < ranked.length - 1 ? '11px' : 0 }}>
                <span style={{ fontSize: '15px', fontWeight: '900', width: '24px', textAlign: 'center', color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{t.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: t.color }}>{Math.round(t.score)}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '3px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: Math.min(pct(t.score, Math.max(gS, 1)), 100) + '%', height: '100%', background: t.color, borderRadius: '3px', transition: 'width 0.6s' }} />
                  </div>
                </div>
              </div>
            )
          })}
          {scores.length === 0 && !loading && <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>관리자 U-TURN 탭에서 팀별 목표·실적을 입력하면 표시됩니다</div>}
        </div>

        {/* 6개 메뉴 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {cards.map(c => (
            <button key={c.title} onClick={() => onGo(c.id)} style={{ background: c.bg, border: '1.5px solid ' + c.bd, borderRadius: '16px', padding: '15px 14px', cursor: 'pointer', textAlign: 'left', color: '#f1f5f9', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '110px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid ' + c.bd, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '900', color: c.c, marginBottom: '3px' }}>{c.title}</div>
                <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{c.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 하단 */}
        <div style={{ textAlign: 'center', marginTop: '22px', color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700' }}><span style={{ color: '#E31937' }}>kt</span> U-TURN 플랫폼</div>
          <div style={{ fontSize: '10px', letterSpacing: '1px', marginTop: '2px' }}>TURN THE GAME. TURN THE CUSTOMER. TURN THE RESULT.</div>
        </div>
      </div>
    </div>
  )
}
