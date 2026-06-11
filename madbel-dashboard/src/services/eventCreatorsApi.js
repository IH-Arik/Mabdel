import { apiRequest, apiRequestWithFallback, createPath } from "./httpClient";

const toListQuery = (query = {}) => ({
  ...query,
  pageSize: query.pageSize ?? query.limit,
});

export const listEventCreators = (query = {}) =>
  apiRequestWithFallback(
    ["/admin/event-creators", "/admin/event-creators/premium"],
    { query: toListQuery(query) }
  );

export const getEventCreatorById = ({ id }) =>
  apiRequestWithFallback([
    createPath("/admin/event-creators/:id", { id }),
    createPath("/admin/event-creators/premium/:id", { id }),
  ]);

export const payoutEventCreator = ({ id, body = {} }) =>
  apiRequestWithFallback(
    [createPath("/admin/event-creators/:id/payout", { id })],
    {
      method: "POST",
      body,
    }
  );
