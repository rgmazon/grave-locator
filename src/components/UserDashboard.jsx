import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function UserDashboard({ user }) {
  const [graves, setGraves] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchMyGraves();
  }, [user]);

  async function fetchMyGraves() {
    setLoading(true);
    console.log('Fetching graves for user:', user?.id);
    try {
      const { data, error } = await supabase
        .from('graves')
        .select('id,deceased_name,birth_date,death_date,status,created_at,image_url')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false });
      console.log('User graves fetch result:', { data, error });
      if (error) throw error;
      setGraves(data || []);
    } catch (e) {
      console.error('Failed to load graves', e);
      alert('Error loading your submissions: ' + e.message);
      setGraves([]);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(grave) {
    setEditing({ ...grave });
  }

  function closeEdit() {
    setEditing(null);
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (!editing) return;
    const { id, deceased_name, birth_date, death_date, image_url } = editing;

    // Prepare a JSON object with proposed changes
    const proposed = { deceased_name, birth_date, death_date, image_url };
    try {
      const { error } = await supabase.from('graves_edits').insert([{ 
        grave_id: id,
        proposed_changes: proposed,
        status: 'pending',
        submitted_by: user.id
      }]);
      if (error) throw error;
      alert('Edit submitted for admin review');
      closeEdit();
    } catch (err) {
      console.error('Failed to submit edit', err);
      alert('Failed to submit edit for review');
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">My Submissions</h2>
      {loading ? (
        <p>Loading...</p>
      ) : graves.length === 0 ? (
        <p>You have not submitted any graves yet.</p>
      ) : (
        <div className="space-y-3">
          {graves.map((g) => (
            <div key={g.id} className="p-4 bg-white rounded shadow flex justify-between items-center">
              <div>
                <div className="font-medium">{g.deceased_name}</div>
                <div className="text-sm text-gray-500">Status: {g.status}</div>
                <div className="text-sm text-gray-500">Submitted: {new Date(g.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => openEdit(g)} className="px-3 py-1 bg-yellow-50 text-yellow-800 rounded">Edit (submit for review)</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submitEdit} className="bg-white p-6 rounded w-full max-w-lg">
            <h3 className="text-xl font-semibold mb-4">Edit submission (sent for review)</h3>
            <label className="block mb-2">
              <div className="text-sm text-gray-600">Deceased name</div>
              <input value={editing.deceased_name} onChange={(e) => setEditing({ ...editing, deceased_name: e.target.value })} className="w-full border rounded p-2" />
            </label>
            <label className="block mb-2">
              <div className="text-sm text-gray-600">Birth date</div>
              <input type="date" value={editing.birth_date ? editing.birth_date.split('T')[0] : ''} onChange={(e) => setEditing({ ...editing, birth_date: e.target.value })} className="w-full border rounded p-2" />
            </label>
            <label className="block mb-2">
              <div className="text-sm text-gray-600">Death date</div>
              <input type="date" value={editing.death_date ? editing.death_date.split('T')[0] : ''} onChange={(e) => setEditing({ ...editing, death_date: e.target.value })} className="w-full border rounded p-2" />
            </label>
            <label className="block mb-4">
              <div className="text-sm text-gray-600">Image URL</div>
              <input value={editing.image_url || ''} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="w-full border rounded p-2" />
            </label>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={closeEdit} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Submit for review</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
