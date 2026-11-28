import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { expect, it, vi } from 'vitest';
import { PublicHome } from './PublicHome';

vi.mock('../../contexts/CompanyContext', () => ({ useCompany: () => ({ company: null }) }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [{ id: 'car', brand: 'Porsche', model: 'Cayenne Híbrido', year: 2024, sale_price: 100000 }],
          }),
        }),
      }),
    }),
  },
}));
vi.mock('../../services/storage.service', () => ({ thumbUrl: (url: string) => url }));

function VehicleDetailsStub() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Voltar</button>;
}

it('finds a vehicle across brand and model and keeps the search after going back', async () => {
  render(
    <MemoryRouter initialEntries={['/estoque']}>
      <Routes>
        <Route path="/estoque" element={<PublicHome />} />
        <Route path="/vehicles/:id" element={<VehicleDetailsStub />} />
      </Routes>
    </MemoryRouter>
  );

  const vehicle = { name: /Porsche Cayenne Híbrido/ };
  await screen.findByRole('link', vehicle);
  const search = screen.getByRole('textbox', { name: /buscar veículos/i });
  fireEvent.change(search, { target: { value: ' Porsche  Cayenne Hibrido ' } });

  fireEvent.click(await screen.findByRole('link', vehicle));
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

  expect(screen.getByRole('textbox', { name: /buscar veículos/i })).toHaveValue(' Porsche  Cayenne Hibrido ');
  expect(await screen.findByRole('link', vehicle)).toBeVisible();
});
