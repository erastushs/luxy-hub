import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'

export default function GetKeyPage() {
  return (
    <>
      <Navbar keyPage />

      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-xl text-center">
          <h1 className="text-5xl font-bold mb-6">Get Your Free Key</h1>

          <p className="text-zinc-400 mb-8">Complete one Work.ink offer to unlock your LuxyHub access key.</p>

          <a
            href="https://work.ink/2Dlr/luxyhub"
            className="inline-flex items-center rounded-xl bg-red-600 px-8 py-4 font-semibold transition hover:bg-red-700"
          >
            Generate Key
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
