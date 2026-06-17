import path from 'path'

const DOCS_ROOT = path.join(process.cwd(), 'docs')

export const DOC_PATHS = {
  apiReference: path.join(DOCS_ROOT, 'api', 'REFERENCE.md'),
  apiIntegration: path.join(DOCS_ROOT, 'archive', 'integration', 'API_INTEGRATION.md'),
  apiSpec: path.join(DOCS_ROOT, 'archive', 'integration', 'API_SPEC.md'),
  architecture: path.join(DOCS_ROOT, 'architecture', 'ARCHITECTURE.md'),
  eventPlatform: path.join(DOCS_ROOT, 'integration', 'EVENT_PLATFORM_INTEGRATION.md'),
  eventPlatformQuickstart: path.join(DOCS_ROOT, 'integration', 'EVENT_PLATFORM_QUICKSTART.md'),
  phase7bRuntimeIntegration: path.join(DOCS_ROOT, 'phases', 'phase7', 'PHASE_7B_RUNTIME_INTEGRATION_SPEC.md'),
} as const
