import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  SUPABASE_URL: 'https://demo.supabase.co',
  supabase: { supabaseUrl: 'https://demo.supabase.co', storage: { from: vi.fn() } },
}));

import { buildVehicleImagePaths, thumbUrl } from './storage.service';

describe('vehicle image storage helpers', () => {
  it('assembles tenant-scoped image and thumbnail paths', () => {
    expect(buildVehicleImagePaths('company-123', 'vehicles', 'image-456')).toEqual({
      imagePath: 'company-123/vehicles/image-456.webp',
      thumbnailPath: 'company-123/vehicles/image-456_thumb.webp',
    });
    expect(buildVehicleImagePaths('company-123', 'trade-in', 'image-456').imagePath)
      .toBe('company-123/trade-in/image-456.webp');
  });

  it('maps public Storage URLs to the matching thumbnail and preserves query parameters', () => {
    expect(thumbUrl('https://demo.supabase.co/storage/v1/object/public/vehicles/company/vehicles/car.webp?download=1'))
      .toBe('https://demo.supabase.co/storage/v1/object/public/vehicles/company/vehicles/car_thumb.webp?download=1');
  });

  it('preserves legacy data URLs, external URLs and thumbnail URLs', () => {
    const legacy = 'data:image/png;base64,abc';
    const external = 'https://cdn.example.test/car.jpg';
    const externalWithStorageLikePath = 'https://cdn.example.test/storage/v1/object/public/vehicles/car.webp';
    const thumbnail = 'https://demo.supabase.co/storage/v1/object/public/vehicles/company/car_thumb.webp';
    expect(thumbUrl(legacy)).toBe(legacy);
    expect(thumbUrl(external)).toBe(external);
    expect(thumbUrl(externalWithStorageLikePath)).toBe(externalWithStorageLikePath);
    expect(thumbUrl(thumbnail)).toBe(thumbnail);
  });
});
