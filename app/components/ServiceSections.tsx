"use client";
import Link from "next/link";
import {
  Compass,
  Calculator,
  Landmark,
  ListOrdered,
  Columns3,
  Scale,
  Wallet,
  Route,
  Zap,
  Briefcase,
  TrendingUp,
  Lightbulb,
  GraduationCap,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { STAGES, SERVICES, type Service } from "../../data/services";

// أيقونة مميّزة لكل خدمة على حدة (لا أيقونة عامة واحدة مكرَّرة) -- كل خدمة
// أصبحت بطاقة مستقلة ظاهرة بذاتها الآن (بدل نظام لوحة/حوار سابق كانت فيه
// الأيقونة الوحيدة على مستوى المرحلة لا الخدمة).
const SERVICE_ICON: Record<string, LucideIcon> = {
  compass: Compass,
  "gpa-check": Calculator,
  explorer: Landmark,
  wishlist: ListOrdered,
  compare: Columns3,
  decider: Scale,
  cost: Wallet,
  roadmap: Route,
  skills: Zap,
  destinations: Briefcase,
  income: TrendingUp,
  projects: Lightbulb,
  postgrad: GraduationCap,
};

const BLURB: Record<string, string> = {
  decide: "قبل ما تحدّد وجهتك، شوف وين ميولك ووين معدّلك يوصل.",
  apply: "موسم التقديم ما يرحم الترتيب الغلط. رتّب رغباتك على أرقام حقيقية.",
  started: "قُبلت؟ زين. هسّه شوف شنو راح تدرس، وشنو تبني من أول سنة.",
  beyond: "التخصص ما ينتهي بالتخرّج. شوف وين يوصلك قبل ما تختاره.",
};

function ServiceCard({ service, featured = false }: { service: Service; featured?: boolean }) {
  const Icon = SERVICE_ICON[service.id] ?? Compass;
  const live = service.status === "live" && service.href;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex shrink-0 rounded-xl p-2.5 ${
            live ? "bg-primary-100 text-primary-700" : "bg-surface-muted text-ink-muted"
          }`}
        >
          <Icon className={featured ? "h-6 w-6" : "h-5 w-5"} />
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            live ? "bg-band-safe-bg text-band-safe" : "bg-surface-muted text-ink-muted"
          }`}
        >
          {live ? "متاح" : "قريباً"}
        </span>
      </div>

      <h3 className={`mt-4 font-extrabold text-ink ${featured ? "text-xl" : "text-base"}`}>{service.title}</h3>
      <p className={`mt-1.5 leading-relaxed text-ink-soft ${featured ? "text-sm" : "text-sm"}`}>{service.summary}</p>

      {live && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-text">
          جرّبها الآن
          <ArrowLeft className="h-3.5 w-3.5" />
        </span>
      )}
    </>
  );

  const cls = `flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-all duration-200 ${
    live ? "hover:-translate-y-1 hover:border-primary-300 hover:shadow-md" : "opacity-80"
  }`;

  if (live) {
    return (
      <Link href={service.href!} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export default function ServiceSections() {
  return (
    <div dir="rtl" className="space-y-20 py-20">
      {STAGES.map((stage, stageIdx) => {
        const items = SERVICES.filter((s) => s.stageId === stage.id);

        return (
          <section
            key={stage.id}
            aria-labelledby={`h-${stage.id}`}
            style={stageIdx % 2 ? { background: "var(--g-surface)" } : undefined}
          >
            <div className="mx-auto max-w-6xl px-5 py-10">
              <p className="text-sm font-bold text-primary-text">{stage.when}</p>
              <h2 id={`h-${stage.id}`} className="mt-2 text-3xl font-extrabold leading-tight text-ink md:text-4xl">
                {stage.title}
              </h2>
              <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">{BLURB[stage.id]}</p>

              {/* شكل شبكة مختلف لكل مرحلة عمداً -- لا 13 بطاقة متطابقة متتالية
                  (المشكلة التي حذّر منها فحص الإشراف: تفكيك الخدمات إلى أقسام
                  متماثلة الشكل يُضاعف الرتابة بدل حلّها). */}
              {stage.id === "decide" && (
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {items.map((s) => (
                    <ServiceCard key={s.id} service={s} />
                  ))}
                </div>
              )}

              {stage.id === "apply" && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {items.map((s) => (
                    <ServiceCard key={s.id} service={s} />
                  ))}
                </div>
              )}

              {stage.id === "started" && (
                <div className="mt-8 grid gap-4 sm:grid-cols-5">
                  {items.map((s) => (
                    <div key={s.id} className={s.status === "live" ? "sm:col-span-3" : "sm:col-span-2"}>
                      <ServiceCard service={s} featured={s.status === "live"} />
                    </div>
                  ))}
                </div>
              )}

              {stage.id === "beyond" && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {items.map((s, i) => (
                    <ServiceCard key={s.id} service={s} featured={i === 0} />
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
