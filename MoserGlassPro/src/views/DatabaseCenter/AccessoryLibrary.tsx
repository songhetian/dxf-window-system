import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Trash2, Edit3, ChevronLeft, ChevronRight, AlertTriangle, Search, X, Loader2, CheckCircle2, Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Combobox } from '../../components/ui/Combobox';
import { cn } from '../../lib/utils';

export const AccessoryLibrary = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'BASE' | 'CAT' | 'FEE'>('BASE');
  const [page, setPage] = useState(1);
  const pageSize = 16;
  const [searchTerm, setSearchTerm] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => (window.db?.getCategories?.() || []) });
  const { data: baseLibrary = [] } = useQuery({ queryKey: ['baseLibrary'], queryFn: () => (window.db?.getBaseLibrary?.() || []) });
  const { data: fees = [] } = useQuery({ queryKey: ['fees'], queryFn: () => (window.db?.getFeeDefinitions?.() || []) });

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [poolCatId, setPoolCatId] = useState<any>(''); 

  const [form, setForm] = useState<any>({ 
    id: null, name: '', guide: '', agency: '', 
    batch: false, rate: '', category_id: '',
    price_type: 'FIXED', unit_name: '件'
  });

  const tabLabels = useMemo(() => {
    switch(activeTab) {
      case 'BASE': return { btn: '添加配件项', title: '配件与方案库', item: '配件' };
      case 'CAT': return { btn: '设置配件分类', title: '配件分类管理', item: '分类' };
      case 'FEE': return { btn: '设置辅料费率', title: '加价比例/杂费设置', item: '费率' };
      default: return { btn: '新建', title: '管理', item: '项' };
    }
  }, [activeTab]);

  useEffect(() => {
    if (categories.length > 0 && !poolCatId) {
      const accessoryCat = categories.find((c:any) => c.name.includes('配件') || c.name.includes('辅料') || c.name.includes('胶') || c.name.includes('系统'));
      setPoolCatId(accessoryCat ? accessoryCat.id.toString() : categories[0].id.toString());
    }
  }, [categories]);

  const handleOpenAdd = () => {
    setBuilderMode('ADD');
    setForm({ 
      id: null, name: '', guide: '', agency: '', 
      batch: false, rate: '', category_id: poolCatId,
      price_type: 'FIXED', unit_name: '件'
    });
    setIsBuilderOpen(true);
  };

  const handleOpenEdit = async (i: any) => {
    setBuilderMode('EDIT');
    setForm({
      id: i.id,
      name: i.name || '',
      guide: i.guide_price ?? '',
      agency: i.agency_price ?? '',
      rate: i.default_rate ?? '',
      category_id: i.category_id || '',
      price_type: i.price_type || 'FIXED',
      unit_name: i.unit_name || '件',
    });
    setIsBuilderOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (d: any) => {
      if (!window.db) return;
      const payload = { 
        ...d, 
        guidePrice: d.guide === '' ? 0 : Number(d.guide), 
        agencyPrice: d.agency === '' ? 0 : Number(d.agency), 
        rate: d.rate === '' ? 0 : Number(d.rate) 
      };
      if (builderMode === 'ADD') {
        if (activeTab === 'BASE') return window.db.addBaseItem({ 
          name: d.name, 
          category_id: Number(d.category_id),
          price_type: d.price_type,
          unit_name: d.unit_name,
          agency_price: payload.agencyPrice,
          guide_price: payload.guidePrice
        });
        if (activeTab === 'CAT') return window.db.addCategory({ name: d.name });
        return window.db.addFee({ name: d.name, rate: payload.rate });
      } else {
        const table = activeTab === 'FEE' ? 'fee_definitions' : activeTab === 'CAT' ? 'categories' : 'base_library';
        await window.db.updateBaseItem({ 
          table, id: d.id, name: d.name, category_id: d.category_id, rate: payload.rate,
          price_type: d.price_type,
          unit_name: d.unit_name,
          agency_price: payload.agencyPrice,
          guide_price: payload.guidePrice
        });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries(); if (!form.batch || builderMode === 'EDIT') setIsBuilderOpen(false); setForm((p:any)=>({...p, name: '', guide: '', agency: '', rate: '', unit_name: '件'})); }
  });

  const deleteMutation = useMutation({
    mutationFn: (item: any) => {
      const id = item.id;
      if (activeTab === 'BASE') return window.db.deleteBaseItem(id);
      if (activeTab === 'FEE') return window.db.deleteFee(id);
      return window.db.deleteCategory(id);
    },
    onSuccess: () => { queryClient.invalidateQueries(); setItemToDelete(null); }
  });

  const filteredData = useMemo(() => {
    let raw = activeTab === 'BASE' ? baseLibrary : activeTab === 'CAT' ? categories : fees;
    if (activeTab === 'BASE') {
      raw = raw.filter((i:any) => i.categoryName.includes('配件') || i.categoryName.includes('辅料') || i.categoryName.includes('胶') || i.categoryName.includes('系统'));
    }
    const term = searchTerm.toLowerCase();
    return raw.filter((i:any) => (i?.name || '').toLowerCase().includes(term));
  }, [activeTab, baseLibrary, categories, fees, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  if (!window.db) return <div className="h-full w-full flex items-center justify-center text-slate-950 font-black"><Loader2 className="animate-spin mr-2"/> 加载引擎核心...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-transparent min-h-screen transition-none">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#0f172a] p-4 border border-slate-100 rounded-xl shadow-sm">
        <div className="flex bg-slate-50 dark:bg-white/5 p-1 rounded-lg gap-1 border border-slate-100">
          <NavTab active={activeTab === 'BASE'} onClick={() => {setActiveTab('BASE'); setPage(1); setSearchTerm('');}} label="配件管理" />
          <NavTab active={activeTab === 'CAT'} onClick={() => {setActiveTab('CAT'); setPage(1); setSearchTerm('');}} label="配件分类" />
          <NavTab active={activeTab === 'FEE'} onClick={() => {setActiveTab('FEE'); setPage(1); setSearchTerm('');}} label="相关费用" />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-950" size={14} /><input className="stitch-input w-full pl-10 h-9 text-[13px] font-black text-slate-950 bg-white border border-slate-200 rounded-lg" placeholder={`搜索配件...`} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} /></div>
          <button onClick={handleOpenAdd} className="h-9 px-5 bg-blue-600 text-white rounded-lg font-black text-xs active:scale-95 transition-all flex items-center gap-2"><Plus size={14} strokeWidth={3}/>{tabLabels.btn}</button>
        </div>
      </div>

      <div className="flex-1 min-h-[600px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 transition-none">
          {filteredData.slice((page-1)*pageSize, page*pageSize).map((item: any, idx: number) => (
            <div key={idx} className="p-5 rounded-xl relative transition-all group shadow-sm border border-slate-100 overflow-hidden bg-white dark:bg-[#0f172a]">
              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                  <h4 className="text-[14px] font-black text-slate-950 dark:text-white leading-tight tracking-tight">{item?.name}</h4>
                  <p className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest truncate max-w-[180px]">{item?.categoryName || '基础数据'}</p>
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => handleOpenEdit(item)} className="p-1.5 bg-white/80 dark:bg-white/5 hover:bg-white text-slate-950 dark:text-white hover:text-blue-600 rounded-lg shadow-sm border border-black/5 dark:border-white/5"><Edit3 size={14}/></button>
                  <button onClick={() => setItemToDelete(item)} className="p-1.5 bg-white/80 dark:bg-white/5 hover:bg-white text-slate-950 dark:text-white hover:text-rose-600 rounded-lg shadow-sm border border-black/5 dark:border-white/5"><Trash2 size={14}/></button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 relative z-10 flex flex-col gap-1.5">
                {activeTab === 'BASE' ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[9px] font-black text-blue-600 uppercase">零售价:</span>
                      <span className="text-[12px] font-black text-slate-950 dark:text-white">
                        ¥{item?.guide_price?.toFixed(2)} / {item.unit_name || '件'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[9px] font-black text-emerald-600 uppercase">内部价:</span>
                      <span className="text-[12px] font-black text-slate-950 dark:text-white">
                        ¥{item?.agency_price?.toFixed(2)} / {item.unit_name || '件'}
                      </span>
                    </div>
                  </>
                ) : activeTab === 'FEE' ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-[9px] font-black text-blue-600 uppercase">当前费率:</span>
                    <span className="text-[15px] font-black text-slate-950 dark:text-white">{(item?.default_rate * 100).toFixed(1)}%</span>
                  </div>
                ) : <div className="h-5" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="p-0 border-none shadow-2xl rounded-2xl bg-white dark:bg-[#020617] overflow-hidden w-[95vw] md:w-[520px]">
            <div className="p-8 space-y-8 bg-white dark:bg-[#020617]">
              <div className="text-center space-y-1">
                <DialogTitle className="text-base font-black uppercase tracking-widest text-slate-950 dark:text-white">
                  {builderMode === 'EDIT' ? `更新${tabLabels.item}` : tabLabels.btn}
                </DialogTitle>
              </div>
              <div className="space-y-5">
                <div className="space-y-1.5 text-left"><label className="text-[10px] font-black text-slate-950 dark:text-white uppercase ml-1">{tabLabels.item}名称</label><input className="stitch-input w-full h-11 font-black text-center text-slate-950 dark:text-white bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} /></div>
                
                {activeTab === 'BASE' && (
                  <div className="space-y-5 py-2">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">计价逻辑</label>
                      <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                        {['AREA', 'LINEAR', 'FIXED'].map(mode => (
                          <button key={mode} type="button" onClick={()=>setForm({...form, price_type:mode})} 
                            className={cn("flex-1 py-2 text-[11px] font-black rounded-md transition-all", 
                            form.price_type === mode ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                            {mode === 'AREA' ? '随面积' : mode === 'LINEAR' ? '随周长' : '随窗扇数量'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">单位名称</label>
                        <input placeholder="套/件/延米" className="stitch-input w-full h-10 px-4 text-[12px] font-black bg-white border border-slate-200 rounded-lg" value={form.unit_name} onChange={e=>setForm({...form, unit_name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">快捷</label>
                        <div className="flex gap-1 h-10">
                          {['套','件','延米','瓶'].map(u => (
                            <button key={u} type="button" onClick={()=>setForm({...form, unit_name: u})} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black hover:bg-slate-100">{u}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">零售标价 (元)</label>
                        <input type="text" className="stitch-input w-full h-10 px-4 text-blue-600 text-lg font-black bg-white border border-slate-200 rounded-lg" value={form.guide} onChange={e=>setForm({...form, guide: e.target.value.replace(/\D/g, '')})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">内部价格 (元)</label>
                        <input type="text" className="stitch-input w-full h-10 px-4 text-slate-900 text-lg font-black bg-white border border-slate-200 rounded-lg" value={form.agency} onChange={e=>setForm({...form, agency: e.target.value.replace(/\D/g, '')})} />
                      </div>
                    </div>
                  </div>
                )}

                {(activeTab === 'BASE' || activeTab === 'FEE') && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-950 dark:text-white uppercase ml-1">
                      {activeTab === 'BASE' ? '配件分类' : '费率系数(0-1)'}
                    </label>
                    {activeTab === 'BASE' ? (
                      <Combobox options={categories.filter((c:any)=>c.name.includes('配件') || c.name.includes('辅料') || c.name.includes('胶') || c.name.includes('系统')).map((c:any)=>({value:c.id.toString(), label:c.name}))} value={form.category_id} onValueChange={(v:any)=>setForm({...form, category_id: v})} placeholder="选择分类" />
                    ) : (
                      <input type="text" className="stitch-input w-full h-11 text-blue-600 font-black text-center text-xl bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg" value={form.rate} onChange={e=>setForm({...form, rate: e.target.value.replace(/\D/g, '')})} />
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => saveMutation.mutate(form)} className="w-full h-11 bg-blue-600 text-white rounded-lg font-black text-xs uppercase active:scale-95 shadow-md">确认保存配件方案</button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="max-w-[280px] border-none shadow-xl p-6 text-center rounded-xl bg-white dark:bg-[#0f172a]"><div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-4"><AlertTriangle size={24} /></div><DialogTitle className="text-sm font-black mb-6 text-slate-950 dark:text-white uppercase tracking-widest">彻底删除该配件？</DialogTitle><div className="flex gap-2"><button onClick={() => setItemToDelete(null)} className="flex-1 h-10 rounded-lg text-[11px] font-black border border-slate-100 dark:border-white/5 text-slate-500">取消</button><button onClick={() => deleteMutation.mutate(itemToDelete)} className="flex-1 h-10 rounded-lg text-[11px] font-black bg-rose-600 text-white shadow-md shadow-rose-200">确认</button></div></DialogContent>
      </Dialog>
    </div>
  );
};

const NavTab = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={cn(
    "px-4 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95",
    active ? "bg-slate-950 dark:bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-950 dark:hover:text-white"
  )}>
    {label}
  </button>
);
