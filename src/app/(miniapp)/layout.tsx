export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[480px] mx-auto bg-background min-h-[100dvh] flex flex-col relative overflow-x-hidden shadow-sm">
      {children}
    </div>
  );
}
