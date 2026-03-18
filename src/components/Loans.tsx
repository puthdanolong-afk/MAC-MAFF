import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Plus, 
  Search, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  ChevronRight,
  MoreVertical,
  X
} from 'lucide-react';
import { db, collection, onSnapshot, query, setDoc, doc, auth, updateDoc } from '../firebase';
import { Loan, Member } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useLanguage } from '../LanguageContext';
import { formatUSD, formatKHR } from '../utils/currency';

export const Loans = () => {
  const { t } = useLanguage();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLoanForPayments, setSelectedLoanForPayments] = useState<Loan | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    principal: 0,
    interest: 0
  });
  const [newLoan, setNewLoan] = useState({
    memberId: '',
    amount: 0,
    interestRate: 5,
    termMonths: 12
  });

  useEffect(() => {
    const lQ = query(collection(db, 'loans'));
    const unsubscribe = onSnapshot(lQ, (snapshot) => {
      setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'loans');
    });

    const mQ = query(collection(db, 'members'));
    const mUnsubscribe = onSnapshot(mQ, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'members');
    });

    return () => {
      unsubscribe();
      mUnsubscribe();
    };
  }, []);

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newLoan.amount <= 0) {
      alert(t('amountMustBeGreaterThanZero'));
      return;
    }
    if (!newLoan.memberId) {
      alert(t('pleaseSelectMember'));
      return;
    }

    setIsSubmitting(true);
    try {
      const id = Math.random().toString(36).substring(7);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("User not authenticated");

      await setDoc(doc(db, 'loans', id), {
        ...newLoan,
        status: 'pending',
        startDate: new Date().toISOString(),
        payments: [],
        uid: uid
      });
      setIsModalOpen(false);
      setNewLoan({
        memberId: '',
        amount: 0,
        interestRate: 5,
        termMonths: 12
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForPayments) return;
    if (newPayment.amount <= 0) {
      alert(t('amountMustBeGreaterThanZero'));
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedPayments = [
        ...(selectedLoanForPayments.payments || []),
        {
          ...newPayment,
          amount: Number(newPayment.amount),
          principal: Number(newPayment.principal),
          interest: Number(newPayment.interest)
        }
      ];

      // Calculate total principal paid
      const totalPrincipalPaid = updatedPayments.reduce((acc, p) => acc + p.principal, 0);
      
      // If fully paid, update status
      let newStatus = selectedLoanForPayments.status;
      if (totalPrincipalPaid >= selectedLoanForPayments.amount) {
        newStatus = 'repaid';
      }

      await updateDoc(doc(db, 'loans', selectedLoanForPayments.id), {
        payments: updatedPayments,
        status: newStatus
      });

      setIsPaymentModalOpen(false);
      setNewPayment({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        principal: 0,
        interest: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'approved': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'repaid': return 'bg-slate-50 text-slate-600 border-slate-100';
      default: return 'bg-red-50 text-red-600 border-red-100';
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 rounded-2xl">
              <Wallet className="w-6 h-6 text-indigo-600" />
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-slate-500 text-sm font-medium">{t('totalOutstanding')}</p>
          <p className="text-2xl font-bold text-slate-900">{formatUSD(loans.reduce((acc, l) => acc + l.amount, 0))}</p>
          <p className="text-xs text-slate-400">{formatKHR(loans.reduce((acc, l) => acc + l.amount, 0))}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">{t('pendingApplications')}</p>
          <p className="text-2xl font-bold text-slate-900">{loans.filter(l => l.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">{t('fullyRepaid')}</p>
          <p className="text-2xl font-bold text-slate-900">{loans.filter(l => l.status === 'repaid').length}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('search')} 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">{t('newApplication')}</span>
        </button>
      </div>

      {/* Loans List */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('members')}</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('amount')}</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('interest')}</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('term')}</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                </tr>
              ))
            ) : (
              loans.map((loan) => {
                const member = members.find(m => m.id === loan.memberId);
                return (
                  <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 font-bold">
                          {member?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{member?.name || t('unknown')}</p>
                          <p className="text-xs text-slate-500">ID: {loan.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <p className="font-bold text-slate-900">{formatUSD(loan.amount)}</p>
                        <p className="text-[10px] text-slate-400">{formatKHR(loan.amount)}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-medium text-slate-600">{loan.interestRate}% APR</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-medium text-slate-600">{loan.termMonths} months</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold capitalize ${getStatusStyle(loan.status)}`}>
                        {t(loan.status)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => {
                            setSelectedLoanForPayments(loan);
                            setIsPaymentModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="View Payments"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            {loans.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic">
                  {t('noLoanApplicationsFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Loan Payments Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedLoanForPayments && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{t('loanPayments')}</h2>
                  <p className="text-sm text-slate-500">
                    Loan ID: {selectedLoanForPayments.id} • 
                    {t('members')}: {members.find(m => m.id === selectedLoanForPayments.memberId)?.name}
                  </p>
                </div>
                <button 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Payment History */}
                  <div className="lg:col-span-2 space-y-6">
                    <h3 className="font-bold text-slate-900 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-emerald-600" />
                      {t('paymentHistory')}
                    </h3>
                    <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/50">
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('date')}</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('amount')}</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('principal')}</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('interest')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedLoanForPayments.payments?.map((payment, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-4 py-3 text-sm text-slate-600">{new Date(payment.date).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-sm font-bold text-slate-900">
                                <div className="flex flex-col">
                                  <span>{formatUSD(payment.amount)}</span>
                                  <span className="text-[10px] opacity-60 font-normal">{formatKHR(payment.amount)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{formatUSD(payment.principal)}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{formatUSD(payment.interest)}</td>
                            </tr>
                          ))}
                          {(!selectedLoanForPayments.payments || selectedLoanForPayments.payments.length === 0) && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic text-sm">
                                {t('noPaymentsRecorded')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">{t('totalPaid')}</p>
                        <p className="text-xl font-bold text-emerald-700">
                          {formatUSD(selectedLoanForPayments.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}
                        </p>
                        <p className="text-xs text-emerald-600/70">
                          {formatKHR(selectedLoanForPayments.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}
                        </p>
                      </div>
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">{t('remainingPrincipal')}</p>
                        <p className="text-xl font-bold text-indigo-700">
                          {formatUSD(selectedLoanForPayments.amount - (selectedLoanForPayments.payments?.reduce((acc, p) => acc + p.principal, 0) || 0))}
                        </p>
                        <p className="text-xs text-indigo-600/70">
                          {formatKHR(selectedLoanForPayments.amount - (selectedLoanForPayments.payments?.reduce((acc, p) => acc + p.principal, 0) || 0))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Add New Payment */}
                  <div className="space-y-6">
                    <h3 className="font-bold text-slate-900 flex items-center">
                      <Plus className="w-5 h-5 mr-2 text-emerald-600" />
                      {t('addPayment')}
                    </h3>
                    <form onSubmit={handleAddPayment} className="space-y-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('paymentDate')}</label>
                        <input 
                          required
                          type="date" 
                          value={newPayment.date}
                          onChange={(e) => setNewPayment({...newPayment, date: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('totalAmount')} ($)</label>
                        <input 
                          required
                          type="number" 
                          value={newPayment.amount}
                          onChange={(e) => setNewPayment({...newPayment, amount: Number(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('principal')} ($)</label>
                          <input 
                            required
                            type="number" 
                            value={newPayment.principal}
                            onChange={(e) => setNewPayment({...newPayment, principal: Number(e.target.value)})}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('interest')} ($)</label>
                          <input 
                            required
                            type="number" 
                            value={newPayment.interest}
                            onChange={(e) => setNewPayment({...newPayment, interest: Number(e.target.value)})}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          />
                        </div>
                      </div>
                      <button 
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting ? t('submitting') : t('recordPayment')}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Loan Modal */}
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
                <h2 className="text-2xl font-bold text-slate-900 mb-8">{t('newApplication')}</h2>
                <form onSubmit={handleAddLoan} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('members')}</label>
                    <select 
                      required
                      value={newLoan.memberId}
                      onChange={(e) => setNewLoan({...newLoan, memberId: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{t('selectMember')}</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('amount')} ($)</label>
                    <input 
                      required
                      type="number" 
                      value={newLoan.amount}
                      onChange={(e) => setNewLoan({...newLoan, amount: Number(e.target.value)})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t('interest')} (%)</label>
                      <input 
                        required
                        type="number" 
                        value={newLoan.interestRate}
                        onChange={(e) => setNewLoan({...newLoan, interestRate: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t('term')} (Months)</label>
                      <input 
                        required
                        type="number" 
                        value={newLoan.termMonths}
                        onChange={(e) => setNewLoan({...newLoan, termMonths: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? t('submitting') : t('submitApplication')}
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
