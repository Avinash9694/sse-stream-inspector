import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app';
import { useInspector } from '../store';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  },
);

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
    useInspector.getState().clear();
    useInspector.setState({ drawerOpen: false, highlighted: [], highlightLabel: null });
  });

  it('boots with the dual-spelling sample and surfaces the renamed-event error', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /timeline/i })).toBeInTheDocument();
    await waitFor(() => expect(useInspector.getState().frames.length).toBeGreaterThan(0));
    const diagnosticsButton = await screen.findByRole('button', { name: /^diagnostics/i });
    expect(within(diagnosticsButton).getByText('1E')).toBeInTheDocument();

    await userEvent.click(diagnosticsButton);
    const drawer = screen.getByRole('complementary', { name: /diagnostics/i });
    expect(within(drawer).getByText(/Event spelled 2 ways/)).toBeInTheDocument();
    expect(within(drawer).getByText(/token stream/i)).toBeInTheDocument();
  });

  it('jumps to the frames a diagnostic points at and shows the selected payload', async () => {
    render(<App />);
    await waitFor(() => expect(useInspector.getState().frames.length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('button', { name: /^diagnostics/i }));
    const drawer = screen.getByRole('complementary', { name: /diagnostics/i });
    await userEvent.click(within(drawer).getByRole('button', { name: /Event spelled 2 ways/ }));
    expect(useInspector.getState().selected).toBe(1);
    expect(useInspector.getState().highlighted).toEqual([1, 2, 3, 4, 5]);
    const detail = screen.getByRole('region', { name: /frame detail/i });
    expect(within(detail).getByText('component:')).toBeInTheDocument();
  });

  it('arrow keys move the selection through the timeline', async () => {
    render(<App />);
    await waitFor(() => expect(useInspector.getState().frames.length).toBeGreaterThan(0));
    const list = screen.getByRole('listbox', { name: /frames/i });
    list.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(useInspector.getState().selected).toBe(2);
    await userEvent.keyboard('{Home}');
    expect(useInspector.getState().selected).toBe(0);
  });

  it('shows a parse error for an empty paste', async () => {
    render(<App />);
    await waitFor(() => expect(useInspector.getState().frames.length).toBeGreaterThan(0));
    const textarea = screen.getByRole('textbox', { name: /raw/i });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, '   ');
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing to parse/i);
  });

  it('renders the attribution footer', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Avinash Sahu' })).toHaveAttribute(
      'href',
      'https://avinash9694.github.io',
    );
    expect(screen.getByRole('link', { name: /github profile/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /linkedin profile/i })).toBeInTheDocument();
  });
});
