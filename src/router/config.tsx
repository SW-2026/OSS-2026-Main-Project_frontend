import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import LoginPage from "../pages/login/page";
import RegisterPage from "../pages/register/page";
import SettingsPage from "../pages/settings/page";
import ProjectsPage from "../pages/projects/page";
import ProtectedRoute from "../components/feature/ProtectedRoute";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/editor",
    element: <ProtectedRoute><Home /></ProtectedRoute>,
  },
  {
    path: "/settings",
    element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
  },
  {
    path: "/projects",
    element: <ProtectedRoute><ProjectsPage /></ProtectedRoute>,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
