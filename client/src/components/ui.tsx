/* 
模块：通用 UI 组件
定位：Card/StatCard/PaginationBar 等可复用展示与分页控件
要点：基于 antd 进行样式包装，保持项目视觉统一
*/
import type { ReactNode } from 'react';
import { Card as AntCard, Pagination, Statistic } from 'antd';

export function Card({
  title,
  actions,
  className = '',
  children,
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const hasHeader = Boolean(title || actions);

  return (
    <AntCard
      title={hasHeader ? <span className="text-xl font-extrabold text-slate-900">{title}</span> : undefined}
      extra={hasHeader ? actions : undefined}
      className={`overflow-hidden rounded-5! border-4! border-[#222]! bg-white! shadow-[4px_4px_0_rgba(0,0,0,0.04)] ${className}`.trim()}
      styles={{
        header: hasHeader ? { minHeight: 74, borderBottom: '0', paddingInline: 24, paddingBlock: 18 } : { display: 'none' },
        body: { padding: 24 },
      }}
    >
      {children}
    </AntCard>
  );
}

export function StatCard({
  icon,
  label,
  value,
  subValue,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subValue: string;
}) {
  return (
    <AntCard
      className="rounded-5! border-4! border-[#222]! bg-white! shadow-[4px_4px_0_rgba(0,0,0,0.04)]"
      styles={{ body: { padding: 24 } }}
    >
      <div className="mb-4 flex items-center justify-center gap-3 text-base text-slate-600">
        <span className="text-2xl text-violet-800">{icon}</span>
        <span>{label}</span>
      </div>
      <Statistic
        value={value}
        valueStyle={{
          color: '#111827',
          fontSize: 44,
          lineHeight: 1.1,
          fontWeight: 800,
          textAlign: 'center',
        }}
      />
      <div className="mt-4 text-center text-sm text-slate-400">{subValue}</div>
    </AntCard>
  );
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4 border-t-3 border-dashed border-slate-300 pt-5 md:flex-row md:items-center md:justify-end">
      <div className="text-sm text-slate-400">共 {total} 条</div>
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger
        pageSizeOptions={[10, 20, 50]}
        onChange={(nextPage, nextPageSize) => {
          if (nextPageSize !== pageSize) {
            onPageSizeChange(nextPageSize);
            return;
          }
          onPageChange(nextPage);
        }}
        onShowSizeChange={(_, size) => onPageSizeChange(size)}
        showTotal={() => ''}
      />
    </div>
  );
}
