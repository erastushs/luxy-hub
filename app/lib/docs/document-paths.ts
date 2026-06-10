import path from 'path'

const DOCS_ROOT = path.join(process.cwd(), 'docs')

export const DOC_PATHS = {
  apiIntegration: path.join(DOCS_ROOT, 'archive', 'integration', 'API_INTEGRATION.md'),
  apiSpec: path.join(DOCS_ROOT, 'archive', 'integration', 'API_SPEC.md'),
  architecture: path.join(DOCS_ROOT, 'architecture', 'ARCHITECTURE.md'),
} as const
