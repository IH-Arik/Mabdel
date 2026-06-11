import { useEffect, useMemo, useState } from "react";
import { Trash2, Edit } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../services/categoriesApi";

const ITEMS_PER_PAGE = 8;

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeListPayload = (payload) => {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const meta = payload?.meta || {};

  const totalItems = toNumber(meta?.totalItems, rows.length);
  const currentPage = toNumber(meta?.page ?? meta?.currentPage, 1);
  const totalPages = Math.max(
    1,
    toNumber(meta?.totalPages ?? meta?.pageCount, Math.ceil(totalItems / ITEMS_PER_PAGE))
  );

  return {
    rows,
    totalItems,
    currentPage,
    totalPages,
  };
};

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add");
  const [currentCategory, setCurrentCategory] = useState({ id: "", name: "" });
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = async (page = currentPage) => {
    try {
      setLoading(true);
      const payload = await listCategories({
        page,
        limit: ITEMS_PER_PAGE,
      });
      const normalized = normalizeListPayload(payload);
      setCategories(
        normalized.rows.map((row, index) => ({
          id: row?.id || row?._id || "",
          serialId:
            row?.serialId
            || String((normalized.currentPage - 1) * ITEMS_PER_PAGE + index + 1).padStart(2, "0"),
          name: row?.categoryName || row?.name || "",
          isActive: row?.isActive ?? true,
        }))
      );
      setTotalItems(normalized.totalItems);
      setTotalPages(normalized.totalPages);
      setCurrentPage(normalized.currentPage);
    } catch {
      setCategories([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories(currentPage);
  }, [currentPage]);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const handleAddCategory = () => {
    setModalType("add");
    setCurrentCategory({ id: "", name: "" });
    setIsModalOpen(true);
  };

  const handleEdit = (category) => {
    setModalType("edit");
    setCurrentCategory({ id: category.id, name: category.name });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const name = String(currentCategory.name || "").trim();
    if (!name) {
      alert("Category name is required");
      return;
    }

    try {
      setSaving(true);
      if (modalType === "add") {
        await createCategory({ categoryName: name, isActive: true });
      } else {
        await updateCategory({
          id: currentCategory.id,
          body: { categoryName: name },
        });
      }
      setIsModalOpen(false);
      setCurrentCategory({ id: "", name: "" });
      await loadCategories(currentPage);
    } catch (error) {
      alert(error?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (category) => {
    setDeletingCategory(category);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory?.id) return;
    try {
      setDeleting(true);
      await deleteCategory({ id: deletingCategory.id });
      setDeletingCategory(null);

      const isLastItemOnPage = categories.length === 1 && currentPage > 1;
      const nextPage = isLastItemOnPage ? currentPage - 1 : currentPage;
      await loadCategories(nextPage);
    } catch (error) {
      alert(error?.message || "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  };

  const closeDeleteModal = () => setDeletingCategory(null);

  const visiblePages = useMemo(() => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
      endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    }

    return Array.from(
      { length: Math.max(0, endPage - startPage + 1) },
      (_, index) => startPage + index
    );
  }, [currentPage, totalPages]);

  return (
    <div className="w-full p-6 bg-gray-50">
      <div className="overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#17b4c9] rounded-t-2xl">
          <h1 className="text-2xl font-semibold text-white">Categories</h1>
          <button
            onClick={handleAddCategory}
            className="px-4 py-2 text-sm font-medium text-blue-500 transition-colors bg-white rounded-md hover:bg-blue-50"
          >
            + Add Categories
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                  S.ID
                </th>
                <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                  Category Name
                </th>
                <th className="px-6 py-4 text-sm font-medium text-right text-[#17b4c9]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-center text-gray-500" colSpan={3}>
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-center text-gray-500" colSpan={3}>
                    No categories found.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr
                    key={category.id}
                    className="transition-colors border-b border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm text-gray-700">{category.serialId}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{category.name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDelete(category)}
                          className="p-1 text-red-500 transition-colors rounded hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-1 text-gray-600 transition-colors rounded hover:text-gray-800 hover:bg-gray-100"
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div className="text-sm text-[#17b4c9]">
            SHOWING {startItem}-{endItem} OF {totalItems}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-gray-500 hover:text-[#17b4c9] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt;
            </button>
            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 text-sm font-medium rounded ${
                  currentPage === page
                    ? "bg-blue-500 text-white"
                    : "text-blue-500 hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-gray-500 hover:text-[#17b4c9] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="mb-4 text-xl font-semibold">
              {modalType === "add" ? "Add Category" : "Edit Category"}
            </h2>
            <input
              type="text"
              className="w-full p-2 mb-4 border border-gray-300 rounded"
              placeholder="Category Name"
              value={currentCategory.name}
              onChange={(e) =>
                setCurrentCategory((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-white bg-[#17b4c9] rounded hover:bg-blue-400 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCategory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-sm p-6 bg-white rounded-lg shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-4 text-2xl font-bold text-center">
              Are you sure you want to delete this category?
            </h3>
            <div className="flex justify-center gap-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 text-sm transition-colors bg-white border border-[#17b4c9] text-[#17b4c9] rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white transition-colors bg-red-600 rounded hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
