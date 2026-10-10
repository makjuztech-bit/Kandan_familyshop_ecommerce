import fs from 'node:fs';

const file = 'src/pages/Admin.jsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);

const replacementLines = [
  `  {tab==='products'&&(edit?<Form key={edit.id} init={edit} onDone={()=>setEdit(null)}/>:<><div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-serif font-bold text-ink">Products <span className="ml-2 rounded-full bg-gold/20 px-3 py-1 text-sm text-maroon font-sans font-bold">{products.length}</span></h1><div className="flex flex-wrap gap-3"><button className={btnP} onClick={()=>setEdit(blank())}>Add product</button><button className={btnO} onClick={()=>confirm('Reset products and site images to the sample data?')&&resetCatalog()}>Reset sample data</button></div></div>`,
  `   <div className="mt-4 flex flex-wrap items-center gap-3">`,
  `     <input id="pq" type="search" placeholder="Search by name, SKU, or color..." value={q} onChange={e=>setQ(e.target.value)} className={sel+' max-w-sm rounded-lg'}/>`,
  `     <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className={sel+' max-w-xs rounded-lg'}>`,
  `       <option value="">All Categories ({products.length})</option>`,
  `       {COLLECTIONS.map(c=><option key={c} value={c}>{c} ({products.filter(p=>p.collection===c).length})</option>)}`,
  `     </select>`,
  `     {(q || catFilter) && <button type="button" onClick={()=>{setQ('');setCatFilter('')}} className="text-xs text-maroon underline font-bold">Clear filters</button>}`,
  `   </div>`,
  `   <div className="mt-4 overflow-x-auto border border-gold/40 bg-white shadow-sm rounded-xl"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-ivory-dark"><tr><th className="p-3">Product / SKU</th><th className="p-3">Category</th><th className="p-3">Price &amp; Discount</th><th className="p-3">Stock &amp; Units</th><th className="p-3">Badges</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{shown.map(p=><tr key={p.id} className="border-t border-gold/30 hover:bg-gold/5 transition-colors"><td className="p-3"><div className="flex items-center gap-3"><div className="h-14 w-11 shrink-0 overflow-hidden rounded bg-ivory-dark border border-gold/30"><Img src={p.images[0]} alt="" tone={p.hex} className="h-full w-full object-cover"/></div><div><p className="font-bold text-ink leading-tight">{p.name}</p><p className="font-mono text-xs text-ink/50 mt-0.5">SKU: {p.sku || p.id}</p></div></div></td><td className="p-3 text-xs font-semibold text-ink/80">{p.collection}</td><td className="p-3"><div><span className="font-bold text-maroon">{inr(p.price)}</span>{p.originalPrice > p.price && <span className="block text-xs text-ink/40 line-through">{inr(p.originalPrice)}</span>}{p.discount > 0 && <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">{p.discount}% OFF</span>}</div></td>`,
  `    <td className="p-3"><div><button className={'rounded-full px-2.5 py-0.5 text-xs font-bold '+(p.stock?'bg-emerald/15 text-emerald':'bg-red-100 text-red-800')} aria-pressed={p.stock} onClick={()=>saveProduct({...p,stock:!p.stock})}>{p.stock?'In stock':'Out of stock'}</button><span className="block text-xs text-ink/50 mt-1">{p.stockCount ?? 10} units</span></div></td>`,
  `    <td className="p-3"><div className="flex flex-col gap-1">{p.best && <span className="w-fit rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">★ Best</span>}{p.isNew && <span className="w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">✦ New</span>}</div></td>`,
  `    <td className="whitespace-nowrap p-3 text-right"><button className="min-h-11 px-2.5 font-bold text-maroon underline" onClick={()=>setEdit(p)}>Edit</button><button className="min-h-11 px-2.5 text-red-700 underline" onClick={()=>confirm('Delete '+p.name+'?')&&deleteProduct(p.id)}>Delete</button></td></tr>)}</tbody></table>{!shown.length&&<p className="p-8 text-center text-ink/60">No products match your search or filter.</p>}</div></>)}`
];

// Replace lines from index 354 to 358 (lines 355 to 359 1-based)
lines.splice(354, 5, ...replacementLines);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Admin.jsx successfully updated with line splice!');
