export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-y-scroll">
      {children}
    </div>
  );
}