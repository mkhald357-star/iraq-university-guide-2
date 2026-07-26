# RIASEC Coverage-Matrix Diagnostic Report

Generated: 2026-07-22
Scope: `data/questions.json` (40 base questions), `data/tiebreaker_questions.json` (12 questions at the time this report ran), `data/majors.json` + `data/major_riasec_profiles.json` (81 majors)

> **Post-hoc note**: this report's finding (I/E/C-dimension major clusters are proportionally under-served by a flat 2-questions-per-dimension tiebreaker bank) directly motivated expanding `tiebreaker_questions.json` from 12 to 18 questions (3 per dimension) the same day. All "12 questions" references below describe the bank's state *at diagnostic time*, not its current state — see `PROJECT.md` §11 for the current count.

Method notes:
- **Dominant dimension** of a major = the RIASEC letter(s) with the highest raw value in its profile (0-10 scale). Ties are listed as multiple letters (e.g. `medicine` → I8/S8 tied → dominant `[I, S]`).
- **Strong-signal question** for a dimension = a question where that dimension is the (or a, if tied) **primary** dimension of the question (largest `Math.abs(weight)` among the question's `dimensions`) **and** `Math.abs(weight) >= 5`.
- "At risk of weak signal" = a major whose dominant dimension has fewer than 4 strong-signal base questions supporting it.

## 1. Coverage matrix

| Dimension | Strong-signal base questions (of 40) | Strong-signal tiebreaker questions (of 12) | Majors dominant in this dimension (of 81) |
|---|---|---|---|
| R (Realistic) | 6 | 2 | 12 |
| I (Investigative) | 7 | 2 | 31 |
| A (Artistic) | 6 | 2 | 9 |
| S (Social) | 7 | 2 | 16 |
| E (Enterprising) | 8 | 2 | 10 |
| C (Conventional) | 8 | 2 | 18 |

(Column totals for "majors dominant" sum to 88, not 81, because 7 majors are tied across two dimensions — see below — and each tie is counted once per dimension.)

Strong-signal base questions per dimension:
- **R**: q_hands_on, q_outdoor_fieldwork, q_tinkering, q_tangible_result, q_nature_animals, q_machine_operation
- **I**: q_pure_theory_vs_applied_build, q_math_logic, q_scientific_curiosity, q_data_patterns, q_solitary_research, q_lab_experiments, q_tech_savvy
- **A**: q_creative_art, q_self_expression, q_creative_freedom, q_routine_aversion, q_aesthetic_style, q_original_thinking
- **S**: q_help_others, q_social, q_empathy, q_people_facing, q_volunteering, q_stress_tolerance, q_advocacy_vs_execution
- **E**: q_pure_theory_vs_applied_build, q_free_expression_vs_client_brief, q_negotiation, q_leadership, q_deal_making, q_risk_reward, q_competitive_recognition, q_public_pitching
- **C**: q_advocacy_vs_execution, q_established_vs_emerging_field, q_detail_oriented, q_numbers_finance, q_follow_procedures, q_comfort_vs_salary, q_memory, q_structured_study_preference

## 2. Majors flagged "at risk of weak signal" (< 4 strong-signal base questions on their dominant dimension)

**None.** Every dimension has at least 6 strong-signal base questions (the minimum is R and A at 6), which clears the threshold of 4 comfortably. No major, regardless of its dominant dimension, falls below the 4-question floor.

## 3. Cluster imbalance (majors per dominant dimension)

Even though no major is "at risk" by the strict question-count rule, the **distribution of majors across dimensions is highly uneven**:

| Dimension | # majors dominant | Share of 81 |
|---|---|---|
| I | 31 | ~38% |
| C | 18 | ~22% |
| S | 16 | ~20% |
| R | 12 | ~15% |
| E | 10 | ~12% |
| A | 9 | ~11% |

Nearly 4 out of every 10 majors are Investigative-dominant (all engineering, medicine, and pure-science majors cluster here), while Artistic-dominant majors are the rarest (9 majors: architecture, graphic_design, interior_design, arabic_language, media_journalism, fine_arts, cosmetic_science_tech, urban_regional_planning_engineering, music_performing_arts). This mirrors real-world Iraqi major distribution (STEM-heavy system) rather than a data-entry accident, but it does mean that when the quiz scores a user as I-dominant, it is discriminating among a candidate pool of 31 similar majors with only 7 strong-signal questions — proportionally thinner coverage per major than, say, A's 9 majors sharing 6 strong-signal questions. This is a "resolution" concern (how finely the algorithm can rank *within* a large I-cluster) distinct from the "at risk of weak signal" rule, which only checks whether a dimension is covered at all.

7 majors have tied dominant dimensions (both counted): medicine (I/S), pharmacy (I/C), law (S/E), political_science (S/E), project_management (E/C), media_journalism (A/E), tourism_hospitality (S/E), emergency_medical_tech (R/S), optometry_audiology_tech (I/E/C — 3-way tie), environmental_engineering (I/S), plant_crop_production (R/C), foreign_languages_other (I/S/E — 3-way tie). (12 tie instances across 11 unique majors, accounting for the 88 vs 81 discrepancy above.)

## 4. Tiebreaker bank cross-reference

The tiebreaker bank (`data/tiebreaker_questions.json`) is **perfectly balanced**: exactly 2 strong-signal questions per dimension (2×6 = 12, matching the total question count exactly — every tiebreaker question is single-dimension-loaded at weight ≥ 8, so all 12 count as strong-signal for exactly one dimension each).

Since no major was flagged "at risk," there is no dimension the tiebreaker bank needs to specifically "rescue." But given the cluster imbalance noted above, it's worth observing:
- The I-cluster (31 majors, the largest and most likely to produce top-2 ties) is backed by only 2 tiebreaker questions (tb_investigative_1, tb_investigative_2) — the same flat allocation as A's 9-major cluster. The tiebreaker bank does not scale with cluster size, so ties *within* the large I-cluster (e.g. ai vs computer_science vs mathematics, all near-identical I-heavy profiles) get the same 2-question disambiguation budget as ties in the much smaller A-cluster.
- This is not a coverage gap in the strict sense asked for (every dimension is covered, base and tiebreaker), but it is the most plausible follow-on risk: the tiebreaker mechanism's per-dimension question count doesn't reflect how crowded that dimension's major-space is.

## 5. Summary

- No dimension is under-covered by the strict rule (min. 6 strong-signal base questions per dimension, well above the 4 threshold).
- No major is flagged "at risk of weak signal."
- Real imbalance exists in **major distribution**, not **question distribution**: I-dominant majors (31) outnumber A-dominant majors (9) by more than 3:1, while question coverage per dimension only varies from 6 to 8. This means I-dominant majors get proportionally less differentiating power per capita than A-dominant majors, even though absolute question counts are fine.
- The tiebreaker bank is evenly split (2 questions/dimension) and does not compensate for this per-capita disparity in the largest cluster (I).
