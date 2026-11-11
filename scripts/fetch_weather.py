"""기상청 단기예보(VilageFcstInfoService_2.0) → data/weather.json

올림픽공원 격자(nx=62, ny=126)의 3일치 시간별 예보에서 강수확률(POP)·강수형태(PTY)·1시간 강수량(PCP)·기온(TMP)·하늘(SKY)을 받아
주차 혼잡 예보의 "비" 입력을 자동으로 채운다. 발표 시각은 02·05·08·11·14·17·20·23시(10분 뒤 제공) 중 가장 최근 것.

실행: KMA_KEY=<공공데이터포털 서비스키> python3 scripts/fetch_weather.py
"""
import json, os, sys, datetime as dt, urllib.request, urllib.parse, ssl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "weather.json")
API = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
NX, NY = 62, 126           # 올림픽공원(37.5208N, 127.1218E) 기상청 격자
BASES = [2, 5, 8, 11, 14, 17, 20, 23]
KST = dt.timezone(dt.timedelta(hours=9))


def ssl_ctx():
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    return ctx


def latest_base(now):
    ok = [b for b in BASES if now >= now.replace(hour=b, minute=10, second=0, microsecond=0)]
    if ok:
        return now.strftime("%Y%m%d"), f"{ok[-1]:02d}00"
    return (now - dt.timedelta(1)).strftime("%Y%m%d"), "2300"


def fetch(key, bd, bt):
    q = urllib.parse.urlencode({"serviceKey": key, "numOfRows": 1000, "pageNo": 1, "dataType": "JSON",
                                "base_date": bd, "base_time": bt, "nx": NX, "ny": NY})
    with urllib.request.urlopen(urllib.request.Request(f"{API}?{q}"), timeout=60, context=ssl_ctx()) as r:
        j = json.load(r)
    hdr = j["response"]["header"]
    if hdr.get("resultCode") != "00":
        raise RuntimeError(f"{hdr.get('resultCode')} {hdr.get('resultMsg')}")
    items = j["response"]["body"]["items"]["item"]
    return [items] if isinstance(items, dict) else items


def build(items):
    hours = {}
    for it in items:
        d = f"{it['fcstDate'][:4]}-{it['fcstDate'][4:6]}-{it['fcstDate'][6:]}"
        h = it["fcstTime"][:2]
        c, v = it["category"], it["fcstValue"]
        slot = hours.setdefault(d, {}).setdefault(h, {})
        if c == "POP":
            slot["pop"] = int(v)
        elif c == "PTY":
            slot["pty"] = int(v)       # 0 없음 1 비 2 비/눈 3 눈 4 소나기
        elif c == "PCP":
            slot["pcp"] = v            # "강수없음", "1.0mm", "1mm 미만", "30.0~50.0mm"
        elif c == "TMP":
            slot["tmp"] = int(float(v))
        elif c == "SKY":
            slot["sky"] = int(v)       # 1 맑음 3 구름많음 4 흐림
    days = {}
    for d, hs in hours.items():
        pops = [s["pop"] for s in hs.values() if "pop" in s]
        rain = [h for h, s in hs.items() if s.get("pty", 0) != 0]
        days[d] = {"popMax": max(pops) if pops else None, "rainHours": sorted(rain),
                   "tmin": min((s["tmp"] for s in hs.values() if "tmp" in s), default=None),
                   "tmax": max((s["tmp"] for s in hs.values() if "tmp" in s), default=None)}
    return hours, days


def main():
    key = os.environ.get("KMA_KEY")
    if not key:  # 키가 없으면 지난 파일 유지(파이프라인은 계속)
        print("KMA_KEY 환경변수가 없어 날씨를 건너뜁니다", file=sys.stderr)
        return
    now = dt.datetime.now(KST)
    bd, bt = latest_base(now)
    try:
        items = fetch(key, bd, bt)
    except Exception as e:  # 실패 시 지난 파일 유지
        print("fetch failed, keeping previous file:", e, file=sys.stderr)
        return
    hours, days = build(items)
    json.dump({"updated": now.strftime("%Y-%m-%d %H:%M"), "base": f"{bd[:4]}-{bd[4:6]}-{bd[6:]} {bt[:2]}:00",
               "grid": {"nx": NX, "ny": NY, "place": "올림픽공원"}, "source": "기상청 단기예보 조회서비스(공공데이터포털 15084084)",
               "rule": {"rainPop": 60, "note": "강수형태가 '없음'이 아니거나 강수확률 60% 이상이면 비로 봄"},
               "days": days, "hours": hours},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"weather base {bd} {bt} | days {sorted(days)} | items {len(items)}")


if __name__ == "__main__":
    main()
