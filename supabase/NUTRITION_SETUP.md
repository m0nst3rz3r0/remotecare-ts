# Adult nutrition planner setup

Apply `supabase/migrations/006_nutrition_sync.sql` in the Supabase SQL editor after migrations 001–005. This additive migration preserves patient IDs (text or bigint), patient codes, device letters, and existing records. Do not rerun the baseline as a replacement for an existing database. Back up production before applying schema changes.

Migration 006 adds `patients.nutrition_profile`, `patients.nutrition_revision`, and `visits.meal_plan`. Nutrition writes use the authenticated `sync_nutrition` RPC, with existing live facility authorization and a locked revision check. Ordinary clinical columns remain writable under existing RLS. Deploy this migration and the updated client together: older clients do not implement nutrition revision checks. No new Edge Function or server secret is required.

## Using the feature

Open a patient's visit and expand Nutrition & Meal Plan. Record screening, activity, body goal, measurement date, availability, exclusions, and any extra cooking ingredients. Assessment answers save locally immediately; save the visit to retain its generated plan, portion edits, and approval. A provisioned device can generate plans offline after the datasets have loaded successfully once. Reconnect alone does not synchronize or submit messages.

Generation starts with regional Tanzanian meal templates, chooses assessed foods, rounds household portions before calculating nutrients, and adjusts portions or optional snacks. It displays planned energy, protein, carbohydrate, fat, sodium, and fibre against the selected targets. Cooking additions are counted separately; do not double-count ingredients already represented in prepared-food entries. Unknown sodium/fibre remain unknown.

A complete result requires three nonempty main meals, energy within ±10%, protein within ±20%, sodium at/below the selected limit, fibre at/above target, completed negative screening, and no unresolved restrictions or stale inputs. These are software consistency checks, not clinical approval. Infeasible selections show explicit unmet requirements. Complex conditions and positive/unknown screening require review. Legacy plans remain readable with an assessment-unavailable label.

Food substitutions and portion edits recalculate the entire day and clear current approval. Clinician approval requires a review note and is recorded separately with account, device, time, and plan fingerprint. Relevant clinical changes invalidate current approval and retain previous approved snapshots. Print/share output includes stale, incomplete, or unreviewed status and nutrient totals. Approved historical portions remain fixed even if the catalogue changes.

## Manual sync and conflicts

Save the visit, then use the existing manual Sync action. A second device using the facility account can pull nutrition records. If two devices edit the same nutrition record, the second submission retains its local draft and reports a conflict. In Nutrition & Meal Plan choose **Keep local draft** or **Use cloud**, then synchronize manually again. Keeping local archives a conflicting cloud approval and advances from the server revision. A failed sync leaves local work intact. A revision conflict can occur even for changes to different visits of the same patient; resolution applies to that patient's nutrition bundle.

## Data and clinical review before release

The validated cache checks structure, unique IDs, required nutrients, servings, references, and meal templates. It does not establish the clinical accuracy of the source content. Duplicate legacy rule IDs 200–210 were disambiguated without changing their conditions or messages. Unresolved orphan rules 034, 037, and 052 and blanket ulcer rules are quarantined. No replacement food mapping was invented. Unsupported preparations are not assessed.

Plans record dataset fingerprints and policy version `adult-dm-htn-2.0.0`. Original food-composition provenance is explicitly unverified; reviewer and review date remain unset. A qualified Tanzanian clinician/dietitian must verify food composition, portion limits, preparation assumptions, rule content, target formulas, bilingual wording, and specialist referral behavior before clinical release. Document that review in `src/lib/clinical/nutritionPolicy.ts` with real citations and reviewer details. General policy references:

- WHO healthy diet: https://www.who.int/news-room/fact-sheets/detail/healthy-diet
- KDIGO CKD guidance: https://kdigo.org/guidelines/ckd-evaluation-and-management/
- NIDDK peptic-ulcer nutrition: https://www.niddk.nih.gov/health-information/digestive-diseases/peptic-ulcers-stomach-ulcers/eating-diet-nutrition

The retained energy estimate uses Mifflin–St Jeor BMR, the selected activity multiplier, a legacy 100-kcal work allowance, and condition/body-goal adjustments. It is provisional; clinician adjustments require a documented reason. Specialist, pediatric, weekly, pricing, and shopping-list planning are outside this release.

## Verification

From `touchhealth-ts`, run `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build`. Tests include 28 zone/condition scenarios, invalid/missing datasets, offline cache recovery, allergy/complex-case screening, ingredients, portion rounding, equivalent language nutrition, edits, stale/legacy printouts, approval snapshots, two-device manual sync, failed RPC preservation, and PostgreSQL migration/authorization/revision checks.

