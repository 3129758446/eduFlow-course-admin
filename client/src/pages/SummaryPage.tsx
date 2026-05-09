/* 
模块：学习总结页面
定位：从服务端拉取 Markdown 内容并以内置解析器渲染，支持代码高亮与一键复制
数据流：useSummaryStore.refresh() -> data.content -> <MarkdownRenderer />
用法：受保护路由下直接渲染
*/
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
