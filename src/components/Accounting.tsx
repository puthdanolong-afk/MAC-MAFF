import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Download,
  Filter,
  Search,
  PieChart as PieIcon,
  X
} from 'lucide-react';
import { db, collection, onSnapshot, query, setDoc, doc, Timestamp, auth } from '../firebase';
import { Transaction } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { formatUSD, formatKHR } from '../utils/currency';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const Accounting = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: 'income',
    amount: 0,
    description: '',
    category: 'Sales'
  });

  useEffect(() => {
    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });
    return () => unsubscribe();
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substring(7);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("User not authenticated");

      await setDoc(doc(db, 'transactions', id), {
        ...newTransaction,
        date: new Date().toISOString(),
        uid: uid
      });
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income' || t.type === 'deposit').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' || t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const chartData = [
    { name: 'Income', value: totalIncome },
    { name: 'Expenses', value: totalExpense },
  ];
  const COLORS = ['#10b981', '#ef4444'];

  return (
    <div className="space-y-8">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total Income</p>
          <p className="text-2xl font-bold text-slate-900">{formatUSD(totalIncome)}</p>
          <p className="text-xs text-slate-400">{formatKHR(totalIncome)}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-2xl">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total Expenses</p>
          <p className="text-2xl font-bold text-slate-900">{formatUSD(totalExpense)}</p>
          <p className="text-xs text-slate-400">{formatKHR(totalExpense)}</p>
        </div>
        <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
          <p className="text-emerald-100 text-sm font-medium">Current Balance</p>
          <p className="text-2xl font-bold">{formatUSD(balance)}</p>
          <p className="text-sm text-emerald-200">{formatKHR(balance)}</p>
        </div>
      </div>

      {/* Charts & Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900">Cash Flow</h3>
            <div className="flex items-center space-x-2">
              <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl"><Download className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={transactions.slice(-10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-8">Expense Ratio</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 mt-4">
            <div className="flex items-center text-xs font-bold text-slate-500">
              <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2" /> Income
            </div>
            <div className="flex items-center text-xs font-bold text-slate-500">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2" /> Expenses
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Recent Transactions</h3>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Transaction</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6 text-sm text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-8 py-6 font-bold text-slate-900">{t.description}</td>
                  <td className="px-8 py-6 text-sm text-slate-600">{t.category}</td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${
                      t.type === 'income' || t.type === 'deposit' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`px-8 py-6 text-right font-bold ${
                    t.type === 'income' || t.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    <div className="flex flex-col items-end">
                      <span>{t.type === 'income' || t.type === 'deposit' ? '+' : '-'}{formatUSD(t.amount)}</span>
                      <span className="text-[10px] opacity-60 font-normal">{formatKHR(t.amount)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-8">New Transaction</h2>
                <form onSubmit={handleAddTransaction} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
                      <select 
                        required
                        value={newTransaction.type}
                        onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Amount ($)</label>
                      <input 
                        required
                        type="number" 
                        value={newTransaction.amount}
                        onChange={(e) => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                    <input 
                      required
                      type="text" 
                      value={newTransaction.description}
                      onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Rice sales, Fertilizer purchase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                    <input 
                      required
                      type="text" 
                      value={newTransaction.category}
                      onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Sales, Input, Labor"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
                  >
                    Record Transaction
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
