import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, Select } from "../components/ui";
import { listDepartments } from "../services/appointments";
import { getPatient } from "../services/patients";
import { checkIn } from "../services/queue";
import type { Department } from "../types/appointment";
import type { QueuePriority } from "../types/queue";
import type { Patient } from "../types/patient";

export function QueueCheckIn() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient");
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState<QueuePriority>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (patientId) {
      getPatient(patientId).then(setPatient).catch(() => undefined);
    }
  }, [patientId]);

  if (!patientId) {
    return (
      <p className="text-sm text-slate-600">
        Pick a patient first — go to{" "}
        <Link to="/patients" className="font-medium text-accent-600 hover:text-accent-700">
          Patients
        </Link>{" "}
        and open a profile, then use "Check in" there.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department) {
      setError("A department is required before checking in.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await checkIn({ patient: patientId, department, priority });
      navigate("/queue", { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const firstError = Object.values(err.response.data).flat()[0];
        setError(typeof firstError === "string" ? firstError : "Check-in failed.");
      } else {
        setError("Check-in failed. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      {patient && (
        <p className="mb-4 text-sm text-slate-500">
          Checking in{" "}
          <span className="font-medium text-navy-900">
            {patient.first_name} {patient.last_name}
          </span>{" "}
          ({patient.patient_number})
        </p>
      )}

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="" disabled>
                  Choose a department…
                </option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as QueuePriority)}
              >
                <option value="normal">Normal</option>
                <option value="emergency">Emergency</option>
              </Select>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <div>
              <Button type="submit" isLoading={submitting}>
                {submitting ? "Checking in…" : "Check in"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
