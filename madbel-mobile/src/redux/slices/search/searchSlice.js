import { baseApi } from "../../baseApi";

export const searchSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    searchUsers: builder.query({
      query: ({ page = 1, limit = 10, query = "" } = {}) => ({
        url: "/social-feed/golfers",
        params: {
          page,
          limit,
          search: query,
        },
      }),
      meta: {
        skipAuth: false,
      },
      transformResponse: (response, meta, arg = {}) => {
        const rawUsers = response?.data || [];
        const users = rawUsers.map(entry => ({
          ...entry.golfer,
          isFollowing: entry.isFollowing,
        }));
        const page = arg.page ?? 1;
        const limit = arg.limit ?? (users.length || 10);
        const pagination = response.pagination || {
          page,
          limit,
          total: response.total || users.length,
          totalPages: Math.ceil((response.total || users.length) / limit),
          hasNext: users.length === limit,
        };


        return {
          users,
          pagination,
          _meta: {
            fetchedAt: Date.now(),
            page,
            query: arg.query || "",
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

        const existingIds = new Set(currentCache.users.map((u) => u._id));
        const newUsers = newResponse.users.filter(
          (u) => !existingIds.has(u._id),
        );

        return {
          users: [...currentCache.users, ...newUsers],
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
          state.baseApi.queries[`searchUsers-${JSON.stringify(currentArg)}`];
        if (cacheEntry?.data?._meta?.fetchedAt) {
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          return cacheEntry.data._meta.fetchedAt < fiveMinutesAgo;
        }

        return false;
      },
      providesTags: (result) => {
        const tags = [{ type: "SearchUsers", id: "LIST" }];

        if (result?.users) {
          tags.push(
            ...result.users.map(({ _id }) => ({
              type: "SearchUsers",
              id: `USER-${_id}`,
            })),
          );
        }

        return tags;
      },
    }),
    toggleFollow: builder.mutation({
      query: (golferUserId) => ({
        url: `/social-feed/follow/${golferUserId}`,
        method: "POST",
      }),
      meta: {
        skipAuth: false,
      },
      invalidatesTags: (result, error, golferUserId) => [
        { type: "SearchUsers", id: "LIST" },
        { type: "SearchUsers", id: `USER-${golferUserId}` },
        { type: "SearchUsers", id: `USER-PROFILE-${golferUserId}` },
      ],
    }),
    getUserProfile: builder.query({
      query: (golferUserId) => ({
        url: `/social-feed/golfers/${golferUserId}/profile`,
      }),
      meta: {
        skipAuth: false,
      },
      transformResponse: (response) => {
        return response?.data || response;
      },
      providesTags: (result, error, golferUserId) => [
        { type: "SearchUsers", id: `USER-PROFILE-${golferUserId}` },
      ],
    }),
  }),
  overrideExisting: true,
});


// export const searchSlice = baseApi.injectEndpoints({
//   endpoints: (builder) => ({
//     searchUsers: builder.query({
//       query: () => "/social-feed/golfers",
//       transformResponse: (response) => {
//         console.log("searchUsers response", response);
//         return response;
//       },
//       meta: { skipAuth: false },
//     })


//   }),
//   overrideExisting: true,
// });

export const { useSearchUsersQuery, useToggleFollowMutation, useGetUserProfileQuery } = searchSlice;
