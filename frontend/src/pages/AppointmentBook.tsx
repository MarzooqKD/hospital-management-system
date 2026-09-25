import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Button, Card, CardBody, Input, Select, Textarea } from "../components/ui";
import { createAppointment, listDepartments } from "../services/appointments";
import { getPatient } from "../services/patients";
import type { Department } from "../types/appointment";
import type { Patient } from "../types/patient";

const appointmentSchema = z.object({
  department: z.string().min(1, "Select a department"),
  scheduled_at: z
    .string()
    .min(1, "Select a date and time")
    .refine((v) => new Date(v).getTime() > Date.now(), {
      message: "Appointment time cannot be in the past",
    }),
  reason: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

export function AppointmentBook() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient");
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({ resolver: zodResolver(appointmentSchema) });

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
        and open a profile, then use "Book appointment" there.
      </p>
    );
  }

  const onSubmit = async (values: AppointmentFormValues) => {
    setSubmitError(null);
    try {
      await createAppointment({
        patient: patientId,
        department: values.department,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
        reason: values.reason ?? "",
      });
      navigate("/appointments", { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const firstError = Object.values(err.response.data).flat()[0];
        setSubmitError(typeof firstError === "string" ? firstError : "Booking failed.");
      } else {
        setSubmitError("Booking failed. Check your connection and try again.");
      }
    }
  };

  return (
    <div className="max-w-xl">
      {patient && (
        <p className="mb-4 text-sm text-slate-500">
          Booking for{" "}
          <span className="font-medium text-navy-900">
            {patient.first_name} {patient.last_name}
          </span>{" "}
          ({patient.patient_number})
        </p>
      )}

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Department"
                error={errors.department?.message}
                defaultValue=""
                {...register("department")}
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
              <Input
                label="Date and time"
                type="datetime-local"
                error={errors.scheduled_at?.message}
                {...register("scheduled_at")}
              />
            </div>
            <Textarea label="Reason" rows={3} {...register("reason")} />

            {submitError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
            )}

            <div>
              <Button type="submit" isLoading={isSubmitting}>
                {isSubmitting ? "Booking…" : "Book appointment"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
