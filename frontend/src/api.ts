/**
 * Güvenli ve yetkilendirilmiş API istek yardımcısı.
 * localStorage'da kayıtlı JWT token'ı otomatik olarak Authorization başlığına ekler.
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('lojistik_token');
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // FormData değilse ve Content-Type belirtilmemişse JSON kabul et
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

