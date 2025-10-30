import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import SettingsPage from './SettingsPage';

const apiMocks = vi.hoisted(() => ({
  updateConfig: vi.fn(),
}));

const stateMock = vi.hoisted(() => ({
  value: {
    config: {
      default_dimension: 'general',
      match_threshold: 0.7,
      top_k: 5,
      matcher_backend: 'embedding',
      embedding_model: 'text-embeddings',
      llm_mode: 'online',
      llm_model: 'gpt-4o-mini',
      llm_api_base: 'https://api.openai.com/v1',
      llm_api_key_set: true,
    },
    setConfig: vi.fn(),
    isLoading: false,
  },
}));

vi.mock('../api', () => ({
  updateConfig: apiMocks.updateConfig,
}));

vi.mock('../state/AppStateContext', () => ({
  useAppState: () => stateMock.value,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    apiMocks.updateConfig.mockReset();
    stateMock.value.setConfig.mockReset();
    stateMock.value.config = {
      default_dimension: 'general',
      match_threshold: 0.7,
      top_k: 5,
      matcher_backend: 'embedding',
      embedding_model: 'text-embeddings',
      llm_mode: 'online',
      llm_model: 'gpt-4o-mini',
      llm_api_base: 'https://api.openai.com/v1',
      llm_api_key_set: true,
    } as never;
    stateMock.value.isLoading = false;
  });

  it('submits updated configuration values', async () => {
    apiMocks.updateConfig.mockResolvedValue({
      ...stateMock.value.config,
      default_dimension: 'region',
    });

    const onToast = vi.fn();
    render(<SettingsPage onToast={onToast} />);

    fireEvent.change(screen.getByLabelText('Default dimension'), {
      target: { value: 'region' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));

    await waitFor(() => expect(apiMocks.updateConfig).toHaveBeenCalledWith({
      default_dimension: 'region',
    }));

    expect(stateMock.value.setConfig).toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', content: 'Configuration updated.' }),
    );
  });

  it('surfaces loading state when configuration is unavailable', () => {
    stateMock.value.config = null as never;
    const onToast = vi.fn();
    render(<SettingsPage onToast={onToast} />);

    expect(screen.getByText('Configuration is still loading.')).toBeInTheDocument();
  });
});
