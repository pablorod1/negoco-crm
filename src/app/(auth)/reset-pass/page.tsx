import ResetPassWrapper from "@/core/components/auth/reset-pass/ResetPassWrapper";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPassWrapper token={params.token || ""} />;
}
