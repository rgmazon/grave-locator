import { useState, useEffect } from 'react';

export default function SearchBar({ graves, onSelectGrave }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    console.log('SearchBar graves:', graves);
  }, [graves]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredResults([]);
      setIsOpen(false);
      return;
    }

    console.log('Searching for:', searchTerm, 'in', graves?.length, 'graves');
    const results = (graves || []).filter(grave =>
      grave.deceased_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    console.log('Search results:', results);
    setFilteredResults(results);
    setIsOpen(results.length > 0);
  }, [searchTerm, graves]);

  const handleSelect = (grave) => {
    onSelectGrave(grave);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilteredResults([]);
    setIsOpen(false);
  };

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
            placeholder="Search by name..."
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
            {filteredResults.length > 0 ? (
              <ul className="py-1">
                {filteredResults.map((grave) => (
                  <li key={grave.id}>
                    <button
                      onClick={() => handleSelect(grave)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 transition"
                    >
                      <div className="font-semibold text-gray-800">
                        {grave.deceased_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {grave.lat.toFixed(5)}, {grave.lng.toFixed(5)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                No results found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      {searchTerm && (
        <div className="mt-2 px-2 text-xs text-gray-600 bg-white/90 rounded py-1 inline-block">
          {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
        </div>
      )}
    </div>
  );
}
