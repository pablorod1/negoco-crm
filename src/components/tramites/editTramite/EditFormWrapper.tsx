export const EditFormWrapper = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl text-[var(--primary-color-500)] font-semibold">
        {title}
      </h2>
      {children}
    </div>
  );
};
