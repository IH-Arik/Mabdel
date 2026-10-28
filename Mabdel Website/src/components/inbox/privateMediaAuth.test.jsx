import { describe, expect, it, beforeEach } from 'vitest';
import { withAuth } from './privateMediaAuth';
import { API_BASE_URL } from '../../api/client';

describe('withAuth', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'real-session-token');
  });

  it('attaches the token for our own private-media path', () => {
    const url = `${API_BASE_URL}/api/v1/media/private/message_attachments/owner1/file.png`;
    expect(withAuth(url)).toContain('token=real-session-token');
  });

  it('regression for R07: never attaches the token to an attacker-controlled host even when the path contains the same substring', () => {
    const url = 'https://attacker.example/media/private/collect.png';
    const result = withAuth(url);
    expect(result).toBe(url);
    expect(result).not.toContain('real-session-token');
  });

  it('never attaches the token to our own origin on an unrelated path', () => {
    const url = `${API_BASE_URL}/api/v1/some/other/route`;
    const result = withAuth(url);
    expect(result).not.toContain('real-session-token');
  });
});
