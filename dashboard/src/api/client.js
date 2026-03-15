import router from '@/router/index.js';

const BASE = '/api/dashboard';

async function request(method, path, body) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: {},
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE}${path}`, options);

  if (response.status === 401) {
    router.push({ name: 'login' });
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  get(path) {
    return request('GET', path);
  },

  post(path, body) {
    return request('POST', path, body);
  },

  del(path) {
    return request('DELETE', path);
  },
};
