"use client";

import { useEffect, useState } from "react";
import { Building2, Landmark, Wallet, AlertCircle, Trophy } from "lucide-react";
import majorsData from "../../data/majors.json";
import { MajorPicker } from "../components/MajorPicker";
import { ChannelNotice } from "../components/ChannelNotice";
import { fetchOfferingsForMajor } from "../../lib/offeringsClient";
import { IconBadge, Badge, Card, Alert } from "../components/ui";
import { Reveal } from "../components/motion/Reveal";
import { splitOfferings, sortByFeeAscending, computeCheapestHighlight, offeringKey } from "../../lib/costCompare";
import {
  TUITION_NOT_PUBLISHED,
  GOVERNMENT_NO_COMPARABLE_FEE,
  TUITION_UNVERIFIED_SOURCE_NOTE,
} from "../../lib/admissionDisclosure";
import type { UniversityOffering } from "../../lib/majorMatcher";

function formatFee(amount: number): string {
  return `${amount.toLocaleString("ar-IQ")} د.ع`;
}

export default function CostPage() {
  const [majorId, setMajorId] = useState("");
  const [offerings, setOfferings] = useState<UniversityOffering[] | null>(null);
  const major = majorsData.find((m) => m.id === majorId);

  useEffect(() => {
    if (!majorId) {
      setOfferings(null);
      return;
    }
    let cancelled = false;
    fetchOfferingsForMajor(majorId).then((o) => {
      if (!cancelled) setOfferings(o);
    });
    return () => {
      cancelled = true;
    };
  }, [majorId]);

  const { private: priv, unverifiedPrivate, government } = offerings
    ? splitOfferings(offerings)
    : { private: [], unverifiedPrivate: [], government: [] };
  const sortedPrivate = sortByFeeAscending(priv);
  const cheapestKey = computeCheapestHighlight(priv);

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-8 pb-8">
      <div
        className="relative -mx-4 overflow-hidden px-4 pb-10 pt-10 md:-mx-8 md:px-8"
        style={{ background: "var(--g-surface)" }}
      >
        <Wallet
          aria-hidden="true"
          className="pointer-events-none absolute -end-8 -top-8 h-56 w-56 text-primary-100 md:h-72 md:w-72"
          strokeWidth={1}
        />
        <div className="relative">
          <IconBadge icon={Wallet} size="lg" />
          <h1 className="mt-4 text-3xl font-black text-ink">كلفة الدراسة الأهلية</h1>
          <p className="mt-1 text-ink-soft">قارن أجور الجامعات الأهلية لنفس التخصص قبل ما تقرّر.</p>
        </div>
      </div>

      <Card variant="glass">
        <MajorPicker index={0} value={majorId} excludeIds={[]} onChange={setMajorId} />
      </Card>

      <ChannelNotice />

      {!major && (
        <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-line py-16 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-8 opacity-[0.07]"
          >
            <Building2 className="h-28 w-28 md:h-36 md:w-36" strokeWidth={1} />
            <Wallet className="h-40 w-40 md:h-52 md:w-52" strokeWidth={1} />
            <Landmark className="h-28 w-28 md:h-36 md:w-36" strokeWidth={1} />
          </div>
          <IconBadge icon={Wallet} size="lg" className="relative" />
          <p className="relative font-bold text-ink">اختر تخصصك أعلاه لعرض الأجور</p>
          <p className="relative max-w-sm text-sm text-ink-muted">
            نطابقه فوراً مع كل الجامعات الأهلية الموثَّقة لنفس التخصص، ونرتّبها من الأرخص.
          </p>
        </div>
      )}

      {major && offerings === null && <p className="text-center text-ink-muted">جارٍ التحميل...</p>}

      {major && offerings && sortedPrivate.length === 0 && unverifiedPrivate.length === 0 && government.length === 0 && (
        <p className="text-center text-ink-muted">لا تتوفر عروض جامعات موثَّقة لهذا التخصص حالياً.</p>
      )}

      {major && sortedPrivate.length > 0 && (
        <Reveal>
        <Card variant="surface" padding="" className="overflow-hidden">
          <div className="relative flex items-center gap-3 overflow-hidden border-b border-line p-6">
            <Building2
              aria-hidden="true"
              className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 text-primary-100 md:h-28 md:w-28"
              strokeWidth={1}
            />
            <IconBadge icon={Building2} className="relative" />
            <h2 className="relative font-bold text-ink">الجامعات الأهلية</h2>
          </div>
          <div className="divide-y divide-line">
            {sortedPrivate.map((o) => {
              const key = offeringKey(o);
              const isCheapest = key === cheapestKey;
              return (
                <div key={key} className={`p-5 ${isCheapest ? "bg-band-safe-bg" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{o.universityName}</p>
                      <p className="text-sm text-ink-soft">{o.departmentName}</p>
                      {o.confidence <= 60 && (
                        <Badge tone="muted" className="mt-1">
                          تخصص قريب
                        </Badge>
                      )}
                    </div>
                    {isCheapest && (
                      <Badge tone="safe" icon={Trophy}>
                        الأرخص من بين المنشور
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <div>
                      <span className="text-ink-muted">صباحي: </span>
                      {o.tuitionFees?.["صباحي"] != null ? (
                        <span className="font-bold text-ink">{formatFee(o.tuitionFees["صباحي"])}</span>
                      ) : (
                        <span className="text-ink-muted">{TUITION_NOT_PUBLISHED}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-ink-muted">مسائي: </span>
                      {o.tuitionFees?.["مسائي"] != null ? (
                        <span className="font-bold text-ink">{formatFee(o.tuitionFees["مسائي"])}</span>
                      ) : (
                        <span className="text-ink-muted">{TUITION_NOT_PUBLISHED}</span>
                      )}
                    </div>
                    {o.admissionSuspended && <Badge tone="reach">القبول متوقف هذا العام</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        </Reveal>
      )}

      {major && unverifiedPrivate.length > 0 && (
        <Reveal>
        <Alert tone="info" icon={AlertCircle}>
          {TUITION_UNVERIFIED_SOURCE_NOTE}
        </Alert>
        </Reveal>
      )}

      {major && government.length > 0 && (
        <Reveal>
        <Card variant="surface" padding="" className="overflow-hidden">
          <div className="relative flex items-center gap-3 overflow-hidden p-6 pb-3">
            <Landmark
              aria-hidden="true"
              className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 text-primary-100 md:h-28 md:w-28"
              strokeWidth={1}
            />
            <IconBadge icon={Landmark} className="relative" />
            <h2 className="relative font-bold text-ink">الجامعات الحكومية</h2>
          </div>
          <div className="px-6 pb-6">
            <p className="mb-3 text-sm text-ink-soft">{GOVERNMENT_NO_COMPARABLE_FEE}</p>
            <ul className="grid gap-1.5 text-sm text-ink-soft">
              {government.map((o) => (
                <li key={offeringKey(o)}>
                  {o.universityName} — {o.departmentName}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Alert tone="info" icon={AlertCircle}>
        الأرقام من دليل أجور الجامعات الأهلية الرسمي للعام الدراسي الحالي — قد تتغيّر الأجور من عام لآخر، وبعض الأقسام
        لا تُنشَر أجورها في الدليل. راجع الجامعة مباشرة قبل أي قرار نهائي.
      </Alert>
    </div>
  );
}
