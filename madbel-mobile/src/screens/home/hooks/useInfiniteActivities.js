import { useCallback, useEffect, useMemo, useState } from "react";
import { useGetAllActivitiesQuery } from "../../../redux/slices/event/eventSlice";

export const useInfiniteActivities = (options = {}) => {
  const { pageSize = 10, initialPage = 1, filters = {} } = options;

  const [page, setPage] = useState(initialPage);
  const [allActivities, setAllActivities] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const serializedFilters = useMemo(() => JSON.stringify(filters || {}), [filters]);

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: refetchQuery,
  } = useGetAllActivitiesQuery(
    { page, limit: pageSize, filters },
    {
      refetchOnMountOrArgChange: true,
    },
  );

  useEffect(() => {
    setPage(1);
    setAllActivities([]);
    setHasMore(true);
  }, [serializedFilters]);

  useEffect(() => {
    if (!pageData) return;

    const pageActivities = pageData.activities || [];

    if (page === 1) {
      setAllActivities(pageActivities);
    } else {
      setAllActivities((prev) => {
        const existingIds = new Set(prev.map((activity) => activity?.id || activity?._id));
        const nextActivities = pageActivities.filter(
          (activity) => !existingIds.has(activity?.id || activity?._id),
        );
        return [...prev, ...nextActivities];
      });
    }

    const pagination = pageData.pagination || {};
    const resolvedHasMore =
      pagination.hasNext === true ||
      (pagination.currentPage &&
        pagination.pageCount &&
        pagination.currentPage < pagination.pageCount) ||
      pageActivities.length === pageSize;

    setHasMore(Boolean(resolvedHasMore));
  }, [pageData, page, pageSize]);

  const loadNextPage = useCallback(() => {
    if (!hasMore || isFetching) return;

    const nextPageFromApi = pageData?.pagination?.currentPage
      ? pageData.pagination.currentPage + 1
      : page + 1;

    setPage(nextPageFromApi);
  }, [hasMore, isFetching, pageData?.pagination?.currentPage, page]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (page !== 1) {
        setPage(1);
      } else {
        await refetchQuery();
      }
      setAllActivities([]);
      setHasMore(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [page, refetchQuery]);

  return {
    activities: allActivities,
    currentPage: page,
    hasMore,
    totalActivities: allActivities.length,
    pagination: pageData?.pagination,
    isLoading: isLoading && page === 1,
    isFetching,
    isError,
    error,
    isRefreshing,
    loadNextPage,
    refresh,
    setPage,
    refetch: refetchQuery,
  };
};
