import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronRight, 
  Activity, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  CloudRain,
  Sun,
  Wind,
  Info,
  X,
  Thermometer
} from 'lucide-react';
import { db, collection, onSnapshot, query, setDoc, doc, where, auth } from '../firebase';
import { CropActivity, Member } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { formatDualCurrency } from '../utils/currency';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area
} from 'recharts';

export const Crops = () => {
  const [activities, setActivities] = useState<CropActivity[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CropActivity | null>(null);
  const [selectedActivityForLog, setSelectedActivityForLog] = useState<CropActivity | null>(null);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [newActivity, setNewActivity] = useState({
    memberId: '',
    cropType: '',
    startDate: new Date().toISOString().split('T')[0],
    estimatedYield: 0
  });

  const [currentLogActivity, setCurrentLogActivity] = useState({
    date: new Date().toISOString().split('T')[0],
    type: '',
    description: '',
    cost: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'cropActivities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CropActivity));
      setActivities(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cropActivities');
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

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = Math.random().toString(36).substring(7);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("User not authenticated");

      await setDoc(doc(db, 'cropActivities', id), {
        ...newActivity,
        status: 'active',
        activities: [],
        uid: uid
      });
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'cropActivities');
    }
  };

  const generateForecast = (activity: CropActivity) => {
    setSelectedActivity(activity);
    
    // Simulate historical data and forecast
    const baseYield = activity.estimatedYield;
    const historical = [
      { year: '2022', yield: baseYield * 0.85 },
      { year: '2023', yield: baseYield * 0.92 },
      { year: '2024', yield: baseYield * 0.88 },
      { year: '2025 (Est)', yield: baseYield, isForecast: true },
      { year: '2026 (Proj)', yield: baseYield * 1.05, isForecast: true }
    ];
    
    setForecastData(historical);
    setIsForecastModalOpen(true);
  };

  const handleAddLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivityForLog || !currentLogActivity.type || !currentLogActivity.description || !currentLogActivity.cost) return;

    try {
      const updatedActivities = [
        ...(selectedActivityForLog.activities || []),
        {
          date: currentLogActivity.date,
          type: currentLogActivity.type,
          description: currentLogActivity.description,
          cost: parseFloat(currentLogActivity.cost)
        }
      ];

      await setDoc(doc(db, 'cropActivities', selectedActivityForLog.id), {
        activities: updatedActivities
      }, { merge: true });

      setCurrentLogActivity({
        date: new Date().toISOString().split('T')[0],
        type: '',
        description: '',
        cost: ''
      });
      
      // Update local state for immediate feedback
      setSelectedActivityForLog({
        ...selectedActivityForLog,
        activities: updatedActivities
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'cropActivities');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'planned': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Activity className="w-4 h-4" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'planned': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cropping Calendar</h2>
          <p className="text-slate-500">Track production activities and forecast yields</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">New Activity</span>
        </button>
      </div>

      {/* Weather Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-xl">
              <Sun className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Condition</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">Sunny</p>
          <p className="text-sm text-slate-500">Perfect for harvesting</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Thermometer className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Temp</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">28°C</p>
          <p className="text-sm text-slate-500">High: 31° Low: 22°</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <CloudRain className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rain</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">15%</p>
          <p className="text-sm text-slate-500">Low probability</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-slate-50 rounded-xl">
              <Wind className="w-6 h-6 text-slate-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wind</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">12 km/h</p>
          <p className="text-sm text-slate-500">Breezy, North-East</p>
        </div>
      </div>

      {/* Activity List */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-3xl border border-slate-100 animate-pulse" />
          ))
        ) : (
          activities.map((activity) => {
            const member = members.find(m => m.id === activity.memberId);
            return (
              <motion.div 
                key={activity.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 hover:shadow-xl transition-all flex flex-col md:flex-row md:items-center gap-6"
              >
                <div className="flex items-center space-x-4 min-w-[240px]">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <CalendarIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{activity.cropType}</h3>
                    <p className="text-sm text-slate-500">{member?.name || 'Unknown Member'}</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Start Date</p>
                    <p className="text-sm font-semibold text-slate-700">{new Date(activity.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Est. Yield</p>
                    <p className="text-sm font-semibold text-slate-700">{activity.estimatedYield} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Status</p>
                    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-bold ${getStatusColor(activity.status)}`}>
                      {getStatusIcon(activity.status)}
                      <span className="capitalize">{activity.status}</span>
                    </div>
                  </div>
                    <div className="flex items-center justify-end space-x-3">
                      <button 
                        onClick={() => {
                          setSelectedActivityForLog(activity);
                          setIsLogModalOpen(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all text-sm font-bold"
                      >
                        <Activity className="w-4 h-4" />
                        <span>Logs</span>
                      </button>
                      <button 
                        onClick={() => generateForecast(activity)}
                        className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all text-sm font-bold"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Forecast</span>
                      </button>
                      <button className="p-3 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Activity Modal */}
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
                <h2 className="text-2xl font-bold text-slate-900 mb-8">Start New Cropping</h2>
                <form onSubmit={handleAddActivity} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Member</label>
                    <select 
                      required
                      value={newActivity.memberId}
                      onChange={(e) => setNewActivity({...newActivity, memberId: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select a member</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Crop Type</label>
                    <input 
                      required
                      type="text" 
                      value={newActivity.cropType}
                      onChange={(e) => setNewActivity({...newActivity, cropType: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Rice, Corn, Mango"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
                      <input 
                        required
                        type="date" 
                        value={newActivity.startDate}
                        onChange={(e) => setNewActivity({...newActivity, startDate: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Est. Yield (kg)</label>
                      <input 
                        required
                        type="number" 
                        value={newActivity.estimatedYield}
                        onChange={(e) => setNewActivity({...newActivity, estimatedYield: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
                  >
                    Create Activity
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Log Modal */}
      <AnimatePresence>
        {isLogModalOpen && selectedActivityForLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Activity Log</h2>
                    <p className="text-slate-500">{selectedActivityForLog.cropType} - {members.find(m => m.id === selectedActivityForLog.memberId)?.name}</p>
                  </div>
                  <button 
                    onClick={() => setIsLogModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Log Form */}
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center">
                    <Plus className="w-4 h-4 mr-2 text-emerald-600" />
                    Log New Activity
                  </h3>
                  <form onSubmit={handleAddLogActivity} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                        <input 
                          type="date"
                          required
                          value={currentLogActivity.date}
                          onChange={(e) => setCurrentLogActivity({...currentLogActivity, date: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Activity Type</label>
                        <select 
                          required
                          value={currentLogActivity.type}
                          onChange={(e) => setCurrentLogActivity({...currentLogActivity, type: e.target.value})}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        >
                          <option value="">Select Type</option>
                          <option value="Land Prep">Land Prep</option>
                          <option value="Planting">Planting</option>
                          <option value="Fertilizing">Fertilizing</option>
                          <option value="Pest Control">Pest Control</option>
                          <option value="Irrigation">Irrigation</option>
                          <option value="Harvesting">Harvesting</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                      <input 
                        type="text"
                        required
                        value={currentLogActivity.description}
                        onChange={(e) => setCurrentLogActivity({...currentLogActivity, description: e.target.value})}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        placeholder="What was done?"
                      />
                    </div>
                    <div className="flex items-end space-x-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="number"
                            required
                            value={currentLogActivity.cost}
                            onChange={(e) => setCurrentLogActivity({...currentLogActivity, cost: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <button 
                        type="submit"
                        className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm shadow-md"
                      >
                        Log Activity
                      </button>
                    </div>
                  </form>
                </div>

                {/* Log List */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-blue-600" />
                    Activity History
                  </h3>
                  <div className="space-y-3">
                    {selectedActivityForLog.activities && selectedActivityForLog.activities.length > 0 ? (
                      selectedActivityForLog.activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-emerald-200 transition-all group">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                              <CalendarIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{log.type}</span>
                                <span className="text-xs text-slate-400">{new Date(log.date).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm font-medium text-slate-700 mt-1">{log.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{formatDualCurrency(log.cost)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 italic">No activities logged yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Production Cost</span>
                  <span className="text-xl font-bold text-slate-900">
                    {formatDualCurrency(selectedActivityForLog.activities?.reduce((sum, a) => sum + a.cost, 0) || 0)}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forecast Modal */}
      <AnimatePresence>
        {isForecastModalOpen && selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsForecastModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Yield Forecast</h2>
                    <p className="text-slate-500">{selectedActivity.cropType} Production Analysis</p>
                  </div>
                  <button 
                    onClick={() => setIsForecastModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <div className="flex items-center space-x-2 text-blue-600 mb-2">
                      <CloudRain className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Conditions</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">Optimal</p>
                    <p className="text-xs text-slate-500">Favorable rainfall</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                    <div className="flex items-center space-x-2 text-amber-600 mb-2">
                      <Sun className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Soil Health</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">High</p>
                    <p className="text-xs text-slate-500">Rich in nutrients</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="flex items-center space-x-2 text-emerald-600 mb-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Confidence</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">92%</p>
                    <p className="text-xs text-slate-500">Based on history</p>
                  </div>
                </div>

                <div className="h-64 w-full mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="year" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          padding: '12px'
                        }}
                      />
                      <Bar dataKey="yield" radius={[8, 8, 0, 0]}>
                        {forecastData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.isForecast ? '#10b981' : '#cbd5e1'} 
                            fillOpacity={entry.isForecast ? 1 : 0.6}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Info className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Forecast Analysis</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Based on current weather patterns and historical soil performance for this member's location, 
                        we project a <span className="font-bold text-emerald-600">5% increase</span> in yield compared to your initial estimate. 
                        We recommend maintaining current irrigation schedules.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
