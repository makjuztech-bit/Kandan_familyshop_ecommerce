import { useEffect, useMemo, useState } from 'react';
import { products, inr } from '../data/products';
import { useOrders } from '../data/orders';

const periods = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'custom', label: 'Custom Date Range' },
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const parseDate = (order) => {
  const value = order.createdAt || order.at || order.date;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const isCompleted = (order) => {
  const oStatus = String(order.status || order.orderStatus || '').toLowerCase();
  const pStatus = String(order.paymentStatus || '').toLowerCase();
  return pStatus === 'paid' && !['cancelled', 'refunded', 'failed'].includes(oStatus) && pStatus !== 'refunded';
};

const isPending = (order) => {
  const oStatus = String(order.status || order.orderStatus || '').toLowerCase();
  const pStatus = String(order.paymentStatus || '').toLowerCase();
  return ['processing', 'pending'].includes(oStatus) || pStatus === 'pending';
};

const isCancelledOrFailed = (order) => {
  const oStatus = String(order.status || order.orderStatus || '').toLowerCase();
  return ['cancelled', 'failed', 'refunded'].includes(oStatus);
};

const StatCard = ({ label, value }) => (
  <article className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm">
    <p className="text-sm text-ink/60">{label}</p>
    <p className="mt-2 font-serif text-3xl font-semibold text-primary">{value}</p>
  </article>
);

export default function AdminSales() {
  const allOrders = useOrders();
  const [dateFilter, setDateFilter] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState(null);
  const [appliedEnd, setAppliedEnd] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date');
  const [sortDesc, setSortDesc] = useState(true);

  // Set date ranges based on filter
  useEffect(() => {
    const now = new Date();
    let s = null, e = null;
    if (dateFilter === 'today') {
      s = startOfDay(now);
      e = endOfDay(now);
    } else if (dateFilter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      s = startOfDay(yesterday);
      e = endOfDay(yesterday);
    } else if (dateFilter === '7d') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      s = startOfDay(past);
      e = endOfDay(now);
    } else if (dateFilter === '30d') {
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      s = startOfDay(past);
      e = endOfDay(now);
    } else if (dateFilter === 'thisMonth') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = endOfDay(now);
    } else if (dateFilter === 'lastMonth') {
      s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      e = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    }
    
    if (dateFilter !== 'custom') {
      setAppliedStart(s);
      setAppliedEnd(e);
      setCustomStart('');
      setCustomEnd('');
    }
  }, [dateFilter]);

  const applyCustomDate = () => {
    if (customStart && customEnd) {
      setAppliedStart(startOfDay(new Date(customStart)));
      setAppliedEnd(endOfDay(new Date(customEnd)));
    }
  };

  const resetFilters = () => {
    setDateFilter('7d');
    setSearch('');
    setPage(1);
  };

  // Filter Orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      // Date Filter
      const d = parseDate(o);
      if (d && appliedStart && d < appliedStart) return false;
      if (d && appliedEnd && d > appliedEnd) return false;

      // Search Filter
      if (search) {
        const q = search.toLowerCase();
        const no = String(o.no || '').toLowerCase();
        const name = String(o.name || o.customerName || '').toLowerCase();
        const email = String(o.email || '').toLowerCase();
        const items = (o.items || []).map(i => String(i.name || '').toLowerCase()).join(' ');
        if (!no.includes(q) && !name.includes(q) && !email.includes(q) && !items.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [allOrders, appliedStart, appliedEnd, search]);

  // Sort Orders
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      let v1 = 0, v2 = 0;
      if (sortBy === 'date') {
        v1 = parseDate(a)?.getTime() || 0;
        v2 = parseDate(b)?.getTime() || 0;
      } else if (sortBy === 'amount') {
        v1 = Number(a.total || 0);
        v2 = Number(b.total || 0);
      } else if (sortBy === 'id') {
        v1 = a.no || '';
        v2 = b.no || '';
      }
      
      if (v1 < v2) return sortDesc ? 1 : -1;
      if (v1 > v2) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [filteredOrders, sortBy, sortDesc]);

  // Pagination
  const pageSize = 20;
  const totalPages = Math.ceil(sortedOrders.length / pageSize) || 1;
  const pagedOrders = sortedOrders.slice((page - 1) * pageSize, page * pageSize);

  // Metrics
  const metrics = useMemo(() => {
    let rev = 0, ordCount = 0, prodCount = 0, pending = 0, cancelled = 0;
    filteredOrders.forEach(o => {
      if (isCancelledOrFailed(o)) cancelled++;
      else if (isPending(o)) pending++;

      if (isCompleted(o)) {
        rev += Number(o.total || 0);
        ordCount++;
        (o.items || []).forEach(i => prodCount += Number(i.q || i.quantity || 1));
      }
    });
    return { rev, ordCount, prodCount, avg: ordCount ? rev / ordCount : 0, pending, cancelled };
  }, [filteredOrders]);

  // Export 
  const exportToCSV = () => {
    const headers = ['Order ID', 'Date', 'Customer Name', 'Email', 'Product Names', 'Quantity', 'Subtotal', 'Discount', 'Shipping', 'Tax', 'Total Amount', 'Payment Status', 'Order Status'];
    const rows = sortedOrders.map(o => [
      o.no,
      parseDate(o)?.toLocaleString('en-IN') || '',
      o.name || o.customerName || '',
      o.email || '',
      (o.items || []).map(i => i.name).join('; '),
      (o.items || []).reduce((sum, i) => sum + Number(i.q || i.quantity || 1), 0),
      o.subtotal || 0,
      o.discount || 0,
      o.shipping || 0,
      o.tax || 0,
      o.total || 0,
      o.paymentStatus || '',
      o.status || o.orderStatus || ''
    ]);
    
    let csv = headers.join(',') + '\n' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Best Selling Products
  const bestSellers = useMemo(() => {
    const map = {};
    filteredOrders.forEach(o => {
      if (!isCompleted(o)) return;
      (o.items || []).forEach(i => {
        const id = i.productId || i.sku || i.name;
        if (!map[id]) map[id] = { name: i.name, units: 0, rev: 0 };
        map[id].units += Number(i.q || i.quantity || 1);
        map[id].rev += Number(i.q || i.quantity || 1) * Number(i.price || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.units - a.units).slice(0, 10);
  }, [filteredOrders]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Sales Analytics</h1>
          <p className="mt-2 text-sm text-ink/70">Analyze completed sales, orders, and product performance.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToCSV} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink">Export to CSV</button>
          <button onClick={exportToCSV} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-bold text-primary">Export to Excel</button>
          <button onClick={() => window.print()} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-bold text-primary">Print Report</button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Date Filter</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {periods.map(p => (
            <button key={p.id} onClick={() => setDateFilter(p.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${dateFilter === p.id ? 'bg-primary text-white' : 'border border-gold/40 text-primary'}`}>
              {p.label}
            </button>
          ))}
          <button onClick={resetFilters} className="rounded-full border border-red-200 text-red-600 px-4 py-2 text-sm font-bold">Reset Filters</button>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-end gap-4 mt-4 p-4 bg-ivory/30 rounded-lg">
            <div>
              <label className="block text-sm mb-1">Start Date</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-gold/30 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">End Date</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-gold/30 p-2 rounded" />
            </div>
            <button onClick={applyCustomDate} className="bg-primary text-white px-4 py-2 rounded font-bold">Apply Filter</button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div>
        <input 
          type="text" 
          placeholder="Search by Order ID, Customer Name, Email or Product Name..." 
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-full border border-gold/40 px-6 py-3 shadow-sm focus:border-primary focus:outline-none"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Sales Revenue" value={inr(metrics.rev)} />
        <StatCard label="Total Orders" value={metrics.ordCount.toLocaleString('en-IN')} />
        <StatCard label="Total Products Sold" value={metrics.prodCount.toLocaleString('en-IN')} />
        <StatCard label="Average Order Value" value={inr(metrics.avg)} />
        <StatCard label="Pending Orders" value={metrics.pending.toLocaleString('en-IN')} />
        <StatCard label="Cancelled / Failed Orders" value={metrics.cancelled.toLocaleString('en-IN')} />
      </div>

      {/* Best Selling Products */}
      <section className="rounded-2xl border border-gold/30 bg-white shadow-sm p-5">
        <h2 className="text-xl mb-4">Best-Selling Products (Selected Period)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-ivory-dark text-ink/70">
              <tr>
                <th className="p-3">Product Name</th>
                <th className="p-3 text-right">Units Sold</th>
                <th className="p-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {bestSellers.map(p => (
                <tr key={p.name} className="border-t border-gold/20">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 text-right">{p.units}</td>
                  <td className="p-3 text-right">{inr(p.rev)}</td>
                </tr>
              ))}
              {!bestSellers.length && (
                <tr><td colSpan="3" className="p-6 text-center text-ink/60">No products sold in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sales Report Table */}
      <section className="rounded-2xl border border-gold/30 bg-white shadow-sm">
        <div className="p-5 flex justify-between items-center">
          <h2 className="text-xl">Sales Report Table</h2>
          <div className="text-sm flex gap-4">
            <span className="font-semibold">Sort By:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent outline-none cursor-pointer">
              <option value="date">Order Date</option>
              <option value="amount">Total Amount</option>
              <option value="id">Order ID</option>
            </select>
            <button onClick={() => setSortDesc(!sortDesc)} className="text-primary hover:underline">{sortDesc ? 'Desc ↓' : 'Asc ↑'}</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm whitespace-nowrap">
            <thead className="bg-ivory-dark text-ink/70">
              <tr>
                <th className="p-3">Order ID</th>
                <th className="p-3">Order Date</th>
                <th className="p-3">Customer Name</th>
                <th className="p-3 max-w-[200px]">Product Name</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">Discount</th>
                <th className="p-3 text-right">Shipping</th>
                <th className="p-3 text-right">GST/Tax</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map(o => (
                <tr key={o.no} className="border-t border-gold/20 hover:bg-ivory/20">
                  <td className="p-3 font-mono text-xs">{o.no}</td>
                  <td className="p-3">{parseDate(o)?.toLocaleString('en-IN') || '—'}</td>
                  <td className="p-3">
                    <p className="font-medium">{o.name || o.customerName}</p>
                    <p className="text-xs text-ink/60">{o.email}</p>
                  </td>
                  <td className="p-3 max-w-[200px] truncate" title={(o.items||[]).map(i=>i.name).join(', ')}>
                    {(o.items || []).map(i => i.name).join(', ')}
                  </td>
                  <td className="p-3 text-right">{(o.items || []).reduce((s,i)=>s+Number(i.q||i.quantity||1),0)}</td>
                  <td className="p-3 text-right">{inr(o.subtotal||0)}</td>
                  <td className="p-3 text-right">{inr(o.discount||0)}</td>
                  <td className="p-3 text-right">{inr(o.shipping||0)}</td>
                  <td className="p-3 text-right">{inr(o.tax||0)}</td>
                  <td className="p-3 text-right font-bold text-primary">{inr(o.total||0)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${String(o.paymentStatus).toLowerCase()==='paid'?'bg-green-100 text-green-800':'bg-orange-100 text-orange-800'}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${String(o.status||o.orderStatus).toLowerCase()==='cancelled'?'bg-red-100 text-red-800':'bg-blue-100 text-blue-800'}`}>
                      {o.status || o.orderStatus}
                    </span>
                  </td>
                  <td className="p-3 text-primary hover:underline cursor-pointer" onClick={() => window.location.hash = `#/admin?order=${o.no}`}>
                    View
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pagedOrders.length && <p className="p-8 text-center text-ink/60">No records found matching your filters.</p>}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center p-5 border-t border-gold/20">
            <span className="text-sm text-ink/60">Showing {pagedOrders.length} of {sortedOrders.length} records</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-gold/40 rounded disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 font-bold">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-gold/40 rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
