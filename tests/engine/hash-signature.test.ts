import { describe, it, expect } from 'vitest';
import { isSha256, hashLabel } from '../../src/engine/transitions/hash';
import { signatureFor } from '../../src/engine/transitions/signatures';

const H = 'A'.repeat(8) + 'b'.repeat(48) + 'C'.repeat(8);

describe('hash signature', () => {
  it('accepts only a real 64-digit hex SHA-256', () => {
    expect(isSha256(H)).toBe(true);
    expect(isSha256('abc')).toBe(false);
    expect(isSha256('g'.repeat(64))).toBe(false);
    expect(isSha256(undefined)).toBe(false);
    expect(isSha256('')).toBe(false);
  });
  it('shortens to the first and last 8 digits, lowercase', () => expect(hashLabel(H)).toBe('aaaaaaaa…cccccccc'));
  it('is registered, and is not ready without a sample hash (plain navigation)', () => {
    const sig = signatureFor('hash')!;
    expect(sig.id).toBe('hash');
    const a = document.createElement('a');
    expect(sig.ready!(a)).toBe(false);
    a.dataset.sigHash = 'nope';
    expect(sig.ready!(a)).toBe(false);
    a.dataset.sigHash = H;
    expect(sig.ready!(a)).toBe(true);
  });
  it('forms an aria-hidden overlay with the label, and cleans up after itself', async () => {
    const a = document.createElement('a');
    a.dataset.sigHash = H;
    document.body.append(a);
    (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
    const done = await signatureFor('hash')!.form(a);
    const el = document.querySelector('.sig-hash')!;
    expect(el.textContent).toBe('aaaaaaaa…cccccccc');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    done();
    expect(document.querySelector('.sig-hash')).toBeNull();
  });
});
