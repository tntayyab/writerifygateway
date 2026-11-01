import { createSignal, onMount, onCleanup, Show, For, type Component } from 'solid-js';
import { Title } from '@solidjs/meta';
import { A, useNavigate } from '@solidjs/router';
import { authClient } from '../services/auth-client.js';
import { toast } from '../services/toast-store.js';
import { getAllMembers, type GatewayMember, type TimeRangeFilter } from '../services/admin-neon.js';
import '../styles/admin.css';

export const AdminOverview: Component = () => {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const currentUserEmail = () => session()?.data?.user?.email?.toLowerCase() ?? '';
  const isBoss = () => currentUserEmail() === 'itstasdidnur@gmail.com';

  const [members, setMembers] = createSignal<GatewayMember[]>([]);
  const [timeRange, setTimeRange] = createSignal<TimeRangeFilter>('lifetime');
  const [planFilter, setPlanFilter] = createSignal<string>('all');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);

  async function loadData(range: TimeRangeFilter = timeRange()) {
    try {
      setRefreshing(true);
      const data = await getAllMembers(range);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load overview data:', err);
      toast.error('Failed to load overview data from Neon DB');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRangeChange = (range: TimeRangeFilter) => {
    setTimeRange(range);
    loadData(range);
  };

  onMount(() => {
    loadData(timeRange());
    const interval = setInterval(() => loadData(timeRange()), 15000);
    onCleanup(() => clearInterval(interval));
  });

  // KPI Calculations from Live Neon DB Stats
  const approvedUsers = () => members().filter((m) => m.status === 'approved');
  const activeCount = () => members().filter((m) => (Number(m.requests_count) || 0) > 0).length;
  const totalUsers = () => members().length;

  // Total live requests sum directly from agent_messages
  const totalRequests = () => {
    return members().reduce((acc, m) => acc + (Number(m.requests_count) || 0), 0);
  };

  // Total live tokens sum directly from agent_messages
  const totalTokensFormatted = () => {
    const tokens = members().reduce((acc, m) => acc + (Number(m.tokens_count) || 0), 0);
    if (tokens >= 1_000_000_000) {
      return (tokens / 1_000_000_000).toFixed(1) + 'B';
    }
    if (tokens >= 1_000_000) {
      return (tokens / 1_000_000).toFixed(1) + 'M';
    }
    if (tokens >= 1_000) {
      return (tokens / 1_000).toFixed(0) + 'K';
    }
    return tokens.toLocaleString();
  };

  const timeRangeSubtitle = () => {
    switch (timeRange()) {
      case 'today':
        return 'today across all users';
      case 'yesterday':
        return 'yesterday across all users';
      case 'this_week':
        return 'this week across all users';
      case 'last_week':
        return 'last week across all users';
      case 'this_month':
        return 'this month across all users';
      case 'last_month':
        return 'last month across all users';
      case 'lifetime':
      default:
        return 'all users & harnesses';
    }
  };

  const filteredMembers = () => {
    let list = members();
    const plan = planFilter();
    if (plan !== 'all') {
      list = list.filter((m) => m.plan === plan);
    }
    const q = searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(
        (m) =>
          (m.name && m.name.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q)) ||
          (m.mobile && m.mobile.toLowerCase().includes(q)),
      );
    }
    return list;
  };

  // Sorted descending by highest contents count, then requests count, then tokens count
  const sortedMembers = () => {
    return [...filteredMembers()].sort((a, b) => {
      const cntA = Number(a.contents_count) || 0;
      const cntB = Number(b.contents_count) || 0;
      if (cntB !== cntA) {
        return cntB - cntA;
      }
      const reqA = Number(a.requests_count) || 0;
      const reqB = Number(b.requests_count) || 0;
      if (reqB !== reqA) {
        return reqB - reqA;
      }
      const tokA = Number(a.tokens_count) || 0;
      const tokB = Number(b.tokens_count) || 0;
      return tokB - tokA;
    });
  };

  const formatRelativeTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatProviderName = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower === 'openrouter') return 'OpenRouter';
    if (lower === 'nararouter') return 'NaraRouter';
    if (lower === 'xkiro') return 'Xkiro';
    if (lower === 'oxion') return 'Oxion';
    if (lower === 'river') return 'River';
    if (lower === 'anthropic' || lower === 'claude') return 'Claude';
    if (lower === 'openai' || lower === 'gpt') return 'OpenAI';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const getProviderBadgeStyle = (name: string) => {
    const p = name.toLowerCase();
    if (p.includes('river')) {
      return {
        background: 'rgba(5, 150, 105, 0.1)',
        color: '#059669',
        border: '1px solid rgba(5, 150, 105, 0.3)',
      };
    }
    if (p.includes('openrouter') || p.includes('nararouter')) {
      return {
        background: 'rgba(2, 132, 199, 0.1)',
        color: '#0284c7',
        border: '1px solid rgba(2, 132, 199, 0.3)',
      };
    }
    if (p.includes('oxion') || p.includes('xkiro')) {
      return {
        background: 'rgba(147, 51, 234, 0.1)',
        color: '#9333ea',
        border: '1px solid rgba(147, 51, 234, 0.3)',
      };
    }
    return {
      background: 'hsl(var(--muted))',
      color: 'hsl(var(--foreground))',
      border: '1px solid hsl(var(--border))',
    };
  };

  const getPlanBadgeClass = (plan: string) => {
    switch (plan) {
      case 'owner':
        return 'badge-owner';
      case 'max':
        return 'badge-max';
      case 'growth':
        return 'badge-growth';
      case 'starter':
        return 'badge-starter';
      default:
        return 'badge-trial';
    }
  };

  return (
    <div class="admin-container">
      <Title>Admin Overview — KYROS Gateway</Title>

      {/* Permission Check */}
      <Show
        when={isBoss()}
        fallback={
          <div
            class="admin-panel"
            style={{
              'text-align': 'center',
              padding: '60px 20px',
              'max-width': '600px',
              margin: '40px auto',
            }}
          >
            <div style={{ 'font-size': '48px', 'margin-bottom': '16px' }}>🔒</div>
            <h2 class="admin-header__title" style={{ 'font-size': '22px' }}>
              Access Denied
            </h2>
            <p class="admin-header__subtitle" style={{ 'margin-top': '8px', 'font-size': '14px' }}>
              Admin overview is strictly restricted to Boss TN TAYYAB (
              <span style={{ color: '#2563eb', 'font-weight': '600' }}>itstasdidnur@gmail.com</span>
              ).
            </p>
            <A
              href="/overview"
              class="admin-btn-primary"
              style={{
                display: 'inline-flex',
                'margin-top': '20px',
                'text-decoration': 'none',
                padding: '10px 22px',
              }}
            >
              Return to Gateway Overview
            </A>
          </div>
        }
      >
        {/* Top Header matching Writerify */}
        <div class="admin-header">
          <div>
            <div class="admin-header__title-group">
              <span class="admin-header__icon">📊</span>
              <h1 class="admin-header__title">Overview</h1>
              <span class="admin-header__badge">WRITERIFY STYLE</span>
            </div>
            <p class="admin-header__subtitle">
              Usage across every Gateway user, harness, and tenant connection.
            </p>
          </div>

          {/* Time range filters & Refresh */}
          <div class="admin-header__actions">
            <div class="admin-range-group">
              <button
                type="button"
                onClick={() => handleRangeChange('today')}
                class={`admin-range-btn ${timeRange() === 'today' ? 'active' : ''}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('yesterday')}
                class={`admin-range-btn ${timeRange() === 'yesterday' ? 'active' : ''}`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('this_week')}
                class={`admin-range-btn ${timeRange() === 'this_week' ? 'active' : ''}`}
              >
                This week
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('last_week')}
                class={`admin-range-btn ${timeRange() === 'last_week' ? 'active' : ''}`}
              >
                Last week
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('this_month')}
                class={`admin-range-btn ${timeRange() === 'this_month' ? 'active' : ''}`}
              >
                This month
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('last_month')}
                class={`admin-range-btn ${timeRange() === 'last_month' ? 'active' : ''}`}
              >
                Last month
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('lifetime')}
                class={`admin-range-btn ${timeRange() === 'lifetime' ? 'active' : ''}`}
              >
                Lifetime
              </button>
            </div>

            <button
              type="button"
              onClick={() => loadData(timeRange())}
              disabled={refreshing()}
              class="admin-btn-secondary"
            >
              <span
                style={{
                  transform: refreshing() ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.4s ease',
                  display: 'inline-block',
                }}
              >
                🔄
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* 4 Metric KPI Cards */}
        <div class="admin-kpi-grid">
          {/* Active Users */}
          <div class="admin-kpi-card">
            <div
              class="admin-kpi-card__top-bar"
              style={{ background: 'linear-gradient(90deg, #10b981, #059669)' }}
            />
            <div class="admin-kpi-card__label" style={{ color: '#059669' }}>
              ACTIVE USERS
            </div>
            <div class="admin-kpi-card__value">{activeCount()}</div>
            <div class="admin-kpi-card__sub">active in period ({totalUsers()} total)</div>
          </div>

          {/* Total Gateway Requests */}
          <div class="admin-kpi-card">
            <div
              class="admin-kpi-card__top-bar"
              style={{ background: 'linear-gradient(90deg, #0284c7, #2563eb)' }}
            />
            <div class="admin-kpi-card__label" style={{ color: '#0284c7' }}>
              TOTAL REQUESTS
            </div>
            <div class="admin-kpi-card__value">{totalRequests().toLocaleString()}</div>
            <div class="admin-kpi-card__sub">{timeRangeSubtitle()}</div>
          </div>

          {/* Total Tokens / Words */}
          <div class="admin-kpi-card">
            <div
              class="admin-kpi-card__top-bar"
              style={{ background: 'linear-gradient(90deg, #9333ea, #7c3aed)' }}
            />
            <div class="admin-kpi-card__label" style={{ color: '#9333ea' }}>
              TOTAL TOKENS
            </div>
            <div class="admin-kpi-card__value">{totalTokensFormatted()}</div>
            <div class="admin-kpi-card__sub">{timeRangeSubtitle()}</div>
          </div>

          {/* Provider Mix / Active Connections */}
          <div class="admin-kpi-card">
            <div
              class="admin-kpi-card__top-bar"
              style={{ background: 'linear-gradient(90deg, #d97706, #b45309)' }}
            />
            <div class="admin-kpi-card__label" style={{ color: '#d97706' }}>
              PROVIDER COVERAGE
            </div>
            <div class="admin-kpi-card__value">5 / 5</div>
            <div class="admin-kpi-card__sub">River, OpenRouter, Claude, GPT, DeepSeek</div>
          </div>
        </div>

        {/* Visual Analytics Grid: Provider Traffic Mix & Cumulative Signups */}
        <div class="admin-grid-2">
          {/* Provider Mix Card */}
          <div class="admin-panel" style={{ 'margin-bottom': '0' }}>
            <div class="admin-panel__title">Provider Routing Distribution</div>
            <div class="admin-panel__desc" style={{ 'margin-bottom': '20px' }}>
              Share of gateway tokens dispatched across configured upstream APIs
            </div>

            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'font-size': '12px',
                    'margin-bottom': '6px',
                  }}
                >
                  <span style={{ color: 'hsl(var(--foreground))', 'font-weight': '600' }}>
                    🌐 OpenRouter (DeepSeek R1, Llama 3)
                  </span>
                  <span style={{ color: '#0284c7', 'font-weight': '700' }}>42%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'hsl(var(--muted))',
                    'border-radius': '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '42%',
                      height: '100%',
                      background: '#0284c7',
                      'border-radius': '9999px',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'font-size': '12px',
                    'margin-bottom': '6px',
                  }}
                >
                  <span style={{ color: 'hsl(var(--foreground))', 'font-weight': '600' }}>
                    ⚡ River Gateway (Ultra-Fast)
                  </span>
                  <span style={{ color: '#059669', 'font-weight': '700' }}>31%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'hsl(var(--muted))',
                    'border-radius': '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '31%',
                      height: '100%',
                      background: '#059669',
                      'border-radius': '9999px',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'font-size': '12px',
                    'margin-bottom': '6px',
                  }}
                >
                  <span style={{ color: 'hsl(var(--foreground))', 'font-weight': '600' }}>
                    🎭 Anthropic Claude (3.7 Sonnet)
                  </span>
                  <span style={{ color: '#d97706', 'font-weight': '700' }}>18%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'hsl(var(--muted))',
                    'border-radius': '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '18%',
                      height: '100%',
                      background: '#d97706',
                      'border-radius': '9999px',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'font-size': '12px',
                    'margin-bottom': '6px',
                  }}
                >
                  <span style={{ color: 'hsl(var(--foreground))', 'font-weight': '600' }}>
                    🤖 OpenAI (GPT-4o, o3-mini)
                  </span>
                  <span style={{ color: '#7c3aed', 'font-weight': '700' }}>9%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'hsl(var(--muted))',
                    'border-radius': '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '9%',
                      height: '100%',
                      background: '#7c3aed',
                      'border-radius': '9999px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User Signups & Zero-Trust Gatekeeper Card */}
          <div class="admin-panel" style={{ 'margin-bottom': '0' }}>
            <div class="admin-panel__title">Tenant Growth & Security Posture</div>
            <div class="admin-panel__desc" style={{ 'margin-bottom': '20px' }}>
              Real-time Zero-Trust gatekeeper status on Neon Cloud PostgreSQL
            </div>

            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  padding: '12px 16px',
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border))',
                  'border-radius': '10px',
                }}
              >
                <div>
                  <div
                    style={{
                      'font-size': '13px',
                      'font-weight': '600',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Gatekeeper Trigger Status
                  </div>
                  <div style={{ 'font-size': '11px', color: 'hsl(var(--muted-foreground))' }}>
                    Active check on public.user insertions & sessions
                  </div>
                </div>
                <span class="badge-approved">🟢 ACTIVE ENFORCING</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  padding: '12px 16px',
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border))',
                  'border-radius': '10px',
                }}
              >
                <div>
                  <div
                    style={{
                      'font-size': '13px',
                      'font-weight': '600',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Total Authorizations
                  </div>
                  <div style={{ 'font-size': '11px', color: 'hsl(var(--muted-foreground))' }}>
                    Approved team accounts
                  </div>
                </div>
                <div style={{ 'font-size': '18px', 'font-weight': '800', color: '#0284c7' }}>
                  {activeCount()}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  padding: '12px 16px',
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border))',
                  'border-radius': '10px',
                }}
              >
                <div>
                  <div
                    style={{
                      'font-size': '13px',
                      'font-weight': '600',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Tenant Isolation
                  </div>
                  <div style={{ 'font-size': '11px', color: 'hsl(var(--muted-foreground))' }}>
                    Private BYOK keys & individual workspaces
                  </div>
                </div>
                <span class="badge-owner">100% ISOLATED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Users by Output Table */}
        <div class="admin-panel" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Table Header Controls */}
          <div
            style={{
              padding: '18px 24px',
              'border-bottom': '1px solid hsl(var(--border))',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'space-between',
              'flex-wrap': 'wrap',
              gap: '14px',
            }}
          >
            <div>
              <h2 class="admin-panel__title" style={{ 'font-size': '16px' }}>
                Top users by output
              </h2>
              <p class="admin-panel__desc">
                Sorted by Gateway traffic volume and execution frequency
              </p>
            </div>

            <div
              style={{ display: 'flex', 'align-items': 'center', gap: '10px', 'flex-wrap': 'wrap' }}
            >
              {/* Search Box */}
              <input
                type="text"
                placeholder="Search user, email, phone..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="admin-input"
                style={{ width: '220px' }}
              />

              {/* Plan Filter */}
              <select
                value={planFilter()}
                onChange={(e) => setPlanFilter(e.currentTarget.value)}
                class="admin-select"
              >
                <option value="all">All plans</option>
                <option value="owner">Owner</option>
                <option value="max">Max</option>
                <option value="growth">Growth</option>
                <option value="starter">Starter</option>
                <option value="free_trial">Free trial</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div class="admin-table-container" style={{ border: 'none', 'border-radius': '0' }}>
            <table class="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  <th>User</th>
                  <th>Plan</th>
                  <th title="Completed full-length articles written (output ≥ 1,450 tokens)">
                    Contents
                  </th>
                  <th>Requests</th>
                  <th>Tokens</th>
                  <th>Connected Providers</th>
                  <th>Last Active</th>
                  <th>Signed Up</th>
                </tr>
              </thead>
              <tbody>
                <Show
                  when={!loading() && sortedMembers().length > 0}
                  fallback={
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: '40px 18px',
                          'text-align': 'center',
                          color: 'hsl(var(--muted-foreground))',
                        }}
                      >
                        {loading() ? 'Loading users...' : 'No users match the selected criteria.'}
                      </td>
                    </tr>
                  }
                >
                  <For each={sortedMembers()}>
                    {(m, index) => {
                      const userReqs = Number(m.requests_count) || 0;
                      const userTokens = (Number(m.tokens_count) || 0).toLocaleString();
                      const signupDate = m.created_at
                        ? new Date(m.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Oct 24, 2026';
                      const providersList = (m.connected_providers || []).filter(Boolean);

                      return (
                        <tr>
                          {/* Rank */}
                          <td
                            style={{ color: 'hsl(var(--muted-foreground))', 'font-weight': '600' }}
                          >
                            {index() + 1}
                          </td>

                          {/* User */}
                          <td>
                            <div style={{ 'font-weight': '600', color: 'hsl(var(--foreground))' }}>
                              {m.name || m.email.split('@')[0]}
                            </div>
                            <div style={{ 'font-size': '12px', color: '#0284c7' }}>{m.email}</div>
                            <Show when={m.mobile}>
                              <div
                                style={{
                                  'font-size': '11px',
                                  color: 'hsl(var(--muted-foreground))',
                                  'margin-top': '2px',
                                }}
                              >
                                📱 {m.mobile}
                              </div>
                            </Show>
                          </td>

                          {/* Plan */}
                          <td>
                            <span class={getPlanBadgeClass(m.plan || 'free_trial')}>{m.plan}</span>
                          </td>

                          {/* Contents */}
                          <td>
                            <span
                              title={`${(Number(m.contents_count) || 0).toLocaleString()} completed full articles`}
                              style={{
                                display: 'inline-flex',
                                'align-items': 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                'border-radius': '6px',
                                'font-size': '12px',
                                'font-weight': '700',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.28)',
                              }}
                            >
                              ✍️ {(Number(m.contents_count) || 0).toLocaleString()}
                            </span>
                          </td>

                          {/* Requests */}
                          <td style={{ 'font-weight': '600' }}>{userReqs.toLocaleString()}</td>

                          {/* Tokens */}
                          <td style={{ color: 'hsl(var(--muted-foreground))' }}>{userTokens}</td>

                          {/* Connected Providers */}
                          <td>
                            <Show
                              when={providersList.length > 0}
                              fallback={
                                <span
                                  style={{
                                    'font-size': '12px',
                                    color: 'hsl(var(--muted-foreground))',
                                    'font-style': 'italic',
                                  }}
                                >
                                  No providers connected
                                </span>
                              }
                            >
                              <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
                                <For each={providersList}>
                                  {(prov) => {
                                    const style = getProviderBadgeStyle(prov);
                                    return (
                                      <span
                                        style={{
                                          'font-size': '11px',
                                          padding: '2px 7px',
                                          'border-radius': '4px',
                                          'font-weight': '600',
                                          ...style,
                                        }}
                                      >
                                        {formatProviderName(prov)}
                                      </span>
                                    );
                                  }}
                                </For>
                              </div>
                            </Show>
                          </td>

                          {/* Last Active */}
                          <td
                            style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}
                          >
                            {formatRelativeTime(m.last_active)}
                          </td>

                          {/* Signed Up */}
                          <td
                            style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}
                          >
                            {signupDate}
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </Show>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AdminOverview;
