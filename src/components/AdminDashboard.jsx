import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNotifications } from './NotificationProvider';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('pending');
  const [graves, setGraves] = useState([]);
  const [edits, setEdits] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrave, setSelectedGrave] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const { add } = useNotifications() || {};

  // Check current user and their admin status
  useEffect(() => {
    checkCurrentUser();
  }, []);

  async function checkCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current auth user:', user);
    
    if (user) {
      // Check if user has profile and is admin
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      console.log('User profile:', profile, 'Error:', error);
      setCurrentUser(profile);
      
      // Get debug info
      const debugData = {
        userId: user.id,
        userEmail: user.email,
        isAdmin: profile?.is_admin || false,
        profileExists: !!profile
      };
      setDebugInfo(debugData);
      console.log('Debug info:', debugData);
    }
  }

  // Fetch graves by status
  async function fetchGraves(status) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('graves')
        .select('id,deceased_name,birth_date,death_date,image_url,status,submitted_by,created_at,location')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching graves:', error);
        add && add('Error loading submissions: ' + error.message, { type: 'error' });
        setGraves([]);
        return;
      }

      // Parse PostGIS POINT if present (string)
      const parsed = (data || []).map((grave) => {
        if (grave.location && typeof grave.location === 'string') {
          const match = grave.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
          if (match) {
            return { ...grave, lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
          }
        }
        return grave;
      });

      setGraves(parsed);
    } catch (e) {
      console.error('Error in fetchGraves:', e);
      add && add('Error loading submissions: ' + e.message, { type: 'error' });
      setGraves([]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch users
  async function fetchUsers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching users:', error);
        add && add('Error loading users: ' + error.message, { type: 'error' });
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch (e) {
      console.error('Error in fetchUsers:', e);
      add && add('Error loading users: ' + e.message, { type: 'error' });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch pending edits
  async function fetchEdits() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('graves_edits')
        .select('id,grave_id,proposed_changes,status,submitted_by,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching edits:', error);
        add && add('Error fetching edits: ' + error.message, { type: 'error' });
        setEdits([]);
      } else {
        setEdits(data || []);
      }
    } catch (e) {
      console.error('Error in fetchEdits:', e);
      add && add('Error fetching edits: ' + e.message, { type: 'error' });
      setEdits([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'edits') {
      fetchEdits();
    } else {
      fetchGraves(activeTab);
    }
  }, [activeTab]);

  // Realtime subscription: notify admin on new pending submissions
  useEffect(() => {
    const subscription = supabase
      .channel('public:graves')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'graves' }, (payload) => {
        const newRow = payload.new;
        if (newRow?.status === 'pending') {
          add && add(`New submission: ${newRow.deceased_name || 'Unknown'}`, { type: 'info' });
          // Optionally refresh pending list
          if (activeTab === 'pending') fetchGraves('pending');
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(subscription); } catch (e) { /* ignore */ }
    };
  }, [add, activeTab]);

  // Listen for new edit submissions so admins see them immediately
  useEffect(() => {
    const sub = supabase
      .channel('public:graves_edits')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'graves_edits' }, (payload) => {
        const newRow = payload.new;
        if (newRow?.status === 'pending') {
          add && add(`New edit submitted: ${newRow.grave_id}`, { type: 'info' });
          if (activeTab === 'edits') fetchEdits();
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(sub); } catch (e) { /* ignore */ }
    };
  }, [add, activeTab]);

  async function approveEdit(editId) {
    try {
      // Load the edit row using Supabase client (applies auth/RLS)
      const { data: edit, error: fetchError } = await supabase
        .from('graves_edits')
        .select('*')
        .eq('id', editId)
        .maybeSingle();

      if (fetchError || !edit) {
        console.error('Failed to load edit', fetchError);
        add && add('Failed to load edit: ' + (fetchError?.message || 'no data'), { type: 'error' });
        return;
      }

      const changes = edit.proposed_changes || {};
      console.log('Applying changes via client:', changes, 'to grave:', edit.grave_id);

      // Apply changes to graves using Supabase client (auth JWT applies)
      const { error: applyError } = await supabase
        .from('graves')
        .update(changes)
        .eq('id', edit.grave_id);

      if (applyError) {
        console.error('Failed to apply changes:', applyError);
        add && add('Failed to apply changes: ' + applyError.message, { type: 'error' });
        return;
      }

      // Mark edit as approved
      const { error: markError } = await supabase
        .from('graves_edits')
        .update({ status: 'approved', reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', editId);

      if (markError) {
        console.error('Failed to mark edit as approved:', markError);
        add && add('Applied changes but failed to mark edit as approved: ' + markError.message, { type: 'error' });
      } else {
        console.log('Edit approved successfully!');
        add && add('Edit approved and applied to record.', { type: 'success' });
        fetchEdits();
        fetchGraves(activeTab);
      }
    } catch (e) {
      console.error('Error approving edit:', e);
      add && add('Error approving edit: ' + e.message, { type: 'error' });
    }
  }

  async function rejectEdit(editId) {
    try {
      const { error } = await supabase
        .from('graves_edits')
        .update({ status: 'rejected', reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', editId);

      if (error) {
        console.error('Failed to reject edit:', error);
        add && add('Failed to reject edit: ' + error.message, { type: 'error' });
      } else {
        add && add('Edit rejected.', { type: 'info' });
        fetchEdits();
      }
    } catch (e) {
      console.error('Error rejecting edit:', e);
      add && add('Error rejecting edit: ' + e.message, { type: 'error' });
    }
  }

  async function updateStatus(id, newStatus) {
    const { error } = await supabase
      .from('graves')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      add && add("Error updating status: " + error.message, { type: 'error' });
    } else {
      add && add(`Successfully ${newStatus} submission!`, { type: 'success' });
      fetchGraves(activeTab);
    }
  }

  async function deleteGrave(id) {
    if (!confirm('Are you sure you want to permanently delete this grave entry?')) return;
    
    const { error } = await supabase
      .from('graves')
      .delete()
      .eq('id', id);

    if (error) {
      add && add("Error deleting: " + error.message, { type: 'error' });
    } else {
      add && add('Successfully deleted!', { type: 'success' });
      fetchGraves(activeTab);
    }
  }

  async function toggleAdminStatus(userId, currentStatus) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);

    if (error) {
      add && add("Error updating admin status: " + error.message, { type: 'error' });
    } else {
      add && add('Admin status updated!', { type: 'success' });
      fetchUsers();
    }
  }

  function parseLocation(locationString) {
    if (!locationString) return { lat: 'N/A', lng: 'N/A' };
    const match = locationString.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (match) {
      return {
        lng: parseFloat(match[1]).toFixed(5),
        lat: parseFloat(match[2]).toFixed(5)
      };
    }
    return { lat: 'N/A', lng: 'N/A' };
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage submissions and users</p>
        </header>

        {/* Debug Info Banner */}
        {debugInfo && !debugInfo.isAdmin && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-bold text-yellow-800 mb-2">⚠️ Admin Access Required</h3>
            <p className="text-sm text-yellow-700 mb-2">
              Your account is not marked as admin. You need admin privileges to view submissions.
            </p>
            <div className="bg-white rounded p-3 font-mono text-xs text-gray-600 space-y-1">
              <div><strong>Your User ID:</strong> {debugInfo.userId}</div>
              <div><strong>Email:</strong> {debugInfo.userEmail}</div>
              <div><strong>Is Admin:</strong> {debugInfo.isAdmin ? 'Yes ✓' : 'No ✗'}</div>
              <div><strong>Profile Exists:</strong> {debugInfo.profileExists ? 'Yes ✓' : 'No ✗'}</div>
            </div>
            <div className="mt-3 text-sm text-yellow-800">
              <strong>To fix this:</strong> Run this SQL in your Supabase SQL Editor:
              <pre className="bg-gray-800 text-green-400 p-2 rounded mt-2 overflow-x-auto">
                UPDATE profiles SET is_admin = true WHERE id = '{debugInfo.userId}';
              </pre>
            </div>
          </div>
        )}

        {debugInfo && debugInfo.isAdmin && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700">
              ✓ Logged in as admin: <strong>{debugInfo.userEmail}</strong>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 flex justify-between items-center">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'pending'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Submissions
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'approved'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'rejected'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('edits')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'edits'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Edits
            </button>
          </nav>
          <button
            onClick={() => {
              if (activeTab === 'users') {
                fetchUsers();
              } else {
                fetchGraves(activeTab);
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : activeTab === 'users' ? (
          <UsersTable users={users} onToggleAdmin={toggleAdminStatus} />
        ) : (
          <GravesTable
            graves={graves}
            status={activeTab}
            onUpdateStatus={updateStatus}
            onDelete={deleteGrave}
            onViewDetails={setSelectedGrave}
          />
        )}
        {activeTab === 'edits' && (
          <EditsTable edits={edits} onApprove={approveEdit} onReject={rejectEdit} />
        )}
      </div>

      {/* Details Modal */}
      {selectedGrave && (
        <GraveDetailsModal
          grave={selectedGrave}
          onClose={() => setSelectedGrave(null)}
          parseLocation={parseLocation}
        />
      )}
    </div>
  );
}

// Graves Table Component
function GravesTable({ graves, status, onUpdateStatus, onDelete, onViewDetails }) {
  function parseLocation(locationString) {
    if (!locationString) return { lat: 'N/A', lng: 'N/A' };
    const match = locationString.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (match) {
      return {
        lng: parseFloat(match[1]).toFixed(5),
        lat: parseFloat(match[2]).toFixed(5)
      };
    }
    return { lat: 'N/A', lng: 'N/A' };
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                Deceased Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                Dates
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                Location
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                Submitted
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {graves.map((grave) => {
              const loc = parseLocation(grave.location_text);
              return (
                <tr key={grave.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">{grave.deceased_name}</div>
                    {grave.image_url && (
                      <span className="text-xs text-blue-500">📷 Has photo</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-500">
                      {grave.birth_date && <div>Born: {new Date(grave.birth_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</div>}
                      {grave.death_date && <div>Died: {new Date(grave.death_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</div>}
                      {!grave.birth_date && !grave.death_date && <div className="text-gray-400">N/A</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-gray-500">
                      {loc.lat}, {loc.lng}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-500">
                      {new Date(grave.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' })}
                    </div>
                    {grave.profiles?.full_name && (
                      <div className="text-xs text-gray-400">by {grave.profiles.full_name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => onViewDetails(grave)}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition font-medium text-xs"
                    >
                      View
                    </button>
                    {status === 'pending' && (
                      <>
                        <button
                          onClick={() => onUpdateStatus(grave.id, 'approved')}
                          className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition font-medium text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onUpdateStatus(grave.id, 'rejected')}
                          className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md transition font-medium text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {status === 'approved' && (
                      <button
                        onClick={() => onUpdateStatus(grave.id, 'rejected')}
                        className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md transition font-medium text-xs"
                      >
                        Revoke
                      </button>
                    )}
                    {status === 'rejected' && (
                      <>
                        <button
                          onClick={() => onUpdateStatus(grave.id, 'approved')}
                          className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition font-medium text-xs"
                          >
                          Approve
                        </button>
                        <button
                          onClick={() => onDelete(grave.id)}
                          className="inline-flex items-center px-3 py-1.5 bg-gray-700 text-white hover:bg-gray-800 rounded-md transition font-medium text-xs"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {graves.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-400 italic">No {status} submissions found.</p>
        </div>
      )}
    </div>
  );
}

// Users Table Component
function UsersTable({ users, onToggleAdmin }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                User
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                Last Updated
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-gray-900">
                    {user.full_name || 'No name set'}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{user.id}</div>
                </td>
                <td className="px-6 py-4">
                  {user.is_admin ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      User
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.updated_at ? new Date(user.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onToggleAdmin(user.id, user.is_admin)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md transition font-medium text-xs ${
                      user.is_admin
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-400 italic">No users found.</p>
        </div>
      )}
    </div>
  );
}

// Grave Details Modal
function GraveDetailsModal({ grave, onClose, parseLocation }) {
  const loc = parseLocation(grave.location_text);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Grave Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Deceased Name
            </label>
            <p className="text-lg font-semibold text-gray-900">{grave.deceased_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Birth Date
              </label>
              <p className="text-sm text-gray-700">
                {grave.birth_date ? new Date(grave.birth_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : 'Not provided'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Death Date
              </label>
              <p className="text-sm text-gray-700">
                {grave.death_date ? new Date(grave.death_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : 'Not provided'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Location (GPS Coordinates)
            </label>
            <p className="text-sm font-mono text-gray-700 bg-gray-50 p-3 rounded-lg">
              Latitude: {loc.lat}<br />
              Longitude: {loc.lng}
            </p>
          </div>

          {grave.image_url && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Photo
              </label>
              <a
                href={grave.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
              >
                {grave.image_url}
              </a>
              <img
                src={grave.image_url}
                alt="Grave"
                className="mt-2 rounded-lg max-h-64 object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Status
              </label>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  grave.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : grave.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {grave.status}
              </span>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Submitted
              </label>
              <p className="text-sm text-gray-700">
                {new Date(grave.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {grave.profiles?.full_name && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Submitted By
              </label>
              <p className="text-sm text-gray-700">{grave.profiles.full_name}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Edits Table Component
function EditsTable({ edits, onApprove, onReject }) {
  // Filter to only show pending edits
  const pendingEdits = edits.filter(e => e.status === 'pending');
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Grave ID</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Proposed Changes</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Submitted</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {pendingEdits.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-700 font-mono">{e.grave_id}</td>
                <td className="px-6 py-4 text-sm text-gray-700 break-words max-w-xl">{JSON.stringify(e.proposed_changes)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => onApprove(e.id)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-xs">Approve</button>
                  <button onClick={() => onReject(e.id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-md text-xs">Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingEdits.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-400 italic">No pending edits found.</p>
        </div>
      )}
    </div>
  );
}