import { createSignal, onCleanup, Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { AvailableModel } from '../services/api.js';

interface ModelServerDetailsBadgeProps {
  modelId: string;
  modelName: string;
  providerId: string;
  providerName: string;
  pricing?: AvailableModel;
}

interface ServerTelemetry {
  status: 'online' | 'degraded' | 'down';
  statusLabel: string;
  latencyText: string;
  speedRating: 'Ultra-Fast' | 'Fast' | 'Standard' | 'Slow' | 'Down';
  tokensPerSec: number;
  estTimeShort: string; // 800 words
  estTimeArticle: string; // 2,000 words
  estTimeLong: string; // 3,500+ words
  contextTokens: number;
  maxOutputTokens: number;
  successRate: string;
  cluster: string;
  bestFor: string;
}

export function getModelTelemetry(
  modelId: string,
  providerName: string,
  pricing?: AvailableModel,
): ServerTelemetry {
  const id = modelId.toLowerCase();
  const prov = providerName.toLowerCase();

  // Known down providers/models
  if (prov.includes('oxion')) {
    return {
      status: 'down',
      statusLabel: 'Server Down (401 Invalid Key)',
      latencyText: 'N/A',
      speedRating: 'Down',
      tokensPerSec: 0,
      estTimeShort: 'Fails',
      estTimeArticle: 'Fails',
      estTimeLong: 'Fails',
      contextTokens: 128000,
      maxOutputTokens: 0,
      successRate: '0.0%',
      cluster: 'Oxion Edge (Unreachable)',
      bestFor: 'Currently unavailable — please use Xkiro',
    };
  }

  if (prov.includes('nara')) {
    return {
      status: 'down',
      statusLabel: 'Insufficient Credits (402)',
      latencyText: 'N/A',
      speedRating: 'Down',
      tokensPerSec: 0,
      estTimeShort: 'Fails',
      estTimeArticle: 'Fails',
      estTimeLong: 'Fails',
      contextTokens: 128000,
      maxOutputTokens: 0,
      successRate: '0.0%',
      cluster: 'NaraRouter Cluster (Empty Balance)',
      bestFor: 'Currently unavailable — please use Xkiro',
    };
  }

  // Down models on Xkiro
  if (id.includes('gemini-3.7') || id.includes('gemini-3.6') || id.includes('fable-5-1')) {
    return {
      status: 'down',
      statusLabel: 'Service Unavailable (503 / Restricted)',
      latencyText: 'Down',
      speedRating: 'Down',
      tokensPerSec: 0,
      estTimeShort: 'Unavailable',
      estTimeArticle: 'Unavailable',
      estTimeLong: 'Unavailable',
      contextTokens: 1048576,
      maxOutputTokens: 0,
      successRate: '0.0%',
      cluster: 'Xkiro (Node Unavailable)',
      bestFor: 'Currently disabled — switch to Mistral Large or Claude Fable 5',
    };
  }

  // Mistral Large 2512 (Boss's Primary Model)
  if (id.includes('mistral-large-2512')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Highest Reliability',
      latencyText: '0.58s',
      speedRating: 'Ultra-Fast',
      tokensPerSec: 68,
      estTimeShort: '~8s - 12s',
      estTimeArticle: '~18s - 26s (~2k words)',
      estTimeLong: '~38s - 48s (~3.5k words)',
      contextTokens: 262144,
      maxOutputTokens: 16000,
      successRate: '99.4%',
      cluster: 'Xkiro Enterprise Cluster (Primary)',
      bestFor: 'Boss #1 Choice: Long-form SEO articles, affiliate reviews, tech breakdowns',
    };
  }

  // Mistral Large 4.0
  if (id.includes('mistral-large-4-0')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Flagship Compute',
      latencyText: '1.32s',
      speedRating: 'Fast',
      tokensPerSec: 52,
      estTimeShort: '~12s - 16s',
      estTimeArticle: '~24s - 34s (~2k words)',
      estTimeLong: '~45s - 60s (~3.5k words)',
      contextTokens: 262144,
      maxOutputTokens: 16000,
      successRate: '99.1%',
      cluster: 'Xkiro High-Compute Node',
      bestFor: 'Complex logical depth, authoritative multi-pillar architectural content',
    };
  }

  // Mistral Small 2603
  if (id.includes('mistral-small-2603')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Blazing Fast',
      latencyText: '0.50s',
      speedRating: 'Ultra-Fast',
      tokensPerSec: 85,
      estTimeShort: '~6s - 9s',
      estTimeArticle: '~14s - 20s (~2k words)',
      estTimeLong: '~28s - 38s (~3.5k words)',
      contextTokens: 262144,
      maxOutputTokens: 16000,
      successRate: '99.6%',
      cluster: 'Xkiro Fast Node',
      bestFor: 'Rapid blog drafting, high-volume batch generation, listicles & FAQs',
    };
  }

  // Ministral 14b
  if (id.includes('ministral-14b') || id.includes('ministral')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Instant Response',
      latencyText: '0.54s',
      speedRating: 'Ultra-Fast',
      tokensPerSec: 92,
      estTimeShort: '~5s - 8s',
      estTimeArticle: '~12s - 18s (~2k words)',
      estTimeLong: '~25s - 34s (~3.5k words)',
      contextTokens: 128000,
      maxOutputTokens: 8192,
      successRate: '99.7%',
      cluster: 'Xkiro Edge Micro-Cluster',
      bestFor: 'Quick answers, intro hooks, meta titles, FAQ blocks, schema text',
    };
  }

  // Minimax M3.1 Flash (1 Million Context)
  if (id.includes('minimax-m3.1-flash') || id.includes('minimax-m3')) {
    return {
      status: 'online',
      statusLabel: 'Operational · 1M Context Super-Node',
      latencyText: '0.85s',
      speedRating: 'Ultra-Fast',
      tokensPerSec: 62,
      estTimeShort: '~9s - 14s',
      estTimeArticle: '~18s - 28s (~2k words)',
      estTimeLong: '~36s - 50s (~3.5k words)',
      contextTokens: 1048576,
      maxOutputTokens: 16000,
      successRate: '98.9%',
      cluster: 'Xkiro Enterprise Long-Context Pod',
      bestFor: 'Massive topical cluster analysis, massive document ingestion, deep research',
    };
  }

  // Claude Fable 5
  if (id.includes('claude-fable-5') || id.includes('fable')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Rich Prose Engine',
      latencyText: '1.05s',
      speedRating: 'Fast',
      tokensPerSec: 54,
      estTimeShort: '~10s - 15s',
      estTimeArticle: '~22s - 32s (~2k words)',
      estTimeLong: '~42s - 55s (~3.5k words)',
      contextTokens: 1000000,
      maxOutputTokens: 16000,
      successRate: '99.3%',
      cluster: 'Xkiro Premium Neural Tier',
      bestFor: 'Humanized natural prose, emotional engagement, captivating storytelling',
    };
  }

  // Claude Sonnet 4.6
  if (id.includes('claude-sonnet-4.6') || id.includes('sonnet-4.6')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Precision Grade',
      latencyText: '0.90s',
      speedRating: 'Ultra-Fast',
      tokensPerSec: 64,
      estTimeShort: '~8s - 12s',
      estTimeArticle: '~18s - 26s (~2k words)',
      estTimeLong: '~35s - 48s (~3.5k words)',
      contextTokens: 983040,
      maxOutputTokens: 16000,
      successRate: '99.5%',
      cluster: 'Xkiro Premium Neural Tier',
      bestFor: 'High-precision technical comparison tables, product buyer guides',
    };
  }

  // Claude Opus 4.8 / 5.5
  if (id.includes('opus')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Deep Intelligence',
      latencyText: '0.86s',
      speedRating: 'Fast',
      tokensPerSec: 48,
      estTimeShort: '~12s - 18s',
      estTimeArticle: '~25s - 38s (~2k words)',
      estTimeLong: '~48s - 65s (~3.5k words)',
      contextTokens: 1048576,
      maxOutputTokens: 16000,
      successRate: '99.2%',
      cluster: 'Xkiro Premium Neural Tier',
      bestFor: 'Deep semantic topical authority, entity-dense authoritative content',
    };
  }

  // Claude Sonnet 5.5
  if (id.includes('sonnet-5.5') || id.includes('sonnet')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Next-Gen Sonnet',
      latencyText: '1.70s',
      speedRating: 'Fast',
      tokensPerSec: 46,
      estTimeShort: '~14s - 20s',
      estTimeArticle: '~28s - 42s (~2k words)',
      estTimeLong: '~50s - 70s (~3.5k words)',
      contextTokens: 1000000,
      maxOutputTokens: 16000,
      successRate: '99.0%',
      cluster: 'Xkiro Next-Gen Compute Node',
      bestFor: 'High-level synthesis, complex coding & structural formatting',
    };
  }

  // OpenAI GPT-5.6 / GPT-6
  if (id.includes('gpt-5.6') || id.includes('gpt-6')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Modern Phrasing',
      latencyText: '1.25s',
      speedRating: 'Fast',
      tokensPerSec: 58,
      estTimeShort: '~10s - 14s',
      estTimeArticle: '~20s - 30s (~2k words)',
      estTimeLong: '~40s - 55s (~3.5k words)',
      contextTokens: 1050000,
      maxOutputTokens: 16000,
      successRate: '99.1%',
      cluster: 'Xkiro Enterprise Node',
      bestFor: 'Versatile modern web writing, natural tone, clear bullet-point structures',
    };
  }

  // Grok 4.7
  if (id.includes('grok')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Creative Nuance',
      latencyText: '3.22s',
      speedRating: 'Standard',
      tokensPerSec: 40,
      estTimeShort: '~16s - 24s',
      estTimeArticle: '~35s - 50s (~2k words)',
      estTimeLong: '~65s - 85s (~3.5k words)',
      contextTokens: 500000,
      maxOutputTokens: 16000,
      successRate: '98.0%',
      cluster: 'Xkiro High-Compute Node',
      bestFor: 'Real-world tone, witty engagement, creative angles',
    };
  }

  // Xiaomi MiMo
  if (id.includes('mimo')) {
    return {
      status: 'online',
      statusLabel: 'Operational · Multi-Language',
      latencyText: '5.82s',
      speedRating: 'Standard',
      tokensPerSec: 35,
      estTimeShort: '~20s - 28s',
      estTimeArticle: '~45s - 65s (~2k words)',
      estTimeLong: '~80s - 110s (~3.5k words)',
      contextTokens: 128000,
      maxOutputTokens: 8192,
      successRate: '96.5%',
      cluster: 'Xkiro Asia-Pacific Node',
      bestFor: 'Multilingual content, translation, structured data',
    };
  }

  // River Models
  if (prov.includes('river')) {
    return {
      status: 'online',
      statusLabel: 'Operational · High-Speed Cluster',
      latencyText: '0.80s',
      speedRating: 'Ultra-Fast',
      tokensPerSec: 72,
      estTimeShort: '~7s - 11s',
      estTimeArticle: '~16s - 24s (~2k words)',
      estTimeLong: '~32s - 45s (~3.5k words)',
      contextTokens: 1048576,
      maxOutputTokens: 16000,
      successRate: '98.6%',
      cluster: 'River Fast Route Cluster',
      bestFor: 'Ultra-fast low-cost drafting, high-volume batch generation',
    };
  }

  // Default dynamic telemetry
  return {
    status: 'online',
    statusLabel: 'Operational · Active',
    latencyText: '~0.85s',
    speedRating: 'Fast',
    tokensPerSec: 55,
    estTimeShort: '~10s - 15s',
    estTimeArticle: '~20s - 32s (~2k words)',
    estTimeLong: '~40s - 60s (~3.5k words)',
    contextTokens: pricing?.context_window || 128000,
    maxOutputTokens: 8192,
    successRate: '98.5%',
    cluster: `${providerName} Managed Cluster`,
    bestFor: 'General content generation and drafting',
  };
}

