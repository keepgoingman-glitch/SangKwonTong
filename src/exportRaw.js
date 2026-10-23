// ── 상권통 원시데이터 엑셀 내보내기 ──────────────────────────────
// 성과(성공 1건 × 상품 1개 = 1행) · 활동 전체 · M플러스 일별 · MM별 요약 · 코드표
// 집계 기준은 연간누계 보고서와 동일:
//   - 배분 리드: 미처리 제외, 귀속일 = activity_at || created_at
//   - 직접발굴: 전체, 귀속일 = activity_at || created_at
//   - M플러스 현장: 회선 1개 이상인 일별 실적 1건 = 활동 1 · 성공 1 (등록 MM 귀속)
//   - 수주 회선: won_products 우선, 없으면 products 상품당 1회선

const THEMES = { 1: '기업체 통신환경 개선공사', 2: '세움터 신축건물', 3: '빌딩/상가 공략', 4: '직접 판매', 5: 'M플러스' }
const ALIAS = { 'TV': 'TV-M', '다량회선': 'TV-B', '일반전화': '전화' }   // 구버전 상품명 → 현행
const GROUP7 = ['인터넷', 'TV-M', 'TV-B', '모바일', '하이오더', '약정갱신', '기타']
const ETC_ITEMS = ['전화', 'USIM', 'CCTV', '로봇', '기타']

const prodName = p => ALIAS[p] || p
const prodGroup = p => { const n = prodName(p); return GROUP7.slice(0, 6).includes(n) ? n : '기타' }

function toDate(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d) ? null : d
}
const ymd = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''
const ym = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : ''

// 성공 1건 → [{상품, 회선}]
function wonItems(l) {
  try {
    const wp = JSON.parse(l.won_products || 'null')
    if (wp && !Array.isArray(wp)) {
      const r = Object.entries(wp).map(([p, v]) => ({ p, n: Number(v) || 0 })).filter(x => x.n > 0)
      if (Object.keys(wp).length) return r
    }
    if (Array.isArray(wp) && wp.length) return wp.map(p => ({ p, n: 1 }))
  } catch {}
  const pr = Array.isArray(l.products) ? l.products : (() => { try { return JSON.parse(l.products || '[]') } catch { return [] } })()
  return pr.map(p => ({ p, n: 1 }))
}

function mpRecs(m) {
  let recs = []
  try { recs = JSON.parse(m.daily_records || '[]') } catch {}
  return (Array.isArray(recs) ? recs : []).map(r => {
    const net = +r.net || 0, tv = +r.tv || 0, renew = +r.renew || 0
    const chg = +r.wireChange || 0, mnp = +r.mnp || 0, sec = +r.second || 0
    return { r, net, tv, renew, chg, mnp, sec, mob: chg + mnp + sec, total: net + tv + renew + chg + mnp + sec }
  })
}

function sheet(XLSX, rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '데이터 없음': '' }])
  if (widths) ws['!cols'] = widths.map(w => ({ wch: w }))
  if (rows.length && ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] }
  return ws
}

