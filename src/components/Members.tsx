import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin,
  ChevronRight,
  X,
  Map as MapIcon,
  Maximize2,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Calendar,
  ClipboardList,
  Trash2,
  LayoutGrid,
  Map as MapIconLucide,
  Check,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Sprout,
  Download,
  Upload,
  QrCode
} from 'lucide-react';
import { db, collection, getDocs, onSnapshot, query, setDoc, doc, Timestamp, auth, writeBatch } from '../firebase';
import { Member } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { MapContainer, TileLayer, Polygon, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';

import { formatDualCurrency } from '../utils/currency';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Map controller to handle zooming
const MapController = ({ selectedMember, productionArea, location }: { selectedMember?: Member | null, productionArea?: Member['productionArea'], location?: Member['location'] }) => {
  const map = useMap();
  
  useEffect(() => {
    const area = productionArea || selectedMember?.productionArea;
    const loc = location || selectedMember?.location;

    if (area && area.geometry.type === 'Polygon') {
      const coords = area.geometry.coordinates[0];
      const bounds = L.latLngBounds(coords.map(c => [c[1], c[0]] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (loc) {
      map.setView([loc.lat, loc.lng], 16);
    }
  }, [selectedMember, productionArea, location, map]);

  return null;
};

// Geoman initialization component
const GeomanControls = ({ 
  onPolygonCreated, 
  onPolygonEdited, 
  onPolygonRemoved,
  calculateArea
}: { 
  onPolygonCreated: (coords: number[][]) => void,
  onPolygonEdited: (memberId: string, coords: number[][], area_sqm: number) => void,
  onPolygonRemoved: (memberId: string) => void,
  calculateArea: (coords: number[][]) => number
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
      editMode: true,
      removalMode: true,
    });

    map.on('pm:create', (e: any) => {
      if (e.shape === 'Polygon') {
        const layer = e.layer;
        const coords = layer.getLatLngs()[0].map((latlng: any) => [latlng.lng, latlng.lat]);
        // Close the polygon for GeoJSON
        coords.push(coords[0]);
        onPolygonCreated(coords);
        
        // Remove the drawn layer so we can manage it via state
        map.removeLayer(layer);
      }
    });

    // Handle editing of existing polygons
    map.on('pm:update', (e: any) => {
      const layer = e.layer;
      const memberId = (layer as any).memberId;
      if (memberId) {
        const coords = layer.getLatLngs()[0].map((latlng: any) => [latlng.lng, latlng.lat]);
        coords.push(coords[0]);
        const area_sqm = calculateArea(coords);
        onPolygonEdited(memberId, coords, area_sqm);
      }
    });

    // Handle removal of existing polygons
    map.on('pm:remove', (e: any) => {
      const layer = e.layer;
      const memberId = (layer as any).memberId;
      if (memberId) {
        onPolygonRemoved(memberId);
      }
    });

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
      map.off('pm:update');
      map.off('pm:remove');
    };
  }, [map, onPolygonCreated, onPolygonEdited, onPolygonRemoved, calculateArea]);

  return null;
};

