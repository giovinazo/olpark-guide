"""공연 회차 시각 수집·표준화·오기 점검.

공공데이터(통합 공연정보)에는 회차별 시작 시각이 없어, 기관 누리집 공연 상세 글(URL 칸)의 "시간" 칸을 읽어
날짜별 회차(시작 시각)로 표준화하고, 표기 오류(요일 불일치·기간 밖 날짜·요일 빈칸·해석 불가)를 점검한다.

실행: python3 scripts/fetch_details.py            (다가오는 공연 상세 글을 받아 data/details.json 갱신)
      python3 scripts/fetch_details.py --cache DIR (이미 받아 둔 HTML 폴더로 시험, 받기 없음)
      python3 scripts/fetch_details.py --reparse   (받기 없이 저장된 원문만 다시 해석)
"""
import json, re, os, sys, time, html, datetime as dt, urllib.request, ssl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "details.json")
AHEAD_DAYS = 120      # 오늘부터 이 기간 안에 시작·진행하는 공연만 새로 받음
DELAY = 1.0           # 요청 간격(초)
UA = "olpark-guide/0.1 (+https://github.com/giovinazo/olpark-guide)"

WD = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6,
      "MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6}
WD_KO = "월화수목금토일"


def ssl_ctx():
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    return ctx


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=40, context=ssl_ctx()) as r:
        return r.status, r.read().decode("utf-8", "replace")


