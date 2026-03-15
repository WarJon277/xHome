import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [username, setUsername] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load state from localStorage on mount
    const storedUsername = localStorage.getItem('portal_username');
    const storedIsAdmin = localStorage.getItem('portal_is_admin');
    
    if (storedUsername) {
      setUsername(storedUsername);
      setIsAdmin(storedIsAdmin === 'true');
      setIsRegistered(true);
    }
    
    setIsLoading(false);
  }, []);

  const register = (name, adminStatus) => {
    localStorage.setItem('portal_username', name);
    localStorage.setItem('portal_is_admin', adminStatus ? 'true' : 'false');
    
    setUsername(name);
    setIsAdmin(adminStatus);
    setIsRegistered(true);
  };

  const logout = () => {
    localStorage.removeItem('portal_username');
    localStorage.removeItem('portal_is_admin');
    
    setUsername(null);
    setIsAdmin(false);
    setIsRegistered(false);
  };

  return (
    <UserContext.Provider value={{ username, isAdmin, isRegistered, isLoading, register, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
