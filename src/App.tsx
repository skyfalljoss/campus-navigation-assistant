/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/Map";
import SavedPage from "./pages/Saved";
import ProfilePage from "./pages/Profile";
import SettingsPage from "./pages/Settings";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Fallback routes for demo purposes */}
          <Route path="*" element={
            <div className="flex-1 flex items-center justify-center">
              <p className="text-on-surface-variant font-headline text-xl">Coming Soon</p>
            </div>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

