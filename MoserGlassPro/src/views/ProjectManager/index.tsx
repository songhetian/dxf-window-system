import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Trash2, ListOrdered, 
  ToggleRight, ToggleLeft, Calculator, Ruler, Info, FileSpreadsheet, RotateCcw, LayoutPanelTop, 
  Settings2, SlidersHorizontal, Copy, Check, Boxes
} from 'lucide-react';
import { useCalculationStore, CalculationStore, ItemFee } from '../../store/calculationStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Combobox } from '../../components/ui/Combobox';
import { cn } from '../../lib/utils';
import * as XLSX from 'xlsx';

const COMPONENT_COLORS = [
  { bg: '#0ea5e9', border: '#0369a1' }, { bg: '#f59e0b', border: '#b45309' },
  { bg: '#ef4444', border: '#991b1b' }, { bg: '#10b981', border: '#065f46' },
  { bg: '#8b5cf6', border: '#5b21b6' }, { bg: '#f97316', border: '#c2410c' },
  { bg: '#06b6d4', border: '#0891b2' }, { bg: '#ec4899', border: '#be185d' },
  { bg: '#6366f1', border: '#4338ca' }, { bg: '#14b8a6', border: '#0f766e' },
  { bg: '#84cc16', border: '#4d7c0f' }, { bg: '#475569', border: '#1e293b' },
];

