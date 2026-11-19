import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Wallet,
  ShoppingBag,
  Factory,
  Boxes,
  BarChart3,
  ArrowLeft,
  Plus,
  Trash2,
  User,
  CheckCircle2,
  TrendingUp,
  Calendar,
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyAlSm8jiz_F0epu6RFfBp...",
  authDomain: "kap-po-kap.firebaseapp.com",
  projectId: "kap-po-kap",
  storageBucket: "kap-po-kap.firebasestorage.app",
  messagingSenderId: "830699442632",
  appId: "1:830699442632:web:89a20a553..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const USERS = ['Đorđe', 'Petar', 'Slavko'];

const RAKIJA_TYPES = ['Jabuka', 'Kruška', 'Šljiva', 'Kajsija', 'Dunja'];
const JUICE_TYPES = [
  'Jabuka',
  'Malina',
  'Višnja',
  'Zeleni mix',
  'Crveni mix',
  'Narandžasti mix',
];

const PRODUCT_CATALOG = [
  ...RAKIJA_TYPES.map((name) => ({
    id: `rakija_refuz_${name.toLowerCase()}`,
    category: 'Rakija',
    name: `Rakija ${name} (Refuz)`,
    shortName: `${name} — Refuz`,
    unit: 'L',
    packaging: 'Refuz',
    pdvMode: 'bez_pdv',
  })),
  ...RAKIJA_TYPES.map((name) => ({
    id: `rakija_07_${name.toLowerCase()}`,
    category: 'Rakija',
    name: `Rakija ${name} (0,7L)`,
    shortName: `${name} — Flaša 0,7L`,
    unit: 'kom',
    packaging: 'Staklo 0,7L',
    pdvMode: 'sa_pdv',
    bulkSourceId: `rakija_refuz_${name.toLowerCase()}`,
    litersPerUnit: 0.7,
  })),
  ...JUICE_TYPES.map((name) => ({
    id: `sok_3l_${name.toLowerCase().replace(/\s+/g, '_')}`,
    category: 'Sokovi',
    name: `Sok ${name} (3L BiB)`,
    shortName: `${name} — 3L Bag & Box`,
    unit: 'kom',
    packaging: 'Bag & Box 3L',
    pdvMode: 'both',
  })),
  ...JUICE_TYPES.map((name) => ({
    id: `sok_025_${name.toLowerCase().replace(/\s+/g, '_')}`,
    category: 'Sokovi',
    name: `Sok ${name} (0,25L)`,
    shortName: `${name} — Staklo 0,25L`,
    unit: 'kom',
    packaging: 'Staklo 0,25L',
    pdvMode: 'both',
  })),
];

const todayStr = () => new Date().toISOString().split('T')[0];

const formatRSD = (num) =>
  new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(num) || 0) + ' RSD';

const formatNum = (num) =>
  new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(num) || 0);

