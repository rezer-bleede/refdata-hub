import { useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';

import { proposeMatch, updateConfig } from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  MatchCandidate,
  MatchResponse,
  ToastMessage,
} from '../types';

interface DashboardPageProps {
  onToast: (toast: ToastMessage) => void;
}

const DashboardPage = ({ onToast }: DashboardPageProps) => {
  const { config, setConfig, canonicalValues, isLoading } = useAppState();
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [matchInput, setMatchInput] = useState('');
  const [matchDimension, setMatchDimension] = useState('');
  const [matchResults, setMatchResults] = useState<MatchResponse | null>(null);
  const [runningMatch, setRunningMatch] = useState(false);

  const availableDimensions = useMemo(() => {
    const dimensionSet = new Set<string>();
    canonicalValues.forEach((value) => dimensionSet.add(value.dimension));
    if (config?.default_dimension) {
      dimensionSet.add(config.default_dimension);
    }
    return Array.from(dimensionSet).sort();
  }, [canonicalValues, config?.default_dimension]);

  const insights = useMemo(() => {
    const uniqueDimensions = availableDimensions.length;
    const canonicalCount = canonicalValues.length;
    return {
      uniqueDimensions,
      canonicalCount,
      matcher: config?.matcher_backend ?? '—',
    };
  }, [availableDimensions, canonicalValues.length, config?.matcher_backend]);

  const handleConfigChange = (key: string, value: string) => {
    setConfigDraft((draft) => ({ ...draft, [key]: value }));
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload: Record<string, string | number> = {};
      Object.entries(configDraft).forEach(([key, value]) => {
        if (value !== '') {
          if (key === 'match_threshold' || key === 'top_k') {
            payload[key] = Number(value);
          } else {
            payload[key] = value;
          }
        }
      });
      const updated = await updateConfig(payload);
      setConfig(() => updated);
      setConfigDraft({});
      onToast({ type: 'success', content: 'Configuration updated.' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update configuration.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunMatch = async () => {
    if (!matchInput.trim()) {
      onToast({ type: 'error', content: 'Enter a raw value to match.' });
      return;
    }
    setRunningMatch(true);
    try {
      const response = await proposeMatch(matchInput.trim(), matchDimension || undefined);
      setMatchResults(response);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Matching request failed.' });
    } finally {
      setRunningMatch(false);
    }
  };

  const renderMatches = (matches: MatchCandidate[]) => {
    if (!matches.length) {
      return <p className="text-body-secondary mb-0">No matches returned for the supplied value.</p>;
    }

    return (
      <Table striped bordered hover responsive size="sm" className="mt-3">
        <thead>
          <tr>
            <th>Canonical Label</th>
            <th>Dimension</th>
            <th>Description</th>
            <th className="text-end">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={`${match.canonical_id}-${match.score}`}> 
              <td>{match.canonical_label}</td>
              <td>
                <Badge bg="info" text="dark">{match.dimension}</Badge>
              </td>
              <td>{match.description || '—'}</td>
              <td className="text-end text-monospaced">{(match.score * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div className="d-flex flex-column gap-4" aria-busy={isLoading}>
      <Row xs={1} md={3} className="g-3">
        <Col>
          <Card className="card-section h-100">
            <Card.Body>
              <Card.Title className="section-heading">Canonical values</Card.Title>
              <Card.Text className="display-6 fw-semibold mb-0">{insights.canonicalCount}</Card.Text>
              <Card.Text className="text-body-secondary">Managed reference records</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col>
          <Card className="card-section h-100">
            <Card.Body>
              <Card.Title className="section-heading">Dimensions</Card.Title>
              <Card.Text className="display-6 fw-semibold mb-0">{insights.uniqueDimensions}</Card.Text>
              <Card.Text className="text-body-secondary">Distinct semantic domains</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col>
          <Card className="card-section h-100">
            <Card.Body>
              <Card.Title className="section-heading">Matcher backend</Card.Title>
              <Card.Text className="display-6 fw-semibold mb-0 text-uppercase">{insights.matcher}</Card.Text>
              <Card.Text className="text-body-secondary">Active configuration</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-4">
          <div>
            <Card.Title as="h2" className="section-heading h4 mb-2">
              System configuration
            </Card.Title>
            <Card.Text className="text-body-secondary">
              Fine-tune the matcher and default behaviours. Changes take effect immediately after saving.
            </Card.Text>
          </div>
          {config && (
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveConfig();
              }}
              className="row g-3"
            >
              <Form.Group as={Col} md={6} controlId="config-default-dimension">
                <Form.Label>Default dimension</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. region"
                  defaultValue={config.default_dimension}
                  onChange={(event) => handleConfigChange('default_dimension', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={3} controlId="config-match-threshold">
                <Form.Label>Match threshold</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  defaultValue={config.match_threshold}
                  onChange={(event) => handleConfigChange('match_threshold', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={3} controlId="config-top-k">
                <Form.Label>Top K results</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={config.top_k}
                  onChange={(event) => handleConfigChange('top_k', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={6} controlId="config-embedding-model">
                <Form.Label>Embedding model</Form.Label>
                <Form.Control
                  type="text"
                  defaultValue={config.embedding_model}
                  onChange={(event) => handleConfigChange('embedding_model', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={6} controlId="config-llm-model">
                <Form.Label>LLM model</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="gpt-4o-mini"
                  defaultValue={config.llm_model ?? ''}
                  onChange={(event) => handleConfigChange('llm_model', event.target.value)}
                />
              </Form.Group>
              <Form.Group as={Col} md={6} controlId="config-llm-api-base">
                <Form.Label>LLM API base URL</Form.Label>
                <Form.Control
                  type="url"
                  placeholder="https://api.openai.com/v1"
                  defaultValue={config.llm_api_base ?? ''}
                  onChange={(event) => handleConfigChange('llm_api_base', event.target.value)}
                />
              </Form.Group>
              <Col xs={12} className="d-flex justify-content-end">
                <Button type="submit" variant="primary" disabled={savingConfig}>
                  {savingConfig ? (
                    <span className="d-inline-flex align-items-center gap-2">
                      <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                      Saving…
                    </span>
                  ) : (
                    'Save configuration'
                  )}
                </Button>
              </Col>
            </Form>
          )}
        </Card.Body>
      </Card>

      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-4">
          <div>
            <Card.Title as="h2" className="section-heading h4 mb-2">
              Semantic match playground
            </Card.Title>
            <Card.Text className="text-body-secondary">
              Experiment with raw inputs to validate canonical coverage and scoring across dimensions.
            </Card.Text>
          </div>
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void handleRunMatch();
            }}
            className="d-flex flex-column gap-3"
          >
            <Form.Group controlId="match-raw-value">
              <Form.Label>Raw value</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter a raw data value to match"
                value={matchInput}
                onChange={(event) => setMatchInput(event.target.value)}
                required
              />
            </Form.Group>
            <Form.Group controlId="match-dimension">
              <Form.Label>Dimension (optional)</Form.Label>
              <Form.Select value={matchDimension} onChange={(event) => setMatchDimension(event.target.value)}>
                <option value="">Use default</option>
                {availableDimensions.map((dimension) => (
                  <option key={dimension} value={dimension}>
                    {dimension}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <div>
              <Button type="submit" variant="success" disabled={runningMatch}>
                {runningMatch ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Matching…
                  </span>
                ) : (
                  'Run match'
                )}
              </Button>
            </div>
          </Form>
          {matchResults && (
            <div>
              <h3 className="h5">Matches for “{matchResults.raw_text}”</h3>
              {renderMatches(matchResults.matches)}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default DashboardPage;
