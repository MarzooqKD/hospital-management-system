import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button, Card, Input, Select } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { STAFF_ROLE_OPTIONS } from "../types/auth";

const loginSchema = z.object({
  role: z.string().min(1, "Select your role"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const ROLE_LABELS = Object.fromEntries(
  STAFF_ROLE_OPTIONS.map((option) => [option.value, option.label]),
);

const MODULE_HIGHLIGHTS = ["Patient records", "Appointments", "Laboratory", "Pharmacy"];

export function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setLoginError(null);
    try {
      const currentUser = await login(values.email, values.password);
      if (currentUser.role?.name !== values.role) {
        await logout();
        setLoginError(
          `This account isn't registered as ${ROLE_LABELS[values.role]}. Check your ` +
            "role selection, or contact your hospital administrator if this seems wrong.",
        );
        return;
      }
      navigate("/", { replace: true });
    } catch {
      setLoginError("Incorrect email or password.");
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-50">
      {/* Illustration panel — hidden on small screens, per the redesign brief's split layout. */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-navy-950 px-10 py-10 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-navy-700/40 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
            <Building2 className="h-5 w-5 text-navy-900" />
          </div>
          <span className="text-sm font-semibold text-white">Hospital Management System</span>
        </div>

        <div className="relative flex flex-col items-center gap-8 text-center">
          <svg aria-hidden="true" viewBox="0 0 280 32" className="h-6 w-56 text-accent-400">
            <polyline
              points="0,16 46,16 60,4 74,28 88,16 102,16 116,8 130,24 144,16 280,16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="relative rounded-2xl bg-white p-7 shadow-xl shadow-black/20">
            <Building2 className="h-16 w-16 text-navy-900" strokeWidth={1.5} />
            <div className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 shadow-md">
              <HeartPulse className="h-4 w-4 text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-semibold text-balance text-white">Care, coordinated.</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm text-slate-300">
              Patients, appointments and records managed together in one secure
              workspace.
            </p>
          </div>
        </div>

        <div className="relative flex flex-wrap justify-center gap-2">
          {MODULE_HIGHLIGHTS.map((label) => (
            <span
              key={label}
              className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm p-8 shadow-xl shadow-slate-900/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Hospital Management System</p>
              <p className="text-xs text-slate-500">Staff portal</p>
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-semibold text-navy-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Select
              label="Role"
              defaultValue=""
              error={errors.role?.message}
              {...register("role")}
            >
              <option value="" disabled>
                Select your role…
              </option>
              {STAFF_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Input
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="name@hospital.gh"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register("email")}
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                leftIcon={<Lock className="h-4 w-4" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Hide characters" : "Show characters"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                error={errors.password?.message}
                {...register("password")}
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-accent-600 hover:text-accent-700"
                  onClick={() => setShowForgotHelp((v) => !v)}
                >
                  Forgot password?
                </button>
              </div>
              {showForgotHelp && (
                <p className="mt-2 text-sm text-slate-500">
                  Staff accounts are managed by your Hospital or System Administrator — contact
                  them to reset your password.
                </p>
              )}
            </div>

            {loginError && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure, encrypted connection
          </p>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Need access? Contact your hospital administrator.
        </p>
      </div>
    </main>
  );
}
