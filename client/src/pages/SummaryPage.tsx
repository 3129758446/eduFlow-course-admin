import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { EmptyState, PanelLoading } from "../components/feedback";
import { Card } from "../components/ui";
import { MarkdownRenderer } from "../markdown";
import { useSummaryStore } from "../stores/summary-store";

export function SummaryPage() {
  const { data, loading, refresh } = useSummaryStore(
    useShallow((state) => ({
      data: state.data,
      loading: state.loading,
      refresh: state.refresh,
    }))
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && !data) {
    return <PanelLoading text="正在加载学习总结..." />;
  }

  if (!data) {
    return <EmptyState title="学习总结加载失败" />;
  }

  return (
    <div className="w-full space-y-6">
      <h2 className="m-0 text-4xl font-extrabold text-slate-900">
        学习总结
      </h2>
      <Card title="" className="summary-card border-4! border-[#222]!">
        <div className="summary-panel">
          <MarkdownRenderer content={data.content} />
        </div>
      </Card>
    </div>
  );
}
