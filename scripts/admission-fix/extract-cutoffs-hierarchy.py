#!/usr/bin/env python3
"""
استخراج مستقل لملف «الحدود الدنيا للقبول المركزي 2025-2026» مباشرةً من طبقة النص في PDF الرسمي
(لا من data/raw/hodod.full.txt)، ثم:
  1) مقارنة كل صف بصفوف المنصة الخام (data/raw/cutoffs_2025_2026.json) رقماً رقماً.
  2) فرز الصفوف إلى «بقسم» و«كلية بلا قسم».
  3) ترتيبها هرمياً: المحافظة ← الجامعة ← الكلية (+الحرم/المسار) ← القسم.

التشغيل (من جذر المشروع):  python -I scripts/admission-fix/extract-cutoffs-hierarchy.py
يتطلب: pip install pypdfium2.   المخرجات: reports/admission-fix/cutoffs-extraction/
"""
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

import pypdfium2 as pdfium

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PDF = os.path.join(ROOT, "الحدودالدنياالقبول-المركزي-القناةالعامة__للسنة_الدراسية_2025-2026.pdf")
OUT = os.path.join(ROOT, "reports", "admission-fix", "cutoffs-extraction")
os.makedirs(OUT, exist_ok=True)


def norm(s: str) -> str:
    """مفتاح مقارنة: يوحّد الهمزات ويحذف الألف واللام المشوَّهة والمسافات (كما في normKey)."""
    s = (s or "").replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    s = s.replace("ة", "ه").replace("ى", "ي")
    s = s.replace("ا", "")
    return re.sub(r"\s+", "", s)


# ── 1) طبقة النص ─────────────────────────────────────────────────────
pdf = pdfium.PdfDocument(PDF)
ROW = re.compile(r"^(?P<name>.+?)\s+(?P<total>\d+\.\d{2})\s+(?P<avg>\d+\.\d{2})\s+(?P<rank>\d+)\s+"
                 r"(?P<branch>علمي|ادبي|فنون)\s+(?P<gender>مختلط|انثى|ذكر)\s*$")
FOOT = re.compile(r"صفحة\s*(\d+)\s*من\s*(\d+)")
SKIP = ("الحدود الدنيا", "للسنة الدراسية", "وزارة التعليم", "دائرة الدراسات", "اسم الجامعة")

source_rows = []
unparsed = []
for pi in range(len(pdf)):
    text = pdf[pi].get_textpage().get_text_range()
    page_no = None
    m = FOOT.search(text)
    if m:
        page_no = int(m.group(1))
    buf = ""
    for line in text.replace("\r", "").split("\n"):
        line = line.strip()
        if not line or FOOT.search(line) or any(line.startswith(k) for k in SKIP):
            continue
        cand = (buf + " " + line).strip() if buf else line
        r = ROW.match(cand)
        if r:
            d = r.groupdict()
            d["page"] = page_no if page_no else pi
            d["index_on_page"] = sum(1 for x in source_rows if x["page"] == d["page"]) + 1
            source_rows.append(d)
            buf = ""
        else:
            buf = cand
    if buf:
        unparsed.append((page_no or pi, buf))

# ── 2) المقارنة بالخام ───────────────────────────────────────────────
raw = json.load(open(os.path.join(ROOT, "data", "raw", "cutoffs_2025_2026.json"), encoding="utf8"))
BR = {"علمي": "علمي", "ادبي": "أدبي", "فنون": "فنون"}
GN = {"مختلط": "مختلط", "انثى": "أنثى", "ذكر": "ذكر"}


def key_num(total, avg, rank, branch, gender):
    return (round(float(total), 2), round(float(avg), 2), int(rank), branch, gender)


raw_pool = defaultdict(list)
for r in raw:
    raw_pool[key_num(r["totalScore"], r["averagePercent"], r["rank"], r["branch"], r["gender"])].append(r)

matched = 0
name_diff = []
not_in_raw = []
for s in source_rows:
    k = key_num(s["total"], s["avg"], s["rank"], BR[s["branch"]], GN[s["gender"]])
    pool = raw_pool.get(k, [])
    if not pool:
        not_in_raw.append(s)
        s["raw_match"] = False
        continue
    cand = pool.pop(0)
    s["raw_match"] = True
    matched += 1
    # اسم المصدر مقابل اسم الخام (جامعة+كلية+[قسم]) بعد التطبيع
    raw_full = norm(cand["university"] + "/" + cand["college"] + ("-" + cand["department"] if cand["department"] else ""))
    src_full = norm(s["name"].replace("/", "/").replace(" ", ""))
    if norm(cand["university"]) not in src_full or norm(cand["college"].split("/")[0]) not in src_full:
        name_diff.append((s["name"], cand["university"], cand["college"], cand.get("department")))
