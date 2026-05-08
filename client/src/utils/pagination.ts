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
