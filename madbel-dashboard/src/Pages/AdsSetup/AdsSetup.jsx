import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Plus, Search, SlidersHorizontal } from "lucide-react";
import { MdDelete } from "react-icons/md";
import { CiPower } from "react-icons/ci";
import {
  createAd,
  deleteAd,
  listAds,
  updateAd,
  updateAdStatus,
} from "../../services/adsApi";

const defaultCategories = [
  "Protein",
  "Fitness Tracker",
  "Sport Earbuds",
  "Premium Yoga Mat",
  "Supplements",
  "Accessories",
];

const createBlankAdForm = () => ({
  id: null,
  category: "",
  productName: "",
  description: "",
  price: "",
  url: "",
  isActive: false,
  image: "",
  imageFile: null,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatPrice = (value) => {
  if (value === "" || value === undefined || value === null) return "--";
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return typeof value === "string" && value.trim() ? value : "--";
  }
  return currencyFormatter.format(numeric);
};

const parsePriceValue = (value) => {
  const numeric = Number.parseFloat(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const extractItems = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
};

const toBooleanFilter = (value) => {
  if (value === "active") return true;
  if (value === "inactive") return false;
  return undefined;
};

const normalizeProducts = (payload) => {
  const items = extractItems(payload);
  return items.map((item) => {
    const id = item?.id || item?._id;
    return {
      id: String(id || ""),
      category: item?.category || "",
      productName: item?.name || "",
      description: item?.description || "",
      price: item?.price ?? "",
      url: item?.ctaUrl || item?.destinationUrl || "",
      isActive: Boolean(item?.isActive),
      image: item?.imageUrl || "",
      createdAt: item?.createdAt || null,
    };
  });
};

const buildProductPayload = (formData, { withImage }) => {
  const parsedPrice = Number.parseFloat(formData.price);
  const price = Number.isNaN(parsedPrice) ? 0 : parsedPrice;
  const payload = {
    name: formData.productName.trim(),
    category: formData.category.trim() || undefined,
    description: formData.description.trim() || undefined,
    price,
    destinationUrl: formData.url.trim(),
    imageUrl:
      formData.image && typeof formData.image === "string" && !formData.image.startsWith("data:")
        ? formData.image
        : undefined,
    isActive: Boolean(formData.isActive),
    stock: 0,
  };

  if (withImage) {
    const body = new FormData();
    body.append("name", payload.name);
    if (payload.category) body.append("category", payload.category);
    if (payload.description) body.append("description", payload.description);
    body.append("price", String(payload.price));
    body.append("destinationUrl", payload.destinationUrl);
    if (payload.imageUrl) body.append("imageUrl", payload.imageUrl);
    body.append("isActive", String(payload.isActive));
    body.append("stock", String(payload.stock));
    body.append("image", formData.imageFile);
    return body;
  }

  return payload;
};

const normalizeUrlInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return "";
  }
};

