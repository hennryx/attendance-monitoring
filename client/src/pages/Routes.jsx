import React, { useEffect, useState } from 'react';
import { Route, Routes as Switch, useLocation } from 'react-router-dom';
import NotFound from './notFound';
import ROLES from './views/roles';
import Loading from '../components/loadingPage';
import RouteWrapper from './routeWrapper';
import ProtectedRoute from './protectRoutes';
import useAuthStore from '../services/stores/authStore';

const Routes = () => {
    const { role } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const routes = ROLES[role] || [];
    const location = useLocation();

    useEffect(() => {
        setLoading(!role);
    }, [role]);

    if (loading) return <Loading />;

    return (
        <Switch location={location} key={location.pathname}>
            {role && routes.map(({ path, element, children, acceptProps }, index) => {
                if (children) {
                    return children.map((child, cIndex) => (
                        <Route
                            key={`route-${index}-${cIndex}`}
                            path={child.path}
                            element={
                                <ProtectedRoute
                                    role={role}
                                    element={child.element || <NotFound />}
                                    acceptProps={child.acceptProps}
                                />
                            }
                        />
                    ));
                }

                return (
                    <Route
                        key={`route-${index}`}
                        path={path}
                        element={
                            <ProtectedRoute
                                role={role}
                                element={element || <NotFound />}
                                acceptProps={acceptProps}
                            />
                        }
                    />
                );
            })}

            <Route path="*" element={<NotFound />} />
        </Switch>
    );
};

export default Routes;
