import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { useCurrentUser } from './hooks';
import { homePathFor } from './api';
import { ROLE } from './constants';
import Register from './pages/Register';
import Login from './pages/Login';
import Cabinet from './pages/Cabinet';
import ApplyForm from './pages/ApplyForm';
import AdminPanel from './pages/AdminPanel';
import ConferenceEditor from './pages/ConferenceEditor';
import ApplicationReview from './pages/ApplicationReview';
import NotFound from './pages/NotFound';

function Home() {
  return <Navigate to={homePathFor(useCurrentUser())} replace />;
}

function GuestOnly() {
  const user = useCurrentUser();
  return user ? <Navigate to={homePathFor(user)} replace /> : <Outlet />;
}

function RequireRole({ role }) {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.role !== role) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route element={<GuestOnly />}>
          <Route path="register" element={<Register />} />
          <Route path="login" element={<Login />} />
        </Route>
        <Route element={<RequireRole role={ROLE.USER} />}>
          <Route path="cabinet" element={<Cabinet />} />
          <Route path="apply" element={<ApplyForm />} />
          <Route path="apply/:id" element={<ApplyForm />} />
        </Route>
        <Route element={<RequireRole role={ROLE.ADMIN} />}>
          <Route path="admin" element={<AdminPanel />} />
          <Route path="admin/conferences/new" element={<ConferenceEditor />} />
          <Route path="admin/conferences/:id" element={<ConferenceEditor />} />
          <Route path="admin/applications/:id" element={<ApplicationReview />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
