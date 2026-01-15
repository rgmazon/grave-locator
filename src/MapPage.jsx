import { useState, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import GraveSubmission from './assets/GraveSubmission';
import SearchBar from './components/SearchBar';
import { supabase } from './supabaseClient.js';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function MapPage({ user, onRequestAuth }) {
  const [viewState, setViewState] = useState(() => {
    // Try to load saved view state from localStorage
    const savedView = localStorage.getItem('mapViewState');
    if (savedView) {
      try {
        return JSON.parse(savedView);
      } catch (e) {
        console.error('Error parsing saved view state:', e);
      }
    }
    // Default view if no saved state
    return {
      longitude: 121.0, // Default to Philippines
      latitude: 14.5,
      zoom: 10
    };
  });

  const [selectedMarker, setSelectedMarker] = useState(null);
  const [approvedGraves, setApprovedGraves] = useState([]);
  const [selectedGrave, setSelectedGrave] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);

  // Save view state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('mapViewState', JSON.stringify(viewState));
  }, [viewState]);

  // Fetch approved graves on mount
  useEffect(() => {
    fetchApprovedGraves();
  }, []);

  async function fetchApprovedGraves() {
    try {
      // Try using RPC function first (if it exists in Supabase)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_graves_by_status', { grave_status: 'approved' });
      
      if (!rpcError && rpcData) {
        console.log('Fetched approved graves via RPC:', rpcData);
        const parsed = rpcData.map(grave => {
          const match = grave.location_text?.match(/POINT\(([^ ]+) ([^ ]+)\)/);
          if (match) {
            return {
              ...grave,
              lng: parseFloat(match[1]),
              lat: parseFloat(match[2])
            };
          }
          return null;
        }).filter(Boolean);
        console.log('Parsed graves with coordinates:', parsed);
        setApprovedGraves(parsed);
        return;
      }
      
      // Fallback: Query graves table directly and cast location to text
      console.log('RPC not available, using fallback direct query');
      const { data, error } = await supabase
        .from('graves')
        .select('id,deceased_name,birth_date,death_date,image_url,status,submitted_by,created_at')
        .eq('status', 'approved');

      if (error) {
        console.error('Error fetching approved graves:', error);
        return;
      }
      
      console.log('Fetched graves (direct query):', data);
      
      // For each grave, fetch location as text using raw SQL
      const parsed = [];
      for (const grave of data || []) {
        try {
          // Use raw SQL to get ST_AsText for each grave
          const { data: locData, error: locError } = await supabase
            .rpc('get_grave_location', { p_grave_id: grave.id });
          
          if (!locError && locData) {
            const match = locData.match(/POINT\(([^ ]+) ([^ ]+)\)/);
            if (match) {
              parsed.push({
                ...grave,
                lng: parseFloat(match[1]),
                lat: parseFloat(match[2])
              });
            }
          }
        } catch (e) {
          console.log('Could not get location for grave:', grave.id);
        }
      }
      
      console.log('Parsed graves:', parsed);
      setApprovedGraves(parsed);
    } catch (e) {
      console.error('Error in fetchApprovedGraves:', e);
    }
  }

  const handleMapClick = (e) => {
    setSelectedMarker({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    setSelectedGrave(null); // Close any open popup
  };

  const handleSelectGrave = (grave) => {
    // Zoom to the selected grave and show popup
    setViewState({
      longitude: grave.lng,
      latitude: grave.lat,
      zoom: 18, // Close zoom level
      transitionDuration: 1000
    });
    setSelectedGrave(grave);
    setSelectedMarker(null); // Clear any temporary marker
  };

  return (
    <div className="relative w-full h-screen">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        {/* User's temporary marker for new submission */}
        {selectedMarker && (
          <Marker longitude={selectedMarker.lng} latitude={selectedMarker.lat} anchor="bottom">
            <div style={{ fontSize: '32px', cursor: 'pointer' }}>📍</div>
          </Marker>
        )}

        {/* Approved graves markers */}
        {approvedGraves.map((grave) => (
          <Marker
            key={grave.id}
            longitude={grave.lng}
            latitude={grave.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedGrave(grave);
              setSelectedMarker(null); // Clear temporary marker
            }}
          >
            <div style={{ fontSize: '32px', cursor: 'pointer' }}>🪦</div>
          </Marker>
        ))}

        {/* Popup for selected approved grave */}
        {selectedGrave && (
          <Popup
            longitude={selectedGrave.lng}
            latitude={selectedGrave.lat}
            onClose={() => setSelectedGrave(null)}
            closeButton={true}
            closeOnClick={false}
            anchor="bottom"
            maxWidth="320px"
          >
            <div className="p-3 min-w-[200px]">
              <h3 className="font-semibold text-gray-900 text-base mb-2">{selectedGrave.deceased_name}</h3>
              
              {/* Dates */}
              {(selectedGrave.birth_date || selectedGrave.death_date) && (
                <div className="mb-3 text-sm text-gray-600">
                  {selectedGrave.birth_date && selectedGrave.death_date ? (
                    <p>
                      {new Date(selectedGrave.birth_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} — {new Date(selectedGrave.death_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  ) : (
                    <>
                      {selectedGrave.birth_date && <p>Born: {new Date(selectedGrave.birth_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                      {selectedGrave.death_date && <p>Died: {new Date(selectedGrave.death_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                    </>
                  )}
                </div>
              )}

              {/* Photo */}
              {selectedGrave.image_url && (
                <div className="mb-3">
                  <img 
                    src={selectedGrave.image_url} 
                    alt={selectedGrave.deceased_name}
                    className="w-full h-32 object-cover rounded-md"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Coordinates */}
              <p className="text-xs text-gray-400 font-mono">
                {selectedGrave.lat.toFixed(6)}, {selectedGrave.lng.toFixed(6)}
              </p>
            </div>
          </Popup>
        )}
      </Map>

      {/* Floating Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex justify-between items-start gap-2 pointer-events-none">
        {/* Search Panel */}
        <div className="pointer-events-auto flex-shrink-0">
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="h-10 px-4 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition flex items-center gap-2 text-sm text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">Search</span>
            </button>
          ) : (
            <div className="w-80 max-w-[calc(100vw-6rem)] bg-white rounded-lg shadow-lg border border-gray-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-900">Search</span>
                <button
                  onClick={() => setShowSearch(false)}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-3">
                <SearchBar graves={approvedGraves} onSelectGrave={(grave) => { handleSelectGrave(grave); setShowSearch(false); }} />
              </div>
            </div>
          )}
        </div>

        {/* Add Location Panel */}
        <div className="pointer-events-auto flex-shrink-0">
          {!showSubmission ? (
            <button
              onClick={() => setShowSubmission(true)}
              className="h-10 px-4 bg-gray-900 text-white rounded-lg shadow-md hover:bg-gray-800 transition flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Location</span>
            </button>
          ) : (
            <div className="w-80 max-w-[calc(100vw-6rem)] max-h-[calc(100vh-6rem)] overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200">
              <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between z-10">
                <span className="text-sm font-medium text-gray-900">Add Location</span>
                <button
                  onClick={() => {
                    setShowSubmission(false);
                    setSelectedMarker(null);
                  }}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <GraveSubmission 
                  selectedCoords={selectedMarker} 
                  onClear={() => setSelectedMarker(null)}
                  user={user}
                  onRequestAuth={onRequestAuth}
                  onSubmitSuccess={() => { fetchApprovedGraves(); setShowSubmission(false); }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapPage;