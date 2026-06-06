import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'

export default function Loading() {
  return (
    <>
      <Navbar keyPage />
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
          <h1 className="mb-2 text-2xl font-bold">Verifying Token</h1>
          <p className="text-zinc-400">Please wait while we validate your Work.ink offer.</p>
        </div>
      </main>
      <Footer />
    </>
  )
}
