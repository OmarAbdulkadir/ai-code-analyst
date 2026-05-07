import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { isLoggedIn } from "./lib/auth";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import History from "./pages/History";
import About from "./pages/About";

const Protected = ({ children }) => {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/insights"
          element={
            <Protected>
              <Insights />
            </Protected>
          }
        />
        <Route
          path="/sessions/:id"
          element={
            <Protected>
              <Insights />
            </Protected>
          }
        />
        <Route
          path="/history"
          element={
            <Protected>
              <History />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
