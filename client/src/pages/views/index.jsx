import React from 'react';
import useAuthStore from '../../services/stores/authStore';
import Routes from '../Routes';
import Sidebar from '../../components/sidebar';

const Views = () => {
    const { role } = useAuthStore();
    console.log(role);

    return (
        <>
            {role !== null ? (
                <div className="flex h-screen w-screen overflow-hidden">
                    <Sidebar role={role}/>
                    <main className={`flex-1 flex flex-col bg-[#E4E9F7] overflow-hidden`}>
                        <div className="flex-1 overflow-y-auto p-4 text-black">
                            <Routes />
                        </div>
                        <p className='text-black'>Footer</p>
                    </main>
                </div>
            ) : null}
        </>
    );
};

export default Views;
