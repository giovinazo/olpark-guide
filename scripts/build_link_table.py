"""입출차 원자료 → 시간별 연계표(data/source/link_table_202407.csv)

입력(data/source/raw/에 둘 것, 모두 공공데이터포털·기관 공개 자료):
  - 15138735_입출차.csv
  - 기상청ASOS_서울108_시간자료_202407.csv
  - 올림픽공원_누리집_공연일정_202407.csv
  - 천문연_공휴일_2024_2025.csv
출력: data/source/link_table_202407.csv (744행: 시간별 입차·출차·재차·기상·공휴일·공연 수)
"""
import csv, datetime as dt, collections, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW8 = os.path.join(BASE, "data", "source", "raw")   # 공공데이터포털 원자료(15138735_입출차.csv 등)를 받아 둘 폴더
RAW10 = os.path.join(BASE, "data", "source", "raw")
OUT = os.path.join(BASE, "data", "source", "link_table_202407.csv")
Y, M = 2024, 7
DAYS = "월화수목금토일"


def read_csv(path):
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            with open(path, encoding=enc) as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"인코딩 실패: {path}")


def hour_key(s):  # 'YYYY-MM-DD HH:MM' -> datetime(hour)
    return dt.datetime.strptime(s[:13], "%Y-%m-%d %H")


# 1) 입출차 → 시간별 입차·출차·재차
io = read_csv(os.path.join(RAW8, "15138735_입출차.csv"))
k_in = next(k for k in io[0] if "입차일시" in k)
k_out = next(k for k in io[0] if "출차일시" in k)
inc, outc = collections.Counter(), collections.Counter()
for r in io:
    inc[hour_key(r[k_in])] += 1
    if r[k_out].strip():
        outc[hour_key(r[k_out])] += 1

# 2) 날씨
wx = {}
for r in read_csv(os.path.join(RAW10, "기상청ASOS_서울108_시간자료_202407.csv")):
    wx[dt.datetime.strptime(r["tm"], "%Y-%m-%d %H:%M")] = r

# 3) 공휴일
hol = {}
for r in read_csv(os.path.join(RAW10, "천문연_공휴일_2024_2025.csv")):
    hol[str(r["locdate"])] = r["dateName"]

# 4) 공연 일정 = 올림픽공원 누리집 일정안내(2024.07) 수기 수집본. 기간(시작~종료)으로 날짜별 전개
#    (영문 공연정보 파일의 "공연일자"는 실제 공연일과 어긋나 6건 중 4건 불일치 → 참고용으로만 남김)
BIG = ("KSPO DOME", "핸드볼경기장")  # 대형 공연장(수천~만 명)
shows, big_shows = collections.defaultdict(list), collections.defaultdict(int)
for r in read_csv(os.path.join(RAW10, "올림픽공원_누리집_공연일정_202407.csv")):
    d0 = dt.date.fromisoformat(r["시작일"]); d1 = dt.date.fromisoformat(r["종료일"])
    d = d0
    while d <= d1:
        if d.year == Y and d.month == M:
            shows[d.isoformat()].append(f'{r["공연명"]}({r["공연장"]})')
            if r["공연장"] in BIG:
                big_shows[d.isoformat()] += 1
        d += dt.timedelta(days=1)

# 5) 744행 조립
rows, occ = [], 0
start = dt.datetime(Y, M, 1)
end = dt.datetime(Y, M + 1, 1)
t = start
while t < end:
    occ += inc[t] - outc[t]
    d = t.strftime("%Y-%m-%d")
    w = wx.get(t, {})
    wd = DAYS[t.weekday()]
    holiday = hol.get(t.strftime("%Y%m%d"), "")
    rows.append({
        "일시": t.strftime("%Y-%m-%d %H:00"), "날짜": d, "시": t.hour, "요일": wd,
        "휴일구분": holiday or ("주말" if t.weekday() >= 5 else ""),
        "입차대수": inc[t], "출차대수": outc[t], "재차대수(누적)": occ,
        "기온": w.get("ta", ""), "강수량": w.get("rn", ""), "풍속": w.get("ws", ""),
        "풍향": w.get("wd", ""), "습도": w.get("hm", ""), "운량": w.get("dc10Tca", ""),
        "공연수": len(shows.get(d, [])), "대형공연수": big_shows.get(d, 0), "공연명": " / ".join(shows.get(d, [])),
    })
    t += dt.timedelta(hours=1)

with open(OUT, "w", newline="", encoding="utf-8-sig") as f:
    wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    wr.writeheader(); wr.writerows(rows)

# 6) 점검 요약
print("행수", len(rows), "| 입차 합", sum(inc.values()), "| 출차 합(7월 내)", sum(outc[r] for r in [start + dt.timedelta(hours=i) for i in range(len(rows))]))
print("날씨 결측 시각", sum(1 for r in rows if r["기온"] == ""))
print("공연 있는 날", len(shows), "| 대형공연 날", sorted(big_shows))
top = sorted(rows, key=lambda r: -r["입차대수"])[:5]
print("입차 최다 5시각:", [(r["일시"], r["요일"], r["입차대수"]) for r in top])
print("재차 누적 최대", max(r["재차대수(누적)"] for r in rows), "최소", min(r["재차대수(누적)"] for r in rows))
print("저장:", OUT)
