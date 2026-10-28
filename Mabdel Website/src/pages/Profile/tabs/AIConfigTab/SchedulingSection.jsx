import { Ban, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { LABEL } from '../../shared';
import { WEEKDAYS } from './constants';
import SectionCard from './SectionCard';

export default function SchedulingSection({
  providers, appointmentTypes, loadingScheduling, teamMembers,
  newProviderName, setNewProviderName, newProviderRole, setNewProviderRole,
  newProviderLinkedId, setNewProviderLinkedId, newProviderWorkingDays, setNewProviderWorkingDays,
  newProviderStartHour, setNewProviderStartHour, newProviderEndHour, setNewProviderEndHour,
  newTypeName, setNewTypeName, newTypeMinutes, setNewTypeMinutes,
  newTypeEligibleProviderIds, setNewTypeEligibleProviderIds, schedulingError,
  savingProvider, savingType, handleAddProvider, handleToggleProvider, handleDeleteProvider,
  handleAddType, handleToggleType, handleDeleteType, t,
}) {
  return (
          <SectionCard icon={Users} title={t('aiprof_hdr_scheduling')} description={t('aiprof_scheduling_desc')}>
            {schedulingError ? (
              <p className="text-rose-300 text-xs mb-3 flex items-center gap-1.5"><Ban size={12} />{schedulingError}</p>
            ) : null}
            {loadingScheduling ? (
              <div className="flex items-center justify-center h-16"><Loader2 className="animate-spin text-[#9333ea]" size={18} /></div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={LABEL}>{t('aiprof_lbl_providers')}</label>
                  <div className="space-y-1.5 mb-3">
                    {providers.map((provider) => (
                      <div key={provider.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${provider.active ? 'bg-[#131A24] border-[#243041]' : 'bg-[#131A24]/40 border-[#243041]/60 opacity-60'}`}>
                        <span className="flex-1 min-w-0 text-white text-xs font-semibold truncate">
                          {provider.name}{provider.role_title ? <span className="text-[#A4B0B7] font-normal"> · {provider.role_title}</span> : null}
                        </span>
                        <button type="button" onClick={() => handleToggleProvider(provider)} className="text-[10px] font-bold text-[#9333ea] cursor-pointer">
                          {provider.active ? t('aiprof_btn_pause') : t('aiprof_btn_resume')}
                        </button>
                        <button type="button" onClick={() => handleDeleteProvider(provider)} className="text-[#A4B0B7] hover:text-rose-400 cursor-pointer" title={t('aiprof_btn_remove')}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {!providers.length ? <p className="text-[#4A5568] text-xs">{t('aiprof_no_providers')}</p> : null}
                  </div>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_provider_name')}
                      value={newProviderName}
                      onChange={(event) => setNewProviderName(event.target.value)}
                      className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <input
                      type="text"
                      maxLength={60}
                      placeholder={t('aiprof_ph_provider_role')}
                      value={newProviderRole}
                      onChange={(event) => setNewProviderRole(event.target.value)}
                      className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    {teamMembers.length ? (
                      <select
                        aria-label={t('aiprof_lbl_providers')}
                        value={newProviderLinkedId}
                        onChange={(event) => setNewProviderLinkedId(event.target.value)}
                        className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none"
                      >
                        <option value="">{t('aiprof_opt_no_login')}</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                    ) : null}
                    <div>
                      <span className="text-[#70829B] text-[10px] block mb-1">{t('aiprof_lbl_provider_working_days')}</span>
                      <div className="flex gap-1">
                        {WEEKDAYS.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setNewProviderWorkingDays((current) =>
                              current.includes(day.value) ? current.filter((d) => d !== day.value) : [...current, day.value]
                            )}
                            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                              newProviderWorkingDays.includes(day.value)
                                ? 'bg-[#9333ea]/20 border-[#9333ea]/50 text-[#9333ea]'
                                : 'bg-[#131A24] border-[#243041] text-[#70829B]'
                            }`}
                          >
                            {t(day.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#70829B] text-[10px] block mb-1">{t('aiprof_lbl_provider_working_hours')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={0} max={23}
                          placeholder="Start"
                          value={newProviderStartHour}
                          onChange={(event) => setNewProviderStartHour(event.target.value)}
                          className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2 py-1.5 outline-none"
                        />
                        <span className="text-[#70829B] text-xs">–</span>
                        <input
                          type="number" min={1} max={24}
                          placeholder="End"
                          value={newProviderEndHour}
                          onChange={(event) => setNewProviderEndHour(event.target.value)}
                          className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2 py-1.5 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddProvider}
                      disabled={savingProvider || !newProviderName.trim()}
                      className="w-full py-2 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {savingProvider ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      {t('aiprof_btn_add_provider')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={LABEL}>{t('aiprof_lbl_appointment_types')}</label>
                  <div className="space-y-1.5 mb-3">
                    {appointmentTypes.map((type) => (
                      <div key={type.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${type.active ? 'bg-[#131A24] border-[#243041]' : 'bg-[#131A24]/40 border-[#243041]/60 opacity-60'}`}>
                        <span className="flex-1 min-w-0 text-white text-xs font-semibold truncate">
                          {type.name} <span className="text-[#A4B0B7] font-normal">· {type.duration_minutes} min</span>
                        </span>
                        <button type="button" onClick={() => handleToggleType(type)} className="text-[10px] font-bold text-[#9333ea] cursor-pointer">
                          {type.active ? t('aiprof_btn_pause') : t('aiprof_btn_resume')}
                        </button>
                        <button type="button" onClick={() => handleDeleteType(type)} className="text-[#A4B0B7] hover:text-rose-400 cursor-pointer" title={t('aiprof_btn_remove')}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {!appointmentTypes.length ? <p className="text-[#4A5568] text-xs">{t('aiprof_no_types')}</p> : null}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_type_name')}
                      value={newTypeName}
                      onChange={(event) => setNewTypeName(event.target.value)}
                      className="flex-1 min-w-0 bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={newTypeMinutes}
                      onChange={(event) => setNewTypeMinutes(event.target.value)}
                      title={t('aiprof_lbl_minutes')}
                      className="w-16 bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <button
                      type="button"
                      onClick={handleAddType}
                      disabled={savingType || !newTypeName.trim()}
                      className="px-3 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg cursor-pointer disabled:opacity-60"
                      title={t('aiprof_btn_add_type')}
                    >
                      {savingType ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    </button>
                  </div>
                  {providers.length ? (
                    <div className="mt-2">
                      <span className="text-[#70829B] text-[10px] block mb-1">{t('aiprof_lbl_eligible_providers')}</span>
                      <div className="flex flex-wrap gap-1">
                        {providers.map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setNewTypeEligibleProviderIds((current) =>
                              current.includes(provider.id) ? current.filter((id) => id !== provider.id) : [...current, provider.id]
                            )}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                              newTypeEligibleProviderIds.includes(provider.id)
                                ? 'bg-[#9333ea]/20 border-[#9333ea]/50 text-[#9333ea]'
                                : 'bg-[#131A24] border-[#243041] text-[#70829B]'
                            }`}
                          >
                            {provider.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </SectionCard>
  );
}
