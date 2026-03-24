import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Trash2, Edit3, ChevronLeft, ChevronRight, AlertTriangle, Search, X, Loader2, CheckCircle2, Layers,
  Settings2, Package, Tag, Percent, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SegmentedControl, Text, Group, Stack, Badge, Paper, ActionIcon, Tooltip, Box } from '@mantine/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Combobox } from '../../components/ui/Combobox';
import { cn } from '../../lib/utils';

// --- 全量 24 色工业色池 ---
const COLOR_POOL = [
  { name: 'sea', bg: '#0ea5e9', border: '#0369a1' }, { name: 'gold', bg: '#f59e0b', border: '#b45309' },
  { name: 'red', bg: '#ef4444', border: '#991b1b' }, { name: 'emerald', bg: '#10b981', border: '#065f46' },
  { name: 'purple', bg: '#8b5cf6', border: '#5b21b6' }, { name: 'orange', bg: '#f97316', border: '#c2410c' },
  { name: 'cyan', bg: '#06b6d4', border: '#0891b2' }, { name: 'pink', bg: '#ec4899', border: '#be185d' },
  { name: 'indigo', bg: '#6366f1', border: '#4338ca' }, { name: 'teal', bg: '#14b8a6', border: '#0f766e' },
  { name: 'lime', bg: '#84cc16', border: '#4d7c0f' }, { name: 'slate', bg: '#475569', border: '#1e293b' },
  { name: 'rose', bg: '#fb7185', border: '#e11d48' }, { name: 'amber', bg: '#fbbf24', border: '#d97706' },
  { name: 'violet', bg: '#a78bfa', border: '#7c3aed' }, { name: 'blue', bg: '#3b82f6', border: '#2563eb' },
  { name: 'green', bg: '#22c55e', border: '#16a34a' }, { name: 'yellow', bg: '#eab308', border: '#ca8a04' },
  { name: 'fuchsia', bg: '#d946ef', border: '#a21caf' }, { name: 'sky', bg: '#0ea5e9', border: '#0284c7' },
  { name: 'neutral', bg: '#737373', border: '#404040' }, { name: 'brown', bg: '#a16207', border: '#78350f' },
  { name: 'deepblue', bg: '#1e3a8a', border: '#1e40af' }, { name: 'zinc', bg: '#18181b', border: '#09090b' },
];

const getDynamicCatStyle = (catName: string = '', index: number = 0) => {
  let color = COLOR_POOL[index % COLOR_POOL.length];
  const n = catName.toLowerCase();
  if (n.includes('玻璃')) color = COLOR_POOL[0];
  else if (n.includes('间隔') || n.includes('铝') || n.includes('条')) color = COLOR_POOL[1];
  else if (n.includes('工艺')) color = COLOR_POOL[2];
  return {
    backgroundColor: `${color.bg}E6`,
    border: `1.5px solid ${color.border}`,
    color: '#ffffff',
    textShadow: '0 1px 1px rgba(0,0,0,0.2)'
  };
};

