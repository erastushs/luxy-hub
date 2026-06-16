import path from 'path'

const DOCS_ROOT = path.join(process.cwd(), 'docs')

export type DocsSection = {
  title: string
  href: string
  description: string
  group: 'Start' | 'Build' | 'Operate' | 'Reference' | 'Architecture' | 'Releases'
  sourcePaths: string[]
  quickLinks: { label: string; href: string }[]
  related: string[]
  sectionNav: string[]
  parent?: string
}

export const docsGroups = ['Start', 'Build', 'Operate', 'Reference', 'Architecture', 'Releases'] as const

export type DocsGroup = (typeof docsGroups)[number]

const ADR_PATHS = Array.from({ length: 9 }, (_, i) => {
  const num = String(i + 1).padStart(3, '0')
  const files: Record<string, string> = {
    '001': 'delivery-session-authorization-boundary',
    '002': 'postgres-backed-event-queue',
    '003': 'github-actions-event-worker-scheduler',
    '004': 'inline-alert-evaluation',
    '005': 'build-automation-failure-model',
    '006': 'verification-logs-as-monitoring-counters',
    '007': 'webhook-credential-storage-risk',
    '008': 'payload-secret-fallback-policy',
    '009': 'license-authorization-model',
  }
  return path.join(DOCS_ROOT, 'architecture', 'decisions', `ADR-${num}-${files[num]}.md`)
})

