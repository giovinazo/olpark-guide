"""영문 공연 제목·영문 예매 링크 연결.

기관 개방 데이터 "올림픽공원 영문 공연정보"(공공데이터포털 15149169)는 기관 영문 누리집 Culture Info 게시판(bid=0043)의
내보내기이며 일련번호·공연제목·상세주소(영문 예매처)·공연일자 칸을 가진다. 같은 게시판을 직접 읽어 최신 글까지 받고,
공공데이터 공연정보(shows.json)와 날짜·제목 낱말 겹침으로 짝을 지어 data/titles_en.json 을 만든다.

실행: python3 scripts/fetch_titles_en.py              (영문 게시판 읽기 → 연결)
      python3 scripts/fetch_titles_en.py --csv 파일   (공공데이터포털 CSV(cp949)로 연결, 받기 없음)
"""
import json, re, os, sys, csv, time, html, datetime as dt, urllib.request, ssl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "titles_en.json")
LIST = "https://www.ksponco.or.kr/olympicpark/gallery.es?mid=a30301000000&bid=0043&nPage={page}&b_list_cnt={n}"
PAGE_SIZE = 9          # 게시판이 b_list_cnt를 9로 고정
MAX_PAGES = 60
RECENT_DAYS = 60       # --full 아니면 이 날짜보다 오래된 글이 나오는 쪽에서 멈춤
DELAY = 1.0
UA = "olpark-guide/0.1 (+https://github.com/giovinazo/olpark-guide)"
STOP = {"the", "in", "seoul", "concert", "tour", "live", "world", "of", "and", "with", "fan", "meeting", "fanmeeting", "asia",
        "korea", "festival", "special", "show", "encore", "final", "on", "to", "ver", "st", "nd", "rd", "th", "anniversary",
        "kspo", "dome", "olympic", "hall", "park", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027"}
WIN_DAYS = 45


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
        return r.read().decode("utf-8", "replace")


ITEM = re.compile(r'<li class="list_li">\s*<a href="([^"]*)"[^>]*>.*?list_no=(\d+).*?<strong class="title">(.*?)</strong>.*?<span class="date">([\d-]+)</span>', re.S)


def parse_list(body):
    out = []
    for href, no, title, date in ITEM.findall(body):
        out.append({"no": no, "en": html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", title))).strip(),
                    "ticket": html.unescape(href).strip(), "date": date})
    return out


def fetch_board(full=False):
    items, seen = [], set()
    cutoff = (dt.date.today() - dt.timedelta(RECENT_DAYS)).isoformat()
    for p in range(1, MAX_PAGES + 1):
        got = parse_list(fetch(LIST.format(page=p, n=PAGE_SIZE)))
        new = [g for g in got if g["no"] not in seen]
        if not new:
            break
        for g in new:
            seen.add(g["no"])
        items += new
        if len(got) < PAGE_SIZE or (not full and min(g["date"] for g in got) < cutoff):
            break
        time.sleep(DELAY)
    return items


def read_csv(path):
    rows = list(csv.DictReader(open(path, encoding="cp949")))
    return [{"no": r["일련번호"].split("-")[-1], "en": html.unescape(r["공연제목"]).strip(), "ticket": r["상세주소"].strip(), "date": r["공연일자"]} for r in rows]


def norm(s):
    s = html.unescape(s or "")
    s = s.translate(str.maketrans("＆＂＇（）［］：！？～", "&\"'()[]:!?~"))
    return s


KO_STOP = {"콘서트", "단독", "공연", "서울", "투어", "팬미팅", "팬콘서트", "내한공연", "내한", "앵콜", "전국투어", "첫", "기념", "주년"}


def toks(s):
    s = norm(s).lower()
    en = {t for t in re.findall(r"[a-z0-9]+", s) if len(t) > 1 and t not in STOP}
    ko = {t for t in re.findall(r"[가-힣]{2,}", re.sub(r"[\[\]()〈〉《》＜＞<>\"'“”‘’]", " ", s)) if t not in KO_STOP}
    return en | ko


def match(items, shows):
    """영문 글 → 공연 자료. 날짜 창(±45일) 안에서 제목 낱말 겹침(자카드)이 가장 큰 공연. 0.3 미만은 미연결."""
    by_id, unmatched = {}, []
    cands = [s for s in shows if s.get("start") and "non_show" not in s["issues"]]
    for it in items:
        try:
            d = dt.date.fromisoformat(it["date"])
        except ValueError:
            unmatched.append({**it, "why": "date"})
            continue
        tk = toks(it["en"])
        best, bscore = None, 0
        for s in cands:
            sd = dt.date.fromisoformat(s["start"])
            if abs((sd - d).days) > WIN_DAYS:
                continue
            st = toks(s["title"])
            if not tk or not st:
                continue
            j = len(tk & st) / len(tk | st)
            # 한쪽이 다른 쪽에 통째로 들어가면 가점(한글 제목 안의 영문 부제 등)
            if tk <= st or st <= tk:
                j = max(j, 0.6)
            if j > bscore:
                best, bscore = s, j
        if best is None or bscore < 0.3:
            unmatched.append({**it, "why": "nomatch"})
            continue
        prev = by_id.get(best["id"])
        if prev and prev["score"] >= bscore:
            continue
        by_id[best["id"]] = {"en": norm(it["en"]), "ticket": it["ticket"], "date": it["date"], "no": it["no"], "score": round(bscore, 2), "how": "title"}
    # 2차: 제목으로 못 맞춘 글은 시작일이 같은 공연이 하나뿐일 때만 날짜로 연결(낮은 점수, how=date)
    still = []
    for it in unmatched:
        if it["why"] != "nomatch":
            still.append(it)
            continue
        same = [s for s in cands if s["start"] == it["date"] and s["id"] not in by_id]
        if len(same) == 1 and not re.search(r"[가-힣]", it["en"]):
            by_id[same[0]["id"]] = {"en": norm(it["en"]), "ticket": it["ticket"], "date": it["date"], "no": it["no"], "score": 0.2, "how": "date"}
        else:
            still.append(it)
    return by_id, still


def main():
    shows = json.load(open(os.path.join(DATA, "shows.json"), encoding="utf-8"))["shows"]
    if "--csv" in sys.argv:
        items, src = read_csv(sys.argv[sys.argv.index("--csv") + 1]), "공공데이터포털 15149169 CSV"
    elif "--reparse" in sys.argv:  # 받기 없이 지난 파일의 글만 다시 연결
        old = json.load(open(OUT, encoding="utf-8"))
        items = [{k: v[k] for k in ("no", "en", "ticket", "date")} for v in old["byId"].values()] + [{k: u[k] for k in ("no", "en", "ticket", "date")} for u in old["unmatched"]]
        src = old["source"]
    else:
        try:
            items, src = fetch_board("--full" in sys.argv), "기관 영문 누리집 Culture Info 게시판(bid=0043)"
        except Exception as e:  # 읽기 실패: 지난 파일 유지
            print("fetch failed, keeping previous file:", e, file=sys.stderr)
            return
        if os.path.exists(OUT):  # 이번에 안 읽은 옛 글은 지난 파일에서 이어받음
            old = json.load(open(OUT, encoding="utf-8"))
            seen = {it["no"] for it in items}
            items += [{"no": v["no"], "en": v["en"], "ticket": v["ticket"], "date": v["date"]} for v in old.get("byId", {}).values() if v["no"] not in seen]
            items += [{k: u[k] for k in ("no", "en", "ticket", "date")} for u in old.get("unmatched", []) if u["no"] not in seen]
    by_id, unmatched = match(items, shows)
    today = dt.date.today().isoformat()
    up = [s for s in shows if (s.get("end") or "") >= today and "non_show" not in s["issues"]]
    up_linked = sum(1 for s in up if s["id"] in by_id)
    json.dump({"updated": dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M"), "source": src, "items": len(items),
               "linked": len(by_id), "upcoming": {"total": len(up), "linked": up_linked},
               "byId": by_id, "unmatched": unmatched[:200]},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"items {len(items)} | linked {len(by_id)} | unmatched {len(unmatched)} | upcoming linked {up_linked}/{len(up)}")


if __name__ == "__main__":
    main()
