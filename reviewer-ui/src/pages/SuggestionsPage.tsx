import { useCallback, useEffect, useMemo, useState } from 'react';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';

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

  const canonicalByDimension = useMemo(() => {
    const map = new Map<string, CanonicalValue[]>();
    canonicalValues.forEach((value) => {
      const list = map.get(value.dimension) ?? [];
      list.push(value);
      map.set(value.dimension, list);
    });
    map.forEach((list, key) => list.sort((a, b) => a.canonical_label.localeCompare(b.canonical_label)));
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
      onToast({ type: 'error', content: 'Failed to load connections' });
    }
  }, [onToast, selectedConnectionId]);

  const loadUnmatched = useCallback(async (connectionId: number) => {
    setLoading(true);
    try {
      const records = await fetchUnmatchedValues(connectionId);
      setUnmatched(records);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to load unmatched values' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

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
      onToast({ type: 'error', content: 'Failed to store mapping' });
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
    <Stack spacing={4} component="section">
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Triage unmatched values
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review low-confidence matches and confirm the appropriate canonical record. Suggestions are ranked using the semantic matcher.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="suggestions-connection-label">Connection</InputLabel>
              <Select
                labelId="suggestions-connection-label"
                label="Connection"
                value={selectedConnectionId}
                onChange={(event) => setSelectedConnectionId(Number(event.target.value))}
              >
                {connections.map((connection) => (
                  <MenuItem key={connection.id} value={connection.id}>
                    {connection.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {loading && <Typography variant="body2">Loading unmatched values…</Typography>}
        </Stack>
      </Paper>

      {unmatched.map((record) => {
        const key = `${record.mapping_id}:${record.raw_value}`;
        const canonicalOptions = canonicalByDimension.get(record.ref_dimension) ?? [];
        return (
          <Paper key={key} variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {record.raw_value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {record.source_table}.{record.source_field} · {record.ref_dimension}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {record.occurrence_count} occurrences
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {record.suggestions.map((suggestion) => (
                    <Chip
                      key={suggestion.canonical_id}
                      label={`${suggestion.canonical_label} (${(suggestion.score * 100).toFixed(0)}%)`}
                      onClick={() => void applyMapping(record, suggestion.canonical_id, suggestion.score, suggestion.canonical_label)}
                      icon={<DoneRoundedIcon />}
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <FormControl sx={{ minWidth: 220 }}>
                  <InputLabel id={`manual-select-${key}`}>Select canonical</InputLabel>
                  <Select
                    labelId={`manual-select-${key}`}
                    label="Select canonical"
                    value={manualSelection[key] ?? ''}
                    onChange={(event) =>
                      setManualSelection((prev) => ({ ...prev, [key]: Number(event.target.value) }))
                    }
                  >
                    {canonicalOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.canonical_label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={<LinkRoundedIcon />}
                  onClick={() => void handleManualApply(record)}
                  disabled={!manualSelection[key]}
                >
                  Link to canonical
                </Button>
              </Stack>
            </Stack>
          </Paper>
        );
      })}

      {!unmatched.length && !loading && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            All sampled values are currently mapped. Great work!
          </Typography>
        </Paper>
      )}
    </Stack>
  );
};

export default SuggestionsPage;
