import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold mb-2">Página no encontrada</h2>
      <Link href="/" className="text-amber-400 underline text-sm">
        Volver al Hotel
      </Link>
    </div>
  );
}
