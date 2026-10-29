const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function submitContactMessage(payload) {
  const response = await fetch(`${API_BASE_URL}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}
