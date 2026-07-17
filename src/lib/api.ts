export function getApiUrl(endpoint: string): string {
  const savedBase = localStorage.getItem("app_api_base_url") || (import.meta as any).env?.VITE_API_BASE_URL || "";
  if (!savedBase) return endpoint;
  
  // Clean trailing slashes from the base and leading slashes from the endpoint
  const base = savedBase.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}
