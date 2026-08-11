import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // استبعاد صريح لـ .claude/ (نسخ worktree مؤقتة لعمل الوكلاء، قد تحوي
    // نسخة كاملة من المستودع بما فيها ملفات *.test.ts -- بلا هذا الاستبعاد
    // يُعيد vitest تشغيل كل الاختبارات عدة مرات مضاعفة، اكتُشف فعلياً
    // 2026-08-11 حين قفز عدد الاختبارات من 224 إلى 694 بعد محاولتي عزل
    // فاشلتين تركتا worktree يتيمة).
    exclude: ["**/node_modules/**", "**/dist/**", "**/.{git,cache,output,temp}/**", "**/.claude/**"],
    coverage: {
      provider: "v8",
      include: ["lib/riasec.ts", "lib/majorMatcher.ts"],
    },
  },
});
