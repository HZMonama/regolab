// API Configuration for backend communication
// In development: uses localhost
// In production: uses Cloud Run URL from environment variable

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const API_ENDPOINTS = {
  evaluate: `${API_BASE_URL}/api/evaluate`,
  test: `${API_BASE_URL}/api/test`,
  format: `${API_BASE_URL}/api/format`,
  lint: `${API_BASE_URL}/api/lint`,
  opaStatus: `${API_BASE_URL}/api/opa/status`,
  regalStatus: `${API_BASE_URL}/api/regal/status`,
  version: `${API_BASE_URL}/api/version`,
  versionCheck: `${API_BASE_URL}/api/version/check`,
  templates: `${API_BASE_URL}/api/templates`,
  dataSources: `${API_BASE_URL}/api/data-sources`,
  inputTemplates: `${API_BASE_URL}/api/input-templates`,
} as const;

export { API_BASE_URL };
