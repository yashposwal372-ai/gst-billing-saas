import { RequireAuth } from "../../components/auth/require-auth";
import { OnboardingForm } from "../../components/onboarding/onboarding-form";

export default function Page() { return <RequireAuth><OnboardingForm /></RequireAuth>; }
