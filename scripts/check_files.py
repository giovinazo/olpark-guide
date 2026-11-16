"""기관 개방 파일 2종 점검 → data/files_check.json

- 올림픽공원 주차장 혼잡도 정보(공공데이터포털 15164156) : 등록시간 칸의 분:초가 등록일의 월:일과 같은지(시각 칸이 실제 시각이 아닌 문제), 연도별 건수, 구역·등급 분포
  + 대형 공연일 대조: 등록일이 KSPO DOME·핸드볼경기장 공연 기간(data/shows.json)에 드는지로 나누고, 주말·공휴일(data/holidays.json)과 평일을 따로 만차 비율 비교
- 올림픽공원 월별 주차현황(15131671) : 월별 추이와 7월 대비 비율, 입출차 정보(2024년 7월)와의 규모 차이

실행: python3 scripts/check_files.py
"""
import csv, json, os, collections, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
OUT = os.path.join(ROOT, "data", "files_check.json")


def congestion():
    rows = list(csv.DictReader(open(os.path.join(SRC, "parking_congestion_15164156.csv"), encoding="utf-8-sig")))
    same = sum(1 for r in rows if r["등록시간"][3:8] == f"{r['등록일'][5:7]}:{r['등록일'][8:10]}")
    years = collections.Counter(r["등록일"][:4] for r in rows)
    zones = collections.Counter(r["주차구역"] for r in rows)
    grades = collections.Counter(r["혼잡도"] for r in rows)
    dates = sorted({r["등록일"] for r in rows})
    sd = show_days(rows, dates)
    return {"rows": len(rows), "dateRange": [dates[0], dates[-1]], "distinctDays": len(dates),
            "timeMinSecEqualsMonthDay": same, "years": dict(sorted(years.items())),
            "zones": dict(zones.most_common()), "grades": dict(grades.most_common()), "showDays": sd,
            "finding": "등록시간의 분:초가 등록일의 월:일과 같은 행이 전부여서 시각 칸을 실제 시각으로 쓸 수 없음. 하루 몇 건의 수기 등록이라 시간대 혼잡 지표로는 부족"}


def show_days(rows, dates):
    """등록일 단위 대조(등록시간은 실제 시각이 아니므로 날짜만 씀)"""
    shows = [s for s in json.load(open(os.path.join(ROOT, "data", "shows.json"), encoding="utf-8"))["shows"] if s["big"]]
    hol = {f"{h[:4]}-{h[4:6]}-{h[6:]}" for h in json.load(open(os.path.join(ROOT, "data", "holidays.json"), encoding="utf-8"))["holidays"]}
    big = {d for d in dates if any(s["start"] <= d <= s["end"] for s in shows)}
    kind = lambda d: "weekend" if dt.date.fromisoformat(d).weekday() >= 5 or d in hol else "weekday"
    out = {}
    for k in ("all", "weekend", "weekday"):
        for g in ("big", "other"):
            ds = [d for d in dates if (d in big) == (g == "big") and (k == "all" or kind(d) == k)]
            rs = [r for r in rows if r["등록일"] in ds]
            full = sum(1 for r in rs if r["혼잡도"] == "만차")
            out[f"{k}_{g}"] = {"days": len(ds), "rows": len(rs), "full": full, "fullPct": round(100 * full / len(rs), 1) if rs else None}
    a, w, d = out["all_big"], out["weekend_big"], out["weekday_big"]
    ao, wo, do = out["all_other"], out["weekend_other"], out["weekday_other"]
    out["finding"] = (f"대형 공연일 대조: 만차 비율은 대형 공연일 {a['fullPct']}%({a['days']}일 {a['rows']}건), 그 밖 {ao['fullPct']}%({ao['days']}일 {ao['rows']}건)로 보이지만, "
                      f"주말·공휴일만 놓으면 {w['fullPct']}%({w['days']}일)와 {wo['fullPct']}%({wo['days']}일)로 차이가 없음. 평일은 대형 공연일 {d['fullPct']}%({d['days']}일), 그 밖 {do['fullPct']}%({do['days']}일). "
                      f"등록이 대형 공연이 있는 주말에 몰려 있어 이 자료로는 공연 효과를 요일 효과와 떼어 확인할 수 없음")
    return out


def monthly():
    rows = [r for r in csv.DictReader(open(os.path.join(SRC, "monthly_parking_15131671.csv"), encoding="utf-8-sig")) if r["주차장소"] == "올림픽공원"]
    by = collections.defaultdict(dict)
    for r in rows:
        by[r["연도"]][int(r["월"][:2])] = int(r["주차대수"])
    july_gate = 215528  # 입출차 정보 2024년 7월 입차 건수
    return {"years": sorted(by), "table": {y: [by[y].get(m) for m in range(1, 13)] for y in sorted(by)},
            "july2024": by.get("2024", {}).get(7), "gateJuly2024": july_gate,
            "ratioGateToMonthly": round(july_gate / by["2024"][7], 2) if by.get("2024", {}).get(7) else None,
            "finding": "월별 주차현황 2024년 7월(59,808대)은 입출차 정보 같은 달 입차(215,528건)의 약 1/3.6으로 집계 기준이 다름(유료 정산 대수 등으로 추정). 서비스는 월별 상대 비율(7월 대비)만 계절 보정에 씀"}


def main():
    out = {"updated": dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M"), "congestion": congestion(), "monthly": monthly()}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: (v if k == "updated" else {kk: vv for kk, vv in v.items() if kk in ("rows", "timeMinSecEqualsMonthDay", "years", "ratioGateToMonthly")}) for k, v in out.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
