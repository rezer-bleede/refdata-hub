import { useMemo, useState } from 'react';

import { proposeMatch } from '../api';
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
  const { config, canonicalValues, isLoading } = useAppState();
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
      return <p className="text-sm text-slate-400">No matches returned for the supplied value.</p>;
    }

    return (
      <div className="mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left">Canonical Label</th>
              <th className="px-4 py-3 text-left">Dimension</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={`${match.canonical_id}-${match.score}`} className="bg-slate-900/40">
                <td className="px-4 py-3 font-medium text-slate-100">{match.canonical_label}</td>
                <td className="px-4 py-3">
                  <span className="badge-pill">{match.dimension}</span>
                </td>
                <td className="px-4 py-3 text-slate-300">{match.description || '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-slate-200">
                  {(match.score * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8" aria-busy={isLoading}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="panel-card">
          <p className="panel-heading">Canonical values</p>
          <p className="metric-value">{insights.canonicalCount}</p>
          <p className="metric-subtitle">Managed reference records</p>
        </div>
        <div className="panel-card">
          <p className="panel-heading">Dimensions</p>
          <p className="metric-value">{insights.uniqueDimensions}</p>
          <p className="metric-subtitle">Distinct semantic domains</p>
        </div>
        <div className="panel-card">
          <p className="panel-heading">Matcher backend</p>
          <p className="metric-value uppercase">{insights.matcher}</p>
          <p className="metric-subtitle">Active configuration</p>
        </div>
      </div>

      <section className="surface-card flex flex-col gap-6">
        <div className="space-y-2">
          <h2 className="section-heading">Semantic match playground</h2>
          <p className="text-sm text-slate-400">
            Experiment with raw inputs to validate canonical coverage and scoring across dimensions.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleRunMatch();
          }}
          className="flex flex-col gap-4"
        >
          <label htmlFor="match-raw-value" className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Raw value</span>
            <textarea
              id="match-raw-value"
              rows={3}
              placeholder="Enter a raw data value to match"
              value={matchInput}
              onChange={(event) => setMatchInput(event.target.value)}
              required
            />
          </label>
          <label htmlFor="match-dimension" className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Dimension (optional)</span>
            <select
              id="match-dimension"
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
          <div>
            <button type="submit" className="neon-button" disabled={runningMatch}>
              {runningMatch ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                    role="status"
                    aria-hidden="true"
                  />
                  Matching…
                </span>
              ) : (
                'Run match'
              )}
            </button>
          </div>
        </form>
        {matchResults && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Matches for “{matchResults.raw_text}”</h3>
            {renderMatches(matchResults.matches)}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
