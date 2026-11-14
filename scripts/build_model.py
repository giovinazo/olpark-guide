"""주차 혼잡 예보 모델 v1 : data/source/*.csv → data/model.json

자료
- link_table_202407.csv : 올림픽공원 입출차 정보(공공데이터포털 15138735, 2024년 7월 215,528건)를 시간별로 모은 744행
                          + 기상청 ASOS 서울(108) 시간자료 + 한국천문연구원 공휴일 + 누리집 공연 일정(대형 공연 여부)
- monthly_parking_15131671.csv : 올림픽공원 월별 주차현황(공공데이터포털 15131671, 2023~2025년) → 월별 계절 보정
- shows_202407_official_site.csv : 2024년 7월 누리집 일정안내(대형 공연 시작 시각)

모델(설명 가능한 곱셈 모형, 로그 선형 최소제곱)
  입차(시간당) ≈ 기준[요일구분][시] × 공연효과[시작 시각까지의 거리 구간]^(대형공연) × 비효과^(비) × 월보정[월]
  - 요일구분 3(평일·토·일/공휴일) × 시 24 = 72칸 기준값, 공연효과 5구간, 비효과 1개 → 744행으로 추정
  - 공연 시작 시각까지의 거리를 쓰므로 회차 시각이 모델 입력이 된다(v0는 시각만 썼음)
검증 : 하루씩 빼고(31회) 다시 추정해 그 날을 예측 → 평균 절대 오차·수준 일치율. v0(칸 평균) 방식과 나란히 기록

실행: python3 scripts/build_model.py
"""
import csv, json, os, math, datetime as dt, collections
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
OUT = os.path.join(ROOT, "data", "model.json")
BINS = [("-6~-5", -6, -5), ("-4~-3", -4, -3), ("-2~-1", -2, -1), ("0", 0, 0), (">=1", 1, 99)]   # 시작 시각까지의 거리(시간) 구간. 6시간 넘게 이른 시각은 공연 효과 없음
KINDS = ["wd", "sat", "sun"]
DEFAULT_START = {"wd": 19, "sat": 18, "sun": 17}   # 회차 시각을 모를 때(2024년 7월 대형 공연의 흔한 시작 시각)


def bin_of(off):
    """구간 번호, 범위 밖(시작 6시간 넘게 전)은 None = 효과 없음"""
    for i, (_, lo, hi) in enumerate(BINS):
        if lo <= off <= hi:
            return i
    return None


def load_rows():
    rows = list(csv.DictReader(open(os.path.join(SRC, "link_table_202407.csv"), encoding="utf-8-sig")))
    starts = collections.defaultdict(list)   # 날짜 → 대형 공연 시작 시각들
    for s in csv.DictReader(open(os.path.join(SRC, "shows_202407_official_site.csv"), encoding="utf-8-sig")):
        if s["공연장"] not in ("KSPO DOME", "핸드볼경기장"):
            continue
        d0, d1 = dt.date.fromisoformat(s["시작일"]), dt.date.fromisoformat(s["종료일"])
        text = s["공연시간안내"]
        import re
        per_wd = dict(re.findall(r"\((월|화|수|목|금|토|일)\)\s*(\d{1,2})", text))
        single = re.fullmatch(r"\s*(\d{1,2}):\d{2}\s*", text)
        for n in range((d1 - d0).days + 1):
            d = d0 + dt.timedelta(n)
            wd = "월화수목금토일"[d.weekday()]
            h = per_wd.get(wd) or (single.group(1) if single else None)
            if h:
                starts[d.isoformat()].append(int(h))
    out = []
    for r in rows:
        d = r["날짜"]
        kind = "sun" if (r["요일"] == "일" or (r["휴일구분"] and r["휴일구분"] != "주말")) else ("sat" if r["요일"] == "토" else "wd")
        h = int(r["시"])
        big = int(r["대형공연수"]) > 0
        rain = bool(r["강수량"]) and float(r["강수량"]) >= 0.1
        st = starts.get(d) or ([DEFAULT_START[kind]] if big else [])
        off = min((h - s for s in st), key=abs) if st else None
        out.append({"date": d, "kind": kind, "h": h, "big": big, "rain": rain, "off": off, "y": int(r["입차대수"])})
    return out


def design(rows):
    n = len(rows)
    p = 72 + len(BINS) + 1
    X = np.zeros((n, p))
    for i, r in enumerate(rows):
        X[i, KINDS.index(r["kind"]) * 24 + r["h"]] = 1
        b = bin_of(r["off"]) if r["big"] else None
        if b is not None:
            X[i, 72 + b] = 1
        if r["rain"]:
            X[i, 72 + len(BINS)] = 1
    y = np.log1p(np.array([r["y"] for r in rows], dtype=float))
    return X, y


def fit(rows):
    X, y = design(rows)
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    return beta


def predict(beta, r):
    v = beta[KINDS.index(r["kind"]) * 24 + r["h"]]
    b = bin_of(r["off"]) if r["big"] else None
    if b is not None:
        v += beta[72 + b]
    if r["rain"]:
        v += beta[72 + len(BINS)]
    return max(0.0, math.expm1(v))


