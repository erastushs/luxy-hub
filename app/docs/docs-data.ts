import path from 'path'

const DOCS_ROOT = path.join(process.cwd(), 'docs')

export type DocsSection = {
  title: string
  href: string
  description: string
  group: 'Start' | 'Build' | 'Operate' | 'Reference'
  sourcePaths: string[]
  quickLinks: { label: string; href: string }[]
  related: string[]
  sectionNav: string[]
}

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
    title: 'Operations',
    href: '/docs/operations',
    description: 'Production deployment, monitoring, incident response, event queue, backups, and secret rotation.',
    group: 'Operate',
    sourcePaths: [
      path.join(DOCS_ROOT, 'operations', 'PRODUCTION_DEPLOYMENT.md'),
      path.join(DOCS_ROOT, 'operations', 'MONITORING.md'),
      path.join(DOCS_ROOT, 'operations', 'INCIDENT_RESPONSE.md'),
      path.join(DOCS_ROOT, 'operations', 'EVENT_QUEUE_RUNBOOK.md'),
    ],
    quickLinks: [
      { label: 'Troubleshooting', href: '/docs/troubleshooting' },
      { label: 'Analytics', href: '/docs/analytics' },
      { label: 'Reference', href: '/docs/reference' },
    ],
    related: ['delivery', 'analytics', 'troubleshooting'],
    sectionNav: ['Production Deployment', 'Monitoring', 'Incident Response', 'Event Queue Runbook'],
  },
  {
    title: 'Reference',
    href: '/docs/reference',
    description: 'Canonical V1 API reference, active endpoint contracts, and response conventions.',
    group: 'Reference',
    sourcePaths: [path.join(DOCS_ROOT, 'api', 'REFERENCE.md')],
    quickLinks: [
      { label: 'Delivery APIs', href: '/docs/delivery' },
      { label: 'Keys', href: '/docs/keys' },
      { label: 'Licenses', href: '/docs/licenses' },
    ],
    related: ['getting-started', 'delivery', 'operations'],
    sectionNav: ['Conventions', 'Key System', 'Scripts', 'Delivery', 'Events'],
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
