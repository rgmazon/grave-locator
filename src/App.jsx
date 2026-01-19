import { useState, useEffect } from 'react';
import MapPage from './MapPage';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import AuthModal from './components/AuthModal';
import { supabase } from './supabaseClient.js';
import { useNotifications } from './components/NotificationProvider';

function App() {
  // Use state to switch between 'map' and 'admin' views
  const [view, setView] = useState('map');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  // Debug profile state changes
  useEffect(() => {
    console.log('Profile state changed:', profile);
  }, [profile]);

  useEffect(() => {
    // Check current session and load profile
    const init = async () => {
      console.log('Initializing auth...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        console.log('User found, loading profile for:', currentUser.id);
        await loadProfile(currentUser.id);
      }
    };
    
    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state change:', _event);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    console.log('loadProfile called for:', userId);
    try {
      // Try direct fetch first to test connectivity
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('Trying direct fetch to:', supabaseUrl);
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Fetch response status:', response.status);
      const data = await response.json();
      console.log('Fetch response data:', data);
      
      if (data && data.length > 0) {
        console.log('Setting profile:', data[0]);
        setProfile(data[0]);
      } else {
        console.log('No profile found');
        setProfile(null);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
      setProfile(null);
    }
  }

  const { add } = useNotifications() || {};

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setView('map');
    add && add('Signed out successfully', { type: 'success' });
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased">
      {/* NAVIGATION BAR */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          {/* Logo */}
          <h1 className="text-lg font-semibold text-gray-900">
            Grave Locator
          </h1>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            <button 
              onClick={() => setView('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                view === 'map' 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Map
            </button>
            {user && (
              <button
                onClick={() => setView('user')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  view === 'user' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                My Submissions
              </button>
            )}
            {profile?.is_admin && (
              <button 
                onClick={() => {
                  console.log('Admin panel clicked, profile:', profile);
                  setView('admin');
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  view === 'admin' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Admin
              </button>
            )}
            
            <div className="w-px h-6 bg-gray-200 mx-2"></div>
            
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md text-sm font-medium transition"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Nav */}
          <div className="flex md:hidden items-center space-x-3">
            {!user && (
              <button
                onClick={() => setShowAuth(true)}
                className="px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium"
              >
                Sign In
              </button>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-gray-100 space-y-1 max-w-7xl mx-auto">
            <button 
              onClick={() => { setView('map'); setMenuOpen(false); }}
              className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition ${
                view === 'map' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Map
            </button>
            {user && (
              <button
                onClick={() => { setView('user'); setMenuOpen(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition ${
                  view === 'user' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                My Submissions
              </button>
            )}
            {profile?.is_admin && (
              <button 
                onClick={() => { setView('admin'); setMenuOpen(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition ${
                  view === 'admin' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Admin
              </button>
            )}
            {user && (
              <>
                <div className="border-t border-gray-100 my-2"></div>
                <div className="px-4 py-2 text-sm text-gray-500">{user.email}</div>
                <button
                  onClick={() => { handleSignOut(); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="h-[calc(100vh-60px)]">
        {view === 'map' ? (
          <MapPage user={user} onRequestAuth={() => setShowAuth(true)} />
        ) : view === 'user' ? (
          <UserDashboard user={user} />
        ) : view === 'admin' && profile?.is_admin ? (
          <AdminDashboard />
        ) : (
          <MapPage user={user} onRequestAuth={() => setShowAuth(true)} />
        )}
      </main>

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={(user) => {
            setUser(user);
            setShowAuth(false);
          }}
        />
      )}
    </div>
  );
}

export default App;