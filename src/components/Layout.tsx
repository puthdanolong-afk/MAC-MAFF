import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Store, 
  Wallet, 
  BookOpen, 
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Languages,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  isCollapsed?: boolean;
  key?: string | number;
}

const SidebarItem = ({ icon: Icon, label, active, onClick, isCollapsed }: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full p-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-emerald-600 text-white" 
        : "text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400"
    )}
  >
    <Icon className={cn("w-5 h-5", isCollapsed ? "mx-auto" : "mr-3")} />
    {!isCollapsed && <span className="font-medium">{label}</span>}
    {!isCollapsed && active && <ChevronRight className="ml-auto w-4 h-4" />}
  </button>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export const Layout = ({ children, activeTab, setActiveTab, user, onLogout }: LayoutProps) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Emblem_of_the_Ministry_of_Agriculture%2C_Forestry_and_Fisheries_of_Cambodia.svg/512px-Emblem_of_the_Ministry_of_Agriculture%2C_Forestry_and_Fisheries_of_Cambodia.svg.png";

  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'members', label: t('members'), icon: Users },
    { id: 'crops', label: t('crops'), icon: Calendar },
    { id: 'store', label: t('store'), icon: Store },
    { id: 'loans', label: t('loans'), icon: Wallet },
    { id: 'accounting', label: t('accounting'), icon: BookOpen },
  ];

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 280 }}
        className="bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col z-20 transition-colors duration-300"
      >
        <div className="p-6 flex items-center justify-between">
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-4"
            >
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                <img src={LOGO_URL} className="w-10 h-10 object-contain" alt="Logo" referrerPolicy="no-referrer" />
              </div>
              <h1 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 tracking-tight leading-tight">
                {t('appName')}
              </h1>
            </motion.div>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--border-color)]">
          <div className={cn(
            "flex items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50",
            isCollapsed ? "justify-center" : "space-x-3"
          )}>
            <img 
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'User'}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700 shadow-sm"
              referrerPolicy="no-referrer"
            />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user?.displayName || 'Admin User'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {user?.email}
                </p>
              </div>
            )}
            {!isCollapsed && (
              <button 
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 glass-nav flex items-center justify-between px-8 z-10 transition-colors duration-300">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] capitalize">
            {t(activeTab)}
          </h2>
          <div className="flex items-center space-x-6">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  "flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all",
                  language === 'en' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <img src="https://flagcdn.com/w40/us.png" className="w-5 h-3.5 object-cover rounded-sm" alt="EN" />
                <span className="text-xs font-bold">EN</span>
              </button>
              <button
                onClick={() => setLanguage('km')}
                className={cn(
                  "flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all",
                  language === 'km' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <img src="https://flagcdn.com/w40/kh.png" className="w-5 h-3.5 object-cover rounded-sm" alt="KH" />
                <span className="text-xs font-bold">KH</span>
              </button>
            </div>
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border-color)] px-8 py-3 flex items-center justify-between text-xs text-slate-500 transition-colors duration-300">
          <div className="flex flex-col space-y-0.5">
            <p className="font-medium text-slate-700 dark:text-slate-300">{t('allRightsReserved')}</p>
            <p className="text-slate-500 dark:text-slate-400">{t('contactTelegram')}</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-[10px] uppercase tracking-wider">{t('scanToConnect')}</p>
              <p className="text-[10px] font-mono opacity-60">@PUDANO</p>
            </div>
            <div className="w-12 h-12 bg-white p-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://t.me/PUDANO" 
                alt="Telegram QR Code" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