leftover_raw = [r for pool in raw_pool.values() for r in pool]

# ── 3) الحساب: المعدل = المجموع ÷ 7 ──────────────────────────────────
arith_bad = []
for s in source_rows:
    t, a = float(s["total"]), float(s["avg"])
    if abs(round(t / 7, 2) - a) > 0.011:
        arith_bad.append(s)

# ── 4) تفكيك الاسم ───────────────────────────────────────────────────
uni_json = json.load(open(os.path.join(ROOT, "data", "universities.json"), encoding="utf8"))["universities"]
uni_province = {norm(u["name"]): (u["name"], u["province"]) for u in uni_json if u.get("type") == "حكومية"}
camp = json.load(open(os.path.join(ROOT, "data", "campus-qualifiers.json"), encoding="utf8"))
campus_province = dict(camp["qualifiers"])
campus_province.update({k: v for k, v in camp["namedCampuses"].items() if not k.startswith("_")})
campus_province_n = {norm(k): v for k, v in campus_province.items()}
PROVINCES = {"بغداد", "البصرة", "نينوى", "النجف", "صلاح الدين", "الديوانية", "الأنبار", "بابل", "ديالى", "كربلاء",
             "ذي قار", "كركوك", "واسط", "ميسان", "المثنى"}
PROVINCES_N = {norm(p): p for p in PROVINCES}
QUOTA_LABEL = re.compile(r"ابناء|شهداء|متميز|اوائل")


def is_track(p: str) -> bool:
    """«التخصصات الطبية» و«الاقسام الهندسية» و«الفنون التطبيقية» أسماء مسارات لا أحرم (مع تشوّه «االقسام»)."""
    n = norm(p)
    return n.startswith(("تخصصت", "لتخصصت", "لقسم", "قسم")) or n in {"لفنونلتطبيقيه", "فنونلتطبيقيه"}


def split_name(name: str):
    uni, _, rest = name.partition("/")
    dept = None
    # القسم بعد أول «-» يلي اسم الكلية/الحرم/المسار
    if "-" in rest:
        rest, _, dept = rest.partition("-")
        dept = dept.strip()
    parts = [p.strip() for p in rest.split("/") if p.strip()]
    college = parts[0] if parts else ""
    campus = track = None
    quota = False
    for p in parts[1:]:
        if QUOTA_LABEL.search(p):
            quota = True
        elif is_track(p):
            track = p
        else:
            campus = p
    return uni.strip(), college, campus, track, dept, quota


def lookup_campus_province(label: str):
    m = re.search(r"[()](.*?)[()]", label)
    if m and norm(m.group(1)) in PROVINCES_N:
        return PROVINCES_N[norm(m.group(1))]
    c = re.sub(r"[()].*?[()]", "", label).strip()
    for cand in (c, c.replace("بغداد ", "").strip()):
        n = norm(cand)
        if n in PROVINCES_N:
            return PROVINCES_N[n]
        if n in campus_province_n:
            return campus_province_n[n]
    if c.startswith("بغداد"):
        return "بغداد"
    return None


def province_of(uni_name, college, campus):
    """محافظة الحرم/المعهد إن عُرفت (حرم صريح، أو مدينة في آخر اسم كلية/معهد بجامعة تقنية)، وإلا محافظة الجامعة."""
    if campus:
        p = lookup_campus_province(campus)
        if p:
            return p
    if "التقنية" in uni_name:
        p = lookup_campus_province(college)
        if p:
            return p
        last = re.sub(r"[()].*?[()]", "", college).split()[-1] if college.split() else ""
        p = lookup_campus_province(last)
        if p:
            return p
    u = uni_province.get(norm(uni_name))
    return u[1] if u else "غير معروفة"


rows = []
for s in source_rows:
    uni, college, campus, track, dept, quota = split_name(s["name"])
    canon = uni_province.get(norm(uni), (uni, ""))[0]
    rows.append(
        {
            "page": s["page"],
            "row_on_page": s["index_on_page"],
            "province": province_of(uni, college, campus),
            "university": canon,
            "college": college,
            "campus": campus or "",
            "track": track or "",
            "department": dept or "",
            "level": "قسم" if dept else ("مسار" if track else "كلية"),
            "quota": "حصة" if quota else "",
            "branch": BR[s["branch"]],
            "gender": GN[s["gender"]],
            "total": float(s["total"]),
            "average": float(s["avg"]),
            "rank": int(s["rank"]),
            "in_platform_raw": s["raw_match"],
            "source_text": s["name"],
        }
    )

