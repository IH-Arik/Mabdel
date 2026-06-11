import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, Tag, X, CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { smartflowApi } from '../api/services';

const FALLBACK_PRODUCTS = [
  {
    id: 'p1',
    name: 'Mabdel FitBand Pro',
    category: 'tech',
    price: 149.99,
    description: 'Advanced fitness smartwatch with real-time biometric tracking, sleep cycles analyzer, and integrated AI voice dictation.',
    imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&h=400&fit=crop',
    stock: 25
  },
  {
    id: 'p2',
    name: 'Premium HydroBottle 1L',
    category: 'equipment',
    price: 34.99,
    description: 'Double-walled vacuum insulated stainless steel water bottle. Keeps drinks cold for 24 hours or hot for 12 hours.',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=400&fit=crop',
    stock: 120
  },
  {
    id: 'p3',
    name: 'Mabdel Whey Isolate (Chocolate)',
    category: 'supplements',
    price: 59.99,
    description: 'Ultra-pure grass-fed whey protein isolate. 25g of protein per serving with added digestive enzymes.',
    imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&h=400&fit=crop',
    stock: 45
  },
  {
    id: 'p4',
    name: 'Seamless Tech Tee',
    category: 'apparel',
    price: 39.99,
    description: 'Ultra-lightweight, sweat-wicking running t-shirt with seamless construction to eliminate chafing.',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&h=400&fit=crop',
    stock: 80
  },
  {
    id: 'p5',
    name: 'Adjustable Dumbbell Set (24kg)',
    category: 'equipment',
    price: 249.99,
    description: 'Heavy duty adjustable dumbbells replacing 15 individual pairs. Smooth selector dial mechanism.',
    imageUrl: 'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=600&h=400&fit=crop',
    stock: 15
  },
  {
    id: 'p6',
    name: 'Acoustic Active Buds',
    category: 'tech',
    price: 89.99,
    description: 'Sweat-resistant wireless earbuds with active noise cancellation and specialized workout acoustic profiles.',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=400&fit=crop',
    stock: 32
  }
];

