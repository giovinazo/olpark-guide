"""주차 혼잡 예보 모델 v2.0 : data/source/*.csv → data/model.json

자료
- hourly_2025_15159093.csv : 올림픽공원 2025년 전체구역 입출차 정보(공공데이터포털 15159093, 2,411,225건)를 시간별로 모은 표.
                             원본 자료가 빠진 날(8·9·11·12월은 월 65,534건에서 멈춤, 매월 말일 0건)은 '자료상태'로 표시돼 있고, '정상' 235일만 사용
- asos108_2025.csv : 기상청 ASOS 서울(108) 2025년 시간자료(강수량 0.1mm 이상이면 비)
- sessions_2025_official_site.csv : 2025년 대형 공연(KSPO DOME·핸드볼경기장) 64건의 누리집 상세 글에서 읽은 회차 시각(132일·184회차)
- monthly_parking_15131671.csv : 월별 주차현황(2023~2025년) → 2025년 자료가 없는 달(8·9·11·12월)의 월 보정

모델(설명 가능한 곱셈 모형, 로그 선형 최소제곱)
  입차(시간당) ≈ 기준[요일구분][시] × 공연효과[시작까지 남은 시간 구간](대형 공연 회차가 있는 날) × 비효과(비) × 월보정[월]
  - 기준값 72칸(7월 수준), 월 효과는 자료가 있는 8개 달을 함께 추정(7월=1), 공연효과 5구간, 비효과 1개
검증
  - 하루씩 빼고(235회) 다시 추정해 그 날을 예측 → 평균 절대 오차·4단계 수준 일치율, 요일·시각 평균(월 보정 포함)과 비교
  - 대형 공연일만 따로 집계(공연 효과가 실제로 쓰이는 시간)
  - (2024년 7월 파일은 집계 범위가 달라(2025년 같은 달의 약 0.7배) 검증에 쓰지 않음)

실행: python3 scripts/build_model.py
"""
import csv, json, os, math, datetime as dt, collections
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
OUT = os.path.join(ROOT, "data", "model.json")
BINS = [("-6~-5", -6, -5), ("-4~-3", -4, -3), ("-2~-1", -2, -1), ("0", 0, 0), (">=1", 1, 99)]
KINDS = ["wd", "sat", "sun"]
DEFAULT_START = {"wd": 19, "sat": 18, "sun": 17}
MONTHS_FIT = [1, 2, 3, 4, 5, 6, 7, 10]          # 2025년 자료가 정상인 달(7월 = 기준)
NB = 72 + (len(MONTHS_FIT) - 1) + len(BINS) + 1


def bin_of(off):
    for i, (_, lo, hi) in enumerate(BINS):
        if off is not None and lo <= off <= hi:
            return i
    return None


def kind_of(yoil, hol):
    return "sun" if (yoil == "일" or (hol and hol != "주말")) else ("sat" if yoil == "토" else "wd")


def load_2025():
    rain = {}
    for r in csv.DictReader(open(os.path.join(SRC, "asos108_2025.csv"), encoding="utf-8-sig")):
        rain[r["tm"][:13]] = bool(r["rn"]) and float(r["rn"]) >= 0.1
    starts = collections.defaultdict(list)
    for s in csv.DictReader(open(os.path.join(SRC, "sessions_2025_official_site.csv"), encoding="utf-8-sig")):
        starts[s["날짜"]].append(int(s["시각"][:2]))
    out = []
    for r in csv.DictReader(open(os.path.join(SRC, "hourly_2025_15159093.csv"), encoding="utf-8-sig")):
        if r["자료상태"] != "정상":
            continue
        d, h = r["날짜"], int(r["시"])
        st = starts.get(d, [])
        out.append({"date": d, "month": int(d[5:7]), "kind": kind_of(r["요일"], r["휴일구분"]), "h": h, "big": bool(st),
                    "rain": rain.get(f"{d} {h:02d}", False), "off": min((h - s for s in st), key=abs) if st else None,
                    "y": int(r["입차대수"])})
    return out


