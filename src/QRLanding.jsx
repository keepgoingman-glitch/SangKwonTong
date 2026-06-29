import { useState, useEffect, useRef } from 'react'
import { db } from './supabase'

/* ============================================================
   QR파트너스 · 고객 랜딩 (상권통 통합 버전)
   ------------------------------------------------------------
   · 기존과 동일하게 storeCode(매장코드)로 qr_stores 조회
   · 상담 제출 시 기존 qr_leads 테이블에 그대로 저장 (DB 변경 불필요)
   · interest_product: 견적 요약 문자열 / memo: 상세(견적·게임·행동) JSON
   ============================================================ */

// KT 공식 요금 (KT닷컴 3년약정·부가세포함 기준)
const NET = { '100':22000, '500':33000, '1000':38500 }
const TVO = [
  { v:0,     ch:'TV 없음' },
  { v:16500, ch:'지니TV 베이직 238채널' },
  { v:17600, ch:'지니TV 라이트 240채널' },
  { v:20900, ch:'지니TV+넷플릭스 266채널' },
]

export default function QRLanding({ storeCode, onBack }) {
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('home')   // home | estimate | ktnet | game | done
  const [cstep, setCstep] = useState(0)
  const [coupon, setCoupon] = useState(false)
  const [err, setErr] = useState('')

  // 견적 상태
  const [sel, setSel] = useState({ speed:'500', tv:1, combine:1, card:1 })
  // 상담 폼
  const [form, setForm] = useState({ name:'', phone:'', time:'지금 바로', consent:false })
  // 토스트 / PWA 설치
  const [toast, setToast] = useState('')
  const deferredRef = useRef(null)
  useEffect(() => {
    const onBIP = (e) => { e.preventDefault(); deferredRef.current = e }
    window.addEventListener('beforeinstallprompt', onBIP)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200) }
  async function saveHome() {
    const dp = deferredRef.current
    if (dp) {
      dp.prompt()
      const { outcome } = await dp.userChoice
      deferredRef.current = null
      showToast(outcome === 'accepted' ? '홈 화면에 저장되었습니다' : '다음에 저장할 수 있어요')
    } else {
      // iOS 사파리 등 자동설치 미지원 → 간단 안내만
      showToast('홈 화면에 저장되었습니다')
    }
  }

  useEffect(() => {
    (async () => {
      try {
        if (storeCode) {
          // 홈 아이콘 재진입용으로 매장코드 기억
          try { localStorage.setItem('sk_last_store', storeCode) } catch (e) {}
          const rows = await db.get('qr_stores', 'select=*&store_code=eq.' + encodeURIComponent(storeCode))
          if (rows && rows[0]) {
            setStore(rows[0])
            // 스캔 수 +1 (기존 동작 유지)
            try { await db.patch('qr_stores', 'store_code=eq.' + encodeURIComponent(storeCode),
              { scan_count: (rows[0].scan_count || 0) + 1 }) } catch (e) {}
          }
        }
      } catch (e) { console.warn(e) }
      setLoading(false)
    })()
  }, [storeCode])

  // ---- 요금 계산 ----
  const net = NET[sel.speed]
  const tv = TVO[sel.tv].v
  const base = net + tv
  const combineDisc = (sel.combine && tv > 0) ? 5500 : 0
  const cardDisc = sel.card ? 11000 : 0
  const finalFee = Math.max(0, base - combineDisc - cardDisc)
  const won = n => n.toLocaleString() + '원'
  const speedLabel = sel.speed === '100' ? '100M' : sel.speed === '500' ? '500M' : '1G'

  // ---- 상담 제출 → 기존 qr_leads 저장 ----
  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) { setErr('성함과 연락처를 입력해주세요.'); return }
    if (!form.consent) { setErr('개인정보 수집 동의가 필요합니다.'); return }
    setErr('')
    const summary = `KT인터넷 ${speedLabel}` + (tv > 0 ? ` + ${TVO[sel.tv].ch}` : '') +
      (sel.combine ? ' · 결합' : '') + (sel.card ? ' · 카드할인' : '') + (coupon ? ' · 게임혜택' : '')
    const memo = JSON.stringify({
      quote: { speed: speedLabel, tv: TVO[sel.tv].ch, combine: !!sel.combine, card: !!sel.card,
               base, finalFee, gameBonus: !!coupon },
      preferred_time: form.time, source: 'qr_landing_v2'
    })
    try {
      await db.post('qr_leads', [{
        store_code: storeCode || (store && store.store_code) || '',
        store_name: store ? store.store_name : '',
        partner_username: store ? store.partner_username : '',
        customer_name: form.name.trim(),
        customer_contact: form.phone.trim(),
        interest_product: summary,
        status: '상담요청',
        memo,
        team_id: store ? store.team_id : null,
      }])
      setScreen('done')
    } catch (e) {
      setErr('저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      console.warn(e)
    }
  }

  if (loading) return <Center>불러오는 중…</Center>

  const placeName = store ? store.store_name : '우리 동네'

  // ================= 화면 =================
  return (
    <div style={S.wrap}>
      <div style={S.device}>
        {/* 안심 배너 */}
        {screen !== 'done' && (
          <div style={S.reassure}>
            <span style={S.lock}>🔒</span>
            <div><b style={{fontSize:12.5,fontWeight:800,color:C.ink}}>가입 없이 바로 이용 · 개인정보 입력 0</b>
              <div style={{fontSize:10.5,color:C.soft}}>상담을 원할 때만 연락처를 남기면 됩니다</div></div>
          </div>
        )}

        {/* ---------- HOME ---------- */}
        {screen === 'home' && (
          <div style={S.scroll}>
            <div style={S.hero}>
              <span style={S.loc}><b style={S.ktb}>kt</b> {placeName} 전용</span>
              <h1 style={S.h1}>우리 동네 혜택,<br/><span style={{color:C.gold}}>여기 다 모았어요</span></h1>
              <p style={S.hp}>통신비 절감부터 생활 혜택까지. 필요한 걸 골라 바로 누리세요.</p>
            </div>

            <div style={S.body}>
              <div style={S.primary}>
                <span style={S.tagHot}>이번 달 가장 큰 혜택</span>
                <h2 style={S.ph2}>내 통신비, 얼마나 줄일 수 있을까요?</h2>
                <p style={S.pp}>속도·채널만 고르면 1분 만에 견적이 나와요. 카드 할인까지 더하면 더 저렴해져요.</p>
                <button style={S.ctaBlue} onClick={() => { setScreen('estimate'); setCstep(0) }}>💡 통신비 견적 내보기 ›</button>
                <div style={S.micro}><span>🔒 개인정보 0</span><span>⏱ 1분</span><span>💸 무료</span></div>
              </div>

              <div style={S.ktnet} onClick={() => setScreen('ktnet')}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <span style={S.knTag}><b style={S.ktb}>kt</b> 기가 인터넷</span><span style={{color:C.blue,fontSize:20}}>›</span>
                </div>
                <b style={{fontSize:16,fontWeight:800}}>왜 우리 단지엔 KT 인터넷일까?</b>
                <p style={{fontSize:11.5,color:C.soft,marginTop:5,lineHeight:1.5}}>광케이블 기가급 · 대칭형 · 데이터 무제한</p>
                <Bars/>
              </div>

              <SecTitle>🎁 결합 혜택 받기 <small style={{color:C.soft,fontWeight:600,fontSize:11}}>상담 시 안내</small></SecTitle>
              <div style={S.maxben} onClick={() => { setScreen('estimate'); setCstep(0) }}>
                <div style={{fontSize:11,fontWeight:800,color:C.gold}}>인터넷+TV+유심 결합 시</div>
                <h4 style={{fontSize:20,fontWeight:800,margin:'8px 0 4px',lineHeight:1.25}}>결합하면 <span style={{color:C.gold}}>현금·사은품 지원</span><br/>받을 수 있어요</h4>
                <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
                  {['💵 현금 지원','📺 TV·가전','🎁 사은품'].map(t =>
                    <span key={t} style={S.it}>{t}</span>)}
                </div>
                <button style={S.ctaGold} onClick={(e)=>{e.stopPropagation();setScreen('estimate');setCstep(0)}}>내 혜택 상담받기 ›</button>
              </div>

              <div style={S.game} onClick={() => setScreen('game')}>
                <span style={S.gameBadge}>추가 혜택</span>
                <span style={S.gi}>🧱</span>
                <div><b style={{fontSize:15,fontWeight:800,display:'block'}}>벽돌 깨고 추가 지원금 받기</b>
                  <span style={{fontSize:11.5,opacity:.9}}>미니게임 통과 시 추가 지원금 (상담 시 안내)</span></div>
              </div>

              <SecTitle>☀️ 생활 서비스 <small style={{color:C.soft,fontWeight:600,fontSize:11}}>준비중</small></SecTitle>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[['❄️','에어컨 청소'],['🪟','방충망 교체'],['🧹','입주 청소'],['🐜','해충 방역']].map(([ic,nm]) =>
                  <div key={nm} style={S.svc}>
                    <span style={S.svcSoon}>준비중</span>
                    <div style={S.svcIc}>{ic}</div>
                    <b style={{fontSize:13.5,fontWeight:800,display:'block'}}>{nm}</b>
                    <span style={{fontSize:11,color:C.soft}}>제휴 업체 모집 중</span>
                  </div>)}
              </div>

              <SecTitle>🏷️ 단지 주변 쿠폰 <small style={{color:C.soft,fontWeight:600,fontSize:11}}>준비중</small></SecTitle>
              <div style={S.soonbox}>
                <span style={{fontSize:22,opacity:.6}}>🏷️</span>
                <div><b style={{fontSize:13.5,fontWeight:800,color:C.soft,display:'block'}}>단지 주변 제휴 쿠폰을 준비하고 있어요</b>
                  <span style={{fontSize:11.5,color:C.dim}}>입주민 전용 동네 상가 혜택이 곧 열립니다.</span></div>
              </div>

              <div style={S.foot}>
                <div style={{fontSize:10.5,color:C.dim,lineHeight:1.6}}>모든 서비스는 가입·개인정보 없이 둘러볼 수 있습니다.<br/>상담을 신청할 때만 연락처를 남기면 됩니다.</div>
                <div style={{marginTop:9,fontSize:12,fontWeight:800}}><b style={S.ktb}>kt</b> × <span style={{color:C.blue}}>상권통</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- ESTIMATE ---------- */}
        {screen === 'estimate' && (
          <>
            <Bar title="통신비 견적 내보기" onBack={() => setScreen('home')} />
            <div style={S.prog}>{[0,1,2,3,4].map(i =>
              <div key={i} style={{...S.pgseg, background: i <= Math.min(cstep,4) ? C.blue : C.line2}} />)}</div>
            <div style={S.cbody}>
              {cstep === 0 && <Step label="STEP 1 / 5" title="인터넷 속도를 골라주세요" sub="집 크기·인원에 맞춰 추천해드려요.">
                {[['100','100M','슬림 — 1~2인'],['500','500M','베이직 — 3~4인 (추천)'],['1000','1G','에센스 — 고사양']].map(([v,big,desc]) =>
                  <Opt key={v} on={sel.speed===v} onClick={() => setSel({...sel, speed:v})} big={big} title={desc} />)}
              </Step>}
              {cstep === 1 && <Step label="STEP 2 / 5" title="TV는 어떻게 할까요?" sub="채널 구성을 고르거나 인터넷만 쓸 수도 있어요.">
                {TVO.map((o,i) =>
                  <Opt key={i} on={sel.tv===i} onClick={() => setSel({...sel, tv:i})}
                    big={i===0?'📡':o.ch.match(/\d+/)+''} title={o.ch} />)}
              </Step>}
              {cstep === 2 && <Step label="STEP 3 / 5" title="휴대폰도 KT를 쓰시나요?" sub="결합하면 인터넷 요금이 더 내려갑니다.">
                <Opt on={sel.combine===1} onClick={() => setSel({...sel, combine:1})} big="📱" title="네, 결합할게요 (인터넷+TV 결합 시 5,500원 할인)" />
                <Opt on={sel.combine===0} onClick={() => setSel({...sel, combine:0})} big="🤔" title="아직 모르겠어요 (상담 때 확인)" />
              </Step>}
              {cstep === 3 && <Step label="STEP 4 / 5" title="제휴카드 할인까지 받아볼까요?" sub="통신비 자동이체+카드 실적으로 추가 할인.">
                <Opt on={sel.card===1} onClick={() => setSel({...sel, card:1})} big="💳" title="네, 카드 할인 적용 (월 최대 11,000원)" />
                <Opt on={sel.card===0} onClick={() => setSel({...sel, card:0})} big="🙅" title="카드 없이 볼게요" />
              </Step>}
              {cstep === 4 && <Step label="STEP 5 / 5 · 내게 맞는 구성" title="할인을 다 더하면 이 금액이에요" sub="기본 요금에서 할인이 차례로 빠집니다.">
                <div style={S.reveal}>
                  <Row k={`기본 요금 ${speedLabel}${tv>0?' + 지니TV':''}`} v={won(base)} />
                  {combineDisc>0 && <Row k="📱 모바일 결합" v={'- '+won(combineDisc)} blue />}
                  {cardDisc>0 && <Row k="💳 제휴카드 할인" v={'- '+won(cardDisc)} violet />}
                  <div style={{borderTop:'2px solid '+C.line2, marginTop:6, paddingTop:13, display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
                    <b style={{fontSize:13}}>월 최종 예상</b>
                    <div style={{textAlign:'right'}}>
                      {(combineDisc+cardDisc)>0 && <div style={{fontSize:12,color:C.dim,textDecoration:'line-through'}}>{won(base)}</div>}
                      <div style={{fontSize:26,fontWeight:800,color:C.blueD}}>월 {finalFee.toLocaleString()}원</div>
                    </div>
                  </div>
                </div>
                <div style={S.giftbox}><span style={{fontSize:22}}>🎁</span>
                  <div><b style={{fontSize:14,fontWeight:800,color:'#9A6A00'}}>결합·가입 사은품 안내</b>
                    {coupon && <span style={{fontSize:11,color:'#C9821A',fontWeight:800,display:'block'}}>게임 추가 지원금 대상 · </span>}
                    <span style={{fontSize:11,color:'#B5853A'}}>사은품·지원금 금액은 상담 시 안내드립니다</span></div></div>
                <p style={S.disc}>KT닷컴 공식 3년 약정·부가세 포함 기준. 카드 할인은 제휴카드 전월 실적 충족 시 적용. 실제 금액·사은품은 결합 조건·프로모션·경품 한도에 따라 상담 시 확정됩니다.</p>
              </Step>}
              {cstep === 5 && <Step label="상담 요청" title="언제 연락드리면 될까요?" sub="아래만 남겨주시면 전문 상담원이 연락드립니다.">
                <Field label="고객명"><input style={S.input} value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="성함을 입력해주세요" /></Field>
                <Field label="연락처"><input style={S.input} value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="010-0000-0000" /></Field>
                <Field label="상담 희망 시간">
                  <div style={{display:'flex',gap:9}}>
                    <TimeBtn on={form.time==='지금 바로'} onClick={() => setForm({...form, time:'지금 바로'})} t="지금 바로" s="가능한 빨리" />
                    <TimeBtn on={form.time!=='지금 바로'} onClick={() => setForm({...form, time:'오후 (12~18시)'})} t="시간 선택" s="원하는 시간대" />
                  </div>
                  {form.time !== '지금 바로' &&
                    <select style={{...S.input, marginTop:10}} value={form.time} onChange={e => setForm({...form, time:e.target.value})}>
                      {['오전 (09~12시)','오후 (12~18시)','저녁 (18~21시)','주말'].map(t => <option key={t}>{t}</option>)}
                    </select>}
                </Field>
                <label style={S.consent}>
                  <input type="checkbox" checked={form.consent} onChange={e => setForm({...form, consent:e.target.checked})} style={{marginTop:2,width:17,height:17,accentColor:C.blue}} />
                  <span style={{fontSize:11.5,color:C.soft,lineHeight:1.5}}><b style={{color:C.kt}}>(필수)</b> 개인정보 수집·이용 동의 — 상담 연락 목적으로 이름·연락처를 수집하며, 담당 직원에게만 전달됩니다.</span>
                </label>
              </Step>}
              {err && <div style={S.errBox}>{err}</div>}
            </div>

            {cstep <= 4 &&
              <div style={S.pricebar}>
                <div><div style={{fontSize:11,color:'#9DB0D0'}}>현재 선택</div>
                  <b style={{fontSize:12,fontWeight:700}}>{speedLabel}{tv>0?' + 지니TV':''}{sel.combine?' · 결합':''}{sel.card?' · 카드':''}</b></div>
                <div style={{textAlign:'right'}}><div style={{fontSize:23,fontWeight:800}}>월 {finalFee.toLocaleString()}원</div>
                  <div style={{fontSize:11,color:C.gold,fontWeight:700}}>🎁 사은품 상담 안내</div></div>
              </div>}

            <div style={S.nav}>
              <button style={S.back} onClick={() => cstep>0 ? setCstep(cstep-1) : setScreen('home')}>이전</button>
              <button style={S.next} onClick={() => {
                if (cstep < 5) setCstep(cstep+1)
                else submit()
              }}>{cstep===4 ? '이 구성으로 상담받기 ›' : cstep===5 ? '상담 요청 보내기 ›' : '다음 ›'}</button>
            </div>
          </>
        )}

        {/* ---------- KT NET ---------- */}
        {screen === 'ktnet' && (
          <>
            <Bar title="KT 기가 인터넷" onBack={() => setScreen('home')} />
            <div style={S.scroll}>
              <div style={S.knhero}>
                <span style={{fontSize:11,fontWeight:800,letterSpacing:'.14em',color:'#9DC2FF'}}>왜 우리 단지엔 KT인가</span>
                <h1 style={{fontSize:24,fontWeight:800,lineHeight:1.28,marginTop:11}}>광케이블로 들어오는<br/><span style={{color:'#7FE7FF'}}>기가급 속도</span></h1>
                <p style={{fontSize:12.5,color:'rgba(255,255,255,.9)',marginTop:10,lineHeight:1.55}}>아파트·주택까지 광섬유(FTTH)로 직접 연결. 받는 속도와 보내는 속도가 같은 대칭형 인터넷이에요.</p>
              </div>
              <div style={{padding:16}}>
                <div style={S.kncard}>
                  <div style={{fontSize:14,fontWeight:800,marginBottom:14}}>속도 비교 — 한눈에</div>
                  {[['kt 기가(1G)','100%',true],['광랜(500M)','50%',false],['100M','12%',false]].map(([l,w,best]) =>
                    <div key={l} style={{display:'flex',alignItems:'center',gap:10,marginBottom:11}}>
                      <span style={{fontSize:12,fontWeight:800,color:best?C.blueD:C.soft,width:84}}>{l}</span>
                      <div style={{flex:1,height:13,background:'#EEF2F8',borderRadius:7,overflow:'hidden'}}>
                        <div style={{height:'100%',width:w,borderRadius:7,background:best?'linear-gradient(90deg,#5AA0FF,#0B4FCB)':'#C9D6EA'}}/></div>
                    </div>)}
                  <div style={{fontSize:10.5,color:C.dim,lineHeight:1.5,marginTop:13,paddingTop:12,borderTop:'1px solid '+C.line}}>속도 구간은 상품 기준 최대치예요. 실제 속도는 설치 장소의 통신설비·단말·환경에 따라 달라질 수 있어요.</div>
                </div>
                <div style={{fontSize:16,fontWeight:800,margin:'22px 2px 12px'}}>KT 기가 인터넷의 강점</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[['⚡','기가급 속도','대용량·4K·게임도 쾌적'],['🔗','광케이블 직결','아파트·주택까지 FTTH'],['↕️','대칭형 속도','업로드도 안정적'],['♾️','데이터 무제한','기본 데이터 무제한']].map(([ic,t,d]) =>
                    <div key={t} style={S.knstr}><div style={S.knstrIc}>{ic}</div><b style={{fontSize:14,fontWeight:800,display:'block'}}>{t}</b><span style={{fontSize:11,color:C.soft}}>{d}</span></div>)}
                </div>
                <div style={S.knCta}>
                  <b style={{fontSize:17,fontWeight:800,display:'block'}}>우리 집은 기가 인터넷이 될까요?</b>
                  <span style={{fontSize:12,color:'rgba(255,255,255,.9)',display:'block',marginTop:7,lineHeight:1.5}}>주소만 확인하면 설치 가능 여부를 바로 알려드려요.</span>
                  <button style={S.knCtaBtn} onClick={() => { setScreen('estimate'); setCstep(0) }}>내 통신비 견적 + 설치 확인 ›</button>
                </div>
                <div style={{fontSize:10,color:C.dim,textAlign:'center',margin:'16px 8px 8px',lineHeight:1.5}}>KT닷컴 공식 상품 정보 기준 · 실제 제공 속도는 설치 환경에 따라 다를 수 있습니다.</div>
              </div>
            </div>
          </>
        )}

        {/* ---------- GAME ---------- */}
        {screen === 'game' && <BrickGame onWin={() => { setCoupon(true); setScreen('estimate'); setCstep(0) }} onSkip={() => { setScreen('estimate'); setCstep(0) }} onBack={() => setScreen('home')} />}

        {/* ---------- DONE ---------- */}
        {screen === 'done' && (
          <div style={S.done}>
            <div style={S.doneIc}>✓</div>
            <h2 style={{fontSize:22,fontWeight:800,marginBottom:8}}>상담 요청이 접수됐어요</h2>
            <p style={{fontSize:13.5,color:C.soft,lineHeight:1.6}}>희망하신 시간에 맞춰<br/>전문 상담원이 연락드리겠습니다.</p>
            <div style={S.hbtn} onClick={saveHome}>
              <span style={{fontSize:19}}>📲</span>
              <div style={{flex:1,textAlign:'left'}}><b style={{color:'#fff',fontSize:14,fontWeight:800,display:'block'}}>홈 화면에 저장하기</b>
                <span style={{color:'rgba(255,255,255,.85)',fontSize:11}}>다음에도 앱처럼 바로</span></div>
              <span style={{color:'#fff',fontSize:20}}>›</span>
            </div>
            <button style={S.goHome} onClick={() => { setScreen('home'); setCstep(0) }}>홈으로 돌아가기</button>
          </div>
        )}

        {/* 토스트 */}
        {toast && <div style={S.toast}>{toast}</div>}
      </div>
    </div>
  )
}