# ---------- 상세 글 읽기 ----------
def strip_tags(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def parse_page(body):
    m = re.search(r'<div class="detail_info">\s*<ul class="list">(.*?)</ul>', body, re.S)
    if not m:
        return None
    info = {}
    for em, sp in re.findall(r"<li><em>(.*?)</em><span[^>]*>(.*?)</span></li>", m.group(1), re.S):
        info[strip_tags(em)] = strip_tags(sp)
    t = re.search(r'<strong class="title">(.*?)</strong>', body, re.S)
    b = re.search(r'<a href="(https?://[^"]+)"[^>]*>\s*공연정보\s*</a>', body)
    p = re.search(r'<ul class="sub_tabs">.*?<a href="#conPlace01"[^>]*>(.*?)</a>', body, re.S)
    return {
        "title": strip_tags(t.group(1)) if t else "",
        "period": info.get("기간", ""), "timeRaw": info.get("시간", ""), "duration": info.get("소요시간", ""),
        "price": info.get("티켓가격", ""), "age": info.get("관람연령", ""), "host": info.get("주최", ""),
        "tel": info.get("문의", ""), "booking": b.group(1) if b else "", "placeTab": strip_tags(p.group(1)) if p else "",
    }


# ---------- 회차 시각 해석 ----------
TOKEN = re.compile(r"""
  (?P<date>(?:(?P<y>20\d{2})\s*[년.]\s*)?(?:(?P<mo>\d{1,2})\s*[월.]\s*)?(?P<d>\d{1,2})\s*(?:일|\.(?=\s*\()|(?=\s*[\(\-~]|\s*$|\s*[월화수목금토일]|\.\s*\())\s*
     (?:\(\s*(?P<wd1>[월화수목금토일]|SAT|SUN|MON|TUE|WED|THU|FRI)\s*(?:요일)?\s*\)|\s*(?P<wd2>[월화수목금토일])요일|\s*(?P<wd3>[월화수목금토일])(?=\s)|\(\s*\))?)
 |(?P<time>(?P<ap>오전|오후|낮|저녁|밤)?\s*(?P<h>\d{1,2})\s*(?::\s*(?P<mi>\d{2})\s*(?P<ap2>AM|PM)?|\s*(?P<ap3>AM|PM)|\s*시\s*(?:(?P<mi2>\d{1,2})\s*분)?(?:\s*반)?|(?P<bare>)(?=\s*[,、/·]|\s*$|\s*\(|\s*공연)))
 |(?P<wdrange>[월화수목금토일]\s*[~\-]\s*[월화수목금토일])
 |(?P<wdclass>주말\s*(?:[&,·]\s*공휴일)?|공휴일|평일)
 |\(?\s*(?P<wdlist>[월화수목금토일](?:\s*[,·]?\s*[월화수목금토일]){0,6})(?:요일)?\s*\)?(?=\s*[:：]?\s*(?:\d|오전|오후|낮|저녁|밤)|\s*$|\s*[/,]|\s*공연)
 |(?P<range>[~\-–]|부터)
 |(?P<noshow>공연\s*없음|휴연)
 |(?P<sep>[/,、·])
""", re.X | re.I)


def to_hhmm(h, mi, ap, prev_pm):
    """시각 문자열 구성. ap: 오전/오후/AM/PM/None. prev_pm: 같은 묶음 앞 회차가 오후였는지."""
    ap = (ap or "").upper()
    if ap in ("오후", "PM", "저녁", "밤", "낮"):
        if h < 12:
            h += 12
    elif ap in ("오전", "AM"):
        if h == 12:
            h = 0
    else:  # 오전·오후 표시 없음: 1~9시는 공연 관행상 오후, 10~11시는 오전
        if h <= 9:
            h += 12
    if h > 23 or mi > 59:
        return None
    return f"{h:02d}:{mi:02d}"


def parse_time_text(raw, start, end):
    """시간 칸 원문 → (sessions, checks, leftovers)
    sessions: [{date, time, wdWritten}] / checks: [{kind, text, fix}]"""
    s = raw or ""
    s = re.sub(r"[​‌‍﻿]", "", s)
    s = s.replace("（", "(").replace("）", ")").replace("：", ":").replace("～", "~").replace("–", "-")
    s = re.sub(r"\(\s*KST\s*\)|KST", "", s, flags=re.I)
    s = re.sub(r"\(\s*\d일\s*\d회\s*\)|\(\s*1일\s*\d회\s*\)", "", s)
    s = re.sub(r"공연\s*시작|시작|총|약|예정|이상|인터미션[^)]*\)?", " ", s)
    s = re.sub(r"\*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    checks, sessions = [], []
    if not s or re.search(r"추후|미정|업데이트|확인\s*바랍|상세\s*페이지|공지", s) and not re.search(r"\d\s*(시|PM|AM|:)", s, re.I):
        return [], [{"kind": "time_blank" if not s else "time_tbd", "text": raw}], ""
    days = [start + dt.timedelta(n) for n in range((end - start).days + 1)]
    ctx, had_time, range_pending, last_date, leftovers = [], False, False, None, []
    pos = 0
    cur_mo = None

    def resolve(y, mo, d):
        nonlocal cur_mo
        mo = int(mo) if mo else (cur_mo or start.month)
        d = int(d)
        cur_mo = mo
        y = int(y) if y else None
        if y is None:
            # 기간에 걸친 연도 중 월이 맞는 쪽
            y = start.year if (mo, d) >= (start.month, start.day) or start.year == end.year else end.year
        try:
            return dt.date(y, int(mo), int(d))
        except ValueError:
            return None

    ctx_src = None          # 현재 묶음이 날짜(date)로 정해졌는지 요일(wd)로 정해졌는지
    range_after_time = False  # "14:00 ~ 22:30"처럼 시각 뒤의 물결표: 다음 시각은 종료 시각이라 버림

    def new_group(src):
        nonlocal ctx, had_time, ctx_src
        # 시각이 이미 붙은 묶음 뒤, 또는 날짜 묶음 뒤에 요일이 오면 새 묶음
        if had_time or (src == "wd" and ctx_src == "date"):
            ctx, had_time = [], False
        ctx_src = src

    for m in TOKEN.finditer(s):
        if m.start() > pos and s[pos:m.start()].strip():
            leftovers.append(s[pos:m.start()].strip())
        pos = m.end()
        if m.group("date"):
            new_group("date")
            d = resolve(m.group("y"), m.group("mo"), m.group("d"))
            wd = m.group("wd1") or m.group("wd2") or m.group("wd3")
            if d is None:
                checks.append({"kind": "date_invalid", "text": m.group("date").strip()})
                continue
            w = WD.get(wd.upper()) if wd else None
            if not (start <= d <= end):
                # 기간 밖 날짜: 같은 일(日)이 기간 안에 하나뿐이면(요일이 적혔으면 그 요일과 맞는 날) 월 오기로 보고 정정 제안
                cands = [x for x in days if x.day == d.day]
                if w is not None:
                    cands = [x for x in cands if x.weekday() == w] or cands
                fix = cands[0] if len(cands) == 1 else None
                checks.append({"kind": "date_outside", "text": m.group("date").strip(), "fix": fix.isoformat() if fix else None})
                if fix is None:
                    continue
                d = fix
            if w is not None and w != d.weekday():
                checks.append({"kind": "weekday_mismatch", "text": m.group("date").strip(), "fix": f"{d.month}월 {d.day}일({WD_KO[d.weekday()]})"})
            elif wd is None and "()" in m.group("date").replace(" ", ""):
                checks.append({"kind": "weekday_blank", "text": m.group("date").strip(), "fix": f"{d.month}월 {d.day}일({WD_KO[d.weekday()]})"})
            if range_pending and last_date:
                ctx += [x for x in days if last_date < x <= d]
            else:
                ctx.append(d)
            range_pending = False
            last_date = d
        elif m.group("time"):
            if range_after_time:  # 종료 시각
                range_after_time = False
                continue
            h = int(m.group("h"))
            mi = int(m.group("mi") or m.group("mi2") or 0)
            if m.group("mi2") is None and "반" in m.group("time"):
                mi = 30
            ap = m.group("ap") or m.group("ap2") or m.group("ap3")
            t = to_hhmm(h, mi, ap, False)
            if t is None:
                checks.append({"kind": "time_unparsed", "text": m.group("time").strip()})
                continue
            if m.group("bare") is not None and ap:  # "오후 5"처럼 '시'가 빠진 표기
                checks.append({"kind": "time_format", "text": m.group("time").strip(), "fix": f"{ap} {h}시"})
            if not ctx:
                ctx = list(days)  # 날짜 언급 없이 시각만: 기간의 모든 날
                ctx_src = "all"
            for d in ctx:
                sessions.append({"date": d.isoformat(), "time": t})
            had_time = True
        elif m.group("wdrange"):
            new_group("wd")
            a, b = re.findall(r"[월화수목금토일]", m.group("wdrange"))
            lo, hi = WD[a], WD[b]
            wds = set(range(lo, hi + 1)) if lo <= hi else set(range(lo, 7)) | set(range(0, hi + 1))
            ctx += [x for x in days if x.weekday() in wds]
        elif m.group("wdclass"):
            new_group("wd")
            w = m.group("wdclass")
            if "주말" in w:
                ctx += [x for x in days if x.weekday() >= 5 or x.isoformat() in HOLIDAYS]
            elif "공휴일" in w:
                ctx += [x for x in days if x.isoformat() in HOLIDAYS and x not in ctx]
            else:
                ctx += [x for x in days if x.weekday() < 5 and x.isoformat() not in HOLIDAYS]
        elif m.group("wdlist"):
            new_group("wd")
            wds = {WD[c] for c in re.findall(r"[월화수목금토일]", m.group("wdlist"))}
            ctx += [x for x in days if x.weekday() in wds]
        elif m.group("range"):
            if had_time:
                range_after_time = True
            else:
                range_pending = True
        elif m.group("noshow"):
            ctx, had_time = [], True
        # sep: 구분자는 문맥 유지
    if pos < len(s) and s[pos:].strip():
        leftovers.append(s[pos:].strip())
    leftovers = [x for x in leftovers if re.search(r"[0-9가-힣A-Za-z]", x)]
    hard = [x for x in leftovers if re.search(r"\d|오전|오후|AM|PM", x, re.I)]
    if hard:
        checks.append({"kind": "time_leftover", "text": " | ".join(hard)})
    elif leftovers:
        checks.append({"kind": "note", "text": " | ".join(leftovers)})
    # 중복 제거·정렬
    seen, out = set(), []
    for x in sorted(sessions, key=lambda x: (x["date"], x["time"])):
        if (x["date"], x["time"]) not in seen:
            seen.add((x["date"], x["time"]))
            out.append(x)
    if not out and not checks:
        checks.append({"kind": "time_unparsed", "text": raw})
    return out, checks, s


HOLIDAYS = set()


def load_holidays():
    try:
        h = json.load(open(os.path.join(DATA, "holidays.json"), encoding="utf-8"))
        for x in (h if isinstance(h, list) else h.get("dates", h.get("holidays", []))):
            d = x if isinstance(x, str) else x.get("date") or x.get("locdate")
            if d:
                d = str(d)
                HOLIDAYS.add(d if "-" in d else f"{d[:4]}-{d[4:6]}-{d[6:]}")
    except Exception:
        pass


def analyse(rec, api_start, api_end):
    """상세 글 원문 → 해석 결과 덧붙임"""
    ps = pe = None
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2}) ~ (\d{4}-\d{2}-\d{2})", rec.get("period", "").strip())
    if m:
        ps, pe = dt.date.fromisoformat(m.group(1)), dt.date.fromisoformat(m.group(2))
    start, end = ps or api_start, pe or api_end
    sessions, checks, norm = parse_time_text(rec.get("timeRaw", ""), start, end)
    if ps and api_start and (ps, pe) != (api_start, api_end):
        checks.append({"kind": "period_mismatch", "text": f"공공데이터 {api_start}~{api_end} / 누리집 {ps}~{pe}"})
    rec["sessions"] = sessions
    rec["sessionDays"] = sorted({x["date"] for x in sessions})
    ndays = (end - start).days + 1
    if sessions and ndays <= 14 and len(rec["sessionDays"]) < ndays:
        checks.append({"kind": "partial_days", "text": f"{ndays}일 중 {len(rec['sessionDays'])}일만 회차 있음"})
    rec["checks"] = checks
    return rec


