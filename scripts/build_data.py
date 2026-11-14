"""공연 자료 갱신: 문화 공공데이터광장 통합 공연정보(API_CCA_144)에서 한국체육산업개발(주) 공연을 받아
공연장 표준화·점검을 거쳐 data/shows.json, data/quality.json 을 만든다.

실행: KCISA_KEY=<서비스키> python3 scripts/build_data.py
      python3 scripts/build_data.py --input raw.json   (이미 받은 원자료로 만들 때)
"""
import json, re, os, sys, csv, collections, datetime as dt, urllib.request, urllib.parse, ssl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
API = "https://api.kcisa.kr/openapi/API_CCA_144/request"
KEYWORD = "한국체육산업개발"
INSTT = "한국체육산업개발(주)"

# 표준 공연장 판별 규칙(우선순위 순). 기관 누리집 일정안내의 공연장 탭과 맞춤
VENUES = [
    ("KSPO DOME", r"kspo\s*dome|체조\s*경기장|돔"),
    ("핸드볼경기장", r"핸드볼|라이브\s*아레나|live\s*arena"),
    ("우리금융아트홀", r"우리금융|역도\s*경기장|우리\s*아트홀"),
    ("K-아트홀", r"k[\s\-]*아트홀|k[\s\-]*art"),
    ("뮤즈라이브", r"뮤즈\s*라이브|muse"),
    ("올림픽홀", r"올림픽\s*홀|olympic\s*hall"),
    ("88잔디마당", r"잔디\s*마당|88\s*잔디"),
    ("88호수 수변무대", r"수변\s*무대|88\s*호수"),
    ("평화의 광장", r"평화의\s*광장|평화의\s*문"),
    ("옥외·기타", r"야외|옥외|광장|공원\s*일원|만남의|몽촌|올림픽공원$|벨로드롬|경륜장|축구장|피크닉|88\s*마당|기타시설"),
]
VENUES = [(n, re.compile(p, re.I)) for n, p in VENUES]
BIG = {"KSPO DOME", "핸드볼경기장"}
NON_SHOW = re.compile(r"준비\s*대관|철거\s*대관|리허설|셋업|철수|설치\s*일|해체|예약\s*완료|가\s*예약|대관\s*예약|^대관$|행사\s*준비")


def fetch_all(key):
    items, page = [], 1
    while page <= 30:
        q = urllib.parse.urlencode({"serviceKey": key, "numOfRows": 1000, "pageNo": page, "keyword": KEYWORD})
        req = urllib.request.Request(f"{API}?{q}", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            body = json.load(r)["response"]["body"]
        got = body.get("items", {}).get("item", []) if body.get("items") else []
        if isinstance(got, dict):
            got = [got]
        items += got
        if len(got) < 1000:
            break
        page += 1
    return items


def canon_venue(raw):
    s = (raw or "").strip()
    if s in ("", ".", "-", "기타", "미정"):
        return "미상", "blank"
    for name, rx in VENUES:
        if rx.search(s):
            return name, ("ok" if s == name else "variant")
    return "미상", "unmatched"


def parse_period(p):
    m = re.fullmatch(r"(\d{8})\s+(\d{8})", (p or "").strip())
    if not m:
        return None, None
    f = lambda x: f"{x[:4]}-{x[4:6]}-{x[6:]}"
    try:
        return dt.date.fromisoformat(f(m.group(1))), dt.date.fromisoformat(f(m.group(2)))
    except ValueError:
        return None, None


def parse_duration(d):
    s = (d or "").strip()
    if s in ("", ".", "-"):
        return None, "blank"
    m = re.search(r"(\d{2,3})\s*분", s)
    if m:
        return int(m.group(1)), "ok"
    m = re.search(r"(\d)\s*시간\s*(\d{1,2})?", s)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2) or 0), "ok"
    return None, "unparsed"


