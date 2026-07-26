import { describe, it, expect } from "vitest";
import { computeSubjectAffinityVector, computeSubjectAffinityFit, SUBJECT_AFFINITY_AXES } from "./subjectAffinity";

describe("computeSubjectAffinityVector", () => {
  it("يُرجع محايداً (50) لمحور تفوّق فيه الطالب بنفس معدله العام تماماً", () => {
    const vec = computeSubjectAffinityVector({ math: 80 }, 80);
    expect(vec.quantitative).toBe(50);
  });

  it("يُرجع أعلى من 50 لمحور تفوّق فيه الطالب نسبياً عن معدله العام", () => {
    const vec = computeSubjectAffinityVector({ math: 95 }, 80);
    expect(vec.quantitative).toBeGreaterThan(50);
  });

  it("يُرجع أقل من 50 لمحور ضعف فيه الطالب نسبياً عن معدله العام", () => {
    const vec = computeSubjectAffinityVector({ math: 60 }, 80);
    expect(vec.quantitative).toBeLessThan(50);
  });

  it("طالب متفوّق بانتظام في كل المواد (كل درجاته = معدله العام) يظهر محايداً على كل المحاور -- لا مرتفعاً على الجميع", () => {
    const vec = computeSubjectAffinityVector(
      { math: 95, physics: 95, chemistry: 95, biology: 95, arabic: 95, english: 95 },
      95
    );
    SUBJECT_AFFINITY_AXES.forEach((axis) => {
      if (vec[axis] !== undefined) expect(vec[axis]).toBe(50);
    });
  });

  it("محور بلا أي مادة مصدر مُدخَلة يبقى undefined (لا صفراً ولا 50)", () => {
    const vec = computeSubjectAffinityVector({ math: 90 }, 80);
    expect(vec.bioMedical).toBeUndefined();
    expect(vec.socialHumanities).toBeUndefined();
  });

  it("محور بمادتين مصدر (مثال: علوم طبيعية = فيزياء+كيمياء) يأخذ متوسطهما", () => {
    const vec = computeSubjectAffinityVector({ physics: 90, chemistry: 70 }, 80);
    // متوسط (90+70)/2 = 80 = نفس المعدل العام → محايد 50
    expect(vec.physicalScience).toBe(50);
  });

  it("لا يخرج عن مدى [0,100] حتى مع فارق نسبي متطرف جداً", () => {
    const vec = computeSubjectAffinityVector({ math: 100 }, 40);
    expect(vec.quantitative).toBeLessThanOrEqual(100);
    const vec2 = computeSubjectAffinityVector({ math: 10 }, 90);
    expect(vec2.quantitative).toBeGreaterThanOrEqual(0);
  });
});

describe("computeSubjectAffinityFit", () => {
  it("يُرجع null إن لم يُدخِل الطالب أي درجة مادة إطلاقاً (متجه فارغ)", () => {
    expect(computeSubjectAffinityFit({}, { quantitative: 8 })).toBeNull();
  });

  it("يتجاهل المحاور غير المُدخَلة تماماً بدل معاقبة التخصص عليها", () => {
    // الطالب أدخل الرياضيات فقط (quantitative=90) -- تخصص وزنه العالي فقط على
    // بُعد لم يُدخِله الطالب (bioMedical) يجب ألا يُعاقَب على غيابه
    const studentVector = { quantitative: 90 };
    const majorHighInUnmeasuredAxis = { bioMedical: 10 }; // لا quantitative محدد له (0 افتراضاً)
    const fit = computeSubjectAffinityFit(studentVector, majorHighInUnmeasuredAxis);
    // يُحسَب فقط على quantitative: طالب=90 مقابل وزن التخصص=0*10=0 → فرق كبير متوقّع، لكن الاختبار المهم أنه لا يُرجع null
    expect(fit).not.toBeNull();
  });

  it("تطابق تام بين متجه الطالب وأوزان التخصص (بعد الضرب في 10) = 100", () => {
    const fit = computeSubjectAffinityFit({ quantitative: 80, verbal: 30 }, { quantitative: 8, verbal: 3 });
    expect(fit).toBe(100);
  });

  it("لا يخرج عن مدى [0,100]", () => {
    const fit = computeSubjectAffinityFit({ quantitative: 100, verbal: 0 }, { quantitative: 0, verbal: 10 });
    expect(fit).toBeGreaterThanOrEqual(0);
    expect(fit).toBeLessThanOrEqual(100);
  });
});
