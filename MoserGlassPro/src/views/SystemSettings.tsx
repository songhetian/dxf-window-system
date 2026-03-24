import React, { useState } from 'react';
import { Database, Download, Upload, ShieldAlert, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { GlassModal } from '../components/ui/GlassModal';
import { GlassButton } from '../components/ui/GlassBase';
import { useCalculationStore, CalculationStore } from '../store/calculationStore';

export const SystemSettings = () => {
  const { theme, setTheme, resetStore } = useCalculationStore((state: CalculationStore) => state);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'RESET' | 'IMPORT_WARN' | 'EXPORT_CONFIRM' | 'SUCCESS';
    title: string;
    message: string;
    path?: string;
  }>({
    isOpen: false,
    type: 'RESET',
    title: '',
    message: ''
  });

  const handleExport = () => {
    setModalConfig({
      isOpen: true,
      type: 'EXPORT_CONFIRM',
      title: '导出数据库备份',
      message: '准备将当前数据库导出为备份文件。您可以选择存储位置，以便日后还原或迁移。'
    });
  };

  const executeExport = async () => {
    const res = await window.db.exportDatabase();
    if (res?.success) {
      setModalConfig({
        isOpen: true,
        type: 'SUCCESS',
        title: '备份成功',
        message: '您的数据库已安全导出。',
        path: res.path
      });
    } else {
      closeModal();
    }
  };

  const handleImport = async () => {
    setModalConfig({
      isOpen: true,
      type: 'IMPORT_WARN',
      title: '还原数据库备份',
      message: '警告：导入操作将覆盖当前所有数据。系统将执行深度清理并刷新环境，是否继续？'
    });
  };

  const executeImport = async () => {
    const res = await window.db.importDatabase();
    if (res?.success) {
      resetStore();
      setModalConfig({
        isOpen: true,
        type: 'SUCCESS',
        title: '还原成功',
        message: '数据已成功同步。'
      });
    }
  };

  const handleReset = () => {
    setModalConfig({
      isOpen: true,
      type: 'RESET',
      title: '清空所有数据',
      message: '警告：此操作将永久抹除所有已配置的产品、材料及费用比例。此过程不可恢复且将立即生效！'
    });
  };

  const executeReset = async () => {
    const res = await window.db.resetDatabase();
    if (res?.success) {
      resetStore();
      setModalConfig({
        isOpen: true,
        type: 'SUCCESS',
        title: '清空完成',
        message: '系统数据已全部重置。'
      });
    }
  };

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const getConfirmAction = () => {
    switch (modalConfig.type) {
      case 'RESET': return executeReset;
      case 'IMPORT_WARN': return executeImport;
      case 'EXPORT_CONFIRM': return executeExport;
      default: return closeModal;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10 min-h-screen bg-transparent transition-none">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-blue-600 rounded-full" />
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">系统环境设置</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 dark:bg-white/5 border border-slate-100 dark:border-white/5 overflow-hidden rounded-lg shadow-sm">
        {/* 1. 存储管理 */}
        <div className="bg-white dark:bg-[#0f172a] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Database size={18} className="text-blue-600" />
            <h3 className="text-[13px] font-black text-slate-950 dark:text-white uppercase">本地数据治理</h3>
          </div>
          <div className="space-y-3">
            <button onClick={handleExport} className="w-full h-11 flex items-center justify-between px-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-lg group transition-all active:scale-[0.98]">
              <div className="flex items-center gap-3"><Download size={14} className="text-slate-400 group-hover:text-blue-600" /><span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">导出数据备份 (.db)</span></div>
              <span className="text-[9px] font-black text-slate-300 tracking-widest">EXPORT</span>
            </button>
            <button onClick={handleImport} className="w-full h-11 flex items-center justify-between px-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-lg group transition-all active:scale-[0.98]">
              <div className="flex items-center gap-3"><Upload size={14} className="text-slate-400 group-hover:text-emerald-600" /><span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">从备份还原数据</span></div>
              <span className="text-[9px] font-black text-slate-300 tracking-widest">IMPORT</span>
            </button>
          </div>
        </div>

        {/* 2. 界面偏好 */}
        <div className="bg-white dark:bg-[#0f172a] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <RotateCcw size={18} className="text-blue-600" />
            <h3 className="text-[13px] font-black text-slate-950 dark:text-white uppercase">视觉偏好设置</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTheme('light')} className={`h-11 rounded-lg text-[10px] font-black uppercase transition-all ${theme === 'light' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>商务纯白模式</button>
            <button onClick={() => setTheme('dark')} className={`h-11 rounded-lg text-[10px] font-black uppercase transition-all ${theme === 'dark' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>极客深空模式</button>
          </div>
        </div>

        {/* 3. 安全与危险区 */}
        <div className="bg-white dark:bg-[#0f172a] p-8 col-span-full border-t border-slate-50 dark:border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldAlert size={18} className="text-rose-500" />
            <h3 className="text-[13px] font-black text-slate-950 dark:text-white uppercase">系统深度重置</h3>
          </div>
          <p className="text-[11px] text-slate-500 font-bold max-w-xl">重置操作将物理物理清空本地所有组合资产、规格单项及费率定义。数据一旦抹除无法找回，请务必预先执行导出备份。</p>
          <button onClick={handleReset} className="h-11 px-8 border-2 border-rose-100 dark:border-rose-500/20 text-rose-600 rounded-lg text-[11px] font-black uppercase hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95">重置精算核心数据库</button>
        </div>
      </div>

      <div className="py-10 text-center space-y-1 opacity-20">
        <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.5em]">Moser Glass Pro Precision Engine</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase">Version 2.0.0 Stable Build</p>
      </div>

      <GlassModal 
        isOpen={modalConfig.isOpen} 
        onClose={closeModal} 
        title={modalConfig.title}
        footer={
          modalConfig.type === 'SUCCESS' ? (
            <GlassButton size="sm" onClick={closeModal}>明白了</GlassButton>
          ) : (
            <>
              <GlassButton variant="secondary" size="sm" onClick={closeModal}>取消</GlassButton>
              <GlassButton 
                variant={modalConfig.type === 'RESET' ? 'danger' : 'primary'} 
                size="sm" 
                onClick={getConfirmAction()}
              >
                确认执行
              </GlassButton>
            </>
          )
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {modalConfig.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-blue-500 shrink-0" />
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-200">{modalConfig.message}</p>
              {modalConfig.path && (
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl break-all">
                  <p className="text-[10px] text-slate-500 uppercase font-black mb-1">存储位置</p>
                  <code className="text-[10px] text-blue-400 font-mono">{modalConfig.path}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
