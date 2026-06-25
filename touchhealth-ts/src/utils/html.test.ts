import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml', () => {
  it('escapes the five dangerous HTML characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('neutralises a script-injection patient name', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const out = escapeHtml(malicious);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-strings safely', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(true)).toBe('true');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('Ugali wa Mahindi')).toBe('Ugali wa Mahindi');
  });
});
