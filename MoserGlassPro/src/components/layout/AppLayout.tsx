import React, { useState } from 'react';
import { LayoutDashboard, Database, Settings, FileText, ChevronRight, LogOut } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: string) => void;
}

export const AppLayout = ({ children, currentView, onChangeView }: AppLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const NavItem = ({ id, icon: Icon, label }: any) => (
    <button
      onClick={() => onChangeView(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium ${
        currentView === id 
        ? 'bg-blue-600 text-white shadow-sm' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <Icon size={18} />
      {!isCollapsed && <span>{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen w-screen bg-[#0f172a]">
      {/* 侧边栏 */}
      <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-[#020617] border-r border-slate-800 flex flex-col transition-all duration-300`}>
        {/* 品牌区 */}
        <div className="h-16 flex items-center px-4 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shrink-0">
            <span className="font-bold text-white text-lg">M</span>
          </div>
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden">
              <h1 className="font-bold text-slate-100 whitespace-nowrap">Moser Pro</h1>
              <p className="text-xs text-slate-500 whitespace-nowrap">Glass Estimator</p>
            </div>
          )}
        </div>

        {/* 导航菜单 */}
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {!isCollapsed && '工程管理'}
          </div>
          <NavItem id="PROJECTS" icon={FileText} label="项目与报价" />
          
          <div className="mt-6 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {!isCollapsed && '数据库中心'}
          </div>
          <NavItem id="DB_SPECS" icon={Database} label="规格与属性库" />
          <NavItem id="DB_MATRIX" icon={LayoutDashboard} label="价格矩阵配置" />
          <NavItem id="DB_FEES" icon={Settings} label="费率与参数" />
        </div>

        {/* 底部折叠按钮 */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-12 border-t border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-200"
        >
          <ChevronRight size={16} className={`transition-transform ${!isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
        {children}
      </main>
    </div>
  );
};
