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
import { A, useNavigate } from '@solidjs/router';
import { authClient } from '../services/auth-client.js';
import { toast } from '../services/toast-store.js';
import {
  getAllMembers,
  updateMemberStatus,
  updateMemberRole,
  updateMemberPlan,
  updateMemberFinancials,
  whitelistNewMember,
  deleteMember,
  blockMember,
  unblockMember,
  getGatewayAccessMode,
  setGatewayAccessMode,
  isUserAdminOrOwner,
  checkUserIsAdminAsync,
  type GatewayMember,
} from '../services/admin-neon.js';
import {
  approveUserAccount,
  getGatewaySettings,
  updateGatewaySetting,
  sendEmailViaResend,
  getRecentVerifications,
  type VerificationRecord,
} from '../services/kyros-auth-flow.js';
import '../styles/admin.css';

export const AdminUsers: Component = () => {
  const navigate = useNavigate();
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

  const [members, setMembers] = createSignal<GatewayMember[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [actionBusy, setActionBusy] = createSignal(false);
  const [gatewayMode, setGatewayMode] = createSignal<'boss_only' | 'team_mode'>('team_mode');

  // Filters matching Writerify
  const [searchQuery, setSearchQuery] = createSignal('');
  const [planFilter, setPlanFilter] = createSignal<string>('all');
  const [statusFilter, setStatusFilter] = createSignal<string>('all');
  const [period, setPeriod] = createSignal<'lifetime' | '30d' | 'year' | 'last_year'>('lifetime');

  // Whitelist modal state
  const [modalOpen, setModalOpen] = createSignal(false);
  const [newEmail, setNewEmail] = createSignal('');
  const [newName, setNewName] = createSignal('');
  const [newRole, setNewRole] = createSignal('member');
  const [newPlan, setNewPlan] = createSignal('user');

  // Email & Resend settings state
  const [emailModalOpen, setEmailModalOpen] = createSignal(false);
  const [resendApiKey, setResendApiKey] = createSignal('');
  const [emailFrom, setEmailFrom] = createSignal('Writerify Gateway <onboarding@resend.dev>');
  const [adminNotifyEmail, setAdminNotifyEmail] = createSignal('itsinjamul@gmail.com');
  const [showApiKey, setShowApiKey] = createSignal(false);
  const [verifications, setVerifications] = createSignal<VerificationRecord[]>([]);
  const [emailSettingsBusy, setEmailSettingsBusy] = createSignal(false);
  const [testEmailBusy, setTestEmailBusy] = createSignal(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = createSignal('');

  async function loadEmailSettings() {
    try {
      const s = await getGatewaySettings();
      if (s['resend_api_key'] !== undefined) setResendApiKey(s['resend_api_key']);
      if (s['email_from']) setEmailFrom(s['email_from']);
      if (s['admin_email']) setAdminNotifyEmail(s['admin_email']);
      const recents = await getRecentVerifications();
      setVerifications(recents);
    } catch (e) {
      console.error('Failed to load email settings:', e);
    }
  }

  async function handleSaveEmailSettings(e: Event) {
    e.preventDefault();
    try {
      setEmailSettingsBusy(true);
      await updateGatewaySetting('resend_api_key', resendApiKey().trim());
      await updateGatewaySetting('email_from', emailFrom().trim());
      await updateGatewaySetting('admin_email', adminNotifyEmail().trim());
      setSaveSuccessMsg('Settings saved successfully to Neon database!');
      toast.success('Email settings saved to Neon database!');
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setEmailSettingsBusy(false);
    }
  }

  async function handleTestEmail() {
    if (!resendApiKey().trim()) {
      toast.error('Please enter a Resend API Key first!');
      return;
    }
    try {
      setTestEmailBusy(true);
      await updateGatewaySetting('resend_api_key', resendApiKey().trim());
      await updateGatewaySetting('email_from', emailFrom().trim());
      const res = await sendEmailViaResend({
        to: adminNotifyEmail().trim() || 'itsinjamul@gmail.com',
        subject: 'Writerify Gateway - Test Email',
        html: '<h2 style="color: #0284c7;">Writerify Gateway Email Test</h2><p>Your Resend integration is active and working perfectly!</p>',
      });
      if (res.success) {
        toast.success('Test email delivered! Check inbox of ' + adminNotifyEmail());
      } else {
        toast.error('Test email failed: ' + res.error);
      }
    } catch (err: any) {
      toast.error('Test error: ' + err.message);
    } finally {
      setTestEmailBusy(false);
    }
  }

  // Inline edits cache
  const [editedPlans, setEditedPlans] = createSignal<Record<string, string>>({});
  const [editedAgreed, setEditedAgreed] = createSignal<Record<string, number>>({});
  const [editedPaid, setEditedPaid] = createSignal<Record<string, number>>({});

  async function loadMembers() {
    try {
      setRefreshing(true);
      const [data, mode] = await Promise.all([getAllMembers(), getGatewayAccessMode()]);
      setMembers(data);
      setGatewayMode(mode);
    } catch (err: any) {
      console.error('Failed to load members:', err);
      toast.error('Failed to connect to Neon PostgreSQL');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleToggleGatewayLock() {
    const currentMode = gatewayMode();
    const willLock = currentMode === 'team_mode';
    const confirmMsg = willLock
      ? '🔒 Lock Gateway to BOSS ONLY? This will immediately pause all other users (Said, etc.) from making Writerify requests.'
      : '🟢 Restore Team Access? This will allow approved team members to resume making Writerify requests.';
    if (!confirm(confirmMsg)) return;

    try {
      setActionBusy(true);
      const newMode = willLock ? 'boss_only' : 'team_mode';
      await setGatewayAccessMode(newMode);
      setGatewayMode(newMode);
      if (willLock) {
        toast.success('🔒 Gateway Locked! Only Boss TN TAYYAB can make requests.');
      } else {
        toast.success('🟢 Team Access Restored! Approved members can make requests.');
      }
      await loadMembers();
    } catch (err: any) {
      toast.error('Failed to change gateway mode: ' + (err.message || 'Unknown error'));
    } finally {
      setActionBusy(false);
    }
  }

  onMount(() => {
    loadMembers();
    const interval = setInterval(loadMembers, 15000);
    onCleanup(() => clearInterval(interval));
  });

  // KPI counts
  const totalCount = () => members().length;
  const ownerCount = () =>
    members().filter((m) => m.plan === 'owner' || m.role === 'superadmin').length;
  const userCount = () =>
    members().filter((m) => m.plan !== 'owner' && m.role !== 'superadmin').length;
  const pendingCount = () => members().filter((m) => m.status === 'pending').length;

  const filteredMembers = () => {
    let list = members();
    const plan = planFilter();
    if (plan !== 'all') {
      if (plan === 'owner') {
        list = list.filter((m) => m.plan === 'owner' || m.role === 'superadmin');
      } else {
        list = list.filter((m) => m.plan !== 'owner' && m.role !== 'superadmin');
      }
    }
    const status = statusFilter();
    if (status !== 'all') {
      list = list.filter((m) => m.status === status);
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

  async function handleApprove(email: string) {
    try {
      setActionBusy(true);
      const res = await approveUserAccount(email, 'Writerify');
      if (res.success) {
        if (res.emailSent) {
          toast.success(`Approved ${email} and dispatched confirmation email!`);
        } else {
          toast.success(
            `Approved ${email}! (Setup Resend API Key in Settings to send automated emails)`,
          );
        }
      } else {
        toast.error(res.error || 'Failed to approve');
      }
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRevoke(email: string) {
    if (email === 'itstasdidnur@gmail.com') {
      toast.error('Cannot revoke Master Admin Boss!');
      return;
    }
    try {
      setActionBusy(true);
      await blockMember(email, 'Boss TN TAYYAB');
      toast.success(`Blocked access for ${email}`);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleBlock(email: string) {
    if (email === 'itstasdidnur@gmail.com') {
      toast.error('Cannot block Master Admin Boss!');
      return;
    }
    if (
      !confirm(
        `Are you sure you want to block ${email}? They will be immediately blocked from accessing Writerify Gateway.`,
      )
    )
      return;
    try {
      setActionBusy(true);
      await blockMember(email, 'Boss TN TAYYAB');
      toast.success(`Blocked ${email} from Writerify Gateway`);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to block member');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleUnblock(email: string) {
    try {
      setActionBusy(true);
      await unblockMember(email);
      toast.success(`Unblocked ${email}. Status changed to pending approval.`);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unblock member');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSaveRow(m: GatewayMember) {
    try {
      setActionBusy(true);
      const plan = editedPlans()[m.email] ?? m.plan;
      const agreed = editedAgreed()[m.email] ?? Number(m.agreed_price) ?? 0;
      const paid = editedPaid()[m.email] ?? Number(m.paid_amount) ?? 0;

      if (plan && plan !== m.plan) {
        await updateMemberPlan(m.email, plan);
      }
      await updateMemberFinancials(m.email, agreed, paid);

      toast.success(`Updated settings for ${m.name || m.email}!`);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete(m: GatewayMember) {
    if (m.email === 'itstasdidnur@gmail.com') {
      toast.error('Cannot delete Master Admin Boss!');
      return;
    }
    if (!confirm(`Permanently remove ${m.email} from access list?`)) return;
    try {
      setActionBusy(true);
      await deleteMember(m.email);
      toast.success(`Completely wiped ${m.email}. Account is reset for fresh sign-up testing!`);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleWhitelistSubmit(e: Event) {
    e.preventDefault();
    if (!newEmail()) {
      toast.error('Email is required');
      return;
    }
    try {
      setActionBusy(true);
      await whitelistNewMember(
        newEmail(),
        newName() || newEmail().split('@')[0],
        newRole(),
        newPlan(),
      );
      toast.success(`Whitelisted ${newEmail()} successfully!`);
      setModalOpen(false);
      setNewEmail('');
      setNewName('');
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || 'Whitelisting failed');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div class="admin-container">
      <Title>User Management — KYROS Gateway</Title>

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
              User management is strictly restricted to Boss TN TAYYAB and Authorized Owners.
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
              <span class="admin-header__icon">👥</span>
              <h1 class="admin-header__title">User management</h1>
              <span class="admin-header__badge">ZERO-TRUST GATEKEEPER</span>
            </div>
            <p class="admin-header__subtitle">
              Everyone who signed up for KYROS Gateway. Approve team members and configure plans.
            </p>
          </div>

          <div class="admin-header__actions">
            <button
              type="button"
              onClick={() => {
                loadEmailSettings();
                setEmailModalOpen(true);
              }}
              class="admin-btn-secondary"
              style={{
                display: 'inline-flex',
                'align-items': 'center',
                gap: '6px',
                background: 'rgba(2, 132, 199, 0.1)',
                'border-color': 'rgba(2, 132, 199, 0.3)',
                color: '#0284c7',
                'font-weight': '600',
              }}
            >
              ✉️ Email & Resend Setup
            </button>

            <button
              type="button"
              onClick={handleToggleGatewayLock}
              disabled={actionBusy()}
              class="admin-btn-secondary"
              style={{
                display: 'inline-flex',
                'align-items': 'center',
                gap: '6px',
                'font-weight': '700',
                background:
                  gatewayMode() === 'boss_only'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(16, 185, 129, 0.12)',
                'border-color': gatewayMode() === 'boss_only' ? '#ef4444' : '#10b981',
                color: gatewayMode() === 'boss_only' ? '#dc2626' : '#059669',
                cursor: 'pointer',
              }}
              title="Click to toggle between Boss-Only private mode and Team mode"
            >
              {gatewayMode() === 'boss_only' ? '🔒 Gateway: BOSS ONLY' : '🟢 Gateway: TEAM ACTIVE'}
            </button>

            <button type="button" onClick={() => setModalOpen(true)} class="admin-btn-primary">
              + Whitelist Team Member
            </button>

            <button
              type="button"
              onClick={loadMembers}
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

        {/* Section 1: Subscriptions & Revenue Badges */}
        <div class="admin-panel">
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'space-between',
              'margin-bottom': '16px',
              'flex-wrap': 'wrap',
              gap: '10px',
            }}
          >
            <div
              style={{
                'font-size': '12px',
                'font-weight': '700',
                color: 'hsl(var(--muted-foreground))',
                'letter-spacing': '0.05em',
              }}
            >
              SUBSCRIPTIONS & REVENUE OVERVIEW
            </div>

            <select
              value={period()}
              onChange={(e) => setPeriod(e.currentTarget.value as any)}
              class="admin-select"
              style={{ padding: '4px 10px', 'font-size': '11px' }}
            >
              <option value="lifetime">Lifetime</option>
              <option value="30d">Last 30 days</option>
              <option value="year">This year</option>
              <option value="last_year">Last year</option>
            </select>
          </div>

          {/* Badges Grid matching Writerify */}
          <div style={{ display: 'flex', gap: '10px', 'flex-wrap': 'wrap' }}>
            <div
              style={{
                background: 'hsl(var(--muted) / 0.5)',
                border: '1px solid hsl(var(--border))',
                padding: '10px 16px',
                'border-radius': '10px',
              }}
            >
              <div
                style={{
                  'font-size': '10px',
                  color: 'hsl(var(--muted-foreground))',
                  'font-weight': '700',
                }}
              >
                TOTAL USERS
              </div>
              <div
                style={{
                  'font-size': '20px',
                  'font-weight': '800',
                  color: 'hsl(var(--foreground))',
                }}
              >
                {totalCount()}
              </div>
            </div>

            <div
              style={{
                background: 'hsl(var(--muted) / 0.5)',
                border: '1px solid hsl(var(--border))',
                padding: '10px 16px',
                'border-radius': '10px',
              }}
            >
              <div style={{ 'font-size': '10px', color: '#7c3aed', 'font-weight': '700' }}>
                OWNER
              </div>
              <div style={{ 'font-size': '20px', 'font-weight': '800', color: '#7c3aed' }}>
                {ownerCount()}
              </div>
            </div>

            <div
              style={{
                background: 'hsl(var(--muted) / 0.5)',
                border: '1px solid hsl(var(--border))',
                padding: '10px 16px',
                'border-radius': '10px',
              }}
            >
              <div style={{ 'font-size': '10px', color: '#2563eb', 'font-weight': '700' }}>
                USERS
              </div>
              <div style={{ 'font-size': '20px', 'font-weight': '800', color: '#2563eb' }}>
                {userCount()}
              </div>
            </div>

            <Show when={pendingCount() > 0}>
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '10px 16px',
                  'border-radius': '10px',
                }}
              >
                <div style={{ 'font-size': '10px', color: '#b45309', 'font-weight': '700' }}>
                  ⚠️ PENDING APPROVAL
                </div>
                <div style={{ 'font-size': '20px', 'font-weight': '800', color: '#b45309' }}>
                  {pendingCount()}
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Section 2: Users Management Table */}
        <div class="admin-panel" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Filters Bar */}
          <div
            style={{
              padding: '16px 22px',
              'border-bottom': '1px solid hsl(var(--border))',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'space-between',
              'flex-wrap': 'wrap',
              gap: '12px',
            }}
          >
            <div
              style={{ display: 'flex', 'align-items': 'center', gap: '10px', 'flex-wrap': 'wrap' }}
            >
              {/* Search input */}
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="admin-input"
                style={{ width: '240px' }}
              />

              {/* Role / Plan filter */}
              <select
                value={planFilter()}
                onChange={(e) => setPlanFilter(e.currentTarget.value)}
                class="admin-select"
              >
                <option value="all">All accounts</option>
                <option value="owner">Owner</option>
                <option value="user">User</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter()}
                onChange={(e) => setStatusFilter(e.currentTarget.value)}
                class="admin-select"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="revoked">Revoked / Suspended</option>
              </select>
            </div>

            <div style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}>
              Showing {filteredMembers().length} of {members().length} accounts
            </div>
          </div>

          {/* Table Container */}
          <div class="admin-table-container" style={{ border: 'none', 'border-radius': '0' }}>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Status / Access</th>
                  <th>Agreed ($)</th>
                  <th>Paid ($)</th>
                  <th>Due ($)</th>
                  <th>Joined</th>
                  <th style={{ 'text-align': 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <Show
                  when={!loading() && filteredMembers().length > 0}
                  fallback={
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: '40px 18px',
                          'text-align': 'center',
                          color: 'hsl(var(--muted-foreground))',
                        }}
                      >
                        {loading() ? 'Loading users...' : 'No users match criteria.'}
                      </td>
                    </tr>
                  }
                >
                  <For each={filteredMembers()}>
                    {(m) => {
                      const agreed = () => (editedAgreed()[m.email] ?? Number(m.agreed_price)) || 0;
                      const paid = () => (editedPaid()[m.email] ?? Number(m.paid_amount)) || 0;
                      const due = () => Math.max(0, agreed() - paid());
                      const joinedDate = m.created_at
                        ? new Date(m.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Oct 24, 2026';

                      return (
                        <tr
                          style={{
                            background:
                              m.status === 'pending' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                          }}
                        >
                          {/* User */}
                          <td>
                            <div style={{ 'font-weight': '600', color: 'hsl(var(--foreground))' }}>
                              {m.name || m.email.split('@')[0]}
                            </div>
                            <div style={{ 'font-size': '12px', color: '#0284c7' }}>{m.email}</div>
                            <Show when={m.mobile}>
                              <a
                                href={`https://wa.me/${m.mobile?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  'font-size': '11px',
                                  color: '#059669',
                                  'text-decoration': 'none',
                                  display: 'inline-flex',
                                  'align-items': 'center',
                                  gap: '4px',
                                  'margin-top': '2px',
                                  'font-weight': '600',
                                }}
                              >
                                💬 WhatsApp ({m.mobile})
                              </a>
                            </Show>
                          </td>

                          {/* Plan selector matching Writerify */}
                          <td>
                            <select
                              value={
                                editedPlans()[m.email] ?? (m.plan === 'owner' ? 'owner' : 'user')
                              }
                              onChange={(e) =>
                                setEditedPlans({
                                  ...editedPlans(),
                                  [m.email]: e.currentTarget.value,
                                })
                              }
                              class="admin-select"
                              style={{ padding: '5px 8px', 'font-size': '12px' }}
                            >
                              <option value="user">user</option>
                              <option value="owner">owner</option>
                            </select>
                          </td>

                          {/* Status / Access Actions */}
                          <td>
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                              <span
                                class={
                                  m.status === 'approved'
                                    ? 'badge-approved'
                                    : m.status === 'pending'
                                      ? 'badge-pending'
                                      : 'badge-revoked'
                                }
                              >
                                {m.status === 'rejected' || m.status === 'revoked'
                                  ? 'blocked ⛔'
                                  : m.status || 'pending'}
                              </span>

                              <Show when={m.is_email_verified}>
                                <span
                                  style={{
                                    'font-size': '10px',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    color: '#16a34a',
                                    padding: '2px 6px',
                                    'border-radius': '4px',
                                    'font-weight': '700',
                                  }}
                                  title="User verified their email address via OTP code"
                                >
                                  Verified ✅
                                </span>
                              </Show>

                              {/* Approve Button */}
                              <Show
                                when={
                                  m.status !== 'approved' &&
                                  m.status !== 'rejected' &&
                                  m.status !== 'revoked'
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => handleApprove(m.email)}
                                  disabled={actionBusy()}
                                  style={{
                                    background: '#059669',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 10px',
                                    'border-radius': '6px',
                                    'font-size': '11px',
                                    'font-weight': '700',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Approve
                                </button>
                              </Show>

                              {/* Block Button */}
                              <Show
                                when={
                                  m.status !== 'rejected' &&
                                  m.status !== 'revoked' &&
                                  m.email !== 'itstasdidnur@gmail.com'
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => handleBlock(m.email)}
                                  disabled={actionBusy()}
                                  title="Block this user from accessing gateway"
                                  style={{
                                    background: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 8px',
                                    'border-radius': '6px',
                                    'font-size': '11px',
                                    'font-weight': '600',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Block ⛔
                                </button>
                              </Show>

                              {/* Unblock Button */}
                              <Show when={m.status === 'rejected' || m.status === 'revoked'}>
                                <button
                                  type="button"
                                  onClick={() => handleUnblock(m.email)}
                                  disabled={actionBusy()}
                                  style={{
                                    background: '#0284c7',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 8px',
                                    'border-radius': '6px',
                                    'font-size': '11px',
                                    'font-weight': '600',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Unblock
                                </button>
                              </Show>
                            </div>
                          </td>

                          {/* Agreed Price */}
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={editedAgreed()[m.email] ?? Number(m.agreed_price) ?? 0}
                              onInput={(e) =>
                                setEditedAgreed({
                                  ...editedAgreed(),
                                  [m.email]: parseFloat(e.currentTarget.value) || 0,
                                })
                              }
                              class="admin-input"
                              style={{ width: '75px', padding: '5px 8px' }}
                            />
                          </td>

                          {/* Paid Amount */}
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={editedPaid()[m.email] ?? Number(m.paid_amount) ?? 0}
                              onInput={(e) =>
                                setEditedPaid({
                                  ...editedPaid(),
                                  [m.email]: parseFloat(e.currentTarget.value) || 0,
                                })
                              }
                              class="admin-input"
                              style={{ width: '75px', padding: '5px 8px' }}
                            />
                          </td>

                          {/* Due */}
                          <td>
                            <span class={due() <= 0 ? 'badge-approved' : 'badge-revoked'}>
                              {due() <= 0 ? 'settled' : `$${due()}`}
                            </span>
                          </td>

                          {/* Joined */}
                          <td
                            style={{ 'font-size': '12px', color: 'hsl(var(--muted-foreground))' }}
                          >
                            {joinedDate}
                          </td>

                          {/* Actions */}
                          <td style={{ 'text-align': 'right' }}>
                            <div
                              style={{
                                display: 'flex',
                                'align-items': 'center',
                                'justify-content': 'flex-end',
                                gap: '8px',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleSaveRow(m)}
                                disabled={actionBusy()}
                                class="admin-btn-primary"
                                style={{ padding: '5px 12px', 'font-size': '11px' }}
                              >
                                Save
                              </button>
                              <Show when={m.email !== 'itstasdidnur@gmail.com'}>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(m)}
                                  disabled={actionBusy()}
                                  title="Delete user"
                                  style={{
                                    background: 'transparent',
                                    color: '#dc2626',
                                    border: 'none',
                                    cursor: 'pointer',
                                    'font-size': '15px',
                                    padding: '4px',
                                  }}
                                >
                                  🗑️
                                </button>
                              </Show>
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

        {/* Modal: Whitelist Team Member */}
        <Show when={modalOpen()}>
          <div class="admin-modal-backdrop" onClick={() => setModalOpen(false)}>
            <div class="admin-modal" onClick={(e) => e.stopPropagation()}>
              <h3 class="admin-modal__title">+ Whitelist Team Member</h3>
              <p class="admin-modal__desc">
                Pre-authorize a team member so they can access Gateway without waiting for approval.
              </p>

              <form onSubmit={handleWhitelistSubmit}>
                <div style={{ 'margin-bottom': '14px' }}>
                  <label
                    style={{
                      display: 'block',
                      'font-size': '12px',
                      'font-weight': '600',
                      'margin-bottom': '6px',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Team Member Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="teammate@gmail.com"
                    value={newEmail()}
                    onInput={(e) => setNewEmail(e.currentTarget.value)}
                    class="admin-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ 'margin-bottom': '14px' }}>
                  <label
                    style={{
                      display: 'block',
                      'font-size': '12px',
                      'font-weight': '600',
                      'margin-bottom': '6px',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newName()}
                    onInput={(e) => setNewName(e.currentTarget.value)}
                    class="admin-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    'grid-template-columns': '1fr 1fr',
                    gap: '12px',
                    'margin-bottom': '20px',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        'font-size': '12px',
                        'font-weight': '600',
                        'margin-bottom': '6px',
                        color: 'hsl(var(--foreground))',
                      }}
                    >
                      Role
                    </label>
                    <select
                      value={newRole()}
                      onChange={(e) => setNewRole(e.currentTarget.value)}
                      class="admin-select"
                      style={{ width: '100%' }}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        'font-size': '12px',
                        'font-weight': '600',
                        'margin-bottom': '6px',
                        color: 'hsl(var(--foreground))',
                      }}
                    >
                      Plan
                    </label>
                    <select
                      value={newPlan()}
                      onChange={(e) => setNewPlan(e.currentTarget.value)}
                      class="admin-select"
                      style={{ width: '100%' }}
                    >
                      <option value="user">user</option>
                      <option value="owner">owner</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    class="admin-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={actionBusy()} class="admin-btn-primary">
                    {actionBusy() ? 'Whitelisting...' : 'Whitelist Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Show>

        {/* Email & Resend Gateway Settings Modal */}
        <Show when={emailModalOpen()}>
          <div
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'z-index': '9999',
              padding: '20px',
              'backdrop-filter': 'blur(4px)',
            }}
          >
            <div
              style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                'border-radius': '16px',
                width: '100%',
                'max-width': '620px',
                'max-height': '90vh',
                overflow: 'auto',
                padding: '24px',
                'box-shadow': '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  'margin-bottom': '16px',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: '0',
                      'font-size': '18px',
                      'font-weight': '700',
                      color: 'hsl(var(--foreground))',
                      display: 'flex',
                      'align-items': 'center',
                      gap: '8px',
                    }}
                  >
                    ✉️ Email & Resend Gateway Hub
                  </h3>
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      'font-size': '13px',
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    Powers OTP email verifications and automated Admin approval notices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    'font-size': '20px',
                  }}
                >
                  ✕
                </button>
              </div>

              <Show when={saveSuccessMsg()}>
                <div
                  style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    padding: '10px 14px',
                    'border-radius': '8px',
                    'font-size': '13px',
                    'font-weight': '600',
                    'margin-bottom': '16px',
                    display: 'flex',
                    'align-items': 'center',
                    gap: '8px',
                  }}
                >
                  <span>✅ {saveSuccessMsg()}</span>
                </div>
              </Show>

              <form onSubmit={handleSaveEmailSettings}>
                <div style={{ 'margin-bottom': '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      'font-size': '12px',
                      'font-weight': '600',
                      'margin-bottom': '6px',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Resend API Key (re_...)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type={showApiKey() ? 'text' : 'password'}
                      placeholder="re_1234567890abcdef..."
                      value={resendApiKey()}
                      onInput={(e) => setResendApiKey(e.currentTarget.value)}
                      class="admin-input"
                      style={{ flex: '1', 'font-family': 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey())}
                      class="admin-btn-secondary"
                      style={{ padding: '0 12px' }}
                    >
                      {showApiKey() ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div style={{ 'font-size': '11px', color: '#64748b', 'margin-top': '4px' }}>
                    Get your free key from{' '}
                    <a
                      href="https://resend.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0284c7' }}
                    >
                      resend.com
                    </a>{' '}
                    (3,000 free emails/month). Stored securely in Neon DB.
                  </div>
                </div>

                <div style={{ 'margin-bottom': '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      'font-size': '12px',
                      'font-weight': '600',
                      'margin-bottom': '6px',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Outgoing Sender Address ("From")
                  </label>
                  <input
                    type="text"
                    placeholder="Writerify Gateway <onboarding@resend.dev>"
                    value={emailFrom()}
                    onInput={(e) => setEmailFrom(e.currentTarget.value)}
                    class="admin-input"
                    style={{ width: '100%' }}
                  />
                  <div style={{ 'font-size': '11px', color: '#64748b', 'margin-top': '4px' }}>
                    Use <code>Writerify Gateway &lt;onboarding@resend.dev&gt;</code> for test/free
                    sending, or your custom domain when verified in Resend.
                  </div>
                  <Show
                    when={
                      emailFrom().toLowerCase().includes('@gmail.com') ||
                      emailFrom().toLowerCase().includes('@yahoo.com')
                    }
                  >
                    <div
                      style={{
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: '#eab308',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        padding: '8px 12px',
                        'border-radius': '6px',
                        'font-size': '12px',
                        'margin-top': '6px',
                        'line-height': '1.4',
                      }}
                    >
                      ⚠️ <strong>Resend Restriction:</strong> Cannot send from personal @gmail.com
                      addresses. Please use{' '}
                      <code>Writerify Gateway &lt;onboarding@resend.dev&gt;</code> (or verify
                      writerify.org in Resend Domains).
                    </div>
                  </Show>
                </div>

                <div style={{ 'margin-bottom': '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      'font-size': '12px',
                      'font-weight': '600',
                      'margin-bottom': '6px',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    Admin Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="itsinjamul@gmail.com"
                    value={adminNotifyEmail()}
                    onInput={(e) => setAdminNotifyEmail(e.currentTarget.value)}
                    class="admin-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'center',
                    'margin-bottom': '24px',
                    'border-top': '1px solid hsl(var(--border))',
                    'padding-top': '16px',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={testEmailBusy()}
                    class="admin-btn-secondary"
                    style={{ color: '#0284c7', 'border-color': 'rgba(2, 132, 199, 0.4)' }}
                  >
                    {testEmailBusy() ? 'Sending Test Email...' : '🧪 Send Test Email to Boss'}
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEmailModalOpen(false)}
                      class="admin-btn-secondary"
                    >
                      Close
                    </button>
                    <button type="submit" disabled={emailSettingsBusy()} class="admin-btn-primary">
                      {emailSettingsBusy() ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Recent Verification OTP Codes Section */}
              <div style={{ 'border-top': '1px solid hsl(var(--border))', 'padding-top': '16px' }}>
                <h4
                  style={{
                    margin: '0 0 10px 0',
                    'font-size': '13px',
                    'font-weight': '700',
                    color: 'hsl(var(--foreground))',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between',
                  }}
                >
                  <span>📋 Recent Verification Codes (OTP Live Log)</span>
                  <button
                    type="button"
                    onClick={loadEmailSettings}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      'font-size': '11px',
                      cursor: 'pointer',
                      'font-weight': '600',
                    }}
                  >
                    🔄 Refresh Log
                  </button>
                </h4>
                <div
                  style={{
                    'max-height': '180px',
                    overflow: 'auto',
                    border: '1px solid hsl(var(--border))',
                    'border-radius': '8px',
                  }}
                >
                  <table
                    style={{ width: '100%', 'font-size': '11px', 'border-collapse': 'collapse' }}
                  >
                    <thead>
                      <tr style={{ background: 'hsl(var(--muted))', 'text-align': 'left' }}>
                        <th style={{ padding: '6px 10px' }}>User</th>
                        <th style={{ padding: '6px 10px' }}>Email</th>
                        <th style={{ padding: '6px 10px' }}>OTP Code</th>
                        <th style={{ padding: '6px 10px' }}>Status</th>
                        <th style={{ padding: '6px 10px' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For
                        each={verifications()}
                        fallback={
                          <tr>
                            <td
                              colspan="5"
                              style={{ padding: '12px', 'text-align': 'center', color: '#64748b' }}
                            >
                              No verification records found.
                            </td>
                          </tr>
                        }
                      >
                        {(v) => (
                          <tr style={{ 'border-top': '1px solid hsl(var(--border))' }}>
                            <td style={{ padding: '6px 10px', 'font-weight': '600' }}>
                              {v.name || 'Member'}
                            </td>
                            <td style={{ padding: '6px 10px', color: '#0284c7' }}>{v.email}</td>
                            <td
                              style={{
                                padding: '6px 10px',
                                'font-family': 'monospace',
                                'font-size': '12px',
                                'font-weight': '700',
                                color: '#38bdf8',
                              }}
                            >
                              {v.code}
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <span
                                style={{
                                  color: v.is_verified ? '#16a34a' : '#eab308',
                                  'font-weight': '600',
                                }}
                              >
                                {v.is_verified ? 'Verified ✅' : 'Pending ⏳'}
                              </span>
                            </td>
                            <td style={{ padding: '6px 10px', color: '#64748b' }}>
                              {v.created_at ? new Date(v.created_at).toLocaleTimeString() : ''}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default AdminUsers;
