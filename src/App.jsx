import React, { useState, useMemo, useEffect } from 'react';
import './App.css';
import pricingCatalog from './pricing_catalog.json';
import { DEFAULT_INPUTS, calculateTco } from './calculator.js';

const BASE_DEFAULTS = {
  ...DEFAULT_INPUTS,
  monthlyActiveUsers: 10000,
  avgQueriesPerUserMonth: 15
};

export default function App() {
  // 1. THEME STATE
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rag-tco-theme') || 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('rag-tco-theme', next);
      return next;
    });
  };

  // 2. TCO CONFIG CONFIGURATION STATE
  const [activeTab, setActiveTab] = useState('activity');
  const [inputs, setInputs] = useState(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#state=')) {
        const base64Data = hash.substring(7);
        const jsonStr = atob(base64Data);
        const loaded = JSON.parse(jsonStr);
        return { ...BASE_DEFAULTS, ...loaded };
      }
    } catch (e) {
      console.error("Failed to load state from hash:", e);
    }
    
    return BASE_DEFAULTS;
  });

  useEffect(() => {
    try {
      const diff = {};
      for (const key in inputs) {
        if (inputs[key] !== BASE_DEFAULTS[key]) {
          diff[key] = inputs[key];
        }
      }
      
      const jsonStr = JSON.stringify(diff);
      const base64Data = btoa(jsonStr);
      
      if (Object.keys(diff).length === 0) {
        // Clear hash cleanly if there are no overrides
        if (window.location.hash) {
          window.history.replaceState(null, null, window.location.pathname + window.location.search);
        }
      } else {
        window.location.hash = `state=${base64Data}`;
      }
    } catch (e) {
      console.error("Failed to serialize state to hash:", e);
    }
  }, [inputs]);

  const handleUpdate = (key, value) => {
    setInputs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 3. COST CALCULATION ENGINE INVOCATIONS
  const metrics = useMemo(() => {
    return calculateTco(inputs, pricingCatalog);
  }, [inputs]);

  const sensitivityTiers = useMemo(() => {
    const tiers = [1000, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000];
    return tiers.map(t => {
      const tMetrics = calculateTco(inputs, pricingCatalog, t);
      return {
        users: t,
        queries: tMetrics.monthlyQueries,
        totalCost: tMetrics.totalMonthlyCost,
        costPerQuery: tMetrics.costPerQuery,
        llmCost: tMetrics.totalLlmCost,
        embedCost: tMetrics.queryEmbeddingCost + tMetrics.monthlyNewEmbeddingsCost,
        dbCost: tMetrics.vectorDbCost,
        infraCost: tMetrics.infraCost,
        opsCost: tMetrics.opsCost
      };
    });
  }, [inputs]);

  const formatVal = (val, decimalPlaces = 2) => {
    const prefix = inputs.currency === "INR" ? "₹" : "$";
    return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}`;
  };

  const handleCurrencyToggle = (curr) => {
    handleUpdate("currency", curr);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Shareable config link copied to clipboard!");
  };

  const exportCsv = () => {
    const headers = ["Users (MAU)", "Monthly Queries", `Total Cost (${inputs.currency})`, `Cost per Query (${inputs.currency})`].join(",");
    const rows = sensitivityTiers.map(t => 
      [t.users, t.queries, t.totalCost.toFixed(2), t.costPerQuery.toFixed(4)].join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rag_tco_sensitivity_projections.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. CHART SVG GRAPHICS COORDINATES GENERATION
  const paddingLeft = 50;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  const chartWidth = 450;
  const chartHeight = 180;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const bottomY = chartHeight - paddingBottom;

  const chartPoints = useMemo(() => {
    if (sensitivityTiers.length === 0) return [];
    const maxCost = Math.max(...sensitivityTiers.map(t => t.totalCost), 1);
    
    return sensitivityTiers.map((t, idx) => {
      const x = paddingLeft + (idx / (sensitivityTiers.length - 1)) * plotWidth;
      const y = chartHeight - paddingBottom - (t.totalCost / maxCost) * plotHeight;
      return { x, y, ...t };
    });
  }, [sensitivityTiers]);

  const svgPaths = useMemo(() => {
    if (chartPoints.length === 0) return { line: '', area: '' };
    const linePath = chartPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const areaPath = `M ${first.x} ${bottomY} ` + chartPoints.map(p => `L ${p.x} ${p.y}`).join(' ') + ` L ${last.x} ${bottomY} Z`;
    return { line: linePath, area: areaPath };
  }, [chartPoints]);

  return (
    <div className={`app-container theme-${theme}`}>
      {/* HEADER BANNER */}
      <header className="app-header">
        <div className="header-title-container">
          <h1>Enterprise RAG Total Cost of Ownership (TCO) Calculator</h1>
          <div className="header-subtitle">
            Model document ingestion, chunk strategies, embeddings, rerankers, vectors, caches, LLMs, and DevOps infrastructure.
          </div>
        </div>
        <div className="header-controls">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          <div className="currency-toggle-group">
            <button 
              className={`currency-btn ${inputs.currency === 'USD' ? 'active' : ''}`}
              onClick={() => handleCurrencyToggle('USD')}
            >
              USD
            </button>
            <button 
              className={`currency-btn ${inputs.currency === 'INR' ? 'active' : ''}`}
              onClick={() => handleCurrencyToggle('INR')}
            >
              INR
            </button>
          </div>

          {inputs.currency === 'INR' && (
            <div className="ex-rate-wrapper">
              <span>Rate:</span>
              <input 
                type="number" 
                className="ex-rate-input"
                value={inputs.exchangeRate} 
                onChange={(e) => handleUpdate("exchangeRate", parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>
      </header>

      {/* DASHBOARD SPLIT GRID */}
      <div className="app-body">
        
        {/* LEFT COLUMN: DENSE MINILIST CONFIG INPUTS */}
        <aside className="config-panel">
          <div className="tab-nav-vertical">
            <button className={`tab-nav-btn ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>1. Activity & Docs</button>
            <button className={`tab-nav-btn ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')}>2. Models & API</button>
            <button className={`tab-nav-btn ${activeTab === 'storage' ? 'active' : ''}`} onClick={() => setActiveTab('storage')}>3. Storage & DB</button>
            <button className={`tab-nav-btn ${activeTab === 'context' ? 'active' : ''}`} onClick={() => setActiveTab('context')}>4. Context & Cache</button>
            <button className={`tab-nav-btn ${activeTab === 'infra' ? 'active' : ''}`} onClick={() => setActiveTab('infra')}>5. Infra & Ops</button>
          </div>

          {/* TAB PANEL 1: ACTIVITY & DOCUMENTS */}
          {activeTab === 'activity' && (
            <div className="config-section">
              <h3 className="config-section-title">👤 User Activity</h3>
              <div className="minilist-group">
                <div className="minilist-row">
                  <span className="minilist-label" title="Monthly Active Users interacting with RAG">Monthly Active Users</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="100" max="100000" step="100"
                      value={inputs.monthlyActiveUsers}
                      onChange={(e) => handleUpdate("monthlyActiveUsers", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.monthlyActiveUsers.toLocaleString()}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Queries generated per user per month">Queries / User / Month</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="1" max="100" step="1"
                      value={inputs.avgQueriesPerUserMonth}
                      onChange={(e) => handleUpdate("avgQueriesPerUserMonth", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.avgQueriesPerUserMonth}</span>
                </div>
              </div>

              <h3 className="config-section-title" style={{ marginTop: '16px' }}>📂 Document Ingestion</h3>
              <div className="minilist-group">
                <div className="minilist-row">
                  <span className="minilist-label" title="Total base documents loaded upfront">Base Documents</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="10" max="10000" step="10"
                      value={inputs.documents}
                      onChange={(e) => handleUpdate("documents", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.documents.toLocaleString()}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Average pages per document">Pages per Doc</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="1" max="100" step="1"
                      value={inputs.pagesPerDoc}
                      onChange={(e) => handleUpdate("pagesPerDoc", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.pagesPerDoc}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Average word count per page">Words per Page</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="50" max="1000" step="50"
                      value={inputs.wordsPerPage}
                      onChange={(e) => handleUpdate("wordsPerPage", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.wordsPerPage}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="New documentation uploaded per month">New Docs / Month</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="500" step="5"
                      value={inputs.monthlyNewDocs}
                      onChange={(e) => handleUpdate("monthlyNewDocs", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.monthlyNewDocs}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Percentage of documents processed via OCR scanning">OCR Scanning %</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={inputs.ocrPercent}
                      onChange={(e) => handleUpdate("ocrPercent", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.ocrPercent}%</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="OCR rate per page in USD">OCR Rate / Page (USD)</span>
                  <div className="minilist-control">
                    <input 
                      type="number" step="0.001"
                      value={inputs.ocrRatePerPage}
                      onChange={(e) => handleUpdate("ocrRatePerPage", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <span className="minilist-value">{formatVal(inputs.ocrRatePerPage * metrics.multiplier, 3)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB PANEL 2: MODEL SELECTION & APIS */}
          {activeTab === 'models' && (
            <div className="config-section">
              <h3 className="config-section-title">🤖 LLM Generative Layer</h3>
              <div className="minilist-group">
                <div className="minilist-row" style={{ gridTemplateColumns: '130px 1fr' }}>
                  <span className="minilist-label">Generative LLM</span>
                  <div className="minilist-control">
                    <select 
                      value={inputs.llmModel}
                      onChange={(e) => handleUpdate("llmModel", e.target.value)}
                    >
                      {pricingCatalog.llm_models.map(m => (
                        <option key={m.name} value={m.name}>{m.name} ({m.provider})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group-checkbox" style={{ padding: '4px 8px', margin: '4px 0' }}>
                  <input 
                    type="checkbox" id="routingEnabled"
                    checked={inputs.routingEnabled}
                    onChange={(e) => handleUpdate("routingEnabled", e.target.checked)}
                  />
                  <label htmlFor="routingEnabled">Enable Dynamic Model Routing</label>
                </div>

                {inputs.routingEnabled && (
                  <div className="glass-card" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    <div className="minilist-row" style={{ gridTemplateColumns: '120px 1fr', padding: 0 }}>
                      <span className="minilist-label" style={{ fontSize: '11px' }}>Mini Router LLM</span>
                      <select 
                        style={{ padding: '4px' }}
                        value={inputs.llmModelMini}
                        onChange={(e) => handleUpdate("llmModelMini", e.target.value)}
                      >
                        {pricingCatalog.llm_models.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="minilist-row" style={{ gridTemplateColumns: '120px 1fr', padding: 0 }}>
                      <span className="minilist-label" style={{ fontSize: '11px' }}>Large Escalator LLM</span>
                      <select 
                        style={{ padding: '4px' }}
                        value={inputs.llmModelLarge}
                        onChange={(e) => handleUpdate("llmModelLarge", e.target.value)}
                      >
                        {pricingCatalog.llm_models.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="minilist-row" style={{ padding: 0 }}>
                      <span className="minilist-label" style={{ fontSize: '11px' }}>Route to Mini %</span>
                      <div className="minilist-control">
                        <input 
                          type="range" min="0" max="100" step="5"
                          value={inputs.routingMiniPercent}
                          onChange={(e) => {
                            const mini = parseInt(e.target.value);
                            handleUpdate("routingMiniPercent", mini);
                            handleUpdate("routingLargePercent", 100 - mini);
                          }}
                        />
                      </div>
                      <span className="minilist-value" style={{ fontSize: '10px' }}>{inputs.routingMiniPercent}%</span>
                    </div>
                  </div>
                )}

                <div className="minilist-row">
                  <span className="minilist-label" title="Workflow calls per query (Router, reflection cycles)">Workflow Invocations</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="1" max="10" step="1"
                      value={inputs.workflowCallsPerQuery}
                      onChange={(e) => handleUpdate("workflowCallsPerQuery", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.workflowCallsPerQuery}x</span>
                </div>
              </div>

              <h3 className="config-section-title" style={{ marginTop: '16px' }}>📡 Embedding & Reranking</h3>
              <div className="minilist-group">
                <div className="minilist-row" style={{ gridTemplateColumns: '130px 1fr' }}>
                  <span className="minilist-label">Embedding Model</span>
                  <div className="minilist-control">
                    <select 
                      value={inputs.embeddingModel}
                      onChange={(e) => handleUpdate("embeddingModel", e.target.value)}
                    >
                      {pricingCatalog.embedding_models.map(m => (
                        <option key={m.name} value={m.name}>{m.name} ({m.dimensions} dims)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="minilist-row" style={{ gridTemplateColumns: '130px 1fr' }}>
                  <span className="minilist-label">Reranker Model</span>
                  <div className="minilist-control">
                    <select 
                      value={inputs.rerankerModel}
                      onChange={(e) => handleUpdate("rerankerModel", e.target.value)}
                    >
                      {pricingCatalog.reranker_models.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB PANEL 3: STORAGE & VECTOR DATABASE */}
          {activeTab === 'storage' && (
            <div className="config-section">
              <h3 className="config-section-title">🗄️ Vector Database Index</h3>
              <div className="minilist-group">
                <div className="minilist-row" style={{ gridTemplateColumns: '130px 1fr' }}>
                  <span className="minilist-label">Vector Database</span>
                  <div className="minilist-control">
                    <select 
                      value={inputs.vectorDb}
                      onChange={(e) => handleUpdate("vectorDb", e.target.value)}
                    >
                      {pricingCatalog.vector_databases.map(db => (
                        <option key={db.name} value={db.name}>{db.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Token limits per chunk">Chunk Size (tokens)</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="128" max="2048" step="128"
                      value={inputs.chunkSize}
                      onChange={(e) => handleUpdate("chunkSize", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.chunkSize}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Overlapping tokens on chunks split">Chunk Overlap</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="500" step="10"
                      value={inputs.chunkOverlap}
                      onChange={(e) => handleUpdate("chunkOverlap", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.chunkOverlap}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Bytes allocated for citation source metadata">Metadata Size</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="1024" step="64"
                      value={inputs.metadataSize}
                      onChange={(e) => handleUpdate("metadataSize", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.metadataSize} B</span>
                </div>
              </div>

              <h3 className="config-section-title" style={{ marginTop: '16px' }}>🔍 Retrieval Details</h3>
              <div className="minilist-group">
                <div className="minilist-row">
                  <span className="minilist-label" title="Number of vectors retrieved for analysis">Top-K Chunks</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="1" max="100" step="1"
                      value={inputs.topK}
                      onChange={(e) => handleUpdate("topK", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.topK}</span>
                </div>

                <div className="form-group-checkbox" style={{ padding: '4px 8px' }}>
                  <input 
                    type="checkbox" id="metadataFiltering"
                    checked={inputs.metadataFiltering}
                    onChange={(e) => handleUpdate("metadataFiltering", e.target.checked)}
                  />
                  <label htmlFor="metadataFiltering">Enable Metadata Index Filtering</label>
                </div>
              </div>
            </div>
          )}

          {/* TAB PANEL 4: CONTEXT & CACHING */}
          {activeTab === 'context' && (
            <div className="config-section">
              <h3 className="config-section-title">📝 Context Construction</h3>
              <div className="minilist-group">
                <div className="minilist-row">
                  <span className="minilist-label">System Prompt</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="100" max="5000" step="100"
                      value={inputs.systemPromptTokens}
                      onChange={(e) => handleUpdate("systemPromptTokens", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.systemPromptTokens}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label">History (tokens)</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="16384" step="256"
                      value={inputs.conversationHistoryTokens}
                      onChange={(e) => handleUpdate("conversationHistoryTokens", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.conversationHistoryTokens}</span>
                </div>

                <div className="form-group-checkbox" style={{ padding: '4px 8px', margin: '4px 0' }}>
                  <input 
                    type="checkbox" id="compressionEnabled"
                    checked={inputs.compressionEnabled}
                    onChange={(e) => handleUpdate("compressionEnabled", e.target.checked)}
                  />
                  <label htmlFor="compressionEnabled">Enable Context Compression (LLMLingua)</label>
                </div>

                {inputs.compressionEnabled && (
                  <div className="glass-card" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    <div className="minilist-row" style={{ gridTemplateColumns: '120px 1fr', padding: 0 }}>
                      <span className="minilist-label" style={{ fontSize: '11px' }}>Compressor LLM</span>
                      <select 
                        style={{ padding: '4px' }}
                        value={inputs.compressionModel}
                        onChange={(e) => handleUpdate("compressionModel", e.target.value)}
                      >
                        {pricingCatalog.llm_models.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="minilist-row" style={{ padding: 0 }}>
                      <span className="minilist-label" style={{ fontSize: '11px' }}>Compression Rate</span>
                      <div className="minilist-control">
                        <input 
                          type="range" min="10" max="80" step="5"
                          value={inputs.compressionRate}
                          onChange={(e) => handleUpdate("compressionRate", parseInt(e.target.value))}
                        />
                      </div>
                      <span className="minilist-value" style={{ fontSize: '10px' }}>{inputs.compressionRate}%</span>
                    </div>
                  </div>
                )}
              </div>

              <h3 className="config-section-title" style={{ marginTop: '16px' }}>⚡ Cache Acceleration</h3>
              <div className="minilist-group">
                <div className="minilist-row">
                  <span className="minilist-label" title="Avoided LLM invocations using semantic vector cache">Semantic Cache Hit %</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="60" step="2"
                      value={inputs.semanticCacheHitPercent}
                      onChange={(e) => handleUpdate("semanticCacheHitPercent", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.semanticCacheHitPercent}%</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label" title="Discounts applied on identical prompts headers (Anthropic/OpenAI prompt cache)">Prompt Cache Hit %</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="90" step="5"
                      value={inputs.promptCacheHitPercent}
                      onChange={(e) => handleUpdate("promptCacheHitPercent", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.promptCacheHitPercent}%</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB PANEL 5: INFRASTRUCTURE & OPERATIONAL COSTS */}
          {activeTab === 'infra' && (
            <div className="config-section">
              <h3 className="config-section-title">☁️ Infrastructure Flat Costs</h3>
              <div className="minilist-group">
                <div className="minilist-row">
                  <span className="minilist-label">App Servers</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="1" max="16" step="1"
                      value={inputs.infraAppServers}
                      onChange={(e) => handleUpdate("infraAppServers", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.infraAppServers}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label">Server Rate (USD/Mo)</span>
                  <div className="minilist-control">
                    <input 
                      type="number"
                      value={inputs.infraAppServerMonthlyRate}
                      onChange={(e) => handleUpdate("infraAppServerMonthlyRate", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <span className="minilist-value">{formatVal(inputs.infraAppServerMonthlyRate * metrics.multiplier)}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label">GPU Container Node</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="8" step="1"
                      value={inputs.infraGpuNodes}
                      onChange={(e) => handleUpdate("infraGpuNodes", parseInt(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{inputs.infraGpuNodes}</span>
                </div>

                <div className="minilist-row">
                  <span className="minilist-label">GPU Rate (USD/Mo)</span>
                  <div className="minilist-control">
                    <input 
                      type="number"
                      value={inputs.infraGpuNodeMonthlyRate}
                      onChange={(e) => handleUpdate("infraGpuNodeMonthlyRate", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <span className="minilist-value">{formatVal(inputs.infraGpuNodeMonthlyRate * metrics.multiplier)}</span>
                </div>
              </div>

              <h3 className="config-section-title" style={{ marginTop: '16px' }}>👥 Engineering Payroll (Ops)</h3>
              <div className="minilist-group">
                <div className="minilist-row">
                  <span className="minilist-label">Allocated DevOps FTE</span>
                  <div className="minilist-control">
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={inputs.opsDedicatedFteCount}
                      onChange={(e) => handleUpdate("opsDedicatedFteCount", parseFloat(e.target.value))}
                    />
                  </div>
                  <span className="minilist-value">{(inputs.opsDedicatedFteCount * 100).toFixed(0)}%</span>
                </div>

                <div className="minilist-row" style={{ gridTemplateColumns: '130px 1fr' }}>
                  <span className="minilist-label">Engineer Salary (USD/Yr)</span>
                  <div className="minilist-control">
                    <input 
                      type="number"
                      value={inputs.opsEngineerSalary}
                      onChange={(e) => handleUpdate("opsEngineerSalary", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT COLUMN: VISUALIZATIONS AND CALCULATIONS METRICS */}
        <main className="viz-panel">
          
          {/* KPI CARDS PANEL */}
          <div className="kpi-grid">
            <div className="glass-card kpi-card">
              <div className="kpi-label">Monthly Running Cost</div>
              <div className="kpi-value-primary">{formatVal(metrics.totalMonthlyCost, 2)}</div>
              {inputs.currency === 'INR' && (
                <div className="kpi-value-secondary">(${ (metrics.totalMonthlyCost / inputs.exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 }) })</div>
              )}
            </div>

            <div className="glass-card kpi-card">
              <div className="kpi-label">Annual Operational TCO</div>
              <div className="kpi-value-primary">{formatVal(metrics.totalAnnualCost, 0)}</div>
              {inputs.currency === 'INR' && (
                <div className="kpi-value-secondary">(${ (metrics.totalAnnualCost / inputs.exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 }) })</div>
              )}
            </div>

            <div className="glass-card kpi-card green">
              <div className="kpi-label">Cost Per Query</div>
              <div className="kpi-value-primary">{formatVal(metrics.costPerQuery, 4)}</div>
              {inputs.currency === 'INR' && (
                <div className="kpi-value-secondary">(${ (metrics.costPerQuery / inputs.exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 4 }) })</div>
              )}
            </div>
          </div>

          {/* DUAL COLS SPLIT: COST COMPONENT BREAKDOWN & BUILD VS BUY */}
          <div className="dashboard-grid-split">
            
            {/* COMPONENT BAR CHART */}
            <div className="glass-card">
              <h3 className="section-card-title">Monthly Cost Breakdown</h3>
              <div className="bar-chart-container">
                {[
                  { name: "LLM Inference API", val: metrics.totalLlmCost },
                  { name: "Vector DB Storage", val: metrics.vectorDbCost },
                  { name: "Flat Infrastructure", val: metrics.infraCost },
                  { name: "Engineering Ops", val: metrics.opsCost },
                  { name: "Reranker API", val: metrics.rerankCost },
                  { name: "Embeddings API", val: metrics.queryEmbeddingCost + metrics.monthlyNewEmbeddingsCost },
                  { name: "Document Parsing", val: metrics.monthlyDocProcessingCost }
                ].map((item, idx) => {
                  const percent = metrics.totalMonthlyCost > 0 ? (item.val / metrics.totalMonthlyCost) * 100 : 0;
                  return (
                    <div className="bar-row" key={idx}>
                      <div className="bar-label-group">
                        <span className="bar-name">{item.name}</span>
                        <span className="bar-amount">{formatVal(item.val)} ({percent.toFixed(1)}%)</span>
                      </div>
                      <div className="bar-track">
                        <div 
                          className="bar-fill" 
                          style={{ 
                            width: `${percent}%`, 
                            backgroundColor: idx === 0 ? 'var(--accent)' : idx === 1 ? 'var(--green)' : 'var(--text-muted)' 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BUILD VS BUY METRIC CARD */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 className="section-card-title">Build vs Buy Cost comparison</h3>
                <div className="build-buy-box">
                  <div className="build-buy-card buy">
                    <div className="build-buy-header">Commercial APIs (Buy)</div>
                    <div className="build-buy-cost">{formatVal(metrics.commercialTotalMonthlyCost)}</div>
                    <div className="build-buy-notes">Inference outsourced to third-party endpoints. Flex-pricing per token. No GPU overhead.</div>
                  </div>

                  <div className="build-buy-card build">
                    <div className="build-buy-header">Self-Hosted Local (Build)</div>
                    <div className="build-buy-cost">{formatVal(metrics.selfHostedTotalMonthlyCost)}</div>
                    <div className="build-buy-notes">Self-hosted LLMs & embeddings run on dedicated GPU containers. Inference is free.</div>
                  </div>
                </div>
              </div>
              
              <div className="build-buy-winner-banner" style={{ marginTop: '16px' }}>
                {metrics.commercialTotalMonthlyCost < metrics.selfHostedTotalMonthlyCost ? (
                  <span>💡 Recommend: **Commercial APIs (Buy)**. Self-hosting requires dedicated GPU nodes, which is cost-ineffective at your current scale.</span>
                ) : (
                  <span>💡 Recommend: **Self-Hosted Stack (Build)**. Your query volumes have crossed the amortization threshold, making dedicated GPU instances cheaper than API tokens.</span>
                )}
              </div>
            </div>
          </div>

          {/* SENSITIVITY PROJECTIONS TABLE & CHART */}
          <div className="glass-card sensitivity-section">
            <h3 className="section-card-title">
              <span>Dynamic User Scaling Sensitivity Analysis</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Projections based on User Tiers</span>
            </h3>

            <div className="dashboard-grid-split">
              {/* TABLE */}
              <div className="sens-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Users (MAU)</th>
                      <th>Monthly Queries</th>
                      <th>Total Cost / Mo</th>
                      <th>Cost / Query</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityTiers.map((tier, idx) => (
                      <tr key={idx} style={{ fontWeight: tier.users === inputs.monthlyActiveUsers ? 'bold' : 'normal' }}>
                        <td>{tier.users.toLocaleString()}</td>
                        <td className="text-mono">{tier.queries.toLocaleString()}</td>
                        <td className="text-mono">{formatVal(tier.totalCost, 2)}</td>
                        <td className="text-mono">{formatVal(tier.costPerQuery, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* GRAPH WITH GRADIENT AREA FILL */}
              <div className="sens-graph-svg-wrapper">
                {chartPoints.length > 0 && (
                  <svg className="sens-graph-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                    <defs>
                      <linearGradient id="chart-gradient-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={theme === 'dark' ? "0.22" : "0.15"} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0.25, 0.5, 0.75, 1.0].map((ratio, gridIdx) => (
                      <line 
                        key={gridIdx} 
                        x1={paddingLeft} y1={chartHeight - paddingBottom - ratio * plotHeight} 
                        x2={chartWidth - paddingRight} y2={chartHeight - paddingBottom - ratio * plotHeight} 
                        stroke={theme === 'dark' ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.05)"} 
                        strokeWidth="1" 
                      />
                    ))}

                    {/* Area path */}
                    {svgPaths.area && (
                      <path d={svgPaths.area} className="chart-area-fill" />
                    )}

                    {/* Line path */}
                    {svgPaths.line && (
                      <path d={svgPaths.line} className="chart-line" />
                    )}

                    {/* Point dots */}
                    {chartPoints.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={p.users === inputs.monthlyActiveUsers ? "5" : "3.5"}
                        fill={p.users === inputs.monthlyActiveUsers ? "var(--green)" : "var(--accent)"}
                        stroke={theme === 'dark' ? "#000000" : "#ffffff"}
                        strokeWidth="1"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleUpdate("monthlyActiveUsers", p.users)}
                      />
                    ))}

                    {/* X Axis Labels */}
                    {chartPoints.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
                      <text
                        key={idx}
                        x={p.x}
                        y={chartHeight - 8}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        {p.users >= 1000000 ? `${p.users/1000000}M` : `${p.users/1000}k`}
                      </text>
                    ))}

                    {/* Y Axis Max Label */}
                    <text x="5" y="16" fill="var(--text-muted)" fontSize="9">
                      Max: {formatVal(Math.max(...sensitivityTiers.map(t => t.totalCost)), 0)}
                    </text>
                    <text x="5" y={chartHeight - paddingBottom} fill="var(--text-muted)" fontSize="9">Min</text>
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* VENDOR COMPARISON MODULE */}
          <div className="glass-card comparison-matrix-card">
            <h3 className="section-card-title">Side-by-Side Model & Database Catalog</h3>
            <table>
              <thead>
                <tr>
                  <th>Model / Database Name</th>
                  <th>Vendor</th>
                  <th>Core Rate Specification</th>
                  <th>Capacity Limit / Class</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}><td colSpan="4"><b>Large Language Models (LLMs)</b></td></tr>
                {pricingCatalog.llm_models.map((m, idx) => (
                  <tr key={`llm-${idx}`}>
                    <td>{m.name}</td>
                    <td>{m.provider}</td>
                    <td>Input: {formatVal(m.input_cost * metrics.multiplier)}/1M tokens | Output: {formatVal(m.output_cost * metrics.multiplier)}/1M tokens</td>
                    <td>{m.context_limit.toLocaleString()} tokens context</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}><td colSpan="4"><b>Vector Databases</b></td></tr>
                {pricingCatalog.vector_databases.map((db, idx) => (
                  <tr key={`db-${idx}`}>
                    <td>{db.name}</td>
                    <td>{db.provider}</td>
                    <td>
                      {db.pricing_type === 'serverless' 
                        ? `Storage: ${formatVal(db.storage_cost * metrics.multiplier)}/GB/mo | Read: ${formatVal(db.read_cost * metrics.multiplier)}/1M | Write: ${formatVal(db.write_cost * metrics.multiplier)}/1M`
                        : db.pricing_type === 'provisioned' 
                        ? `Node rate: ${formatVal(db.node_rate * metrics.multiplier)}/hour (${formatVal(db.node_rate * 730 * metrics.multiplier, 0)}/mo)`
                        : `Flat monthly: ${formatVal((db.flat_rate || 0) * metrics.multiplier)}/mo`}
                    </td>
                    <td>{db.pricing_type.toUpperCase()} pricing class</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ACTIONS BAR FOR EXPORT & SHARING */}
          <div className="action-bar">
            <button className="action-btn" onClick={copyShareLink}>
              🔗 Copy Config Share URL
            </button>
            <button className="action-btn" onClick={exportCsv}>
              📥 Export CSV Tiers
            </button>
            <button className="action-btn primary" onClick={() => window.print()}>
              🖨️ Print PDF Cost Report
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}
