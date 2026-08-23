"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Wallet, AlertCircle, Trophy } from "lucide-react";
import majorsData from "../../data/majors.json";
import { MajorPicker } from "../components/MajorPicker";
import { ChannelNotice } from "../components/ChannelNotice";
import { fetchOfferingsForMajor } from "../../lib/offeringsClient";
import { IconBadge, Badge, Card, Alert } from "../components/ui";
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

      {major && offerings === null && <p className="text-center text-ink-muted">جارٍ التحميل...</p>}

      {major && offerings && sortedPrivate.length === 0 && unverifiedPrivate.length === 0 && government.length === 0 && (
        <p className="text-center text-ink-muted">لا تتوفر عروض جامعات موثَّقة لهذا التخصص حالياً.</p>
      )}

      {major && sortedPrivate.length > 0 && (
        <Card variant="surface" padding="" className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line p-6">
            <IconBadge icon={Wallet} />
            <h2 className="font-bold text-ink">الجامعات الأهلية</h2>
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
      )}

      {major && unverifiedPrivate.length > 0 && (
        <Alert tone="info" icon={AlertCircle}>
          {TUITION_UNVERIFIED_SOURCE_NOTE}
        </Alert>
      )}

      {major && government.length > 0 && (
        <Card variant="surface" padding="p-6">
          <div className="mb-3 flex items-center gap-3">
            <IconBadge icon={GraduationCap} />
            <h2 className="font-bold text-ink">الجامعات الحكومية</h2>
          </div>
          <p className="mb-3 text-sm text-ink-soft">{GOVERNMENT_NO_COMPARABLE_FEE}</p>
          <ul className="grid gap-1.5 text-sm text-ink-soft">
            {government.map((o) => (
              <li key={offeringKey(o)}>
                {o.universityName} — {o.departmentName}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Alert tone="info" icon={AlertCircle}>
        الأرقام من دليل أجور الجامعات الأهلية الرسمي للعام الدراسي الحالي — قد تتغيّر الأجور من عام لآخر، وبعض الأقسام
        لا تُنشَر أجورها في الدليل. راجع الجامعة مباشرة قبل أي قرار نهائي.
      </Alert>
    </div>
  );
}
