import { baseApi } from "../../baseApi";

export const eventSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllEvents: builder.query({
      query: ({ page = 1, limit = 10, filters = {} } = {}) => {
        return {
        url: "/events",
        params: {
          page,
          limit,
          // sort: "createdAt:desc",
          ...filters,
        },
      }},

      


    transformResponse: (response, meta, arg) => {

      const events = response?.data || [];
      const pagination = response?.pagination || {
        currentPage: arg.page,
        itemsPerPage: arg.limit,
        totalItems: events.length,
        pageCount: 1,
        hasNext: false,
        hasPrev: arg.page > 1,
      };

      return {
        events,
        pagination,
        _meta: {
          fetchedAt: Date.now(),
          page: arg.page,
        },
      };
    },

    serializeQueryArgs: ({ endpointName, queryArgs }) => {
      const { page, ...restArgs } = queryArgs || {};
      return `${endpointName}-${JSON.stringify(restArgs)}`;
    },

    merge: (currentCache, newResponse, { arg }) => {
      if (arg.page === 1 || !currentCache) {
        return newResponse;
      }

      const existingIds = new Set(
        currentCache.events.map((event) => event?.id || event?._id),
      );
      const newEvents = newResponse.events.filter(
        (event) => !existingIds.has(event?.id || event?._id),
      );

      return {
        events: [...currentCache.events, ...newEvents],
        pagination: newResponse.pagination,
        _meta: {
          ...currentCache._meta,
          latestPage: arg.page,
        },
      };
    },

    forceRefetch({ currentArg, previousArg, state }) {
      if (currentArg?.page !== previousArg?.page) return true;

      const cacheEntry =
        state.baseApi.queries[`getAllEvents-${JSON.stringify(currentArg)}`];
      if (cacheEntry?.data?._meta?.fetchedAt) {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return cacheEntry.data._meta.fetchedAt < fiveMinutesAgo;
      }

      return false;
    },

    providesTags: (result, error, arg) => {
      const tags = [{ type: "GetAllEvents", id: "LIST" }];

      if (result?.events) {
        tags.push(
          ...result.events.map((event) => ({
            type: "GetAllEvents",
            id: event?.id || event?._id,
          })),
        );

        tags.push({
          type: "GetAllEvents",
          id: `PAGE-${arg.page}`,
        });
      }

      return tags;
    },
    }),

    getAllActivities: builder.query({
      query: ({ page = 1, limit = 10, filters = {} } = {}) => ({
        url: "/activities",
        params: {
          page,
          limit,
          ...filters,
        },
      }),

      transformResponse: (response, meta, arg) => {
        const activities = response?.data || [];
        const pagination = response?.pagination || {
          currentPage: arg.page,
          itemsPerPage: arg.limit,
          totalItems: activities.length,
          pageCount: 1,
          hasNext: false,
          hasPrev: arg.page > 1,
        };

        return {
          activities,
          pagination,
          _meta: {
            fetchedAt: Date.now(),
            page: arg.page,
          },
        };
      },

      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const { page, ...restArgs } = queryArgs || {};
        return `${endpointName}-${JSON.stringify(restArgs)}`;
      },

      merge: (currentCache, newResponse, { arg }) => {
        if (arg.page === 1 || !currentCache) {
          return newResponse;
        }

        const existingIds = new Set(
          currentCache.activities.map((activity) => activity?.id || activity?._id),
        );
        const newActivities = newResponse.activities.filter(
          (activity) => !existingIds.has(activity?.id || activity?._id),
        );

        return {
          activities: [...currentCache.activities, ...newActivities],
          pagination: newResponse.pagination,
          _meta: {
            ...currentCache._meta,
            latestPage: arg.page,
          },
        };
      },

      forceRefetch({ currentArg, previousArg, state }) {
        if (currentArg?.page !== previousArg?.page) return true;

        const cacheEntry =
          state.baseApi.queries[`getAllActivities-${JSON.stringify(currentArg)}`];
        if (cacheEntry?.data?._meta?.fetchedAt) {
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          return cacheEntry.data._meta.fetchedAt < fiveMinutesAgo;
        }

        return false;
      },

      providesTags: (result, error, arg) => {
        const tags = [{ type: "GetAllActivities", id: "LIST" }];

        if (result?.activities) {
          tags.push(
            ...result.activities.map((activity) => ({
              type: "GetAllActivities",
              id: activity?.id || activity?._id,
            })),
          );

          tags.push({
            type: "GetAllActivities",
            id: `PAGE-${arg.page}`,
          });
        }

        return tags;
      },
    }),

 

    createEvent: builder.mutation({
      query: (payload) => {
        const { mediaFiles = [], ...restPayload } = payload || {};
        const hasMedia = Array.isArray(mediaFiles) && mediaFiles.length > 0;

        if (!hasMedia) {
          return {
            url: `/events`,
            method: "POST",
            body: restPayload,
          };
        }

        const formData = new FormData();

        Object.entries(restPayload).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (typeof value === "object") {
            formData.append(key, JSON.stringify(value));
            return;
          }
          formData.append(key, String(value));
        });

        mediaFiles.forEach((file, index) => {
          if (!file?.uri) return;
          formData.append("media", {
            uri: file.uri,
            type: file.type || "application/octet-stream",
            name: file.fileName || `media-${Date.now()}-${index}`,
          });
        });
        return {
          url: `/events`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (result, error) => {
        if (error) return [];
        return [{ type: "GetAllEvents", id: "LIST" }];
      },
      meta: {
        skipAuth: false,
      },
    }),

    createActivity: builder.mutation({
      query: (payload) => {
        const { mediaFiles = [], ...restPayload } = payload || {};
        const hasMedia = Array.isArray(mediaFiles) && mediaFiles.length > 0;

        if (!hasMedia) {
          return {
            url: `/activities`,
            method: "POST",
            body: restPayload,
          };
        }

        const formData = new FormData();

        Object.entries(restPayload).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (typeof value === "object") {
            formData.append(key, JSON.stringify(value));

            return;
          }
          formData.append(key, String(value));
        });

        mediaFiles.forEach((file, index) => {
          if (!file?.uri) return;
          formData.append("media", {
            uri: file.uri,
            type: file.type || "application/octet-stream",
            name: file.fileName || `media-${Date.now()}-${index}`,
          });
        });
        return {
          url: `/activities`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (result, error) => {
        if (error) return [];
        return [{ type: "GetAllActivities", id: "LIST" }];
      },
      meta: {
        skipAuth: false,
      },
    }),

    joinActivity: builder.mutation({
      query: (activityId) => ({
        url: `/activities/${activityId}/join`,
        method: "POST",
      }),
      invalidatesTags: (result, error, activityId) => {
        if (error) return [];
        return [
          { type: "GetAllActivities", id: "LIST" },
          { type: "GetAllActivities", id: activityId },
        ];
      },
    }),
  }),

  overrideExisting: true,
});

export const {
  useGetAllEventsQuery,
  useGetAllActivitiesQuery,
  // useGetAllPostsOwnQuery,
  // useAddCommentSinglePostMutation,
  // useAddReplyToCommentSinglePostMutation,
  // useAddReShareSinglePostMutation,
  // useToggleLikeSinglePostMutation,
  // useAddViewSinglePostMutation,
  useCreateEventMutation,
  useCreateActivityMutation,
  useJoinActivityMutation,
} = eventSlice;
