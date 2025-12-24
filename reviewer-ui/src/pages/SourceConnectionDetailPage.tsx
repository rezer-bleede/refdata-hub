import { useEffect, useMemo, useState } from 'react';
import { Badge, Breadcrumb, Card, Col, ListGroup, Row, Spinner, Table } from '../components/ui';
import { useNavigate, useParams } from 'react-router-dom';

import {
  fetchMatchStatistics,
  fetchSourceConnection,
  fetchSourceFields,
  fetchSourceSamples,
  fetchSourceTables,
} from '../api';
import type {
  FieldMatchStats,
  SourceConnection,
  SourceFieldMetadata,
  SourceSample,
  SourceTableMetadata,
  ToastMessage,
} from '../types';

interface SourceConnectionDetailPageProps {
  onToast: (toast: ToastMessage) => void;
}

type FieldCache = Record<string, SourceFieldMetadata[]>;
type SampleCache = Record<string, SourceSample[]>;

const keyForTable = (table: SourceTableMetadata) => `${table.schema ?? ''}:${table.name}`;

const SourceConnectionDetailPage = ({ onToast }: SourceConnectionDetailPageProps) => {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const numericId = Number(connectionId);

  const [connection, setConnection] = useState<SourceConnection | null>(null);
  const [tables, setTables] = useState<SourceTableMetadata[]>([]);
  const [fieldsByTable, setFieldsByTable] = useState<FieldCache>({});
  const [samplesByField, setSamplesByField] = useState<SampleCache>({});
  const [matchStats, setMatchStats] = useState<FieldMatchStats[]>([]);
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);

  useEffect(() => {
    if (!connectionId || Number.isNaN(numericId)) {
      navigate('/connections');
      return;
    }

    const load = async () => {
      setLoadingSummary(true);
      try {
        const [connectionRecord, tableRecords, stats] = await Promise.all([
          fetchSourceConnection(numericId),
          fetchSourceTables(numericId),
          fetchMatchStatistics(numericId),
        ]);
        setConnection(connectionRecord);
        setTables(
          [...tableRecords].sort((a, b) => {
            const schemaCompare = (a.schema ?? '').localeCompare(b.schema ?? '');
            if (schemaCompare !== 0) {
              return schemaCompare;
            }
            return a.name.localeCompare(b.name);
          }),
        );
        setMatchStats(stats);
        if (tableRecords.length > 0) {
          setSelectedTableKey(keyForTable(tableRecords[0]));
        }
      } catch (error: unknown) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to load source metadata.' });
        navigate('/connections');
      } finally {
        setLoadingSummary(false);
      }
    };

    void load();
  }, [connectionId, navigate, numericId, onToast]);

  const selectedTable = useMemo(() => {
    if (!selectedTableKey) return null;
    return tables.find((table) => keyForTable(table) === selectedTableKey) ?? null;
  }, [selectedTableKey, tables]);

  const statsByField = useMemo(() => {
    const lookup: Record<string, FieldMatchStats> = {};
    matchStats.forEach((stat) => {
      const key = `${stat.source_table}:${stat.source_field}`;
      lookup[key] = stat;
    });
    return lookup;
  }, [matchStats]);

  useEffect(() => {
    const loadFields = async () => {
      if (!selectedTable || !numericId) {
        return;
      }
      const cacheKey = keyForTable(selectedTable);
      if (fieldsByTable[cacheKey]) {
        return;
      }
      setLoadingFields(true);
      try {
        const data = await fetchSourceFields(numericId, selectedTable.name, selectedTable.schema);
        setFieldsByTable((current) => ({ ...current, [cacheKey]: data }));
      } catch (error: unknown) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to load table fields.' });
      } finally {
        setLoadingFields(false);
      }
    };

    void loadFields();
  }, [fieldsByTable, numericId, onToast, selectedTable]);

  const fieldsForSelectedTable = selectedTable
    ? fieldsByTable[keyForTable(selectedTable)] ?? []
    : [];

  const handleTableSelect = (table: SourceTableMetadata) => {
    const key = keyForTable(table);
    setSelectedTableKey(key);
    setSelectedFieldKey(null);
  };

  const handleFieldSelect = async (field: SourceFieldMetadata) => {
    if (!selectedTable) return;
    const cacheKey = `${keyForTable(selectedTable)}:${field.name}`;
    setSelectedFieldKey(cacheKey);
    if (samplesByField[cacheKey]) {
      return;
    }
    setLoadingSamples(true);
    try {
      const data = await fetchSourceSamples(numericId, {
        source_table: selectedTable.name,
        source_field: field.name,
      });
      setSamplesByField((current) => ({ ...current, [cacheKey]: data }));
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to load sample values.' });
    } finally {
      setLoadingSamples(false);
    }
  };

  const selectedSamples = selectedFieldKey ? samplesByField[selectedFieldKey] ?? [] : [];
  const distinctSamples = useMemo(() => {
    if (selectedSamples.length === 0) {
      return [] as SourceSample[];
    }
    const grouped = new Map<string, SourceSample>();
    selectedSamples.forEach((sample) => {
      const existing = grouped.get(sample.raw_value);
      if (!existing) {
        grouped.set(sample.raw_value, { ...sample });
        return;
      }
      const latestSeen =
        new Date(sample.last_seen_at).getTime() > new Date(existing.last_seen_at).getTime()
          ? sample.last_seen_at
          : existing.last_seen_at;
      grouped.set(sample.raw_value, {
        ...existing,
        occurrence_count: existing.occurrence_count + sample.occurrence_count,
        last_seen_at: latestSeen,
        dimension: existing.dimension ?? sample.dimension ?? null,
      });
    });
    return Array.from(grouped.values()).sort((a, b) => {
      if (b.occurrence_count !== a.occurrence_count) {
        return b.occurrence_count - a.occurrence_count;
      }
      return a.raw_value.localeCompare(b.raw_value);
    });
  }, [selectedSamples]);

  const schemaSummary = useMemo(() => {
    const schemas = new Set<string>();
    tables.forEach((table) => schemas.add(table.schema ?? ''));
    return {
      schemaCount: schemas.size,
      tableCount: tables.length,
    };
  }, [tables]);

  return (
    <div className="flex flex-col gap-4" aria-busy={loadingSummary}>
      <Breadcrumb>
        <Breadcrumb.Item onClick={() => navigate('/connections')} linkAs="button">
          Source connections
        </Breadcrumb.Item>
        <Breadcrumb.Item active>{connection?.name ?? 'Details'}</Breadcrumb.Item>
      </Breadcrumb>

      <Card className="card-section">
        <Card.Body className="flex flex-col gap-3">
          <div>
            <Card.Title as="h1" className="text-2xl mb-2">
              {connection?.name ?? 'Loading connection…'}
            </Card.Title>
            <Card.Text className="text-slate-400 mb-0">
              Review ingested metadata, field statistics, and profiling samples for this data source.
            </Card.Text>
          </div>
          {connection ? (
            <Row xs={1} md={3} className="gap-3">
              <Col>
                <Card className="h-full">
                  <Card.Body>
                    <Card.Subtitle className="text-slate-400 mb-1">Database type</Card.Subtitle>
                    <Card.Title className="text-base font-semibold uppercase tracking-[0.3em]">
                      {connection.db_type}
                    </Card.Title>
                    <Card.Text className="mb-0">Host: {connection.host}</Card.Text>
                    <Card.Text className="mb-0">Port: {connection.port}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col>
                <Card className="h-full">
                  <Card.Body>
                    <Card.Subtitle className="text-slate-400 mb-1">Catalog</Card.Subtitle>
                    <Card.Title className="text-lg">{connection.database}</Card.Title>
                    <Card.Text className="mb-0">Schemas discovered: {schemaSummary.schemaCount}</Card.Text>
                    <Card.Text className="mb-0">Tables &amp; views: {schemaSummary.tableCount}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col>
                <Card className="h-full">
                  <Card.Body>
                    <Card.Subtitle className="text-slate-400 mb-1">Credentials</Card.Subtitle>
                    <Card.Text className="mb-0">User: {connection.username}</Card.Text>
                    <Card.Text className="mb-0">Updated: {new Date(connection.updated_at).toLocaleString()}</Card.Text>
                    <Card.Text className="mb-0">Created: {new Date(connection.created_at).toLocaleString()}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
              Loading connection…
            </div>
          )}
        </Card.Body>
      </Card>

      <Row xs={1} xl={2} className="gap-4">
        <Col xl={4}>
          <Card className="card-section h-full">
            <Card.Body className="flex flex-col gap-3">
              <div>
                <Card.Title as="h2" className="text-lg mb-1">
                  Schemas &amp; objects
                </Card.Title>
                <Card.Text className="text-slate-400 mb-0">
                  Select a table or view to inspect field metadata and profiles.
                </Card.Text>
              </div>
              {tables.length > 0 ? (
                <ListGroup as="ul" className="overflow-auto" style={{ maxHeight: '24rem' }}>
                  {tables.map((table) => {
                    const key = keyForTable(table);
                    const isActive = key === selectedTableKey;
                    return (
                      <ListGroup.Item
                        as="li"
                        key={key}
                        action
                        active={isActive}
                        onClick={() => handleTableSelect(table)}
                        className="flex flex-col items-start"
                      >
                        <div className="flex items-center gap-2">
                          <strong>{table.name}</strong>
                          <Badge bg={table.type === 'view' ? 'info' : 'secondary'}>{table.type}</Badge>
                        </div>
                        {table.schema ? (
                          <small className="text-slate-400">Schema: {table.schema}</small>
                        ) : null}
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                  Discovering tables…
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xl={8}>
          <Card className="card-section h-full">
            <Card.Body className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <Card.Title as="h2" className="text-lg mb-1">
                    Field catalogue
                  </Card.Title>
                  {selectedTable ? (
                    <Card.Text className="text-slate-400 mb-0">
                      {selectedTable.schema ? `${selectedTable.schema}.` : ''}
                      {selectedTable.name}
                    </Card.Text>
                  ) : (
                    <Card.Text className="text-slate-400 mb-0">Select an object to continue.</Card.Text>
                  )}
                </div>
              </div>
              {selectedTable ? (
                loadingFields && fieldsForSelectedTable.length === 0 ? (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Loading fields…
                  </div>
                ) : fieldsForSelectedTable.length > 0 ? (
                  <Table bordered hover responsive size="sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Nullable</th>
                        <th>Default</th>
                        <th className="text-end">Match rate</th>
                        <th className="text-end">Matched / Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldsForSelectedTable.map((field) => {
                        const stats = statsByField[`${selectedTable.name}:${field.name}`];
                        const cacheKey = `${keyForTable(selectedTable)}:${field.name}`;
                        const isSelected = cacheKey === selectedFieldKey;
                        return (
                          <tr
                            key={field.name}
                            role="button"
                            className={isSelected ? 'bg-aurora/10 text-white' : ''}
                            onClick={() => void handleFieldSelect(field)}
                          >
                            <td>{field.name}</td>
                            <td>{field.data_type ?? '—'}</td>
                            <td>{field.nullable === false ? 'No' : 'Yes'}</td>
                            <td>{field.default ?? '—'}</td>
                            <td className="text-end">
                              {stats ? `${(stats.match_rate * 100).toFixed(1)}%` : '—'}
                            </td>
                            <td className="text-end font-mono">
                              {stats
                                ? `${stats.matched_values.toLocaleString()} / ${stats.total_values.toLocaleString()}`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                ) : (
                  <p className="text-slate-400 mb-0">No fields were discovered for this object.</p>
                )
              ) : (
                <p className="text-slate-400 mb-0">Select a table or view to see its fields.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="card-section">
        <Card.Body className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div>
              <Card.Title as="h2" className="text-lg mb-1">
                Distinct sample values
              </Card.Title>
              <Card.Text className="text-slate-400 mb-0">
                Click a field above to preview distinct raw values stored for profiling and reconciliation.
              </Card.Text>
            </div>
          </div>
          {selectedFieldKey ? (
            loadingSamples && selectedSamples.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Loading samples…
              </div>
            ) : distinctSamples.length > 0 ? (
              <Table bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>Raw value</th>
                    <th className="text-end">Occurrences</th>
                    <th className="text-end">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {distinctSamples.map((sample) => (
                    <tr key={`${sample.source_field}-${sample.raw_value}`}>
                      <td>{sample.raw_value}</td>
                      <td className="text-end font-mono">{sample.occurrence_count.toLocaleString()}</td>
                      <td className="text-end">{new Date(sample.last_seen_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-slate-400 mb-0">No samples captured for this field yet.</p>
            )
          ) : (
            <p className="text-slate-400 mb-0">Select a field to view its distinct values.</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default SourceConnectionDetailPage;
