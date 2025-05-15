/* eslint-disable no-useless-catch */
import axiosTools from "./axiosUtils";

export const uploadFile = async (endpoint, formData, token) => {
  try {
    if (!(formData instanceof FormData)) {
      const newFormData = new FormData();

      // Add all data to FormData
      Object.keys(formData).forEach((key) => {
        if (key === "files" && Array.isArray(formData[key])) {
          // Handle multiple files
          formData[key].forEach((file) => {
            newFormData.append("files", file);
          });
        } else if (key === "file" && formData[key] instanceof File) {
          // Handle single file
          newFormData.append("file", formData[key]);
        } else {
          // Handle regular data
          newFormData.append(
            key,
            typeof formData[key] === "object"
              ? JSON.stringify(formData[key])
              : formData[key]
          );
        }
      });

      formData = newFormData;
    }

    const response = await axiosTools.saveData(endpoint, formData, token);
    return response;
  } catch (error) {
    throw error;
  }
};
