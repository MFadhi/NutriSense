import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Nutrition from "./pages/Nutrition";
import LabReports from "./pages/LabReports";
import Weather from "./pages/Weather";
import FoodScanner from "./pages/FoodScanner";
import Pantry from "./pages/Pantry";
import Recipes from "./pages/Recipes";
import ShoppingList from "./pages/ShoppingList";
import Settings from "./pages/Settings";
import Login from "./auth/Login";
import Register from "./auth/Register";

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="lab-reports" element={<LabReports />} />
        <Route path="weather" element={<Weather />} />
        <Route path="scanner" element={<FoodScanner />} />
        <Route path="pantry" element={<Pantry />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="shopping" element={<ShoppingList />} />
        <Route path="settings" element={<Settings />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
