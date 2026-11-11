/* 올림픽공원 공연·주차 길잡이 v0 */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = iso(new Date());

  const I18N = {
    ko: {
      brand: "올림픽공원 공연·주차 길잡이", tagline: "공연 일정 표준화 · 시간대별 주차 혼잡 예보 · 데이터 점검", "tab.schedule": "공연 일정", "tab.forecast": "주차 혼잡 예보", "tab.quality": "데이터 점검판",
      todayShows: "오늘 공연", todayNone: "오늘은 공연이 없습니다", nextBig: "다음 대형 공연", todayWx: "오늘 날씨(기상청)", wxRainH: h => `비 ${h}시부터`, wxDry: "비 소식 없음", wxPop: p => `강수확률 최고 ${p}%`, countShows: n => `${n}건`,
      levelTip: ["주차장 여유가 있는 시간대입니다.", "평소 수준입니다. 공연장 옆 주차장이 차면 P1·P2로 돌리십시오.", "공연장 옆 주차장이 찰 가능성이 큽니다. 30분 일찍 오거나 P1(562대)을 바로 이용하십시오.", "주차장 진입 도로까지 막히는 시간대입니다. 지하철(5·9호선 올림픽공원역) 이용을 권합니다."],
      stripTitle: "시간대별 수준(0~23시)", stripHint: "막대를 누르면 그 시각으로 바뀝니다. 흰 점은 비 예보", legendLv: (name, lo, hi) => `${name} ${lo == null ? `~${hi}대` : hi == null ? `${lo}대 이상` : `${lo}~${hi}대`}/시간`,
      sourcesH: "활용 데이터", sources: [
        ["한국체육산업개발(주) 올림픽공원 입출차 정보(2024년 7월)", "https://www.data.go.kr/data/15138735/fileData.do"],
        ["한국체육산업개발(주) 올림픽공원 영문 공연정보", "https://www.data.go.kr/data/15149169/fileData.do"],
        ["한국체육산업개발(주) 올림픽공원 주차장 혼잡도 정보·월별 주차현황", "https://www.data.go.kr/data/15164156/fileData.do"],
        ["한국문화정보원 문화 공공데이터광장 통합 공연정보(API_CCA_144) 중 한국체육산업개발(주) 분", "https://www.culture.go.kr/data/openapi/openapiList.do"],
        ["기상청 단기예보 조회서비스(올림픽공원 격자 62·126)", "https://www.data.go.kr/data/15084084/openapi.do"],
        ["기상청 지상(종관, ASOS) 시간자료(서울 108, 모델 추정용)", "https://www.data.go.kr/data/15057210/openapi.do"],
        ["한국천문연구원 특일 정보(공휴일)", "https://www.data.go.kr/data/15012690/openapi.do"],
        ["올림픽공원 누리집 공연 일정안내·주차 안내(회차 시각·주차장 위치)", "https://www.ksponco.or.kr/olympicpark/"],
      ],
      "schedule.title": "다가오는 공연", "schedule.sub": "공공데이터의 공연장 이름을 하나로 맞추고 기간을 날짜별로 풀어 보여 줍니다.",
      "forecast.title": "주차 혼잡 예보", "forecast.sub": "요일·시간·대형 공연 유무·비로 그 시간대 들어오는 차량 수준을 예상합니다. 2024년 7월 입출차 21만 5천 건을 기준으로 추정했습니다.",
      "forecast.date": "날짜", "forecast.hour": "시각", "forecast.venue": "공연장", "forecast.rain": "비 예보", "forecast.clear": "맑음", "forecast.rainy": "비",
      "quality.title": "데이터 점검판", "quality.sub": "서비스가 공연 자료를 받을 때 자동으로 걸러 낸 항목입니다. 표기 통일과 빈칸 보완이 필요한 곳을 보여 줍니다.",
      "foot.disclaimer": "예보는 과거 입출차 기록으로 추정한 값이며 실제 주차 가능 대수와 다를 수 있습니다. 공연 정보는 기관 누리집 원문을 확인하십시오.",
      all: "전체", today: "오늘", days: "일간", min: "분", official: "기관 안내", forecastBtn: "주차 예보", bigShow: "대형 공연", venueFixed: "표기 통일", noUpcoming: "다가오는 공연이 없습니다.",
      upcomingNote: (n, from, to) => `${from}부터 ${to}까지 공연 ${n}건. 자료 갱신 ${""}`,
      expected: n => `예상 입차 ${n}대/시간`, basis: (n, b) => `표본 ${n}시간 · ${b}`, basisD: "같은 조건 평균", basisR: "비 구분 없이 평균", basisS: "공연 구분 없이 평균",
      bigOn: v => `이날 ${v} 공연이 있어 공연 수요를 더했습니다.`, bigOff: "이날 대형 공연장(KSPO DOME·핸드볼경기장) 공연이 없습니다.",
      dayKind: { wd: "평일", sat: "토요일", sun: "일요일·공휴일" },
      parkingH: "가까운 주차장", lot: "주차장", spaces: "대수", walk: "걸어서", gates: "진입 출입문", hours: "운영 시간", feeH: "요금", noLot: "이 공연장은 주차장 안내가 없습니다. P1(562대)을 이용하십시오.",
      transitH: "대중교통", exit: "출구", toward: "→", tipsH: "공연일 안내",
      wxLine: (base, pop, pty, tmp) => `기상청 단기예보(${base} 발표): 강수확률 ${pop}%${pty ? ` · ${pty}` : ""}${tmp != null ? ` · ${tmp}℃` : ""}. 비 여부를 예보로 채웠습니다.`,
      wxManual: "직접 고른 값으로 계산 중(날짜를 바꾸면 예보로 돌아감)", wxNone: last => `기상청 단기예보 범위(${last}까지) 밖이라 비 여부는 직접 고르십시오.`,
      pty: { 0: "", 1: "비", 2: "비 또는 눈", 3: "눈", 4: "소나기" },
      timeUnknown: "시각 미확인", timeCheck: "시각 표기 점검", booking: "예매", startAt: (v, t) => `${v} 공연 시작 ${t}. 2024년 7월 기록에서는 시작 2~3시간 전부터 입차가 늘었습니다.`,
      sessionsH: "회차 시각 점검(기관 누리집 상세 글)", sessionsSub: "공공데이터에는 회차별 시작 시각이 없어 기관 누리집 공연 상세 글의 \"시간\" 칸을 읽어 날짜별 시각으로 표준화하고 표기 오류를 점검합니다. 2026년 이후 공연 전부와 다가오는 공연을 매일 다시 읽습니다.",
      sessRead: "읽은 상세 글", sessGot: "시각 확보", sessBlank: "빈칸·추후 공지", sessErr: "표기 오류", sessShow: "공연", sessRaw: "원문", sessProblem: "문제", sessFix: "정정안",
      sessIssue: { date_outside: "날짜가 공연 기간 밖(월 오기 추정)", weekday_mismatch: "요일이 날짜와 다름", weekday_blank: "요일 빈칸", time_format: "시각 표기 불완전('시' 누락)", time_leftover: "해석 못 한 시각 표기", time_unparsed: "시각 해석 불가", date_invalid: "없는 날짜", period_mismatch: "공공데이터와 누리집 기간 불일치", time_blank: "시각 빈칸", time_tbd: "추후 공지", partial_days: "기간 중 일부 날만 회차", note: "비고", page_error: "누리집 상세 글 열리지 않음(서버 오류)" },
      sessNote: "오류로 잡힌 글은 화면에 '시각 표기 점검' 꼬리표를 붙이고, 정정안이 있으면 정정안 날짜로 회차를 잡습니다. 원문은 기관 누리집에서 확인하십시오.",
      titlesH: "영문 제목 연결(기관 영문 게시판)", titlesSub: "개방 데이터 '영문 공연정보'(15149169)의 원천인 기관 영문 누리집 Culture Info 게시판을 읽어, 공연정보와 날짜·제목 낱말 겹침으로 짝을 짓습니다. 영어 화면에서는 이 제목과 외국인용 예매처 링크를 씁니다.",
      teItems: "영문 게시판 글", teLinked: "공연정보와 연결", teUpcoming: "다가오는 공연 연결", teKoOnEn: "영문 글인데 한국어 제목(2026년~)", teDate: "날짜", teTitle: "영문 게시판 제목 그대로",
      teNote: n => `제목 낱말이 안 겹치면 시작일이 같은 공연이 하나뿐일 때만 날짜로 연결합니다(${n}건, 점수 0.2). 한국어 제목 그대로인 영문 글은 외국인 관람객이 검색하지 못하는 항목입니다.`,
      statTotal: "전체 공연 자료", statClean: "문제 없는 자료", statRecent: "2024년 이후", statVenueRaw: "공연장 표기 종류",
      issuesH: "자동 점검 결과", variantsH: "공연장 표기 통일(2024년 이후)", raw: "원문 표기", canonical: "표준명", count: "건",
      issue: { venue_variant: "공연장 표기가 표준명과 다름", venue_blank: "공연장 빈칸·자리표", venue_unmatched: "공연장 판별 불가", non_show: "공연이 아닌 항목(대관 준비·예약 자리표)", duration_blank: "공연 시간 빈칸·자리표", duration_unparsed: "공연 시간 해석 불가", duplicate: "같은 제목·기간 중복 등록", period_unparsed: "기간 해석 불가" },
      qNotes: ["공연 자료는 문화 공공데이터광장 통합 공연정보(API_CCA_144)에서 한국체육산업개발(주) 분만 받아 매일 새로 만듭니다.", "표준 공연장 10종은 기관 누리집 일정안내의 공연장 구분을 따릅니다.", "공연이 아닌 항목은 2013~2015년 대관 시스템 자리표이며 화면의 일정에서는 제외합니다."],
      source: (u) => `자료: 한국체육산업개발(주) 개방 공공데이터(공연정보·입출차·주차 안내), 한국문화정보원 통합 공연정보, 기상청 지상관측, 한국천문연구원 특일 정보 · 공연 자료 갱신 ${u}`,
    },
    en: {
      brand: "Olympic Park Show & Parking Guide", tagline: "Unified show schedule · hourly parking forecast · data check", "tab.schedule": "Shows", "tab.forecast": "Parking forecast", "tab.quality": "Data check",
      todayShows: "Shows today", todayNone: "No shows today", nextBig: "Next major show", todayWx: "Weather today (KMA)", wxRainH: h => `Rain from ${h}:00`, wxDry: "No rain expected", wxPop: p => `max rain chance ${p}%`, countShows: n => `${n}`,
      levelTip: ["Parking is easy at this hour.", "Normal level. If the lot next to the venue is full, use P1 or P2.", "The lot next to the venue will likely fill up. Arrive 30 minutes early or go straight to P1 (562 spaces).", "Roads to the parking gates jam at this hour. Take the subway (Olympic Park Station, Lines 5 and 9)."],
      stripTitle: "Level by hour (0 to 23)", stripHint: "Tap a bar to pick that hour. White dot = rain forecast", legendLv: (name, lo, hi) => `${name} ${lo == null ? `up to ${hi}` : hi == null ? `${lo}+` : `${lo} to ${hi}`} cars/h`,
      sourcesH: "Data sources", sources: [
        ["KSPO&CO Olympic Park gate records (July 2024)", "https://www.data.go.kr/data/15138735/fileData.do"],
        ["KSPO&CO Olympic Park English show information", "https://www.data.go.kr/data/15149169/fileData.do"],
        ["KSPO&CO Olympic Park parking congestion and monthly parking", "https://www.data.go.kr/data/15164156/fileData.do"],
        ["KCISA Culture Public Data Plaza integrated performance API (API_CCA_144), KSPO&CO records", "https://www.culture.go.kr/data/openapi/openapiList.do"],
        ["KMA short-term forecast (Olympic Park grid 62, 126)", "https://www.data.go.kr/data/15084084/openapi.do"],
        ["KMA ASOS hourly observations (Seoul 108, for the model)", "https://www.data.go.kr/data/15057210/openapi.do"],
        ["KASI public holidays", "https://www.data.go.kr/data/15012690/openapi.do"],
        ["Olympic Park website schedule and parking pages (showtimes, lot locations)", "https://www.ksponco.or.kr/olympicpark/"],
      ],
      "schedule.title": "Upcoming shows", "schedule.sub": "Venue names from open data are unified and multi-day runs are expanded by date.",
      "forecast.title": "Parking forecast", "forecast.sub": "Expected inbound traffic by weekday, hour, major show and rain, estimated from 215,528 gate records of July 2024.",
      "forecast.date": "Date", "forecast.hour": "Hour", "forecast.venue": "Venue", "forecast.rain": "Rain", "forecast.clear": "Clear", "forecast.rainy": "Rain",
      "quality.title": "Data check", "quality.sub": "Items the service flagged automatically while loading show data: inconsistent venue names and blanks.",
      "foot.disclaimer": "Forecasts are estimates from past gate records and may differ from actual availability. Check the official page for show details.",
      all: "All", today: "Today", days: "days", min: "min", official: "Official page", forecastBtn: "Parking", bigShow: "Major show", venueFixed: "Name unified", noUpcoming: "No upcoming shows.",
      upcomingNote: (n, from, to) => `${n} shows from ${from} to ${to}.`,
      expected: n => `About ${n} cars entering per hour`, basis: (n, b) => `${n} sample hours · ${b}`, basisD: "same conditions", basisR: "rain ignored", basisS: "shows ignored",
      bigOn: v => `A show at ${v} that day adds concert traffic.`, bigOff: "No show at the two large venues (KSPO DOME, Handball Gymnasium) that day.",
      dayKind: { wd: "Weekday", sat: "Saturday", sun: "Sunday / holiday" },
      parkingH: "Nearest parking", lot: "Lot", spaces: "Spaces", walk: "Walk", gates: "Gates", hours: "Hours", feeH: "Fee", noLot: "No lot listed for this venue. Use P1 (562 spaces).",
      transitH: "Public transport", exit: "Exit", toward: "→", tipsH: "Show-day tips",
      wxLine: (base, pop, pty, tmp) => `KMA short-term forecast (issued ${base}): rain chance ${pop}%${pty ? ` · ${pty}` : ""}${tmp != null ? ` · ${tmp}℃` : ""}. The rain input was filled from the forecast.`,
      wxManual: "using your manual choice (changing the date restores the forecast)", wxNone: last => `Outside the forecast range (through ${last}); choose rain manually.`,
      pty: { 0: "", 1: "rain", 2: "rain or snow", 3: "snow", 4: "showers" },
      timeUnknown: "Time not listed", timeCheck: "Time text check", booking: "Tickets", startAt: (v, t) => `${v} show starts at ${t}. In July 2024 records, inbound traffic rose 2 to 3 hours before showtime.`,
      sessionsH: "Showtime check (official detail pages)", sessionsSub: "Open data has no per-day showtimes, so the service reads the \"time\" field of each official show page, normalises it into dated showtimes and flags text errors. All shows since 2026 plus every upcoming show are re-read daily.",
      sessRead: "Pages read", sessGot: "Showtimes found", sessBlank: "Blank / TBA", sessErr: "Text errors", sessShow: "Show", sessRaw: "As written", sessProblem: "Problem", sessFix: "Suggested fix",
      sessIssue: { date_outside: "Date outside show period (wrong month?)", weekday_mismatch: "Weekday does not match date", weekday_blank: "Weekday blank", time_format: "Incomplete time text", time_leftover: "Unparsed time text", time_unparsed: "Time not parseable", date_invalid: "Invalid date", period_mismatch: "Period differs from open data", time_blank: "Time blank", time_tbd: "To be announced", partial_days: "Showtimes on only some days", note: "Note", page_error: "Official page fails to load (server error)" },
      sessNote: "Flagged pages get a 'Time text check' tag on the schedule; when a fix is suggested, the showtime is placed on the corrected date. Check the official page for the original text.",
      titlesH: "English titles (official English board)", titlesSub: "The open dataset 'English show information' (15149169) is an export of the official English Culture Info board. The service reads that board and pairs each post with a show record by date and title word overlap. The English view uses these titles and the English ticketing links.",
      teItems: "English board posts", teLinked: "Linked to show records", teUpcoming: "Upcoming shows linked", teKoOnEn: "English posts titled only in Korean (2026+)", teDate: "Date", teTitle: "Title as posted on the English board",
      teNote: n => `When no title words overlap, a post is linked by date only if exactly one show starts that day (${n} posts, score 0.2). Korean-only titles on the English board cannot be found by foreign visitors.`,
      statTotal: "Show records", statClean: "Clean records", statRecent: "Since 2024", statVenueRaw: "Venue spellings",
      issuesH: "Automatic checks", variantsH: "Venue name unification (since 2024)", raw: "As written", canonical: "Standard", count: "n",
      issue: { venue_variant: "Venue differs from standard name", venue_blank: "Venue blank / placeholder", venue_unmatched: "Venue not recognised", non_show: "Not a show (booking placeholders)", duration_blank: "Running time blank", duration_unparsed: "Running time unreadable", duplicate: "Duplicate title and period", period_unparsed: "Period unreadable" },
      qNotes: ["Show data is rebuilt daily from the Culture Public Data Plaza integrated performance API (KSPO&CO records only).", "The 10 standard venues follow the venue tabs on the official schedule page.", "Non-show items are 2013-2015 booking placeholders and are hidden from the schedule."],
      source: (u) => `Data: KSPO&CO open data (shows, gate records, parking), KCISA integrated performance API, KMA weather, KASI holidays · shows updated ${u}`,
    },
  };
  let lang = (localStorage.getItem("olpark.lang") || (navigator.language || "ko").startsWith("ko") ? "ko" : "en");
  try { lang = localStorage.getItem("olpark.lang") || lang; } catch (e) {}
  const T = k => I18N[lang][k];

  const DATA = {};
  const state = { venue: "all", fc: { date: today, hour: 17, venue: "KSPO DOME", rain: 0, rainMode: "auto" } };
  /* 기상청 단기예보(3일): 그 시각의 비 여부. 없으면 null */
  function wxAt(dateStr, hour) {
    const w = DATA.weather; if (!w || !w.hours || !w.hours[dateStr]) return null;
    const hs = w.hours[dateStr]; const keys = Object.keys(hs).sort();
    if (!keys.length) return null;
    const k = pad(hour); const pick = hs[k] ? k : (keys.filter(x => x <= k).pop() || keys[0]);  // 지난 시각은 가장 가까운 앞 시각
    const s = hs[pick];
    const rain = (s.pty || 0) !== 0 || (s.pop || 0) >= (w.rule ? w.rule.rainPop : 60);
    return { ...s, hour: pick, rain: rain ? 1 : 0 };
  }
  function autoRain() { if (state.fc.rainMode !== "auto") return; const w = wxAt(state.fc.date, state.fc.hour); if (w) state.fc.rain = w.rain; }

  async function load() {
    const names = ["shows", "model", "venues", "quality", "holidays", "details", "titles_en", "weather"];
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
    const end = iso(new Date(Date.now() + days * 864e5));
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
    $("#footSources").innerHTML = `<h4>${T("sourcesH")}</h4><ul>${T("sources").map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("")}</ul>`;
  }
  function renderSchedule() {
    renderChips();
    const list = upcoming().filter(s => state.venue === "all" || s.venue === state.venue);
    const byDay = {};
    const limitIso = iso(new Date(Date.now() + 60 * 864e5));
    list.forEach(s => {
      const det = detailOf(s);
      if (det && det.sessionDays.length) {  // 회차가 있는 날만 (준비·철거일 제외)
        det.sessionDays.filter(k => k >= today && k <= limitIso).forEach(k => (byDay[k] = byDay[k] || []).push(s));
        return;
      }
      let d = new Date(Math.max(new Date(s.start + "T00:00:00"), new Date(today + "T00:00:00")));
      const end = new Date(s.end + "T00:00:00");
      const limit = new Date(Date.now() + 60 * 864e5);
      for (; d <= end && d <= limit; d = new Date(d.getTime() + 864e5)) { const k = iso(d); (byDay[k] = byDay[k] || []).push(s); }
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
    $("#scheduleNote").textContent = lang === "ko" ? `${fmtDate(today)}부터 60일 안의 공연 ${n}건. 공연 자료 갱신 ${DATA.shows.updated}` : `${n} shows within 60 days from ${fmtDate(today)}. Data updated ${DATA.shows.updated}`;
  }

  /* ---------- 2. 예보 ---------- */
  function dayKind(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (DATA.holidaySet.has(dateStr.replace(/-/g, "")) || d.getDay() === 0) return "sun";
    return d.getDay() === 6 ? "sat" : "wd";
  }
  function bigShowsOn(dateStr) { return DATA.shows.shows.filter(s => isShow(s) && s.big && s.start <= dateStr && s.end >= dateStr); }
  function lookup(dateStr, hour, big, rain) {
    const k = `${dayKind(dateStr)}|${hour}|${big ? 1 : 0}|${rain ? 1 : 0}`;
    return DATA.model.table[k] || [0, 0, 0, "s"];
  }
  function syncForecastForm() {
    $("#fcDate").value = state.fc.date; $("#fcHour").value = state.fc.hour; $("#fcVenue").value = state.fc.venue;
    $$("#fcForm [data-rain]").forEach(b => b.classList.toggle("is-on", +b.dataset.rain === state.fc.rain));
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
    const basisTxt = { d: T("basisD"), r: T("basisR"), s: T("basisS") }[basis];
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
    $("#fcStrip").innerHTML = [...Array(24)].map((_, h) => { const rh = state.fc.rainMode === "auto" && wx ? ((wxAt(date, h) || {}).rain ?? rain) : rain; const r = lookup(date, h, big, rh); return `<div class="l${r[1]} ${h === hour ? "sel" : ""} ${rh ? "rain" : ""}" title="${pad(h)}:00 · ${r[0]}${rh ? " ☂" : ""}">${h % 3 === 0 ? h : ""}</div>`; }).join("");
    $("#stripTitle").textContent = T("stripTitle"); $("#stripHint").textContent = T("stripHint");
    const th = Object.values(DATA.model.thresholds || {});
    const lvNames = lang === "ko" ? DATA.model.levels : DATA.model.levelsEn;
    $("#fcLegend").innerHTML = lvNames.map((nm, i) => `<span><i class="l${i}"></i>${T("legendLv")(nm, i === 0 ? null : th[i - 1], i < th.length ? th[i] - 1 : null)}</span>`).join("");
    $$("#fcStrip div").forEach((el, h) => el.onclick = () => { state.fc.hour = h; syncForecastForm(); renderForecast(); });
    const v = DATA.venues.venues[venue] || {};
    $("#fcParking").innerHTML = `<h3>${T("parkingH")} · ${venueName(venue)}</h3>` + (v.lot ? `<dl class="kv">
      <dt>${T("lot")}</dt><dd>${esc(v.lot)}</dd><dt>${T("spaces")}</dt><dd>${v.lotSpaces ?? "-"}</dd>
      ${v.walk ? `<dt>${T("walk")}</dt><dd>${esc(v.walk)}</dd>` : ""}
      <dt>${T("gates")}</dt><dd>${(v.gates || []).join(" · ")}</dd><dt>${T("hours")}</dt><dd>${DATA.venues.parkingHours}</dd>
      <dt>${T("feeH")}</dt><dd>${esc(DATA.venues.fee.small)}</dd></dl>` : `<p class="muted">${T("noLot")}</p>`);
    $("#fcTransit").innerHTML = `<h3>${T("transitH")}</h3><ul class="plain">` + DATA.venues.subway.map(s => { const e = lang === "en" ? s.en : s; return `<li><b>${esc(e.line)} ${esc(e.station)}</b>${e.exit ? ` ${esc(e.exit)}` : ""} ${T("toward")} ${esc(e.gate)}</li>`; }).join("") + `</ul>`;
    $("#fcTips").innerHTML = `<h3>${T("tipsH")}</h3><ul class="plain">` + DATA.venues.alternatives.map(a => `<li>${esc(a[lang])}</li>`).join("") + `</ul>`;
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
  }

  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function renderAll() { applyI18n(); renderToday(); renderSchedule(); initForecastForm(); renderForecast(); renderQuality(); renderSources(); $("#footSource").textContent = T("source")(DATA.shows.updated); }

  load().then(() => {
    renderAll();
    $("#langBtn").onclick = () => { lang = lang === "ko" ? "en" : "ko"; try { localStorage.setItem("olpark.lang", lang); } catch (e) {} renderAll(); };
    $$(".tab").forEach(t => t.onclick = e => { e.preventDefault(); location.hash = "#" + t.dataset.tab; showTab(t.dataset.tab); });
    const fromHash = () => { const h = location.hash.replace("#", ""); if (["schedule", "forecast", "quality"].includes(h)) showTab(h); };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }).catch(err => { $("main").innerHTML = `<div class="empty">자료를 불러오지 못했습니다. ${esc(err.message)}</div>`; });
})();