COLS = list(rows[0].keys())


def write_csv(path, data):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:  # BOM لفتحه في Excel بالعربية
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(data)


order = lambda r: (r["province"], r["university"], r["college"], r["campus"], r["track"], r["department"], r["branch"], -r["average"])
rows_sorted = sorted(rows, key=order)
with_dept = [r for r in rows_sorted if r["department"]]
college_only = [r for r in rows_sorted if not r["department"]]
json.dump(rows_sorted, open(os.path.join(OUT, "rows.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
# ملاحظة: الملفات الظاهرة للمستخدم (CSV بأسماء مصحَّحة + hierarchy.md) يولّدها
# scripts/admission-fix/polish-cutoffs-extraction.js من rows.json بعد إصلاح تشوّه «ال» (displayName.js).
write_csv(os.path.join(OUT, "all-rows-ordered.csv"), rows_sorted)
write_csv(os.path.join(OUT, "1-with-department.csv"), with_dept)
write_csv(os.path.join(OUT, "2-college-or-track-only.csv"), college_only)

# شجرة مقروءة
tree = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
for r in rows_sorted:
    cname = r["college"] + (f" / {r['campus']}" if r["campus"] else "") + (f" / {r['track']}" if r["track"] else "")
    tree[r["province"]][r["university"]][cname][r["department"] or "—(حد الكلية/المسار)"].append(r)


def fmt(rs):
    return " · ".join(f"{r['branch']}{'' if r['gender']=='مختلط' else ' '+r['gender']} {r['average']:.2f}{' (حصة)' if False else ''}" for r in rs)


lines = ["# الحدود الدنيا للقبول المركزي 2025-2026 — ترتيب هرمي", "",
         "المحافظة ← الجامعة ← الكلية (+الحرم/المسار) ← القسم. الأرقام: المعدل لكل فرع (والجنس إن خُصِّص).", ""]
for prov in sorted(tree):
    lines.append(f"## {prov}")
    for uni in sorted(tree[prov]):
        lines.append(f"### {uni}")
        for col in sorted(tree[prov][uni]):
            lines.append(f"- **{col}**")
            for dep in sorted(tree[prov][uni][col], key=lambda d: (d.startswith("—"), d)):
                lines.append(f"  - {dep}: {fmt(tree[prov][uni][col][dep])}")
        lines.append("")
open(os.path.join(OUT, "hierarchy.md"), "w", encoding="utf8").write("\n".join(lines) + "\n")

# ملخص الدقة
quota_like = [r for r in rows if r["quota"]]
summary = {
    "pdf_pages": len(pdf),
    "source_rows": len(source_rows),
    "raw_rows": len(raw),
    "matched_exact_numbers_branch_gender": matched,
    "source_rows_not_in_raw": len(not_in_raw),
    "raw_rows_not_in_source": len(leftover_raw),
    "name_mismatch_university_or_college": len(name_diff),
    "arithmetic_average_ne_total_over_7": len(arith_bad),
    "unparsed_fragments": len(unparsed),
    "with_department": len(with_dept),
    "college_or_track_only": len(college_only),
    "by_level": Counter(r["level"] for r in rows),
    "pages_15_24_rows": sum(1 for r in rows if 15 <= r["page"] <= 24),
    "provinces": len({r["province"] for r in rows}),
    "universities": len({r["university"] for r in rows}),
    "unknown_province": sorted({r["university"] for r in rows if r["province"] == "غير معروفة"}),
    "quota_rows": len(quota_like),
}
json.dump(
    {
        "summary": summary,
        "source_not_in_raw": [{"page": s["page"], "name": s["name"], "avg": s["avg"]} for s in not_in_raw],
        "raw_not_in_source": [
            {"university": r["university"], "college": r["college"], "department": r["department"], "avg": r["averagePercent"]}
            for r in leftover_raw
        ],
        "name_mismatch": [list(x) for x in name_diff][:50],
        "arith_bad": [{"page": s["page"], "name": s["name"], "total": s["total"], "avg": s["avg"]} for s in arith_bad],
        "unparsed": [{"page": p, "text": t} for p, t in unparsed],
    },
    open(os.path.join(OUT, "accuracy.json"), "w", encoding="utf8"),
    ensure_ascii=False,
    indent=2,
)
print(json.dumps(summary, ensure_ascii=False, indent=2, default=dict))