/* ===================== 하위 컴포넌트 ===================== */
function Center({ children }) { return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,color:C.soft,fontSize:14}}>{children}</div> }
function SecTitle({ children }) { return <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'24px 4px 12px',fontSize:16,fontWeight:800}}><span>{children}</span></div> }
function Bar({ title, onBack }) {
  return <div style={S.topbar}><button style={S.bk} onClick={onBack}>‹</button><span style={{fontSize:15,fontWeight:800}}>{title}</span>
    <span style={{marginLeft:'auto',fontSize:10.5,color:C.soft,fontWeight:700}}><b style={S.ktb}>kt</b> 공식 제휴</span></div>
}
function Bars() {
  return <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:8}}>
    {[['KT 기가','100%',true],['일반 광랜','48%',false]].map(([l,w,kt]) =>
      <div key={l} style={{display:'flex',alignItems:'center',gap:9}}>
        <span style={{fontSize:11,fontWeight:700,color:C.soft,width:52}}>{l}</span>
        <div style={{flex:1,height:9,background:'#EEF2F8',borderRadius:6,overflow:'hidden'}}>
          <div style={{height:'100%',width:w,borderRadius:6,background:kt?'linear-gradient(90deg,#5AA0FF,#0B4FCB)':'#C9D6EA'}}/></div>
        <span style={{fontSize:10.5,fontWeight:800,color:C.dim,width:48,textAlign:'right'}}>{kt?'1Gbps급':'500M급'}</span>
      </div>)}
  </div>
}
function Step({ label, title, sub, children }) {
  return <div><div style={{fontSize:11,fontWeight:800,color:C.blue,letterSpacing:'.04em'}}>{label}</div>
    <div style={{fontSize:18,fontWeight:800,margin:'6px 0 4px'}}>{title}</div>
    <div style={{fontSize:12,color:C.soft,marginBottom:15,lineHeight:1.5}}>{sub}</div>
    <div style={{display:'flex',flexDirection:'column',gap:9}}>{children}</div></div>
}
function Opt({ on, onClick, big, title }) {
  return <div onClick={onClick} style={{...S.opt, ...(on?S.optOn:{})}}>
    <div style={{fontSize: big.length>2?17:22, fontWeight:800, minWidth:52}}>{big}</div>
    <div style={{flex:1, fontSize:13.5, fontWeight:800}}>{title}</div>
    <div style={{...S.chk, ...(on?S.chkOn:{})}}>✓</div></div>
}
function Row({ k, v, blue, violet }) {
  const col = blue ? C.blue : violet ? C.violet : C.ink
  return <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontSize:13}}>
    <span style={{color: blue||violet ? col : C.soft, fontWeight: blue||violet?800:600}}>{k}</span>
    <span style={{fontWeight:blue||violet?800:700, color:col}}>{v}</span></div>
}
function Field({ label, children }) {
  return <div style={{marginBottom:13}}><label style={{fontSize:13,fontWeight:700,display:'block',marginBottom:6}}>{label} <span style={{color:C.kt}}>*</span></label>{children}</div>
}
function TimeBtn({ on, onClick, t, s }) {
  return <div onClick={onClick} style={{flex:1,border:'2px solid '+(on?C.blue:C.line),borderRadius:13,padding:13,cursor:'pointer',textAlign:'center',background:on?C.blueXl:'#fff'}}>
    <b style={{fontSize:15,fontWeight:800,color:on?C.blueD:C.ink}}>{t}</b><div style={{fontSize:11,color:C.soft,marginTop:3}}>{s}</div></div>
}

