import { useCallback, useEffect, useMemo, useState } from 'react';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';

import { fetchMatchStatistics, fetchSourceConnections } from '../api';
import type { FieldMatchStats, MatchCandidate, SourceConnection, ToastMessage } from '../types';

interface MatchInsightsPageProps {
  onToast: (toast: ToastMessage) => void;
}

const renderSuggestions = (suggestions: MatchCandidate[]) => {
  if (!suggestions.length) {
    return <Typography variant="body2">No suggestions above the relaxed threshold.</Typography>;
  }

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {suggestions.map((candidate) => (
        <Chip
          key={candidate.canonical_id}
          label={`${candidate.canonical_label} (${(candidate.score * 100).toFixed(0)}%)`}
          size="small"
          color={candidate.score >= 0.6 ? 'primary' : 'default'}
        />
      ))}
    </Stack>
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
      onToast({ type: 'error', content: 'Failed to load connections' });
    }
  }, [onToast, selectedConnectionId]);

  const loadStats = useCallback(async (connectionId: number) => {
    setLoading(true);
    try {
      const response = await fetchMatchStatistics(connectionId);
      setStats(response);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to compute match statistics' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

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
    <Stack spacing={4} component="section">
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Match insights
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monitor the alignment between raw source values and canonical records. Use these insights to prioritise review efforts.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="match-connection-label">Connection</InputLabel>
              <Select
                labelId="match-connection-label"
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <InsightsRoundedIcon color="primary" />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Overall match rate
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {(overallRate * 100).toFixed(1)}%
              </Typography>
            </Box>
          </Box>
          {loading && <LinearProgress />}
        </Stack>
      </Paper>

      {stats.map((item) => (
        <Paper key={item.mapping_id} variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {item.source_table}.{item.source_field}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Dimension: {item.ref_dimension}
                </Typography>
              </Box>
              <Box textAlign="right">
                <Typography variant="h5" fontWeight={700}>
                  {(item.match_rate * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.matched_values} / {item.total_values} matched
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Top unmatched values
              </Typography>
              <Stack spacing={1}>
                {item.top_unmatched.length ? (
                  item.top_unmatched.map((unmatched) => (
                    <Paper key={unmatched.raw_value} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {unmatched.raw_value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {unmatched.occurrence_count} occurrences
                      </Typography>
                      <Box sx={{ mt: 1 }}>{renderSuggestions(unmatched.suggestions)}</Box>
                    </Paper>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Every sampled value met the configured threshold.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      ))}

      {!stats.length && !loading && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No mappings available for the selected connection yet.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
};

export default MatchInsightsPage;
