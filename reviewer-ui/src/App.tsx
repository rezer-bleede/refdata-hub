import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCanonicalValue,
  fetchCanonicalValues,
  fetchConfig,
  proposeMatch,
  updateConfig,
} from './api';
import type { CanonicalValue, MatchCandidate, MatchResponse, SystemConfig } from './types';

interface ToastMessage {
  type: 'success' | 'error';
  content: string;
}

const matcherOptions = [
  { value: 'embedding', label: 'Embedding based (default)' },
  { value: 'llm', label: 'LLM orchestration' },
];

const App = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [canonicalValues, setCanonicalValues] = useState<CanonicalValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [matchInput, setMatchInput] = useState('');
  const [matchDimension, setMatchDimension] = useState('');
  const [matchResults, setMatchResults] = useState<MatchResponse | null>(null);
  const [newCanonical, setNewCanonical] = useState({
    dimension: '',
    canonical_label: '',
    description: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningMatch, setRunningMatch] = useState(false);
  const [creatingCanonical, setCreatingCanonical] = useState(false);

  const availableDimensions = useMemo(() => {
    const dimensionSet = new Set<string>();
    canonicalValues.forEach((value) => dimensionSet.add(value.dimension));
    if (config?.default_dimension) {
      dimensionSet.add(config.default_dimension);
    }
    return Array.from(dimensionSet);
  }, [canonicalValues, config?.default_dimension]);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [configResponse, canonicalResponse] = await Promise.all([
        fetchConfig(),
        fetchCanonicalValues(),
      ]);
      setConfig(configResponse);
      setCanonicalValues(canonicalResponse);
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Failed to load initial data' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleConfigChange = (key: string, value: string) => {
    setConfigDraft((draft) => ({ ...draft, [key]: value }));
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    setToast(null);
    try {
      const payload: Record<string, string | number> = {};
      Object.entries(configDraft).forEach(([key, value]) => {
        if (value !== '') {
          if (key === 'match_threshold') {
            payload[key] = Number(value);
          } else if (key === 'top_k') {
            payload[key] = Number(value);
          } else {
            payload[key] = value;
          }
        }
      });
      const updated = await updateConfig(payload);
      setConfig(updated);
      setConfigDraft({});
      setToast({ type: 'success', content: 'Configuration updated' });
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Unable to update configuration' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunMatch = async () => {
    if (!matchInput.trim()) {
      setToast({ type: 'error', content: 'Enter a raw value to match.' });
      return;
    }
    setRunningMatch(true);
    setToast(null);
    try {
      const response = await proposeMatch(matchInput.trim(), matchDimension || undefined);
      setMatchResults(response);
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Matching request failed' });
    } finally {
      setRunningMatch(false);
    }
  };

  const handleCreateCanonical = async () => {
    if (!newCanonical.dimension || !newCanonical.canonical_label) {
      setToast({ type: 'error', content: 'Provide dimension and label to create a canonical value.' });
      return;
    }
    setCreatingCanonical(true);
    setToast(null);
    try {
      const created = await createCanonicalValue(newCanonical);
      setCanonicalValues((values) => [...values, created].sort((a, b) => a.canonical_label.localeCompare(b.canonical_label)));
      setNewCanonical({ dimension: '', canonical_label: '', description: '' });
      setToast({ type: 'success', content: 'Canonical value added' });
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Failed to add canonical value' });
    } finally {
      setCreatingCanonical(false);
    }
  };

  const renderMatches = (matches: MatchCandidate[]) => {
    if (!matches.length) {
      return <div className="alert">No matches met the configured threshold.</div>;
    }

    return (
      <table className="table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Dimension</th>
            <th>Score</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.canonical_id}>
              <td>{match.canonical_label}</td>
              <td>{match.dimension}</td>
              <td>{(match.score * 100).toFixed(1)}%</td>
              <td>{match.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="app-wrapper">
      <header>
        <div>
          <h1>RefData Hub</h1>
          <p>Ship defaults instantly and push every additional change through the reviewer UI.</p>
        </div>
        {config && (
          <span className="badge">Matcher: {config.matcher_backend}</span>
        )}
      </header>

      {toast && (
        <div className="alert" role="status">
          {toast.content}
        </div>
      )}

      {isLoading ? (
        <section>
          <p>Loading application state…</p>
        </section>
      ) : (
        <>
          <section>
            <h2>Runtime Configuration</h2>
            <p>Updates here immediately persist and drive the semantic matcher—no environment variables required.</p>
            {config && (
              <div className="grid two-columns">
                <label>
                  Default Dimension
                  <input
                    type="text"
                    defaultValue={config.default_dimension}
                    onChange={(event) => handleConfigChange('default_dimension', event.target.value)}
                  />
                </label>
                <label>
                  Match Threshold
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    defaultValue={config.match_threshold}
                    onChange={(event) => handleConfigChange('match_threshold', event.target.value)}
                  />
                </label>
                <label>
                  Matcher Backend
                  <select
                    defaultValue={config.matcher_backend}
                    onChange={(event) => handleConfigChange('matcher_backend', event.target.value)}
                  >
                    {matcherOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Embedding Model
                  <input
                    type="text"
                    defaultValue={config.embedding_model}
                    onChange={(event) => handleConfigChange('embedding_model', event.target.value)}
                  />
                </label>
                <label>
                  LLM Model
                  <input
                    type="text"
                    defaultValue={config.llm_model ?? ''}
                    placeholder="gpt-4o-mini"
                    onChange={(event) => handleConfigChange('llm_model', event.target.value)}
                  />
                </label>
                <label>
                  LLM API Base URL
                  <input
                    type="text"
                    defaultValue={config.llm_api_base ?? ''}
                    placeholder="https://api.openai.com/v1"
                    onChange={(event) => handleConfigChange('llm_api_base', event.target.value)}
                  />
                </label>
                <label>
                  LLM API Key
                  <input
                    type="password"
                    placeholder={config.llm_api_key_set ? 'Key already stored' : 'Paste secret key'}
                    onChange={(event) => handleConfigChange('llm_api_key', event.target.value)}
                  />
                </label>
                <label>
                  Top K Results
                  <input
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={config.top_k}
                    onChange={(event) => handleConfigChange('top_k', event.target.value)}
                  />
                </label>
              </div>
            )}
            <button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? 'Saving…' : 'Save Configuration'}
            </button>
          </section>

          <section>
            <h2>Semantic Match Playground</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleRunMatch();
              }}
            >
              <textarea
                rows={3}
                placeholder="Enter a raw data value to match"
                value={matchInput}
                onChange={(event) => setMatchInput(event.target.value)}
              />
              <label>
                Dimension (optional)
                <select
                  value={matchDimension}
                  onChange={(event) => setMatchDimension(event.target.value)}
                >
                  <option value="">Use default</option>
                  {availableDimensions.map((dimension) => (
                    <option key={dimension} value={dimension}>
                      {dimension}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={runningMatch}>
                {runningMatch ? 'Matching…' : 'Run Match'}
              </button>
            </form>
            {matchResults && (
              <div style={{ marginTop: '1rem' }}>
                <h3>
                  Matches for “{matchResults.raw_text}”
                </h3>
                {renderMatches(matchResults.matches)}
              </div>
            )}
          </section>

          <section>
            <h2>Canonical Library</h2>
            <p>Bootstrap reviewers with some defaults and grow the knowledge base over time.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateCanonical();
              }}
            >
              <input
                placeholder="Dimension"
                value={newCanonical.dimension}
                onChange={(event) =>
                  setNewCanonical((draft) => ({ ...draft, dimension: event.target.value }))
                }
              />
              <input
                placeholder="Canonical Label"
                value={newCanonical.canonical_label}
                onChange={(event) =>
                  setNewCanonical((draft) => ({ ...draft, canonical_label: event.target.value }))
                }
              />
              <textarea
                placeholder="Description (optional)"
                rows={2}
                value={newCanonical.description}
                onChange={(event) =>
                  setNewCanonical((draft) => ({ ...draft, description: event.target.value }))
                }
              />
              <button type="submit" disabled={creatingCanonical}>
                {creatingCanonical ? 'Adding…' : 'Add Canonical Value'}
              </button>
            </form>
            <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Dimension</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {canonicalValues.map((value) => (
                    <tr key={`${value.dimension}-${value.id}`}>
                      <td>{value.canonical_label}</td>
                      <td>{value.dimension}</td>
                      <td>{value.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default App;
