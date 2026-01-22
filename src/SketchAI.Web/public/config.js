// This file is replaced at runtime by Docker/nginx in production
// In development, this empty file prevents 404 errors
// 
// Production values are injected via environment variables:
// - API_URL: Backend API endpoint
// - APPLICATIONINSIGHTS_CONNECTION_STRING: Application Insights connection string
window.__RUNTIME_CONFIG__ = {};
