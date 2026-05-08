import { Empty, Spin } from 'antd';

export function LoadingScreen({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_45%,#f8fafc_100%)] px-6">
      <div className="rounded-3xl bg-white/95 px-10 py-12 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <Spin size="large" />
        <p className="mt-5 text-base text-slate-600">{text}</p>
      </div>
    </div>
  );
}

export function PanelLoading({ text }: { text: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center">
      <div className="flex items-center gap-3 text-slate-500">
        <Spin />
        <span>{text}</span>
      </div>
    </div>
  );
}

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Empty description={title} />
    </div>
  );
}
