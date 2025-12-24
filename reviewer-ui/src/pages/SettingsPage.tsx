import { useMemo, useState } from 'react';
import { Button, Card, Col, Form, Spinner } from '../components/ui';

import { updateConfig } from '../api';
import { useAppState } from '../state/AppStateContext';
import type { ToastMessage } from '../types';

interface SettingsPageProps {
  onToast: (toast: ToastMessage) => void;
}

const SettingsPage = ({ onToast }: SettingsPageProps) => {
  const { config, setConfig, isLoading } = useAppState();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleChange = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload: Record<string, string | number> = {};
      Object.entries(draft).forEach(([key, value]) => {
        if (value === '') {
          return;
        }
        if (key === 'match_threshold' || key === 'top_k') {
          payload[key] = Number(value);
        } else {
          payload[key] = value;
        }
      });
      const updated = await updateConfig(payload);
      setConfig(() => updated);
      setDraft({});
      onToast({ type: 'success', content: 'Configuration updated.' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const currentValues = useMemo(() => ({
    default_dimension: config?.default_dimension ?? '',
    match_threshold: config?.match_threshold?.toString() ?? '',
    top_k: config?.top_k?.toString() ?? '',
    embedding_model: config?.embedding_model ?? '',
    llm_mode: config?.llm_mode ?? 'online',
    llm_model: config?.llm_model ?? '',
    llm_api_base: config?.llm_api_base ?? '',
  }), [
    config?.default_dimension,
    config?.match_threshold,
    config?.top_k,
    config?.embedding_model,
    config?.llm_mode,
    config?.llm_model,
    config?.llm_api_base,
  ]);

  return (
    <div className="flex flex-col gap-4" aria-busy={isLoading}>
      <Card className="card-section">
        <Card.Body className="flex flex-col gap-4">
          <div>
            <Card.Title as="h1" className="section-heading text-xl mb-2">
              System configuration
            </Card.Title>
            <Card.Text className="text-slate-400 mb-0">
              Fine-tune matcher defaults, LLM integrations, and semantic controls. Changes apply immediately after saving.
            </Card.Text>
          </div>
          {config ? (
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
              className="grid grid-cols-12 gap-3"
            >
              <Form.Group as={Col} md={6} controlId="settings-default-dimension">
                <Form.Label>Default dimension</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. region"
                  value={draft.default_dimension ?? currentValues.default_dimension}
                  onChange={(event) => handleChange('default_dimension', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={3} controlId="settings-match-threshold">
                <Form.Label>Match threshold</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  value={draft.match_threshold ?? currentValues.match_threshold}
                  onChange={(event) => handleChange('match_threshold', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={3} controlId="settings-top-k">
                <Form.Label>Top K results</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={20}
                  value={draft.top_k ?? currentValues.top_k}
                  onChange={(event) => handleChange('top_k', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={6} controlId="settings-embedding-model">
                <Form.Label>Embedding model</Form.Label>
                <Form.Control
                  type="text"
                  value={draft.embedding_model ?? currentValues.embedding_model}
                  onChange={(event) => handleChange('embedding_model', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={6} controlId="settings-llm-mode">
                <Form.Label>LLM mode</Form.Label>
                <Form.Select
                  value={draft.llm_mode ?? currentValues.llm_mode}
                  onChange={(event) => handleChange('llm_mode', event.target.value)}
                >
                  <option value="online">Online API (OpenAI compatible)</option>
                  <option value="offline">Offline Ollama (llama3)</option>
                </Form.Select>
                <Form.Text className="text-slate-400">
                  Choose between the hosted API endpoint and the bundled Ollama service.
                </Form.Text>
              </Form.Group>
              <Form.Group as={Col} md={6} controlId="settings-llm-model">
                <Form.Label>LLM model</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="gpt-4o-mini"
                  value={draft.llm_model ?? currentValues.llm_model}
                  onChange={(event) => handleChange('llm_model', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={6} controlId="settings-llm-api-base">
                <Form.Label>LLM API base URL</Form.Label>
                <Form.Control
                  type="url"
                  placeholder="https://api.openai.com/v1"
                  value={draft.llm_api_base ?? currentValues.llm_api_base}
                  onChange={(event) => handleChange('llm_api_base', event.target.value)}
                />
              </Form.Group>
              <Col xs={12} className="flex justify-end">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                      Saving…
                    </span>
                  ) : (
                    'Save configuration'
                  )}
                </Button>
              </Col>
            </Form>
          ) : (
            <p className="text-slate-400 mb-0">Configuration is still loading.</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default SettingsPage;