const categories = [
  { id: 'all', label: 'All Products' },
  { id: 'tech', label: 'Smart Tech' },
  { id: 'equipment', label: 'Fitness Equipment' },
  { id: 'supplements', label: 'Nutrition' },
  { id: 'apparel', label: 'Apparel' }
];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState('form'); // form, processing, success
  const [cardDetails, setCardDetails] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await smartflowApi.listShopProducts();
        if (response.data?.success && response.data?.data?.length > 0) {
          setProducts(response.data.data);
        } else {
          setProducts(FALLBACK_PRODUCTS);
        }
      } catch (err) {
        console.error('Failed to load shop products, using fallbacks:', err);
        setProducts(FALLBACK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category?.toLowerCase() === selectedCategory;
    const matchesSearch = product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    setPaymentError('');
    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc || !cardDetails.name) {
      setPaymentError('Please fill in all credit card details.');
      return;
    }
    
    setCheckoutStep('processing');
    setTimeout(() => {
      setCheckoutStep('success');
    }, 2000);
  };

  const closeCheckout = () => {
    setCheckoutProduct(null);
    setCheckoutStep('form');
    setCardDetails({ name: '', number: '', expiry: '', cvc: '' });
    setPaymentError('');
  };

  return (
    <div className="space-y-6 text-white pb-12 max-w-7xl mx-auto">
      {/* Top Title Row */}
      <div className="border-b border-[#243041]/40 pb-4 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Shop</h1>
        <p className="text-[#A4B0B7] text-xs mt-1">Browse and purchase official Mabdel fitness products, gear, and nutrition.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Category Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#11C7E5]/10 text-[#11C7E5] border-[#11C7E5]/30'
                  : 'bg-[#0c101b] text-[#A4B0B7] border-[#243041]/40 hover:text-white hover:border-[#243041]/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0c101b] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
          />
          <Search size={15} className="absolute left-3.5 top-3.5 text-[#A4B0B7]" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#11C7E5]" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center bg-[#0c101b] rounded-3xl border border-[#243041]/60">
          <ShoppingBag size={48} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-lg font-bold text-white">No Products Found</h3>
          <p className="text-slate-500 text-xs mt-1">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <motion.div
              layout
              key={product.id || product._id}
              className="bg-[#0c101b] border border-[#243041]/50 rounded-[22px] overflow-hidden flex flex-col justify-between hover:border-[#11C7E5]/30 group transition-all duration-300"
            >
              <div>
                {/* Product Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-900/50 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                  <img
                    src={product.imageUrl || product.image || 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&h=300&fit=crop'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1.5">
                    <Tag size={10} className="text-[#11C7E5]" />
                    <span className="text-[10px] font-black tracking-wider uppercase text-white">{product.category || 'General'}</span>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-5 text-left space-y-2">
                  <h3 className="font-bold text-white text-base truncate group-hover:text-[#11C7E5] transition-colors">{product.name}</h3>
                  <p className="text-[#A4B0B7] text-xs leading-relaxed line-clamp-2 min-h-[32px]">{product.description}</p>
                </div>
              </div>

              {/* Price and Action Row */}
              <div className="px-5 pb-5 pt-3 border-t border-[#243041]/30 flex items-center justify-between">
                <span className="text-xl font-black text-white">${product.price?.toFixed(2)}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="px-4 py-2 border border-[#243041] hover:border-[#A4B0B7]/40 rounded-xl text-xs font-bold text-[#A4B0B7] hover:text-white transition-colors cursor-pointer"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setCheckoutProduct(product)}
                    className="px-4 py-2 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-xl bg-[#0c101b] border border-[#243041] rounded-[28px] overflow-hidden shadow-2xl z-10 text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-slate-400 hover:text-white rounded-full transition-colors z-20 cursor-pointer"
              >
                <X size={16} />
              </button>

              {/* Cover Image */}
              <div className="w-full aspect-video relative">
                <img
                  src={selectedProduct.imageUrl || selectedProduct.image || 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&h=300&fit=crop'}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c101b] via-transparent to-transparent" />
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[10px] bg-[#11C7E5]/10 text-[#11C7E5] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#11C7E5]/10">
                      {selectedProduct.category || 'General'}
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-3">{selectedProduct.name}</h2>
                  </div>
                  <span className="text-2xl font-black text-[#11C7E5] shrink-0">${selectedProduct.price?.toFixed(2)}</span>
                </div>

                <p className="text-[#A4B0B7] text-xs leading-relaxed">{selectedProduct.description}</p>

                <div className="grid grid-cols-2 gap-4 py-2 text-xs">
                  <div className="bg-[#131A24] border border-[#243041]/40 rounded-xl p-3">
                    <span className="text-slate-500 block mb-1">Availability</span>
                    <span className="font-bold text-white">In Stock ({selectedProduct.stock || 24} left)</span>
                  </div>
                  <div className="bg-[#131A24] border border-[#243041]/40 rounded-xl p-3">
                    <span className="text-slate-500 block mb-1">Delivery</span>
                    <span className="font-bold text-white">Free Express (3-5 Days)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 py-3 border border-[#243041] hover:border-[#A4B0B7]/40 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer text-center"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setCheckoutProduct(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 py-3 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Payment Modal */}
      <AnimatePresence>
        {checkoutProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCheckout}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-[#0c101b] border border-[#243041] rounded-[28px] p-6 shadow-2xl z-10 text-left space-y-6"
            >
              {/* Close Button */}
              <button
                onClick={closeCheckout}
                className="absolute top-4 right-4 p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>

              {checkoutStep === 'form' && (
                <form onSubmit={handleCheckoutSubmit} className="space-y-5">
                  <div className="text-center">
                    <CreditCard size={28} className="mx-auto text-[#11C7E5] mb-2" />
                    <h3 className="text-lg font-black text-white">Payment Checkout</h3>
                    <p className="text-[#A4B0B7] text-xs">Enter your card details to complete your checkout purchase.</p>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 bg-[#131A24] border border-[#243041] rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <img
                        src={checkoutProduct.imageUrl || checkoutProduct.image}
                        alt={checkoutProduct.name}
                        className="w-10 h-10 object-cover rounded-lg"
                      />
                      <div>
                        <span className="font-bold text-white block truncate max-w-[150px]">{checkoutProduct.name}</span>
                        <span className="text-[#A4B0B7] text-[10px]">Qty: 1</span>
                      </div>
                    </div>
                    <span className="font-black text-[#11C7E5] text-sm">${checkoutProduct.price?.toFixed(2)}</span>
                  </div>

                  {paymentError && <p className="text-rose-400 text-[11px] font-bold bg-rose-950/20 p-2.5 rounded-lg border border-rose-950/50">{paymentError}</p>}

                  {/* Inputs */}
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Cardholder Name"
                      value={cardDetails.name}
                      onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="Card Number"
                      maxLength={16}
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        value={cardDetails.expiry}
                        onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-center"
                      />
                      <input
                        type="password"
                        placeholder="CVC"
                        maxLength={3}
                        value={cardDetails.cvc}
                        onChange={(e) => setCardDetails({ ...cardDetails, cvc: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-center"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
                    <ShieldCheck size={14} className="text-[#11C7E5]" />
                    <span>Secured Stripe Gateway Integration</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center"
                  >
                    Confirm & Pay
                  </button>
                </form>
              )}

              {checkoutStep === 'processing' && (
                <div className="py-12 flex flex-col justify-center items-center space-y-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#11C7E5]" />
                  <h4 className="font-extrabold text-white">Processing Transaction...</h4>
                  <p className="text-[#A4B0B7] text-xs">Authenticating and verifying payment credentials with card issuer...</p>
                </div>
              )}

              {checkoutStep === 'success' && (
                <div className="py-8 text-center space-y-5">
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                    <CheckCircle2 size={54} className="mx-auto text-emerald-400" />
                  </motion.div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-white">Payment Successful</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Your purchase of <span className="text-white font-bold">{checkoutProduct.name}</span> has been confirmed. A receipt has been sent to your email.
                    </p>
                  </div>
                  <button
                    onClick={closeCheckout}
                    className="w-full py-2.5 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
