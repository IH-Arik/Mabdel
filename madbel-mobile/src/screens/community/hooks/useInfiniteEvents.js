import { useCallback, useEffect, useMemo, useState } from "react";
import { useGetAllEventsQuery } from "../../../redux/slices/event/eventSlice";

export const useInfiniteEvents = (options = {}) => {
  const { pageSize = 10, initialPage = 1, filters = {} } = options;

  const [page, setPage] = useState(initialPage);
  const [allEvents, setAllEvents] = useState([]);
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
  } = useGetAllEventsQuery(
    { page, limit: pageSize, filters },
    {
      refetchOnMountOrArgChange: true,
    },
  );

  useEffect(() => {
    setPage(1);
    setAllEvents([]);
    setHasMore(true);
  }, [serializedFilters]);

  useEffect(() => {
    if (!pageData) return;

    const pageEvents = pageData?.events || [];

    if (page === 1) {
      setAllEvents(pageEvents);
    } else {
      setAllEvents((prev) => {
        const existingIds = new Set(prev.map((event) => event?.id || event?._id));
        const nextEvents = pageEvents.filter(
          (event) => !existingIds.has(event?.id || event?._id),
        );
        return [...prev, ...nextEvents];
      });
    }

    const pagination = pageData.pagination || {};
    const resolvedHasMore =
      pagination.hasNext === true ||
      (pagination.currentPage &&
        pagination.pageCount &&
        pagination.currentPage < pagination.pageCount) ||
      pageEvents.length === pageSize;

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
      setAllEvents([]);
      setHasMore(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [page, refetchQuery]);

  const reset = useCallback(() => {
    setPage(1);
    setAllEvents([]);
    setHasMore(true);
  }, []);

  return {
    events: allEvents,
    currentPage: page,
    hasMore,
    totalEvents: allEvents.length,
    pagination: pageData?.pagination,
    isLoading: isLoading && page === 1,
    isFetching,
    isError,
    error,
    isRefreshing,
    loadNextPage,
    refresh,
    reset,
    setPage,
    refetch: refetchQuery,
  };
};