After deployment, test with two physical provisioned devices and a test patient: save offline, restart, generate, manually sync, edit on both devices, resolve a conflict, and verify shared visibility. Local automated tests do not verify your deployed Supabase settings, actual browser persistence policies, or local clinical content approval.

## Meal handout and direct PDF update (policy 2.1.0)

Save PDF now downloads a searchable PDF directly without a popup or print dialog. Print remains a separate browser action that waits for the document and fonts. Both export locations offer Patient only or Patient and clinician (default), prevent concurrent generation, and report failures. HTML, PDF and shared text use the same document model; filenames use the saved plan date. Documents show status/identification on continuation pages and allow natural overflow rather than promising exactly two pages.

The PDF uses pdf-lib, @pdf-lib/fontkit and a locally embedded Noto Sans font under the SIL Open Font License (`src/assets/fonts/OFL.txt`). No external font or conversion service is called. Service-worker provisioning caches the initial bundled app/PDF scripts for offline restart. Load the updated app online once to provision the new assets before using it offline.

New clinical checks require review for targets at or below 1,200 kcal/day and BMI at or above 40 (confirm measurements and seek individualized assessment). Adjusted macro targets differing from their calorie target by more than max(50 kcal, 5%) prevent computational completeness. These checks do not automatically change prescriptions. Existing plans become stale after the policy-version change and must be regenerated and reviewed; approved historical snapshots remain intact.

Portions now retain grams per household unit and bilingual display text. Prepared uji uses each food's recorded cup weight (millet/sorghum uji: 250 g); ugali remains a fist measure. One/two cups can be selected, all totals recalculate, and no volume conversion is inferred. Optional snacks exclude extra rice/ugali meals. Preparation-specific warnings retain full distinct reasons and only offer assessed alternatives. The short guidance list prioritizes foods present in the plan; it is not an exhaustive allergy or interaction assessment. Named medicines are recorded in new plan inputs; class-only historical CCB alerts request pharmacist confirmation. Sodium is labelled Sodiamu, with salt equivalent described as total dietary salt, not extra cooking allowance.

Verification includes real PDF parsing/text bounds, Unicode font embedding, long-content pagination, popup-free PDF download/error/retry behavior, print readiness, offline asset provisioning, and the existing clinical/synchronization regression suite. A local Windows Chrome offline check downloaded a valid PDF with no popup. Local clinical-content review and checks on the deployed app remain necessary.
# Personalized food-choice guide

Plain rice now uses the same portion-controlled policy as the listed staples;
unrelated patient restrictions retain priority. The ambiguous food_005 uji
preparation is unassessed because that combined record stores an ugali fist
measure. It cannot supply a liquid cup conversion. Use separate porridge
records with their recorded prepared weights, pending local serving review.
Older snapshots display their saved grams rather than a fist for liquid uji.
The clinician panel lists incomplete screens, missing measurement dates and
the need to resolve daily nutrient/clinical findings before approval. These
tasks are not printed as technical errors on the patient handout.

Plain cooked maize ugali and selected unsweetened maize/wheat porridges are
portion-controlled choices rather than automatic exclusions for their GI alone.
Only explicitly listed catalogue rules receive this policy correction. Other
restrictions continue to block generation; sugar-added and fried preparations
do not inherit eligibility. The selected available-food list is also the
patient's affordable-food list, not a price estimate. Wholegrain substitutions
are optional and must come from this list. A limited selection may produce an
incomplete day with explicit unmet targets. No SQL migration is required.

Patient exports now summarize food choices and practical advice on page one,
followed by sample meal combinations on page two. Unfinished screening keeps
the examples provisional; it never unlocks a suitable-food label. Detailed
clinical issues remain in the review panel. Regenerate older plans to apply
updated meal composition rules; exporting does not rewrite stored meals.

Routine generation shares quantity budgets across whole-egg aliases and across
avocado/jackfruit servings. The current software defaults (120 g whole egg,
200 g avocado, 140 g jackfruit per day) are variety constraints, not clinical
maximums or prescribed servings. Clinician/dietitian review remains required.

Newly generated plans include a saved, versioned regional food/preparation guide.
The review panel supports search and status filtering. The export checkbox adds
the complete guide to patient-only or full documents, including shared text.
Reference portions are examples, not extra foods to add to the daily plan.
Incomplete or positive screening prevents a suitable label; exclusions remain
explicit. Older plans show guide unavailable until regenerated and reviewed.
No additional SQL migration is required: the guide travels in the existing
meal_plan JSON snapshot, including approval history and manual revision sync.

Generated days limit repeated foods to two appearances as a practical variety
constraint, not a clinical intake limit. Snacks are included in daily totals.
If variety and availability make targets infeasible, review unmet requirements.