export const ProjectManager = () => {
  const { 
    projectItems, selectedAsset, setSelectedAsset, addToProject, removeFromProject, 
    updateItemPriceMode, updateItemFees, updateItemDimensions, updateItemQuantity, clearProject, calculateProjectTotal 
  } = useCalculationStore((state: CalculationStore) => state);

  const [search, setSearch] = useState('');
  const [config, setConfig] = useState({ 
    width: 2400, 
    height: 1800, 
    quantity: 1, 
    priceMode: 'guide' as 'guide' | 'agency' 
  });
  
  // 新增配件选择状态
  const [selectedAccessories, setSelectedAccessories] = useState<{
    hardwareId?: string,
    sealantId?: string,
    extraId?: string
  }>({});

  const [editingItem, setEditingItem] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const { data: rawFees = [] } = useQuery({ queryKey: ['fees'], queryFn: () => (window.db?.getFeeDefinitions?.() || []) });
  const { data: matrixData = [] } = useQuery({ queryKey: ['matrixData'], queryFn: () => (window.db?.getMatrixData?.() || []) });
  // 获取所有基础材料作为配件候选
  const { data: allBaseItems = [] } = useQuery({ queryKey: ['baseLibrary'], queryFn: () => (window.db?.getBaseLibrary?.() || []) });

  // 过滤出配件类数据
  const accessoryOptions = useMemo(() => {
    const filter = (keyword: string) => allBaseItems.filter((i:any) => i.categoryName.includes(keyword))
      .map((i:any) => ({ value: i.id.toString(), label: i.name, item: i }));
    
    return {
      hardware: filter('五金'),
      sealant: filter('胶条') || filter('密封'),
      extra: filter('胶') || filter('辅材')
    };
  }, [allBaseItems]);

  const [fees, setFees] = useState<ItemFee[]>([]);
  useEffect(() => {
    if (rawFees.length > 0 && fees.length === 0) {
      setFees(rawFees.map((f:any) => ({ id: f.id, name: f.name, rate: f.default_rate, isActive: !!f.is_active })));
    }
  }, [rawFees]);

  const totals = calculateProjectTotal(matrixData);

  const [selectedComps, setSelectedComps] = useState<any[]>([]);
  useEffect(() => {
    if (selectedAsset?.comboId) { window.db.getAssetComponents(selectedAsset.comboId).then(setSelectedComps); }
    else { setSelectedComps([]); }
  }, [selectedAsset]);

  // 计算当前配置下的预览价格 (包含主材 + 动态配件)
  const previewPrice = useMemo(() => {
    if (!selectedAsset || selectedComps.length === 0) return { guide: 0, agency: 0, perSquare: 0, glassOnly: 0, accOnly: 0 };
    
    const w_m = config.width / 1000;
    const h_m = config.height / 1000;
    const area = w_m * h_m;
    const perimeter = (w_m + h_m) * 2;
    
    let gGlass = 0; // 玻璃部分
    let aGlass = 0;
    selectedComps.forEach(c => {
      gGlass += (c.guide_price || 0) * area;
      aGlass += (c.agency_price || 0) * area;
    });

    let gAcc = 0; // 配件部分
    let aAcc = 0;

    // 累加选中的配件
    const selectedItems = [
      accessoryOptions.hardware.find(o => o.value === selectedAccessories.hardwareId)?.item,
      accessoryOptions.sealant.find(o => o.value === selectedAccessories.sealantId)?.item,
      accessoryOptions.extra.find(o => o.value === selectedAccessories.extraId)?.item,
    ].filter(Boolean);

    selectedItems.forEach(i => {
      if (i.price_type === 'LINEAR') {
        gAcc += (i.guide_price || 0) * perimeter;
        aAcc += (i.agency_price || 0) * perimeter;
      } else if (i.price_type === 'FIXED') {
        gAcc += (i.guide_price || 0) * config.quantity;
        aAcc += (i.agency_price || 0) * config.quantity;
      } else {
        gAcc += (i.guide_price || 0) * area;
        aAcc += (i.agency_price || 0) * area;
      }
    });

    const gTotal = gGlass + gAcc;
    const aTotal = aGlass + aAcc;

    return { 
      guide: gTotal, 
      agency: aTotal, 
      perSquare: gTotal / (area || 1),
      glassOnly: gGlass,
      accOnly: gAcc
    };
  }, [selectedAsset, selectedComps, config.width, config.height, config.quantity, selectedAccessories, accessoryOptions]);

  const handleCopyPrices = () => {
    if (!selectedAsset) return;
    navigator.clipboard.writeText(`零售标价: ¥${previewPrice.guide.toFixed(2)} | 内部价格: ¥${previewPrice.agency.toFixed(2)} | 平摊单价: ¥${previewPrice.perSquare.toFixed(2)}/㎡`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportXLSX = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["项目统计总面积", totals.totalArea, "平方米"],
      ["项目精算总额", totals.finalTotal, "元"],
      [],
      ["序号", "型号名称", "规格尺寸", "数量", "计价模式", "计算单价", "行金额"],
      ...totals.items.map((it:any, i:number) => [i+1, it.displayName, `${it.width}x${it.height}`, it.quantity, it.priceMode === 'guide' ? '零售' : '代理', it.unitPrice.toFixed(2), it.lineAmount.toFixed(2)])
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "精算清单");
    XLSX.writeFile(wb, `项目报告_${Date.now()}.xlsx`);
  };

  const updateWidth = (v: string) => {
    const num = Number(v.replace(/\D/g, ''));
    setConfig({ ...config, width: num > 9999 ? 9999 : num });
  };

  const updateHeight = (v: string) => {
    const num = Number(v.replace(/\D/g, ''));
    setConfig({ ...config, height: num > 9999 ? 9999 : num });
  };

  return (
    <div className="flex h-full bg-[#f8f9fb] dark:bg-[#020617] overflow-hidden transition-none border-none">
      <aside className="w-72 h-full bg-white dark:bg-[#0f172a] flex flex-col shrink-0 shadow-sm border-r border-slate-100">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2"><div className="w-1 h-3.5 bg-blue-600 rounded-full" /><h2 className="text-[12px] font-black text-slate-950 dark:text-white uppercase tracking-widest">资产方案方案库</h2></div>
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} /><input className="stitch-input w-full pl-8 h-8 text-xs font-black text-slate-950 bg-slate-50 border-none rounded-xl" placeholder="搜索型号..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1.5">
          {matrixData.filter((m:any)=>m.displayName.includes(search)).map((m: any) => (
            <button key={m.comboId} onClick={() => setSelectedAsset(m)} 
              className={cn("w-full p-3 text-left flex flex-col gap-0.5 rounded-xl border-none transition-all shadow-sm", 
                selectedAsset?.comboId === m.comboId ? "bg-blue-600 text-white shadow-lg scale-[0.98]" : "bg-transparent hover:bg-slate-50")}
              style={selectedAsset?.comboId === m.comboId ? {} : { backgroundColor: `${m.color || '#ffffff'}15` }}>
              <span className="text-[11px] font-black truncate">{m.displayName}</span>
              <div className="flex flex-col gap-0.5 mt-1 opacity-90">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[9px] font-black uppercase", selectedAsset?.comboId === m.comboId ? "text-blue-100" : "text-blue-600")}>参考零售:</span>
                  <span className="text-[11px] font-black">¥{m.totalGuidePrice.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[9px] font-black uppercase", selectedAsset?.comboId === m.comboId ? "text-emerald-100" : "text-emerald-600")}>参考代理:</span>
                  <span className="text-[11px] font-black">¥{m.totalAgencyPrice.toFixed(0)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* 仿真预览：精致吊牌与黑字正方形 */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2"><Boxes size={16} className="text-blue-600"/><h3 className="text-[11px] font-black text-slate-950 dark:text-white uppercase tracking-widest">物理构成仿真</h3></div>
                <div className="flex items-center gap-2">
                  {selectedAsset && (
                    <div className="flex bg-white rounded-xl p-0.5 shadow-sm border border-slate-100">
                      <div className="px-3 py-1 bg-blue-50 rounded-lg text-center border border-blue-100">
                        <span className="text-[9px] font-black text-blue-600 uppercase block leading-none mb-0.5">玻璃主材</span>
                        <span className="text-sm font-black text-slate-950">¥{previewPrice.glassOnly.toFixed(0)}</span>
                      </div>
                      <div className="px-3 py-1 bg-amber-50 rounded-lg text-center border border-amber-100 ml-0.5">
                        <span className="text-[9px] font-black text-amber-600 uppercase block leading-none mb-0.5">配件/辅材</span>
                        <span className="text-sm font-black text-slate-950">¥{previewPrice.accOnly.toFixed(0)}</span>
                      </div>
                      <div className="px-3 py-1 bg-emerald-50 rounded-lg text-center border border-emerald-100 ml-0.5">
                        <span className="text-[9px] font-black text-emerald-600 uppercase block leading-none mb-0.5">当前总标价</span>
                        <span className="text-xl font-black text-slate-950">¥{previewPrice.guide.toFixed(0)}</span>
                      </div>
                      <div className="px-3 py-1 bg-slate-50 rounded-lg text-center border border-slate-100 ml-0.5">
                        <span className="text-[9px] font-black text-slate-500 uppercase block leading-none mb-0.5">平摊单价/㎡</span>
                        <span className="text-sm font-black text-slate-950">¥{previewPrice.perSquare.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <button onClick={handleCopyPrices} disabled={!selectedAsset} className="p-2 bg-white hover:bg-blue-50 text-slate-950 rounded-lg shadow-sm transition-all active:scale-90 border border-slate-100">{copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}</button>
                </div>
              </div>
              <div className="h-64 bg-white dark:bg-[#0f172a] rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden shadow-sm border border-slate-100">
                <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-30" />
                <AnimatePresence mode="wait"><motion.div key={selectedAsset?.comboId || 'none'} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-row items-center gap-3 z-10 flex-wrap justify-center px-10">
                  {selectedComps.map((c: any, i: number) => {
                    const cStyle = COMPONENT_COLORS[i % 12];
                    return (
                      <div key={i} className="w-20 h-20 flex flex-col rounded-xl overflow-hidden shadow-lg border border-black/5" 
                        style={{ backgroundColor: `${cStyle.bg}99`, borderBottom: `4px solid ${cStyle.border}` }}>
                        <div className="flex-1 flex flex-col items-center justify-center p-2 relative text-center">
                          <span className="text-[11px] font-black text-slate-950 uppercase leading-tight">{c.name}</span>
                          <span className="text-[8px] font-bold text-slate-950/40 uppercase mt-1">
                            {c.price_type === 'LINEAR' ? '延米计价' : c.price_type === 'FIXED' ? `按${c.unit_name||'件'}计价` : '平方米计价'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </motion.div></AnimatePresence>
              </div>
            </div>

            {/* 配置面板 */}
            <div className="xl:col-span-5 flex flex-col">
              <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl space-y-5 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 border-b border-slate-50 pb-3"><Settings2 size={16} className="text-blue-600"/><h3 className="text-[11px] font-black text-slate-950 dark:text-white">明细规格录入</h3></div>
                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-950 uppercase">净宽 (毫米)</label><input type="text" value={config.width} onChange={e=>updateWidth(e.target.value)} className="stitch-input w-full h-8 text-[11px] font-black text-center border-none bg-slate-50 rounded-lg" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-950 uppercase">净高 (毫米)</label><input type="text" value={config.height} onChange={e=>updateHeight(e.target.value)} className="stitch-input w-full h-8 text-[11px] font-black text-center border-none bg-slate-50 rounded-lg" /></div>
                  </div>

                  {/* 新增配件选配区 */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 mb-1"><LayoutPanelTop size={14} className="text-blue-600"/><span className="text-[10px] font-black text-slate-950 uppercase tracking-widest">配件方案选配</span></div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">五金方案 (点选/套)</label>
                        <Combobox 
                          options={accessoryOptions.hardware} 
                          value={selectedAccessories.hardwareId || ''} 
                          onValueChange={(v)=>setSelectedAccessories({...selectedAccessories, hardwareId: v})} 
                          placeholder="选择五金" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">密封方案 (点选/延米)</label>
                        <Combobox 
                          options={accessoryOptions.sealant} 
                          value={selectedAccessories.sealantId || ''} 
                          onValueChange={(v)=>setSelectedAccessories({...selectedAccessories, sealantId: v})} 
                          placeholder="选择胶条/密封项" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">玻璃胶/辅材 (点选/瓶)</label>
                        <Combobox 
                          options={accessoryOptions.extra} 
                          value={selectedAccessories.extraId || ''} 
                          onValueChange={(v)=>setSelectedAccessories({...selectedAccessories, extraId: v})} 
                          placeholder="选择辅料" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1"><label className="text-[10px] font-black text-slate-950 text-center block uppercase">下单片数</label><input type="text" value={config.quantity} onChange={e=>setConfig({...config, quantity: Number(e.target.value.replace(/\D/g,'')) || 1})} className="stitch-input w-full h-9 text-center text-lg font-black text-blue-600 border-none bg-slate-50 rounded-lg" /></div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-black text-slate-950 text-center block uppercase">计价基准</label>
                      <div className="flex h-9 bg-slate-100 rounded-lg p-1 shadow-inner">
                        <button onClick={()=>setConfig({...config, priceMode:'guide'})} className={cn("flex-1 text-[9px] font-black rounded transition-all", config.priceMode==='guide'?"bg-white text-blue-600 shadow-sm":"text-slate-400")}>零售</button>
                        <button onClick={()=>setConfig({...config, priceMode:'agency'})} className={cn("flex-1 text-[9px] font-black rounded transition-all", config.priceMode==='agency'?"bg-white text-blue-600 shadow-sm":"text-slate-400")}>代理</button>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-50 space-y-2">
                    {fees.map((f, idx) => (
                      <div key={f.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl transition-all">
                        <button onClick={() => {const nf=[...fees]; nf[idx].isActive=!f.isActive; setFees(nf);}}>{f.isActive ? <ToggleRight className="text-blue-600" size={22}/> : <ToggleLeft className="text-slate-300" size={22}/>}</button>
                        <span className="text-[10px] font-black text-slate-950 flex-1 truncate">{f.name}</span>
                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100">
                          <input type="text" value={Math.round(f.rate * 100)} onChange={e=>{const nf=[...fees]; nf[idx].rate=Number(e.target.value.replace(/\D/g,''))/100; setFees(nf);}} className="w-7 text-[11px] font-black text-blue-600 outline-none text-right" /><span className="text-[9px] font-black text-slate-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button disabled={!selectedAsset} onClick={() => addToProject({...config, fees, components: selectedComps})} className="w-full h-9 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 mt-2">确认加入清单</button>
              </div>
            </div>
          </div>

          {/* 清单表格 */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center font-black uppercase text-[10px] tracking-widest text-slate-950">
              <div className="flex items-center gap-2"><ListOrdered size={16} className="text-blue-600"/> 项目精算明细清单</div>
              <button onClick={clearProject} className="text-[10px] font-black text-rose-500 flex items-center gap-1"><RotateCcw size={12}/> 清空全部</button>
            </div>
            <table className="w-full text-center table-fixed">
              <thead className="text-[10px] text-slate-950 uppercase border-b border-slate-50 font-black bg-white"><tr className="h-10"><th className="w-1/4 px-4 text-left">型号型号名称</th><th className="w-28">规格尺寸</th><th className="w-16">数量</th><th className="w-20">模式</th><th className="w-24">单价</th><th className="w-16">费率</th><th className="w-28 text-right px-6">行行总额</th><th className="w-12">操作</th></tr></thead>
              <tbody className="divide-y divide-slate-50 font-black text-slate-950">
                {totals.items.map((item: any) => (
                  <tr key={item.id} className="h-11 hover:bg-slate-50 transition-none group/row">
                    <td className="px-4 text-left"><div className="flex flex-col gap-0.5"><span className="text-[11px] font-black truncate">{item.displayName}</span><div className="flex flex-wrap gap-1">{item.fees.filter((f:any)=>f.isActive).map((f:any)=>(<span key={f.id} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black border border-blue-100">{f.name}</span>))}</div></div></td>
                    <td className="px-2"><div className="flex items-center justify-center gap-1"><input type="text" value={item.width} onChange={e=>updateItemDimensions(item.id, Number(e.target.value.replace(/\D/g,'')), item.height)} className="w-10 h-7 text-center text-[11px] bg-slate-50 rounded-lg border-none" /><span className="text-slate-300 font-mono text-[9px]">x</span><input type="text" value={item.height} onChange={e=>updateItemDimensions(item.id, item.width, Number(e.target.value.replace(/\D/g,'')))} className="w-10 h-7 text-center text-[11px] bg-slate-50 rounded-lg border-none" /></div></td>
                    <td className="px-2"><input type="text" value={item.quantity} onChange={e=>updateItemQuantity(item.id, Number(e.target.value.replace(/\D/g,'')) || 1)} className="w-12 h-7 text-center text-[12px] font-black text-blue-600 bg-slate-50 rounded-lg border-none" /></td>
                    <td className="px-2"><button onClick={()=>updateItemPriceMode(item.id, item.priceMode==='guide'?'agency':'guide')} className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black transition-all shadow-sm", item.priceMode==='guide'?"bg-blue-600 text-white":"bg-slate-950 text-white shadow-md")}>{item.priceMode==='guide'?'零售':'代理'}</button></td>
                    <td className="text-center text-[12px]">{item.unitPrice.toFixed(0)}</td>
                    <td className="text-center"><button onClick={()=>setEditingItem(item)} className="p-1.5 bg-slate-100 text-blue-600 rounded-lg shadow-inner"><SlidersHorizontal size={14}/></button></td>
                    <td className="px-6 text-right text-blue-600 text-[12px]">¥{item.lineAmount.toFixed(2)}</td>
                    <td className="text-center"><button onClick={() => removeFromProject(item.id)} className="p-1 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover/row:opacity-100"><Trash2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="h-14 bg-white border-t border-slate-100 flex items-center justify-between px-8 shrink-0 z-[100] shadow-xl font-black">
          <div className="flex gap-8 text-slate-950">
            <div className="flex items-baseline gap-1.5"><span className="text-[10px] uppercase text-slate-950 tracking-widest">项目总面积</span><p className="text-lg">{totals.totalArea}平方米</p></div>
            <div className="flex items-baseline gap-1.5"><span className="text-[10px] uppercase text-slate-950 tracking-widest">物料净总额</span><p className="text-lg">{totals.baseTotal}元</p></div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right flex items-baseline gap-2">
                <span className="text-[10px] font-black text-blue-600 tracking-widest">项目精算总计</span>
                <p className="text-xl font-black text-slate-950 tracking-tight">{totals.finalTotal}元</p>
             </div>
             <button onClick={handleExportXLSX} className="h-8 px-5 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-md shadow-blue-200"><FileSpreadsheet size={14}/> 导出报告</button>
          </div>
        </footer>
      </div>

      <Dialog open={!!editingItem} onOpenChange={(o)=>!o && setEditingItem(null)}>
        <DialogContent className="w-[320px] p-6 bg-white rounded-2xl shadow-2xl border-none">
          <DialogHeader className="mb-4 border-b border-slate-50 pb-3"><DialogTitle className="text-sm font-black text-slate-950 uppercase tracking-widest">单项费率调节</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editingItem?.fees.map((f: ItemFee, idx: number) => (
              <div key={f.id} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <button onClick={()=>{const nf=[...editingItem.fees]; nf[idx].isActive=!f.isActive; updateItemFees(editingItem.id, nf);}}>{f.isActive ? <ToggleRight className="text-blue-600" size={22}/> : <ToggleLeft className="text-slate-300" size={22}/>}</button>
                <span className="text-[11px] font-black text-slate-950 flex-1">{f.name}</span>
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100">
                  <input type="text" value={Math.round(f.rate * 100)} onChange={e=>{const nf=[...editingItem.fees]; nf[idx].rate=Number(e.target.value.replace(/^0+(?=\d)/,''))/100; updateItemFees(editingItem.id, nf);}} className="w-7 text-[11px] font-black text-blue-600 outline-none text-right" /><span className="text-[9px] font-black text-slate-400">%</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>setEditingItem(null)} className="w-full h-10 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase mt-6 shadow-md shadow-blue-100">完成应用</button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
