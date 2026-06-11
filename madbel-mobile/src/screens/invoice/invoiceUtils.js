import { Share } from "react-native";
import { API_BASE_URL } from "../../redux/apiUtils";

export const formatCurrency = (amount = 0, currency = "USD") => {
  const numericAmount = Number(amount || 0);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
  } catch {
    return `${currency} ${(Number.isFinite(numericAmount) ? numericAmount : 0).toFixed(2)}`;
  }
};

export const formatInvoiceDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export const formatTimelineDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const getInvoiceStatusMeta = (status = "draft") => {
  const normalized = String(status || "draft").toLowerCase();

  switch (normalized) {
    case "paid":
      return {
        label: "PAID",
        backgroundColor: "#1E4030",
        borderColor: "#31C48D",
        color: "#9BF3C5",
      };
    case "sent":
      return {
        label: "SENT",
        backgroundColor: "#2D4B27",
        borderColor: "#4D863D",
        color: "#96F16D",
      };
    case "viewed":
      return {
        label: "VIEWED",
        backgroundColor: "#133848",
        borderColor: "#14C9E7",
        color: "#86EFFF",
      };
    case "overdue":
      return {
        label: "OVERDUE",
        backgroundColor: "#4A211E",
        borderColor: "#F97316",
        color: "#FDBA74",
      };
    case "cancelled":
      return {
        label: "CANCELLED",
        backgroundColor: "#3B1D24",
        borderColor: "#FB7185",
        color: "#FDA4AF",
      };
    default:
      return {
        label: "DRAFT",
        backgroundColor: "#2C3341",
        borderColor: "#556070",
        color: "#D0D7E3",
      };
  }
};

export const buildInvoicePayload = (values = {}) => {
  const quantity = Number(values.qty || 1);
  const unitPrice = Number(String(values.price || "0").replace(/[^0-9.-]/g, "")) || 0;
  const normalizedItems = Array.isArray(values.items)
    ? values.items
        .map((item) => ({
          description: item?.description?.trim(),
          quantity: Number(item?.quantity || 1),
          unit_price: Number(item?.unit_price || 0),
          details: item?.details?.trim() || undefined,
        }))
        .filter((item) => item.description)
    : [];
  const items =
    normalizedItems.length > 0
      ? normalizedItems.map((item) => ({
          description: item.description,
          quantity: item.quantity > 0 ? item.quantity : 1,
          unit_price: item.unit_price >= 0 ? item.unit_price : 0,
          details: item.details,
        }))
      : [
          {
            description: values.itemName?.trim(),
            quantity: quantity > 0 ? quantity : 1,
            unit_price: unitPrice >= 0 ? unitPrice : 0,
          },
        ];

  return {
    client_name: values.clientName?.trim(),
    client_email: values.email?.trim() || undefined,
    due_date: values.dueDate,
    items,
  };
};

export const getInvoiceId = (invoice) =>
  invoice?.id || invoice?._id || invoice?.invoice_id || null;

export const getPublicInvoicePdfUrl = (shareUrl) => {
  if (!shareUrl) return null;

  // Keep the token/path but always pin to the app's current API host.
  if (/^https?:\/\//i.test(shareUrl)) {
    try {
      const parsed = new URL(shareUrl);
      const pathWithQuery = `${parsed.pathname || ""}${parsed.search || ""}`;
      return `${API_BASE_URL}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
    } catch {
      return shareUrl;
    }
  }

  return `${API_BASE_URL}${shareUrl.startsWith("/") ? shareUrl : `/${shareUrl}`}`;
};

export const shareInvoiceLink = async (shareUrl) => {
  const url = getPublicInvoicePdfUrl(shareUrl);
  if (!url) return false;

  await Share.share({ message: url, url });
  return true;
};
