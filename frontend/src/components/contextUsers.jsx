// contexts/UserContext.js
import { createContext, useState, useContext } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  // ✅ Inicializamos directamente leyendo el localStorage de forma síncrona
  const [user, setUserState] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Error al leer el usuario del localStorage", error);
      return null;
    }
  });

  // setUser que también guarda o elimina del localStorage
  const setUser = (u) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('token'); // Opcional: limpiar token también si cierras sesión
      localStorage.removeItem('rol');
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);