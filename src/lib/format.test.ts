import { describe, expect, it } from 'vitest';
import { maskPhone, PHONE_MAX_LENGTH } from './format';

describe('maskPhone', () => {
  it('formats a mobile number as it is typed', () => {
    expect(maskPhone('1')).toBe('(1');
    expect(maskPhone('119')).toBe('(11) 9');
    expect(maskPhone('11999998888')).toBe('(11) 99999-8888');
  });

  it('formats a landline with 10 digits', () => {
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('drops letters and anything past 11 digits', () => {
    const masked = maskPhone('(11) 99999-88887777abc');
    expect(masked).toBe('(11) 99999-8888');
    expect(masked.length).toBeLessThanOrEqual(PHONE_MAX_LENGTH);
  });
});
