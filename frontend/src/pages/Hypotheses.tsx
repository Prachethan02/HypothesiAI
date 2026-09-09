import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Lightbulb,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Quote,
  CheckCircle2,
  FlaskConical,
  Bot,
  Key,
  Eye,
  EyeOff,
  Cpu,
  Settings2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiService } from '../services/api';
import type { GroundedHypothesis, RankedGap } from '../services/api';

export const Hypotheses: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialGapId = searchParams.get('gap_id');

  const [hypotheses, setHypotheses] = useState<GroundedHypothesis[]>([]);
  const [rankedGaps, setRankedGaps] = useState<RankedGap[]>([]);
  const [selectedGapId, setSelectedGapId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingGapId, setGeneratingGapId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showFormulateModal, setShowFormulateModal] = useState(false);

  // LLM Engine Configuration State (persisted to localStorage)
  const [provider, setProvider] = useState<string>(() => {
    return localStorage.getItem('hypothesiai_llm_provider') || 'gemini';
  });
  const [model, setModel] = useState<string>(() => {
    return localStorage.getItem('hypothesiai_llm_model') || 'gemini-1.5-flash';
  });
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('hypothesiai_llm_api_key') || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    localStorage.setItem('hypothesiai_llm_provider', newProvider);
    let defaultModel = 'gemini-1.5-flash';
    if (newProvider === 'openai') defaultModel = 'gpt-4o-mini';
    else if (newProvider === 'evidence_engine') defaultModel = 'evidence-grounded-v1';
    setModel(defaultModel);
    localStorage.setItem('hypothesiai_llm_model', defaultModel);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    localStorage.setItem('hypothesiai_llm_model', newModel);
  };

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('hypothesiai_llm_api_key', val);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gapsRes, hypRes] = await Promise.all([
        apiService.listRankedGaps(),
        apiService.listGroundedHypotheses(),
      ]);

      if (gapsRes.success && gapsRes.data) {
        setRankedGaps(gapsRes.data);
        if (gapsRes.data.length > 0 && !selectedGapId) {
          setSelectedGapId(gapsRes.data[0].gap_id);
        }
      }

      if (hypRes.success && hypRes.data) {
        setHypotheses(hypRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load hypotheses data.');
    } finally {
      setLoading(false);
    }
  }, [selectedGapId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL param gap_id
  useEffect(() => {
    if (initialGapId) {
      setSelectedGapId(initialGapId);
      setShowFormulateModal(true);
    }
  }, [initialGapId]);

  const handleGenerate = async (gapIdToUse?: string) => {
    const targetGapId = gapIdToUse || selectedGapId;
    if (!targetGapId) return;

    setGenerating(true);
    setGeneratingGapId(targetGapId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiService.generateGroundedHypothesis({
        gap_id: targetGapId,
        provider,
        model,
        api_key: apiKey.trim() || undefined,
        force_regenerate: true,
      });

      if (res.success && res.data) {
        setHypotheses((prev) => {
          const filtered = prev.filter(
            (h) => h.hypothesis_id !== res.data.hypothesis_id && h.gap_id !== res.data.gap_id
          );
          return [res.data, ...filtered];
        });
        setShowFormulateModal(false);
        setSuccessMsg(
          res.message ||
            `Hypothesis formulated successfully using ${res.data.llm_provider || provider} (${res.data.llm_model || model})!`
        );
        setTimeout(() => setSuccessMsg(null), 6000);
      }
    } catch (err: any) {
      setError(err.message || 'Hypothesis generation failed.');
    } finally {
      setGenerating(false);
      setGeneratingGapId(null);
    }
  };

  const renderProviderBadge = (hyp: GroundedHypothesis) => {
    const prov = (hyp.llm_provider || '').toLowerCase();
    const mod = hyp.llm_model || 'v1';

    if (prov.includes('gemini')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            color: '#60a5fa',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
          title="Generated via Google Gemini LLM"
        >
          <Bot size={13} />
          <span>Google Gemini ({mod})</span>
        </span>
      );
    }
    if (prov.includes('openai')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
          title="Generated via OpenAI LLM"
        >
          <Bot size={13} />
          <span>OpenAI ({mod})</span>
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.2rem 0.65rem',
          borderRadius: '9999px',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          color: '#a78bfa',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
        title="Formulated via HypothesiAI Evidence Engine"
      >
        <Cpu size={13} />
        <span>Evidence Engine ({mod})</span>
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Lightbulb size={24} color="#eab308" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Evidence-Grounded Hypotheses
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Scientific hypotheses and actionable experimental roadmaps formulated dynamically by LLMs from your uploaded papers.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowFormulateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              backgroundColor: '#4f46e5',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.4)',
            }}
          >
            <Sparkles size={16} />
            <span>Formulate Hypothesis from Gap</span>
          </button>
        </div>
      </div>

      {/* AI LLM Settings Quick Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.1rem',
          backgroundColor: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.625rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <Bot size={18} color="#60a5fa" />
          <span style={{ color: 'var(--text-muted)' }}>Active LLM Provider:</span>
          <span
            style={{
              fontWeight: 700,
              color: provider === 'gemini' ? '#60a5fa' : provider === 'openai' ? '#34d399' : '#a78bfa',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              padding: '0.2rem 0.55rem',
              borderRadius: '0.25rem',
              border: '1px solid var(--border-color)',
            }}
          >
            {provider === 'gemini' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'HypothesiAI Evidence Engine'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Model:</span>
          <span style={{ fontFamily: 'monospace', color: '#cbd5e1', fontSize: '0.8rem', backgroundColor: 'rgba(255, 255, 255, 0.06)', padding: '0.15rem 0.45rem', borderRadius: '0.25rem' }}>
            {model}
          </span>
          {apiKey.trim() ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontSize: '0.75rem' }}>
              <CheckCircle2 size={13} /> Custom API Key Active
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              (Using server key or zero-key evidence engine)
            </span>
          )}
        </div>

        <button
          onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            backgroundColor: showSettingsDrawer ? '#4f46e5' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: showSettingsDrawer ? '#ffffff' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          <Settings2 size={14} />
          <span>{showSettingsDrawer ? 'Hide LLM Settings' : 'Configure LLM Engine'}</span>
          {showSettingsDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expandable LLM Configuration Box */}
      {showSettingsDrawer && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '0.625rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', fontWeight: 600, fontSize: '0.9rem' }}>
            <Key size={16} />
            <span>LLM Provider & API Credentials Setup</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Provider Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Select AI / LLM Provider:
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                style={{
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="gemini">Google Gemini (Recommended - Free AI Studio API)</option>
                <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                <option value="evidence_engine">HypothesiAI Built-in Synthesis Engine (Local / No Key)</option>
              </select>
            </div>

            {/* Model Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Select Model:
              </label>
              <select
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                style={{
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                {provider === 'gemini' ? (
                  <>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fast, accurate, high rate limits)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Deep reasoning & hypothesis formulation)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Next-gen frontier reasoning)</option>
                  </>
                ) : provider === 'openai' ? (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini (Cost-efficient, agile formulation)</option>
                    <option value="gpt-4o">gpt-4o (State of the art multimodal analysis)</option>
                  </>
                ) : (
                  <option value="evidence-grounded-v1">evidence-grounded-v1 (Domain extraction engine)</option>
                )}
              </select>
            </div>
          </div>

          {/* API Key Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {provider === 'gemini' ? 'Google Gemini API Key:' : provider === 'openai' ? 'OpenAI API Key:' : 'Engine Key (Optional):'}
              </label>
              {provider === 'gemini' && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.2rem', textDecoration: 'none' }}
                >
                  <span>Get Free Gemini Key</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={
                  provider === 'gemini'
                    ? 'AIzaSy... (leave blank to use backend GEMINI_API_KEY / fallback)'
                    : provider === 'openai'
                    ? 'sk-... (leave blank to use backend OPENAI_API_KEY / fallback)'
                    : 'Not required for built-in evidence engine'
                }
                style={{
                  width: '100%',
                  padding: '0.65rem 2.5rem 0.65rem 0.85rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Saved locally in your browser session. When provided, the backend directly prompts the live LLM with the gap details and paper quotes to generate realistic scientific hypotheses.
            </p>
          </div>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            color: '#f87171',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '0.5rem',
            color: '#34d399',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Formulate Modal */}
      {showFormulateModal && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FlaskConical size={18} color="#818cf8" />
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Formulate Hypothesis with LLM
              </span>
            </div>
            <button
              onClick={() => setShowFormulateModal(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              1. Choose from Discovered Research Gaps:
            </label>
            {rankedGaps.length > 0 ? (
              <select
                value={selectedGapId}
                onChange={(e) => setSelectedGapId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              >
                {rankedGaps.map((g) => (
                  <option key={g.gap_id} value={g.gap_id}>
                    #{g.rank} — {g.title}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No research gaps found yet. Please upload papers into a corpus and analyze it first.
              </div>
            )}
          </div>

          {/* LLM Engine Selection in Modal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                2. AI / LLM Provider:
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                style={{
                  padding: '0.65rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="evidence_engine">Built-in Synthesis Engine</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                3. Model:
              </label>
              <select
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                style={{
                  padding: '0.65rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {provider === 'gemini' ? (
                  <>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Free)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Deep reasoning)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  </>
                ) : provider === 'openai' ? (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                  </>
                ) : (
                  <option value="evidence-grounded-v1">evidence-grounded-v1</option>
                )}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              onClick={() => setShowFormulateModal(false)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleGenerate()}
              disabled={generating || !selectedGapId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.4rem',
                borderRadius: '0.5rem',
                backgroundColor: generating ? '#4338ca' : '#4f46e5',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: generating || !selectedGapId ? 'not-allowed' : 'pointer',
              }}
            >
              <Sparkles size={16} />
              <span>
                {generating
                  ? `Generating with ${provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : 'Engine'}…`
                  : `Generate Hypothesis with ${provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : 'Engine'}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main Hypotheses Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {loading && hypotheses.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <RefreshCw size={24} style={{ margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
            <div>Loading formulated hypotheses…</div>
          </div>
        ) : hypotheses.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.75rem',
              border: '1px dashed var(--border-color)',
            }}
          >
            <Lightbulb size={40} color="#4b5563" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              No Hypotheses Generated Yet
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '480px', marginInline: 'auto' }}>
              Select an identified research gap to generate an evidence-grounded hypothesis and experimental roadmap.
            </p>
            <button
              onClick={() => setShowFormulateModal(true)}
              style={{
                padding: '0.65rem 1.4rem',
                backgroundColor: '#4f46e5',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Formulate from Discovered Gap
            </button>
          </div>
        ) : (
          hypotheses.map((hyp) => {
            const correspondingGap = rankedGaps.find((g) => g.gap_id === hyp.gap_id);
            const isRegeneratingThis = generating && generatingGapId === hyp.gap_id;

            return (
              <div
                key={hyp.hypothesis_id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-color)',
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                }}
              >
                {/* Top Row: Research Gap Origin + LLM Provider Badge + Regenerate Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#a5b4fc', flexWrap: 'wrap' }}>
                    {correspondingGap && (
                      <>
                        <span style={{ fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.2)' }}>
                          Target Gap #{correspondingGap.rank}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{correspondingGap.title}</span>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {renderProviderBadge(hyp)}

                    <button
                      onClick={() => handleGenerate(hyp.gap_id)}
                      disabled={generating}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.35)',
                        color: '#a5b4fc',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: generating ? 'not-allowed' : 'pointer',
                      }}
                      title="Re-run formulation with active LLM settings"
                    >
                      <RefreshCw size={12} style={{ animation: isRegeneratingThis ? 'spin 1s linear infinite' : 'none' }} />
                      <span>{isRegeneratingThis ? 'Regenerating…' : 'Regenerate with LLM'}</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
                    {hyp.title}
                  </h2>

                  {/* Research Question Callout */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      borderLeft: '4px solid #6366f1',
                      borderRadius: '0 0.375rem 0.375rem 0',
                      marginTop: '0.75rem',
                    }}
                  >
                    <HelpCircle size={18} color="#818cf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                        Core Research Question
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.4 }}>
                        {hyp.research_question}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hypothesis Statement Box */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: '0.5rem',
                    padding: '1.1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#facc15', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <Lightbulb size={16} />
                    <span>Scientific Hypothesis Statement:</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{hyp.hypothesis}"
                  </p>
                </div>

                {/* Rationale */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Scientific Grounding & Rationale
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {hyp.rationale}
                  </p>
                </div>

                {/* PROMINENT SECTION: What To Proceed Further (Experimental Roadmap) */}
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '0.625rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 700, fontSize: '0.95rem' }}>
                    <FlaskConical size={18} />
                    <span>What To Proceed Further: Actionable Experimental Roadmap</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {hyp.possible_methodology}
                  </div>
                </div>

                {/* Experimental Variables Grid */}
                {hyp.variables && hyp.variables.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Identified Experimental Variables
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>
                      {hyp.variables.map((v, vIdx) => {
                        const vText = typeof v === 'string' ? v : `${(v as any).name}: ${(v as any).description}`;
                        return (
                          <div
                            key={vIdx}
                            style={{
                              padding: '0.6rem 0.85rem',
                              backgroundColor: 'rgba(30, 41, 59, 0.5)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '0.375rem',
                              fontSize: '0.825rem',
                              color: 'var(--text-primary)',
                              lineHeight: 1.4,
                            }}
                          >
                            <CheckCircle2 size={13} color="#60a5fa" style={{ display: 'inline', marginRight: '0.4rem' }} />
                            <span>{vText}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Supporting Evidence Excerpts */}
                {hyp.supporting_evidence && hyp.supporting_evidence.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Literature Citations & Excerpts
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {hyp.supporting_evidence.map((ev, eIdx) => {
                        const evText = typeof ev === 'string' ? ev : (ev as any).description || (ev as any).citation || JSON.stringify(ev);
                        return (
                          <div
                            key={eIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              padding: '0.55rem 0.85rem',
                              backgroundColor: 'rgba(15, 23, 42, 0.4)',
                              borderLeft: '3px solid #eab308',
                              borderRadius: '0 0.375rem 0.375rem 0',
                              fontSize: '0.825rem',
                              color: 'var(--text-secondary)',
                              fontStyle: 'italic',
                            }}
                          >
                            <Quote size={13} color="#facc15" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>"{evText}"</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Expected Contribution */}
                {hyp.expected_contribution && (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.5rem',
                      fontSize: '0.825rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>Expected Scientific Contribution: </strong>
                    {hyp.expected_contribution}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Hypotheses;
