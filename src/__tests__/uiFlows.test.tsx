import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';

function createSampleJsonFile(): File {
  const payload = JSON.stringify([{ id: 1, title: 'OmniConvert' }], null, 2);
  return new File([payload], 'data.json', { type: 'application/json' });
}

async function createSamplePdfFile(name: string, pages = 1): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([400, 600]);
  }
  const bytes = await doc.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], name, { type: 'application/pdf' });
}

describe('OmniConvert Pro UI, PDF Merge, Preview & Store Compliance Flows', () => {
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

  it('runs a real local JSON -> YAML conversion end-to-end and opens Preview modal', async () => {
    render(<App />);
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [createSampleJsonFile()] } });

    const chooseBtn = await screen.findByTestId('choose-target-btn');
    // Dock CTA sits cleanly outside scroll-viewport while BottomNav is visible
    expect(screen.getByTestId('nav-convert')).toBeInTheDocument();
    fireEvent.click(chooseBtn);

    const yamlOpt = await screen.findByTestId('target-option-yaml');
    // Inside ToolWorkspaceSheet, TopBar and BottomNav MUST NOT exist in the DOM at all
    expect(screen.queryByTestId('nav-convert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offline-lock-toggle')).not.toBeInTheDocument();
    fireEvent.click(yamlOpt);

    const startBtn = screen.getByTestId('start-conversion-btn');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByTestId('queue-job-completed')).toBeInTheDocument();
    });

    // Open live preview modal and verify converted YAML content is shown
    fireEvent.click(screen.getByTestId('queue-preview-btn'));
    expect(await screen.findByText(/OmniConvert/)).toBeInTheDocument();
  });

  it('completes the guided PDF Merge workflow with 2 PDFs end-to-end', async () => {
    const pdf1 = await createSamplePdfFile('sozlesme_1.pdf', 1);
    const pdf2 = await createSamplePdfFile('ek_2.pdf', 2);

    render(<App />);
    fireEvent.click(screen.getByTestId('tool-card-pdf-merge'));

    const wsInput = await screen.findByTestId('workspace-file-input');
    fireEvent.change(wsInput, { target: { files: [pdf1, pdf2] } });

    const mergeBtn = await screen.findByTestId('start-conversion-btn');
    await waitFor(() => {
      expect(mergeBtn).not.toBeDisabled();
    });

    fireEvent.click(mergeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('queue-job-completed')).toBeInTheDocument();
    });
  });

  it('opens balanced 3-tier Pro Paywall (Yearly, Lifetime, Monthly) with Restore Purchases', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-settings'));
    fireEvent.click(await screen.findByTestId('open-paywall-btn'));

    expect(await screen.findByTestId('plan-yearly')).toBeInTheDocument();
    expect(screen.getByTestId('plan-lifetime')).toBeInTheDocument();
    expect(screen.getByTestId('plan-monthly')).toBeInTheDocument();
    expect(screen.getByTestId('paywall-restore-btn')).toBeInTheDocument();
  });

  it('exposes Restore Purchases and Open Source Licenses in Settings', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-settings'));

    expect(await screen.findByTestId('settings-restore-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-licenses-btn'));
    expect(await screen.findByText(/Capacitor \(Core & iOS\)/i)).toBeInTheDocument();
    expect(await screen.findByText(/PDF\.js/i)).toBeInTheDocument();
    expect(await screen.findByText(/Zero GPL/i)).toBeInTheDocument();
  });
});
