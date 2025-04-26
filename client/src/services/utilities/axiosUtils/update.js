import axios from "axios";
import { TOKENHEADER } from "..";

const updateData = async (url, formData, token) => {
    try {
        const headers = {
            Authorization: `${TOKENHEADER} ${token}`,
        };

        if (formData instanceof FormData) {
            headers['Content-Type'] = 'multipart/form-data';
        }

        const response = await axios.put(
            url, 
            formData, 
            { headers }
        )

        return response.data;
    } catch ({ response }) {
        const { error, message } = response.data;
        throw new Error(message ? message : error);
    }
}

export default updateData;