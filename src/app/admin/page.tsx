import KincstartoMenu from "@/app/KincstartoMenu";

export const metadata = {
  title: "Kincstartó · Admin főmenü",
};

export default function AdminHomePage() {
  // AdminLayout and proxy.ts both enforce the signed administrator session.
  return <KincstartoMenu adminMode />;
}