def cell_predict(train, r, min_n=3):
    """v0 방식: 요일구분×시×대형공연×비 칸 평균, 표본 3 미만이면 비 무시 → 공연 무시"""
    for keyf in (lambda x: (x["kind"], x["h"], x["big"], x["rain"]), lambda x: (x["kind"], x["h"], x["big"]), lambda x: (x["kind"], x["h"])):
        k = keyf(r)
        v = [x["y"] for x in train if keyf(x) == k]
        if len(v) >= min_n:
            return sum(v) / len(v)
    return 0.0


def level(x, th):
    return 3 if x >= th[2] else 2 if x >= th[1] else 1 if x >= th[0] else 0


def main():
    rows = load_rows()
    ys = sorted(r["y"] for r in rows)
    th = [ys[int(len(ys) * p)] for p in (.50, .75, .90)]
    beta = fit(rows)
    # 하루씩 빼고 검증
    days = sorted({r["date"] for r in rows})
    err1 = err0 = errs = agree1 = agree0 = agrees = 0
    for d in days:
        train = [r for r in rows if r["date"] != d]
        test = [r for r in rows if r["date"] == d]
        b = fit(train)
        for r in test:
            p1, p0 = predict(b, r), cell_predict(train, r)
            v = [x["y"] for x in train if x["kind"] == r["kind"] and x["h"] == r["h"]]
            ps = sum(v) / len(v) if v else 0.0
            err1 += abs(p1 - r["y"]); err0 += abs(p0 - r["y"]); errs += abs(ps - r["y"])
            agree1 += level(p1, th) == level(r["y"], th); agree0 += level(p0, th) == level(r["y"], th); agrees += level(ps, th) == level(r["y"], th)
    n = len(rows)
    # 월 보정(월별 주차현황: 연도별 월/7월 비율의 평균)
    mp = collections.defaultdict(dict)
    for m in csv.DictReader(open(os.path.join(SRC, "monthly_parking_15131671.csv"), encoding="utf-8-sig")):
        if m["주차장소"] == "올림픽공원":
            mp[m["연도"]][int(m["월"][:2])] = int(m["주차대수"])
    month_factor = []
    for mo in range(1, 13):
        ratios = [mp[y][mo] / mp[y][7] for y in mp if 7 in mp[y] and mo in mp[y]]
        month_factor.append(round(sum(ratios) / len(ratios), 3) if ratios else 1.0)
    base = {k: [round(math.expm1(beta[KINDS.index(k) * 24 + h]), 1) for h in range(24)] for k in KINDS}
    base_n = {k: [sum(1 for r in rows if r["kind"] == k and r["h"] == h) for h in range(24)] for k in KINDS}
    show_eff = [round(math.exp(beta[72 + i]), 3) for i in range(len(BINS))]
    rain_eff = round(math.exp(beta[72 + len(BINS)]), 3)
    model = {
        "version": "v1", "period": "2024-07",
        "source": "올림픽공원 입출차 정보(2024년 7월, 215,528건) 시간별 744행 + 기상청 ASOS 서울 108 + 한국천문연구원 공휴일 + 누리집 공연 일정 9건, 월 보정은 올림픽공원 월별 주차현황(2023~2025년)",
        "formula": "입차(시간당) = 기준[요일구분][시] × 공연효과[시작까지 거리]^(대형공연) × 비효과^(비) × 월보정[월]",
        "thresholds": {"여유<": th[0], "보통<": th[1], "혼잡<": th[2]},
        "levels": ["여유", "보통", "혼잡", "매우 혼잡"], "levelsEn": ["Light", "Moderate", "Busy", "Very busy"],
        "kinds": KINDS, "base": base, "baseN": base_n,
        "showEffect": {"bins": [b[0] for b in BINS], "lo": [b[1] for b in BINS], "hi": [b[2] for b in BINS], "factor": show_eff,
                       "note": "대형 공연(KSPO DOME·핸드볼경기장) 시작 시각까지의 거리(시간) 구간별 배수. 시작 6시간 넘게 이른 시각에는 적용하지 않음. 2024년 7월 대형 공연일 8일에서 추정"},
        "rainEffect": rain_eff, "defaultStart": DEFAULT_START,
        "monthFactor": month_factor,
        "validation": {"method": "하루씩 빼고 31회 재추정(leave-one-day-out)", "hours": n,
                       "v1": {"mae": round(err1 / n, 1), "levelAgree": round(agree1 / n, 3)},
                       "cellAverage_v0": {"mae": round(err0 / n, 1), "levelAgree": round(agree0 / n, 3)},
                       "weekdayHourOnly": {"mae": round(errs / n, 1), "levelAgree": round(agrees / n, 3)}},
        "showDays": sorted({r["date"] for r in rows if r["big"]}),
        "limits": ["표본이 2024년 7월 한 달(대형 공연일 8일)이라 계절·연말 수요는 월 보정으로만 반영", "2024년 7월 토요일 4일이 모두 대형 공연일이어서 공연 없는 토요일 기준은 모형 가정으로 추정"],
    }
    json.dump(model, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("thresholds", th, "| showEffect", dict(zip(model["showEffect"]["bins"], show_eff)), "| rain", rain_eff)
    print("monthFactor", month_factor)
    print("CV v1 mae %.1f agree %.3f | cell v0 mae %.1f agree %.3f | weekday-hour only mae %.1f agree %.3f" % (err1 / n, agree1 / n, err0 / n, agree0 / n, errs / n, agrees / n))
    print("base wd 8h", base["wd"][8], "sat 15h", base["sat"][15], "sun 15h", base["sun"][15])


if __name__ == "__main__":
    main()
