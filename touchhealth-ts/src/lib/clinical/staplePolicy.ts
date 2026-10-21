import type { ClinicalRule } from './types';

export const CONTROLLED_STAPLES = new Set(['food_005','food_005c','food_014','food_019','food_124_ns','food_141','food_012']);
const portionRules=new Set(['rule_023','rule_152','rule_153','rule_156','rule_162','rule_172','rule_206','rule_206_legacy_2','rule_208','rule_208_legacy_2','rule_210','rule_210_legacy_2','rule_215','rule_309','rule_545']);
export function isPortionAdvice(rule:ClinicalRule):boolean {
  return CONTROLLED_STAPLES.has(rule.target_food_id??'') && ((rule.condition==='DM'&&portionRules.has(rule.id)) || ['med_rule_003','med_rule_007'].includes(rule.id));
}
/** Only enumerated GI/portion rules change; other patient restrictions retain priority. */
export function applyStaplePolicy(rule:ClinicalRule):ClinicalRule {
  if(!portionRules.has(rule.id)||rule.condition!=='DM'||!CONTROLLED_STAPLES.has(rule.target_food_id??''))return rule;
  return {...rule,safety_level:'Warning',
    alert_message_en:'Use a controlled portion of this plain cooked staple. If available, combine with vegetables and beans, fish or egg. Wholegrain alternatives are optional when accessible; do not add sugar to porridge.',
    alert_message_sw:'Kula kiasi kilichoshauriwa cha chakula hiki kilichopikwa. Vikipatikana, ongeza mboga na maharage, samaki au yai. Unga wa dona ni chaguo unapopatikana; usiongeze sukari kwenye uji.'};
}
