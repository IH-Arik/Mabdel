import { Plus, Trash2, Workflow, X } from 'lucide-react';
import { LABEL } from '../../shared';
import { NOTIFY_ROLE_OPTIONS } from './constants';
import SectionCard from './SectionCard';

export default function PlaybooksSection({
  callSettings, providers, appointmentTypes, teamMembers,
  updatePlaybook, addPlaybook, removePlaybook,
  addPlaybookQuestion, updatePlaybookQuestion, removePlaybookQuestion, t,
}) {
  return (
          <SectionCard icon={Workflow} title={t('aiprof_hdr_playbooks')} description={t('aiprof_playbooks_desc')}>
            <div className="space-y-4">
              {(callSettings?.call_routing_rules || []).map((rule) => (
                <div key={rule.id} className="rounded-xl border border-[#243041] bg-[#131A24] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_playbook_name')}
                      value={rule.name}
                      onChange={(event) => updatePlaybook(rule.id, 'name', event.target.value)}
                      className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white font-semibold px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" title={t('aiprof_lbl_playbook_active')}>
                      <input
                        type="checkbox"
                        checked={rule.active !== false}
                        onChange={(event) => updatePlaybook(rule.id, 'active', event.target.checked)}
                        className="w-4 h-4 accent-[#9333ea]"
                      />
                      <span className="text-[10px] font-bold text-[#A4B0B7] uppercase">{t('aiprof_lbl_playbook_active')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removePlaybook(rule.id)}
                      className="shrink-0 p-2 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                      title={t('aiprof_btn_remove')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_playbook_trigger')}</label>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder={t('aiprof_ph_playbook_trigger')}
                      value={rule.trigger_description}
                      onChange={(event) => updatePlaybook(rule.id, 'trigger_description', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_playbook_questions')}</label>
                    <div className="space-y-1.5">
                      {(rule.questions_to_ask || []).map((question, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            maxLength={200}
                            placeholder={t('aiprof_ph_playbook_question')}
                            value={question}
                            onChange={(event) => updatePlaybookQuestion(rule.id, index, event.target.value)}
                            className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-1.5 outline-none focus:border-[#9333ea]/50"
                          />
                          <button
                            type="button"
                            onClick={() => removePlaybookQuestion(rule.id, index)}
                            className="shrink-0 p-1.5 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(rule.questions_to_ask || []).length < 8 ? (
                      <button
                        type="button"
                        onClick={() => addPlaybookQuestion(rule.id)}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#9333ea] cursor-pointer"
                      >
                        <Plus size={11} /> {t('aiprof_btn_add_question')}
                      </button>
                    ) : null}
                  </div>

                  {(providers.length || appointmentTypes.length) ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {providers.length ? (
                        <select
                          aria-label={t('aiprof_lbl_playbook_provider')}
                          value={rule.provider_id || ''}
                          onChange={(event) => updatePlaybook(rule.id, 'provider_id', event.target.value)}
                          className="bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none"
                        >
                          <option value="">{t('cal_opt_no_provider')}</option>
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.name}</option>
                          ))}
                        </select>
                      ) : null}
                      {appointmentTypes.length ? (
                        <select
                          aria-label={t('aiprof_lbl_playbook_appointment_type')}
                          value={rule.appointment_type_id || ''}
                          onChange={(event) => updatePlaybook(rule.id, 'appointment_type_id', event.target.value)}
                          className="bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none"
                        >
                          <option value="">{t('cal_opt_no_appointment_type')}</option>
                          {appointmentTypes.map((type) => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      maxLength={120}
                      placeholder={t('aiprof_ph_playbook_notify')}
                      value={rule.notify_target || ''}
                      onChange={(event) => updatePlaybook(rule.id, 'notify_target', event.target.value)}
                      className="flex-1 min-w-0 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <select
                      aria-label={t('aiprof_lbl_notify_role')}
                      value={rule.notify_role || ''}
                      onChange={(event) => updatePlaybook(rule.id, 'notify_role', event.target.value || null)}
                      className="w-32 shrink-0 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2 py-2 outline-none"
                    >
                      <option value="">{t('aiprof_opt_no_role')}</option>
                      {NOTIFY_ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>{t(`aiprof_role_${role}`)}</option>
                      ))}
                    </select>
                  </div>
                  <label className="block text-xs text-[#A4B0B7]">Route to team members
                    <select multiple aria-label="Route to team members" value={rule.target_user_ids || []} onChange={(event) => updatePlaybook(rule.id, 'target_user_ids', Array.from(event.target.selectedOptions, (option) => option.value))} className="block w-full mt-1 bg-[#0A1019] border border-[#243246] rounded-lg text-white px-2 py-2">
                      {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs text-[#A4B0B7]">Transfer number for this route
                    <input type="tel" aria-label="Route transfer number" placeholder="+15551234567" value={rule.transfer_number || ''} onChange={(event) => updatePlaybook(rule.id, 'transfer_number', event.target.value)} className="block w-full mt-1 bg-[#0A1019] border border-[#243246] rounded-lg text-white px-2 py-2" />
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    placeholder={t('aiprof_ph_playbook_note')}
                    value={rule.crm_note || ''}
                    onChange={(event) => updatePlaybook(rule.id, 'crm_note', event.target.value)}
                    className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                  />
                </div>
              ))}
              {!(callSettings?.call_routing_rules || []).length ? (
                <p className="text-[#4A5568] text-xs">{t('aiprof_no_playbooks')}</p>
              ) : null}
              <button
                type="button"
                onClick={addPlaybook}
                className="w-full py-2.5 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} /> {t('aiprof_btn_add_playbook')}
              </button>
            </div>
          </SectionCard>
  );
}