const AdsSetup = () => {
  const [ads, setAds] = useState([]);
  const [editingAd, setEditingAd] = useState(null);
  const [deletingAd, setDeletingAd] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState(createBlankAdForm());
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const placeholderImage =
    "https://via.placeholder.com/400x240.png?text=Ad+Preview";

  const loadAds = useCallback(async () => {
    try {
      setIsLoading(true);
      const payload = await listAds({
        page: 1,
        limit: 100,
        q: searchTerm.trim() || undefined,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        active: toBooleanFilter(statusFilter),
      });
      setAds(normalizeProducts(payload));
    } catch {
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const categoryOptions = useMemo(() => {
    const seen = new Map();
    [...defaultCategories, ...ads.map((ad) => ad.category || "")].forEach((category) => {
      const normalized = category.trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, normalized);
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [ads]);

  const stats = useMemo(() => {
    const totalValue = ads.reduce((sum, ad) => sum + parsePriceValue(ad.price), 0);
    const activeCount = ads.filter((ad) => ad.isActive).length;
    const categoriesInUse = new Set(
      ads.map((ad) => ad.category).filter((category) => Boolean(category))
    ).size;
    const averagePrice = ads.length ? totalValue / ads.length : 0;

    return {
      totalValue,
      activeCount,
      categoriesInUse,
      averagePrice,
    };
  }, [ads]);

  const displayAds = useMemo(() => {
    return [...ads].sort((a, b) => {
      if (sortBy === "price-desc") {
        return parsePriceValue(b.price) - parsePriceValue(a.price);
      }
      if (sortBy === "price-asc") {
        return parsePriceValue(a.price) - parsePriceValue(b.price);
      }
      if (sortBy === "name-asc") {
        return (a.productName || "").localeCompare(b.productName || "");
      }

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [ads, sortBy]);

  const handleInputChange = (field, value) =>
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

  const resetForm = () => setFormData(createBlankAdForm());

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        image: reader.result ?? "",
        imageFile: file,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = (ad) => {
    setEditingAd(ad);
    setIsCreating(false);
    setFormData({
      id: ad.id,
      category: ad.category || "",
      productName: ad.productName || "",
      description: ad.description || "",
      price:
        ad.price === undefined || ad.price === null ? "" : ad.price.toString(),
      url: ad.url || "",
      isActive: ad.isActive ?? false,
      image: ad.image || "",
      imageFile: null,
    });
  };

  const handleDelete = (ad) => setDeletingAd(ad);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingAd(null);
    resetForm();
  };

  const closeEditModal = () => {
    setEditingAd(null);
    resetForm();
  };

  const closeDeleteModal = () => setDeletingAd(null);

  const closeCreateModal = () => {
    setIsCreating(false);
    resetForm();
  };

  const handleInlineStatusToggle = async (ad) => {
    try {
      await updateAdStatus({
        id: ad.id,
        body: { status: !ad.isActive },
      });
      await loadAds();
    } catch {
      alert("Failed to update status");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAd) return;
    try {
      setIsDeleting(true);
      await deleteAd({ id: deletingAd.id });
      setDeletingAd(null);
      await loadAds();
    } catch {
      alert("Failed to delete ad");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.productName.trim()) {
      alert("Product name is required");
      return;
    }
    if (!formData.url.trim()) {
      alert("Destination URL is required");
      return;
    }
    if (formData.price === "" || Number.isNaN(Number(formData.price))) {
      alert("Valid price is required");
      return;
    }
    const normalizedUrl = normalizeUrlInput(formData.url);
    if (!normalizedUrl) {
      alert("Please enter a valid destination URL");
      return;
    }

    try {
      setIsSaving(true);
      const preparedForm = {
        ...formData,
        url: normalizedUrl,
      };
      if (editingAd) {
        const body = buildProductPayload(preparedForm, {
          withImage: Boolean(formData.imageFile),
        });
        await updateAd({ id: editingAd.id, body });
        closeEditModal();
      } else {
        const body = buildProductPayload(preparedForm, { withImage: true });
        await createAd(body);
        closeCreateModal();
      }
      await loadAds();
    } catch (error) {
      alert(error?.message || "Failed to save ad");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full p-4 space-y-6 bg-gray-50">
      <section className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#17b4c9] uppercase">
              Campaign Control
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900">
              Ads Setup Workspace
            </h1>
            <p className="text-sm text-gray-500">
              Search, filter, and optimize every placement from one view.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-xl bg-[#17b4c9] hover:bg-[#5a94c9] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Ad
          </button>
        </div>

        <div className="grid gap-4 mt-8 md:grid-cols-2 xl:grid-cols-4">
          <div className="p-4 bg-[#F4F8FC] rounded-xl">
            <p className="text-xs font-medium text-gray-500 uppercase">Active Ads</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.activeCount}</p>
            <p className="text-sm text-gray-500">{stats.activeCount} of {ads.length} live</p>
          </div>
          <div className="p-4 bg-[#F4F8FC] rounded-xl">
            <p className="text-xs font-medium text-gray-500 uppercase">Catalog Value</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{formatPrice(stats.totalValue)}</p>
            <p className="text-sm text-gray-500">Combined price across ads</p>
          </div>
          <div className="p-4 bg-[#F4F8FC] rounded-xl">
            <p className="text-xs font-medium text-gray-500 uppercase">Avg. Product Price</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{formatPrice(stats.averagePrice)}</p>
            <p className="text-sm text-gray-500">Based on current catalog</p>
          </div>
          <div className="p-4 bg-[#F4F8FC] rounded-xl">
            <p className="text-xs font-medium text-gray-500 uppercase">Categories Live</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.categoriesInUse}</p>
            <p className="text-sm text-gray-500">Unique categories in rotation</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="sticky top-0 z-20 p-6 space-y-5 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <SlidersHorizontal className="w-4 h-4 text-[#17b4c9]" />
            <span>Showing {displayAds.length} ads</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Keyword Search
              </label>
              <div className="relative">
                <Search className="absolute w-4 h-4 text-gray-400 left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by product, copy, or URL"
                  className="w-full py-3 pl-11 pr-4 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
              >
                <option value="recent">Newest first</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="name-asc">Alphabetical</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
          {isLoading ? (
            <div className="py-12 text-center">
              <p className="text-lg font-semibold text-gray-900">Loading ads...</p>
            </div>
          ) : displayAds.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg font-semibold text-gray-900">
                No ads match the current filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs font-semibold tracking-wide text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayAds.map((ad, index) => (
                    <tr key={ad.id || `${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={ad.image || placeholderImage}
                            alt={ad.productName || "Ad creative"}
                            className="object-cover rounded-lg w-12 h-12"
                          />
                          <div>
                            <p className="font-semibold text-gray-900">
                              {ad.productName || "Untitled"}
                            </p>
                            <p className="text-xs text-gray-500 max-w-[220px] truncate">
                              {ad.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-[#E9F2FB] text-[#17b4c9]">
                          {ad.category || "Uncategorized"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {formatPrice(ad.price)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={ad.isActive}
                              onChange={() => handleInlineStatusToggle(ad)}
                            />
                            <span className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:outline-none peer-checked:bg-[#17b4c9] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:after:translate-x-full"></span>
                          </label>
                          <span
                            className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                              ad.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {ad.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(ad)}
                            className="p-2 transition-colors bg-blue-50 rounded-full hover:bg-blue-100"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(ad)}
                            className="p-2 transition-colors bg-red-50 rounded-full hover:bg-red-100"
                            title="Delete"
                          >
                            <MdDelete className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {(isCreating || editingAd) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black bg-opacity-40"
          onClick={isCreating ? closeCreateModal : closeEditModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-6 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-[#17b4c9] sm:text-2xl">
                {isCreating ? "Create New Ad" : "Edit Ad"}
              </h3>
              <button
                type="button"
                onClick={isCreating ? closeCreateModal : closeEditModal}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Product Name
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) => handleInputChange("productName", e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Category
                </label>
                <input
                  type="text"
                  list="ad-categories"
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
                />
                <datalist id="ad-categories">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Price (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Destination URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => handleInputChange("url", e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#17b4c9]"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Upload Creative
                </label>
                <div className="flex flex-col gap-3 p-4 border border-dashed rounded-xl border-blue-200 bg-blue-50/40">
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="ad-image-upload"
                      className="px-4 py-2 text-sm font-semibold text-white rounded-md cursor-pointer bg-[#17b4c9] hover:bg-[#5a94c9]"
                    >
                      Upload image
                    </label>
                    <input
                      id="ad-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    {formData.image ? (
                      <span className="text-xs text-gray-600">Image selected</span>
                    ) : (
                      <span className="text-xs text-gray-400">No image selected</span>
                    )}
                  </div>
                  {formData.image && (
                    <img
                      src={formData.image}
                      alt="Uploaded preview"
                      className="object-cover w-full h-40 rounded-lg"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block mb-3 text-sm font-medium text-gray-700">
                  Status
                </label>
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full">
                      <CiPower />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Activate Now?</p>
                      <p className="text-xs text-gray-500">Turn on to make ad live immediately</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange("isActive", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-[#17b4c9] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={isCreating ? closeCreateModal : closeEditModal}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 transition-colors bg-white border border-[#17b4c9] rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 text-sm font-medium text-white bg-[#17b4c9] rounded-md hover:bg-[#5a94c9] transition-colors disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : isCreating ? "Save Ad" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingAd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black bg-opacity-40"
          onClick={closeDeleteModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm p-6 bg-white rounded-lg shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-4 text-2xl font-bold text-center">
              Do you want to delete this Ad?
            </h3>
            <p className="mb-6 text-sm text-center text-gray-500">
              {deletingAd.productName || "Unnamed ad"} will be removed.
            </p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 text-sm transition-colors bg-white border border-[#17b4c9] text-[#17b4c9] rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-white transition-colors bg-red-600 rounded hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsSetup;
