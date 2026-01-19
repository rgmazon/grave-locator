import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNotifications } from '../components/NotificationProvider';

export default function GraveSubmission({ selectedCoords, onClear, user, onRequestAuth, onSubmitSuccess }) {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { add } = useNotifications() || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCoords) return;
    if (!user) {
      add && add('Please sign in to submit a grave location', { type: 'error' });
      onRequestAuth();
      return;
    }

    setLoading(true);

    // Prepare the data for PostGIS (Geography POINT)
    // IMPORTANT: Longitude comes FIRST in the POINT string
    const pointString = `POINT(${selectedCoords.lng} ${selectedCoords.lat})`;

    const { error } = await supabase
      .from('graves')
      .insert([
        { 
          deceased_name: name,
          birth_date: birthDate || null,
          death_date: deathDate || null,
          image_url: imageUrl || null,
          location: pointString,
          status: 'pending', // Default status for admin review
          submitted_by: user.id
        }
      ]);

    if (error) {
      console.error("Submission error:", error);
      if (error.message.includes('row-level security')) {
        add && add("Database policy restricts anonymous submissions. Check RLS policies.", { type: 'error' });
        // Keep the longer guidance in console
        console.info("Suggested SQL: CREATE POLICY \"Allow anonymous inserts\" ON graves FOR INSERT WITH CHECK (status = 'pending');");
      } else {
        add && add("Error: " + error.message, { type: 'error' });
      }
    } else {
      add && add('Success! Submission waiting for admin approval.', { type: 'success' });
      setName('');
      setBirthDate('');
      setDeathDate('');
      setImageUrl('');
      onClear(); // This will remove the marker from the map
      if (onSubmitSuccess) onSubmitSuccess(); // Notify parent to refresh
    }
    
    setLoading(false);
  };

  return (
    <div>
      {!selectedCoords ? (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-md text-center">
          <p className="text-gray-600 text-sm">
            Click anywhere on the map to select a location.
          </p>
        </div>
      ) : !user ? (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
            <p className="text-amber-800 text-sm">
              Please sign in to submit locations.
            </p>
          </div>
          <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded-md">
            {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
          </div>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={onClear}
              className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition border border-gray-200"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={onRequestAuth}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium py-2 rounded-md transition"
            >
              Sign In
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              required
              placeholder="Full name of deceased"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Date
              </label>
              <input 
                type="date" 
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition text-sm"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Death Date
              </label>
              <input 
                type="date" 
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition text-sm"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo URL
            </label>
            <input 
              type="url" 
              placeholder="https://..."
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition text-sm"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Optional</p>
          </div>

          <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded-md border border-gray-200">
            Location: {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
          </div>

          <div className="flex gap-2 pt-2">
            <button 
              type="button"
              onClick={onClear}
              className="flex-1 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition border border-gray-200"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 rounded-md transition"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
