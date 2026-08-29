import type { Metadata } from "next";
import { LoginCard } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion — pc store 39",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ guard?: string }>;
}) {
  const params = await searchParams;
  const guardMsg =
    params.guard === "admin"
      ? "Accès réservé à l'administrateur."
      : params.guard === "auth"
        ? "Veuillez vous connecter pour continuer."
        : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7f2] px-6 py-14">
      <LoginCard guardMsg={guardMsg} />
    </div>
  );
}
