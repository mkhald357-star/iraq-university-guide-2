export type ServiceStatus = "live" | "soon";

export interface Stage {
  id: string;
  title: string;
  when: string;
}

export interface Service {
  id: string;
  stageId: string;
  title: string;
  summary: string; // جملة واحدة: ماذا تفعل الخدمة
  status: ServiceStatus;
  href?: string; // للمتاح فقط
}

export const STAGES: Stage[] = [
  { id: "decide", title: "قبل ما تقرّر", when: "الآن" },
  { id: "apply", title: "وأنت تقدّم", when: "موسم القبول" },
  { id: "started", title: "بعد ما تُقبل", when: "سنتك الأولى" },
  { id: "beyond", title: "أبعد من التخرّج", when: "لاحقاً" },
];

export const SERVICES: Service[] = [
  /* ── ① قبل ما تقرّر ── */
  {
    id: "compass",
    stageId: "decide",
    title: "بوصلة التخصص",
    summary: "اختبار ميول يطابقك بتخصصات تناسبك، ويقيس معدّلك أمام حدود القبول الحقيقية.",
    status: "live",
    href: "/quiz",
  },
  {
    id: "gpa-check",
    stageId: "decide",
    title: "فاحص المعدل السريع",
    summary: "أدخل معدّلك وفرعك، وشوف أي قسم يصلك — بلا اختبار وبلا حساب.",
    status: "live",
    href: "/gpa-check",
  },
  {
    id: "explorer",
    stageId: "decide",
    title: "مستكشف الجامعات",
    summary: "تصفّح كل قسم جامعي في العراق، وفلتِره بالمحافظة والفرع والحد الأدنى.",
    status: "live",
    href: "/explorer",
  },

  /* ── ② وأنت تقدّم ── */
  {
    id: "wishlist",
    stageId: "apply",
    title: "مرتِّب الرغبات",
    summary: "رتّب رغباتك، ونحذّرك إن كانت كلها طموحاً بلا خيار آمن.",
    status: "live",
    href: "/wishlist",
  },
  {
    id: "compare",
    stageId: "apply",
    title: "الموازنة بين التخصصات",
    summary: "ضع تخصصين أو ثلاثة جنباً لجنب: الدراسة، والعمل، والقبول.",
    status: "live",
    href: "/compare",
  },
  {
    id: "decider",
    stageId: "apply",
    title: "حسم الحيرة",
    summary: "محتار بين تخصصات متقاربة؟ أسئلة ترجيح قصيرة تفصل بينها.",
    status: "live",
    href: "/decider",
  },
  {
    id: "cost",
    stageId: "apply",
    title: "كلفة الدراسة الأهلية",
    summary: "قارن أجور الجامعات الأهلية لنفس التخصص قبل ما تقرّر.",
    status: "live",
    href: "/cost",
  },

  /* ── ③ بعد ما تُقبل ── */
  {
    id: "roadmap",
    stageId: "started",
    title: "خارطة سنواتك الدراسية",
    summary: "شوف ماذا تدرس سنة بسنة، وأين تتفرّع المسارات داخل تخصصك.",
    status: "soon",
  },
  {
    id: "skills",
    stageId: "started",
    title: "مهارات تسبق التخرّج",
    summary: "المهارات التي يطلبها سوق تخصصك، وتستطيع بناءها وأنت طالب.",
    status: "live",
    href: "/skills",
  },

  /* ── ④ أبعد من التخرّج ── */
  {
    id: "destinations",
    stageId: "beyond",
    title: "وجهات العمل بعد التخرّج",
    summary: "أين يشتغل خرّيجو تخصصك فعلاً في العراق، وما الترخيص المطلوب.",
    status: "live",
    href: "/destinations",
  },
  {
    id: "income",
    stageId: "beyond",
    title: "دخل التخصص الموثّق",
    summary: "أرقام دخل من مصادر رسمية فقط — وإن لم تتوفّر، نقولها بصراحة.",
    status: "live",
    href: "/income",
  },
  {
    id: "projects",
    stageId: "beyond",
    title: "بنك أفكار مشاريع التخرّج",
    summary: "أفكار مشاريع مرتبطة بتخصصك وبحاجة حقيقية في السوق المحلي.",
    status: "soon",
  },
  {
    id: "postgrad",
    stageId: "beyond",
    title: "جدوى الدراسات العليا",
    summary: "هل يستحق الماجستير في تخصصك؟ كلفة ووقت وعائد مهني.",
    status: "soon",
  },
];
