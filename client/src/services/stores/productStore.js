// client/src/stores/productStore.js
import { create } from 'zustand';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/products';

const useProductStore = create((set, get) => ({
  products: [],
  product: null,
  isLoading: false,
  error: null,
  
  // Get authorization header
  getAuthHeader: () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  },
  
  // Get all products
  getProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(API_URL, get().getAuthHeader());
      
      if (response.data.success) {
        set({
          products: response.data.data,
          isLoading: false
        });
      }
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Could not fetch products',
        isLoading: false
      });
    }
  },
  
  // Get single product
  getProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(`${API_URL}/${id}`, get().getAuthHeader());
      
      if (response.data.success) {
        set({
          product: response.data.data,
          isLoading: false
        });
      }
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Could not fetch product',
        isLoading: false
      });
    }
  },
  
  // Create product
  createProduct: async (productData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(API_URL, productData, get().getAuthHeader());
      
      if (response.data.success) {
        set((state) => ({
          products: [...state.products, response.data.data],
          isLoading: false
        }));
        return true;
      }
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Could not create product',
        isLoading: false
      });
      return false;
    }
  },
  
  // Update product
  updateProduct: async (id, productData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.put(`${API_URL}/${id}`, productData, get().getAuthHeader());
      
      if (response.data.success) {
        set((state) => ({
          products: state.products.map(product => 
            product._id === id ? response.data.data : product
          ),
          product: response.data.data,
          isLoading: false
        }));
        return true;
      }
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Could not update product',
        isLoading: false
      });
      return false;
    }
  },
  
  // Delete product
  deleteProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.delete(`${API_URL}/${id}`, get().getAuthHeader());
      
      if (response.data.success) {
        set((state) => ({
          products: state.products.filter(product => product._id !== id),
          isLoading: false
        }));
        return true;
      }
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Could not delete product',
        isLoading: false
      });
      return false;
    }
  },
  
  // Clear errors
  clearError: () => set({ error: null })
}));

export default useProductStore;