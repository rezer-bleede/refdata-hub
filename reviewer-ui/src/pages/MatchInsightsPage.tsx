import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, Form, ProgressBar, Spinner } from '../components/ui';

import { fetchFieldMappings, fetchMatchStatistics, fetchSourceConnections } from '../api';
import { useAppState } from '../state/AppStateContext';
import type { FieldMatchStats, MatchCandidate, SourceConnection, ToastMessage } from '../types';

interface MatchInsightsPageProps {
  onToast: (toast: ToastMessage) => void;
}

const renderSuggestions = (suggestions: MatchCandidate[]) => {
  if (!suggestions.length) {
    return <p className="text-slate-400 mb-0">No suggestions above the relaxed threshold.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((candidate) => (
        <Badge
          key={candidate.canonical_id}
          bg={candidate.score >= 0.6 ? 'primary' : 'secondary'}
          className="whitespace-normal"
        >
          {candidate.canonical_label} ({(candidate.score * 100).toFixed(0)}%)
        </Badge>
      ))}
    </div>
  );
};

const renderMatchedValueCard = (matched: FieldMatchStats['top_matched'][number]) => {
  const confidence = matched.confidence ?? null;
  const badgeLabel = matched.match_type === 'mapping' ? 'Mapped value' : 'Semantic match';
  const badgeVariant = matched.match_type === 'mapping' ? 'success' : 'secondary';

  return (
    <Card key={`${matched.raw_value}-${matched.canonical_label}`} body className="border-0 bg-slate-900/70">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="font-semibold truncate" title={matched.raw_value}>
            {matched.raw_value}
          </div>
          <div className="text-slate-400 text-xs">{matched.occurrence_count} occurrences</div>
        </div>
        <Badge bg={badgeVariant}>{badgeLabel}</Badge>
      </div>
      <div className="mt-2 text-sm text-slate-200">
        <span className="font-semibold text-slate-100">Canonical:</span>{' '}
        <span>{matched.canonical_label}</span>
        {confidence !== null && (
          <span className="ml-2 text-xs text-slate-400">{`Confidence ${(confidence * 100).toFixed(0)}%`}</span>
        )}
      </div>
    </Card>
  );
};

const MatchInsightsPage = ({ onToast }: MatchInsightsPageProps) => {
  const { refreshToken } = useAppState();
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
        if (response.length) {
          setStats(
            response.map((item) => ({
              ...item,
              top_matched: item.top_matched ?? [],
            })),
          );
          return;
        }

        const mappings = await fetchFieldMappings(connectionId);
        if (mappings.length) {
          setStats(
            mappings.map((mapping) => ({
              mapping_id: mapping.id ?? 0,
              source_table: mapping.source_table,
              source_field: mapping.source_field,
              ref_dimension: mapping.ref_dimension,
              total_values: 0,
              matched_values: 0,
              unmatched_values: 0,
              match_rate: 0,
              top_unmatched: [],
              top_matched: [],
            })),
          );
          return;
        }

        setStats([]);
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
  }, [selectedConnectionId, loadStats, refreshToken]);

  const overallTotals = useMemo(() => {
    const totals = stats.reduce(
      (acc, item) => {
        acc.total += item.total_values;
        acc.matched += item.matched_values;
        return acc;
      },
      { total: 0, matched: 0 },
    );
    return {
      ...totals,
      rate: totals.total ? totals.matched / totals.total : 0,
    };
  }, [stats]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="card-section">
        <Card.Body className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row justify-between gap-3">
            <div>
              <Card.Title as="h1" className="text-2xl mb-1">
                Match Insights
              </Card.Title>
              <Card.Text className="text-slate-400 mb-0">
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
          <div className="flex items-center gap-3">
            <div>
              <p className="text-slate-400 mb-1">Overall match rate</p>
              <h2 className="text-3xl font-semibold mb-0">
                {overallTotals.total ? `${(overallTotals.rate * 100).toFixed(1)}%` : '—'}
              </h2>
              {!overallTotals.total && (
                <p className="text-slate-400 mb-0">No samples captured yet.</p>
              )}
            </div>
            <div className="grow">
              <ProgressBar
                now={overallTotals.rate * 100}
                variant="success"
                style={{ height: '0.75rem' }}
              />
            </div>
          </div>
          {loading && <Spinner animation="border" role="status" className="self-start" />}
        </Card.Body>
      </Card>

      {stats.map((item) => (
        <Card key={item.mapping_id} className="card-section">
          <Card.Body className="flex flex-col gap-3">
            <div className="flex justify-between flex-wrap gap-3">
              <div>
                <Card.Title as="h2" className="text-lg mb-1">
                  {item.source_table}.{item.source_field}
                </Card.Title>
                <Card.Text className="text-slate-400 mb-0">
                  Dimension: {item.ref_dimension}
                </Card.Text>
              </div>
              <div className="text-end">
                <div className="text-3xl font-semibold">
                  {item.total_values ? `${(item.match_rate * 100).toFixed(1)}%` : '—'}
                </div>
                <div className="text-slate-400">
                  {item.total_values
                    ? `${item.matched_values} / ${item.total_values} matched`
                    : 'No samples captured yet.'}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                Top unmatched values
              </h3>
              <div className="flex flex-col gap-2">
                {item.total_values ? (
                  item.top_unmatched.length ? (
                    item.top_unmatched.map((unmatched) => (
                      <Card key={unmatched.raw_value} body className="border-0 bg-slate-900/70">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">{unmatched.raw_value}</div>
                            <div className="text-slate-400 text-xs">
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
                    <p className="text-slate-400 mb-0">
                      Every sampled value met the configured threshold.
                    </p>
                  )
                ) : (
                  <p className="text-slate-400 mb-0">
                    No samples have been captured for this mapping yet.
                  </p>
                )}
              </div>
            </div>

            <details
              className="group rounded-2xl border border-slate-800/60 bg-slate-900/50 px-4 py-3"
              data-testid={`matched-section-${item.mapping_id}`}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                Matched values
                <span className="text-xs text-slate-500 group-open:hidden">Expand</span>
                <span className="hidden text-xs text-slate-500 group-open:inline">Collapse</span>
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {item.total_values ? (
                  item.top_matched.length ? (
                    item.top_matched.map((matched) => renderMatchedValueCard(matched))
                  ) : (
                    <p className="text-slate-400 mb-0">No matched values recorded yet.</p>
                  )
                ) : (
                  <p className="text-slate-400 mb-0">No samples have been captured for this mapping yet.</p>
                )}
              </div>
            </details>
          </Card.Body>
        </Card>
      ))}

      {!stats.length && !loading && (
        <Card className="card-section">
          <Card.Body>
            <p className="text-slate-400 mb-0">No mappings available for the selected connection yet.</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default MatchInsightsPage;
