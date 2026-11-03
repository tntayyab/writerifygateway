import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  Show,
  For,
  type Component,
} from 'solid-js';
import { Title } from '@solidjs/meta';
import { A } from '@solidjs/router';
import { authClient } from '../services/auth-client.js';
import { toast } from '../services/toast-store.js';
import {
  getAllMembers,
  updateMemberAsset,
  getAiAssetsMonitoringData,
  isUserAdminOrOwner,
  checkUserIsAdminAsync,
  type GatewayMember,
  type UserAssetItem,
  type TenantProviderItem,
  type AssetsMonitoringSummary,
} from '../services/admin-neon.js';
import '../styles/admin.css';

export const AdminAssets: Component = () => {
  const session = authClient.useSession();
  const currentUserEmail = () => session()?.data?.user?.email?.toLowerCase() ?? '';
  const [adminAllowed, setAdminAllowed] = createSignal(false);

  createEffect(() => {
    const email = currentUserEmail();
    if (!email) {
      setAdminAllowed(false);
      return;
    }
    if (isUserAdminOrOwner(email)) {
      setAdminAllowed(true);
      return;
    }
    void checkUserIsAdminAsync(email).then((res) => setAdminAllowed(res));
  });

  const isBoss = () => adminAllowed();

  // Active Tab: 'ai_assets' (User AI Model/Provider/Fallback Hub) or 'members' (AnyDesk/Work Assets)
  const [activeTab, setActiveTab] = createSignal<'ai_assets' | 'members'>('ai_assets');

  // AI Users & Assets State (Tab 1)
  const [aiUsers, setAiUsers] = createSignal<UserAssetItem[]>([]);
  const [aiProviders, setAiProviders] = createSignal<TenantProviderItem[]>([]);
  const [aiSummary, setAiSummary] = createSignal<AssetsMonitoringSummary | null>(null);
  const [pricingFilter, setPricingFilter] = createSignal<'all' | 'free' | 'paid'>('all');
  const [selectedUser, setSelectedUser] = createSignal<UserAssetItem | null>(null);

  // Members Assets State (Tab 2)
  const [members, setMembers] = createSignal<GatewayMember[]>([]);
  const [anydeskMap, setAnydeskMap] = createSignal<Record<string, string>>({});
  const [earningMap, setEarningMap] = createSignal<Record<string, boolean>>({});
  const [supportMap, setSupportMap] = createSignal<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = createSignal<string | null>(null);

  // General State
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');

  async function loadData() {
    try {
      setRefreshing(true);
      const [aiData, memberData] = await Promise.all([
        getAiAssetsMonitoringData(),
        getAllMembers(),
      ]);

      setAiUsers(aiData.users);
      setAiProviders(aiData.providers);
      setAiSummary(aiData.summary);

      // If user is currently selected in modal, keep their data updated
      if (selectedUser()) {
        const updated = aiData.users.find((u) => u.user_id === selectedUser()?.user_id);
        if (updated) setSelectedUser(updated);
      }

      setMembers(memberData);
      const anydesks: Record<string, string> = {};
      const earnings: Record<string, boolean> = {};
      const supports: Record<string, boolean> = {};
      for (const m of memberData) {
        anydesks[m.email] = m.anydesk_id ?? '';
        earnings[m.email] = !!m.is_earning;
        supports[m.email] = !!m.is_supported;
      }
      setAnydeskMap(anydesks);
      setEarningMap(earnings);
      setSupportMap(supports);
    } catch (err: any) {
      console.error('Failed to load assets data:', err);
      toast.error('Failed to load assets from Neon DB');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 15000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedUser()) {
        setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    onCleanup(() => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  // Filtered AI Users (Tab 1)
  const filteredAiUsers = () => {
    let list = aiUsers();
    const filter = pricingFilter();
    if (filter === 'free') {
      list = list.filter((u) => u.primary_harness?.primary_tier?.is_primary_free);
    } else if (filter === 'paid') {
      list = list.filter(
        (u) => u.primary_harness?.primary_tier && !u.primary_harness.primary_tier.is_primary_free,
      );
    }

    const q = searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter((u) => {
        const matchesName =
          (u.user_name || '').toLowerCase().includes(q) ||
          (u.display_name || '').toLowerCase().includes(q);
        const matchesEmail = (u.user_email || '').toLowerCase().includes(q);
        const matchesHarness = u.harnesses.some((h) => h.agent_name.toLowerCase().includes(q));
        const matchesModel = (u.primary_harness?.primary_tier?.clean_primary_model || '')
          .toLowerCase()
          .includes(q);
        const matchesProvider = u.connected_providers.some((p) =>
          p.clean_provider.toLowerCase().includes(q),
        );
        const matchesFallback = u.primary_harness?.primary_tier?.fallbacks.some(
          (f) =>
            f.clean_model.toLowerCase().includes(q) || f.clean_provider.toLowerCase().includes(q),
        );
        return (
          matchesName ||
          matchesEmail ||
          matchesHarness ||
          matchesModel ||
          matchesProvider ||
          matchesFallback
        );
      });
    }
    return list;
  };

  // Filtered Members (Tab 2)
  const paidMembers = () => members().filter((m) => m.status === 'approved');
  const filteredMembers = () => {
    let list = paidMembers().length > 0 ? paidMembers() : members();
    const q = searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(
        (m) =>
          (m.name && m.name.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q)) ||
          (m.mobile && m.mobile.toLowerCase().includes(q)) ||
          (anydeskMap()[m.email] && anydeskMap()[m.email].toLowerCase().includes(q)),
      );
    }
    return list;
  };

  async function handleToggleEarning(m: GatewayMember) {
    const current = !!earningMap()[m.email];
    const next = !current;
    setEarningMap((prev) => ({ ...prev, [m.email]: next }));
    try {
      setSavingKey(`${m.email}-earning`);
      await updateMemberAsset(
        m.email,
        anydeskMap()[m.email] ?? m.anydesk_id,
        next,
        !!supportMap()[m.email],
      );
      toast.success(`${m.name || m.email} earning status set to ${next ? 'YES' : 'NO'}`);
    } catch (err: any) {
      setEarningMap((prev) => ({ ...prev, [m.email]: current }));
      toast.error(err.message || 'Failed to update earning status');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleToggleSupport(m: GatewayMember) {
    const current = !!supportMap()[m.email];
    const next = !current;
    setSupportMap((prev) => ({ ...prev, [m.email]: next }));
    try {
      setSavingKey(`${m.email}-support`);
      await updateMemberAsset(
        m.email,
        anydeskMap()[m.email] ?? m.anydesk_id,
        !!earningMap()[m.email],
        next,
      );
      toast.success(`${m.name || m.email} support status set to ${next ? 'YES' : 'NO'}`);
    } catch (err: any) {
      setSupportMap((prev) => ({ ...prev, [m.email]: current }));
      toast.error(err.message || 'Failed to update support');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleAnydeskBlur(m: GatewayMember) {
    const val = anydeskMap()[m.email];
    if (val === m.anydesk_id) return;
    try {
      setSavingKey(`${m.email}-anydesk`);
      await updateMemberAsset(m.email, val, !!earningMap()[m.email], !!supportMap()[m.email]);
      toast.success(`AnyDesk ID saved for ${m.name || m.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save AnyDesk ID');
    } finally {
      setSavingKey(null);
    }
  }

  function formatTokens(count: number) {
    if (!count) return '0';
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
    return count.toLocaleString();
  }

  function formatRelativeTime(dateStr?: string | null) {
    if (!dateStr) return 'Never';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  }

  return (
    <div class="admin-container">
      <Title>Assets & Model Hub — KYROS Gateway</Title>

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
              Assets view is strictly restricted to Boss TN TAYYAB and Authorized Owners.
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
        {/* Top Header */}
        <div class="admin-header">
          <div>
            <div class="admin-header__title-group">
              <span class="admin-header__icon">💼</span>
              <h1 class="admin-header__title">Assets & Model Intelligence</h1>
              <span class="admin-header__badge">LIVE MONITORING</span>
            </div>
            <p class="admin-header__subtitle">
              Monitor active AI models, connected providers, Free vs Paid routing, armed fallback
              chains, and member assets.
            </p>
          </div>

          <div class="admin-header__actions">
            <button
              type="button"
              onClick={loadData}
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
              Refresh Live
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div class="admin-nav-tabs">
          <button
            type="button"
            class={`admin-nav-tab ${activeTab() === 'ai_assets' ? 'admin-nav-tab--active' : ''}`}
            onClick={() => setActiveTab('ai_assets')}
          >
            <span>🤖</span> AI Models, Providers & Fallbacks ({aiUsers().length})
          </button>
          <button
            type="button"
            class={`admin-nav-tab ${activeTab() === 'members' ? 'admin-nav-tab--active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <span>💼</span> Paid Users & Remote AnyDesk ({paidMembers().length})
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: AI MODELS, PROVIDERS & FALLBACK CHAINS (MONITORING) */}
        {/* ======================================================== */}
        <Show when={activeTab() === 'ai_assets'}>
          {/* Top 4 KPI Metric Cards */}
          <div class="admin-grid-4" style="margin-bottom: 24px;">
            {/* KPI 1: Connected Providers */}
            <div class="admin-stat-card">
              <div class="admin-stat-card__header">
                <span class="admin-stat-card__title">Connected Providers</span>
                <span style={{ 'font-size': '18px' }}>🔌</span>
              </div>
              <div class="admin-stat-card__value" style="color: #2563eb;">
                {aiSummary()?.total_providers ?? 0} Active
              </div>
              <div class="admin-stat-card__change">
                <span style={{ color: '#10b981', 'font-weight': '700' }}>
                  🟢 {aiSummary()?.free_providers_count ?? 0} Free
                </span>
                {' • '}
                <span style={{ color: '#f59e0b', 'font-weight': '700' }}>
                  💎 {aiSummary()?.paid_providers_count ?? 0} Paid
                </span>
              </div>
            </div>

            {/* KPI 2: Primary Routing Model */}
            <div class="admin-stat-card">
              <div class="admin-stat-card__header">
                <span class="admin-stat-card__title">Primary Routing Model</span>
                <span style={{ 'font-size': '18px' }}>🎯</span>
              </div>
              <div class="admin-stat-card__value" style="font-size: 18px; color: #8b5cf6;">
                {aiUsers()[0]?.primary_harness?.primary_tier?.clean_primary_model ||
                  'DeepSeek-V4.1-Flash'}
              </div>
              <div
                class="admin-stat-card__change"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Provider:{' '}
                <span style={{ color: 'hsl(var(--foreground))', 'font-weight': '600' }}>
                  {aiUsers()[0]?.primary_harness?.primary_tier?.clean_primary_provider ||
                    'Custom Gateway'}
                </span>
              </div>
            </div>

            {/* KPI 3: Armed Fallbacks */}
            <div class="admin-stat-card">
              <div class="admin-stat-card__header">
                <span class="admin-stat-card__title">Armed Fallbacks</span>
                <span style={{ 'font-size': '18px' }}>🛡️</span>
              </div>
              <div class="admin-stat-card__value" style="color: #10b981;">
                {aiSummary()?.total_fallback_models ?? 0} Models
              </div>
              <div class="admin-stat-card__change" style={{ color: '#10b981' }}>
                ✓ 100% Failover Safety Active
              </div>
            </div>

            {/* KPI 4: Total Traffic Monitored */}
            <div class="admin-stat-card">
              <div class="admin-stat-card__header">
                <span class="admin-stat-card__title">Total Traffic Monitored</span>
                <span style={{ 'font-size': '18px' }}>⚡</span>
              </div>
              <div class="admin-stat-card__value" style="color: #0284c7;">
                {formatTokens(aiSummary()?.total_tokens_consumed ?? 0)} Tokens
              </div>
              <div
                class="admin-stat-card__change"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Cost:{' '}
                <span style={{ color: '#10b981', 'font-weight': '700' }}>
                  ${(aiSummary()?.total_cost_usd ?? 0).toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* AI User & Asset Matrix Table Panel */}
          <div class="admin-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                'border-bottom': '1px solid hsl(var(--border))',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'space-between',
                'flex-wrap': 'wrap',
                gap: '12px',
                background: 'hsl(var(--muted) / 0.25)',
              }}
            >
              <div>
                <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <h3
                    style={{
                      'font-size': '15px',
                      'font-weight': '700',
                      margin: '0',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    LIVE USER & AI ASSET MATRIX
                  </h3>
                  <span
                    style={{
                      'font-size': '11px',
                      padding: '2px 8px',
                      'border-radius': '9999px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#2563eb',
                      'font-weight': '600',
                    }}
                  >
                    1 User per Account
                  </span>
                </div>
                <p
                  style={{
                    'font-size': '12px',
                    color: 'hsl(var(--muted-foreground))',
                    margin: '3px 0 0 0',
                  }}
                >
                  Click on any user name to open their full deep intelligence drawer (profile,
                  credentials, harnesses & fallbacks).
                </p>
              </div>

              {/* Filters & Search */}
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '10px',
                  'flex-wrap': 'wrap',
                }}
              >
                <div class="admin-range-group">
                  <button
                    type="button"
                    class={`admin-range-btn ${pricingFilter() === 'all' ? 'active' : ''}`}
                    onClick={() => setPricingFilter('all')}
                  >
                    All Users
                  </button>
                  <button
                    type="button"
                    class={`admin-range-btn ${pricingFilter() === 'free' ? 'active' : ''}`}
                    onClick={() => setPricingFilter('free')}
                  >
                    🟢 Free Only
                  </button>
                  <button
                    type="button"
                    class={`admin-range-btn ${pricingFilter() === 'paid' ? 'active' : ''}`}
                    onClick={() => setPricingFilter('paid')}
                  >
                    💎 Paid Only
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Search user, model, provider..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="admin-input"
                  style={{ width: '220px' }}
                />
              </div>
            </div>

            {/* Table */}
            <div class="admin-table-container" style={{ border: 'none', 'border-radius': '0' }}>
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>User & Harnesses</th>
                    <th>Active Primary Model</th>
                    <th>Connected Providers</th>
                    <th>Armed Fallback Routing Chain</th>
                    <th>Traffic / Cost</th>
                    <th>Activity</th>
                  </tr>
                </thead>
                <tbody>
                  <Show
                    when={!loading() && filteredAiUsers().length > 0}
                    fallback={
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: '40px 18px',
                            'text-align': 'center',
                            color: 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {loading()
                            ? 'Loading AI asset matrix from Neon DB...'
                            : 'No users found matching filter.'}
                        </td>
                      </tr>
                    }
                  >
                    <For each={filteredAiUsers()}>
                      {(user) => {
                        const pt = () => user.primary_harness?.primary_tier;
                        const fallbacks = () => pt()?.fallbacks || [];

                        return (
                          <tr>
                            {/* User & Harnesses */}
                            <td>
                              <div
                                style={{
                                  display: 'flex',
                                  'align-items': 'flex-start',
                                  gap: '10px',
                                }}
                              >
                                <Show
                                  when={user.avatar_url}
                                  fallback={
                                    <div
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        'border-radius': '50%',
                                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                        color: '#fff',
                                        display: 'flex',
                                        'align-items': 'center',
                                        'justify-content': 'center',
                                        'font-weight': '700',
                                        'font-size': '14px',
                                        'flex-shrink': '0',
                                        'margin-top': '2px',
                                      }}
                                    >
                                      {user.user_name.charAt(0)}
                                    </div>
                                  }
                                >
                                  <img
                                    src={user.avatar_url!}
                                    alt={user.user_name}
                                    style={{
                                      width: '36px',
                                      height: '36px',
                                      'border-radius': '50%',
                                      'object-fit': 'cover',
                                      'flex-shrink': '0',
                                      'margin-top': '2px',
                                      border: '1.5px solid hsl(var(--border))',
                                    }}
                                  />
                                </Show>

                                <div>
                                  {/* Clickable User Name */}
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedUser(user)}
                                      class="user-name-click-btn"
                                      title="Click to view all user details, credentials & fallbacks"
                                    >
                                      <span>{user.display_name || user.user_name}</span>
                                      <span class="view-details-pill">Details ↗</span>
                                    </button>
                                  </div>

                                  <div
                                    style={{
                                      'font-size': '11px',
                                      color: 'hsl(var(--muted-foreground))',
                                      'margin-top': '2px',
                                    }}
                                  >
                                    {user.user_email}
                                  </div>

                                  {/* Harnesses List Badge */}
                                  <div class="badge-harnesses">
                                    <span>⚡</span>
                                    <span style={{ 'font-weight': '700', color: '#0284c7' }}>
                                      {user.harnesses.length} Harness
                                      {user.harnesses.length > 1 ? 'es' : ''}:
                                    </span>
                                    <span style={{ 'font-family': 'monospace' }}>
                                      {user.harnesses
                                        .map(
                                          (h) =>
                                            `@${h.agent_name}${h.agent_platform ? ` (${h.agent_platform})` : ''}`,
                                        )
                                        .join(', ')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Active Primary Model */}
                            <td>
                              <div>
                                <div
                                  style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}
                                >
                                  <span
                                    style={{
                                      'font-weight': '700',
                                      'font-size': '13px',
                                      color: 'hsl(var(--foreground))',
                                    }}
                                  >
                                    {pt()?.clean_primary_model || 'Auto-Routing'}
                                  </span>
                                  <Show
                                    when={pt()?.is_primary_free}
                                    fallback={<span class="badge-paid">💎 PAID</span>}
                                  >
                                    <span class="badge-free">🟢 FREE</span>
                                  </Show>
                                </div>
                                <div
                                  style={{
                                    'font-size': '11px',
                                    color: 'hsl(var(--muted-foreground))',
                                    'margin-top': '2px',
                                  }}
                                >
                                  Provider:{' '}
                                  <span style={{ 'font-weight': '600' }}>
                                    {pt()?.clean_primary_provider || 'Default'}
                                  </span>
                                  <Show when={user.primary_harness}>
                                    <span
                                      style={{
                                        'font-size': '10px',
                                        color: '#0284c7',
                                        'margin-left': '4px',
                                      }}
                                    >
                                      (@{user.primary_harness?.agent_name})
                                    </span>
                                  </Show>
                                </div>
                              </div>
                            </td>

                            {/* Connected Providers */}
                            <td>
                              <div
                                style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}
                              >
                                <div
                                  style={{
                                    'font-size': '11px',
                                    'font-weight': '700',
                                    color: 'hsl(var(--muted-foreground))',
                                  }}
                                >
                                  {user.connected_providers.length} PROVIDER(S):
                                </div>
                                <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '4px' }}>
                                  <For each={user.connected_providers}>
                                    {(p) => (
                                      <div class="provider-pill">
                                        <Show
                                          when={p.is_free}
                                          fallback={
                                            <span
                                              class="badge-paid"
                                              style={{ 'font-size': '9px', padding: '1px 4px' }}
                                            >
                                              💎
                                            </span>
                                          }
                                        >
                                          <span
                                            class="badge-free"
                                            style={{ 'font-size': '9px', padding: '1px 4px' }}
                                          >
                                            🟢
                                          </span>
                                        </Show>
                                        <span>{p.clean_provider}</span>
                                        <Show when={p.key_prefix}>
                                          <span
                                            style={{
                                              'font-size': '10px',
                                              color: 'hsl(var(--muted-foreground))',
                                            }}
                                          >
                                            ({p.key_prefix})
                                          </span>
                                        </Show>
                                      </div>
                                    )}
                                  </For>
                                </div>
                              </div>
                            </td>

                            {/* Armed Fallback Routing Chain */}
                            <td>
                              <Show
                                when={fallbacks().length > 0}
                                fallback={
                                  <div
                                    style={{
                                      'font-size': '12px',
                                      color: 'hsl(var(--muted-foreground))',
                                      'font-style': 'italic',
                                    }}
                                  >
                                    No fallback models configured
                                  </div>
                                }
                              >
                                <div>
                                  <div
                                    style={{
                                      'font-size': '10px',
                                      'font-weight': '700',
                                      color: 'hsl(var(--muted-foreground))',
                                      'letter-spacing': '0.04em',
                                    }}
                                  >
                                    🛡️ {fallbacks().length} FAILOVER STEPS:
                                  </div>
                                  <div class="fallback-chain">
                                    <For each={fallbacks()}>
                                      {(fb, idx) => (
                                        <>
                                          <div class="fallback-step-chip">
                                            <span
                                              style={{ 'font-weight': '700', color: '#0284c7' }}
                                            >
                                              #{fb.rank}
                                            </span>
                                            <span>{fb.clean_model}</span>
                                            <Show
                                              when={fb.is_free}
                                              fallback={
                                                <span
                                                  class="badge-paid"
                                                  style={{ 'font-size': '9px', padding: '1px 4px' }}
                                                >
                                                  PAID
                                                </span>
                                              }
                                            >
                                              <span
                                                class="badge-free"
                                                style={{ 'font-size': '9px', padding: '1px 4px' }}
                                              >
                                                FREE
                                              </span>
                                            </Show>
                                          </div>
                                          <Show when={idx() < fallbacks().length - 1}>
                                            <span class="fallback-arrow">➔</span>
                                          </Show>
                                        </>
                                      )}
                                    </For>
                                  </div>
                                </div>
                              </Show>
                            </td>

                            {/* Traffic / Cost */}
                            <td>
                              <div>
                                <div
                                  style={{
                                    'font-weight': '700',
                                    'font-size': '13px',
                                    color: 'hsl(var(--foreground))',
                                  }}
                                >
                                  {formatTokens(user.total_tokens)} tokens
                                </div>
                                <div
                                  style={{
                                    'font-size': '11px',
                                    color: '#10b981',
                                    'font-weight': '600',
                                  }}
                                >
                                  ${user.total_cost.toFixed(3)} USD
                                </div>
                                <div
                                  style={{
                                    'font-size': '10px',
                                    color: 'hsl(var(--muted-foreground))',
                                  }}
                                >
                                  {user.total_messages.toLocaleString()} requests
                                </div>
                              </div>
                            </td>

                            {/* Activity */}
                            <td>
                              <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    'border-radius': '50%',
                                    background: '#10b981',
                                    display: 'inline-block',
                                    'box-shadow': '0 0 6px rgba(16, 185, 129, 0.6)',
                                  }}
                                />
                                <span style={{ 'font-size': '12px', 'font-weight': '600' }}>
                                  Active
                                </span>
                              </div>
                              <div
                                style={{
                                  'font-size': '10px',
                                  color: 'hsl(var(--muted-foreground))',
                                  'margin-top': '2px',
                                }}
                              >
                                {formatRelativeTime(user.last_active)}
                              </div>
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

        {/* ======================================================== */}
        {/* TAB 2: MEMBERS ANYDESK & WORK ASSETS (PRESERVED)           */}
        {/* ======================================================== */}
        <Show when={activeTab() === 'members'}>
          <div class="admin-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                'border-bottom': '1px solid hsl(var(--border))',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'space-between',
                'flex-wrap': 'wrap',
                gap: '12px',
                background: 'hsl(var(--muted) / 0.25)',
              }}
            >
              <div>
                <h3
                  style={{
                    'font-size': '15px',
                    'font-weight': '700',
                    margin: '0',
                    color: 'hsl(var(--foreground))',
                  }}
                >
                  PAID USERS & REMOTE ANYDESK DIRECTORY
                </h3>
                <p
                  style={{
                    'font-size': '12px',
                    color: 'hsl(var(--muted-foreground))',
                    margin: '3px 0 0 0',
                  }}
                >
                  Manage client AnyDesk remote access, WhatsApp channels, earning online status, and
                  priority support.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search member, AnyDesk, mobile..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="admin-input"
                style={{ width: '260px' }}
              />
            </div>

            <div class="admin-table-container" style={{ border: 'none', 'border-radius': '0' }}>
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Mobile</th>
                    <th>AnyDesk ID</th>
                    <th>Earning</th>
                    <th>Support</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  <Show
                    when={!loading() && filteredMembers().length > 0}
                    fallback={
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: '40px 18px',
                            'text-align': 'center',
                            color: 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {loading()
                            ? 'Loading member assets...'
                            : 'No members found matching filter.'}
                        </td>
                      </tr>
                    }
                  >
                    <For each={filteredMembers()}>
                      {(member) => (
                        <tr>
                          <td>
                            <div style={{ 'font-weight': '600', color: 'hsl(var(--foreground))' }}>
                              {member.name || 'Anonymous User'}
                            </div>
                            <div
                              style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}
                            >
                              {member.email}
                            </div>
                          </td>

                          <td>
                            <Show
                              when={member.mobile}
                              fallback={
                                <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>
                              }
                            >
                              <a
                                href={`https://wa.me/${member.mobile?.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: '#2563eb',
                                  'text-decoration': 'none',
                                  display: 'inline-flex',
                                  'align-items': 'center',
                                  gap: '4px',
                                  'font-size': '12px',
                                  'font-weight': '500',
                                }}
                              >
                                <span>📱</span>
                                {member.mobile}
                              </a>
                            </Show>
                          </td>

                          <td>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                              <input
                                type="text"
                                placeholder="e.g. 1 234 567 890"
                                value={anydeskMap()[member.email] ?? ''}
                                onInput={(e) =>
                                  setAnydeskMap((prev) => ({
                                    ...prev,
                                    [member.email]: e.currentTarget.value,
                                  }))
                                }
                                onBlur={() => handleAnydeskBlur(member)}
                                class="admin-input"
                                style={{
                                  width: '160px',
                                  padding: '4px 8px',
                                  'font-size': '12px',
                                  'font-family': 'monospace',
                                }}
                              />
                              <Show when={savingKey() === `${member.email}-anydesk`}>
                                <span style={{ 'font-size': '11px', color: '#2563eb' }}>💾</span>
                              </Show>
                            </div>
                          </td>

                          <td>
                            <button
                              type="button"
                              onClick={() => handleToggleEarning(member)}
                              disabled={savingKey() === `${member.email}-earning`}
                              style={{
                                background: earningMap()[member.email]
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : 'hsl(var(--muted))',
                                color: earningMap()[member.email]
                                  ? '#059669'
                                  : 'hsl(var(--muted-foreground))',
                                border: earningMap()[member.email]
                                  ? '1px solid rgba(16, 185, 129, 0.3)'
                                  : '1px solid hsl(var(--border))',
                                padding: '4px 10px',
                                'border-radius': '9999px',
                                'font-size': '11px',
                                'font-weight': '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {earningMap()[member.email] ? '✓ YES' : 'NO'}
                            </button>
                          </td>

                          <td>
                            <button
                              type="button"
                              onClick={() => handleToggleSupport(member)}
                              disabled={savingKey() === `${member.email}-support`}
                              style={{
                                background: supportMap()[member.email]
                                  ? 'rgba(37, 99, 235, 0.12)'
                                  : 'hsl(var(--muted))',
                                color: supportMap()[member.email]
                                  ? '#2563eb'
                                  : 'hsl(var(--muted-foreground))',
                                border: supportMap()[member.email]
                                  ? '1px solid rgba(37, 99, 235, 0.3)'
                                  : '1px solid hsl(var(--border))',
                                padding: '4px 10px',
                                'border-radius': '9999px',
                                'font-size': '11px',
                                'font-weight': '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {supportMap()[member.email] ? '✓ ACTIVE' : 'NONE'}
                            </button>
                          </td>

                          <td
                            style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}
                          >
                            {member.created_at
                              ? new Date(member.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      )}
                    </For>
                  </Show>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* ======================================================== */}
        {/* USER DEEP INTELLIGENCE MODAL (CLICK ON USER NAME)        */}
        {/* ======================================================== */}
        <Show when={selectedUser()}>
          {(user) => (
            <div class="user-details-modal-overlay" onClick={() => setSelectedUser(null)}>
              <div class="user-details-modal" onClick={(e) => e.stopPropagation()}>
                {/* Banner Header */}
                <div
                  class="modal-banner"
                  style={{
                    'background-image': user().banner_url
                      ? `url("${user().banner_url}")`
                      : 'linear-gradient(135deg, #1e293b, #0f172a)',
                  }}
                >
                  <div class="modal-banner-gradient" />
                  <button
                    type="button"
                    class="modal-close-btn"
                    onClick={() => setSelectedUser(null)}
                    title="Close (Esc)"
                  >
                    ✕
                  </button>
                </div>

                {/* Profile Header */}
                <div class="modal-header-body">
                  <div class="modal-avatar-wrapper">
                    <Show
                      when={user().avatar_url}
                      fallback={<div class="modal-avatar">{user().user_name.charAt(0)}</div>}
                    >
                      <img src={user().avatar_url!} alt={user().user_name} class="modal-avatar" />
                    </Show>
                    <span class="modal-avatar-status" title="Active Account" />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'space-between',
                      'flex-wrap': 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <h2
                          style={{
                            'font-size': '22px',
                            'font-weight': '800',
                            margin: '0',
                            color: 'hsl(var(--foreground))',
                          }}
                        >
                          {user().display_name || user().user_name}
                        </h2>
                        <span
                          class="badge-paid"
                          style={{ 'font-size': '12px', padding: '3px 9px' }}
                        >
                          👑{' '}
                          {user().member_role === 'superadmin' || user().plan === 'owner'
                            ? 'Super Admin / Owner'
                            : 'Verified Member'}
                        </span>
                      </div>
                      <div
                        style={{
                          'font-size': '13px',
                          color: 'hsl(var(--muted-foreground))',
                          'margin-top': '4px',
                        }}
                      >
                        {user().user_email} • Joined{' '}
                        {new Date(user().user_created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <A
                        href="/account"
                        class="admin-btn-secondary"
                        style={{ 'font-size': '12px', padding: '6px 12px' }}
                      >
                        ⚙️ Edit Profile in Account
                      </A>
                    </div>
                  </div>

                  {/* Headline & Bio */}
                  <Show when={user().headline}>
                    <div
                      style={{
                        'font-size': '14px',
                        'font-weight': '600',
                        color: '#0284c7',
                        'margin-top': '10px',
                      }}
                    >
                      {user().headline}
                    </div>
                  </Show>
                  <Show when={user().bio}>
                    <p
                      style={{
                        'font-size': '13px',
                        color: 'hsl(var(--muted-foreground))',
                        'margin-top': '6px',
                        'line-height': '1.5',
                      }}
                    >
                      {user().bio}
                    </p>
                  </Show>

                  {/* Location & Website */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '14px',
                      'margin-top': '10px',
                      'font-size': '12px',
                      color: 'hsl(var(--muted-foreground))',
                      'flex-wrap': 'wrap',
                    }}
                  >
                    <Show when={user().location}>
                      <span>📍 {user().location}</span>
                    </Show>
                    <Show when={user().website}>
                      <span>
                        🌐{' '}
                        <a
                          href={user().website!}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563eb' }}
                        >
                          {user().website}
                        </a>
                      </span>
                    </Show>
                  </div>
                </div>

                {/* Lifetime Metrics Strip */}
                <div style={{ padding: '0 24px 18px 24px' }}>
                  <div class="admin-grid-4" style={{ margin: '0' }}>
                    <div class="admin-stat-card" style={{ padding: '12px 14px' }}>
                      <div class="admin-stat-card__title" style={{ 'font-size': '11px' }}>
                        Total Tokens
                      </div>
                      <div
                        class="admin-stat-card__value"
                        style={{ 'font-size': '18px', color: '#8b5cf6' }}
                      >
                        {formatTokens(user().total_tokens)}
                      </div>
                    </div>
                    <div class="admin-stat-card" style={{ padding: '12px 14px' }}>
                      <div class="admin-stat-card__title" style={{ 'font-size': '11px' }}>
                        Total Cost
                      </div>
                      <div
                        class="admin-stat-card__value"
                        style={{ 'font-size': '18px', color: '#10b981' }}
                      >
                        ${user().total_cost.toFixed(2)} USD
                      </div>
                    </div>
                    <div class="admin-stat-card" style={{ padding: '12px 14px' }}>
                      <div class="admin-stat-card__title" style={{ 'font-size': '11px' }}>
                        Total Requests
                      </div>
                      <div
                        class="admin-stat-card__value"
                        style={{ 'font-size': '18px', color: '#0284c7' }}
                      >
                        {user().total_messages.toLocaleString()}
                      </div>
                    </div>
                    <div class="admin-stat-card" style={{ padding: '12px 14px' }}>
                      <div class="admin-stat-card__title" style={{ 'font-size': '11px' }}>
                        Harness Swarm
                      </div>
                      <div
                        class="admin-stat-card__value"
                        style={{ 'font-size': '18px', color: '#f59e0b' }}
                      >
                        {user().harnesses.length} Active
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 1: Remote AnyDesk & Support */}
                <div class="modal-section">
                  <div class="modal-section-title">
                    <span>💼</span> Remote Access & Support Configuration
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      'grid-template-columns': 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        background: 'hsl(var(--muted) / 0.5)',
                        padding: '10px 14px',
                        'border-radius': '8px',
                        border: '1px solid hsl(var(--border))',
                      }}
                    >
                      <div
                        style={{
                          'font-size': '11px',
                          color: 'hsl(var(--muted-foreground))',
                          'margin-bottom': '4px',
                        }}
                      >
                        AnyDesk ID
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          'justify-content': 'space-between',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            'font-weight': '700',
                            'font-family': 'monospace',
                            'font-size': '13px',
                          }}
                        >
                          {user().anydesk_id || 'Not configured'}
                        </span>
                        <Show when={user().anydesk_id}>
                          <button
                            type="button"
                            class="admin-btn-secondary"
                            style={{ padding: '2px 8px', 'font-size': '11px' }}
                            onClick={() => {
                              navigator.clipboard.writeText(user().anydesk_id!);
                              toast.success('AnyDesk ID copied to clipboard');
                            }}
                          >
                            Copy
                          </button>
                        </Show>
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'hsl(var(--muted) / 0.5)',
                        padding: '10px 14px',
                        'border-radius': '8px',
                        border: '1px solid hsl(var(--border))',
                      }}
                    >
                      <div
                        style={{
                          'font-size': '11px',
                          color: 'hsl(var(--muted-foreground))',
                          'margin-bottom': '4px',
                        }}
                      >
                        WhatsApp / Mobile
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          'justify-content': 'space-between',
                          gap: '8px',
                        }}
                      >
                        <span style={{ 'font-weight': '700', 'font-size': '13px' }}>
                          {user().mobile || 'Not configured'}
                        </span>
                        <Show when={user().mobile}>
                          <a
                            href={`https://wa.me/${user().mobile!.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            class="admin-btn-secondary"
                            style={{ padding: '2px 8px', 'font-size': '11px', color: '#10b981' }}
                          >
                            WhatsApp ↗
                          </a>
                        </Show>
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'hsl(var(--muted) / 0.5)',
                        padding: '10px 14px',
                        'border-radius': '8px',
                        border: '1px solid hsl(var(--border))',
                      }}
                    >
                      <div
                        style={{
                          'font-size': '11px',
                          color: 'hsl(var(--muted-foreground))',
                          'margin-bottom': '4px',
                        }}
                      >
                        Support Coverage
                      </div>
                      <div>
                        <span
                          style={{
                            'font-weight': '700',
                            color: user().is_supported ? '#10b981' : 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {user().is_supported
                            ? '✓ 24/7 Priority Support Active'
                            : 'Standard Community'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Connected Providers */}
                <div class="modal-section">
                  <div class="modal-section-title">
                    <span>🔌</span> Connected AI Providers ({user().connected_providers.length})
                  </div>
                  <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '8px' }}>
                    <For each={user().connected_providers}>
                      {(p) => (
                        <div
                          class="provider-pill"
                          style={{ padding: '6px 12px', 'border-radius': '8px' }}
                        >
                          <Show when={p.is_free} fallback={<span class="badge-paid">💎 PAID</span>}>
                            <span class="badge-free">🟢 FREE</span>
                          </Show>
                          <span style={{ 'font-weight': '700', color: 'hsl(var(--foreground))' }}>
                            {p.clean_provider}
                          </span>
                          <Show when={p.key_prefix}>
                            <span
                              style={{
                                'font-size': '10px',
                                color: 'hsl(var(--muted-foreground))',
                                'font-family': 'monospace',
                              }}
                            >
                              ({p.key_prefix})
                            </span>
                          </Show>
                          <span
                            style={{ 'font-size': '10px', color: '#10b981', 'margin-left': '4px' }}
                          >
                            ● Verified
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                {/* Section 3: User Harnesses & Fallback Chains */}
                <div class="modal-section">
                  <div class="modal-section-title">
                    <span>🤖</span> Configured Agent Harnesses & Failover Chains (
                    {user().harnesses.length})
                  </div>
                  <For each={user().harnesses}>
                    {(harness) => {
                      const pt = () => harness.primary_tier;
                      const fallbacks = () => pt()?.fallbacks || [];

                      return (
                        <div class="modal-harness-card">
                          <div
                            style={{
                              display: 'flex',
                              'align-items': 'center',
                              'justify-content': 'space-between',
                              'margin-bottom': '8px',
                              'flex-wrap': 'wrap',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                              <span
                                style={{
                                  'font-weight': '800',
                                  'font-size': '14px',
                                  color: 'hsl(var(--foreground))',
                                }}
                              >
                                @{harness.agent_name}
                              </span>
                              <span
                                style={{
                                  'font-size': '11px',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  color: '#2563eb',
                                  padding: '1px 6px',
                                  'border-radius': '4px',
                                  'font-weight': '600',
                                }}
                              >
                                {harness.agent_platform || 'gateway harness'}
                              </span>
                            </div>
                            <div
                              style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}
                            >
                              {formatTokens(harness.total_tokens)} tokens • $
                              {harness.total_cost.toFixed(3)} USD •{' '}
                              {harness.total_messages.toLocaleString()} reqs
                            </div>
                          </div>

                          {/* Primary Model */}
                          <div
                            style={{
                              'margin-bottom': '10px',
                              display: 'flex',
                              'align-items': 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}
                            >
                              Primary Model:
                            </span>
                            <span style={{ 'font-weight': '700', 'font-size': '13px' }}>
                              {pt()?.clean_primary_model || 'Auto-Routing'}
                            </span>
                            <Show
                              when={pt()?.is_primary_free}
                              fallback={<span class="badge-paid">💎 PAID</span>}
                            >
                              <span class="badge-free">🟢 FREE</span>
                            </Show>
                            <span
                              style={{ 'font-size': '11px', color: 'hsl(var(--muted-foreground))' }}
                            >
                              (via {pt()?.clean_primary_provider || 'Default'})
                            </span>
                          </div>

                          {/* Fallbacks */}
                          <div>
                            <div
                              style={{
                                'font-size': '11px',
                                'font-weight': '700',
                                color: 'hsl(var(--muted-foreground))',
                                'margin-bottom': '6px',
                              }}
                            >
                              ARMED FALLBACK PIPELINE ({fallbacks().length} STEPS):
                            </div>
                            <Show
                              when={fallbacks().length > 0}
                              fallback={
                                <span
                                  style={{
                                    'font-size': '12px',
                                    color: 'hsl(var(--muted-foreground))',
                                  }}
                                >
                                  No fallbacks configured
                                </span>
                              }
                            >
                              <div class="fallback-chain">
                                <For each={fallbacks()}>
                                  {(fb, idx) => (
                                    <>
                                      <div class="fallback-step-chip">
                                        <span style={{ 'font-weight': '700', color: '#0284c7' }}>
                                          #{fb.rank}
                                        </span>
                                        <span>{fb.clean_model}</span>
                                        <Show
                                          when={fb.is_free}
                                          fallback={
                                            <span
                                              class="badge-paid"
                                              style={{ 'font-size': '9px', padding: '1px 4px' }}
                                            >
                                              PAID
                                            </span>
                                          }
                                        >
                                          <span
                                            class="badge-free"
                                            style={{ 'font-size': '9px', padding: '1px 4px' }}
                                          >
                                            FREE
                                          </span>
                                        </Show>
                                      </div>
                                      <Show when={idx() < fallbacks().length - 1}>
                                        <span class="fallback-arrow">➔</span>
                                      </Show>
                                    </>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    padding: '16px 24px',
                    'border-top': '1px solid hsl(var(--border))',
                    display: 'flex',
                    'justify-content': 'flex-end',
                    background: 'hsl(var(--muted) / 0.2)',
                    'border-radius': '0 0 20px 20px',
                  }}
                >
                  <button
                    type="button"
                    class="admin-btn-primary"
                    onClick={() => setSelectedUser(null)}
                    style={{ padding: '8px 24px' }}
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
};
