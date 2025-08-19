export default function FormWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 relative min-h-[200px] h-full animate-size transition-all duration-200 ease-in-out z-20">
      {children}
    </div>
  );
}