export const docsSections: DocsSection[] = [
  {
    title: 'Getting Started',
    href: '/docs/getting-started',
    description: 'First steps, source-of-truth documents, and the fastest path into LuxyHub workflows.',
    group: 'Start',
    sourcePaths: [path.join(DOCS_ROOT, 'GETTING_STARTED.md')],
    quickLinks: [
      { label: 'Dashboard workflows', href: '/docs/dashboard' },
      { label: 'Scripts', href: '/docs/scripts' },
      { label: 'Reference', href: '/docs/reference' },
    ],
    related: ['scripts', 'dashboard', 'troubleshooting'],
    sectionNav: ['Quick Navigation', 'Popular Tasks', 'Current Source Of Truth'],
  },
  {
    title: 'Dashboard',
    href: '/docs/dashboard',
    description: 'Creator control-plane workflows for scripts, licenses, events, profile, and release validation.',
    group: 'Start',
    sourcePaths: [path.join(DOCS_ROOT, 'dashboard', 'DASHBOARD_WORKFLOWS.md')],
    quickLinks: [
      { label: 'Open dashboard', href: '/dashboard' },
      { label: 'Scripts', href: '/docs/scripts' },
      { label: 'Licenses', href: '/docs/licenses' },
    ],
    related: ['getting-started', 'scripts', 'analytics'],
    sectionNav: ['Quick Navigation', 'Scripts Workflow', 'Licenses Workflow', 'Profile Workflow'],
  },
  {
    title: 'Event Platform',
    href: '/docs/event-platform',
    description: 'Event platform integration guide for connecting external services to LuxyHub event system.',
    group: 'Start',
    sourcePaths: [path.join(DOCS_ROOT, 'integration', 'EVENT_PLATFORM_INTEGRATION.md')],
    quickLinks: [
      { label: 'Quickstart', href: '/docs/event-platform/quickstart' },
      { label: 'Analytics', href: '/docs/analytics' },
      { label: 'Operations', href: '/docs/operations' },
    ],
    related: ['analytics', 'operations', 'getting-started'],
    sectionNav: ['Overview', 'Setup', 'Configuration'],
  },
  {
    title: 'Event Platform Quickstart',
    href: '/docs/event-platform/quickstart',
    description: 'Quickstart guide for event platform integration.',
    group: 'Start',
    sourcePaths: [path.join(DOCS_ROOT, 'integration', 'EVENT_PLATFORM_QUICKSTART.md')],
    quickLinks: [
      { label: 'Event Platform', href: '/docs/event-platform' },
      { label: 'Analytics', href: '/docs/analytics' },
    ],
    related: ['event-platform', 'analytics'],
    sectionNav: ['Quickstart'],
    parent: '/docs/event-platform',
  },
  {
    title: 'Scripts',
    href: '/docs/scripts',
    description: 'Script metadata, access modes, visibility, builds, versions, and creator workflows.',
    group: 'Build',
    sourcePaths: [
      path.join(DOCS_ROOT, 'features', 'SCRIPTS.md'),
      path.join(DOCS_ROOT, 'features', 'ACCESS_MODES.md'),
    ],
    quickLinks: [
      { label: 'Dashboard scripts', href: '/dashboard/scripts' },
      { label: 'Delivery', href: '/docs/delivery' },
      { label: 'Licenses', href: '/docs/licenses' },
    ],
    related: ['keys', 'licenses', 'delivery'],
    sectionNav: ['Scripts', 'Access Modes', 'Related Documents'],
  },
  {
    title: 'Keys',
    href: '/docs/keys',
    description: 'Free key flow, validation behavior, and how keys relate to public access modes.',
    group: 'Build',
    sourcePaths: [path.join(DOCS_ROOT, 'features', 'KEYS.md')],
    quickLinks: [
      { label: 'API reference', href: '/docs/reference' },
      { label: 'Scripts', href: '/docs/scripts' },
      { label: 'Troubleshooting', href: '/docs/troubleshooting' },
    ],
    related: ['scripts', 'licenses', 'reference'],
    sectionNav: ['Key System', 'Runtime Usage', 'Related Documents'],
  },
  {
    title: 'Licenses',
    href: '/docs/licenses',
    description: 'Premium license management, runtime licensing, and assignment concepts.',
    group: 'Build',
    sourcePaths: [
      path.join(DOCS_ROOT, 'features', 'LICENSES.md'),
      path.join(DOCS_ROOT, 'features', 'RUNTIME_LICENSING.md'),
      path.join(DOCS_ROOT, 'features', 'LICENSE_ASSIGNMENTS.md'),
    ],
    quickLinks: [
      { label: 'License dashboard', href: '/dashboard/licenses' },
      { label: 'Analytics', href: '/docs/analytics' },
      { label: 'Reference', href: '/docs/reference' },
    ],
    related: ['scripts', 'keys', 'analytics'],
    sectionNav: ['Licenses', 'Runtime Licensing', 'License Assignments'],
  },
  {
    title: 'Delivery',
    href: '/docs/delivery',
    description: 'Secure script delivery, delivery sessions, loader integration, and runtime payloads.',
    group: 'Build',
    sourcePaths: [
      path.join(DOCS_ROOT, 'features', 'DELIVERY.md'),
      path.join(DOCS_ROOT, 'features', 'SECURE_DELIVERY.md'),
      path.join(DOCS_ROOT, 'runtime', 'DELIVERY_SESSIONS.md'),
    ],
    quickLinks: [
      { label: 'Scripts', href: '/docs/scripts' },
      { label: 'Reference', href: '/docs/reference' },
      { label: 'Operations', href: '/docs/operations' },
    ],
    related: ['scripts', 'analytics', 'operations'],
    sectionNav: ['Delivery', 'Secure Delivery', 'Delivery Sessions'],
  },
  {
    title: 'Analytics',
    href: '/docs/analytics',
    description: 'Analytics V2 surfaces, metrics interpretation, event platform context, and dashboard visibility.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'features', 'ANALYTICS_V2.md'),
      path.join(DOCS_ROOT, 'features', 'EVENT_PLATFORM.md'),
    ],
    quickLinks: [
      { label: 'Analytics dashboard', href: '/dashboard/analytics' },
      { label: 'Operations', href: '/docs/operations' },
      { label: 'Troubleshooting', href: '/docs/troubleshooting' },
    ],
    related: ['delivery', 'dashboard', 'operations'],
    sectionNav: ['Analytics V2', 'Event Platform', 'Related Documents'],
  },
  {
    title: 'Operations',
    href: '/docs/operations',
    description: 'Production deployment, monitoring, incident response, event queue, backups, and secret rotation.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'operations', 'PRODUCTION_DEPLOYMENT.md'),
      path.join(DOCS_ROOT, 'operations', 'MONITORING.md'),
      path.join(DOCS_ROOT, 'operations', 'INCIDENT_RESPONSE.md'),
      path.join(DOCS_ROOT, 'operations', 'EVENT_QUEUE_RUNBOOK.md'),
      path.join(DOCS_ROOT, 'operations', 'SECRET_ROTATION.md'),
      path.join(DOCS_ROOT, 'operations', 'BUILD_OPERATIONS.md'),
    ],
    quickLinks: [
      { label: 'Deployment', href: '/docs/operations/deployment' },
      { label: 'Monitoring', href: '/docs/operations/monitoring' },
      { label: 'Incident Response', href: '/docs/operations/incident-response' },
      { label: 'Backup & Recovery', href: '/docs/operations/backup-recovery' },
    ],
    related: ['delivery', 'analytics', 'troubleshooting'],
    sectionNav: ['Production Deployment', 'Monitoring', 'Incident Response', 'Event Queue Runbook'],
  },
  {
    title: 'Deployment',
    href: '/docs/operations/deployment',
    description: 'Production deployment checklist, environment variables, and infrastructure configuration.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'deployment', 'DEPLOYMENT_CHECKLIST.md'),
      path.join(DOCS_ROOT, 'operations', 'ENVIRONMENT_VARIABLES.md'),
    ],
    quickLinks: [
      { label: 'Operations overview', href: '/docs/operations' },
      { label: 'Monitoring', href: '/docs/operations/monitoring' },
      { label: 'Production validation', href: '/docs/operations/production-validation' },
    ],
    related: ['operations', 'operations/monitoring', 'operations/production-validation'],
    sectionNav: ['Pre-Deployment Verification', 'Deployment Steps', 'Post-Deployment'],
    parent: '/docs/operations',
  },
  {
    title: 'Monitoring',
    href: '/docs/operations/monitoring',
    description: 'Production monitoring configuration, health checks, alert thresholds, and observability setup.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'operations', 'MONITORING.md'),
    ],
    quickLinks: [
      { label: 'Operations overview', href: '/docs/operations' },
      { label: 'Incident Response', href: '/docs/operations/incident-response' },
    ],
    related: ['operations', 'operations/incident-response', 'analytics'],
    sectionNav: ['Monitoring'],
    parent: '/docs/operations',
  },
  {
    title: 'Incident Response',
    href: '/docs/operations/incident-response',
    description: 'Incident response procedures, escalation paths, and common failure scenarios.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'operations', 'INCIDENT_RESPONSE.md'),
    ],
    quickLinks: [
      { label: 'Operations overview', href: '/docs/operations' },
      { label: 'Monitoring', href: '/docs/operations/monitoring' },
      { label: 'Backup & Recovery', href: '/docs/operations/backup-recovery' },
    ],
    related: ['operations', 'operations/monitoring', 'operations/backup-recovery'],
    sectionNav: ['Incident Response'],
    parent: '/docs/operations',
  },
  {
    title: 'Backup & Recovery',
    href: '/docs/operations/backup-recovery',
    description: 'Backup strategies, disaster recovery procedures, and data restoration runbooks.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'operations', 'BACKUP_DR.md'),
    ],
    quickLinks: [
      { label: 'Operations overview', href: '/docs/operations' },
      { label: 'Incident Response', href: '/docs/operations/incident-response' },
    ],
    related: ['operations', 'operations/incident-response', 'operations/deployment'],
    sectionNav: ['Backup and Disaster Recovery'],
    parent: '/docs/operations',
  },
  {
    title: 'Production Validation',
    href: '/docs/operations/production-validation',
    description: 'Production validation reports, pre-release checks, and infrastructure readiness assessments.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'deployment', 'PRODUCTION_VALIDATION_REPORT.md'),
    ],
    quickLinks: [
      { label: 'Operations overview', href: '/docs/operations' },
      { label: 'Deployment', href: '/docs/operations/deployment' },
    ],
    related: ['operations', 'operations/deployment', 'releases/status'],
    sectionNav: ['Production Validation'],
    parent: '/docs/operations',
  },
  {
    title: 'Reference',
    href: '/docs/reference',
    description: 'Canonical V1 API reference, active endpoint contracts, and response conventions.',
    group: 'Reference',
    sourcePaths: [path.join(DOCS_ROOT, 'api', 'REFERENCE.md')],
    quickLinks: [
      { label: 'API Reference', href: '/docs/reference/api' },
      { label: 'Database Schema', href: '/docs/reference/database' },
      { label: 'Architecture', href: '/docs/reference/architecture' },
      { label: 'ADRs', href: '/docs/reference/adrs' },
    ],
    related: ['getting-started', 'delivery', 'operations'],
    sectionNav: ['Conventions', 'Key System', 'Scripts', 'Delivery', 'Events'],
  },
  {
    title: 'API Reference',
    href: '/docs/reference/api',
    description: 'Complete V1 API reference with endpoint contracts, request/response formats, and authentication.',
    group: 'Reference',
    sourcePaths: [path.join(DOCS_ROOT, 'api', 'REFERENCE.md')],
    quickLinks: [
      { label: 'Reference overview', href: '/docs/reference' },
      { label: 'Database Schema', href: '/docs/reference/database' },
      { label: 'Architecture', href: '/docs/reference/architecture' },
    ],
    related: ['reference', 'reference/database', 'reference/architecture'],
    sectionNav: ['Conventions', 'Key System', 'Scripts', 'Delivery', 'Events'],
    parent: '/docs/reference',
  },
  {
    title: 'Database Schema',
    href: '/docs/reference/database',
    description: 'Complete database schema, migrations history, and RLS policy documentation.',
    group: 'Reference',
    sourcePaths: [
      path.join(DOCS_ROOT, 'database', 'SCHEMA.md'),
      path.join(DOCS_ROOT, 'database', 'MIGRATIONS.md'),
      path.join(DOCS_ROOT, 'database', 'RLS_POLICIES.md'),
    ],
    quickLinks: [
      { label: 'Reference overview', href: '/docs/reference' },
      { label: 'API Reference', href: '/docs/reference/api' },
      { label: 'ADRs', href: '/docs/reference/adrs' },
    ],
    related: ['reference', 'reference/api', 'reference/adrs'],
    sectionNav: ['Schema', 'Migrations', 'RLS Policies'],
    parent: '/docs/reference',
  },
  {
    title: 'Architecture Overview',
    href: '/docs/reference/architecture',
    description: 'Current implementation architecture, route topology, and system design overview.',
    group: 'Reference',
    sourcePaths: [
      path.join(DOCS_ROOT, 'architecture', 'ARCHITECTURE.md'),
      path.join(DOCS_ROOT, 'architecture', 'PHASE7_LICENSE_ARCHITECTURE.md'),
    ],
    quickLinks: [
      { label: 'Reference overview', href: '/docs/reference' },
      { label: 'Architecture Center', href: '/docs/architecture' },
      { label: 'ADRs', href: '/docs/reference/adrs' },
    ],
    related: ['reference', 'reference/adrs', 'architecture'],
    sectionNav: ['Architecture'],
    parent: '/docs/reference',
  },
  {
    title: 'ADRs',
    href: '/docs/reference/adrs',
    description: 'Architecture Decision Records (ADR-001 through ADR-009) documenting key technical decisions.',
    group: 'Reference',
    sourcePaths: ADR_PATHS,
    quickLinks: [
      { label: 'Reference overview', href: '/docs/reference' },
      { label: 'Architecture Overview', href: '/docs/reference/architecture' },
      { label: 'Architecture Center', href: '/docs/architecture' },
    ],
    related: ['reference', 'reference/architecture', 'architecture'],
    sectionNav: ['Architecture Decision Records'],
    parent: '/docs/reference',
  },
  {
    title: 'Troubleshooting',
    href: '/docs/troubleshooting',
    description: 'Production issue diagnosis, common symptoms, validation checks, and escalation references.',
    group: 'Reference',
    sourcePaths: [path.join(DOCS_ROOT, 'TROUBLESHOOTING.md')],
    quickLinks: [
      { label: 'Operations', href: '/docs/operations' },
      { label: 'Reference', href: '/docs/reference' },
      { label: 'Dashboard', href: '/docs/dashboard' },
    ],
    related: ['operations', 'delivery', 'getting-started'],
    sectionNav: ['Troubleshooting', 'Common Checks', 'Escalation'],
  },
  {
    title: 'Architecture',
    href: '/docs/architecture',
    description: 'Complete system architecture: route topology, runtime design, security posture, and deployment model.',
    group: 'Architecture',
    sourcePaths: [path.join(DOCS_ROOT, 'architecture', 'ARCHITECTURE.md')],
    quickLinks: [
      { label: 'License System', href: '/docs/architecture/license-system' },
      { label: 'Runtime', href: '/docs/architecture/runtime' },
      { label: 'Decisions', href: '/docs/architecture/decisions' },
    ],
    related: ['reference/architecture', 'architecture/license-system', 'architecture/decisions'],
    sectionNav: ['Architecture'],
  },
  {
    title: 'License System',
    href: '/docs/architecture/license-system',
    description: 'Phase 7 license architecture: access modes, keys, license authorization, and runtime enforcement.',
    group: 'Architecture',
    sourcePaths: [path.join(DOCS_ROOT, 'architecture', 'PHASE7_LICENSE_ARCHITECTURE.md')],
    quickLinks: [
      { label: 'Architecture overview', href: '/docs/architecture' },
      { label: 'Runtime', href: '/docs/architecture/runtime' },
      { label: 'Licenses', href: '/docs/licenses' },
    ],
    related: ['architecture', 'architecture/runtime', 'licenses'],
    sectionNav: ['License System Architecture'],
    parent: '/docs/architecture',
  },
  {
    title: 'Runtime',
    href: '/docs/architecture/runtime',
    description: 'Script runtime architecture: build pipeline, secure delivery, event queue, and delivery sessions.',
    group: 'Architecture',
    sourcePaths: [
      path.join(DOCS_ROOT, 'runtime', 'BUILD_PIPELINE.md'),
      path.join(DOCS_ROOT, 'runtime', 'SECURE_DELIVERY.md'),
      path.join(DOCS_ROOT, 'runtime', 'EVENT_QUEUE.md'),
      path.join(DOCS_ROOT, 'runtime', 'DELIVERY_SESSIONS.md'),
      path.join(DOCS_ROOT, 'operations', 'BUILD_OPERATIONS.md'),
    ],
    quickLinks: [
      { label: 'Architecture overview', href: '/docs/architecture' },
      { label: 'License System', href: '/docs/architecture/license-system' },
      { label: 'Delivery', href: '/docs/delivery' },
    ],
    related: ['architecture', 'architecture/license-system', 'delivery'],
    sectionNav: ['Build Pipeline', 'Secure Delivery', 'Event Queue', 'Delivery Sessions'],
    parent: '/docs/architecture',
  },
  {
    title: 'Decisions',
    href: '/docs/architecture/decisions',
    description: 'Architecture Decision Records (ADR-001 through ADR-009) documenting key technical decisions.',
    group: 'Architecture',
    sourcePaths: ADR_PATHS,
    quickLinks: [
      { label: 'Architecture overview', href: '/docs/architecture' },
      { label: 'License System', href: '/docs/architecture/license-system' },
      { label: 'Reference ADRs', href: '/docs/reference/adrs' },
    ],
    related: ['architecture', 'reference/adrs', 'architecture/license-system'],
    sectionNav: ['Architecture Decision Records'],
    parent: '/docs/architecture',
  },
  {
    title: 'Release Checklist',
    href: '/docs/releases/checklist',
    description: 'Release Candidate validation checklist covering soak testing, analytics, licensing, delivery, and rollback readiness.',
    group: 'Releases',
    sourcePaths: [path.join(DOCS_ROOT, 'releases', 'RC_CHECKLIST.md')],
    quickLinks: [
      { label: 'Rollout plan', href: '/docs/releases/rollout' },
      { label: 'Rollback plan', href: '/docs/releases/rollback' },
      { label: 'Release status', href: '/docs/releases/status' },
    ],
    related: ['releases/rollout', 'releases/rollback', 'releases/status'],
    sectionNav: ['Release Candidate Checklist'],
  },
  {
    title: 'Rollout Plan',
    href: '/docs/releases/rollout',
    description: 'Release Candidate rollout plan: pre-rollout requirements, deployment strategy, and validation gates.',
    group: 'Releases',
    sourcePaths: [path.join(DOCS_ROOT, 'releases', 'RC_ROLLOUT_PLAN.md')],
    quickLinks: [
      { label: 'Checklist', href: '/docs/releases/checklist' },
      { label: 'Rollback plan', href: '/docs/releases/rollback' },
      { label: 'Release status', href: '/docs/releases/status' },
    ],
    related: ['releases/checklist', 'releases/rollback', 'releases/status'],
    sectionNav: ['Release Candidate Rollout Plan'],
  },
  {
    title: 'Rollback Plan',
    href: '/docs/releases/rollback',
    description: 'Release Candidate rollback plan: rollback drill requirements, recovery procedures, and validation.',
    group: 'Releases',
    sourcePaths: [path.join(DOCS_ROOT, 'releases', 'RC_ROLLBACK_PLAN.md')],
    quickLinks: [
      { label: 'Checklist', href: '/docs/releases/checklist' },
      { label: 'Rollout plan', href: '/docs/releases/rollout' },
      { label: 'Release status', href: '/docs/releases/status' },
    ],
    related: ['releases/checklist', 'releases/rollout', 'releases/status'],
    sectionNav: ['Release Candidate Rollback Plan'],
  },
  {
    title: 'Release Status',
    href: '/docs/releases/status',
    description: 'Current Release Candidate status: completed phases, remaining requirements, and production readiness.',
    group: 'Releases',
    sourcePaths: [
      path.join(DOCS_ROOT, 'releases', 'RC_STATUS.md'),
      path.join(DOCS_ROOT, 'PROJECT_STATUS.md'),
      path.join(DOCS_ROOT, 'releases', 'RC_TEST_PLAN.md'),
      path.join(DOCS_ROOT, 'releases', 'ROLLBACK_DRILL_REPORT.md'),
      path.join(DOCS_ROOT, 'releases', 'PRODUCTION_READINESS_REPORT.md'),
    ],
    quickLinks: [
      { label: 'Checklist', href: '/docs/releases/checklist' },
      { label: 'Rollout plan', href: '/docs/releases/rollout' },
      { label: 'Rollback plan', href: '/docs/releases/rollback' },
    ],
    related: ['releases/checklist', 'releases/rollout', 'releases/rollback'],
    sectionNav: ['Release Candidate Status'],
  },
]

export const docsSectionsBySlug = new Map(
  docsSections.map((section) => [section.href.replace('/docs/', ''), section])
)

export function getDocsSection(slug: string) {
  return docsSectionsBySlug.get(slug) ?? null
}

export function getRelatedDocs(section: DocsSection) {
  return section.related
    .map((slug) => docsSectionsBySlug.get(slug))
    .filter((related): related is DocsSection => Boolean(related))
}

export function getChildSections(parentHref: string) {
  return docsSections.filter((s) => s.parent === parentHref)
}

