import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

const NotificationContext = createContext(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

let idCounter = 1;

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, { type = 'info', duration = 4500 } = {}) => {
    const id = idCounter++;
    setToasts((t) => [...t, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((t) => t.filter(x => x.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter(x => x.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ add, remove }}>
      {children}
      <div aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

function Toast({ toast, onClose }) {
  const { type, message } = toast;

  useEffect(() => {
    // no-op: placeholder for entrance animation if needed
  }, []);

  const bg = type === 'success' ? 'bg-green-50 border-green-200' : type === 'error' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200';
  const text = type === 'success' ? 'text-green-800' : type === 'error' ? 'text-red-800' : 'text-gray-800';

  return (
    <div className={`max-w-sm w-full ${bg} border rounded-lg shadow-sm p-3 flex items-start gap-3`}>
      <div className={`flex-shrink-0 mt-0.5 ${text}`}>
        {type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}
      </div>
      <div className="flex-1 text-sm text-gray-700">
        {message}
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 text-sm">×</button>
    </div>
  );
}
