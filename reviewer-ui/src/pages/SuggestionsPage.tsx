import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Form, Spinner } from '../components/ui';

import {
  createValueMapping,
  fetchSourceConnections,
  fetchUnmatchedValues,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  CanonicalValue,
  SourceConnection,
  ToastMessage,
  UnmatchedValueRecord,
} from '../types';

interface SuggestionsPageProps {
  onToast: (toast: ToastMessage) => void;
}

const SuggestionsPage = ({ onToast }: SuggestionsPageProps) => {
  const { canonicalValues } = useAppState();
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | ''>('');
  const [unmatched, setUnmatched] = useState<UnmatchedValueRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualSelection, setManualSelection] = useState<Record<string, number>>({});
  const [linking, setLinking] = useState<string | null>(null);

  const canonicalByDimension = useMemo(() => {
    const map = new Map<string, CanonicalValue[]>();
    canonicalValues.forEach((value) => {
      const list = map.get(value.dimension) ?? [];
      list.push(value);
      map.set(value.dimension, list);
    });
    map.forEach((list) => list.sort((a, b) => a.canonical_label.localeCompare(b.canonical_label)));
    return map;
  }, [canonicalValues]);

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

  const loadUnmatched = useCallback(
    async (connectionId: number) => {
      setLoading(true);
      try {
        const records = await fetchUnmatchedValues(connectionId);
        setUnmatched(records);
      } catch (error) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to load unmatched values.' });
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
      void loadUnmatched(selectedConnectionId);
    } else {
      setUnmatched([]);
    }
  }, [selectedConnectionId, loadUnmatched]);

  const applyMapping = async (
    record: UnmatchedValueRecord,
    canonicalId: number,
    confidence?: number,
    suggestedLabel?: string,
  ) => {
    if (!selectedConnectionId) return;
    const key = `${record.mapping_id}:${record.raw_value}`;
    setLinking(key);
    try {
      await createValueMapping(selectedConnectionId, {
        source_table: record.source_table,
        source_field: record.source_field,
        raw_value: record.raw_value,
        canonical_id: canonicalId,
        status: 'approved',
        confidence,
        suggested_label: suggestedLabel,
      });
      setUnmatched((prev) => prev.filter((item) => item !== record));
      onToast({ type: 'success', content: `Mapped ${record.raw_value}` });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to store mapping.' });
    } finally {
      setLinking(null);
    }
  };

  const handleManualApply = async (record: UnmatchedValueRecord) => {
    const key = `${record.mapping_id}:${record.raw_value}`;
    const canonicalId = manualSelection[key];
    if (!canonicalId) {
      onToast({ type: 'error', content: 'Select a canonical value first.' });
      return;
    }
    await applyMapping(record, canonicalId);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="card-section">
        <Card.Body className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row justify-between gap-3">
            <div>
              <Card.Title as="h1" className="text-2xl mb-1">
                Triage unmatched values
              </Card.Title>
              <Card.Text className="text-slate-400 mb-0">
                Review low-confidence matches and confirm the appropriate canonical record. Suggestions are ranked using the semantic matcher.
              </Card.Text>
            </div>
            <Form.Group controlId="suggestions-connection" className="w-auto">
              <Form.Label>Connection</Form.Label>
              <Form.Select
                value={selectedConnectionId}
                onChange={(event) => setSelectedConnectionId(event.target.value ? Number(event.target.value) : '')}
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
          {loading && <Spinner animation="border" role="status" className="self-start" />}
        </Card.Body>
      </Card>

      {unmatched.map((record) => {
        const key = `${record.mapping_id}:${record.raw_value}`;
        const canonicalOptions = canonicalByDimension.get(record.ref_dimension) ?? [];
        return (
          <Card key={key} className="card-section">
            <Card.Body className="flex flex-col gap-3">
              <div className="flex justify-between flex-wrap gap-3">
                <div>
                  <Card.Title as="h2" className="text-lg mb-1">
                    {record.raw_value}
                  </Card.Title>
                  <Card.Text className="text-slate-400 mb-0">
                    {record.source_table}.{record.source_field} · {record.ref_dimension}
                  </Card.Text>
                  <Card.Text className="text-slate-400 text-xs">
                    {record.occurrence_count} occurrences
                  </Card.Text>
                </div>
                <Badge bg="warning" text="dark">
                  Needs review
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {record.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion.canonical_id}
                    variant="outline-success"
                    size="sm"
                    onClick={() => void applyMapping(record, suggestion.canonical_id, suggestion.score, suggestion.canonical_label)}
                    disabled={linking === key}
                  >
                    {suggestion.canonical_label} ({(suggestion.score * 100).toFixed(0)}%)
                  </Button>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-3 items-start">
                <Form.Group controlId={`manual-select-${key}`} className="grow">
                  <Form.Label>Manual selection</Form.Label>
                  <Form.Select
                    value={manualSelection[key] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setManualSelection((prev) => {
                        const next = { ...prev };
                        if (!value) {
                          delete next[key];
                        } else {
                          next[key] = Number(value);
                        }
                        return next;
                      });
                    }}
                  >
                    <option value="">Select canonical value</option>
                    {canonicalOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.canonical_label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Button
                  variant="primary"
                  onClick={() => void handleManualApply(record)}
                  disabled={linking === key}
                >
                  {linking === key ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                      Linking…
                    </span>
                  ) : (
                    'Link to canonical'
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>
        );
      })}

      {!unmatched.length && !loading && (
        <Card className="card-section">
          <Card.Body>
            <p className="text-slate-400 mb-0">All recent values are matched for this connection.</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default SuggestionsPage;