def load_2024():
    import re
    starts = collections.defaultdict(list)
    for s in csv.DictReader(open(os.path.join(SRC, "shows_202407_official_site.csv"), encoding="utf-8-sig")):
        if s["공연장"] not in ("KSPO DOME", "핸드볼경기장"):
            continue
        d0, d1 = dt.date.fromisoformat(s["시작일"]), dt.date.fromisoformat(s["종료일"])
        per_wd = dict(re.findall(r"\((월|화|수|목|금|토|일)\)\s*(\d{1,2})", s["공연시간안내"]))
        single = re.fullmatch(r"\s*(\d{1,2}):\d{2}\s*", s["공연시간안내"])
        for n in range((d1 - d0).days + 1):
            d = d0 + dt.timedelta(n)
            h = per_wd.get("월화수목금토일"[d.weekday()]) or (single.group(1) if single else None)
            if h:
                starts[d.isoformat()].append(int(h))
    out = []
    for r in csv.DictReader(open(os.path.join(SRC, "link_table_202407.csv"), encoding="utf-8-sig")):
        d, h, k = r["날짜"], int(r["시"]), kind_of(r["요일"], r["휴일구분"])
        big = int(r["대형공연수"]) > 0
        st = starts.get(d) or ([DEFAULT_START[k]] if big else [])
        out.append({"date": d, "month": 7, "kind": k, "h": h, "big": big, "rain": bool(r["강수량"]) and float(r["강수량"]) >= 0.1,
                    "off": min((h - s for s in st), key=abs) if st else None, "y": int(r["입차대수"])})
    return out


def row_x(r):
    x = np.zeros(NB)
    x[KINDS.index(r["kind"]) * 24 + r["h"]] = 1
    if r["month"] != 7 and r["month"] in MONTHS_FIT:
        x[72 + [m for m in MONTHS_FIT if m != 7].index(r["month"])] = 1
    b = bin_of(r["off"]) if r["big"] else None
    if b is not None:
        x[72 + len(MONTHS_FIT) - 1 + b] = 1
    if r["rain"]:
        x[NB - 1] = 1
    return x


def fit(X, y):
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    return beta


def level(v, th):
    return 3 if v >= th[2] else 2 if v >= th[1] else 1 if v >= th[0] else 0


