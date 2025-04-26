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

    signup: async (item) => {
        set({ isLoading: true, message: '', isSuccess: false });
        try {
            const res = await axiosTools.register('auth/signup', { ...item });
            set({
                isSuccess: res.success,
                isLoading: false,
                message: 'Sign up successful',
            });
        } catch (error) {
            set({
                isLoading: false,
                message: error?.response?.data?.message || 'signup failed',
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
            console.log(res);
            
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
            await axiosTools.logOut('auth/logout', token);
            localStorage.removeItem('token');
            set({
                auth: {},
                token: '',
                role: null,
                email: '',
                isSuccess: false,
                message: '',
            });
        } catch (error) {
            set({ message: 'Logout failed' });
        }
    },

    reset: () => {
        set({
            auth: {},
            token: '',
            role: null,
            email: '',
            message: '',
            isSuccess: false,
        });
    }
}));

export default useAuthStore;
