import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider, useLanguage } from './LanguageContext';

function Probe({ testKey }) {
  const { t, setLanguage, language } = useLanguage();
  return (
    <div>
      <span data-testid="value">{t(testKey)}</span>
      <span data-testid="language">{language}</span>
      <button onClick={() => setLanguage('bn-BD')}>switch to bengali</button>
    </div>
  );
}

describe('LanguageContext', () => {
  it('t() never returns a raw/unresolved key - it falls back to the key text itself, so a missing translation is visibly wrong, never silently blank', () => {
    render(
      <LanguageProvider>
        <Probe testKey="this_key_does_not_exist_anywhere" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('this_key_does_not_exist_anywhere');
  });

  it('resolves a real English key correctly on first render (English ships eagerly, no async wait needed)', () => {
    render(
      <LanguageProvider>
        <Probe testKey="prof_btn_upload" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('Upload Photo');
  });

  it('switching language actually loads and renders the new language, not just the English fallback', async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Probe testKey="prof_btn_upload" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('Upload Photo');

    await user.click(screen.getByText('switch to bengali'));

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('bn-BD');
    });
    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).not.toBe('Upload Photo');
      expect(screen.getByTestId('value').textContent).not.toBe('prof_btn_upload');
    });
  });
});