def main():
    rows = load_2025()
    X = np.array([row_x(r) for r in rows]); y = np.log1p(np.array([r["y"] for r in rows], float))
    beta = fit(X, y)
    # 월 보정: 자료가 있는 달은 추정값, 없는 달(8·9·11·12월)은 월별 주차현황의 7월 대비 비율
    mp = collections.defaultdict(dict)
    for m in csv.DictReader(open(os.path.join(SRC, "monthly_parking_15131671.csv"), encoding="utf-8-sig")):
        if m["주차장소"] == "올림픽공원":
            mp[m["연도"]][int(m["월"][:2])] = int(m["주차대수"])
    mf_file = [round(sum(mp[yy][mo] / mp[yy][7] for yy in mp if 7 in mp[yy] and mo in mp[yy]) /
                     max(1, sum(1 for yy in mp if 7 in mp[yy] and mo in mp[yy])), 3) for mo in range(1, 13)]
    others = [m for m in MONTHS_FIT if m != 7]
    est = {mo: math.exp(beta[72 + others.index(mo)]) for mo in others}
    # 월별 주차현황은 계절 폭이 더 커서(겹치는 7개 달에서 2025년 입출차 추정의 평균 약 0.7배), 빠진 달은 그 비율을 곱해 씀
    scale = math.exp(sum(math.log(est[mo] / mf_file[mo - 1]) for mo in others) / len(others))
    month_factor, month_src = [], []
    for mo in range(1, 13):
        if mo == 7:
            month_factor.append(1.0); month_src.append("기준")
        elif mo in others:
            month_factor.append(round(est[mo], 3)); month_src.append("2025년 입출차")
        else:
            month_factor.append(round(mf_file[mo - 1] * scale, 3)); month_src.append(f"월별 주차현황×{scale:.2f}")
    # 수준 경계: 월 보정을 걷어 낸(7월 수준) 시간별 입차의 50·75·90% 자리
    norm = sorted(r["y"] / month_factor[r["month"] - 1] for r in rows)
    th = [int(round(norm[int(len(norm) * p)])) for p in (.50, .75, .90)]

    def pred(b, r):
        return max(0.0, math.expm1(float(row_x(r) @ b)))

    # 하루씩 빼고 검증(235회)
    days = sorted({r["date"] for r in rows})
    idx = collections.defaultdict(list)
    for i, r in enumerate(rows):
        idx[r["date"]].append(i)
    # 요일·시각 평균(월 보정 포함) 비교용 합계
    tot = collections.defaultdict(lambda: [0.0, 0])
    for r in rows:
        k = (r["kind"], r["h"]); tot[k][0] += r["y"] / month_factor[r["month"] - 1]; tot[k][1] += 1
    acc = {"m": [0.0, 0, 0], "s": [0.0, 0, 0], "mb": [0.0, 0, 0], "sb": [0.0, 0, 0]}   # 오차합, 일치, 시간 수
    all_idx = np.arange(len(rows))
    for d in days:
        te = idx[d]; mask = np.ones(len(rows), bool); mask[te] = False
        b = fit(X[mask], y[mask])
        dsum = collections.defaultdict(lambda: [0.0, 0])
        for i in te:
            r = rows[i]; k = (r["kind"], r["h"]); dsum[k][0] += r["y"] / month_factor[r["month"] - 1]; dsum[k][1] += 1
        for i in te:
            r = rows[i]; k = (r["kind"], r["h"])
            s_, n_ = tot[k][0] - dsum[k][0], tot[k][1] - dsum[k][1]
            mf = month_factor[r["month"] - 1]
            pm, ps = pred(b, r), (s_ / n_ * mf if n_ else 0.0)
            thm = [t * mf for t in th]
            for key, p in (("m", pm), ("s", ps)):
                for kk in ((key,) + ((key + "b",) if r["big"] else ())):
                    acc[kk][0] += abs(p - r["y"]); acc[kk][1] += level(p, thm) == level(r["y"], thm); acc[kk][2] += 1
    res = {k: {"mae": round(v[0] / v[2], 1), "levelAgree": round(v[1] / v[2], 3), "hours": v[2]} for k, v in acc.items()}
    base = {k: [round(math.expm1(beta[KINDS.index(k) * 24 + h]), 1) for h in range(24)] for k in KINDS}
    base_n = {k: [sum(1 for r in rows if r["kind"] == k and r["h"] == h) for h in range(24)] for k in KINDS}
    o = 72 + len(others)
    show_eff = [round(math.exp(beta[o + i]), 3) for i in range(len(BINS))]
    rain_eff = round(math.exp(beta[NB - 1]), 3)
    n_days = len(days); n_big = len({r["date"] for r in rows if r["big"]})
    n_bigsat = len({r["date"] for r in rows if r["big"] and r["kind"] == "sat"}); n_sat = len({r["date"] for r in rows if r["kind"] == "sat"})
    model = {
        "version": "v2.0", "period": "2025", "thresholdsScaleWithMonth": True,
        "source": f"올림픽공원 2025년 전체구역 입출차 정보(API 15159093, 2,411,225건) 중 원본 자료가 온전한 {n_days}일({len(rows):,}시간) + 기상청 ASOS 서울 108 + 한국천문연구원 공휴일 + 누리집 2025년 대형 공연 64건 회차 시각, 자료가 빠진 달의 월 보정은 월별 주차현황(2023~2025년)",
        "formula": "입차(시간당) = 기준[요일구분][시] × 공연효과[공연 시작까지 남은 시간](대형 공연일 때만) × 비효과(비 올 때만) × 월보정[월]",
        "thresholds": {"여유<": th[0], "보통<": th[1], "혼잡<": th[2]},
        "levels": ["여유", "보통", "혼잡", "매우 혼잡"], "levelsEn": ["Light", "Moderate", "Busy", "Very busy"],
        "kinds": KINDS, "base": base, "baseN": base_n,
        "showEffect": {"bins": [b[0] for b in BINS], "lo": [b[1] for b in BINS], "hi": [b[2] for b in BINS], "factor": show_eff,
                       "note": f"대형 공연(KSPO DOME·핸드볼경기장) 공연 시작까지 남은 시간 구간별 배수. 시작 6시간 넘게 이른 시각에는 적용하지 않음. 2025년 대형 공연일 {n_big}일에서 추정"},
        "rainEffect": rain_eff, "defaultStart": DEFAULT_START,
        "monthFactor": month_factor, "monthSource": month_src,
        "validation": {"method": f"하루씩 빼고 {n_days}회 재추정(leave-one-day-out)", "days": n_days, "hours": len(rows), "bigDays": n_big,
                       "v2": res["m"], "weekdayHourOnly": res["s"], "v2_bigDays": res["mb"], "weekdayHourOnly_bigDays": res["sb"]},
        "showDays": sorted({r["date"] for r in rows if r["big"]}),
        "counts": {"days": n_days, "bigDays": n_big, "saturdays": n_sat, "bigSaturdays": n_bigsat},
        "limits": [f"2025년 입출차 중 원본 자료가 빠진 8·9·11·12월과 매월 말일은 쓰지 않아, 그 달들의 월 보정은 월별 주차현황 비율(×{scale:.2f})로 대신함",
                   f"2025년 토요일 {n_sat}일 중 {n_bigsat}일이 대형 공연일이라 대형 공연 없는 토요일 기준값은 모델 가정의 비중이 큼",
                   "수준은 그 시간에 공원 전체로 들어오는 차의 수 기준이며 빈자리 수가 아님"],
    }
    json.dump(model, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("days", n_days, "hours", len(rows), "bigDays", n_big, "sat", n_sat, "bigSat", n_bigsat)
    print("thresholds(7월 수준)", th, "| showEffect", dict(zip(model["showEffect"]["bins"], show_eff)), "| rain", rain_eff)
    print("monthFactor", month_factor, month_src)
    print("LOO", json.dumps(res, ensure_ascii=False))
    print("base sat 16h", base["sat"][16], "wd 8h", base["wd"][8])


if __name__ == "__main__":
    main()
