/* 
模块：分页工具
定位：删除数据后根据总数与 pageSize 计算下一页，避免空页
用法：pageAfterDelete({ page, pageSize, total })
*/
export function pageAfterDelete({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const nextTotal = Math.max(total - 1, 0);
  const maxPage = Math.max(Math.ceil(nextTotal / pageSize), 1);

  return Math.min(page, maxPage);
}
