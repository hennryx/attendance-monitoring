import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom';

import './App.css'
import useAuthStore from './services/stores/authStore';
import NotFound from './pages/notFound';
import HeroPage from './pages/home';
import Views from './pages/views';

function App() {
    const { auth, token, validateToken } = useAuthStore();

    useEffect(() => {
        if (!auth?._id && token) {
            validateToken();
        }
    }, [auth?._id, token]);

    const heroPaths = [
        '/',
        '/about-us',
        '/services',
    ];

    const urlPath = location.pathname;

    return (
        <>
            <Routes>
                {heroPaths.includes(urlPath) ? <Route path='/*' element={<HeroPage />} /> : <Route path='/*' element={<Views />} />}
                <Route path='*' element={<NotFound />} />
            </Routes>
        </>
    )
}

export default App
