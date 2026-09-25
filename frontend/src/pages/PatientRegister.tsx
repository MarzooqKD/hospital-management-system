import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select } from "../components/ui";
import { GHANA_CARD_REGEX, isValidGhanaPhone } from "../lib/ghana";
import { createPatient } from "../services/patients";

const optionalPhone = z
  .string()
  .optional()
  .refine((v) => !v || isValidGhanaPhone(v), {
    message: "Enter a valid Ghanaian phone number, e.g. 024 123 4567",
  });

const patientSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"], { message: "Select a gender" }),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine(isValidGhanaPhone, {
      message: "Enter a valid Ghanaian phone number, e.g. 024 123 4567",
    }),
  alt_phone: optionalPhone,
  ghana_card_number: z
    .string()
    .optional()
    .refine((v) => !v || GHANA_CARD_REGEX.test(v), {
      message: "Format: GHA-XXXXXXXXX-X",
    }),
  nhis_number: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address",
    }),
  address_region: z.string().optional(),
  address_district: z.string().optional(),
  address_town: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: optionalPhone,
  emergency_contact_relationship: z.string().optional(),
  blood_group: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export function PatientRegister() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: { gender: "female" },
  });

  const onSubmit = async (values: PatientFormValues) => {
    setSubmitError(null);
    try {
      const patient = await createPatient(values);
      navigate(`/patients/${patient.id}`, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const firstError = Object.values(err.response.data).flat()[0];
        setSubmitError(typeof firstError === "string" ? firstError : "Registration failed.");
      } else {
        setSubmitError("Registration failed. Check your connection and try again.");
      }
    }
  };

  return (
    <div className="max-w-3xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First name" required error={errors.first_name?.message} {...register("first_name")} />
            <Input label="Last name" required error={errors.last_name?.message} {...register("last_name")} />
            <Input
              label="Date of birth"
              type="date"
              required
              error={errors.date_of_birth?.message}
              {...register("date_of_birth")}
            />
            <Select label="Gender" {...register("gender")}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
            <Select label="Blood group" defaultValue="unknown" {...register("blood_group")}>
              {["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                <option key={bg} value={bg}>
                  {bg === "unknown" ? "Unknown" : bg}
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Phone"
              required
              placeholder="024 123 4567"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <Input
              label="Alternate phone"
              placeholder="Optional"
              error={errors.alt_phone?.message}
              {...register("alt_phone")}
            />
            <Input label="Email" placeholder="Optional" error={errors.email?.message} {...register("email")} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Ghana Card number"
              placeholder="GHA-XXXXXXXXX-X"
              error={errors.ghana_card_number?.message}
              {...register("ghana_card_number")}
            />
            <Input label="NHIS number" placeholder="Optional" {...register("nhis_number")} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Region" {...register("address_region")} />
            <Input label="District" {...register("address_district")} />
            <Input label="Town" {...register("address_town")} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emergency contact</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Name" {...register("emergency_contact_name")} />
            <Input
              label="Contact's phone"
              error={errors.emergency_contact_phone?.message}
              {...register("emergency_contact_phone")}
            />
            <Input
              label="Relationship"
              placeholder="e.g. Spouse"
              {...register("emergency_contact_relationship")}
            />
          </CardBody>
        </Card>

        {submitError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
        )}

        <div>
          <Button type="submit" size="lg" isLoading={isSubmitting}>
            {isSubmitting ? "Registering…" : "Register patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}
