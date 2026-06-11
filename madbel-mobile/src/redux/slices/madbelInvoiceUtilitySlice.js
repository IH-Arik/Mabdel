import { baseApi } from "../baseApi.js";
import { buildInvoiceUtilityEndpoints } from "./madbelApi/endpoints/invoiceUtilityEndpoints.js";

export const madbelInvoiceUtilitySlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    ...buildInvoiceUtilityEndpoints(builder),
  }),
  overrideExisting: false,
});

export const {
  useMadbelListInvoicesQuery,
  useLazyMadbelListInvoicesQuery,
  useMadbelCreateInvoiceMutation,
  useMadbelGetInvoiceQuery,
  useLazyMadbelGetInvoiceQuery,
  useMadbelUpdateInvoiceMutation,
  useMadbelDeleteInvoiceMutation,
  useMadbelSendInvoiceMutation,
  useMadbelShareInvoiceMutation,
  useMadbelSendInvoiceReminderMutation,
  useMadbelUpdateInvoiceStatusMutation,
  useMadbelGetInvoiceTimelineQuery,
  useLazyMadbelGetInvoiceTimelineQuery,
  useMadbelDownloadInvoicePdfQuery,
  useLazyMadbelDownloadInvoicePdfQuery,
  useMadbelDownloadSharedInvoicePdfQuery,
  useLazyMadbelDownloadSharedInvoicePdfQuery,
  useMadbelDraftEmailMutation,
  useMadbelScheduleMeetingMutation,
  useMadbelCreateGroupGroupsMutation,
  useMadbelIncomingCallMutation,
  useMadbelCallStatusMutation,
  useMadbelGetPermissionsQuery,
  useLazyMadbelGetPermissionsQuery,
  useMadbelUpdatePermissionsMutation,
  useMadbelAcceptAllPermissionsMutation,
} = madbelInvoiceUtilitySlice;
