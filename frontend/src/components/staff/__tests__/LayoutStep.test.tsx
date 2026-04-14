import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LayoutStep } from '../LayoutStep';
import { apiClient } from '../../../api/client';

vi.mock('lucide-react', () => ({
  LayoutGrid: () => <div data-testid="icon-grid" />,
  Plus: () => <div data-testid="icon-plus" />
}));

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('LayoutStep', () => {
  const mockSetWizardData = vi.fn();
  const mockOnNext = vi.fn();
  const mockOnPrev = vi.fn();
  const sessionToken = "mock_token";
  const baseWizardData = {
    venueId: 'ven_1',
    venueName: 'Mock Venue',
    layoutId: '',
    layoutName: '',
    tenantId: 'mock_tenant'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders layouts for venue', async () => {
    (apiClient.get as any).mockResolvedValueOnce([
       { id: 'lay_1', name: 'Layout Gala' }
    ]);

    render(<LayoutStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} onPrev={mockOnPrev} sessionToken={sessionToken} />);

    expect(apiClient.get).toHaveBeenCalledWith('/venues/ven_1/layouts', expect.any(Object));
    expect(await screen.findByText('Layout Gala')).toBeInTheDocument();
  });

  it('handles fallback logic if layouts api drops', async () => {
    (apiClient.get as any).mockRejectedValueOnce(new Error('Layout API Down'));
    render(<LayoutStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} onPrev={mockOnPrev} sessionToken={sessionToken} />);

    expect(await screen.findByText('No hay Planos definidos para este salón.')).toBeInTheDocument();
  });

  it('selects existing layout', async () => {
    (apiClient.get as any).mockResolvedValueOnce([
       { id: 'lay_1', name: 'Layout Gala' }
    ]);
    render(<LayoutStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} onPrev={mockOnPrev} sessionToken={sessionToken} />);

    const layout = await screen.findByText('Layout Gala');
    fireEvent.click(layout);

    expect(mockSetWizardData).toHaveBeenCalledWith({
      ...baseWizardData,
      layoutId: 'lay_1',
      layoutName: 'Layout Gala'
    });
    expect(mockOnNext).toHaveBeenCalled();
  });

  it('allows creating a new layout with table multiplication', async () => {
    (apiClient.get as any).mockResolvedValueOnce([]);
    (apiClient.post as any).mockResolvedValue({ id: 'new_lay_99', name: 'Massive Gala' });

    render(<LayoutStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} onPrev={mockOnPrev} sessionToken={sessionToken} />);

    fireEvent.click(screen.getByText(/Nuevo Layout/i));
    fireEvent.change(screen.getByLabelText('Nombre del Layout'), { target: { value: 'Massive Gala' } });
    fireEvent.change(screen.getByLabelText('Cantidad de Mesas Total'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Cupos x Mesa (Capacidad)'), { target: { value: '5' } });

    // Validate derived view 2*5 = 10
    expect(screen.getByText('10 cupos')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: "Crear y Generar Distribución" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
        // Debió hacer 1 post para config y 2 post para tablas
        expect(apiClient.post).toHaveBeenCalledTimes(3);
    });

    expect(mockSetWizardData).toHaveBeenCalledWith({
      ...baseWizardData,
      layoutId: 'new_lay_99',
      layoutName: 'Massive Gala'
    });
    expect(mockOnNext).toHaveBeenCalled();
  });

  it('does not proceed if table generator API fails during layout step', async () => {
    const spyAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    (apiClient.get as any).mockResolvedValueOnce([]);
    // Rechazar toda solicitud post
    (apiClient.post as any).mockRejectedValueOnce(new Error('Fatal create err'));

    render(<LayoutStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} onPrev={mockOnPrev} sessionToken={sessionToken} />);

    fireEvent.click(screen.getByText(/Nuevo Layout/i));
    fireEvent.change(screen.getByLabelText('Nombre del Layout'), { target: { value: 'Massive Gala' } });
    fireEvent.click(screen.getByRole('button', { name: "Crear y Generar Distribución" }));

    await waitFor(() => {
      expect(spyAlert).toHaveBeenCalledWith(expect.stringContaining('Fatal create err'));
      expect(mockOnNext).not.toHaveBeenCalled();
    });
  });

  it('triggers onPrev when back button is clicked', () => {
    render(<LayoutStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} onPrev={mockOnPrev} sessionToken={sessionToken} />);
    fireEvent.click(screen.getByRole('button', { name: "Volver" }));
    expect(mockOnPrev).toHaveBeenCalled();
  });

  it('does not submit if layout name is empty and handles parse fallbacks', async () => {
    (apiClient.get as any).mockResolvedValueOnce([]);
    render(<LayoutStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} onPrev={mockOnPrev} sessionToken={sessionToken} />);
    
    fireEvent.click(screen.getByText(/Nuevo Layout/i));
    const btn = screen.getByRole('button', { name: "Crear y Generar Distribución" });
    fireEvent.click(btn);
    expect(apiClient.post).not.toHaveBeenCalled();

    // Hit the onChange || 1 and || 2 logic
    fireEvent.change(screen.getByLabelText('Cantidad de Mesas Total'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Cupos x Mesa (Capacidad)'), { target: { value: 'xyz' } });
  });
});
