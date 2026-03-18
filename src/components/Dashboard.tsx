import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Store, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { db, collection, onSnapshot, query } from '../firebase';
import { Member, CropActivity, Sale, Loan, Transaction } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { formatUSD, formatKHR } from '../utils/currency';

const StatCard = ({ title, value, subValue, change, icon: Icon, color }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="glass-card p-6 rounded-3xl flex flex-col transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-4 rounded-2xl ${color} shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {change !== undefined && (
        <div className={cn(
          "flex items-center text-xs font-bold px-2 py-1 rounded-full",
          change >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
        )}>
          {change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
    {subValue && <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">{subValue}</p>}
  </motion.div>
);

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export const Dashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeCrops: 0,
    totalSales: 0,
    loanBalance: 0,
    recentActivities: [] as any[]
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      const unsubscribers: (() => void)[] = [];

      // Members
      const mQ = query(collection(db, 'members'));
      unsubscribers.push(onSnapshot(mQ, (snapshot) => {
        const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
        setStats(prev => ({ ...prev, totalMembers: members.length }));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'members')));

      // Crop Activities
      const cQ = query(collection(db, 'cropActivities'));
      unsubscribers.push(onSnapshot(cQ, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CropActivity));
        setStats(prev => ({ ...prev, activeCrops: activities.filter(a => a.status === 'active').length }));

        // Update yield in chart data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        setChartData(prevData => {
          const newData = [...prevData];
          activities.forEach(activity => {
            if (activity.status === 'completed' && activity.actualYield && activity.endDate) {
              const endDate = new Date(activity.endDate);
              const monthName = months[endDate.getMonth()];
              const chartItem = newData.find(item => item.name === monthName);
              if (chartItem) {
                chartItem.yield += activity.actualYield;
              }
            }
          });
          return newData;
        });
      }, (error) => handleFirestoreError(error, OperationType.GET, 'cropActivities')));

      // Sales
      const sQ = query(collection(db, 'sales'));
      unsubscribers.push(onSnapshot(sQ, (snapshot) => {
        const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        const totalSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
        setStats(prev => ({ ...prev, totalSales }));

        // Prepare chart data (last 6 months)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          const m = (currentMonth - i + 12) % 12;
          last6Months.push({ name: months[m], revenue: 0, yield: 0 });
        }

        sales.forEach(sale => {
          const saleDate = new Date(sale.date);
          const monthName = months[saleDate.getMonth()];
          const chartItem = last6Months.find(item => item.name === monthName);
          if (chartItem) {
            chartItem.revenue += sale.totalAmount;
          }
        });
        setChartData(last6Months);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'sales')));

      // Loans
      const lQ = query(collection(db, 'loans'));
      unsubscribers.push(onSnapshot(lQ, (snapshot) => {
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        const loanBalance = loans.reduce((acc, l) => {
          const totalPaid = l.payments?.reduce((pAcc, p) => pAcc + p.principal, 0) || 0;
          return acc + (l.amount - totalPaid);
        }, 0);
        setStats(prev => ({ ...prev, loanBalance }));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'loans')));

      // Transactions for Recent Activity
      const tQ = query(collection(db, 'transactions'));
      unsubscribers.push(onSnapshot(tQ, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        const sorted = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
        
        const activities = sorted.map(t => ({
          user: 'System', // In a real app, we'd link this to a user
          action: `${t.type}: ${t.description}`,
          time: new Date(t.date).toLocaleString(),
          icon: t.type === 'income' ? TrendingUp : TrendingDown,
          color: t.type === 'income' ? 'text-emerald-600' : 'text-red-600',
          bg: t.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'
        }));
        setStats(prev => ({ ...prev, recentActivities: activities }));
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions')));

      return () => unsubscribers.forEach(unsub => unsub());
    };

    return fetchData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t('totalMembers')} 
          value={stats.totalMembers.toLocaleString()} 
          icon={Users} 
          color="bg-emerald-600" 
        />
        <StatCard 
          title={t('activeCrops')} 
          value={stats.activeCrops.toLocaleString()} 
          icon={Calendar} 
          color="bg-blue-600" 
        />
        <StatCard 
          title={t('totalSales')} 
          value={formatUSD(stats.totalSales)} 
          subValue={formatKHR(stats.totalSales)}
          icon={Store} 
          color="bg-amber-600" 
        />
        <StatCard 
          title={t('loanBalance')} 
          value={formatUSD(stats.loanBalance)} 
          subValue={formatKHR(stats.loanBalance)}
          icon={Wallet} 
          color="bg-indigo-600" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('yieldVsRevenue')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('monthlyPerformance')}</p>
            </div>
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorYield)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('salesByCategory')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('topPerformingProducts')}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-8 rounded-3xl">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6">{t('recentActivity')}</h3>
        <div className="space-y-6">
          {stats.recentActivities.length > 0 ? (
            stats.recentActivities.map((item, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className={`p-3 rounded-2xl ${item.bg}`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    <span className="font-bold">{item.user}</span> {item.action}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.time}</p>
                </div>
                <button className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300">{t('view')}</button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">No recent activity found.</p>
          )}
        </div>
      </div>
    </div>
  );
};
