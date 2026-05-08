import { useEffect, useState } from "react";
import { fetchSummary } from "../api";
import { EmptyState, PanelLoading } from "../components/feedback";
import { Card } from "../components/ui";
import { MarkdownRenderer } from "../markdown";
import type { SummaryData } from "../types";
import { appErrorMessage } from "../utils/text";

export function SummaryPage({
  setGlobalError,
}: {
  setGlobalError: (value: string) => void;
}) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchSummary()
      .then((result) => {
        if (!active) return;
        setData(result);
        setGlobalError("");
      })
      .catch((error) => {
        if (active) setGlobalError(appErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setGlobalError]);

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