export const Members = () => {
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMember, setNewMember] = useState<{
    name: string;
    contact: string;
    address: string;
    cropType: string;
    plantingDate: string;
    estimatedHarvestDate: string;
    soilType: string;
    activities: { id: string; date: string; type: string; description: string; cost: number }[];
    productionArea?: Member['productionArea'];
  }>({ 
    name: '', 
    contact: '', 
    address: '',
    cropType: '',
    plantingDate: '',
    estimatedHarvestDate: '',
    soilType: '',
    activities: []
  });

  const [currentActivity, setCurrentActivity] = useState({
    date: new Date().toISOString().split('T')[0],
    type: '',
    description: '',
    cost: ''
  });
  const [showMap, setShowMap] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedMemberForMap, setSelectedMemberForMap] = useState<Member | null>(null);
  const [showPolygons, setShowPolygons] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [selectedMemberForQR, setSelectedMemberForQR] = useState<Member | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'members'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(membersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'members');
    });
    return () => unsubscribe();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const memberId = Math.random().toString(36).substring(7);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("User not authenticated");

      // Default location if not set (Manila)
      const location = newMember.location || { lat: 14.5995, lng: 120.9842 };

      await setDoc(doc(db, 'members', memberId), {
        ...newMember,
        location,
        status: 'active',
        joinedAt: new Date().toISOString(),
        crops: [],
        uid: uid
      });
      setIsModalOpen(false);
      setNewMember({ 
        name: '', 
        contact: '', 
        address: '',
        cropType: '',
        plantingDate: '',
        estimatedHarvestDate: '',
        soilType: '',
        activities: []
      });
      setShowMap(false);
      setCurrentActivity({
        date: new Date().toISOString().split('T')[0],
        type: '',
        description: '',
        cost: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'members');
    }
  };

  const addActivity = () => {
    if (!currentActivity.type || !currentActivity.description || !currentActivity.cost) return;
    
    const activity = {
      id: Math.random().toString(36).substring(7),
      date: currentActivity.date,
      type: currentActivity.type,
      description: currentActivity.description,
      cost: parseFloat(currentActivity.cost)
    };

    setNewMember({
      ...newMember,
      activities: [...newMember.activities, activity]
    });

    setCurrentActivity({
      date: new Date().toISOString().split('T')[0],
      type: '',
      description: '',
      cost: ''
    });
  };

  const removeActivity = (id: string) => {
    setNewMember({
      ...newMember,
      activities: newMember.activities.filter(a => a.id !== id)
    });
  };

  const updateMemberProductionArea = async (memberId: string, coords: number[][], area_sqm: number) => {
    if (memberId === "current") return;
    try {
      await setDoc(doc(db, 'members', memberId), {
        productionArea: {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          },
          properties: {
            area_sqm: area_sqm
          }
        }
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'members');
    }
  };

  const removeMemberProductionArea = async (memberId: string) => {
    if (memberId === "current") return;
    try {
      await setDoc(doc(db, 'members', memberId), {
        productionArea: null
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'members');
    }
  };

  const calculateArea = (coords: number[][]) => {
    if (!coords || coords.length < 3) return 0;
    let area = 0;
    let avgLat = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      area += (coords[i][0] * coords[i+1][1]) - (coords[i+1][0] * coords[i][1]);
      avgLat += coords[i][1];
    }
    avgLat /= (coords.length - 1);
    
    // Shoelace formula gives area in square degrees
    // Convert to square meters using latitude correction
    // 1 deg lat approx 111,319m
    // 1 deg lng approx 111,319m * cos(lat)
    const latFactor = 111319;
    const lngFactor = 111319 * Math.cos(avgLat * Math.PI / 180);
    
    return Math.abs(area * 0.5) * latFactor * lngFactor;
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.contact.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map(m => m.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`${t('confirmDelete')} ${selectedIds.length} ${t('members')}?`)) return;
    setBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'members', id));
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'members');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive' | 'pending') => {
    setBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'members', id), { status });
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'members');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Contact', 'Address', 'Crop Type', 'Planting Date', 'Estimated Harvest Date', 'Soil Type', 'Status', 'Joined At'];
    const csvContent = [
      headers.join(','),
      ...members.map(m => [
        `"${m.name}"`,
        `"${m.contact}"`,
        `"${m.address}"`,
        `"${m.cropType || ''}"`,
        `"${m.plantingDate || ''}"`,
        `"${m.estimatedHarvestDate || ''}"`,
        `"${m.soilType || ''}"`,
        `"${m.status}"`,
        `"${m.joinedAt}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `members_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) return;

      const parseCSVLine = (line: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const batch = writeBatch(db);
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const memberData: any = {
          uid,
          crops: [],
          joinedAt: new Date().toISOString(),
          status: 'active',
          location: { lat: 14.5995, lng: 120.9842 } // Default location
        };

        headers.forEach((header, index) => {
          const value = values[index];
          if (!value) return;
          
          const h = header.toLowerCase();
          if (h === 'name') memberData.name = value;
          else if (h === 'contact') memberData.contact = value;
          else if (h === 'address') memberData.address = value;
          else if (h === 'crop type') memberData.cropType = value;
          else if (h === 'planting date') memberData.plantingDate = value;
          else if (h === 'estimated harvest date') memberData.estimatedHarvestDate = value;
          else if (h === 'soil type') memberData.soilType = value;
          else if (h === 'status') memberData.status = value as any;
          else if (h === 'joined at') memberData.joinedAt = value;
          else if (h === 'latitude') memberData.location.lat = parseFloat(value);
          else if (h === 'longitude') memberData.location.lng = parseFloat(value);
        });

        if (memberData.name) {
          const memberId = Math.random().toString(36).substring(7);
          batch.set(doc(db, 'members', memberId), memberData);
          count++;
        }
      }

      if (count > 0) {
        try {
          await batch.commit();
          alert(`Successfully imported ${count} members!`);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'members');
        }
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* QR Code Modal */}
      <AnimatePresence>
        {selectedMemberForQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[var(--bg-secondary)] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[var(--border-color)]"
            >
              <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-emerald-600 text-white">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('qrCode')}</h2>
                    <p className="text-xs text-emerald-100">{selectedMemberForQR.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMemberForQR(null)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 flex flex-col items-center justify-center space-y-8">
                <div className="p-6 bg-white rounded-3xl shadow-inner border border-slate-100">
                  <QRCodeSVG 
                    id="member-qr-code"
                    value={JSON.stringify({
                      id: selectedMemberForQR.id,
                      name: selectedMemberForQR.name,
                      contact: selectedMemberForQR.contact,
                      address: selectedMemberForQR.address,
                      joinedAt: selectedMemberForQR.joinedAt
                    })}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t('scanToViewProfile')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedMemberForQR.contact}</p>
                </div>

                <button
                  onClick={() => {
                    const svg = document.getElementById('member-qr-code');
                    if (svg) {
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      const img = new Image();
                      img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx?.drawImage(img, 0, 0);
                        const pngFile = canvas.toDataURL('image/png');
                        const downloadLink = document.createElement('a');
                        downloadLink.download = `QR_${selectedMemberForQR.name.replace(/\s+/g, '_')}.png`;
                        downloadLink.href = pngFile;
                        downloadLink.click();
                      };
                      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                    }
                  }}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>{t('downloadQR')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('search')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-[var(--text-primary)]"
          />
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 mr-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
              title={t('exportCSV')}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">{t('exportCSV')}</span>
            </button>
            <label className="flex items-center space-x-2 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm cursor-pointer" title={t('importCSV')}>
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">{t('importCSV')}</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex items-center space-x-2 mr-4">
            <input 
              type="checkbox" 
              checked={selectedIds.length === filteredMembers.length && filteredMembers.length > 0}
              onChange={toggleSelectAll}
              className="w-5 h-5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('selectAll')}</span>
          </div>
          <div className="flex bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'map' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              <MapIconLucide className="w-5 h-5" />
            </button>
          </div>
          <button className="flex items-center space-x-2 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Filter className="w-5 h-5" />
            <span className="font-medium">{t('filter')}</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{t('addMember')}</span>
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            statusFilter === 'all' 
            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg' 
            : 'bg-[var(--bg-secondary)] text-slate-500 dark:text-slate-400 border border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {t('allMembers')}
        </button>
        <button 
          onClick={() => setStatusFilter('active')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            statusFilter === 'active' 
            ? 'bg-emerald-600 text-white shadow-lg' 
            : 'bg-[var(--bg-secondary)] text-slate-500 dark:text-slate-400 border border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${statusFilter === 'active' ? 'bg-white' : 'bg-emerald-500'}`} />
          <span>{t('active')}</span>
        </button>
        <button 
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            statusFilter === 'pending' 
            ? 'bg-amber-500 text-white shadow-lg' 
            : 'bg-[var(--bg-secondary)] text-slate-500 dark:text-slate-400 border border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${statusFilter === 'pending' ? 'bg-white' : 'bg-amber-500'}`} />
          <span>{t('pending')}</span>
        </button>
        <button 
          onClick={() => setStatusFilter('inactive')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            statusFilter === 'inactive' 
            ? 'bg-slate-500 text-white shadow-lg' 
            : 'bg-[var(--bg-secondary)] text-slate-500 dark:text-slate-400 border border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${statusFilter === 'inactive' ? 'bg-white' : 'bg-slate-400'}`} />
          <span>{t('inactive')}</span>
        </button>
      </div>

      {/* Members Content */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="glass-card p-6 rounded-3xl animate-pulse">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                </div>
              </div>
            ))
          ) : (
            filteredMembers.map((member) => (
              <motion.div 
                key={member.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "glass-card p-6 rounded-3xl transition-all group relative",
                  selectedIds.includes(member.id) ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-xl' : 'hover:shadow-2xl'
                )}
              >
                <div className="absolute top-4 left-4 z-10">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(member.id)}
                    onChange={() => toggleSelect(member.id)}
                    className="w-5 h-5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-start justify-between mb-4 pl-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl relative">
                      {member.name.charAt(0)}
                      {member.status && (
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${
                          member.status === 'active' ? 'bg-emerald-500' : 
                          member.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{member.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Joined {new Date(member.joinedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => setSelectedMemberForQR(member)}
                        className="p-2 text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                        title={t('qrCode')}
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                      <button className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                    {member.productionArea && (
                      <button 
                        onClick={() => setSelectedMemberForMap(member)}
                        className="flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full mt-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        <MapIcon className="w-3 h-3 mr-1" />
                        {(member.productionArea.properties?.area_sqm / 10000).toFixed(2)} ha
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4 mr-3 text-slate-400" />
                    {member.contact}
                  </div>
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4 mr-3 text-slate-400" />
                    {member.address}
                  </div>
                  {member.cropType && (
                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                      <TrendingUp className="w-4 h-4 mr-3 text-slate-400" />
                      {member.cropType} • {member.soilType || 'Unknown Soil'}
                    </div>
                  )}
                  {member.activities && member.activities.length > 0 && (
                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                      <ClipboardList className="w-4 h-4 mr-3 text-slate-400" />
                      {member.activities.length} Activities Logged
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                  <div className="flex -space-x-2">
                    {member.crops.map((crop, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                        {crop.charAt(0)}
                      </div>
                    ))}
                    {member.crops.length === 0 && <span className="text-xs text-slate-400 italic">No crops listed</span>}
                  </div>
                  <button className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center hover:translate-x-1 transition-transform">
                    View Profile <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="h-[600px] w-full bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] overflow-hidden shadow-sm relative">
          <MapContainer 
            center={[14.5995, 120.9842]} 
            zoom={12} 
            className="h-full w-full z-0"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapController selectedMember={selectedMemberForMap} />
            <GeomanControls 
              onPolygonCreated={(coords) => {
                const center = coords.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]], [0, 0]);
                const avgCenter = { lng: center[0] / coords.length, lat: center[1] / coords.length };
                
                setNewMember({
                  ...newMember,
                  location: avgCenter,
                  productionArea: {
                    type: "Feature",
                    geometry: {
                      type: "Polygon",
                      coordinates: [coords]
                    },
                    properties: {
                      area_sqm: calculateArea(coords)
                    }
                  }
                });
                setIsModalOpen(true);
              }} 
              onPolygonEdited={updateMemberProductionArea}
              onPolygonRemoved={removeMemberProductionArea}
              calculateArea={calculateArea}
            />
            {showPolygons && filteredMembers.map((member) => (
              member.productionArea && member.productionArea.geometry.type === 'Polygon' && (
                <Polygon 
                  key={`poly-${member.id}`}
                  positions={member.productionArea.geometry.coordinates[0].map(coord => [coord[1], coord[0]]) as [number, number][]}
                  eventHandlers={{
                    add: (e) => {
                      const layer = e.target;
                      (layer as any).memberId = member.id;
                    }
                  }}
                  pathOptions={{ 
                    color: member.status === 'active' ? '#10b981' : member.status === 'pending' ? '#f59e0b' : '#94a3b8',
                    fillColor: member.status === 'active' ? '#10b981' : member.status === 'pending' ? '#f59e0b' : '#94a3b8',
                    fillOpacity: 0.2,
                    weight: selectedMemberForMap?.id === member.id ? 3 : 1
                  }}
                >
                  <Popup>
                    <div className="p-1 text-center">
                      <p className="font-bold text-xs">{member.name}</p>
                      <p className="text-[10px] text-slate-500">Production Area</p>
                    </div>
                  </Popup>
                </Polygon>
              )
            ))}
            {filteredMembers.map((member) => (
              member.location && (
                <Marker 
                  key={member.id} 
                  position={[member.location.lat, member.location.lng]}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-[var(--text-primary)] leading-tight">{member.name}</h4>
                          <p className="text-[10px] text-slate-500">{member.contact}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-[10px] text-slate-600 dark:text-slate-400">
                          <MapPin className="w-3 h-3 mr-2 text-slate-400" />
                          {member.address}
                        </div>
                        {member.cropType && (
                          <div className="flex items-center text-[10px] text-slate-600 dark:text-slate-400">
                            <Sprout className="w-3 h-3 mr-2 text-slate-400" />
                            {member.cropType}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setSelectedMemberForMap(member)}
                        className="w-full mt-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        View Production Area
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
          <div className="absolute top-4 right-4 z-[1000] bg-[var(--bg-secondary)]/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-[var(--border-color)] max-w-xs">
            <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1">Member Map</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              Showing {filteredMembers.filter(m => m.location).length} members with registered locations. Click on a marker to see details.
            </p>
            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Show Production Areas</span>
              <button 
                onClick={() => setShowPolygons(!showPolygons)}
                className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  showPolygons ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                  showPolygons ? "translate-x-4.5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-8 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center space-x-4 pr-8 border-r border-white/20">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-bold">
                {selectedIds.length}
              </div>
              <div>
                <p className="text-sm font-bold">{t('membersSelected')}</p>
                <button 
                  onClick={() => setSelectedIds([])}
                  className="text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-wider"
                >
                  {t('clearSelection')}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handleBulkStatusUpdate('active')}
                  disabled={bulkUpdating}
                  className="p-2 hover:bg-emerald-500/20 rounded-xl transition-colors group relative"
                  title="Mark as Active"
                >
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('active')}</span>
                </button>
                <button 
                  onClick={() => handleBulkStatusUpdate('pending')}
                  disabled={bulkUpdating}
                  className="p-2 hover:bg-amber-500/20 rounded-xl transition-colors group relative"
                  title={t('markAsPending')}
                >
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('pending')}</span>
                </button>
                <button 
                  onClick={() => handleBulkStatusUpdate('inactive')}
                  disabled={bulkUpdating}
                  className="p-2 hover:bg-slate-500/20 rounded-xl transition-colors group relative"
                  title={t('markAsInactive')}
                >
                  <ShieldAlert className="w-6 h-6 text-slate-400" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('inactive')}</span>
                </button>
              </div>
              
              <button 
                onClick={handleBulkDelete}
                disabled={bulkUpdating}
                className="flex items-center space-x-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Map Modal */}
      <AnimatePresence>
        {selectedMemberForMap && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMemberForMap(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden relative border border-[var(--border-color)]"
            >
              <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedMemberForMap.name}'s Production Area</h2>
                  <div className="flex items-center space-x-3 mt-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{(selectedMemberForMap.productionArea?.properties?.area_sqm / 10000).toFixed(2)} hectares</p>
                    {selectedMemberForMap.cropType && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{selectedMemberForMap.cropType}</p>
                      </>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMemberForMap(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {selectedMemberForMap.plantingDate && (
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 px-6 py-3 border-b border-emerald-100 dark:border-emerald-900/20 flex items-center space-x-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">Planting Date</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{new Date(selectedMemberForMap.plantingDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">Est. Harvest</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{new Date(selectedMemberForMap.estimatedHarvestDate!).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">Soil Type</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedMemberForMap.soilType || 'N/A'}</p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-3 h-[500px]">
                <div className="lg:col-span-2 h-full w-full">
                  <MapContainer 
                    center={[
                      selectedMemberForMap.productionArea?.geometry.coordinates[0][0][1],
                      selectedMemberForMap.productionArea?.geometry.coordinates[0][0][0]
                    ]} 
                    zoom={16} 
                    className="h-full w-full"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Polygon 
                      positions={selectedMemberForMap.productionArea?.geometry.coordinates[0].map((c: number[]) => [c[1], c[0]])}
                      pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3 }}
                    />
                  </MapContainer>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 border-l border-[var(--border-color)] flex flex-col">
                  <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">
                      <ClipboardList className="w-3 h-3 mr-2 text-emerald-600 dark:text-emerald-400" />
                      Activity Log
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedMemberForMap.activities && selectedMemberForMap.activities.length > 0 ? (
                      selectedMemberForMap.activities.map((activity) => (
                        <div key={activity.id} className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)] shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                              {activity.type}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(activity.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-primary)] font-medium mb-1">{activity.description}</p>
                          <p className="text-[10px] font-bold text-[var(--text-primary)]">{formatDualCurrency(activity.cost)}</p>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <ClipboardList className="w-8 h-8 text-slate-200 dark:text-slate-800 mb-2" />
                        <p className="text-xs text-slate-400 italic">No activities logged yet</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Cost</span>
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {formatDualCurrency(selectedMemberForMap.activities?.reduce((sum, a) => sum + a.cost, 0) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
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
              className="relative w-full max-w-lg glass-card rounded-3xl shadow-2xl overflow-hidden border border-[var(--border-color)]"
            >
              <div className="p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">Add New Member</h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleAddMember} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                    <input 
                      required
                      type="text" 
                      value={newMember.name}
                      onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                      className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[var(--text-primary)]"
                      placeholder="Enter member's full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Contact Number</label>
                    <input 
                      required
                      type="tel" 
                      value={newMember.contact}
                      onChange={(e) => setNewMember({...newMember, contact: e.target.value})}
                      className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[var(--text-primary)]"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Address</label>
                    <textarea 
                      required
                      value={newMember.address}
                      onChange={(e) => setNewMember({...newMember, address: e.target.value})}
                      className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[var(--text-primary)]"
                      placeholder="Enter full address"
                      rows={3}
                    />
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-[var(--border-color)] space-y-4">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                      <Sprout className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                      Production Area Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Crop Type</label>
                        <input 
                          type="text"
                          value={newMember.cropType}
                          onChange={(e) => setNewMember({...newMember, cropType: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
                          placeholder="e.g. Rice, Corn"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Soil Type</label>
                        <input 
                          type="text"
                          value={newMember.soilType}
                          onChange={(e) => setNewMember({...newMember, soilType: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
                          placeholder="e.g. Clay, Sandy"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Planting Date</label>
                        <input 
                          type="date"
                          value={newMember.plantingDate}
                          onChange={(e) => setNewMember({...newMember, plantingDate: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Est. Harvest Date</label>
                        <input 
                          type="date"
                          value={newMember.estimatedHarvestDate}
                          onChange={(e) => setNewMember({...newMember, estimatedHarvestDate: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-[var(--border-color)] space-y-4">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                      <ClipboardList className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                      Production Area Activities
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                          <input 
                            type="date"
                            value={currentActivity.date}
                            onChange={(e) => setCurrentActivity({...currentActivity, date: e.target.value})}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Activity Type</label>
                          <select 
                            value={currentActivity.type}
                            onChange={(e) => setCurrentActivity({...currentActivity, type: e.target.value})}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
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
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Description</label>
                        <input 
                          type="text"
                          value={currentActivity.description}
                          onChange={(e) => setCurrentActivity({...currentActivity, description: e.target.value})}
                          className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
                          placeholder="What was done?"
                        />
                      </div>
                      <div className="flex items-end space-x-3">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Cost</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input 
                              type="number"
                              value={currentActivity.cost}
                              onChange={(e) => setCurrentActivity({...currentActivity, cost: e.target.value})}
                              className="w-full pl-8 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-[var(--text-primary)]"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={addActivity}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {newMember.activities.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                        {newMember.activities.map((activity) => (
                          <div key={activity.id} className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)] flex items-center justify-between group">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-[var(--text-primary)]">{activity.type}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{activity.date} • {formatDualCurrency(activity.cost)}</p>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeActivity(activity.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Production Area Boundary</label>
                      <button 
                        type="button"
                        onClick={() => setShowMap(!showMap)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center"
                      >
                        {showMap ? 'Hide Map' : 'Define on Map'}
                        <MapIcon className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                    
                    {showMap && (
                      <div className="h-64 w-full rounded-2xl overflow-hidden border border-[var(--border-color)] relative">
                        <MapContainer 
                          center={[14.5995, 120.9842]} 
                          zoom={13} 
                          className="h-full w-full"
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          {newMember.productionArea && (
                            <Polygon 
                              positions={newMember.productionArea.geometry.coordinates[0].map(coord => [coord[1], coord[0]])}
                              eventHandlers={{
                                add: (e) => {
                                  const layer = e.target;
                                  (layer as any).memberId = "current";
                                }
                              }}
                              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3 }}
                            />
                          )}
                          <MapController productionArea={newMember.productionArea} />
                          <GeomanControls 
                            onPolygonCreated={(coords) => {
                              const center = coords.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]], [0, 0]);
                              const avgCenter = { lng: center[0] / coords.length, lat: center[1] / coords.length };
                              
                              setNewMember({
                                ...newMember,
                                location: avgCenter,
                                productionArea: {
                                  type: "Feature",
                                  geometry: {
                                    type: "Polygon",
                                    coordinates: [coords]
                                  },
                                  properties: {
                                    area_sqm: calculateArea(coords)
                                  }
                                }
                              });
                            }} 
                            onPolygonEdited={(_id, coords, area_sqm) => {
                              setNewMember({
                                ...newMember,
                                productionArea: {
                                  type: "Feature",
                                  geometry: {
                                    type: "Polygon",
                                    coordinates: [coords]
                                  },
                                  properties: {
                                    area_sqm: area_sqm
                                  }
                                }
                              });
                            }}
                            onPolygonRemoved={() => {
                              setNewMember({
                                ...newMember,
                                productionArea: undefined
                              });
                            }}
                            calculateArea={calculateArea}
                          />
                        </MapContainer>
                        <div className="absolute bottom-4 left-4 z-[1000] bg-[var(--bg-secondary)]/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400 shadow-sm border border-[var(--border-color)]">
                          Use the polygon tool to draw the production area
                        </div>
                      </div>
                    )}

                    {newMember.productionArea && (
                      <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20 flex items-center justify-between">
                        <div className="flex items-center text-sm text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Boundary defined successfully
                        </div>
                        <button 
                          type="button"
                          onClick={() => setNewMember({...newMember, productionArea: undefined})}
                          className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
                  >
                    Register Member
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