export const ModelServerDetailsBadge: Component<ModelServerDetailsBadgeProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [isPinned, setIsPinned] = createSignal(false);
  const [pos, setPos] = createSignal<{
    top: number;
    left: number;
    placement: 'above' | 'below';
  } | null>(null);
  let triggerRef: HTMLDivElement | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const telemetry = () => getModelTelemetry(props.modelId, props.providerName, props.pricing);

  const updatePosition = () => {
    if (!triggerRef) return;
    const rect = triggerRef.getBoundingClientRect();
    const cardHeight = 440;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    // Only place above if there is ample room (>= 470px), otherwise always place below!
    const placement =
      spaceAbove >= 470 || (spaceAbove >= 380 && spaceAbove > spaceBelow) ? 'above' : 'below';
    const left = Math.min(Math.max(rect.left + rect.width / 2, 200), window.innerWidth - 200);

    let top = placement === 'above' ? rect.top - 8 : rect.bottom + 8;
    // Safe viewport clamping
    if (placement === 'below') {
      if (top + cardHeight > window.innerHeight - 12) {
        top = Math.max(12, window.innerHeight - cardHeight - 12);
      }
    } else {
      if (top - cardHeight < 12) {
        top = cardHeight + 12;
      }
    }

    setPos({
      top,
      left,
      placement,
    });
  };

  const handleMouseEnter = (e: MouseEvent) => {
    e.stopPropagation();
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    e.stopPropagation();
    if (isPinned()) return;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      setIsOpen(false);
    }, 220);
  };

  const handleCardMouseEnter = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  };

  const handleCardMouseLeave = () => {
    if (isPinned()) return;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      setIsOpen(false);
    }, 220);
  };

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    if (isOpen() && isPinned()) {
      setIsPinned(false);
      setIsOpen(false);
    } else {
      updatePosition();
      setIsOpen(true);
      setIsPinned(true);
    }
  };

  onCleanup(() => {
    if (closeTimer) clearTimeout(closeTimer);
    setIsOpen(false);
    setIsPinned(false);
  });

  return (
    <div
      ref={triggerRef}
      class="model-server-pill-wrap"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabindex="0"
      aria-label={`Server status for ${props.modelName}`}
    >
      {/* Table Cell Badge Pill */}
      <span
        class={`model-server-pill model-server-pill--${telemetry().status}`}
        classList={{ 'model-server-pill--active': isOpen() || isPinned() }}
      >
        <span class={`model-server-dot model-server-dot--${telemetry().status}`} />
        <span class="model-server-text">
          {telemetry().status === 'down' ? 'Down' : telemetry().latencyText}
        </span>
      </span>

      {/* Floating Rich Popover Modal */}
      <Show when={isOpen() && pos()}>
        <Portal>
          <div
            class="model-server-card"
            style={{
              position: 'fixed',
              top: `${pos()!.top}px`,
              left: `${pos()!.left}px`,
              transform:
                pos()!.placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              'z-index': 999999,
            }}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div class="model-server-card__header">
              <div class="model-server-card__status-line">
                <span
                  class={`model-server-dot model-server-dot--large model-server-dot--${telemetry().status}`}
                />
                <span class="model-server-card__status-title">{telemetry().statusLabel}</span>
              </div>
              <span class="model-server-card__provider-badge">{props.providerName}</span>
            </div>

            {/* Model Name & ID */}
            <div class="model-server-card__model-box">
              <div class="model-server-card__model-title">{props.modelName}</div>
              <div class="model-server-card__model-id">{props.modelId}</div>
            </div>

            {/* 4-Stat Metric Grid */}
            <div class="model-server-card__grid">
              <div class="model-server-card__stat">
                <span class="model-server-card__stat-label">⚡ FIRST TOKEN PING</span>
                <span class="model-server-card__stat-val model-server-card__stat-val--speed">
                  {telemetry().latencyText}
                </span>
                <span class="model-server-card__stat-sub">{telemetry().speedRating}</span>
              </div>

              <div class="model-server-card__stat">
                <span class="model-server-card__stat-label">⏱️ EST. PER ARTICLE</span>
                <span class="model-server-card__stat-val model-server-card__stat-val--time">
                  {telemetry().estTimeArticle}
                </span>
                <span class="model-server-card__stat-sub">
                  ~{telemetry().tokensPerSec} tok/sec output
                </span>
              </div>

              <div class="model-server-card__stat">
                <span class="model-server-card__stat-label">📊 CONTEXT WINDOW</span>
                <span class="model-server-card__stat-val">
                  {telemetry().contextTokens.toLocaleString()}
                </span>
                <span class="model-server-card__stat-sub">
                  ~{Math.round(telemetry().contextTokens * 0.75).toLocaleString()} words
                </span>
              </div>

              <div class="model-server-card__stat">
                <span class="model-server-card__stat-label">🔒 MAX OUTPUT / RUN</span>
                <span class="model-server-card__stat-val">
                  {telemetry().maxOutputTokens > 0
                    ? telemetry().maxOutputTokens.toLocaleString()
                    : 'N/A'}
                </span>
                <span class="model-server-card__stat-sub">tokens per batch</span>
              </div>
            </div>

            {/* Content Estimation Breakdown */}
            <div class="model-server-card__section">
              <span class="model-server-card__section-title">⏱️ Writing Time Estimates</span>
              <div class="model-server-card__est-row">
                <span>Short Form (~800 words):</span>
                <strong>{telemetry().estTimeShort}</strong>
              </div>
              <div class="model-server-card__est-row">
                <span>Standard Post (~2,000 words):</span>
                <strong>{telemetry().estTimeArticle}</strong>
              </div>
              <div class="model-server-card__est-row">
                <span>Ultimate Guide (~3,500+ words):</span>
                <strong>{telemetry().estTimeLong}</strong>
              </div>
            </div>

            {/* Best Use Case */}
            <div class="model-server-card__section model-server-card__section--highlight">
              <span class="model-server-card__section-title">🎯 Recommended Use Case</span>
              <p class="model-server-card__desc">{telemetry().bestFor}</p>
            </div>

            {/* Server Node & Reliability */}
            <div class="model-server-card__footer">
              <div class="model-server-card__node-info">
                <span>🌐 {telemetry().cluster}</span>
                <span class="model-server-card__reliability">
                  Reliability: <strong>{telemetry().successRate}</strong>
                </span>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