def main():
    load_holidays()
    shows = json.load(open(os.path.join(DATA, "shows.json"), encoding="utf-8"))["shows"]
    old = {}
    if os.path.exists(OUT):
        old = json.load(open(OUT, encoding="utf-8")).get("bySeq", {})
    cache = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else None
    reparse = "--reparse" in sys.argv
    today = dt.date.today()
    limit = (today + dt.timedelta(AHEAD_DAYS)).isoformat()
    by = dict(old)
    n_fetch = n_fail = 0
    for s in shows:
        m = re.search(r"evtSeq=(\d+)", s.get("url") or "")
        if not m or not s.get("start"):
            continue
        seq = m.group(1)
        want = (s["end"] or "") >= today.isoformat() and s["start"] <= limit
        rec = None
        if cache:
            fn = os.path.join(cache, f"{seq}.html")
            if os.path.exists(fn):
                rec = parse_page(open(fn, encoding="utf-8", errors="replace").read())
        elif want and not reparse:
            try:
                st, body = fetch(s["url"])
                rec = parse_page(body) if st == 200 else None
                n_fetch += 1
            except Exception as e:  # 서버 오류(500)·시간 초과: 지난 값 유지, 없으면 오류 기록
                n_fail += 1
                print("fail", seq, e, file=sys.stderr)
                if seq not in by:
                    by[seq] = {"seq": seq, "id": s["id"], "title": s["title"], "period": f"{s['start']} ~ {s['end']}", "timeRaw": "", "booking": "",
                               "fetched": today.isoformat(), "sessions": [], "sessionDays": [], "checks": [{"kind": "page_error", "text": str(e)[:60]}]}
                continue
            time.sleep(DELAY)
        if rec is None and seq in by:
            if by[seq].get("checks") and by[seq]["checks"][0].get("kind") == "page_error":
                continue
            rec = {k: by[seq][k] for k in ("title", "period", "timeRaw", "duration", "price", "age", "host", "tel", "booking", "placeTab") if k in by[seq]}
        if rec is None:
            continue
        rec["seq"] = seq
        rec["id"] = s["id"]
        rec["fetched"] = by.get(seq, {}).get("fetched") if (cache is None and (reparse or not want)) else today.isoformat()
        rec["fetched"] = rec["fetched"] or today.isoformat()
        a_s = dt.date.fromisoformat(s["start"]) if s["start"] else None
        a_e = dt.date.fromisoformat(s["end"]) if s["end"] else a_s
        by[seq] = analyse(rec, a_s, a_e)
    json.dump({"updated": dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M"), "source": "한국체육산업개발(주) 올림픽공원 누리집 공연 일정안내 상세 글",
               "bySeq": by}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    tot = len(by)
    with_s = sum(1 for r in by.values() if r["sessions"])
    chk = sum(1 for r in by.values() if any(c["kind"] not in ("time_blank",) for c in r["checks"]))
    print(f"details {tot} | fetched {n_fetch} fail {n_fail} | with sessions {with_s} | flagged {chk}")


if __name__ == "__main__":
    main()
