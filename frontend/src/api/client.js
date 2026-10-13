import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({ baseURL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('hrw_token');
      localStorage.removeItem('hrw_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
}

// Downloads or previews a protected file (PDF/CSV) by fetching it as a blob
// with the auth header attached, since a plain <a href> to a protected API
// route would not carry the Authorization header.
export async function downloadAuthenticated(path, filename, mode = 'download') {
  const res = await client.get(path, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(res.data);
  if (mode === 'view') {
    window.open(blobUrl, '_blank');
    return;
  }
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

export default client;
