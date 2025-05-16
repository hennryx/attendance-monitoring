import React, { useState } from "react";
import Pagination from "../../../../components/pagination";

const Table = ({ allData }) => {
  const [currentItems, setCurrentItems] = useState([]);
  const [indexOfFirstItem, setIndexOfFirstItem] = useState(0);
  return (
    <div>
      <table className="table">
        <caption>
          <div className="flex justify-between p-4">
            <h3 className="text-xl">Attendance</h3>
          </div>
        </caption>
        <thead>
          <tr className="text-black bg-gray-300">
            <th>#</th>
            <th>Name</th>
            <th>Role</th>
            <th>type</th>
            <th>date</th>
            <th>time</th>
          </tr>
        </thead>
        <tbody className="text-gray-500">
          {currentItems.map((_data, i) => (
            <tr key={i}>
              <th>{indexOfFirstItem + i + 1}</th>
              <td>
                {_data.staffId?.firstname} {_data.staffId?.middlename}{" "}
                {_data.staffId?.lastname}
              </td>
              <td>{_data.staffId?.position}</td>
              <td>{_data.attendanceType}</td>
              <td>{_data.date.split("T")[0]}</td>
              <td>
                {new Date(_data.date).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        allData={allData}
        getCurrentItems={setCurrentItems}
        getIndexOfFirstItem={setIndexOfFirstItem}
      />
    </div>
  );
};

export default Table;
