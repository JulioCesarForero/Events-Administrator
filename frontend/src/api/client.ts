const BASE_URL = '/api/v1';

interface RequestOptions extends RequestInit {
  token?: string;
  isBearer?: boolean;
}

async function fetchApi<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, isBearer, headers, ...customConfig } = options;
  
  const authHeader = token 
    ? { Authorization: isBearer ? `Bearer ${token}` : token } 
    : undefined;

  const config: RequestInit = {
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...headers,
    } as HeadersInit,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    let errorMsg = 'Error en la petición';
    try {
      const data = await response.json();
      errorMsg = data.error?.message || data.detail?.[0]?.msg || JSON.stringify(data) || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) => fetchApi<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: any, options?: RequestOptions) => fetchApi<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body?: any, options?: RequestOptions) => fetchApi<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) => fetchApi<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, options?: RequestOptions) => fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};
