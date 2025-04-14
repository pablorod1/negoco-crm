export default function FormWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col gap-4 relative">{children}</div>;
}
