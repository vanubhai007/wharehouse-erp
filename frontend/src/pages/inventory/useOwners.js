import { useEffect, useState } from 'react';
import { customerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';

// Owners are Customer records (Item.owner). The list API returns at most 100
// per request, so every page is fetched until all owners are loaded.
const PAGE_SIZE = 100;

export const ownerName = (owner) => owner?.businessName || owner?.name || '-';

export async function fetchAllOwners() {
  const byId = new Map();
  let page = 1;
  let totalPages = 1;
  do {
    const res = await customerApi.list({ page, limit: PAGE_SIZE });
    res.data.data.forEach((o) => byId.set(o._id, o));
    totalPages = res.data.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);
  return [...byId.values()].sort((a, b) => ownerName(a).localeCompare(ownerName(b)));
}

export default function useOwners() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchAllOwners()
      .then((list) => active && setOwners(list))
      .catch((err) => active && setError(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return { owners, loading, error };
}
