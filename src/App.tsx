/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from './firebase';
import { Layout } from './components/Layout';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from './LanguageContext';

// Real modules
import { Dashboard } from './components/Dashboard';
import { Members } from './components/Members';
import { Crops } from './components/Crops';
import { StoreModule as Store } from './components/Store';
import { Loans } from './components/Loans';
import { Accounting } from './components/Accounting';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { t } = useLanguage();

  const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Emblem_of_the_Ministry_of_Agriculture%2C_Forestry_and_Fisheries_of_Cambodia.svg/512px-Emblem_of_the_Ministry_of_Agriculture%2C_Forestry_and_Fisheries_of_Cambodia.svg.png";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-emerald-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <img src={LOGO_URL} className="w-16 h-16" alt="Loading..." referrerPolicy="no-referrer" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-emerald-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl text-center"
        >
          <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-md border border-emerald-50">
            <img src={LOGO_URL} className="w-20 h-20 object-contain" alt="Logo" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight leading-tight">
            {t('appName')}
          </h1>
          <p className="text-slate-500 mb-10 leading-relaxed text-sm">
            {t('welcome')}
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center space-x-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300"
          >
            <LogIn className="w-5 h-5" />
            <span>{t('signIn')}</span>
          </button>
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'members': return <Members />;
      case 'crops': return <Crops />;
      case 'store': return <Store />;
      case 'loans': return <Loans />;
      case 'accounting': return <Accounting />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      user={user} 
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
}

