import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';

function createSampleJsonFile(): File {
  const payload = JSON.stringify([{ id: 1, title: 'OmniConvert' }], null, 2);
  return new File([payload], 'data.json', { type: 'application/json' });
}

describe('OmniConvert Pro UI & Store Compliance Flows', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('toggles Offline Mode from TopBar and displays subtle offline status', () => {
    render(<App />);
    const toggle = screen.getByTestId('offline-lock-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('offline-lock-banner')).toBeInTheDocument();
  });

  it('runs a real local JSON -> YAML conversion end-to-end into the Queue', async () => {
    render(<App />);
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [createSampleJsonFile()] } });

    const chooseBtn = await screen.findByTestId('choose-target-btn');
    fireEvent.click(chooseBtn);

    const yamlOpt = await screen.findByTestId('target-option-yaml');
    fireEvent.click(yamlOpt);

    const startBtn = screen.getByTestId('start-conversion-btn');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByTestId('queue-job-completed')).toBeInTheDocument();
    });
  });

  it('prompts confirmation when tapping a Cloud target while Offline Mode is active', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('offline-lock-toggle'));

    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [createSampleJsonFile()] } });
    fireEvent.click(await screen.findByTestId('choose-target-btn'));

    const parquetBtn = await screen.findByTestId('target-all-parquet');
    fireEvent.click(parquetBtn);

    expect(await screen.findByTestId('confirm-temp-cloud-btn')).toBeInTheDocument();
  });

  it('exposes Restore Purchases and Open Source Licenses in Settings', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-settings'));

    expect(await screen.findByTestId('settings-restore-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-licenses-btn'));
    expect(await screen.findByText(/Capacitor \(Core & iOS\)/i)).toBeInTheDocument();
    expect(await screen.findByText(/Zero GPL/i)).toBeInTheDocument();
  });
});
