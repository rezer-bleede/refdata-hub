import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, Form, ProgressBar, Spinner } from 'react-bootstrap';

import { fetchMatchStatistics, fetchSourceConnections } from '../api';
import type { FieldMatchStats, MatchCandidate, SourceConnection, ToastMessage } from '../types';

interface MatchInsightsPageProps {
  onToast: (toast: ToastMessage) => void;
}

const renderSuggestions = (suggestions: MatchCandidate[]) => {
  if (!suggestions.length) {
    return <p className="text-body-secondary mb-0">No suggestions above the relaxed threshold.</p>;
  }

  return (
    <div className="d-flex flex-wrap gap-2">
      {suggestions.map((candidate) => (
        <Badge
          key={candidate.canonical_id}
          bg={candidate.score >= 0.6 ? 'primary' : 'secondary'}
          className="text-wrap"
        >
          {candidate.canonical_label} ({(candidate.score * 100).toFixed(0)}%)
        </Badge>
      ))}
    </div>
  );
};

const MatchInsightsPage = ({ onToast }: MatchInsightsPageProps) => {
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | ''>('');
  const [stats, setStats] = useState<FieldMatchStats[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConnections = useCallback(async () => {
    try {
      const records = await fetchSourceConnections();
      setConnections(records);
      if (!selectedConnectionId && records.length) {
        setSelectedConnectionId(records[0].id);
      }
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to load connections.' });
    }
  }, [onToast, selectedConnectionId]);

  const loadStats = useCallback(
    async (connectionId: number) => {
      setLoading(true);
      try {
        const response = await fetchMatchStatistics(connectionId);
        setStats(response);
      } catch (error) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to compute match statistics.' });
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (selectedConnectionId) {
      void loadStats(selectedConnectionId);
    } else {
      setStats([]);
    }
  }, [selectedConnectionId, loadStats]);

  const overallRate = useMemo(() => {
    const totals = stats.reduce(
      (acc, item) => {
        acc.total += item.total_values;
        acc.matched += item.matched_values;
        return acc;
      },
      { total: 0, matched: 0 },
    );
    if (!totals.total) return 0;
    return totals.matched / totals.total;
  }, [stats]);

  return (
    <div className="d-flex flex-column gap-4">
      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <Card.Title as="h1" className="section-heading h4 mb-1">
                Match insights
              </Card.Title>
              <Card.Text className="text-body-secondary mb-0">
                Monitor alignment between raw values and canonical records. Use the insights below to prioritise review efforts.
              </Card.Text>
            </div>
            <Form.Group controlId="match-connection" className="w-auto">
              <Form.Label>Connection</Form.Label>
              <Form.Select
                value={selectedConnectionId}
                onChange={(event) =>
                  setSelectedConnectionId(event.target.value ? Number(event.target.value) : '')
                }
              >
                <option value="">Select connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div>
              <p className="text-body-secondary mb-1">Overall match rate</p>
              <h2 className="display-6 fw-semibold mb-0">{(overallRate * 100).toFixed(1)}%</h2>
            </div>
            <div className="flex-grow-1">
              <ProgressBar now={overallRate * 100} variant="success" style={{ height: '0.75rem' }} />
            </div>
          </div>
          {loading && <Spinner animation="border" role="status" className="align-self-start" />}
        </Card.Body>
      </Card>

      {stats.map((item) => (
        <Card key={item.mapping_id} className="card-section">
          <Card.Body className="d-flex flex-column gap-3">
            <div className="d-flex justify-content-between flex-wrap gap-3">
              <div>
                <Card.Title as="h2" className="h5 mb-1">
                  {item.source_table}.{item.source_field}
                </Card.Title>
                <Card.Text className="text-body-secondary mb-0">
                  Dimension: {item.ref_dimension}
                </Card.Text>
              </div>
              <div className="text-end">
                <div className="display-6 fw-semibold">{(item.match_rate * 100).toFixed(1)}%</div>
                <div className="text-body-secondary">
                  {item.matched_values} / {item.total_values} matched
                </div>
              </div>
            </div>

            <div>
              <h3 className="h6 mb-2">Top unmatched values</h3>
              <div className="d-flex flex-column gap-2">
                {item.top_unmatched.length ? (
                  item.top_unmatched.map((unmatched) => (
                    <Card key={unmatched.raw_value} body className="border-0 bg-body-tertiary">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-semibold">{unmatched.raw_value}</div>
                          <div className="text-body-secondary small">
                            {unmatched.occurrence_count} occurrences
                          </div>
                        </div>
                        <Badge bg="warning" text="dark">
                          Needs review
                        </Badge>
                      </div>
                      <div className="mt-2">{renderSuggestions(unmatched.suggestions)}</div>
                    </Card>
                  ))
                ) : (
                  <p className="text-body-secondary mb-0">Every sampled value met the configured threshold.</p>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>
      ))}

      {!stats.length && !loading && (
        <Card className="card-section">
          <Card.Body>
            <p className="text-body-secondary mb-0">No mappings available for the selected connection yet.</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default MatchInsightsPage;
