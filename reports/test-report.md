# تقرير الاختبارات الآلية

> مُولَّد آلياً من تشغيل حقيقي لـ`vitest` بتاريخ 2026-11-01: `node scripts/generate-test-report.mjs`. لا رقم هنا مكتوب يدوياً.

## الخلاصة

| | |
|---|---|
| ملفات الاختبار | 50 |
| مجموعات الاختبار (describe) | 168 |
| الاختبارات | 486 |
| الناجحة | 486 |
| الفاشلة | 0 |

## التغطية بحسب المجال

| المجال | الملفات | الاختبارات |
|---|---|---|
| المحرك والتوصية | 15 | 147 |
| كشف الجدّية | 1 | 31 |
| القبول والأهلية والرغبات | 7 | 90 |
| بيانات القبول ودقتها | 9 | 62 |
| مطابقة الأقسام والأسماء | 8 | 76 |
| المدخلات والواجهة | 3 | 13 |
| الأمن والخصوصية | 6 | 46 |
| المساعد الذكي | 1 | 21 |

## التفصيل بحسب الملف

لكل ملف: ما يحرسه (عناوين مجموعاته كما كتبها الاختبار نفسه).

### المحرك والتوصية

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/riasec.test.ts` | 32/32 | computeUserRiasecVector ؛ computeMajorFit ؛ computeCombinedRankingScore |
| `lib/recommendationEngine.characterization.test.ts` | 17/17 | golden master: rankMajors على بيانات المنصة الحقيقية (قبل أي تعديل خوارزمي) ؛ golden master: planTieBreak |
| `lib/compareMajors.test.ts` | 14/14 | rankDemandLevel ؛ computeComparisonHighlights ؛ sanitizeSelection |
| `lib/decider.test.ts` | 13/13 | computeDimensionLeans ؛ computeDeciderVerdict |
| `lib/subjectAffinity.test.ts` | 11/11 | computeSubjectAffinityVector ؛ computeSubjectAffinityFit |
| `lib/itemFormats.test.ts` | 10/10 | itemFormats ؛ VRS مع الأشكال ؛ البنك المنشور |
| `lib/recommendationEngine.contextTieBreak.test.ts` | 10/10 | applyContextTieBreak -- بصمة السياق تفصل زوجاً حقيقياً RIASEC وحده يفشل فيه ؛ applyContextTieBreak -- ضمانات السلامة (لا يمسّ إلا نطاق الغموض) ؛ applyContextTieBreak -- عتبة الحد الأدنى للفارق الحقيقي (CONTEXT_MIN_AXIS_DIVERGENCE) |
| `lib/adaptiveRound.test.ts` | 8/8 | planReserveRound ؛ measureDimensions |
| `lib/contextAxisMap.test.ts` | 8/8 | computeUserContextVector ؛ computeContextFit ؛ findMostDivergentContextAxis |
| `lib/familyRecommendation.test.ts` | 5/5 | التوصية بالعائلة |
| `lib/singleSourceOfTruth.test.ts` | 5/5 | مصدر وحيد للبيانات الحرجة -- لا نسخ مكرَّرة صامتة |
| `lib/triState.test.ts` | 5/5 | normalizeTriState ؛ قيم ثلاثية الحالات في البيانات الفعلية |
| `lib/quizEngine.test.ts` | 4/4 | evaluateQuizStep -- وضع legacy مطابق للسلوك السابق حرفياً ؛ evaluateQuizStep -- وضع reserve (جولة واحدة) ؛ buildScoredPool |
| `lib/eval/shortForm.test.ts` | 3/3 | الاختبار القصير -- حدود المنتج |
| `lib/reportQuizParity.test.ts` | 2/2 | تطابق نسبة التوافق بين /report و/quiz |

### كشف الجدّية

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/validity.test.ts` | 31/31 | computeValidityRiskScore ؛ computeValidityRiskScore — مقياس الخمس نقاط ؛ مؤشر الموافقة المتوازن ومقياس الصدق (البنك ذو البنود المعكوسة) |

