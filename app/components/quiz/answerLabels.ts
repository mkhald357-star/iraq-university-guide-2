// نصوص درجات الإجابة الخمس -- مصدر مشترك لمكوّنات الإجابة (ArrowScale وغيرها).
export interface FiveLevelLabels {
  stronglyYes: string;
  yes: string;
  maybe: string;
  no: string;
  stronglyNo: string;
}

export const GENERIC_ANSWER_LABELS: FiveLevelLabels = {
  stronglyYes: "أوافق بشدة",
  yes: "أوافق",
  maybe: "محايد",
  no: "لا أوافق",
  stronglyNo: "لا أوافق إطلاقاً",
};

export interface AnswerLabelsSource {
  answerLabels?: { yes: string; maybe: string; no: string; stronglyYes?: string; stronglyNo?: string };
}

// أسئلة المقارنة الصريحة («تفضّل A أم B؟») تستبدل الطرفين بنصّي الخيارين،
// والدرجتان الوسيطتان نص عام يُفهَم من موضعه بين الطرف والحياد.
export function getAnswerLabels(q: AnswerLabelsSource): FiveLevelLabels {
  if (!q.answerLabels) return GENERIC_ANSWER_LABELS;
  const { yes, maybe, no, stronglyYes, stronglyNo } = q.answerLabels;
  return { stronglyYes: stronglyYes ?? yes, yes: "أميل لهذا الجانب", maybe, no: "أميل للجانب الآخر", stronglyNo: stronglyNo ?? no };
}

/** القيم مرتّبة من بداية السطر (يمين، RTL) إلى نهايته. */
export const SCALE_STOPS = [1, 0.5, 0, -0.5, -1] as const;
export type ScaleValue = (typeof SCALE_STOPS)[number];

export function labelFor(labels: FiveLevelLabels, value: ScaleValue): string {
  return value === 1
    ? labels.stronglyYes
    : value === 0.5
      ? labels.yes
      : value === 0
        ? labels.maybe
        : value === -0.5
          ? labels.no
          : labels.stronglyNo;
}
