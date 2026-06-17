import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import CampaignDetail from "./pages/CampaignDetail";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Login from "./pages/Login";
import ReviewCampaign from "./pages/ReviewCampaign";
import ReviewQueue from "./pages/ReviewQueue";
import SubmitCampaign from "./pages/SubmitCampaign";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/submit" element={<SubmitCampaign />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/review/:campaignId" element={<ReviewCampaign />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/campaign/:campaignId" element={<CampaignDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
