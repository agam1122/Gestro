/**
 * Dynamically resolves the API and signaling server URL.
 * If running on a local subnet or localhost, it resolves to the current hostname on port 4000.
 * Otherwise, it falls back to the configured environment variable.
 */
export const getApiBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_BASE_URL;
  const hostname = window.location.hostname;
  const isLocalHost = hostname === 'localhost' || 
                      hostname === '127.0.0.1' || 
                      hostname.startsWith('10.') || 
                      hostname.startsWith('192.168.') || 
                      hostname.startsWith('172.');

  if (isLocalHost) {
    return `http://${hostname}:4000`;
  }
  return configuredUrl || 'http://localhost:4000';
};

export const getSocketUrl = () => {
  return getApiBaseUrl();
};
