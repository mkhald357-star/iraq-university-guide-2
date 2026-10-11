import { describe, it, expect } from "vitest";
import { genderCutoffLine, genderRestrictionLabel } from "./genderNote";

describe("genderNote: الجنس لقسم محدَّد فقط", () => {
  it("لقسم مختلط لا يُعاد أي نص", () => {
    expect(genderRestrictionLabel(undefined)).toBeNull();
    expect(genderCutoffLine({})).toBeNull();
    expect(genderCutoffLine({ forBranch: "علمي" })).toBeNull();
  });

  it("قسم لجنس واحد", () => {
    expect(genderRestrictionLabel("أنثى")).toBe("للإناث فقط");
    expect(genderRestrictionLabel("ذكر")).toBe("للذكور فقط");
  });

  it("حدّا الجنسين لفرع الطالب فقط", () => {
    const by = { علمي: { ذكر: 96.43, أنثى: 96.57 }, أدبي: { ذكر: 80, أنثى: 81.5 } };
    expect(genderCutoffLine({ genderByBranch: by, forBranch: "علمي" })).toBe("ذكور 96.43% · إناث 96.57%");
    expect(genderCutoffLine({ genderByBranch: by, forBranch: "فنون" })).toBeNull();
    expect(genderCutoffLine({ genderByBranch: by })).toBe(
      "علمي: ذكور 96.43% · إناث 96.57% — أدبي: ذكور 80% · إناث 81.5%"
    );
  });

  it("سجل by-branch يحمل حدّي فرعه مباشرة", () => {
    expect(genderCutoffLine({ morningGender: { ذكر: 70, أنثى: 72.14 } })).toBe("ذكور 70% · إناث 72.14%");
  });
});
