import { Eye, FilePlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  generateEarningInvoice,
  getEarningTransactionById,
  listEarningTransactions,
} from "../../services/earningsApi";

const ITEMS_PER_PAGE = 8;
const formatMoney = (amount, currency = "USD") =>
  `${currency === "USD" ? "$" : `${currency} `}${Number(amount || 0).toLocaleString()}`;

const Earnings = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [rows, setRows] = useState([]);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const payload = await listEarningTransactions({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        });
        if (!mounted) return;
        const data = payload?.data ?? payload;
        const items = Array.isArray(data) ? data : data?.items || data?.rows || [];
        const total =
          Number(payload?.meta?.totalItems) ||
          Number(data?.total) ||
          items.length;

        setRows(Array.isArray(items) ? items : []);
        setTotalItems(total);
      } catch {
        if (mounted) {
          setRows([]);
          setTotalItems(0);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const transactions = useMemo(
    () =>
      rows.map((row, index) => ({
        id: row?.id || row?._id || String(startItem + index),
        sid: row?.sId || startItem + index,
        name: row?.payer?.fullName || row?.payerName || "N/A",
        avatar: row?.payer?.avatarUrl || "",
        trxId: row?.transactionId || row?.id || "N/A",
        plan: row?.plan || "N/A",
        price: formatMoney(
          row?.adminEarning !== undefined ? row.adminEarning : row?.amount,
          row?.currency
        ),
        date: row?.date ? new Date(row.date).toLocaleDateString() : "N/A",
        email: row?.payer?.email || "N/A",
      })),
    [rows, startItem]
  );

  const summary = useMemo(() => {
    const total = rows.reduce(
      (sum, row) =>
        sum + Number(row?.adminEarning !== undefined ? row.adminEarning : row?.amount || 0),
      0
    );
    return {
      today: total,
      month: total,
      lifetime: totalItems ? total * Math.ceil(totalItems / Math.max(rows.length || 1, 1)) : total,
    };
  }, [rows, totalItems]);

  const handleView = async (transaction) => {
    try {
      const payload = await getEarningTransactionById({ id: transaction.id });
      const data = payload?.data ?? payload;
      setSelectedTransaction(data || null);
      setShowModal(true);
    } catch {
      setSelectedTransaction(null);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
  };

  const handleDownloadInvoice = async (id) => {
    try {
      const payload = await generateEarningInvoice({ id });
      const data = payload?.data ?? payload;
      alert(`Invoice generated: ${data?.invoiceId || "Success"}`);
    } catch {
      alert("Failed to generate invoice");
    }
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="sticky top-0 z-10 pb-4 bg-gray-50">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(summary.today)}</p>
            <p className="mt-2 text-base font-semibold text-slate-600">Today</p>
          </div>
          <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(summary.month)}</p>
            <p className="mt-2 text-base font-semibold text-slate-600">This Month</p>
          </div>
          <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(summary.lifetime)}</p>
            <p className="mt-2 text-base font-semibold text-slate-600">Total Revenue</p>
          </div>
        </div>
      </div>

      <div className="mx-auto">
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-white bg-[#17b4c9]">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-left">S.ID</th>
                  <th className="px-6 py-4 text-sm font-medium text-left">Full Name</th>
                  <th className="px-6 py-4 text-sm font-medium text-left">Trx ID</th>
                  <th className="px-6 py-4 text-sm font-medium text-left">Plans</th>
                  <th className="px-6 py-4 text-sm font-medium text-left">Price</th>
                  <th className="px-6 py-4 text-sm font-medium text-left">Date</th>
                  <th className="px-6 py-4 text-sm font-medium text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((transaction, index) => (
                  <tr
                    key={transaction.id}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">{String(transaction.sid).padStart(2, "0")}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={transaction.avatar || "https://placehold.co/64x64?text=U"}
                          alt={transaction.name}
                          className="object-cover w-8 h-8 rounded-full"
                        />
                        <span className="text-sm font-medium text-gray-900">{transaction.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.trxId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.plan}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{transaction.price}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadInvoice(transaction.id)}
                          className="p-1 text-gray-500 transition-colors hover:text-gray-700"
                          title="Download"
                        >
                          <FilePlus className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleView(transaction)}
                          className="p-1 text-[#17b4c9] transition-colors hover:text-gray-700"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-sm text-center text-slate-500">
                      No earnings found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
            <div className="text-sm font-medium text-[#17b4c9]">
              SHOWING {totalItems ? startItem : 0}-{totalItems ? endItem : 0} OF {totalItems}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-white rounded bg-[#17b4c9]">{currentPage}</span>
              <span className="text-sm text-gray-600">of {totalPages}</span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-md p-6 mx-4 bg-white rounded-lg shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center mb-6">
              <h2 className="text-2xl font-semibold text-[#17b4c9] w-4/5">
                Transaction Details
              </h2>
              <div className="flex self-end justify-end w-1/5">
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 transition-colors hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {selectedTransaction ? (
              <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Transaction ID</span>
                  <span className="text-gray-900">{selectedTransaction.transactionId || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Plans</span>
                  <span className="text-gray-900">{selectedTransaction.plan || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Date</span>
                  <span className="text-gray-900">
                    {selectedTransaction.date
                      ? new Date(selectedTransaction.date).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Name</span>
                  <span className="text-gray-900">{selectedTransaction.payer?.fullName || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">A/C number</span>
                  <span className="text-gray-900">
                    {selectedTransaction.payer?.accountNumberMasked || "**** **** **** *545"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Email</span>
                  <span className="text-gray-900">{selectedTransaction.payer?.email || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Transaction amount</span>
                  <span className="font-semibold text-gray-900">
                    {formatMoney(selectedTransaction.amount, selectedTransaction.currency)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mb-8 text-sm text-slate-500">Unable to load transaction details.</p>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 font-medium text-[#17b4c9] transition-colors border-2 border-[#17b4c9] rounded-lg hover:bg-blue-50"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedTransaction && handleDownloadInvoice(selectedTransaction.id)}
                className="flex-1 px-4 py-2 font-medium text-white transition-colors bg-[#17b4c9] rounded-lg hover:bg-blue-400"
              >
                Download Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Earnings;
