import { useState, useEffect, useRef } from 'react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function SearchBar({ graves, onSelectGrave }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [placeResults, setPlaceResults] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    console.log('SearchBar graves:', graves);
  }, [graves]);

  useEffect(() => {
    // Basic grave name search
    if (searchTerm.trim() === '') {
      setFilteredResults([]);
      setPlaceResults([]);
      setIsOpen(false);
      return;
    }

    const term = searchTerm.toLowerCase();
    const graveMatches = (graves || []).filter(grave =>
      grave.deceased_name?.toLowerCase().includes(term)
    ).map(g => ({ type: 'grave', item: g }));

    setFilteredResults(graveMatches);
    setIsOpen(graveMatches.length > 0);

    // Debounced place search using Mapbox Geocoding
    if (!MAPBOX_TOKEN) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoadingPlaces(true);
        const q = encodeURIComponent(searchTerm);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&limit=6`;
        const res = await fetch(url);
        const data = await res.json();
        const places = (data.features || []).map((f, idx) => ({
          id: `place-${f.id || idx}`,
          place_name: f.place_name,
          center: f.center // [lng, lat]
        })).map(p => ({ type: 'place', item: p }));

        setPlaceResults(places);
        setIsOpen(true);
      } catch (e) {
        console.error('Place search error', e);
      } finally {
        setLoadingPlaces(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, graves]);

  const handleSelect = (entry) => {
    // entry: { type: 'grave'|'place', item }
    if (entry.type === 'grave') {
      onSelectGrave(entry.item);
    } else if (entry.type === 'place') {
      const [lng, lat] = entry.item.center;
      onSelectGrave({ deceased_name: entry.item.place_name, lng, lat });
    }

    setSearchTerm('');
    setFilteredResults([]);
    setPlaceResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilteredResults([]);
    setPlaceResults([]);
    setIsOpen(false);
  };

  const combinedResults = [...filteredResults, ...placeResults];

  return (
    <div className="w-full">
      <div className="relative">
        {/* Search Input */}
        <div className="flex items-center bg-gray-50 rounded-md border border-gray-200 focus-within:border-gray-400 focus-within:bg-white transition">
          <svg className="ml-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or place..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm"
          />
          {searchTerm && (
            <button
              onClick={handleClear}
              className="pr-3 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isOpen && (
          <div className="absolute w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
            {combinedResults.length > 0 ? (
              <ul className="py-1">
                {combinedResults.map((entry) => (
                  <li key={entry.type + '-' + (entry.item.id || entry.item.place_name || entry.item.item)}>
                    <button
                      onClick={() => handleSelect(entry)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 transition"
                    >
                      {entry.type === 'grave' ? (
                        <>
                          <div className="font-semibold text-gray-800">{entry.item.deceased_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{entry.item.lat.toFixed(5)}, {entry.item.lng.toFixed(5)}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-gray-800">{entry.item.place_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Place</div>
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                {loadingPlaces ? 'Searching places...' : 'No results found'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      {searchTerm && (
        <div className="mt-2 px-2 text-xs text-gray-600 bg-white/90 rounded py-1 inline-block">
          {combinedResults.length} result{combinedResults.length !== 1 ? 's' : ''} found
        </div>
      )}
    </div>
  );
}
