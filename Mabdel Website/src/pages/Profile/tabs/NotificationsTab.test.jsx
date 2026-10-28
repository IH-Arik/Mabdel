import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../../context/LanguageContext';
import en from '../../../i18n/locales/en-US.js';
import NotificationsTab from './NotificationsTab';

vi.mock('../../../api/services', () => ({
  smartflowApi: {
    getNotificationSettings: vi.fn().mockResolvedValue({ data: { data: {} } }),
    updateNotificationSettings: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

// Regression test for a real shipped bug: the label for each toggle was derived by
// string-munging item.key (e.g. 'new_messages' -> 'nprof_lbl_new_messages'), but the
// real translation keys are shorter (nprof_lbl_messages) - 5 of 8 labels silently
// rendered their raw i18n key instead of real text. This test fails the same way the
// bug did if the derivation logic (or the i18nKey mapping) ever drifts from the real
// translation file again.
describe('NotificationsTab', () => {
  it('every notification toggle label resolves to real text, not a raw i18n key', async () => {
    render(
      <LanguageProvider>
        <NotificationsTab />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const body = document.body.textContent;
    expect(body).not.toMatch(/nprof_lbl_/);

    const expectedLabels = [
      en.nprof_lbl_general,
      en.nprof_lbl_sound,
      en.nprof_lbl_vibrate,
      en.nprof_lbl_messages,
      en.nprof_lbl_missed,
      en.nprof_lbl_scheduled,
      en.nprof_lbl_tasks,
      en.nprof_lbl_calendar,
    ];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
