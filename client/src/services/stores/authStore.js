import { create } from 'zustand';
import axiosTools from '../utilities/axiosUtils';

const tokenFromStorage = localStorage.getItem('token');

const useAuthStore = create((set, get) => ({
    auth: {},
    token: tokenFromStorage || '',
    role: null,
    email: '',
    isLoading: false,
    message: '',
    isSuccess: false,

    login: async ({ email, password }) => {
        set({ isLoading: true, message: '', isSuccess: false });
        try {
            const res = await axiosTools.login('auth/login', { email, password });
            localStorage.setItem('token', res.token);

            set({
                auth: res,
                token: res.token,
                role: res?.user?.role,
                email: res?.user?.email,
                isSuccess: true,
                isLoading: false,
                message: 'Login successful',
            });
        } catch (error) {
            set({
                isLoading: false,
                message: error?.response?.data?.message || 'Login failed',
                isSuccess: false,
            });
        }
    },

    validateToken: async () => {
        const token = get().token || localStorage.getItem('token');;
        
        if (!token) return;

        set({ isLoading: true });
        try {
            const res = await axiosTools.validateToken('auth/validateToken', token);
            const { data } = res;

            set({
                auth: data,
                role: data.role,
                email: data.email,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false, message: 'Token validation failed' });
        }
    },

    logout: async () => {
        const token = get().token;
        try {
            const message = await axiosTools.logOut('auth/logout', token);
            localStorage.removeItem('token');
            set({
                isSuccess: true,
                message: message,
            });
        } catch (error) {
            set({ message: 'Logout failed' });
        }
    },

    reset: () => {
        set({
            email: '',
            message: '',
            isSuccess: false,
        });
    },

    hardReset: () => {
        set({
            auth: {},
            token: null,
            role: null,
            email: '',
            email: '',
            message: '',
            isSuccess: false,
        });
    }
}));

export default useAuthStore;
