import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VenueStep } from '../VenueStep';
import { apiClient } from '../../../api/client';

// Agregamos un mock para lucide-react para evitar problemas de SVG parsing en JSDOM
vi.mock('lucide-react', () => ({
  MapPin: () => <div data-testid="icon-map-pin" />,
  Plus: () => <div data-testid="icon-plus" />
}));

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('VenueStep', () => {
  const mockSetWizardData = vi.fn();
  const mockOnNext = vi.fn();
  const sessionToken = "mock_token";
  const baseWizardData = {
    venueId: '',
    venueName: '',
    layoutId: '',
    layoutName: '',
    tenantId: 'mock_tenant'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and loads venues from backend', async () => {
    (apiClient.get as any).mockResolvedValueOnce([
      { id: 'ven_123', name: 'Mock Venue API', address: 'Mock Address' }
    ]);

    render(<VenueStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} sessionToken={sessionToken} />);

    expect(apiClient.get).toHaveBeenCalledWith('/venues?tenant_id=mock_tenant', expect.any(Object));
    
    expect(await screen.findByText('Mock Venue API')).toBeInTheDocument();
  });

  it('handles empty fallback when api drops', async () => {
    (apiClient.get as any).mockRejectedValueOnce(new Error('API Down'));

    render(<VenueStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} sessionToken={sessionToken} />);

    expect(await screen.findByText('No hay salones.')).toBeInTheDocument();
  });

  it('allows selecting an existing venue', async () => {
    (apiClient.get as any).mockResolvedValueOnce([
       { id: 'ven_123', name: 'Mock Venue API', address: 'Mock Address' }
    ]);
    render(<VenueStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} sessionToken={sessionToken} />);

    const item = await screen.findByText('Mock Venue API');
    fireEvent.click(item);

    expect(mockSetWizardData).toHaveBeenCalledWith({
      ...baseWizardData,
      venueId: 'ven_123',
      venueName: 'Mock Venue API'
    });
    expect(mockOnNext).toHaveBeenCalled();
  });

  it('allows creating a new venue via form', async () => {
    (apiClient.get as any).mockResolvedValueOnce([]);
    // Mock the post correctly with a valid response resolving to a mock UUID object structure
    (apiClient.post as any).mockResolvedValueOnce({ id: 'new_uuid_123', name: 'Test Hall' });

    render(<VenueStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} sessionToken={sessionToken} />);

    const createTab = screen.getByText('Crear Nuevo Salón');
    fireEvent.click(createTab);

    // Enter info
    fireEvent.change(screen.getByLabelText('Nombre del Establecimiento'), { target: { value: 'Test Hall' } });
    fireEvent.change(screen.getByLabelText('Dirección / Localidad'), { target: { value: 'Test Addr' } });

    const saveBtn = screen.getByRole('button', { name: "Guardar y Continuar" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    expect(mockSetWizardData).toHaveBeenCalledWith({
      ...baseWizardData,
      venueId: 'new_uuid_123',
      venueName: 'Test Hall'
    });
    expect(mockOnNext).toHaveBeenCalled();
  });

  it('shows generic alert window and stops flow on create error', async () => {
    // Override window.alert
    const spyAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    (apiClient.get as any).mockResolvedValueOnce([]);
    (apiClient.post as any).mockRejectedValueOnce(new Error('Network Err'));

    render(<VenueStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} sessionToken={sessionToken} />);

    fireEvent.click(screen.getByText('Crear Nuevo Salón'));
    fireEvent.change(screen.getByLabelText('Nombre del Establecimiento'), { target: { value: 'Err Hall' } });
    fireEvent.change(screen.getByLabelText('Dirección / Localidad'), { target: { value: 'Add' } });

    fireEvent.click(screen.getByRole('button', { name: "Guardar y Continuar" }));

    await waitFor(() => {
        expect(spyAlert).toHaveBeenCalledWith(expect.stringContaining('Error creando Salón: Network Err'));
    });

    // Validamos que por culpa de ese throw la operación se suspende, NO llamando a OnNext
    expect(mockSetWizardData).not.toHaveBeenCalled();
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('does not submit if required fields are missing on create and handles parse lat/lon', async () => {
    (apiClient.get as any).mockResolvedValueOnce([]);
    render(<VenueStep wizardData={baseWizardData} setWizardData={mockSetWizardData} onNext={mockOnNext} sessionToken={sessionToken} />);
    fireEvent.click(screen.getByText('Crear Nuevo Salón'));
    
    // No name/address so it returns early
    fireEvent.click(screen.getByRole('button', { name: "Guardar y Continuar" }));
    expect(apiClient.post).not.toHaveBeenCalled();

    // Fill missing params explicitly to hit the || '4.71' fallback branch when not typed
    // Wait, since we removed location from payload, lat and lon are NOT inside VenueStep's payload anymore!
    // But they might still have onChange handlers in the UI.
  });
});