/* ---- 벽돌깨기 (14개, 절반) ---- */
function BrickGame({ onWin, onSkip, onBack }) {
  const [ov, setOv] = useState('start')   // start | win | lose
  useEffect(() => {
    if (ov !== 'play') return
    const cv = document.getElementById('qrbrick'); if (!cv) return
    const cx = cv.getContext('2d'); const W = cv.width, H = cv.height
    let raf, running = true, lives = 3
    const pad = { w:76, h:12, x:W/2-38, y:H-24 }
    let ball = { x:W/2, y:H-40, r:7, dx:2.2, dy:-2.7 }
    const cols=7, rows=2, bw=42, bh=17, gap=6, offTop=24, offLeft=(W-(cols*bw+(cols-1)*gap))/2
    const pal=['#1E7BFF','#34D9C4','#7C5CFF','#FF7DA0']
    let bricks=[]; for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)bricks.push({x:offLeft+c*(bw+gap),y:offTop+r*(bh+gap),hit:false,color:pal[r%4]})
    const alive=()=>bricks.filter(b=>!b.hit).length
    const rr=(x,y,w,h,r)=>{cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
    const draw=()=>{cx.clearRect(0,0,W,H);bricks.forEach(b=>{if(b.hit)return;cx.fillStyle=b.color;rr(b.x,b.y,bw,bh,5);cx.fill()})
      const g=cx.createLinearGradient(pad.x,0,pad.x+pad.w,0);g.addColorStop(0,'#5AA0FF');g.addColorStop(1,'#1E7BFF');cx.fillStyle=g;rr(pad.x,pad.y,pad.w,pad.h,6);cx.fill()
      cx.fillStyle='#FFD86B';cx.beginPath();cx.arc(ball.x,ball.y,ball.r,0,7);cx.fill()}
    const step=()=>{if(!running)return;ball.x+=ball.dx;ball.y+=ball.dy
      if(ball.x<ball.r){ball.x=ball.r;ball.dx*=-1}if(ball.x>W-ball.r){ball.x=W-ball.r;ball.dx*=-1}if(ball.y<ball.r){ball.y=ball.r;ball.dy*=-1}
      if(ball.y+ball.r>=pad.y&&ball.x>=pad.x-4&&ball.x<=pad.x+pad.w+4&&ball.dy>0){ball.dy*=-1;ball.y=pad.y-ball.r;ball.dx=((ball.x-(pad.x+pad.w/2))/(pad.w/2))*3.2}
      if(ball.y-ball.r>H){lives--;if(lives<=0){running=false;setOv('lose');return}ball.x=W/2;ball.y=H-40;ball.dx=(Math.random()<.5?1:-1)*2.2;ball.dy=-2.7}
      for(const b of bricks){if(b.hit)continue;if(ball.x>b.x-ball.r&&ball.x<b.x+bw+ball.r&&ball.y>b.y-ball.r&&ball.y<b.y+bh+ball.r){b.hit=true;ball.dy*=-1;if(alive()===0){running=false;setOv('win');return}break}}
      draw();raf=requestAnimationFrame(step)}
    const move=cx2=>{const rect=cv.getBoundingClientRect();const sc=W/rect.width;pad.x=Math.max(0,Math.min(W-pad.w,(cx2-rect.left)*sc-pad.w/2))}
    const mm=e=>{if(e.buttons)move(e.clientX)}, md=e=>move(e.clientX), tm=e=>{e.preventDefault();move(e.touches[0].clientX)}
    cv.addEventListener('mousemove',mm);cv.addEventListener('mousedown',md);cv.addEventListener('touchmove',tm,{passive:false})
    draw();step()
    return ()=>{running=false;cancelAnimationFrame(raf);cv.removeEventListener('mousemove',mm);cv.removeEventListener('mousedown',md);cv.removeEventListener('touchmove',tm)}
  }, [ov])
  return <>
    <Bar title="벽돌 깨고 추가 할인" onBack={onBack} />
    <div style={{padding:'16px 20px 12px',textAlign:'center'}}>
      <h1 style={{fontSize:19,fontWeight:800,lineHeight:1.3}}>벽돌 깨고 <span style={{color:C.blue}}>추가 할인</span> 받기</h1>
      <p style={{fontSize:12,color:C.soft,marginTop:6}}>통신비 벽돌을 모두 깨면 추가 지원금 쿠폰을 드려요.</p>
    </div>
    <div style={{margin:'0 20px',borderRadius:16,overflow:'hidden',background:'linear-gradient(180deg,#0B1430,#0B0F1D)',position:'relative',border:'1px solid '+C.line}}>
      <canvas id="qrbrick" width="362" height="300" style={{display:'block',width:'100%',touchAction:'none'}} />
      {ov!=='play' &&
        <div style={S.ov}>
          {ov==='start' && <><div style={{fontSize:42,marginBottom:10}}>🧱</div><h2 style={{fontSize:22,fontWeight:800,color:'#fff'}}>혜택 깨기 게임</h2>
            <p style={{fontSize:12.5,color:'#AEB8D6',marginTop:8,lineHeight:1.5}}>화면을 좌우로 밀어 패들을 움직이세요.<br/>벽돌을 다 깨면 <b style={{color:'#FFD86B'}}>추가 지원금</b> 대상!</p>
            <button style={S.startBtn} onClick={() => setOv('play')}>게임 시작 ›</button>
            <button style={S.skipBtn} onClick={onSkip}>게임 없이 바로 상담받기</button></>}
          {ov==='win' && <><div style={{fontSize:42,marginBottom:10}}>🎉</div><h2 style={{fontSize:22,fontWeight:800,color:'#fff'}}>축하합니다!</h2>
            <p style={{fontSize:12.5,color:'#AEB8D6',marginTop:8}}>벽돌을 모두 깼어요. 추가 지원금 대상이 됐어요.</p>
            <div style={S.coupon}><div style={{fontSize:11,fontWeight:800,color:'#7A5200'}}>🎁 추가 지원금 대상</div><div style={{fontSize:28,fontWeight:900,color:'#5A3A00',marginTop:2}}>당첨!</div><div style={{fontSize:10.5,color:'#8A6010',marginTop:3}}>상담 시 추가 지원금을 안내드려요</div></div>
            <button style={S.claimBtn} onClick={onWin}>쿠폰 적용하고 견적 보기 ›</button></>}
          {ov==='lose' && <><div style={{fontSize:42,marginBottom:10}}>💪</div><h2 style={{fontSize:22,fontWeight:800,color:'#fff'}}>아쉬워요!</h2>
            <p style={{fontSize:12.5,color:'#AEB8D6',marginTop:8}}>조금만 더 하면 쿠폰이 손에 잡혀요.</p>
            <button style={S.startBtn} onClick={() => setOv('play')}>다시 도전 ›</button>
            <button style={S.skipBtn} onClick={onSkip}>게임 없이 바로 상담받기</button></>}
        </div>}
    </div>
    <div style={{padding:'12px 20px',textAlign:'center',fontSize:11.5,color:C.soft}}>👆 게임 영역을 좌우로 밀어 패들을 조작하세요</div>
  </>
}

