import React, { useEffect, useState } from "react";

const Pagination = ({ allData, getCurrentItems, getIndexOfFirstItem }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const totalPages = Math.ceil(allData.length / itemsPerPage);

    // Update items whenever page, items per page, or the data changes
    useEffect(() => {
        if (allData.length > 0) {
            const currentItems = allData.slice(indexOfFirstItem, indexOfLastItem);
            getCurrentItems(currentItems);
            getIndexOfFirstItem(indexOfFirstItem);
        } else {
            // Handle empty data case
            getCurrentItems([]);
            getIndexOfFirstItem(0);
        }
    }, [allData, currentPage, itemsPerPage, getCurrentItems, getIndexOfFirstItem, indexOfFirstItem, indexOfLastItem]);

    // Ensure current page is valid when data length changes
    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(allData.length / itemsPerPage));
        if (currentPage > maxPage) {
            setCurrentPage(maxPage);
        }
    }, [allData.length, currentPage, itemsPerPage]);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    const handleItemsPerPageChange = (e) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
    }

    return (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
                <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${currentPage === 1
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50"
                        }`}
                >
                    Previous
                </button>
                <button
                    onClick={() =>
                        handlePageChange(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${currentPage === totalPages || totalPages === 0
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50"
                        }`}
                >
                    Next
                </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        {allData.length > 0 ? (
                            <>
                                Showing <span className="font-medium">{indexOfFirstItem + 1}</span>{" "}
                                to{" "}
                                <span className="font-medium">
                                    {Math.min(indexOfLastItem, allData.length)}
                                </span>{" "}
                                of <span className="font-medium">{allData.length}</span> results
                            </>
                        ) : (
                            "No results to display"
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        className="rounded border-gray-300 text-sm"
                    >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                    </select>
                    {totalPages > 0 && (
                        <nav
                            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                            aria-label="Pagination"
                        >
                            <button
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${currentPage === 1
                                        ? "opacity-50 cursor-not-allowed"
                                        : "hover:bg-gray-50"
                                    }`}
                            >
                                <span className="sr-only">Previous</span>
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                            {pageNumbers.map((number) => (
                                <button
                                    key={number}
                                    onClick={() => handlePageChange(number)}
                                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === number
                                            ? "bg-blue-600 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                            : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0"
                                        }`}
                                >
                                    {number}
                                </button>
                            ))}
                            <button
                                onClick={() =>
                                    handlePageChange(Math.min(totalPages, currentPage + 1))
                                }
                                disabled={currentPage === totalPages}
                                className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${currentPage === totalPages
                                        ? "opacity-50 cursor-not-allowed"
                                        : "hover:bg-gray-50"
                                    }`}
                            >
                                <span className="sr-only">Next</span>
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </nav>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Pagination;