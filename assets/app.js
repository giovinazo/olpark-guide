/* 올림픽공원 공연·주차 길잡이 (모델 v1.2) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const kstNow = new Date(Date.now() + (new Date().getTimezoneOffset() + 540) * 60000);  // 보는 사람 시간대와 관계없이 한국 날짜
  const today = iso(kstNow);
  const addDays = (k, n) => { const d = new Date(k + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };  // 기기 시간대·서머타임과 무관한 날짜 계산
  try { const th = new URLSearchParams(location.search).get("theme"); if (th === "light" || th === "dark") document.documentElement.dataset.theme = th; } catch (e) {}  // ?theme=light 로 밝은 화면 고정(시연·캡처용)

  const I18N = {
    ko: {
      skip: "본문 바로가기", brand: "올림픽공원 공연·주차 길잡이", tagline: "공연 일정 표준화 · 시간대별 주차 혼잡 예보 · 데이터 점검", "tab.schedule": "공연 일정", "tab.forecast": "주차 혼잡 예보", "tab.quality": "데이터 점검판",
      todayShows: "오늘 공연", todayNone: "오늘은 공연이 없습니다", nextBig: "다음 대형 공연", todayWx: "오늘 날씨(기상청)", wxRainH: h => `비 ${h}시부터`, wxDry: "비 소식 없음", wxPop: p => `강수확률 최고 ${p}%`, countShows: n => `${n}건`,
      levelTip: ["들어오는 차가 적은 시간대입니다.", "평소 수준입니다. 공연장 옆 주차장이 차면 P1·P2로 돌리십시오.", "그 달 안에서 들어오는 차가 많은 시간대(상위 10~25%)입니다. 30분 일찍 오거나 큰 주차장 P1(562대)을 바로 이용하십시오.", "그 달 안에서 들어오는 차가 가장 많은 시간대(상위 10%)입니다. 지하철(5·9호선 올림픽공원역) 이용을 권합니다."],
      stripTitle: "시간대별 수준(0~23시)", stripHint: "막대를 누르면 그 시각으로 바뀝니다.", stripHintWx: " 위 그림은 기상청 예보",
      wxKind: { sun: "맑음", partly: "구름 많음", cloud: "흐림", rain: "비", shower: "소나기", sleet: "비 또는 눈", snow: "눈" },
      wxBasis: pop => `강수확률 ${pop}%`, wxNoFc: "기상청 예보가 없는 날짜", wxPicked: "직접 선택",
      wxLabelFc: "날씨(예보 기준)", wxLabelPick: "날씨(직접 선택)", legendLv: (name, lo, hi) => `${name} ${lo == null ? `~${hi}대` : hi == null ? `${lo}대 이상` : `${lo}~${hi}대`}/시간`,
      sourcesH: "활용 데이터", license: "기상청 자료는 공공누리 제1유형(출처표시), 그 밖의 공공데이터는 공공데이터포털·문화 공공데이터광장 이용조건을 따릅니다. 소스 코드는 MIT 라이선스입니다.", repo: "원천 소스(공개 저장소, 화면·갱신 스크립트·모델 추정·원천 표)", liveLink: "실시간 주차대수(주말 운영): 기관 주차장 예상 이용률", sources: [
        ["한국체육산업개발(주) 올림픽공원 전체구역 입출차 정보(2025년)", "https://www.data.go.kr/data/15159093/openapi.do"],
        ["한국체육산업개발(주) 올림픽공원 영문 공연정보", "https://www.data.go.kr/data/15149169/fileData.do"],
        ["한국체육산업개발(주) 올림픽공원 월별 주차현황(월 보정)", "https://www.data.go.kr/data/15131671/fileData.do"],
        ["한국체육산업개발(주) 올림픽공원 주차장 혼잡도 정보(파일 점검)", "https://www.data.go.kr/data/15164156/fileData.do"],
        ["한국문화정보원 문화 공공데이터광장 통합 공연정보(API_CCA_144) 중 한국체육산업개발(주) 분", "https://www.culture.go.kr/data/openapi/openapiList.do"],
        ["기상청 단기예보 조회서비스(올림픽공원 격자 62·126)", "https://www.data.go.kr/data/15084084/openapi.do"],
        ["기상청 지상(종관, ASOS) 시간자료(서울 108, 모델 추정용)", "https://www.data.go.kr/data/15057210/openapi.do"],
        ["한국천문연구원 특일 정보(공휴일)", "https://www.data.go.kr/data/15012690/openapi.do"],
        ["올림픽공원 누리집 공연 일정안내·주차 안내(회차 시각·주차장 위치)", "https://www.ksponco.or.kr/olympicpark/"],
      ],
      "schedule.title": "다가오는 공연", "schedule.sub": "공공데이터의 공연장 이름을 하나로 맞추고 기간을 날짜별로 풀어 보여 줍니다.",
      "forecast.title": "주차 혼잡 예보", "forecast.sub": "요일·시각·공연 시작까지 남은 시간·비로 그 시간대 입차 수준을 예상하고, 월 보정을 곱해 예상 대수를 냅니다. 2025년 입출차 241만 건 중 원본 자료가 온전한 235일로 추정했고 검증 수치는 아래 '예보 모델 근거'에 있습니다.",
      "forecast.date": "날짜", "forecast.hour": "시각", "forecast.venue": "공연장", "forecast.rain": "날씨", "forecast.clear": "맑음", "forecast.rainy": "비",
      "quality.title": "데이터 점검판", "quality.sub": "서비스가 공연 자료를 받을 때 자동으로 걸러 낸 항목입니다. 표기 통일과 빈칸 보완이 필요한 곳을 보여 줍니다.",
      "foot.disclaimer": "예보는 과거 입출차 기록으로 추정한 값이며 실제 주차 가능 대수와 다를 수 있습니다. 공연 정보는 기관 누리집 원문을 확인하십시오.",
      all: "전체", today: "오늘", days: "일간", min: "분", official: "기관 안내", forecastBtn: "주차 예보", bigShow: "대형 공연", venueFixed: "표기 통일", noUpcoming: "다가오는 공연이 없습니다.",
      upcomingNote: (n, from, to) => `${from}부터 ${to}까지 공연 ${n}건. 자료 갱신 ${""}`,
      expected: n => `예상 입차 ${n}대/시간`, basis: (n, b) => `표본 ${n}시간 · ${b}`, basisD: "같은 조건 평균", basisR: "비 구분 없이 평균", basisS: "공연 구분 없이 평균",
      basisV1: (b, mo) => `기준 ${b.base}대(2025년 입출차로 추정한 요일·시각 기준값, 공연·비 효과 제외)${b.showF !== 1 ? ` × 공연 ${b.showF}(시작 ${b.off < 0 ? `${-b.off}시간 전` : b.off === 0 ? "시각" : `${b.off}시간 뒤`})` : ""}${b.rainF !== 1 ? ` × 비 ${b.rainF}` : ""}${b.monthF !== 1 ? ` × ${mo}월 보정 ${b.monthF}` : ""}`,
      modelH: "예보 모델 근거", modelNotes: (m, v) => [
        `계산식: ${m.formula}`,
        `기준값 72칸(요일구분 3×시각 24)·공연 효과 ${m.showEffect.factor.length}구간·비 효과·월 보정은 2025년 입출차 중 원본 자료가 온전한 ${v.days}일(${v.hours.toLocaleString()}시간, 대형 공연일 ${v.bigDays}일)로 추정했습니다. 원본 자료가 빠진 8·9·11·12월의 월 보정은 월별 주차현황 비율로 대신합니다.`,
        `공연 효과(공연 시작까지 남은 시간): ${m.showEffect.bins.map((b, i) => `${b}시간 ×${m.showEffect.factor[i]}`).join(", ")}. 비 효과 ×${m.rainEffect}.`,
        v.v2 ? `검증(${v.method}): 평균 절대 오차 ${v.v2.mae}대/시간, 4단계 수준 일치 ${Math.round(v.v2.levelAgree * 100)}%로 요일·시각 평균만 쓴 방식(${v.weekdayHourOnly.mae}대·${Math.round(v.weekdayHourOnly.levelAgree * 100)}%)보다 조금 낫습니다. 대형 공연일만 보면 ${v.v2_bigDays.mae}대·${Math.round(v.v2_bigDays.levelAgree * 100)}%로 요일·시각 평균(${v.weekdayHourOnly_bigDays.mae}대·${Math.round(v.weekdayHourOnly_bigDays.levelAgree * 100)}%)과 비슷하며, 이 모델의 장점은 회차 시각을 입력으로 받아 공연 전후 시간대를 나눠 보여 주는 데 있습니다.` : "",
        `공연 효과는 시작 6시간 전부터만 적용합니다. 수준 경계(월 보정을 걷어 낸 7월 수준 시간별 입차의 50·75·90 백분위 ${Object.values(m.thresholds).join('·')}대)와 예상 대수에 같은 월 보정을 곱하므로 월은 수준을 바꾸지 않습니다. 수준은 그 달 안에서의 상대 혼잡이고, 월 보정은 예상 대수에만 드러납니다.`,
        sdNote("ko"),
        ...(m.limits || []),
      ].filter(Boolean),
      bigOn: v => `이날 ${v} 공연이 있어 공연 수요를 더했습니다.`, bigOff: "이날 대형 공연장(KSPO DOME·핸드볼경기장) 공연이 없습니다.",
      dayKind: { wd: "평일", sat: "토요일", sun: "일요일·공휴일" },
      parkingH: "가까운 주차장", lot: "주차장", spaces: "대수", walk: "걸어서", gates: "진입 출입문", hours: "운영 시간", feeH: "요금", noLot: "이 공연장은 주차장 안내가 없습니다. P1(562대)을 이용하십시오.",
      transitH: "대중교통", exit: "출구", toward: "→", tipsH: "공연일 안내",
      wxLine: (base, pop, pty, tmp) => `기상청 단기예보(${base} 발표): 강수확률 ${pop}%${pty ? ` · ${pty}` : ""}${tmp != null ? ` · ${tmp}℃` : ""}. 이 예보로 계산했습니다(눈·소나기도 비로 계산).`,
      wxManual: "직접 고른 값으로 계산 중(날짜를 바꾸면 예보로 돌아감)", wxNone: last => `기상청 단기예보 범위(${last}까지) 밖이라 비 여부는 직접 고르십시오.`,
      pty: { 0: "", 1: "비", 2: "비 또는 눈", 3: "눈", 4: "소나기" },
      timeUnknown: "시각 미확인", timeCheck: "시각 표기 점검", booking: "예매", startAt: (v, t) => `${v} 공연 시작 ${t}. 2025년 기록으로 추정하면 시작 5~6시간 전부터 입차가 늘고, 1~2시간 전에는 같은 요일·시각 기준값의 약 1.7배입니다.`,
      sessionsH: "회차 시각 점검(기관 누리집 상세 글)", sessionsSub: "공공데이터에는 회차별 시작 시각이 없어 기관 누리집 공연 상세 글의 \"시간\" 칸을 읽어 날짜별 시각으로 표준화하고 표기 오류를 점검합니다. 2026년 이후 공연을 모아 두고, 다가오는 공연(120일 안)은 매일 다시 읽습니다.",
      sessRead: "읽은 상세 글", sessGot: "시각 확보", sessBlank: "빈칸·추후 공지", sessErr: "표기 오류", sessShow: "공연", sessRaw: "원문", sessProblem: "문제", sessFix: "정정안",
      sessIssue: { date_outside: "날짜가 공연 기간 밖(월 오기 추정)", weekday_mismatch: "요일이 날짜와 다름", weekday_blank: "요일 빈칸", time_format: "시각 표기 불완전('시' 누락)", time_leftover: "해석 못 한 시각 표기", time_unparsed: "시각 해석 불가", date_invalid: "없는 날짜", period_mismatch: "공공데이터와 누리집 기간 불일치", time_blank: "시각 빈칸", time_tbd: "추후 공지", partial_days: "기간 중 일부 날만 회차", note: "비고", page_error: "누리집 상세 글 열리지 않음(서버 오류)" },
      sessNote: "오류로 잡힌 글은 화면에 '시각 표기 점검' 꼬리표를 붙이고, 정정안이 있으면 정정안 날짜로 회차를 잡습니다. 원문은 기관 누리집에서 확인하십시오.",
      titlesH: "영문 제목 연결(기관 영문 게시판)", titlesSub: "개방 데이터 '영문 공연정보'(15149169)의 원천인 기관 영문 누리집 Culture Info 게시판을 읽어, 공연정보와 날짜·제목 낱말 겹침으로 짝을 짓습니다. 영어 화면에서는 이 제목과 외국인용 예매처 링크를 씁니다.",
      teItems: "영문 게시판 글", teLinked: "공연정보와 연결", teUpcoming: "다가오는 공연 연결", teKoOnEn: "영문 글인데 한국어 제목(2026년~)", teDate: "날짜", teTitle: "영문 게시판 제목 그대로",
      teNote: n => `제목 낱말이 안 겹치면 시작일이 같은 공연이 하나뿐일 때만 날짜로 연결합니다(${n}건, 점수 0.2). 한국어 제목 그대로인 영문 글은 외국인 관람객이 검색하지 못하는 항목입니다.`,
      filesH: "개방 파일 점검(주차장 혼잡도 정보·월별 주차현황)", filesSub: "같은 기관 개방 파일 2종을 받아 형식과 규모를 점검한 결과입니다. 혼잡도 정보는 점검과 대형 공연일 대조에만 쓰고, 월별 주차현황은 예보의 월 보정에도 씁니다.",
      fcRows: "혼잡도 등록 행", fcTimeBug: "등록시간 분:초 = 등록일 월:일", fcDays: "등록된 날 수", fcRatio: "월별 주차현황 : 입출차(2024년 7월)",
      statTotal: "전체 공연 자료", statClean: "문제 없는 자료", statRecent: "2024년 이후", statVenueRaw: "공연장 표기 종류",
      issuesH: "자동 점검 결과", variantsH: "공연장 표기 통일(2024년 이후)", raw: "원문 표기", canonical: "표준명", count: "건",
      issue: { venue_variant: "공연장 표기가 표준명과 다름", venue_blank: "공연장 빈칸·자리표", venue_unmatched: "공연장 판별 불가", non_show: "공연이 아닌 항목(대관 준비·예약 자리표)", duration_blank: "공연 시간 빈칸·자리표", duration_unparsed: "공연 시간 해석 불가", duplicate: "같은 제목·기간 중복 등록", period_unparsed: "기간 해석 불가" },
      qNotes: ["공연 자료는 문화 공공데이터광장 통합 공연정보(API_CCA_144)에서 한국체육산업개발(주) 분만 받아 매일 새로 만듭니다.", "표준 공연장 10종은 기관 누리집 일정안내의 공연장 구분을 따릅니다.", "공연이 아닌 항목은 2013~2015년 대관 시스템 자리표이며 화면의 일정에서는 제외합니다."],
      source: (u) => `자료: 한국체육산업개발(주) 개방 공공데이터(입출차·영문 공연정보·월별 주차현황·혼잡도), 한국문화정보원 통합 공연정보(기관 등록분), 기상청 단기예보·지상관측, 한국천문연구원 특일 정보, 올림픽공원 누리집(회차 시각·주차 안내) · 공연 자료 갱신 ${u}(한국 시각)`, stale: " · 공연 자료가 하루 넘게 갱신되지 않아 지난 자료를 보여 주고 있습니다",
    },
    en: {
      skip: "Skip to main content", brand: "Olympic Park Show & Parking Guide", tagline: "Unified show schedule · hourly parking forecast · data check", "tab.schedule": "Shows", "tab.forecast": "Parking forecast", "tab.quality": "Data check",
      todayShows: "Shows today", todayNone: "No shows today", nextBig: "Next major show", todayWx: "Weather today (KMA)", wxRainH: h => `Rain from ${h}:00`, wxDry: "No rain expected", wxPop: p => `max rain chance ${p}%`, countShows: n => `${n}`,
      levelTip: ["Few cars are entering at this hour.", "Normal level. If the lot next to the venue is full, use P1 or P2.", "One of the busier hours of the month (top 10 to 25%). Arrive 30 minutes early or go straight to P1 (562 spaces).", "The busiest hours of the month (top 10%). Take the subway (Olympic Park Station, Lines 5 and 9)."],
      stripTitle: "Level by hour (0 to 23)", stripHint: "Tap a bar to pick that hour.", stripHintWx: " Icons = KMA forecast",
      wxKind: { sun: "Clear", partly: "Partly cloudy", cloud: "Cloudy", rain: "Rain", shower: "Showers", sleet: "Rain or snow", snow: "Snow" },
      wxBasis: pop => `${pop}% chance of rain`, wxNoFc: "No KMA forecast for this date", wxPicked: "your choice",
      wxLabelFc: "Weather (forecast)", wxLabelPick: "Weather (your choice)", legendLv: (name, lo, hi) => `${name} ${lo == null ? `up to ${hi}` : hi == null ? `${lo}+` : `${lo} to ${hi}`} cars/h`,
      sourcesH: "Data sources", license: "KMA data: KOGL Type 1 (attribution). Other open data: per data.go.kr / Culture Public Data Plaza terms. Source code: MIT.", repo: "Source code (public repository: pages, update scripts, model, source tables)", liveLink: "Live parking count (weekends): KSPO&CO parking page (Korean only)", sources: [
        ["KSPO&CO Olympic Park gate records, all zones (2025)", "https://www.data.go.kr/data/15159093/openapi.do"],
        ["KSPO&CO Olympic Park English show information", "https://www.data.go.kr/data/15149169/fileData.do"],
        ["KSPO&CO Olympic Park monthly parking totals (month factor)", "https://www.data.go.kr/data/15131671/fileData.do"],
        ["KSPO&CO Olympic Park parking congestion (file check)", "https://www.data.go.kr/data/15164156/fileData.do"],
        ["KCISA Culture Public Data Plaza integrated performance API (API_CCA_144), KSPO&CO records", "https://www.culture.go.kr/data/openapi/openapiList.do"],
        ["KMA short-term forecast (Olympic Park grid 62, 126)", "https://www.data.go.kr/data/15084084/openapi.do"],
        ["KMA ASOS hourly observations (Seoul 108, for the model)", "https://www.data.go.kr/data/15057210/openapi.do"],
        ["KASI public holidays", "https://www.data.go.kr/data/15012690/openapi.do"],
        ["Olympic Park website schedule and parking pages (showtimes, lot locations)", "https://www.ksponco.or.kr/olympicpark/"],
      ],
      "schedule.title": "Upcoming shows", "schedule.sub": "Venue names from open data are unified and multi-day runs are expanded by date.",
      "forecast.title": "Parking forecast", "forecast.sub": "Expected inbound level by weekday type, hour, time left to showtime and rain, with the car count scaled by a month factor; estimated from 2025 gate records (2.41 million) on the 235 days with complete source data. Validation figures are under 'How the forecast is made'.",
      "forecast.date": "Date", "forecast.hour": "Hour", "forecast.venue": "Venue", "forecast.rain": "Weather", "forecast.clear": "Clear", "forecast.rainy": "Rain",
      "quality.title": "Data check", "quality.sub": "Items the service flagged automatically while loading show data: inconsistent venue names and blanks.",
      "foot.disclaimer": "Forecasts are estimates from past gate records and may differ from actual availability. Check the official page for show details.",
      all: "All", today: "Today", days: "days", min: "min", official: "Official page", forecastBtn: "Parking", bigShow: "Major show", venueFixed: "Name unified", noUpcoming: "No upcoming shows.",
      upcomingNote: (n, from, to) => `${n} shows from ${from} to ${to}.`,
      expected: n => `About ${n} cars entering per hour`, basis: (n, b) => `${n} sample hours · ${b}`, basisD: "same conditions", basisR: "rain ignored", basisS: "shows ignored",
      basisV1: (b, mo) => `Base ${b.base} cars (model baseline for this weekday type and hour, 2025 gate records, show and rain effects removed)${b.showF !== 1 ? ` × show ${b.showF} (${b.off < 0 ? `${-b.off}h before start` : b.off === 0 ? "at start" : `${b.off}h after start`})` : ""}${b.rainF !== 1 ? ` × rain ${b.rainF}` : ""}${b.monthF !== 1 ? ` × month ${b.monthF}` : ""}`,
      modelH: "How the forecast is made", modelNotes: (m, v) => [
        `Formula: hourly inbound = base[weekday type][hour] × show effect[time to showtime] × rain effect × month factor.`,
        `The 72 base values (3 weekday types × 24 hours), ${m.showEffect.factor.length} show-effect bins, the rain effect and month factors are estimated from 2025 gate records on the ${v.days} days with complete source data (${v.hours.toLocaleString()} hours, ${v.bigDays} major-show days). For August, September, November and December, where the source data is cut off, month factors come from monthly parking ratios.`,
        `Show effect by hours to showtime: ${m.showEffect.bins.map((b, i) => `${b}h ×${m.showEffect.factor[i]}`).join(", ")}. Rain ×${m.rainEffect}.`,
        v.v2 ? `Validation (leave-one-day-out, ${v.days} refits): mean absolute error ${v.v2.mae} cars/h, 4-level agreement ${Math.round(v.v2.levelAgree * 100)}%, slightly better than a weekday-hour-only average (${v.weekdayHourOnly.mae} / ${Math.round(v.weekdayHourOnly.levelAgree * 100)}%). On major-show days alone the two are similar (${v.v2_bigDays.mae} / ${Math.round(v.v2_bigDays.levelAgree * 100)}% vs ${v.weekdayHourOnly_bigDays.mae} / ${Math.round(v.weekdayHourOnly_bigDays.levelAgree * 100)}%); the model's merit is taking the showtime as an input to split hours before and after the show.` : "",
        "The show effect applies only from 6 hours before showtime. Both the level thresholds (50/75/90th percentiles of hourly inbound at July level) and the car count are scaled by the same month factor, so the month does not change the level: levels are relative to that month, and the month factor shows only in the car count.",
        sdNote("en"),
        "Source months with missing data (Aug, Sep, Nov, Dec) and the last day of every month are excluded, so those month factors come from monthly parking ratios.",
        `${m.counts ? m.counts.bigSaturdays : ""} of ${m.counts ? m.counts.saturdays : ""} Saturdays in the data had major shows, so the Saturday baseline without a major show relies heavily on the model's assumptions.`,
        "Levels count cars entering the whole park in that hour, not free spaces.",
      ].filter(Boolean),
      bigOn: v => `A show at ${v} that day adds concert traffic.`, bigOff: "No show at the two large venues (KSPO DOME, Handball Gymnasium) that day.",
      dayKind: { wd: "Weekday", sat: "Saturday", sun: "Sunday / holiday" },
      parkingH: "Nearest parking", lot: "Lot", spaces: "Spaces", walk: "Walk", gates: "Gates", hours: "Hours", feeH: "Fee", noLot: "No lot listed for this venue. Use P1 (562 spaces).",
      transitH: "Public transport", exit: "Exit", toward: "→", tipsH: "Show-day tips",
      wxLine: (base, pop, pty, tmp) => `KMA short-term forecast (issued ${base}): rain chance ${pop}%${pty ? ` · ${pty}` : ""}${tmp != null ? ` · ${tmp}℃` : ""}. Computed from this forecast (snow and showers count as rain).`,
      wxManual: "using your manual choice (changing the date restores the forecast)", wxNone: last => `Outside the forecast range (through ${last}); choose rain manually.`,
      pty: { 0: "", 1: "rain", 2: "rain or snow", 3: "snow", 4: "showers" },
      timeUnknown: "Time not listed", timeCheck: "Time text check", booking: "Tickets", startAt: (v, t) => `${v} show starts at ${t}. Estimated from 2025 records, inbound traffic starts rising 5 to 6 hours before showtime and is about 1.7 times the baseline for that weekday type and hour 1 to 2 hours before.`,
      sessionsH: "Showtime check (official detail pages)", sessionsSub: "Open data has no per-day showtimes, so the service reads the \"time\" field of each official show page, normalises it into dated showtimes and flags text errors. Shows since 2026 are kept, and upcoming shows (within 120 days) are re-read daily.",
      sessRead: "Pages read", sessGot: "Showtimes found", sessBlank: "Blank / TBA", sessErr: "Text errors", sessShow: "Show", sessRaw: "As written", sessProblem: "Problem", sessFix: "Suggested fix",
      sessIssue: { date_outside: "Date outside show period (wrong month?)", weekday_mismatch: "Weekday does not match date", weekday_blank: "Weekday blank", time_format: "Incomplete time text", time_leftover: "Unparsed time text", time_unparsed: "Time not parseable", date_invalid: "Invalid date", period_mismatch: "Period differs from open data", time_blank: "Time blank", time_tbd: "To be announced", partial_days: "Showtimes on only some days", note: "Note", page_error: "Official page fails to load (server error)" },
      sessNote: "Flagged pages get a 'Time text check' tag on the schedule; when a fix is suggested, the showtime is placed on the corrected date. Check the official page for the original text.",
      titlesH: "English titles (official English board)", titlesSub: "The open dataset 'English show information' (15149169) is an export of the official English Culture Info board. The service reads that board and pairs each post with a show record by date and title word overlap. The English view uses these titles and the English ticketing links.",
      teItems: "English board posts", teLinked: "Linked to show records", teUpcoming: "Upcoming shows linked", teKoOnEn: "English posts titled only in Korean (2026+)", teDate: "Date", teTitle: "Title as posted on the English board",
      teNote: n => `When no title words overlap, a post is linked by date only if exactly one show starts that day (${n} posts, score 0.2). Korean-only titles on the English board cannot be found by foreign visitors.`,
      filesH: "Open file check (parking congestion, monthly parking)", filesSub: "Two more open files from the same agency, checked for format and scale. The congestion file is only checked and compared with major-show days; the monthly parking file also feeds the forecast's month factor.",
      fcRows: "Congestion rows", fcTimeBug: "Time mm:ss equals date month:day", fcDays: "Days with entries", fcRatio: "Monthly total : gate records (July 2024)",
      fcFindingEn: "In every row the minute:second part of the time field equals the month:day of the date, so the time field is not a real time; a few manual entries per day cannot serve as an hourly congestion indicator.",
      moFindingEn: "The monthly parking total for July 2024 (59,808) is about 1/3.6 of the gate records for the same month (215,528), so the two files count different things (likely paid exits). The service uses only month-to-July ratios as a seasonal factor.",
      statTotal: "Show records", statClean: "Clean records", statRecent: "Since 2024", statVenueRaw: "Venue spellings",
      issuesH: "Automatic checks", variantsH: "Venue name unification (since 2024)", raw: "As written", canonical: "Standard", count: "n",
      issue: { venue_variant: "Venue differs from standard name", venue_blank: "Venue blank / placeholder", venue_unmatched: "Venue not recognised", non_show: "Not a show (booking placeholders)", duration_blank: "Running time blank", duration_unparsed: "Running time unreadable", duplicate: "Duplicate title and period", period_unparsed: "Period unreadable" },
      qNotes: ["Show data is rebuilt daily from the Culture Public Data Plaza integrated performance API (KSPO&CO records only).", "The 10 standard venues follow the venue tabs on the official schedule page.", "Non-show items are 2013-2015 booking placeholders and are hidden from the schedule."],
      source: (u) => `Data: KSPO&CO open data (gate records, English shows, monthly parking, congestion), KCISA integrated performance API (KSPO&CO records), KMA forecast and observations, KASI holidays, Olympic Park website (showtimes, parking) · shows updated ${u} (KST)`, stale: " · Show data has not been refreshed for over a day; showing the previous data",
    },
  };
  let lang = (navigator.language || "ko").startsWith("ko") ? "ko" : "en";
  try { lang = localStorage.getItem("olpark.lang") || lang; } catch (e) {}
  const T = k => I18N[lang][k];

  const DATA = {};
  const state = { venue: "all", fc: { date: today, hour: 17, venue: "KSPO DOME", rain: 0, rainMode: "auto" } };
  /* 기상청 단기예보(3~4일, 발표 시각에 따라 다름): 그 시각의 비 여부. 없으면 null */
  function wxAt(dateStr, hour) {
    const w = DATA.weather; if (!w || !w.hours || !w.hours[dateStr]) return null;
    const hs = w.hours[dateStr]; const keys = Object.keys(hs).sort();
    if (!keys.length) return null;
    const k = pad(hour); const pick = hs[k] ? k : keys.filter(x => x <= k).pop();  // 3시간 간격 구간은 바로 앞 칸
    if (!pick || +k - +pick > 2) return null;  // 앞 칸이 없거나 3시간 넘게 떨어지면(마지막 날 0시 한 칸 등) 범위 밖
    const s = hs[pick];
    const rain = (s.pty || 0) !== 0 || (s.pop || 0) >= (w.rule ? w.rule.rainPop : 60);
    return { ...s, hour: pick, rain: rain ? 1 : 0 };
  }
  // 예보가 있으면 늘 예보 기준(직접 선택 없음), 예보 밖 날짜만 맑음으로 두고 직접 고르게 함
  function autoRain() { const w = wxAt(state.fc.date, state.fc.hour); if (w) { state.fc.rainMode = "auto"; state.fc.rain = w.rain; } else if (state.fc.rainMode === "auto") state.fc.rain = 0; }
  function wxKind(s) { const p = s.pty || 0; return p === 3 ? "snow" : p === 2 ? "sleet" : p === 4 ? "shower" : p === 1 || s.rain ? "rain" : s.sky === 1 ? "sun" : s.sky === 3 ? "partly" : "cloud"; }
  const CLOUD = '<path d="M7.5 15.5h9a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 6.3 8.2 3.7 3.7 0 0 0 7.5 15.5z"/>';
  const WX_SVG = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    partly: '<path d="M8.5 2.5v1.5M3 8h1.5M4.6 4.1l1 1M12.4 4.1l-1 1"/><path d="M11.8 8.6a3.6 3.6 0 0 0-6.4 2.3"/><path d="M9 20.5h8.5a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 8.4 12.4 4 4 0 0 0 9 20.5z"/>',
    cloud: '<path d="M7 19h10a4.2 4.2 0 0 0 .5-8.37A6.3 6.3 0 0 0 5.6 9.4 4.8 4.8 0 0 0 7 19z"/>',
    rain: CLOUD + '<path d="M8.5 18.5l-1 3M12.5 18.5l-1 3M16.5 18.5l-1 3"/>',
    shower: CLOUD + '<path d="M9 18.5l-1.5 3.5M14 18.5l-1.5 3.5"/>',
    sleet: CLOUD + '<path d="M8.5 18.5l-1 3M15.5 18.5l-1 3"/><path d="M12 19.5v.01M12 22v.01" stroke-width="2.8"/>',
    snow: CLOUD + '<path d="M8 19v.01M12 20v.01M16 19v.01M10 22.3v.01M14 22.3v.01" stroke-width="2.8"/>',
  };
  const wxIcon = (k, label) => `<svg class="wxi wx-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label || k}">${WX_SVG[k]}</svg>`;

  async function load() {
    const names = ["shows", "model", "venues", "quality", "holidays", "details", "titles_en", "weather", "files_check"];
    const res = await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => r.json())));
    names.forEach((n, i) => DATA[n] = res[i]);
    DATA.holidaySet = new Set(DATA.holidays.holidays.map(String));
  }
  /* 회차 시각(기관 누리집 상세 글) */
  const ERR_KINDS = ["date_outside", "weekday_mismatch", "weekday_blank", "time_format", "time_leftover", "time_unparsed", "date_invalid", "period_mismatch"];
  const LIST_KINDS = ERR_KINDS.concat(["page_error"]);  // 점검판 표에 싣는 종류(누리집 글 자체 오류 포함)
  const seqOf = s => ((s.url || "").match(/evtSeq=(\d+)/) || [])[1];
  const detailOf = s => (DATA.details && DATA.details.bySeq[seqOf(s)]) || null;
  const timesOn = (s, k) => { const d = detailOf(s); return d ? d.sessions.filter(x => x.date === k).map(x => x.time) : []; };
  const hasErr = d => d && d.checks.some(c => ERR_KINDS.includes(c.kind));
  const hourBefore = (times, fallback = 17) => { if (!times.length) return fallback; const h = +times[0].slice(0, 2); return Math.min(21, Math.max(6, h - 2)); };
  /* 영문 제목·영문 예매처(기관 영문 게시판) */
  const enOf = s => (DATA.titles_en && DATA.titles_en.byId[s.id]) || null;
  const bare = t => (t || "").replace(/[^A-Za-z0-9가-힣]/g, "").toLowerCase();
  const enUsable = (e, s) => e && /[A-Za-z]{3,}/.test(e.en) && bare(e.en) !== bare(s.title);  // 영문 글 제목이 실제 영어이고 원제와 다를 때만
  const showTitle = s => { const e = enOf(s); return lang === "en" && enUsable(e, s) ? e.en : s.title; };
  const subTitle = s => { const e = enOf(s); return lang === "en" && enUsable(e, s) ? s.title : ""; };

  /* ---------- 공통 ---------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach(el => { const v = T(el.dataset.i18n); if (typeof v === "string") el.textContent = v; });
    $("#langBtn").textContent = lang === "ko" ? "EN" : "KO";
    document.title = T("brand");
  }
  function venueName(v) { return lang === "en" ? ((DATA.venues.venues[v] || {}).en || v) : v; }
  function fmtDate(s) { if (!s) return ""; const d = new Date(s + "T00:00:00"); const wd = lang === "ko" ? "일월화수목금토"[d.getDay()] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]; return lang === "ko" ? `${d.getMonth() + 1}월 ${d.getDate()}일(${wd})` : `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getDate()} (${wd})`; }
  function showTab(name) {
    $$(".tab").forEach(t => t.classList.toggle("is-on", t.dataset.tab === name));
    $$(".panel").forEach(p => p.classList.toggle("is-on", p.id === name));
    if (name === "forecast") renderForecast();
  }

  /* ---------- 1. 일정 ---------- */
  const isShow = s => !s.issues.includes("non_show") && s.start && s.end;
  function upcoming(days = 60) {
    const end = addDays(today, days);
    return DATA.shows.shows.filter(s => isShow(s) && s.end >= today && s.start <= end);
  }
  function renderChips() {
    const counts = {};
    upcoming().forEach(s => counts[s.venue] = (counts[s.venue] || 0) + 1);
    const order = Object.keys(DATA.venues.venues).filter(v => counts[v]);
    $("#venueChips").innerHTML = [`<button class="chip ${state.venue === "all" ? "is-on" : ""}" data-v="all">${T("all")}</button>`]
      .concat(order.map(v => `<button class="chip ${state.venue === v ? "is-on" : ""}" data-v="${v}">${venueName(v)} <span class="small">${counts[v]}</span></button>`)).join("");
    $$("#venueChips .chip").forEach(b => b.onclick = () => { state.venue = b.dataset.v; renderSchedule(); });
  }
  const venueClass = v => ({ "KSPO DOME": "v-dome", "핸드볼경기장": "v-hand", "올림픽홀": "v-hall", "우리금융아트홀": "v-art", "K-아트홀": "v-art", "뮤즈라이브": "v-hall" }[v] || "v-other");
  function renderToday() {
    const el = $("#todayStrip"); if (!el) return;
    const todays = DATA.shows.shows.filter(s => isShow(s) && s.start <= today && s.end >= today && (!detailOf(s) || !detailOf(s).sessionDays.length || detailOf(s).sessionDays.includes(today)));
    const nextBig = DATA.shows.shows.filter(s => isShow(s) && s.big && s.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0];
    const wd = DATA.weather && DATA.weather.days && DATA.weather.days[today];
    const tile = (k, v, wrap) => `<div class="t"><div class="k">${k}</div><div class="v ${wrap ? "wrap2" : ""}">${v}</div></div>`;
    el.innerHTML = tile(T("todayShows"), todays.length ? `${T("countShows")(todays.length)} · ${esc(todays.map(s => showTitle(s)).join(", "))}` : T("todayNone"), true)
      + (nextBig ? tile(T("nextBig"), `${fmtDate(Math.max(nextBig.start, today) === today ? today : nextBig.start)} · ${venueName(nextBig.venue)}<br><span class="muted small">${esc(showTitle(nextBig))}</span>`, true) : "")
      + (wd ? tile(T("todayWx"), `${wd.rainHours.length ? T("wxRainH")(+wd.rainHours[0]) : T("wxDry")} · ${T("wxPop")(wd.popMax ?? 0)}${wd.tmin != null ? ` · ${wd.tmin}~${wd.tmax}℃` : ""}`, true) : "");
  }
  function renderSources() {
    $("#footSources").innerHTML = `<h4>${T("sourcesH")}</h4><ul>${T("sources").map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("")}</ul><p><a href="https://github.com/giovinazo/olpark-guide" target="_blank" rel="noopener">${esc(T("repo"))}</a></p><p class="small muted">${esc(T("license"))}</p>`;
  }
  function renderSchedule() {
    renderChips();
    const list = upcoming().filter(s => state.venue === "all" || s.venue === state.venue);
    const byDay = {};
    const limitIso = addDays(today, 60);
    list.forEach(s => {
      const det = detailOf(s);
      if (det && det.sessionDays.length) {  // 회차가 있는 날만 (준비·철거일 제외)
        det.sessionDays.filter(k => k >= today && k <= limitIso).forEach(k => (byDay[k] = byDay[k] || []).push(s));
        return;
      }
      for (let k = s.start > today ? s.start : today; k <= s.end && k <= limitIso; k = addDays(k, 1)) (byDay[k] = byDay[k] || []).push(s);
    });
    const keys = Object.keys(byDay).sort();
    if (!keys.length) { $("#scheduleList").innerHTML = `<div class="empty">${T("noUpcoming")}</div>`; $("#scheduleNote").textContent = ""; return; }
    $("#scheduleList").innerHTML = keys.map(k => `<div class="day ${k === today ? "today" : ""} ${dayKind(k)}">${fmtDate(k)}${k === today ? `<span class="pill">${T("today")}</span>` : ""}</div>` +
      byDay[k].sort((a, b) => (b.big - a.big) || a.title.localeCompare(b.title)).map(s => { const det = detailOf(s); const times = timesOn(s, k); return `
      <article class="show">
        <div>
          <p class="title">${times.map(t => `<span class="time">${t}</span>`).join(" ")}${times.length ? " " : ""}${esc(showTitle(s))}</p>
          ${subTitle(s) ? `<p class="sub muted small">${esc(subTitle(s))}</p>` : ""}
          <div class="meta">
            <span class="venue ${venueClass(s.venue)}">${venueName(s.venue)}</span>
            <span>${fmtDate(s.start)}${s.start !== s.end ? ` ~ ${fmtDate(s.end)} · ${s.days}${T("days")}` : ""}</span>
            ${s.durationMin ? `<span>${s.durationMin}${T("min")}</span>` : ""}
            ${s.big ? `<span class="tag big">${T("bigShow")}</span>` : ""}
            ${!times.length ? `<span class="tag" title="${esc(det ? det.timeRaw : "")}">${T("timeUnknown")}</span>` : ""}
            ${hasErr(det) ? `<span class="tag warn" title="${esc(det.checks.filter(c => ERR_KINDS.includes(c.kind)).map(c => `${T("sessIssue")[c.kind] || c.kind}: ${c.text}${c.fix ? ` → ${c.fix}` : ""}`).join(" / "))}">${T("timeCheck")}</span>` : ""}
            ${s.issues.includes("venue_variant") ? `<span class="tag warn" title="${esc(s.venueRaw)}">${T("venueFixed")}: ${esc(s.venueRaw)}</span>` : ""}
          </div>
        </div>
        <div class="acts">
          <button class="btn primary" data-fc="${k}|${s.venue}|${hourBefore(times)}">${T("forecastBtn")}</button>
          ${(() => { const e = enOf(s); const u = lang === "en" && e && e.ticket ? e.ticket : (det && det.booking); return u ? `<a class="btn" href="${esc(u)}" target="_blank" rel="noopener">${T("booking")}${lang === "en" && e && e.ticket ? " (EN)" : ""}</a>` : ""; })()}
          ${s.url ? `<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">${T("official")}</a>` : ""}
        </div>
      </article>`; }).join("")).join("");
    $$("#scheduleList [data-fc]").forEach(b => b.onclick = () => { const [d, v, h] = b.dataset.fc.split("|"); state.fc.date = d; state.fc.venue = v; state.fc.hour = +h || 17; state.fc.rainMode = "auto"; syncForecastForm(); location.hash = "#forecast"; showTab("forecast"); });
    const n = new Set(list.map(s => s.id)).size;
    $("#scheduleNote").textContent = lang === "ko" ? `${fmtDate(today)}부터 60일 안의 공연 ${n}건. 공연 자료 갱신 ${DATA.shows.updated}(한국 시각)` : `${n} shows within 60 days from ${fmtDate(today)}. Data updated ${DATA.shows.updated} (KST)`;
  }

  /* ---------- 2. 예보 ---------- */
  function dayKind(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (DATA.holidaySet.has(dateStr.replace(/-/g, "")) || d.getDay() === 0) return "sun";
    return d.getDay() === 6 ? "sat" : "wd";
  }
  function bigShowsOn(dateStr) { return DATA.shows.shows.filter(s => isShow(s) && s.big && s.start <= dateStr && s.end >= dateStr); }
  /* 모델 v1: 기준[요일구분][시] × 공연효과[시작까지 남은 시간] × 비효과 × 월보정 → [예상 입차, 수준, 표본 시간, 근거] */
  function bigStartsOn(dateStr) {
    const kind = dayKind(dateStr);
    const starts = bigShowsOn(dateStr).flatMap(s => timesOn(s, dateStr)).map(t => +t.slice(0, 2));
    return starts.length ? starts : (bigShowsOn(dateStr).length ? [DATA.model.defaultStart[kind]] : []);
  }
  function monthThresholds(dateStr) { const m = DATA.model, f = m.monthFactor[+dateStr.slice(5, 7) - 1] || 1; return Object.values(m.thresholds).map(x => Math.round(x * f)); }
  function lookup(dateStr, hour, big, rain) {
    const m = DATA.model, kind = dayKind(dateStr);
    const base = m.base[kind][hour], n = m.baseN[kind][hour];
    let v = base, showF = 1, off = null, bin = "";
    if (big) {
      const starts = bigStartsOn(dateStr);
      if (starts.length) {
        off = starts.map(s => hour - s).sort((a, b) => Math.abs(a) - Math.abs(b))[0];
        const i = m.showEffect.lo.findIndex((lo, j) => off >= lo && off <= m.showEffect.hi[j]);
        if (i >= 0) { showF = m.showEffect.factor[i]; bin = m.showEffect.bins[i]; v *= showF; }  // 시작 6시간 넘게 이른 시각은 효과 없음
      }
    }
    const rainF = rain ? m.rainEffect : 1;
    const monthF = m.monthFactor[+dateStr.slice(5, 7) - 1] || 1;
    v = v * rainF * monthF;
    const th = monthThresholds(dateStr);  // v1.2: 경계에도 월 보정
    const r = Math.round(v), lv = r >= th[2] ? 3 : r >= th[1] ? 2 : r >= th[0] ? 1 : 0;
    return [r, lv, n, { base: Math.round(base), showF, off, bin, rainF, monthF }];
  }
  function syncForecastForm() {
    $("#fcDate").value = state.fc.date; $("#fcHour").value = state.fc.hour; $("#fcVenue").value = state.fc.venue;
    $$("#fcForm [data-rain]").forEach(b => b.classList.toggle("is-on", +b.dataset.rain === state.fc.rain));
    const w = wxAt(state.fc.date, state.fc.hour);
    $("#fcSeg").hidden = !!w; $("#fcWx").hidden = !w; $("#fcWxNote").hidden = !!w;
    $("#fcWxNote").textContent = T("wxNoFc");
    $("#fcWxLabel").textContent = T(w ? "wxLabelFc" : "wxLabelPick");
    if (w) { const k = wxKind(w), nm = T("wxKind")[k]; $("#fcWx").innerHTML = `${wxIcon(k, nm)}<span><b>${nm}</b>${w.tmp != null ? ` ${w.tmp}℃` : ""}<small>${T("wxBasis")(w.pop ?? "-")}</small></span>`; }
  }
  function initForecastForm() {
    $("#fcHour").innerHTML = [...Array(24)].map((_, h) => `<option value="${h}">${pad(h)}:00</option>`).join("");
    $("#fcVenue").innerHTML = Object.keys(DATA.venues.venues).filter(v => !["미상", "옥외·기타"].includes(v)).map(v => `<option value="${v}">${venueName(v)}</option>`).join("");
    $("#fcDate").min = "2024-01-01";
    syncForecastForm();
    $("#fcDate").onchange = e => { state.fc.date = e.target.value || today; state.fc.rainMode = "auto"; renderForecast(); };
    $("#fcHour").onchange = e => { state.fc.hour = +e.target.value; renderForecast(); };
    $("#fcVenue").onchange = e => { state.fc.venue = e.target.value; renderForecast(); };
    $$("#fcForm [data-rain]").forEach(b => b.onclick = () => { state.fc.rain = +b.dataset.rain; state.fc.rainMode = "manual"; syncForecastForm(); renderForecast(); });
  }
  function renderForecast() {
    autoRain(); syncForecastForm();
    const { date, hour, venue, rain } = state.fc;
    const wx = wxAt(date, hour);
    const wxLine = (() => {
      if (!DATA.weather) return "";
      if (!wx) return `<p class="why">${T("wxNone")(Object.keys(DATA.weather.days || {}).sort().pop() || "")}</p>`;
      const pty = T("pty")[wx.pty || 0] || "";
      return `<p class="why">${T("wxLine")(DATA.weather.base, wx.pop ?? "-", pty, wx.tmp)}${state.fc.rainMode === "manual" ? ` · ${T("wxManual")}` : ""}</p>`;
    })();
    const bigs = bigShowsOn(date);
    const big = bigs.length > 0;
    const [n, lv, cnt, basis] = lookup(date, hour, big, rain);
    const lvName = (lang === "ko" ? DATA.model.levels : DATA.model.levelsEn)[lv];
    const basisTxt = T("basisV1")(basis, +date.slice(5, 7));
    $("#fcResult").innerHTML = `
      <div class="level l${lv}">${lvName}<small>${T("expected")(n)}</small></div>
      <div>
        <p class="big">${fmtDate(date)} ${pad(hour)}:00 · ${T("dayKind")[dayKind(date)]}${rain ? ` · ${T("forecast.rainy")}` : ""}</p>
        <p class="tip">${T("levelTip")[lv]}</p>
        <p class="why">${T("basis")(cnt, basisTxt)}</p>
        <p class="why">${big ? T("bigOn")(bigs.map(s => { const t = timesOn(s, date); return `${venueName(s.venue)}(${esc(s.title)}${t.length ? `, ${t.join("·")}` : ""})`; }).join(", ")) : T("bigOff")}</p>
        ${(() => { const t = [...new Set(DATA.shows.shows.filter(s => isShow(s) && s.venue === venue && s.start <= date && s.end >= date).flatMap(s => timesOn(s, date)))].sort(); return t.length ? `<p class="why">${T("startAt")(venueName(venue), t.join(" · "))}</p>` : ""; })()}
        ${wxLine}
      </div>`;
    const lvNamesAll = lang === "ko" ? DATA.model.levels : DATA.model.levelsEn;
    const dayWx = !!(DATA.weather && DATA.weather.hours && DATA.weather.hours[date]);
    $("#fcWxRow").innerHTML = dayWx ? [...Array(24)].map((_, h) => { const w = wxAt(date, h); return `<span>${w ? wxIcon(wxKind(w), T("wxKind")[wxKind(w)]) : ""}</span>`; }).join("") : "";
    $("#fcWxRow").hidden = !dayWx;
    $("#fcStrip").innerHTML = [...Array(24)].map((_, h) => { const rh = dayWx ? ((wxAt(date, h) || {}).rain ?? 0) : rain; const r = lookup(date, h, big, rh); return `<div class="l${r[1]} ${h === hour ? "sel" : ""}" role="button" tabindex="0" aria-pressed="${h === hour}" aria-label="${pad(h)}:00 · ${lvNamesAll[r[1]]} · ${r[0]}${rh ? " ☂" : ""}"></div>`; }).join("");
    $("#fcTicks").innerHTML = [...Array(24)].map((_, h) => `<span class="${h === hour ? "on" : ""}">${h % 3 === 0 || h === hour ? h : ""}</span>`).join("");
    $("#fcReadout").innerHTML = `<b>${pad(hour)}:00</b><span class="lv l${lv}">${lvName}</span><span>${T("expected")(n)}</span>${wx ? `<span class="rwx">${wxIcon(wxKind(wx), T("wxKind")[wxKind(wx)])}${T("wxKind")[wxKind(wx)]}${wx.tmp != null ? ` ${wx.tmp}℃` : ""}</span>` : rain ? `<span class="rwx">${wxIcon("rain", T("forecast.rainy"))}${T("forecast.rainy")} (${T("wxPicked")})</span>` : ""}`;
    $("#stripTitle").textContent = T("stripTitle"); $("#stripHint").textContent = T("stripHint") + (dayWx ? T("stripHintWx") : "");
    const th = monthThresholds(date);
    const lvNames = lang === "ko" ? DATA.model.levels : DATA.model.levelsEn;
    $("#fcLegend").innerHTML = lvNames.map((nm, i) => `<span><i class="l${i}"></i>${T("legendLv")(nm, i === 0 ? null : th[i - 1], i < th.length ? th[i] - 1 : null)}</span>`).join("");
    $$("#fcStrip div").forEach((el, h) => {
      const pick = () => { state.fc.hour = h; syncForecastForm(); renderForecast(); $$("#fcStrip div")[h].focus({ preventScroll: true }); };
      el.onclick = pick; el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
    });
    const v = DATA.venues.venues[venue] || {};
    $("#fcParking").innerHTML = `<h3>${T("parkingH")} · ${venueName(venue)}</h3>` + (v.lot ? `<dl class="kv">
      <dt>${T("lot")}</dt><dd>${esc(v.lot)}</dd><dt>${T("spaces")}</dt><dd>${v.lotSpaces ?? "-"}</dd>
      ${v.walk ? `<dt>${T("walk")}</dt><dd>${esc(v.walk)}</dd>` : ""}
      <dt>${T("gates")}</dt><dd>${(v.gates || []).join(" · ")}</dd><dt>${T("hours")}</dt><dd>${DATA.venues.parkingHours}</dd>
      <dt>${T("feeH")}</dt><dd>${esc(DATA.venues.fee.small)}</dd></dl>` : `<p class="muted">${T("noLot")}</p>`) + `<p class="small"><a href="https://www.ksponco.or.kr/online/main/parking.do" target="_blank" rel="noopener">${T("liveLink")}</a></p>`;
    $("#fcTransit").innerHTML = `<h3>${T("transitH")}</h3><ul class="plain">` + DATA.venues.subway.map(s => { const e = lang === "en" ? s.en : s; return `<li><b>${esc(e.line)} ${esc(e.station)}</b>${e.exit ? ` ${esc(e.exit)}` : ""} ${T("toward")} ${esc(e.gate)}</li>`; }).join("") + `</ul>`;
    $("#fcTips").innerHTML = `<h3>${T("tipsH")}</h3><ul class="plain">` + DATA.venues.alternatives.map(a => `<li>${esc(a[lang])}</li>`).join("") + `</ul>`;
    const m = DATA.model, val = m.validation || {};
    $("#fcModel").innerHTML = `<h3>${T("modelH")}</h3><ul class="plain">${T("modelNotes")(m, val).map(s => `<li>${s}</li>`).join("")}</ul>`;
  }

  /* ---------- 3. 점검판 ---------- */
  function renderQuality() {
    const q = DATA.quality;
    $("#qStats").innerHTML = [
      [q.total.toLocaleString(), T("statTotal")], [`${q.clean.toLocaleString()} <span class="small muted">(${Math.round(q.clean / q.total * 100)}%)</span>`, T("statClean")],
      [`${q.recent.clean} / ${q.recent.total}`, T("statRecent")], [q.rawVenueKinds, T("statVenueRaw")],
    ].map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
    const order = ["venue_variant", "venue_blank", "venue_unmatched", "duration_blank", "duration_unparsed", "duplicate", "non_show", "period_unparsed"];
    $("#qIssues").innerHTML = `<h3>${T("issuesH")}</h3><table><tr><th></th><th class="num">${lang === "ko" ? "전체" : "All"}</th><th class="num">${lang === "ko" ? "2024년 이후" : "Since 2024"}</th></tr>` +
      order.filter(k => q.counts[k]).map(k => `<tr><td>${T("issue")[k]}</td><td class="num">${(q.counts[k] || 0).toLocaleString()}</td><td class="num">${(q.recent.counts[k] || 0).toLocaleString()}</td></tr>`).join("") + `</table>`;
    $("#qVariants").innerHTML = `<h3>${T("variantsH")}</h3><table><tr><th>${T("raw")}</th><th>${T("canonical")}</th><th class="num">${T("count")}</th></tr>` +
      q.recent.venueVariants.map(v => `<tr><td>${esc(v.raw)}</td><td>${venueName(v.canonical)}</td><td class="num">${v.n}</td></tr>`).join("") + `</table>`;
    $("#qNotes").innerHTML = `<ul class="plain">${T("qNotes").map(s => `<li>${s}</li>`).join("")}</ul>`;
    renderSessions();
  }
  function renderSessions() {
    const by = Object.values((DATA.details || {}).bySeq || {});
    if (!by.length) { $("#qSessions").innerHTML = ""; return; }
    const withS = by.filter(d => d.sessions.length).length;
    const blank = by.filter(d => d.checks.some(c => c.kind === "time_blank" || c.kind === "time_tbd")).length;
    const errs = by.flatMap(d => d.checks.filter(c => LIST_KINDS.includes(c.kind)).map(c => ({ d, c }))).sort((a, b) => b.d.period.localeCompare(a.d.period));
    const nErr = new Set(errs.map(e => e.d.seq)).size;
    const stat = (n, l) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`;
    $("#qSessions").innerHTML = `<h3>${T("sessionsH")}</h3><p class="muted small">${T("sessionsSub")}</p>
      <div class="stats">${stat(by.length, T("sessRead"))}${stat(`${withS} <span class="small muted">(${Math.round(withS / by.length * 100)}%)</span>`, T("sessGot"))}${stat(blank, T("sessBlank"))}${stat(nErr, T("sessErr"))}</div>
      <table><tr><th>${T("sessShow")}</th><th>${T("sessRaw")}</th><th>${T("sessProblem")}</th><th>${T("sessFix")}</th></tr>` +
      errs.map(({ d, c }) => `<tr><td>${esc(d.title.slice(0, 28))}${d.title.length > 28 ? "…" : ""}<div class="small muted">${esc(d.period)}</div></td><td>${esc(c.text)}</td><td>${T("sessIssue")[c.kind] || c.kind}</td><td>${esc(c.fix || "")}</td></tr>`).join("") +
      `</table><p class="muted small">${T("sessNote")}</p>`;
    renderTitlesEn();
  }
  function renderTitlesEn() {
    const te = DATA.titles_en;
    if (!te) { $("#qTitles").innerHTML = ""; return; }
    const all = Object.values(te.byId).concat(te.unmatched || []);
    const koOnEn = all.filter(x => x.date >= "2026-01-01" && /[가-힣]/.test(x.en) && !/[A-Za-z]{3,}/.test(x.en));
    const byDate = Object.values(te.byId).filter(x => x.how === "date").length;
    const stat = (n, l) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`;
    $("#qTitles").innerHTML = `<h3>${T("titlesH")}</h3><p class="muted small">${T("titlesSub")}</p>
      <div class="stats">${stat(te.items, T("teItems"))}${stat(`${te.linked} <span class="small muted">(${Math.round(te.linked / te.items * 100)}%)</span>`, T("teLinked"))}${stat(`${te.upcoming.linked} / ${te.upcoming.total}`, T("teUpcoming"))}${stat(koOnEn.length, T("teKoOnEn"))}</div>
      ${koOnEn.length ? `<table><tr><th>${T("teDate")}</th><th>${T("teTitle")}</th></tr>${koOnEn.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(x => `<tr><td class="num">${x.date}</td><td>${esc(x.en)}</td></tr>`).join("")}</table>` : ""}
      <p class="muted small">${T("teNote")(byDate)}</p>`;
    renderFiles();
  }
  function renderFiles() {
    const f = DATA.files_check; const el = $("#qFiles");
    if (!f || !el) { if (el) el.innerHTML = ""; return; }
    const c = f.congestion, mo = f.monthly;
    const stat = (n, l) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`;
    el.innerHTML = `<h3>${T("filesH")}</h3><p class="muted small">${T("filesSub")}</p>
      <div class="stats">${stat(c.rows.toLocaleString(), T("fcRows"))}${stat(`${c.timeMinSecEqualsMonthDay.toLocaleString()} <span class="small muted">(${Math.round(c.timeMinSecEqualsMonthDay / c.rows * 100)}%)</span>`, T("fcTimeBug"))}${stat(c.distinctDays, T("fcDays"))}${stat(mo.ratioGateToMonthly ? `1 : ${mo.ratioGateToMonthly}` : "-", T("fcRatio"))}</div>
      <ul class="plain"><li>${esc(lang === "ko" ? c.finding : T("fcFindingEn"))}</li>${c.showDays ? `<li>${esc(lang === "ko" ? c.showDays.finding : sdNote("en"))}</li>` : ""}<li>${esc(lang === "ko" ? mo.finding : T("moFindingEn"))}</li></ul>`;
  }

  function sdNote(l) {  // 기관 혼잡도 자료(15164156)와 대형 공연일 대조 결과 한 줄(scripts/check_files.py)
    const sd = DATA.files_check && DATA.files_check.congestion && DATA.files_check.congestion.showDays;
    if (!sd) return "";
    const w = sd.weekend_big, wo = sd.weekend_other, d = sd.weekday_big, dn = sd.weekday_other;
    return l === "ko"
      ? `기관 주차장 혼잡도 자료(${sd.all_big.days + sd.all_other.days}일)와 대조: 주말·공휴일 만차 비율은 대형 공연일 ${w.fullPct}%(${w.days}일)와 그 밖 ${wo.fullPct}%(${wo.days}일)로 차이가 없고, 평일은 대형 공연일이 ${d.days}일(${d.fullPct}%, 그 밖 ${dn.fullPct}%)뿐이라 공연 효과를 이 자료로 따로 확인하지 못했습니다.`
      : `Check against the agency's parking congestion file (${sd.all_big.days + sd.all_other.days} days): on weekends and holidays the share of "full" entries is ${w.fullPct}% on major-show days (${w.days} days) and ${wo.fullPct}% on other days (${wo.days} days), no difference; only ${d.days} weekdays had major shows (${d.fullPct}% vs ${dn.fullPct}%), so this file cannot confirm the show effect on its own.`;
  }

  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function renderAll() { applyI18n(); renderToday(); renderSchedule(); initForecastForm(); renderForecast(); renderQuality(); renderSources(); const age = Date.now() - Date.parse((DATA.shows.updated || "").replace(" ", "T") + ":00+09:00"); $("#footSource").textContent = T("source")(DATA.shows.updated) + (age > 36 * 36e5 ? T("stale") : ""); }

  load().then(() => {
    try {  // 깊은 링크: ?date=2026-11-14&hour=16&venue=KSPO%20DOME (시연·캡처용)
      const q = new URLSearchParams(location.search);
      const qd = q.get("date") || "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(qd) && addDays(qd, 0) === qd) { state.fc.date = qd; state.fc.rainMode = "auto"; }  // 없는 날짜(2월 30일 등)는 버림
      if (/^\d{1,2}$/.test(q.get("hour") || "")) state.fc.hour = Math.min(23, +q.get("hour"));  // 0~23 정수만
      if (q.get("venue") && DATA.venues.venues[q.get("venue")]) state.fc.venue = q.get("venue");
      if (q.get("lang") === "en" || q.get("lang") === "ko") lang = q.get("lang");
      if (!location.hash && (q.has("date") || q.has("hour") || q.has("venue"))) history.replaceState(null, "", location.pathname + location.search + "#forecast");  // 예보 값을 준 주소는 예보 탭으로
    } catch (e) {}
    renderAll();
    $("#langBtn").onclick = () => { lang = lang === "ko" ? "en" : "ko"; try { localStorage.setItem("olpark.lang", lang); } catch (e) {} renderAll(); };
    $$(".tab").forEach(t => t.onclick = e => { e.preventDefault(); location.hash = "#" + t.dataset.tab; showTab(t.dataset.tab); });
    const fromHash = () => { const h = location.hash.replace("#", ""); if (["schedule", "forecast", "quality"].includes(h)) showTab(h); };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }).catch(err => { $("main").innerHTML = `<div class="empty">자료를 불러오지 못했습니다. ${esc(err.message)}</div>`; });
})();
