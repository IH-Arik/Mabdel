import { PhoneOutgoing, Plus, Trash2, X } from 'lucide-react';
import { LABEL } from '../../shared';
import SectionCard from './SectionCard';

export default function OutboundPurposesSection({
  callSettings, updateOutboundPurpose, addOutboundPurpose, removeOutboundPurpose,
  addOutboundPurposeListItem, updateOutboundPurposeListItem, removeOutboundPurposeListItem, t,
}) {
  return (
          <SectionCard icon={PhoneOutgoing} title={t('aiprof_hdr_outbound_purposes')} description={t('aiprof_outbound_purposes_desc')}>
            <div className="space-y-4">
              {(callSettings?.outbound_call_purposes || []).map((purpose) => (
                <div key={purpose.id} className="rounded-xl border border-[#243041] bg-[#131A24] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_outbound_purpose_name')}
                      value={purpose.name}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'name', event.target.value)}
                      className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white font-semibold px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" title={t('aiprof_lbl_outbound_purpose_active')}>
                      <input
                        type="checkbox"
                        checked={purpose.active !== false}
                        onChange={(event) => updateOutboundPurpose(purpose.id, 'active', event.target.checked)}
                        className="w-4 h-4 accent-[#9333ea]"
                      />
                      <span className="text-[10px] font-bold text-[#A4B0B7] uppercase">{t('aiprof_lbl_outbound_purpose_active')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeOutboundPurpose(purpose.id)}
                      className="shrink-0 p-2 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                      title={t('aiprof_btn_remove')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_opening')}</label>
                    <input
                      type="text"
                      maxLength={500}
                      placeholder={t('aiprof_ph_outbound_purpose_opening')}
                      value={purpose.opening_message || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'opening_message', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_objective')}</label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder={t('aiprof_ph_outbound_purpose_objective')}
                      value={purpose.objective || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'objective', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_questions')}</label>
                    <div className="space-y-1.5">
                      {(purpose.questions_to_ask || []).map((question, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            maxLength={200}
                            placeholder={t('aiprof_ph_outbound_purpose_question')}
                            value={question}
                            onChange={(event) => updateOutboundPurposeListItem(purpose.id, 'questions_to_ask', index, event.target.value)}
                            className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-1.5 outline-none focus:border-[#9333ea]/50"
                          />
                          <button
                            type="button"
                            onClick={() => removeOutboundPurposeListItem(purpose.id, 'questions_to_ask', index)}
                            className="shrink-0 p-1.5 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(purpose.questions_to_ask || []).length < 8 ? (
                      <button
                        type="button"
                        onClick={() => addOutboundPurposeListItem(purpose.id, 'questions_to_ask')}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#9333ea] cursor-pointer"
                      >
                        <Plus size={11} /> {t('aiprof_btn_add_outbound_purpose_question')}
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_actions')}</label>
                    <div className="space-y-1.5">
                      {(purpose.allowed_actions || []).map((action, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            maxLength={120}
                            placeholder={t('aiprof_ph_outbound_purpose_action')}
                            value={action}
                            onChange={(event) => updateOutboundPurposeListItem(purpose.id, 'allowed_actions', index, event.target.value)}
                            className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-1.5 outline-none focus:border-[#9333ea]/50"
                          />
                          <button
                            type="button"
                            onClick={() => removeOutboundPurposeListItem(purpose.id, 'allowed_actions', index)}
                            className="shrink-0 p-1.5 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(purpose.allowed_actions || []).length < 10 ? (
                      <button
                        type="button"
                        onClick={() => addOutboundPurposeListItem(purpose.id, 'allowed_actions')}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#9333ea] cursor-pointer"
                      >
                        <Plus size={11} /> {t('aiprof_btn_add_outbound_purpose_action')}
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_closing')}</label>
                    <input
                      type="text"
                      maxLength={500}
                      placeholder={t('aiprof_ph_outbound_purpose_closing')}
                      value={purpose.closing_message || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'closing_message', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_followup_sms')}</label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder={t('aiprof_ph_outbound_purpose_followup_sms')}
                      value={purpose.follow_up_sms || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'follow_up_sms', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>
                </div>
              ))}
              {!(callSettings?.outbound_call_purposes || []).length ? (
                <p className="text-[#4A5568] text-xs">{t('aiprof_no_outbound_purposes')}</p>
              ) : null}
              <button
                type="button"
                onClick={addOutboundPurpose}
                className="w-full py-2.5 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} /> {t('aiprof_btn_add_outbound_purpose')}
              </button>
            </div>
          </SectionCard>
  );
}
