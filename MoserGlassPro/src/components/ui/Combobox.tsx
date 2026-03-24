import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Command } from "cmdk"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

export function Combobox({ options, value, onValueChange, placeholder = "请点选...", colorPreview = false }: any) {
  const [open, setOpen] = React.useState(false)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button className="flex h-12 w-full items-center justify-between rounded-xl border-2 border-slate-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-bold transition-all focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm active:scale-[0.98]">
          <div className="flex items-center gap-2 truncate text-slate-900 dark:text-white">
            {colorPreview && value && (
              <div className={cn("w-3 h-3 rounded-full", value)} />
            )}
            <span className={cn(!value && "text-slate-400")}>
              {value ? options.find((opt: any) => opt.value === value)?.label : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content 
          className="z-[1000] w-[var(--radix-popover-trigger-width)] min-w-[200px] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          align="start"
          sideOffset={4}
        >
          <Command className="flex flex-col overflow-hidden">
            <div className="flex items-center border-b border-slate-50 dark:border-white/5 px-3 py-2 bg-slate-50/50 dark:bg-white/5">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-30 dark:text-white" />
              <Command.Input 
                placeholder="搜索名称进行筛选..." 
                className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-slate-400 font-bold dark:text-white"
              />
            </div>
            <Command.Empty className="py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              库内无匹配内容
            </Command.Empty>
            <Command.List className="max-h-[280px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
              {options.map((opt: any) => (
                <Command.Item
                  key={opt.value}
                  onSelect={() => { onValueChange(opt.value); setOpen(false); }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm font-bold outline-none transition-colors",
                    value === opt.value 
                      ? "bg-blue-600 text-white" 
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}
                >
                  {colorPreview && <div className={cn("w-3 h-3 rounded-full mr-3 border border-white/20", opt.value)} />}
                  <span className="flex-1">{opt.label}</span>
                  <Check className={cn("ml-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