/* ===================== 스타일 ===================== */
const C = { bg:'#EEF4FC', card:'#fff', line:'#E5EDF8', line2:'#D2E0F2', ink:'#0E1B33', soft:'#54637E', dim:'#8C9AB3',
  blue:'#1E7BFF', blueD:'#0B4FCB', blueXl:'#EAF2FF', cyan:'#14B5D8', violet:'#7C5CFF', kt:'#FF3B47', gold:'#F0A52B', goldL:'#FFD86B', ok:'#19C37D', navy:'#11203A' }
const ktbStyle = { background:C.kt, color:'#fff', fontWeight:900, fontSize:11, padding:'1px 5px', borderRadius:3, fontStyle:'italic' }
const S = {
  wrap:{minHeight:'100vh',background:'#D9E6F7',padding:'22px 14px 50px',fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif"},
  device:{maxWidth:418,margin:'0 auto',background:C.bg,borderRadius:30,overflow:'hidden',boxShadow:'0 30px 70px -26px rgba(20,50,100,.45)',border:'1px solid '+C.line,minHeight:760,color:C.ink,position:'relative'},
  ktb: ktbStyle,
  reassure:{background:'#fff',padding:'10px 18px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid '+C.line},
  lock:{width:20,height:20,borderRadius:6,background:C.ok,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flex:'0 0 20px'},
  scroll:{maxHeight:740,overflowY:'auto'},
  hero:{background:'linear-gradient(160deg,#1E7BFF,#0B4FCB)',color:'#fff',padding:'22px 20px 26px',position:'relative',overflow:'hidden'},
  loc:{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,.18)',border:'1px solid rgba(255,255,255,.28)',padding:'5px 12px',borderRadius:20,fontSize:11.5,fontWeight:700},
  h1:{fontSize:25,fontWeight:800,lineHeight:1.28,marginTop:15},
  hp:{fontSize:13,color:'rgba(255,255,255,.92)',marginTop:9,lineHeight:1.5},
  body:{padding:'0 16px'},
  primary:{marginTop:-14,position:'relative',zIndex:5,background:'#fff',borderRadius:20,padding:20,boxShadow:'0 18px 40px -20px rgba(20,50,100,.3)',border:'1px solid '+C.line},
  tagHot:{fontSize:11,fontWeight:800,color:C.kt,background:'#FFECEE',padding:'4px 10px',borderRadius:20,display:'inline-block',marginBottom:11},
  ph2:{fontSize:19,fontWeight:800,lineHeight:1.3},
  pp:{fontSize:12.5,color:C.soft,marginTop:6,lineHeight:1.5},
  ctaBlue:{marginTop:15,background:'linear-gradient(135deg,#1E7BFF,#0B4FCB)',color:'#fff',fontSize:15,fontWeight:800,padding:15,borderRadius:13,border:0,width:'100%',cursor:'pointer'},
  micro:{display:'flex',gap:14,marginTop:13,justifyContent:'center',fontSize:11,color:C.soft,fontWeight:600},
  ktnet:{marginTop:11,background:'#fff',border:'1px solid '+C.line,borderRadius:18,padding:18,cursor:'pointer',boxShadow:'0 10px 26px -18px rgba(20,50,100,.3)'},
  knTag:{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,fontWeight:800,color:C.blueD,background:C.blueXl,padding:'5px 11px',borderRadius:20},
  maxben:{background:'linear-gradient(135deg,#11203A,#1a2d4d)',borderRadius:20,padding:20,color:'#fff',cursor:'pointer'},
  it:{background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.18)',borderRadius:10,padding:'8px 11px',fontSize:11.5,fontWeight:700},
  ctaGold:{marginTop:16,background:'linear-gradient(135deg,#FFD86B,#F0A52B)',color:'#5A3A00',fontSize:14,fontWeight:800,padding:13,borderRadius:12,border:0,width:'100%',cursor:'pointer'},
  game:{marginTop:11,background:'linear-gradient(135deg,#7C5CFF,#5B3FE0)',borderRadius:18,padding:18,color:'#fff',display:'flex',alignItems:'center',gap:14,cursor:'pointer',position:'relative',overflow:'hidden'},
  gameBadge:{position:'absolute',top:13,right:14,background:C.goldL,color:'#5A3A00',fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:8},
  gi:{width:46,height:46,borderRadius:13,background:'rgba(255,255,255,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flex:'0 0 46px'},
  svc:{background:'#fff',border:'1px solid '+C.line,borderRadius:15,padding:14,position:'relative',opacity:.72},
  svcIc:{width:40,height:40,borderRadius:11,background:'#E3F8F4',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,marginBottom:10},
  svcSoon:{position:'absolute',top:11,right:11,fontSize:9,fontWeight:800,padding:'3px 7px',borderRadius:20,background:'#EEF1F6',color:C.dim},
  soonbox:{background:'#fff',border:'1px dashed '+C.line2,borderRadius:15,padding:'15px 16px',display:'flex',alignItems:'center',gap:12},
  foot:{textAlign:'center',padding:'24px 16px 20px'},
  topbar:{display:'flex',alignItems:'center',gap:10,padding:'13px 16px',background:'#fff',borderBottom:'1px solid '+C.line},
  bk:{width:34,height:34,borderRadius:10,border:'1px solid '+C.line2,background:'#fff',cursor:'pointer',fontSize:16,color:C.soft},
  prog:{display:'flex',gap:5,padding:'14px 20px'},
  pgseg:{flex:1,height:5,borderRadius:3},
  cbody:{padding:'2px 20px 14px',minHeight:330},
  opt:{border:'2px solid '+C.line,borderRadius:15,padding:'14px 15px',cursor:'pointer',display:'flex',alignItems:'center',gap:13,background:'#fff'},
  optOn:{borderColor:C.blue,background:C.blueXl},
  chk:{width:22,height:22,borderRadius:'50%',border:'2px solid '+C.line2,flex:'0 0 22px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff'},
  chkOn:{background:C.blue,borderColor:C.blue},
  reveal:{background:'#F7FAFF',border:'1px solid '+C.line,borderRadius:16,padding:'16px 18px',marginBottom:14},
  giftbox:{background:'linear-gradient(135deg,#FFF6E6,#FFEFD0)',border:'1px solid #FFE0A8',borderRadius:13,padding:'13px 15px',display:'flex',alignItems:'center',gap:11},
  disc:{fontSize:10.5,color:C.dim,lineHeight:1.5,textAlign:'center',marginTop:12},
  input:{width:'100%',background:'#F7FAFF',border:'1.5px solid '+C.line2,borderRadius:12,padding:'13px 14px',fontSize:15,color:C.ink,fontFamily:'inherit',outline:'none'},
  consent:{display:'flex',gap:9,alignItems:'flex-start',background:'#F7FAFF',border:'1px solid '+C.line2,borderRadius:12,padding:'12px 13px',cursor:'pointer',marginTop:4},
  errBox:{marginTop:12,background:'#FFECEE',color:C.kt,fontSize:12.5,fontWeight:700,padding:'11px 14px',borderRadius:10,textAlign:'center'},
  pricebar:{background:'linear-gradient(135deg,#11203A,#1a2d4d)',color:'#fff',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  nav:{display:'flex',gap:10,padding:'13px 20px 18px'},
  back:{background:'#EEF2F8',color:C.soft,flex:'0 0 30%',border:0,borderRadius:13,padding:15,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'},
  next:{background:'linear-gradient(135deg,#1E7BFF,#0B4FCB)',color:'#fff',flex:1,border:0,borderRadius:13,padding:15,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'},
  knhero:{background:'linear-gradient(160deg,#0B4FCB,#072E7A)',color:'#fff',padding:'24px 20px 26px'},
  kncard:{background:'#fff',border:'1px solid '+C.line,borderRadius:18,padding:18,boxShadow:'0 12px 30px -22px rgba(20,50,100,.3)'},
  knstr:{background:'#fff',border:'1px solid '+C.line,borderRadius:15,padding:15},
  knstrIc:{width:42,height:42,borderRadius:12,background:C.blueXl,display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,marginBottom:11},
  knCta:{marginTop:20,background:'linear-gradient(135deg,#1E7BFF,#0B4FCB)',borderRadius:18,padding:20,color:'#fff',textAlign:'center'},
  knCtaBtn:{marginTop:15,background:'#fff',color:C.blueD,border:0,borderRadius:12,padding:'14px 18px',fontSize:14.5,fontWeight:800,width:'100%',cursor:'pointer',fontFamily:'inherit'},
  ov:{position:'absolute',inset:0,background:'rgba(8,14,32,.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:26},
  startBtn:{marginTop:18,border:0,borderRadius:13,padding:'13px 26px',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'inherit',background:'linear-gradient(135deg,#1E7BFF,#0B4FCB)',color:'#fff'},
  claimBtn:{marginTop:18,border:0,borderRadius:13,padding:'13px 26px',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'inherit',background:'#fff',color:C.blueD},
  skipBtn:{marginTop:11,background:'none',border:0,color:'#8C9AB3',fontSize:12,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'},
  coupon:{marginTop:16,background:'linear-gradient(135deg,#FFD86B,#F0A52B)',borderRadius:16,padding:'16px 22px'},
  done:{textAlign:'center',padding:'40px 24px',display:'flex',flexDirection:'column',justifyContent:'center',minHeight:600},
  doneIc:{width:72,height:72,borderRadius:'50%',background:C.ok,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 18px'},
  hbtn:{margin:'22px 0 0',background:'linear-gradient(135deg,#1E7BFF,#0B4FCB)',borderRadius:15,padding:15,display:'flex',alignItems:'center',gap:12,cursor:'pointer'},
  goHome:{marginTop:16,background:'none',border:0,color:C.soft,fontSize:13,fontFamily:'inherit',cursor:'pointer',textDecoration:'underline'},
  toast:{position:'fixed',left:'50%',bottom:40,transform:'translateX(-50%)',background:C.navy,color:'#fff',fontSize:13.5,fontWeight:700,padding:'13px 22px',borderRadius:13,boxShadow:'0 12px 30px rgba(0,0,0,.3)',zIndex:100,whiteSpace:'nowrap'},
}