def build(items):
    g = lambda i, k: (i.get(k) or "")
    shows, seen = [], collections.defaultdict(list)
    for it in items:
        if g(it, "CNTC_INSTT_NM") != INSTT:
            continue
        title = re.sub(r"\s+", " ", g(it, "TITLE")).strip()
        raw_v = g(it, "SPATIAL_COVERAGE")
        venue, vkind = canon_venue(raw_v)
        s, e = parse_period(g(it, "PERIOD"))
        dur, dkind = parse_duration(g(it, "DURATION"))
        issues = []
        if NON_SHOW.search(title + " " + raw_v):
            issues.append("non_show")
        if vkind != "ok":
            issues.append("venue_" + vkind)
        if s is None:
            issues.append("period_unparsed")
        if dkind != "ok":
            issues.append("duration_" + dkind)
        seen[(title.lower(), g(it, "PERIOD"))].append(g(it, "LOCAL_ID"))
        shows.append({
            "id": g(it, "LOCAL_ID"), "title": title, "venue": venue, "venueRaw": raw_v.strip(), "big": venue in BIG,
            "start": s.isoformat() if s else None, "end": e.isoformat() if e else None,
            "days": (e - s).days + 1 if s else None, "durationMin": dur, "url": g(it, "URL"),
            "issued": g(it, "ISSUED_DATE")[:10], "issues": issues,
        })
    dup_ids = {i for v in seen.values() if len(v) > 1 for i in v}
    for sh in shows:
        if sh["id"] in dup_ids:
            sh["issues"].append("duplicate")
    shows.sort(key=lambda x: (x["start"] or "0000", x["title"]))
    return shows


def quality(shows):
    c = collections.Counter(i for s in shows for i in s["issues"])
    recent = [s for s in shows if (s["start"] or "")[:4] >= "2024"]
    cr = collections.Counter(i for s in recent for i in s["issues"])
    variants = collections.Counter((s["venueRaw"], s["venue"]) for s in recent if "venue_variant" in s["issues"])
    return {
        "generated": dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M"),
        "total": len(shows), "clean": sum(1 for s in shows if not s["issues"]),
        "counts": dict(c),
        "recent": {"from": "2024-01-01", "total": len(recent), "clean": sum(1 for s in recent if not s["issues"]), "counts": dict(cr),
                   "venueVariants": [{"raw": r, "canonical": v, "n": n} for (r, v), n in variants.most_common(15)]},
        "venues": dict(collections.Counter(s["venue"] for s in shows)),
        "rawVenueKinds": len({s["venueRaw"] for s in shows}),
    }


def main():
    if "--input" in sys.argv:
        items = json.load(open(sys.argv[sys.argv.index("--input") + 1], encoding="utf-8"))
    else:
        key = os.environ.get("KCISA_KEY")
        if not key:
            sys.exit("KCISA_KEY 환경변수가 없습니다")
        items = fetch_all(key)
    prev_path = os.path.join(DATA, "shows.json")
    if os.path.exists(prev_path) and "--force" not in sys.argv:  # 빈 응답·일부 응답으로 지난 자료를 덮어쓰지 않음
        prev_n = len(json.load(open(prev_path, encoding="utf-8")).get("shows", []))
        if len(items) < prev_n * 0.9:
            sys.exit(f"받은 공연 {len(items)}건이 지난 자료 {prev_n}건의 90%보다 적어 갱신하지 않습니다(--force로 강제)")
    shows = build(items)
    os.makedirs(DATA, exist_ok=True)
    json.dump({"updated": dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M"), "source": "문화 공공데이터광장 통합 공연정보(API_CCA_144) 중 한국체육산업개발(주)", "shows": shows},
              open(os.path.join(DATA, "shows.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(quality(shows), open(os.path.join(DATA, "quality.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("shows", len(shows), "| clean", sum(1 for s in shows if not s["issues"]), "| upcoming", sum(1 for s in shows if (s["end"] or "") >= dt.date.today().isoformat()))


if __name__ == "__main__":
    main()