export async function exportRawExcel({ users = [], leads = [], directLeads = [], mDiscovery = [], teamLabels = {}, year, startMonth = 4, endMonth }) {
  const XLSX = await import('xlsx')
  const byName = Object.fromEntries(users.map(u => [u.name, u]))
  const byUname = Object.fromEntries(users.map(u => [u.username, u]))
  const teamOf = tid => teamLabels[tid] || tid || '-'

  const act = []    // 활동_전체
  const perf = []   // 성과_상품별

  const pushLead = (l, src, u) => {
    const d = toDate(l.activity_at || l.created_at)
    const ok = l.activity_status === '성공'
    const items = ok ? wonItems(l) : []
    const base = {
      '연월': ym(d), '월': d ? d.getMonth() + 1 : '', '일자': ymd(d),
      '팀': teamOf(u?.team_id || l.team_id), 'MM': u?.name || l.assigned_to || l.mm_username || '-',
      '구분': src, '테마': THEMES[Number(l.project_type)] || '-',
    }
    const cust = src === '배분' ? (l.col1 || l.address || '') : (l.customer || '')
    act.push({
      ...base, '고객명': cust, '주소': l.address || l.col2 || '',
      '상태': l.activity_status || '', '성공': ok ? 1 : 0,
      '회선계': items.reduce((a, x) => a + x.n, 0),
      '수주상품': items.map(x => `${prodName(x.p)} ${x.n}`).join(', '),
      '결과': l.activity_result || '', '메모': l.activity_memo || l.note || '',
      '대리점유형': l.agency_type || '', '대리점명': l.agency_name || '', '레코드ID': l.id,
    })
    items.forEach(x => perf.push({
      ...base, '고객명': cust, '상품(원본)': x.p, '상품': prodName(x.p), '7분류': prodGroup(x.p), '회선수': x.n,
      '회선번호': l.circuit_number || '', '개통일': l.activation_date || '',
      '대리점유형': l.agency_type || '', '대리점명': l.agency_name || '', '레코드ID': l.id,
    }))
  }

  leads.filter(l => l.activity_status && l.activity_status !== '미처리')
    .forEach(l => pushLead(l, '배분', byName[l.assigned_to]))
  directLeads.forEach(l => pushLead(l, '직접발굴', byUname[l.mm_username]))

  const mp = []     // M플러스_일별
  mDiscovery.forEach(m => {
    mpRecs(m).forEach(x => {
      const d = toDate(x.r.date)
      const base = { '연월': ym(d), '월': d ? d.getMonth() + 1 : '', '일자': ymd(d), '팀': teamOf(m.team_id), 'MM': m.registered_by || '-' }
      mp.push({ ...base, '현장': m.site_name || '', '단계': m.stage || '', '인터넷': x.net, 'TV': x.tv, '약정갱신': x.renew,
        '기변': x.chg, 'MNP': x.mnp, '2nd': x.sec, '무선계': x.mob, '회선계': x.total, '현장ID': m.id })
      if (x.total <= 0) return
      act.push({ ...base, '구분': 'M플러스현장', '테마': 'M플러스', '고객명': m.site_name || '', '주소': m.address || '',
        '상태': '성공', '성공': 1, '회선계': x.total,
        '수주상품': [['인터넷', x.net], ['TV-M', x.tv], ['약정갱신', x.renew], ['모바일', x.mob]].filter(([, n]) => n).map(([p, n]) => `${p} ${n}`).join(', '),
        '결과': '', '메모': '', '대리점유형': m.agency_type || '', '대리점명': m.agency_name || '', '레코드ID': m.id })
      ;[['인터넷', x.net], ['TV-M', x.tv], ['약정갱신', x.renew], ['모바일', x.mob]].forEach(([p, n]) => {
        if (n > 0) perf.push({ ...base, '구분': 'M플러스현장', '테마': 'M플러스', '고객명': m.site_name || '',
          '상품(원본)': p, '상품': p, '7분류': prodGroup(p), '회선수': n, '회선번호': '', '개통일': '',
          '대리점유형': m.agency_type || '', '대리점명': m.agency_name || '', '레코드ID': m.id })
      })
    })
  })

  const sortKey = r => (r['일자'] || '9999') + (r['팀'] || '') + (r['MM'] || '')
  act.sort((a, b) => sortKey(a) < sortKey(b) ? -1 : 1)
  perf.sort((a, b) => sortKey(a) < sortKey(b) ? -1 : 1)
  mp.sort((a, b) => sortKey(a) < sortKey(b) ? -1 : 1)

  // MM별 요약 (연간 누계 보고서와 동일 기간: startMonth ~ endMonth)
  const inRange = r => { const y = Number(String(r['연월']).slice(0, 4)); return y === year && r['월'] >= startMonth && r['월'] <= endMonth }
  const sum = {}
  const keyOf = r => r['팀'] + '|' + r['MM']
  const blank = r => ({ '팀': r['팀'], 'MM': r['MM'], '활동': 0, '성공': 0, '성공률(%)': 0, '회선계': 0, ...Object.fromEntries(GROUP7.map(g => [g, 0])), ...Object.fromEntries(ETC_ITEMS.map(g => ['기타:' + g, 0])) })
  users.forEach(u => { const r = { '팀': teamOf(u.team_id), 'MM': u.name }; sum[keyOf(r)] = blank(r) })
  act.filter(inRange).forEach(r => { const k = keyOf(r); sum[k] = sum[k] || blank(r); sum[k]['활동']++; sum[k]['성공'] += r['성공'] })
  perf.filter(inRange).forEach(r => {
    const k = keyOf(r); sum[k] = sum[k] || blank(r)
    sum[k]['회선계'] += r['회선수']; sum[k][r['7분류']] += r['회선수']
    if (r['7분류'] === '기타') { const e = ETC_ITEMS.includes(r['상품']) ? r['상품'] : '기타'; sum[k]['기타:' + e] += r['회선수'] }
  })
  const summary = Object.values(sum)
    .map(r => ({ ...r, '성공률(%)': r['활동'] ? Math.round(r['성공'] / r['활동'] * 100) : 0 }))
    .sort((a, b) => (a['팀'] + a['MM']).localeCompare(b['팀'] + b['MM'], 'ko'))
  const total = summary.reduce((t, r) => { Object.keys(r).forEach(k => { if (typeof r[k] === 'number') t[k] = (t[k] || 0) + r[k] }); return t }, { '팀': '전체', 'MM': '' })
  total['성공률(%)'] = total['활동'] ? Math.round(total['성공'] / total['활동'] * 100) : 0
  summary.push(total)

  const codes = [
    ...Object.entries(THEMES).map(([id, n]) => ({ '구분': '테마', '코드': Number(id), '이름': n, '7분류': '' })),
    ...['인터넷', 'TV-M', 'TV', 'TV-B', '다량회선', '모바일', '하이오더', '약정갱신', '전화', '일반전화', 'USIM', 'CCTV', '로봇', '기타']
      .map(p => ({ '구분': '상품', '코드': p, '이름': prodName(p), '7분류': prodGroup(p) })),
    { '구분': '기준', '코드': '활동', '이름': '배분 리드는 미처리 제외, 직접발굴은 전체, M플러스는 회선 1개 이상인 일별 실적 1건', '7분류': '' },
    { '구분': '기준', '코드': '귀속일', '이름': '활동일(activity_at), 없으면 등록일(created_at)', '7분류': '' },
    { '구분': '기준', '코드': '회선', '이름': '수주상품(won_products) 회선수, 미입력 시 상품당 1회선', '7분류': '' },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, summary, [8, 8, 7, 7, 10, 8, ...GROUP7.map(() => 8), ...ETC_ITEMS.map(() => 10)]), `MM별요약_${startMonth}-${endMonth}월`)
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, perf, [8, 5, 11, 8, 8, 10, 22, 24, 10, 9, 9, 7, 16, 11, 10, 14, 16]), '성과_상품별')
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, act, [8, 5, 11, 8, 8, 10, 22, 24, 30, 9, 5, 7, 26, 24, 40, 10, 14, 16]), '활동_전체')
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, mp, [8, 5, 11, 8, 8, 22, 9, 7, 6, 8, 6, 6, 6, 7, 7, 16]), 'M플러스_일별')
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, codes, [6, 10, 60, 8]), '코드표')

  const now = new Date()
  const fname = `상권통_원시데이터_${ymd(now).replace(/-/g, '')}.xlsx`
  XLSX.writeFile(wb, fname)
  return { fname, perf: perf.length, act: act.length, mp: mp.length }
}
