import { useState, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient.js';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.error('Missing VITE_MAPBOX_TOKEN - map will not load');
}

function GraveMap() {
  const [viewState, setViewState] = useState({
    longitude: 121.0, // Default to your country/city
    latitude: 14.5,
    zoom: 10
  });

  const [marker, setMarker] = useState(null);
  const [approvedGraves, setApprovedGraves] = useState([]);
  const [selectedGrave, setSelectedGrave] = useState(null);

  // Fetch approved graves on mount
  useEffect(() => {
    fetchApprovedGraves();
  }, []);

  async function fetchApprovedGraves() {
    const { data, error } = await supabase
      .from('graves')
      .select('*')
      .eq('status', 'approved');

    if (error) {
      console.error('Error fetching approved graves:', error);
    } else {
      // Parse PostGIS POINT string format: "POINT(lng lat)"
      const parsed = data.map(grave => {
        const match = grave.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          return {
            ...grave,
            lng: parseFloat(match[1]),
            lat: parseFloat(match[2])
          };
        }
        return null;
      }).filter(Boolean);
      setApprovedGraves(parsed);
    }
  }

  // This function runs when the user clicks the map
  const handleMapClick = (e) => {
    const { lng, lat } = e.lngLat;
    setMarker({ lng, lat });
    setSelectedGrave(null); // Close any open popup
    console.log("Selected Location:", lng, lat);
  };

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12" // Satellite view is best for cemeteries!
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {/* User's temporary marker */}
        {marker && (
          <Marker longitude={marker.lng} latitude={marker.lat} color="red" />
        )}

        {/* Approved graves markers */}
        {approvedGraves.map((grave) => (
          <Marker
            key={grave.id}
            longitude={grave.lng}
            latitude={grave.lat}
            color="green"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedGrave(grave);
              setMarker(null); // Clear temporary marker
            }}
          />
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
          >
            <div className="p-2">
              <h3 className="font-bold text-gray-800">{selectedGrave.deceased_name}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {selectedGrave.lat.toFixed(5)}, {selectedGrave.lng.toFixed(5)}
              </p>
            </div>
          </Popup>
        )}
      </Map>
      
      {marker && (
        <p>You selected: {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}</p>
      )}
    </div>
  );
}

export default GraveMap;