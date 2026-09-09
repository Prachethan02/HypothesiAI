import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { apiService } from '../services/api';
import type {
  PatternMiningRunResult,
  ResearchPattern,
  PatternAssociationRule,
  UnderexploredCandidate,
} from '../services/api';


// ── Colour palette ────────────────────────────────────────────────────────────
const COMBO_COLORS: Record<string, string> = {
  'method + dataset': '#6366f1',
  'method + metric': '#f59e0b',
  'method + domain': '#10b981',
  'method + dataset + metric': '#ec4899',
  other: '#6b7280',
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'patterns' | 'rules' | 'candidates';

// ── Helpers ──────────────────────────────────────────────────────────────────
const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{
    fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem',
    borderRadius: '4px', backgroundColor: color + '22', color,
    border: `1px solid ${color}44`, textTransform: 'uppercase', letterSpacing: '0.04em',
  }}>
    {text}
  </span>
);

const ScoreBar: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div style={{ marginTop: '0.35rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
      <span>{label}</span><span>{pct(value)}</span>
    </div>
    <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'rgba(99,102,241,0.15)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value * 100}%`, backgroundColor: '#6366f1', borderRadius: '3px' }} />
    </div>
  </div>
);

// ── Pattern card ──────────────────────────────────────────────────────────────
const PatternCard: React.FC<{ p: ResearchPattern }> = ({ p }) => {
  const color = COMBO_COLORS[p.combo_type?.toLowerCase() ?? ''] ?? '#6b7280';
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.625rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            <Badge text={p.combo_type || 'pattern'} color={color} />
            <Badge text={p.algorithm} color="#6b7280" />
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
            {p.pattern_label}
          </p>
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {p.items.map(item => (
              <span key={item} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'rgba(99,102,241,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{pct(p.support)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>support</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{p.paper_count} papers</div>
        </div>
      </div>
      <ScoreBar value={p.support} label="Support" />
    </div>
  );
};

// ── Rule card ─────────────────────────────────────────────────────────────────
const RuleCard: React.FC<{ r: PatternAssociationRule }> = ({ r }) => (
  <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.625rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {r.antecedent.map(a => (
          <span key={a} style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{a}</span>
        ))}
      </div>
      <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>→</span>
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {r.consequent.map(c => (
          <span key={c} style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>{c}</span>
        ))}
      </div>
    </div>
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <ScoreBar value={r.support} label="Support" />
      <ScoreBar value={r.confidence} label="Confidence" />
    </div>
    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
      Lift: {r.lift.toFixed(2)} · {r.paper_count} papers
    </div>
  </div>
);

// ── Candidate card ────────────────────────────────────────────────────────────
const CandidateCard: React.FC<{ c: UnderexploredCandidate }> = ({ c }) => {
  const score = c.underexplored_score;
  const scoreColor = score >= 0.7 ? '#f59e0b' : score >= 0.4 ? '#6366f1' : '#6b7280';
  return (
    <div style={{ border: `1px solid ${scoreColor}33`, borderRadius: '0.625rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            <Badge text="underexplored candidate" color={scoreColor} />
            {c.combo_type && <Badge text={c.combo_type} color="#6b7280" />}
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
            {c.combo_label}
          </p>
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {c.items.map(item => (
              <span key={item} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'rgba(99,102,241,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                {item}
              </span>
            ))}
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
            {c.note}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: scoreColor }}>{pct(score)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>signal strength</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {c.observed_support != null ? `Observed: ${pct(c.observed_support)}` : 'Never observed'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.paper_count} related papers</div>
        </div>
      </div>
      <ScoreBar value={score} label="Underexplored signal strength (heuristic)" />
    </div>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
const PatternMiningDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<PatternMiningRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('patterns');
  const [minSupport, setMinSupport] = useState(0.02);
  const [minConfidence, setMinConfidence] = useState(0.3);
  const [algorithm, setAlgorithm] = useState<'fpgrowth' | 'apriori'>('fpgrowth');
  const [filterCombo, setFilterCombo] = useState('all');
  const [justRan, setJustRan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const runs = await apiService.listPatternRuns();
      if (runs.success && runs.data.length > 0) {
        const latest = runs.data[0];
        const detail = await apiService.getPatternRun(latest.id);
        if (detail.success && detail.data) setResult(detail.data);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load patterns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRun = async () => {
    setRunning(true);
    setJustRan(false);
    setError(null);
    try {
      const res = await apiService.runPatternMining({ min_support: minSupport, min_confidence: minConfidence, algorithm });
      if (res.success && res.data.run_id) { setResult(res.data); setJustRan(true); }
      else setError('Mining returned no results. Check that papers have been processed first.');
    } catch (e: any) {
      setError(e.message ?? 'Mining failed.');
    } finally {
      setRunning(false);
    }
  };


  // Filter options
  const allCombos = result
    ? Array.from(new Set(result.frequent_patterns.map(p => p.combo_type).filter(Boolean)))
    : [];

  const filteredPatterns = (result?.frequent_patterns ?? [])
    .filter(p => filterCombo === 'all' || p.combo_type === filterCombo);
  const filteredCandidates = (result?.underexplored_candidates ?? [])
    .filter(c => filterCombo === 'all' || c.combo_type?.toLowerCase() === filterCombo.toLowerCase());

  // Chart data – top 12 patterns by support
  const chartData = [...filteredPatterns]
    .sort((a, b) => b.support - a.support)
    .slice(0, 12)
    .map(p => ({
      name: p.pattern_label.length > 30 ? p.pattern_label.slice(0, 30) + '…' : p.pattern_label,
      support: parseFloat((p.support * 100).toFixed(2)),
      papers: p.paper_count,
      combo: p.combo_type,
    }));

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Research Pattern Mining
            </h1>
            <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '700px' }}>
              Discover frequent entity combinations (Method+Dataset, Method+Metric, etc.) across papers using
              FP-Growth or Apriori. Rarely-observed combinations are surfaced as{' '}
              <strong>underexplored candidates</strong> — a signal for further investigation, not proof of a research gap.
            </p>
          </div>
          {result && (
            <button
              onClick={() => navigate('/research-gaps')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.25rem', backgroundColor: '#4f46e5',
                border: 'none', borderRadius: '0.5rem', color: '#ffffff',
                fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79,70,229,0.4)', flexShrink: 0,
              }}
            >
              ✦ Proceed to Research Gaps →
            </button>
          )}
        </div>

        {/* Workflow step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 600 }}>Step 1: Evidence Clusters ✓</span>
          <span>→</span>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600 }}>Step 2: Pattern Mining ✓</span>
          <span>→</span>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 500 }}>Step 3: Research Gaps</span>
        </div>

        {justRan && result && (
          <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', backgroundColor: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '0.5rem', color: '#34d399', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span>✓ {result.frequent_pattern_count} patterns mined — ready to analyze research gaps.</span>
            <button onClick={() => navigate('/research-gaps')} style={{ padding: '0.35rem 0.85rem', backgroundColor: '#10b981', border: 'none', borderRadius: '0.375rem', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
              Analyze Research Gaps →
            </button>
          </div>
        )}
      </div>



      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Algorithm</label>
          <select value={algorithm} onChange={e => setAlgorithm(e.target.value as 'fpgrowth' | 'apriori')}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
            <option value="fpgrowth">FP-Growth</option>
            <option value="apriori">Apriori</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Min Support ({pct(minSupport)})</label>
          <input type="range" min={0.005} max={0.5} step={0.005} value={minSupport}
            onChange={e => setMinSupport(Number(e.target.value))}
            style={{ width: '140px', cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Min Confidence ({pct(minConfidence)})</label>
          <input type="range" min={0.0} max={1.0} step={0.05} value={minConfidence}
            onChange={e => setMinConfidence(Number(e.target.value))}
            style={{ width: '140px', cursor: 'pointer' }} />
        </div>
        <button onClick={handleRun} disabled={running}
          style={{ padding: '0.55rem 1.4rem', borderRadius: '0.5rem', backgroundColor: running ? '#374151' : '#6366f1', color: '#fff', border: 'none', cursor: running ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
          {running ? 'Mining…' : 'Run Mining'}
        </button>
        <button onClick={load} disabled={loading}
          style={{ padding: '0.55rem 1rem', borderRadius: '0.5rem', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Stats row */}
      {result && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Papers Analysed', value: result.n_papers },
            { label: 'Frequent Patterns', value: result.frequent_pattern_count },
            { label: 'Association Rules', value: result.association_rule_count },
            { label: 'Underexplored Candidates', value: result.underexplored_candidate_count },
          ].map(s => (
            <div key={s.label} style={{ flex: '1 1 130px', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Top Patterns by Support</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 16, bottom: 70, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', fontSize: '0.78rem' }}
                formatter={(val: any, name: any) => [name === 'support' ? `${val}%` : val, name === 'support' ? 'Support' : 'Papers']} />
              <Bar dataKey="support" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={COMBO_COLORS[entry.combo?.toLowerCase() ?? ''] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {Object.entries(COMBO_COLORS).filter(([k]) => k !== 'other').map(([combo, color]) => (
              <div key={combo} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, display: 'inline-block' }} />
                {combo}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + tabs */}
      {result && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', padding: '0.2rem', border: '1px solid var(--border-color)' }}>
            {([['patterns', 'Frequent Patterns'], ['rules', 'Association Rules'], ['candidates', 'Underexplored Candidates']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', backgroundColor: tab === t ? '#6366f1' : 'transparent', color: tab === t ? '#fff' : 'var(--text-muted)', fontWeight: tab === t ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Combo filter */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {['all', ...allCombos].map(c => (
              <button key={c} onClick={() => setFilterCombo(c)}
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', borderRadius: '999px', border: `1px solid ${filterCombo === c ? '#6366f1' : 'var(--border-color)'}`, backgroundColor: filterCombo === c ? 'rgba(99,102,241,0.15)' : 'transparent', color: filterCombo === c ? '#818cf8' : 'var(--text-muted)', cursor: 'pointer' }}>
                {c === 'all' ? 'All Combos' : c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading patterns…</div>
      ) : !result ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '0.75rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔬</div>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>No patterns mined yet</div>
          <div style={{ fontSize: '0.875rem' }}>
            Upload and process papers, then click <strong>Run Mining</strong> to discover frequent research patterns.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {tab === 'patterns' && filteredPatterns.map(p => <PatternCard key={p.pattern_id} p={p} />)}
          {tab === 'rules' && (result.association_rules ?? []).map(r => <RuleCard key={r.rule_id} r={r} />)}
          {tab === 'candidates' && filteredCandidates.map(c => <CandidateCard key={c.candidate_id} c={c} />)}
          {tab === 'patterns' && filteredPatterns.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No patterns for this filter.</div>
          )}
          {tab === 'rules' && (result.association_rules ?? []).length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No association rules found. Try lowering min_confidence.</div>
          )}
          {tab === 'candidates' && filteredCandidates.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No underexplored candidates found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatternMiningDashboard;