export const BaseLibrary = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('MATRIX');
  const [page, setPage] = useState(1);
  const pageSize = 16;
  const [searchTerm, setSearchTerm] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => (window.db?.getCategories?.() || []) });
  const { data: baseLibrary = [] } = useQuery({ queryKey: ['baseLibrary'], queryFn: () => (window.db?.getBaseLibrary?.() || []) });
  const { data: matrixData = [] } = useQuery({ queryKey: ['matrixData'], queryFn: () => (window.db?.getMatrixData?.() || []) });
  const { data: fees = [] } = useQuery({ queryKey: ['fees'], queryFn: () => (window.db?.getFeeDefinitions?.() || []) });

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [guardCat, setGuardCat] = useState(true); 
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [poolCatId, setPoolCatId] = useState<any>(''); 

  const [form, setForm] = useState<any>({ 
    id: null, comps: [], name: '', guide: '', agency: '', 
    color: '#0ea5e9', batch: false, rate: '', category_id: '',
    price_type: 'AREA', unit_name: '平米'
  });

  const tabLabels = useMemo(() => {
    switch(activeTab) {
      case 'MATRIX': return { btn: '添加组合产品', title: '组合产品价格库', item: '产品', icon: <Package size={14}/> };
      case 'BASE': return { btn: '添加材料项', title: '基础材料单价库', item: '材料', icon: <Layers size={14}/> };
      case 'CAT': return { btn: '设置材料分类', title: '材料分类管理', item: '分类', icon: <Tag size={14}/> };
      case 'FEE': return { btn: '设置额外费用', title: '加价比例/杂费设置', item: '费率', icon: <Percent size={14}/> };
      default: return { btn: '新建', title: '管理', item: '项', icon: <Plus size={14}/> };
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'MATRIX' && form.comps?.length > 0 && builderMode === 'ADD' && !form.name) {
      const autoName = form.comps.map((c:any) => c.name).join(' + ');
      setForm((p:any) => ({ ...p, name: autoName }));
    }
  }, [form.comps, activeTab, builderMode]);

  useEffect(() => {
    if (categories.length > 0 && !poolCatId) setPoolCatId(categories[0].id.toString());
  }, [categories]);

  const handleOpenAdd = () => {
    setBuilderMode('ADD');
    setForm({ 
      id: null, comps: [], name: '', guide: '', agency: '', 
      color: '#0ea5e9', batch: false, rate: '', category_id: poolCatId,
      price_type: 'AREA', unit_name: '平米'
    });
    setIsBuilderOpen(true);
  };

  const handleOpenEdit = async (i: any) => {
    setBuilderMode('EDIT');
    let currentComps = [];
    if (activeTab === 'MATRIX' && window.db?.getAssetComponents) {
      currentComps = await window.db.getAssetComponents(i.comboId || i.id);
    }
    setForm({
      id: i.comboId || i.id,
      name: i.displayName || i.name || '',
      guide: (i.guidePrice ?? i.guide_price) ?? '',
      agency: (i.agencyPrice ?? i.agency_price) ?? '',
      color: i.color || '#0ea5e9',
      comps: currentComps || [],
      rate: i.default_rate ?? '',
      category_id: i.category_id || '',
      price_type: i.price_type || 'AREA',
      unit_name: i.unit_name || '平米',
      catId: '', itemId: ''
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
        if (activeTab === 'MATRIX') return window.db.addPricedAsset({ name: d.name, color: d.color, componentIds: d.comps.map((c:any)=>c.id) });
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
        if (activeTab === 'MATRIX') {
          await window.db.updatePrice({ comboId: d.id, field: 'color', value: d.color });
          await window.db.updatePrice({ comboId: d.id, field: 'displayName', value: d.name });
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
      }
    },
    onSuccess: () => { queryClient.invalidateQueries(); if (!form.batch || builderMode === 'EDIT') setIsBuilderOpen(false); setForm((p:any)=>({...p, comps: [], name: '', guide: '', agency: '', rate: '', unit_name: '平米'})); }
  });

  const deleteMutation = useMutation({
    mutationFn: (item: any) => {
      const id = item.comboId || item.id;
      if (activeTab === 'MATRIX') return window.db.deletePricedAsset(id);
      if (activeTab === 'BASE') return window.db.deleteBaseItem(id);
      if (activeTab === 'FEE') return window.db.deleteFee(id);
      return window.db.deleteCategory(id);
    },
    onSuccess: () => { queryClient.invalidateQueries(); setItemToDelete(null); }
  });

  const filteredData = useMemo(() => {
    const raw = activeTab === 'MATRIX' ? matrixData : activeTab === 'BASE' ? baseLibrary : activeTab === 'CAT' ? categories : fees;
    
    // 过滤逻辑
    let finalRaw = raw;
    if (activeTab === 'BASE') {
      finalRaw = raw.filter((i:any) => !i.categoryName.includes('配件') && !i.categoryName.includes('辅料') && !i.categoryName.includes('胶') && !i.categoryName.includes('系统'));
    } else if (activeTab === 'CAT') {
      finalRaw = raw.filter((i:any) => !i.name.includes('配件') && !i.name.includes('辅料') && !i.name.includes('胶') && !i.name.includes('系统'));
    }

    const term = searchTerm.toLowerCase();
    return finalRaw.filter((i:any) => (i?.displayName || i?.name || '').toLowerCase().includes(term) || (i?.componentsDesc || '').toLowerCase().includes(term));
  }, [activeTab, matrixData, baseLibrary, categories, fees, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  if (!window.db) return <Box h="100vh" w="100%" display="flex" style={{alignItems:'center', justifyContent:'center'}}><Loader2 className="animate-spin mr-2"/> 加载引擎核心...</Box>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-transparent min-h-screen">
      {/* 头部切换区域 - 升级为 SegmentedControl */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#0f172a] p-4 border border-slate-100 rounded-2xl shadow-sm">
        <SegmentedControl
          value={activeTab}
          onChange={(val) => {setActiveTab(val); setPage(1); setSearchTerm('');}}
          data={[
            { label: (
              <Group gap="xs" px="xs">
                <Package size={14} />
                <Text size="xs" fw={900}>资产库</Text>
              </Group>
            ), value: 'MATRIX' },
            { label: (
              <Group gap="xs" px="xs">
                <Layers size={14} />
                <Text size="xs" fw={900}>主材项</Text>
              </Group>
            ), value: 'BASE' },
            { label: (
              <Group gap="xs" px="xs">
                <Tag size={14} />
                <Text size="xs" fw={900}>分类管理</Text>
              </Group>
            ), value: 'CAT' },
            { label: (
              <Group gap="xs" px="xs">
                <Percent size={14} />
                <Text size="xs" fw={900}>费率设置</Text>
              </Group>
            ), value: 'FEE' },
          ]}
          transitionDuration={300}
          transitionTimingFunction="linear"
          radius="xl"
          size="sm"
          className="bg-slate-50 dark:bg-white/5 border border-slate-100"
          styles={{
            root: { backgroundColor: 'transparent' },
            indicator: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: 'var(--mantine-color-blue-6)' },
            control: { border: 'none !important' },
            label: { color: activeTab === 'MATRIX' ? 'white' : undefined }
          }}
        />
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              className="w-full pl-10 h-10 text-[13px] font-black text-slate-950 bg-slate-50 border-none rounded-xl focus:ring-2 ring-blue-500 transition-all" 
              placeholder={`搜索${tabLabels.item}...`} 
              value={searchTerm} 
              onChange={e=>setSearchTerm(e.target.value)} 
            />
          </div>
          <button 
            onClick={handleOpenAdd} 
            className="h-10 px-6 bg-blue-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-blue-200"
          >
            <Plus size={14} strokeWidth={3}/>
            {tabLabels.btn}
          </button>
        </div>
      </div>

      {/* 列表显示区域 - 增加 AnimatePresence 丝滑切换 */}
      <div className="flex-1 min-h-[600px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + page}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
          >
            {filteredData.slice((page-1)*pageSize, page*pageSize).map((item: any, idx: number) => (
              <Paper 
                key={idx} 
                p="lg" 
                radius="xl" 
                withBorder 
                className="group relative hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex justify-between items-start">
                  <Stack gap={4}>
                    <Text fw={900} size="sm" className="text-slate-950 tracking-tight">
                      {item?.displayName || item?.name}
                    </Text>
                    <Badge variant="light" size="xs" radius="sm" color="blue" styles={{ label: { fontWeight: 900 } }}>
                      {activeTab === 'MATRIX' ? `${item?.componentsCount || 0} 组件` : item?.categoryName || '基础数据'}
                    </Badge>
                  </Stack>
                  <Group gap={6} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip label="编辑">
                      <ActionIcon variant="light" color="blue" radius="md" onClick={() => handleOpenEdit(item)}>
                        <Edit3 size={14}/>
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除">
                      <ActionIcon variant="light" color="red" radius="md" onClick={() => {
                        const id = item.comboId || item.id; 
                        if(activeTab === 'MATRIX') window.db.deletePricedAsset(id).then(()=>queryClient.invalidateQueries()); 
                        else setItemToDelete(item);
                      }}>
                        <Trash2 size={14}/>
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </div>

                <Divider my="md" variant="dashed" />

                <Stack gap={8}>
                  {activeTab === 'MATRIX' ? (
                    <>
                      <Group justify="space-between">
                        <Text size="xs" fw={900} c="dimmed">零售总额</Text>
                        <Text size="sm" fw={900} c="blue">¥{item?.totalGuidePrice?.toFixed(2)}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="xs" fw={900} c="dimmed">代理总额</Text>
                        <Text size="sm" fw={900} c="teal">¥{item?.totalAgencyPrice?.toFixed(2)}</Text>
                      </Group>
                    </>
                  ) : activeTab === 'BASE' ? (
                    <>
                      <Group justify="space-between">
                        <Text size="xs" fw={900} c="dimmed">零售单价</Text>
                        <Text size="sm" fw={900} c="blue">¥{item?.guide_price?.toFixed(2)}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="xs" fw={900} c="dimmed">代理单价</Text>
                        <Text size="sm" fw={900} c="teal">¥{item?.agency_price?.toFixed(2)}</Text>
                      </Group>
                    </>
                  ) : activeTab === 'FEE' ? (
                    <Group justify="space-between">
                      <Text size="xs" fw={900} c="dimmed">费率系数</Text>
                      <Text size="lg" fw={900} c="blue">{(item?.default_rate * 100).toFixed(1)}%</Text>
                    </Group>
                  ) : (
                    <Box h={20} />
                  )}
                </Stack>
              </Paper>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 弹窗部分保持功能逻辑，优化视觉细节 */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className={cn("p-0 border-none shadow-2xl rounded-2xl bg-white dark:bg-[#020617] overflow-hidden", activeTab === 'MATRIX' ? "w-[95vw] md:w-[960px]" : "w-[95vw] md:w-[520px]")}>
          {activeTab === 'MATRIX' ? (
            <div className="flex flex-col md:flex-row h-[580px]">
              {/* 左侧分类池 */}
              <div className="w-52 border-r border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 flex flex-col shrink-0">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase text-slate-950 dark:text-white tracking-widest">1. 选择类目</h3>
                  <ActionIcon variant="subtle" size="xs" color="blue" onClick={() => {setActiveTab('CAT'); setIsBuilderOpen(false);}}>
                    <Settings2 size={12} />
                  </ActionIcon>
                </div>
                <div className="flex-1 overflow-y-auto py-2 no-scrollbar">
                  {categories.map((c: any) => (
                    <button 
                      key={c.id} 
                      onClick={() => setPoolCatId(c.id.toString())} 
                      className={cn(
                        "w-full px-5 py-3 text-left text-[11px] font-black transition-all flex items-center justify-between group",
                        poolCatId === c.id.toString() ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white border-r-4 border-blue-600" : "text-slate-500 hover:text-slate-950"
                      )}
                    >
                      {c.name}
                      <ArrowRight size={12} className={cn("opacity-0 transition-opacity", poolCatId === c.id.toString() ? "opacity-100" : "group-hover:opacity-50")} />
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 中间备选区域 */}
              <div className="flex-1 flex flex-col bg-white dark:bg-[#0f172a] overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase text-slate-950 dark:text-white tracking-widest">2. 备选主材</h3>
                  <Group gap={8}>
                    <button onClick={()=>setGuardCat(!guardCat)} className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-200 active:scale-95 transition-all">
                      <span className="text-[9px] font-black text-slate-600 uppercase">同类替换锁</span>
                      {guardCat ? <CheckCircle2 size={12} className="text-emerald-500"/> : <X size={12} className="text-slate-300"/>}
                    </button>
                  </Group>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-wrap gap-2.5 content-start bg-slate-50/10 dark:bg-black/10 no-scrollbar">
                  {baseLibrary.filter((i:any)=>i.category_id === Number(poolCatId)).map((i:any) => (
                    <button 
                      key={i.id} 
                      onClick={() => setForm((p:any)=>{
                        let newC=[...(p.comps||[])]; 
                        if(guardCat){
                          const idx=newC.findIndex(c=>c.category_id===i.category_id); 
                          if(idx!==-1)newC[idx]=i; else newC.push(i);
                        }else newC.push(i); 
                        return {...p, comps:newC};
                      })} 
                      className="min-w-[100px] h-10 bg-white dark:bg-white/5 border border-slate-200 rounded-xl text-[10px] font-black text-slate-950 px-3 hover:border-blue-500 hover:shadow-md transition-all"
                    >
                      {i.name}
                    </button>
                  ))}
                </div>
                {/* 底部预览 */}
                <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#0f172a]">
                  <Text size="xs" fw={900} ta="center" c="dimmed" tt="uppercase" mb="sm" style={{letterSpacing:1}}>3. 资产物理构成预览</Text>
                  <div className="min-h-[100px] p-4 border-2 border-dashed border-slate-100 rounded-2xl flex flex-wrap gap-2 items-start justify-center">
                    <AnimatePresence>
                      {(form.comps || []).map((c: any, i: number) => { 
                        const style = getDynamicCatStyle(c.categoryName, i); 
                        return (
                          <motion.div 
                            key={i} 
                            initial={{ scale: 0.8, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="h-9 flex items-center justify-center rounded-xl text-[10px] font-black uppercase px-4 relative shadow-lg" 
                            style={style}
                          >
                            {c.name}
                            <button onClick={()=>setForm({...form, comps:form.comps.filter((_:any,idx:number)=>idx!==i)})} className="absolute -top-2 -right-2 bg-slate-950 text-white rounded-full p-1 shadow-md">
                              <X size={10}/>
                            </button>
                          </motion.div>
                        ); 
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* 右侧属性设置 */}
              <div className="w-[340px] border-l border-slate-100 p-8 flex flex-col justify-between bg-slate-50/50">
                <Stack gap="xl">
                  <div className="text-center">
                    <Badge variant="dot" size="lg" color="blue" mb="xs">
                      {builderMode === 'ADD' ? '新建精算资产' : '更新资产定义'}
                    </Badge>
                    <Title order={5} fw={900} tt="uppercase" lts={1}>资产方案配置</Title>
                  </div>
                  
                  <Stack gap="sm">
                    <Text size="xs" fw={900} tt="uppercase" ml={4}>资产方案全称</Text>
                    <input 
                      className="w-full h-12 text-center font-black text-slate-950 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 ring-blue-500 transition-all" 
                      value={form.name} 
                      onChange={e=>setForm({...form, name: e.target.value})} 
                      placeholder="例如: 5+12A+5 双玻组合"
                    />
                  </Stack>

                  <Paper p="lg" radius="xl" withBorder bg="blue.0" className="border-blue-100">
                    <Text size="xs" fw={900} c="blue" tt="uppercase" mb="xs" lts={1}>理论汇总估价</Text>
                    <Stack gap={4}>
                      <Group justify="space-between">
                        <Text size="xs" fw={900} c="slate.5">零售总价:</Text>
                        <Text size="xl" fw={900} c="slate.9">¥{(form.comps || []).reduce((s:number,c:any)=>s+(c.guide_price||0), 0).toFixed(2)}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="xs" fw={900} c="slate.5">代理总价:</Text>
                        <Text size="sm" fw={900} c="slate.7">¥{(form.comps || []).reduce((s:number,c:any)=>s+(c.agency_price||0), 0).toFixed(2)}</Text>
                      </Group>
                    </Stack>
                  </Paper>
                </Stack>

                <Stack gap="md">
                  <Box>
                    <Text size="xs" fw={900} c="dimmed" tt="uppercase" mb="xs" ml={4}>资产预设识别色</Text>
                    <div className="grid grid-cols-8 gap-2">
                      {COLOR_POOL.map((c: any) => (
                        <button 
                          key={c.name} 
                          onClick={()=>setForm({...form, color: c.bg})} 
                          style={{ backgroundColor: c.bg }} 
                          className={cn("h-6 rounded-md border-2 transition-all", form.color === c.bg ? "border-slate-950 scale-125 shadow-md" : "border-transparent opacity-60 hover:opacity-100")} 
                        />
                      ))}
                    </div>
                  </Box>
                  <Button 
                    fullWidth 
                    size="lg" 
                    radius="xl" 
                    color="blue" 
                    onClick={() => saveMutation.mutate(form)}
                    styles={{ inner: { fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 } }}
                    className="shadow-lg shadow-blue-200"
                  >
                    确认同步至价格库
                  </Button>
                </Stack>
              </div>
            </div>
          ) : (
            <div className="p-10 space-y-8 bg-white dark:bg-[#020617]">
              <Stack align="center" gap={4}>
                <Badge size="lg" variant="dot" color="blue">{tabLabels.item}定义</Badge>
                <Title order={4} fw={900} tt="uppercase" lts={1}>{builderMode === 'EDIT' ? '修改现有数据' : '录入新数据'}</Title>
              </Stack>

              <Stack gap="xl">
                <Stack gap={6}>
                  <Text size="xs" fw={900} tt="uppercase" ml={4}>{tabLabels.item}显示名称</Text>
                  <input 
                    className="w-full h-12 text-center font-black text-slate-950 bg-slate-50 border-none rounded-xl focus:ring-2 ring-blue-500 transition-all" 
                    value={form.name} 
                    onChange={e=>setForm({...form, name: e.target.value})} 
                  />
                </Stack>

                {activeTab === 'BASE' && (
                  <Stack gap="xl">
                    <Stack gap={6}>
                      <Text size="xs" fw={900} tt="uppercase" ml={4}>计价逻辑与单位</Text>
                      <Group grow gap="xs">
                        <SegmentedControl
                          value={form.price_type}
                          onChange={(v)=>setForm({...form, price_type: v})}
                          data={[
                            { label: '按面积', value: 'AREA' },
                            { label: '按延米', value: 'LINEAR' },
                            { label: '按件/瓶', value: 'FIXED' },
                          ]}
                          radius="lg"
                        />
                        <input 
                          placeholder="单位(如:平米)" 
                          className="h-10 px-4 font-black text-xs bg-slate-50 border-none rounded-lg" 
                          value={form.unit_name} 
                          onChange={e=>setForm({...form, unit_name: e.target.value})} 
                        />
                      </Group>
                    </Stack>

                    <SimpleGrid cols={2} gap="md">
                      <Stack gap={6}>
                        <Text size="xs" fw={900} tt="uppercase" ml={4}>零售标价 (¥)</Text>
                        <input className="w-full h-12 px-4 text-blue-600 text-xl font-black bg-slate-50 border-none rounded-xl" value={form.guide} onChange={e=>setForm({...form, guide: e.target.value})} />
                      </Stack>
                      <Stack gap={6}>
                        <Text size="xs" fw={900} tt="uppercase" ml={4}>代理成本 (¥)</Text>
                        <input className="w-full h-12 px-4 text-slate-900 text-xl font-black bg-slate-50 border-none rounded-xl" value={form.agency} onChange={e=>setForm({...form, agency: e.target.value})} />
                      </Stack>
                    </SimpleGrid>
                  </Stack>
                )}

                {(activeTab === 'BASE' || activeTab === 'FEE') && (
                  <Stack gap={6}>
                    <Text size="xs" fw={900} tt="uppercase" ml={4}>
                      {activeTab === 'BASE' ? '所属分类' : '费率系数 (0.01 - 0.99)'}
                    </Text>
                    {activeTab === 'BASE' ? (
                      <Group gap="xs">
                        <Box flex={1}>
                          <Combobox options={categories.map((c:any)=>({value:c.id.toString(), label:c.name}))} value={form.category_id} onValueChange={(v:any)=>setForm({...form, category_id: v})} placeholder="选择分类" />
                        </Box>
                        <ActionIcon size="lg" variant="light" radius="md" onClick={() => {setActiveTab('CAT'); setIsBuilderOpen(false);}}>
                          <Plus size={18} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <input className="w-full h-12 text-blue-600 font-black text-center text-2xl bg-slate-50 border-none rounded-xl" value={form.rate} onChange={e=>setForm({...form, rate: e.target.value})} />
                    )}
                  </Stack>
                )}
              </Stack>

              <Button 
                fullWidth 
                size="lg" 
                radius="xl" 
                color="blue" 
                onClick={() => saveMutation.mutate(form)}
                className="shadow-lg"
              >
                确认并同步数据
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认与分页保持逻辑，优化样式 */}
      <div className="flex justify-between items-center px-6 py-4 bg-white dark:bg-[#0f172a] border border-slate-100 rounded-2xl shadow-sm">
        <Text size="xs" fw={900} tt="uppercase" c="dimmed" lts={1}>有效数据条目: {filteredData.length}</Text>
        <Group gap={4}>
          <ActionIcon variant="light" color="slate" radius="xl" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </ActionIcon>
          <Group gap={4}>
            {[...Array(totalPages)].map((_, i) => (totalPages <= 5 || Math.abs(i+1-page) <= 1) && (
              <Button key={i} size="xs" radius="xl" variant={page === i+1 ? "filled" : "light"} color={page === i+1 ? "blue" : "slate"} onClick={() => setPage(i+1)}>
                {i+1}
              </Button>
            ))}
          </Group>
          <ActionIcon variant="light" color="slate" radius="xl" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </ActionIcon>
        </Group>
      </div>

      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="max-w-[320px] border-none shadow-2xl p-8 text-center rounded-2xl bg-white dark:bg-[#0f172a]">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <Title order={5} fw={900} mb="xs">确认删除该项？</Title>
          <Text size="xs" c="dimmed" mb="xl">此操作将永久移除该数据，且不可恢复。</Text>
          <Group grow gap="md">
            <Button variant="light" color="slate" radius="md" onClick={() => setItemToDelete(null)}>取消</Button>
            <Button color="red" radius="md" onClick={() => deleteMutation.mutate(itemToDelete)}>确认删除</Button>
          </Group>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// 辅助组件 SimpleGrid (补齐 Mantine 导入)
import { Divider, SimpleGrid } from '@mantine/core';
