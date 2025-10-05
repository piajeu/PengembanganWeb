'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Brand {
  id: number;
  name: string;
  description?: string;
  status: boolean;
  createdAt: string;
  _count?: { products: number };
}

export default function BrandsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: 0, name: '', description: '', status: true });
  const [loading, setLoading] = useState(true);  // Init true untuk cover flicker
  const [error, setError] = useState('');
  const limit = 10;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user?.role !== 'admin') {
      router.push('/login');
      return;
    }
    fetchBrands();  // Fetch sekali di mount
  }, [session, status, router]);  // Hapus token dep, biar nggak re-fetch

  const fetchBrands = async (page = 1, q = search) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), search: q });
      const res = await fetch(`${API_BASE}/api/admin/brands?${params}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}: Route not found or server error. Check backend at port 3001.`);
      }
      const data = await res.json();
      setBrands(data.brands || []);
      setTotal(data.total || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Fetch brands error:', error);
      setError((error as Error).message);
    } finally {
      setLoading(false);  // Set false di akhir, hilangkan flicker
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const method = formData.id ? 'PUT' : 'POST';
      const url = formData.id ? `${API_BASE}/api/admin/brands/${formData.id}` : `${API_BASE}/api/admin/brands`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: formData.name, description: formData.description, status: formData.status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setIsModalOpen(false);
      setFormData({ id: 0, name: '', description: '', status: true });
      fetchBrands(currentPage, search);
      alert('Sukses simpan brand!');
    } catch (error) {
      console.error('Submit error:', error);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setFormData({ id: brand.id, name: brand.name, description: brand.description || '', status: brand.status });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin hapus brand ini?')) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/brands/${id}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      fetchBrands(currentPage, search);
      alert('Brand dihapus!');
    } catch (error) {
      console.error('Delete error:', error);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (status === 'loading') {
    return <div className="p-6 text-center">Loading session...</div>;  // Hindari flicker awal
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Kelola Brand Produk</h1>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">Tambah Brand</button>
      </div>

      <div className="form-control">
        <input
          type="text"
          placeholder="Cari brand..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); fetchBrands(1, e.target.value); }}
          className="input input-bordered"
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="text-center">Loading brands...</div>  // Spinner sederhana
      ) : brands.length === 0 ? (
        <div className="text-center text-gray-500">Tidak ada brand. Tambah yang pertama!</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>No.</th>
                <th>Nama</th>
                <th>Deskripsi</th>
                <th>Status</th>
                <th>Produk</th>
                <th>Tanggal Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand, index) => (
                <tr key={brand.id}>
                  <th>{(currentPage - 1) * limit + index + 1}</th>
                  <td>{brand.name}</td>
                  <td>{brand.description || '-'}</td>
                  <td><span className={`badge ${brand.status ? 'badge-success' : 'badge-error'}`}>{brand.status ? 'Aktif' : 'Tidak Aktif'}</span></td>
                  <td>{brand._count?.products || 0}</td>
                  <td>{new Date(brand.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => handleEdit(brand)} className="btn btn-sm btn-info mr-2">Edit</button>
                    <button onClick={() => handleDelete(brand.id)} className="btn btn-sm btn-error">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="join">
        <button onClick={() => fetchBrands(currentPage - 1, search)} disabled={currentPage === 1} className="btn join-item">Sebelumnya</button>
        <button className="btn join-item no-animation">{currentPage} / {totalPages}</button>
        <button onClick={() => fetchBrands(currentPage + 1, search)} disabled={currentPage === totalPages} className="btn join-item">Selanjutnya</button>
      </div>

      {isModalOpen && (
        <dialog open className="modal">
          <form method="dialog" className="modal-box" onSubmit={handleSubmit}>
            <h3 className="font-bold text-lg">{formData.id ? 'Edit Brand' : 'Tambah Brand Baru'}</h3>
            <input
              type="text"
              placeholder="Nama Brand"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input input-bordered w-full mt-4"
              required
            />
            <textarea
              placeholder="Deskripsi (opsional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="textarea textarea-bordered w-full mt-2"
            />
            <select
              value={formData.status.toString()}
              onChange={(e) => setFormData({ ...formData, status: e.target.value === 'true' })}
              className="select select-bordered w-full mt-2"
            >
              <option value="true">Aktif</option>
              <option value="false">Tidak Aktif</option>
            </select>
            <div className="modal-action mt-4">
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button type="button" onClick={() => { setIsModalOpen(false); setFormData({ id: 0, name: '', description: '', status: true }); }} className="btn">Batal</button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}