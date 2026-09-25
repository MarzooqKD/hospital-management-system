import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppLayout } from "./layouts/AppLayout";
import { AdmissionsBoard } from "./pages/AdmissionsBoard";
import { AppointmentBook } from "./pages/AppointmentBook";
import { AppointmentList } from "./pages/AppointmentList";
import { Dashboard } from "./pages/Dashboard";
import { DesignSystem } from "./pages/DesignSystem";
import { InventoryPage } from "./pages/InventoryPage";
import { LabWorklist } from "./pages/LabWorklist";
import { Login } from "./pages/Login";
import { ManageBeds } from "./pages/ManageBeds";
import { PatientDetail } from "./pages/PatientDetail";
import { PatientList } from "./pages/PatientList";
import { PatientRegister } from "./pages/PatientRegister";
import { PharmacyWorklist } from "./pages/PharmacyWorklist";
import { QueueBoard } from "./pages/QueueBoard";
import { QueueCheckIn } from "./pages/QueueCheckIn";
import { ReferralsBoard } from "./pages/ReferralsBoard";
import { VisitWorkspace } from "./pages/VisitWorkspace";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RequireModule } from "./routes/RequireModule";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Internal style guide for the redesign — not linked from nav,
              not behind auth. Remove once every page has been rebuilt. */}
          <Route path="/design-system" element={<DesignSystem />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/patients"
              element={
                <RequireModule module="patients">
                  <PatientList />
                </RequireModule>
              }
            />
            <Route
              path="/patients/new"
              element={
                <RequireModule module="patients">
                  <PatientRegister />
                </RequireModule>
              }
            />
            <Route
              path="/patients/:id"
              element={
                <RequireModule module="patients">
                  <PatientDetail />
                </RequireModule>
              }
            />
            <Route
              path="/appointments"
              element={
                <RequireModule module="appointments">
                  <AppointmentList />
                </RequireModule>
              }
            />
            <Route
              path="/appointments/book"
              element={
                <RequireModule module="appointments">
                  <AppointmentBook />
                </RequireModule>
              }
            />
            <Route
              path="/queue"
              element={
                <RequireModule module="queue">
                  <QueueBoard />
                </RequireModule>
              }
            />
            <Route
              path="/queue/check-in"
              element={
                <RequireModule module="queue">
                  <QueueCheckIn />
                </RequireModule>
              }
            />
            <Route
              path="/visits/:visitId"
              element={
                <RequireModule module="queue">
                  <VisitWorkspace />
                </RequireModule>
              }
            />
            <Route
              path="/laboratory"
              element={
                <RequireModule module="laboratory">
                  <LabWorklist />
                </RequireModule>
              }
            />
            <Route
              path="/pharmacy"
              element={
                <RequireModule module="pharmacy">
                  <PharmacyWorklist />
                </RequireModule>
              }
            />
            <Route
              path="/inventory"
              element={
                <RequireModule module="inventory">
                  <InventoryPage />
                </RequireModule>
              }
            />
            <Route
              path="/admissions"
              element={
                <RequireModule module="admissions">
                  <AdmissionsBoard />
                </RequireModule>
              }
            />
            <Route
              path="/admissions/beds"
              element={
                <RequireModule module="admissions">
                  <ManageBeds />
                </RequireModule>
              }
            />
            <Route
              path="/referrals"
              element={
                <RequireModule module="referrals">
                  <ReferralsBoard />
                </RequireModule>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
