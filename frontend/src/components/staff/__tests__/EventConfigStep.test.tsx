import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventConfigStep } from '../EventConfigStep';
import { apiClient } from '../../../api/client';
import { BrowserRouter } from 'react-router-dom';

vi.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="icon-calendar" />,
  Rocket: () => <div data-testid="icon-rocket" />
}));

vi.mock('../../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
    put: vi.fn(),
  }
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('EventConfigStep', () => {
  const mockOnPrev = vi.fn();
  const sessionToken = "mock_token";
  const baseWizardData = {
    venueId: 'ven_1',
    venueName: 'Mock Venue',
    layoutId: 'lay_1',
    layoutName: 'Mock Layout',
    tenantId: 'mock_tenant'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with wizard data shown in descriptions', () => {
    renderWithRouter(<EventConfigStep wizardData={baseWizardData} onPrev={mockOnPrev} sessionToken={sessionToken} />);
    expect(screen.getByText(/Mock Venue/)).toBeInTheDocument();
    expect(screen.getByText(/Mock Layout/)).toBeInTheDocument();
  });

  it('triggers onPrev when back button is clicked', () => {
    renderWithRouter(<EventConfigStep wizardData={baseWizardData} onPrev={mockOnPrev} sessionToken={sessionToken} />);
    fireEvent.click(screen.getByRole('button', { name: "Volver" }));
    expect(mockOnPrev).toHaveBeenCalled();
  });

  it('submits 2 POST calls + 1 PUT call and redirects on successful creation', async () => {
    const spyAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // POST /events and POST /layout-binding
    (apiClient.post as any)
      .mockResolvedValueOnce({ id: 'new_evt_1', name: 'Graduation 2026' })
      .mockResolvedValueOnce({ id: 'binding_id' });
    // PUT /configuration (doc 8 §4.2.1 uses PUT for event configuration)
    (apiClient.put as any).mockResolvedValueOnce({ id: 'config_id' });

    renderWithRouter(<EventConfigStep wizardData={baseWizardData} onPrev={mockOnPrev} sessionToken={sessionToken} />);

    // Rellenamos el formuylario (todos los obligatorios)
    fireEvent.change(screen.getByLabelText('Nombre del Evento a Publicar'), { target: { value: 'Graduation 2026' } });
    fireEvent.change(screen.getByLabelText('Apertura Preventa'), { target: { value: '2026-06-30T10:00' } });
    fireEvent.change(screen.getByLabelText('Cierre Preventa'), { target: { value: '2026-06-30T12:00' } });
    fireEvent.change(screen.getByLabelText('Apertura Venta Libre'), { target: { value: '2026-06-30T13:00' } });
    fireEvent.change(screen.getByLabelText('Cierre Venta Libre'), { target: { value: '2026-06-30T18:00' } });
    fireEvent.change(screen.getByLabelText('Fecha del Evento en Físico'), { target: { value: '2026-06-30T19:00' } });
    
    // Simulate Submit action
    fireEvent.click(screen.getByRole('button', { name: "Crear Evento Oficial" }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(apiClient.put).toHaveBeenCalledTimes(1);
    });

    expect(spyAlert).toHaveBeenCalledWith('¡Evento creado, publicado y configurado exitosamente!');
    expect(mockNavigate).toHaveBeenCalledWith('/staff/dashboard');
  });

  it('stops flow and warns user if any creation API fails', async () => {
    const spyAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    (apiClient.post as any).mockRejectedValueOnce(new Error('DB Constraint Violation'));

    renderWithRouter(<EventConfigStep wizardData={baseWizardData} onPrev={mockOnPrev} sessionToken={sessionToken} />);

    // Fill required
    fireEvent.change(screen.getByLabelText('Nombre del Evento a Publicar'), { target: { value: 'Fail Event' } });
    fireEvent.change(screen.getByLabelText('Apertura Preventa'), { target: { value: '2026-06-30T10:00' } });
    fireEvent.change(screen.getByLabelText('Cierre Preventa'), { target: { value: '2026-06-30T12:00' } });
    fireEvent.change(screen.getByLabelText('Apertura Venta Libre'), { target: { value: '2026-06-30T13:00' } });
    fireEvent.change(screen.getByLabelText('Cierre Venta Libre'), { target: { value: '2026-06-30T18:00' } });
    fireEvent.change(screen.getByLabelText('Fecha del Evento en Físico'), { target: { value: '2026-06-30T19:00' } });
    
    fireEvent.click(screen.getByRole('button', { name: "Crear Evento Oficial" }));

    await waitFor(() => {
      expect(spyAlert).toHaveBeenCalledWith(expect.stringContaining('Error creando el Evento: DB Constraint Violation'));
      // No debió invocar navigate de ok
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('handles input fallbacks on tickets and empty dates in form change', () => {
    renderWithRouter(<EventConfigStep wizardData={baseWizardData} onPrev={mockOnPrev} sessionToken={sessionToken} />);
    
    fireEvent.change(screen.getByLabelText('Boletas permitidas por estudiante en Preventa'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Boletas permitidas por estudiante en Venta Normal'), { target: { value: 'xyz' } });
    fireEvent.change(screen.getByLabelText('Apertura Preventa'), { target: { value: '' } });
  });
});
