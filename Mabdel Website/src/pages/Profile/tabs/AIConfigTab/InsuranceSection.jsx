import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { INSURANCE_ELIGIBLE_BUSINESS_TYPES, NETWORK_STATUS_OPTIONS } from './constants';
import SectionCard from './SectionCard';

export default function InsuranceSection({ callSettings, updateInsurancePlan, addInsurancePlan, removeInsurancePlan, t }) {
  return (
    INSURANCE_ELIGIBLE_BUSINESS_TYPES.includes(callSettings?.business_type) ? (
            <SectionCard icon={ShieldCheck} title={t('aiprof_hdr_insurance')} description={t('aiprof_insurance_desc')}>
              <div className="space-y-3">
                {(callSettings?.insurance_plans || []).map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-[#243041] bg-[#131A24] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={80}
                        placeholder={t('aiprof_ph_insurance_payer')}
                        value={plan.payer}
                        onChange={(event) => updateInsurancePlan(plan.id, 'payer', event.target.value)}
                        className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white font-semibold px-3 py-2 outline-none focus:border-[#9333ea]/50"
                      />
                      <button
                        type="button"
                        onClick={() => removeInsurancePlan(plan.id)}
                        className="shrink-0 p-2 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                        title={t('aiprof_btn_remove')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_insurance_plan_name')}
                      value={plan.plan_name || ''}
                      onChange={(event) => updateInsurancePlan(plan.id, 'plan_name', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.accepted !== false}
                          onChange={(event) => updateInsurancePlan(plan.id, 'accepted', event.target.checked)}
                          className="w-4 h-4 accent-[#9333ea]"
                        />
                        <span className="text-[10px] font-bold text-[#A4B0B7] uppercase">{t('aiprof_lbl_insurance_accepted')}</span>
                      </label>
                      <select
                        aria-label={t('aiprof_lbl_insurance_network_status')}
                        value={plan.network_status || 'unknown'}
                        onChange={(event) => updateInsurancePlan(plan.id, 'network_status', event.target.value)}
                        className="bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2 py-1.5 outline-none"
                      >
                        {NETWORK_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{t(`aiprof_net_${status}`)}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.verification_required)}
                          onChange={(event) => updateInsurancePlan(plan.id, 'verification_required', event.target.checked)}
                          className="w-4 h-4 accent-[#9333ea]"
                        />
                        <span className="text-[10px] font-bold text-[#A4B0B7] uppercase">{t('aiprof_lbl_insurance_verification_required')}</span>
                      </label>
                      {[['effective_from', 'Effective from'], ['effective_until', 'Effective until'], ['last_verified_at', 'Last verified']].map(([field, label]) => (
                        <label key={field} className="text-xs text-[#A4B0B7]">{label}
                          <input type="date" aria-label={label} value={plan[field] || ''} onChange={(event) => updateInsurancePlan(plan.id, field, event.target.value || null)} className="block bg-[#0A1019] border border-[#243246] rounded-lg text-white px-2 py-1.5" />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {!(callSettings?.insurance_plans || []).length ? (
                  <p className="text-[#4A5568] text-xs">{t('aiprof_no_insurance_plans')}</p>
                ) : null}
                <button
                  type="button"
                  onClick={addInsurancePlan}
                  className="w-full py-2.5 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} /> {t('aiprof_btn_add_insurance_plan')}
                </button>
              </div>
            </SectionCard>
    ) : null
  );
}