export default function App() {
  const [activeUser, setActiveUser] = useState(() => {
    return localStorage.getItem('kap_po_kap_user') || 'Đorđe';
  });
  const [screen, setScreen] = useState('home');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [expenseAmount, setExpenseAmount] = useState('');

  const [taxType, setTaxType] = useState(null);
  const [saleProductId, setSaleProductId] = useState('');
  const [saleQty, setSaleQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState(todayStr());
  const [saleNote, setSaleNote] = useState('');

  const [prodProductId, setProdProductId] = useState(PRODUCT_CATALOG[0].id);
  const [prodQty, setProdQty] = useState('');
  const [prodDate, setProdDate] = useState(todayStr());
  const [deductFromBulk, setDeductFromBulk] = useState(true);

  const [lagerFilter, setLagerFilter] = useState('sve');

  useEffect(() => {
    localStorage.setItem('kap_po_kap_user', activeUser);
  }, [activeUser]);

  useEffect(() => {
    const q = query(collection(db, 'evidencija'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setRecords(list);
        setLoading(false);
      },
      (err) => {
        console.error('Greška pri čitanju baze:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const availableSaleProducts = useMemo(() => {
    if (!taxType) return [];
    return PRODUCT_CATALOG.filter(
      (p) => p.pdvMode === taxType || p.pdvMode === 'both'
    );
  }, [taxType]);

  useEffect(() => {
    if (availableSaleProducts.length > 0) {
      setSaleProductId(availableSaleProducts[0].id);
    }
  }, [availableSaleProducts]);

  const inventory = useMemo(() => {
    const stockMap = {};
    PRODUCT_CATALOG.forEach((p) => {
      stockMap[p.id] = { ...p, produced: 0, sold: 0, usedForBottling: 0, stock: 0 };
    });

    records.forEach((r) => {
      if (r.type === 'proizvodnja' && stockMap[r.productId]) {
        const qty = Number(r.qty) || 0;
        stockMap[r.productId].produced += qty;
        if (r.deductedBulkId && stockMap[r.deductedBulkId]) {
          stockMap[r.deductedBulkId].usedForBottling += Number(r.deductedLiters) || 0;
        }
      }
      if (r.type === 'prodaja' && stockMap[r.productId]) {
        stockMap[r.productId].sold += Number(r.qty) || 0;
      }
    });

    Object.values(stockMap).forEach((item) => {
      item.stock = item.produced - item.sold - item.usedForBottling;
    });

    return Object.values(stockMap);
  }, [records]);

  const stats = useMemo(() => {
    let totalExpenses = 0;
    let totalRevenue = 0;
    let revenueSaPdv = 0;
    let revenueBezPdv = 0;

    const productSales = {};
    const productProduced = {};
    const monthlyStats = {};

    records.forEach((r) => {
      const monthKey = (r.date || '').slice(0, 7) || 'Nepoznato';
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { month: monthKey, revenue: 0, expenses: 0, unitsSold: 0 };
      }

      if (r.type === 'trosak') {
        const amt = Number(r.amount) || 0;
        totalExpenses += amt;
        monthlyStats[monthKey].expenses += amt;
      }

      if (r.type === 'prodaja') {
        const rev = Number(r.totalAmount) || 0;
        const qty = Number(r.qty) || 0;
        totalRevenue += rev;
        if (r.taxType === 'sa_pdv') revenueSaPdv += rev;
        if (r.taxType === 'bez_pdv') revenueBezPdv += rev;

        monthlyStats[monthKey].revenue += rev;
        monthlyStats[monthKey].unitsSold += qty;

        if (!productSales[r.productId]) {
          productSales[r.productId] = {
            name: r.productName,
            unit: r.unit,
            qty: 0,
            revenue: 0,
          };
        }
        productSales[r.productId].qty += qty;
        productSales[r.productId].revenue += rev;
      }

      if (r.type === 'proizvodnja') {
        const qty = Number(r.qty) || 0;
        if (!productProduced[r.productId]) {
          productProduced[r.productId] = {
            name: r.productName,
            unit: r.unit,
            qty: 0,
          };
        }
        productProduced[r.productId].qty += qty;
      }
    });

    const profit = totalRevenue - totalExpenses;
    const sortedMonths = Object.values(monthlyStats).sort((a, b) => b.revenue - a.revenue);
    const bestMonth = sortedMonths.length > 0 && sortedMonths[0].revenue > 0 ? sortedMonths[0] : null;

    return {
      totalExpenses,
      totalRevenue,
      revenueSaPdv,
      revenueBezPdv,
      profit,
      bestMonth,
      topProducts: Object.values(productSales).sort((a, b) => b.revenue - a.revenue),
      producedList: Object.values(productProduced).sort((a, b) => b.qty - a.qty),
      monthlyBreakdown: Object.values(monthlyStats).sort((a, b) => b.month.localeCompare(a.month)),
    };
  }, [records]);

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;
    await addDoc(collection(db, 'evidencija'), {
      type: 'trosak',
      description: expenseDesc.trim(),
      amount: Number(expenseAmount),
      date: expenseDate,
      user: activeUser,
      createdAt: serverTimestamp(),
    });
    setExpenseDesc('');
    setExpenseAmount('');
    showToast('Trošak je uspešno sačuvan!');
  };

  const handleSaveSale = async (e) => {
    e.preventDefault();
    if (!saleProductId || !saleQty) return;
    const prod = PRODUCT_CATALOG.find((p) => p.id === saleProductId);
    const qty = Number(saleQty);
    const unitPrice = Number(salePrice) || 0;
    const totalAmount = qty * unitPrice;

    await addDoc(collection(db, 'evidencija'), {
      type: 'prodaja',
      taxType,
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit,
      qty,
      unitPrice,
      totalAmount,
      note: saleNote.trim(),
      date: saleDate,
      user: activeUser,
      createdAt: serverTimestamp(),
    });
    setSaleQty('');
    setSalePrice('');
    setSaleNote('');
    showToast('Prodaja je zabeležena i lager je ažuriran!');
  };

  const handleSaveProduction = async (e) => {
    e.preventDefault();
    if (!prodProductId || !prodQty) return;
    const prod = PRODUCT_CATALOG.find((p) => p.id === prodProductId);
    const qty = Number(prodQty);

    const payload = {
      type: 'proizvodnja',
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit,
      qty,
      date: prodDate,
      user: activeUser,
      createdAt: serverTimestamp(),
    };

    if (prod.bulkSourceId && deductFromBulk) {
      payload.deductedBulkId = prod.bulkSourceId;
      payload.deductedLiters = Number((qty * prod.litersPerUnit).toFixed(2));
    }

    await addDoc(collection(db, 'evidencija'), payload);
    setProdQty('');
    showToast('Proizvodnja je upisana na lager!');
  };

  const handleDeleteRecord = async (id) => {
    await deleteDoc(doc(db, 'evidencija', id));
    showToast('Stavka je obrisana.');
  };

  const selectedProdObj = PRODUCT_CATALOG.find((p) => p.id === prodProductId);
  const selectedSaleObj = PRODUCT_CATALOG.find((p) => p.id === saleProductId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col max-w-2xl mx-auto pb-12">
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {screen !== 'home' && (
              <button
                onClick={() => {
                  setScreen('home');
                  setTaxType(null);
                }}
                className="p-3 rounded-2xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 active:scale-95 transition"
              >
                <ArrowLeft className="w-7 h-7 text-amber-400" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-amber-400 leading-tight">
                Destilerija Kap po Kap
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                {loading ? 'Povezivanje sa bazom...' : 'Zajednička evidencija uživo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
            {USERS.map((u) => (
              <button
                key={u}
                onClick={() => setActiveUser(u)}
                className={`px-3 py-2 rounded-xl text-sm sm:text-base font-bold transition ${
                  activeUser === u
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-zinc-950 font-extrabold px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-lg">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <main className="flex-1 px-4 pt-6">
        {screen === 'home' && (
          <div className="space-y-4">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <User className="w-6 h-6 text-amber-400" />
                <span className="text-base sm:text-lg text-zinc-300">
                  Prijavljen: <strong className="text-white">{activeUser}</strong>
                </span>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Aktivno
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setScreen('trosak')}
                className="w-full bg-zinc-900 hover:bg-zinc-800/90 border-2 border-rose-500/40 rounded-3xl p-6 flex items-center gap-5 text-left transition shadow-lg"
              >
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-9 h-9 text-rose-400" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white">Trošak</div>
                  <div className="text-base text-zinc-400 mt-0.5">Upis nabavke, ambalaže, voća...</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setTaxType(null);
                  setScreen('prodato');
                }}
                className="w-full bg-zinc-900 hover:bg-zinc-800/90 border-2 border-emerald-500/40 rounded-3xl p-6 flex items-center gap-5 text-left transition shadow-lg"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-9 h-9 text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white">Prodato</div>
                  <div className="text-base text-zinc-400 mt-0.5">Prodaja sa PDV-om ili bez PDV-a</div>
                </div>
              </button>

              <button
                onClick={() => setScreen('proizvedeno')}
                className="w-full bg-zinc-900 hover:bg-zinc-800/90 border-2 border-amber-500/40 rounded-3xl p-6 flex items-center gap-5 text-left transition shadow-lg"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Factory className="w-9 h-9 text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white">Proizvedeno</div>
                  <div className="text-base text-zinc-400 mt-0.5">Unos nove rakije i ceđenih sokova</div>
                </div>
              </button>

              <button
                onClick={() => setScreen('lager')}
                className="w-full bg-zinc-900 hover:bg-zinc-800/90 border-2 border-sky-500/40 rounded-3xl p-6 flex items-center gap-5 text-left transition shadow-lg"
              >
                <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center shrink-0">
                  <Boxes className="w-9 h-9 text-sky-400" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white">Lager</div>
                  <div className="text-base text-zinc-400 mt-0.5">Trenutno stanje svih proizvoda</div>
                </div>
              </button>

              <button
                onClick={() => setScreen('statistika')}
                className="w-full bg-zinc-900 hover:bg-zinc-800/90 border-2 border-purple-500/40 rounded-3xl p-6 flex items-center gap-5 text-left transition shadow-lg"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-9 h-9 text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white">Statistika</div>
                  <div className="text-base text-zinc-400 mt-0.5">Zarada, troškovi i analitika</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {screen === 'trosak' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-rose-400" />
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Novi trošak</h2>
            </div>
            <form onSubmit={handleSaveExpense} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-5">
              <div>
                <label className="block text-lg font-bold text-zinc-200 mb-2">Koji je trošak?</label>
                <input
                  type="text"
                  required
                  placeholder="Npr. Flaše 0,7L, Jabuka..."
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-rose-400 rounded-2xl px-4 py-4 text-lg text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-lg font-bold text-zinc-200 mb-2">Iznos (RSD)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="0"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-rose-400 rounded-2xl px-4 py-4 text-2xl font-bold text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-lg font-bold text-zinc-200 mb-2">Datum</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-rose-400 rounded-2xl px-4 py-4 text-lg text-white outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-rose-500 hover:bg-rose-400 text-zinc-950 font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-7 h-7" /> Sačuvaj trošak ({activeUser})
              </button>
            </form>
          </div>
        )}

        {screen === 'prodato' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-emerald-400" />
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Prodaja</h2>
            </div>
            {!taxType ? (
              <div className="space-y-4">
                <p className="text-lg text-zinc-300 font-medium">Izaberi vrstu prodaje:</p>
                <button
                  onClick={() => setTaxType('sa_pdv')}
                  className="w-full bg-zinc-900 border-2 border-emerald-500/50 rounded-3xl p-7 text-left"
                >
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">Sa PDV-om</div>
                  <div className="text-base text-zinc-300 mt-1">Rakija 0,7L i sokovi (3L i 0,25L)</div>
                </button>
                <button
                  onClick={() => setTaxType('bez_pdv')}
                  className="w-full bg-zinc-900 border-2 border-amber-500/50 rounded-3xl p-7 text-left"
                >
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">Bez PDV-a</div>
                  <div className="text-base text-zinc-300 mt-1">Rakija u refuzu i sokovi</div>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveSale} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-5">
                <div className="flex items-center justify-between bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
                  <span className="text-lg font-extrabold text-emerald-400">
                    {taxType === 'sa_pdv' ? 'SA PDV-OM' : 'BEZ PDV-A'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTaxType(null)}
                    className="text-sm font-bold text-amber-400 underline px-2 py-1"
                  >
                    Promeni
                  </button>
                </div>
                <div>
                  <label className="block text-lg font-bold text-zinc-200 mb-2">Proizvod</label>
                  <select
                    value={saleProductId}
                    onChange={(e) => setSaleProductId(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-2xl px-4 py-4 text-lg font-bold text-white outline-none"
                  >
                    {availableSaleProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-lg font-bold text-zinc-200 mb-2">Količina</label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="any"
                      placeholder="0"
                      value={saleQty}
                      onChange={(e) => setSaleQty(e.target.value)}
                      className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-2xl px-4 py-4 text-2xl font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-bold text-zinc-200 mb-2">Cena (RSD)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-2xl px-4 py-4 text-2xl font-bold text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-lg font-bold text-zinc-200 mb-2">Datum</label>
                  <input
                    type="date"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-2xl px-4 py-4 text-lg text-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2"
                >
                  <Plus className="w-7 h-7" /> Sačuvaj prodaju ({activeUser})
                </button>
              </form>
            )}
          </div>
        )}

        {screen === 'proizvedeno' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Factory className="w-8 h-8 text-amber-400" />
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Proizvodnja</h2>
            </div>
            <form onSubmit={handleSaveProduction} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-5">
              <div>
                <label className="block text-lg font-bold text-zinc-200 mb-2">Proizvod</label>
                <select
                  value={prodProductId}
                  onChange={(e) => setProdProductId(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-2xl px-4 py-4 text-lg font-bold text-white outline-none"
                >
                  {PRODUCT_CATALOG.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-lg font-bold text-zinc-200 mb-2">Količina</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="any"
                  placeholder="0"
                  value={prodQty}
                  onChange={(e) => setProdQty(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-2xl px-4 py-4 text-2xl font-bold text-white outline-none"
                />
              </div>
              {selectedProdObj?.bulkSourceId && (
                <label className="flex items-start gap-3 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductFromBulk}
                    onChange={(e) => setDeductFromBulk(e.target.checked)}
                    className="w-6 h-6 mt-0.5 accent-amber-500"
                  />
                  <span className="text-base text-zinc-300">
                    Automatski umanji refuz za <strong className="text-amber-400">{formatNum((Number(prodQty) || 0) * 0.7)} L</strong>
                  </span>
                </label>
              )}
              <div>
                <label className="block text-lg font-bold text-zinc-200 mb-2">Datum</label>
                <input
                  type="date"
                  required
                  value={prodDate}
                  onChange={(e) => setProdDate(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-2xl px-4 py-4 text-lg text-white outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2"
              >
                <Plus className="w-7 h-7" /> Dodaj na lager ({activeUser})
              </button>
            </form>
          </div>
        )}

        {screen === 'lager' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Boxes className="w-8 h-8 text-sky-400" />
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Lager</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
              {[
                { id: 'sve', label: 'Sve' },
                { id: 'Rakija', label: 'Rakija' },
                { id: 'Sokovi', label: 'Sokovi' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLagerFilter(tab.id)}
                  className={`py-3 rounded-xl text-base font-extrabold transition ${
                    lagerFilter === tab.id ? 'bg-sky-500 text-zinc-950' : 'text-zinc-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {inventory
                .filter((item) => lagerFilter === 'sve' || item.category === lagerFilter)
                .map((item) => (
                  <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 inline-block">
                        {item.packaging}
                      </div>
                      <div className="text-lg font-bold text-white mt-1">{item.name}</div>
                      <div className="text-xs text-zinc-400">Proizvedeno: {formatNum(item.produced)} • Prodato: {formatNum(item.sold)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-sky-400">{formatNum(item.stock)}</div>
                      <div className="text-sm font-bold text-zinc-400">{item.unit}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {screen === 'statistika' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-purple-400" />
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Statistika</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4">
                <div className="text-sm font-bold text-zinc-400">Ukupan prihod</div>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">{formatRSD(stats.totalRevenue)}</div>
              </div>
              <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4">
                <div className="text-sm font-bold text-zinc-400">Ukupni troškovi</div>
                <div className="text-2xl font-extrabold text-rose-400 mt-1">{formatRSD(stats.totalExpenses)}</div>
              </div>
              <div className="bg-zinc-900 border border-purple-500/40 rounded-2xl p-4">
                <div className="text-sm font-bold text-zinc-400">Čista zarada</div>
                <div className={`text-2xl font-extrabold mt-1 ${stats.profit >= 0 ? 'text-purple-400' : 'text-rose-400'}`}>
                  {formatRSD(stats.profit)}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