### القبول والأهلية والرغبات

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/wishlistPlanner.test.ts` | 31/31 | classifyOffering ؛ classifyOffering -- الأهلي (data/admission_rules.md §32) ؛ classifyOffering على بيانات حقيقية (لا وهمية، data/admission_rules.md §32) |
| `lib/eligibility.test.ts` | 13/13 | computeEligibility ؛ eveningOnlyOffers (الإصدار 2، شرط المدقّق: المسائي بلوغ بأجور يُسمّى باسمه) |
| `lib/costCompare.test.ts` | 12/12 | computeEffectiveFee ؛ splitOfferings ؛ sortByFeeAscending |
| `lib/admissionLabel.test.ts` | 10/10 | formatGrade -- الرقم أولاً، ولا قبول مباشر للحكومي ؛ admissionCell -- لا قبول مباشر في أي قسم حكومي أو أهلي |
| `lib/admissionFeasibility.test.ts` | 9/9 | واقعية القبول |
| `lib/wishlistMigration.test.ts` | 9/9 | ترحيل الرغبات المحفوظة ؛ sanitizeWishlist: بيانات المتصفح التالفة لا تكسر الصفحة |
| `lib/emptyDiagnosis.test.ts` | 6/6 | تشخيص الفراغ ؛ طالب بمعدّل معقول وفلاتر واسعة يجد خيارات (بيانات حقيقية، لا وهمية) |

### بيانات القبول ودقتها

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/accuracyGoldenCases.test.ts` | 15/15 | حالات ذهبية: حرم القرنة وتكريت/الشرقاط وحرم كركوك (م3) ؛ حالات ذهبية: إصلاحات قائمة (it) |
| `lib/admissionTruth.test.ts` | 11/11 | Phase 4: Admission Truth Regression Tests |
| `lib/branchPlacement.test.ts` | 10/10 | lib/branchCutoff: حد فرع الطالب ؛ البيانات: القسم بالمكان الصحيح وبالحد الصحيح |
| `lib/guideBranches.test.ts` | 8/8 | scripts/guideBranches: أنماط التشوّه ؛ scripts/guideBranches: لا مطابقة كاذبة |
| `lib/hierarchyData.test.ts` | 5/5 | hierarchy.json |
| `lib/branchCoverage.test.ts` | 4/4 | تغطية الفرع (data/admission_rules.md §29) |
| `lib/genderNote.test.ts` | 4/4 | genderNote: الجنس لقسم محدَّد فقط |
| `lib/channelNoticeCoverage.test.ts` | 3/3 | تغطية تنويه القناة العامة |
| `lib/cutoffsYearCoverage.test.ts` | 2/2 | تغطية سنة مصدر الحدود الدنيا (CUTOFFS_YEAR) |

### مطابقة الأقسام والأسماء

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/majorMatcher.test.ts` | 17/17 | matchMajorToDepartment ؛ findUniversitiesForMajor ؛ rankUniversityOfferings |
| `lib/prefixGuard.test.ts` | 16/16 | حارس البادئة: لا تصادم بين أزواج هندسة/تقنيات السبعة على كامل قاعدة البيانات الحقيقية |
| `lib/crossMajorContamination.test.ts` | 11/11 | لا تصادم بين تخصصات غير مرتبطة بسبب جذر عربي قصير مشترك مصادفة |
| `lib/displayNameResidual.test.ts` | 10/10 | م6: أنماط انعكاس «لا» المتبقية في displayName ؛ م6: البيانات |
| `scripts/displayName.test.js` | 10/10 | fixLamAlef ؛ applyCorrections ؛ toDisplayName |
| `lib/matchPrecision.test.ts` | 8/8 | دقّة مطابقة الأقسام بالتخصصات (بيانات حقيقية) ؛ تطبيع مطابقة الأنماط |
| `lib/departmentNames.test.ts` | 2/2 | سلامة أسماء الأقسام |
| `lib/departmentNormalizer.test.ts` | 2/2 | departmentNormalizer - تكافؤ النسختين والتعامل مع حالات OCR |

### المدخلات والواجهة

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/gradeInput.test.ts` | 9/9 | sanitizeGradeInput ؛ gradeRangeMessage ؛ caretAfterSanitize: المؤشر لا يقفز |
| `lib/emptyStateTone.test.ts` | 2/2 | نبرة حالات الفراغ (data/admission_rules.md §31) |
| `lib/quizNoAutoAdvance.test.ts` | 2/2 | الاختبار: لا انتقال تلقائي للسؤال الأحادي |

### الأمن والخصوصية

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/securityScripts.test.ts` | 22/22 | apply-cloudflare.mjs ؛ apply-github.mjs |
| `lib/pilotCode.test.ts` | 8/8 | رمز التجربة الميدانية |
| `lib/siteMeta.test.ts` | 6/6 | بيانات الموقع ؛ وسوم الصفحات |
| `lib/reportIssue.test.ts` | 4/4 | نصّ البلاغ |
| `lib/safeStorage.test.ts` | 4/4 | التخزين المحلي الآمن |
| `lib/jsonLd.test.ts` | 2/2 | serializeJsonLd |

### المساعد الذكي

| الملف | اختبارات | ما يحرسه |
|---|---|---|
| `lib/assistant.test.ts` | 21/21 | findBestAnswer -- تطابق فصيح أساسي ؛ findBestAnswer -- دعم اللهجة العراقية ؛ findBestAnswer -- فلترة كلمات الحشو (STOPWORDS) |

## ما لا يغطيه هذا التقرير

- **فحوص المتصفح الحقيقي** (Playwright) والوصول (axe) والمراجعة المستقلة قبل النشر: تُجرى بأدواتها قبل كل إصدار.
- **تدقيق بيانات القبول** صفاً بصف: سكربتات `scripts/admission-fix/audit-*.js` ونتائجها في `reports/admission-fix/audit/`، وليست ضمن `vitest`.
- **المحاكاة الإحصائية** للتوصية: أدوات `scripts/eval/` (للمعايرة الداخلية، لا حكم صحّة).
