export default function FormWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col gap-8 relative">{children}</div>;
}
