import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Search, 
  Plus, 
  ShoppingCart, 
  Tag, 
  Package, 
  TrendingUp,
  Filter,
  MoreVertical,
  X,
  Upload,
  Image as ImageIcon,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  setDoc, 
  doc, 
  auth, 
  storage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteDoc, 
  deleteObject 
} from '../firebase';
import { Product, Sale } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Trash2, Edit2 } from 'lucide-react';
import { formatUSD, formatKHR } from '../utils/currency';

export const StoreModule = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    price: 0, 
    stock: 0, 
    category: '', 
    description: '' 
  });

  const quarterlyCategoryData = React.useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const categorySales: Record<string, number> = {};

    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      if (saleDate >= ninetyDaysAgo) {
        const product = products.find(p => p.id === sale.productId);
        const category = product?.category || 'Uncategorized';
        categorySales[category] = (categorySales[category] || 0) + sale.totalAmount;
      }
    });

    return Object.entries(categorySales)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [sales, products]);

  useEffect(() => {
    const pQ = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(pQ, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const sQ = query(collection(db, 'sales'));
    const sUnsubscribe = onSnapshot(sQ, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    return () => {
      unsubscribe();
      sUnsubscribe();
    };
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const id = editingProduct ? editingProduct.id : Math.random().toString(36).substring(7);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("User not authenticated");

      let imageUrl = editingProduct?.imageUrl || '';
      if (imageFile) {
        // If editing and there was an old image, we might want to delete it, 
        // but for simplicity we'll just upload the new one.
        const storageRef = ref(storage, `products/${id}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      await setDoc(doc(db, 'products', id), {
        ...newProduct,
        imageUrl,
        uid: uid
      }, { merge: true });

      setIsModalOpen(false);
      setEditingProduct(null);
      setNewProduct({ name: '', price: 0, stock: 0, category: '', description: '' });
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    } finally {
      setUploading(false);
    }
  };

  const handleRecordSale = async (product: Product) => {
    if (product.stock <= 0) {
      alert("Product out of stock!");
      return;
    }

    const quantity = 1; // For simplicity, we sell 1 at a time
    const totalAmount = product.price * quantity;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const saleId = Math.random().toString(36).substring(7);
      const sale: Sale = {
        id: saleId,
        productId: product.id,
        buyerName: 'Walk-in Customer',
        quantity,
        totalAmount,
        date: new Date().toISOString()
      };

      // Record sale
      await setDoc(doc(db, 'sales', saleId), { ...sale, uid });

      // Update stock
      await setDoc(doc(db, 'products', product.id), {
        ...product,
        stock: product.stock - quantity
      }, { merge: true });

      // Record transaction in accounting
      const transactionId = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'transactions', transactionId), {
        type: 'income',
        amount: totalAmount,
        description: `Sale of ${product.name}`,
        date: new Date().toISOString(),
        category: 'Sales',
        referenceId: saleId,
        uid
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'products', product.id));

      // Delete from Storage if it exists
      if (product.imageUrl && product.imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
          // We need the path from the URL. 
          // A simpler way is to store the storage path in the document, 
          // but we can try to infer it or just leave it for now.
          // For a robust app, we'd store the path.
          // Let's try to extract it from the URL if possible, or just skip if too complex.
          // The URL format is usually .../o/products%2F<filename>?alt=media...
          const decodedUrl = decodeURIComponent(product.imageUrl);
          const pathStart = decodedUrl.indexOf('/o/') + 3;
          const pathEnd = decodedUrl.indexOf('?');
          const fullPath = decodedUrl.substring(pathStart, pathEnd);
          const imageRef = ref(storage, fullPath);
          await deleteObject(imageRef);
        } catch (storageError) {
          console.error("Error deleting image from storage:", storageError);
          // Don't block the UI if storage deletion fails
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      description: product.description || ''
    });
    setImagePreview(product.imageUrl || null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-emerald-100 text-sm font-medium">Total Sales</p>
          <p className="text-2xl font-bold">{formatUSD(sales.reduce((acc, s) => acc + s.totalAmount, 0))}</p>
          <p className="text-sm text-emerald-200">{formatKHR(sales.reduce((acc, s) => acc + s.totalAmount, 0))}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Products</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{products.length}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <Tag className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Promotions</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">4</p>
        </div>
      </div>

      {/* Quarterly Sales Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 rounded-3xl"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Quarterly Sales by Category</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total revenue per category over the last 90 days</p>
          </div>
          <TrendingUp className="w-5 h-5 text-slate-400" />
        </div>
        <div className="h-80 w-full">
          {quarterlyCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterlyCategoryData} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={100} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} barSize={30}>
                  {quarterlyCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#8b5cf6'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 italic">
              No sales data available for the last quarter
            </div>
          )}
        </div>
      </motion.div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search products..." 
            className="w-full pl-12 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-[var(--text-primary)]"
          />
        </div>
        <button 
          onClick={() => {
            setEditingProduct(null);
            setNewProduct({ name: '', price: 0, stock: 0, category: '', description: '' });
            setImagePreview(null);
            setImageFile(null);
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Product</span>
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-64 glass-card rounded-3xl animate-pulse" />
          ))
        ) : (
          products.map((product) => (
            <motion.div 
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`glass-card rounded-3xl overflow-hidden group hover:shadow-2xl transition-all ${product.stock < 5 ? 'border-red-500 ring-2 ring-red-500/10' : ''}`}
            >
              <div className="h-40 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                <img 
                  src={product.imageUrl || `https://picsum.photos/seed/${product.name}/400/300`} 
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {product.stock < 5 && (
                  <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center space-x-1 z-10">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Low Stock</span>
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 flex flex-col items-end">
                  <span>{formatUSD(product.price)}</span>
                  <span className="text-[10px] opacity-70">{formatKHR(product.price)}</span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-[var(--text-primary)]">{product.name}</h3>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => handleEditClick(product)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    product.stock >= 10 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                      : product.stock >= 5
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  }`}>
                    {product.stock} {product.stock < 5 ? 'CRITICAL' : 'in stock'}
                  </span>
                  <button 
                    onClick={() => handleRecordSale(product)}
                    className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--bg-secondary)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--glass-border)]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleAddProduct} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Product Name</label>
                    <input 
                      required
                      type="text" 
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Price ($)</label>
                      <input 
                        required
                        type="number" 
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({...newProduct, price: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Initial Stock</label>
                      <input 
                        required
                        type="number" 
                        value={newProduct.stock}
                        onChange={(e) => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Product Image</label>
                    <div className="flex items-center space-x-4">
                      <div className="relative w-24 h-24 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-[var(--border-color)] rounded-2xl overflow-hidden flex items-center justify-center group">
                        {imagePreview ? (
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        )}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <Upload className="w-6 h-6 text-white" />
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Upload a high-quality image for your product. Max size 5MB.</p>
                        <button 
                          type="button"
                          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                          Select Image
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Category</label>
                    <input 
                      required
                      type="text" 
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-[var(--border-color)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[var(--text-primary)]"
                      placeholder="e.g. Seeds, Tools, Harvest"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{editingProduct ? 'Updating...' : 'Uploading...'}</span>
                      </>
                    ) : (
                      <span>{editingProduct ? 'Update Product' : 'Add Product'}</span>
                    )}
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
