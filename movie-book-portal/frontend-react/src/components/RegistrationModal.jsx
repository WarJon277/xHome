import React, { useState, useEffect } from 'react';
import { User, Shield, ArrowRight } from 'lucide-react';

export default function RegistrationModal({ onRegister }) {
  const [name, setName] = useState('');
  const [isAdminCheck, setIsAdminCheck] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Disable body scroll when modal is open
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Пожалуйста, введите ваше имя');
      return;
    }

    if (isAdminCheck) {
      if (password !== '123e4r5') {
        setError('Неверный пароль администратора');
        return;
      }
    }

    onRegister(name.trim(), isAdminCheck);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
      
      {/* Modal */}
      <div 
        className="relative bg-[#1f1f1f] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl z-10 animate-fade-in-up"
        style={{ animation: 'pageFadeIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center border border-red-500/30">
            <User className="text-red-500" size={32} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
          Добро пожаловать
        </h2>
        <p className="text-center text-gray-400 mb-8 text-sm">
          Пожалуйста, представьтесь для входа на портал дома
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">
              Ваше имя
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться?"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Admin Checkbox */}
          <div className="flex items-center ml-1">
            <label className="flex items-center cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isAdminCheck}
                  onChange={(e) => {
                    setIsAdminCheck(e.target.checked);
                    if (!e.target.checked) setPassword('');
                  }}
                />
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isAdminCheck ? 'bg-red-500 border-red-500' : 'bg-transparent border-gray-500 group-hover:border-gray-400'}`}>
                  {isAdminCheck && <Shield size={12} className="text-white" />}
                </div>
              </div>
              <span className="ml-3 text-sm text-gray-300 group-hover:text-white transition-colors">
                Я администратор
              </span>
            </label>
          </div>

          {/* Password Input (Conditional) */}
          {isAdminCheck && (
            <div style={{ animation: 'pageFadeIn 0.2s ease-out forwards' }}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">
                Пароль администратора
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm font-medium text-center py-1 bg-red-400/10 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 mt-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
          >
            Войти на портал <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
